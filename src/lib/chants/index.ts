import type { Chant, ChantCategoryId } from './types';
import { CHANTS } from './chants';
import { getPrayer } from '@/lib/devotional';
import { fold, rankByTiers } from '@/lib/textSearch';

export type { Chant, ChantCategory, ChantCategoryId } from './types';
export { CHANT_CATEGORIES } from './types';
export { CHANTS } from './chants';

/** A chant with its words filled in, wherever they came from. (An
    intersection rather than an interface: `Chant` is a union.) */
export type ResolvedChant = Chant & {
    /** The sung text, whether it came from the chant or from the prayer it
        points at. */
    body: string;
    /** The Latin, likewise. */
    latinBody?: string;
};

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

/** Every chant with its words filled in, resolved once at module load. */
const RESOLVED: readonly ResolvedChant[] = CHANTS.map(resolveChant);
const BY_ID = new Map(RESOLVED.map((c) => [c.id, c]));

/** Folded once too: without this the whole hymnal — 200-odd chants plus the
    prayer bodies they borrow — is re-normalised on every keystroke. */
const INDEX = new Map(RESOLVED.map((chant) => [chant.id, {
    title: fold(chant.title),
    head: fold(`${chant.title} ${chant.note}`),
    body: fold(`${chant.body} ${chant.latinBody ?? ''}`),
}]));

export function chantsByCategory(category: ChantCategoryId): ResolvedChant[] {
    return RESOLVED.filter((c) => c.category === category);
}

export function getChant(id: string | undefined): ResolvedChant | undefined {
    return id ? BY_ID.get(id) : undefined;
}

/**
 * Filters the hymnal by category and query together, ranked in the three tiers
 * described in `@/lib/textSearch` — the same ranking the Devocionário uses.
 */
export function searchChants(query: string, category: ChantCategoryId | null): ResolvedChant[] {
    const pool = category ? RESOLVED.filter((c) => c.category === category) : RESOLVED;
    return rankByTiers(pool, query, (chant) => INDEX.get(chant.id)!);
}

export interface Stanza {
    text: string;
    /** Sung by everyone, after each verse — set apart when rendered. */
    isRefrain: boolean;
}

const VERSE_NUMBER = /^\d+\.\s/;
const REFRAIN_MARK = /^R\.\s*/;
// `R.` also opens the people's response in a versicle-and-response block, so
// a stanza written `V. … / R. …` must not be read as a marked refrain.
const RESPONSORY = /^V\.\s/m;

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
        const marked = REFRAIN_MARK.test(block) && !RESPONSORY.test(block);
        return {
            text: marked ? block.replace(REFRAIN_MARK, '') : block,
            isRefrain: marked || (numbered && !VERSE_NUMBER.test(block)),
        };
    });
}
