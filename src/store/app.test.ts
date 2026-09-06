import { describe, expect, it } from 'vitest';
import {
    isCompleteSyncedSettings,
    migrateScrollSpeed,
    sanitizeSyncedSettings,
    scrollLevelIndex,
    scrollSpeedAt,
    settingsEqual,
    useAppStore,
    DEFAULT_SCROLL_SPEED,
    SCROLL_LEVELS,
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
