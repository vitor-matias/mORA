import { describe, expect, it } from 'vitest';
import { formatISODate } from './format';
import { getDefaultHoursDate, getHourForTime } from './hours';

describe('getDefaultHoursDate', () => {
    // Saturday night's Completas belongs to Saturday, even at 00:30 on Sunday.
    it('stays on yesterday while Completas is still on offer', () => {
        const at = new Date(2026, 10, 8, 0, 30);
        expect(getHourForTime(at).id).toBe('completas');
        expect(formatISODate(getDefaultHoursDate(at))).toBe('2026-11-07');
    });

    it('moves to the calendar day at 02:00', () => {
        expect(formatISODate(getDefaultHoursDate(new Date(2026, 10, 8, 2, 0)))).toBe('2026-11-08');
        expect(formatISODate(getDefaultHoursDate(new Date(2026, 10, 8, 21, 30)))).toBe('2026-11-08');
    });

    it('crosses a month boundary', () => {
        expect(formatISODate(getDefaultHoursDate(new Date(2026, 11, 1, 1, 0)))).toBe('2026-11-30');
    });
});
