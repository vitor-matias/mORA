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
import {
    KIND_APP_STATE,
    RELAY_QUERY_TIMEOUT_MS,
    fetchProfileCards,
    queryComplete,
    toProfileCard,
} from '@/lib/nostr';
import { currentPubkey, useAuthStore } from '@/store/auth';
import { relaysForAuthors } from '@/lib/relayList';
import { formatUTCDate } from '@/lib/format';
import {
    PALAVRA_TOPIC,
    countPerGroup,
    entriesFromEvents,
    filtersFor,
    inGroupsOf,
    newestPerDay,
    resultDTag,
    tagValue,
} from './results';
import { liveThrough, monthDays, tallyMonth, type DatedResult, type MonthlyEntry } from './scoring';
import { DUEL_DAYS, type LeaderboardEntry } from './types';

const KIND_CONTACTS = 3;

/** Enough that a normal follow list is covered whole, small enough that the
    filter stays inside what relays accept. */
const MAX_FOLLOWS = 300;

// Re-exported so the boards, the leagues module and the tests keep importing
// the reader from here. It lives in results.ts because the badge job in
// server/palavra needs the same gate and cannot import this file — see the
// note at the top of results.ts.
export { entriesFromEvents };

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

    // Your own row falls back to the profile this device already holds.
    //
    // Profile lookups go to the app's own relays with no outbox routing, so a
    // kind-0 published from another client to another relay set simply isn't
    // found — and the row it fails to find most visibly is your own, because
    // you are the one person who knows what should be there. The app fetched
    // your profile at sign-in; there is no reason to make the leaderboard ask
    // the network again for something it is already holding.
    const me = currentPubkey();
    if (me) {
        const own = toProfileCard(useAuthStore.getState().profile);
        if (own) {
            // Field by field, not all-or-nothing. The first version of this
            // only filled in a *missing* card, which is the case that doesn't
            // happen: the relays usually do have a kind-0, so the name arrived
            // and the fallback was skipped — leaving exactly the symptom it
            // was written to fix, a name with no picture beside it.
            const found = cards.get(me);
            cards.set(me, {
                name: found?.name ?? own.name,
                picture: found?.picture ?? own.picture,
            });
        }
    }

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

/** Days per filter in the monthly query, and how many events each may return.
    Split rather than asked for in one go because a relay that truncates
    returns its newest events — one filter over thirty-one days would drop the
    start of the month for everybody, quietly, and only once the month got
    busy. A filter per week can only ever truncate that week. */
const MONTH_CHUNK_DAYS = 7;
const MONTH_CHUNK_LIMIT = 500;

/** The budget a single day gets when its week came back full and has to be
    read again. Deliberately the daily board's own limit, so a day goes short
    here exactly when it would go short there — no failure mode the rest of
    the app doesn't already have. */
const MONTH_DAY_LIMIT = 200;

function queryDays(groups: string[][], limit: number) {
    return queryComplete(filtersFor(groups, limit), {
        signal: AbortSignal.timeout(RELAY_QUERY_TIMEOUT_MS),
    });
}

/** A month's events, and whether the reads behind them were whole. `partial`
    covers both ways a month can come back short: a relay that never finished
    answering, and a day busier than one query can return. */
interface MonthEvents {
    events: NostrEvent[];
    partial: boolean;
}

/**
 * Every result event for a month, re-reading any week that came back full.
 *
 * A filter that returns its whole limit is a filter that may have been cut
 * short, and truncation keeps the *newest* events — so a busy week silently
 * loses its earliest days, the board still renders, and the total is quietly
 * wrong. That is the worst shape a bug can take on a ranking, and worst of all
 * at month end, which is when a podium is read off it.
 *
 * So a full week is not trusted: it is asked for again a day at a time, where
 * each day gets the daily board's own budget. Costs one extra round trip, only
 * for the weeks that need it, and only once the game is busy enough to have
 * the problem at all.
 *
 * A day that *still* comes back full is past what this can fix by narrowing —
 * there is nothing smaller than a day to split into — so it is reported rather
 * than passed off as complete.
 *
 * The other way a month comes back short needs no filter at all: a relay that
 * never answers. `pool.query` cannot say when that happened — it returns what
 * arrived — so the reads go through queryComplete, and a read no relay finished
 * is reported the same way a saturated day is. A ranking missing whole players
 * is the worst shape a bug can take here, and it is worse still for being
 * indistinguishable from a quiet month.
 */
