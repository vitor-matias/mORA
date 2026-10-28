// The publisher's "already published?" check reads relays over a raw socket,
// so it has to verify what comes back itself.

import { describe, expect, it } from 'vitest';
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools/pure';
// @ts-expect-error plain JS server module, no types
import { buildPuzzle, publishedDate } from '../../server/palavra/publish.js';
// @ts-expect-error plain JS server module, no types
import * as server from '../../server/palavra/palavra.js';
import * as client from './palavra/game';

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

// The server and the app each carry these rules. If they ever differ, every
// puzzle fails the app's check and the game is unplayable — with CI green.
describe('server and app agree on the puzzle rules', () => {
    const words = ['Misericórdia', 'coração', 'ÁGUA', 'Ñandú', 'pão-de-ló'];
    const date = '2026-10-28';

    it.each(words)('%s', (word) => {
        expect(server.normalizeWord(word)).toBe(client.normalizeWord(word));
        expect(server.answerHash(date, word)).toBe(client.answerHash(date, word));
        expect(server.obfuscateAnswer(date, word)).toBe(client.obfuscateAnswer(date, word));
        // What the publisher scrambles, the app unscrambles to the same thing
        // its own scrambling would give back.
        expect(client.deobfuscateAnswer(date, server.obfuscateAnswer(date, word)))
            .toBe(client.deobfuscateAnswer(date, client.obfuscateAnswer(date, word)));
    });

    // Backfilling republishes past days, which is only safe if a date always
    // deals the same puzzle.
    it('deals the same puzzle for a date every time', () => {
        expect(buildPuzzle(date)).toEqual(buildPuzzle(date));
    });
});
