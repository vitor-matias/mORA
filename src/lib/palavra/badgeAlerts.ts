// Telling a player they won something.
//
// A NIP-58 award is an event a publisher signs on a relay. Nothing about that
// reaches the person it names: until now a badge appeared only if they happened
// to open Perfil and scroll to the shelf, which is a poor way to learn you came
// third in July. This half of the feature watches for awards addressed to the
// signed-in identity and hands them to the UI, once each.
//
// "Once each" is per device and per identity — see `announcedBadges` in the
// palavra store. Nothing here decides whether a badge is genuine; fetchBadges
// already pins the issuer, and an award from anyone else never gets this far.

import type { EarnedBadge } from './badges';
import { badgeAnnouncementKey } from '@/store/palavra';

/**
 * The badges in `earned` this identity has not been told about yet.
 *
 * Pure and exported so the interesting rule — an unknown coordinate is new,
 * everything else is not — can be tested without relays or a store.
 */
export function unannouncedBadges(
    earned: EarnedBadge[],
    announced: Record<string, true>,
    pubkey: string,
): EarnedBadge[] {
    return earned.filter((badge) => !announced[badgeAnnouncementKey(pubkey, badge.coord)]);
}

/**
 * The system notification for newly won badges, when the app isn't on screen.
 *
 * Deliberately silent while the page is visible: the card the app shows is a
 * better version of the same news, and a notification tray entry duplicating
 * something already on screen is noise. This matters most at launch, where the
 * catch-up run announces badges won before the feature existed.
 *
 * Never asks for permission. Being awarded a badge is not the moment to put a
 * browser permission prompt in front of someone; if they have already allowed
 * notifications for the prayer reminders, this uses that, and otherwise it
 * stays quiet and the in-app card does the work.
 */
export async function notifyBadgeAwards(
    badges: EarnedBadge[],
    text: { title: string; body: (badges: EarnedBadge[]) => string },
): Promise<void> {
    if (badges.length === 0) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

    const options: NotificationOptions = {
        body: text.body(badges),
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        // One tag for all of them: two awards arriving together should read as
        // one piece of news, not stack up in the tray.
        tag: 'mora-palavra-badge',
    };
    try {
        // Prefer the service worker — a page-owned Notification is dismissed
        // along with the tab on mobile, which is where this is read.
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            const registration = await navigator.serviceWorker.ready;
            await registration.showNotification(text.title, options);
        } else {
            new Notification(text.title, options);
        }
    } catch (error) {
        // A blocked or unsupported notification must not cost the in-app card,
        // which is the part that always works.
        console.warn('Could not show the badge notification.', error);
    }
}
