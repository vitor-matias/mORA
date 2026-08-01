import { describe, expect, it } from 'vitest';
import { fixSmallCapsWords, parseCommonsPointer } from './proprio.ts';

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
