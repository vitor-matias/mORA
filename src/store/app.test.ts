import { describe, expect, it } from 'vitest';
import {
    clampScrollLevel,
    isCompleteSyncedSettings,
    migrateScrollLevel,
    sanitizeSyncedSettings,
    settingsEqual,
    useAppStore,
    DEFAULT_SCROLL_LEVEL,
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

describe('clampScrollLevel', () => {
    it('keeps every valid level', () => {
        SCROLL_LEVELS.forEach((_, idx) => expect(clampScrollLevel(idx)).toBe(idx));
    });

    it('clamps a step past either end back into range', () => {
        expect(clampScrollLevel(-1)).toBe(0);
        expect(clampScrollLevel(SCROLL_LEVELS.length)).toBe(SCROLL_LEVELS.length - 1);
    });

    it('falls back to the default for a corrupted persisted value', () => {
        expect(clampScrollLevel(1.5)).toBe(DEFAULT_SCROLL_LEVEL);
        expect(clampScrollLevel(NaN)).toBe(DEFAULT_SCROLL_LEVEL);
    });
});

describe('SCROLL_LEVELS', () => {
    it('runs from slowest to fastest', () => {
        const speeds = SCROLL_LEVELS.map((level) => level.pps);
        expect(speeds).toEqual([...speeds].sort((a, b) => a - b));
        expect(new Set(speeds).size).toBe(speeds.length);
    });

    it('defaults to the level labelled 2, as it did before the fractions', () => {
        expect(SCROLL_LEVELS[DEFAULT_SCROLL_LEVEL].label).toBe('2');
    });
});

describe('migrateScrollLevel', () => {
    // ¼ and ¾ went in below and between the old levels, so every stored index
    // above ½ shifted; left alone, a reader on '2' would find themselves on ¾.
    it('maps each level of the old four-step scale onto the same label', () => {
        const oldLabels = ['½', '1', '2', '3'];
        oldLabels.forEach((label, storedIndex) => {
            expect(SCROLL_LEVELS[migrateScrollLevel(storedIndex, 0)].label).toBe(label);
        });
    });

    it('leaves an already-migrated value alone', () => {
        SCROLL_LEVELS.forEach((_, idx) => expect(migrateScrollLevel(idx, 1)).toBe(idx));
    });

    it('falls back to the default for a missing or unrecognised value', () => {
        expect(migrateScrollLevel(undefined, 0)).toBe(DEFAULT_SCROLL_LEVEL);
        expect(migrateScrollLevel(9, 0)).toBe(DEFAULT_SCROLL_LEVEL);
        expect(migrateScrollLevel('2', 0)).toBe(DEFAULT_SCROLL_LEVEL);
        expect(migrateScrollLevel(99, 1)).toBe(SCROLL_LEVELS.length - 1);
    });
});

// The +/- controls during a reading write straight to this value, so the
// speed last used is the one the next reading starts at.
describe('autoScrollSpeed', () => {
    it('remembers the speed it is set to', () => {
        useAppStore.getState().setAutoScrollSpeed(0);
        expect(useAppStore.getState().autoScrollSpeed).toBe(0);
        useAppStore.getState().setAutoScrollSpeed(5);
        expect(useAppStore.getState().autoScrollSpeed).toBe(5);
    });
});
