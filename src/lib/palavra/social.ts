// Palavra on Nostr: what gets read.
//
// Every social view is assembled here from relay queries — there is no server
// endpoint behind any of it. That keeps the whole social graph portable and
// self-owned, at one cost worth stating plainly: a query only ever reaches the
// relays this client asks, so a "global" ranking is really "everyone this
// client can see". For the views scoped to a known set of people (duels,
// leagues) relayList.ts closes most of that gap by asking each person's own
// write relays. For the open daily board it cannot — nobody knows who to look
// for until the events come back.

import type { NostrEvent } from '@nostrify/nostrify';
import { pool } from '@/lib/pool';
import { KIND_APP_STATE, RELAY_QUERY_TIMEOUT_MS, fetchProfileCards } from '@/lib/nostr';
import { relaysForAuthors } from '@/lib/relayList';
import { formatUTCDate } from '@/lib/format';
import { PALAVRA_TOPIC, resultDTag } from './nostr';
import { meetsPow } from './pow';
import { DUEL_DAYS, MAX_GUESSES, type LeaderboardEntry } from './types';

const KIND_CONTACTS = 3;

/** Enough that a normal follow list is covered whole, small enough that the
    filter stays inside what relays accept. */
const MAX_FOLLOWS = 300;

/** Roughly thirty years of consecutive days. High enough never to clip a real
    player, low enough that a fabricated number is obviously refused rather
    than printed. */
const MAX_DECLARED_STREAK = 11_000;

function tagValue(event: { tags: string[][] }, name: string): string | undefined {
    return event.tags.find((tag) => tag[0] === name)?.[1];
}

/**
 * Read one published result.
 *
 * Every number here is self-reported. The server issues puzzles and nothing
 * else, so nobody countersigns a result and there is no way to tell a real
 * one from a fabricated one. What is enforced is the NIP-13 proof of work on
 * the event id: that makes minting a thousand fake entries expensive, without
 * pretending to say anything about whether any single one is honest.
 */
export function entriesFromEvents(events: NostrEvent[], date: string): LeaderboardEntry[] {
    return events.flatMap((event) => {
        if (tagValue(event, 'date') !== date) return [];
        // The spam gate. An unmined event is not listed — see pow.ts for what
        // this does and does not buy.
        if (!meetsPow(event.id)) return [];
        try {
            const { tries, solved, ms, streak } = JSON.parse(event.content) as Record<string, unknown>;
            if (!Number.isInteger(tries) || (tries as number) < 1 || (tries as number) > MAX_GUESSES) return [];
            if (typeof solved !== 'boolean') return [];
            if (!Number.isFinite(ms) || (ms as number) < 0) return [];
            // Bounded rather than trusted. It is a self-declared number from a
            // stranger's event: anything absurd is dropped instead of being
            // rendered, which is the cheapest defence against a board topped
            // by someone claiming nine thousand days.
            const declared = Number.isInteger(streak) && (streak as number) >= 0
                && (streak as number) <= MAX_DECLARED_STREAK
                ? streak as number
                : undefined;
            return [{
                pubkey: event.pubkey,
                tries: tries as number,
                solved,
                ms: ms as number,
                ...(declared === undefined ? {} : { streak: declared }),
            }];
        } catch {
            return [];
        }
    });
}

export type RankableResult = Pick<LeaderboardEntry, 'tries' | 'solved' | 'ms'>;

/** Solved first, then fewer guesses, then faster. */
export function rank(a: RankableResult, b: RankableResult): number {
    if (a.solved !== b.solved) return a.solved ? -1 : 1;
    if (a.tries !== b.tries) return a.tries - b.tries;
    // ms 0 means no duration was recorded — formatDuration already renders it
    // as "—". Subtracting straight through would sort those rows to the top of
    // the speed ranking, which is both wrong and the cheapest thing to forge.
    if ((a.ms <= 0) !== (b.ms <= 0)) return a.ms <= 0 ? 1 : -1;
    return a.ms - b.ms;
}

/** Attach display names, keyed by pubkey. Rows whose author has no profile
    keep `name` undefined and are shown by a shortened key instead. */
