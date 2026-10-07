// The month's result cache, and the bug it exists for: a player who had just
// published their result reading a board that didn't have them on it, because
// the relay read after the publish didn't happen to reach a relay holding it.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';
import { formatUTCDate } from '@/lib/format';
import { POW_MINIMUM } from './pow';
import { KIND_RESULT, resultDTag } from './results';

const ME = 'a'.repeat(64);
const THEM = 'b'.repeat(64);

/** What every relay read returns in this file, unless a test says otherwise.
    Empty by default — the read that missed. */
const relayRead = vi.fn<() => Promise<NostrEvent[]>>();

vi.mock('@/lib/pool', () => ({
    pool: { query: () => relayRead() },
    RELAYS: [],
}));
vi.mock('@/store/auth', () => ({
    currentPubkey: () => ME,
    useAuthStore: { getState: () => ({ profile: null }) },
}));
vi.mock('@/lib/nostr', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/nostr')>()),
    fetchProfileCards: async () => new Map(),
}));

/** localStorage as a plain map, so a "reload" can be a fresh module import
    reading what the last one wrote. */
const storage = new Map<string, string>();
const memoryStorage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, value); },
    removeItem: (key: string) => { storage.delete(key); },
};

/** A fresh copy of the module, as after a reload: nothing in memory, only
    whatever storage holds. */
const reload = () => import('./resultCache');

const NOW = new Date('2026-10-07T12:00:00Z');
const MINED_ID = '0'.repeat(POW_MINIMUM / 4) + 'f'.repeat(64 - POW_MINIMUM / 4);
const BARE_ID = 'f'.repeat(64);

function result(over: {
    pubkey?: string; date?: string; dTag?: string; id?: string; created_at?: number; kind?: number; tries?: number;
} = {}): NostrEvent {
    const date = over.date ?? '2026-10-07';
    return {
        id: over.id ?? MINED_ID,
        pubkey: over.pubkey ?? ME,
        created_at: over.created_at ?? 1_791_000_000,
        kind: over.kind ?? KIND_RESULT,
        tags: [['d', over.dTag ?? resultDTag(date)], ['t', 'morapalavra'], ['date', date]],
        content: JSON.stringify({ tries: over.tries ?? 3, solved: true, ms: 60_000 }),
        sig: '0'.repeat(128),
    };
}

beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    vi.stubGlobal('localStorage', memoryStorage);
    storage.clear();
    relayRead.mockReset().mockResolvedValue([]);
});

describe('the month cache', () => {
    it('hands back a remembered result for its day', async () => {
        const { rememberResults, rememberedResults } = await reload();
        rememberResults([result()], NOW);
        expect(rememberedResults(['2026-10-07'], undefined, NOW)).toEqual([result()]);
        expect(rememberedResults(['2026-10-06'], undefined, NOW)).toEqual([]);
    });

    it('keeps nothing a board would drop anyway', async () => {
        const { rememberResults, rememberedResults } = await reload();
        rememberResults([
            result({ id: BARE_ID }),
            result({ dTag: resultDTag('2026-10-06') }),
            result({ kind: 1 }),
        ], NOW);
        expect(rememberedResults(['2026-10-06', '2026-10-07'], undefined, NOW)).toEqual([]);
    });

    it('keeps only the current month', async () => {
        const { rememberResults, rememberedResults } = await reload();
        rememberResults([result({ date: '2026-09-30' })], NOW);
        expect(rememberedResults(['2026-09-30'], undefined, NOW)).toEqual([]);
    });

    it('keeps the newest version of a result, whichever arrives first', async () => {
        const { rememberResults, rememberedResults } = await reload();
        const older = result({ created_at: 100, tries: 6 });
        const newer = result({ created_at: 200, tries: 2 });
        rememberResults([newer], NOW);
        rememberResults([older], NOW);
        expect(rememberedResults(['2026-10-07'], undefined, NOW)).toEqual([newer]);
    });

    it('narrows to the authors asked for', async () => {
        const { rememberResults, rememberedResults } = await reload();
        rememberResults([result(), result({ pubkey: THEM })], NOW);
        expect(rememberedResults(['2026-10-07'], [THEM], NOW).map((e) => e.pubkey)).toEqual([THEM]);
    });

    it('survives a reload', async () => {
        (await reload()).rememberResults([result()], NOW);
        vi.resetModules();
        const { rememberedResults } = await reload();
        expect(rememberedResults(['2026-10-07'], undefined, NOW)).toEqual([result()]);
    });

    it('starts the new month empty', async () => {
        (await reload()).rememberResults([result({ date: '2026-10-31' })], new Date('2026-10-31T23:00:00Z'));
        vi.resetModules();
        const { rememberedResults } = await reload();
        const november = new Date('2026-11-01T01:00:00Z');
        expect(rememberedResults(['2026-10-31'], undefined, november)).toEqual([]);
    });

    it('ignores storage it cannot read', async () => {
        storage.set('mora-palavra-results', '{not json');
        const { rememberResults, rememberedResults } = await reload();
        expect(rememberedResults(['2026-10-07'], undefined, NOW)).toEqual([]);
        rememberResults([result()], NOW);
        expect(rememberedResults(['2026-10-07'], undefined, NOW)).toEqual([result()]);
    });

    it('still works in memory when storage is blocked', async () => {
        const blocked = () => { throw new Error('SecurityError'); };
        vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked, removeItem: blocked });
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { rememberResults, rememberedResults } = await reload();
        rememberResults([result()], NOW);
        expect(rememberedResults(['2026-10-07'], undefined, NOW)).toEqual([result()]);
    });
});

describe('the boards', () => {
    const today = formatUTCDate(new Date());

    it('show your own published result when the relay read misses it', async () => {
        (await reload()).rememberResults([result({ date: today })]);
        const { fetchDailyLeaderboard } = await import('./social');

        const rows = await fetchDailyLeaderboard(today);
        expect(rows.map((row) => row.pubkey)).toEqual([ME]);
    });

    it('keep a player one read saw after the next read misses them', async () => {
        const { fetchDailyLeaderboard } = await import('./social');
        relayRead.mockResolvedValueOnce([result({ date: today, pubkey: THEM })]);
        expect((await fetchDailyLeaderboard(today)).map((row) => row.pubkey)).toEqual([THEM]);

        // The next read reaches only relays that don't hold them.
        expect((await fetchDailyLeaderboard(today)).map((row) => row.pubkey)).toEqual([THEM]);
    });

    it('rank the newer of a cached and a fresh version, not both', async () => {
        (await reload()).rememberResults([result({ date: today, created_at: 100, tries: 6 })]);
        const { fetchDailyLeaderboard } = await import('./social');
        relayRead.mockResolvedValueOnce([result({ date: today, created_at: 200, tries: 2 })]);

        const rows = await fetchDailyLeaderboard(today);
        expect(rows.map((row) => row.tries)).toEqual([2]);
    });
});
