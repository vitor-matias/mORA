import type { Chant, ChantCategoryId } from './types';
import { CHANTS } from './chants';
import { fold, getPrayer } from '@/lib/devotional';

export type { Chant, ChantCategory, ChantCategoryId } from './types';
export { CHANT_CATEGORIES } from './types';
export { CHANTS } from './chants';

export interface ResolvedChant extends Chant {
    /** The sung text, whether it came from the chant or from the prayer it
        points at. */
    body: string;
    /** The Latin, likewise. */
    latinBody?: string;
}

/** Fills in the words for a chant that is sung from a text the Devocionário
    already holds, so the two can never say different things. */
export function resolveChant(chant: Chant): ResolvedChant {
    const prayer = getPrayer(chant.prayerId);
    return {
        ...chant,
        body: chant.text ?? prayer?.text ?? '',
        latinBody: chant.latin ?? prayer?.latin,
    };
}

export function chantsByCategory(category: ChantCategoryId): ResolvedChant[] {
    return CHANTS.filter((c) => c.category === category).map(resolveChant);
}

export function getChant(id: string | undefined): Chant | undefined {
    return id ? CHANTS.find((c) => c.id === id) : undefined;
}

export interface Stanza {
    text: string;
    /** Sung by everyone, after each verse — set apart when rendered. */
    isRefrain: boolean;
}

const VERSE_NUMBER = /^\d+\.\s/;

/**
 * Splits a sung text into stanzas and works out which of them is the refrain,
 * by the two conventions hymnals actually use:
 *
 * - an explicit `R.` opening the stanza (the ℟ of the liturgical books), and
 * - in a hymn whose verses are numbered, any stanza that carries no number —
 *   which is exactly how a songbook prints a refrain.
 *
 * A hymn with neither (Noite feliz, In paradisum) has no refrain, and every
 * stanza comes back plain.
 */
export function toStanzas(text: string): Stanza[] {
    const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
    const numbered = blocks.some((b) => VERSE_NUMBER.test(b));
    return blocks.map((block) => {
        const marked = block.startsWith('R.');
        return {
            text: marked ? block.slice(2).trimStart() : block,
            isRefrain: marked || (numbered && !VERSE_NUMBER.test(block)),
        };
    });
}

/**
 * Filters the hymnal by category and query together, in three tiers: the title
 * read as a phrase, then every term somewhere in the title or provenance line,
 * then every term anywhere at all.
 *
 * The phrase tier is what makes short words usable. Typing "ao pe de ti" as
 * loose terms matches half the book — "pe" is inside "Pentecostes", "ti"
 * inside "antífona" — so the hymn actually called "Ao Pé de Ti" has to be
 * recognised by its whole name, not by its parts.
 */
export function searchChants(query: string, category: ChantCategoryId | null): ResolvedChant[] {
    const pool = (category ? CHANTS.filter((c) => c.category === category) : CHANTS).map(resolveChant);
    const phrase = fold(query).trim().replace(/\s+/g, ' ');
    const terms = phrase.split(' ').filter(Boolean);
    if (terms.length === 0) return pool;

    const named: ResolvedChant[] = [];
    const titleHits: ResolvedChant[] = [];
    const bodyHits: ResolvedChant[] = [];
    for (const chant of pool) {
        const title = fold(chant.title);
        const head = `${title} ${fold(chant.note)}`;
        const body = fold(`${chant.body} ${chant.latinBody ?? ''}`);
        if (title.includes(phrase)) named.push(chant);
        else if (terms.every((t) => head.includes(t))) titleHits.push(chant);
        else if (terms.every((t) => head.includes(t) || body.includes(t))) bodyHits.push(chant);
    }
    return [...named, ...titleHits, ...bodyHits];
}
