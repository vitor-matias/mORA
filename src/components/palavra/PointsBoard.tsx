import { useEffect, useState, type ReactNode } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Flame, Loader2, Medal } from 'lucide-react';
import type { MonthlyEntry } from '@/lib/palavra/scoring';
import { MAX_ARCHIVE_MONTHS, monthOf, shiftMonth } from '@/lib/palavra/scoring';
import { useTranslations } from '@/lib/i18n';
import { formatUTCDate } from '@/lib/format';
import { Player } from './Player';

/** The three podium places get a tint; everyone else is plain. */
const PLACE_TINT = [
    'text-amber-600 dark:text-amber-400',
    'text-zinc-500 dark:text-zinc-300',
    'text-orange-700 dark:text-orange-500',
];

/**
 * The standing board: points earned this month.
 *
 * Summed from the results themselves rather than from a number anyone
 * declared, which is what a calendar month buys — thirty-one day keys is a
 * query, where a lifetime total would have been a claim. See scoring.ts for
 * the rule and social.ts for the query.
 *
 * The flame beside a name is the streak, and it is decoration: it orders
 * nothing. It is still self-reported, and nothing here checks it, because a
 * number that ranks nobody isn't worth a second relay round trip to refute.
 * The legend says as much rather than letting the badge imply otherwise.
 */
