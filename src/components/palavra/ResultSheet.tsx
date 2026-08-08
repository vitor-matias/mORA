import { useEffect, useState, type ReactNode } from 'react';
import { Check, Copy } from 'lucide-react';
import { nextUTCMidnight } from '@/lib/format';
import { MAX_GUESSES } from '@/lib/palavra/types';
import type { PalavraStats } from '@/store/palavra';

/**
 * Time left until the next puzzle, as "4h 12m".
 *
 * Counts down to 00:00 UTC, not local midnight: the puzzle is one global
 * daily so that everyone plays the same word inside the same window and the
 * speed ranking compares like with like. `nextPuzzleAt` comes from the server
 * when it supplies one, so the rollover policy lives there rather than being
 * assumed here twice.
 */
function useTimeToNextPuzzle(nextPuzzleAt?: number): string {
    const [label, setLabel] = useState('');
    useEffect(() => {
        const tick = () => {
            const target = nextPuzzleAt ? nextPuzzleAt * 1000 : nextUTCMidnight().getTime();
            const totalMinutes = Math.max(0, Math.round((target - Date.now()) / 60000));
            const hours = Math.floor(totalMinutes / 60);
            setLabel(hours > 0 ? `${hours}h ${totalMinutes % 60}m` : `${totalMinutes}m`);
        };
        tick();
        const timer = window.setInterval(tick, 60_000);
        return () => window.clearInterval(timer);
    }, [nextPuzzleAt]);
    return label;
}

function StatFigure({ value, label }: { value: ReactNode; label: string }) {
    return (
        <div className="text-center px-1">
            <p className="text-2xl font-bold leading-tight">{value}</p>
            <p className="text-xs text-zinc-500 leading-tight mt-0.5">{label}</p>
        </div>
    );
}

/**
 * The end-of-game panel: how it went, the record it changed, and the grid to
 * share. Shown in place of the keyboard once the board is closed.
 */
export function ResultSheet({
    solved,
    tries,
    answer,
    stats,
    shareText,
    actions,
    archive = false,
    nextPuzzleAt,
}: {
    solved: boolean;
    tries: number;
    /** The revealed word, accents and all. Shown only on a loss. */
    answer: string;
    stats: PalavraStats;
    /** The emoji grid plus its heading, ready for the clipboard. */
    shareText: string;
    /** Nostr publishing controls, when signed in. */
    actions?: ReactNode;
    /** An archive day. The record below is still the player's real one — this
        game simply isn't part of it — and there is no countdown to a puzzle
        that has already come and gone. */
    archive?: boolean;
    /** When the next puzzle unlocks, epoch seconds, as the server declares it.
        Falls back to the next 00:00 UTC. */
    nextPuzzleAt?: number;
}) {
    const [copied, setCopied] = useState(false);
    const countdown = useTimeToNextPuzzle(nextPuzzleAt);
    const winRate = stats.plays > 0 ? Math.round((stats.wins / stats.plays) * 100) : 0;
    const best = Math.max(1, ...stats.distribution);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(shareText);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.warn('Could not copy the result.', error);
        }
    };

    return (
        <section className="surface rounded-3xl p-5 space-y-5" aria-live="polite">
            {/* No verse and no reference here: the card above already shows
                the completed verse, the revealed word and the link out. The
                answer is restated only on a loss, where the player never
                typed it and the heading alone doesn't tell them. */}
            <div className="text-center space-y-1">
                <h2 className="text-xl font-bold page-title">
                    {solved
                        ? tries === 1 ? 'À primeira!' : `Acertou em ${tries} tentativas.`
                        : 'Fica para amanhã.'}
                </h2>
                {!solved && (
                    <p className="text-sm text-zinc-500">
                        A palavra era <strong className="text-zinc-800 dark:text-zinc-100">{answer}</strong>.
                    </p>
                )}
            </div>

            <div>
                <h3 className="text-sm font-semibold text-zinc-500 mb-2">
                    O seu registo
                    {archive && (
                        <span className="ml-2 font-normal text-xs text-zinc-400">
                            (inalterado — este jogo não conta)
                        </span>
                    )}
                </h3>
                <div className="grid grid-cols-4 divide-x divide-zinc-100 dark:divide-zinc-800">
                    <StatFigure value={stats.plays} label="jogos" />
                    <StatFigure value={`${winRate}%`} label="vitórias" />
                    <StatFigure value={stats.currentStreak} label="seguidos" />
                    <StatFigure value={stats.maxStreak} label="recorde" />
                </div>
            </div>

            <div>
                <h3 className="text-sm font-semibold text-zinc-500 mb-2">Distribuição</h3>
                <div className="space-y-1">
                    {Array.from({ length: MAX_GUESSES }, (_, i) => {
                        const count = stats.distribution[i] ?? 0;
                        // An archive win isn't in these bars, so highlighting
                        // one would point at somebody else's game.
                        const isThisGame = solved && tries === i + 1 && !archive;
                        return (
                            <div key={i} className="flex items-center gap-2 text-xs">
                                <span className="w-3 text-zinc-500 tabular-nums">{i + 1}</span>
                                <div className="flex-1 bg-zinc-100 dark:bg-zinc-800 rounded overflow-hidden">
                                    <div
                                        className={`h-5 rounded flex items-center justify-end px-1.5 font-semibold text-white transition-all ${
                                            isThisGame ? 'palavra-tile-correct' : 'palavra-tile-absent'
                                        }`}
                                        // Always wide enough to show its own number, even at zero.
                                        style={{ width: `${Math.max(8, (count / best) * 100)}%` }}
                                    >
                                        {count}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="space-y-2">
                <button
                    type="button"
                    onClick={copy}
                    className="w-full flex items-center justify-center gap-2 text-sm font-semibold cta-primary rounded-xl px-4 py-3 transition-colors active:scale-[0.98]"
                >
                    {copied
                        ? <><Check size={16} aria-hidden="true" /> Copiado</>
                        : <><Copy size={16} aria-hidden="true" /> Copiar resultado</>}
                </button>
                {actions}
            </div>

            {!archive && (
                <p className="text-center text-xs text-zinc-500">
                    Próxima palavra em {countdown}.
                </p>
            )}
        </section>
    );
}
