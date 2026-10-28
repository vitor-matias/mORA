// Joining a league rewrites the whole membership list, so the read before it
// decides whether the other memberships survive a slow network.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';
import { KIND_APP_STATE } from '@/lib/nostr';
import { joinLeague } from './leagues';

const ME = 'a'.repeat(64);
const coord = (n: number) => `30000:${'b'.repeat(64)}:mora-palavra-league:x${n}`;

const relayPublish = vi.fn();
const signEvent = vi.fn(async (t: { tags: string[][] }) => t);
let answer: { events: NostrEvent[]; answered: number; asked: number; refused: number };

vi.mock('@/lib/pool', () => ({
    pool: { event: (...args: unknown[]) => relayPublish(...args) },
    RELAYS: [],
}));
vi.mock('@/store/auth', () => ({ currentPubkey: () => ME }));
vi.mock('@/lib/nostr', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/nostr')>()),
    queryComplete: async () => answer,
    signNostrEvent: (t: { tags: string[][] }) => signEvent(t),
}));

const membershipEvent = (coords: string[]): NostrEvent => ({
    id: '1'.repeat(64), sig: '', pubkey: ME, kind: KIND_APP_STATE, created_at: 1, content: '',
    tags: [['d', 'mora-palavra-leagues'], ...coords.map((c) => ['a', c])],
});
const published = () => (signEvent.mock.calls.at(-1)![0].tags as string[][])
    .filter((t) => t[0] === 'a').map((t) => t[1]);

describe('joinLeague', () => {
    beforeEach(() => { relayPublish.mockReset(); signEvent.mockClear(); });

    it('keeps the existing memberships', async () => {
        answer = { events: [membershipEvent([coord(1), coord(2)])], answered: 3, asked: 4, refused: 0 };
        await joinLeague(coord(3));
        expect(published()).toEqual([coord(1), coord(2), coord(3)]);
    });

    // The bug: a timeout looked like "no leagues" and the list was rewritten
    // with only the new one.
    it('refuses to write when most relays did not answer', async () => {
        answer = { events: [], answered: 1, asked: 4, refused: 0 };
        await expect(joinLeague(coord(3))).rejects.toThrow();
        expect(relayPublish).not.toHaveBeenCalled();
    });
});
