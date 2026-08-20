/**
 * Turns the Cancioneiro dos Convívios Fraternos PDF into src/lib/chants/cf.ts.
 *
 *   node tools/parse-cancioneiro.mjs <cancioneiro.pdf> [out.ts]
 *
 * The book is a two-column Word export with the chords set above the words,
 * so plain text extraction interleaves the columns and loses the stanza
 * breaks. Reading it through pdf.js instead gives, per run of text: where it
 * sits (which column, which line, how big the gap above it) and what face it
 * is set in — and that last one is what marks the refrain. The book prints
 * verses in Calibri and refrains in Calibri Bold. Chords are bold too, but
 * they are recognised by their text and dropped first.
 */
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { readFileSync, writeFileSync } from 'node:fs';

const COLUMN_SPLIT = 250;   // A4, columns at x≈40 and x≈300
const STANZA_GAP = 20;      // normal leading is 13.4
const ROW_TOLERANCE = 2;
const SPACE_GAP = 0.6;      // below this, two runs are one word

const NOTE = '(?:do|re|mi|fa|sol|la|si)';
const UNIT = `${NOTE}[#b]?(?:[-m]|maj|dim|aug|sus)*\\d*`;
const CHORD = new RegExp(`^(?:${UNIT})(?:[/-]?(?:${UNIT}))*$`);
const ANNOTATION = /^(?:\(\d+x\)|\(?bis\)?|-{1,2}>?|\||\d+x)$/i;
const ACCENTS = { á: 'a', à: 'a', â: 'a', ã: 'a', é: 'e', è: 'e', ê: 'e', í: 'i', ì: 'i', î: 'i', ó: 'o', ò: 'o', ô: 'o', õ: 'o', ú: 'u', ù: 'u', û: 'u', ç: 'c' };

const SONG = /^(\d{1,3})\s*[.\-]\s*(.+)$/;
const SECTION_HEADING = /^MÚSICAS DE |^EXTRAS$/i;
const SMALL = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'as', 'os', 'em', 'no', 'na', 'nos', 'nas', 'para', 'por', 'com', 'que', 'um', 'uma', 'ao', 'aos', 'à', 'às', 'pela', 'pelo', 'se', 'me', 'te']);

const fold = (token) =>
    [...token.toLowerCase()].map((c) => ACCENTS[c] ?? c).join('').replace(/^[[(<,;:.–—]+|[\])>,;:.–—]+$/g, '');

function isChordLine(text) {
    // Chords are always capitalised, which is what stops a sung "la la la"
    // from being read as three A chords and thrown away.
    if (!/^\p{Lu}/u.test(text)) return false;
    const tokens = text.split(/\s+/).map(fold).filter(Boolean);
    return tokens.length > 0 && tokens.every((t) => CHORD.test(t) || ANNOTATION.test(t));
}

const isTitle = (text) => {
    const letters = [...text].filter((c) => /\p{L}/u.test(c));
    return letters.length >= 3 && letters.filter((c) => c === c.toUpperCase()).length / letters.length > 0.75;
};

/** Groups a page's text runs into lines, per column, top to bottom. */
function pageLines(items, fontOf) {
    const columns = [[], []];
    for (const item of items) {
        if (!item.str.trim()) continue;
        const x = item.transform[4];
        const y = item.transform[5];
        const rows = columns[x < COLUMN_SPLIT ? 0 : 1];
        const row = rows.find((r) => Math.abs(r.y - y) <= ROW_TOLERANCE);
        (row ?? rows[rows.push({ y, runs: [] }) - 1]).runs.push({
            x, width: item.width, str: item.str, bold: fontOf(item).includes('Bold'),
        });
    }

    const out = [];
    for (const rows of columns) {
        rows.sort((a, b) => b.y - a.y);   // PDF y grows upward
        let previousY = null;
        for (const row of rows) {
            row.runs.sort((a, b) => a.x - b.x);
            let text = '';
            for (const [i, run] of row.runs.entries()) {
                const previous = row.runs[i - 1];
                if (previous && run.x - (previous.x + previous.width) > SPACE_GAP) text += ' ';
                text += run.str;
            }
            text = text.replace(/\s+/g, ' ').trim();
            if (!text) continue;
            // A line counts as bold when its words are: the chord runs mixed
            // into a lyric row would otherwise tip every line over.
            const boldWidth = row.runs.filter((r) => r.bold).reduce((n, r) => n + r.width, 0);
            const totalWidth = row.runs.reduce((n, r) => n + r.width, 0);
            out.push({
                text,
                bold: totalWidth > 0 && boldWidth / totalWidth > 0.6,
                gap: previousY !== null && previousY - row.y > STANZA_GAP,
            });
            previousY = row.y;
        }
    }
    return out;
}

