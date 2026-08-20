import type { Prayer, PrayerCategoryId } from './types';
import { COMUNS } from './comuns';
import { DIA } from './dia';
import { SENHOR } from './senhor';
import { ESPIRITO } from './espirito';
import { MARIA } from './maria';
import { FATIMA } from './fatima';
import { SANTOS } from './santos';
import { VIDA } from './vida';
import { DEFUNTOS } from './defuntos';
import { SALMOS } from './salmos';
import { FORMULAS } from './formulas';
import { suggestedPrayer } from './suggestion';

export type { Prayer, PrayerCategory, PrayerCategoryId } from './types';
export { PRAYER_CATEGORIES } from './types';
export { WEEKDAY_SUGGESTIONS, suggestedPrayer } from './suggestion';

/** The whole devocionário, in category order. */
export const PRAYERS: readonly Prayer[] = [
    ...COMUNS, ...DIA, ...SENHOR, ...ESPIRITO, ...MARIA,
    ...FATIMA, ...SANTOS, ...VIDA, ...DEFUNTOS, ...SALMOS, ...FORMULAS,
];

const BY_ID = new Map(PRAYERS.map((p) => [p.id, p]));

export function getPrayer(id: string | undefined): Prayer | undefined {
    return id ? BY_ID.get(id) : undefined;
}

/** Lowercase and strip diacritics, so "coracao" finds "Coração" and "Fatima"
    finds "Fátima" — nobody types the accents into a search box on a phone. */
export function fold(text: string): string {
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/** Title, alternative names and the first line — what a title match is worth
    ranking against. The body is searched too, but only after these. */
function haystacks(prayer: Prayer): { title: string; head: string; body: string } {
    return {
        title: fold([prayer.title, ...(prayer.aka ?? [])].join(' · ')),
        head: fold([prayer.title, ...(prayer.aka ?? []), prayer.note ?? ''].join(' ')),
        body: fold(prayer.text),
    };
}

const INDEX = new Map(PRAYERS.map((p) => [p.id, haystacks(p)]));

/**
 * Filters by category and query together, in three tiers: the title (or an
 * alternative name) read as a whole phrase, then every whitespace-separated
 * term in the title, then every term anywhere.
 *
 * The phrase tier is what rescues short words — typed loosely, "ao pe de ti"
 * matches almost anything, because "pe" is inside "Pentecostes" and "ti"
 * inside "antífona".
 */
export function searchPrayers(query: string, category: PrayerCategoryId | null): Prayer[] {
    const pool = category ? PRAYERS.filter((p) => p.category === category) : PRAYERS;
    const phrase = fold(query).trim().replace(/\s+/g, ' ');
    const terms = phrase.split(' ').filter(Boolean);
    if (terms.length === 0) return [...pool];

    const named: Prayer[] = [];
    const titleHits: Prayer[] = [];
    const bodyHits: Prayer[] = [];
    for (const prayer of pool) {
        const { title, head, body } = INDEX.get(prayer.id)!;
        if (title.includes(phrase)) named.push(prayer);
        else if (terms.every((t) => head.includes(t))) titleHits.push(prayer);
        else if (terms.every((t) => head.includes(t) || body.includes(t))) bodyHits.push(prayer);
    }
    return [...named, ...titleHits, ...bodyHits];
}

/** The prayer to suggest today, following the weekday devotion. */
export function prayerOfTheDay(now: Date = new Date()): Prayer {
    return BY_ID.get(suggestedPrayer(now).id) ?? PRAYERS[0];
}
