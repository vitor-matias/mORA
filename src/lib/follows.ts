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
