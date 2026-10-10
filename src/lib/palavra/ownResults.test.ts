// The player's own game on their own boards, before anything is signed.
//
// The bug these exist for: a player whose remote signer didn't answer finished
// the day's game, opened the board, and wasn't on it. The result cache
// couldn't help, because it holds signed events and there wasn't one. The
// game itself was on the device all along.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';
import { POW_MINIMUM } from './pow';
import { KIND_RESULT, resultDTag } from './results';

const ME = 'a'.repeat(64);
const THEM = 'b'.repeat(64);
const NOW = new Date('2026-10-07T12:00:00Z');
const TODAY = '2026-10-07';

/** Every relay read in this file. Empty unless a test says otherwise: the
    publish never happened, so nobody holds anything of this player's. */
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

const storage = new Map<string, string>();

function result(over: { pubkey?: string; tries?: number } = {}): NostrEvent {
    return {
        id: '0'.repeat(POW_MINIMUM / 4) + 'f'.repeat(64 - POW_MINIMUM / 4),
        pubkey: over.pubkey ?? ME,
        created_at: 1_791_000_000,
        kind: KIND_RESULT,
        tags: [['d', resultDTag(TODAY)], ['t', 'morapalavra'], ['date', TODAY]],
        content: JSON.stringify({ tries: over.tries ?? 3, solved: true, ms: 60_000 }),
        sig: '0'.repeat(128),
    };
}

/** Fresh modules, so neither the result cache nor the store carries anything
    over from the last case, and today's game finished in `tries`. */
async function setUp({ tries = 3, sharing = true, finished = true } = {}) {
    vi.resetModules();
    const { usePalavraStore } = await import('@/store/palavra');
    const guesses = Array.from({ length: tries }, (_, i) => `PALAV${i}`);
    usePalavraStore.setState({
        plays: { [TODAY]: { guesses, solved: finished, ms: 42_000 } },
        sharing: sharing ? { [ME]: true } : {},
        publishedResults: {},
    });
    return import('./social');
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    vi.stubGlobal('localStorage', {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => { storage.set(key, value); },
        removeItem: (key: string) => { storage.delete(key); },
    });
    storage.clear();
    relayRead.mockReset().mockResolvedValue([]);
});
afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('your own game on the day board', () => {
    it('is there before anything is signed', async () => {
        const { fetchDailyLeaderboard } = await setUp({ tries: 3 });
        const rows = await fetchDailyLeaderboard(TODAY);
        expect(rows.map(({ pubkey, tries, ms }) => ({ pubkey, tries, ms })))
            .toEqual([{ pubkey: ME, tries: 3, ms: 42_000 }]);
    });

    it('ranks among everyone the relays returned', async () => {
        const { fetchDailyLeaderboard } = await setUp({ tries: 2 });
        relayRead.mockResolvedValueOnce([result({ pubkey: THEM, tries: 4 })]);
        const rows = await fetchDailyLeaderboard(TODAY);
        expect(rows.map((row) => row.pubkey)).toEqual([ME, THEM]);
    });

    // The relay copy is what everyone else is ranked against.
    it('gives way to the published copy, once, when there is one', async () => {
        const { fetchDailyLeaderboard } = await setUp({ tries: 3 });
        relayRead.mockResolvedValueOnce([result({ tries: 2 })]);
        const rows = await fetchDailyLeaderboard(TODAY);
        expect(rows.map(({ pubkey, tries }) => ({ pubkey, tries }))).toEqual([{ pubkey: ME, tries: 2 }]);
    });

    // The signer answers late: the event lands in the cache the moment a
    // relay takes it (publishPalavraResult), and the board's next read shows
    // that signed copy in place of the device's own, even when the read
    // itself still misses it.
    it('is replaced by the signed copy once the signer answers', async () => {
        const { fetchDailyLeaderboard } = await setUp({ tries: 3 });
        expect((await fetchDailyLeaderboard(TODAY)).map((row) => row.tries)).toEqual([3]);

        const { rememberResults } = await import('./resultCache');
        rememberResults([result({ tries: 2 })]);

        const rows = await fetchDailyLeaderboard(TODAY);
        expect(rows.map(({ pubkey, tries }) => ({ pubkey, tries }))).toEqual([{ pubkey: ME, tries: 2 }]);
    });

    it('stays off the board when you don\'t share results', async () => {
        const { fetchDailyLeaderboard } = await setUp({ sharing: false });
        expect(await fetchDailyLeaderboard(TODAY)).toEqual([]);
    });

    it('waits for the game to be over', async () => {
        const { fetchDailyLeaderboard } = await setUp({ tries: 2, finished: false });
        expect(await fetchDailyLeaderboard(TODAY)).toEqual([]);
    });
});

describe('your own game on the month board', () => {
    it('counts today before anything is signed', async () => {
        const { fetchMonthlyPoints } = await setUp({ tries: 3 });
        const { entries } = await fetchMonthlyPoints('2026-10');
        // Third guess: 6, 5, 4.
        expect(entries.map(({ pubkey, points, played }) => ({ pubkey, points, played })))
            .toEqual([{ pubkey: ME, points: 4, played: 1 }]);
    });

    // The spoiler gate: today is left out of the sum until it is finished,
    // and a finished game of your own mustn't put it back early. The caller
    // passes yesterday as the last day in that case.
    it('respects the day the caller stops at', async () => {
        const { fetchMonthlyPoints } = await setUp({ tries: 3 });
        const { entries } = await fetchMonthlyPoints('2026-10', '2026-10-06');
        expect(entries).toEqual([]);
    });
});

// What the boards draw before their relay read returns: no network at all,
// so it is there the moment the board opens.
describe('the boards drawn from this device alone', () => {
    it('show your game at once', async () => {
        const { localDailyLeaderboard, localMonthlyPoints } = await setUp({ tries: 3 });
        expect(localDailyLeaderboard(TODAY).map((row) => row.pubkey)).toEqual([ME]);
        expect(localMonthlyPoints('2026-10').map(({ pubkey, points }) => ({ pubkey, points })))
            .toEqual([{ pubkey: ME, points: 4 }]);
        expect(relayRead).not.toHaveBeenCalled();
    });

    it('carry the signed copy once the signer has answered', async () => {
        const { localDailyLeaderboard } = await setUp({ tries: 3 });
        const { rememberResults } = await import('./resultCache');
        rememberResults([result({ tries: 2 }), result({ pubkey: THEM, tries: 5 })]);
        expect(localDailyLeaderboard(TODAY).map(({ pubkey, tries }) => ({ pubkey, tries })))
            .toEqual([{ pubkey: ME, tries: 2 }, { pubkey: THEM, tries: 5 }]);
    });

    it('hold back today when the caller does', async () => {
        const { localMonthlyPoints } = await setUp({ tries: 3 });
        expect(localMonthlyPoints('2026-10', '2026-10-06')).toEqual([]);
    });
});

describe('your own game in a league', () => {
    it('is added only when you are a member', async () => {
        const { withOwnRow } = await setUp();
        expect(withOwnRow([], TODAY, [ME, THEM]).map((row) => row.pubkey)).toEqual([ME]);
        expect(withOwnRow([], TODAY, [THEM])).toEqual([]);
    });
});
