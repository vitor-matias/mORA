import { describe, expect, it } from 'vitest';
import type { DaySection } from './icsCalendar';
import { isEmptySection, splitSections, withoutReadings } from './dayInfo';

// What the day card actually renders. The prose helpers next door decide the
// same things by regex, for days published before the calendar carried
// sections; these decide them by kind, which is what fixed Easter.

const celebration: DaySection = { kind: 'celebration', text: 'Páscoa', rank: 'SOLENIDADE' };
const readings: DaySection = { kind: 'readings', items: [{ label: 'L 1', ref: 'Gn 1, 1 – 2, 2' }] };

describe('splitSections', () => {
    it('sends the notes to the end however early they were written', () => {
        // Easter Sunday's remark sits above its readings in the feed. Cutting
        // the day at the first note — what the prose fallback does — put the
        // Vigil's eight readings behind "Ver mais" along with it.
        const { main, notes } = splitSections([
            celebration,
            { kind: 'notes', items: ['Hoje o Ofício de Leitura é omitido.'] },
            readings,
        ]);
        expect(main).toEqual([celebration, readings]);
        expect(notes).toEqual(['Hoje o Ofício de Leitura é omitido.']);
    });

    it('gathers notes written in more than one place', () => {
        const { notes } = splitSections([
            { kind: 'notes', items: ['Primeira.'] },
            readings,
            { kind: 'notes', items: ['Segunda.', 'Terceira.'] },
        ]);
        expect(notes).toEqual(['Primeira.', 'Segunda.', 'Terceira.']);
    });

    it('has no notes when the day has none', () => {
        expect(splitSections([celebration]).notes).toEqual([]);
    });
});

describe('withoutReadings', () => {
    it('drops the references and keeps everything else', () => {
        expect(withoutReadings([celebration, readings])).toEqual([celebration]);
    });
});

describe('isEmptySection', () => {
    it('calls a colour-only office line empty', () => {
        // Its colour is already on screen as the day's dot.
        expect(isEmptySection({ kind: 'office', text: '', colors: 'Branco' })).toBe(true);
    });

    it('keeps a section with something to say', () => {
        expect(isEmptySection({ kind: 'office', text: 'Ofício da festa.', colors: 'Branco' })).toBe(false);
        expect(isEmptySection(celebration)).toBe(false);
        expect(isEmptySection(readings)).toBe(false);
    });

    it('calls a rank with no title non-empty', () => {
        // Easter's "SOLENIDADE com oitava" stands alone under the day name.
        expect(isEmptySection({ kind: 'celebration', text: '', rank: 'SOLENIDADE com oitava' })).toBe(false);
    });
});
