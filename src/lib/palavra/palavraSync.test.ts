// The encrypted play log is one record per identity, shared by its devices:
// publishing has to merge what the other devices added, never replace it.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePalavraStore, type PalavraPlay } from '@/store/palavra';
import { useAppStore } from '@/store/app';
import { syncPalavraWithNostr } from './nostr';

const ME = 'a'.repeat(64);
const published = vi.fn();
let remotePlays: Record<string, PalavraPlay> = {};
let release: () => void = () => {};
let hold = false;

vi.mock('@/store/auth', () => ({ currentPubkey: () => ME }));
vi.mock('@/lib/nostr', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/nostr')>()),
    fetchSnapshot: async () => ({ snapshot: { payload: { plays: remotePlays } }, complete: true }),
    publishSnapshot: async (_d: string, payload: { plays: Record<string, PalavraPlay> }) => {
        published(payload.plays);
        if (hold) await new Promise<void>((r) => { release = r; });
    },
}));

const game = (guesses: string[]): PalavraPlay => ({ guesses, solved: true, ms: 1000 });

describe('syncPalavraWithNostr', () => {
    beforeEach(() => {
        published.mockReset();
        hold = false;
        useAppStore.setState({ shareStreaks: true });
    });

    it('publishes this device’s game together with the other device’s', async () => {
        remotePlays = { '2026-10-27': game(['LAPIS']) };
        usePalavraStore.setState({ plays: { '2026-10-28': game(['PEDRA']) } });

        await syncPalavraWithNostr();

        expect(Object.keys(published.mock.calls.at(-1)![0]).sort()).toEqual(['2026-10-27', '2026-10-28']);
    });

    // A game finished while a sync is still publishing must reach the relays
    // too — sharing that run would publish the log from before it.
    it('runs again for a call made while a sync is in flight', async () => {
        remotePlays = {};
        usePalavraStore.setState({ plays: { '2026-10-27': game(['LAPIS']) } });
        hold = true;
        const first = syncPalavraWithNostr();
        await vi.waitFor(() => expect(published).toHaveBeenCalledTimes(1));
        usePalavraStore.setState({ plays: { '2026-10-27': game(['LAPIS']), '2026-10-28': game(['PEDRA']) } });
        const second = syncPalavraWithNostr();
        hold = false;
        release();
        await first;
        await second;

        expect(Object.keys(published.mock.calls.at(-1)![0]).sort()).toEqual(['2026-10-27', '2026-10-28']);
    });
});
