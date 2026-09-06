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
import { appUrl } from '@/lib/appUrl';
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

// The day key and the hashtag now live in results.ts, with the reader that
// depends on them, so Node can import all three without dragging the signer
// and the stores in. Imported for use below and re-exported, because this is
// where the writer half looks for them.
import { PALAVRA_TOPIC, resultDTag } from './results';
export { PALAVRA_TOPIC, resultDTag };

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

    // The public-result catch-up is not called from here: it belongs to the
    // other opt-in, and useNostrSync runs it after this merge whether or not
    // the encrypted sync is switched on.
}

/** How far back to look for a finished game that never reached the relays.
    Today alone is too narrow: a game finished at 23:50 UTC whose publish
    failed is not today's game the next time the app opens, and a player who
    doesn't open the app for a few days would lose those days the same way. */
const CATCH_UP_DAYS = 7;

/** How many of those one pass will publish. Each mines a proof of work —
    roughly a million hashes — so a week of missing days would otherwise put
    several seconds of a phone's CPU into one foreground. The rest ride the
    next pass. */
const CATCH_UP_PER_PASS = 3;

/**
 * Publish any finished game from the last few days that hasn't reached the
 * relays as a public result.
 *
 * The per-game publish in the page fires the moment a board is completed, and
 * only then — which is one attempt over a network that is often a phone on a
 * train. It also misses the player who plays with no identity and signs in
 * afterwards, and the one who plays opted out and changes their mind in
 * Perfil. In all three the player has done the work and asked to be counted.
 *
 * A day published late is still filed under its own day: the result is an
 * addressable event keyed on the date, so a repeat overwrites itself rather
 * than accumulating, and both the board and the badge job read by date tag
 * rather than by when the event was written.
 *
 * Runs on sign-in and on every foreground, and not under `shareStreaks`: that
 * toggle governs the encrypted cross-device snapshot, while publishing a
 * result is governed by `sharePalavraResults`. Two switches, and the one that
 * matters here is the one that is on by default.
 */
const inFlightCatchUp = new Map<string, Promise<void>>();

export function publishMissingResults(pubkey: string): Promise<void> {
    // One pass at a time per identity. Sign-in forces a sync that can land
    // while a foreground one is still running, and two passes over the same
    // day would each mine the same proof of work before either could set the
    // marker.
    //
    // Keyed on the pubkey rather than shared: switching identity while a pass
    // is running would otherwise hand the new one the old one's promise, which
    // publishes nothing of theirs — and, since the caller awaits it and
    // returns, leaves them with no pass until some later foreground.
    let pass = inFlightCatchUp.get(pubkey);
    if (!pass) {
        pass = doPublishMissingResults(pubkey)
            .finally(() => { inFlightCatchUp.delete(pubkey); });
        inFlightCatchUp.set(pubkey, pass);
    }
    return pass;
}

async function doPublishMissingResults(pubkey: string): Promise<void> {
    const state = usePalavraStore.getState();
    if (!sharesResults(state, pubkey)) return;

    const today = Date.now();
    const dates = Array.from(
        { length: CATCH_UP_DAYS },
        (_, back) => formatUTCDate(new Date(today - back * 86_400_000)),
    ).reverse(); // Oldest first: a backlog drains in the order it was played.

    let published = 0;
    for (const date of dates) {
        if (published >= CATCH_UP_PER_PASS) return;

        // Read the store afresh each time: publishing awaits the network, and
        // a game can finish — or the identity can change — while it does.
        const current = usePalavraStore.getState();
        const play = current.plays[date];
        if (!play || !isFinished(play)) continue;
        // Publishing mines a proof of work and this runs on every foreground,
        // so without the marker the app would re-mine events the relays
        // already hold every time it comes back on screen.
        if (current.publishedResults[`${pubkey}:${date}`]) continue;

        try {
            // Marked on the return value, not on the absence of a throw.
            // `publishPalavraResult` swallows its own failures and returns
            // early on half a dozen paths — no signer, the proof of work lost,
            // the relay unreachable — so awaiting it says nothing about
            // whether anything reached a relay. Marking a day done on that
            // basis is what the marker exists to prevent: invisible for good,
            // and retried never.
            if (await publishPalavraResult(date, play, pubkey)) {
                usePalavraStore.getState().markResultPublished(pubkey, date);
                published++;
            }
        } catch (error) {
            // Never let one day fail the rest, or the caller this rides on —
            // the next foreground tries again.
            console.warn(`Could not publish the result for ${date}.`, error);
        }
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
): Promise<boolean> {
    const pubkey = currentPubkey();
    if (!pubkey) return false;
    if (expectedPubkey && pubkey !== expectedPubkey) {
        console.warn('The signed-in identity changed; not publishing this result.');
        return false;
    }
    if (!sharesResults(usePalavraStore.getState(), pubkey)) return false;
    if (!isFinished(play)) return false;

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
            return false;
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
            return false;
        }
        await pool.event(event, { signal: AbortSignal.timeout(RELAY_PUBLISH_TIMEOUT_MS) });
        return true;
    } catch (error) {
        // Relays reject or go offline routinely, and the game is already
        // recorded locally — warn rather than throw.
        console.warn('Could not publish the Palavra result to Nostr.', error);
        return false;
    }
}

// ── Share note ───────────────────────────────────────────────────────────

/**
 * Post the emoji grid as an ordinary note, so it shows up in every Nostr
 * client rather than only in mORA. Always an explicit action — nothing here
 * runs on its own.
 *
 * No verse reference. This lands on public timelines where most readers
 * haven't played yet, and "João 1,1" hands them the day's word — the grid says
 * how it went without giving anything away, which is the whole point of the
 * form. A link to the app goes where the reference was, so someone who sees
 * the grid can go and play the same puzzle.
 */
export async function sharePalavraNote({
    date,
    tries,
    solved,
    grid,
}: {
    date: string;
    tries: number;
    solved: boolean;
    grid: string;
}): Promise<void> {
    const score = solved ? `${tries}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`;
    const lines = [
        `Palavra Bíblica do Dia — ${date} ${score}`,
        '',
        grid,
        '',
        appUrl(),
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
