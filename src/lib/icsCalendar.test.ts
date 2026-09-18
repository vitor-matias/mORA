import { describe, expect, it } from 'vitest';
import { parseDaySections, parseIcsToDays, parseVEventInfo } from './icsCalendar';

// This parser is the one thing the app and the publisher (server/agenda) have
// to agree on: the publisher runs it to decide what each day's event says, and
// the app renders the result. A change here changes what gets published, so
// the cases that used to only exist in liturgia.pt's own feed are pinned down.

const vevent = (body: string) => `BEGIN:VCALENDAR\nBEGIN:VEVENT\n${body}\nEND:VEVENT\nEND:VCALENDAR`;

describe('parseVEventInfo', () => {
    it('reads the date, the day name and the description', () => {
        const parsed = parseVEventInfo(
            '\nDTSTART;VALUE=DATE:20260528\nSUMMARY:Quinta-feira da semana VIII\nDESCRIPTION:Verde – Ofício da féria.\n',
        );
        expect(parsed?.dateStr).toBe('2026-05-28');
        expect(parsed?.info.dayName).toBe('Quinta-feira da semana VIII');
        expect(parsed?.info.color).toBe('verde');
    });

    it('takes the colour that appears first', () => {
        // Diocesan notes routinely mention a second colour further down, and
        // taking the last (or any) match would show the wrong one.
        const parsed = parseVEventInfo(
            '\nDTSTART;VALUE=DATE:20260101\nSUMMARY:Dia\nDESCRIPTION:Branco – Solenidade.\\nNoutro lugar: vermelho.\n',
        );
        expect(parsed?.info.color).toBe('branco');
    });

    it('falls back to the day name when the description names no colour', () => {
        const parsed = parseVEventInfo(
            '\nDTSTART;VALUE=DATE:20260214\nSUMMARY:S. Valentim, mártir\nDESCRIPTION:Sem cor indicada.\n',
        );
        expect(parsed?.info.color).toBe('vermelho');
    });

    it('unescapes the ICS escaping', () => {
        const parsed = parseVEventInfo(
            '\nDTSTART;VALUE=DATE:20260301\nSUMMARY:Dia\nDESCRIPTION:Roxo – Quaresma.\\nL 1: Gn 9\\, 8-15\\; Sl 24\n',
        );
        expect(parsed?.info.description).toBe('Roxo – Quaresma.\nL 1: Gn 9, 8-15; Sl 24');
    });

    it('flattens newlines in the day name but keeps them in the description', () => {
        // The name is a heading; a line break in it would break the layout.
        const parsed = parseVEventInfo(
            '\nDTSTART;VALUE=DATE:20260301\nSUMMARY:Domingo\\nda Quaresma\nDESCRIPTION:Roxo.\\nSegunda linha.\n',
        );
        expect(parsed?.info.dayName).toBe('Domingo da Quaresma');
        expect(parsed?.info.description).toBe('Roxo.\nSegunda linha.');
    });

    it('decodes an escaped backslash without mistaking it for a newline', () => {
        // RFC 5545 allows \\ for a literal backslash. Decoding \n before \\
        // would read the pair in \\n as an escaped newline and swallow the
        // backslash escaping it. liturgia.pt sends no backslashes today, so
        // this guards a trap rather than a live bug.
        const parsed = parseVEventInfo(
            '\nDTSTART;VALUE=DATE:20260301\nSUMMARY:Dia\nDESCRIPTION:Verde – a\\\\nb\n',
        );
        expect(parsed?.info.description).toBe('Verde – a\\nb');
    });

    it('treats \\N as a newline too, as the spec allows', () => {
        const parsed = parseVEventInfo(
            '\nDTSTART;VALUE=DATE:20260301\nSUMMARY:Dia\nDESCRIPTION:Verde – a\\NB\n',
        );
        expect(parsed?.info.description).toBe('Verde – a\nB');
    });

    it('skips a block with no derivable colour', () => {
        expect(parseVEventInfo('\nDTSTART;VALUE=DATE:20260101\nSUMMARY:Dia\nDESCRIPTION:Nada.\n')).toBeNull();
    });

    it('skips a block with no date', () => {
        expect(parseVEventInfo('\nSUMMARY:Dia\nDESCRIPTION:Verde – Ofício.\n')).toBeNull();
    });
});

