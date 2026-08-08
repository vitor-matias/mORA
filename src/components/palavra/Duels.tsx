import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { DuelRecord } from '@/lib/palavra/social';
import { Player } from './Player';

export function Duels({ pubkey }: { pubkey: string }) {
    // Stamped with the identity it was loaded for — see Leaderboard.
    const [loaded, setLoaded] = useState<{ pubkey: string; rows: DuelRecord[] } | null>(null);
    const rows = loaded?.pubkey === pubkey ? loaded.rows : null;

    useEffect(() => {
        let cancelled = false;
        import('@/lib/palavra/social')
            .then(({ fetchDuels }) => fetchDuels(pubkey))
            .then((result) => { if (!cancelled) setLoaded({ pubkey, rows: result }); })
            .catch((error) => {
                console.warn('Could not load duels.', error);
                if (!cancelled) setLoaded({ pubkey, rows: [] });
            });
        return () => { cancelled = true; };
    }, [pubkey]);

    if (rows === null) {
        return (
            <p className="flex items-center justify-center gap-2 text-sm text-zinc-500 py-8">
                <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                A comparar resultados…
            </p>
        );
    }

    if (rows.length === 0) {
        return (
            <p className="text-sm text-zinc-500 text-center py-8">
                Nenhum duelo ainda. Os duelos comparam-no com quem segue no Nostr,
                nos dias em que ambos jogaram.
            </p>
        );
    }

    return (
        <>
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {rows.map((row) => (
                    <li key={row.pubkey} className="flex items-center gap-3 py-2.5 text-sm">
                        <Player player={row} />
                        <span className="shrink-0 tabular-nums text-xs">
                            <strong className="text-emerald-600 dark:text-emerald-400">{row.wins}</strong>
                            <span className="text-zinc-400 mx-1">·</span>
                            <span className="text-zinc-500">{row.draws}</span>
                            <span className="text-zinc-400 mx-1">·</span>
                            <strong className="text-zinc-500">{row.losses}</strong>
                        </span>
                        <span className="shrink-0 w-16 text-right text-xs text-zinc-400">
                            {row.played} {row.played === 1 ? 'dia' : 'dias'}
                        </span>
                    </li>
                ))}
            </ul>
            <p className="text-xs text-zinc-400 mt-3">
                Vitórias · empates · derrotas, nos últimos 30 dias. Só contam os dias
                em que ambos terminaram o jogo.
            </p>
        </>
    );
}
