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

/**
 * Relays used to reach the signer. The subscription only dies when *every*
 * relay closes, so several healthy ones is the resilience — one flaky entry
 * costs nothing.
 *
 * Measured before choosing: relay.nsec.app refused the connection outright
 * and relay.damus.io took 3.6s to accept, past the pool's 3s connection
 * timeout — with only those two the subscription closed before the user could
 * ever approve, which is exactly the "subscription closed before connection
 * was established" failure. These three accepted a NIP-46 subscription in
 * 249ms, 598ms and 487ms. nsec.app stays last because signers commonly
 * default to it, and it can only help if it recovers.
 */
const DEFAULT_SIGNER_RELAYS = [
    'wss://nos.lol',
    'wss://relay.primal.net',
    'wss://nostr.mom',
    'wss://relay.nsec.app',
];

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
    try {
        await withSignerTimeout(signer.connect());
    } catch (error) {
        signer.close().catch(() => {});
        throw error;
    }
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

const HEX64_RE = /^[0-9a-f]{64}$/i;

export function readPendingConnection(): PendingConnection | null {
    try {
        const raw = localStorage.getItem(PENDING_KEY);
        if (!raw) return null;
        const pending = JSON.parse(raw) as PendingConnection;
        // Everything here is validated rather than assumed: this is storage a
        // half-written attempt or another build could have left behind, and a
        // malformed entry that never expires would have the app retrying a
        // dead attempt on every foreground, forever.
        const usable = pending
            && typeof pending.clientSecret === 'string' && HEX64_RE.test(pending.clientSecret)
            && typeof pending.uri === 'string' && pending.uri.startsWith('nostrconnect://')
            && typeof pending.startedAt === 'number' && Number.isFinite(pending.startedAt);
        if (!usable || Date.now() - pending.startedAt > CONNECT_TIMEOUT_MS) {
            localStorage.removeItem(PENDING_KEY);
            return null;
        }
        return pending;
    } catch {
        localStorage.removeItem(PENDING_KEY);
        return null;
    }
}

export function clearPendingConnection() {
    localStorage.removeItem(PENDING_KEY);
}

export class SignerTimeoutError extends Error {
    constructor() {
        // NIP-46 secrets are single-use, so if the signer did approve while
        // this page was suspended, its reply is gone and re-listening for it
        // is pointless — the bunker:// address is the way through.
        super('Não recebemos a resposta do assinador. Cole antes o endereço bunker:// (ou o identificador NIP-05) da aplicação.');
        this.name = 'SignerTimeoutError';
    }
}

export class SignerRelayError extends Error {
    constructor() {
        super('Não foi possível manter a ligação aos relays. Verifique a internet e tente novamente, ou use o endereço bunker:// da aplicação.');
        this.name = 'SignerRelayError';
    }
}

/** Below this, a closed subscription means the relays never held, not that
    the user was slow to approve — the two need different advice. */
const RELAY_FAILURE_WINDOW_MS = 10_000;

export class SignerUnreachableError extends Error {
    constructor(message = 'O assinador não respondeu. Verifique se a aplicação está a correr e ligada à internet.') {
        super(message);
        this.name = 'SignerUnreachableError';
    }
}

/**
 * The failure that looks like nothing happening: signer apps ask for approval
 * through a notification, and when notifications are turned off for that app
 * the request is never shown — so it is never approved, and the wait simply
 * expires with no clue as to why. Worth naming explicitly, because nothing on
 * either screen points at it.
 */
export const SIGNER_APPROVAL_HINT =
    'Sem resposta ainda. Abra a aplicação de assinatura e aprove o pedido. '
    + 'Se não apareceu nenhuma notificação, verifique nas definições do Android se as '
    + 'notificações dessa aplicação estão ativadas — sem elas o pedido fica invisível.';

/** How long to wait before offering the hint above: long enough that a prompt
    approval never sees it, early enough to still be actionable. */
export const SIGNER_HINT_DELAY_MS = 8_000;

