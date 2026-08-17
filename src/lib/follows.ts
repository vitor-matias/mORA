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
    if (events.length > 0) {
        // Newest wins. `limit: 1` is per relay, so several relays can each
        // return their own version of this replaceable event, and the first in
        // the array need not be the current one. Following rewrites the whole
        // list, so building on a stale version would unfollow everyone added
        // since it was signed.
        return events.reduce((a, b) => (b.created_at > a.created_at ? b : a));
    }
    // Nothing came back, and that only means "no list yet" if enough of the
    // network said so. `pool.query` could not tell the two apart at all — an
    // unreachable relay and an empty one both come back as an empty array —
    // which is how a list built on a failed read gets published over a real
    // one.
    //
    // A majority rather than every relay: insisting on all of them would let a
    // single chronically dead relay make following permanently impossible,
    // which trades one broken feature for another. A majority answering and
    // none of them holding a list is as close to "there isn't one" as a
    // relay-backed read gets.
    if (answered * 2 <= asked) {
        console.warn(
            `Only ${answered} of ${asked} relays finished answering for the contact list, `
            + 'so it is unknown rather than empty.',
        );
        return null;
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
