import { BunkerURI, NConnectSigner, NIP05, NSecSigner, type NostrSigner } from '@nostrify/nostrify';
import { NLogin, generateNostrConnectParams, generateNostrConnectURI, type NostrConnectParams } from '@nostrify/react/login';
import { generateSecretKey, getPublicKey } from 'nostr-tools';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { pool } from '@/lib/pool';
import { useAuthStore } from '@/store/auth';

/**
 * NIP-46 ("Nostr Connect") remote signing, over Nostrify's `NConnectSigner`.
 *
 * This is how a phone signs in: Amber and other Android signer apps are not
 * browser extensions and never inject `window.nostr`, least of all into an
 * installed PWA. Instead the signer holds the key and answers signing requests
 * over relays, so the app can keep publishing in the background without
 * bouncing the user out to another app for every event.
 *
 * The relay side is the shared `pool`, so the signer channel reuses whatever
 * sockets the app already has open rather than dialling its own.
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

/** Asked for up front so the signer grants them once, at approval time.
    Without them a signer may prompt again for every background sync. */
const PERMS = ['sign_event', 'nip44_encrypt', 'nip44_decrypt'];

const CLIENT_NAME = 'mORA';
const CLIENT_URL = typeof window !== 'undefined' ? window.location.origin : '';

/** Where the signer's pubkey and relays live between sessions. Deliberately
    the same shape nostr-tools used, so sessions stored by an older build of
    the app keep working. */
