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
