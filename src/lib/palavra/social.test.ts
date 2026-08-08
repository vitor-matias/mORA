import { describe, expect, it } from 'vitest';
import { rank, recentDates, type RankableResult } from './social.ts';
import { formatUTCDate } from '@/lib/format';

function result(over: Partial<RankableResult> = {}): RankableResult {
    return { tries: 3, solved: true, ms: 60_000, ...over };
}

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
