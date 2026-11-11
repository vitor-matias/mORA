import { describe, expect, it } from 'vitest';
import { blocksPlay, dayNotice } from './dayNotice';

const today = '2026-11-11';
const midnight = Date.parse(`${today}T00:00:00Z`) / 1000;
const base = {
    isArchive: false, over: false, guesses: 0, publishedToday: false,
    canUnlockToSync: false, logTouchedAt: null, today,
};

describe('dayNotice', () => {
    it('says nothing for a fresh day with no hints', () => {
        expect(dayNotice(base)).toBeNull();
    });

    it('closes the board when today is published elsewhere', () => {
        expect(dayNotice({ ...base, publishedToday: true })).toBe('played');
        expect(blocksPlay('played')).toBe(true);
    });

    it('offers the unlock for a published day only when it would sync', () => {
        expect(dayNotice({ ...base, publishedToday: true, canUnlockToSync: true })).toBe('played-unlock');
        expect(blocksPlay('played-unlock')).toBe(true);
    });

    it('stays quiet once the game here is over, or on an archive day', () => {
        expect(dayNotice({ ...base, publishedToday: true, over: true })).toBeNull();
        expect(dayNotice({ ...base, publishedToday: true, isArchive: true })).toBeNull();
    });

    it('hints at a game in progress elsewhere without closing the board', () => {
        const notice = dayNotice({ ...base, canUnlockToSync: true, logTouchedAt: midnight + 60 });
        expect(notice).toBe('in-progress-unlock');
        expect(blocksPlay(notice)).toBe(false);
    });

    it('does not hint when the log was last written before today', () => {
        expect(dayNotice({ ...base, canUnlockToSync: true, logTouchedAt: midnight - 1 })).toBeNull();
    });

    it('does not hint once a guess is made here, or when unlocking would not sync', () => {
        expect(dayNotice({ ...base, canUnlockToSync: true, logTouchedAt: midnight + 60, guesses: 1 })).toBeNull();
        expect(dayNotice({ ...base, logTouchedAt: midnight + 60 })).toBeNull();
    });
});
