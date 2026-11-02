import { describe, expect, it } from 'vitest';
import { assembleHour, complementSeries, psalmsCommonId, withPsalmody, type AssembledHour } from './assemble.ts';
import type { ComumDoc } from './comum.ts';
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

describe('an "Ou" in the common', () => {
    const ou = { kind: 'rubrica', text: 'Ou' };
    const comum = {
        title: 'Comum',
        hours: {
            'Vésperas II': [
                { kind: 'ant-magnificat', text: 'Primeira do Comum.' },
                ou,
                { kind: 'ant-magnificat', text: 'Segunda do Comum.' },
                { kind: 'preces', text: 'Preces do Comum.' },
                ou,
                { kind: 'preces', text: 'Outras preces do Comum.' },
            ],
        },
    };
    const texts = (hours: Record<string, ProprioBlock[]>) => assembleHour(
        { day: 15, name: 'SANTA', descriptor: null, rank: 'Memória', commons: [], bio: '', hours },
        comum, 'vesperas', null, false
    )?.sections[0].blocks.map((b) => b.text);

    it('goes when the entry replaces its alternatives', () => {
        expect(texts({ Vésperas: [{ kind: 'ant-magnificat', text: 'Própria.' }] })).toEqual([
            'Própria.', 'Preces do Comum.', 'Ou', 'Outras preces do Comum.',
        ]);
    });

    it('stays while they stand', () => {
        expect(texts({ Vésperas: [{ kind: 'preces', text: 'Preces próprias.' }] })).toEqual([
            'Primeira do Comum.', 'Ou', 'Segunda do Comum.', 'Preces próprias.',
        ]);
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

    it('keeps the common\'s pointer when the entry prints it with a page number', () => {
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
        const proper = entry({ Laudes: [salmodia('Salmos e cântico do Domingo I: p. 879.')] });
        expect(assembleHour(proper, comum, 'laudes', null, false)?.sections[0].blocks).toEqual([
            expect.objectContaining({ kind: 'rubrica', text: 'Salmos e cântico do Domingo I.' }),
            expect.objectContaining({ kind: 'ant', n: 1, text: 'Primeira própria.' }),
            expect.objectContaining({ kind: 'rubrica', text: 'Ou' }),
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

describe('a Vespers psalmody pointing at a common the entry does not have', () => {
    const entry = (commons: string[], text: string): ProprioEntry => ({
        day: 25, name: 'SANTO', descriptor: null, rank: 'Festa', commons, bio: '',
        hours: {
            Vésperas: [
                { kind: 'hino', text: 'Hino próprio' },
                { kind: 'salmodia', text: `${text} Ant. 1 Primeira própria. Ant. 2 Segunda própria.` },
                { kind: 'leitura breve', text: 'Leitura própria' },
            ],
        },
    });
    const apostolos = {
        title: 'Comum dos Apóstolos',
        hours: {
            'Vésperas II': [
                { kind: 'hino', text: 'Hino do Comum' },
                { kind: 'ant', n: 1, text: 'Primeira do Comum.' },
                { kind: 'salmo', ref: 'Salmo 115' },
                { kind: 'ant', text: 'Primeira do Comum.' },
                { kind: 'ant', n: 2, text: 'Segunda do Comum.' },
                { kind: 'salmo', ref: 'Salmo 125' },
                { kind: 'ant', text: 'Segunda do Comum.' },
                { kind: 'leitura', text: 'Leitura do Comum' },
                { kind: 'preces', text: 'Preces do Comum' },
            ],
        },
    };
    const pointer = 'Salmos e cântico do Comum dos Apóstolos, p. 1890.';

    it('names the common only when the entry has none', () => {
        expect(psalmsCommonId(entry([], pointer))).toBe('apostolos');
        expect(psalmsCommonId(entry([], 'Salmo e cântico do Comum de N. Senhora.'))).toBe('nossa-senhora');
        expect(psalmsCommonId(entry(['apostolos'], pointer))).toBeNull();
        expect(psalmsCommonId(entry([], 'Salmos e cântico do Domingo I.'))).toBeNull();
    });

    it('takes only the psalms of that common, under the entry\'s antiphons', () => {
        const blocks = assembleHour(entry([], pointer), null, 'vesperas', null, false, apostolos)?.sections[0].blocks;
        expect(blocks?.map((b) => b.text ?? b.ref)).toEqual([
            'Hino próprio',
            'Primeira própria.', 'Salmo 115', 'Primeira própria.',
            'Segunda própria.', 'Salmo 125', 'Segunda própria.',
            'Leitura própria',
        ]);
    });

    it('falls back to the pointer when that common is not at hand', () => {
        const blocks = assembleHour(entry([], pointer), null, 'vesperas', null, false)?.sections[0].blocks;
        expect(blocks?.map((b) => b.text)).toEqual([
            'Hino próprio', pointer, 'Primeira própria.', 'Segunda própria.', 'Leitura própria',
        ]);
    });
});

describe('an entry printing both Vespers', () => {
    const entry = (second: ProprioBlock[]): ProprioEntry => ({
        day: 15, name: 'SANTA', descriptor: null, rank: 'Solenidade', commons: [], bio: '',
        hours: {
            'Vésperas I': [{ kind: 'hino', text: 'Hino de I' }, { kind: 'preces', text: 'Preces de I' }],
            Oração: [{ kind: 'oração', text: 'Coleta de I' }, { kind: 'oração', text: 'Coleta do dia' }],
            'Vésperas II': second,
        },
    });
    const texts = (proper: ProprioEntry, comum: ComumDoc | null = null) =>
        assembleHour(proper, null, 'vesperas', null, false, comum)?.sections[0].blocks.map((b) => b.text ?? b.ref);

    it('prays the second, with the last collect printed', () => {
        const proper = entry([{ kind: 'hino', text: 'Hino de II' }, { kind: 'preces', text: 'Preces de II' }]);
        expect(texts(proper)).toEqual(['Hino de II', 'Preces de II', 'Coleta do dia']);
    });

    it('takes the hymn of the first when the second has none', () => {
        expect(texts(entry([{ kind: 'preces', text: 'Preces de II' }]))).toEqual(['Hino de I', 'Preces de II', 'Coleta do dia']);
    });

    it('prays the day\'s collect at the other hours too', () => {
        const proper = entry([]);
        for (const [hour, sub] of [['laudes', null], ['intermedia', 'Sexta']] as const) {
            expect(assembleHour(proper, null, hour, sub, false)?.sections[0].blocks.map((b) => b.text)).toEqual(['Coleta do dia']);
        }
    });

    it('takes the psalms of the common its pointer names', () => {
        const proper = entry([{ kind: 'salmodia', text: 'Salmos e cântico do Comum dos Santos. Ant. 1 Própria.' }]);
        expect(psalmsCommonId(proper)).toBe('santos');
        const santos = {
            title: 'Comum',
            hours: { 'Vésperas II': [{ kind: 'ant', n: 1, text: 'Do Comum.' }, { kind: 'salmo', ref: 'Salmo 14' }] },
        };
        expect(texts(proper, santos)).toEqual(['Hino de I', 'Própria.', 'Salmo 14', 'Coleta do dia']);
    });
});

describe('a rubric pointing at the printed book', () => {
    const entry = (hours: Record<string, ProprioBlock[]>): ProprioEntry => ({
        day: 3, name: 'SANTO', descriptor: null, rank: 'Festa', commons: ['apostolos'], bio: '', hours,
    });
    const rubrica = (text: string): ProprioBlock => ({ kind: 'rubrica', text });
    const comum = {
        title: 'Comum',
        hours: {
            Sexta: [{ kind: 'leitura', text: 'Leitura do Comum' }],
            'Vésperas II': [
                { kind: 'hino', text: 'Hino do Comum' },
                { kind: 'ant', n: 1, text: 'Primeira do Comum.' },
                { kind: 'salmo', ref: 'Salmo 115' },
                { kind: 'ant', text: 'Primeira do Comum.' },
                { kind: 'preces', text: 'Preces do Comum' },
                { kind: 'rubrica', text: 'Ou' },
                { kind: 'preces', text: 'Outras preces do Comum' },
                { kind: 'rubrica', text: 'Pai nosso' },
                { kind: 'rubrica', text: 'Oração: no Próprio dos Santos.' },
            ],
        },
    };
    const vesperas = [
        'Hino do Comum', 'Primeira do Comum.', 'Salmo 115', 'Primeira do Comum.',
        'Preces do Comum', 'Ou', 'Outras preces do Comum', 'Pai nosso', 'Oração: no Próprio dos Santos.',
    ];
    const texts = (proper: ProprioEntry, hour = 'vesperas', sub: string | null = null) =>
        assembleHour(proper, comum, hour, sub, false)?.sections[0].blocks.map((b) => b.text ?? b.ref);

    it.each([
        'Preces do Comum dos Apóstolos: p. 1893.',
        'Preces ao Comum dos Santos: p. 1976.',
        'Preces do Comum das Santas, p. 1999; ou do dia ferial correspondente.',
        'Hino: do Comum dos Apóstolos, p. 1889 ou 1894.',
    ])('gives way to the common, its other rubrics intact: %s', (text) => {
        expect(texts(entry({ Vésperas: [rubrica(text)] }))).toEqual(vesperas);
    });

    it('gives way to the common\'s reading', () => {
        const proper = entry({ 'Hora Intermédia': [rubrica('Leitura breve do Comum dos Apóstolos: p. 1888.')] });
        expect(texts(proper, 'intermedia', 'Sexta')).toEqual(['Leitura do Comum']);
    });

    it('takes the entry\'s Laudes hymn when offered the choice', () => {
        const proper = entry({
            Laudes: [{ kind: 'hino', text: 'Hino das Laudes' }],
            Vésperas: [rubrica('Hino: como nas Laudes ou do Comum dos Santos, p. 1616 ou 1973.')],
        });
        expect(texts(proper)).toEqual(['Hino das Laudes', ...vesperas.slice(1)]);
    });

    it('leaves the common\'s hymn when the Laudes has none', () => {
        const proper = entry({ Vésperas: [rubrica('Hino: como nas Laudes ou do Comum, p. 1737 ou 1869.')] });
        expect(texts(proper)).toEqual(vesperas);
    });

    it('takes the entry\'s Laudes antiphons for the common\'s psalms', () => {
        const proper = entry({
            Laudes: [{ kind: 'salmodia', text: 'Salmos e cântico do Domingo I p. 879. Ant. 1 Primeira das Laudes.' }],
            Vésperas: [rubrica('Hino, salmos e cântico do Comum dos Apóstolos: p. 1889. Antífonas como nas Laudes: p. 1593.')],
        });
        expect(texts(proper)).toEqual([
            'Hino do Comum', 'Primeira das Laudes.', 'Salmo 115', 'Primeira das Laudes.', ...vesperas.slice(4),
        ]);
    });

    it('still names the common when it failed to load', () => {
        const proper = entry({
            Laudes: [{ kind: 'salmodia', text: 'Salmos e cântico do Domingo I p. 879. Ant. 1 Primeira das Laudes.' }],
            Vésperas: [rubrica('Hino, salmos e cântico do Comum dos Apóstolos: p. 1889. Antífonas como nas Laudes: p. 1593.')],
        });
        expect(assembleHour(proper, null, 'vesperas', null, false)?.sections[0].blocks.map((b) => b.text)).toEqual([
            'Salmos e cântico do Comum dos Apóstolos.', 'Primeira das Laudes.',
        ]);
    });

    it('drops "Oração: no Próprio dos Santos." once the collect is there', () => {
        const proper = entry({ Oração: [{ kind: 'oração', text: 'Coleta própria' }] });
        expect(texts(proper)).toEqual([...vesperas.slice(0, -1), 'Coleta própria']);
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
