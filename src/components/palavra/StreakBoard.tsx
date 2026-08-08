import { useEffect, useState } from 'react';
import { BadgeCheck, Flame, Loader2 } from 'lucide-react';
import type { LeaderboardEntry } from '@/lib/palavra/types';
import { useTranslations } from '@/lib/i18n';
import { Player } from './Player';

/** The three longest runs get a tint; everyone else is plain. */
const PLACE_TINT = [
    'text-amber-600 dark:text-amber-400',
    'text-zinc-500 dark:text-zinc-300',
    'text-orange-700 dark:text-orange-500',
];

/**
 * Who is on the longest run right now.
 *
 * Ranked on a number each player declares in their own result event, because a
 * lifetime streak cannot be recomputed from the relays — that would mean one
 * event per day per player, and the answer would still stop wherever the query
 * did. The cost is that it is self-reported, exactly like the guess count and
 * the time on the daily board. The note at the foot says so rather than
 * letting the ranking imply otherwise.
 */
export function StreakBoard({ you }: { you?: string | null }) {
    const t = useTranslations().palavra;
    const [rows, setRows] = useState<LeaderboardEntry[] | null>(null);

    useEffect(() => {
        let cancelled = false;
        import('@/lib/palavra/social')
            .then(({ fetchStreakLeaderboard }) => fetchStreakLeaderboard())
            .then((entries) => { if (!cancelled) setRows(entries); })
            .catch((error: unknown) => {
                console.warn('Could not load the streak board.', error);
                if (!cancelled) setRows([]);
            });
        return () => { cancelled = true; };
    }, []);

    if (rows === null) {
        return (
            <p className="flex items-center justify-center gap-2 text-sm text-zinc-500 py-8">
                <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                {t.loadingStreaks}
            </p>
        );
    }

    if (rows.length === 0) {
        return <p className="text-sm text-zinc-500 text-center py-8">{t.emptyStreaks}</p>;
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
                                {i + 1}
                            </span>
                            <Player player={row} you={isYou} />
                            <span className="shrink-0 flex items-center gap-1 tabular-nums font-semibold">
                                {row.verified
                                    ? (
                                        <BadgeCheck
                                            size={14}
                                            className="text-emerald-600 dark:text-emerald-400"
                                            aria-label={t.streakVerified}
                                        />
                                    )
                                    /* Deliberately not a warning icon. An
                                       unbacked row may simply be one the
                                       relays didn't answer for. */
                                    : <span className="w-[14px]" aria-hidden="true" />}
                                <Flame size={14} aria-hidden="true" className="text-orange-500" />
                                {row.streak ?? 0}
                            </span>
                        </li>
                    );
                })}
            </ol>
            <p className="text-xs text-zinc-400 mt-3">{t.streaksLegend}</p>
        </>
    );
}
