import { describe, expect, it } from 'vitest';
import { calendarReaches, unfoldICS } from './liturgy';

describe('unfoldICS', () => {
    // RFC 5545 folds by inserting CRLF plus one whitespace octet at an
    // arbitrary point, so unfolding drops both — "Domingo d" + "o Advento".
    it('joins continuation lines folded with a space', () => {
        expect(unfoldICS('SUMMARY:Domingo d\r\n o Advento')).toBe('SUMMARY:Domingo do Advento');
    });

    it('joins continuation lines folded with a tab', () => {
        // The RFC allows either octet; only the space case was handled before,
        // so a tab-folded DESCRIPTION kept a literal newline and broke parsing.
        expect(unfoldICS('SUMMARY:Domingo d\r\n\to Advento')).toBe('SUMMARY:Domingo do Advento');
    });

    it('leaves ordinary line breaks alone', () => {
        expect(unfoldICS('SUMMARY:A\r\nDTSTART:20260906')).toBe('SUMMARY:A\r\nDTSTART:20260906');
    });
});

describe('calendarReaches', () => {
    const ics = [
        'BEGIN:VEVENT\nDTSTART;VALUE=DATE:20260901\nEND:VEVENT',
        'BEGIN:VEVENT\nDTSTART;VALUE=DATE:20260930\nEND:VEVENT',
    ].join('\n');

    it('accepts a feed whose last event is still ahead', () => {
        expect(calendarReaches(ics, '2026-09-06')).toBe(true);
    });

    it('accepts a feed whose last event is exactly today', () => {
        expect(calendarReaches(ics, '2026-09-30')).toBe(true);
    });

    it('rejects a feed that has run out — the silent-stale-cache case', () => {
        expect(calendarReaches(ics, '2026-10-01')).toBe(false);
    });

    it('tolerates a single missing day rather than forcing a refetch', () => {
        // 2026-09-15 has no event of its own, but the feed still runs to the 30th.
        expect(calendarReaches(ics, '2026-09-15')).toBe(true);
    });

    it('handles the date-time form of DTSTART', () => {
        expect(calendarReaches('DTSTART:20260930T080000Z', '2026-09-06')).toBe(true);
    });

    it('rejects a body with no DTSTART at all', () => {
        expect(calendarReaches('BEGIN:VCALENDAR\nEND:VCALENDAR', '2026-09-06')).toBe(false);
    });
});
