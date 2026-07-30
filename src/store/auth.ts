import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';
import { bytesToHex } from '@noble/hashes/utils';
import type { NostrProfile } from '@/lib/nostr';
import type { BunkerSession } from '@/lib/signer';
import type { ProtectedKey } from '@/lib/keyVault';
import { useAppStore } from '@/store/app';

// Signing in is the point at which a user gets an identity to sync under, so
// sync starts on and they can turn it off in Perfil. Both halves live here so
// the flag can never be carried over to whoever signs in next on this device —
// shareStreaks is device-level, and every caller of logout() must clear it, not
// just the button in Perfil.
function enableSyncForNewIdentity() {
    useAppStore.getState().setShareStreaks(true);
}

function clearSyncForIdentity() {
    useAppStore.getState().setShareStreaks(false);
}

interface AuthState {
    pubkey: string | null;
    /** The locally generated key, hex. While `protectedKey` is set this is
        memory-only — it is deliberately kept out of storage (see partialize)
        and is null again after a reload until the passkey unlocks it. */
    privkey: string | null;
    /** Set once the key is encrypted behind a passkey. Its presence is what
        makes `privkey` memory-only. */
    protectedKey: ProtectedKey | null;
    /** Encrypted at rest and not yet unlocked this session: the app works,
        but nothing that needs the key (signing, Nostr sync) can run. */
    isLocked: boolean;
    setProtectedKey: (protectedKey: ProtectedKey | null, privkey: string | null) => void;
    unlockWithKey: (privkey: string) => void;
    isNip07: boolean;
    /** NIP-46 remote signer (e.g. Amber on Android), which holds the key and
        signs over relays. Null unless signed in that way. */
    bunker: BunkerSession | null;
    loginWithBunker: (session: BunkerSession, pubkey: string) => void;
    profile: NostrProfile | null;
    setProfile: (profile: NostrProfile | null) => void;
    loginWithNip07: () => Promise<void>;
    loginWithPrivateKey: (key: string) => void;
    generateLocalKey: () => void;
    logout: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            pubkey: null,
            privkey: null,
            protectedKey: null,
            isLocked: false,
            isNip07: false,
            bunker: null,
            profile: null,

            // Turning protection on keeps the key usable for this session and
            // stops persisting it; turning it off writes it back to storage.
            setProtectedKey: (protectedKey, privkey) => set({
                protectedKey,
                privkey,
                isLocked: false,
            }),

            unlockWithKey: (privkey) => set({ privkey, isLocked: false }),

            setProfile: (profile) => set({ profile }),

            loginWithNip07: async () => {
                try {
                    if (!window.nostr) {
                        throw new Error('Nostr extension not found');
                    }
                    const pubkey = await window.nostr.getPublicKey();
                    set({ pubkey, privkey: null, protectedKey: null, isLocked: false, isNip07: true, bunker: null });
                    enableSyncForNewIdentity();
                } catch (error) {
                    console.error('Failed to login with NIP-07:', error);
                    throw error;
                }
            },

            loginWithPrivateKey: (key: string) => {
                let privkeyHex = '';
                try {
                    if (key.startsWith('nsec')) {
                        const decoded = nip19.decode(key);
                        if (decoded.type === 'nsec') {
                            privkeyHex = bytesToHex(decoded.data as Uint8Array);
                        } else {
                            throw new Error('Invalid nsec key');
                        }
                    } else {
                        // Assume it's already a hex key
                        privkeyHex = key;
                    }

                    // Verify it works by generating the pubkey
                    const secretKeyBytes = new Uint8Array(privkeyHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
                    const pubkeyHex = getPublicKey(secretKeyBytes);
                    set({ pubkey: pubkeyHex, privkey: privkeyHex, protectedKey: null, isLocked: false, isNip07: false, bunker: null });
                    enableSyncForNewIdentity();
                } catch {
                    throw new Error('Formato de chave privada inválido. Utilize nsec ou hex.');
                }
            },

            generateLocalKey: () => {
                const secretKey = generateSecretKey();
                const privkeyHex = bytesToHex(secretKey);
                const pubkeyHex = getPublicKey(secretKey);
                set({ pubkey: pubkeyHex, privkey: privkeyHex, protectedKey: null, isLocked: false, isNip07: false, bunker: null });
                enableSyncForNewIdentity();
            },

            loginWithBunker: (bunker, pubkey) => {
                // The signer keeps the secret key; this device only ever holds
                // the session it talks to the signer with.
                set({ pubkey, privkey: null, protectedKey: null, isLocked: false, isNip07: false, bunker });
                enableSyncForNewIdentity();
            },

            logout: () => {
                set({ pubkey: null, privkey: null, protectedKey: null, isLocked: false, isNip07: false, bunker: null, profile: null });
                clearSyncForIdentity();
            },
        }),
        {
            name: 'mora-auth-storage',
            // The whole point of protection: once the key is encrypted, the
            // plaintext must never reach storage again.
            partialize: (state) => (
                state.protectedKey ? { ...state, privkey: null } : state
            ),
            // A protected key starts every session locked — `privkey` was
            // never written, so it can only come back via the passkey.
            onRehydrateStorage: () => (state) => {
                if (state?.protectedKey) {
                    state.privkey = null;
                    state.isLocked = true;
                }
            },
        }
    )
);
