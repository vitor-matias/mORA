// The publisher's "already published?" check reads relays over a raw socket,
// so it has to verify what comes back itself.

import { describe, expect, it } from 'vitest';
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools/pure';
// @ts-expect-error plain JS server module, no types
import { publishedDate } from '../../server/palavra/publish.js';

const sk = generateSecretKey();
const me = getPublicKey(sk);
// Through JSON, as it arrives off the socket: finalizeEvent marks its result
// as already verified, and that mark would otherwise survive a tamper.
const puzzle = (key = sk) => JSON.parse(JSON.stringify(finalizeEvent(
    { kind: 30078, created_at: 1, tags: [['date', '2026-10-28'], ['t', 'morapalavra']], content: '' }, key)));

describe('publishedDate', () => {
    it('accepts the publisher’s own signed puzzle', () => {
        expect(publishedDate(puzzle(), me)).toBe('2026-10-28');
    });

    // The bug: one relay answering with this blanked the day everywhere.
    it('ignores an unsigned or tampered event', () => {
        expect(publishedDate({ ...puzzle(), sig: '0'.repeat(128) }, me)).toBeNull();
        expect(publishedDate({ kind: 30078, pubkey: me, tags: [['date', '2026-10-28']] }, me)).toBeNull();
    });

    it('ignores someone else’s event', () => {
        expect(publishedDate(puzzle(generateSecretKey()), me)).toBeNull();
    });
});
