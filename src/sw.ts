/// <reference lib="webworker" />
// Custom service worker (vite-plugin-pwa injectManifest). Keeps the same
// precache-everything/auto-update behaviour generateSW gave us, plus Web
// Push: pushes are sent WITHOUT a payload (no RFC 8291 encryption needed
// server-side), so the notification text lives here.
declare let self: ServiceWorkerGlobalScope & {
    __WB_MANIFEST: Parameters<typeof precacheAndRoute>[0];
};

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { readReminderSchedule, matchReminder, reminderBody, reminderKey, reminderRoute } from '@/lib/reminderSchedule';

self.skipWaiting();
clientsClaim();

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('push', (event) => {
    event.waitUntil((async () => {
        // Pushes carry no payload, so name the reminder from the schedule the
        // app last wrote. Unknown (schedule missing or clock far off) falls
        // back to the generic wording.
        let entry: Awaited<ReturnType<typeof readReminderSchedule>>[number] | null = null;
        try {
            entry = matchReminder(await readReminderSchedule(), new Date());
        } catch {
            // Naming the reminder is a nicety; showing one is not. A push must
            // never end up silent (browsers penalise that), so fall through to
            // the generic wording.
        }
        await self.registration.showNotification(entry?.title ?? 'Oremus — Hora da oração 🙏', {
            body: entry ? reminderBody(entry, new Date()) : 'As leituras e orações de hoje esperam por ti.',
            icon: 'pwa-192x192.png',
            badge: 'pwa-192x192.png',
            // Per-reminder tag, so an Hour never collapses onto another one.
            tag: entry ? `mora-reminder-${reminderKey(entry)}` : 'mora-daily-reminder',
            data: { url: entry?.url },
        });
    })());
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    // Routing is hash-based, so a route is "./#/path".
    const route: unknown = event.notification.data?.url;
    const target = typeof route === 'string' && route.startsWith('/') ? `./#${reminderRoute(route)}` : './';
    event.waitUntil(
        // Controlled windows only: navigate() rejects for the rest.
        self.clients.matchAll({ type: 'window' }).then(async (clients) => {
            const existing = clients.find((c) => 'focus' in c);
            if (!existing) return self.clients.openWindow(target);
            try {
                await existing.focus();
                // No route (generic notification): leave the page the user is on.
                if (target === './') return;
                // A hash-only change does not reload the page.
                await existing.navigate(new URL(target, self.registration.scope).href);
            } catch {
                await self.clients.openWindow(target);
            }
        })
    );
});