export async function withNames<T extends { pubkey: string }>(
    rows: T[],
): Promise<(T & { name?: string; picture?: string })[]> {
    const cards = await fetchProfileCards(rows.map((row) => row.pubkey));
    return rows.map((row) => ({ ...row, ...(cards.get(row.pubkey) ?? {}) }));
}

/**
 * Today's ranking, from whoever this client can see.
 *
 * Addressable events mean one per author per day, and the pool resolves them
 * across relays, so there is nothing to deduplicate here.
 */
export async function fetchDailyLeaderboard(date: string, limit = 50): Promise<LeaderboardEntry[]> {
    let events: NostrEvent[];
    try {
        events = await pool.query(
            [{ kinds: [KIND_APP_STATE], '#d': [resultDTag(date)], '#t': [PALAVRA_TOPIC], limit: 200 }],
            { signal: AbortSignal.timeout(RELAY_QUERY_TIMEOUT_MS) },
        );
    } catch (error) {
        console.warn('Could not load the Palavra leaderboard.', error);
        return [];
    }

    const rows = entriesFromEvents(events, date).sort(rank).slice(0, limit);
    return withNames(rows);
}

/**
 * The standing streak board.
 *
 * Two days of results, not a scan of history. Each result declares its
 * author's streak, so the length of a streak costs nothing to read — a
 * thousand days is the same one query as three.
 *
 * Two days rather than one because a streak is alive until a day is missed:
 * someone who played yesterday and hasn't opened the app yet today still has
 * theirs. Anyone whose newest result is older than that has broken it and
 * simply isn't here. Their own record still shows it — this board is who is
 * currently running, not who ever ran.
 *
 * Newest result per author wins, so today's number replaces yesterday's.
 */
export async function fetchStreakLeaderboard(limit = 50): Promise<LeaderboardEntry[]> {
    const dates = recentDates(2);
    let events: NostrEvent[];
    try {
        events = await pool.query(
            [{
                kinds: [KIND_APP_STATE],
                '#d': dates.map(resultDTag),
                '#t': [PALAVRA_TOPIC],
                limit: 400,
            }],
            { signal: AbortSignal.timeout(RELAY_QUERY_TIMEOUT_MS) },
        );
    } catch (error) {
        console.warn('Could not load the streak board.', error);
        return [];
    }

    // One row per author, from their latest *day*.
    //
    // Ordered by the `date` tag, not by `created_at`. The timestamp is chosen
    // by the author, and mining perturbs it besides: proof-of-work searches
    // over `created_at` as well as the nonce, so a day mined for longer can
    // come out with a later stamp than the day after it. Observed exactly
    // that while testing — yesterday's event stamped a second ahead of
    // today's, which handed the row a stale streak. `dates` is newest-first,
    // so the first entry found for an author is the right one.
    const claimed = liveStreaks(events, dates, limit);

    // Rank on what the relays back up, not on what was claimed. An unbacked
    // claim doesn't win by being loud: it falls below every verified streak,
    // however long it says it is.
    const verified = await verifiedStreaks(claimed, dates[0]);
    const rows = claimed
        .map((entry) => ({ ...entry, verified: verified.has(entry.pubkey) }))
        .sort((a, b) => Number(b.verified) - Number(a.verified)
            || (b.streak ?? 0) - (a.streak ?? 0)
            || rank(a, b));
    return withNames(rows);
}

/**
 * The rows a streak board should show, from a batch of recent result events.
 *
 * Pure, and separated from the query so the rule can be tested: whoever's
 * latest day it is holds the slot, and only then is it asked whether that day
 * qualifies. Doing it the other way round — skipping losses while choosing —
 * promotes the author's previous day into the slot, and their previous day is
 * the one before they broke the run. A dead streak would read as live.
 */
export function liveStreaks(
    events: NostrEvent[],
    dates: string[],
    limit = 50,
): LeaderboardEntry[] {
    const newest = new Map<string, LeaderboardEntry>();
    for (const date of dates) {
        for (const entry of entriesFromEvents(events, date)) {
            if (!newest.has(entry.pubkey)) newest.set(entry.pubkey, entry);
        }
    }

    return [...newest.values()]
        // A run, on the latest day that author played. A loss ends it, and a
        // zero is a run of nothing — neither belongs on a board of streaks
        // still going, which is what the empty state promises.
        .filter((entry) => entry.solved && (entry.streak ?? 0) > 0)
        .sort((a, b) => (b.streak ?? 0) - (a.streak ?? 0))
        .slice(0, limit);
}

