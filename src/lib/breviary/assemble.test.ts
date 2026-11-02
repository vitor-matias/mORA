import { describe, expect, it } from 'vitest';
import { assembleHour, complementSeries, withPsalmody, type AssembledHour } from './assemble.ts';
import type { ComumDoc } from './comum.ts';
import type { ProprioEntry } from './proprio.ts';

const hour: AssembledHour = {
    sections: [{
        title: 'Sexta',
        blocks: [
            { kind: 'hino', text: 'Hino' },
            { kind: 'ant', text: 'Salvai, Senhor, a minha alma' },
            { kind: 'salmo', ref: 'Salmo 69 (70)', verses: [] },
            { kind: 'salmo', ref: 'Salmo 84 (85)', verses: [] },
            { kind: 'rubrica', text: 'Para as outras Horas, a Salmodia Complementar, série II e III' },
            { kind: 'leitura', text: 'Não foi Deus quem fez a morte' },
        ],
    }],
};

describe('assembleHour collects', () => {
    const comum: ComumDoc = {
        title: 'OFÍCIO DE DEFUNTOS',
        hours: {
            'Laudes': [
                { kind: 'oração', text: 'Deus, Pai de misericórdia. Por Nosso Senhor.' },
                { kind: 'rubrica', text: 'Ou' },
                { kind: 'oração', text: 'Senhor, glória dos fiéis. Por Nosso Senhor.' },
            ],
            'Tércia': [{ kind: 'leitura', text: 'Eu sei' }],
            'Noa': [{ kind: 'leitura', text: 'O Senhor' }, { kind: 'rubrica', text: 'Oração como nas Laudes.' }],
        },
    };
    const allSouls = {
        day: 2,
        name: 'COMEMORAÇÃO DE TODOS OS FIÉIS DEFUNTOS',
        commons: ['defuntos'],
        hours: { 'Oração': [{ kind: 'oração', text: 'Escutai benignamente. Por Nosso Senhor.' }] },
    } as unknown as ProprioEntry;
    const collects = (a: AssembledHour | null) => a!.sections.flatMap((s) => s.blocks).filter((b) => b.kind === 'oração').map((b) => b.text);

    it('writes the conclusion out: long at Laudes, short at the minor Hours', () => {
        expect(collects(assembleHour(null, comum, 'laudes', null, false))[0]).toMatch(/por todos os séculos dos séculos\.$/);
        expect(collects(assembleHour(null, comum, 'intermedia', 'Tércia', false))).toEqual([
            'Deus, Pai de misericórdia. Por Cristo nosso Senhor.',
            'Senhor, glória dos fiéis. Por Cristo nosso Senhor.',
        ]);
    });

    it('prints the proper collect once, with no leftover pointer or alternatives', () => {
        const noa = assembleHour(allSouls, comum, 'intermedia', 'Noa', false)!;
        expect(noa.sections[0].blocks.map((b) => b.kind)).toEqual(['leitura', 'oração']);
        expect(collects(noa)).toEqual(['Escutai benignamente. Por Cristo nosso Senhor.']);
        expect(collects(assembleHour(allSouls, comum, 'laudes', null, false))).toHaveLength(1);
    });
});

describe('complementSeries', () => {
    it('maps Sexta and Noa to séries II and III, keeping Tércia proper', () => {
        expect(complementSeries(hour, 'Tércia')).toBeNull();
        expect(complementSeries(hour, 'Sexta')).toBe('Série II');
        expect(complementSeries(hour, 'Noa')).toBe('Série III');
    });

    it('offers nothing without the rubric', () => {
        expect(complementSeries({ sections: [{ title: 'Sexta', blocks: [] }] }, 'Sexta')).toBeNull();
    });
});

describe('withPsalmody', () => {
    it('swaps the psalms in place, keeping the antiphon and dropping the rubric', () => {
        const swapped = withPsalmody(hour, [
            { kind: 'ant', n: 1, text: 'Vós que habitais no Céu' },
            { kind: 'salmo', ref: 'Salmo 122 (123)', verses: [] },
            { kind: 'salmo', ref: 'Salmo 123 (124)', verses: [] },
        ]);
        expect(swapped.sections[0].blocks.map((b) => b.ref ?? b.kind)).toEqual([
            'hino', 'ant', 'Salmo 122 (123)', 'Salmo 123 (124)', 'leitura',
        ]);
    });
});
