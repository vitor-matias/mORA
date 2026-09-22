import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DayDescription } from './DayInfo';
import type { DaySection } from '@/lib/icsCalendar';

// A day with a remark: the part "Ver mais" hides on Home and the Missa page.
const sections: DaySection[] = [
    { kind: 'celebration', text: 'S. Pio de Pietrelcina, presbítero', rank: 'MEMÓRIA' },
    { kind: 'mass', text: 'Missa da memória.' },
    { kind: 'notes', items: ['Pode celebrar-se a Missa votiva.'] },
];

function render(notesOpen: boolean): string {
    return renderToStaticMarkup(createElement(DayDescription, { text: '', sections, notesOpen }));
}

describe('DayDescription', () => {
    it('keeps the remarks behind "Ver mais" by default', () => {
        const html = render(false);
        expect(html).toContain('Ver mais (1)');
        expect(html).not.toContain('Pode celebrar-se a Missa votiva.');
    });

    it('lists the remarks outright, with no toggle, when notesOpen', () => {
        const html = render(true);
        expect(html).toContain('Pode celebrar-se a Missa votiva.');
        expect(html).not.toContain('Ver mais');
        expect(html).not.toContain('Ver menos');
        expect(html).not.toContain('<button');
    });
});
