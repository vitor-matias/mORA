import { finalizeEvent, SimplePool, type EventTemplate } from 'nostr-tools';
import { useAuthStore } from '@/store/auth';
import { useAppStore } from '@/store/app';

const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net'];
const pool = new SimplePool();

export const MORA_APP_PUBKEY = 'mora_app'; // Could be used in tags to identify app

// Ensure kind is a valid number
const KIND_APP_STATE = 30000;

export interface NostrProfile {
    name?: string;
    display_name?: string;
    picture?: string;
    about?: string;
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
    const { pubkey, privkey, isNip07 } = useAuthStore.getState();
    if (!pubkey) throw new Error("Not logged in");

    const baseEvent: EventTemplate = {
        kind: 0,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify(profile)
    };

    try {
        let signedEvent;
        if (isNip07 && typeof window !== 'undefined' && (window as any).nostr) {
            signedEvent = await (window as any).nostr.signEvent(baseEvent);
        } else if (privkey) {
            const secretKeyBytes = new Uint8Array(privkey.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
            signedEvent = finalizeEvent(baseEvent, secretKeyBytes);
        } else {
            throw new Error('No method available to sign the event');
        }

        await Promise.any(pool.publish(RELAYS, signedEvent));
        console.log('Successfully published profile to Nostr:', signedEvent);
        return signedEvent;
    } catch (error) {
        console.error('Failed to publish Nostr profile:', error);
        throw error;
    }
}

export async function publishStreakToNostr() {
    const { pubkey, privkey, isNip07 } = useAuthStore.getState();
    const { streaks } = useAppStore.getState();

    if (!pubkey) return; // Not logged in

    const eventContent = JSON.stringify({
        streaks: streaks,
        lastUpdate: new Date().toISOString()
    });

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
        let signedEvent;
        if (isNip07 && typeof window !== 'undefined' && (window as any).nostr) {
            signedEvent = await (window as any).nostr.signEvent(baseEvent);
        } else if (privkey) {
            const secretKeyBytes = new Uint8Array(privkey.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
            signedEvent = finalizeEvent(baseEvent, secretKeyBytes);
        } else {
            throw new Error('No method available to sign the event');
        }

        // Publish to relays
        await Promise.any(pool.publish(RELAYS, signedEvent));
        console.log('Successfully published streak to Nostr:', signedEvent);

    } catch (error) {
        // It's common for relays to reject or be offline, just warn instead of erroring loudly
        console.warn('Could not publish streak to Nostr relays. Continuing anyway.', error);
    }
}
