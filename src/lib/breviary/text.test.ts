import { describe, expect, it } from 'vitest';
import {
    afterDespaced,
    assembleHymn,
    despace,
    joinLines,
    joinProse,
    joinVerse,
    prettifyRef,
    splitColumns,
    type HymnLine,
    type VerseLine,
} from './text.ts';

describe('despace', () => {
    it('lowercases and strips all whitespace, matching kerning-fragmented labels', () => {
        expect(despace('L E I T U R A  B R E V E')).toBe('leiturabreve');
        expect(despace('Responsório breve')).toBe('responsóriobreve');
    });

    it('collapses tabs and newlines too', () => {
        expect(despace('H I\tN\nO')).toBe('hino');
    });
});

describe('afterDespaced', () => {
    it('skips the first n non-space characters and trims the rest', () => {
        expect(afterDespaced('H I N O Hebr13,7-9a', 4)).toBe('Hebr13,7-9a');
    });

    it('keeps a colon left behind by an unfragmented label (prettifyRef strips it)', () => {
        expect(afterDespaced('Hino: Hebr13,7-9a', 4)).toBe(': Hebr13,7-9a');
    });

    it('returns empty when the label is the whole line', () => {
        expect(afterDespaced('L E I T U R A B R E V E', 12)).toBe('');
    });

    it('returns empty when n exceeds the non-space characters', () => {
        expect(afterDespaced('abc', 10)).toBe('');
    });
});

describe('joinProse', () => {
    it('joins wrapped lines with single spaces, trimming each', () => {
        expect(joinProse(['  Nasceu em Lisboa ', 'no ano de 1195.'])).toBe('Nasceu em Lisboa no ano de 1195.');
    });

    it('repairs end-of-line hyphenation', () => {
        expect(joinProse(['Entrou na Ordem dos Prega-', 'dores em 1220.'])).toBe('Entrou na Ordem dos Pregadores em 1220.');
    });

    it('repairs hyphenation after an accented letter', () => {
        expect(joinProse(['viveu em vá-', 'rios mosteiros'])).toBe('viveu em vários mosteiros');
    });

    it('keeps a dash that does not follow a letter', () => {
        expect(joinProse(['morreu em 1231 -', 'diz a tradição'])).toBe('morreu em 1231 - diz a tradição');
    });

    it('skips blank lines', () => {
        expect(joinProse(['Primeira', '', '   ', 'segunda'])).toBe('Primeira segunda');
        expect(joinProse([])).toBe('');
    });
});

describe('joinVerse', () => {
    const line = (t: string, cont = false): VerseLine => ({ t, cont });

    it('keeps one line per verse', () => {
        expect(joinVerse([line('Vinde, Espírito criador,'), line('visitai as nossas almas.')])).toBe(
            'Vinde, Espírito criador,\nvisitai as nossas almas.'
        );
    });

    it('merges indented continuations into the previous verse with a space', () => {
        expect(joinVerse([line('R. Os seus amigos'), line('o escutam.', true)])).toBe('R. Os seus amigos o escutam.');
    });

    it('merges a mid-word wrap even when the line is not marked as continuation', () => {
        expect(joinVerse([line('Ficai connos-'), line('co, Senhor.')])).toBe('Ficai connosco, Senhor.');
    });

    it('joins without a space when a continuation follows a hyphen wrap', () => {
        expect(joinVerse([line('Ficai connos-'), line('co, Senhor.', true)])).toBe('Ficai connosco, Senhor.');
    });

    it('keeps a leading continuation line as its own verse', () => {
        expect(joinVerse([line('órfã de anterior', true)])).toBe('órfã de anterior');
    });
});

describe('joinLines', () => {
    it('is joinVerse over plain strings: one line each, hyphen wraps merged', () => {
        expect(joinLines(['Glória ao Pai e ao Fi-', 'lho', 'e ao Espírito Santo.'])).toBe(
            'Glória ao Pai e ao Filho\ne ao Espírito Santo.'
        );
    });
});

