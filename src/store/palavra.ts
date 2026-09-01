import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { daysApart, formatUTCDate } from '@/lib/format';
import { MAX_GUESSES, MAX_WORD_LENGTH, MIN_WORD_LENGTH, type DailyChallenge } from '@/lib/palavra/types';

/** One day's game, finished or still open. */
export interface PalavraPlay {
    /** Guesses in order, already normalized to A–Z. */
    guesses: string[];
    solved: boolean;
    /** Milliseconds from opening the board to the last guess. 0 until the
        game ends. */
    ms: number;
    /** When the board was first opened, epoch ms. Local bookkeeping for the
        timer — never published, and dropped from the synced snapshot, since
        another device's clock reading means nothing here. */
    startedAt?: number;
}

export type PalavraPlays = Record<string, PalavraPlay>;

export interface PalavraStats {
    plays: number;
    wins: number;
    currentStreak: number;
    maxStreak: number;
    /** `distribution[i]` — games won using `i + 1` guesses. */
    distribution: number[];
    lastPlayedDate: string | null;
}

/** A game is over when it is won, or when the guesses run out. */
export function isFinished(play: PalavraPlay): boolean {
    return play.solved || play.guesses.length >= MAX_GUESSES;
}

// ── Deriving the record ──────────────────────────────────────────────────
// Unlike the prayer streaks, nothing here is stored as a running total.
// Counters cannot be merged: folding another device's snapshot in would add
// its plays to this device's on every sync, and the number would climb on its
// own. The per-day log is the only state, and every figure below is computed
// from it — which makes merging a plain union, and makes it idempotent.

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const GUESS_RE = /^[A-Z]+$/;

// A single game cannot reasonably span a day. Anything longer is a wrong
// clock or a corrupted snapshot, and it would otherwise sort to the bottom of
// every speed ranking forever.
const MAX_PLAY_MS = 24 * 60 * 60 * 1000;

// Roughly five years of daily play. The log is tiny per entry, so this is a
// backstop against a corrupted snapshot rather than a space concern.
const MAX_PLAY_ENTRIES = 2000;

// Two weeks of puzzles kept for offline play.
const MAX_CACHED_CHALLENGES = 14;

function isUsableDate(value: string): boolean {
    return ISO_DATE_RE.test(value) && value <= formatUTCDate(new Date());
}

/** A snapshot from a relay is only as trustworthy as its shape. */
function isUsablePlay(value: unknown): value is PalavraPlay {
    if (!value || typeof value !== 'object') return false;
    const { guesses, solved, ms } = value as PalavraPlay;
    if (!Array.isArray(guesses) || guesses.length === 0 || guesses.length > MAX_GUESSES) return false;
    if (!guesses.every((guess) =>
        typeof guess === 'string'
        && GUESS_RE.test(guess)
        && guess.length >= MIN_WORD_LENGTH
        && guess.length <= MAX_WORD_LENGTH
    )) return false;
    // Every guess is one row of the same board, so they all have to be the
    // same width — a mixed set could not have come from one puzzle.
    if (new Set(guesses.map((guess) => guess.length)).size !== 1) return false;
    if (typeof solved !== 'boolean') return false;
    if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0 || ms > MAX_PLAY_MS) return false;
    return true;
}

/**
 * Drop anything in a restored log that isn't a usable record.
 *
 * Discarding a corrupt day loses that day and nothing else, which is the right
 * trade against refusing to start.
 */
export function sanitizePlays(value: unknown): PalavraPlays {
    if (!value || typeof value !== 'object') return {};
    const clean: PalavraPlays = {};
    for (const [date, play] of Object.entries(value as Record<string, unknown>)) {
        if (!isUsableDate(date) || !isUsablePlay(play)) continue;
        clean[date] = play;
    }
    return trimPlays(clean);
}

/** Keep only `pubkey: true` pairs — the same reasoning as sanitizePlays, and
    it matters more here: a junk key that reads as truthy would publish. */
