// Following someone, from inside the app.
//
// A kind-3 contact list is one replaceable event holding *everyone* an
// identity follows, so following one person means republishing the whole list.
// Every write here is therefore a read-modify-write that refuses to proceed on
// a failed read: collapsing "we couldn't fetch your list" into "you follow
// nobody" would republish it with a single name in it and unfollow the
// person's entire graph — silently, irreversibly as far as the app is
// concerned, and in a way they'd discover days later in another client.
//
// The `content` of a kind-3 is a relay map some clients still keep. It is
// carried through verbatim for the same reason: this app has no use for it and
// no business dropping it.

import type { NostrEvent } from '@nostrify/nostrify';
import { pool } from '@/lib/pool';
import {
    RELAY_PUBLISH_TIMEOUT_MS,
    matching,
    newestEvent,
    queryComplete,
    signNostrEvent,
} from '@/lib/nostr';
import { relaysForAuthors } from '@/lib/relayList';

const KIND_CONTACTS = 3;

const HEX64_RE = /^[0-9a-f]{64}$/i;

/** Longer than a board read, because this one gates a write that replaces the
    whole list. A relay that has not answered yet is the difference between
    "you follow nobody" and "we could not see", and telling those apart is
    worth several more seconds on a button somebody deliberately pressed. */
const CONTACT_READ_TIMEOUT_MS = 12_000;

/** The signed-in identity's contact list event, or null if the read failed.
    Null and "no list yet" are deliberately different — see the module note. */
async function fetchContactList(pubkey: string): Promise<NostrEvent | null | undefined> {
    // Their own write relays as well as ours, as the duels reader does. A
    // contact list published from another client to a relay set we don't ask
    // is otherwise invisible here — and invisible is what gets overwritten.
    const relays = await relaysForAuthors([pubkey]);
    const { events, answered, asked } = await queryComplete(
        [{ kinds: [KIND_CONTACTS], authors: [pubkey], limit: 1 }],
        { signal: AbortSignal.timeout(CONTACT_READ_TIMEOUT_MS), relays },
    );
    // The majority gate comes first, before anything is selected — not only
    // when nothing came back.
    //
    // It used to guard the empty case alone, which left the nonempty one
    // unguarded and was the more dangerous of the two: one relay answering
    // with an old list, while the three that hold the current one never
    // answered, gave a perfectly valid-looking baseline to rewrite from. The
    // list would then be republished without everyone added since that copy
    // was signed. "Some relay had something" is not the same as "the network
    // agrees this is the list".
    //
    // A majority rather than every relay: insisting on all of them would let a
    // single chronically dead relay make following permanently impossible,
    // which trades one broken feature for another.
    if (answered * 2 <= asked) {
        console.warn(
            `Only ${answered} of ${asked} relays finished answering for the contact list, `
            + 'so it is unknown rather than empty.',
        );
        return null;
    }

    // Checked against what was asked for, not taken on the relay's word. The
    // tags below are copied into an event signed with this identity's key, so
    // an unrelated kind-3 accepted here is someone else's follow list
    // republished as this one's.
    //
    // Every candidate is kept, including those from relays that never
    // finished: the one holding the current list may be exactly the one that
    // died mid-send, and dropping its answer would hand the write a stale copy
    // from a relay that happened to finish. More candidates, newest wins.
    const mine = matching(events, { kind: KIND_CONTACTS, author: pubkey });
    if (mine.length > 0) {
        // Newest wins. `limit: 1` is per relay, so several relays can each
        // return their own version of this replaceable event, and the first in
        // the array need not be the current one. Ties on created_at break on
        // the id: two lists signed in the same second are entirely possible,
        // and leaving that to relay order would decide, by luck, which one this
        // republishes the whole graph from.
        return newestEvent(mine)!;
    }

    // undefined: read succeeded, this identity has no list yet.
    return undefined;
}

/** Whether `pubkey` is in this identity's contact list. Null when unknown,
    so the UI can say so instead of claiming "not following". */
export async function isFollowing(me: string, pubkey: string): Promise<boolean | null> {
    const list = await fetchContactList(me);
    if (list === null) return null;
    if (list === undefined) return false;
    return list.tags.some((tag) => tag[0] === 'p' && tag[1] === pubkey);
}

/**
 * Add someone to the signed-in identity's contact list.
 *
 * Everything already in the list is preserved, tag for tag — including `p`
 * tags with relay hints and petnames in positions 2 and 3, which are dropped
 * by any implementation that rebuilds the list from pubkeys alone.
 *
 * Throws rather than returning false: following is an explicit, public act,
 * and a caller that can't tell whether it happened will tell the user the
 * wrong thing.
 */