describe('parseDaySections', () => {
    it('splits the ordinary day into its parts', () => {
        expect(parseDaySections(
            'Natividade da Virgem santa Maria – FESTA\n'
            + 'Branco – Ofício da festa. Te Deum.\n'
            + 'Missa própria, Glória, pf. da Virgem santa Maria.\n'
            + '\n'
            + 'L 1: Mq 5, 1-4a ou Rm 8, 28-30; Sl 12, 6ab. 6cd\n'
            + 'Ev: Mt 1, 1-16. 18-23\n'
            + '\n'
            + '* Proibidas as Missas de defuntos, exceto a exequial.',
        )).toEqual([
            { kind: 'celebration', text: 'Natividade da Virgem santa Maria', rank: 'FESTA' },
            { kind: 'office', text: 'Ofício da festa. Te Deum.', colors: 'Branco' },
            { kind: 'mass', text: 'Missa própria, Glória, pf. da Virgem santa Maria.' },
            { kind: 'readings', items: [
                { label: 'L 1', ref: 'Mq 5, 1-4a ou Rm 8, 28-30; Sl 12, 6ab. 6cd' },
                { label: 'Ev', ref: 'Mt 1, 1-16. 18-23' },
            ] },
            { kind: 'notes', items: ['Proibidas as Missas de defuntos, exceto a exequial.'] },
        ]);
    });

    it('joins a title the feed wrapped over several lines', () => {
        // The rank is what marks the end of a title, and it can be three
        // wrapped lines below where the title started.
        expect(parseDaySections(
            'IMACULADA CONCEIÇÃO DA VIRGEM SANTA MARIA, \n'
            + 'Padroeira principal de Portugal e das Dioceses de Évora, Santarém, \n'
            + 'Setúbal e Vila Real – SOLENIDADE ',
        )).toEqual([{
            kind: 'celebration',
            text: 'IMACULADA CONCEIÇÃO DA VIRGEM SANTA MARIA, Padroeira principal de Portugal e das Dioceses de Évora, Santarém, Setúbal e Vila Real',
            rank: 'SOLENIDADE',
        }]);
    });

    it('takes a rank standing on its own line', () => {
        expect(parseDaySections('EPIFANIA DO SENHOR\nSOLENIDADE')).toEqual([
            { kind: 'celebration', text: 'EPIFANIA DO SENHOR', rank: 'SOLENIDADE' },
        ]);
    });

    it('keeps two celebrations apart', () => {
        expect(parseDaySections(
            'Santos João de Brébeuf e Isaac Jogues, presbíteros, \n'
            + 'e companheiros, mártires – MF\n'
            + 'S. Paulo da Cruz, presbítero – MF',
        )).toEqual([
            { kind: 'celebration', text: 'Santos João de Brébeuf e Isaac Jogues, presbíteros, e companheiros, mártires', rank: 'MF' },
            { kind: 'celebration', text: 'S. Paulo da Cruz, presbítero', rank: 'MF' },
        ]);
    });

    it('carries a bare colour as colours, not as text', () => {
        // "Branco." says only what the day card's dot already says.
        expect(parseDaySections('Branco.')).toEqual([{ kind: 'office', text: '', colors: 'Branco' }]);
    });

    it('keeps a colour the priest gets to choose', () => {
        expect(parseDaySections('Verde, verm. ou br. – Ofício da féria ou da memória.')).toEqual([
            { kind: 'office', text: 'Ofício da féria ou da memória.', colors: 'Verde, verm. ou br.' },
        ]);
    });

    it('reads an office line that names no colour', () => {
        expect(parseDaySections('Ofício próprio.')).toEqual([{ kind: 'office', text: 'Ofício próprio.' }]);
    });

    it('rejoins a Mass line the feed wrapped mid-sentence', () => {
        expect(parseDaySections(
            'Missa própria da Vigília, Glória, Credo, pf. da Epifania do \nSenhor.',
        )).toEqual([{ kind: 'mass', text: 'Missa própria da Vigília, Glória, Credo, pf. da Epifania do Senhor.' }]);
    });

    it('keeps an alternative reading with the block it continues', () => {
        expect(parseDaySections(
            'L 1: Sir 3, 3-7. 14-17a\nou Heb 5, 7-9; Sl 30, 2-3ab\nEv: Lc 2, 41-52',
        )).toEqual([{ kind: 'readings', items: [
            { label: 'L 1', ref: 'Sir 3, 3-7. 14-17a' },
            { ref: 'ou Heb 5, 7-9; Sl 30, 2-3ab' },
            { label: 'Ev', ref: 'Lc 2, 41-52' },
        ] }]);
    });

    it('reads a tab between a reading label and its reference', () => {
        expect(parseDaySections('L 3:\tEx 14, 15 – 15, 1')).toEqual([
            { kind: 'readings', items: [{ label: 'L 3', ref: 'Ex 14, 15 – 15, 1' }] },
        ]);
    });

    it('keeps notes written above the readings out of them', () => {
        // Easter Sunday: the Vigil's remark sits above eight readings, and
        // splitting the day on the first "*" line buried all of them.
        const sections = parseDaySections(
            'Branco.\n'
            + '* Hoje o Ofício de Leitura é omitido.\n'
            + '\n'
            + 'L 1: Gn 1, 1 – 2, 2\n'
            + 'Ev: Mt 28, 1-10',
        );
        expect(sections.map((s) => s.kind)).toEqual(['office', 'notes', 'readings']);
        expect(sections.at(-1)).toEqual({ kind: 'readings', items: [
            { label: 'L 1', ref: 'Gn 1, 1 – 2, 2' },
            { label: 'Ev', ref: 'Mt 28, 1-10' },
        ] });
    });

    it('keeps a heading it cannot classify, in place', () => {
        expect(parseDaySections('TEMPO PASCAL\n\nBranco.')).toEqual([
            { kind: 'text', text: 'TEMPO PASCAL' },
            { kind: 'office', text: '', colors: 'Branco' },
        ]);
    });

    it('has nothing to say about an empty description', () => {
        expect(parseDaySections('')).toEqual([]);
    });
});