describe('assembleHymn', () => {
    const l = (p: number, y: number, x: number, t: string): HymnLine => ({ p, y, x, t });

    it('reads two-column stanza bands row-wise: left, its right neighbour, next band', () => {
        // Two bands of two stanzas each, lines interleaved in extraction
        // order (down the page, left run before right run).
        const lines = [
            l(1, 700, 72, 'A1'), l(1, 700, 152, 'B1'),
            l(1, 688, 72, 'A2'), l(1, 688, 152, 'B2'),
            l(1, 676, 72, 'A3'), l(1, 676, 152, 'B3'),
            l(1, 650, 72, 'C1'), l(1, 650, 152, 'D1'),
            l(1, 638, 72, 'C2'), l(1, 638, 152, 'D2'),
        ];
        expect(assembleHymn(lines)).toBe('A1\nA2\nA3\n\nB1\nB2\nB3\n\nC1\nC2\n\nD1\nD2');
    });

    it('places a full-width tail stanza after both columns of the band above', () => {
        const lines = [
            l(1, 700, 72, 'A1'), l(1, 700, 152, 'B1'),
            l(1, 688, 72, 'A2'), l(1, 688, 152, 'B2'),
            l(1, 650, 72, 'Amen.'),
        ];
        expect(assembleHymn(lines)).toBe('A1\nA2\n\nB1\nB2\n\nAmen.');
    });

    it('treats a slightly lower right column as the same band (offset < stanza gap)', () => {
        const lines = [
            l(1, 700, 72, 'L1'), l(1, 695, 152, 'R1'),
            l(1, 688, 72, 'L2'), l(1, 683, 152, 'R2'),
        ];
        expect(assembleHymn(lines)).toBe('L1\nL2\n\nR1\nR2');
    });

    it('splits single-column stanzas on the vertical gap', () => {
        const lines = [
            l(1, 700, 72, 'A1'), l(1, 688, 72, 'A2'),
            l(1, 660, 72, 'B1'), l(1, 648, 72, 'B2'),
        ];
        expect(assembleHymn(lines)).toBe('A1\nA2\n\nB1\nB2');
    });

    it('starts a new stanza at a page break even though y jumps back up', () => {
        const lines = [
            l(1, 80, 72, 'A1'), l(1, 68, 72, 'A2'),
            l(2, 700, 72, 'B1'), l(2, 688, 72, 'B2'),
        ];
        expect(assembleHymn(lines)).toBe('A1\nA2\n\nB1\nB2');
    });

    it('repairs hyphen wraps inside a stanza', () => {
        const lines = [
            l(1, 700, 72, 'Vinde, Espírito cria-'),
            l(1, 688, 72, 'dor, visitai'),
        ];
        expect(assembleHymn(lines)).toBe('Vinde, Espírito criador, visitai');
    });
});

describe('splitColumns', () => {
    it('splits at a run past x=120 with a real gap before it', () => {
        expect(splitColumns([
            { x: 72, w: 60, s: 'Vinde, Senhor' },
            { x: 152, w: 58, s: 'Glória ao Pai' },
        ])).toEqual({ left: 'Vinde, Senhor', right: 'Glória ao Pai', rightX: 152 });
    });

    it('keeps a butt-joined continuation run past x=120 in the left column', () => {
        // A long left verse whose next run starts past the column threshold
        // but with (almost) no gap — the gap > 5 guard keeps it whole.
        expect(splitColumns([
            { x: 72, w: 50, s: 'Um verso comprido que' },
            { x: 124, w: 30, s: 'continua' },
        ])).toEqual({ left: 'Um verso comprido que continua', right: null, rightX: 0 });
    });

    it('does not split on a gap of exactly 5', () => {
        expect(splitColumns([
            { x: 72, w: 48, s: 'a' },
            { x: 125, w: 10, s: 'b' },
        ])).toEqual({ left: 'a b', right: null, rightX: 0 });
    });

    it('ignores wide gaps that stay left of x=120', () => {
        expect(splitColumns([
            { x: 60, w: 10, s: 'V.' },
            { x: 90, w: 40, s: 'Louvai o Senhor' },
        ])).toEqual({ left: 'V. Louvai o Senhor', right: null, rightX: 0 });
    });

    it('joins multiple right-column runs after the split', () => {
        expect(splitColumns([
            { x: 72, w: 30, s: 'Amen.' },
            { x: 152, w: 20, s: 'Glória' },
            { x: 174, w: 30, s: 'ao Pai' },
        ])).toEqual({ left: 'Amen.', right: 'Glória ao Pai', rightX: 152 });
    });

    it('butt-joins runs closer than 1pt without a space', () => {
        expect(splitColumns([
            { x: 72, w: 30, s: 'connos' },
            { x: 102.5, w: 12, s: 'co' },
        ])).toEqual({ left: 'connosco', right: null, rightX: 0 });
    });

    it('returns a single run as the left column', () => {
        expect(splitColumns([{ x: 72, w: 40, s: 'Só um' }])).toEqual({ left: 'Só um', right: null, rightX: 0 });
    });
});

describe('prettifyRef', () => {
    it('restores the spaces tight kerning removed', () => {
        expect(prettifyRef('Hebr13,7-9a')).toBe('Hebr 13, 7-9a');
    });

    it('drops the colon a "Hino:" label leaves behind', () => {
        expect(prettifyRef(': Hebr13,7-9a')).toBe('Hebr 13, 7-9a');
    });

    it('leaves an already-spaced ref alone', () => {
        expect(prettifyRef('Hebr 13, 7-9a')).toBe('Hebr 13, 7-9a');
    });

    it('handles book names with a leading number and uppercase letters', () => {
        expect(prettifyRef('1Tes2,13')).toBe('1Tes 2, 13');
        expect(prettifyRef('FILIP4,4-9')).toBe('FILIP 4, 4-9');
    });
});
