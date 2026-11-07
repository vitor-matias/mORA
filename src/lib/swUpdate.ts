/// <reference types="vite-plugin-pwa/client" />
// Keeps open and installed copies on the latest deploy. The browser only
// looks for a new sw.js on navigation, and an installed PWA resumed from the
// background never navigates, so it could run a stale build for days; and
// once a new worker does take over (sw.ts skips waiting), the page keeps
// running the old JS until something reloads it.
import { registerSW } from 'virtual:pwa-register';

const UPDATE_CHECK_MS = 60 * 60 * 1000;

registerSW({
    onRegisteredSW(_url, registration) {
        if (!registration) return;
        // Offline or a flaky network: the next check tries again.
        const check = () => registration.update().catch(() => {});
        setInterval(check, UPDATE_CHECK_MS);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') check();
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
