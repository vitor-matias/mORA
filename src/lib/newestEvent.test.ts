import { describe, expect, it } from 'vitest';
import { newestEvent, supersedes } from './nostr';
import type { NostrEvent } from '@nostrify/nostrify';

// One rule for "which version of this replaceable event is current", used by
// the contact list, the profile badge list and the badge definitions. Two of
// those gate a write that republishes the whole list, so picking the stale one
// of a tied pair does not just display something old — it publishes it over
// the current one.

const event = (id: string, created_at: number): NostrEvent => ({
    id,
    created_at,
    pubkey: 'a'.repeat(64),
    kind: 3,
    tags: [],
    content: '',
    sig: '0'.repeat(128),
});

describe('supersedes', () => {
    it('accepts anything over nothing', () => {
        expect(supersedes(event('a', 1), undefined)).toBe(true);
    });

    it('prefers the later timestamp', () => {
        expect(supersedes(event('a', 2), event('b', 1))).toBe(true);
        expect(supersedes(event('a', 1), event('b', 2))).toBe(false);
    });

    // The case that matters: a republish takes milliseconds, so two versions
    // sharing a second is ordinary rather than exotic.
    it('breaks a tie on the lower id', () => {
        expect(supersedes(event('a', 1), event('b', 1))).toBe(true);
        expect(supersedes(event('b', 1), event('a', 1))).toBe(false);
    });

    it('is antisymmetric on a tie, so two readers cannot both win', () => {
        const x = event('a', 1);
        const y = event('b', 1);
        expect(supersedes(x, y)).toBe(!supersedes(y, x));
    });
});

describe('newestEvent', () => {
    it('has nothing to return for nothing', () => {
        expect(newestEvent([])).toBeUndefined();
    });

    it('finds the latest', () => {
        expect(newestEvent([event('a', 1), event('c', 3), event('b', 2)])?.id).toBe('c');
    });

    // Relay answers arrive in whatever order the network decides, so the same
    // set must give the same answer whichever way round it is read.
    it('does not depend on the order it was given', () => {
        const events = [event('b', 5), event('a', 5), event('c', 4)];
        const forwards = newestEvent(events)?.id;
        const backwards = newestEvent([...events].reverse())?.id;
        expect(forwards).toBe('a');
        expect(backwards).toBe('a');
    });
});
