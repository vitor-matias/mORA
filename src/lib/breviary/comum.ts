// Parser for the Ofícios Comuns PDFs (liturgia.pt/lh, 1001…1012): the full
// office bodies — hymns, psalmody with complete psalm texts, short readings,
// responsories, preces and collects — that fill whatever a saint's Próprio
// entry (proprio.ts) does not provide.
//
// Blocks carry two variant dimensions the assembler must resolve:
//   season  — "Tempo Pascal" / "Fora do Tempo Pascal" alternatives
//   variant — "Para um Santo Mártir" / "Para uma Santa Mártir" alternatives

import type { PdfLine } from './pdfLines.ts';
import { afterDespaced, assembleHymn, despace, joinProse, joinVerse, prettifyRef, splitColumns, type HymnLine, type VerseLine } from './text.ts';

/** Common id (as produced by proprio.ts parseCommonsPointer) → PDF file. */
export const COMMON_FILES: Record<string, string> = {
    'dedicacao-igreja': '1001DedicaIgreja.pdf',
    'nossa-senhora': '1002NossaSenhora.pdf',
    'ns-sabado': '1003NSSabado.pdf',
    'apostolos': '1004Apostolos.pdf',
    'varios-martires': '1005VariosMartires.pdf',
    'um-martir': '1006UmMartir.pdf',
    'pastores': '1007Pastores.pdf',
    'doutores': '1008Doutores.pdf',
    'virgens': '1009Virgens.pdf',
    'santos': '1010Santos.pdf',
    'santas': '1011Santas.pdf',
    'defuntos': '1012Defuntos.pdf',
    // Not a common: the Salmodia Complementar (séries I–III, one per hour
    // in the doc's `hours`), which the Defuntos' Hora Intermédia points to.
    'complementar': '0806SalmComple.pdf',
};

export interface ComumVerse {
    n?: number;
    text: string;
    /** Second half of a verse (after the "*"), set indented in the book. */
    indent?: boolean;
    /** Opens a new stanza (a wider gap above it in the book). */
    stanza?: boolean;
}

export interface ComumBlock {
    kind: string;
    ref?: string;
    /** Psalmody position for numbered antiphons ("Ant. 1"). */
    n?: number;
    season?: string;
    variant?: string;
    text?: string;
    verses?: ComumVerse[];
    /**
     * Ofício de Leitura readings: "Dos Sermões de…" attribution; psalms:
     * the epigraph under the title ("Pacientes na tribulação… (Rom 12, 12)").
     */
    source?: string;
    /** The reading's own heading, or the psalm's ("Anseio de paz"). */
    title?: string;
}

export interface ComumDoc {
    title: string | null;
    /** "I – PARA VÁRIOS MÁRTIRES" — variant subtitle under the title. */
    subtitle?: string;
    /**
     * Inheritance rubric: "Como no Comum dos Pastores da Igreja, excepto:" —
     * this common is an overlay on another, and the assembler must start
     * from the base one.
     */
    note?: string;
    hours: Record<string, ComumBlock[]>;
}

// Plain "Vésperas" and the Ofício de Leitura are the Defuntos office's
// alone — the commons proper use "Vésperas I/II" and have no readings.
const HOURS = ['Vésperas', 'Vésperas I', 'Vésperas II', 'Invitatório', 'Ofício de Leitura', 'Laudes', 'Hora Intermédia', 'Completas'];
const SUB_HOURS = ['Tércia', 'Sexta', 'Noa']; // left-aligned, unlike the above
const SEASONS = [
    'Tempo Pascal', 'Fora do Tempo Pascal',
    'Tempo do Advento', 'Tempo do Natal', 'Tempo da Quaresma',
];

const LABELS: { re: RegExp; kind: string; skip: number }[] = [
    { re: /^hino/, kind: 'hino', skip: 4 },
    { re: /^salmodia/, kind: 'salmodia', skip: 8 },
    { re: /^leiturabreve/, kind: 'leitura', skip: 12 },
    { re: /^respons[óo]riobreve/, kind: 'responsório', skip: 16 },
    // The Ofício de Leitura's: the long responsory after each reading.
    { re: /^respons[óo]rio/, kind: 'responsório-leitura', skip: 11 },
    { re: /^primeiraleitura/, kind: 'leitura-1', skip: 15 },
    { re: /^segundaleitura/, kind: 'leitura-2', skip: 14 },
    { re: /^c[âa]nti[cç]oevang[ée]li[cç]o/, kind: 'evangélico', skip: 0 },
    { re: /^preces/, kind: 'preces', skip: 6 },
];
const VERSE_LIKE = new Set(['responsório', 'responsório-leitura', 'versículo', 'preces', 'hino']);
const READINGS = new Set(['leitura-1', 'leitura-2']);
/** Paragraph break marker inside a reading's line buffer. */
const PARA = '\u00b6';

