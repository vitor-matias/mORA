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

/** How long to wait for the signer to answer before giving up. The library
    default is five minutes, which is indistinguishable from a hung button. */
const CONNECT_TIMEOUT_MS = 90_000;

/** An attempt survives here across a reload, because opening the signer app
    can freeze or discard this page — and the client key exists only in
    memory, so without it the attempt would be unrecoverable. */
const PENDING_KEY = 'mora-pending-signer';

interface PendingConnection {
    clientSecret: string;
    uri: string;
    startedAt: number;
}

export function readPendingConnection(): PendingConnection | null {
    try {
        const raw = localStorage.getItem(PENDING_KEY);
        if (!raw) return null;
        const pending = JSON.parse(raw) as PendingConnection;
        if (!pending?.clientSecret || !pending.uri) return null;
        if (Date.now() - pending.startedAt > CONNECT_TIMEOUT_MS) {
            localStorage.removeItem(PENDING_KEY);
            return null;
        }
        return pending;
    } catch {
        return null;
    }
}

export function clearPendingConnection() {
    localStorage.removeItem(PENDING_KEY);
}

export class SignerTimeoutError extends Error {
    constructor() {
        super('O assinador não respondeu. Tente novamente ou use o endereço bunker://.');
        this.name = 'SignerTimeoutError';
    }
}

/** Listens for the signer's answer to an already-created connection URI. */
function awaitSignerResponse(clientSecretKey: Uint8Array, uri: string): Promise<BunkerLogin> {
    return BunkerSigner
        .fromURI(clientSecretKey, uri, {}, CONNECT_TIMEOUT_MS)
        .then(async (signer: BunkerSigner) => {
            const pubkey = await signer.getPublicKey();
            const session: BunkerSession = {
                clientSecret: bytesToHex(clientSecretKey),
                pointer: signer.bp,
            };
            setActive(signer, sessionKey(session));
            clearPendingConnection();
            return { session, pubkey };
        })
        .catch((error) => {
            // The library rejects with a closed-subscription error once its
            // wait elapses; say what actually happened.
            throw error instanceof Error && /subscription closed/i.test(error.message)
                ? new SignerTimeoutError()
                : error;
        });
}

/**
 * Starts a connection the signer app can accept: returns the `nostrconnect://`
 * URI to open, plus a promise that settles once the signer answers.
 *
 * The answer arrives as an ephemeral event on a live subscription, so it is
 * only received while this page is listening. Opening the signer app can
 * background the page and drop that socket, which is why the attempt is
 * persisted and can be resumed — and why the bunker:// paste exists as the
 * path that doesn't depend on catching a push at all.
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

    localStorage.setItem(PENDING_KEY, JSON.stringify({
        clientSecret: bytesToHex(clientSecretKey),
        uri,
        startedAt: Date.now(),
    } satisfies PendingConnection));

    return { uri, connected: awaitSignerResponse(clientSecretKey, uri) };
}

/** Re-listens for an attempt that outlived a reload, or whose socket was
    dropped while the signer app was in front. */
export function resumeBunkerConnection(): Promise<BunkerLogin> | null {
    const pending = readPendingConnection();
    if (!pending) return null;
    return awaitSignerResponse(hexToBytes(pending.clientSecret), pending.uri);
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
