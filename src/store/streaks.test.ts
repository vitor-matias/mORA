import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { completedDates, emptyStreaks, mergeStreaks, streaksEqual, useAppStore } from './app';

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 28, 12)); // Wed 28 Oct 2026
    useAppStore.setState({ streaks: emptyStreaks() });
});
afterEach(() => vi.useRealTimers());

describe('completedDates', () => {
    it('infers the unbroken run from a snapshot with no history', () => {
        expect(completedDates({ days: 3, lastCompletedDate: '2026-10-27' }))
            .toEqual(['2026-10-25', '2026-10-26', '2026-10-27']);
    });

    it('drops malformed and future dates', () => {
        expect(completedDates({ days: 0, lastCompletedDate: null, history: ['x', '2026-10-30', '2026-10-01'] }))
            .toEqual(['2026-10-01']);
    });
});

describe('incrementStreak history', () => {
    it('keeps a broken earlier run alongside today', () => {
        useAppStore.setState({ streaks: { ...emptyStreaks(), liturgy: { days: 2, lastCompletedDate: '2026-10-25' } } });
        useAppStore.getState().incrementStreak('liturgy');
        const s = useAppStore.getState().streaks.liturgy;
        expect(s.days).toBe(1);
        expect(s.history).toEqual(['2026-10-24', '2026-10-25', '2026-10-28']);
    });
});

describe('mergeStreaks history', () => {
    it('unions the days each device saw', () => {
        const local = { ...emptyStreaks(), liturgy_hours: { days: 1, lastCompletedDate: '2026-10-28', history: ['2026-10-20', '2026-10-28'] } };
        const remote = { liturgy_hours: { days: 1, lastCompletedDate: '2026-10-26', history: ['2026-10-22', '2026-10-26'] } };
        const merged = mergeStreaks(local, remote);
        expect(merged.liturgy_hours.history).toEqual(['2026-10-20', '2026-10-22', '2026-10-26', '2026-10-28']);
        expect(streaksEqual(merged, local)).toBe(false);
        expect(streaksEqual(mergeStreaks(merged, remote), merged)).toBe(true);
    });
});
