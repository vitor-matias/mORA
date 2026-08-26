import { useEffect, useRef, useState } from 'react';
import { Loader2, Swords, User, UserCheck, UserPlus, X } from 'lucide-react';
import type { EarnedBadge } from '@/lib/palavra/badges';
import type { PlayerRef } from './Player';
import { BadgeItem } from './BadgeItem';
import { shortPubkey } from './playerLabel';
import { useTranslations } from '@/lib/i18n';

// Disabled controls excluded: the follow button is disabled while loading,
// saving, or already following, and a disabled button cannot take focus — so
// picking it as the trap's first or last element made Tab call focus() on
// something that ignores it, and focus escaped the dialog.
const FOCUSABLE_SELECTOR = 'button:not([disabled]), [href], input:not([disabled]), '
    + 'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type FollowState = 'loading' | 'following' | 'not-following' | 'unknown' | 'failed';

/**
 * One player, from a tap on any board row: what they have won, and the button
 * that puts them in your duels.
 *
 * Following is what duels are built on — fetchDuels reads the kind-3 contact
 * list — so "follow" and "duel them from tomorrow" are the same act, and the
 * copy says so rather than leaving the reader to connect a social-graph
 * concept to a game feature.
 */
export function PlayerSheet({ player, you, onClose }: {
    player: PlayerRef;
    /** The signed-in identity, or null. Following needs one; the badges
        don't, so the sheet stays useful signed out. */
    you: string | null;
    onClose: () => void;
}) {
    const t = useTranslations().palavra;
    const dialogRef = useRef<HTMLDivElement>(null);
    const closeRef = useRef<HTMLButtonElement>(null);
    const [badges, setBadges] = useState<EarnedBadge[] | null>(null);
    const [follows, setFollows] = useState<FollowState>('loading');

    const isYou = you === player.pubkey;

    useEffect(() => {
        const previouslyFocused = document.activeElement as HTMLElement | null;
        closeRef.current?.focus();
        return () => previouslyFocused?.focus();
    }, []);

    useEffect(() => {
        let cancelled = false;
        import('@/lib/palavra/badges')
            .then(({ fetchBadges }) => fetchBadges(player.pubkey))
            .then((earned) => { if (!cancelled) setBadges(earned); })
            .catch((error: unknown) => {
                console.warn('Could not load badges.', error);
                if (!cancelled) setBadges([]);
            });
        return () => { cancelled = true; };
    }, [player.pubkey]);

    useEffect(() => {
        // Nothing to look up when there is nobody to follow or nobody to
        // follow them as. The follow button is rendered under the same
        // condition, so `follows` simply never gets read in that case — which
        // is why this returns rather than setting a state nothing will show.
        if (!you || isYou) return;
        let cancelled = false;
        let unsubscribe: (() => void) | undefined;

        // The queue first, and without touching the network: a follow queued
        // earlier — possibly from this sheet before it was closed — is the
        // truth about what this button should say, and the relays won't know
        // about it until it lands.
        import('@/lib/follows').then(({ queuedFollowState, onFollowsChanged, isFollowing }) => {
            if (cancelled) return;

            const fromQueue = () => {
                const queued = queuedFollowState(you, player.pubkey);
                if (queued === 'pending') { setFollows('following'); return true; }
                if (queued === 'failed') { setFollows('failed'); return true; }
                return false;
            };

            // Told when a queued follow lands or gives up, so a sheet still
            // open when the answer arrives stops claiming success.
            unsubscribe = onFollowsChanged(() => { if (!cancelled) fromQueue(); });

            if (fromQueue()) return;

            // Only then ask the relays. This decides a label and nothing else,
            // so it is allowed to be slow — the button does not wait for it.
            isFollowing(you, player.pubkey)
                .then((already) => {
                    // A tap while this was in flight has already set the
                    // state; a stale answer must not overwrite it.
                    if (cancelled || queuedFollowState(you, player.pubkey)) return;
                    setFollows(already === null ? 'unknown' : already ? 'following' : 'not-following');
                })
                .catch(() => { if (!cancelled) setFollows('unknown'); });
        }).catch(() => { if (!cancelled) setFollows('unknown'); });

        return () => {
            cancelled = true;
            unsubscribe?.();
        };
    }, [you, isYou, player.pubkey]);

    const onFollow = () => {
        if (!you) return;
        // Answered on the tap, not on the round trip. The work is queued and
        // retried in the background; the only thing that can still change this
        // is running out of attempts, which the subscription above reports.
        setFollows('following');
        void import('@/lib/follows').then(({ queueFollow }) => queueFollow(you, player.pubkey));
    };

    const onDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        // stopPropagation for the same reason HowToPlay does it: Palavra has a
        // page-level key listener that would read a bare letter as a guess.
        event.stopPropagation();
        if (event.key === 'Escape') { onClose(); return; }
        if (event.key !== 'Tab') return;
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
        if (!focusable || focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in"
            onClick={onClose}
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="palavra-player-title"
                onClick={(event) => event.stopPropagation()}
                onKeyDown={onDialogKeyDown}
                className="surface rounded-3xl p-6 max-w-sm w-full shadow-2xl max-h-[85vh] overflow-y-auto space-y-5 animate-in zoom-in-95"
            >
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <Avatar player={player} />
                        <h2 id="palavra-player-title" className="text-lg font-bold page-title truncate">
                            {player.name || shortPubkey(player.pubkey)}
                        </h2>
                    </div>
                    <button
                        ref={closeRef}
                        type="button"
                        onClick={onClose}
                        aria-label={t.playerClose}
                        className="shrink-0 -m-1 p-1 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <section className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                        {t.badgesTitle}
                    </h3>
                    {badges === null && (
                        <p className="flex items-center gap-2 text-sm text-zinc-500 py-2">
                            <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                            {t.badgesLoading}
                        </p>
                    )}
                    {badges?.length === 0 && (
                        <p className="text-sm text-zinc-500 py-2">
                            {isYou ? t.badgesNoneYours : t.badgesNone}
                        </p>
                    )}
                    {badges !== null && badges.length > 0 && (
                        <ul className="space-y-2">
                            {badges.map((badge) => <BadgeItem key={badge.coord} badge={badge} />)}
                        </ul>
                    )}
                </section>

                {!isYou && you && (
                    <button
                        type="button"
                        onClick={onFollow}
                        // Tappable while the preflight read is still out.
                        //
                        // It used to be disabled during 'loading', which made
                        // the button dead for as long as that read took — and
                        // it waits on every relay, so one that never answers
                        // costs the whole timeout. With a relay currently
                        // timing out that was twelve seconds of a greyed-out
                        // button, which is indistinguishable from broken.
                        //
                        // Nothing is risked by allowing the tap: follow() does
                        // its own read and is the one that decides, refusing
                        // outright if the list can't be seen. The preflight
                        // only ever chooses a label.
                        disabled={follows === 'following'}
                        className="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold bg-liturgy-500/10 text-liturgy-700 dark:text-liturgy-300 hover:bg-liturgy-500/20 transition-colors disabled:opacity-60 disabled:hover:bg-liturgy-500/10"
                    >
                        {follows === 'following'
                            ? <UserCheck size={15} aria-hidden="true" />
                            : <UserPlus size={15} aria-hidden="true" />}
                        {/* 'failed' is the only state that reports a failure,
                            and it is only reached once the queue has run out of
                            attempts. Everything else — including 'unknown', the
                            preflight not coming back — reads as "Seguir", since
                            the queue takes its own read and may well succeed
                            where the preflight didn't. */}
                        {follows === 'following' ? t.followingAlready
                            : follows === 'failed' ? t.followFailed
                                : t.followToDuel}
                    </button>
                )}

                {/* The reason to follow, said once under the button rather than
                    inside it. Duels are the payoff and nothing else in the app
                    explains where opponents come from. */}
                {!isYou && you && follows !== 'following' && (
                    <p className="flex items-start gap-1.5 text-xs text-zinc-500 -mt-2">
                        <Swords size={13} className="shrink-0 mt-0.5" aria-hidden="true" />
                        {t.followWhy}
                    </p>
                )}

                {!you && (
                    <p className="text-xs text-zinc-500">{t.signInFollow}</p>
                )}
            </div>
        </div>
    );
}

/** The player's picture, falling back to a person — as in Player.tsx. A medal
    here read as a badge they had won rather than as a missing photo. */
function Avatar({ player }: { player: PlayerRef }) {
    const [broken, setBroken] = useState(false);
    return (
        <span
            aria-hidden="true"
            className="h-10 w-10 shrink-0 rounded-full overflow-hidden bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center"
        >
            {player.picture && !broken
                ? <img
                    src={player.picture}
                    alt=""
                    // Origin only, as in Player.tsx — the host learns that the
                    // request came from this app and nothing about where in it.
                    referrerPolicy="origin"
                    className="h-full w-full object-cover"
                    onError={() => setBroken(true)}
                />
                : <User size={18} className="text-zinc-400" />}
        </span>
    );
}
