import { finalizeEvent, SimplePool, nip44, type Event, type EventTemplate } from 'nostr-tools';
import { hexToBytes } from '@noble/hashes/utils';
import { useAuthStore } from '@/store/auth';
import {
    useAppStore, mergeStreaks, streaksEqual, emptyStreaks, sanitizeSyncedSettings, settingsEqual,
    type Streaks, type SyncedSettings,
} from '@/store/app';

const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net'];
const pool = new SimplePool();

export const MORA_APP_PUBKEY = 'mora_app'; // Could be used in tags to identify app

// NIP-78 "Application-specific Data": addressable event, replaced per d-tag.
// (30000 would collide with NIP-51 follow sets.)
const KIND_APP_STATE = 30078;

// Addressable events are keyed by their d-tag, so streaks and settings live
// side by side under one identity without overwriting each other.
const D_STREAK = 'mora-app-streak';
const D_SETTINGS = 'mora-app-settings';

// querySync resolves on EOSE, which an unresponsive relay never sends — so
// without a ceiling a single dead relay would hang the whole sync.
const RELAY_QUERY_TIMEOUT_MS = 5000;

// One sync of each kind at a time; overlapping callers await the same run.
let inFlightStreakSync: Promise<void> | null = null;
let inFlightSettingsSync: Promise<void> | null = null;

export interface NostrProfile {
    name?: string;
    display_name?: string;
    picture?: string;
    about?: string;
}

// Signs with the NIP-07 extension when available, otherwise with the locally
// stored private key.
async function signNostrEvent(baseEvent: EventTemplate): Promise<Event> {
    const { privkey, isNip07 } = useAuthStore.getState();
    if (isNip07 && typeof window !== 'undefined' && window.nostr) {
        return window.nostr.signEvent(baseEvent);
    }
    if (privkey) {
        return finalizeEvent(baseEvent, hexToBytes(privkey));
    }
    throw new Error('No method available to sign the event');
}

export async function fetchNostrProfile(pubkey: string): Promise<NostrProfile | null> {
    try {
        const events = await pool.querySync(RELAYS, { kinds: [0], authors: [pubkey], limit: 1 });
        if (events.length > 0) {
            return JSON.parse(events[0].content) as NostrProfile;
        }
        return null;
    } catch (error) {
        console.error('Failed to fetch Nostr profile:', error);
        return null;
    }
}

export async function publishNostrProfile(profile: NostrProfile) {
    const { pubkey } = useAuthStore.getState();
    if (!pubkey) throw new Error("Not logged in");

    const baseEvent: EventTemplate = {
        kind: 0,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify(profile)
    };

    try {
        const signedEvent = await signNostrEvent(baseEvent);

        await Promise.any(pool.publish(RELAYS, signedEvent));
        console.log('Successfully published profile to Nostr:', signedEvent);
        return signedEvent;
    } catch (error) {
        console.error('Failed to publish Nostr profile:', error);
        throw error;
    }
}

// Community pulse: who prayed today, and how many. Streak events are
// encrypted, but their existence is public metadata — each opted-in user
// republishes their (replaceable) streak event on completing a prayer, so
// counting distinct pubkeys with an update since local midnight counts
// today's praying users without reading anyone's content. Undercounts by
// design: only users with shareStreaks on are visible.
export interface PrayerPulse {
    count: number;
    /** Display names of the most recent few — only those with a public
        Nostr profile, so this is usually shorter than `count`. */
    names: string[];
}

let prayerPulseCache: { value: PrayerPulse; fetchedAt: number; since: number } | null = null;
const PRAYER_COUNT_TTL_MS = 5 * 60 * 1000;
/** How many names to show, and how many profiles to look up to find them. */
const PULSE_NAMES_SHOWN = 3;
const PULSE_PROFILES_QUERIED = 12;

export async function fetchTodayPrayerPulse(): Promise<PrayerPulse | null> {
    const since = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000);
    // Keyed on `since` too, so the cache dies the moment "today" rolls over.
    if (prayerPulseCache && prayerPulseCache.since === since
        && Date.now() - prayerPulseCache.fetchedAt < PRAYER_COUNT_TTL_MS) {
        return prayerPulseCache.value;
    }
    try {
        const events = await pool.querySync(RELAYS, {
            kinds: [KIND_APP_STATE],
            '#d': [D_STREAK],
            since,
        });
        // Most recent first, so the names shown are whoever prayed last.
        const pubkeys = [...new Set(
            [...events].sort((a, b) => b.created_at - a.created_at).map((e) => e.pubkey)
        )];
        const names = await fetchDisplayNames(pubkeys.slice(0, PULSE_PROFILES_QUERIED));
        const value: PrayerPulse = { count: pubkeys.length, names: names.slice(0, PULSE_NAMES_SHOWN) };
        prayerPulseCache = { value, fetchedAt: Date.now(), since };
        return value;
    } catch (error) {
        console.warn('Could not fetch community prayer pulse:', error);
        return null;
    }
}

