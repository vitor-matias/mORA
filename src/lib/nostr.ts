import { finalizeEvent, SimplePool, nip44, type Event, type EventTemplate } from 'nostr-tools';
import { hexToBytes } from '@noble/hashes/utils';
import { useAuthStore } from '@/store/auth';
import { useAppStore } from '@/store/app';

const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net'];
const pool = new SimplePool();

export const MORA_APP_PUBKEY = 'mora_app'; // Could be used in tags to identify app

// NIP-78 "Application-specific Data": addressable event, replaced per d-tag.
// (30000 would collide with NIP-51 follow sets.)
const KIND_APP_STATE = 30078;

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

// Community pulse: how many people prayed today. Streak events are
// encrypted, but their existence is public metadata — each opted-in user
// republishes their (replaceable) streak event on completing a prayer, so
// counting distinct pubkeys with an update since local midnight counts
// today's praying users without reading anyone's content. Undercounts by
// design: only users with shareStreaks on are visible.
let prayerCountCache: { value: number; fetchedAt: number } | null = null;
const PRAYER_COUNT_TTL_MS = 5 * 60 * 1000;

export async function fetchTodayPrayerCount(): Promise<number | null> {
    if (prayerCountCache && Date.now() - prayerCountCache.fetchedAt < PRAYER_COUNT_TTL_MS) {
        return prayerCountCache.value;
    }
    try {
        const since = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000);
        const events = await pool.querySync(RELAYS, {
            kinds: [KIND_APP_STATE],
            '#d': ['mora-app-streak'],
            since,
        });
        const value = new Set(events.map((e) => e.pubkey)).size;
        prayerCountCache = { value, fetchedAt: Date.now() };
        return value;
    } catch (error) {
        console.warn('Could not fetch community prayer count:', error);
        return null;
    }
}

export async function publishStreakToNostr() {
    const { pubkey, privkey, isNip07 } = useAuthStore.getState();
    const { streaks, shareStreaks } = useAppStore.getState();

    if (!pubkey) return; // Not logged in
    // Prayer activity is sensitive — syncing it to public relays is opt-in.
    if (!shareStreaks) return;

    const plaintext = JSON.stringify({
        streaks: streaks,
        lastUpdate: new Date().toISOString()
    });

    // NIP-44 encrypt to self, so relays only ever store ciphertext. Without
    // an encryption path (e.g. a NIP-07 extension without nip44) we skip
    // publishing rather than fall back to plaintext.
    let eventContent: string;
    try {
        if (isNip07 && typeof window !== 'undefined' && window.nostr?.nip44) {
            eventContent = await window.nostr.nip44.encrypt(pubkey, plaintext);
        } else if (privkey) {
            const conversationKey = nip44.v2.utils.getConversationKey(hexToBytes(privkey), pubkey);
            eventContent = nip44.v2.encrypt(plaintext, conversationKey);
        } else {
            console.warn('No NIP-44 encryption available; not publishing streaks.');
            return;
        }
    } catch (error) {
        console.warn('Failed to encrypt streaks; not publishing.', error);
        return;
    }

    const baseEvent: EventTemplate = {
        kind: KIND_APP_STATE,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
            ['d', 'mora-app-streak'], // The distinct string for this parameterized replaceable event
            ['client', 'mora']
        ],
        content: eventContent
    };

    try {
        const signedEvent = await signNostrEvent(baseEvent);

        // Publish to relays
        await Promise.any(pool.publish(RELAYS, signedEvent));
        console.log('Successfully published streak to Nostr:', signedEvent);

    } catch (error) {
        // It's common for relays to reject or be offline, just warn instead of erroring loudly
        console.warn('Could not publish streak to Nostr relays. Continuing anyway.', error);
    }
}