describe('parseIcsToDays', () => {
    it('unfolds the continuation lines liturgia.pt wraps at 75 characters', () => {
        // A folded DESCRIPTION continues on the next line after a single
        // space. Parsed without unfolding, the colour and half the text sit
        // in a line the regex never reaches.
        const days = parseIcsToDays(vevent(
            'DTSTART;VALUE=DATE:20260528\nSUMMARY:Quinta-feira\nDESCRIPTION:Verde – Ofício da féria.\n Missa à escolha.',
        ));
        expect(days.get('2026-05-28')?.description).toBe('Verde – Ofício da féria.Missa à escolha.');
    });

    it('keeps the first event for a date when the feed carries several', () => {
        const days = parseIcsToDays(
            'BEGIN:VCALENDAR\n'
            + 'BEGIN:VEVENT\nDTSTART;VALUE=DATE:20260101\nSUMMARY:Primeiro\nDESCRIPTION:Branco – Solenidade.\nEND:VEVENT\n'
            + 'BEGIN:VEVENT\nDTSTART;VALUE=DATE:20260101\nSUMMARY:Segundo\nDESCRIPTION:Verde – Ofício.\nEND:VEVENT\n'
            + 'END:VCALENDAR',
        );
        expect(days.size).toBe(1);
        expect(days.get('2026-01-01')?.dayName).toBe('Primeiro');
    });

    it('returns nothing for a feed with no usable events', () => {
        expect(parseIcsToDays('BEGIN:VCALENDAR\nEND:VCALENDAR').size).toBe(0);
    });
});
