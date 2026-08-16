// How a month of play becomes a score.
//
// Deliberately apart from social.ts and importing nothing but ./types. The
// ordinary reason is that social.ts pulls in the relay pool, so a pure rule
// living there costs a pool to test. The reason that will matter more: the
// monthly podium badges are awarded by the publisher in server/palavra, and a
// badge handed to the wrong person because the server and the client each kept
// their own copy of the scoring rule is exactly the failure two copies
// eventually produce — silently, and only at month end. One file, imported by
// both halves, the way publish.js already imports relays.json rather than
// restating it.

// Extension spelled out: Node's ESM resolver does not guess it, and the badge
// job imports this file directly. See the note in results.ts.
import { MAX_GUESSES } from './types.ts';

/**
 * What one finished game is worth.
 *
 * Fewer guesses, more points; a loss is worth nothing. That is the whole rule,
 * with no speed component on purpose: `ms` is self-reported like everything
 * else in a result, and it is the cheapest field in the event to forge — a
 * number nobody can even sanity-check, unlike a guess count bounded by
 * MAX_GUESSES. Scoring guesses adds no new way to cheat, because the daily
 * board already ranks on them. Time still decides ties there, and nothing else.
 */
export function pointsFor(result: { tries: number; solved: boolean }): number {
    if (!result.solved) return 0;
    // A guess count outside the board is worth nothing, rather than worth
    // something absurd: the arithmetic below hands `tries: 0` seven points and
    // `tries: 99` a negative score, either of which would wreck a total.
    //
    // Everything read off a relay is already bounded by entriesFromEvents, so
    // this is unreachable through the app today. It is here because this file
    // is the canonical rule rather than the board's private helper — the badge
    // job on the server scores from it too, and a caller that reaches for the
    // rule without also reaching for the reader's checks should not be able to
    // mint a seven-point day by declaring a guess count of zero.
    if (!Number.isInteger(result.tries)) return 0;
    if (result.tries < 1 || result.tries > MAX_GUESSES) return 0;
    // One guess is worth MAX_GUESSES; using all MAX_GUESSES is worth 1.
    return MAX_GUESSES + 1 - result.tries;
}

/** The most a single day can be worth — the ceiling a month's total is read
    against, and the bound the badge job checks a claim against. */
export const MAX_DAILY_POINTS = MAX_GUESSES;

/** How far back the archive offers to look. Twelve keeps a year of podiums
    reachable without offering months that predate the game itself. */
export const MAX_ARCHIVE_MONTHS = 12;

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** The month a puzzle day belongs to: `2026-08-16` → `2026-08`. */
export function monthOf(date: string): string {
    return date.slice(0, 7);
}

/** `2026-08` stepped by whole months, staying in UTC so it can't drift a day
    either side of a boundary the way local-time arithmetic does. */
