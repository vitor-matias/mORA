// Reading a published result, and the keys one is filed under.
//
// Split out of social.ts and nostr.ts so that both halves of the app can share
// it: social.ts reaches the relay pool and nostr.ts reaches the signer and the
// stores, and neither of those exists in Node — but the monthly badge job in
// server/palavra has to decide which events count, and it must decide it the
// same way the board does.
//
// That is not a tidiness argument. A badge is permanent and public, awarded to
// whoever the job says came first; if the job counted an event the board
// filters out — an unmined one, or one filed under another day's key — it
// would hand a stranger a badge for a month they did not win, and nothing
// about that is retractable. So the gate lives in one file, importing nothing
// but types and the proof-of-work check, and both halves import it.
//
// Node reads this with --experimental-strip-types, so every import here must
// be either runtime-safe outside a browser or type-only.

// Extensions spelled out, unlike everywhere else in src/. Node's ESM resolver
// does not guess them and this file is imported from Node; the tsconfig has
// allowImportingTsExtensions, and Vite is happy either way. Same in
// scoring.ts, and for the same reason.
import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { meetsPow } from './pow.ts';
import { MAX_GUESSES, type LeaderboardEntry } from './types.ts';

/** NIP-78 application data — the kind a result is published under. Stated here
    rather than imported from @/lib/nostr so Node can read this file; it is the
    same 30078 as KIND_APP_STATE, and the two are asserted equal in the tests. */
export const KIND_RESULT = 30078;

/** One public result per day. Addressable, so republishing replaces rather
    than duplicating, and a relay only ever holds one per author per date. */
export function resultDTag(date: string): string {
    return `mora-palavra-r:${date}`;
}

/** The hashtag every public Palavra event carries, so they can be found
    without knowing who wrote them. */
export const PALAVRA_TOPIC = 'morapalavra';

/** Roughly thirty years of consecutive days. High enough never to clip a real
    player, low enough that a fabricated number is obviously refused rather
    than printed. */
const MAX_DECLARED_STREAK = 11_000;

export function tagValue(event: { tags: string[][] }, name: string): string | undefined {
    return event.tags.find((tag) => tag[0] === name)?.[1];
}

// ── Reading a month ──────────────────────────────────────────────────────
//
// How a month is partitioned into relay filters lives here, with the reader,
// for the reason the module note gives: the board and the badge job both decide
// which events a month is scored from, and if they partition it differently the
// job can mint a permanent badge for someone the board never ranked first.

export function inGroupsOf<T>(items: T[], size: number): T[][] {
    const groups: T[][] = [];
    for (let from = 0; from < items.length; from += size) {
        groups.push(items.slice(from, from + size));
    }
    return groups;
}

/** One filter per group of days. NIP-01 applies `limit` per filter, so a month
    is a single round trip with several smaller budgets rather than one big
    one. */
export function filtersFor(groups: string[][], limit: number): NostrFilter[] {
    return groups.map((group) => ({
        kinds: [KIND_RESULT],
        '#d': group.map(resultDTag),
        '#t': [PALAVRA_TOPIC],
        limit,
    }));
}

/**
 * One event per author per day key — the newest, ties broken on the id.
 *
 * A month is read in up to two passes, and each pass resolves its own results
 * on its own: the pool collects into an NSet, and the badge job runs
 * newestVersions over each relay union. Neither sees across the two. A result
 * replayed between the passes therefore arrives as two events sharing a
 * coordinate with different ids, one per pass, and concatenating those hands
 * the tally both — where it keeps whichever it sees first, which is the older
 * one. A stale loss outranking its own replacement can decide a month, and on
 * the server it decides a permanent badge.
 *
 * Ties break on the id, the way NSet's own comparison does, so the outcome
 * never depends on which relay answered first.
 */
export function newestPerDay(events: NostrEvent[]): NostrEvent[] {
    const newest = new Map<string, NostrEvent>();
    for (const event of events) {
        const key = `${event.pubkey}:${tagValue(event, 'd') ?? ''}`;
        const held = newest.get(key);
        if (!held
            || event.created_at > held.created_at
            || (event.created_at === held.created_at && event.id < held.id)) {
            newest.set(key, event);
        }
    }
    return [...newest.values()];
}

/** How many of `events` belong to each group, by the `d` tag the relay matched
    on. Used to spot a filter that came back at its limit, and so may have been
    cut short. */
export function countPerGroup(events: NostrEvent[], groups: string[][]): number[] {
    const groupOf = new Map<string, number>();
    groups.forEach((group, index) => {
        for (const day of group) groupOf.set(resultDTag(day), index);
    });

    const counts = new Array<number>(groups.length).fill(0);
    for (const event of events) {
        const dTag = tagValue(event, 'd');
        const index = dTag === undefined ? undefined : groupOf.get(dTag);
        if (index !== undefined) counts[index]++;
    }
    return counts;
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
        // The `d` tag has to agree with the `date` tag.
        //
        // They are two different fields and only the first is addressable, so
        // one author gets one event per `d` — and, without this, as many
        // events *claiming* a given date as they care to publish under other
        // day keys. Any reader that asks for more than one `d` at a time can
        // then be paid repeatedly for the same game: the monthly tally asks
        // for thirty-one, and duels for thirty. The daily board and league
        // standings ask for exactly one, which is why this was invisible until
        // there was a board that summed days.
        if (tagValue(event, 'd') !== resultDTag(date)) return [];
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
