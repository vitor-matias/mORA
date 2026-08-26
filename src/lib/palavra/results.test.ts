import { describe, expect, it } from 'vitest';
import {
    KIND_RESULT,
    countPerGroup,
    filtersFor,
    inGroupsOf,
    resultDTag,
} from './results';
import type { NostrEvent } from '@nostrify/nostrify';

// How a month is cut into relay filters, and how a short read is spotted. Both
// the board and the badge job run on these, so a change here moves who wins a
// month *and* who is handed a permanent badge for it.

describe('inGroupsOf', () => {
    it('splits evenly when the size divides', () => {
        expect(inGroupsOf([1, 2, 3, 4], 2)).toEqual([[1, 2], [3, 4]]);
    });

    it('leaves a short last group rather than padding it', () => {
        expect(inGroupsOf([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    });

    // A 31-day month at 7 a group: the last group is three days, and dropping
    // it would silently lose the end of every long month.
    it('covers a whole month with nothing left over', () => {
        const days = Array.from({ length: 31 }, (_, i) => i + 1);
        const groups = inGroupsOf(days, 7);
        expect(groups).toHaveLength(5);
        expect(groups.flat()).toEqual(days);
    });

    it('has nothing to do with an empty month', () => {
        expect(inGroupsOf([], 7)).toEqual([]);
    });
});

describe('filtersFor', () => {
    const groups = [['2026-08-01', '2026-08-02'], ['2026-08-03']];

    it('makes one filter per group, each with its own limit', () => {
        const filters = filtersFor(groups, 500);
        expect(filters).toHaveLength(2);
        expect(filters.every((f) => f.limit === 500)).toBe(true);
    });

    it('asks for the day keys, not the bare dates', () => {
        expect(filtersFor(groups, 500)[0]['#d'])
            .toEqual([resultDTag('2026-08-01'), resultDTag('2026-08-02')]);
    });

    it('asks for the kind results are published under', () => {
        expect(filtersFor(groups, 500)[0].kinds).toEqual([KIND_RESULT]);
    });
});

describe('countPerGroup', () => {
    const groups = [['2026-08-01', '2026-08-02'], ['2026-08-03']];
    const event = (day: string): NostrEvent => ({
        id: 'f'.repeat(64),
        pubkey: 'a'.repeat(64),
        created_at: 0,
        kind: KIND_RESULT,
        tags: [['d', resultDTag(day)], ['date', day]],
        content: '{}',
        sig: '0'.repeat(128),
    });

    it('counts each event against the group its day belongs to', () => {
        const counts = countPerGroup(
            [event('2026-08-01'), event('2026-08-02'), event('2026-08-03')],
            groups,
        );
        expect(counts).toEqual([2, 1]);
    });

    it('counts nothing for a group with no events', () => {
        expect(countPerGroup([event('2026-08-01')], groups)).toEqual([1, 0]);
    });

    // The count decides whether a filter looks truncated, so an event that
    // belongs to no group must not inflate one — otherwise a stray event
    // triggers a re-read, or worse, makes a month look unreadable and gets a
    // podium refused.
    it('ignores an event outside every group', () => {
        expect(countPerGroup([event('2026-09-01')], groups)).toEqual([0, 0]);
    });

    it('ignores an event with no d tag', () => {
        const bare = { ...event('2026-08-01'), tags: [['date', '2026-08-01']] };
        expect(countPerGroup([bare], groups)).toEqual([0, 0]);
    });

    it('is all zeroes for no events at all', () => {
        expect(countPerGroup([], groups)).toEqual([0, 0]);
    });
});
