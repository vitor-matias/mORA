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
