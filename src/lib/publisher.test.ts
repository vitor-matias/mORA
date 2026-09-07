import { describe, expect, it } from 'vitest';
import { parsePublisherPubkey } from './publisher';

// One pin, checked in one place, for both feeds the app reads back: the daily
// puzzle and the liturgical calendar. Getting this wrong is quiet — a pin that
// can never match reads as "nothing published" on every single day — so the
// shapes that must be refused are pinned down here.

describe('parsePublisherPubkey', () => {
    const key = 'A1B2C3D4E5F6'.repeat(5) + 'abcd'; // 64 hex characters

    it('accepts a 64-character hex key, lowercased', () => {
        expect(key).toHaveLength(64);
        expect(parsePublisherPubkey(key)).toBe(key.toLowerCase());
    });

    it('tolerates surrounding whitespace, which a copied CI variable brings along', () => {
        expect(parsePublisherPubkey(`  ${key}\n`)).toBe(key.toLowerCase());
    });

    it('refuses an npub rather than pinning something that can never match', () => {
        expect(parsePublisherPubkey('npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq')).toBe('');
    });

    it('refuses a truncated key', () => {
        expect(parsePublisherPubkey(key.slice(0, 63))).toBe('');
    });

    it('refuses non-hex characters', () => {
        expect(parsePublisherPubkey('z'.repeat(64))).toBe('');
    });

    it('is empty when nothing is configured', () => {
        expect(parsePublisherPubkey(undefined)).toBe('');
        expect(parsePublisherPubkey('')).toBe('');
        expect(parsePublisherPubkey('   ')).toBe('');
    });
});
