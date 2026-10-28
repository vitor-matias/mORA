// Streaks and the Palavra log live on the device and merge into whoever syncs
// next — so switching identity must not hand one person's to another.

import { beforeEach, describe, expect, it } from 'vitest';
import { generateSecretKey, nip19 } from 'nostr-tools';
import { useAppStore } from './app';
import { useAuthStore } from './auth';
import { usePalavraStore } from './palavra';

const nsec = () => nip19.nsecEncode(generateSecretKey());
const game = { guesses: ['PEDRA'], solved: true, ms: 1000 };

describe('signing in on a device another identity used', () => {
    beforeEach(() => {
        useAuthStore.getState().logout();
        useAppStore.setState({ localDataOwner: null });
    });

    it('adopts what was played signed out', () => {
        usePalavraStore.setState({ plays: { '2026-10-27': game } });
        useAuthStore.getState().loginWithPrivateKey(nsec());
        expect(Object.keys(usePalavraStore.getState().plays)).toEqual(['2026-10-27']);
    });

    it('keeps the data when the same identity signs back in', () => {
        const key = nsec();
        useAuthStore.getState().loginWithPrivateKey(key);
        usePalavraStore.setState({ plays: { '2026-10-27': game } });
        useAuthStore.getState().logout();
        useAuthStore.getState().loginWithPrivateKey(key);
        expect(Object.keys(usePalavraStore.getState().plays)).toEqual(['2026-10-27']);
    });

    it('starts a different identity clean', () => {
        useAuthStore.getState().loginWithPrivateKey(nsec());
        usePalavraStore.setState({ plays: { '2026-10-27': game } });
        useAppStore.getState().incrementStreak('rosary');
        useAuthStore.getState().logout();

        useAuthStore.getState().loginWithPrivateKey(nsec());

        expect(usePalavraStore.getState().plays).toEqual({});
        expect(useAppStore.getState().streaks.rosary?.days ?? 0).toBe(0);
    });
});
