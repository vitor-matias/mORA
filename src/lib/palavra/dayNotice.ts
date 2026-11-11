/**
 * What the game tab says about today when this device has no finished game for
 * it, and whether the board may still be played.
 *
 *   'played-unlock'       today's result is on the relays; the key is locked
 *                         and sync is on, so unlocking would merge the plays.
 *   'played-resync'       the same, unlocked: the sync should bring the plays;
 *                         offer to run it again in case it failed.
 *   'played-sync-off'     the same, with cross-device sync off: the plays can
 *                         only come back if it is switched on.
 *   'in-progress-unlock'  no result, but the encrypted play log was written
 *                         today and nothing is played here yet: a game may be
 *                         in progress elsewhere. A hint only; play stays open.
 *
 * The 'played-*' notices close the board.
 */
export type DayNotice = 'played-unlock' | 'played-resync' | 'played-sync-off' | 'in-progress-unlock' | null;

export function dayNotice(o: {
    isArchive: boolean;
    over: boolean;
    guesses: number;
    /** This identity has a public result for today on the relays. */
    publishedToday: boolean;
    locked: boolean;
    /** Cross-device sync of the encrypted play log. */
    syncOn: boolean;
    /** When the play log was last written, in seconds, or null if unknown. */
    logTouchedAt: number | null;
    today: string;
}): DayNotice {
    if (o.isArchive || o.over) return null;
    if (o.publishedToday) {
        if (!o.syncOn) return 'played-sync-off';
        return o.locked ? 'played-unlock' : 'played-resync';
    }
    const touchedToday = o.logTouchedAt !== null && o.logTouchedAt * 1000 >= Date.parse(`${o.today}T00:00:00Z`);
    if (o.locked && o.syncOn && o.guesses === 0 && touchedToday) return 'in-progress-unlock';
    return null;
}

/** The notices that close the board. */
export const blocksPlay = (notice: DayNotice) => notice !== null && notice.startsWith('played');