export function sanitizeSharing(value: unknown): Record<string, boolean> {
    if (!value || typeof value !== 'object') return {};
    const clean: Record<string, boolean> = {};
    for (const [pubkey, on] of Object.entries(value as Record<string, unknown>)) {
        if (on === true && /^[0-9a-f]{64}$/i.test(pubkey)) clean[pubkey] = true;
    }
    return clean;
}

/** The key a badge announcement is remembered under. Identity first, so one
    account's history can be read off the map by prefix. */
export function badgeAnnouncementKey(pubkey: string, coord: string): string {
    return `${pubkey}:${coord}`;
}

/** Keep only `key: true` pairs whose key names a pubkey and a coordinate.
    Junk that read as truthy would silence a real award for good — the one
    failure here nothing downstream could notice. */
export function sanitizeAnnouncedBadges(value: unknown): Record<string, true> {
    if (!value || typeof value !== 'object') return {};
    const clean: Record<string, true> = {};
    for (const [key, announced] of Object.entries(value as Record<string, unknown>)) {
        if (announced !== true) continue;
        const [pubkey, ...rest] = key.split(':');
        if (!/^[0-9a-f]{64}$/i.test(pubkey ?? '') || rest.length === 0 || !rest.join(':')) continue;
        clean[key] = true;
    }
    return clean;
}

/** Which of two records for the same day to keep. Two devices can play the
    same puzzle independently, so this picks the better outcome rather than
    the later write: a win beats a loss, a faster win beats a slower one, and
    an unfinished game keeps whichever got further. */
function betterPlay(a: PalavraPlay, b: PalavraPlay): PalavraPlay {
    if (a.solved !== b.solved) return a.solved ? a : b;
    if (a.solved) {
        if (a.guesses.length !== b.guesses.length) {
            return a.guesses.length < b.guesses.length ? a : b;
        }
        // ms 0 is "no duration recorded", not "instant" — a win merged from a
        // device whose startedAt was lost arrives that way. Compared naively
        // it wins every tie-break and reports as the fastest solve there is.
        if ((a.ms === 0) !== (b.ms === 0)) return a.ms === 0 ? b : a;
        return a.ms <= b.ms ? a : b;
    }
    return a.guesses.length >= b.guesses.length ? a : b;
}

/**
 * Fold another device's log into this one. Union by date — no entry is ever
 * dropped for being unknown here, and merging the same snapshot twice gives
 * the same result, which is what lets the sync run on every foreground.
 */
export function mergePalavraPlays(local: PalavraPlays, remote: unknown): PalavraPlays {
    const incoming = (remote && typeof remote === 'object' ? remote : {}) as Record<string, unknown>;
    const merged: PalavraPlays = { ...local };
    for (const [date, entry] of Object.entries(incoming)) {
        if (!isUsableDate(date) || !isUsablePlay(entry)) continue;
        const mine = merged[date];
        // startedAt is this device's own clock reading; a remote one would be
        // meaningless and could produce a negative duration.
        const theirs: PalavraPlay = { guesses: entry.guesses, solved: entry.solved, ms: entry.ms };
        merged[date] = mine && isUsablePlay(mine) ? betterPlay(mine, theirs) : theirs;
    }
    return trimPlays(merged);
}

/** Keeps the most recent entries when a log grows past the cap. */
export function trimPlays(plays: PalavraPlays): PalavraPlays {
    const dates = Object.keys(plays);
    if (dates.length <= MAX_PLAY_ENTRIES) return plays;
    const keep = dates.sort().slice(-MAX_PLAY_ENTRIES);
    return Object.fromEntries(keep.map((date) => [date, plays[date]]));
}

export function playsEqual(a: PalavraPlays, b: PalavraPlays): boolean {
    const aKeys = Object.keys(a).sort();
    const bKeys = Object.keys(b).sort();
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((date, i) => {
        if (bKeys[i] !== date) return false;
        const x = a[date];
        const y = b[date];
        return x.solved === y.solved
            && x.ms === y.ms
            && x.guesses.length === y.guesses.length
            && x.guesses.every((guess, j) => guess === y.guesses[j]);
    });
}

