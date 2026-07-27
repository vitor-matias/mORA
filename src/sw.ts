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
import { readReminderSchedule, matchReminder } from '@/lib/reminderSchedule';

self.skipWaiting();
clientsClaim();

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('push', (event) => {
    event.waitUntil((async () => {
        // Pushes carry no payload, so name the reminder from the schedule the
        // app last wrote. Unknown (schedule missing or clock far off) falls
        // back to the generic wording.
        const entry = matchReminder(await readReminderSchedule(), new Date());
        await self.registration.showNotification(entry?.title ?? 'mORA — Hora da oração 🙏', {
            body: entry?.body ?? 'As leituras e orações de hoje esperam por si.',
            icon: 'pwa-192x192.png',
            badge: 'pwa-192x192.png',
            // Per-reminder tag, so an Hour never collapses onto another one.
            tag: entry ? `mora-reminder-${entry.time}` : 'mora-daily-reminder',
        });
    })());
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
            const existing = clients.find((c) => 'focus' in c);
            if (existing) return existing.focus();
            return self.clients.openWindow('./');
        })
    );
});
