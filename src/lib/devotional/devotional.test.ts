import { describe, expect, it } from 'vitest';
import { PRAYERS, WEEKDAY_SUGGESTIONS, fold, getPrayer, prayerOfTheDay, searchPrayers } from './index';
import { PRAYER_CATEGORIES } from './types';

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
