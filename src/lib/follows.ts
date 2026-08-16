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
    RELAY_QUERY_TIMEOUT_MS,
    signNostrEvent,
} from '@/lib/nostr';

const KIND_CONTACTS = 3;

const HEX64_RE = /^[0-9a-f]{64}$/i;

/** The signed-in identity's contact list event, or null if the read failed.
    Null and "no list yet" are deliberately different — see the module note. */
async function fetchContactList(pubkey: string): Promise<NostrEvent | null | undefined> {
    try {
        const [contacts] = await pool.query(
            [{ kinds: [KIND_CONTACTS], authors: [pubkey], limit: 1 }],
            { signal: AbortSignal.timeout(RELAY_QUERY_TIMEOUT_MS) },
        );
        // undefined: read succeeded, this identity has no list yet.
        return contacts ?? undefined;
    } catch (error) {
        console.warn('Could not read the contact list.', error);
        return null;
    }
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
