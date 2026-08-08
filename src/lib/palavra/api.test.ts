import { describe, expect, it } from 'vitest';
import { sanitizeChallenge } from './api';
import { answerHash, obfuscateAnswer } from './game';
import { BLANK_MARKER } from './types';

const DATE = '2026-08-08';
const ANSWER = 'SALVAÇÃO';

/** A payload as the publisher builds it, with individual fields overridable
    so each test can break exactly one thing. */
function payload(overrides: Record<string, unknown> = {}) {
    return {
        date: DATE,
        ref: 'Lucas 1,77',
        full: 'para dar ao seu povo o conhecimento da salvação.',
        verse: `para dar ao seu povo o conhecimento da ${BLANK_MARKER}.`,
        length: 8,
        answerHash: answerHash(DATE, ANSWER),
        answerCipher: obfuscateAnswer(DATE, ANSWER),
        nextPuzzleAt: Math.floor(Date.parse(`${DATE}T00:00:00Z`) / 1000) + 86400,
        ...overrides,
    };
}

describe('sanitizeChallenge', () => {
    it('accepts a well-formed puzzle', () => {
        const challenge = sanitizeChallenge(payload(), DATE);
        expect(challenge.length).toBe(8);
        expect(challenge.ref).toBe('Lucas 1,77');
        expect(challenge.full).toContain('salvação');
    });

    // The board is drawn from `length`, the win is decided by `answerHash`,
    // and the wrong guesses are scored against `answerCipher`. Nothing forces
    // those three to agree, so the payload has to be checked for it: each of
    // the mismatches below renders a board that cannot be won, and without
    // the check nothing on screen says why.
    it('refuses a cipher that does not decode to the committed answer', () => {
        expect(() => sanitizeChallenge(
            payload({ answerCipher: obfuscateAnswer(DATE, 'PECADORES') }), DATE,
        )).toThrow();
    });

    it('refuses a hash that commits to a different word', () => {
        expect(() => sanitizeChallenge(
            payload({ answerHash: answerHash(DATE, 'PECADORES') }), DATE,
        )).toThrow();
    });

    it('refuses a length that does not match the answer', () => {
        expect(() => sanitizeChallenge(payload({ length: 7 }), DATE)).toThrow();
    });

    it('refuses a cipher keyed to another day', () => {
        // The keystream is derived from the date, so yesterday's cipher
        // decodes to noise rather than to a word.
        expect(() => sanitizeChallenge(
            payload({ answerCipher: obfuscateAnswer('2026-08-07', ANSWER) }), DATE,
        )).toThrow();
    });

    it('measures length against the folded answer, not the accented one', () => {
        // SALVAÇÃO is 8 characters either way, but the board only ever shows
        // the 26 unaccented keys — folding is what the two have to agree on.
        expect(sanitizeChallenge(payload(), DATE).length).toBe(8);
    });

    it('refuses a puzzle for a different date', () => {
        expect(() => sanitizeChallenge(payload(), '2026-08-09')).toThrow();
    });

    it('refuses a verse with no blank to fill', () => {
        expect(() => sanitizeChallenge(
            payload({ verse: 'para dar ao seu povo o conhecimento.' }), DATE,
        )).toThrow();
    });

    it('drops a full text that still carries the marker', () => {
        // That would mean the publisher sent the puzzle text twice. Printing
        // "{{blank}}" at the player is worse than printing nothing.
        const challenge = sanitizeChallenge(
            payload({ full: `conhecimento da ${BLANK_MARKER}.` }), DATE,
        );
        expect(challenge.full).toBeUndefined();
    });
});
