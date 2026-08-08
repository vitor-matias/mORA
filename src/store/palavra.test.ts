import { describe, expect, it } from 'vitest';
import {
    derivePalavraStats,
    mergePalavraPlays,
    playsEqual,
    type PalavraPlay,
    type PalavraPlays,
} from './palavra.ts';
import { formatUTCDate } from '@/lib/format';

/** Dates are relative to the real today, because the streak rules are.
    UTC throughout: a puzzle day rolls over at 00:00 UTC. */
function daysAgo(n: number): string {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - n);
    return formatUTCDate(date);
}

function won(guesses: number, ms = 60_000): PalavraPlay {
    return {
        guesses: Array.from({ length: guesses }, (_, i) => `GUES${'S'.repeat(i % 2 + 1)}`.slice(0, 5)),
        solved: true,
        ms,
    };
}

function lost(): PalavraPlay {
    return { guesses: Array.from({ length: 6 }, () => 'ERRAR'), solved: false, ms: 120_000 };
}

/** An open board — three guesses in, not yet won or out of tries. */
function inProgress(): PalavraPlay {
    return { guesses: ['REINO', 'VERBO', 'MUNDO'], solved: false, ms: 0 };
}

describe('derivePalavraStats', () => {
    it('counts only games that ended', () => {
        const stats = derivePalavraStats({
            [daysAgo(2)]: won(3),
            [daysAgo(1)]: lost(),
            [daysAgo(0)]: inProgress(),
        });
        expect(stats.plays).toBe(2);
        expect(stats.wins).toBe(1);
    });

    it('records how many guesses each win took', () => {
        const stats = derivePalavraStats({
            [daysAgo(3)]: won(2),
            [daysAgo(2)]: won(2),
            [daysAgo(1)]: won(5),
        });
        expect(stats.distribution).toEqual([0, 2, 0, 0, 1, 0]);
    });

    it('counts an unbroken run of wins', () => {
        const stats = derivePalavraStats({
            [daysAgo(2)]: won(3),
            [daysAgo(1)]: won(4),
            [daysAgo(0)]: won(2),
        });
        expect(stats.currentStreak).toBe(3);
        expect(stats.maxStreak).toBe(3);
    });

    it('keeps yesterday\'s streak alive before today is played', () => {
        // The run isn't broken until a whole day passes unplayed, so someone
        // who hasn't opened today's puzzle still sees what they're extending.
        const stats = derivePalavraStats({
            [daysAgo(2)]: won(3),
            [daysAgo(1)]: won(3),
        });
        expect(stats.currentStreak).toBe(2);
    });

    it('drops the current streak once a day is missed', () => {
        const stats = derivePalavraStats({
            [daysAgo(4)]: won(3),
            [daysAgo(3)]: won(3),
        });
        expect(stats.currentStreak).toBe(0);
        expect(stats.maxStreak).toBe(2);
    });

    it('breaks the streak on a loss but remembers the best run', () => {
        const stats = derivePalavraStats({
            [daysAgo(4)]: won(3),
            [daysAgo(3)]: won(3),
            [daysAgo(2)]: won(3),
            [daysAgo(1)]: lost(),
            [daysAgo(0)]: won(2),
        });
        expect(stats.currentStreak).toBe(1);
        expect(stats.maxStreak).toBe(3);
    });

    it('reports an empty record for an empty log', () => {
        expect(derivePalavraStats({})).toEqual({
            plays: 0,
            wins: 0,
            currentStreak: 0,
            maxStreak: 0,
            distribution: [0, 0, 0, 0, 0, 0],
            lastPlayedDate: null,
        });
    });

    it('ignores entries whose shape could not have come from a real game', () => {
        const stats = derivePalavraStats({
            [daysAgo(1)]: won(3),
            [daysAgo(2)]: { guesses: ['ok'], solved: true, ms: 1 } as unknown as PalavraPlay,
            [daysAgo(3)]: { guesses: ['REINO', 'CORACAO'], solved: true, ms: 1 } as unknown as PalavraPlay,
            'not-a-date': won(2),
            '2999-01-01': won(1),
        });
        expect(stats.plays).toBe(1);
        expect(stats.wins).toBe(1);
    });
});

