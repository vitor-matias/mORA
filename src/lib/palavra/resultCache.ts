// The running month's results, as this device has seen them.
//
// Every board is assembled from a relay read, and a relay read is a sample.
// `pool.query` gives the slower relays one second after the *first* EOSE, and
// the relay that tends to answer first (nos.lol, in practice) is also the one
// holding the fewest results — so whether a given row appeared came down to
// which relays happened to speak inside that second. The row it failed most
// visibly was the player's own: finish the puzzle, open the board, not be on
// it, and reload until a read got lucky. The device had published that very
// event a moment earlier, and was waiting for a relay to echo it back.
//
// So this holds two things, and every reader merges it into what the network
// returned:
//
//   - the player's own result, put here the moment a relay accepts it, so no
//     board has to wait for the echo;
//   - every result any read has returned, so a row seen once stays seen for
//     the month instead of coming and going with whichever relays answered.
//
// Persisted, so a reload starts from what the last session saw rather than
// from one more lucky-or-not read.
//
// Signed events, not rows. Every reader still runs what comes out of here
// through entriesFromEvents, so the cache can never put anything on a board
// that the proof-of-work gate and the bounds checks would have kept off it —
// it only changes how many reads an event needs to survive, from every one to
// any one.
//
// The current UTC month only, which is the standing board's window and the
// only one where a missed row costs anything; a past month is settled, and is
// read the way it always was. It rolls over on its own: the first read in a
// new month finds the held month stale and starts again.

import type { NostrEvent } from '@nostrify/nostrify';
import { formatUTCDate } from '@/lib/format';
import { supersedes } from '@/lib/nostr';
import { meetsPow } from './pow';
import { KIND_RESULT, resultDTag, tagValue } from './results';
import { monthOf } from './scoring';

const STORAGE_KEY = 'mora-palavra-results';

/** How many events are written to storage. Memory keeps everything; storage
    keeps the newest this many, so a busy month can't crowd the liturgy caches
    out of a quota they share. Comfortably more than a month of the game at
    any size it has been. */
const MAX_PERSISTED = 2000;

interface Held {
    month: string;
    /** Newest event per author and day, keyed `pubkey:d`. */
    events: Map<string, NostrEvent>;
}

let held: Held | null = null;

function currentMonth(now: Date): string {
    return monthOf(formatUTCDate(now));
}

/** A result for a day in `month`, mined, with a day key that agrees with its
    date. Anything else would be dropped by every reader anyway, and keeping it
    here would only spend storage on events nobody will show. */
function belongs(event: NostrEvent, month: string): boolean {
    if (event.kind !== KIND_RESULT) return false;
    const date = tagValue(event, 'date');
    return date !== undefined
        && monthOf(date) === month
        && tagValue(event, 'd') === resultDTag(date)
        && meetsPow(event.id);
}

/**
 * Enough of an event's shape to be read without throwing. Storage is ours,
 * but it outlives builds and can be edited by hand.
 *
 * Signatures are deliberately not checked again here. Everything written to
 * storage was checked once already: NRelay1 runs verifyEvent on every event a
 * relay sends, and the only other source is this device's own signed result.
 * What remains is an entry edited in place, and the only things that can do
 * that are this device's user or script already running in the page. Either
 * one can rewrite the board itself, or the play log persisted beside this
 * without any checking. The cache is never published and the badge job never
 * reads it, so a forged entry reaches nobody but the person who forged it.
 * Re-verifying up to MAX_PERSISTED Schnorr signatures on every cold start
 * would cost a phone seconds to defend against that.
 */
function looksLikeEvent(value: unknown): value is NostrEvent {
    const event = value as NostrEvent | null;
    return typeof event === 'object' && event !== null
        && typeof event.id === 'string'
        && typeof event.pubkey === 'string'
        && typeof event.created_at === 'number'
        && typeof event.kind === 'number'
        && typeof event.content === 'string'
        && Array.isArray(event.tags)
        && event.tags.every((tag) => Array.isArray(tag));
}

function coordinate(event: NostrEvent): string {
    return `${event.pubkey}:${tagValue(event, 'd') ?? ''}`;
}

/** Keep `event` if it is newer than what is held for its coordinate. Same tie
    break as the pool and newestPerDay, so the cache lands on the same version
    every other reader does. */
function keep(events: Map<string, NostrEvent>, event: NostrEvent): boolean {
    const key = coordinate(event);
    if (!supersedes(event, events.get(key))) return false;
    events.set(key, event);
    return true;
}

function load(month: string): Map<string, NostrEvent> {
    if (held?.month === month) return held.events;

    const events = new Map<string, NostrEvent>();
    // Only on the first read of the session. A month that rolls over while
    // the app is open starts empty: what storage holds is the old month.
    if (!held) {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as
                { month?: unknown; events?: unknown } | null;
            if (saved?.month === month && Array.isArray(saved.events)) {
                for (const event of saved.events) {
                    if (looksLikeEvent(event) && belongs(event, month)) keep(events, event);
                }
            }
        } catch {
            // Storage blocked (private browsing), or a corrupt entry. Start
            // from nothing; the next read fills it.
        }
    }
    held = { month, events };
    return events;
}

function save(month: string, events: Map<string, NostrEvent>): void {
    const newest = [...events.values()]
        .sort((a, b) => b.created_at - a.created_at)
        .slice(0, MAX_PERSISTED);
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ month, events: newest }));
    } catch (error) {
        // Out of quota, or no storage at all. The session still has the
        // memory copy; only the next reload loses it.
        console.warn('Could not save the month\'s Palavra results.', error);
    }
}

/** Fold events into the month's cache. Anything that isn't a current-month
    result is ignored, so a caller can pass a whole read without sorting it. */
export function rememberResults(events: readonly NostrEvent[], now = new Date()): void {
    const month = currentMonth(now);
    const cache = load(month);
    let changed = false;
    for (const event of events) {
        if (belongs(event, month) && keep(cache, event)) changed = true;
    }
    if (changed) save(month, cache);
}

/** What the cache holds for these days — optionally only from these authors,
    for the views scoped to a known set of people. Days outside the current
    month simply have nothing here. */
export function rememberedResults(
    days: readonly string[],
    authors?: readonly string[],
    now = new Date(),
): NostrEvent[] {
    const wanted = new Set(days.map(resultDTag));
    const who = authors ? new Set(authors) : null;
    return [...load(currentMonth(now)).values()].filter((event) =>
        wanted.has(tagValue(event, 'd') ?? '') && (!who || who.has(event.pubkey)));
}
