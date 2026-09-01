/**
 * The one text search the libraries share.
 *
 * The Devocionário and the Cânticos index different things but rank them the
 * same way, and they were drifting apart as near-copies of each other.
 */

/** Lowercase and strip diacritics, so "coracao" finds "Coração" and "Fatima"
    finds "Fátima" — nobody types the accents into a search box on a phone. */
export function fold(text: string): string {
    return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** The three things a query is matched against, already folded. */
export interface Haystack {
    /** The name it is known by, including any alternative names. */
    title: string;
    /** The title plus whatever else identifies it (provenance, occasion). */
    head: string;
    /** The words themselves. */
    body: string;
}

/**
 * Ranks in three tiers: the title read as a whole phrase, then every
 * whitespace-separated term in the title, then every term anywhere.
 *
 * The phrase tier is what makes short words usable. Typed as loose terms,
 * "ao pe de ti" matches half a hymnal — "pe" is inside "Pentecostes", "ti"
 * inside "antífona" — so a hymn actually called "Ao Pé de Ti" has to be
 * recognised by its whole name rather than by its parts.
 *
 * An empty query returns everything, in the order it was given.
 */
export function rankByTiers<T>(
    items: readonly T[],
    query: string,
    haystackOf: (item: T) => Haystack,
): T[] {
    const phrase = fold(query).trim().replace(/\s+/g, ' ');
    const terms = phrase.split(' ').filter(Boolean);
    if (terms.length === 0) return [...items];

    const named: T[] = [];
    const titled: T[] = [];
    const anywhere: T[] = [];
    for (const item of items) {
        const { title, head, body } = haystackOf(item);
        if (title.includes(phrase)) named.push(item);
        else if (terms.every((t) => head.includes(t))) titled.push(item);
        else if (terms.every((t) => head.includes(t) || body.includes(t))) anywhere.push(item);
    }
    return [...named, ...titled, ...anywhere];
}
