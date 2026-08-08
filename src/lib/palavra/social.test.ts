import { describe, expect, it } from 'vitest';
import { entriesFromEvents, rank, recentDates, type RankableResult } from './social.ts';
import { POW_MINIMUM } from './pow';
import type { NostrEvent } from '@nostrify/nostrify';
import { formatUTCDate } from '@/lib/format';

function result(over: Partial<RankableResult> = {}): RankableResult {
    return { tries: 3, solved: true, ms: 60_000, ...over };
}

const DATE = '2026-08-08';

/** An id with enough leading zero bits to clear POW_MINIMUM. The gate reads
    the id alone, so a hand-built one is a faithful stand-in for a mined event
    and keeps the suite from having to mine. */
const MINED_ID = '0'.repeat(POW_MINIMUM / 4) + 'f'.repeat(64 - POW_MINIMUM / 4);
/** No leading zeros at all — an unmined event. */
const BARE_ID = 'f'.repeat(64);

function event(over: {
    id?: string; date?: string; content?: string; pubkey?: string;
} = {}): NostrEvent {
    return {
        id: over.id ?? MINED_ID,
        pubkey: over.pubkey ?? 'a'.repeat(64),
        created_at: 1_786_233_600,
        kind: 30078,
        tags: [['date', over.date ?? DATE]],
        content: over.content ?? JSON.stringify({ tries: 3, solved: true, ms: 60_000 }),
        sig: '0'.repeat(128),
    };
}

// This is the boundary where a stranger's relay event becomes a row on the
// player's screen, and the only place the proof-of-work gate is enforced.
describe('entriesFromEvents', () => {
    it('accepts a well-formed mined result', () => {
        expect(entriesFromEvents([event()], DATE)).toEqual([
            { pubkey: 'a'.repeat(64), tries: 3, solved: true, ms: 60_000 },
        ]);
    });

    it('drops an event tagged for another day', () => {
        expect(entriesFromEvents([event({ date: '2026-08-07' })], DATE)).toEqual([]);
    });

    it('drops an event that carries no proof of work', () => {
        expect(entriesFromEvents([event({ id: BARE_ID })], DATE)).toEqual([]);
    });

    it('drops malformed JSON without throwing', () => {
        expect(() => entriesFromEvents([event({ content: 'not json' })], DATE)).not.toThrow();
        expect(entriesFromEvents([event({ content: 'not json' })], DATE)).toEqual([]);
    });

    it('drops a non-integer guess count', () => {
        const content = JSON.stringify({ tries: 2.5, solved: true, ms: 1 });
        expect(entriesFromEvents([event({ content })], DATE)).toEqual([]);
    });

    it('drops a guess count above the board height', () => {
        const content = JSON.stringify({ tries: 99, solved: true, ms: 1 });
        expect(entriesFromEvents([event({ content })], DATE)).toEqual([]);
    });

    it('drops a guess count below one', () => {
        const content = JSON.stringify({ tries: 0, solved: true, ms: 1 });
        expect(entriesFromEvents([event({ content })], DATE)).toEqual([]);
    });

    it('drops a non-boolean solved flag', () => {
        const content = JSON.stringify({ tries: 3, solved: 'yes', ms: 1 });
        expect(entriesFromEvents([event({ content })], DATE)).toEqual([]);
    });

    it('drops a negative duration', () => {
        const content = JSON.stringify({ tries: 3, solved: true, ms: -1 });
        expect(entriesFromEvents([event({ content })], DATE)).toEqual([]);
    });

    it('keeps the good rows when one event in the batch is bad', () => {
        const rows = entriesFromEvents(
            [event({ pubkey: 'b'.repeat(64) }), event({ content: '{' }), event()],
            DATE,
        );
        expect(rows.map((row) => row.pubkey)).toEqual(['b'.repeat(64), 'a'.repeat(64)]);
    });
});

