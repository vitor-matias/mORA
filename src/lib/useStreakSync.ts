import { useEffect } from 'react';
import { useAppStore } from '@/store/app';
import { useAuthStore } from '@/store/auth';

// Relays are shared infrastructure and the payload never changes faster than
// a prayer takes — one sync a minute per device is plenty.
const MIN_INTERVAL_MS = 60_000;
let lastSyncAt = 0;

/**
 * Keeps this device's streaks in step with the ones published under the same
 * Nostr identity: on app start, on sign-in, and whenever the app comes back
 * to the foreground (a phone opened in the evening should show what the
 * laptop recorded that morning).
 */
export function useStreakSync() {
    const pubkey = useAuthStore((s) => s.pubkey);
    const shareStreaks = useAppStore((s) => s.shareStreaks);

    useEffect(() => {
        if (!pubkey || !shareStreaks) return;

        const sync = async (force = false) => {
            const now = Date.now();
            if (!force && now - lastSyncAt < MIN_INTERVAL_MS) return;
            lastSyncAt = now;
            try {
                const { syncStreaksWithNostr } = await import('@/lib/nostr');
                await syncStreaksWithNostr();
            } catch (error) {
                // Offline, relay down, chunk load failed — the local streaks
                // stand on their own until the next attempt.
                console.warn('Streak sync skipped:', error);
            }
        };

        // Signing in (or switching identity) must sync immediately; the
        // throttle only guards the repeat visits below.
        sync(true);

        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') sync();
        };
        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => document.removeEventListener('visibilitychange', onVisibilityChange);
    }, [pubkey, shareStreaks]);
}
