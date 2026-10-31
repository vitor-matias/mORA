// Assembles a saint's (or the Defuntos) office for one canonical hour:
// the Ofício Comum provides the body, the saint's Próprio entry overlays
// whatever it owns (collect, gospel-canticle antiphons, readings — or, on
// feasts, whole hours). Proper ▸ common is the breviary's own precedence;
// the psalter/ferial parts stay with the API office the page already shows.

import type { ProprioEntry } from './proprio.ts';
import type { ComumBlock, ComumDoc } from './comum.ts';

export interface AssembledSection {
    title: string;
    blocks: ComumBlock[];
}

export interface AssembledHour {
    sections: AssembledSection[];
    /** Rubric shown when the corpus has nothing for this hour. */
    note?: string;
}

/** The saints celebrated on `day` (multiple on "No mesmo dia" days). */
export function saintsForDay(entries: ProprioEntry[], day: number): ProprioEntry[] {
    return entries.filter((e) => e.day === day);
}

/**
 * An entry whose office exists only in the printed book ("Apêndice VI,
 * p. 2079") has nothing to render besides its collect-less biography.
 */
export function hasRenderableOffice(entry: ProprioEntry): boolean {
    return Object.keys(entry.hours).length > 0 || entry.commons.length > 0;
}

// Proper subsection kinds → the commons' kind vocabulary.
const PROPER_KIND: Record<string, string> = {
    'leitura breve': 'leitura',
    'responsório breve': 'responsório',
};

const SUB_HOUR_VARIANTS = ['Tércia', 'Sexta', 'Noa'];

/** Keep blocks with no season, the matching season, or an unknown one. */
function seasonFilter(blocks: ComumBlock[], pascal: boolean): ComumBlock[] {
    const drop = pascal ? 'Fora do Tempo Pascal' : 'Tempo Pascal';
    return blocks.filter((b) => b.season !== drop);
}

// "(T. P. Aleluia)" is the printed rubric for "add Aleluia in Paschal
// Time". Like the API's pre-resolved texts: in Eastertide it becomes the
// aleluia itself, outside it disappears.
const TP_MARK = /\s*\(T\.\s*P\.\s*Aleluia\.?\)/gi;
function paschalize(text: string, pascal: boolean): string {
    return text.replace(TP_MARK, pascal ? ', aleluia' : '');
}
function resolveMarks(blocks: ComumBlock[], pascal: boolean): ComumBlock[] {
    return blocks.map((b) => {
        let text = b.text === undefined ? undefined : paschalize(b.text, pascal);
        // Source erratum (e.g. Pastores Vésperas II): a stray "Aleluia,
        // Aleluia." left on a non-Paschal responsory line — outside
        // Eastertide a responsory never ends in Aleluia.
        if (text && b.kind === 'responsório' && b.season === 'Fora do Tempo Pascal') {
            text = text.replace(/\.\s*Aleluia,?\s*Aleluia\.?$/gm, '.');
        }
        return {
            ...b,
            text,
            verses: b.verses?.map((v) => ({ ...v, text: paschalize(v.text, pascal) })),
        };
    });
}

function properBlocks(entry: ProprioEntry, hour: string): ComumBlock[] {
    return (entry.hours[hour] ?? []).map((b) => ({
        kind: PROPER_KIND[b.kind] ?? b.kind,
        ref: b.ref,
        text: b.text,
    }));
}

/**
 * "Oração própria. Na sua falta, como nas Laudes." is a pointer rubric —
 * once the proper collect is actually present it is fulfilled and must not
 * render. The collect also ends the hour: whatever trails the last oração
 * (variant labels and "Ou" separators of the common's fallback collects,
 * orphaned when the overlay replaced them) is fallback apparatus, not
 * prayer.
 */
function dropFulfilledOracaoRubric(blocks: ComumBlock[]): ComumBlock[] {
    const lastOracao = blocks.map((b) => b.kind).lastIndexOf('oração');
    if (lastOracao < 0) return blocks;
    return blocks
        .slice(0, lastOracao + 1)
        .filter((b) => !(b.kind === 'rubrica' && /^Oração própria/.test(b.text ?? '')));
}

/**
 * Replaces every base block of a kind the proper provides with the proper's
 * block(s), at the position of the first replaced block; proper kinds the
 * base lacks are appended. Variant siblings ("Para um Santo Mártir" /
 * "Para uma Santa Mártir") count as one slot and are replaced together.
 */
