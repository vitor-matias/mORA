import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { NLogin, type NLoginType } from '@nostrify/react/login';
import { generateSecretKey, nip19 } from 'nostr-tools';
import type { NostrProfile } from '@/lib/nostr';
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
    /** Nostrify's login record — one discriminated union across all three key
        custodies, and the only thing needed to rebuild a signer. */
    login: NLoginType | null;
    /** Who a protected key belongs to while it is still locked. The login
        itself is not persisted in that case (see partialize), so without this
        a reload would show a signed-out app rather than a locked one. */
    lockedPubkey: string | null;
    /** Set once the key is encrypted behind a passkey. Its presence is what
        keeps the login out of storage. */
    protectedKey: ProtectedKey | null;
    /** Encrypted at rest and not yet unlocked this session: the app works,
        but nothing that needs the key (signing, Nostr sync) can run. */
    isLocked: boolean;
    profile: NostrProfile | null;
    setProfile: (profile: NostrProfile | null) => void;
    setProtectedKey: (protectedKey: ProtectedKey | null) => void;
    unlockWithKey: (privkeyHex: string) => void;
    signIn: (login: NLoginType) => void;
    loginWithNip07: () => Promise<void>;
    loginWithPrivateKey: (key: string) => void;
    generateLocalKey: () => void;
    logout: () => void;
}

/** The nsec of a locally held key, or null for the custodies that never hand
    this device the secret (NIP-07, remote signer) or while one is locked. */
export function localNsec(state: AuthState): `nsec1${string}` | null {
    return state.login?.type === 'nsec' ? state.login.data.nsec : null;
}

const HEX64_RE = /^[0-9a-f]{64}$/i;

/**
 * Hex to key bytes, refusing anything that isn't a whole 32-byte key.
 *
 * Validated rather than parsed leniently: `parseInt` turns a stray non-hex
 * pair into NaN, which `Uint8Array.from` stores as 0. Sixty-four characters
 * with two bad ones would therefore produce a different — but perfectly
 * valid — key, and the user would be signed in as an identity that isn't
 * theirs, with no error anywhere.
 */
function keyBytes(hex: string): Uint8Array {
    if (!HEX64_RE.test(hex)) throw new Error('Chave privada inválida.');
    return Uint8Array.from(hex.match(/.{2}/g)!.map((byte) => parseInt(byte, 16)));
}

/** Hex form of the local key, for the passkey vault — which predates the
    login record and speaks hex. */