// Every request to the signer resolves only when a reply comes back —
// nostr-tools sets no deadline of its own. Without one of ours, a signer that
// is closed, offline or simply never approved leaves the caller hanging for
// good: a spinning button, or a background sync whose in-flight guard never
// clears and never runs again.
const CONNECT_RPC_TIMEOUT_MS = 45_000; // first contact: the user may need to approve
const SIGNER_RPC_TIMEOUT_MS = 20_000;  // an already-approved session should be prompt

export function withSignerTimeout<T>(
    work: Promise<T>,
    timeoutMs = SIGNER_RPC_TIMEOUT_MS,
    message?: string,
): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new SignerUnreachableError(message)), timeoutMs);
        work.then(
            (value) => { clearTimeout(timer); resolve(value); },
            (error) => { clearTimeout(timer); reject(error); },
        );
    });
}

/** Listens for the signer's answer to an already-created connection URI. */
function awaitSignerResponse(clientSecretKey: Uint8Array, uri: string): Promise<BunkerLogin> {
    const startedAt = Date.now();
    return BunkerSigner
        .fromURI(clientSecretKey, uri, {}, CONNECT_TIMEOUT_MS)
        .then(async (signer: BunkerSigner) => {
            let pubkey: string;
            try {
                pubkey = await withSignerTimeout(signer.getPublicKey());
            } catch (error) {
                // Only a signer that reached `active` gets closed by setActive,
                // so one that fails here would keep its subscription for the
                // life of the page.
                signer.close().catch(() => {});
                throw error;
            }
            const session: BunkerSession = {
                clientSecret: bytesToHex(clientSecretKey),
                pointer: signer.bp,
            };
            setActive(signer, sessionKey(session));
            clearPendingConnection();
            return { session, pubkey };
        })
        .catch((error) => {
            // The library reports every failure as a closed subscription,
            // whether the relays never connected or the user simply never
            // approved. How fast it closed tells them apart.
            if (error instanceof Error && /subscription closed/i.test(error.message)) {
                throw Date.now() - startedAt < RELAY_FAILURE_WINDOW_MS
                    ? new SignerRelayError()
                    : new SignerTimeoutError();
            }
            throw error;
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
    let clientSecretKey: Uint8Array;
    try {
        clientSecretKey = hexToBytes(pending.clientSecret);
    } catch {
        // Validated above, so this shouldn't happen — but throwing here would
        // land in a caller that isn't awaiting, as an unhandled rejection.
        clearPendingConnection();
        return null;
    }
    return awaitSignerResponse(clientSecretKey, pending.uri);
}

/** Connects using a `bunker://` URI (or NIP-05) copied out of the signer. */
export async function connectWithBunkerUri(input: string): Promise<BunkerLogin> {
    const pointer = await parseBunkerInput(input.trim());
    if (!pointer) throw new Error('Endereço de ligação inválido. Verifique se copiou o endereço completo.');

    const clientSecretKey = generateSecretKey();
    let signer: BunkerSigner;
    try {
        signer = BunkerSigner.fromBunker(clientSecretKey, pointer);
    } catch {
        // A truncated or mistyped address parses but isn't a real key, and the
        // curve maths then fails with something like "bad point: is not on
        // curve" — true, and useless to whoever pasted it.
        throw new Error('Endereço de ligação inválido: a chave do assinador não é válida. Copie o endereço outra vez.');
    }
    let pubkey: string;
    try {
        // Generous: connecting for the first time can mean waiting for the
        // user to approve the request inside the signer app.
        await withSignerTimeout(
            signer.connect(),
            CONNECT_RPC_TIMEOUT_MS,
            'O assinador não respondeu ao pedido de ligação. Abra a aplicação e aprove-o — se não '
            + 'recebeu nenhuma notificação, ative as notificações dessa aplicação nas definições do Android.',
        );
        pubkey = await withSignerTimeout(signer.getPublicKey());
    } catch (error) {
        signer.close().catch(() => {});
        throw error;
    }

    const session: BunkerSession = { clientSecret: bytesToHex(clientSecretKey), pointer };
    setActive(signer, sessionKey(session));
    return { session, pubkey };
}