async function readSongs(pdfPath) {
    const doc = await getDocument({ data: new Uint8Array(readFileSync(pdfPath)) }).promise;
    const songs = [];
    let current = null;
    let section = null;
    let pendingGap = false;

    for (let p = 1; p <= doc.numPages; p++) {
        const page = await doc.getPage(p);
        // commonObjs is only populated once the operator list is built; without
        // this the font names come back as opaque ids and every line looks the
        // same weight.
        await page.getOperatorList();
        const content = await page.getTextContent();
        const fontOf = (item) => {
            try { return page.commonObjs.get(item.fontName)?.name ?? ''; } catch { return ''; }
        };

        const lines = pageLines(content.items, fontOf);
        // The section heading sits in whichever column has room for it, so it
        // has to be read off the whole page first — otherwise every song in
        // the left column is filed under the previous page's heading.
        for (const line of lines) {
            if (SECTION_HEADING.test(line.text)) section = line.text;
        }

        for (const line of lines) {
            const { text } = line;
            if (/^ÍNDICE/i.test(text)) return { songs, section };
            if (SECTION_HEADING.test(text)) {
                current = null;
                continue;
            }
            const header = SONG.exec(text);
            if (header && isTitle(header[2])) {
                current = { number: Number(header[1]), title: header[2].trim(), section, lines: [] };
                songs.push(current);
                pendingGap = false;
                continue;
            }
            if (!current) continue;
            if (isChordLine(text)) {
                // The stanza break sits above the chord line that opens the
                // next stanza, so it has to survive the chord being dropped.
                pendingGap ||= line.gap;
                continue;
            }
            if ((line.gap || pendingGap) && current.lines.length) current.lines.push(null);
            pendingGap = false;
            current.lines.push(line);
        }
    }
    return { songs };
}

// ── shaping ──────────────────────────────────────────────────────────────

const titleCase = (text) =>
    text.trim().replace(/\.$/, '').split(/\s+/)
        .map((word, i) => {
            const core = word.replace(/^[("[]+|[)"\],;:!?]+$/g, '');
            if (core === 'CF') return word;
            if (i > 0 && SMALL.has(core.toLowerCase())) return word.toLowerCase();
            return word[0].toUpperCase() + word.slice(1).toLowerCase();
        })
        .join(' ')
        .replace(/\b(i{1,3}|iv|vi{0,3})\b/g, (m) => m.toUpperCase());

const slugify = (text) =>
    text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const escapeTemplate = (text) => text.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

/** Splits a song's lines into stanzas and marks the bold ones as refrains. */
function toText(lines) {
    const stanzas = [];
    let stanza = [];
    for (const line of lines) {
        if (line === null) {
            if (stanza.length) stanzas.push(stanza);
            stanza = [];
        } else {
            stanza.push(line);
        }
    }
    if (stanza.length) stanzas.push(stanza);

    return stanzas
        .map((group) => {
            const bold = group.filter((l) => l.bold).length;
            const body = group.map((l) => l.text).join('\n');
            // A stanza is the refrain when most of it is set bold. Requiring a
            // majority rather than all of it tolerates the odd word the export
            // left in the other weight.
            return bold / group.length > 0.6 ? `R. ${body}` : body;
        })
        .join('\n\n')
        .trim();
}

const HEAD = `import type { Chant } from './types';

/**
 * The Cancioneiro dos Convívios Fraternos, transcribed from the movement's own
 * songbook (versão 1, com acordes) and used with the CF secretariat's
 * permission. The chords are dropped — this is a prayer app, not a chordsheet
 * — and the stanza breaks and refrains are the book's own: it prints its
 * verses in Calibri and its refrains in Calibri Bold.
 *
 * Generated by tools/parse-cancioneiro.mjs. Hand corrections belong here; a
 * re-run overwrites the file.
 */
export const CF_CHANTS: Chant[] = [
`;

const [pdfPath, outPath = 'src/lib/chants/cf.ts'] = process.argv.slice(2);
const { songs } = await readSongs(pdfPath);

const seen = new Set();
const chunks = [HEAD];
let kept = 0;
let refrains = 0;
for (const song of songs) {
    const text = toText(song.lines);
    if (text.length < 80) continue;          // index stubs and stray fragments
    let id = `cf-${slugify(song.title)}`;
    if (seen.has(id)) id = `${id}-${song.number}`;
    seen.add(id);
    const animation = /anima/i.test(song.section ?? '');
    const kind = animation ? 'Música de animação' : 'Música de reflexão';
    chunks.push(
        `    {\n` +
        `        id: '${id}',\n` +
        `        title: ${JSON.stringify(titleCase(song.title))},\n` +
        `        category: '${animation ? 'cf-animacao' : 'cf-reflexao'}',\n` +
        `        note: 'Cancioneiro dos Convívios Fraternos, n.º ${song.number} · ${kind}',\n` +
        `        text: \`${escapeTemplate(text)}\`,\n` +
        `    },\n`,
    );
    kept += 1;
    if (text.includes('R. ')) refrains += 1;
}
chunks.push('];\n');
writeFileSync(outPath, chunks.join(''));
console.log(`${kept} songs written to ${outPath}; ${refrains} with a refrain marked`);