/** Days sampled inside a claimed streak. Four is enough that a fabricated
    claim almost never survives, and cheap enough to check the whole board in
    one query. */
const STREAK_SAMPLES = 4;

/**
 * Which claimed streaks the relays actually back up.
 *
 * A streak is a claim about the past, and the past is already on the relays:
 * each day is its own addressable event, so a real 400-day streak is 400
 * signed, proof-of-work-mined events under one key. Nothing needs storing to
 * check that — it just needs asking.
 *
 * Asking for all of them would be 400 events per player, so this samples:
 * a few days spread across the claimed range, always including the oldest,
 * which is the one a fabricated claim is least likely to have. A missing
 * sample refutes the claim outright.
 *
 * What this buys, precisely: declaring a number you didn't earn stops working.
 * Faking it now means actually publishing a result for every sampled day, and
 * since you can't know which days get sampled, that means all of them — each
 * one mined. A 1,000-day streak becomes 1,000 proofs of work.
 *
 * What it does not buy: `created_at` is chosen by the author, so someone
 * patient can still mine and backdate a whole history today. Proving an event
 * is genuinely old needs an external timestamp — NIP-03's OpenTimestamps
 * attestation is the Nostr-native answer, and it is not implemented here.
 */
async function verifiedStreaks(
    rows: LeaderboardEntry[],
    endingOn: string,
): Promise<Set<string>> {
    const wanted = new Map<string, string[]>();
    for (const row of rows) {
        if (!row.streak) continue;
        wanted.set(row.pubkey, sampleDays(endingOn, row.streak));
    }
    if (wanted.size === 0) return new Set();

    const dTags = [...new Set([...wanted.values()].flat())].map(resultDTag);
    let events: NostrEvent[];
    try {
        // One query for the whole board: every author, every sampled day. The
        // author and the `date` tag on each event say which claim it belongs
        // to, so they don't need separating first.
        events = await pool.query(
            [{ kinds: [KIND_APP_STATE], authors: [...wanted.keys()], '#d': dTags, limit: 1000 }],
            { signal: AbortSignal.timeout(RELAY_QUERY_TIMEOUT_MS) },
        );
    } catch (error) {
        // Unreachable relays are not evidence of lying. Nothing is marked
        // verified, and the board says as much rather than accusing anyone.
        console.warn('Could not check the streak claims.', error);
        return new Set();
    }

    const solvedDays = new Map<string, Set<string>>();
    for (const event of events) {
        if (!meetsPow(event.id)) continue;
        const date = tagValue(event, 'date');
        if (!date) continue;
        try {
            const { solved } = JSON.parse(event.content) as Record<string, unknown>;
            if (solved !== true) continue;
        } catch { continue; }
        const days = solvedDays.get(event.pubkey) ?? new Set<string>();
        days.add(date);
        solvedDays.set(event.pubkey, days);
    }

    const verified = new Set<string>();
    for (const [pubkey, sampled] of wanted) {
        const days = solvedDays.get(pubkey);
        if (days && sampled.every((day) => days.has(day))) verified.add(pubkey);
    }
    return verified;
}

/** Days to sample from a claimed streak: the oldest, the newest, and an even
    spread between. Fewer than that when the streak is short enough to check
    outright. */
function sampleDays(endingOn: string, streak: number): string[] {
    const end = Date.parse(`${endingOn}T00:00:00Z`);
    const span = Math.min(streak, MAX_DECLARED_STREAK);
    const offsets = span <= STREAK_SAMPLES
        ? Array.from({ length: span }, (_, i) => i)
        : Array.from({ length: STREAK_SAMPLES }, (_, i) =>
            Math.round((i * (span - 1)) / (STREAK_SAMPLES - 1)));
    return [...new Set(offsets)].map((back) =>
        formatUTCDate(new Date(end - back * 86_400_000)));
}

