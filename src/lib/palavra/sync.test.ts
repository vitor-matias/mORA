// The cross-device play log: what reaches this device from the relays, and
// what this device is allowed to write back over them.
//
// Run through the real sync, with the relays, the signer and the stores
// stubbed. The failure these guard is a game finished on one device that
// takes hours to show on another — not because the network was slow, but
// because a read that no relay had answered was taken as "the relays are
// empty", and this device's log was published over the other's.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formatUTCDate } from '@/lib/format';
import { useAppStore } from '@/store/app';
import type { PalavraPlays } from '@/store/palavra';

const ME = 'a'.repeat(64);
const D_PALAVRA_STATE = 'mora-palavra-state';
const TEST_RELAYS = ['wss://one.test', 'wss://two.test', 'wss://three.test'];

/** What each relay holds for this identity, by URL. A relay absent here is
    silent: it never sends an EOSE, which is what a dead relay looks like. */
const held = new Map<string, object[]>();
const relayPublish = vi.fn();
const signEvent = vi.fn();

vi.mock('@/lib/pool', () => ({
    pool: {
        event: (...args: unknown[]) => relayPublish(...args),
        relay: (url: string) => ({
            async *req() {
                const events = held.get(url);
                if (!events) return;
                for (const event of events) yield ['EVENT', 'sub', event];
                yield ['EOSE', 'sub'];
            },
        }),
    },
    RELAYS: TEST_RELAYS,
}));
vi.mock('@/store/auth', () => ({
    currentPubkey: () => ME,
    useAuthStore: {
        getState: () => ({ login: { type: 'nsec', pubkey: ME }, profile: null }),
    },
}));
const SEALED = 'nip44:';
vi.mock('@nostrify/react/login', () => ({
    NUser: {
        fromNsecLogin: () => ({
            signer: {
                signEvent: (t: unknown) => signEvent(t),
                nip44: {
                    encrypt: async (_pubkey: string, plaintext: string) => SEALED + plaintext,
                    decrypt: async (_pubkey: string, ciphertext: string) => ciphertext.slice(SEALED.length),
                },
            },
        }),
    },
}));

const { syncPalavraWithNostr } = await import('./nostr');
const { usePalavraStore } = await import('@/store/palavra');

const today = formatUTCDate(new Date());
const yesterday = formatUTCDate(new Date(Date.now() - 86_400_000));

/** A snapshot event as a relay would hold it. */
function snapshot(plays: PalavraPlays, created_at: number, id = `s${created_at}`) {
    return {
        id, pubkey: ME, kind: 30078, created_at,
        tags: [['d', D_PALAVRA_STATE]],
        content: SEALED + JSON.stringify({ plays, sharesResults: true }), sig: 's',
    };
}

/** The play log this device published, unsealed. */
function publishedPlays(): PalavraPlays {
    const { content } = signEvent.mock.calls.at(-1)![0] as { content: string };
    return (JSON.parse(content.slice(SEALED.length)) as { plays: PalavraPlays }).plays;
}

const won = { guesses: ['GRACA'], solved: true, ms: 5000 };
const wonYesterday = { guesses: ['SANTO', 'CRUZE'], solved: true, ms: 9000 };

beforeEach(() => {
    held.clear();
    relayPublish.mockReset().mockResolvedValue(undefined);
    signEvent.mockReset().mockImplementation(async (t: { content: string }) =>
        ({ ...t, id: 'signed', pubkey: ME, sig: 'sig' }));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    useAppStore.setState({ shareStreaks: true });
    usePalavraStore.setState({ plays: {}, sharing: {} });
});

