import { describe, expect, it } from 'vitest';
import {
    isCompleteSyncedSettings,
    sanitizeSyncedSettings,
    settingsEqual,
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
