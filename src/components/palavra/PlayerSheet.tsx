import { useEffect, useRef, useState } from 'react';
import { Award, Loader2, Swords, UserCheck, UserPlus, X } from 'lucide-react';
import type { EarnedBadge } from '@/lib/palavra/badges';
import type { PlayerRef } from './Player';
import { BadgeItem } from './BadgeItem';
import { shortPubkey } from './playerLabel';
import { useTranslations } from '@/lib/i18n';

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

type FollowState = 'loading' | 'following' | 'not-following' | 'unknown' | 'saving' | 'failed';

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
        import('@/lib/follows')
            .then(({ isFollowing }) => isFollowing(you, player.pubkey))
            .then((already) => {
                if (cancelled) return;
                // Null means the read failed, which is not the same as "no".
                // Offering "Seguir" on an unknown list invites a write that
                // would replace it, and the write refuses for that reason —
                // so the button says so instead of lying.
                setFollows(already === null ? 'unknown' : already ? 'following' : 'not-following');
            })
            .catch(() => { if (!cancelled) setFollows('unknown'); });
        return () => { cancelled = true; };
    }, [you, isYou, player.pubkey]);

    const onFollow = async () => {
        if (!you) return;
        setFollows('saving');
        try {
            const { follow } = await import('@/lib/follows');
            await follow(you, player.pubkey);
            setFollows('following');
        } catch (error) {
            console.warn('Could not follow.', error);
            setFollows('failed');
        }
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
                        disabled={follows === 'following' || follows === 'saving' || follows === 'loading'}
                        className="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold bg-liturgy-500/10 text-liturgy-700 dark:text-liturgy-300 hover:bg-liturgy-500/20 transition-colors disabled:opacity-60 disabled:hover:bg-liturgy-500/10"
                    >
                        {follows === 'saving' && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
                        {follows === 'following' && <UserCheck size={15} aria-hidden="true" />}
                        {(follows === 'not-following' || follows === 'failed' || follows === 'unknown') && (
                            <UserPlus size={15} aria-hidden="true" />
                        )}
                        {follows === 'following' ? t.followingAlready
                            : follows === 'saving' ? t.followSaving
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
                : <Award size={18} className="text-zinc-400" />}
        </span>
    );
}