describe('rank', () => {
    it('puts fewer guesses first', () => {
        expect(rank(result({ tries: 2 }), result({ tries: 4 }))).toBeLessThan(0);
    });

    it('breaks a tie on guesses by the faster time', () => {
        expect(rank(result({ ms: 30_000 }), result({ ms: 90_000 }))).toBeLessThan(0);
    });

    it('puts a solved game ahead of an unsolved one, however fast', () => {
        expect(rank(result({ solved: true, tries: 6, ms: 900_000 }), result({ solved: false, tries: 1, ms: 1 })))
            .toBeLessThan(0);
    });

    it('is a consistent comparator — sorting is stable and reversible', () => {
        const rows = [
            result({ tries: 4, ms: 10_000 }),
            result({ tries: 2, ms: 80_000 }),
            result({ solved: false, tries: 6, ms: 5_000 }),
            result({ tries: 2, ms: 20_000 }),
        ];
        const sorted = [...rows].sort(rank);
        expect(sorted.map((r) => `${r.solved ? 's' : 'x'}${r.tries}@${r.ms}`))
            .toEqual(['s2@20000', 's2@80000', 's4@10000', 'x6@5000']);
        // Reversing the input must not change the outcome.
        expect([...rows].reverse().sort(rank)).toEqual(sorted);
    });
});

describe('a declared streak', () => {
    const withStreak = (streak: unknown) => event({
        content: JSON.stringify({ tries: 3, solved: true, ms: 1000, streak }),
    });

    it('is carried through when it is a sane number', () => {
        expect(entriesFromEvents([withStreak(1200)], DATE)[0].streak).toBe(1200);
    });

    // Self-reported, so the only defence is a bound. A board topped by someone
    // claiming nine thousand years should show them not at all rather than
    // first.
    it('is dropped when it is absurd', () => {
        expect(entriesFromEvents([withStreak(9_999_999)], DATE)[0].streak).toBeUndefined();
    });

    it('is dropped when it is negative or fractional', () => {
        expect(entriesFromEvents([withStreak(-5)], DATE)[0].streak).toBeUndefined();
        expect(entriesFromEvents([withStreak(3.5)], DATE)[0].streak).toBeUndefined();
    });

    it('is absent, not zero, when the publisher never sent one', () => {
        // Results published before the field existed must not read as a
        // zero-day streak and crowd the board.
        const legacy = event({ content: JSON.stringify({ tries: 3, solved: true, ms: 1000 }) });
        expect(entriesFromEvents([legacy], DATE)[0].streak).toBeUndefined();
    });

    it('does not stop the rest of the row parsing', () => {
        const row = entriesFromEvents([withStreak('nonsense')], DATE)[0];
        expect(row.tries).toBe(3);
        expect(row.solved).toBe(true);
    });
});

describe('rank with an unrecorded duration', () => {
    const solvedIn = (tries: number, ms: number) => ({ tries, solved: true, ms });

    it('sorts ms 0 behind a real time, not ahead of it', () => {
        // 0 means "no duration recorded" — formatDuration already renders it
        // as "—". Subtracting straight through put those rows at the top of
        // the speed ranking, which is also the cheapest thing to forge.
        expect([solvedIn(3, 0), solvedIn(3, 45_000)].sort(rank))
            .toEqual([solvedIn(3, 45_000), solvedIn(3, 0)]);
    });

    it('still ranks fewer guesses first, whatever the duration', () => {
        expect([solvedIn(4, 1_000), solvedIn(2, 0)].sort(rank))
            .toEqual([solvedIn(2, 0), solvedIn(4, 1_000)]);
    });

    it('leaves two unrecorded durations in a stable order', () => {
        expect([solvedIn(3, 0), solvedIn(3, 0)].sort(rank)).toHaveLength(2);
    });
});

describe('recentDates', () => {
    // Explicit UTC instants: puzzle days roll over at 00:00 UTC, so a local
    // midnight here would make these assertions timezone-dependent.
    it('starts at the given day and walks backwards', () => {
        expect(recentDates(3, new Date('2026-08-08T12:00:00Z')))
            .toEqual(['2026-08-08', '2026-08-07', '2026-08-06']);
    });

    it('crosses a month boundary', () => {
        expect(recentDates(3, new Date('2026-08-01T12:00:00Z')))
            .toEqual(['2026-08-01', '2026-07-31', '2026-07-30']);
    });

    it('uses the UTC day, not the local one', () => {
        // 23:30 UTC on the 8th is already the 9th in Lisbon summer time — the
        // puzzle is still the 8th's.
        expect(recentDates(1, new Date('2026-08-08T23:30:00Z'))).toEqual(['2026-08-08']);
    });

    it('defaults to today', () => {
        expect(recentDates(1)[0]).toBe(formatUTCDate(new Date()));
    });
});