function nsecToHex(nsec: `nsec1${string}`): string {
    const decoded = nip19.decode(nsec);
    if (decoded.type !== 'nsec') throw new Error('Invalid nsec');
    return Array.from(decoded.data, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function localPrivkeyHex(state: AuthState): string | null {
    const nsec = localNsec(state);
    return nsec ? nsecToHex(nsec) : null;
}

/** Whoever is signed in, including an identity whose key is still locked.
    Exported as a plain function because the sync layer runs outside React. */
export function currentPubkey(): string | null {
    const { login, lockedPubkey } = useAuthStore.getState();
    return login?.pubkey ?? lockedPubkey;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            login: null,
            lockedPubkey: null,
            protectedKey: null,
            isLocked: false,
            profile: null,

            setProfile: (profile) => set({ profile }),

            // Turning protection on keeps the login usable for this session and
            // stops persisting it; turning it off writes it back to storage.
            setProtectedKey: (protectedKey) => set({ protectedKey, isLocked: false }),

            unlockWithKey: (privkeyHex) => {
                set({
                    login: NLogin.fromNsec(nip19.nsecEncode(keyBytes(privkeyHex))),
                    isLocked: false,
                });
            },

            signIn: (login) => {
                set({ login, lockedPubkey: null, protectedKey: null, isLocked: false, profile: null });
                enableSyncForNewIdentity();
            },

            loginWithNip07: async () => {
                try {
                    // fromExtension reads window.nostr and asks it for the
                    // pubkey; it throws if no extension ever appears.
                    const login = await NLogin.fromExtension();
                    set({ login, lockedPubkey: null, protectedKey: null, isLocked: false, profile: null });
                    enableSyncForNewIdentity();
                } catch (error) {
                    console.error('Failed to login with NIP-07:', error);
                    throw error;
                }
            },

            loginWithPrivateKey: (key: string) => {
                try {
                    // fromNsec validates and derives the pubkey; hex is still
                    // accepted here because that is what the field has always
                    // taken, and it is what other clients export.
                    const nsec = key.startsWith('nsec')
                        ? key as `nsec1${string}`
                        : nip19.nsecEncode(keyBytes(key));
                    const login = NLogin.fromNsec(nsec);
                    set({ login, lockedPubkey: null, protectedKey: null, isLocked: false, profile: null });
                    enableSyncForNewIdentity();
                } catch {
                    throw new Error('Formato de chave privada inválido. Utilize nsec ou hex.');
                }
            },

            generateLocalKey: () => {
                const login = NLogin.fromNsec(nip19.nsecEncode(generateSecretKey()));
                set({ login, lockedPubkey: null, protectedKey: null, isLocked: false, profile: null });
                enableSyncForNewIdentity();
            },

            logout: () => {
                set({ login: null, lockedPubkey: null, protectedKey: null, isLocked: false, profile: null });
                clearSyncForIdentity();
                // Clearing the login doesn't hang up on a remote signer: the
                // connection is cached at module scope and would keep answering
                // until a reload. Imported lazily — signer.ts reads this store,
                // so a static import would cycle.
                import('@/lib/signer')
                    .then(({ forgetBunkerSigner }) => forgetBunkerSigner())
                    .catch(() => {});
            },
        }),
        {
            name: 'mora-auth-storage',
            version: 1,
            // The whole point of protection: once the key is encrypted, the
            // nsec inside the login must never reach storage again. The pubkey
            // is kept separately so the app still knows whose key is locked.
            partialize: (state) => (
                state.protectedKey
                    ? { ...state, login: null, lockedPubkey: state.login?.pubkey ?? state.lockedPubkey, isLocked: true }
                    : state
            ),
            // A protected key starts every session locked — the login was
            // never written, so it can only come back via the passkey.
            onRehydrateStorage: () => (state) => {
                if (state?.protectedKey) {
                    state.login = null;
                    state.isLocked = true;
                }
            },
            /** Sessions written before the login record existed stored the
                custody as three loose fields. Rebuild the equivalent login so
                nobody is signed out by the upgrade. */
            migrate: (persisted, version) => {
                if (version >= 1) return persisted as AuthState;
                const old = persisted as {
                    pubkey?: string | null;
                    privkey?: string | null;
                    isNip07?: boolean;
                    bunker?: { clientSecret: string; pointer: { pubkey: string; relays: string[] } } | null;
                    protectedKey?: ProtectedKey | null;
                    isLocked?: boolean;
                    profile?: NostrProfile | null;
                };
                let login: NLoginType | null = null;
                try {
                if (old.bunker && old.pubkey) {
                    login = {
                        id: `bunker:${old.pubkey}`,
                        type: 'bunker',
                        pubkey: old.pubkey,
                        createdAt: new Date(0).toISOString(),
                        data: {
                            bunkerPubkey: old.bunker.pointer.pubkey,
                            clientNsec: nip19.nsecEncode(keyBytes(old.bunker.clientSecret)),
                            relays: old.bunker.pointer.relays,
                        },
                    };
                } else if (old.isNip07 && old.pubkey) {
                    login = { id: `extension:${old.pubkey}`, type: 'extension', pubkey: old.pubkey, createdAt: new Date(0).toISOString(), data: null };
                } else if (old.privkey) {
                    login = NLogin.fromNsec(nip19.nsecEncode(keyBytes(old.privkey)));
                }
                } catch (error) {
                    // Unreadable stored key: sign out rather than crash on
                    // start, and rather than guess at what it meant.
                    console.warn('Could not migrate the stored Nostr login.', error);
                    login = null;
                }
                return {
                    login,
                    lockedPubkey: old.protectedKey ? old.pubkey ?? null : null,
                    protectedKey: old.protectedKey ?? null,
                    isLocked: old.isLocked ?? false,
                    profile: old.profile ?? null,
                } as AuthState;
            },
        }
    )
);