export function PointsBoard({ you, refreshKey, revealResults }: {
    you?: string | null;
    /** Reload when this player's own result lands. */
    refreshKey?: number;
    /**
     * False until this player has finished today's puzzle, in which case today
     * is left out of the sum rather than the board being hidden. Points are
     * guess counts added up, so today's column is the same hint about the
     * word's difficulty that the daily board withholds — but a month's total
     * is still worth reading without it, which a hidden board would not be.
     */
    revealResults: boolean;
}) {
    const t = useTranslations().palavra;
    const today = formatUTCDate(new Date());
    const thisMonth = monthOf(today);
    const [month, setMonth] = useState(thisMonth);
    // Archived months are wholly in the past, so nothing in one can give away
    // today's word — the cap is only ever applied to the running month.
    const notAfter = revealResults ? undefined : yesterday(today);
    const holdingToday = !revealResults && month === thisMonth;
    // Rows are stamped with the month they belong to rather than cleared at
    // the top of the effect — the same reason the daily board stamps its date:
    // clearing there is a synchronous setState on every mount, and a stale-key
    // check says the same thing without the extra render.
    const [loaded, setLoaded] = useState<{ month: string; rows: MonthlyEntry[] } | null>(null);
    const rows = loaded?.month === month ? loaded.rows : null;

    // The oldest month the archive offers. Anything before it is out of reach
    // rather than merely empty, so the button is disabled instead of stepping
    // into months that predate the game.
    const oldest = shiftMonth(thisMonth, -(MAX_ARCHIVE_MONTHS - 1));

    useEffect(() => {
        let cancelled = false;
        import('@/lib/palavra/social')
            .then(({ fetchMonthlyPoints }) => fetchMonthlyPoints(month, notAfter))
            .then((entries) => { if (!cancelled) setLoaded({ month, rows: entries }); })
            .catch((error: unknown) => {
                console.warn('Could not load the monthly ranking.', error);
                if (!cancelled) setLoaded({ month, rows: [] });
            });
        return () => { cancelled = true; };
    }, [month, notAfter, refreshKey]);

    return (
        <>
            <div className="flex items-center justify-between gap-2">
                <MonthStep
                    label={t.prevMonth}
                    onClick={() => setMonth(shiftMonth(month, -1))}
                    disabled={month <= oldest}
                >
                    <ChevronLeft size={18} aria-hidden="true" />
                </MonthStep>
                {/* aria-live so stepping months is announced: the heading is
                    the only thing that says which board is on screen, and a
                    screen reader would otherwise hear the rows change with no
                    word about why. */}
                <h3 className="text-sm font-semibold tabular-nums" aria-live="polite">
                    {t.monthLabel(month)}
                </h3>
                <MonthStep
                    label={t.nextMonth}
                    onClick={() => setMonth(shiftMonth(month, 1))}
                    disabled={month >= thisMonth}
                >
                    <ChevronRight size={18} aria-hidden="true" />
                </MonthStep>
            </div>

            {rows === null && (
                <p className="flex items-center justify-center gap-2 text-sm text-zinc-500 py-8">
                    <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                    {t.loadingMonth}
                </p>
            )}

            {rows !== null && rows.length === 0 && (
                <p className="text-sm text-zinc-500 text-center py-8">
                    {/* On the first of the month, holding today back leaves
                        nothing at all to sum — worth saying plainly, since
                        "nobody has scored" would be a different and wrong
                        claim about a board that simply isn't looking yet. */}
                    {month !== thisMonth
                        ? t.emptyMonthArchive
                        : holdingToday && monthOf(yesterday(today)) !== thisMonth
                            ? t.emptyMonthFirstDay
                            : t.emptyMonth}
                </p>
            )}

            {rows !== null && rows.length > 0 && (
                <>
                    {/* The units, said once at the top of their column instead
                        of on all fifty rows. Decorative and hidden from the
                        accessibility tree — a screen reader can't scan up to a
                        header, so every cell below carries its own label. */}
                    {/* Column widths and the gap are duplicated on every row
                        below. They have to agree exactly or the headers drift
                        off their columns, so change them together. Each is cut
                        to what its widest real value needs — a rank of 50, a
                        four-figure streak, 31 days, a perfect month of 186 —
                        because everything trimmed here is width the names get
                        back, and the names are the part that truncates. */}
                    <div className="flex items-center gap-2 pb-1 text-zinc-400" aria-hidden="true">
                        <span className="w-5 shrink-0" />
                        <span className="flex-1 min-w-0" />
                        <span className="w-7 shrink-0 flex justify-end">
                            <Flame size={13} className="text-orange-500" />
                        </span>
                        <span className="w-7 shrink-0 flex justify-end">
                            <CalendarDays size={13} />
                        </span>
                        <span className="w-9 shrink-0 text-right text-[11px] font-semibold uppercase tracking-wide">
                            {t.pointsAbbr}
                        </span>
                    </div>
                    <ol className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {rows.map((row, i) => {
                            const isYou = you === row.pubkey;
                            return (
                                <li
                                    key={row.pubkey}
                                    className={`flex items-center gap-2 py-2.5 text-sm ${
                                        isYou ? 'font-semibold text-liturgy-700 dark:text-liturgy-300' : ''
                                    }`}
                                >
                                    <span className={`w-5 shrink-0 tabular-nums text-center font-bold ${PLACE_TINT[i] ?? 'text-zinc-400'}`}>
                                        {i < 3
                                            ? <>
                                                <Medal size={15} className="mx-auto" aria-hidden="true" />
                                                <span className="sr-only">{i + 1}</span>
                                            </>
                                            : i + 1}
                                    </span>
                                    <Player player={row} you={isYou} />
                                    {/* Bragging rights, and nothing else — the
                                        row is placed by its points. Absent
                                        rather than shown as zero when the run
                                        is over or was never declared, but the
                                        slot stays: without it the day column
                                        beside it would sit at a different x on
                                        every row that has no run, and most
                                        rows have no run. */}
                                    <span className="shrink-0 w-7 text-right tabular-nums text-xs text-zinc-500">
                                        {row.streak !== undefined && (
                                            <>
                                                <span aria-hidden="true">{row.streak}</span>
                                                <span className="sr-only">{t.streakLabel(row.streak)}</span>
                                            </>
                                        )}
                                    </span>
                                    {/* Days played, as context for a total that
                                        rewards turning up: 39 across eight days
                                        and 12 across two are different months.
                                        It ranks nothing either — it only ever
                                        breaks an exact tie. */}
                                    <span className="shrink-0 w-7 text-right tabular-nums text-xs text-zinc-500">
                                        <span aria-hidden="true">{row.played}</span>
                                        <span className="sr-only">{t.days(row.played)}</span>
                                    </span>
                                    <span className="shrink-0 w-9 text-right tabular-nums font-semibold">
                                        <span aria-hidden="true">{row.points}</span>
                                        <span className="sr-only">{t.points(row.points)}</span>
                                    </span>
                                </li>
                            );
                        })}
                    </ol>
                    <p className="text-xs text-zinc-400 mt-3">{t.monthLegend}</p>
                </>
            )}
        </>
    );
}

/** The day before, in UTC — matching how puzzle days are identified, so it
    can't land a day either side for a reader who isn't on UTC. */
function yesterday(date: string): string {
    const day = new Date(`${date}T00:00:00Z`);
    day.setUTCDate(day.getUTCDate() - 1);
    return formatUTCDate(day);
}

function MonthStep({ label, onClick, disabled, children }: {
    label: string;
    onClick: () => void;
    disabled: boolean;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            // p-2.5 around an 18px icon, matching DateNav's day stepper — the
            // same control one section up the page, and the size that keeps
            // this a thumb-sized target rather than a 28px one.
            className="shrink-0 rounded-lg p-2.5 text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-500"
        >
            {children}
        </button>
    );
}
