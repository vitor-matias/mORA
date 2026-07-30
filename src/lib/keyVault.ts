/**
 * Encrypts the locally generated Nostr key at rest, unlocked by a passkey.
 *
 * Why not a non-extractable WebCrypto key: WebCrypto has no secp256k1, so the
 * raw bytes must be reachable by JS to sign anything. The next best thing is
 * to keep them encrypted on disk and only in memory once the user has proved
 * presence — which removes the "anyone with the device (or a copy of its
 * storage) has the key" case, though not a live XSS while unlocked.
 *
 * The encryption key never leaves the authenticator's control: WebAuthn's PRF
 * extension derives it from the passkey during a user-verified assertion.
 */

// Fixed per-app input to the passkey's PRF, so the same passkey always yields
// the same secret for mORA and a different one for any other site.
const PRF_SALT = new TextEncoder().encode('mora-key-vault-v1');
const HKDF_INFO = new TextEncoder().encode('mora-nsec-encryption');

export interface ProtectedKey {
    /** base64url credential id of the passkey that unlocks this. */
    credentialId: string;
    /** base64url AES-GCM IV. */
    iv: string;
    /** base64url ciphertext of the hex private key. */
    ciphertext: string;
    /** base64url HKDF salt. */
    salt: string;
}

export class PasskeyUnsupportedError extends Error {
    constructor(message = 'Este dispositivo não suporta chaves de acesso com encriptação (PRF).') {
        super(message);
        this.name = 'PasskeyUnsupportedError';
    }
}

export class VaultLockedError extends Error {
    constructor(message = 'A chave está protegida e ainda não foi desbloqueada.') {
        super(message);
        this.name = 'VaultLockedError';
    }
}

function toBase64Url(bytes: ArrayBuffer | Uint8Array): string {
    const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    let binary = '';
    for (const byte of view) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/')
        + '='.repeat((4 - (value.length % 4)) % 4);
    const binary = atob(padded);
    const out = new Uint8Array(new ArrayBuffer(binary.length));
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
}

function randomBytes(length: number): Uint8Array<ArrayBuffer> {
    return crypto.getRandomValues(new Uint8Array(new ArrayBuffer(length)));
}

/** Whether this browser can do WebAuthn at all. PRF support itself can only be
    confirmed by creating a credential, so enabling is what truly tests it. */
export function passkeysAvailable(): boolean {
    return typeof window !== 'undefined'
        && typeof window.PublicKeyCredential !== 'undefined'
        && !!navigator.credentials
        && window.isSecureContext;
}

type PrfResults = { first?: ArrayBuffer };
type PrfExtension = { enabled?: boolean; results?: PrfResults };

/** Turns the passkey's PRF output into an AES-GCM key. Non-extractable, so
    the derived key can't be read back out of the page either. */
async function deriveAesKey(prfOutput: ArrayBuffer, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
    const base = await crypto.subtle.importKey('raw', prfOutput, 'HKDF', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
        { name: 'HKDF', hash: 'SHA-256', salt, info: HKDF_INFO },
        base,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
    );
}

/** Runs a user-verified assertion and returns the PRF secret behind it. */
async function evaluatePrf(credentialId?: string): Promise<ArrayBuffer> {
    const assertion = await navigator.credentials.get({
        publicKey: {
            challenge: randomBytes(32),
            ...(credentialId
                ? { allowCredentials: [{ type: 'public-key' as const, id: fromBase64Url(credentialId) }] }
                : {}),
            userVerification: 'required',
            extensions: { prf: { eval: { first: PRF_SALT } } } as AuthenticationExtensionsClientInputs,
        },
    }) as PublicKeyCredential | null;

    if (!assertion) throw new VaultLockedError('Desbloqueio cancelado.');
    const prf = (assertion.getClientExtensionResults() as { prf?: PrfExtension }).prf;
    const secret = prf?.results?.first;
    if (!secret) throw new PasskeyUnsupportedError();
    return secret;
}

/**
 * Creates a passkey and encrypts `privkeyHex` under it. The caller is
 * responsible for dropping the plaintext copy once this resolves.
 */
export async function protectKey(privkeyHex: string, accountName: string): Promise<ProtectedKey> {
    if (!passkeysAvailable()) throw new PasskeyUnsupportedError();

    const credential = await navigator.credentials.create({
        publicKey: {
            challenge: randomBytes(32),
            rp: { name: 'mORA', id: window.location.hostname },
            user: {
                id: randomBytes(16),
                name: accountName || 'mORA',
                displayName: accountName || 'mORA',
            },
            // ES256 then RS256 — between them every platform authenticator.
            pubKeyCredParams: [
                { type: 'public-key', alg: -7 },
                { type: 'public-key', alg: -257 },
            ],
            authenticatorSelection: {
                residentKey: 'required',
                userVerification: 'required',
            },
            extensions: { prf: {} } as AuthenticationExtensionsClientInputs,
        },
    }) as PublicKeyCredential | null;

    if (!credential) throw new PasskeyUnsupportedError('Não foi possível criar a chave de acesso.');

    const prf = (credential.getClientExtensionResults() as { prf?: PrfExtension }).prf;
    if (!prf?.enabled) {
        // The passkey exists but can't derive secrets, so it is useless to us.
        // Nothing has been encrypted, so the caller's key is untouched.
        throw new PasskeyUnsupportedError();
    }

    const credentialId = toBase64Url(credential.rawId);
    // Creation doesn't return PRF output on every platform; a follow-up
    // assertion is the portable way to obtain it.
    const prfOutput = await evaluatePrf(credentialId);

    const salt = randomBytes(32);
    const iv = randomBytes(12);
    const aesKey = await deriveAesKey(prfOutput, salt);
    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        aesKey,
        new TextEncoder().encode(privkeyHex),
    );

    return {
        credentialId,
        iv: toBase64Url(iv),
        salt: toBase64Url(salt),
        ciphertext: toBase64Url(ciphertext),
    };
}

/** Prompts for the passkey and returns the hex private key. */
export async function unlockKey(stored: ProtectedKey): Promise<string> {
    if (!passkeysAvailable()) throw new PasskeyUnsupportedError();

    const prfOutput = await evaluatePrf(stored.credentialId);
    const aesKey = await deriveAesKey(prfOutput, fromBase64Url(stored.salt));
    try {
        const plaintext = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: fromBase64Url(stored.iv) },
            aesKey,
            fromBase64Url(stored.ciphertext),
        );
        return new TextDecoder().decode(plaintext);
    } catch {
        // Wrong passkey, or storage tampered with — AES-GCM authenticates, so
        // this is the only way to find out.
        throw new VaultLockedError('Não foi possível desencriptar a chave com esta chave de acesso.');
    }
}
