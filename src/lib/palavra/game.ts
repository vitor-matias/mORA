// The rules of Palavra do Dia, as pure functions.
//
// Everything here is deterministic and free of React, storage and network, so
// the scoring can be pinned down in unit tests (game.test.ts) — it is the one
// part of the feature a subtle bug would silently corrupt for everybody.

import { sha256 } from '@noble/hashes/sha2';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';
import type { Mark } from './types';

/**
 * A word reduced to the 26 letters the keyboard offers.
 *
 * Portuguese answers are matched without diacritics, so "coração", "CORAÇÃO"
 * and "coracao" are one and the same word. NFD splits an accented letter into
 * its base plus a nonspacing mark (Ç → C + U+0327), which \p{Mn} then drops;
 * anything still outside A–Z afterwards — spaces, hyphens, digits — is removed
 * too, so a guess can never carry a character no key can produce.
 */
export function normalizeWord(input: string): string {
    return input
        .normalize('NFD')
        .replace(/\p{Mn}/gu, '')
        .toUpperCase()
        .replace(/[^A-Z]/g, '');
}

/**
 * Score a guess against the answer, Wordle-style.
 *
 * Two passes, and it has to be two: the exact matches are claimed first, and
 * only the answer letters they leave behind can turn a later letter yellow.
 * The tempting one-pass version ("is this letter anywhere in the answer?")
 * marks both O's of a guess when the answer holds a single O, which is the
 * classic way to get this wrong.
 */
export function scoreGuess(guess: string, answer: string): Mark[] {
    const g = normalizeWord(guess);
    const a = normalizeWord(answer);
    const marks: Mark[] = Array.from({ length: g.length }, () => 'absent');

    // Answer letters still unaccounted for once the exact matches are taken
    // out — the pool a yellow has to draw from.
    const unclaimed = new Map<string, number>();
    for (let i = 0; i < a.length; i++) {
        if (g[i] === a[i]) {
            marks[i] = 'correct';
        } else {
            unclaimed.set(a[i], (unclaimed.get(a[i]) ?? 0) + 1);
        }
    }

    for (let i = 0; i < g.length; i++) {
        if (marks[i] === 'correct') continue;
        const left = unclaimed.get(g[i]) ?? 0;
        if (left > 0) {
            marks[i] = 'present';
            unclaimed.set(g[i], left - 1);
        }
    }

    return marks;
}

export function isSolved(marks: Mark[]): boolean {
    return marks.length > 0 && marks.every((mark) => mark === 'correct');
}

// A letter already shown green must never fall back to yellow because a later
// guess put it in the wrong place.
const MARK_RANK: Record<Mark, number> = { absent: 0, present: 1, correct: 2 };

/** The best-known mark for every letter guessed so far, for colouring keys. */
export function keyboardState(guesses: string[], answer: string): Record<string, Mark> {
    const state: Record<string, Mark> = {};
    for (const guess of guesses) {
        const letters = normalizeWord(guess);
        const marks = scoreGuess(guess, answer);
        for (let i = 0; i < letters.length; i++) {
            const seen = state[letters[i]];
            if (!seen || MARK_RANK[marks[i]] > MARK_RANK[seen]) {
                state[letters[i]] = marks[i];
            }
        }
    }
    return state;
}

// Red rather than black for a miss. Wordle's ⬛/⬜ split exists because a black
// square vanishes on a dark background and a white one on a light background,
// so the grid reads differently depending on the client it lands in. A colour
// sidesteps that entirely — and green/amber/red is the more obvious reading of
// right / close / wrong anyway.
const MARK_EMOJI: Record<Mark, string> = {
    correct: '🟩',
    present: '🟨',
    absent: '🟥',
};

/** The shareable board — the only part of a result that travels as text. */
export function emojiGrid(rows: Mark[][]): string {
    return rows.map((row) => row.map((mark) => MARK_EMOJI[mark]).join('')).join('\n');
}

// ── The answer, in transit ───────────────────────────────────────────────

/** sha256(`${date}:${ANSWER}`), hex. Lets the client recognise a win without
    ever being told the word up front. */
export function answerHash(date: string, answer: string): string {
    return bytesToHex(sha256(utf8ToBytes(`${date}:${normalizeWord(answer)}`)));
}

export function matchesAnswerHash(date: string, guess: string, hash: string): boolean {
    return answerHash(date, guess) === hash;
}

// Obfuscation, not encryption — and the distinction matters enough to spell
// out. Scoring a wrong guess needs the whole answer, so the word must reach
// the browser; anyone who opens devtools can recover it. What this buys is
// that the answer isn't sitting in plain text in the network tab, which is
// where a curious player would stumble on it by accident.
//
// The thing that actually protects shared records is the server's signature
// over a finished result (see server/palavra/README.md): a locally-cheated
// game still can't earn a proof, so it never reaches the leaderboard.
const CIPHER_SALT = 'mora-palavra-v1';

function keystream(date: string, length: number): Uint8Array {
    const out = new Uint8Array(length);
    // Answers run to eight letters, so one 32-byte block always covers it;
    // the counter is here so a longer word could never silently reuse bytes.
    for (let offset = 0, counter = 0; offset < length; counter++) {
        const block = sha256(utf8ToBytes(`${CIPHER_SALT}:${date}:${counter}`));
        out.set(block.subarray(0, Math.min(block.length, length - offset)), offset);
        offset += block.length;
    }
    return out;
}

function bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
    return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

/**
 * Obfuscate the answer **with its accents intact**, uppercased.
 *
 * Guessing is accent-free, but the reveal is not: showing "SALVACAO" as the
 * solution to a Portuguese verse spells the word wrong in front of the reader.
 * So the cipher carries the real spelling and the scoring normalizes it on
 * arrival — one field, and nothing extra is exposed before the game ends.
 */
export function obfuscateAnswer(date: string, answer: string): string {
    const bytes = utf8ToBytes(answer.toLocaleUpperCase('pt-PT'));
    const key = keystream(date, bytes.length);
    return bytesToBase64(bytes.map((byte, i) => byte ^ key[i]));
}

/**
 * Recover the answer, accents and all. Returns '' for anything that doesn't
 * decode — a truncated payload, or a cipher minted for another date — so a bad
 * challenge shows an unplayable board rather than throwing on render.
 *
 * Decoded as UTF-8 rather than byte-per-character: "Ç" and "Ã" are two bytes
 * each, and reading them as latin1 would hand back mojibake that still looked
 * like a word.
 */
export function deobfuscateAnswer(date: string, cipher: string): string {
    let bytes: Uint8Array;
    try {
        bytes = base64ToBytes(cipher);
    } catch {
        return '';
    }
    const key = keystream(date, bytes.length);
    const plain = bytes.map((byte, i) => byte ^ key[i]);
    try {
        // `fatal` turns a wrong-date decode into a throw instead of U+FFFD
        // soup, which makes this double as an integrity check.
        return new TextDecoder('utf-8', { fatal: true }).decode(plain);
    } catch {
        return '';
    }
}