/**
 * Every published figure, computed from the log.
 *
 * The current streak is allowed to end yesterday as well as today: a run isn't
 * broken until a whole day goes by unplayed, so someone who hasn't opened
 * today's puzzle yet still sees the streak they're about to extend.
 */
export function derivePalavraStats(plays: PalavraPlays): PalavraStats {
    const finished = Object.entries(plays)
        .filter(([date, play]) => isUsableDate(date) && isUsablePlay(play) && isFinished(play))
        .sort(([a], [b]) => a.localeCompare(b));

    const distribution = Array.from({ length: MAX_GUESSES }, () => 0);
    let wins = 0;
    for (const [, play] of finished) {
        if (!play.solved) continue;
        wins++;
        distribution[play.guesses.length - 1]++;
    }

    const solvedDates = finished.filter(([, play]) => play.solved).map(([date]) => date);

    let maxStreak = 0;
    let run = 0;
    for (let i = 0; i < solvedDates.length; i++) {
        run = i > 0 && daysApart(solvedDates[i - 1], solvedDates[i]) === 1 ? run + 1 : 1;
        maxStreak = Math.max(maxStreak, run);
    }

    // Walk back from the most recent win, but only if it is recent enough to
    // still count — today or yesterday.
    let currentStreak = 0;
    const today = formatUTCDate(new Date());
    const newest = solvedDates[solvedDates.length - 1];
    // Today finished and lost ends the run. Without this the walk starts from
    // the most recent win — yesterday — and `daysApart(yesterday, today) <= 1`
    // keeps the streak alive through a loss that should have broken it.
    const lostToday = plays[today] !== undefined && isFinished(plays[today]) && !plays[today].solved;
    if (newest && !lostToday && daysApart(newest, today) <= 1) {
        currentStreak = 1;
        for (let i = solvedDates.length - 1; i > 0; i--) {
            if (daysApart(solvedDates[i - 1], solvedDates[i]) !== 1) break;
            currentStreak++;
        }
    }

    return {
        plays: finished.length,
        wins,
        currentStreak,
        maxStreak,
        distribution,
        lastPlayedDate: finished.length > 0 ? finished[finished.length - 1][0] : null,
    };
}

// ── Store ────────────────────────────────────────────────────────────────

/**
 * Which log a game belongs to.
 *
 * Archive games are kept in a separate map rather than flagged inside the
 * main one. A flag is something every future reader has to remember to check —
 * one `derivePalavraStats` that forgets, and yesterday's practice run silently
 * becomes a streak. Two maps make that impossible: the stats function is only
 * ever handed `plays`, and `practice` has no path into it.
 */
export type PalavraScope = 'daily' | 'practice';

interface PalavraState {
    /** The record: today's puzzle, played on the day. Synced, published,
        counted. */
    plays: PalavraPlays;
    /** Archive games from earlier days. Device-local — never synced, never
        published, never counted towards a streak or a leaderboard. */
    practice: PalavraPlays;
    /** Starts the clock for a day, once. Re-opening a board later in the day
        must not reset it, or every abandoned-and-resumed game would post an
        impossibly fast time. */
    beginPlay: (date: string, scope: PalavraScope) => void;
    /** Appends a guess and closes the game if this one ended it. */
    submitGuess: (date: string, guess: string, solved: boolean, scope: PalavraScope) => void;
    /** Replaces the whole record — used by the Nostr pull after merging.
        Practice games are not part of it. */
    setPlays: (plays: PalavraPlays) => void;

    /** Days whose emoji grid has been posted as a kind-1 note, so the button
        doesn't come back offering to post it again after a reload.

        Device-local and not synced: it describes an action taken here, and the
        cost of getting it wrong across devices is only that the button is
        offered twice — posting again is a choice the player can make. Syncing
        it would mean adding a field to the merged snapshot for no real gain. */
    sharedNotes: Record<string, boolean>;
    markNoteShared: (date: string) => void;

