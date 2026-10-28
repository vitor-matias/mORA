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
import { readReminderSchedule, matchReminder, reminderBody, reminderKey } from '@/lib/reminderSchedule';

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
    const url: string = (event.notification.data as { url?: string } | null)?.url ?? './';
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
            const existing = clients.find((c) => 'focus' in c);
            if (!existing) return self.clients.openWindow(url);
            const focused = await existing.focus();
            // An uncontrolled window can't be navigated; focusing it is still right.
            if (url !== './') await focused.navigate(url).catch(() => {});
            return focused;
        })
    );
});
