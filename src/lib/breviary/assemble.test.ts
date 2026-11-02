import { describe, expect, it } from 'vitest';
import { assembleHour, complementSeries, withPsalmody, type AssembledHour } from './assemble.ts';
import type { ProprioBlock, ProprioEntry } from './proprio.ts';

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

describe('a proper "Oração como nas Laudes" pointer', () => {
    const entry = (hours: Record<string, ProprioBlock[]>): ProprioEntry => ({
        day: 1, name: 'SANTO', descriptor: null, rank: 'Festa', commons: [], bio: '', hours,
    });
    const pointer = { kind: 'rubrica', text: 'Oração como nas laudes.' };
    const comum = {
        title: 'Comum',
        hours: {
            'Hora Intermédia': [
                { kind: 'rubrica', text: 'Para as outras Horas, a Salmodia Complementar, série II e III' },
                { kind: 'leitura', text: 'Leitura do Comum' },
            ],
            Laudes: [{ kind: 'oração', text: 'Coleta do Comum' }],
        },
    };
    const texts = (hour: AssembledHour | null) => hour?.sections[0].blocks.map((b) => b.text);

    it('gives way to the collect, keeping the rubrics of the common', () => {
        const hours = { 'Hora Intermédia': [pointer], Oração: [{ kind: 'oração', text: 'Coleta própria' }] };
        expect(texts(assembleHour(entry(hours), comum, 'intermedia', 'Sexta', false))).toEqual([
            'Para as outras Horas, a Salmodia Complementar, série II e III',
            'Leitura do Comum',
            'Coleta própria',
        ]);
    });

    it('resolves to the Laudes collect when the entry has none', () => {
        expect(texts(assembleHour(entry({ 'Hora Intermédia': [pointer] }), comum, 'intermedia', 'Sexta', false))).toEqual([
            'Para as outras Horas, a Salmodia Complementar, série II e III',
            'Leitura do Comum',
            'Coleta do Comum',
        ]);
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