    /**
     * Puzzles already fetched, by date.
     *
     * The app is a PWA and the puzzle now comes off relays, so without this a
     * player who opens it on a train gets an error card — including for a day
     * they had already started, because their guesses persist but the verse and
     * cipher did not. Shipping the answer obfuscated to the client is what
     * makes offline play possible at all; this is what realises it.
     *
     * Only ever holds puzzles that passed validation, so a cached one is
     * always playable.
     */
    /**
     * Days whose public result this identity has already published, keyed
     * `pubkey:date`.
     *
     * Only to avoid doing the work twice. Publishing mines a NIP-13 proof —
     * about a million hashes — and the sync that can publish runs on every
     * foreground, so without this the app would burn a second of CPU re-mining
     * an event the relays already have, every time it came back on screen.
     *
     * Keyed by identity as well as date, because two accounts on one device
     * have separate results for the same day.
     */
    publishedResults: Record<string, true>;
    markResultPublished: (pubkey: string, date: string) => void;

    challenges: Record<string, DailyChallenge>;
    /** Which publisher the cached puzzles came from — a pubkey, or 'mock'.
        Puzzles are keyed by date alone, so without this a device that played
        in demo mode would keep serving demo verses for those dates after a
        real publisher was configured, mixing invented and published days in
        one archive and scoring them against different answers. Changing
        source drops the cache rather than trying to reconcile it. */
    challengeSource: string;
    cacheChallenge: (challenge: DailyChallenge, source: string) => void;

    /**
     * Who has agreed to publish *public* result events, keyed by pubkey.
     *
     * A separate decision from the encrypted streak sync in the app store: one
     * shares a number with everyone, the other backs your own progress up to
     * yourself. Turned on when an identity signs in (see auth.ts).
     *
     * Per identity, not one global flag. Two accounts share a browser more
     * often than it looks — a shared device, or one person keeping a public
     * key apart from a quiet one — and a single flag meant the first account's
     * choice silently published for the second. The consent has to belong to
     * whoever it discloses.
     */
    sharing: Record<string, boolean>;
    setSharePalavraResults: (pubkey: string | null, share: boolean) => void;

    /**
     * Badges this device has already told this identity about, keyed
     * `pubkey:<badge coordinate>`.
     *
     * An award is a NIP-58 event on a relay: nothing about winning one reaches
     * the player, so the app announces it. This is what stops it announcing
     * the same badge on every launch — it is marked the moment the badge is
     * shown, not when the card is dismissed, because a reload between the two
     * would otherwise start the announcement over.
     *
     * Keyed by identity as well as coordinate, so two accounts sharing a
     * browser are each told about their own.
     */
    announcedBadges: Record<string, true>;
    markBadgesAnnounced: (pubkey: string, coords: string[]) => void;

    /** Whether this device has already dismissed the "how to play" explainer.
        Device-local and not synced: a new device is exactly when it's worth
        showing again, so it isn't part of the record a sync would carry. */
    seenTutorial: boolean;
    markTutorialSeen: () => void;
}

/** Whether this identity publishes results. Signed out is always false: there
    is nothing to sign with, and no one to attribute it to. */
export function sharesResults(state: PalavraState, pubkey: string | null | undefined): boolean {
    return pubkey ? state.sharing[pubkey] === true : false;
}

