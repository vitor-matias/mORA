import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Crown, Swords, Users, Loader2 } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';
import type { PublishState } from '@/lib/palavra/publishStatus';
import { Leaderboard } from './Leaderboard';
import { PointsBoard } from './PointsBoard';
import { Duels } from './Duels';
import { Leagues } from './Leagues';

type Tab = 'board' | 'month' | 'duels' | 'leagues';

/** Where this player's own result stands, when it isn't out yet:
    'unpublished' is finished and shared but with no attempt under way — a
    reload after a failure, say, before the catch-up has started one — and
    'locked' is a passkey key not yet unlocked this session, which has no
    signer to publish with. */
export type OwnResult = PublishState | 'unpublished' | 'locked';

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
    finishedToday,
    ownResult,
    remoteSigner,
    onRetryResult,
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
        is — so the numbers wait, while league membership stays usable.

        True for any archived day, whose results give nothing away about today. */
    revealResults: boolean;
    /** False until this player has finished *today's* puzzle, whichever day is
        on screen. The month board is the only panel that needs the difference:
        every other one is scoped to the day being viewed, while a monthly total
        with today in it is today's guess counts summed. */
    finishedToday: boolean;
    /** Null unless this player has finished today's game, shares results,
        and the result hasn't reached a relay yet. The boards below already
        show the game, read from this device (see ownResults in social.ts),
        so this is what says that nobody else can see it yet. */
    ownResult: OwnResult | null;
    /** Signing goes through another app (NIP-46), which is both the usual
        reason a publish is slow and the usual reason it fails. */
    remoteSigner: boolean;
    onRetryResult: () => void;
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

            {ownResult && (
                <OwnResultNotice state={ownResult} remoteSigner={remoteSigner} onRetry={onRetryResult} />
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
                        // `finishedToday`, not `revealResults`: the archive
                        // unlocks the other panels because a past day says
                        // nothing about today's word, but this board sums
                        // today's guess counts and so has to wait for today.
                        <PointsBoard you={pubkey} refreshKey={refreshKey} revealResults={finishedToday} />
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

/**
 * Says where this player's result is while it is only on this device. The
 * boards under it show the game already, so without this a player would take
 * their own row as proof that everyone else can see it.
 *
 * A live region, because the state changes on its own — publishing turns into
 * failed a minute later when a remote signer never answers — and the retry
 * button only exists in the failed and unpublished states, so a second tap
 * can't start a second attempt while one is out.
 */
function OwnResultNotice({ state, remoteSigner, onRetry }: {
    state: OwnResult;
    remoteSigner: boolean;
    onRetry: () => void;
}) {
    const t = useTranslations().palavra;
    if (state === 'publishing') {
        return (
            <p role="status" className="flex items-start gap-2 text-xs text-zinc-500 bg-zinc-500/5 rounded-xl px-3 py-2">
                <Loader2 size={13} className="animate-spin shrink-0 mt-0.5" aria-hidden="true" />
                <span>{remoteSigner ? t.resultPublishingSigner : t.resultPublishing}</span>
            </p>
        );
    }
    const actionClass = 'inline-block mt-2 py-1.5 px-3 rounded-lg font-semibold bg-liturgy-500/10 text-liturgy-700 dark:text-liturgy-300 hover:bg-liturgy-500/20 transition-colors';
    if (state === 'locked') {
        // Unlocking re-runs the catch-up (useNostrSync), so the result goes
        // out without the player having to come back and ask.
        return (
            <div role="status" className="text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 rounded-xl px-3 py-2">
                <p>{t.resultLocked}</p>
                <Link to="/perfil" className={actionClass}>{t.resultUnlock}</Link>
            </div>
        );
    }
    return (
        <div role="status" className="text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 rounded-xl px-3 py-2">
            <p>
                {state === 'failed' ? t.resultFailed : t.resultUnpublished}
                {state === 'failed' && remoteSigner && <> {t.resultFailedSigner}</>}
            </p>
            <button type="button" onClick={onRetry} className={actionClass}>
                {state === 'failed' ? t.resultRetry : t.resultPublishNow}
            </button>
        </div>
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
