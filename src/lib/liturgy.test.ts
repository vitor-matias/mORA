import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatISODate } from './format';
import { fetchDailyLiturgy } from './liturgy';

const store = new Map<string, string>();
const day = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return formatISODate(d);
};
const answer = (body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));
const mass = (date: string) => ({
    data: { liturgyWithMemories: { date, masses: [{ title: 'Missa', date, text: '<p>Leitura</p>' }], memories: [] } },
});

beforeEach(() => {
    store.clear();
    vi.stubGlobal('localStorage', {
        get length() { return store.size; },
        key: (i: number) => [...store.keys()][i] ?? null,
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => { store.set(k, v); },
        removeItem: (k: string) => { store.delete(k); },
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.unstubAllGlobals());

describe('fetchDailyLiturgy', () => {
    // GraphQL reports failures with HTTP 200; that used to read as "no Mass".
    it('treats a GraphQL error as an outage, not as a day without Mass', async () => {
        vi.stubGlobal('fetch', answer({ errors: [{ message: 'resolver failed' }], data: null }));
        await expect(fetchDailyLiturgy(day(0))).rejects.toThrow('resolver failed');
    });

    it('falls back to the cached day on a GraphQL error', async () => {
        vi.stubGlobal('fetch', answer(mass(day(0))));
        await fetchDailyLiturgy(day(0));
        vi.stubGlobal('fetch', answer({ errors: [{ message: 'x' }] }));
        expect((await fetchDailyLiturgy(day(0)))?.htmlContent).toBe('<p>Leitura</p>');
    });

    it('drops cached days more than a week ahead, but keeps the one just opened', async () => {
        for (const offset of [-1, 0, 7, 20, 30]) {
            vi.stubGlobal('fetch', answer(mass(day(offset))));
            await fetchDailyLiturgy(day(offset));
        }
        const cached = [...store.keys()].map((k) => k.replace('mora_liturgy_', '')).sort();
        expect(cached).toEqual([day(-1), day(0), day(7), day(30)].sort());
    });
});
