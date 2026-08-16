import { describe, expect, it } from 'vitest';
import {
    MAX_DAILY_POINTS,
    liveThrough,
    monthDays,
    monthOf,
    pointsFor,
    shiftMonth,
    tallyMonth,
    type DatedResult,
} from './scoring';

describe('pointsFor', () => {
    it('pays most for a first-guess win', () => {
        expect(pointsFor({ tries: 1, solved: true })).toBe(6);
    });

    it('pays one for scraping it on the last guess', () => {
        expect(pointsFor({ tries: 6, solved: true })).toBe(1);
    });

    it('descends by one per guess', () => {
        expect([1, 2, 3, 4, 5, 6].map((tries) => pointsFor({ tries, solved: true })))
            .toEqual([6, 5, 4, 3, 2, 1]);
    });

    // A loss is worth nothing at all, not a consolation point: the board is a
    // sum, so a participation point would rank the most persistent player
    // above the best one on attendance alone.
    it('pays nothing for a loss, however few guesses it took', () => {
        expect(pointsFor({ tries: 1, solved: false })).toBe(0);
        expect(pointsFor({ tries: 6, solved: false })).toBe(0);
    });

    // Unreachable through the app — entriesFromEvents bounds `tries` before
    // anything gets here. Guarded because this file is the canonical rule and
    // the server's badge job scores from it without going through that reader.
    it('pays nothing for a guess count off the board', () => {
        expect(pointsFor({ tries: 0, solved: true })).toBe(0);
        expect(pointsFor({ tries: -1, solved: true })).toBe(0);
        expect(pointsFor({ tries: 7, solved: true })).toBe(0);
        expect(pointsFor({ tries: 99, solved: true })).toBe(0);
        expect(pointsFor({ tries: 2.5, solved: true })).toBe(0);
        expect(pointsFor({ tries: NaN, solved: true })).toBe(0);
    });

    // The property the monthly total rests on: no single day can be worth more
    // than the ceiling a badge claim is checked against.
    it('never pays more than a day is worth, nor less than nothing', () => {
        for (const tries of [-5, 0, 1, 3, 6, 7, 50]) {
            const points = pointsFor({ tries, solved: true });
            expect(points).toBeGreaterThanOrEqual(0);
            expect(points).toBeLessThanOrEqual(MAX_DAILY_POINTS);
        }
    });
});

describe('monthOf', () => {
    it('takes the month off a puzzle day', () => {
        expect(monthOf('2026-08-16')).toBe('2026-08');
    });
});

describe('shiftMonth', () => {
    it('steps back a month', () => {
        expect(shiftMonth('2026-08', -1)).toBe('2026-07');
    });

    it('steps across a year boundary in both directions', () => {
        expect(shiftMonth('2026-01', -1)).toBe('2025-12');
        expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    });

    it('steps back a whole archive span', () => {
        expect(shiftMonth('2026-08', -11)).toBe('2025-09');
    });
});

describe('monthDays', () => {
    it('lists a whole month', () => {
        const days = monthDays('2026-08');
        expect(days).toHaveLength(31);
        expect(days[0]).toBe('2026-08-01');
        expect(days[30]).toBe('2026-08-31');
    });

    it('knows how long February is, leap year included', () => {
        expect(monthDays('2026-02')).toHaveLength(28);
        expect(monthDays('2028-02')).toHaveLength(29);
    });

    // The current month must not ask relays for days that haven't happened —
    // half the filter would be spent on events nobody could have published.
    it('stops at the cap', () => {
        const days = monthDays('2026-08', '2026-08-16');
        expect(days).toHaveLength(16);
        expect(days[days.length - 1]).toBe('2026-08-16');
    });

    it('returns nothing when the cap falls before the month', () => {
        expect(monthDays('2026-08', '2026-07-31')).toEqual([]);
    });

    it('ignores a cap that falls after the month', () => {
        expect(monthDays('2026-08', '2026-12-01')).toHaveLength(31);
    });

    it('refuses a malformed month rather than inventing days', () => {
        expect(monthDays('2026-13')).toEqual([]);
        expect(monthDays('2026-00')).toEqual([]);
        expect(monthDays('nonsense')).toEqual([]);
        expect(monthDays('2026-08-16')).toEqual([]);
    });
});

