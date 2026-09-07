import defaultRelays from '@/relays.json';
import { NPool, NRelay1, type NRelay } from '@nostrify/nostrify';

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
 * A relay that holds nothing and never answers — what an unopenable URL
 * becomes.
 *
 * It does not EOSE, and that is the point of it rather than an omission.
 * NPool starts a one-second countdown on the *first* EOSE any relay sends and
 * aborts the rest of the set when it fires, so a stand-in that answered
 * instantly would cut every real relay down to one second and trade a blank
 * board for a half-read one. Saying nothing is what a dead relay does, and a
 * relay that cannot be opened is precisely a dead one.
 */
const unopenableRelay: NRelay = {
    async *req() { /* No events, and no EOSE — see above. */ },
    async query() { return []; },
    async event() { throw new Error('This relay could not be opened.'); },
    async close() { /* Nothing was ever open. */ },
};

/**
 * A connection to one relay, or a stand-in when it cannot be opened at all.
 *
 * `new NRelay1(url)` builds its WebSocket in the constructor, and a browser
 * *throws* there — synchronously, before any network is touched — for a URL
 * it refuses outright: `ws://` from a page served over HTTPS, or a host port
 * on the blocked list. NPool calls this from `req`, outside the try that
 * catches everything else a relay does, so that throw escapes the whole read
 * rather than the one relay; `pool.query` then swallows it and returns an
 * empty array, which every caller in this app quite reasonably reads as
 * "nobody holds anything".
 *
 * One URL nobody can open would therefore blank a whole board — silently, and
 * for every relay in the set. That is not a hypothetical: relay sets are built
 * from other people's NIP-65 lists (relayList.ts), so the URL that does it is
 * neither ours to fix nor ours to trust. relayList.ts refuses the `ws://` case
 * at the source; this contains the rest of the class, so the read goes on with
 * whatever else was asked.
 */
function openRelay(url: string): NRelay {
    try {
        return new NRelay1(url);
    } catch (error) {
        console.warn(`Could not open ${url}, so it is being skipped for this session.`, error);
        return unopenableRelay;
    }
}

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
    open: openRelay,
    reqRouter: (filters) => new Map(RELAYS.map((url) => [url, filters])),
    eventRouter: () => RELAYS,
});
