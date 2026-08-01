// Text-assembly helpers shared by the breviary parsers.
//
// The liturgia.pt PDFs (frozen since 2010) set section labels in fragmented
// small caps whose kerning gaps defeat exact string matching, and break
// words across lines with plain hyphens — everything here exists to undo
// those two artifacts.

/** Lowercased text with all whitespace removed — the label-matching form. */
export function despace(text: string): string {
    return text.toLowerCase().replace(/\s+/g, '');
}

/** Strips the first `n` non-space characters (a despaced label prefix). */
export function afterDespaced(text: string, n: number): string {
    let seen = 0;
    let i = 0;
    while (i < text.length && seen < n) {
        if (!/\s/.test(text[i])) seen++;
        i++;
    }
    return text.slice(i).trim();
}

/** Joins wrapped prose lines, repairing end-of-line hyphenation. */
export function joinProse(buf: string[]): string {
    let out = '';
    for (const raw of buf) {
        const t = raw.trim();
        if (!t) continue;
        if (/[A-Za-zÀ-ú]-$/.test(out)) out = out.slice(0, -1) + t;
        else out += (out ? ' ' : '') + t;
    }
    return out;
}

export interface VerseLine {
    t: string;
    /** Continuation of the previous line (deeper indent), to be merged up. */
    cont: boolean;
}

/**
 * Joins verse-like content (hymns, responsories, preces) keeping one line
 * per verse, merging indented continuations — and any line whose
 * predecessor ends mid-word ("connos- / co"), whatever its indent.
 */
export function joinVerse(buf: VerseLine[]): string {
    const merged: string[] = [];
    for (const { t, cont } of buf) {
        const prev = merged[merged.length - 1];
        if (prev !== undefined && (cont || /[A-Za-zÀ-ú]-$/.test(prev))) {
            merged[merged.length - 1] = /[A-Za-zÀ-ú]-$/.test(prev)
                ? prev.slice(0, -1) + t
                : `${prev} ${t}`;
        } else {
            merged.push(t);
        }
    }
    return merged.join('\n');
}

/** Like joinVerse for plain strings: one line each, hyphen wraps merged. */
export function joinLines(lines: string[]): string {
    return joinVerse(lines.map((t) => ({ t, cont: false })));
}

export interface HymnLine {
    p: number;
    y: number;
    x: number;
    t: string;
}

/**
 * Reassembles a hymn from positioned lines. Hymns are set in one column,
 * two columns, or bands of both; stanzas are separated by vertical gaps.
 * Reading order is row-wise — a stanza and its right-column neighbour, then
 * the next row — which the official app's own typesetting of the same
 * hymns confirms. Grouping by y-gap rather than a fixed stanza size keeps
 * irregular stanzas and full-width tail stanzas in order.
 */
export function assembleHymn(lines: HymnLine[], colX = 120, stanzaGap = 13.5): string {
    interface Stanza {
        p: number;
        topY: number;
        col: number;
        lines: string[];
    }
    const stanzas: Stanza[] = [];
    const open: (Stanza & { lastY: number })[] = [];
    for (const line of lines) {
        const col = line.x > colX ? 1 : 0;
        let cur = open[col];
        if (!cur || cur.p !== line.p || cur.lastY - line.y > stanzaGap) {
            cur = { p: line.p, topY: line.y, col, lines: [], lastY: line.y };
            open[col] = cur;
            stanzas.push(cur);
        }
        cur.lines.push(line.t);
        cur.lastY = line.y;
    }
    // Row-wise order: down the page, left before its right-hand neighbour
    // (columns are vertically offset by less than a stanza).
    stanzas.sort((a, b) => a.p - b.p || (Math.abs(b.topY - a.topY) > stanzaGap ? b.topY - a.topY : a.col - b.col));
    return stanzas.map((s) => joinLines(s.lines)).join('\n\n');
}

/**
 * Scripture refs on label lines lose their inner spaces to tight kerning
 * ("Hebr13,7-9a") — put them back.
 */
export function prettifyRef(ref: string): string {
    return ref
        .replace(/^[:.]\s*/, '') // "Hino:" leaves its colon behind as a ref
        .replace(/([a-zà-ú])(\d)/gi, '$1 $2')
        .replace(/,(\S)/g, ', $1');
}

interface Run {
    x: number;
    w: number;
    s: string;
}

/** Space-restoring join of one line's runs (same rule as pdfLines). */
function joinRuns(items: Run[]): string {
    return items
        .map((it, i) => {
            if (i === 0) return it.s;
            const prev = items[i - 1];
            return (it.x - (prev.x + prev.w) > 1 ? ' ' : '') + it.s;
        })
        .join('')
        .trim();
}

/**
 * Splits a line's runs at a column gutter (hymns are often set in two
 * columns whose halves must not interleave). The right column starts at a
 * fixed position past mid-page, so split on absolute x rather than gap
 * width — a long left verse can shrink the gutter to almost nothing. The
 * small gap guard keeps a long single-column verse's continuation runs,
 * which butt-join, from being mistaken for a column start.
 */
export function splitColumns(items: Run[]): { left: string; right: string | null; rightX: number } {
    for (let i = 1; i < items.length; i++) {
        const gap = items[i].x - (items[i - 1].x + items[i - 1].w);
        // Column-start x varies per document (152 in the Próprio, ~143 in
        // Defuntos); 120 clears every left column while the gap guard keeps
        // butt-joined continuation runs intact.
        if (items[i].x > 120 && gap > 5) {
            return { left: joinRuns(items.slice(0, i)), right: joinRuns(items.slice(i)), rightX: items[i].x };
        }
    }
    return { left: joinRuns(items), right: null, rightX: 0 };
}
