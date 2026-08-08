// NIP-65 relay lists — where to look for somebody else's events.
//
// The pool in src/lib/pool.ts routes every request to the same default relays.
// That is exactly right for this app's own writes and for reading them back:
// mORA published them there, so mORA finds them there.
//
// It quietly breaks the moment we read *other people's* events. Someone whose
// client writes to relay.snort.social and nowhere we ask is simply invisible —
// not an error, just an absence, which in a leaderboard or a duel looks like
// "they didn't play today" rather than "we didn't look in the right place".
//
// NIP-65 is the fix: each user publishes a kind-10002 naming the relays they
// write to. Nostrify's NPool is built for this (`reqRouter` exists to analyse
// the `authors` field, and `query` takes a per-call `relays`), but it ships no
// NIP-65 helper, so this is that helper.

import { pool, RELAYS } from '@/lib/pool';
import { RELAY_QUERY_TIMEOUT_MS } from '@/lib/nostr';

const KIND_RELAY_LIST = 10002;

/** Relay lists change rarely; re-asking on every leaderboard open would be
    pure noise on shared infrastructure. */
const CACHE_TTL_MS = 30 * 60 * 1000;

/** Per author, so one person listing twenty relays can't dominate the set. */
const MAX_RELAYS_PER_AUTHOR = 4;

/** Total sockets for one query. A fifty-person league would otherwise try to
    open a connection per member per relay, which is both slow and rude. */
const MAX_RELAYS_PER_QUERY = 12;

const cache = new Map<string, { relays: string[]; fetchedAt: number }>();

/** Comparable form, so wss://Relay.example/ and wss://relay.example are one. */
function normalizeRelayUrl(raw: string): string | null {
    try {
        const url = new URL(raw);
        if (url.protocol !== 'wss:' && url.protocol !== 'ws:') return null;
        return `${url.protocol}//${url.host}${url.pathname.replace(/\/$/, '')}`;
    } catch {
        return null;
    }
}

/**
 * The relays each pubkey says it writes to.
 *
 * A kind-10002 `r` tag is `["r", url]` for both directions, or carries a
 * "read"/"write" marker. Only the write side matters here: that is where their
 * events actually land.
 */
export async function fetchWriteRelays(pubkeys: string[]): Promise<Map<string, string[]>> {
    const found = new Map<string, string[]>();
    const now = Date.now();

    const stale = pubkeys.filter((pubkey) => {
        const hit = cache.get(pubkey);
        if (hit && now - hit.fetchedAt < CACHE_TTL_MS) {
            found.set(pubkey, hit.relays);
            return false;
        }
        return true;
    });

    if (stale.length === 0) return found;

    let events;
    try {
        events = await pool.query(
            [{ kinds: [KIND_RELAY_LIST], authors: stale }],
            { signal: AbortSignal.timeout(RELAY_QUERY_TIMEOUT_MS) },
        );
    } catch (error) {
        console.warn('Could not fetch relay lists.', error);
        return found;
    }

    // kind 10002 is replaceable, so the pool has already reduced this to one
    // per author.
    for (const event of events) {
        const relays: string[] = [];
        for (const tag of event.tags) {
            if (tag[0] !== 'r' || !tag[1]) continue;
            // No marker means both read and write.
            if (tag[2] && tag[2] !== 'write') continue;
            const url = normalizeRelayUrl(tag[1]);
            if (url && !relays.includes(url)) relays.push(url);
            if (relays.length >= MAX_RELAYS_PER_AUTHOR) break;
        }
        cache.set(event.pubkey, { relays, fetchedAt: now });
        found.set(event.pubkey, relays);
    }

    // Cache the misses too, as empty — otherwise every call re-asks the relays
    // about the same people who have never published a list.
    for (const pubkey of stale) {
        if (!found.has(pubkey)) {
            cache.set(pubkey, { relays: [], fetchedAt: now });
            found.set(pubkey, []);
        }
    }

    return found;
}

/**
 * The relay set to query when looking for these authors' events: the app's own
 * relays plus wherever those authors actually write.
 *
 * The defaults stay in the set rather than being replaced — most mORA players
 * will have published there, and dropping them would trade one blind spot for
 * another.
 */
export async function relaysForAuthors(pubkeys: string[]): Promise<string[]> {
    if (pubkeys.length === 0) return [...RELAYS];

    const byAuthor = await fetchWriteRelays(pubkeys);
    const set = new Set<string>(RELAYS);

    // Round-robin over authors rather than draining one at a time, so that
    // hitting the cap still leaves everyone represented instead of spending
    // every slot on whoever happened to be first.
    const lists = [...byAuthor.values()].filter((list) => list.length > 0);
    for (let depth = 0; depth < MAX_RELAYS_PER_AUTHOR; depth++) {
        for (const list of lists) {
            if (set.size >= MAX_RELAYS_PER_QUERY) return [...set];
            if (list[depth]) set.add(list[depth]);
        }
    }

    return [...set];
}
