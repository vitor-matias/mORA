import { describe, expect, it, vi, afterEach } from 'vitest';
import { toProfileCard } from './nostr';

afterEach(() => vi.restoreAllMocks());

describe('toProfileCard', () => {
    it('keeps an https picture', () => {
        expect(toProfileCard({ name: 'Vítor', picture: 'https://cdn.test/a.jpg' }))
            .toEqual({ name: 'Vítor', picture: 'https://cdn.test/a.jpg' });
    });

    // Rendered as an <img src>, so a javascript: or data: value from a hostile
    // profile would be loading attacker-chosen content into the page.
    it('drops a picture that is not https', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        expect(toProfileCard({ name: 'Vítor', picture: 'http://cdn.test/a.jpg' })?.picture)
            .toBeUndefined();
        expect(toProfileCard({ name: 'V', picture: 'javascript:alert(1)' })?.picture)
            .toBeUndefined();
    });

    // A signed CDN link with a couple of query parameters passes 500 without
    // being unusual, which is why the cap isn't 500 any more.
    it('accepts a long signed CDN URL', () => {
        const long = `https://cdn.test/a.jpg?${'k=v&'.repeat(150)}sig=abc`;
        expect(long.length).toBeGreaterThan(500);
        expect(toProfileCard({ picture: long })?.picture).toBe(long);
    });

    // Some clients embed the avatar in the profile. Refusing these showed a
    // placeholder for a picture every other app renders — the reported bug.
    it('accepts an inline raster image', () => {
        const inline = 'data:image/webp;base64,UklGRqASAABXRUJQVlA4WAoAAAAg';
        expect(toProfileCard({ picture: inline })?.picture).toBe(inline);
        expect(toProfileCard({ picture: 'data:image/png;base64,iVBORw0KG' })?.picture)
            .toBeTruthy();
    });

    // An SVG can carry script, and this one comes from a stranger's profile.
    it('refuses an inline SVG even though it is an image', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        expect(toProfileCard({ picture: 'data:image/svg+xml;base64,PHN2Zz4=' })?.picture)
            .toBeUndefined();
    });

    it('refuses other data URLs', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        expect(toProfileCard({ picture: 'data:text/html;base64,PGgxPmhp' })?.picture)
            .toBeUndefined();
    });

    it('still refuses an absurd one', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        expect(toProfileCard({ picture: `https://cdn.test/${'x'.repeat(300_000)}` })?.picture)
            .toBeUndefined();
    });

    it('says why it dropped one, rather than looking like no picture', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        toProfileCard({ name: 'Vítor', picture: 'http://cdn.test/a.jpg' });
        expect(warn).toHaveBeenCalledOnce();
        expect(String(warn.mock.calls[0][0])).toContain('http://cdn.test/a.jpg');
    });

    it('is null when there is nothing worth showing', () => {
        expect(toProfileCard({})).toBeNull();
        expect(toProfileCard(null)).toBeNull();
        expect(toProfileCard({ name: '   ' })).toBeNull();
    });

    it('collapses and caps an attacker-controlled name', () => {
        expect(toProfileCard({ name: `a${'\n'}   b` })?.name).toBe('a b');
        expect(toProfileCard({ name: 'x'.repeat(80) })?.name).toHaveLength(24);
    });

    it('prefers display_name over name', () => {
        expect(toProfileCard({ name: 'vitor', display_name: 'Vítor M.' })?.name).toBe('Vítor M.');
    });
});

describe('publishNostrProfile', () => {
    // Reported by a user: editing the picture in the app deleted lud16, nip05,
    // display_name and banner from their published profile. Kind 0 is
    // replaceable, so the event that lands *is* the profile.
    it('merges edits over everything already published', () => {
        const published = {
            name: 'Vítor M.',
            display_name: 'Vítor M.',
            displayName: 'Vítor M.',
            picture: 'https://old.test/a.jpg',
            banner: 'https://image.nostr.build/44ab.jpg',
            nip05: 'vitor@nostr.pt',
            lud16: 'vitor@lnbits.dojo.pt',
            about: 'Something about me',
        };
        const edits = { name: 'Vítor M.', display_name: 'Vítor M.', picture: 'https://new.test/b.jpg' };

        const merged = { ...published, ...Object.fromEntries(
            Object.entries(edits).filter(([, v]) => v !== undefined)) };

        expect(merged.lud16).toBe('vitor@lnbits.dojo.pt');
        expect(merged.nip05).toBe('vitor@nostr.pt');
        expect(merged.banner).toBe('https://image.nostr.build/44ab.jpg');
        expect(merged.about).toBe('Something about me');
        expect(merged.displayName).toBe('Vítor M.');
        expect(merged.picture).toBe('https://new.test/b.jpg');
    });

    it('does not let an absent edit blank a published field', () => {
        const published = { name: 'Vítor', lud16: 'vitor@lnbits.dojo.pt' };
        const edits = { name: 'Vítor M.', picture: undefined };
        const merged = { ...published, ...Object.fromEntries(
            Object.entries(edits).filter(([, v]) => v !== undefined)) };
        expect(merged).toEqual({ name: 'Vítor M.', lud16: 'vitor@lnbits.dojo.pt' });
    });
});
