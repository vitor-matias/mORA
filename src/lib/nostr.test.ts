import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import { toProfileCard } from './nostr';
import { starredIds, useAppStore } from '@/store/app';

afterEach(() => vi.restoreAllMocks());

describe('toProfileCard', () => {
    it('keeps an https picture', () => {
        expect(toProfileCard({ name: 'Vítor', picture: 'https://cdn.test/a.jpg' }))
            .toEqual({ name: 'Vítor', picture: 'https://cdn.test/a.jpg' });
    });

    // Rendered as an <img src>, so a javascript: value from a hostile profile
    // would be loading attacker-chosen content into the page, and http would
    // break the padlock on an https deployment. Inline raster images are a
    // separate case and are allowed — see below.
    it('drops a picture that is neither https nor an inline raster image', () => {
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

// ── publishNostrProfile ──────────────────────────────────────────────────
//
// Exercised through the real function, with the relay and the signer stubbed.
// An earlier version of these tests re-implemented the merge inline and
// asserted that — which would have passed just as happily if the function had
// stopped merging altogether. Review caught it; the point of these is the
// production code path, so they call it.

const ME = 'a'.repeat(64);

const relayQuery = vi.fn();
const relayPublish = vi.fn();
const signEvent = vi.fn();

// Hoisted alongside the mock factory below, which reads them.
const { silentRelays, TEST_RELAYS } = vi.hoisted(() => ({
    /** Relays that never finish answering: no events, no EOSE — what a dead
        relay, or one still connecting when the deadline lands, looks like. */
    silentRelays: new Set<string>(),
    TEST_RELAYS: ['wss://one.test', 'wss://two.test'],
}));

// Snapshots are read relay by relay (queryComplete), so each relay answers
// with whatever `relayQuery` holds and then says it is done — unless it has
// been silenced above.
vi.mock('@/lib/pool', () => ({
    pool: {
        query: (...args: unknown[]) => relayQuery(...args),
        event: (...args: unknown[]) => relayPublish(...args),
        relay: (url: string) => ({
            async *req(...args: unknown[]) {
                if (silentRelays.has(url)) return;
                for (const event of await relayQuery(...args)) yield ['EVENT', 'sub', event];
                yield ['EOSE', 'sub'];
            },
        }),
    },
    RELAYS: TEST_RELAYS,
}));
vi.mock('@/store/auth', () => ({
    currentPubkey: () => ME,
    useAuthStore: {
        getState: () => ({ login: { type: 'nsec', pubkey: ME }, profile: null }),
    },
}));
// Stubbed where the signer is actually built: `getSigner` reads the login type
// and hands the work to NUser, so this is the seam, not '@/lib/signer'.
// Snapshots are NIP-44 encrypted to self before they leave the device, so the
// signer has to offer it — stubbed as a visible prefix, which keeps what was
// actually published readable in the assertions below.
const SEALED = 'nip44:';
vi.mock('@nostrify/react/login', () => ({
    NUser: {
        fromNsecLogin: () => ({
            signer: {
                signEvent: (t: unknown) => signEvent(t),
                nip44: {
                    encrypt: async (_pubkey: string, plaintext: string) => SEALED + plaintext,
                    decrypt: async (_pubkey: string, ciphertext: string) => ciphertext.slice(SEALED.length),
                },
            },
        }),
    },
}));

/** The kind-0 the relays are holding for this identity. */
function published(content: unknown, created_at = 1000) {
    relayQuery.mockResolvedValue([{
        id: 'x', pubkey: ME, kind: 0, created_at, tags: [],
        content: typeof content === 'string' ? content : JSON.stringify(content), sig: 's',
    }]);
}

/** The content of the event that was actually signed. */
const signedContent = () => JSON.parse(signEvent.mock.calls[0][0].content) as Record<string, unknown>;

describe('publishNostrProfile', () => {
    beforeEach(() => {
        relayQuery.mockReset();
        relayPublish.mockReset().mockResolvedValue(undefined);
        signEvent.mockReset().mockImplementation(async (t: { content: string }) =>
            ({ ...t, id: 'signed', pubkey: ME, sig: 'sig' }));
    });

    // The reported bug: editing the picture deleted lud16, nip05, display_name
    // and banner, because kind 0 is replaceable and only two fields were sent.
    it('keeps every field the form never sees', async () => {
        published({
            name: 'Vítor M.', display_name: 'Vítor M.', displayName: 'Vítor M.',
            picture: 'https://old.test/a.jpg',
            banner: 'https://image.nostr.build/44ab.jpg',
            nip05: 'vitor@nostr.pt', lud16: 'vitor@lnbits.dojo.pt',
            about: 'Something about me',
        });
        const { publishNostrProfile } = await import('./nostr');

        await publishNostrProfile({
            name: 'Vítor M.', display_name: 'Vítor M.', picture: 'https://new.test/b.jpg',
        });

        expect(signedContent()).toMatchObject({
            lud16: 'vitor@lnbits.dojo.pt',
            nip05: 'vitor@nostr.pt',
            banner: 'https://image.nostr.build/44ab.jpg',
            about: 'Something about me',
            displayName: 'Vítor M.',
            picture: 'https://new.test/b.jpg',
        });
    });

    it('refuses to publish when the relays cannot be read', async () => {
        relayQuery.mockRejectedValue(new Error('offline'));
        const { publishNostrProfile } = await import('./nostr');

        await expect(publishNostrProfile({ name: 'New' })).rejects.toThrow();
        expect(relayPublish).not.toHaveBeenCalled();
    });

    it('refuses when the published profile is not valid JSON', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        published('not json at all');
        const { publishNostrProfile } = await import('./nostr');

        await expect(publishNostrProfile({ name: 'New' })).rejects.toThrow();
        expect(relayPublish).not.toHaveBeenCalled();
    });

    // `typeof [] === 'object'`, so an array slipped past the first guard and
    // the merge would have replaced the published content with the edits.
    it('refuses when the published profile is an array or a scalar', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { publishNostrProfile } = await import('./nostr');

        published([1, 2, 3]);
        await expect(publishNostrProfile({ name: 'New' })).rejects.toThrow();
        published('"just a string"');
        await expect(publishNostrProfile({ name: 'New' })).rejects.toThrow();
        expect(relayPublish).not.toHaveBeenCalled();
    });

    it('publishes for a brand-new identity without reading first', async () => {
        relayQuery.mockRejectedValue(new Error('offline'));
        const { publishNostrProfile } = await import('./nostr');

        await publishNostrProfile({ name: 'Novo' }, { isNewIdentity: true });

        expect(signedContent()).toEqual({ name: 'Novo' });
        expect(relayPublish).toHaveBeenCalled();
    });

    it('does not blank a published field with an absent edit', async () => {
        published({ name: 'Vítor', lud16: 'vitor@lnbits.dojo.pt' });
        const { publishNostrProfile } = await import('./nostr');

        await publishNostrProfile({ name: 'Vítor M.', picture: undefined });

        expect(signedContent()).toEqual({ name: 'Vítor M.', lud16: 'vitor@lnbits.dojo.pt' });
    });

    it('returns the merged profile, not just the edits', async () => {
        published({ name: 'Vítor', lud16: 'vitor@lnbits.dojo.pt' });
        const { publishNostrProfile } = await import('./nostr');

        const result = await publishNostrProfile({ picture: 'https://new.test/b.jpg' });

        expect(result).toMatchObject({
            name: 'Vítor', lud16: 'vitor@lnbits.dojo.pt', picture: 'https://new.test/b.jpg',
        });
    });

    it('keeps the newest published profile when relays disagree', async () => {
        relayQuery.mockResolvedValue([
            { id: 'a', pubkey: ME, kind: 0, created_at: 100, tags: [], content: '{"lud16":"old@x"}', sig: 's' },
            { id: 'b', pubkey: ME, kind: 0, created_at: 900, tags: [], content: '{"lud16":"new@x"}', sig: 's' },
        ]);
        const { publishNostrProfile } = await import('./nostr');

        await publishNostrProfile({ name: 'V' });

        expect(signedContent().lud16).toBe('new@x');
    });
});


const D_FAVOURITES = 'mora-app-favourites';
const NOW = Date.now();
const DAY = 24 * 60 * 60 * 1000;

/** The favourites snapshot the relays are holding for this identity. */
function heldFavourites(payload: unknown) {
    relayQuery.mockResolvedValue([{
        id: 'f', pubkey: ME, kind: 30078, created_at: 1000,
        tags: [['d', D_FAVOURITES]],
        content: SEALED + JSON.stringify(payload), sig: 's',
    }]);
}

/** The payload of the snapshot this device published, unsealed. */
function publishedFavourites() {
    const { content } = signEvent.mock.calls.at(-1)![0] as { content: string };
    return JSON.parse(content.slice(SEALED.length)) as {
        prayers: Record<string, { at: number; on: boolean }>;
        chants: Record<string, { at: number; on: boolean }>;
    };
}

describe('syncFavouritesWithNostr', () => {
    beforeEach(() => {
        silentRelays.clear();
        relayQuery.mockReset().mockResolvedValue([]);
        relayPublish.mockReset().mockResolvedValue(undefined);
        signEvent.mockReset().mockImplementation(async (t: { content: string }) =>
            ({ ...t, id: 'signed', pubkey: ME, sig: 'sig' }));
        useAppStore.setState({
            shareStreaks: true,
            prayerFavourites: {},
            chantFavourites: {},
            favouritesFromRemote: false,
        });
    });

    // The whole point of merging rather than letting one side win: an
    // afternoon's starring on the phone must not delete the laptop's.
    it('keeps both devices\' stars, and publishes the union back', async () => {
        useAppStore.setState({ prayerFavourites: { angelus: { at: NOW - DAY, on: true } } });
        heldFavourites({
            prayers: { magnificat: { at: NOW - 2 * DAY, on: true } },
            chants: { 'adeste-fideles': { at: NOW - DAY, on: true } },
        });
        const { syncFavouritesWithNostr } = await import('./nostr');

        await syncFavouritesWithNostr();

        const state = useAppStore.getState();
        expect(starredIds(state.prayerFavourites)).toEqual(['angelus', 'magnificat']);
        expect(starredIds(state.chantFavourites)).toEqual(['adeste-fideles']);
        // Adopted from the relays, so the sync hook must not publish it again.
        expect(state.favouritesFromRemote).toBe(true);
        expect(starredIds(publishedFavourites().prayers)).toEqual(['angelus', 'magnificat']);
    });

    it('lets an unstar made on another device remove the star here', async () => {
        useAppStore.setState({ prayerFavourites: { angelus: { at: NOW - 2 * DAY, on: true } } });
        heldFavourites({ prayers: { angelus: { at: NOW - DAY, on: false } }, chants: {} });
        const { syncFavouritesWithNostr } = await import('./nostr');

        await syncFavouritesWithNostr();

        expect(starredIds(useAppStore.getState().prayerFavourites)).toEqual([]);
    });

    // The tombstone has to travel, or the device that still holds the star
    // would hand it straight back on its next sync.
    it('publishes the unstar to relays that still show the star', async () => {
        useAppStore.setState({ prayerFavourites: { angelus: { at: NOW - DAY, on: false } } });
        heldFavourites({ prayers: { angelus: { at: NOW - 2 * DAY, on: true } }, chants: {} });
        const { syncFavouritesWithNostr } = await import('./nostr');

        await syncFavouritesWithNostr();

        expect(publishedFavourites().prayers.angelus).toEqual({ at: NOW - DAY, on: false });
    });

    it('writes nothing when the relays already hold what this device has', async () => {
        const prayers = { angelus: { at: NOW - DAY, on: true } };
        useAppStore.setState({ prayerFavourites: { ...prayers } });
        heldFavourites({ prayers, chants: {} });
        const { syncFavouritesWithNostr } = await import('./nostr');

        await syncFavouritesWithNostr();

        expect(relayPublish).not.toHaveBeenCalled();
    });

    it('seeds the relays when this identity has never published favourites', async () => {
        useAppStore.setState({ prayerFavourites: { angelus: { at: NOW - DAY, on: true } } });
        const { syncFavouritesWithNostr } = await import('./nostr');

        await syncFavouritesWithNostr();

        expect(starredIds(publishedFavourites().prayers)).toEqual(['angelus']);
    });

    // "Nothing came back" and "nobody answered" used to look the same, and the
    // seed above then ran on a read no relay had finished — publishing this
    // device's list over the one the other device had just put there.
    it('leaves the relays alone when they did not answer', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        useAppStore.setState({ prayerFavourites: { angelus: { at: NOW - DAY, on: true } } });
        for (const url of TEST_RELAYS) silentRelays.add(url);
        const { syncFavouritesWithNostr } = await import('./nostr');

        await syncFavouritesWithNostr();

        expect(relayPublish).not.toHaveBeenCalled();
        // This device's own stars are untouched by a read that said nothing.
        expect(starredIds(useAppStore.getState().prayerFavourites)).toEqual(['angelus']);
    });

    // Half the relays is not a majority. What the answering half sent is
    // still merged in, though: a union loses nothing.
    it('merges what arrived but does not publish when only half the relays answered', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        useAppStore.setState({ prayerFavourites: { angelus: { at: NOW - DAY, on: true } } });
        heldFavourites({ prayers: { magnificat: { at: NOW - 2 * DAY, on: true } }, chants: {} });
        silentRelays.add(TEST_RELAYS[0]);
        const { syncFavouritesWithNostr } = await import('./nostr');

        await syncFavouritesWithNostr();

        expect(starredIds(useAppStore.getState().prayerFavourites)).toEqual(['angelus', 'magnificat']);
        expect(relayPublish).not.toHaveBeenCalled();
    });

    // Syncing is opt-in: with the switch off, a shortlist never leaves the
    // device and the relays are not even asked.
    it('does nothing at all while cross-device sync is off', async () => {
        useAppStore.setState({
            shareStreaks: false,
            prayerFavourites: { angelus: { at: NOW - DAY, on: true } },
        });
        const { syncFavouritesWithNostr } = await import('./nostr');

        await syncFavouritesWithNostr();

        expect(relayQuery).not.toHaveBeenCalled();
        expect(relayPublish).not.toHaveBeenCalled();
    });
});
