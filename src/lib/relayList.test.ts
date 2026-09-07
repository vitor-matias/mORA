import { describe, expect, it } from 'vitest';
import { normalizeRelayUrl } from './relayList';

// This is the whole gate between somebody else's kind-10002 and a socket this
// app opens, so what it refuses matters as much as what it normalizes.
describe('normalizeRelayUrl', () => {
    it('keeps a wss relay, lowercasing the host and dropping a trailing slash', () => {
        expect(normalizeRelayUrl('wss://Relay.Example/')).toBe('wss://relay.example');
    });

    it('keeps the path of a relay served under one', () => {
        expect(normalizeRelayUrl('wss://relay.example/nostr')).toBe('wss://relay.example/nostr');
    });

    it('drops the query string and fragment, so one relay is never two entries', () => {
        // Both go for the same reason the trailing slash does: this is the
        // form relay URLs are compared and deduplicated in. A fragment is the
        // one a WebSocket URL may not carry at all; a query string is legal
        // and simply is not part of which relay this is.
        expect(normalizeRelayUrl('wss://relay.example/?x=1#y')).toBe('wss://relay.example');
    });

    it('refuses a plain ws:// relay', () => {
        // Not a style preference. The app is served over HTTPS, where opening
        // one of these throws in the browser — and NPool builds its relays
        // outside the try that catches everything else, so that throw takes
        // the entire read down with it, not just this relay.
        expect(normalizeRelayUrl('ws://relay.jb55.com')).toBeNull();
    });

    it('refuses the loopback relay people leave in their own relay list', () => {
        // Real entries, found in the NIP-65 lists of one ordinary account's
        // follows. Dialling one points the reader's browser at the reader's
        // own machine.
        expect(normalizeRelayUrl('ws://127.0.0.1:4869')).toBeNull();
        expect(normalizeRelayUrl('ws://192.168.1.105:4848')).toBeNull();
    });

    it('refuses anything that is not a relay URL at all', () => {
        expect(normalizeRelayUrl('https://relay.example')).toBeNull();
        expect(normalizeRelayUrl('relay.example')).toBeNull();
        expect(normalizeRelayUrl('')).toBeNull();
    });
});
