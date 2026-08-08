import { describe, expect, it } from 'vitest';
import {
    answerHash,
    deobfuscateAnswer,
    emojiGrid,
    isSolved,
    keyboardState,
    matchesAnswerHash,
    normalizeWord,
    obfuscateAnswer,
    scoreGuess,
} from './game.ts';
import type { Mark } from './types.ts';

/** Compact spelling for expected rows: c=correct, p=present, a=absent. */
function marks(pattern: string): Mark[] {
    return [...pattern].map((char) =>
        char === 'c' ? 'correct' : char === 'p' ? 'present' : 'absent'
    );
}

describe('normalizeWord', () => {
    it('folds Portuguese diacritics onto the 26 keys the keyboard offers', () => {
        expect(normalizeWord('coração')).toBe('CORACAO');
        expect(normalizeWord('SALVAÇÃO')).toBe('SALVACAO');
        expect(normalizeWord('após')).toBe('APOS');
        expect(normalizeWord('lâmpada')).toBe('LAMPADA');
    });

    it('makes the accented and unaccented spellings the same word', () => {
        expect(normalizeWord('coração')).toBe(normalizeWord('CORACAO'));
    });

    it('drops anything a key could not produce', () => {
        expect(normalizeWord('bem-aventurado 2')).toBe('BEMAVENTURADO');
        expect(normalizeWord('  reino  ')).toBe('REINO');
    });
});

describe('scoreGuess', () => {
    it('marks an exact match all correct', () => {
        expect(scoreGuess('REINO', 'REINO')).toEqual(marks('ccccc'));
    });

    it('marks a letter in the wrong place as present', () => {
        // MONTE holds O, T and M, none where OTIMO puts them; I is absent, and
        // the second O has no unclaimed O left to draw on.
        expect(scoreGuess('OTIMO', 'MONTE')).toEqual(marks('ppapa'));
    });

    // The failure this whole two-pass design exists to prevent.
    it('does not light up more copies of a letter than the answer holds', () => {
        // REINO has exactly one O. The guess offers four, none of them lined
        // up — only the first may go yellow, the rest stay grey.
        expect(scoreGuess('OOOOR', 'REINO')).toEqual(marks('paaap'));
    });

    it('spends the answer letter on the green, leaving the copies grey', () => {
        // ASIDO's single S lines up at index 1. Once it is claimed there is no
        // S left over, so the guess's other two S's cannot go yellow.
        expect(scoreGuess('SSSAL', 'ASIDO')).toEqual(marks('acapa'));
    });

    it('gives greens priority over yellows for a repeated letter', () => {
        // MOODO holds three O's, at indices 1, 2 and 4. The guess's O's at 1
        // and 2 line up and go green; the leading one takes the third O as a
        // yellow. Greens are claimed before any yellow is handed out — score
        // left to right in one pass and the leading O steals a green's letter.
        expect(scoreGuess('OOOSS', 'MOODO')).toEqual(marks('pccaa'));
    });

    it('leaves a repeated guess letter grey once the answer runs out', () => {
        // ABCDE's only E is claimed green at index 4, so neither leading E can
        // go yellow. B, sitting at the wrong index, still can.
        expect(scoreGuess('EEBRE', 'ABCDE')).toEqual(marks('aapac'));
    });

    it('scores accented and unaccented guesses identically', () => {
        expect(scoreGuess('coração', 'CORACAO')).toEqual(marks('ccccccc'));
        expect(scoreGuess('CORACAO', 'coração')).toEqual(marks('ccccccc'));
    });
});

describe('isSolved', () => {
    it('is true only when every position is correct', () => {
        expect(isSolved(marks('ccccc'))).toBe(true);
        expect(isSolved(marks('ccccp'))).toBe(false);
        expect(isSolved([])).toBe(false);
    });
});

describe('keyboardState', () => {
    it('keeps the best mark a letter has ever earned', () => {
        // R is yellow in the first guess and green in the second; the key must
        // not fall back to yellow afterwards.
        const state = keyboardState(['RATOS', 'BARCO'], 'BARCO');
        expect(state.R).toBe('correct');
        expect(state.B).toBe('correct');
        expect(state.T).toBe('absent');
    });

    it('is empty before anything is guessed', () => {
        expect(keyboardState([], 'REINO')).toEqual({});
    });
});

describe('emojiGrid', () => {
    it('renders one line per guess', () => {
        expect(emojiGrid([marks('ccccc'), marks('paaap')])).toBe('🟩🟩🟩🟩🟩\n🟨🟥🟥🟥🟨');
    });

    // Not ⬛/⬜: a black square disappears on a dark background and a white one
    // on a light background, so the same grid reads differently depending on
    // which client opens it.
    it('uses a colour for a miss, so the grid survives any theme', () => {
        expect(emojiGrid([marks('aaa')])).toBe('🟥🟥🟥');
    });
});

describe('the answer in transit', () => {
    it('round-trips through the day cipher', () => {
        const cipher = obfuscateAnswer('2026-08-08', 'PASTOR');
        expect(cipher).not.toContain('PASTOR');
        expect(deobfuscateAnswer('2026-08-08', cipher)).toBe('PASTOR');
    });

    // The reveal shows the real Portuguese spelling, so the accents have to
    // survive the round trip — including through the multi-byte UTF-8 of Ç/Ã.
    it('preserves accents, uppercased, for the reveal', () => {
        expect(deobfuscateAnswer('2026-08-08', obfuscateAnswer('2026-08-08', 'salvação')))
            .toBe('SALVAÇÃO');
        expect(deobfuscateAnswer('2026-08-08', obfuscateAnswer('2026-08-08', 'coração')))
            .toBe('CORAÇÃO');
    });

    it('folds to the keyboard form for scoring', () => {
        const revealed = deobfuscateAnswer('2026-08-08', obfuscateAnswer('2026-08-08', 'salvação'));
        expect(normalizeWord(revealed)).toBe('SALVACAO');
        expect(normalizeWord(revealed)).toHaveLength(8);
    });

    it('keys the cipher to the date, so yesterday cannot decode today', () => {
        const cipher = obfuscateAnswer('2026-08-08', 'PASTOR');
        expect(deobfuscateAnswer('2026-08-09', cipher)).not.toBe('PASTOR');
    });

    it('returns empty rather than throwing on a payload that will not decode', () => {
        expect(deobfuscateAnswer('2026-08-08', 'not base64 !!')).toBe('');
    });

    it('hashes the folded form, so an accented guess still wins', () => {
        const hash = answerHash('2026-08-08', 'salvação');
        expect(matchesAnswerHash('2026-08-08', 'SALVACAO', hash)).toBe(true);
        expect(matchesAnswerHash('2026-08-08', 'salvação', hash)).toBe(true);
    });

    it('confirms a win by hash without carrying the word', () => {
        const hash = answerHash('2026-08-08', 'PASTOR');
        expect(matchesAnswerHash('2026-08-08', 'pastor', hash)).toBe(true);
        expect(matchesAnswerHash('2026-08-08', 'PASTOS', hash)).toBe(false);
        // Same word, different day, different hash.
        expect(matchesAnswerHash('2026-08-09', 'PASTOR', hash)).toBe(false);
    });
});