describe('syncPalavraWithNostr', () => {
    it('brings a game finished on another device onto this one', async () => {
        for (const url of TEST_RELAYS) held.set(url, [snapshot({ [today]: won }, 1000)]);

        await syncPalavraWithNostr();

        expect(usePalavraStore.getState().plays[today]).toEqual(won);
        // The relays already hold everything this device has, so nothing goes back.
        expect(relayPublish).not.toHaveBeenCalled();
    });

    it('publishes the union when this device knows a day the relays are missing', async () => {
        usePalavraStore.setState({ plays: { [yesterday]: wonYesterday } });
        for (const url of TEST_RELAYS) held.set(url, [snapshot({ [today]: won }, 1000)]);

        await syncPalavraWithNostr();

        expect(Object.keys(publishedPlays()).sort()).toEqual([yesterday, today].sort());
    });

    // The bug. Every relay went quiet — a phone still reconnecting after
    // waking, a deadline that landed first — and the empty read was taken as
    // "nothing published yet". This device then seeded the relays with its own
    // log, which had no game for today, over the snapshot the other device
    // had written when its game ended.
    it('does not write over the relays when none of them answered', async () => {
        usePalavraStore.setState({ plays: { [yesterday]: wonYesterday } });

        await syncPalavraWithNostr();

        expect(relayPublish).not.toHaveBeenCalled();
        expect(signEvent).not.toHaveBeenCalled();
        expect(usePalavraStore.getState().plays).toEqual({ [yesterday]: wonYesterday });
    });

    // One relay out of three is not the network's answer either. What it sent
    // is still merged in — a union loses nothing — but nothing is written
    // back on the strength of it.
    it('merges what one relay sent but does not publish on a minority read', async () => {
        usePalavraStore.setState({ plays: { [yesterday]: wonYesterday } });
        held.set(TEST_RELAYS[0], [snapshot({ [today]: won }, 1000)]);

        await syncPalavraWithNostr();

        expect(usePalavraStore.getState().plays[today]).toEqual(won);
        expect(relayPublish).not.toHaveBeenCalled();
    });

    // Two of three finished: a majority, so an empty answer means empty and a
    // first sync seeds the relays as before.
    it('still seeds the relays when a majority answered with nothing', async () => {
        usePalavraStore.setState({ plays: { [yesterday]: wonYesterday } });
        held.set(TEST_RELAYS[0], []);
        held.set(TEST_RELAYS[1], []);

        await syncPalavraWithNostr();

        expect(publishedPlays()).toEqual({ [yesterday]: wonYesterday });
    });

    // Relays lag one another. pool.query used to end the read a second after
    // the first EOSE, so the stale relay could speak for all of them; now every
    // version is collected and the newest wins.
    it('takes the newest snapshot when the relays disagree', async () => {
        held.set(TEST_RELAYS[0], [snapshot({ [yesterday]: wonYesterday }, 1000)]);
        held.set(TEST_RELAYS[1], [snapshot({ [yesterday]: wonYesterday, [today]: won }, 2000)]);
        held.set(TEST_RELAYS[2], [snapshot({ [yesterday]: wonYesterday }, 1000)]);

        await syncPalavraWithNostr();

        expect(usePalavraStore.getState().plays[today]).toEqual(won);
        expect(relayPublish).not.toHaveBeenCalled();
    });

    // A snapshot that came back but cannot be read is unknown, not empty:
    // writing over it would replace a log this device could not see.
    it('does not write over a snapshot it could not read', async () => {
        usePalavraStore.setState({ plays: { [yesterday]: wonYesterday } });
        for (const url of TEST_RELAYS) {
            held.set(url, [{ ...snapshot({}, 1000), content: SEALED + 'not json' }]);
        }

        await syncPalavraWithNostr();

        expect(relayPublish).not.toHaveBeenCalled();
    });

    it('does nothing at all while cross-device sync is off', async () => {
        useAppStore.setState({ shareStreaks: false });
        for (const url of TEST_RELAYS) held.set(url, [snapshot({ [today]: won }, 1000)]);

        await syncPalavraWithNostr();

        expect(usePalavraStore.getState().plays[today]).toBeUndefined();
        expect(relayPublish).not.toHaveBeenCalled();
    });
});
