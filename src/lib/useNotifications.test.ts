import { describe, expect, it } from 'vitest';
import { buildReminderSchedule } from './useNotifications';

describe('buildReminderSchedule urls', () => {
    it('opens the rosary for the daily reminder and the chosen Hour for Hours', () => {
        const schedule = buildReminderSchedule('18:00', { vesperas: '19:00' }, 'Terço');
        expect(schedule.map((e) => e.url)).toEqual(['/terco', '/liturgia-horas?hora=vesperas']);
    });

    it('lets the first prayer win when two share a minute', () => {
        const [entry] = buildReminderSchedule('19:00', { vesperas: '19:00' }, 'Terço');
        expect(entry.url).toBe('/terco');
    });
});