export async function follow(me: string, pubkey: string): Promise<void> {
    if (!HEX64_RE.test(pubkey)) throw new Error('Not a valid public key.');
    if (pubkey === me) throw new Error('You cannot follow yourself.');

    const list = await fetchContactList(me);
    if (list === null) {
        throw new Error('Could not read your contact list, so it was not replaced.');
    }
    const tags = list?.tags ?? [];
    if (tags.some((tag) => tag[0] === 'p' && tag[1] === pubkey)) return;

    const event = await signNostrEvent({
        kind: KIND_CONTACTS,
        created_at: Math.floor(Date.now() / 1000),
        tags: [...tags, ['p', pubkey]],
        // Preserved verbatim: some clients keep a relay map here, and this app
        // has no use for it and no business dropping it.
        content: list?.content ?? '',
    });
    if (event.pubkey !== me) {
        throw new Error('The contact list was signed by a different identity; it was not published.');
    }
    await pool.event(event, { signal: AbortSignal.timeout(RELAY_PUBLISH_TIMEOUT_MS) });
}

// ── Following in the background ──────────────────────────────────────────
//
// `follow` above is the honest, slow version: it reads the whole contact list,
// waits for enough relays to answer, and refuses rather than guess. On a good
// day that is a second; with one relay in the set never answering it is the
// full read timeout. Nobody should watch a button for twelve seconds to find
// out whether they followed someone.
//
// So the button stops waiting for it. The tap queues the work and returns, and
// the UI says "following" straight away — a promise the queue then keeps,
// retrying a failed publish rather than dropping it. If it runs out of
// attempts the UI is told, and only then does anyone see a failure.
//
// Serial, not parallel. Following is a read-modify-write over one event holding
// the whole list, so two running at once each read the list without the other's
// name and whichever publishes last erases the other. A queue of one at a time
// is what makes "follow three people quickly" mean three people.

/** Attempts before a queued follow is given up on, and how long to wait
    between them. Generous rather than quick: nothing is blocked on this, and a
    relay that is briefly unreachable usually isn't for long. */
const FOLLOW_ATTEMPTS = 5;
const FOLLOW_BACKOFF_MS = [2_000, 5_000, 15_000, 45_000];

const key = (me: string, pubkey: string) => `${me}:${pubkey}`;

const queued: { me: string; pubkey: string }[] = [];
const inFlight = new Set<string>();
const failedFollows = new Set<string>();
const listeners = new Set<() => void>();
let draining = false;

function announce() {
    for (const listener of listeners) listener();
}

/** Told whenever a queued follow starts, lands or gives up, so a sheet that is
    open when the answer arrives can stop claiming success. */
export function onFollowsChanged(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

/**
 * What the UI should show for a follow it may have queued, without asking the
 * network. Survives the sheet being closed and reopened, because the queue
 * outlives the component.
 */
export function queuedFollowState(me: string, pubkey: string): 'pending' | 'failed' | null {
    const id = key(me, pubkey);
    if (inFlight.has(id)) return 'pending';
    if (failedFollows.has(id)) return 'failed';
    return null;
}

/** Queue a follow and return at once. Never throws: the outcome arrives
    through onFollowsChanged, not from here. */
export function queueFollow(me: string, pubkey: string): void {
    const id = key(me, pubkey);
    if (inFlight.has(id)) return;
    failedFollows.delete(id);
    inFlight.add(id);
    queued.push({ me, pubkey });
    announce();
    void drain();
}

const wait = (ms: number) => new Promise((resolve) => { setTimeout(resolve, ms); });

async function drain(): Promise<void> {
    if (draining) return;
    draining = true;
    try {
        while (queued.length > 0) {
            const job = queued[0];
            const id = key(job.me, job.pubkey);
            let landed = false;

            for (let attempt = 0; attempt < FOLLOW_ATTEMPTS && !landed; attempt++) {
                try {
                    // A fresh read every time. The list may have moved since
                    // the last attempt — including by an earlier job in this
                    // very queue — and retrying with a stale copy is how a
                    // retry undoes the thing before it.
                    await follow(job.me, job.pubkey);
                    landed = true;
                } catch (error) {
                    const last = attempt === FOLLOW_ATTEMPTS - 1;
                    console.warn(
                        `Could not follow (attempt ${attempt + 1} of ${FOLLOW_ATTEMPTS})`
                        + `${last ? ', giving up' : ', will retry'}.`,
                        error,
                    );
                    if (!last) await wait(FOLLOW_BACKOFF_MS[attempt] ?? 45_000);
                }
            }

            queued.shift();
            inFlight.delete(id);
            if (!landed) failedFollows.add(id);
            announce();
        }
    } finally {
        draining = false;
    }
}
