// Dev CLI for the liturgia.pt breviary parsers (src/lib/breviary/).
//
//   npm run parse-lh proprio 1          # January's Próprio dos Santos → JSON
//   npm run parse-lh proprio Janeiro
//   npm run parse-lh comum um-martir    # one Ofício Comum → JSON
//   npm run parse-lh sweep              # every month + common: summary + checks
//   npm run parse-lh generate           # whole corpus → public/lh/*.json
//
// JSON goes to stdout ('generate' writes files); summaries and validation
// warnings to stderr. Downloads are cached in tools/.cache (gitignored).
// The texts are © Secretariado Nacional de Liturgia; `generate` output under
// public/lh/ is committed and served by the app as static data.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { extractLines, type PdfLine } from '../src/lib/breviary/pdfLines.ts';
import { MONTHS, parseProprio, type Month, type ProprioEntry } from '../src/lib/breviary/proprio.ts';
import { COMMON_FILES, parseComum, type ComumDoc } from '../src/lib/breviary/comum.ts';

const BASE_URL = 'https://www.liturgia.pt/lh/pdf/';
const CACHE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '.cache');

const MONTH_FILES: Record<Month, string> = {
    Janeiro: '0901Jan.pdf', Fevereiro: '0902Fev.pdf', Março: '0903Mar.pdf',
    Abril: '0904Abr.pdf', Maio: '0905Mai.pdf', Junho: '0906Jun.pdf',
    Julho: '0907Jul.pdf', Agosto: '0908Ago.pdf', Setembro: '0909Set.pdf',
    Outubro: '0910Out.pdf', Novembro: '0911Nov.pdf', Dezembro: '0912Dez.pdf',
};

async function fetchPdf(file: string): Promise<PdfLine[]> {
    const cached = path.join(CACHE_DIR, file);
    let data: Uint8Array;
    try {
        data = new Uint8Array(await readFile(cached));
    } catch {
        const res = await fetch(BASE_URL + file);
        if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
        data = new Uint8Array(await res.arrayBuffer());
        await mkdir(CACHE_DIR, { recursive: true });
        await writeFile(cached, data);
    }
    return extractLines(await getDocument({ data }).promise);
}

function monthFromArg(arg: string): Month {
    const byNumber = MONTHS[Number(arg) - 1];
    if (byNumber) return byNumber;
    const found = MONTHS.find((m) => m.toLowerCase() === arg.toLowerCase());
    if (!found) throw new Error(`unknown month: ${arg}`);
    return found;
}

// --- Validation: cheap invariants that catch a mis-parse without needing the
// --- texts themselves. The same checks can run on-device after parsing.

function checkProprio(month: Month, entries: ProprioEntry[]): string[] {
    const warnings: string[] = [];
    if (entries.length === 0) warnings.push('no entries parsed');
    for (const e of entries) {
        const id = `${e.day} ${month}`;
        if (!e.name) warnings.push(`${id}: no name`);
        // An entry is covered when it has any of: its own collect, a commons
        // pointer (the collect then comes from the common), a cross-reference
        // note ("Apêndice…", "Como na festa de…"), or proper hours of its
        // own (octave commemorations like S. Silvestre have no commons).
        const hasCollect = e.hours['Oração']?.some((b) => b.kind === 'oração');
        const covered = hasCollect || e.commonsText || e.note || Object.keys(e.hours).length > 0;
        if (!covered) warnings.push(`${id} (${e.name}): no office content at all`);
    }
    return warnings;
}

function checkComum(doc: ComumDoc): string[] {
    const warnings: string[] = [];
    const hours = Object.keys(doc.hours);
    if (!doc.title) warnings.push('no title');
    for (const required of ['Laudes']) {
        if (!hours.includes(required)) warnings.push(`missing ${required}`);
    }
    const laudes = doc.hours['Laudes'] ?? [];
    if (!laudes.some((b) => b.kind === 'ant-benedictus')) {
        warnings.push('Laudes without Benedictus antiphon');
    }
    for (const [hour, blocks] of Object.entries(doc.hours)) {
        if (hour.startsWith('(')) continue; // pseudo-hours are never rendered
        const strays = blocks.filter((b) => b.kind === 'texto').length;
        if (strays > 0) warnings.push(`${hour}: ${strays} unclassified block(s)`);
        // A short-form kind that runs long is swallowed body text.
        for (const b of blocks) {
            if (/^ant/.test(b.kind) && (b.text?.length ?? 0) > 600) {
                warnings.push(`${hour}: over-long ${b.kind} (${b.text!.length} chars)`);
            }
        }
    }
    return warnings;
}

