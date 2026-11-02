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

describe('a proper invitatory', () => {
    it('replaces the common\'s, alternatives and all', () => {
        const entry: ProprioEntry = {
            day: 15, name: 'SANTA', descriptor: null, rank: 'Memória', commons: [], bio: '',
            hours: { Invitatório: [{ kind: 'ant', text: 'Antífona própria.' }] },
        };
        const comum = {
            title: 'Comum',
            hours: {
                Invitatório: [
                    { kind: 'ant', text: 'Primeira do Comum.' },
                    { kind: 'rubrica', text: 'Ou' },
                    { kind: 'ant', text: 'Segunda do Comum.' },
                    { kind: 'rubrica', text: 'Salmo invitatório.' },
                ],
            },
        };
        expect(assembleHour(entry, comum, 'laudes', null, false)?.sections[0]).toEqual({
            title: 'Invitatório',
            blocks: [expect.objectContaining({ kind: 'ant', text: 'Antífona própria.' })],
        });
    });
});

describe('a proper psalmody pointer', () => {
    const salmodia = (pointer: string): ProprioBlock => ({
        kind: 'salmodia',
        text: `${pointer} Ant. 1 Primeira própria. Ant. 2 Segunda própria.`,
    });
    const entry = (hours: Record<string, ProprioBlock[]>): ProprioEntry => ({
        day: 15, name: 'SANTA', descriptor: null, rank: 'Memória', commons: [], bio: '', hours,
    });

    it('puts its antiphons in the common\'s Laudes, keeping the common\'s pointer', () => {
        const comum = {
            title: 'Comum',
            hours: {
                Laudes: [
                    { kind: 'rubrica', text: 'Salmos e cântico do Domingo I.' },
                    { kind: 'ant', n: 1, text: 'Primeira do Comum.' },
                    { kind: 'ant', n: 2, text: 'Segunda do Comum.' },
                    { kind: 'ant', n: 3, text: 'Terceira do Comum.' },
                    { kind: 'rubrica', text: 'Ou' },
                ],
            },
        };
        const proper = entry({ Laudes: [salmodia('Salmos e cântico do Domingo I.')] });
        expect(assembleHour(proper, comum, 'laudes', null, false)?.sections[0].blocks).toEqual([
            expect.objectContaining({ kind: 'rubrica', text: 'Salmos e cântico do Domingo I.' }),
            expect.objectContaining({ kind: 'ant', n: 1, text: 'Primeira própria.' }),
            expect.objectContaining({ kind: 'ant', n: 2, text: 'Segunda própria.' }),
            // An antiphon the entry doesn't give stays the common's.
            expect.objectContaining({ kind: 'ant', n: 3, text: 'Terceira do Comum.' }),
            expect.objectContaining({ kind: 'rubrica', text: 'Ou' }),
        ]);
    });

    it('keeps the common\'s pointer when the entry prints another rubric', () => {
        const comum = {
            title: 'Comum',
            hours: {
                Laudes: [
                    { kind: 'rubrica', text: 'Salmos e cântico do Domingo I.' },
                    { kind: 'ant', n: 1, text: 'Primeira do Comum.' },
                    { kind: 'rubrica', text: 'Ou' },
                ],
            },
        };
        const proper = entry({
            Laudes: [salmodia('Salmos e cântico do Domingo I: p. 879.'), { kind: 'rubrica', text: 'Preces do Comum: p. 1887.' }],
        });
        expect(assembleHour(proper, comum, 'laudes', null, false)?.sections[0].blocks).toEqual([
            expect.objectContaining({ kind: 'rubrica', text: 'Salmos e cântico do Domingo I.' }),
            expect.objectContaining({ kind: 'ant', n: 1, text: 'Primeira própria.' }),
            expect.objectContaining({ kind: 'rubrica', text: 'Preces do Comum: p. 1887.' }),
        ]);
    });

    it('repeats its antiphons after the common\'s Vespers psalms and drops the pointer', () => {
        const comum = {
            title: 'Comum',
            hours: {
                'Vésperas II': [
                    { kind: 'ant', n: 1, text: 'Primeira do Comum.' },
                    { kind: 'salmo', ref: 'Salmo 121' },
                    { kind: 'ant', text: 'Primeira do Comum.' },
                    { kind: 'ant', n: 2, text: 'Segunda do Comum.' },
                    { kind: 'salmo', ref: 'Salmo 126' },
                    { kind: 'ant', n: 2, text: 'Segunda do Comum.' },
                ],
            },
        };
        const proper = entry({ Vésperas: [salmodia('Salmos e cântico do Comum.')] });
        expect(assembleHour(proper, comum, 'vesperas', null, false)?.sections[0].blocks).toEqual([
            expect.objectContaining({ kind: 'ant', n: 1, text: 'Primeira própria.' }),
            expect.objectContaining({ kind: 'salmo', ref: 'Salmo 121' }),
            expect.objectContaining({ kind: 'ant', text: 'Primeira própria.' }),
            expect.objectContaining({ kind: 'ant', n: 2, text: 'Segunda própria.' }),
            expect.objectContaining({ kind: 'salmo', ref: 'Salmo 126' }),
            expect.objectContaining({ kind: 'ant', n: 2, text: 'Segunda própria.' }),
        ]);
    });

    it('stands where printed when there is no common', () => {
        const proper = entry({
            Laudes: [
                { kind: 'hino', text: 'Hino' },
                salmodia('Salmo e cântico do Domingo I.'),
                { kind: 'leitura breve', text: 'Leitura' },
            ],
        });
        expect(assembleHour(proper, null, 'laudes', null, false)?.sections[0].blocks).toEqual([
            expect.objectContaining({ kind: 'hino' }),
            expect.objectContaining({ kind: 'rubrica', text: 'Salmo e cântico do Domingo I.' }),
            expect.objectContaining({ kind: 'ant', n: 1, text: 'Primeira própria.' }),
            expect.objectContaining({ kind: 'ant', n: 2, text: 'Segunda própria.' }),
            expect.objectContaining({ kind: 'leitura' }),
        ]);
    });

    it('leaves a psalmody printed in full whole', () => {
        const text = 'Ant. 1 Própria. Salmo 140 Senhor, a Vós clamo. Ant. Própria.';
        const proper = entry({ Vésperas: [{ kind: 'salmodia', text }] });
        expect(assembleHour(proper, null, 'vesperas', null, false)?.sections[0].blocks).toEqual([
            expect.objectContaining({ kind: 'salmodia', text }),
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