function overlay(base: ComumBlock[], proper: ComumBlock[]): ComumBlock[] {
    const byKind = new Map<string, ComumBlock[]>();
    for (const b of proper) {
        const group = byKind.get(b.kind);
        if (group) group.push(b);
        else byKind.set(b.kind, [b]);
    }

    const out: ComumBlock[] = [];
    const placed = new Set<string>();
    for (const b of base) {
        const replacement = byKind.get(b.kind);
        if (!replacement) {
            out.push(b);
            continue;
        }
        if (!placed.has(b.kind)) {
            placed.add(b.kind);
            out.push(...replacement);
        }
    }
    for (const [kind, group] of byKind) {
        if (!placed.has(kind)) out.push(...group);
    }
    return out;
}

/**
 * Resolves a common that is declared as an overlay on another ("COMUM DOS
 * DOUTORES … Como no Comum dos Pastores da Igreja, excepto:") into a
 * self-contained document: the base's hours with the overlay's blocks
 * replacing their kind-mates.
 */
export function mergeComumOverlay(base: ComumDoc, over: ComumDoc): ComumDoc {
    const hours: ComumDoc['hours'] = { ...base.hours };
    for (const [hour, blocks] of Object.entries(over.hours)) {
        const baseBlocks = hours[hour];
        hours[hour] = baseBlocks ? overlay(baseBlocks, blocks) : blocks;
    }
    // `note` is intentionally omitted: the inheritance it describes is now
    // resolved, so loadComum must not follow it again.
    return {
        title: over.title ?? base.title,
        subtitle: over.subtitle ?? base.subtitle,
        hours,
    };
}

const COMPLEMENT_RUBRIC = /^Para as outras Horas, a Salmodia Complementar/;
const isComplementRubric = (b: ComumBlock) => b.kind === 'rubrica' && COMPLEMENT_RUBRIC.test(b.text ?? '');

/**
 * The Salmodia Complementar series ("Série II") an assembled Hora
 * Intermédia offers for this sub-hour: its own psalmody serves one Hour,
 * "Para as outras Horas, a Salmodia Complementar, série II e III" — taken
 * as Sexta → II, Noa → III, Tércia always proper.
 */
export function complementSeries(hour: AssembledHour | null | undefined, subHour: string | null): string | null {
    if (!hour?.sections.some((s) => s.blocks.some(isComplementRubric))) return null;
    return subHour === 'Sexta' ? 'Série II' : subHour === 'Noa' ? 'Série III' : null;
}

/** Swaps an hour's psalms for a Salmodia Complementar series'; its antiphon stays. */
export function withPsalmody(hour: AssembledHour, series: ComumBlock[]): AssembledHour {
    const psalms = series.filter((b) => b.kind === 'salmo');
    return {
        ...hour,
        sections: hour.sections.map((s) => {
            const at = s.blocks.findIndex((b) => b.kind === 'salmo');
            if (at < 0 || psalms.length === 0) return s;
            const rest = s.blocks.filter((b) => b.kind !== 'salmo' && !isComplementRubric(b));
            return { ...s, blocks: [...rest.slice(0, at), ...psalms, ...rest.slice(at)] };
        }),
    };
}

/**
 * The office for one canonical hour of the page (`hourId` as used by
 * LiturgiaHoras). `entry` is null for the Ofício de Defuntos, which is a
 * complete office of its own. Returns null for hours prayed as on the
 * ferial day (the caller keeps the API content).
 */
