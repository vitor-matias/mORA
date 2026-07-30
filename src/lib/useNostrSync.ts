import { useEffect } from 'react';
import { useAppStore } from '@/store/app';
import { useAuthStore } from '@/store/auth';

// Relays are shared infrastructure and neither payload changes faster than a
// prayer takes — one pull a minute per device is plenty.
const MIN_INTERVAL_MS = 60_000;
// A settings edit is often one of several (theme, then font, then size), so
// let the burst settle before publishing.
const SETTINGS_DEBOUNCE_MS = 2_000;

let lastSyncAt = 0;

/**
 * Keeps this device in step with the others signed in under the same Nostr
 * identity: streaks (merged) and display settings (last edit wins). Runs on
 * app start, on sign-in, when the app returns to the foreground, and — for
 * settings — shortly after any local change.
 */
export function useNostrSync() {
    const pubkey = useAuthStore((s) => s.pubkey);
    const isLocked = useAuthStore((s) => s.isLocked);
    const shareStreaks = useAppStore((s) => s.shareStreaks);

    useEffect(() => {
        // A protected key that hasn't been unlocked this session can't sign or
        // decrypt anything. Prayers still count locally; syncing resumes on
        // unlock, which re-runs this effect.
        if (!pubkey || !shareStreaks || isLocked) return;

        const pull = async (force = false) => {
            const now = Date.now();
            if (!force && now - lastSyncAt < MIN_INTERVAL_MS) return;
            lastSyncAt = now;
            try {
                const { syncStreaksWithNostr, syncSettingsWithNostr } = await import('@/lib/nostr');
                await Promise.all([syncStreaksWithNostr(), syncSettingsWithNostr()]);
            } catch (error) {
                // Offline, relay down, chunk load failed — this device's own
                // state stands until the next attempt. Release the throttle so
                // that attempt can be the next foreground rather than a minute
                // from now.
                lastSyncAt = 0;
                console.warn('Nostr sync skipped:', error);
            }
        };

        // Signing in (or switching identity) syncs immediately; the throttle
        // only guards the repeat visits below.
        pull(true);

        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') pull();
        };
        document.addEventListener('visibilitychange', onVisibilityChange);

        // Publish settings shortly after they change here, so the other
        // devices see the edit without waiting for their next foreground.
        let seenUpdatedAt = useAppStore.getState().settingsUpdatedAt;
        let debounce: number | undefined;
        const unsubscribe = useAppStore.subscribe((state) => {
            if (state.settingsUpdatedAt === seenUpdatedAt) return;
            seenUpdatedAt = state.settingsUpdatedAt;
            window.clearTimeout(debounce);
            debounce = window.setTimeout(async () => {
                try {
                    const { publishSettingsToNostr } = await import('@/lib/nostr');
                    await publishSettingsToNostr();
                } catch (error) {
                    console.warn('Settings publish skipped:', error);
                }
            }, SETTINGS_DEBOUNCE_MS);
        });

        return () => {
            document.removeEventListener('visibilitychange', onVisibilityChange);
            window.clearTimeout(debounce);
            unsubscribe();
        };
    }, [pubkey, shareStreaks, isLocked]);
}
