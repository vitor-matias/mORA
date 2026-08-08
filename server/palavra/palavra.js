// The parts of the contract that must agree with the client byte for byte.
//
// Every function here mirrors one in src/lib/palavra/game.ts. If the two ever
// drift, the failure is silent and total: a hash that doesn't match makes the
// day unwinnable, and a cipher that doesn't decode makes the board unplayable.
// The client checks both on load and refuses the challenge rather than serving
// a broken puzzle — but that only turns a silent bug into a visible one, so
// keep these in step.

import { sha256 } from '@noble/hashes/sha2';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';

export const CIPHER_SALT = 'mora-palavra-v1';

/** NFD → drop nonspacing marks → uppercase → keep only A–Z. */
export function normalizeWord(input) {
    return input
        .normalize('NFD')
        .replace(/\p{Mn}/gu, '')
        .toUpperCase()
        .replace(/[^A-Z]/g, '');
}

export function answerHash(date, answer) {
    return bytesToHex(sha256(utf8ToBytes(`${date}:${normalizeWord(answer)}`)));
}

function keystream(date, length) {
    const out = new Uint8Array(length);
    for (let offset = 0, counter = 0; offset < length; counter++) {
        const block = sha256(utf8ToBytes(`${CIPHER_SALT}:${date}:${counter}`));
        out.set(block.subarray(0, Math.min(block.length, length - offset)), offset);
        offset += block.length;
    }
    return out;
}

/**
 * Obfuscate the answer with its accents intact, uppercased, UTF-8 encoded.
 *
 * Note the asymmetry with answerHash, which covers the *folded* form: guessing
 * is accent-free, but the reveal shows the real spelling. So "SALVAÇÃO" is ten
 * bytes here while `length` is 8.
 */
export function obfuscateAnswer(date, answer) {
    const bytes = utf8ToBytes(answer.toLocaleUpperCase('pt-PT'));
    const key = keystream(date, bytes.length);
    return Buffer.from(bytes.map((byte, i) => byte ^ key[i])).toString('base64');
}