/** The pubkeys this identity follows, from their kind-3 contact list. */
export async function fetchFollows(pubkey: string): Promise<string[]> {
    try {
        const [contacts] = await pool.query(
            [{ kinds: [KIND_CONTACTS], authors: [pubkey], limit: 1 }],
            { signal: AbortSignal.timeout(RELAY_QUERY_TIMEOUT_MS) },
        );
        if (!contacts) return [];
        // Capped: a contact list can run to thousands, and every pubkey here
        // becomes an `authors` entry in a relay filter and a NIP-65 lookup.
        // Past a point relays start rejecting the filter outright, which
        // turns a big follow list into no duels at all.
        return [...new Set(
            contacts.tags
                .filter((tag) => tag[0] === 'p' && /^[0-9a-f]{64}$/i.test(tag[1] ?? ''))
                .map((tag) => tag[1]),
        )].slice(0, MAX_FOLLOWS);
    } catch (error) {
        console.warn('Could not load the contact list.', error);
        return [];
    }
}

export interface DuelRecord {
    pubkey: string;
    name?: string;
    picture?: string;
    wins: number;
    losses: number;
    draws: number;
    /** Days both players finished — wins + losses + draws. */
    played: number;
}

/** Recent dates, newest first, as UTC YYYY-MM-DD — the same day-keys the
    puzzles and result events are tagged with. */
export function recentDates(days: number, from = new Date()): string[] {
    return Array.from({ length: days }, (_, i) => {
        const date = new Date(from);
        // UTC arithmetic to match UTC formatting — stepping local days and
        // then formatting as UTC would skip or repeat a date for anyone not
        // on UTC, and around a DST change even for those who are.
        date.setUTCDate(date.getUTCDate() - i);
        return formatUTCDate(date);
    });
}

/**
 * Head-to-head over the last month against everyone this identity follows.
 *
 * Only days *both* played count. Someone who plays daily would otherwise rack
 * up wins against a friend who plays twice a month purely by showing up, which
 * makes the record a measure of attendance rather than of the duel.
 */
export async function fetchDuels(pubkey: string, days = DUEL_DAYS): Promise<DuelRecord[]> {
    const follows = await fetchFollows(pubkey);
    if (follows.length === 0) return [];

    const dates = recentDates(days);
    const authors = [pubkey, ...follows];
    // Ask each opponent's own write relays as well as ours — otherwise the
    // people most worth duelling are exactly the ones who look inactive.
    const relays = await relaysForAuthors(follows);

    let events: NostrEvent[];
    try {
        events = await pool.query(
            [{ kinds: [KIND_APP_STATE], authors, '#d': dates.map(resultDTag) }],
            { signal: AbortSignal.timeout(RELAY_QUERY_TIMEOUT_MS), relays },
        );
    } catch (error) {
        console.warn('Could not load duel results.', error);
        return [];
    }

    // pubkey → date → result
    const byAuthor = new Map<string, Map<string, LeaderboardEntry>>();
    for (const event of events) {
        const date = tagValue(event, 'date');
        if (!date || !dates.includes(date)) continue;
        const [entry] = entriesFromEvents([event], date);
        if (!entry) continue;
        if (!byAuthor.has(event.pubkey)) byAuthor.set(event.pubkey, new Map());
        byAuthor.get(event.pubkey)!.set(date, entry);
    }

    const mine = byAuthor.get(pubkey);
    if (!mine || mine.size === 0) return [];

    const records: DuelRecord[] = [];
    for (const opponent of follows) {
        const theirs = byAuthor.get(opponent);
        if (!theirs || theirs.size === 0) continue;

        let wins = 0, losses = 0, draws = 0;
        for (const [date, me] of mine) {
            const them = theirs.get(date);
            if (!them) continue;
            const verdict = rank(me, them);
            if (verdict < 0) wins++;
            else if (verdict > 0) losses++;
            else draws++;
        }
        if (wins + losses + draws > 0) {
            records.push({ pubkey: opponent, wins, losses, draws, played: wins + losses + draws });
        }
    }

    records.sort((a, b) => b.played - a.played || b.wins - a.wins);
    return withNames(records);
}
