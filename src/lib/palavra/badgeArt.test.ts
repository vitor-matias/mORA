import { describe, expect, it } from 'vitest';

// server/palavra/badges.js bakes these URLs into signed definitions. A missing
// file doesn't fail the job, it just awards that month's medal with no picture.
describe('monthly badge art', () => {
    it('has every month, in every place and size', () => {
        const art = new Set(Object.keys(import.meta.glob('/public/badges/*.png')));
        const missing: string[] = [];
        const themes = [...Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')), 'pascoa'];
        for (const theme of themes) {
            for (const place of [1, 2, 3]) {
                for (const suffix of ['', '-thumb']) {
                    const file = `/public/badges/palavra-${theme}-${place}${suffix}.png`;
                    if (!art.has(file)) missing.push(file);
                }
            }
        }
        expect(missing).toEqual([]);
    });
});
