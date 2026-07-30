import type { LiturgicalColor } from "@/lib/liturgy";

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

// Scripture reference lines: "L 1: Jr 18, 1-6", "Ev: Mt 13, 47-53", a
// tab-separated "L 2<TAB>Heb 11, 8" and the standalone "Sl 103 (104), …"
// continuations. The digit is what tells "L 1:" from a word starting with L.
const READING_LINE_RE = /^(L\s*\d+\s*[:\t]|Ev\s*[:\t]|Sl\s+\d)/i;

/** The day description without its readings list — for cards that say which
    day it is rather than what is read at Mass. */
export function stripReadingLines(text: string): string {
    return text
        .split('\n')
        .filter((line) => !READING_LINE_RE.test(line.trim()))
        .join('\n')
        .trim();
}

/**
 * Splits a liturgical-calendar day description into the part shown by
 * default — celebration, office notes and the day's readings — and the
 * trailing remarks (lines starting with "*": diocesan and religious-order
 * notes, Mass prohibitions) that stay collapsed until expanded.
 */
export function splitDayDescription(text: string): { main: string; notes: string | null } {
    const lines = text.split('\n');
    const idx = lines.findIndex((l) => l.trim().startsWith('*'));
    if (idx <= 0) return { main: text.trim(), notes: null };
    return {
        main: lines.slice(0, idx).join('\n').trim(),
        notes: lines.slice(idx).join('\n').trim() || null,
    };
}
