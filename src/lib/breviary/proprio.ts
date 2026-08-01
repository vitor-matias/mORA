// Parser for the monthly Próprio dos Santos PDFs (liturgia.pt/lh,
// 0901Jan.pdf … 0912Dez.pdf): per saint, the proper elements of the office —
// always the collect, plus Benedictus/Magnificat antiphons on memorials and
// full hour structures on feasts. The rest of a saint's office comes from
// the Ofício Comum the entry points at (comum.ts) and the ferial psalter.

import type { PdfLine } from './pdfLines.ts';
import { afterDespaced, assembleHymn, despace, joinLines, joinProse, prettifyRef, splitColumns, type HymnLine } from './text.ts';

export const MONTHS = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
] as const;
export type Month = (typeof MONTHS)[number];

export interface ProprioBlock {
    kind: string;
    ref?: string;
    text: string;
}

export interface ProprioEntry {
    day: number;
    /** Second (or later) celebration of the same day ("No mesmo dia …"). */
    sameDay?: boolean;
    name: string | null;
    descriptor: string | null;
    rank: string;
    /** The original pointer wording — keeps the "ou" choice for the UI. */
    commonsText?: string;
    /** Common ids in the order offered (first = default); see COMMON_FILES. */
    commons: string[];
    /**
     * Cross-reference rubric instead of (or besides) content: "Apêndice VI,
     * p. 2079." points into the printed book (absent from the web corpus);
     * "Como na festa de S. Marcos, dia 25 de Abril, excepto:" borrows
     * another proper's office.
     */
    note?: string;
    bio: string;
    hours: Record<string, ProprioBlock[]>;
}

const HOURS = [
    'Invitatório', 'Laudes', 'Hora Intermédia', 'Tércia', 'Sexta', 'Noa',
    'Vésperas', 'Vésperas I', 'Vésperas II', 'Oração',
];
const RANKS = ['Memória', 'Memória facultativa', 'Festa', 'Solenidade'];

// Subsection labels within an hour, matched on despaced text (see text.ts).
const LABELS: { re: RegExp; kind: string; skip: number; verseLike?: boolean }[] = [
    { re: /^hino/, kind: 'hino', skip: 4, verseLike: true },
    { re: /^salmodia/, kind: 'salmodia', skip: 8 },
    { re: /^leiturabreve/, kind: 'leitura breve', skip: 12 },
    { re: /^respons[óo]riobreve/, kind: 'responsório breve', skip: 16, verseLike: true },
    { re: /^preces/, kind: 'preces', skip: 6, verseLike: true },
];

// "Comum dos Pastores ou dos Doutores da Igreja" → ['pastores', 'doutores'].
const COMMON_IDS: [RegExp, string][] = [
    [/defuntos/i, 'defuntos'],
    [/dedicação/i, 'dedicacao-igreja'],
    [/nossa senhora/i, 'nossa-senhora'],
    [/apóstolos/i, 'apostolos'],
    [/vários mártires/i, 'varios-martires'],
    [/(?:um|uma) mártir|mártir(?!es)/i, 'um-martir'],
    [/pastores/i, 'pastores'],
    [/doutores/i, 'doutores'],
    [/virgens/i, 'virgens'],
    [/santas/i, 'santas'],
    [/santos/i, 'santos'],
];

/**
 * Small-caps glyphs occasionally extract as lowercase inside an ALL-CAPS
 * name ("EyMARD") — a word with capitals on both sides of a lowercase run
 * was meant to be all caps.
 */
function fixSmallCapsWords(name: string): string {
    return name.replace(/\S+/g, (w) =>
        /^[A-ZÀ-Ú].*[a-zà-ú].*[A-ZÀ-Ú]/.test(w) ? w.toUpperCase() : w
    );
}

export function parseCommonsPointer(text: string): string[] {
    return COMMON_IDS
        .map(([re, id]) => ({ id, at: text.search(re) }))
        .filter((m) => m.at >= 0)
        .sort((a, b) => a.at - b.at)
        .map((m) => m.id);
}

