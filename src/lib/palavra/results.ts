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
import type { NostrEvent } from '@nostrify/nostrify';
import { meetsPow } from './pow.ts';
import { MAX_GUESSES, type LeaderboardEntry } from './types.ts';

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
