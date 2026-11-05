import { describe, expect, it } from 'vitest';
import { officeTypography } from './officeTypography';

const NBSP = ' ';

describe('officeTypography', () => {
    it('ties the mediant and the flexa to the word before them', () => {
        expect(officeTypography('<p>Vós sois o meu refúgio. *<br>\nmeu Deus, †<br>\nbem.</p>'))
            .toBe(`<p>Vós sois o meu refúgio.${NBSP}*<br>\nmeu Deus,${NBSP}†<br>\nbem.</p>`);
        // Ours wrap the mark in a rubric span.
        expect(officeTypography('Senhor <span class="rubric">*</span> tende'))
            .toBe(`Senhor${NBSP}<span class="rubric">*</span> tende`);
    });

    it('keeps antiphon and psalm numbers with their label', () => {
        expect(officeTypography('<p><span class="rubric">Ant. 1</span> Texto</p>'))
            .toBe(`<p class="antiphon"><span class="rubric">Ant.${NBSP}1</span> Texto</p>`);
        expect(officeTypography('<strong>Sl 118, 1-8</strong> e Salmo 15 (16)'))
            .toBe(`<strong>Sl${NBSP}118, 1-8</strong> e Salmo${NBSP}15 (16)`);
    });

    it('classes the antiphon paragraph whether or not it is numbered', () => {
        expect(officeTypography('<p><span style="color: #ff0000;">Ant.</span> O meu corpo</p>'))
            .toBe('<p class="antiphon"><span style="color: #ff0000;">Ant.</span> O meu corpo</p>');
    });

    it('leaves prose alone', () => {
        const prose = '<p>Irmãos: 2 vezes disse que a Lei é santa.</p>';
        expect(officeTypography(prose)).toBe(prose);
    });
});