/** Newest kind-0 name per pubkey, in the order the pubkeys were given.
    Pubkeys with no profile (or no name in it) are simply dropped. */
async function fetchDisplayNames(pubkeys: string[]): Promise<string[]> {
    if (pubkeys.length === 0) return [];
    let metadata: Event[];
    try {
        metadata = await pool.querySync(RELAYS, { kinds: [0], authors: pubkeys });
    } catch (error) {
        console.warn('Could not fetch profiles for the prayer pulse:', error);
        return [];
    }
    const newest = new Map<string, Event>();
    for (const event of metadata) {
        const prev = newest.get(event.pubkey);
        if (!prev || event.created_at > prev.created_at) newest.set(event.pubkey, event);
    }
    const names: string[] = [];
    for (const pubkey of pubkeys) {
        const event = newest.get(pubkey);
        if (!event) continue;
        try {
            const profile = JSON.parse(event.content) as NostrProfile;
            // Names are attacker-controlled: collapse whitespace and cap the
            // length so a hostile profile can't wreck the Home layout.
            const name = (profile.display_name || profile.name || '')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 24);
            if (name) names.push(name);
        } catch { /* malformed profile JSON — skip this one */ }
    }
    return names;
}

// NIP-44 to self, so relays only ever store ciphertext. Returns null when
// there is no encryption path (e.g. a NIP-07 extension without nip44) —
// callers skip rather than fall back to plaintext.
async function encryptToSelf(plaintext: string): Promise<string | null> {
    const { pubkey, privkey, isNip07 } = useAuthStore.getState();
    if (!pubkey) return null;
    if (isNip07 && typeof window !== 'undefined' && window.nostr?.nip44) {
        return window.nostr.nip44.encrypt(pubkey, plaintext);
    }
    if (privkey) {
        const conversationKey = nip44.v2.utils.getConversationKey(hexToBytes(privkey), pubkey);
        return nip44.v2.encrypt(plaintext, conversationKey);
    }
    return null;
}

async function decryptFromSelf(ciphertext: string): Promise<string | null> {
    const { pubkey, privkey, isNip07 } = useAuthStore.getState();
    if (!pubkey) return null;
    if (isNip07 && typeof window !== 'undefined' && window.nostr?.nip44) {
        return window.nostr.nip44.decrypt(pubkey, ciphertext);
    }
    if (privkey) {
        const conversationKey = nip44.v2.utils.getConversationKey(hexToBytes(privkey), pubkey);
        return nip44.v2.decrypt(ciphertext, conversationKey);
    }
    return null;
}

/** The newest snapshot this identity published under `dTag`, decrypted, or
    null if there is none (or it can't be read). */
async function fetchSnapshot(
    pubkey: string,
    dTag: string,
): Promise<{ payload: Record<string, unknown>; createdAt: number } | null> {
    let events: Event[];
    try {
        events = await pool.querySync(RELAYS, {
            kinds: [KIND_APP_STATE],
            authors: [pubkey],
            '#d': [dTag],
        }, { maxWait: RELAY_QUERY_TIMEOUT_MS });
    } catch (error) {
        console.warn(`Could not fetch ${dTag} from Nostr relays.`, error);
        return null;
    }
    if (events.length === 0) return null;

    // Relays each hold their own copy of a replaceable event and can lag —
    // the newest across all of them is the one to trust.
    const newest = events.reduce((a, b) => (b.created_at > a.created_at ? b : a));
    try {
        const plaintext = await decryptFromSelf(newest.content);
        if (!plaintext) return null;
        const payload = JSON.parse(plaintext) as Record<string, unknown>;
        if (!payload || typeof payload !== 'object') return null;
        return { payload, createdAt: newest.created_at };
    } catch (error) {
        console.warn(`Could not read the ${dTag} snapshot from Nostr.`, error);
        return null;
    }
}

async function publishSnapshot(dTag: string, payload: Record<string, unknown>, label: string) {
    let eventContent: string;
    try {
        const encrypted = await encryptToSelf(JSON.stringify(payload));
        if (!encrypted) {
            console.warn(`No NIP-44 encryption available; not publishing ${label}.`);
            return;
        }
        eventContent = encrypted;
    } catch (error) {
        console.warn(`Failed to encrypt ${label}; not publishing.`, error);
        return;
    }

    const baseEvent: EventTemplate = {
        kind: KIND_APP_STATE,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
            ['d', dTag], // The distinct string for this parameterized replaceable event
            ['client', 'mora'],
        ],
        content: eventContent,
    };

    try {
        const signedEvent = await signNostrEvent(baseEvent);
        await Promise.any(pool.publish(RELAYS, signedEvent));
        console.log(`Successfully published ${label} to Nostr.`);
    } catch (error) {
        // Relays reject or go offline routinely — warn rather than throw.
        console.warn(`Could not publish ${label} to Nostr relays. Continuing anyway.`, error);
    }
}

