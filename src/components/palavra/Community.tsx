import { useState } from 'react';
import { Trophy, Swords, Users } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';
import { Leaderboard } from './Leaderboard';
import { Duels } from './Duels';
import { Leagues } from './Leagues';

type Tab = 'board' | 'duels' | 'leagues';

const TAB_ICON: Record<Tab, typeof Trophy> = { board: Trophy, duels: Swords, leagues: Users };

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
    const t = useTranslations().palavra;
    const [tab, setTab] = useState<Tab>('board');
    const tabs: { id: Tab; label: string }[] = [
        { id: 'board', label: t.tabBoard },
        { id: 'duels', label: t.tabDuels },
        { id: 'leagues', label: t.tabLeagues },
    ];

    return (
        <section className="surface rounded-3xl p-5 space-y-4">
            <div role="tablist" aria-label={t.tabCommunity} className="flex gap-1">
                {tabs.map(({ id, label }) => {
                    const Icon = TAB_ICON[id];
                    return (
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
                    );
                })}
            </div>

            {pubkey && !sharing && (
                <p className="text-xs text-zinc-500 bg-zinc-500/5 rounded-xl px-3 py-2">
                    {t.notSharing}
                </p>
            )}

            <div role="tabpanel">
                {tab === 'board' && (revealResults
                    ? <Leaderboard date={date} you={pubkey} />
                    : <Spoiler text={t.spoiler} why={t.spoilerWhy} />)}

                {tab === 'duels' && (!pubkey
                    ? <SignInPrompt what={t.signInDuels} hint={t.signInHint} />
                    : revealResults ? <Duels pubkey={pubkey} /> : <Spoiler text={t.spoiler} why={t.spoilerWhy} />)}

                {/* Leagues stay usable before the game is played — only the
                    standings inside them are withheld. Being locked out of
                    your own league list because you haven't played yet would
                    be an odd thing to enforce. */}
                {tab === 'leagues' && (pubkey
                    ? <Leagues pubkey={pubkey} date={date} revealResults={revealResults} />
                    : <SignInPrompt what={t.signInLeagues} hint={t.signInHint} />)}
            </div>
        </section>
    );
}

function Spoiler({ text, why }: { text: string; why: string }) {
    return (
        <p className="text-sm text-zinc-500 text-center py-8">
            {text}
            <br />
            <span className="text-xs">{why}</span>
        </p>
    );
}

function SignInPrompt({ what, hint }: { what: string; hint: string }) {
    return (
        <p className="text-sm text-zinc-500 text-center py-8">
            {what}
            <br />
            <span className="text-xs">{hint}</span>
        </p>
    );
}