interface OpenSub {
    kind: string;
    ref?: string;
    buf: string[];
    /** Positioned hymn lines, reassembled by assembleHymn at flush. */
    hymn?: HymnLine[];
    /** Join as one line per verse (hymns, responsories, preces). */
    verseLike?: boolean;
}

export function parseProprio(lines: PdfLine[], month: Month): ProprioEntry[] {
    // Some months set the name lowercase ("3 de julho" vs "2 de Janeiro") —
    // accept both. Running heads are filtered before this regex is tried, so
    // the ALL-CAPS forms can't leak in.
    const dateRe = new RegExp(`^(No mesmo dia )?(\\d+) de (?:${month}|${month.toLowerCase()})$`);
    // Case-sensitive on purpose: running heads are ALL CAPS ("20 E 21 DE
    // JANEIRO"), real entry headers are "2 de Janeiro".
    const headRe = new RegExp(
        `^(\\d+|\\d+ ?(E \\d+ )?DE ${month.toUpperCase()}|PRÓPRIO DOS SANTOS|${month.toUpperCase()})$`
    );

    const entries: ProprioEntry[] = [];
    let cur: ProprioEntry | null = null;
    let section: string | null = null;
    let sub: OpenSub | null = null;
    // A commons pointer may wrap onto an "ou dos …" second line; only the
    // line immediately after the capture qualifies.
    let commonsOpen = false;

    const flushSub = () => {
        if (!cur || !sub || (sub.buf.length === 0 && !sub.hymn?.length)) {
            sub = null;
            return;
        }
        const text = sub.hymn
            ? assembleHymn(sub.hymn)
            : sub.verseLike ? joinLines(sub.buf) : joinProse(sub.buf);
        if (sub.kind === 'bio') {
            cur.bio = cur.bio ? `${cur.bio}\n${text}` : text;
        } else if (section) {
            (cur.hours[section] ??= []).push({ kind: sub.kind, ref: sub.ref, text });
        }
        sub = null;
    };

    for (const l of lines) {
        const text = l.text.replace(/\s+/g, ' ').trim();
        if (!text || headRe.test(text)) continue;
        // Small-caps running heads ("21 DE SETEMBRO" at h=7) can carry
        // lowercase glyphs that dodge headRe — tiny type is signal enough.
        if (l.h <= 7.5 && text.length > 4) continue;

        if (commonsOpen && cur && l.h === 9 && /^ou\b/.test(text)) {
            cur.commonsText = `${cur.commonsText} ${text.replace(/\.$/, '')}`;
            cur.commons = parseCommonsPointer(cur.commonsText);
            commonsOpen = false;
            continue;
        }
        commonsOpen = false;

        const dateMatch = text.match(dateRe);
        if (dateMatch && l.x > 90) {
            flushSub();
            cur = {
                day: Number(dateMatch[2]),
                sameDay: dateMatch[1] ? true : undefined,
                name: null,
                descriptor: null,
                // Entries never state this rank — only the absence of one.
                rank: 'Memória facultativa',
                commons: [],
                bio: '',
                hours: {},
            };
            entries.push(cur);
            section = null;
            continue;
        }
        if (!cur) continue;

        // Name / descriptor (h=10, before any section). Caps ratio is judged
        // on the part before the comma — the descriptor may be lowercase
        // ("bispo e doutor da Igreja") or capitalised ("Apóstolo e
        // Evangelista") and would dilute it either way.
        if (!section && l.h >= 10 && !HOURS.includes(text)) {
            const m = text.match(/^(.*?),\s*(.+)$/);
            const namePart = m ? m[1] : text;
            const caps = namePart.replace(/[^A-ZÁÉÍÓÚÂÊÔÃÕÇ]/g, '').length;
            if (!cur.name && caps > namePart.length / 3) {
                if (m) {
                    cur.name = fixSmallCapsWords(m[1]);
                    cur.descriptor = m[2];
                } else {
                    // The descriptor may wrap to the next line, leaving the
                    // name's trailing comma behind.
                    cur.name = fixSmallCapsWords(text.replace(/,$/, ''));
                }
                continue;
            }
            if (cur.name && !cur.descriptor && /^[a-zà-ú]/.test(text)) {
                cur.descriptor = text;
                continue;
            }
        }

        if (RANKS.includes(text) && l.x > 90) {
            cur.rank = text;
            continue;
        }

        // Hour header. No size test: "Oração" is set at h=9 unlike the h=10
        // hour headers, but all are centered exact matches.
        if (HOURS.includes(text) && l.x > 90) {
            flushSub();
            section = text;
            if (text === 'Oração') sub = { kind: 'oração', buf: [] };
            continue;
        }

        // Commons pointer, in any of its phrasings ("Comum dos Pastores…",
        // "Comum aos…", "Do/Tudo do/Ofício do Comum…", "Ofício de
        // Defuntos"), possibly wrapping onto an "ou dos …" second line.
        if (l.h === 9 && /^(?:(?:Tudo do|Do|Ofício do) )?Comum\b|^Ofício de Defuntos\b/.test(text)) {
            flushSub();
            const raw = text.replace(/\.$/, '');
            cur.commonsText = raw;
            cur.commons = parseCommonsPointer(raw);
            // "…, excepto:" introduces proper elements with no header of
            // their own — almost always the collect (S. Catarina, 25 Nov).
            if (/:$/.test(raw)) {
                section = 'Oração';
                sub = { kind: 'oração', buf: [] };
            } else {
                section = null;
                commonsOpen = true;
            }
            continue;
        }

        // Cross-reference rubric (see ProprioEntry.note).
        if (l.h === 9 && /^(?:Apêndice|Como n)/.test(text)) {
            flushSub();
            cur.note = cur.note ? `${cur.note}; ${text}` : text;
            section = null;
            continue;
        }

        // Biography: h=9 body before the first hour of the entry.
        if (l.h === 9 && (!section || section === 'bio')) {
            if (!sub) sub = { kind: 'bio', buf: [] };
            sub.buf.push(text);
            section = 'bio';
            continue;
        }

        if (section && section !== 'bio') {
            const ant = text.match(/^Ant\.\s*(Bened|Magn(?:if)?)\.?\s*(.*)$/);
            if (ant) {
                flushSub();
                sub = {
                    kind: ant[1].startsWith('B') ? 'ant-benedictus' : 'ant-magnificat',
                    buf: [ant[2]],
                };
                continue;
            }
            const label = LABELS.find((L) => L.re.test(despace(text)));
            if (label && l.x < 90 && text.length < 60) {
                flushSub();
                sub = {
                    kind: label.kind,
                    ref: prettifyRef(afterDespaced(text, label.skip)) || undefined,
                    buf: [],
                    verseLike: label.verseLike,
                };
                continue;
            }
            if (!sub) sub = { kind: 'texto', buf: [] };
            if (sub.kind === 'hino') {
                // Positioned lines: assembleHymn restores stanza reading
                // order from column and y-band at flush.
                const { left, right, rightX } = splitColumns(l.items);
                (sub.hymn ??= []).push({ p: l.p, y: l.y, x: l.x, t: left });
                if (right) sub.hymn.push({ p: l.p, y: l.y, x: rightX, t: right });
                continue;
            }
            sub.buf.push(text);
            continue;
        }
    }
    flushSub();

    // Some entries print the same collect at both Laudes and Vésperas
    // (S. Inês, S. Marcos…); both land under "Oração" and would render as
    // duplicate prayers. Identical blocks within an hour are never
    // meaningful — keep the first.
    for (const entry of entries) {
        for (const [hour, blocks] of Object.entries(entry.hours)) {
            const seen = new Set<string>();
            entry.hours[hour] = blocks.filter((b) => {
                const key = `${b.kind} ${b.text}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
        }
    }

    return entries;
}
