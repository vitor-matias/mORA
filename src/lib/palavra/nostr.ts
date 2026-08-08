// Palavra on Nostr: what gets written.
//
// Three distinct things, with deliberately different visibility:
//
//   mora-palavra-state       NIP-44 to self   the play log, for cross-device
//   mora-palavra-r:<date>    public           one result, for the social views
//   kind 1                   public           the emoji grid, on request
//
// The split matters. The encrypted state is a backup of your own progress,
// readable only by you. Publishing a *public* result says "I played today, in
// N tries" to everyone, and cannot be unsaid once it is on relays — so it has
// its own flag, `sharePalavraResults`, separate from `shareStreaks`.
//
// That flag is turned **on** when an identity signs in (see auth.ts): the
// leaderboard, duels and leagues are most of the point, and an empty board
// nobody appears on is a worse first run than a disclosure the Perfil toggle
// reverses. Worth being clear-eyed that it is a real disclosure made by
// default, and that switching it off later doesn't retract what is already
// published.
//
// Reads — leaderboard, duels, leagues — live in ./social.ts.

import { pool } from '@/lib/pool';
import { formatUTCDate } from '@/lib/format';
import { currentPubkey } from '@/store/auth';
import { useAppStore } from '@/store/app';
import {
    KIND_APP_STATE,
    RELAY_PUBLISH_TIMEOUT_MS,
    fetchSnapshot,
    publishSnapshot,
    signNostrEvent,
} from '@/lib/nostr';
import {
    derivePalavraStats,
    isFinished,
    mergePalavraPlays,
    playsEqual,
    sharesResults,
    usePalavraStore,
    type PalavraPlay,
} from '@/store/palavra';
import { MAX_GUESSES } from './types';
import { meetsPow, minePalavraEvent } from './pow';

/** The private cross-device log. */
export const D_PALAVRA_STATE = 'mora-palavra-state';

/** One public result per day. Addressable, so republishing replaces rather
    than duplicating, and a relay only ever holds one per author per date. */
export function resultDTag(date: string): string {
    return `mora-palavra-r:${date}`;
}

/** The hashtag every public Palavra event carries, so they can be found
    without knowing who wrote them. */
export const PALAVRA_TOPIC = 'morapalavra';

// One sync at a time; overlapping callers await the same run — the same
// arrangement the prayer-streak sync uses, and for the same reason: sign-in
// forces a sync that can land while a foreground one is still in flight.
let inFlightSync: Promise<void> | null = null;

// ── Private state ────────────────────────────────────────────────────────

export async function publishPalavraStateToNostr(): Promise<void> {
    const pubkey = currentPubkey();
    if (!pubkey || !useAppStore.getState().shareStreaks) return;
    const state = usePalavraStore.getState();
    await publishSnapshot(
        D_PALAVRA_STATE,
        // The sharing choice rides along so this identity's other devices
        // inherit it. Encrypted to self like the rest of the snapshot.
        { plays: state.plays, sharesResults: sharesResults(state, pubkey), updatedAt: Date.now() },
        'palavra state',
    );
}

/**
 * Pull this identity's play log, merge it in, and republish if this device now
 * knows more. Safe to call repeatedly — the merge is a union and idempotent,
 * which is what lets it run on every foreground.
 */
export function syncPalavraWithNostr(): Promise<void> {
    inFlightSync ??= doSync().finally(() => { inFlightSync = null; });
    return inFlightSync;
}

async function doSync(): Promise<void> {
    const pubkey = currentPubkey();
    if (!pubkey || !useAppStore.getState().shareStreaks) return;

    const snapshot = await fetchSnapshot(pubkey, D_PALAVRA_STATE);
    const remote = snapshot?.payload.plays;

    // Adopted only when this device has no record of its own: a new phone
    // inherits the identity's setting, and a choice made here is never
    // silently reverted by an older remote value.
    const store = usePalavraStore.getState();
    if (snapshot?.payload.sharesResults === true && !(pubkey in store.sharing)) {
        store.setSharePalavraResults(pubkey, true);
    }

    // Read the store after the round-trip, not before: a game may have
    // finished while the query was in flight.
    const { plays: local, setPlays } = usePalavraStore.getState();
    const merged = mergePalavraPlays(local, remote);

    if (!playsEqual(merged, local)) setPlays(merged);

    // Seed the relays on first sync, and push whatever they were missing.
    // Comparing the merge against the remote alone tells us whether this
    // device is adding anything they don't already have.
    if (!remote || !playsEqual(merged, mergePalavraPlays({}, remote))) {
        await publishPalavraStateToNostr();
    }

    await publishTodaysResultIfMissing(pubkey);
}

/**
 * Publish today's finished game as a public result, if it hasn't been.
 *
 * The per-game publish in the page fires the moment a board is completed, and
 * only then — which misses two ordinary sequences. Someone can play the day's
 * puzzle with no identity at all, sign in afterwards, and have nothing to show
 * for it; or play while opted out, change their mind in Perfil, and stay
 * invisible until tomorrow. Both are cases where the player has done the work
 * and asked to be counted.
 *
 * Sync runs on sign-in and on every foreground, so hanging this here covers
 * both without a new trigger. Publishing is an addressable event keyed on the
 * date, so a repeat overwrites itself rather than accumulating.
 */
