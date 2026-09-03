/**
 * The dialogue markers the Devocionário and the Coroas write at the start of
 * a line: "V. " for the versicle and "R. " for the response. The data stays
 * plain text; the views turn the markers into the liturgical glyphs.
 */
const VERSICLE_RE = /^([VR])\.\s+/;

export const VERSICLE_GLYPH = { V: '℣', R: '℟' } as const;
export type VersicleMark = keyof typeof VERSICLE_GLYPH;

/** Splits a line into its marker, if it has one, and the spoken text. */
export function splitVersicle(line: string): { mark: VersicleMark | null; rest: string } {
    const m = VERSICLE_RE.exec(line);
    return m
        ? { mark: m[1] as VersicleMark, rest: line.slice(m[0].length) }
        : { mark: null, rest: line };
}

/** The same text with the markers as ℣ and ℟, for the clipboard. */
export function withVersicleGlyphs(text: string): string {
    return text
        .split('\n')
        .map((line) => {
            const { mark, rest } = splitVersicle(line);
            return mark ? `${VERSICLE_GLYPH[mark]} ${rest}` : line;
        })
        .join('\n');
}
