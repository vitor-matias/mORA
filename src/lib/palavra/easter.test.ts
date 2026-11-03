import { describe, expect, it } from 'vitest';
import { easterSunday, isEasterMonth } from './easter';

describe('easterSunday', () => {
    it.each([
        [2026, '2026-04-05'],
        [2027, '2027-03-28'],
        [2028, '2028-04-16'],
        [2029, '2029-04-01'],
        [2030, '2030-04-21'],
        [2035, '2035-03-25'],
        // The latest and earliest dates it can fall on.
        [2038, '2038-04-25'],
        [2285, '2285-03-22'],
    ])('%i', (year, date) => {
        expect(easterSunday(year)).toBe(date);
    });
});

describe('isEasterMonth', () => {
    it('picks March or April by the year', () => {
        expect(isEasterMonth('2027-03')).toBe(true);
        expect(isEasterMonth('2027-04')).toBe(false);
        expect(isEasterMonth('2028-03')).toBe(false);
        expect(isEasterMonth('2028-04')).toBe(true);
    });

    it('is never any other month', () => {
        expect(isEasterMonth('2027-05')).toBe(false);
        expect(isEasterMonth('2027-12')).toBe(false);
    });
});