export function shiftMonth(month: string, delta: number): string {
    const [year, mon] = month.split('-').map(Number);
    const shifted = new Date(Date.UTC(year, mon - 1 + delta, 1));
    return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Every puzzle day in a month, oldest first, stopping at `notAfter`.
 *
 * The cap is what keeps the current month from asking relays for days that
 * haven't happened — thirty-one `#d` tags where sixteen exist is a third of
 * the filter spent on events nobody could have published.
 */
export function monthDays(month: string, notAfter?: string): string[] {
    if (!MONTH_RE.test(month)) return [];
    const [year, mon] = month.split('-').map(Number);
    // Day 0 of the following month is the last day of this one, leap years
    // included — cheaper than restating the length of February.
    const length = new Date(Date.UTC(year, mon, 0)).getUTCDate();

    const days: string[] = [];
    for (let day = 1; day <= length; day++) {
        const iso = `${month}-${String(day).padStart(2, '0')}`;
        // Lexicographic comparison, which is chronological for ISO dates.
        if (notAfter && iso > notAfter) break;
        days.push(iso);
    }
    return days;
}

/**
 * The day a month's streaks are judged alive against.
 *
 * The real end of the window — today for the month still running, the last of
 * the month for an archived one — and deliberately *not* the last day the
 * caller happened to fetch. Those differ whenever the query stops short, which
 * it does every time today's column is withheld from someone who hasn't played
 * yet, and judging liveness against the shortened list quietly forgives one
 * day of absence: a player whose last game was the day before we stopped
 * looking reads as still running when the day we skipped is exactly the one
 * that broke them.
 */
export function liveThrough(month: string, today: string): string {
    const days = monthDays(month);
    const end = days[days.length - 1];
    return !end || today < end ? today : end;
}

/** One published result, tagged with the day it belongs to. */
export interface DatedResult {
    date: string;
    pubkey: string;
    tries: number;
    solved: boolean;
    /** The run its author declared that day, if they did. */
    streak?: number;
}

/** One row of the monthly ranking. */
export interface MonthlyEntry {
    pubkey: string;
    points: number;
    /** Days finished this month — context for a total that rewards turning
        up, and the tiebreak towards whoever reached it in fewer days. */
    played: number;
    /** The run declared on their most recent day, and only while that day is
        recent enough for the run to still be alive. Decoration: it ranks
        nothing. */
    streak?: number;
    /** Resolved from kind-0 metadata when the author has a profile. */
    name?: string;
    picture?: string;
}

function daysApart(a: string, b: string): number {
    return Math.abs(Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000;
}

/**
 * The streak worth showing beside a name, or nothing.
 *
 * A declared streak is a claim about a run that was alive *on the day it was
 * published*. Printing it beside someone whose last game was three weeks ago
 * would state something already false — so it survives only while their newest
 * day is the end of the window or the day before, which is the same "alive
 * until a day is missed" rule the streak board used to apply.
 *
 * For a past month the window ends on the last of the month, so the flame is a
 * snapshot of where they stood then. That is the honest reading of an archived
 * board, and the only one available: nothing in a finished month can say what
 * happened after it.
 */
function liveStreak(newest: DatedResult, through: string): number | undefined {
    if (!newest.solved || !newest.streak) return undefined;
    return daysApart(newest.date, through) <= 1 ? newest.streak : undefined;
}

/**
 * A month's ranking, from results already read off the relays.
 *
 * Pure, and separate from the query so the rules can be tested without a relay
 * — including the one that isn't obvious: a single author is counted once per
 * day, however many events they published for it. The monthly query asks for
 * thirty-one `d` tags at once, and an event's `d` tag and its `date` tag are
 * two different fields, so without this someone could publish thirty-one
 * events under thirty-one day keys that all *declare* the same date, and be
 * paid for the same game thirty-one times. The daily board can't be attacked
 * that way because it only ever asks for one `d` tag. This one can.
 *
 * `through` is the last day of the window — today for the current month, the
 * last of the month for an archived one. Named so rather than `liveThrough`,
 * which is the exported function that computes it: as a parameter it shadowed
 * that function inside this body, so a later edit calling `liveThrough(month,
 * today)` here would have been calling a string.
 */
export function tallyMonth(
    results: DatedResult[],
    through: string,
    limit = 50,
): MonthlyEntry[] {
    const counted = new Set<string>();
    const totals = new Map<string, { points: number; played: number; newest: DatedResult }>();

    for (const result of results) {
        const key = `${result.pubkey}:${result.date}`;
        if (counted.has(key)) continue;
        counted.add(key);

        const running = totals.get(result.pubkey);
        if (!running) {
            totals.set(result.pubkey, {
                points: pointsFor(result),
                played: 1,
                newest: result,
            });
            continue;
        }
        running.points += pointsFor(result);
        running.played += 1;
        if (result.date > running.newest.date) running.newest = result;
    }

    return [...totals]
        .map(([pubkey, running]) => {
            const streak = liveStreak(running.newest, through);
            return {
                pubkey,
                points: running.points,
                played: running.played,
                ...(streak === undefined ? {} : { streak }),
            };
        })
        // Points, then fewer days for the same points — a tie broken towards
        // whoever needed less of the month to get there. Only ever a
        // tiebreak: the ranking itself is the straight total, so turning up
        // every day is still the surest way up it.
        //
        // Then the pubkey, so two players with identical figures don't swap
        // places between loads for no reason a reader could see.
        .sort((a, b) => b.points - a.points
            || a.played - b.played
            || a.pubkey.localeCompare(b.pubkey))
        .slice(0, limit);
}
