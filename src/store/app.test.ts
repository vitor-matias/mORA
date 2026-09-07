import { describe, expect, it } from 'vitest';
import {
    favouriteLogsEqual,
    isCompleteSyncedSettings,
    isStarred,
    mergeFavouriteLogs,
    migrateScrollSpeed,
    sanitizeFavouriteLog,
    sanitizeSyncedSettings,
    scrollLevelIndex,
    scrollSpeedAt,
    seedFavouriteLog,
    settingsEqual,
    starredIds,
    toggleFavourite,
    useAppStore,
    CLOCK_SKEW_TOLERANCE_MS,
    DEFAULT_SCROLL_SPEED,
    SCROLL_LEVELS,
    type FavouriteLog,
    type SyncedSettings,
} from './app.ts';

const local: SyncedSettings = { fontFamily: 'serif', rosaryMode: 'beginner' };

describe('sanitizeSyncedSettings', () => {
    it('keeps both settings this version syncs', () => {
        expect(sanitizeSyncedSettings({ fontFamily: 'sans', rosaryMode: 'advanced' }))
            .toEqual({ fontFamily: 'sans', rosaryMode: 'advanced' });
    });

    it('drops the settings that stopped syncing, so an older device cannot restyle this one', () => {
        expect(sanitizeSyncedSettings({
            theme: 'dark',
            fontSize: 'xlarge',
            autoScrollSpeed: 3,
            fontFamily: 'sans',
            rosaryMode: 'advanced',
        })).toEqual({ fontFamily: 'sans', rosaryMode: 'advanced' });
    });

    it('drops values outside the known sets rather than passing them to the UI', () => {
        expect(sanitizeSyncedSettings({ fontFamily: 'comic', rosaryMode: 'expert' })).toEqual({});
    });

    it('treats a non-object payload as empty', () => {
        expect(sanitizeSyncedSettings(null)).toEqual({});
        expect(sanitizeSyncedSettings('serif')).toEqual({});
    });
});

describe('isCompleteSyncedSettings', () => {
    it('accepts a snapshot carrying every synced setting', () => {
        expect(isCompleteSyncedSettings({ fontFamily: 'sans', rosaryMode: 'advanced' })).toBe(true);
    });

    // A partial snapshot must lose the last-write-wins comparison: adopting it
    // would take the remote timestamp while leaving the missing field local.
    it('rejects a snapshot missing either setting', () => {
        expect(isCompleteSyncedSettings({ fontFamily: 'sans' })).toBe(false);
        expect(isCompleteSyncedSettings({ rosaryMode: 'advanced' })).toBe(false);
        expect(isCompleteSyncedSettings({})).toBe(false);
    });
});

describe('settingsEqual', () => {
    it('ignores keys the snapshot carries that this version no longer syncs', () => {
        expect(settingsEqual(local, {
            ...local,
            theme: 'dark',
            autoScrollSpeed: 3,
        } as Partial<SyncedSettings>)).toBe(true);
    });

    it('never calls an empty snapshot equal to real local settings', () => {
        expect(settingsEqual(local, {})).toBe(false);
    });

    it('reports a differing setting', () => {
        expect(settingsEqual(local, { fontFamily: 'sans', rosaryMode: 'beginner' })).toBe(false);
    });
});

describe('scrollLevelIndex', () => {
    it('finds every level of the scale', () => {
        SCROLL_LEVELS.forEach((level, idx) => expect(scrollLevelIndex(level.label)).toBe(idx));
    });

    it('falls back to the default for a value no longer on the scale', () => {
        expect(scrollLevelIndex('⅞')).toBe(scrollLevelIndex(DEFAULT_SCROLL_SPEED));
        expect(scrollLevelIndex(undefined)).toBe(scrollLevelIndex(DEFAULT_SCROLL_SPEED));
        // A raw index is what pre-v2 stores held; only the migration reads those.
        expect(scrollLevelIndex(2)).toBe(scrollLevelIndex(DEFAULT_SCROLL_SPEED));
    });
});

