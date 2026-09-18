import { useEffect } from 'react';
import { useAppStore } from '@/store/app';
import { useAuthStore } from '@/store/auth';

// Relays are shared infrastructure and neither payload changes faster than a
// prayer takes — one pull a minute per device is plenty.
const MIN_INTERVAL_MS = 60_000;
// A change here is often one of several — the reading face, then the rosary
// mode; three prayers starred in a row — so let the burst settle before
// publishing.
const PUBLISH_DEBOUNCE_MS = 2_000;

let lastSyncAt = 0;

// The running hook's pull, for the Palavra board to call when it opens.
let pullNow: ((force?: boolean) => Promise<void>) | null = null;

/** Pull now, past the throttle, if an identity is signed in. */
export function syncNostrNow(): void {
    void pullNow?.(true);
}

/**
 * Keeps this device in step with the others signed in under the same Nostr
 * identity: streaks (merged), the Palavra play log (merged), the starred
 * prayers and hymns (merged entry by entry), the reader-level settings (last
 * edit wins), and the cached profile (name, avatar — always overwritten with
 * whatever the relays currently have).
 * Runs on app start, on sign-in, when the app returns to the foreground, and —
 * for the settings and the favourites — shortly after any local change.
 * Screen-level preferences (theme, text size, scroll speed) stay on the device
 * that set them.
 */
export function useNostrSync() {
    const pubkey = useAuthStore((s) => s.login?.pubkey ?? s.lockedPubkey);
    const isLocked = useAuthStore((s) => s.isLocked);
    const shareStreaks = useAppStore((s) => s.shareStreaks);

    useEffect(() => {
        // A protected key that hasn't been unlocked this session can't sign or
        // decrypt anything. Prayers still count locally; syncing resumes on
        // unlock, which re-runs this effect.
        //
        // `shareStreaks` is not part of this guard: it governs the five syncs
        // below, not the public Palavra result, which has its own opt-in.
        if (!pubkey || isLocked) return;

        const pull = async (force = false) => {
            const now = Date.now();
            if (!force && now - lastSyncAt < MIN_INTERVAL_MS) return;
            lastSyncAt = now;
            try {
                const [{ syncStreaksWithNostr, syncSettingsWithNostr, syncFavouritesWithNostr, fetchNostrProfile }, { syncPalavraWithNostr, publishMissingResults }] =
                    await Promise.all([import('@/lib/nostr'), import('@/lib/palavra/nostr')]);
                // allSettled, not all: the five are independent, and a relay
                // that fails one shouldn't abandon the others — nor release
                // the throttle below and have every foreground retry all of
                // them because one is consistently unhappy.
                const named = shareStreaks
                    ? [
                        ['streaks', syncStreaksWithNostr()],
                        ['settings', syncSettingsWithNostr()],
                        ['favourites', syncFavouritesWithNostr()],
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

                // After the syncs rather than among them: a game this
                // identity played on another device arrives in that pull, and
                // whichever device is awake is the one that can publish it.
                //
                // Outside the `shareStreaks` branch on purpose — sharing
                // results is its own opt-in, and it is the one that is on by
                // default. Under that branch, a player with sync off got a
                // single attempt per game and no second chance.
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

        pullNow = pull;

        // Signing in (or switching identity) syncs immediately; the throttle
        // only guards the repeat visits below.
        pull(true);

        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') pull();
        };
        document.addEventListener('visibilitychange', onVisibilityChange);

        // Publish what changes here shortly after it does, so the other
        // devices see it without waiting for their next foreground. One timer
        // per payload: starring a prayer while a settings publish is pending
        // must not push the settings publish out (or cancel it).
        const timers = new Map<'settings' | 'favourites', number>();
        const publishSoon = (what: 'settings' | 'favourites') => {
            window.clearTimeout(timers.get(what));
            timers.set(what, window.setTimeout(async () => {
                try {
                    const nostr = await import('@/lib/nostr');
                    await (what === 'settings'
                        ? nostr.publishSettingsToNostr()
                        : nostr.publishFavouritesToNostr());
                } catch (error) {
                    console.warn(`${what} publish skipped:`, error);
                }
            }, PUBLISH_DEBOUNCE_MS));
        };

        const store = useAppStore.getState();
        let seenUpdatedAt = store.settingsUpdatedAt;
        let seenPrayers = store.prayerFavourites;
        let seenChants = store.chantFavourites;
        const unsubscribe = useAppStore.subscribe((state) => {
            if (state.settingsUpdatedAt !== seenUpdatedAt) {
                seenUpdatedAt = state.settingsUpdatedAt;
                // A pull that wins also moves settingsUpdatedAt. Publishing
                // that back would put the same snapshot on the relays again on
                // every foreground where the other device is ahead.
                if (!state.settingsFromRemote) publishSoon('settings');
            }
            // The logs are replaced wholesale on every toggle, so identity is
            // the change — and a merge that pulled another device's stars in
            // is not one this device has to send back.
            if (state.prayerFavourites !== seenPrayers || state.chantFavourites !== seenChants) {
                seenPrayers = state.prayerFavourites;
                seenChants = state.chantFavourites;
                if (!state.favouritesFromRemote) publishSoon('favourites');
            }
        });

        return () => {
            if (pullNow === pull) pullNow = null;
            document.removeEventListener('visibilitychange', onVisibilityChange);
            timers.forEach((timer) => window.clearTimeout(timer));
            unsubscribe();
        };
    }, [pubkey, shareStreaks, isLocked]);
}
