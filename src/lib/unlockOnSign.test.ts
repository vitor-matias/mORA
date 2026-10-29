import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateSecretKey, getPublicKey } from 'nostr-tools';
import { signNostrEvent } from './nostr';
import { useAuthStore } from '@/store/auth';

const sk = generateSecretKey();
const hex = Array.from(sk, (b) => b.toString(16).padStart(2, '0')).join('');
const unlockKey = vi.fn();
vi.mock('@/lib/keyVault', () => ({ unlockKey: (...a: unknown[]) => unlockKey(...a) }));

const protectedKey = { credentialId: 'c', iv: 'i', ciphertext: 'x', salt: 's' };
const template = { kind: 1, created_at: 0, tags: [], content: 'hi' };

describe('signing with a locked protected key', () => {
    beforeEach(() => {
        unlockKey.mockReset();
        useAuthStore.setState({ login: null, lockedPubkey: getPublicKey(sk), protectedKey, isLocked: true });
    });

    it('asks for the passkey once, then signs', async () => {
        unlockKey.mockResolvedValue(hex);
        const [a, b] = await Promise.all([signNostrEvent(template), signNostrEvent(template)]);
        expect(unlockKey).toHaveBeenCalledTimes(1);
        expect(a.pubkey).toBe(getPublicKey(sk));
        expect(b.pubkey).toBe(getPublicKey(sk));
        expect(useAuthStore.getState().isLocked).toBe(false);
    });

    it('stays locked and rejects when the prompt is cancelled', async () => {
        unlockKey.mockRejectedValue(new DOMException('cancelled', 'NotAllowedError'));
        await expect(signNostrEvent(template)).rejects.toThrow('cancelled');
        expect(useAuthStore.getState().isLocked).toBe(true);
    });

    it('lock() drops the key again', async () => {
        unlockKey.mockResolvedValue(hex);
        await signNostrEvent(template);
        useAuthStore.getState().lock();
        expect(useAuthStore.getState()).toMatchObject({ login: null, isLocked: true, lockedPubkey: getPublicKey(sk) });
    });
});
