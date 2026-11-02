import { describe, expect, it } from 'vitest';
import type { PdfLine } from './pdfLines.ts';
import { fixSmallCapsWords, parseCommonsPointer, parseProprio } from './proprio.ts';

describe('parseProprio collect endings', () => {
    const line = (text: string, h = 10, x = 28): PdfLine => ({ p: 1, y: 0, x, h, text, items: [] });
    const collect = 'Deus eterno, ouvi-nos. Por Nosso Senhor.';
    const entry = (...rest: PdfLine[]) => [
        line('2 de Agosto', 10, 130),
        line('SANTO DE TESTE', 10, 90),
        line('Oração', 9, 130),
        line(collect),
        ...rest,
        line('3 de Agosto', 10, 130),
        line('OUTRO SANTO', 10, 90),
    ];

    it.each(['OUTROS HINOS', 'OUTRO HINO', 'OUTROS HiNOS', 'OUTRO HiNO'])('ends the collect at "%s"', (heading) => {
        const [first, second] = parseProprio(entry(line(heading, 9, 120), line('I', 9, 151), line('Rainha dos Anjos pura,', 10, 99)), 'Agosto');
        expect(first.hours).toEqual({ Oração: [{ kind: 'oração', text: collect }] });
        expect(first.bio).toBe('');
        expect(second.name).toBe('OUTRO SANTO');
    });

    it('drops the Completas rubric and picks up at the next hour', () => {
        const [first] = parseProprio(entry(
            line('No fim das Completas, é melhor dizer a antífona Deus Vos salve,', 9, 43),
            line('Rainha dos Céus.', 9),
            line('Laudes', 10, 130),
            line('Ant. Bened. Bendita sejais.', 10, 43),
        ), 'Agosto');
        expect(first.hours).toEqual({
            Oração: [{ kind: 'oração', text: collect }],
            Laudes: [{ kind: 'ant-benedictus', text: 'Bendita sejais.' }],
        });
    });
});

describe('parseCommonsPointer', () => {
    it('maps a single common to its id', () => {
        expect(parseCommonsPointer('Comum dos Pastores')).toEqual(['pastores']);
        expect(parseCommonsPointer('Comum das Virgens')).toEqual(['virgens']);
        expect(parseCommonsPointer('Comum de Nossa Senhora')).toEqual(['nossa-senhora']);
        expect(parseCommonsPointer('Tudo do Comum dos Apóstolos')).toEqual(['apostolos']);
        expect(parseCommonsPointer('Ofício de Defuntos')).toEqual(['defuntos']);
    });

    it('keeps "ou" alternatives in the order the entry offers them', () => {
        expect(parseCommonsPointer('Comum dos Pastores ou dos Doutores da Igreja')).toEqual(['pastores', 'doutores']);
        expect(parseCommonsPointer('Comum dos Doutores da Igreja ou dos Pastores')).toEqual(['doutores', 'pastores']);
    });

    it('does not read "Vários Mártires" as the single-martyr common', () => {
        expect(parseCommonsPointer('Comum de Vários Mártires')).toEqual(['varios-martires']);
    });

    it('matches the single-martyr common', () => {
        expect(parseCommonsPointer('Comum de Um Mártir')).toEqual(['um-martir']);
    });

    it('distinguishes Santas from Santos', () => {
        expect(parseCommonsPointer('Comum das Santas Mulheres')).toEqual(['santas']);
        expect(parseCommonsPointer('Comum dos Santos (Religiosos)')).toEqual(['santos']);
    });

    it('returns no ids for text without a common', () => {
        expect(parseCommonsPointer('Como na festa de S. Marcos, dia 25 de Abril, excepto:')).toEqual([]);
    });
});

describe('fixSmallCapsWords', () => {
    it('uppercases words where small-caps glyphs extracted as lowercase', () => {
        expect(fixSmallCapsWords('EyMARD')).toBe('EYMARD');
        expect(fixSmallCapsWords('CRUz')).toBe('CRUZ');
        expect(fixSmallCapsWords('lURDES')).toBe('LURDES');
    });

    it('handles an accented lowercase glyph', () => {
        expect(fixSmallCapsWords('áGUEDA')).toBe('ÁGUEDA');
    });

    it('fixes only the damaged word inside a full name', () => {
        expect(fixSmallCapsWords('S. PEDRO JULIÃO EyMARD')).toBe('S. PEDRO JULIÃO EYMARD');
    });

    it('leaves connectives and normally-capitalised words alone', () => {
        expect(fixSmallCapsWords('NOSSA SENHORA DE LURDES')).toBe('NOSSA SENHORA DE LURDES');
        expect(fixSmallCapsWords('S. CIRILO, monge, e S. METÓDIO, bispo')).toBe('S. CIRILO, monge, e S. METÓDIO, bispo');
        expect(fixSmallCapsWords('Santa Maria de Jesus')).toBe('Santa Maria de Jesus');
    });
});