describe('liveThrough', () => {
    it('is today while the month is still running', () => {
        expect(liveThrough('2026-08', '2026-08-16')).toBe('2026-08-16');
    });

    it('is the last of the month once the month is over', () => {
        expect(liveThrough('2026-07', '2026-08-16')).toBe('2026-07-31');
        expect(liveThrough('2026-02', '2026-08-16')).toBe('2026-02-28');
    });

    // The regression this exists for. Today's column is withheld from a player
    // who hasn't finished, so the query stops at yesterday — and judging
    // liveness against where the *query* stopped hands a flame to someone
    // whose last game was the day before that, i.e. someone who has already
    // missed a day. It has to be measured against the real day.
    it('does not follow the query when today is withheld', () => {
        // The query stopped on the 15th, so the newest row is the 14th. Judged
        // against the real day — the 16th — that run is over. Asserted through
        // tallyMonth because that is where the bug showed: a negative
        // assertion on liveThrough alone restates the case above and cannot
        // fail on its own.
        const through = liveThrough('2026-08', '2026-08-16');
        const rows = tallyMonth(
            [{ pubkey: 'a'.repeat(64), date: '2026-08-14', tries: 3, solved: true, streak: 7 }],
            through,
        );
        expect(rows[0].streak).toBeUndefined();
    });
});