async function fetchMonthEvents(days: string[]): Promise<MonthEvents> {
    const short = ({ answered, asked }: { answered: number; asked: number }) => {
        if (answered === asked) return false;
        console.warn(
            `Only ${answered} of ${asked} relays finished answering the monthly read. `
            + 'Any results only the others hold are missing, so the totals are a floor.',
        );
        return true;
    };

    const weeks = inGroupsOf(days, MONTH_CHUNK_DAYS);
    const first = await queryDays(weeks, MONTH_CHUNK_LIMIT);
    const firstShort = short(first);

    const perWeek = countPerGroup(first.events, weeks);
    const full = weeks.filter((_, index) => perWeek[index] >= MONTH_CHUNK_LIMIT);
    // Resolved even on the single-read path. queryComplete deduplicates by
    // event id and nothing more — it is not pool.query, and does not collapse
    // addressable coordinates — so one read can return two versions of the
    // same result, and tallyMonth keeps whichever arrived first. A stale loss
    // ahead of its replacement scores 0 where the replacement scores up to 6.
    if (full.length === 0) {
        return { events: newestPerDay(first.events), partial: firstShort };
    }

    const singles = full.flat().map((day) => [day]);
    const rest = await queryDays(singles, MONTH_DAY_LIMIT);
    const restShort = short(rest);

    const perDay = countPerGroup(rest.events, singles);
    const stillFull = singles
        .filter((_, index) => perDay[index] >= MONTH_DAY_LIMIT)
        .flat();
    if (stillFull.length > 0) {
        console.warn(
            'The monthly ranking may be missing results for '
            + `${stillFull.join(', ')}: more were published on those days than a `
            + 'single relay query returns. Totals for them are a floor, not a count.',
        );
    }

    // Both reads together, resolved across the pair as well as within each.
    // queryComplete resolves neither, and a result replayed between the two
    // reads arrives once in each, so the tally would keep the older copy. See
    // newestPerDay.
    return {
        events: newestPerDay([...first.events, ...rest.events]),
        partial: firstShort || restShort || stillFull.length > 0,
    };
}

/**
 * A month's points ranking — the standing board.
 *
 * Summed from the results themselves, not from a number anyone declared. That
 * is the whole reason the season is a calendar month: a month is at most
 * thirty-one addressable day keys, which is the same order as the query duels
 * already run, so the total can be *computed* from signed events rather than
 * claimed in one. Nothing here needs the sampling defence the streak board
 * needed, because there is no claim to refute — the points are arithmetic over
 * events the relays either hold or don't.
 *
 * The one thing this inherits unchanged: a result is still whatever its author
 * published. Proof of work prices bulk fabrication, and a single inflated
 * guess count is as cheap here as it is on the daily board. What changed is
 * that lying now costs one mined event per day lied about.
 *
 * `partial` comes back beside the rows rather than in place of them. A relay
 * outage makes a total a floor, not a lie, and blanking a standing ranking over
 * one flaky relay serves nobody — but rendering a floor as though it were a
 * count is how a board ends up authoritative and wrong. The caller says so on
 * screen instead.
 */
export async function fetchMonthlyPoints(
    month: string,
    /**
     * The last day to count, defaulting to today.
     *
     * The caller passes yesterday for a player who hasn't finished today's
     * puzzle yet. Points are guess counts summed, so today's column is the
     * same spoiler the daily board is gated for — and on the first of a month
     * it is not even summed with anything: a row reading "6 pts · 1 dia" is a
     * plain statement that its author solved today in one guess. Dropping the
     * day rather than the board keeps the ranking readable every day of the
     * month, which is the point of making it the standing board.
     */
    notAfter?: string,
    limit = 50,
): Promise<{ entries: MonthlyEntry[]; partial: boolean }> {
    // Never past today either: the rest of the month has no puzzles yet, and
    // asking for them spends filter room on days nobody could have played.
    const today = formatUTCDate(new Date());
    const days = monthDays(month, notAfter && notAfter < today ? notAfter : today);
    if (days.length === 0) return { entries: [], partial: false };

    let read: MonthEvents;
    try {
        read = await fetchMonthEvents(days);
    } catch (error) {
        console.warn('Could not load the monthly ranking.', error);
        return { entries: [], partial: true };
    }

    // Day by day through the same reader the daily board uses, so a month is
    // scored on exactly the rows a single day would have shown — proof-of-work
    // gate, bounds checks and `d`/`date` agreement included.
    const results: DatedResult[] = days.flatMap((date) =>
        entriesFromEvents(read.events, date).map((entry) => ({ ...entry, date })));

    // Judged against the real end of the window, not against `days` — which
    // is only as far as this query chose to look. See liveThrough.
    const entries = await withNames(tallyMonth(results, liveThrough(month, today), limit));
    return { entries, partial: read.partial };
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
    // Your own key is dropped before anyone becomes an opponent. Most Nostr
    // clients put you in your own kind-3 contact list, so without this you
    // appear in your own duels — drawing with yourself, every day, top of the
    // list because you have played the most days with yourself.
    const follows = (await fetchFollows(pubkey)).filter((who) => who !== pubkey);
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

    return withNames(duelRecords(pubkey, follows, byAuthor));
}

/**
 * Head-to-head tallies, from results already grouped by author and day.
 *
 * Pure, and separate from the query so the rules can be tested without a
 * relay — including the one that matters most, that you are never your own
 * opponent.
 */
export function duelRecords(
    pubkey: string,
    opponents: string[],
    byAuthor: Map<string, Map<string, LeaderboardEntry>>,
): DuelRecord[] {
    const mine = byAuthor.get(pubkey);
    if (!mine || mine.size === 0) return [];

    const records: DuelRecord[] = [];
    for (const opponent of opponents) {
        // Belt and braces with the filter at the call site. A duel with
        // yourself is a draw on every day you played, which would sit at the
        // top of the list on days-played and mean nothing.
        if (opponent === pubkey) continue;
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
    return records;
}
