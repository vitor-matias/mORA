import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';
import { bytesToHex } from '@noble/hashes/utils';
import type { NostrProfile } from '@/lib/nostr';

interface AuthState {
    pubkey: string | null;
    privkey: string | null; // Only stored if generated locally, not NIP-07
    isNip07: boolean;
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
            isNip07: false,
            profile: null,

            setProfile: (profile) => set({ profile }),

            loginWithNip07: async () => {
                try {
                    // @ts-ignore
                    if (!window.nostr) {
                        throw new Error('Nostr extension not found');
                    }
                    // @ts-ignore
                    const pubkey = await window.nostr.getPublicKey();
                    set({ pubkey, privkey: null, isNip07: true });
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
                    set({ pubkey: pubkeyHex, privkey: privkeyHex, isNip07: false });
                } catch (e) {
                    throw new Error('Formato de chave privada inválido. Utilize nsec ou hex.');
                }
            },

            generateLocalKey: () => {
                const secretKey = generateSecretKey();
                const privkeyHex = bytesToHex(secretKey);
                const pubkeyHex = getPublicKey(secretKey);
                set({ pubkey: pubkeyHex, privkey: privkeyHex, isNip07: false });
            },

            logout: () => {
                set({ pubkey: null, privkey: null, isNip07: false, profile: null });
            },
        }),
        {
            name: 'mora-auth-storage',
        }
    )
);
