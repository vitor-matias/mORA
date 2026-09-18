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

/**
 * One classified stretch of a day's description.
 *
 * liturgia.pt writes the day as prose — celebration, office, Mass formulary,
 * the readings and a tail of diocesan remarks, wrapped mid-sentence wherever
 * the feed felt like it. Clients used to rebuild that structure from the text
 * with regexes on every render, and got it wrong on the days that don't
 * follow the usual order (Easter's notes sit *above* its readings, which put
 * eight Vigil readings behind a "Ver mais"). Parsing it once, here, and
 * publishing the result means the app renders fields instead of guessing.
 *
 * Ordered and lossless: every non-blank line lands in exactly one section, in
 * the order it was written, so a day that fits no pattern still reads as the
 * feed wrote it.
 */
export type DaySection =
    /** The celebration being kept, and its rank when the feed states one. */
    | { kind: 'celebration'; text: string; rank?: string }
    /** Which office is said. `colors` is the vestment colour the line names —
        split off because the day card already shows a colour dot, and a list
        ("Verde, verm. ou br.") is worth showing where a single repeat is not. */
    | { kind: 'office'; text: string; colors?: string }
    /** The Mass formulary: proper or common, Gloria, Creed, preface. */
    | { kind: 'mass'; text: string }
    /** A block of scripture references. Unlabelled items are the "ou …"
        alternatives that continue the line above them. */
    | { kind: 'readings'; items: { label?: string; ref: string }[] }
    /** The "*" remarks: diocesan and religious-order propers, prohibitions. */
    | { kind: 'notes'; items: string[] }
    /** Anything else — headings ("TEMPO PASCAL", "Missa do dia") and rubrics. */
    | { kind: 'text'; text: string };

export type LiturgicalDayInfo = {
    color: LiturgicalColor;
    dayName: string;
    description: string;
    /** The description, classified. Absent on events published before this
        existed, so readers must still be able to fall back to `description`. */
    sections?: DaySection[];
};

const RANKS = 'SOLENIDADE|FESTA|MEMÓRIA|MO|MF';
/** "… – FESTA", "… – SOLENIDADE com oitava": the rank closes a celebration. */
const TRAILING_RANK_RE = new RegExp(`\\s[–—-]\\s*((?:${RANKS})\\b.*)$`);
/** The same rank standing alone on its own line, under an all-caps title. */
const STANDALONE_RANK_RE = new RegExp(`^((?:${RANKS})\\b.*)$`);
/** "L 1: …", "L 2\t…", "Ev: …" and the bare "Sl 103 (104), …" continuations. */
const READING_RE = /^(L\s*\d+|Ev)\s*[:\t]\s*(.*)$/i;
const PSALM_RE = /^Sl\s+\d/i;
const MASS_RE = /^†?\s*Missa\b/i;
const OFFICE_RE = /^(Verde|Roxo|Branco|Vermelho|Rosa|Ofício)\b/i;
const COLOR_FIRST_RE = /^(Verde|Roxo|Branco|Vermelho|Rosa)\b/i;
/** Splits "Verde, verm. ou br. – Ofício da féria." into colours and office. */
const OFFICE_SPLIT_RE = /^([^–—]*?)\s*[–—]\s*(.+)$/;

/**
 * Classifies a day's description into ordered sections.
 *
 * Two rules carry most of the feed's irregularity. Lines that open nothing
 * are held back rather than emitted straight away, because a title is only
 * recognisable once its rank arrives — which may be two wrapped lines later
 * ("IMACULADA CONCEIÇÃO DA VIRGEM SANTA MARIA, / Padroeira principal de
 * Portugal e das Dioceses de Évora, Santarém, / Setúbal e Vila Real –
 * SOLENIDADE"). And a line that opens nothing directly under an open section
 * continues it, which is how the feed's mid-sentence wrapping is put back
 * together. A blank line ends both.
 */
