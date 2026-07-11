import type { EventTemplate, Event } from 'nostr-tools';

declare global {
    interface Window {
        // Injected by NIP-07 browser extensions (e.g. Alby, nos2x)
        nostr?: {
            getPublicKey(): Promise<string>;
            signEvent(event: EventTemplate): Promise<Event>;
            // Optional NIP-44 capability (newer extensions)
            nip44?: {
                encrypt(pubkey: string, plaintext: string): Promise<string>;
                decrypt(pubkey: string, ciphertext: string): Promise<string>;
            };
        };
    }
}

export {};