export interface BunkerPointer {
    pubkey: string;
    relays: string[];
    secret?: string;
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

const HEX64_RE = /^[0-9a-f]{64}$/i;

// NConnectSigner aborts each request on its own deadline, so a signer that is
// closed, offline or simply never approved can no longer leave the caller
// hanging for good — a spinning button, or a background sync whose in-flight
// guard never clears and never runs again.
const CONNECT_RPC_TIMEOUT_MS = 45_000; // first contact: the user may need to approve
const SIGNER_RPC_TIMEOUT_MS = 20_000;  // an already-approved session should be prompt

/** How long to wait for the signer to answer a connection request before
    giving up: long enough to walk over to another app and approve. */
const CONNECT_TIMEOUT_MS = 90_000;

/** The NIP-05 domain comes from whatever the user typed, so a host that
    accepts the connection and then never answers is an ordinary case — and
    without a deadline it would hold the login attempt open for good. */
const NIP05_LOOKUP_TIMEOUT_MS = 10_000;

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

/** A request that timed out and one that never reached a relay need different
    advice, and both arrive here as library errors. */
function mapSignerError(error: unknown, message?: string): Error {
    if (error instanceof DOMException && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
        return new SignerUnreachableError(message);
    }
    // Every relay refused or failed to take the request event.
    if (error instanceof AggregateError) return new SignerRelayError();
    return error instanceof Error ? error : new Error(String(error));
}

function sessionKey(session: BunkerSession): string {
    return `${session.pointer.pubkey}:${session.pointer.relays.join(',')}`;
}

/** Connecting means a relay round-trip and possibly an approval, so the
    connected signer is kept for the life of the page. */
let active: NostrSigner | null = null;
let activeKey: string | null = null;
/** A cold connect in progress, shared by everyone asking for the same session. */
let connecting: Promise<NostrSigner> | null = null;
let connectingFor: string | null = null;

export function forgetBunkerSigner() {
    active = null;
    activeKey = null;
    connecting = null;
    connectingFor = null;
}

function connectSigner(pointer: BunkerPointer, clientSecretKey: Uint8Array, timeout: number): NConnectSigner {
    return new NConnectSigner({
        // Shares the pool's sockets; the group just narrows it to these relays.
        relay: pool.group(pointer.relays),
        pubkey: pointer.pubkey,
        signer: new NSecSigner(clientSecretKey),
        timeout,
        // Explicit, because the app stores nothing in plaintext and a signer
        // that can only do NIP-04 is one this app cannot sync with anyway.
        encryption: 'nip44',
    });
}

/**
 * Wraps the remote signer so every call answers in app terms.
 *
 * A cached signer that has stopped answering — the app was asleep, a relay
 * dropped, the signer app was killed — would otherwise be handed to every
 * later call, and each one would time out. A timeout therefore drops the
 * cached signer, so the next request reconnects instead.
 */
function guarded(signer: NConnectSigner, key: string): NostrSigner {
    const run = async <T>(work: () => Promise<T>): Promise<T> => {
        try {
            return await work();
        } catch (error) {
            const mapped = mapSignerError(error);
            if (mapped instanceof SignerUnreachableError && activeKey === key) forgetBunkerSigner();
            throw mapped;
        }
    };
    return {
        getPublicKey: () => run(() => signer.getPublicKey()),
        signEvent: (event) => run(() => signer.signEvent(event)),
        nip44: {
            encrypt: (pubkey, plaintext) => run(() => signer.nip44.encrypt(pubkey, plaintext)),
            decrypt: (pubkey, ciphertext) => run(() => signer.nip44.decrypt(pubkey, ciphertext)),
        },
    };
}

/** The live signer for the stored session, connecting on first use. Null when
    this identity doesn't sign through a remote signer at all. */
export async function getBunkerSigner(): Promise<NostrSigner | null> {
    const session = useAuthStore.getState().bunker;
    if (!session) {
        forgetBunkerSigner();
        return null;
    }
    const key = sessionKey(session);
    if (active && activeKey === key) return active;
    // Streaks and settings sync in parallel, so a cold start calls this twice
    // at once. Without sharing the connect, each call would run its own
    // handshake and the second would displace the first — while its caller
    // was still waiting on a request through it.
    if (connecting && connectingFor === key) return connecting;

    connectingFor = key;
    connecting = (async () => {
        const clientSecretKey = hexToBytes(session.clientSecret);
        // Generous while connecting — the user may have to approve — then the
        // session settles onto the shorter per-request deadline.
        const handshake = connectSigner(session.pointer, clientSecretKey, CONNECT_RPC_TIMEOUT_MS);
        try {
            await handshake.connect(session.pointer.secret);
        } catch (error) {
            throw mapSignerError(error);
        }
        // Logging out (or switching signer) while this was connecting clears
        // the session; adopting the result now would resurrect a signer for an
        // identity that no longer exists.
        const current = useAuthStore.getState().bunker;
        if (!current || sessionKey(current) !== key) {
            throw new Error('A sessão do assinador terminou durante a ligação.');
        }
        const signer = guarded(connectSigner(session.pointer, clientSecretKey, SIGNER_RPC_TIMEOUT_MS), key);
        active = signer;
        activeKey = key;
        return signer;
    })();
    connecting.catch(() => {}).then(() => {
        if (connectingFor === key) {
            connecting = null;
            connectingFor = null;
        }
    });
    return connecting;
}

// ── Client-initiated connection (nostrconnect://, shown as a QR code) ────────

/** An attempt survives here across a reload, because opening the signer app
    can freeze or discard this page — and the client key exists only in
    memory, so without it the attempt would be unrecoverable. */
const PENDING_KEY = 'mora-pending-signer';

interface PendingConnection {
    clientSecret: string;
    /** Echoed back by the signer to prove the reply belongs to this attempt. */
    secret: string;
    relays: string[];
    uri: string;
    /** Whether the request went out as a QR code rather than a deep link.
        Carried across a reload so the resumed attempt comes back looking the
        way the user left it. */
    qr: boolean;
    startedAt: number;
}

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
            && typeof pending.secret === 'string' && pending.secret.length > 0
            && Array.isArray(pending.relays) && pending.relays.length > 0
            && pending.relays.every((relay) => typeof relay === 'string')
            && typeof pending.uri === 'string' && pending.uri.startsWith('nostrconnect://')
            && typeof pending.qr === 'boolean'
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

/** Nostrify's URI carries the relays, secret and name; the permissions and
    the app's origin are appended so the signer can grant everything the app
    needs in the one approval, and show who is asking. */
function connectUri(params: NostrConnectParams): string {
    const extra = new URLSearchParams({ perms: PERMS.join(',') });
    if (CLIENT_URL) extra.set('url', CLIENT_URL);
    return `${generateNostrConnectURI(params, { name: CLIENT_NAME })}&${extra}`;
}

/** Waits for the signer to answer a `nostrconnect://` request. */
async function awaitSignerResponse(params: NostrConnectParams): Promise<BunkerLogin> {
    let login;
    try {
        login = await NLogin.fromNostrConnect(params, pool, {
            signal: AbortSignal.timeout(CONNECT_TIMEOUT_MS),
        });
    } catch (error) {
        // The relays never held, versus the user never approving in time: the
        // two arrive as different errors and need different advice.
        if (error instanceof Error && /closed/i.test(error.message)) throw new SignerRelayError();
        throw new SignerTimeoutError();
    }
    const session: BunkerSession = {
        clientSecret: bytesToHex(params.clientSecretKey),
        pointer: {
            pubkey: login.data.bunkerPubkey,
            relays: login.data.relays,
            secret: params.secret,
        },
    };
    clearPendingConnection();
    return { session, pubkey: login.pubkey };
}

/**
 * Starts a connection the signer app can accept: returns the `nostrconnect://`
 * URI — to open as a deep link, or to show as a QR code for a signer on
 * another device — plus a promise that settles once the signer answers.
 *
 * The answer arrives as an ephemeral event on a live subscription, so it is
 * only received while this page is listening. Opening the signer app can
 * background the page and drop that socket, which is why the attempt is
 * persisted and can be resumed — and why the bunker:// paste exists as the
 * path that doesn't depend on catching a push at all.
 */
export function startBunkerConnection(
    { qr = false, relays = DEFAULT_SIGNER_RELAYS }: { qr?: boolean; relays?: string[] } = {},
): {
    uri: string;
    connected: Promise<BunkerLogin>;
} {
    const params = generateNostrConnectParams(relays);
    const uri = connectUri(params);

    localStorage.setItem(PENDING_KEY, JSON.stringify({
        clientSecret: bytesToHex(params.clientSecretKey),
        secret: params.secret,
        relays,
        uri,
        qr,
        startedAt: Date.now(),
    } satisfies PendingConnection));

    return { uri, connected: awaitSignerResponse(params) };
}

/** Re-listens for an attempt that outlived a reload, or whose socket was
    dropped while the signer app was in front. */
export function resumeBunkerConnection(): { uri: string; qr: boolean; connected: Promise<BunkerLogin> } | null {
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
    return {
        uri: pending.uri,
        qr: pending.qr,
        connected: awaitSignerResponse({
            clientSecretKey,
            clientPubkey: getPublicKey(clientSecretKey),
            secret: pending.secret,
            relays: pending.relays,
        }),
    };
}

// ── Signer-initiated connection (bunker:// or NIP-05, pasted) ────────────────

/**
 * NIP-05 identifiers advertise their signer relays under `nip46`, which is not
 * the same list as the profile's own relays — writing to the wrong ones means
 * a request the signer never sees.
 */
async function lookupNip46(input: string): Promise<BunkerPointer> {
    const match = input.match(NIP05.regex());
    if (!match) throw new Error('Endereço de ligação inválido. Verifique se copiou o endereço completo.');
    const [, name = '_', domain] = match;

    const url = new URL('/.well-known/nostr.json', `https://${domain}/`);
    url.searchParams.set('name', name);

    let json: { names?: Record<string, string>; nip46?: Record<string, string[]> };
    try {
        const response = await fetch(url, { signal: AbortSignal.timeout(NIP05_LOOKUP_TIMEOUT_MS) });
        // A 404 or an error page would otherwise fail further down as a JSON
        // parse error, which says nothing about what went wrong.
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        json = await response.json();
    } catch {
        throw new Error(`Não foi possível contactar ${domain}. Verifique a internet e o identificador.`);
    }
    const pubkey = json.names?.[name];
    const relays = json.nip46?.[pubkey ?? ''];
    if (!pubkey || !relays?.length) {
        throw new Error('Este identificador NIP-05 não aponta para um assinador remoto.');
    }
    return { pubkey, relays };
}

async function parseSignerInput(input: string): Promise<BunkerPointer> {
    if (input.startsWith('bunker://')) {
        let uri: BunkerURI;
        try {
            uri = new BunkerURI(input);
        } catch {
            throw new Error('Endereço de ligação inválido. Verifique se copiou o endereço completo.');
        }
        if (!uri.relays.length) throw new Error('O endereço do assinador não indica nenhum relay.');
        return { pubkey: uri.pubkey, relays: uri.relays, secret: uri.secret };
    }
    return lookupNip46(input);
}

/** Connects using a `bunker://` URI (or NIP-05) copied out of the signer. */
export async function connectWithBunkerUri(input: string): Promise<BunkerLogin> {
    const pointer = await parseSignerInput(input.trim());
    // A truncated or mistyped address parses but isn't a real key, and the
    // curve maths then fails with something like "bad point: is not on
    // curve" — true, and useless to whoever pasted it.
    if (!HEX64_RE.test(pointer.pubkey)) {
        throw new Error('Endereço de ligação inválido: a chave do assinador não é válida. Copie o endereço outra vez.');
    }

    const clientSecretKey = generateSecretKey();
    // Generous: connecting for the first time can mean waiting for the user to
    // approve the request inside the signer app.
    const signer = connectSigner(pointer, clientSecretKey, CONNECT_RPC_TIMEOUT_MS);
    let pubkey: string;
    try {
        await signer.connect(pointer.secret);
        pubkey = await signer.getPublicKey();
    } catch (error) {
        throw mapSignerError(
            error,
            'O assinador não respondeu ao pedido de ligação. Abra a aplicação e aprove-o — se não '
            + 'recebeu nenhuma notificação, ative as notificações dessa aplicação nas definições do Android.',
        );
    }

    const session: BunkerSession = { clientSecret: bytesToHex(clientSecretKey), pointer };
    // The session is about to be stored; let the next request connect through
    // the cached path rather than adopting this short-deadline instance.
    forgetBunkerSigner();
    return { session, pubkey };
}