export function parseDaySections(description: string): DaySection[] {
    const sections: DaySection[] = [];
    // Lines that have opened nothing yet: a title waiting for its rank, or
    // (if none comes) a heading or rubric in its own right.
    let pending: string[] = [];
    // The section a wrapped line would continue. Cleared by a blank line.
    let open: DaySection | null = null;

    const flushPending = () => {
        if (pending.length === 0) return;
        sections.push({ kind: 'text', text: pending.join(' ').trim() });
        pending = [];
    };
    // Returns the section so the caller assigns `open` itself: assigning it
    // in here instead leaves the compiler unable to see that `open` is ever
    // anything but null, and every read of it below becomes an error.
    const push = (section: DaySection): DaySection => {
        flushPending();
        sections.push(section);
        return section;
    };

    for (const raw of description.split('\n')) {
        const line = raw.trim();

        if (!line) {
            flushPending();
            open = null;
            continue;
        }

        if (line.startsWith('*')) {
            const note = line.replace(/^\*\s*/, '');
            if (open?.kind === 'notes') open.items.push(note);
            else open = push({ kind: 'notes', items: [note] });
            continue;
        }

        const reading = line.match(READING_RE);
        if (reading || PSALM_RE.test(line)) {
            const item = reading
                ? { label: reading[1].replace(/\s+/g, ' '), ref: reading[2] }
                : { ref: line };
            if (open?.kind === 'readings') open.items.push(item);
            else open = push({ kind: 'readings', items: [item] });
            continue;
        }

        if (MASS_RE.test(line)) {
            open = push({ kind: 'mass', text: line });
            continue;
        }

        if (OFFICE_RE.test(line)) {
            const split = line.match(OFFICE_SPLIT_RE);
            if (split) open = push({ kind: 'office', text: split[2], colors: split[1] });
            // A colour with no dash after it is the whole line ("Branco.") —
            // carried as colours so the card doesn't print what its dot says.
            else if (COLOR_FIRST_RE.test(line)) open = push({ kind: 'office', text: '', colors: line.replace(/\.$/, '') });
            else open = push({ kind: 'office', text: line });
            continue;
        }

        // A rank closes whatever title has been accumulating — including a
        // title that is only this line ("S. Paulo da Cruz, presbítero – MF").
        const trailing = line.match(TRAILING_RANK_RE);
        const standalone = line.match(STANDALONE_RANK_RE);
        if (trailing || standalone) {
            const rank = (trailing ?? standalone)![1].trim();
            const head = trailing ? line.slice(0, line.length - trailing[0].length) : '';
            const text = [...pending, head].join(' ').replace(/\s+/g, ' ').trim();
            pending = [];
            sections.push({ kind: 'celebration', text, ...(rank ? { rank } : {}) });
            open = null; // a rank ends the title; what follows starts afresh
            continue;
        }

        // Nothing opened. Either the feed wrapped an open section mid-sentence,
        // or this is a heading/rubric that only the next lines can classify.
        if (open && (open.kind === 'celebration' || open.kind === 'mass' || open.kind === 'office' || open.kind === 'text')) {
            open.text = `${open.text} ${line}`.replace(/\s+/g, ' ').trim();
        } else if (open?.kind === 'notes') {
            open.items[open.items.length - 1] += ` ${line}`;
        } else if (open?.kind === 'readings') {
            open.items.push({ ref: line });
        } else {
            pending.push(line);
        }
    }

    flushPending();
    return sections;
}

/**
 * Decode RFC 5545 TEXT escaping: `\\n` and `\\N` are newlines, and `\\\\`, `\\,`
 * and `\\;` are the literal characters.
 *
 * One pass, not a chain of replacements: decoding `\\n` first and `\\\\` after
 * would read the pair in `\\\\n` as an escaped newline and swallow the
 * backslash that was escaping it. liturgia.pt's feed happens to contain no
 * backslashes at all today, so nothing currently depends on that ordering —
 * which is exactly why it would be a quiet thing to get wrong later.
 *
 * `newline` is what `\\n` becomes: a heading flattens it to a space, while a
 * description keeps the line break.
 */
function unescapeIcsText(value: string, newline: string): string {
    return value.replace(/\\(.)/g, (_match, escaped: string) => {
        if (escaped === 'n' || escaped === 'N') return newline;
        // Anything else escaped stands for itself — including the backslash.
        return escaped;
    });
}

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

    // A day name is a heading, so its newlines flatten to spaces; the
    // description keeps them.
    dayName = unescapeIcsText(dayName, ' ');

    if (descMatch) {
        const rawDesc = descMatch[1].trim();
        description = unescapeIcsText(rawDesc, '\n');

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
    return { dateStr, info: { color, dayName, description, sections: parseDaySections(description) } };
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
