import { describe, expect, it } from 'vitest';
import { splitVersicle, withVersicleGlyphs } from './versicles';

describe('splitVersicle', () => {
    it('recognises the versicle and the response at the start of a line', () => {
        expect(splitVersicle('V. Rogai por nós, santa Mãe de Deus.')).toEqual({
            mark: 'V',
            rest: 'Rogai por nós, santa Mãe de Deus.',
        });
        expect(splitVersicle('R. Amen.')).toEqual({ mark: 'R', rest: 'Amen.' });
    });

    it('leaves every other line alone', () => {
        // A capital at the start of a sentence, or a "V." inside the line, is
        // not a marker.
        for (const line of ['Vinde, ó Espírito Santo,', 'Rainha do Céu, alegrai-Vos, aleluia.', 'ver V. abaixo', '']) {
            expect(splitVersicle(line)).toEqual({ mark: null, rest: line });
        }
    });
});

describe('withVersicleGlyphs', () => {
    it('swaps the markers for the glyphs and keeps the rest of the text', () => {
        const text = 'V. O Anjo do Senhor anunciou a Maria.\nR. E Ela concebeu do Espírito Santo.\n\nAvé Maria…';
        expect(withVersicleGlyphs(text)).toBe(
            '℣ O Anjo do Senhor anunciou a Maria.\n℟ E Ela concebeu do Espírito Santo.\n\nAvé Maria…',
        );
    });
});
