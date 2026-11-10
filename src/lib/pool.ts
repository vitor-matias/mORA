import defaultRelays from '@/relays.json';
import {
    NPool, NRelay1,
    type NostrEvent, type NostrFilter, type NostrRelayCLOSED, type NostrRelayEOSE, type NostrRelayEVENT, type NostrRelayMsg,
    type NRelay,
} from '@nostrify/nostrify';

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
 * NRelay1, except that `req` passes a CLOSED on instead of swallowing it.
 *
 * NRelay1's `req` is typed to yield CLOSED, but it doesn't. When a CLOSED
 * arrives it just ends, and the relay's reason is lost with it. So a
 * subscription the relay refused looks exactly like one that was cut off, and
 * queryComplete needs to tell the two apart. relay.ditto.pub's
 * `auth-required:` will come back on every load, while an `error:` may not.
 *
 * `receive` is the hook NRelay1 leaves open to subclasses, but it cannot tell
 * which `req` call a CLOSED belongs to: the subscription id is made inside
 * `req`. The REQ it went out with can tell. NRelay1 builds that REQ from the
 * caller's own filter objects and lists it in `subscriptions` until the CLOSED
 * is handled. So the message is filed under the first of those filters, where
 * the `req` that sent them looks once NRelay1's own `req` has ended.
 *
 * If NRelay1 ever stops passing the caller's filters through, nothing is found
 * and a CLOSED reads as it did before this class existed: as a relay that did
 * not answer. That puts a warning up wrongly rather than taking one down.
 */
class ReasonedRelay extends NRelay1 {
    private readonly closedWith = new WeakMap<NostrFilter, NostrRelayCLOSED>();

    protected override receive(msg: NostrRelayMsg): void {
        if (msg[0] === 'CLOSED') {
            const first = this.subscriptions.find(([, id]) => id === msg[1])?.[2];
            if (first) this.closedWith.set(first, msg);
        }
        super.receive(msg);
    }

    override async *req(
        filters: NostrFilter[],
        opts?: { signal?: AbortSignal },
    ): AsyncGenerator<NostrRelayEVENT | NostrRelayEOSE | NostrRelayCLOSED> {
        const [first] = filters;
        // Cleared first, so an earlier CLOSED for the same filters is never
        // mistaken for this subscription's.
        if (first) this.closedWith.delete(first);
        yield* super.req(filters, opts);
        const closed = first && this.closedWith.get(first);
        if (closed) {
            this.closedWith.delete(first);
            yield closed;
        }
    }

    /**
     * A connection the network dropped can still read as OPEN (a phone coming
     * back from the background, say), and NRelay1 keeps writing into it. Every
     * publish then times out until the app restarts. No answer at all drops the
     * connection, so NRelay1 treats it like any other lost one: it redials and
     * replays open subscriptions, or with none open, dials on the next send.
     */
    override async event(event: NostrEvent, opts?: { signal?: AbortSignal }): Promise<void> {
        try {
            await super.event(event, opts);
        } catch (error) {
            if (opts?.signal?.aborted) await this.dropConnection();
            throw error;
        }
    }

    /**
     * Waits for the close to land, because a send before then is queued on the
     * socket being dropped.
     *
     * shortcut: a dead network can report the close after the 1s cap and cost
     * one more failed attempt, which the next retry recovers from.
     */
    private dropConnection(): Promise<unknown> {
        const connection = this.socket.underlyingWebsocket;
        connection?.close();
        return new Promise((resolve) => {
            connection?.addEventListener('close', resolve, { once: true });
            setTimeout(resolve, 1000);
        });
    }
}

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
        return new ReasonedRelay(url);
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

/** An id no event has, so the relay answers with a bare EOSE. */
const NO_SUCH_EVENT = '0'.repeat(64);

async function roundTrip(relay: NRelay, signal: AbortSignal): Promise<number | null> {
    const startedAt = performance.now();
    try {
        for await (const _answer of relay.req([{ ids: [NO_SUCH_EVENT], limit: 1 }], { signal })) {
            return Math.round(performance.now() - startedAt);
        }
    } catch {
        // Aborted: no answer in time.
    }
    return null;
}

/**
 * Round trip to a relay over the app's own socket, in ms, or null if it did
 * not answer. A refusal (CLOSED) counts as an answer: the relay is reachable.
 *
 * Measured twice, keeping the second: the first REQ may have waited for the
 * socket to open, which is connection time rather than ping.
 */
export async function pingRelay(url: string, timeoutMs = 5000): Promise<number | null> {
    const relay = pool.relay(url);
    const signal = AbortSignal.timeout(timeoutMs);
    return await roundTrip(relay, signal) === null ? null : roundTrip(relay, signal);
}
