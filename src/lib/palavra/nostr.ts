// Palavra on Nostr: what gets written.
//
// Three distinct things, with deliberately different visibility:
//
//   mora-palavra-state       NIP-44 to self   the play log, for cross-device
//   mora-palavra-r:<date>    public           one result, for the social views
//   kind 1                   public           the emoji grid, on request
//
// The split matters. The encrypted state is a backup of your own progress and
// rides the same consent as the prayer-streak sync (shareStreaks). Publishing a
// *public* result says "I played today, in N tries" to everyone, which is a
// different decision, so it has its own flag (sharePalavraResults, off until
// asked for). Neither is implied by the other.
//
// Reads — leaderboard, duels, leagues — live in ./social.ts.

import { pool } from '@/lib/pool';
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
    isFinished,
    mergePalavraPlays,
    playsEqual,
    usePalavraStore,
    type PalavraPlay,
} from '@/store/palavra';
import { MAX_GUESSES } from './types';
import { minePalavraEvent } from './pow';

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
    const { plays } = usePalavraStore.getState();
    await publishSnapshot(D_PALAVRA_STATE, { plays, updatedAt: Date.now() }, 'palavra state');
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
export async function publishPalavraResult(date: string, play: PalavraPlay): Promise<void> {
    const pubkey = currentPubkey();
    if (!pubkey) return;
    if (!usePalavraStore.getState().sharePalavraResults) return;
    if (!isFinished(play)) return;

    const tags: string[][] = [
        ['d', resultDTag(date)],
        ['t', PALAVRA_TOPIC],
        ['date', date],
        ['client', 'mora'],
    ];

    // The guesses themselves are deliberately absent: they would hand anyone
    // reading the relay a head start on a puzzle they haven't played yet.
    const content = JSON.stringify({
        tries: play.guesses.length,
        solved: play.solved,
        ms: play.ms,
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
