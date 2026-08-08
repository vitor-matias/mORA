import { useState } from 'react';
import { Trophy, Swords, Users } from 'lucide-react';
import { Leaderboard } from './Leaderboard';
import { Duels } from './Duels';
import { Leagues } from './Leagues';

type Tab = 'board' | 'duels' | 'leagues';

const TABS: { id: Tab; label: string; icon: typeof Trophy }[] = [
    { id: 'board', label: 'Classificação', icon: Trophy },
    { id: 'duels', label: 'Duelos', icon: Swords },
    { id: 'leagues', label: 'Ligas', icon: Users },
];

/**
 * The social half of the page: today's ranking, head-to-head against people
 * you follow, and leagues.
 *
 * Each panel fetches only once its tab is opened. Every one of them is a
 * fan-out across relays — the leagues tab reaches every member's own write
 * relays — so loading all three on mount would open a lot of sockets to answer
 * questions nobody asked.
 */
export function Community({
    date,
    pubkey,
    sharing,
    revealResults,
}: {
    date: string;
    /** Null when signed out. Duels and leagues need an identity; the board
        doesn't, so it stays readable either way. */
    pubkey: string | null;
    /** Whether this player publishes results. They can read the board without
        it — they just won't be on it, which is worth saying rather than
        leaving them to wonder. */
    sharing: boolean;
    /** False until this player has finished the day's puzzle. Rankings say how
        many tries each person needed, which is a hint about how hard the word
        is — so the numbers wait, while league membership stays usable. */
    revealResults: boolean;
}) {
    const [tab, setTab] = useState<Tab>('board');

    return (
        <section className="surface rounded-3xl p-5 space-y-4">
            <div role="tablist" aria-label="Comunidade" className="flex gap-1">
                {TABS.map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        role="tab"
                        aria-selected={tab === id}
                        onClick={() => setTab(id)}
                        className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold transition-colors ${
                            tab === id
                                ? 'bg-liturgy-500/10 text-liturgy-700 dark:text-liturgy-300'
                                : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                        }`}
                    >
                        <Icon size={15} aria-hidden="true" />
                        <span className="truncate">{label}</span>
                    </button>
                ))}
            </div>

            {pubkey && !sharing && (
                <p className="text-xs text-zinc-500 bg-zinc-500/5 rounded-xl px-3 py-2">
                    Está a ver os resultados dos outros. Para aparecer nas
                    classificações, ative a partilha em Perfil.
                </p>
            )}

            <div role="tabpanel">
                {tab === 'board' && (revealResults
                    ? <Leaderboard date={date} you={pubkey} />
                    : <Spoiler />)}

                {tab === 'duels' && (!pubkey
                    ? <SignInPrompt what="Os duelos comparam-no com quem segue no Nostr." />
                    : revealResults ? <Duels pubkey={pubkey} /> : <Spoiler />)}

                {/* Leagues stay usable before the game is played — only the
                    standings inside them are withheld. Being locked out of
                    your own league list because you haven't played yet would
                    be an odd thing to enforce. */}
                {tab === 'leagues' && (pubkey
                    ? <Leagues pubkey={pubkey} date={date} revealResults={revealResults} />
                    : <SignInPrompt what="As ligas precisam de uma identidade Nostr para guardar de quais faz parte." />)}
            </div>
        </section>
    );
}

function Spoiler() {
    return (
        <p className="text-sm text-zinc-500 text-center py-8">
            Termine o jogo de hoje para ver os resultados.
            <br />
            <span className="text-xs">Quantas tentativas os outros precisaram diz-lhe quão difícil é a palavra.</span>
        </p>
    );
}

function SignInPrompt({ what }: { what: string }) {
    return (
        <p className="text-sm text-zinc-500 text-center py-8">
            {what}
            <br />
            <span className="text-xs">Entre com uma identidade Nostr em Perfil.</span>
        </p>
    );
}
