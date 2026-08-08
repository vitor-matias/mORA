import { NPool, NRelay1 } from '@nostrify/nostrify';

const DEFAULT_RELAYS = [
    'wss://relay.damus.io',
    'wss://nos.lol',
    'wss://relay.primal.net',
    'wss://nostr.mom',
    'wss://relay.ditto.pub',
];

/**
 * Relays this app reads and writes its own events on.
 *
 * `VITE_NOSTR_RELAYS` (comma-separated) overrides the defaults, which exists
 * so the social features can be exercised against a local relay — publishing
 * and reading back is most of what they do, and there is no way to verify that
 * against the public network without putting test events on it.
 */
export const RELAYS = (import.meta.env.VITE_NOSTR_RELAYS as string | undefined)
    ?.split(',')
    .map((url) => url.trim())
    .filter(Boolean)
    ?? DEFAULT_RELAYS;

/**
 * One pool for everything Nostr in the app: sync, profiles, and the relay
 * channel the NIP-46 signer talks over.
 *
 * The pool owns the sockets, so `pool.group(otherRelays)` hands a different
 * relay set to the signer without opening a second connection to the relays
 * both use — and `query` resolves replaceable events across the whole set
 * before returning, so callers never have to pick the newest copy themselves.
 */
export const pool = new NPool({
    open: (url) => new NRelay1(url),
    reqRouter: (filters) => new Map(RELAYS.map((url) => [url, filters])),
    eventRouter: () => RELAYS,
});