export const usePalavraStore = create<PalavraState>()(
    persist(
        (set) => ({
            plays: {},
            practice: {},

            beginPlay: (date, scope) => set((state) => {
                const key = scope === 'daily' ? 'plays' : 'practice';
                const existing = state[key][date];
                if (existing?.startedAt) return state;
                return {
                    [key]: {
                        ...state[key],
                        [date]: { ...(existing ?? { guesses: [], solved: false, ms: 0 }), startedAt: Date.now() },
                    },
                };
            }),

            submitGuess: (date, guess, solved, scope) => set((state) => {
                const key = scope === 'daily' ? 'plays' : 'practice';
                const existing = state[key][date] ?? { guesses: [], solved: false, ms: 0 };
                if (isFinished(existing)) return state;

                const guesses = [...existing.guesses, guess];
                const over = solved || guesses.length >= MAX_GUESSES;
                // A log restored without startedAt (an older build, or a
                // snapshot from another device) has no origin to measure
                // from; leave the duration at zero rather than invent one.
                const elapsed = existing.startedAt ? Date.now() - existing.startedAt : 0;

                return {
                    [key]: trimPlays({
                        ...state[key],
                        [date]: {
                            ...existing,
                            guesses,
                            solved,
                            ms: over ? Math.min(Math.max(elapsed, 0), MAX_PLAY_MS) : 0,
                        },
                    }),
                };
            }),

            setPlays: (plays) => set({ plays: trimPlays(plays) }),

            sharedNotes: {},
            markNoteShared: (date) => set((state) => ({
                sharedNotes: { ...state.sharedNotes, [date]: true },
            })),

            publishedResults: {},
            markResultPublished: (pubkey, date) => set((state) => ({
                publishedResults: { ...state.publishedResults, [`${pubkey}:${date}`]: true },
            })),

            challenges: {},
            challengeSource: '',
            cacheChallenge: (challenge, source) => set((state) => {
                const base = state.challengeSource === source ? state.challenges : {};
                const next = { ...base, [challenge.date]: challenge };
                // Keep a couple of weeks: enough that paging back through the
                // recent archive works offline, without carrying a year of
                // verses in localStorage.
                const dates = Object.keys(next).sort();
                if (dates.length <= MAX_CACHED_CHALLENGES) return { challenges: next, challengeSource: source };
                // Trimming to the newest dates would drop the puzzle that was
                // just fetched whenever it is an archive day older than the
                // window — so paging back would re-fetch every time and offline
                // reload would lose the day on screen. Keep it explicitly.
                const keep = new Set(dates.slice(-MAX_CACHED_CHALLENGES));
                keep.add(challenge.date);
                return {
                    challengeSource: source,
                    challenges: Object.fromEntries(
                        [...keep].sort().slice(-MAX_CACHED_CHALLENGES)
                            .map((date) => [date, next[date]]),
                    ),
                };
            }),

            sharing: {},
            setSharePalavraResults: (pubkey, share) => set((state) => {
                if (!pubkey) return {};
                const next = { ...state.sharing };
                // Delete rather than store false: an identity that has opted
                // out reads the same as one that never opted in, and the map
                // doesn't grow a row per account that ever touched the device.
                if (share) next[pubkey] = true; else delete next[pubkey];
                return { sharing: next };
            }),

            announcedBadges: {},
            markBadgesAnnounced: (pubkey, coords) => set((state) => {
                if (!pubkey || coords.length === 0) return {};
                const next = { ...state.announcedBadges };
                for (const coord of coords) next[badgeAnnouncementKey(pubkey, coord)] = true;
                return { announcedBadges: next };
            }),

            seenTutorial: false,
            markTutorialSeen: () => set({ seenTutorial: true }),
        }),
        {
            name: 'mora-palavra-storage',
            // localStorage is not a trusted input. The validators below already
            // exist for entries arriving over Nostr, but nothing applied them
            // to what came back off disk — so a truncated write, a hand-edited
            // key, or a record from a future schema went straight into state.
            // `isFinished` then reads `play.guesses.length` on the Home card
            // and throws, which is a blank page on the app's front door that
            // only clearing site data recovers from.
            merge: (persisted, current) => {
                const saved = (persisted ?? {}) as Partial<PalavraState>;
                return {
                    ...current,
                    ...saved,
                    plays: sanitizePlays(saved.plays),
                    practice: sanitizePlays(saved.practice),
                    sharing: sanitizeSharing(saved.sharing),
                    publishedResults: saved.publishedResults && typeof saved.publishedResults === 'object'
                        ? saved.publishedResults : {},
                    // Anything but a literal `true` (a stray string, a
                    // corrupted write) must read as "not seen yet" — the
                    // failure mode of the loose default is a tutorial that
                    // can never show, which nothing after this would catch.
                    announcedBadges: sanitizeAnnouncedBadges(saved.announcedBadges),
                    seenTutorial: saved.seenTutorial === true,
                };
            },
        }
    )
);
