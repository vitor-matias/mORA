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
import { MAX_GUESSES, type LeaderboardEntry } from './types';

const KIND_CONTACTS = 3;

/** How far back the head-to-head record reaches. */
const DUEL_DAYS = 30;

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
            const { tries, solved, ms } = JSON.parse(event.content) as Record<string, unknown>;
            if (!Number.isInteger(tries) || (tries as number) < 1 || (tries as number) > MAX_GUESSES) return [];
            if (typeof solved !== 'boolean') return [];
            if (!Number.isFinite(ms) || (ms as number) < 0) return [];
            return [{ pubkey: event.pubkey, tries: tries as number, solved, ms: ms as number }];
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
    return a.ms - b.ms;
}

/** Attach display names, keyed by pubkey. Rows whose author has no profile
    keep `name` undefined and are shown by a shortened key instead. */
async function withNames<T extends { pubkey: string }>(
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

/** The pubkeys this identity follows, from their kind-3 contact list. */
export async function fetchFollows(pubkey: string): Promise<string[]> {
    try {
        const [contacts] = await pool.query(
            [{ kinds: [KIND_CONTACTS], authors: [pubkey], limit: 1 }],
            { signal: AbortSignal.timeout(RELAY_QUERY_TIMEOUT_MS) },
        );
        if (!contacts) return [];
        return [...new Set(
            contacts.tags
                .filter((tag) => tag[0] === 'p' && /^[0-9a-f]{64}$/i.test(tag[1] ?? ''))
                .map((tag) => tag[1]),
        )];
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

/** Recent dates, newest first, as local YYYY-MM-DD — the same day-keys the
    result events are tagged with. */
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
