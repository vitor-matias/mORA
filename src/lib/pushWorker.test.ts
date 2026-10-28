// The reminder Worker (workers/push), run against an in-memory KV.

import { beforeEach, describe, expect, it, vi } from 'vitest';
// @ts-expect-error plain JS Worker module, no types
import worker from '../../workers/push/worker.js';

type Entry = { value: string; metadata?: unknown };
function fakeKV() {
    const data = new Map<string, Entry>();
    return {
        data,
        gets: 0,
        async get(key: string) { this.gets++; return data.get(key)?.value ?? null; },
        async put(key: string, value: string, opts?: { metadata?: unknown }) {
            data.set(key, { value, metadata: opts?.metadata });
        },
        async delete(key: string) { data.delete(key); },
        async list() {
            return { keys: [...data].map(([name, e]) => ({ name, metadata: e.metadata })), list_complete: true };
        },
    };
}

let env: { SUBSCRIPTIONS: ReturnType<typeof fakeKV>; VAPID_PRIVATE_KEY_JWK: string; VAPID_PUBLIC_KEY: string; VAPID_SUBJECT: string };
const pushes = vi.fn();

const post = (body: unknown) => worker.fetch(
    new Request('https://w.test/subscriptions', { method: 'POST', body: JSON.stringify(body) }), env);
const sub = (n: number) => ({ endpoint: `https://fcm.googleapis.com/fcm/send/${n}`, keys: { p256dh: 'p', auth: 'a' } });
async function tick(at: string) {
    vi.setSystemTime(new Date(at));
    let done!: Promise<unknown>;
    await worker.scheduled({}, env, { waitUntil: (p: Promise<unknown>) => { done = p; } });
    await done;
}

beforeEach(async () => {
    vi.useFakeTimers();
    const { privateKey } = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
    env = {
        SUBSCRIPTIONS: fakeKV(),
        VAPID_PRIVATE_KEY_JWK: JSON.stringify(await crypto.subtle.exportKey('jwk', privateKey)),
        VAPID_PUBLIC_KEY: 'pub',
        VAPID_SUBJECT: 'mailto:t@test',
    };
    pushes.mockReset().mockResolvedValue(new Response(null, { status: 201 }));
    vi.stubGlobal('fetch', (url: string) => pushes(url));
});

describe('push worker', () => {
    it('stores only the fields a push needs, and rejects oversized ones', async () => {
        const res = await post({ subscription: { ...sub(1), junk: 'x'.repeat(10_000) }, times: ['07:00'], tz: 'UTC' });
        expect(res.status).toBe(201);
        const [stored] = [...env.SUBSCRIPTIONS.data.values()];
        expect(JSON.parse(stored.value).subscription).toEqual(sub(1));

        const big = { ...sub(2), keys: { p256dh: 'p'.repeat(10_000), auth: 'a' } };
        expect((await post({ subscription: big, times: ['07:00'], tz: 'UTC' })).status).toBe(400);
    });

    it('reads only the records that are due, and sends each once', async () => {
        await post({ subscription: sub(1), times: ['07:00'], tz: 'UTC' });
        await post({ subscription: sub(2), times: ['21:00'], tz: 'UTC' });
        env.SUBSCRIPTIONS.gets = 0;

        await tick('2026-10-28T07:02:00Z');
        expect(pushes).toHaveBeenCalledTimes(1);
        expect(pushes.mock.calls[0][0]).toBe(sub(1).endpoint);
        expect(env.SUBSCRIPTIONS.gets).toBe(1);

        await tick('2026-10-28T07:07:00Z');
        expect(pushes).toHaveBeenCalledTimes(1);
    });

    it('still delivers to later records when one throws', async () => {
        await post({ subscription: sub(1), times: ['07:00'], tz: 'UTC' });
        await post({ subscription: sub(2), times: ['07:00'], tz: 'UTC' });
        const realGet = env.SUBSCRIPTIONS.get.bind(env.SUBSCRIPTIONS);
        let first = true;
        env.SUBSCRIPTIONS.get = async (key: string) => {
            if (first) { first = false; throw new Error('KV down'); }
            return realGet(key);
        };
        vi.spyOn(console, 'error').mockImplementation(() => {});

        await tick('2026-10-28T07:02:00Z');
        expect(pushes).toHaveBeenCalledTimes(1);
        expect(pushes.mock.calls[0][0]).toBe(sub(2).endpoint);
    });

    // Written before the schedule moved into metadata: read in full once and
    // rewritten in the current shape.
    it('delivers to an old record without metadata and upgrades it', async () => {
        await env.SUBSCRIPTIONS.put('old', JSON.stringify({ subscription: sub(1), time: '07:00', tz: 'UTC' }));
        await tick('2026-10-28T07:02:00Z');
        expect(pushes).toHaveBeenCalledTimes(1);
        const upgraded = env.SUBSCRIPTIONS.data.get('old')!;
        expect(upgraded.metadata).toEqual({ tz: 'UTC', times: ['07:00'], lastSent: { '07:00': '2026-10-28' } });
    });

    it('deletes a corrupt record', async () => {
        await env.SUBSCRIPTIONS.put('bad', '{not json');
        await tick('2026-10-28T07:02:00Z');
        expect(env.SUBSCRIPTIONS.data.has('bad')).toBe(false);
    });

    it.each([404, 410])('deletes a subscription the push service answers %i for', async (status) => {
        await post({ subscription: sub(1), times: ['07:00'], tz: 'UTC' });
        pushes.mockResolvedValueOnce(new Response(null, { status }));
        await tick('2026-10-28T07:02:00Z');
        expect(env.SUBSCRIPTIONS.data.size).toBe(0);
    });

    // A failed send leaves no mark, so the next tick inside the window retries.
    it('retries a failed send on the next tick', async () => {
        await post({ subscription: sub(1), times: ['07:00'], tz: 'UTC' });
        pushes.mockResolvedValueOnce(new Response(null, { status: 500 }));
        await tick('2026-10-28T07:02:00Z');
        const [key] = env.SUBSCRIPTIONS.data.keys();
        expect(JSON.parse(env.SUBSCRIPTIONS.data.get(key)!.value).lastSent).toEqual({});

        await tick('2026-10-28T07:07:00Z');
        expect(pushes).toHaveBeenCalledTimes(2);
        expect(JSON.parse(env.SUBSCRIPTIONS.data.get(key)!.value).lastSent).toEqual({ '07:00': '2026-10-28' });
    });

    // Every reminder edit re-registers the whole set; a time already sent
    // today must not fire again.
    it('keeps today’s send marks when the reminders are re-registered', async () => {
        await post({ subscription: sub(1), times: ['07:00'], tz: 'UTC' });
        await tick('2026-10-28T07:02:00Z');
        await post({ subscription: sub(1), times: ['07:00', '21:00'], tz: 'UTC' });
        await tick('2026-10-28T07:07:00Z');
        expect(pushes).toHaveBeenCalledTimes(1);
    });

    it('wraps a 23:55 reminder past midnight', async () => {
        await post({ subscription: sub(1), times: ['23:55'], tz: 'UTC' });
        await tick('2026-10-29T00:05:00Z');
        expect(pushes).toHaveBeenCalledTimes(1);
    });
});
