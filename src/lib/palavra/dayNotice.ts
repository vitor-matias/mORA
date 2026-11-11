/**
 * What the game tab says about today when this device has no finished game for
 * it, and whether the board may still be played.
 *
 *   'played'              today's result is on the relays: read-only.
 *   'played-unlock'       the same, and unlocking the key would sync the plays.
 *   'in-progress-unlock'  no result, but the encrypted play log was written
 *                         today and nothing is played here yet: a game may be
 *                         in progress elsewhere. A hint only; play stays open.
 */
export type DayNotice = 'played' | 'played-unlock' | 'in-progress-unlock' | null;

export function dayNotice(o: {
    isArchive: boolean;
    over: boolean;
    guesses: number;
    /** This identity has a public result for today on the relays. */
    publishedToday: boolean;
    /** Locked key with cross-device sync on: unlocking would merge the plays. */
    canUnlockToSync: boolean;
    /** When the play log was last written, in seconds, or null if unknown. */
    logTouchedAt: number | null;
    today: string;
}): DayNotice {
    if (o.isArchive || o.over) return null;
    if (o.publishedToday) return o.canUnlockToSync ? 'played-unlock' : 'played';
    const touchedToday = o.logTouchedAt !== null && o.logTouchedAt * 1000 >= Date.parse(`${o.today}T00:00:00Z`);
    if (o.canUnlockToSync && o.guesses === 0 && touchedToday) return 'in-progress-unlock';
    return null;
}

/** The notices that close the board. */
export const blocksPlay = (notice: DayNotice) => notice === 'played' || notice === 'played-unlock';
