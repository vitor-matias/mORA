import { useEffect, useState } from 'react';
import { Loader2, Medal } from 'lucide-react';
import type { LeaderboardEntry } from '@/lib/palavra/types';
import { MAX_GUESSES } from '@/lib/palavra/types';
import { formatDuration } from './playerLabel';
import { useTranslations } from '@/lib/i18n';
import { formatUTCDate } from '@/lib/format';
import { Player } from './Player';

/** The three podium places get a tint; everyone else is plain. */
const PLACE_TINT = [
    'text-amber-600 dark:text-amber-400',
    'text-zinc-500 dark:text-zinc-300',
    'text-orange-700 dark:text-orange-500',
];

export function Leaderboard({ date, you, refreshKey }: {
    date: string;
    you?: string | null;
    /** Reload when this player's own result lands. */
    refreshKey?: number;
}) {
    const t = useTranslations().palavra;
    // Loaded rows are stamped with the date they belong to, rather than being
    // cleared at the top of the effect: clearing there is a synchronous
    // setState on every mount, and a stale-key check says the same thing
    // without the extra render.
    //
    // `fresh` is false for the rows drawn from this device alone while the
    // relay read is out; see localDailyLeaderboard.
    const [loaded, setLoaded] = useState<{ date: string; rows: LeaderboardEntry[]; fresh: boolean } | null>(null);
    const rows = loaded?.date === date ? loaded.rows : null;
    const refreshing = loaded?.date === date && !loaded.fresh;

    useEffect(() => {
        let cancelled = false;
        import('@/lib/palavra/social')
            .then(({ fetchDailyLeaderboard, localDailyLeaderboard }) => {
                // What the device already holds, drawn at once — the player's
                // own game first among it, whatever their signer is doing.
                // Only over a spinner, never over rows the network already
                // gave: a refresh keeps those until it has better. And not
                // when it is empty, which would flash "nobody has played"
                // at a board that is still being read.
                const local = localDailyLeaderboard(date);
                if (!cancelled && local.length > 0) {
                    setLoaded((held) => (held?.date === date ? held : { date, rows: local, fresh: false }));
                }
                return fetchDailyLeaderboard(date);
            })
            .then((result) => { if (!cancelled) setLoaded({ date, rows: result, fresh: true }); })
            .catch((error) => {
                console.warn('Could not load the leaderboard.', error);
                if (!cancelled) setLoaded((held) => (held?.date === date ? { ...held, fresh: true } : { date, rows: [], fresh: true }));
            });
        return () => { cancelled = true; };
    }, [date, refreshKey]);

    if (rows === null) {
        return (
            <p className="flex items-center justify-center gap-2 text-sm text-zinc-500 py-8">
                <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                {t.loadingBoard}
            </p>
        );
    }

    if (rows.length === 0) {
        return (
            <p className="text-sm text-zinc-500 text-center py-8">
                {date === formatUTCDate(new Date()) ? t.emptyBoard : t.emptyBoardArchive}
            </p>
        );
    }

    return (
        <>
            <ol className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {rows.map((row, i) => {
                    const isYou = you === row.pubkey;
                    return (
                        <li
                            key={row.pubkey}
                            className={`flex items-center gap-3 py-2.5 text-sm ${
                                isYou ? 'font-semibold text-liturgy-700 dark:text-liturgy-300' : ''
                            }`}
                        >
                            <span className={`w-6 shrink-0 tabular-nums text-center font-bold ${PLACE_TINT[i] ?? 'text-zinc-400'}`}>
                                {i < 3
                                    ? <>
                                        <Medal size={15} className="mx-auto" aria-hidden="true" />
                                        <span className="sr-only">{i + 1}</span>
                                    </>
                                    : i + 1}
                            </span>
                            <Player player={row} you={isYou} />
                            <span className="shrink-0 tabular-nums text-zinc-500">
                                {row.solved ? `${row.tries}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`}
                            </span>
                            <span className="shrink-0 tabular-nums text-xs text-zinc-400 w-16 text-right">
                                {formatDuration(row.ms)}
                            </span>
                        </li>
                    );
                })}
            </ol>
            {/* Rows drawn from this device while the relays are still being
                asked: more may come, and saying so keeps a short board from
                reading as the whole day. */}
            {refreshing && (
                <p className="flex items-center justify-center gap-2 text-xs text-zinc-400 pt-2">
                    <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                    {t.loadingBoard}
                </p>
            )}
        </>
    );
}
