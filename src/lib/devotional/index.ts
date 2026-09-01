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
import { fold, rankByTiers } from '@/lib/textSearch';

export type { Prayer, PrayerCategory, PrayerCategoryId } from './types';
export { PRAYER_CATEGORIES } from './types';
export { WEEKDAY_SUGGESTIONS, suggestedPrayer } from './suggestion';
export { fold } from '@/lib/textSearch';

/** The whole devocionário, in category order. */
export const PRAYERS: readonly Prayer[] = [
    ...COMUNS, ...DIA, ...SENHOR, ...ESPIRITO, ...MARIA,
    ...FATIMA, ...SANTOS, ...VIDA, ...DEFUNTOS, ...SALMOS, ...FORMULAS,
];

const BY_ID = new Map(PRAYERS.map((p) => [p.id, p]));

export function getPrayer(id: string | undefined): Prayer | undefined {
    return id ? BY_ID.get(id) : undefined;
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
 * Filters by category and query together, ranked in the three tiers described
 * in `@/lib/textSearch` — the same ranking the hymnal uses.
 */
export function searchPrayers(query: string, category: PrayerCategoryId | null): Prayer[] {
    const pool = category ? PRAYERS.filter((p) => p.category === category) : PRAYERS;
    return rankByTiers(pool, query, (prayer) => INDEX.get(prayer.id)!);
}

/** The prayer to suggest today, following the weekday devotion. */
export function prayerOfTheDay(now: Date = new Date()): Prayer {
    return BY_ID.get(suggestedPrayer(now).id) ?? PRAYERS[0];
}
