import { useState } from 'react';
import { Trophy, Crown, Swords, Users } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';
import { Leaderboard } from './Leaderboard';
import { PointsBoard } from './PointsBoard';
import { Duels } from './Duels';
import { Leagues } from './Leagues';

type Tab = 'board' | 'month' | 'duels' | 'leagues';

const TAB_ICON: Record<Tab, typeof Trophy> = { board: Trophy, month: Crown, duels: Swords, leagues: Users };

/**
 * The social half of the page: today's ranking, the standing streak board,
 * head-to-head against people you follow, and leagues.
 *
 * Each panel fetches only once its tab is opened. Every one of them is a
 * fan-out across relays — the leagues tab reaches every member's own write
 * relays — so loading all three on mount would open a lot of sockets to answer
 * questions nobody asked.
 */
export function Community({
    refreshKey,
    date,
    pubkey,
    sharing,
    revealResults,
}: {
    /** Changes when this player's own result reaches the relays. The panels
        stay mounted once opened, so nothing else would make them look again —
        and the moment a player most wants the board is the moment they have
        just landed on it. */
    refreshKey: number;
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
    // Which tabs have ever been opened. Panels mount lazily and then stay
    // mounted: unmounting on deselect re-ran the whole relay fan-out on every
    // switch back — including the leagues path, which reaches every member's
    // write relays — while mounting all four up front would pay for tabs the
    // player may never open. This pays for each one exactly once.
    //
    // The month starts visited alongside the day. It is the standing ranking
    // — the one people come here for — and its query is the widest of the
    // four, so waiting for the tap to start it is exactly the wrong order:
    // the panel would spend its first seconds loading every time, having sat
    // idle while the day's board was being read. Both fetch on arrival, and
    // switching between them is then instant. Duels and leagues still wait,
    // since neither is on the way to anywhere.
    const [visited, setVisited] = useState<Set<Tab>>(() => new Set<Tab>(['board', 'month']));
    const openTab = (id: Tab) => {
        setTab(id);
        setVisited((seen) => (seen.has(id) ? seen : new Set(seen).add(id)));
    };
    const tabs: { id: Tab; label: string }[] = [
        { id: 'board', label: t.tabBoard },
        { id: 'month', label: t.tabMonth },
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
                        id={`palavra-community-tab-${id}`}
                        aria-selected={tab === id}
                        aria-controls={`palavra-community-panel-${id}`}
                        onClick={() => openTab(id)}
                        className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 rounded-xl px-1.5 sm:px-2 py-2 text-xs font-semibold transition-colors ${
                            tab === id
                                ? 'bg-liturgy-500/10 text-liturgy-700 dark:text-liturgy-300'
                                : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                        }`}
                    >
                        {/* The icon is decorative and the first thing to go:
                            four tabs and four icons don't fit a phone, and a
                            readable "Seguidos" beats an icon beside "Segui…".
                            500px because that is where the labels stop being
                            clipped — at 430 "Seguidos" was still a pixel
                            short. */}
                        <Icon size={15} aria-hidden="true" className="hidden min-[500px]:block shrink-0" />
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

            {/* One panel element per tab, `hidden` when it isn't the active
                one — which also takes it out of the accessibility tree, so a
                screen reader sees exactly one panel. */}
            {tabs.map(({ id }) => visited.has(id) && (
                <div
                    key={id}
                    role="tabpanel"
                    id={`palavra-community-panel-${id}`}
                    aria-labelledby={`palavra-community-tab-${id}`}
                    hidden={tab !== id}
                >
                    {id === 'board' && (revealResults
                        ? <Leaderboard date={date} you={pubkey} refreshKey={refreshKey} />
                        : <Spoiler text={t.spoiler} why={t.spoilerWhy} />)}

                    {/* No sign-in needed, and no spoiler gate either — but for
                        a different reason than the streak board it replaces.
                        A month's points *are* guess counts summed, so the
                        board withholds today's column until this player has
                        finished, rather than withholding itself. A standing
                        ranking nobody can see until they play would be a poor
                        standing ranking. */}
                    {id === 'month' && (
                        <PointsBoard you={pubkey} refreshKey={refreshKey} revealResults={revealResults} />
                    )}

                    {id === 'duels' && (!pubkey
                        ? <SignInPrompt what={t.signInDuels} hint={t.signInHint} />
                        : revealResults ? <Duels pubkey={pubkey} refreshKey={refreshKey} /> : <Spoiler text={t.spoiler} why={t.spoilerWhy} />)}

                    {/* Leagues stay usable before the game is played — only the
                        standings inside them are withheld. Being locked out of
                        your own league list because you haven't played yet
                        would be an odd thing to enforce. */}
                    {id === 'leagues' && (pubkey
                        ? <Leagues pubkey={pubkey} date={date} revealResults={revealResults} refreshKey={refreshKey} />
                        : <SignInPrompt what={t.signInLeagues} hint={t.signInHint} />)}
                </div>
            ))}
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
