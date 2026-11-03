import { describe, expect, it } from 'vitest';
// @ts-expect-error plain JS server module, no types
import { artUrls, monthTheme, servedAsImage } from '../../../server/palavra/badges.js';

const months = (year: number) => Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
const fileName = (url: string) => url.slice(url.lastIndexOf('/') + 1);

describe('monthly badge art', () => {
    // These URLs go into signed definitions, and a place whose file is missing
    // can't be awarded. Easter falls in March in 2027 and April in 2028, so the
    // two years reach every file.
    it('has a file for every URL the job can ask for', () => {
        const art = new Set(Object.keys(import.meta.glob('/public/badges/*.png')).map(fileName));
        const missing: string[] = [];
        for (const month of [...months(2027), ...months(2028)]) {
            for (const place of [1, 2, 3]) {
                const { image, thumb } = artUrls(month, place);
                for (const url of [image, thumb]) {
                    if (!art.has(fileName(url))) missing.push(fileName(url));
                }
            }
        }
        expect(missing).toEqual([]);
    });

    it('gives the month holding Easter the Páscoa medal, and the other its own', () => {
        expect(fileName(artUrls('2027-03', 1).image)).toBe('palavra-pascoa-1.png');
        expect(fileName(artUrls('2027-04', 1).image)).toBe('palavra-04-1.png');
        expect(fileName(artUrls('2028-03', 2).thumb)).toBe('palavra-03-2-thumb.png');
        expect(fileName(artUrls('2028-04', 2).thumb)).toBe('palavra-pascoa-2-thumb.png');

        expect(monthTheme('2027-03')).toBe('Mês da Páscoa');
        expect(monthTheme('2027-04')).toBe('Mês do Santíssimo Sacramento');
        expect(monthTheme('2028-03')).toBe('Mês da Quaresma');
        expect(monthTheme('2028-04')).toBe('Mês da Páscoa');
    });

    it('names a theme for every month', () => {
        for (const month of months(2027)) expect(monthTheme(month)).toMatch(/^Mês /);
    });
});

describe('servedAsImage', () => {
    const response = (status: number, type?: string) =>
        new Response(null, { status, headers: type ? { 'content-type': type } : {} });

    it('accepts a successful image', () => {
        expect(servedAsImage(response(200, 'image/png'))).toBe(true);
    });

    it('refuses an app page answering with a 200, a 404, and no type at all', () => {
        expect(servedAsImage(response(200, 'text/html'))).toBe(false);
        expect(servedAsImage(response(404, 'image/png'))).toBe(false);
        expect(servedAsImage(response(200))).toBe(false);
    });
});
