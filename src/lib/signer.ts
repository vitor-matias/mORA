import { BunkerURI, NIP05, type NostrSigner } from '@nostrify/nostrify';
import {
    NLogin, NUser, generateNostrConnectParams, generateNostrConnectURI,
    type NLoginType, type NostrConnectParams,
} from '@nostrify/react/login';
import { getPublicKey } from 'nostr-tools';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { pool } from '@/lib/pool';

/**
 * NIP-46 ("Nostr Connect") remote signing, on Nostrify's login stack.
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

/** The remote-signer arm of Nostrify's login union. The union is exported
    but its individual members are not, so it is narrowed here. */
export type BunkerLogin = Extract<NLoginType, { type: 'bunker' }>;

const HEX64_RE = /^[0-9a-f]{64}$/i;

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

/** Building the signer is cheap, but the wrapper below holds the invalidation
    state, so one is kept per login for the life of the page. */
let active: NostrSigner | null = null;
let activeId: string | null = null;

export function forgetBunkerSigner() {
    active = null;
    activeId = null;
}

/**
 * Wraps the remote signer so every call answers in app terms.
 *
 * A cached signer that has stopped answering — the app was asleep, a relay
 * dropped, the signer app was killed — would otherwise be handed to every
 * later call, and each one would time out. A timeout therefore drops the
 * cached signer, so the next request builds a fresh one instead.
 */
function guarded(signer: NostrSigner, id: string): NostrSigner {
    const run = async <T>(work: () => Promise<T>): Promise<T> => {
        try {
            return await work();
        } catch (error) {
            const mapped = mapSignerError(error);
            if (mapped instanceof SignerUnreachableError && activeId === id) forgetBunkerSigner();
            throw mapped;
        }
    };
    const nip44 = signer.nip44;
    return {
        getPublicKey: () => run(() => signer.getPublicKey()),
        signEvent: (event) => run(() => signer.signEvent(event)),
        // Mirrored rather than always offered: callers read the absence of
        // `nip44` as "this signer cannot encrypt" and skip publishing instead
        // of falling back to plaintext, so advertising it unconditionally
        // would turn that check into a lie.
        nip44: nip44 && {
            encrypt: (pubkey, plaintext) => run(() => nip44.encrypt(pubkey, plaintext)),
            decrypt: (pubkey, ciphertext) => run(() => nip44.decrypt(pubkey, ciphertext)),
        },
    };
}

/**
 * The signer for a stored remote-signer login.
 *
 * There is no handshake to redo here: NIP-46 `connect` happens once, when the
 * login is created, and the signer remembers the grant against this client's
 * key — which is why the login record keeps no secret to re-send.
 */
export function getBunkerSigner(login: BunkerLogin): NostrSigner {
    if (active && activeId === login.id) return active;
    active = guarded(NUser.fromBunkerLogin(login, pool).signer, login.id);
    activeId = login.id;
    return active;
}

// ── Client-initiated connection (nostrconnect://, deep link or QR) ───────────

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
    let login: BunkerLogin;
    try {
        login = await NLogin.fromNostrConnect(params, pool, {
            signal: AbortSignal.timeout(CONNECT_TIMEOUT_MS),
        });
    } catch (error) {
        // The relays never held, versus the user never approving in time: the
        // two arrive as different errors and need different advice.
        if (error instanceof Error && /closed/i.test(error.message)) throw new SignerRelayError();
        // Nobody answered: either the deadline aborted the subscription, or
        // the request loop ran out. Anything else — a signer that answered in
        // a form this client can't read, a library fault — is not a timeout,
        // and telling the user to paste a bunker:// address would send them
        // after the wrong problem.
        const timedOut = (error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError'))
            || (error instanceof Error && /timeout/i.test(error.message));
        if (timedOut) throw new SignerTimeoutError();
        throw mapSignerError(error);
    }
    clearPendingConnection();
    return login;
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
 * a request the signer never sees. Nostrify's `NIP05` reads the profile list,
 * so only its name matching is reused here.
 */
async function lookupNip46(input: string): Promise<{ pubkey: string; relays: string[] }> {
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
    // Shape-checked, not just present: this is a document from a host the
    // user named, and an npub, a truncated key or a bare string where the
    // relay list should be would otherwise reach BunkerURI and come back
    // as a library error that says nothing about the identifier.
    const pubkey = json.names?.[name];
    const advertised = json.nip46?.[pubkey ?? ''];
    const relays = Array.isArray(advertised)
        ? advertised.filter((url) => typeof url === 'string' && url.startsWith('ws'))
        : [];
    if (typeof pubkey !== 'string' || !HEX64_RE.test(pubkey) || !relays.length) {
        throw new Error('Este identificador NIP-05 não aponta para um assinador remoto.');
    }
    return { pubkey, relays };
}

/** Connects using a `bunker://` URI (or NIP-05) copied out of the signer. */
export async function connectWithBunkerUri(input: string): Promise<BunkerLogin> {
    const trimmed = input.trim();
    // A NIP-05 identifier resolves to the same thing a bunker:// URI spells
    // out, so it is turned into one and both take the same path from here.
    const uri = trimmed.startsWith('bunker://')
        ? trimmed
        : BunkerURI.fromJSON(await lookupNip46(trimmed)).href;

    try {
        // fromBunker parses the URI, connects with its secret and asks the
        // signer whose key it will sign as — a bunker can hold several.
        return await NLogin.fromBunker(uri, pool);
    } catch (error) {
        if (error instanceof Error && /invalid bunker uri|no relay/i.test(error.message)) {
            throw new Error('Endereço de ligação inválido. Verifique se copiou o endereço completo.');
        }
        throw mapSignerError(
            error,
            'O assinador não respondeu ao pedido de ligação. Abra a aplicação e aprove-o — se não '
            + 'recebeu nenhuma notificação, ative as notificações dessa aplicação nas definições do Android.',
        );
    }
}