describe('a loss today', () => {
    it('breaks the streak instead of leaving yesterday standing', () => {
        // The walk starts from the most recent *win*, so a loss today is
        // invisible to it: without an explicit check, daysApart(yesterday,
        // today) === 1 kept the run alive through the game that ended it.
        const plays: PalavraPlays = {
            [daysAgo(3)]: won(3),
            [daysAgo(2)]: won(4),
            [daysAgo(1)]: won(2),
            [daysAgo(0)]: lost(),
        };
        expect(derivePalavraStats(plays).currentStreak).toBe(0);
    });

    it('leaves the longest run on record intact', () => {
        const plays: PalavraPlays = {
            [daysAgo(3)]: won(3),
            [daysAgo(2)]: won(4),
            [daysAgo(1)]: won(2),
            [daysAgo(0)]: lost(),
        };
        expect(derivePalavraStats(plays).maxStreak).toBe(3);
    });

    it('still counts the streak while today is unfinished', () => {
        // Mid-game is not a loss — the run stands until the board is over.
        const plays: PalavraPlays = {
            [daysAgo(1)]: won(2),
            [daysAgo(0)]: { guesses: ['REINO'], solved: false, ms: 0 },
        };
        expect(derivePalavraStats(plays).currentStreak).toBe(1);
    });
});

describe('mergePalavraPlays', () => {
    it('takes days the other device knows about', () => {
        const local: PalavraPlays = { [daysAgo(1)]: won(3) };
        const merged = mergePalavraPlays(local, { [daysAgo(2)]: won(4) });
        expect(Object.keys(merged).sort()).toEqual([daysAgo(2), daysAgo(1)].sort());
    });

    // The property that lets the sync run on every foreground.
    it('is idempotent — merging the same snapshot twice changes nothing', () => {
        const local: PalavraPlays = { [daysAgo(1)]: won(3) };
        const remote = { [daysAgo(2)]: won(4), [daysAgo(1)]: won(5) };
        const once = mergePalavraPlays(local, remote);
        const twice = mergePalavraPlays(once, remote);
        expect(playsEqual(once, twice)).toBe(true);
        // And the counters derived from it stay put, which is the thing
        // storing running totals instead would have got wrong.
        expect(derivePalavraStats(twice).plays).toBe(derivePalavraStats(once).plays);
    });

    it('prefers a win over a loss on the same day', () => {
        const merged = mergePalavraPlays({ [daysAgo(1)]: lost() }, { [daysAgo(1)]: won(4) });
        expect(merged[daysAgo(1)].solved).toBe(true);
    });

    it('prefers the better win when both devices solved it', () => {
        const merged = mergePalavraPlays({ [daysAgo(1)]: won(5) }, { [daysAgo(1)]: won(3) });
        expect(merged[daysAgo(1)].guesses.length).toBe(3);
    });

    it('breaks a tie on guesses by the faster time', () => {
        const merged = mergePalavraPlays(
            { [daysAgo(1)]: won(3, 90_000) },
            { [daysAgo(1)]: won(3, 40_000) },
        );
        expect(merged[daysAgo(1)].ms).toBe(40_000);
    });

    it('keeps whichever unfinished board got further', () => {
        const merged = mergePalavraPlays(
            { [daysAgo(1)]: { guesses: ['REINO'], solved: false, ms: 0 } },
            { [daysAgo(1)]: inProgress() },
        );
        expect(merged[daysAgo(1)].guesses.length).toBe(3);
    });

    it('never adopts another device\'s clock reading', () => {
        const merged = mergePalavraPlays({}, {
            [daysAgo(1)]: { ...won(3), startedAt: 1 },
        });
        expect(merged[daysAgo(1)].startedAt).toBeUndefined();
    });

    it('leaves the local log alone when the snapshot is unusable', () => {
        const local: PalavraPlays = { [daysAgo(1)]: won(3) };
        expect(playsEqual(mergePalavraPlays(local, null), local)).toBe(true);
        expect(playsEqual(mergePalavraPlays(local, 'nonsense'), local)).toBe(true);
        expect(playsEqual(mergePalavraPlays(local, { [daysAgo(2)]: { solved: true } }), local)).toBe(true);
    });

    it('refuses a duration no single game could have taken', () => {
        const merged = mergePalavraPlays({}, {
            [daysAgo(1)]: { guesses: ['REINO'], solved: true, ms: 99 * 60 * 60 * 1000 },
        });
        expect(merged[daysAgo(1)]).toBeUndefined();
    });
});
