import type { DaySection, LiturgicalColor } from "@/lib/icsCalendar";

// Fixed swatches per liturgical color — used wherever a specific day's color
// must render independently of the app-wide `data-theme` palette (calendar
// grids, day cards for dates other than today).
export const COLOR_DOTS: Record<LiturgicalColor, { bg: string; label: string }> = {
    verde: { bg: '#059669', label: 'Verde' },
    roxo: { bg: '#9333ea', label: 'Roxo' },
    vermelho: { bg: '#dc2626', label: 'Vermelho' },
    branco: { bg: '#e4e4e7', label: 'Branco' },
    rosa: { bg: '#ec4899', label: 'Rosa' },
};

/**
 * The day split into what it opens with and what stays behind "Ver mais".
 *
 * Notes go last however high up the feed wrote them. This is the whole point
 * of splitting on kind rather than on position: the prose fallback cuts at
 * the first "*" line, which on Easter Sunday sits above the Vigil's readings
 * and so collapsed eight of them along with the remarks. Five days of 2026
 * read that way — including Easter, Pentecost and Corpus Christi's Sunday.
 */
export function splitSections(sections: DaySection[]): { main: DaySection[]; notes: string[] } {
    const main: DaySection[] = [];
    const notes: string[] = [];
    for (const section of sections) {
        if (section.kind === 'notes') notes.push(...section.items);
        else main.push(section);
    }
    return { main, notes };
}

/** The same, without the scripture references — for cards that say which day
    it is rather than what is read at Mass (Home, and the Missa page, which
    has the readings themselves right underneath). */
export function withoutReadings(sections: DaySection[]): DaySection[] {
    return sections.filter((section) => section.kind !== 'readings');
}

/** A section that would render as nothing: a colour-only office line, whose
    colour the card already shows as a dot, or an empty title. */
export function isEmptySection(section: DaySection): boolean {
    if (section.kind === 'readings') return section.items.length === 0;
    if (section.kind === 'notes') return section.items.length === 0;
    if (section.kind === 'celebration') return !section.text && !section.rank;
    return !section.text;
}
