import { useEffect } from 'react';
import { useAppStore } from '@/store/app';
import { useAuthStore } from '@/store/auth';

// Relays are shared infrastructure and neither payload changes faster than a
// prayer takes — one pull a minute per device is plenty.
const MIN_INTERVAL_MS = 60_000;
// A settings edit is often one of several (the reading face, then the rosary
// mode), so let the burst settle before publishing.
const SETTINGS_DEBOUNCE_MS = 2_000;

let lastSyncAt = 0;

/**
 * Keeps this device in step with the others signed in under the same Nostr
 * identity: streaks (merged), the Palavra play log (merged), the
 * reader-level settings (last edit wins), and the cached profile (name,
 * avatar — always overwritten with whatever the relays currently have).
 * Runs on app start, on sign-in, when the app returns to the foreground, and —
 * for settings — shortly after any local change. Screen-level preferences
 * (theme, text size, scroll speed) stay on the device that set them.
 */
export function useNostrSync() {
    const pubkey = useAuthStore((s) => s.login?.pubkey ?? s.lockedPubkey);
    const isLocked = useAuthStore((s) => s.isLocked);
    const shareStreaks = useAppStore((s) => s.shareStreaks);

    useEffect(() => {
        // A protected key that hasn't been unlocked this session can't sign or
        // decrypt anything, so nothing below can run. Prayers still count
        // locally; syncing resumes on unlock, which re-runs this effect.
        //
        // `shareStreaks` is not checked here: it governs the four syncs, not
        // the public Palavra result, which has its own opt-in — see the
        // catch-up below.
        if (!pubkey || isLocked) return;

        const pull = async (force = false) => {
            const now = Date.now();
            if (!force && now - lastSyncAt < MIN_INTERVAL_MS) return;
            lastSyncAt = now;
            try {
                const [{ syncStreaksWithNostr, syncSettingsWithNostr, fetchNostrProfile }, { syncPalavraWithNostr, publishMissingResults }] =
                    await Promise.all([import('@/lib/nostr'), import('@/lib/palavra/nostr')]);
                // allSettled, not all: the four are independent, and a relay
                // that fails one shouldn't abandon the others — nor release
                // the throttle below and have every foreground retry all of
                // them because one is consistently unhappy.
                const named = shareStreaks
                    ? [
                        ['streaks', syncStreaksWithNostr()],
                        ['settings', syncSettingsWithNostr()],
                        ['palavra', syncPalavraWithNostr()],
                        // Keeps the cached profile (name, avatar) from going
                        // stale when it's edited from another client — the
                        // cache itself is what lets Home show it instantly on
                        // every visit.
                        ['profile', fetchNostrProfile(pubkey).then(p => {
                            if (p) useAuthStore.getState().setProfile(p);
                        })],
                    ] as const
                    : [] as const;
                const settled = await Promise.allSettled(named.map(([, task]) => task));
                // allSettled swallows the reasons, which left a sync that
                // failed every time with nothing to diagnose it by.
                settled.forEach((result, i) => {
                    if (result.status === 'rejected') {
                        console.warn(`Nostr sync failed for ${named[i][0]}:`, result.reason);
                    }
                });

                // After the merge, not beside it: a game this identity played
                // on another device arrives in that pull, and the device that
                // is awake is the one that can publish it.
                //
                // Outside the `shareStreaks` branch on purpose. Sharing
                // results is its own opt-in, and with sync off — the default —
                // this retry was unreachable, which left the publish fired
                // when the board is completed as the only attempt a result
                // ever got. One unlucky moment offline and the game was gone
                // from the board for good.
                await publishMissingResults(pubkey);
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
            // A pull that wins also moves settingsUpdatedAt. Publishing that
            // back would put the same snapshot on the relays again on every
            // foreground where the other device is ahead.
            if (state.settingsFromRemote) return;
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
