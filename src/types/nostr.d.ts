import type { EventTemplate, Event } from 'nostr-tools';

declare global {
    interface Window {
        // Injected by NIP-07 browser extensions (e.g. Alby, nos2x)
        nostr?: {
            getPublicKey(): Promise<string>;
            signEvent(event: EventTemplate): Promise<Event>;
        };
    }
}

export {};
