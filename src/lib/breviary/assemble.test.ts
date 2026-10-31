import { describe, expect, it } from 'vitest';
import { complementSeries, withPsalmody, type AssembledHour } from './assemble.ts';

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
