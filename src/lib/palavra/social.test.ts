import { describe, expect, it } from 'vitest';
import {
    duelRecords,
    duelVerdict,
    entriesFromEvents,
    rank,
    recentDates,
    type RankableResult,
} from './social.ts';
import { resultDTag } from './nostr';
import { KIND_RESULT } from './results';
import { KIND_APP_STATE } from '@/lib/nostr';
import { POW_MINIMUM } from './pow';
import type { NostrEvent } from '@nostrify/nostrify';
import type { LeaderboardEntry } from './types';
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
    id?: string; date?: string; content?: string; pubkey?: string; dTag?: string;
} = {}): NostrEvent {
    const date = over.date ?? DATE;
    return {
        id: over.id ?? MINED_ID,
        pubkey: over.pubkey ?? 'a'.repeat(64),
        created_at: 1_786_233_600,
        kind: 30078,
        // The `d` tag as well as the `date` tag, because a real result carries
        // both and the reader now requires them to agree. A fixture with only
        // one of them would have passed a check no genuine event can skip.
        tags: [['d', over.dTag ?? resultDTag(date)], ['date', date]],
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

describe('duelVerdict', () => {
    it('puts fewer guesses first', () => {
        expect(duelVerdict(result({ tries: 2 }), result({ tries: 4 }))).toBeLessThan(0);
    });

    it('puts a solved game ahead of an unsolved one, however fast', () => {
        expect(duelVerdict(
            result({ solved: true, tries: 6, ms: 900_000 }),
            result({ solved: false, tries: 1, ms: 1 }),
        )).toBeLessThan(0);
    });

    it('calls equal tries a draw, no matter how far apart the times are', () => {
        expect(duelVerdict(result({ tries: 3, ms: 1 }), result({ tries: 3, ms: 900_000 }))).toBe(0);
    });
});

describe('duelRecords', () => {
    const ME = 'a'.repeat(64);
    const RIVAL = 'b'.repeat(64);

    const play = (pubkey: string, tries: number): LeaderboardEntry =>
        ({ pubkey, tries, solved: true, ms: 30_000 });

    /** Results grouped the way fetchDuels groups them: author → date → result. */
    const grouped = (rows: [string, string, number][]) => {
        const byAuthor = new Map<string, Map<string, LeaderboardEntry>>();
        for (const [pubkey, date, tries] of rows) {
            if (!byAuthor.has(pubkey)) byAuthor.set(pubkey, new Map());
            byAuthor.get(pubkey)!.set(date, play(pubkey, tries));
        }
        return byAuthor;
    };

    // Most Nostr clients put your own key in your own kind-3 list, so this is
    // the ordinary case, not an exotic one. Left in, you top your own duel
    // list with a draw on every day you have ever played.
    it('never makes you your own opponent', () => {
        const byAuthor = grouped([[ME, '2026-08-08', 3], [ME, '2026-08-07', 4]]);
        expect(duelRecords(ME, [ME], byAuthor)).toEqual([]);
    });

    it('still tallies real opponents when your key is in the list', () => {
        const byAuthor = grouped([
            [ME, '2026-08-08', 3], [RIVAL, '2026-08-08', 5],
        ]);
        const records = duelRecords(ME, [ME, RIVAL], byAuthor);
        expect(records.map((r) => r.pubkey)).toEqual([RIVAL]);
        expect(records[0]).toMatchObject({ wins: 1, losses: 0, draws: 0, played: 1 });
    });

    it('counts a win, a loss and a draw across days', () => {
        const byAuthor = grouped([
            [ME, '2026-08-08', 2], [RIVAL, '2026-08-08', 5],
            [ME, '2026-08-07', 5], [RIVAL, '2026-08-07', 2],
            [ME, '2026-08-06', 3], [RIVAL, '2026-08-06', 3],
        ]);
        expect(duelRecords(ME, [RIVAL], byAuthor)[0])
            .toMatchObject({ wins: 1, losses: 1, draws: 1, played: 3 });
    });

    it('calls equal tries a draw even when the reported times differ wildly', () => {
        const byAuthor = new Map<string, Map<string, LeaderboardEntry>>([
            [ME, new Map([['2026-08-08', { ...play(ME, 3), ms: 1 }]])],
            [RIVAL, new Map([['2026-08-08', { ...play(RIVAL, 3), ms: 900_000 }]])],
        ]);
        expect(duelRecords(ME, [RIVAL], byAuthor)[0])
            .toMatchObject({ wins: 0, losses: 0, draws: 1, played: 1 });
    });

    it('ignores days only one of you played', () => {
        const byAuthor = grouped([
            [ME, '2026-08-08', 3], [RIVAL, '2026-08-08', 4],
            [ME, '2026-08-07', 3],
        ]);
        expect(duelRecords(ME, [RIVAL], byAuthor)[0].played).toBe(1);
    });

    it('omits an opponent you have never overlapped with', () => {
        const byAuthor = grouped([[ME, '2026-08-08', 3], [RIVAL, '2026-08-01', 3]]);
        expect(duelRecords(ME, [RIVAL], byAuthor)).toEqual([]);
    });

    it('returns nothing when you have played nothing', () => {
        expect(duelRecords(ME, [RIVAL], grouped([[RIVAL, '2026-08-08', 3]]))).toEqual([]);
    });
});

// The guard that makes a summed board possible. `d` and `date` are separate
// fields, and any reader asking for more than one `d` at a time — the monthly
// tally asks for thirty-one, duels for thirty — would otherwise count one
// game under every day key its author cared to publish it beneath.
describe('the d/date agreement guard', () => {
    it('accepts an event whose d tag matches its date', () => {
        expect(entriesFromEvents([event({ dTag: resultDTag(DATE) })], DATE)).toHaveLength(1);
    });

    it('drops a result filed under another day\'s key', () => {
        expect(entriesFromEvents([event({ dTag: resultDTag('2026-08-01') })], DATE)).toEqual([]);
    });

    it('drops a result whose day key carries no date', () => {
        expect(entriesFromEvents([event({ dTag: 'mora-palavra-r:' })], DATE)).toEqual([]);
    });

    // The other half: a `d` tag that isn't there at all, where tagValue
    // returns undefined rather than a string that fails to match. The fixture
    // always emits one, so this is the only way to reach that branch.
    it('drops a result with no d tag at all', () => {
        const bare: NostrEvent = { ...event(), tags: [['date', DATE]] };
        expect(entriesFromEvents([bare], DATE)).toEqual([]);
    });

    // The attack the guard exists for: one game, published beneath a week of
    // day keys, all declaring the same date. Every copy but the real one goes.
    it('refuses to count one game under many day keys', () => {
        const copies = ['2026-08-02', '2026-08-03', '2026-08-04', DATE]
            .map((day) => event({ dTag: resultDTag(day) }));
        expect(entriesFromEvents(copies, DATE)).toHaveLength(1);
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

// results.ts restates the result kind as a plain number so Node can import it
// without reaching for @/lib/nostr. That is a copy, and a copy that drifted
// would point the whole monthly read at a kind nobody publishes.
describe('the result kind', () => {
    it('matches the kind the writer publishes under', () => {
        expect(KIND_RESULT).toBe(KIND_APP_STATE);
    });
});