describe('scrollSpeedAt', () => {
    it('clamps a step past either end back onto the scale', () => {
        expect(scrollSpeedAt(-1)).toBe(SCROLL_LEVELS[0].label);
        expect(scrollSpeedAt(SCROLL_LEVELS.length)).toBe(SCROLL_LEVELS[SCROLL_LEVELS.length - 1].label);
    });
});

describe('SCROLL_LEVELS', () => {
    it('runs from slowest to fastest', () => {
        const speeds = SCROLL_LEVELS.map((level) => level.pps);
        expect(speeds).toEqual([...speeds].sort((a, b) => a - b));
        expect(new Set(speeds).size).toBe(speeds.length);
    });

    it('gives each fraction that fraction of the pace labelled 1', () => {
        const base = SCROLL_LEVELS.find((level) => level.label === '1')!.pps;
        const fractions: [string, number][] = [['¼', 1 / 4], ['⅓', 1 / 3], ['½', 1 / 2], ['¾', 3 / 4]];
        fractions.forEach(([label, fraction]) => {
            expect(SCROLL_LEVELS.find((level) => level.label === label)!.pps).toBeCloseTo(base * fraction, 5);
        });
    });
});

describe('migrateScrollSpeed', () => {
    // Speeds were stored as indices until v2, so every level inserted since
    // shifted what a stored number meant; left alone, a reader on '2' would
    // have come back on ⅓.
    it('resolves an index against the scale the build that wrote it had', () => {
        ['½', '1', '2', '3'].forEach((label, storedIndex) => {
            expect(migrateScrollSpeed(storedIndex, 0)).toBe(label);
        });
        ['¼', '½', '¾', '1', '2', '3'].forEach((label, storedIndex) => {
            expect(migrateScrollSpeed(storedIndex, 1)).toBe(label);
        });
    });

    it('keeps a label written by v2 or later', () => {
        SCROLL_LEVELS.forEach((level) => expect(migrateScrollSpeed(level.label, 2)).toBe(level.label));
    });

    it('falls back to the default for a missing or unrecognised value', () => {
        expect(migrateScrollSpeed(undefined, 0)).toBe(DEFAULT_SCROLL_SPEED);
        expect(migrateScrollSpeed(9, 1)).toBe(DEFAULT_SCROLL_SPEED);
        expect(migrateScrollSpeed('2', 0)).toBe(DEFAULT_SCROLL_SPEED);
        expect(migrateScrollSpeed(2, 2)).toBe(DEFAULT_SCROLL_SPEED);
        expect(migrateScrollSpeed('⅞', 2)).toBe(DEFAULT_SCROLL_SPEED);
    });
});

describe('autoScrollSpeed', () => {
    it('remembers the speed it is set to', () => {
        useAppStore.getState().setAutoScrollSpeed('¼');
        expect(useAppStore.getState().autoScrollSpeed).toBe('¼');
        useAppStore.getState().setAutoScrollSpeed('3');
        expect(useAppStore.getState().autoScrollSpeed).toBe('3');
    });
});


// ── Favourites ───────────────────────────────────────────────────────────

/** A log written the way the store writes one, with readable times. */
const at = (iso: string) => Date.parse(iso);
const starred = (iso: string) => ({ at: at(iso), on: true });
const unstarred = (iso: string) => ({ at: at(iso), on: false });

describe('starredIds', () => {
    it('lists the starred ids newest first and leaves the tombstones out', () => {
        expect(starredIds({
            'salve-rainha': starred('2026-01-02T10:00:00Z'),
            'angelus': unstarred('2026-01-03T10:00:00Z'),
            'magnificat': starred('2026-01-04T10:00:00Z'),
        })).toEqual(['magnificat', 'salve-rainha']);
    });

    it('breaks ties on the id, so the order never depends on how the log was built', () => {
        const same = starred('2026-01-02T10:00:00Z');
        expect(starredIds({ pai: same, ave: same, credo: same })).toEqual(['ave', 'credo', 'pai']);
    });
});

