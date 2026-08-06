import { describe, expect, it } from 'vitest';
import { assembleHour, mergeComumOverlay, saintsForDay, hasRenderableOffice } from './assemble.ts';
import type { ComumDoc } from './comum.ts';
import type { ProprioEntry } from './proprio.ts';

function entry(over: Partial<ProprioEntry>): ProprioEntry {
    return {
        day: 1, name: 'S. TESTE', descriptor: null, rank: 'Memória',
        commons: ['pastores'], bio: '', hours: {}, ...over,
    };
}

const comum: ComumDoc = {
    title: 'COMUM DE TESTE',
    hours: {
        'Invitatório': [{ kind: 'ant', text: 'Vinde, adoremos (T. P. Aleluia).' }],
        'Laudes': [
            { kind: 'hino', text: 'Hino do comum' },
            { kind: 'rubrica', text: 'Salmos e cântico do Domingo I.' },
            { kind: 'leitura', ref: 'Rom 1, 1', text: 'Leitura fora', season: 'Fora do Tempo Pascal' },
            { kind: 'leitura', ref: 'Ap 1, 1', text: 'Leitura pascal', season: 'Tempo Pascal' },
            { kind: 'responsório', text: 'V. Refrão.\nR. Refrão. Aleluia, Aleluia.', season: 'Fora do Tempo Pascal' },
            { kind: 'ant-benedictus', text: 'Ant do comum' },
            { kind: 'rubrica', text: 'Oração própria. Na sua falta, uma das seguintes:' },
            { kind: 'oração', text: 'Colecta do comum' },
            { kind: 'rubrica', text: 'Ou' },
            { kind: 'oração', text: 'Colecta alternativa' },
        ],
        'Hora Intermédia': [
            { kind: 'ant', variant: 'Tércia', text: 'Ant de Tércia' },
            { kind: 'ant', variant: 'Sexta', text: 'Ant de Sexta' },
        ],
        'Tércia': [{ kind: 'leitura', text: 'Leitura de Tércia' }],
        'Vésperas II': [
            { kind: 'hino', text: 'Hino vespertino' },
            { kind: 'ant-magnificat', text: 'Magnificat do comum' },
            { kind: 'oração', text: 'Colecta do comum' },
        ],
    },
};

describe('assembleHour', () => {
    it('keeps Ofício de Leitura and Completas on the ferial office', () => {
        expect(assembleHour(null, comum, 'oficio', null, false)).toBeNull();
        expect(assembleHour(null, comum, 'completas', null, false)).toBeNull();
    });

    it('filters seasonal alternatives by the day', () => {
        const fora = assembleHour(null, comum, 'laudes', null, false)!;
        const texts = fora.sections.flatMap(s => s.blocks).map(b => b.text);
        expect(texts).toContain('Leitura fora');
        expect(texts).not.toContain('Leitura pascal');
        const pascal = assembleHour(null, comum, 'laudes', null, true)!;
        const pTexts = pascal.sections.flatMap(s => s.blocks).map(b => b.text);
        expect(pTexts).toContain('Leitura pascal');
        expect(pTexts).not.toContain('Leitura fora');
    });

    it('resolves the "(T. P. Aleluia)" mark by season', () => {
        const inv = (pascal: boolean) =>
            assembleHour(null, comum, 'laudes', null, pascal)!.sections[0].blocks[0].text;
        expect(inv(false)).toBe('Vinde, adoremos.');
        expect(inv(true)).toBe('Vinde, adoremos, aleluia.');
    });

    it('strips the source-erratum Aleluia from the non-Paschal responsory', () => {
        const laudes = assembleHour(null, comum, 'laudes', null, false)!;
        const resp = laudes.sections[1].blocks.find(b => b.kind === 'responsório')!;
        expect(resp.text).toBe('V. Refrão.\nR. Refrão.');
    });

    it('overlays the proper collect, drops the fulfilled rubric and the fallback tail', () => {
        const saint = entry({ hours: { 'Oração': [{ kind: 'oração', text: 'Colecta própria' }] } });
        const laudes = assembleHour(saint, comum, 'laudes', null, false)!.sections[1].blocks;
        const kinds = laudes.map(b => `${b.kind}:${b.text}`);
        expect(kinds).toContain('oração:Colecta própria');
        expect(laudes.some(b => /^Oração própria/.test(b.text ?? ''))).toBe(false);
        expect(laudes.at(-1)!.text).toBe('Colecta própria');
        expect(kinds).not.toContain('oração:Colecta do comum');
    });

    it('replaces the gospel-canticle antiphon with the proper one', () => {
        const saint = entry({ hours: { 'Laudes': [{ kind: 'ant-benedictus', text: 'Ant própria' }] } });
        const laudes = assembleHour(saint, comum, 'laudes', null, false)!.sections[1].blocks;
        expect(laudes.filter(b => b.kind === 'ant-benedictus').map(b => b.text)).toEqual(['Ant própria']);
    });

    it('ignores printed-book pointer rubrics from the proper', () => {
        const saint = entry({
            hours: { 'Laudes': [{ kind: 'rubrica', text: 'Preces do Comum dos Apóstolos: p. 1887.' }] },
        });
        const laudes = assembleHour(saint, comum, 'laudes', null, false)!.sections[1].blocks;
        // The common's real rubric survives; the pointer never enters.
        expect(laudes.some(b => b.text === 'Salmos e cântico do Domingo I.')).toBe(true);
        expect(laudes.some(b => /p\.\s*1887/.test(b.text ?? ''))).toBe(false);
    });

    it('collapses the Hora Intermédia to the chosen sub-hour', () => {
        const hi = assembleHour(null, comum, 'intermedia', 'Tércia', false)!.sections[0].blocks;
        expect(hi.map(b => b.text)).toEqual(['Ant de Tércia', 'Leitura de Tércia']);
        expect(hi[0].variant).toBeUndefined();
    });

    it('uses Vésperas II as the day Vespers', () => {
        const v = assembleHour(null, comum, 'vesperas', null, false)!.sections[0].blocks;
        expect(v[0].text).toBe('Hino vespertino');
    });
});

describe('mergeComumOverlay', () => {
    it('replaces kind-mates per hour and keeps titles', () => {
        const base: ComumDoc = {
            title: 'BASE', subtitle: 'I — BASE',
            hours: { 'Laudes': [{ kind: 'hino', text: 'Hino base' }, { kind: 'oração', text: 'Colecta base' }] },
        };
        const over: ComumDoc = {
            title: 'SOBRE', note: 'Como no Comum base, excepto:',
            hours: { 'Laudes': [{ kind: 'oração', text: 'Colecta própria' }] },
        };
        const merged = mergeComumOverlay(base, over);
        expect(merged.title).toBe('SOBRE');
        expect(merged.subtitle).toBe('I — BASE');
        expect(merged.note).toBeUndefined();
        expect(merged.hours['Laudes'].map(b => b.text)).toEqual(['Hino base', 'Colecta própria']);
    });
});

describe('entry helpers', () => {
    it('selects saints of a day and detects book-only entries', () => {
        const a = entry({ day: 2 });
        const bookOnly = entry({ day: 2, commons: [], hours: {}, note: 'Apêndice VI, p. 2079.' });
        expect(saintsForDay([a, entry({ day: 3 }), bookOnly], 2)).toEqual([a, bookOnly]);
        expect(hasRenderableOffice(a)).toBe(true);
        expect(hasRenderableOffice(bookOnly)).toBe(false);
    });
});
