import { afterEach, describe, expect, it } from 'vitest';
// @ts-expect-error no types for ws in the app project
import { WebSocketServer } from 'ws';
// @ts-expect-error plain JS server module, no types
import { planEntry, publishedHashesOn } from '../../server/agenda/publish.js';

const entry = { dTag: 'mora-agenda:2026-11-03', content: '{"color":"green"}', tags: [], date: '2026-11-03' };
// sha256 of entry.content, the hash a relay holding this exact day reports.
const HASH = 'b1c0d2a81c6839b36839e8d9b273cb17279370ab430e5e3fc8218e2bcaa6373b';
const relay = (url: string, held: Record<string, string>, complete = true) =>
    ({ url, hashes: new Map(Object.entries(held)), complete });

describe('planEntry', () => {
    it('sends only to the relays that lack this exact content', () => {
        const plan = planEntry(entry, [
            relay('has', { [entry.dTag]: HASH }),
            relay('empty', {}),
            relay('outdated', { [entry.dTag]: 'older' }),
        ]);
        expect(plan.targets).toEqual(['empty', 'outdated']);
        expect(plan.held).toBe(true);
    });

    it('leaves out a relay that did not finish answering', () => {
        const plan = planEntry(entry, [relay('empty', {}), relay('down', {}, false)]);
        expect(plan.targets).toEqual(['empty']);
        expect(plan.held).toBe(false);
    });

    it('sends everywhere when no relay finished answering', () => {
        const plan = planEntry(entry, [relay('a', {}, false), relay('b', {}, false)]);
        expect(plan.targets).toEqual(['a', 'b']);
    });
});

type FakeSocket = { on(event: 'message', listener: (raw: { toString(): string }) => void): void; send(data: string): void };

describe('publishedHashesOn', () => {
    let server: { close(): void; on(event: string, listener: (socket: FakeSocket) => void): void; address(): { port: number } };
    afterEach(() => server.close());

    // Answers each REQ with a hash for every d tag asked about, unless `refuseAfter` REQs have gone by.
    function fakeRelay(refuseAfter = Infinity) {
        const reqs: string[][] = [];
        server = new WebSocketServer({ port: 0 });
        server.on('connection', (socket) => socket.on('message', (raw: { toString(): string }) => {
            const [, id, filter] = JSON.parse(raw.toString());
            reqs.push(filter['#d']);
            if (reqs.length > refuseAfter) {
                socket.send(JSON.stringify(['CLOSED', id, 'rate-limited:']));
                return;
            }
            for (const d of filter['#d']) {
                socket.send(JSON.stringify(['EVENT', id, { tags: [['d', d], ['hash', `h-${d}`]], content: '' }]));
            }
            socket.send(JSON.stringify(['EOSE', id]));
        }));
        const { port } = server.address();
        return { url: `ws://127.0.0.1:${port}`, reqs };
    }

    const dTags = Array.from({ length: 120 }, (_, i) => `d${i}`);

    it('reads every d tag, more than one request is allowed to return', async () => {
        const { url, reqs } = fakeRelay();
        const { hashes, complete } = await publishedHashesOn(url, 'pubkey', dTags);
        expect(complete).toBe(true);
        expect(hashes.size).toBe(120);
        expect(hashes.get('d119')).toBe('h-d119');
        expect(reqs.length).toBeGreaterThan(1);
    });

    it('is not complete when the relay refuses partway', async () => {
        const { url } = fakeRelay(1);
        const { hashes, complete } = await publishedHashesOn(url, 'pubkey', dTags);
        expect(complete).toBe(false);
        expect(hashes.size).toBeGreaterThan(0);
    });
});