export function assembleHour(
    entry: ProprioEntry | null,
    comum: ComumDoc | null,
    hourId: string,
    subHour: string | null,
    pascal: boolean
): AssembledHour | null {
    // Never proper (Completas); the Ofício de Leitura is in the web corpus
    // only for the Defuntos — saints keep the API's.
    if (hourId === 'completas') return null;
    if (hourId === 'oficio' && !comum?.hours['Ofício de Leitura']) return null;

    const commonHour = (name: string): ComumBlock[] =>
        comum ? seasonFilter(comum.hours[name] ?? [], pascal) : [];

    // "Oração como nas Laudes." points at the Laudes collect(s) — resolve it
    // when the hour has no collect of its own, alternatives and all.
    const laudesOracao = (): ComumBlock[] => {
        const laudes = dropFulfilledOracaoRubric(overlay(
            overlay(commonHour('Laudes'), entry ? properBlocks(entry, 'Laudes') : []),
            entry ? properBlocks(entry, 'Oração') : []
        ));
        const first = laudes.findIndex((b) => b.kind === 'oração');
        return first < 0 ? [] : laudes.slice(first);
    };
    const isLaudesPointer = (b: ComumBlock) => b.kind === 'rubrica' && /^Oração como nas Laudes/.test(b.text ?? '');
    const resolveOracao = (blocks: ComumBlock[]): ComumBlock[] => {
        const at = blocks.findIndex(isLaudesPointer);
        if (at < 0 || blocks.some((b) => b.kind === 'oração')) return blocks;
        const oracao = laudesOracao();
        return oracao.length ? [...blocks.slice(0, at), ...oracao, ...blocks.slice(at + 1)] : blocks;
    };

    const sections: AssembledSection[] = [];

    if (hourId === 'oficio') {
        sections.push({ title: 'Ofício de Leitura', blocks: resolveOracao(commonHour('Ofício de Leitura')) });
    } else if (hourId === 'laudes') {
        const invitatorio = overlay(commonHour('Invitatório'), entry ? properBlocks(entry, 'Invitatório') : []);
        if (invitatorio.length > 0) sections.push({ title: 'Invitatório', blocks: invitatorio });

        let laudes = overlay(commonHour('Laudes'), entry ? properBlocks(entry, 'Laudes') : []);
        laudes = dropFulfilledOracaoRubric(overlay(laudes, entry ? properBlocks(entry, 'Oração') : []));
        if (laudes.length > 0) sections.push({ title: 'Laudes', blocks: laudes });
    } else if (hourId === 'intermedia') {
        // Shared psalmody/rubrics live under "Hora Intermédia"; the reading
        // and antiphon of the chosen sub-hour under its own name. Blocks
        // tagged with a sub-hour variant (Defuntos lists the three
        // antiphons inline) collapse to the chosen one, label dropped.
        const want = subHour ?? 'Tércia';
        const shared = commonHour('Hora Intermédia')
            .filter((b) => !b.variant || !SUB_HOUR_VARIANTS.includes(b.variant) || b.variant === want)
            .map((b) => (b.variant === want ? { ...b, variant: undefined } : b));
        const sub = commonHour(want);
        let blocks = [...shared, ...sub];
        if (entry) {
            blocks = overlay(blocks, properBlocks(entry, 'Hora Intermédia'));
            blocks = overlay(blocks, properBlocks(entry, subHour ?? 'Tércia'));
            blocks = overlay(blocks, properBlocks(entry, 'Oração'));
        }
        blocks = dropFulfilledOracaoRubric(blocks);
        // The pointer is printed once, after the last sub-hour (Defuntos:
        // under Noa), but holds for all three.
        const pointer = SUB_HOUR_VARIANTS.flatMap(commonHour).find(isLaudesPointer);
        if (pointer && !blocks.some((b) => b.kind === 'oração' || isLaudesPointer(b))) blocks = [...blocks, pointer];
        blocks = resolveOracao(blocks);
        if (blocks.length > 0) sections.push({ title: subHour ?? 'Hora Intermédia', blocks });
    } else if (hourId === 'vesperas') {
        // Vespers of the day itself is the commons' "Vésperas II"; some
        // documents have a single "Vésperas". The proper may bring a full
        // hour (feasts) or only the Magnificat antiphon.
        const base = comum
            ? commonHour('Vésperas II').length > 0
                ? commonHour('Vésperas II')
                : commonHour('Vésperas')
            : [];
        let blocks = overlay(base, entry ? properBlocks(entry, 'Vésperas') : []);
        blocks = resolveOracao(dropFulfilledOracaoRubric(overlay(blocks, entry ? properBlocks(entry, 'Oração') : [])))
            // Points at the next hour, whose banner already says it.
            .filter((b) => !(b.kind === 'rubrica' && /^Completas como/.test(b.text ?? '')));
        if (blocks.length > 0) sections.push({ title: 'Vésperas', blocks });
    }

    if (sections.length === 0) {
        return {
            sections,
            note: 'Sem textos próprios para esta hora — reza-se como no Ofício do dia.',
        };
    }
    return {
        sections: sections.map((s) => ({ ...s, blocks: resolveMarks(s.blocks, pascal) })),
    };
}