describe('toggleFavourite', () => {
    it('stars an id that was never starred, and unstars it again', () => {
        const first = toggleFavourite({}, 'angelus', at('2026-01-02T10:00:00Z'));
        expect(first).toEqual({ angelus: starred('2026-01-02T10:00:00Z') });
        expect(isStarred(first, 'angelus')).toBe(true);

        // The tombstone stays: it is what tells the other device the star was
        // taken away rather than never having arrived.
        const second = toggleFavourite(first, 'angelus', at('2026-01-03T10:00:00Z'));
        expect(second).toEqual({ angelus: unstarred('2026-01-03T10:00:00Z') });
        expect(isStarred(second, 'angelus')).toBe(false);
    });

    it('leaves the log it was given alone', () => {
        const log: FavouriteLog = { angelus: starred('2026-01-02T10:00:00Z') };
        toggleFavourite(log, 'angelus');
        expect(log).toEqual({ angelus: starred('2026-01-02T10:00:00Z') });
    });
});

describe('mergeFavouriteLogs', () => {
    it('keeps what each device starred — neither list replaces the other', () => {
        const phone = { angelus: starred('2026-01-02T10:00:00Z') };
        const laptop = { magnificat: starred('2026-01-02T11:00:00Z') };
        expect(starredIds(mergeFavouriteLogs(phone, laptop))).toEqual(['magnificat', 'angelus']);
    });

    it('lets a later unstar remove a star the other device still holds', () => {
        const phone = { angelus: unstarred('2026-01-03T10:00:00Z') };
        const laptop = { angelus: starred('2026-01-02T10:00:00Z') };
        expect(starredIds(mergeFavouriteLogs(phone, laptop))).toEqual([]);
        expect(starredIds(mergeFavouriteLogs(laptop, phone))).toEqual([]);
    });

    it('lets a later star bring back one the other device unstarred', () => {
        const phone = { angelus: starred('2026-01-04T10:00:00Z') };
        const laptop = { angelus: unstarred('2026-01-03T10:00:00Z') };
        expect(starredIds(mergeFavouriteLogs(phone, laptop))).toEqual(['angelus']);
    });

    // A star that vanishes has to be noticed to be repaired; one that lingers
    // is a single tap from gone.
    it('keeps the star when the two toggles are stamped the same moment', () => {
        const phone = { angelus: unstarred('2026-01-03T10:00:00Z') };
        const laptop = { angelus: starred('2026-01-03T10:00:00Z') };
        expect(starredIds(mergeFavouriteLogs(phone, laptop))).toEqual(['angelus']);
        expect(starredIds(mergeFavouriteLogs(laptop, phone))).toEqual(['angelus']);
    });

    it('is idempotent, so a device that syncs twice publishes nothing the second time', () => {
        const phone = { angelus: starred('2026-01-02T10:00:00Z') };
        const laptop = { magnificat: starred('2026-01-02T11:00:00Z') };
        const once = mergeFavouriteLogs(phone, laptop);
        expect(favouriteLogsEqual(mergeFavouriteLogs(once, laptop), once)).toBe(true);
    });
});

describe('favouriteLogsEqual', () => {
    it('sees a differing entry, an extra one, and a missing one', () => {
        const log = { angelus: starred('2026-01-02T10:00:00Z') };
        expect(favouriteLogsEqual(log, { ...log })).toBe(true);
        expect(favouriteLogsEqual(log, { angelus: unstarred('2026-01-02T10:00:00Z') })).toBe(false);
        expect(favouriteLogsEqual(log, { angelus: starred('2026-01-03T10:00:00Z') })).toBe(false);
        expect(favouriteLogsEqual(log, { ...log, credo: starred('2026-01-02T10:00:00Z') })).toBe(false);
        expect(favouriteLogsEqual(log, {})).toBe(false);
    });
});

