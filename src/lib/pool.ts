import defaultRelays from '@/relays.json';
import { NPool, NRelay1 } from '@nostrify/nostrify';

// The one list. server/palavra/publish.js reads the same file, because a
// puzzle published only where the app doesn't look is a day with no puzzle for
// everyone — and two hand-maintained copies drift silently, with nothing
// failing until a morning when nobody has a game.
const DEFAULT_RELAYS = defaultRelays;

/**
 * Relays this app reads and writes its own events on.
 *
 * `VITE_NOSTR_RELAYS` (comma-separated) overrides the defaults, which exists
 * so the social features can be exercised against a local relay — publishing
 * and reading back is most of what they do, and there is no way to verify that
 * against the public network without putting test events on it.
 */
const configured = (import.meta.env.VITE_NOSTR_RELAYS as string | undefined)
    ?.split(',')
    .map((url) => url.trim())
    .filter(Boolean) ?? [];

// `??` wouldn't do here: `VITE_NOSTR_RELAYS=` (set but blank, which is what a
// declared-and-empty CI variable produces) parses to an empty array, not
// undefined, and an empty relay list silently turns off every Nostr feature
// in the app rather than falling back.
export const RELAYS = configured.length > 0 ? configured : DEFAULT_RELAYS;

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
