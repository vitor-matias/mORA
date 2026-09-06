// Turning liturgia.pt's ICS feed into day info.
//
// Imported by the app for its types, and executed by the publisher
// (server/agenda) under `node --experimental-strip-types`, the way
// tools/parse-lh.ts already is. Deliberately dependency-free so that stays
// possible: no imports, no browser APIs.
//
// The parsing lives here rather than in the publisher because it is the one
// piece both sides have to agree on, and two copies kept in step by a comment
// stay in step right up until they don't.

export type LiturgicalColor = 'verde' | 'roxo' | 'vermelho' | 'branco' | 'rosa';

export type LiturgicalDayInfo = {
    color: LiturgicalColor;
    dayName: string;
    description: string;
};

/** Extracts a day's info from one unfolded VEVENT block, or null if no color is derivable. */
export function parseVEventInfo(event: string): { dateStr: string; info: LiturgicalDayInfo } | null {
    const dtMatch = event.match(/DTSTART(?:;VALUE=DATE)?:(\d{4})(\d{2})(\d{2})/);
    if (!dtMatch) return null;
    const dateStr = `${dtMatch[1]}-${dtMatch[2]}-${dtMatch[3]}`;

    const descMatch = event.match(/\r?\nDESCRIPTION:(.*?)(?=\r?\n[A-Z-]+[;:]|$)/s);
    const summaryMatch = event.match(/\r?\nSUMMARY:(.*?)(?=\r?\n[A-Z-]+[;:]|$)/s);

    let color: LiturgicalColor | undefined;
    let dayName = summaryMatch ? summaryMatch[1].trim() : '';
    let description = '';

    // Clean up ICS escaped characters using split/join (avoids regex escaping issues)
    const bs = String.fromCharCode(92); // backslash character
    dayName = dayName.split(bs + 'n').join(' ').split(bs + ',').join(',').split(bs + ';').join(';');

    if (descMatch) {
        const rawDesc = descMatch[1].trim();
        description = rawDesc.split(bs + 'n').join('\n').split(bs + ',').join(',').split(bs + ';').join(';');

        const descLower = rawDesc.toLowerCase();
        // Pick the color that appears first — descriptions can mention
        // secondary colors in diocesan notes that would mask the primary.
        const colorCandidates: Array<[LiturgicalColor, number]> = (
            [
                ['verde', descLower.indexOf('verde')],
                ['roxo', descLower.indexOf('roxo')],
                ['branco', descLower.indexOf('branco')],
                ['vermelho', descLower.indexOf('vermelho')],
                ['rosa', descLower.indexOf('rosa')],
            ] as Array<[LiturgicalColor, number]>
        ).filter(([, i]) => i !== -1).sort(([, a], [, b]) => a - b);
        if (colorCandidates.length > 0) color = colorCandidates[0][0];
    }

    // Fall back to inferring color from the day name when the
    // ICS description doesn't spell out the color explicitly.
    if (!color && dayName) {
        const nameLower = dayName.toLowerCase();
        if (nameLower.includes('mártir') || nameLower.includes('martir')) color = 'vermelho';
        else if (nameLower.includes('quaresma') || nameLower.includes('advento')) color = 'roxo';
        else if (nameLower.includes('solenidade') || nameLower.includes('assunção') || nameLower.includes('natal') || nameLower.includes('páscoa')) color = 'branco';
    }

    if (!color) return null;
    return { dateStr, info: { color, dayName, description } };
}

/** The whole feed as YYYY-MM-DD → day info. */
export function parseIcsToDays(ics: string): Map<string, LiturgicalDayInfo> {
    // ICS folds long lines by starting the continuation with a space.
    const unfolded = ics.replace(/\r?\n /g, '');
    const days = new Map<string, LiturgicalDayInfo>();
    for (const event of unfolded.split('BEGIN:VEVENT')) {
        const parsed = parseVEventInfo(event);
        // First event with a derivable color wins for each date.
        if (parsed && !days.has(parsed.dateStr)) days.set(parsed.dateStr, parsed.info);
    }
    return days;
}