async function publishTodaysResultIfMissing(pubkey: string): Promise<void> {
    const state = usePalavraStore.getState();
    if (!sharesResults(state, pubkey)) return;

    const today = formatUTCDate(new Date());
    const play = state.plays[today];
    if (!play || !isFinished(play)) return;

    // The name meant this from the start and the code didn't check. Sync runs
    // on every foreground, and publishing mines a proof of work — roughly a
    // million hashes — so without this the app re-mined an event the relays
    // already had every time it came back on screen.
    if (state.publishedResults[`${pubkey}:${today}`]) return;

    try {
        await publishPalavraResult(today, play, pubkey);
        // Only after it went out, so a failed publish is retried on the next
        // foreground rather than being marked done.
        usePalavraStore.getState().markResultPublished(pubkey, today);
    } catch (error) {
        // Never let this fail the sync it rides on — the play log is the part
        // that matters, and the next foreground tries again.
        console.warn('Could not publish today\'s result.', error);
    }
}

// ── Public result ────────────────────────────────────────────────────────

/**
 * Publish one finished game, so it can appear in the daily ranking, in duels
 * and in leagues.
 *
 * Only ever called for a real game on its own day: practice runs through the
 * archive never reach here, so they cannot surface anywhere shared.
 *
 * The numbers are self-reported and unverifiable — the server issues puzzles
 * and nothing else, so nobody countersigns this. Someone can hand-write an
 * event claiming a one-guess win. That is the accepted cost of a stateless
 * server and a social graph nobody but its users owns.
 */
export async function publishPalavraResult(
    date: string,
    play: PalavraPlay,
    /** The identity this result belongs to, when the caller decided that
        earlier. Sync awaits the network before getting here, and an account
        switch in that window would otherwise publish one person's game under
        the next person's key. */
    expectedPubkey?: string,
): Promise<void> {
    const pubkey = currentPubkey();
    if (!pubkey) return;
    if (expectedPubkey && pubkey !== expectedPubkey) {
        console.warn('The signed-in identity changed; not publishing this result.');
        return;
    }
    if (!sharesResults(usePalavraStore.getState(), pubkey)) return;
    if (!isFinished(play)) return;

    const tags: string[][] = [
        ['d', resultDTag(date)],
        ['t', PALAVRA_TOPIC],
        ['date', date],
        ['client', 'mora'],
    ];

    // The guesses themselves are deliberately absent: they would hand anyone
    // reading the relay a head start on a puzzle they haven't played yet.
    // The streak travels with the result rather than being derived from it.
    //
    // A lifetime streak can't be recomputed by a reader: it would mean
    // fetching one event per day per player, for as many days as the streak is
    // long, and the answer would still stop at whatever window the query used.
    // Declaring it costs one number and makes a 1,000-day streak as cheap to
    // read as a 3-day one.
    //
    // Self-reported, like the guess count and the time beside it. Nobody
    // countersigns any of this; the NIP-13 proof prices bulk fabrication and
    // says nothing about one inflated number. The UI should not imply more.
    const content = JSON.stringify({
        tries: play.guesses.length,
        solved: play.solved,
        ms: play.ms,
        streak: derivePalavraStats(usePalavraStore.getState().plays).currentStreak,
    });

    try {
        // Mine before signing: the id is a pure function of the fields, so the
        // signer recomputes the same one from the mined created_at and tags.
        const mined = await minePalavraEvent({
            kind: KIND_APP_STATE,
            created_at: Math.floor(Date.now() / 1000),
            tags,
            content,
        }, pubkey);
        const event = await signNostrEvent(mined);
        // The signer is the last place the identity can change — a NIP-46
        // bunker or an extension can sign as whoever it is currently pointed
        // at. Checking the event we are about to publish, rather than the
        // store we read a moment ago, is what makes this airtight.
        if (event.pubkey !== pubkey) {
            console.warn('The result was signed by a different identity; not publishing.');
            return;
        }
        // The comment above holds only while the signer passes the template
        // through untouched. A NIP-07 extension or NIP-46 remote signer is
        // free to stamp its own created_at, and that changes the id and
        // throws the mined work away. The publish would still succeed, and
        // then every reader — leaderboard, duels, league standings — would
        // filter the result out for failing the PoW gate, so the player's
        // game would vanish with nothing anywhere saying why.
        if (!meetsPow(event.id)) {
            // Two ways to land here: mining failed or timed out (pow.ts falls
            // back to the unmined template), or the signer restamped
            // created_at and threw the work away. Either way every reader
            // applies the same gate, so publishing would put an event on the
            // relays that nothing will ever display.
            console.warn(
                'The result carries no usable proof of work, so it was not published. '
                + 'Either mining failed or the signer altered the event.',
            );
            return;
        }
        await pool.event(event, { signal: AbortSignal.timeout(RELAY_PUBLISH_TIMEOUT_MS) });
    } catch (error) {
        // Relays reject or go offline routinely, and the game is already
        // recorded locally — warn rather than throw.
        console.warn('Could not publish the Palavra result to Nostr.', error);
    }
}

// ── Share note ───────────────────────────────────────────────────────────

/**
 * Post the emoji grid as an ordinary note, so it shows up in every Nostr
 * client rather than only in mORA. Always an explicit action — nothing here
 * runs on its own.
 *
 * The verse reference is included only for a finished game, which is the only
 * time this is reachable; posting it mid-game would spoil the day for whoever
 * read it.
 */
export async function sharePalavraNote({
    date,
    ref,
    tries,
    solved,
    grid,
}: {
    date: string;
    ref: string;
    tries: number;
    solved: boolean;
    grid: string;
}): Promise<void> {
    const score = solved ? `${tries}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`;
    const lines = [
        `Palavra Bíblica do Dia — ${date} ${score}`,
        ref,
        '',
        grid,
    ];
    const event = await signNostrEvent({
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
            ['t', PALAVRA_TOPIC],
            ['date', date],
            ['client', 'mora'],
        ],
        content: lines.join('\n'),
    });
    await pool.event(event, { signal: AbortSignal.timeout(RELAY_PUBLISH_TIMEOUT_MS) });
}
