// The monthly board's "partial" flag: when the totals are only a floor.
//
// It used to be up on every load. relay.ditto.pub keeps kind 30078 for
// NIP-42-authenticated authors only, so it refuses the board's author-less
// read every time, and a relay that never answers made every month look
// short. These run the real read with only the relays stubbed.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { closing, RELAYS } = vi.hoisted(() => ({
    /** Relays that decline the read, keyed to the CLOSED reason they give.
        The rest send EOSE straight away, holding nothing. */
    closing: new Map<string, string>(),
    RELAYS: ['wss://one.test', 'wss://two.test', 'wss://ditto.test'],
}));

vi.mock('@/lib/pool', () => ({
    pool: {
        query: vi.fn().mockResolvedValue([]),
        relay: (url: string) => ({
            async *req() {
                const reason = closing.get(url);
                if (reason !== undefined) {
                    yield ['CLOSED', 'sub', reason];
                    return;
                }
                yield ['EOSE', 'sub'];
            },
        }),
    },
    RELAYS,
}));
vi.mock('@/store/auth', () => ({ currentPubkey: () => null }));

const { fetchMonthlyPoints } = await import('./social');

const DITTO = 'auth-required: auth-protected kinds require an authors or #p filter';

// A finished month, so every day of it is read whatever today is.
const MONTH = '2026-09';

describe('the monthly read', () => {
    beforeEach(() => {
        closing.clear();
        vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    it('is whole when every relay answers', async () => {
        expect((await fetchMonthlyPoints(MONTH)).partial).toBe(false);
    });

    it('is still whole when the only relay missing refused the read by policy', async () => {
        closing.set('wss://ditto.test', DITTO);

        expect((await fetchMonthlyPoints(MONTH)).partial).toBe(false);
    });

    it('is partial when a relay fails rather than refuses', async () => {
        closing.set('wss://ditto.test', DITTO);
        closing.set('wss://two.test', 'error: shutting down');

        expect((await fetchMonthlyPoints(MONTH)).partial).toBe(true);
    });

    // Leaving refusals out must not turn "nobody would serve this" into an
    // empty month presented as a complete one.
    it('is partial when every relay refused', async () => {
        for (const url of RELAYS) closing.set(url, DITTO);

        expect((await fetchMonthlyPoints(MONTH)).partial).toBe(true);
    });
});
