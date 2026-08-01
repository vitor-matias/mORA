// Turns a pdf.js document into ordered visual lines — the shared first stage
// of the liturgia.pt breviary parsers (proprio.ts, comum.ts).
//
// Structural types only: this module must not depend on pdfjs-dist, so the
// same code runs in the app (browser pdf.js) and in tools/parse-lh.ts
// (Node, legacy build).

export interface PdfRun {
    x: number;
    /** Advance width — used to restore spaces between items sharing a line. */
    w: number;
    h: number;
    s: string;
}

export interface PdfLine {
    /** 1-based page number. */
    p: number;
    y: number;
    /** x of the leftmost item — the layout's main classification signal. */
    x: number;
    /** Tallest item on the line (labels mix 10pt caps with 7pt small caps). */
    h: number;
    text: string;
    items: PdfRun[];
}

interface TextItemLike {
    str?: string;
    transform?: number[];
    width?: number;
    height?: number;
}

export interface PdfPageLike {
    getTextContent(): Promise<{ items: TextItemLike[] }>;
}

export interface PdfDocLike {
    numPages: number;
    getPage(n: number): Promise<PdfPageLike>;
}

/**
 * Groups a page's text items into lines by rounded baseline, restoring
 * reading order (top to bottom, left to right). Items separated by real
 * horizontal space get it back — pdf.js emits e.g. a right-aligned "Por
 * Nosso" on the same line as the collect body — while small-caps fragments
 * ("reSponSório breve") butt-join.
 */
export async function extractLines(doc: PdfDocLike): Promise<PdfLine[]> {
    const lines: PdfLine[] = [];
    for (let p = 1; p <= doc.numPages; p++) {
        const page = await doc.getPage(p);
        const content = await page.getTextContent();

        const byY = new Map<number, PdfRun[]>();
        for (const item of content.items) {
            if (!item.str || !item.height || !item.transform) continue;
            const x = item.transform[4];
            const y = Math.round(item.transform[5]);
            let row = byY.get(y);
            if (!row) byY.set(y, (row = []));
            row.push({ x, w: item.width ?? 0, h: item.height, s: item.str });
        }

        for (const [y, items] of [...byY.entries()].sort((a, b) => b[0] - a[0])) {
            items.sort((a, b) => a.x - b.x);
            lines.push({
                p,
                y,
                x: Math.round(items[0].x * 10) / 10,
                h: Math.max(...items.map((i) => i.h)),
                // Threshold tuned against the corpus: small-caps fragments
                // sit at ≤0.8pt, real word gaps at ≥1.2pt ("A palavra" set
                // as two runs loses its space at 1.5).
                text: items
                    .map((item, i) => {
                        if (i === 0) return item.s;
                        const prev = items[i - 1];
                        const gap = item.x - (prev.x + prev.w);
                        return (gap > 1 ? ' ' : '') + item.s;
                    })
                    .join(''),
                items,
            });
        }
    }
    return lines;
}
