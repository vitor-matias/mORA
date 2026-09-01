import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/store/auth';
import { usePalavraStore } from '@/store/palavra';
import { useTranslations } from '@/lib/i18n';
import { PALAVRA_IS_MOCK } from './api';
import type { EarnedBadge } from './badges';
import { notifyBadgeAwards, unannouncedBadges } from './badgeAlerts';

/** Awards are monthly, so there is nothing to gain from asking often. This is
    the floor between two relay reads within one session. */
const RECHECK_MS = 60 * 60 * 1000;

/** The read waits on relays; the app's own start-up should not. */
const FIRST_CHECK_DELAY_MS = 4000;

/**
 * Newly awarded badges for the signed-in identity, for the app to announce.
 *
 * Checks on mount, and again when the app comes back to the foreground after
 * an hour away — the two moments an award can have appeared while nobody was
 * looking. Signed out, or in demo mode where no issuer is pinned, it does
 * nothing at all: there is no one to have won anything.
 *
 * `pending` is cleared by `dismiss`, but the badges are marked announced as
 * soon as they are handed over. A reload between "shown" and "dismissed" would
 * otherwise start the announcement again on the next launch, and a badge that
 * keeps announcing itself is worse than one announced once.
 */
export function useBadgeAwards(): { pending: EarnedBadge[]; dismiss: () => void } {
    const pubkey = useAuthStore((s) => s.login?.pubkey ?? s.lockedPubkey ?? null);
    const markBadgesAnnounced = usePalavraStore((s) => s.markBadgesAnnounced);
    const t = useTranslations().palavra;
    // Tagged with whose award it is, so signing out mid-session cannot leave
    // the previous identity's badge on screen for whoever signs in next: the
    // award is simply not rendered for anyone but its recipient.
    const [awarded, setAwarded] = useState<{ pubkey: string; badges: EarnedBadge[] } | null>(null);
    // When the last read finished, so returning to the app doesn't re-read on
    // every glance. A ref rather than state: it must not re-run the effect.
    const lastCheck = useRef(0);

    const dismiss = useCallback(() => setAwarded(null), []);

    useEffect(() => {
        if (!pubkey || PALAVRA_IS_MOCK) return;
        let cancelled = false;

        const check = async () => {
            if (cancelled) return;
            lastCheck.current = Date.now();
            let earned: EarnedBadge[];
            try {
                const { fetchBadges } = await import('./badges');
                earned = await fetchBadges(pubkey);
            } catch (error) {
                // Relays being unreachable is ordinary. The badge stays
                // unannounced, so the next check picks it up.
                console.warn('Could not check for new badges.', error);
                return;
            }
            if (cancelled) return;

            // Read the store here rather than through the hook's props: this
            // runs long after the effect was set up, and the subscription
            // would only re-run it.
            const { announcedBadges } = usePalavraStore.getState();
            const fresh = unannouncedBadges(earned, announcedBadges, pubkey);
            if (fresh.length === 0) return;

            markBadgesAnnounced(pubkey, fresh.map((badge) => badge.coord));
            setAwarded({ pubkey, badges: fresh });
            void notifyBadgeAwards(fresh, {
                title: t.badgeAwardNotificationTitle,
                body: (badges) => t.badgeAwardNotificationBody(badges.map((b) => b.name)),
            });
        };

        const firstCheck = window.setTimeout(check, FIRST_CHECK_DELAY_MS);

        // An award signed while the app sat in the background is the common
        // case on a phone, where the tab is rarely closed and rarely on screen.
        const onVisible = () => {
            if (document.visibilityState !== 'visible') return;
            if (Date.now() - lastCheck.current < RECHECK_MS) return;
            void check();
        };
        document.addEventListener('visibilitychange', onVisible);

        return () => {
            cancelled = true;
            window.clearTimeout(firstCheck);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [pubkey, markBadgesAnnounced, t]);

    return { pending: awarded && awarded.pubkey === pubkey ? awarded.badges : [], dismiss };
}
