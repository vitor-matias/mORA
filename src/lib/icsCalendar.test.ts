import { describe, expect, it } from 'vitest';
import { parseIcsToDays, parseVEventInfo } from './icsCalendar';

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

    it('skips a block with no derivable colour', () => {
        expect(parseVEventInfo('\nDTSTART;VALUE=DATE:20260101\nSUMMARY:Dia\nDESCRIPTION:Nada.\n')).toBeNull();
    });

    it('skips a block with no date', () => {
        expect(parseVEventInfo('\nSUMMARY:Dia\nDESCRIPTION:Verde – Ofício.\n')).toBeNull();
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
