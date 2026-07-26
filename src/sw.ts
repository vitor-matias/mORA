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

self.skipWaiting();
clientsClaim();

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('push', (event) => {
    event.waitUntil(
        self.registration.showNotification('mORA — Hora da oração 🙏', {
            body: 'As leituras e orações de hoje esperam por si.',
            icon: 'pwa-192x192.png',
            badge: 'pwa-192x192.png',
            tag: 'mora-daily-reminder', // collapse duplicates
        })
    );
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