function summarize(hours: Record<string, { kind: string }[]>): string {
    return Object.entries(hours)
        .map(([h, blocks]) => `${h}(${blocks.length})`)
        .join(' ');
}

const [, , command, arg] = process.argv;

if (command === 'proprio' && arg) {
    const month = monthFromArg(arg);
    const entries = parseProprio(await fetchPdf(MONTH_FILES[month]), month);
    console.log(JSON.stringify(entries, null, 1));
    console.error(`# ${month}: ${entries.length} entries`);
    for (const w of checkProprio(month, entries)) console.error(`  ⚠ ${w}`);
} else if (command === 'comum' && arg) {
    const file = COMMON_FILES[arg];
    if (!file) throw new Error(`unknown common: ${arg} (${Object.keys(COMMON_FILES).join(', ')})`);
    const doc = parseComum(await fetchPdf(file));
    console.log(JSON.stringify(doc, null, 1));
    console.error(`# ${arg}: "${doc.title}" — ${summarize(doc.hours)}`);
    for (const w of checkComum(doc)) console.error(`  ⚠ ${w}`);
} else if (command === 'generate') {
    const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'lh');
    await mkdir(outDir, { recursive: true });
    let warnings = 0;
    const months: Record<string, number> = {};
    for (const [i, month] of MONTHS.entries()) {
        const entries = parseProprio(await fetchPdf(MONTH_FILES[month]), month);
        const w = checkProprio(month, entries);
        warnings += w.length;
        for (const msg of w) console.error(`  ⚠ ${msg}`);
        const nn = String(i + 1).padStart(2, '0');
        months[nn] = entries.length;
        await writeFile(path.join(outDir, `proprio-${nn}.json`), JSON.stringify({ month, entries }));
        console.error(`proprio-${nn}.json  ${month}, ${entries.length} entries`);
    }
    for (const [id, file] of Object.entries(COMMON_FILES)) {
        const doc = parseComum(await fetchPdf(file));
        const w = checkComum(doc);
        warnings += w.length;
        for (const msg of w) console.error(`  ⚠ ${msg}`);
        await writeFile(path.join(outDir, `comum-${id}.json`), JSON.stringify(doc));
        console.error(`comum-${id}.json  "${doc.title}"`);
    }
    await writeFile(path.join(outDir, 'index.json'), JSON.stringify({
        source: 'https://www.liturgia.pt/lh/ — © Secretariado Nacional de Liturgia',
        months,
        commons: Object.keys(COMMON_FILES),
    }, null, 1));
    console.error(warnings === 0 ? '\nAll clean.' : `\n${warnings} warning(s).`);
    if (warnings > 0) process.exitCode = 1;
} else if (command === 'sweep') {
    let warnings = 0;
    for (const month of MONTHS) {
        const entries = parseProprio(await fetchPdf(MONTH_FILES[month]), month);
        const w = checkProprio(month, entries);
        warnings += w.length;
        const collects = entries.filter((e) => e.hours['Oração']?.length).length;
        console.error(`${month.padEnd(10)} ${String(entries.length).padStart(2)} entries, ${collects} collects`);
        for (const msg of w) console.error(`  ⚠ ${msg}`);
    }
    for (const [id, file] of Object.entries(COMMON_FILES)) {
        const doc = parseComum(await fetchPdf(file));
        const w = checkComum(doc);
        warnings += w.length;
        console.error(`${id.padEnd(16)} ${summarize(doc.hours)}`);
        for (const msg of w) console.error(`  ⚠ ${msg}`);
    }
    console.error(warnings === 0 ? '\nAll clean.' : `\n${warnings} warning(s).`);
    if (warnings > 0) process.exitCode = 1;
} else {
    console.error('usage: parse-lh proprio <1-12|month> | comum <id> | sweep | generate');
    process.exitCode = 2;
}
