// The result catch-up: which finished games get a second chance at the relays.
//
// The publish fired when a board is completed is one attempt over the network,
// and the network is a phone on a train. What decides whether a game reaches
// the daily board is therefore this function, not that attempt — so these run
// the real one, with the relay, the signer and the miner stubbed.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formatUTCDate } from '@/lib/format';
import { resultDTag } from './results';
import type { PalavraPlay } from '@/store/palavra';

const ME = 'a'.repeat(64);
const THEM = 'b'.repeat(64);

/** Who the signer would sign as right now. Mutable: an identity can be
    switched while a pass is in flight, which is one of the cases below. */
let signedIn = ME;

const relayPublish = vi.fn();
const signEvent = vi.fn();

vi.mock('@/lib/pool', () => ({
    pool: {
        query: vi.fn().mockResolvedValue([]),
        event: (...args: unknown[]) => relayPublish(...args),
    },
    RELAYS: [],
}));
vi.mock('@/store/auth', () => ({ currentPubkey: () => signedIn }));
vi.mock('@/lib/nostr', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/nostr')>()),
    signNostrEvent: (template: unknown) => signEvent(template),
}));
// Mining runs in a Worker, which this environment has none of — and an unmined
// event is refused by `publishPalavraResult` on purpose, so without this every
// case here would pass for the wrong reason.
vi.mock('./pow', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./pow')>()),
    meetsPow: () => true,
    minePalavraEvent: async (template: unknown) => template,
}));
// The device-level sync toggle, off — its default, and the state in which the
// catch-up used to be unreachable.
vi.mock('@/store/app', () => ({
    useAppStore: { getState: () => ({ shareStreaks: false }) },
}));

const { publishMissingResults } = await import('./nostr');
const { usePalavraStore } = await import('@/store/palavra');

const day = (back: number) => formatUTCDate(new Date(Date.now() - back * 86_400_000));

function finished(): PalavraPlay {
    return { guesses: ['CASA'], solved: true, ms: 1000 };
}

/** The `d` tags of everything that reached the relay, in order. */
const publishedTags = () => relayPublish.mock.calls
    .map(([event]) => (event as { tags: string[][] }).tags.find((t) => t[0] === 'd')?.[1]);

describe('publishMissingResults', () => {
    beforeEach(() => {
        relayPublish.mockReset().mockResolvedValue(undefined);
        signedIn = ME;
        signEvent.mockReset().mockImplementation(async (t: object) =>
            ({ ...t, id: 'signed', pubkey: signedIn, sig: 'sig' }));
        usePalavraStore.setState({ plays: {}, publishedResults: {}, sharing: { [ME]: true } });
    });

    // The bug this exists for: a game finished late in the UTC day whose
    // publish failed is not "today" the next time the app opens, and the
    // catch-up only ever looked at today.
    it('publishes a finished game from an earlier day', async () => {
        usePalavraStore.setState({ plays: { [day(2)]: finished() } });

        await publishMissingResults(ME);

        expect(publishedTags()).toEqual([resultDTag(day(2))]);
        expect(usePalavraStore.getState().publishedResults[`${ME}:${day(2)}`]).toBe(true);
    });

    it('leaves a day that is already published alone', async () => {
        usePalavraStore.setState({
            plays: { [day(1)]: finished() },
            publishedResults: { [`${ME}:${day(1)}`]: true },
        });

        await publishMissingResults(ME);

        expect(relayPublish).not.toHaveBeenCalled();
    });

    // Mining is around a million hashes a day; a week of them in one
    // foreground is seconds of a phone's CPU. The rest ride the next pass.
    it('publishes oldest first and caps one pass', async () => {
        const plays: Record<string, PalavraPlay> = {};
        for (let back = 0; back < 5; back++) plays[day(back)] = finished();
        usePalavraStore.setState({ plays });

        await publishMissingResults(ME);

        expect(publishedTags()).toEqual([day(4), day(3), day(2)].map(resultDTag));
    });

    it('publishes nothing for an identity that has not opted in', async () => {
        usePalavraStore.setState({
            plays: { [day(0)]: finished() },
            sharing: {},
        });

        await publishMissingResults(ME);

        expect(relayPublish).not.toHaveBeenCalled();
    });

    // The pass is single-flight so two foregrounds can't mine the same day
    // twice — but per identity, not globally: an account switch while one is
    // running must not hand the new identity the old one's pass, which
    // publishes nothing of theirs and leaves them with none of their own.
    it('gives a second identity its own pass', async () => {
        usePalavraStore.setState({
            plays: { [day(1)]: finished() },
            sharing: { [ME]: true, [THEM]: true },
        });

        const first = publishMissingResults(ME);
        signedIn = THEM;
        const second = publishMissingResults(THEM);
        await Promise.all([first, second]);

        expect(usePalavraStore.getState().publishedResults[`${THEM}:${day(1)}`]).toBe(true);
    });

    // An unfinished board is a game in progress, not a result.
    it('skips a day that was never finished', async () => {
        usePalavraStore.setState({
            plays: { [day(0)]: { ...finished(), solved: false } },
        });

        await publishMissingResults(ME);

        expect(relayPublish).not.toHaveBeenCalled();
    });
});
