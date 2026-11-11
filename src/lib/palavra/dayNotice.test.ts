import { describe, expect, it } from 'vitest';
import { blocksPlay, dayNotice } from './dayNotice';

const today = '2026-11-11';
const midnight = Date.parse(`${today}T00:00:00Z`) / 1000;
const base = {
    isArchive: false, over: false, guesses: 0, publishedToday: false,
    locked: false, syncOn: false, logTouchedAt: null, today,
};

describe('dayNotice', () => {
    it('says nothing for a fresh day with no hints', () => {
        expect(dayNotice(base)).toBeNull();
        expect(blocksPlay(null)).toBe(false);
    });

    it('closes the board when today is published elsewhere, whatever the key and sync', () => {
        expect(dayNotice({ ...base, publishedToday: true })).toBe('played-sync-off');
        expect(dayNotice({ ...base, publishedToday: true, locked: true })).toBe('played-sync-off');
        expect(dayNotice({ ...base, publishedToday: true, syncOn: true, locked: true })).toBe('played-unlock');
        expect(dayNotice({ ...base, publishedToday: true, syncOn: true })).toBe('played-resync');
        for (const notice of ['played-sync-off', 'played-unlock', 'played-resync'] as const) {
            expect(blocksPlay(notice)).toBe(true);
        }
    });

    it('stays quiet once the game here is over, or on an archive day', () => {
        expect(dayNotice({ ...base, publishedToday: true, over: true })).toBeNull();
        expect(dayNotice({ ...base, publishedToday: true, isArchive: true })).toBeNull();
    });

    it('hints at a game in progress elsewhere without closing the board', () => {
        const notice = dayNotice({ ...base, locked: true, syncOn: true, logTouchedAt: midnight + 60 });
        expect(notice).toBe('in-progress-unlock');
        expect(blocksPlay(notice)).toBe(false);
    });

    it('does not hint when the log was last written before today', () => {
        expect(dayNotice({ ...base, locked: true, syncOn: true, logTouchedAt: midnight - 1 })).toBeNull();
    });

    it('does not hint once a guess is made here, when unlocked, or with sync off', () => {
        expect(dayNotice({ ...base, locked: true, syncOn: true, logTouchedAt: midnight + 60, guesses: 1 })).toBeNull();
        expect(dayNotice({ ...base, syncOn: true, logTouchedAt: midnight + 60 })).toBeNull();
        expect(dayNotice({ ...base, locked: true, logTouchedAt: midnight + 60 })).toBeNull();
    });
});