describe('sanitizeFavouriteLog', () => {
    it('keeps well-formed entries', () => {
        const log = { angelus: starred('2026-01-02T10:00:00Z'), credo: unstarred('2026-01-03T10:00:00Z') };
        expect(sanitizeFavouriteLog(log, at('2026-02-01T10:00:00Z'))).toEqual(log);
    });

    it('drops entries a relay could use to put the store in a state the UI cannot render', () => {
        expect(sanitizeFavouriteLog({
            good: starred('2026-01-02T10:00:00Z'),
            missingFlag: { at: at('2026-01-02T10:00:00Z') },
            missingTime: { on: true },
            notAnEntry: 'yes',
            infinite: { at: Infinity, on: true },
            negative: { at: -1, on: true },
        }, at('2026-02-01T10:00:00Z'))).toEqual({ good: starred('2026-01-02T10:00:00Z') });
    });

    // An entry stamped in the future would outrank every star and unstar made
    // here afterwards, freezing that prayer's state for good.
    it('refuses a timestamp beyond what a clock could plausibly be out by', () => {
        const now = at('2026-02-01T10:00:00Z');
        expect(sanitizeFavouriteLog({ soon: { at: now + CLOCK_SKEW_TOLERANCE_MS - 1, on: true } }, now))
            .toEqual({ soon: { at: now + CLOCK_SKEW_TOLERANCE_MS - 1, on: true } });
        expect(sanitizeFavouriteLog({ later: { at: now + CLOCK_SKEW_TOLERANCE_MS + 1, on: true } }, now))
            .toEqual({});
    });

    it('treats anything that is not an object of entries as no snapshot at all', () => {
        expect(sanitizeFavouriteLog(null)).toEqual({});
        expect(sanitizeFavouriteLog(['angelus'])).toEqual({});
        expect(sanitizeFavouriteLog('angelus')).toEqual({});
    });

    it('caps a log that could not have come from a catalogue of a few hundred prayers', () => {
        const huge = Object.fromEntries(
            Array.from({ length: 900 }, (_, i) => [`p${i}`, { at: at('2026-01-02T10:00:00Z') + i, on: true }]),
        );
        const kept = sanitizeFavouriteLog(huge, at('2026-02-01T10:00:00Z'));
        expect(Object.keys(kept)).toHaveLength(500);
        // The newest survive: p899 down to p400.
        expect(kept.p899).toBeDefined();
        expect(kept.p399).toBeUndefined();
    });
});

describe('seedFavouriteLog', () => {
    it('turns the pre-log array into stars, keeping its order', () => {
        expect(starredIds(seedFavouriteLog(['magnificat', 'angelus', 'credo'])))
            .toEqual(['magnificat', 'angelus', 'credo']);
    });

    // Two devices upgrading independently should end up holding both
    // shortlists, so a seeded entry is never a tombstone and always loses to a
    // real toggle made since.
    it('stamps the seeds in the past, so any later toggle outranks them', () => {
        const seeded = seedFavouriteLog(['angelus']);
        const unstarredSince = { angelus: unstarred('2020-01-02T10:00:00Z') };
        expect(starredIds(mergeFavouriteLogs(seeded, unstarredSince))).toEqual([]);
    });

    it('has nothing to seed from a device that had never starred anything', () => {
        expect(seedFavouriteLog(undefined)).toEqual({});
        expect(seedFavouriteLog([])).toEqual({});
        expect(seedFavouriteLog(['', 42, 'angelus'])).toEqual({ angelus: expect.objectContaining({ on: true }) });
    });
});

describe('favourites in the store', () => {
    it('stars and unstars a prayer, and marks the change as this device\'s', () => {
        useAppStore.getState().applyFavourites({}, {});
        expect(useAppStore.getState().favouritesFromRemote).toBe(true);

        useAppStore.getState().togglePrayerFavourite('angelus');
        expect(starredIds(useAppStore.getState().prayerFavourites)).toEqual(['angelus']);
        expect(useAppStore.getState().favouritesFromRemote).toBe(false);

        useAppStore.getState().togglePrayerFavourite('angelus');
        expect(starredIds(useAppStore.getState().prayerFavourites)).toEqual([]);
    });

    it('keeps the prayers and the hymns apart', () => {
        useAppStore.getState().applyFavourites({}, {});
        useAppStore.getState().toggleChantFavourite('adeste-fideles');
        expect(starredIds(useAppStore.getState().chantFavourites)).toEqual(['adeste-fideles']);
        expect(starredIds(useAppStore.getState().prayerFavourites)).toEqual([]);
    });
});
