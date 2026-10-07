import { afterEach, describe, expect, it } from 'vitest';
import { pool } from './pool';

const RealWebSocket = globalThis.WebSocket;

/** What a browser does with a URL it refuses outright — `new WebSocket`
    throws where it stands, rather than failing on a later event. */
function refuseSockets() {
    // @ts-expect-error a stand-in for the browser's own constructor
    globalThis.WebSocket = class {
        constructor() {
            throw new DOMException('The operation is insecure.', 'SecurityError');
        }
    };
}

afterEach(() => {
    globalThis.WebSocket = RealWebSocket;
});

// One URL the browser will not dial used to take a whole read with it: NPool
// builds each relay outside the try that catches everything else a relay does,
// so the throw escaped `req`, and `pool.query` returned an empty array — which
// reads exactly like a relay set that holds nothing.
describe('a relay that cannot be opened', () => {
    it('does not throw out of the pool', () => {
        refuseSockets();
        expect(() => pool.relay('wss://unopenable.example')).not.toThrow();
    });

    it('stands in as a relay holding nothing', async () => {
        refuseSockets();
        const relay = pool.relay('wss://unopenable.two.example');

        const seen = [];
        for await (const msg of relay.req([{ kinds: [1] }], { signal: AbortSignal.timeout(1000) })) {
            seen.push(msg);
        }

        // Nothing, and no EOSE among it: NPool aborts every other relay one
        // second after the first EOSE it sees, so a stand-in that answered
        // would cut the real relays short instead of leaving them to answer.
        expect(seen).toEqual([]);
    });

    it('answers a direct query with no events rather than failing', async () => {
        refuseSockets();
        await expect(pool.relay('wss://unopenable.three.example').query([{ kinds: [1] }]))
            .resolves.toEqual([]);
    });
});

/** A socket that opens when told to, keeps what it was sent, and delivers
    whatever the test has the relay say. */
class ScriptedSocket extends EventTarget {
    static readonly OPEN = 1;
    static latest: ScriptedSocket | undefined;
    readonly OPEN = 1;
    readyState = 0;
    readonly sent: unknown[][] = [];

    constructor() {
        super();
        ScriptedSocket.latest = this;
    }

    send(data: string) { this.sent.push(JSON.parse(data)); }
    close() { this.readyState = 3; }

    open() {
        this.readyState = 1;
        this.dispatchEvent(new Event('open'));
    }

    say(msg: unknown[]) {
        this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(msg) }));
    }
}

// NRelay1 on its own ends the subscription on a CLOSED and drops the reason,
// so a relay that refuses the app's reads by policy looked like one that had
// gone down. The monthly board then warned on every load about relay.ditto.pub.
describe('a relay that closes a subscription', () => {
    it('passes the CLOSED on, reason and all', async () => {
        // @ts-expect-error a stand-in for the browser's own constructor
        globalThis.WebSocket = ScriptedSocket;
        const relay = pool.relay('wss://refusing.example');
        const socket = ScriptedSocket.latest!;

        const sub = relay.req(
            [{ kinds: [30078], '#t': ['morapalavra'] }],
            { signal: AbortSignal.timeout(1000) },
        )[Symbol.asyncIterator]();
        const first = sub.next();
        socket.open();
        const [, id] = socket.sent.find(([type]) => type === 'REQ')!;
        const reason = 'auth-required: auth-protected kinds require an authors or #p filter';
        socket.say(['CLOSED', id, reason]);

        expect((await first).value).toEqual(['CLOSED', id, reason]);
        expect((await sub.next()).done).toBe(true);
    });
});
