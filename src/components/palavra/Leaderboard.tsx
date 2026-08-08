import { useEffect, useState } from 'react';
import { Loader2, Medal } from 'lucide-react';
import type { LeaderboardEntry } from '@/lib/palavra/types';
import { MAX_GUESSES } from '@/lib/palavra/types';
import { formatDuration } from './playerLabel';
import { useTranslations } from '@/lib/i18n';
import { Player } from './Player';

/** The three podium places get a tint; everyone else is plain. */
const PLACE_TINT = [
    'text-amber-600 dark:text-amber-400',
    'text-zinc-500 dark:text-zinc-300',
    'text-orange-700 dark:text-orange-500',
];

export function Leaderboard({ date, you }: { date: string; you?: string | null }) {
    const t = useTranslations().palavra;
    // Loaded rows are stamped with the date they belong to, rather than being
    // cleared at the top of the effect: clearing there is a synchronous
    // setState on every mount, and a stale-key check says the same thing
    // without the extra render.
    const [loaded, setLoaded] = useState<{ date: string; rows: LeaderboardEntry[] } | null>(null);
    const rows = loaded?.date === date ? loaded.rows : null;

    useEffect(() => {
        let cancelled = false;
        import('@/lib/palavra/social')
            .then(({ fetchDailyLeaderboard }) => fetchDailyLeaderboard(date))
            .then((result) => { if (!cancelled) setLoaded({ date, rows: result }); })
            .catch((error) => {
                console.warn('Could not load the leaderboard.', error);
                if (!cancelled) setLoaded({ date, rows: [] });
            });
        return () => { cancelled = true; };
    }, [date]);

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
                {t.emptyBoard}
            </p>
        );
    }

    return (
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
                            {i < 3 ? <Medal size={15} className="mx-auto" aria-hidden="true" /> : i + 1}
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
    );
}
