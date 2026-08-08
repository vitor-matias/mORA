// Shared shapes for Palavra do Dia — the daily scripture word game.
// Kept apart from game.ts so the UI and the Nostr layer can import types
// without pulling in the hashing code.

/** How one guessed letter compares to the hidden word. */
export type Mark = 'correct' | 'present' | 'absent';

/**
 * Where the hidden word sits in the verse the server sends.
 *
 * A named token rather than a run of underscores: `____` is impossible to
 * eyeball for the right count, a typo in it produces a verse that renders with
 * no blank at all, and punctuation in a real verse could plausibly collide
 * with it. This can only appear on purpose.
 *
 * It may appear more than once. When a verse repeats the hidden word, every
 * occurrence is blanked — otherwise the answer sits in plain sight next to its
 * own gap, which is what rules out some of the best-known verses.
 */
export const BLANK_MARKER = '{{blank}}';

export const MAX_GUESSES = 6;
export const MIN_WORD_LENGTH = 5;
export const MAX_WORD_LENGTH = 8;

/**
 * The day's challenge as the server hands it over.
 *
 * `answerCipher` carries the answer itself, obfuscated. It has to: scoring a
 * wrong guess needs the whole word, and the game is meant to be playable
 * offline once the day's challenge has been fetched. See obfuscateAnswer in
 * game.ts for what that is and isn't worth.
 */
export interface DailyChallenge {
    /** YYYY-MM-DD **in UTC**. Puzzle days are global and roll over at 00:00
        UTC, so this is not the device's local date — see formatUTCDate. */
    date: string;
    /** Human reference, e.g. "Salmo 23,1". */
    ref: string;
    /**
     * The complete verse, plain — no blank, no ellipsis — shown once the game
     * is over.
     *
     * Carried in the puzzle rather than linked to. The whole translation is
     * available where the puzzle is built, so sending the text costs a few
     * hundred bytes and means the passage reads in the app, offline, with no
     * third-party site involved. `verse` is often only an excerpt of it.
     */
    full?: string;
    /** The verse with BLANK_MARKER standing in for the hidden word. */
    verse: string;
    /** Letters in the hidden word — between MIN_ and MAX_WORD_LENGTH. */
    length: number;
    /** sha256(`${date}:${ANSWER}`) as hex — confirms a win without revealing. */
    answerHash: string;
    /** The obfuscated answer (see game.ts). */
    answerCipher: string;
    /** When the next puzzle unlocks, epoch seconds. Optional: the client falls
        back to the next 00:00 UTC, which is the same rule — having the server
        state it keeps the rollover policy in one place. */
    nextPuzzleAt?: number;
}

/**
 * One row of the daily ranking, assembled from Nostr result events.
 *
 * A result is whatever its author published: there is no server to countersign
 * one, so someone can claim a win they didn't earn. The only gate is the NIP-13
 * proof of work the result event is mined with, which prices bulk fabrication
 * out without pretending to stop a single inflated score. A deliberate trade
 * for having no server and a social graph that belongs entirely to its users.
 */
export interface LeaderboardEntry {
    /** True when the relays hold a solved result for every sampled day inside
        the claimed streak. False means unbacked *or* unchecked — the board
        distinguishes the two in its wording, never in an accusation. */
    verified?: boolean;
    /** The streak its author declared when they published, if they did. Absent
        on results from before the field existed, and on any client that omits
        it — so it is optional, never assumed. */
    streak?: number;
    pubkey: string;
    tries: number;
    solved: boolean;
    ms: number;
    /** Resolved from kind-0 metadata when the author has a profile. */
    name?: string;
    picture?: string;
}

/** How far back a head-to-head record looks.

    Here rather than in social.ts because the copy that names this window has
    to read it, and social.ts is loaded lazily — importing the constant from
    there would pull the pool and nostr-tools into the main bundle to get one
    number. */
export const DUEL_DAYS = 30;
