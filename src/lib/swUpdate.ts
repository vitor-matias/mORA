/// <reference types="vite-plugin-pwa/client" />
// Keeps open and installed copies on the latest deploy. The browser only
// looks for a new sw.js on navigation, and an installed PWA resumed from the
// background never navigates, so it could run a stale build for days; and
// once a new worker does take over (sw.ts skips waiting), the page keeps
// running the old JS until something reloads it.
import { registerSW } from 'virtual:pwa-register';

registerSW({
    onRegisteredSW(_url, registration) {
        if (!registration) return;
        // Opening the app is a navigation, so the browser checks then; this
        // covers resuming. Offline or a flaky network: the next resume retries.
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') registration.update().catch(() => {});
        });
    },
    // Only called when an update takes control, never on the first install.
    // Reloading under the user would drop what they are typing, so a visible
    // page waits until it is next hidden (or shown again).
    onNeedReload() {
        if (document.visibilityState === 'hidden') location.reload();
        else document.addEventListener('visibilitychange', () => location.reload(), { once: true });
    },
});
