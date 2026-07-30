import { generateSecretKey, getPublicKey } from 'nostr-tools';
import { BunkerSigner, createNostrConnectURI, parseBunkerInput } from 'nostr-tools/nip46';
import type { BunkerPointer } from 'nostr-tools/nip46';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { useAuthStore } from '@/store/auth';

/**
 * NIP-46 ("Nostr Connect") remote signing.
 *
 * This is how a phone signs in: Amber and other Android signer apps are not
 * browser extensions and never inject `window.nostr`, least of all into an
 * installed PWA. Instead the signer holds the key and answers signing requests
 * over relays, so the app can keep publishing in the background without
 * bouncing the user out to another app for every event.
 */

/** Relays used to reach the signer when the URI doesn't name its own. */
const DEFAULT_SIGNER_RELAYS = ['wss://relay.nsec.app', 'wss://relay.damus.io'];

const CLIENT_METADATA = {
    name: 'mORA',
    url: typeof window !== 'undefined' ? window.location.origin : '',
};

/** A connected signer is expensive to set up (relay subscription + handshake),
    so one is kept for the life of the page. */
let active: BunkerSigner | null = null;
let activeFor: string | null = null;

/** Replaces the cached signer, closing whatever it displaces — a reconnect, a
    switch of signer, or a logout would otherwise leave the old relay
    subscription running until a hard reload. */
function setActive(signer: BunkerSigner | null, key: string | null) {
    if (active && active !== signer) active.close().catch(() => {});
    active = signer;
    activeFor = key;
}

export interface BunkerSession {
    /** Hex secret key this client uses to talk to the signer — not the user's. */
    clientSecret: string;
    pointer: BunkerPointer;
}

export interface BunkerLogin {
    session: BunkerSession;
    /** Who the signer signs *as*. Not always the bunker's own pubkey — a
        bunker can hold several identities — so this comes from asking it. */
    pubkey: string;
}

function sessionKey(session: BunkerSession): string {
    return `${session.pointer.pubkey}:${session.pointer.relays.join(',')}`;
}

/** The live signer for the stored session, connecting on first use. */
export async function getBunkerSigner(): Promise<BunkerSigner | null> {
    const session = useAuthStore.getState().bunker;
    if (!session) {
        setActive(null, null);
        return null;
    }
    if (active && activeFor === sessionKey(session)) return active;

    const signer = BunkerSigner.fromBunker(
        hexToBytes(session.clientSecret),
        session.pointer,
    );
    await signer.connect();
    setActive(signer, sessionKey(session));
    return signer;
}

export function forgetBunkerSigner() {
    setActive(null, null);
}

/**
 * Starts a connection the signer app can accept: returns the `nostrconnect://`
 * URI to hand to Amber, plus a promise that settles once the signer answers.
 *
 * The URI is opened as a link rather than pasted, so on Android the tap lands
 * straight in Amber; the handshake itself completes over relays, which is why
 * leaving the browser and coming back doesn't break it.
 */
export function startBunkerConnection(relays: string[] = DEFAULT_SIGNER_RELAYS): {
    uri: string;
    connected: Promise<BunkerLogin>;
} {
    const clientSecretKey = generateSecretKey();
    const clientPubkey = getPublicKey(clientSecretKey);
    // Random per attempt: the signer echoes it back to prove the connection
    // belongs to this request.
    const secret = bytesToHex(generateSecretKey()).slice(0, 32);

    const uri = createNostrConnectURI({
        clientPubkey,
        relays,
        secret,
        perms: ['sign_event', 'nip44_encrypt', 'nip44_decrypt'],
        ...CLIENT_METADATA,
    });

    const connected = BunkerSigner
        .fromURI(clientSecretKey, uri)
        .then(async (signer: BunkerSigner) => {
            const pubkey = await signer.getPublicKey();
            const session: BunkerSession = {
                clientSecret: bytesToHex(clientSecretKey),
                pointer: signer.bp,
            };
            setActive(signer, sessionKey(session));
            return { session, pubkey };
        });

    return { uri, connected };
}

/** Connects using a `bunker://` URI (or NIP-05) copied out of the signer. */
export async function connectWithBunkerUri(input: string): Promise<BunkerLogin> {
    const pointer = await parseBunkerInput(input.trim());
    if (!pointer) throw new Error('Endereço de ligação inválido.');

    const clientSecretKey = generateSecretKey();
    const signer = BunkerSigner.fromBunker(clientSecretKey, pointer);
    await signer.connect();
    const pubkey = await signer.getPublicKey();

    const session: BunkerSession = { clientSecret: bytesToHex(clientSecretKey), pointer };
    setActive(signer, sessionKey(session));
    return { session, pubkey };
}