describe('tallyMonth', () => {
    const THROUGH = '2026-08-16';
    const A = 'a'.repeat(64);
    const B = 'b'.repeat(64);

    const on = (over: Partial<DatedResult> & { date: string; pubkey: string }): DatedResult =>
        ({ tries: 3, solved: true, ...over });

    it('sums a month of play', () => {
        const rows = tallyMonth([
            on({ pubkey: A, date: '2026-08-01', tries: 1 }), // 6
            on({ pubkey: A, date: '2026-08-02', tries: 4 }), // 3
            on({ pubkey: A, date: '2026-08-03', solved: false }), // 0
        ], THROUGH);
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ points: 9, played: 3 });
    });

    it('counts a lost day as played but scoreless', () => {
        const rows = tallyMonth([on({ pubkey: A, date: '2026-08-01', solved: false })], THROUGH);
        expect(rows[0]).toMatchObject({ points: 0, played: 1 });
    });

    // The whole reason the tally can't just add up whatever the relays hand
    // back. `d` and `date` are separate fields, and the monthly query asks for
    // thirty-one day keys at once — so a reader that trusted the date alone
    // would pay one game as many times as it was filed.
    it('counts one author once per day, however many results arrive', () => {
        const rows = tallyMonth([
            on({ pubkey: A, date: '2026-08-01', tries: 1 }),
            on({ pubkey: A, date: '2026-08-01', tries: 1 }),
            on({ pubkey: A, date: '2026-08-01', tries: 1 }),
        ], THROUGH);
        expect(rows[0]).toMatchObject({ points: 6, played: 1 });
    });

    // The chosen shape, stated as a test so it can't drift into an average by
    // accident: the board is a straight sum, so persistence outscores brilliance
    // given enough days. Two perfect games are worth less than seven scrappy ones.
    it('ranks on the total, so turning up more can beat playing better', () => {
        const rows = tallyMonth([
            // Perfect, but only twice: 6 + 6.
            on({ pubkey: A, date: '2026-08-01', tries: 1 }),
            on({ pubkey: A, date: '2026-08-02', tries: 1 }),
            // Mediocre, seven times over: 7 × 2.
            ...['03', '04', '05', '06', '07', '08', '09'].map((day) =>
                on({ pubkey: B, date: `2026-08-${day}`, tries: 5 })),
        ], THROUGH);
        expect(rows.map((r) => [r.pubkey[0], r.points, r.played]))
            .toEqual([['b', 14, 7], ['a', 12, 2]]);
    });

    it('breaks a tie towards whoever needed fewer days', () => {
        const rows = tallyMonth([
            on({ pubkey: A, date: '2026-08-01', tries: 1 }), // 6 in one day
            on({ pubkey: B, date: '2026-08-01', tries: 4 }), // 3
            on({ pubkey: B, date: '2026-08-02', tries: 4 }), // 3 — 6 in two days
        ], THROUGH);
        expect(rows.map((r) => r.pubkey[0])).toEqual(['a', 'b']);
    });

    describe('the streak beside a name', () => {
        it('shows the run declared on the most recent day', () => {
            const rows = tallyMonth([
                on({ pubkey: A, date: '2026-08-15', streak: 11 }),
                on({ pubkey: A, date: THROUGH, streak: 12 }),
            ], THROUGH);
            expect(rows[0].streak).toBe(12);
        });

        // Alive until a day is missed — someone who played yesterday and
        // hasn't opened the app today still has theirs.
        it('keeps a run whose newest day is the day before the window ends', () => {
            expect(tallyMonth([on({ pubkey: A, date: '2026-08-15', streak: 9 })], THROUGH)[0].streak)
                .toBe(9);
        });

        // The one that would state something false. A run declared three weeks
        // ago says nothing about today.
        it('drops a run that has gone quiet', () => {
            expect(tallyMonth([on({ pubkey: A, date: '2026-08-02', streak: 40 })], THROUGH)[0].streak)
                .toBeUndefined();
        });

        it('drops a run whose latest day was a loss', () => {
            expect(tallyMonth([
                on({ pubkey: A, date: '2026-08-15', streak: 40 }),
                on({ pubkey: A, date: THROUGH, solved: false, streak: 0 }),
            ], THROUGH)[0].streak).toBeUndefined();
        });

        it('omits a run of zero, and one never declared', () => {
            expect(tallyMonth([on({ pubkey: A, date: THROUGH, streak: 0 })], THROUGH)[0].streak)
                .toBeUndefined();
            expect(tallyMonth([on({ pubkey: A, date: THROUGH })], THROUGH)[0].streak)
                .toBeUndefined();
        });

        // An archived month ends on its own last day, so the flame is a
        // snapshot of where that player stood then.
        it('reads against the end of an archived window, not against today', () => {
            expect(tallyMonth([on({ pubkey: A, date: '2026-07-31', streak: 20 })], '2026-07-31')[0].streak)
                .toBe(20);
        });

        // Decoration, not ranking: a long run doesn't lift anyone.
        it('never outranks points', () => {
            const rows = tallyMonth([
                on({ pubkey: A, date: THROUGH, tries: 6, streak: 500 }), // 1 pt
                on({ pubkey: B, date: THROUGH, tries: 1 }), // 6 pts, no run
            ], THROUGH);
            expect(rows.map((r) => r.pubkey[0])).toEqual(['b', 'a']);
        });
    });

    it('caps the board at the limit asked for', () => {
        const many = Array.from({ length: 80 }, (_, i) =>
            on({ pubkey: String(i).padStart(64, '0'), date: THROUGH }));
        expect(tallyMonth(many, THROUGH, 50)).toHaveLength(50);
    });

    it('orders identically however the results arrive', () => {
        const results = [
            on({ pubkey: A, date: '2026-08-01', tries: 2 }),
            on({ pubkey: B, date: '2026-08-01', tries: 2 }),
        ];
        expect(tallyMonth(results, THROUGH).map((r) => r.pubkey))
            .toEqual(tallyMonth([...results].reverse(), THROUGH).map((r) => r.pubkey));
    });
});
