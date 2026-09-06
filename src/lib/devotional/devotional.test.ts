import { describe, expect, it } from 'vitest';
import { PRAYERS, WEEKDAY_SUGGESTIONS, fold, getPrayer, prayerAsText, prayerOfTheDay, prayerUrl, prayerWithLink, searchPrayers } from './index';
import { PRAYER_CATEGORIES } from './types';
import { getChaplet } from '@/lib/chaplets';

describe('the corpus', () => {
    it('has no duplicate ids', () => {
        // Ids are URLs and favourites keys — a collision would silently make
        // one of the two prayers unreachable.
        const ids = PRAYERS.map((p) => p.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('uses url-safe ids', () => {
        for (const prayer of PRAYERS) {
            expect(prayer.id, prayer.title).toMatch(/^[a-z0-9-]+$/);
        }
    });

    it('carries a title and a body for every entry', () => {
        for (const prayer of PRAYERS) {
            expect(prayer.title.trim(), prayer.id).not.toBe('');
            expect(prayer.text.trim(), prayer.id).not.toBe('');
        }
    });

    it('files every prayer under a category that exists', () => {
        const known = new Set(PRAYER_CATEGORIES.map((c) => c.id));
        for (const prayer of PRAYERS) {
            expect(known.has(prayer.category), `${prayer.id}: ${prayer.category}`).toBe(true);
        }
    });

    it('points every chaplet link at a chaplet that exists', () => {
        // `chapletId` is a plain string, so a renamed or removed chaplet would
        // otherwise leave the "Rezar conta a conta" button going nowhere.
        for (const prayer of PRAYERS) {
            if (!prayer.chapletId) continue;
            expect(getChaplet(prayer.chapletId), `${prayer.id} → ${prayer.chapletId}`).toBeDefined();
        }
    });

    it('leaves no category empty', () => {
        // An empty category would render a filter chip that leads to nothing.
        for (const category of PRAYER_CATEGORIES) {
            expect(PRAYERS.some((p) => p.category === category.id), category.id).toBe(true);
        }
    });
});

describe('fold', () => {
    it('strips diacritics and case', () => {
        expect(fold('Coração de Jesus')).toBe('coracao de jesus');
        expect(fold('Fátima')).toBe('fatima');
    });
});

describe('searchPrayers', () => {
    it('finds a prayer typed without accents', () => {
        const hits = searchPrayers('sagrado coracao', null);
        expect(hits.map((p) => p.id)).toContain('ladainha-do-sagrado-coracao');
    });

    it('requires every term to match', () => {
        const hits = searchPrayers('ladainha jose', null);
        expect(hits.map((p) => p.id)).toEqual(['ladainha-de-sao-jose']);
    });

    it('ranks a title match above a mention in the body', () => {
        const hits = searchPrayers('ave maria', null);
        expect(hits[0].id).toBe('ave-maria');
    });

    it('matches the alternative names', () => {
        expect(searchPrayers('memorare', null).map((p) => p.id)).toContain('lembrai-vos');
        expect(searchPrayers('sub tuum praesidium', null)[0].id).toBe('sob-a-vossa-proteccao');
    });

    it('honours the category filter', () => {
        const hits = searchPrayers('', 'fatima');
        expect(hits.length).toBeGreaterThan(0);
        expect(hits.every((p) => p.category === 'fatima')).toBe(true);
    });

    it('returns nothing rather than everything for a miss', () => {
        expect(searchPrayers('zzzznaoexiste', null)).toEqual([]);
    });
});

describe('prayerOfTheDay', () => {
    it('resolves to a real prayer on every weekday', () => {
        // 2026-08-16 is a Sunday, so this walks a whole week.
        for (let day = 16; day <= 22; day++) {
            const prayer = prayerOfTheDay(new Date(2026, 7, day));
            expect(getPrayer(prayer.id), `${day}`).toBe(prayer);
        }
    });

    it('follows the weekday devotion', () => {
        expect(prayerOfTheDay(new Date(2026, 7, 21)).id).toBe('via-sacra'); // sexta — Paixão
        expect(prayerOfTheDay(new Date(2026, 7, 22)).id).toBe('ladainha-de-nossa-senhora'); // sábado
    });
});

describe('WEEKDAY_SUGGESTIONS', () => {
    it('names a prayer that exists, with the title it actually has', () => {
        // Home renders these literals rather than importing the corpus, so
        // nothing but this test would notice a rename or a retitling.
        expect(WEEKDAY_SUGGESTIONS).toHaveLength(7);
        for (const suggestion of WEEKDAY_SUGGESTIONS) {
            const prayer = getPrayer(suggestion.id);
            expect(prayer, suggestion.id).toBeDefined();
            expect(prayer!.title, suggestion.id).toBe(suggestion.title);
        }
    });
});

describe('sharing a prayer', () => {
    // Salve Rainha, because it ends in a versicle and a response — the part
    // that has to be translated on the way out.
    const salve = getPrayer('salve-rainha')!;

    it('reads the way the page does', () => {
        // Title first — a prayer pasted into a chat with nothing naming it
        // makes the reader guess — and the markers as glyphs, not as "V.".
        const text = prayerAsText(salve);
        expect(text.startsWith(`${salve.title}\n\n`)).toBe(true);
        expect(text).toMatch(/^℣ Rogai por nós/m);
        expect(text).not.toMatch(/^[VR]\. /m);
    });

    it('links back through the hash the router reads', () => {
        // The base is whatever the app is served from, so the deep link has
        // to hang off it rather than be a path of its own.
        expect(prayerUrl(salve, 'https://vitor-matias.github.io/mORA/'))
            .toBe('https://vitor-matias.github.io/mORA/#/devocionario/salve-rainha');
    });

    it('sends the link along with the words on the clipboard', () => {
        // A paste has nowhere but the text to put the link, so it goes under
        // the prayer — otherwise the copy is a dead end for whoever it reaches.
        const pasted = prayerWithLink(salve, 'https://example.test/');
        expect(pasted.startsWith(prayerAsText(salve))).toBe(true);
        expect(pasted.endsWith('\n\nhttps://example.test/#/devocionario/salve-rainha')).toBe(true);
    });

    it('links to a prayer that the route can resolve', () => {
        for (const prayer of PRAYERS) {
            const url = prayerUrl(prayer, 'https://example.test/');
            expect(getPrayer(url.split('/devocionario/')[1]), prayer.id).toBe(prayer);
        }
    });
});