export async function publishStreakToNostr() {
    const { pubkey } = useAuthStore.getState();
    const { streaks, shareStreaks } = useAppStore.getState();
    if (!pubkey) return; // Not logged in
    // Prayer activity is sensitive — syncing it to relays is opt-in.
    if (!shareStreaks) return;

    await publishSnapshot(D_STREAK, { streaks, lastUpdate: new Date().toISOString() }, 'streaks');
}

export async function publishSettingsToNostr() {
    const { pubkey } = useAuthStore.getState();
    const state = useAppStore.getState();
    if (!pubkey || !state.shareStreaks) return;

    const settings: SyncedSettings = {
        theme: state.theme,
        fontSize: state.fontSize,
        fontFamily: state.fontFamily,
        autoScrollSpeed: state.autoScrollSpeed,
        rosaryMode: state.rosaryMode,
    };
    await publishSnapshot(D_SETTINGS, { settings, updatedAt: state.settingsUpdatedAt }, 'settings');
}

/**
 * Pulls this identity's published streaks and merges them into the local
 * store, then republishes if this device now knows more than the relays do.
 * Safe to call repeatedly; the merge is idempotent.
 */
export function syncStreaksWithNostr(): Promise<void> {
    // Sign-in forces a sync past the hook's throttle, which can land while a
    // foreground-triggered one is still in flight. Both would fetch, merge and
    // publish the same replaceable event, so callers share the first run.
    inFlightStreakSync ??= doSyncStreaks().finally(() => { inFlightStreakSync = null; });
    return inFlightStreakSync;
}

async function doSyncStreaks(): Promise<void> {
    const { pubkey } = useAuthStore.getState();
    if (!pubkey || !useAppStore.getState().shareStreaks) return;

    const snapshot = await fetchSnapshot(pubkey, D_STREAK);
    // A payload whose `streaks` is not an object is no snapshot at all —
    // treating it as one would suppress the re-seed below.
    const raw = snapshot?.payload.streaks;
    const remote = (raw && typeof raw === 'object' ? raw : null) as Streaks | null;
    // Read the store after the round-trip, not before: a prayer may have
    // completed while the query was in flight.
    const { streaks: local, setStreaks } = useAppStore.getState();
    const merged = mergeStreaks(local, remote);

    if (!streaksEqual(merged, local)) setStreaks(merged);

    // Seed the relays on first sync, and push whatever they were missing.
    // publishStreakToNostr reads the store, so it picks up the merge above.
    if (!remote || !streaksEqual(merged, mergeStreaks(emptyStreaks(), remote))) {
        await publishStreakToNostr();
    }
}

/**
 * Settings are last-write-wins on `settingsUpdatedAt` — unlike streaks there
 * is nothing to reconcile between two devices, only a question of which edit
 * came last.
 */
export function syncSettingsWithNostr(): Promise<void> {
    inFlightSettingsSync ??= doSyncSettings().finally(() => { inFlightSettingsSync = null; });
    return inFlightSettingsSync;
}

async function doSyncSettings(): Promise<void> {
    const { pubkey } = useAuthStore.getState();
    if (!pubkey || !useAppStore.getState().shareStreaks) return;

    const snapshot = await fetchSnapshot(pubkey, D_SETTINGS);
    const state = useAppStore.getState();
    const remoteUpdatedAt = typeof snapshot?.payload.updatedAt === 'number'
        ? (snapshot.payload.updatedAt as number)
        : 0;
    const remoteSettings = sanitizeSyncedSettings(snapshot?.payload.settings);

    const localSettings: SyncedSettings = {
        theme: state.theme,
        fontSize: state.fontSize,
        fontFamily: state.fontFamily,
        autoScrollSpeed: state.autoScrollSpeed,
        rosaryMode: state.rosaryMode,
    };

    if (snapshot && remoteUpdatedAt > state.settingsUpdatedAt) {
        if (!settingsEqual(localSettings, remoteSettings)) {
            state.applySyncedSettings(remoteSettings, remoteUpdatedAt);
        }
        return;
    }
    // This device edited last (or the relays have nothing) — publish, but not
    // if the two already agree, so a plain app start doesn't write anything.
    if (!snapshot || !settingsEqual(localSettings, remoteSettings)) {
        await publishSettingsToNostr();
    }
}
