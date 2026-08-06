import { NPool, NRelay1 } from '@nostrify/nostrify';

/** Relays this app reads and writes its own events on. */
export const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net'];

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