interface OpenBlock extends ComumBlock {
    buf?: (string | VerseLine)[];
    /** Positioned hymn lines, reassembled by assembleHymn at flush. */
    hymn?: HymnLine[];
    verseLike?: boolean;
    /** Reading still in its attribution/heading lines. */
    head?: boolean;
    /** Preces still in their margin-set introduction. */
    intro?: boolean;
}

export function parseComum(lines: PdfLine[]): ComumDoc {
    const doc: ComumDoc = { title: null, hours: {} };
    let hour: string | null = null;
    let season: string | undefined; // current seasonal-alternative run
    // Season rubrics come in pairs ("Fora do Tempo Pascal" … "Tempo Pascal")
    // over the same slots. The first run records which kinds the
    // alternatives cover; the second run ends — and season-neutral content
    // resumes — at the first block kind the first run did not contain
    // (e.g. preces after the two seasonal responsórios).
    let seasonRun: { kinds: Set<string>; second: boolean } | null = null;
    // A season rubric with no open run and no "Fora …" partner tags only the
    // single alternative block that follows (Defuntos inserts a Paschal
    // Benedictus antiphon into otherwise neutral content).
    let seasonOneShot = false;
    let variant: string | undefined; // "Para um Santo Mártir" — sticky likewise
    let canticle: string | null = null; // Magnificat/Benedictus for the next Ant.
    let psalmBase: string | null = null; // for bare roman-numeral divisions
    let block: OpenBlock | null = null;
    let pendingVerse: number | null = null;
    let lastVerse: { p: number; y: number } | null = null;

    const blocksOf = () => (doc.hours[(hour ??= '(preâmbulo)')] ??= []);
    /** The season a new block of `kind` belongs to, ending runs as needed. */
    const seasonFor = (kind: string): string | undefined => {
        if (!season) return undefined;
        if (seasonOneShot) {
            const s = season;
            seasonOneShot = false;
            season = undefined;
            return s;
        }
        if (!seasonRun) return season;
        if (!seasonRun.second) {
            seasonRun.kinds.add(kind);
            return season;
        }
        if (seasonRun.kinds.has(kind)) return season;
        season = undefined;
        seasonRun = null;
        return undefined;
    };
    const isEmpty = (b: OpenBlock) =>
        !b.hymn?.length && (b.buf ? b.buf.length === 0 : !b.verses?.length);
    const flush = () => {
        if (!block) return;
        if (block.hymn) {
            block.text = assembleHymn(block.hymn);
            delete block.hymn;
            delete block.buf;
            delete block.verseLike;
        } else if (block.buf && READINGS.has(block.kind)) {
            block.text = (block.buf as string[])
                .join('\n')
                .split(PARA)
                .map((para) => joinProse(para.split('\n')))
                .filter(Boolean)
                .join('\n\n');
            delete block.buf;
            delete block.head;
        } else if (block.buf) {
            block.text = block.verseLike
                ? joinVerse(block.buf as VerseLine[])
                : joinProse(block.buf as string[]);
            delete block.buf;
            delete block.verseLike;
            delete block.intro;
        }
        if (block.verses?.length || block.text) {
            blocksOf().push(block);
            // A one-shot season is spent once its tagged block lands.
            if (seasonOneShot && block.season === season) {
                seasonOneShot = false;
                season = undefined;
            }
        }
        block = null;
    };

    for (const l of lines) {
        const text = l.text.replace(/\s+/g, ' ').trim();
        if (!text) continue;
        // Superscript verse number, printed as its own tiny line. Only one
        // at the line start numbers a psalm verse; mid-line ones (inside
        // readings, "Aparecendo como homem, ⁸humilhou-Se") are dropped.
        if (l.h < 6 && /^\d+$/.test(text)) {
            if (block?.kind === 'salmo' && l.x < 35) pendingVerse = Number(text);
            continue;
        }
        if (/^\d+$/.test(text)) continue; // page numbers
        // Running heads: tiny type is signal enough — the uppercase test
        // would miss small-caps heads whose lowercase glyphs survive
        // ("VéSPERAS II"). Nothing legitimate is this small: body text is
        // h≥9 and verse superscripts are short digit runs.
        if (l.h <= 7.5 && text.length > 4) continue;
        const despaced = despace(text);

        // Appendix of alternative hymns after the last hour — parked under
        // a pseudo-hour so the assembled office never includes it.
        if (/^outros?hinos?$/.test(despaced) || /^outrasora[çc][õo]es$/.test(despaced)) {
            flush();
            hour = '(outros hinos)';
            season = undefined;
            variant = undefined;
            canticle = null;
            psalmBase = null;
            continue;
        }

        // Hour header (centered) or sub-hour (left-aligned, h=10) — checked
        // before front matter, or the fallback title rule would swallow the
        // first hour of a document whose title lives in its running heads.
        if ((HOURS.includes(text) && l.x > 90) || (SUB_HOURS.includes(text) && l.h >= 10)) {
            flush();
            hour = text;
            season = undefined;
            variant = undefined;
            canticle = null;
            psalmBase = null;
            continue;
        }

        // Salmodia Complementar: "Série I (Salmodia para Tércia)" heads
        // each series ("Série III" sets its hour on a line of its own).
        const serie = text.match(/^Série (I{1,3})\b/);
        if (serie && l.h >= 10 && l.x < 35) {
            flush();
            hour = `Série ${serie[1]}`;
            variant = undefined;
            canticle = null;
            psalmBase = null;
            continue;
        }
        if (/^\(Salmodia para \S+\)$/.test(text)) continue;

        // Front matter: an ALL-CAPS "COMUM D…"/"OFÍCIO D…" heading (possibly
        // sharing its line with an inheritance rubric), a centered subtitle
        // ("II – PARA UM MÁRTIR"), or the inheritance rubric on its own.
        if (!hour) {
            const merged = text.match(/^((?:COMUM|OFÍCIO) D[A-ZÀ-Ú ]+?)\s+(Como no Comum .*)$/);
            if (merged) {
                doc.title ??= merged[1];
                doc.note = merged[2];
                continue;
            }
            if (/^(?:COMUM|OFÍCIO) D/.test(text)) {
                doc.title ??= text;
                continue;
            }
            // Title wrapping onto a second ALL-CAPS line ("COMUM DA
            // DEDICAÇÃO" / "DE UMA IGREJA").
            if (doc.title && /^[A-ZÀ-Ú ,]+$/.test(text)) {
                doc.title += ` ${text}`;
                continue;
            }
            if (/^[IVX]+ ?[–—-] /.test(text)) {
                doc.subtitle = text;
                continue;
            }
            if (/^Como no Comum /.test(text)) {
                doc.note = text;
                continue;
            }
            if (!doc.title && l.h >= 10 && (l.x > 60 || l.h >= 12)) {
                doc.title = text;
                continue;
            }
        }

        // No size or position test: usually h=9 centered, but Pastores sets
        // these left-aligned at x=42.5 — the exact match is signal enough.
        // Mid-block ("Responsório breve" then per-season alternatives), the
        // same attach-or-sibling rule as variants applies, or the second
        // season's lines would be orphaned by the flush.
        if (SEASONS.includes(text)) {
            const runOpen = season !== undefined && seasonRun !== null;
            if (text === 'Fora do Tempo Pascal' || runOpen) {
                // Paired form: "Fora …" opens a run; its partner continues it.
                if (!runOpen) seasonRun = { kinds: new Set(), second: false };
                else seasonRun!.second = true;
                season = text;
                seasonOneShot = false;
                variant = undefined;
                if (block && isEmpty(block)) {
                    block.season = text;
                    if (!seasonRun!.second) seasonRun!.kinds.add(block.kind);
                } else if (block) {
                    const kind: string = block.kind;
                    const ref: string | undefined = block.ref;
                    flush();
                    if (!seasonRun!.second) seasonRun!.kinds.add(kind);
                    block = { kind, ref, season, buf: [], verseLike: VERSE_LIKE.has(kind) };
                }
            } else {
                // Unpaired insert: tag only the following alternative. It may
                // arrive as a bare continuation of the current kind (the
                // Paschal Magnificat antiphon given without its own "Ant."),
                // so reopen a same-kind sibling carrying the season; the
                // one-shot is consumed when a tagged block lands (see flush
                // and seasonFor).
                season = text;
                seasonRun = null;
                seasonOneShot = true;
                variant = undefined;
                if (block && isEmpty(block)) {
                    block.season = text;
                } else if (block) {
                    const kind: string = block.kind;
                    const ref: string | undefined = block.ref;
                    flush();
                    block = { kind, ref, season: text, buf: [], verseLike: VERSE_LIKE.has(kind) };
                }
            }
            continue;
        }

        // Audience/variant rubric. When a label just opened an empty block
        // ("Responsório breve" then "Para um Santo Mártir"), the variant
        // belongs to that block; when the block already has content, this
        // starts its same-kind sibling for the next variant.
        if (l.h === 9 && l.x > 35 && l.x < 70 && /^Para (um|uma|vários|várias)\b/.test(text)) {
            variant = text;
            if (block && isEmpty(block)) {
                block.variant = text;
            } else if (block) {
                const kind: string = block.kind;
                const ref: string | undefined = block.ref;
                flush();
                block = { kind, ref, season, variant, buf: [], verseLike: VERSE_LIKE.has(kind) };
            }
            continue;
        }

        // Psalm / canticle heading (centered, small) — or a bare roman
        // numeral continuing the previous psalm's divisions ("II").
        if (l.h === 9 && l.x > 90 && /^(Salmo|Cântico)\b/.test(text)) {
            flush();
            psalmBase = text.replace(/,\s*[IVX]+$/, '');
            block = { kind: 'salmo', ref: text, season: seasonFor('salmo'), variant, verses: [] };
            continue;
        }
        if (l.h === 9 && l.x > 90 && /^[IVX]+$/.test(text) && psalmBase) {
            flush();
            block = { kind: 'salmo', ref: `${psalmBase}, ${text}`, season: seasonFor('salmo'), variant, verses: [] };
            continue;
        }

        // Section label (h=10, left) — despace-tolerant small caps
        const label =
            l.h >= 10 && l.x < 90 && text.length < 60
                ? LABELS.find((L) => L.re.test(despaced))
                : null;
        if (label) {
            flush();
            canticle = null;
            if (label.kind === 'evangélico') {
                // The content is the Ant. that follows; remember which canticle.
                canticle = /magnificat/.test(despaced) ? 'Magnificat' : 'Benedictus';
                continue;
            }
            if (label.kind === 'salmodia') continue; // structural marker only
            block = {
                kind: label.kind,
                ref: prettifyRef(afterDespaced(text, label.skip)) || undefined,
                season: seasonFor(label.kind),
                variant,
                buf: [],
                verseLike: VERSE_LIKE.has(label.kind),
                head: READINGS.has(label.kind) || undefined,
            };
            continue;
        }

        // Centered "Oração" header (h=9, unlike the h=10 labels)
        if (text === 'Oração' && l.x > 90) {
            flush();
            canticle = null;
            block = { kind: 'oração', season: seasonFor('oração'), variant, buf: [] };
            continue;
        }

        // "Pai nosso" closes the preces as a bare cue line.
        if (text === 'Pai nosso') {
            flush();
            blocksOf().push({ kind: 'rubrica', season: seasonFor('rubrica'), variant, text });
            continue;
        }

        // Heading over the inline sub-hour antiphon list below — the
        // assembler keeps only the chosen sub-hour's antiphon.
        if (text === 'Antífona' && hour === 'Hora Intermédia') continue;

        // Inline sub-hour antiphon list ("Tércia Voltai-Vos para mim…"), as
        // the Ofício de Defuntos sets its Hora Intermédia.
        const inlineSub = text.match(/^(Tércia|Sexta|Noa) (\S.*)$/);
        if (inlineSub && hour === 'Hora Intermédia') {
            flush();
            block = { kind: 'ant', variant: inlineSub[1], season: seasonFor('ant'), buf: [inlineSub[2]] };
            continue;
        }

        // Antiphon: numbered opens a psalm group; bare after a psalm is the
        // repeat; after a Cântico evangélico label it belongs to that canticle.
        const ant = text.match(/^Ant\.\s*(\d+)?\s*(.*)$/);
        if (ant && l.x > 35 && l.x < 70) {
            flush();
            const kind = canticle
                ? canticle === 'Magnificat' ? 'ant-magnificat' : 'ant-benedictus'
                : 'ant';
            block = {
                kind,
                n: ant[1] ? Number(ant[1]) : undefined,
                season: seasonFor(kind),
                variant,
                buf: [ant[2]],
            };
            continue;
        }

        if (block?.kind === 'salmo') {
            // Small type before the first verse is the psalm's title, then
            // its epigraph (Salmodia Complementar).
            if (l.h === 9 && block.verses!.length === 0) {
                if (!block.title) block.title = text;
                else block.source = block.source ? `${block.source} ${text}` : text;
                continue;
            }
            // Small type after a psalm is a rubric ("Para as outras Horas,
            // a Salmodia Complementar…"), not a verse.
            if (l.h === 9) {
                flush();
                blocksOf().push({ kind: 'rubrica', season: seasonFor('rubrica'), variant, text });
                continue;
            }
            // A stray repeat of an earlier line (Salmo 126 in the
            // Complementar) is a typesetting leftover.
            if (block.verses!.some((v) => v.text === text)) continue;
            // Lines step ≈10.5pt; a stanza break adds ≈5 more.
            const stanza = block.verses!.length > 0 && lastVerse?.p === l.p && lastVerse.y - l.y > 13.5;
            block.verses!.push({ n: pendingVerse ?? undefined, text, indent: l.x > 42 || undefined, stanza: stanza || undefined });
            pendingVerse = null;
            lastVerse = { p: l.p, y: l.y };
            continue;
        }

        // A versicle after the psalmody (Ofício de Leitura) or after a
        // sub-hour's Leitura breve: V./R. dialogue, not part of the prose.
        if (/^V\.\s/.test(text) && block?.buf && (block.kind === 'ant' || block.kind === 'leitura')) {
            flush();
            block = { kind: 'versículo', season: seasonFor('versículo'), variant, buf: [], verseLike: true };
        }

        if (block?.buf && READINGS.has(block.kind)) {
            if (block.head) {
                // Attribution lines ("Dos Sermões de…", its small-type
                // citation), the right-aligned chapter ref, then the
                // centred heading that opens the reading.
                if (l.x > 150) block.ref = prettifyRef(text);
                else if (l.x > 50 && l.h >= 10) {
                    block.title = text;
                    block.head = false;
                } else if (!block.source) block.source = text;
                else block.source += (l.h === 9 && !block.source.includes('\n') ? '\n' : ' ') + text;
                continue;
            }
            // Indented first lines (≈42pt, ≈50 after a dropped verse number)
            // open paragraphs; running lines sit at the margin.
            if (l.x > 40 && block.buf.length) block.buf.push(PARA);
            block.buf.push(text);
            continue;
        }

        if (block?.buf) {
            // A small-size line inside an open block is a rubric ("Salmo
            // invitatório.", "Oração própria. Na sua falta…", the "Ou"
            // between alternative responsories) — never part of the prayer.
            // A same-kind block reopens after it: alternates follow their
            // separating rubric with no header of their own.
            if (l.h === 9) {
                const kind: string = block.kind;
                const ref: string | undefined = block.ref;
                if (isEmpty(block)) block = null;
                else flush();
                blocksOf().push({ kind: 'rubrica', season: seasonFor('rubrica'), variant, text });
                block = { kind, ref, season: seasonFor(kind), variant, buf: [], verseLike: VERSE_LIKE.has(kind) };
                continue;
            }
            if (block.kind === 'hino') {
                // Positioned lines: assembleHymn restores stanza reading
                // order from column and y-band at flush.
                const { left, right, rightX } = splitColumns(l.items);
                (block.hymn ??= []).push({ p: l.p, y: l.y, x: l.x, t: left });
                if (right) block.hymn.push({ p: l.p, y: l.y, x: rightX, t: right });
                continue;
            }
            if (block.kind === 'preces') {
                // Petitions start at the margin ("first, / — second."),
                // their wraps indent — as does the response line, which is
                // told apart by following a finished sentence ("…dizendo:").
                // The intro paragraph wraps at the margin, and so does the
                // odd petition (Um Mártir) — but only after a bare word.
                const prev = block.buf[block.buf.length - 1] as VerseLine | undefined;
                const ended = !!prev && /[.:!?»]$/.test(prev.t);
                if (!prev) block.intro = l.x < 35;
                else if (ended) block.intro = false;
                const cont = !!prev && !text.startsWith('—') && !ended
                    && (l.x > 35 || !!block.intro || /[A-Za-zÀ-ú]$/.test(prev.t));
                block.buf.push({ t: text, cont });
            } else if (block.verseLike) {
                // Dialogue: every line that is not a new V./R. continues one.
                block.buf.push({ t: text, cont: !/^[VR]\.\s/.test(text) });
            } else {
                block.buf.push(text);
            }
            continue;
        }
        if (l.h === 9) {
            blocksOf().push({ kind: 'rubrica', season: seasonFor('rubrica'), variant, text });
            continue;
        }
        // Front-matter prose is the common's introduction, not a stray.
        block = { kind: hour ? 'texto' : 'introdução', season: seasonFor('texto'), variant, buf: [text] };
    }
    flush();

    // A document whose title lives only in its running heads (um-martir)
    // still has its variant subtitle to go by.
    if (!doc.title && doc.subtitle) {
        doc.title = doc.subtitle;
        delete doc.subtitle;
    }

    for (const blocks of Object.values(doc.hours)) {
        for (const b of blocks) {
            if (b.season == null) delete b.season;
            if (b.variant == null) delete b.variant;
            if (b.ref === undefined) delete b.ref;
            if (b.n === undefined) delete b.n;
        }
    }
    return doc;
}
