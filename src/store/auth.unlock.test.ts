import { beforeEach, describe, expect, it } from 'vitest';
import { generateSecretKey, getPublicKey } from 'nostr-tools';
import { useAuthStore } from './auth';

const sk = generateSecretKey();
const hex = Array.from(sk, (b) => b.toString(16).padStart(2, '0')).join('');
const protectedKey = { credentialId: 'c', iv: 'i', ciphertext: 'x', salt: 's' };

describe('unlockWithKey', () => {
    beforeEach(() => {
        useAuthStore.setState({ login: null, lockedPubkey: getPublicKey(sk), protectedKey, isLocked: true });
    });

    it('unlocks the identity that is locked', () => {
        useAuthStore.getState().unlockWithKey(hex);
        expect(useAuthStore.getState().login?.pubkey).toBe(getPublicKey(sk));
        expect(useAuthStore.getState().isLocked).toBe(false);
    });

    // A passkey prompt that resolves after logout must not sign back in with
    // a key that would now be persisted unprotected.
    it('drops a key that arrives after logout', () => {
        useAuthStore.getState().logout();
        useAuthStore.getState().unlockWithKey(hex);
        expect(useAuthStore.getState().login).toBeNull();
    });
});
