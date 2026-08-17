// Badges (NIP-58), from the reader's side.
//
// The publisher awards them — see server/palavra/badges.js. This half does the
// two things a client can: show what someone has won, and put your own on your
// Nostr profile so every other client shows them too. That second part is the
// point of the feature. An award sitting on a relay is invisible; kind 30008
// is what makes it appear next to your name in Damus, Amethyst and the rest.
//
// Three kinds are involved and it matters who signs which:
//
//   30009  definition   the publisher    what the badge *is*
//   8      award        the publisher    who won it
//   30008  profile      **you**          which of yours to display
//
// Only the publisher's awards are read. An award is an ordinary event, so
// anyone can publish one naming themselves; the pinned key is the whole
// difference between a badge and a self-assigned label.

import type { NostrEvent } from '@nostrify/nostrify';
import { pool } from '@/lib/pool';
import {
    RELAY_PUBLISH_TIMEOUT_MS,
    RELAY_QUERY_TIMEOUT_MS,
    matching,
    newestEvent,
    queryComplete,
    signNostrEvent,
    supersedes,
} from '@/lib/nostr';
import { relaysForAuthors } from '@/lib/relayList';
import { PALAVRA_PUBLISHER } from './api';

const KIND_BADGE_AWARD = 8;
const KIND_BADGE_DEFINITION = 30009;
const KIND_PROFILE_BADGES = 30008;

/** NIP-58 fixes this identifier — a profile has exactly one badge list. */
const D_PROFILE_BADGES = 'profile_badges';

/** Enough for many years of monthly podiums, small enough to stay a sane
    filter. */
const MAX_BADGES = 200;

/** Longer than a board read, for the same reason the contact list gets one:
    this read decides whether a write that replaces the whole badge list is
    allowed to proceed, so a relay still answering is worth waiting for. */
const PROFILE_BADGE_READ_TIMEOUT_MS = 12_000;

function tagValue(event: { tags: string[][] }, name: string): string | undefined {
    return event.tags.find((tag) => tag[0] === name)?.[1];
}

export interface EarnedBadge {
    /** `30009:<publisher>:<d>` — the badge's identity, and what a profile
        list points at. */
    coord: string;
    /** The kind-8 event that granted it. NIP-58 wants this alongside the
        coordinate in a profile list, as the receipt for the claim. */
    awardId: string;
    name: string;
    description?: string;
    image?: string;
    thumb?: string;
    /** When the award was signed — only for ordering, since it is the
        publisher's own clock. */
    awardedAt: number;
}

/** `30009:<pubkey>:<d>` split, rejecting anything not a badge definition. */
function parseCoord(coord: string): { pubkey: string; dTag: string } | null {
    const [kind, pubkey, ...rest] = coord.split(':');
    const dTag = rest.join(':');
    if (kind !== String(KIND_BADGE_DEFINITION)) return null;
    if (!/^[0-9a-f]{64}$/i.test(pubkey ?? '')) return null;
    if (!dTag) return null;
    return { pubkey: pubkey.toLowerCase(), dTag };
}

/**
 * Every badge this person has been awarded by the publisher.
 *
 * Two queries: the awards naming them, then the definitions those awards point
 * at. The definition carries the name and the picture, and is addressable, so
 * a badge can be given art later without any award being reissued — which is
 * exactly what the current definitions, published without an image, are
 * relying on.
 */
export async function fetchBadges(pubkey: string): Promise<EarnedBadge[]> {
    // Nothing is pinned in demo mode, so nothing can be trusted, so nothing is
    // shown. Better an empty shelf than badges from an unknown issuer.
    if (!PALAVRA_PUBLISHER) return [];

    let awards: NostrEvent[];
    try {
        awards = await pool.query(
            [{
                kinds: [KIND_BADGE_AWARD],
                authors: [PALAVRA_PUBLISHER],
                '#p': [pubkey],
                limit: MAX_BADGES,
            }],
            { signal: AbortSignal.timeout(RELAY_QUERY_TIMEOUT_MS) },
        );
    } catch (error) {
        console.warn('Could not load badges.', error);
        return [];
    }

    // Belt and braces with the `authors` filter: asking a relay nicely is not
    // the same as being answered honestly, and this is the check that decides
    // whether a badge is real.
    const wanted = new Map<string, { awardId: string; awardedAt: number }>();
    for (const award of awards) {
        if (award.pubkey !== PALAVRA_PUBLISHER) continue;
        // The award has to name this person. A relay that ignores `#p` would
        // otherwise hand someone else's badges to whoever asked.
        if (!award.tags.some((tag) => tag[0] === 'p' && tag[1] === pubkey)) continue;

        const coord = tagValue(award, 'a');
        const parsed = coord === undefined ? null : parseCoord(coord);
        if (!parsed || parsed.pubkey !== PALAVRA_PUBLISHER) continue;

        // One award per badge; the earliest wins if somehow there are two.
        const existing = wanted.get(coord!);
        if (!existing || award.created_at < existing.awardedAt) {
            wanted.set(coord!, { awardId: award.id, awardedAt: award.created_at });
        }
    }
    if (wanted.size === 0) return [];

    const dTags = [...wanted.keys()].map((coord) => parseCoord(coord)!.dTag);
    let definitions: NostrEvent[];
    try {
        definitions = await pool.query(
            [{
                kinds: [KIND_BADGE_DEFINITION],
                authors: [PALAVRA_PUBLISHER],
                '#d': dTags,
                limit: MAX_BADGES,
            }],
            { signal: AbortSignal.timeout(RELAY_QUERY_TIMEOUT_MS) },
        );
    } catch (error) {
        console.warn('Could not load badge definitions.', error);
        return [];
    }

    // Newest per coordinate, not last-one-seen. Kind 30009 is addressable, and
    // `limit` applies per relay, so a pool spanning several relays can hand back
    // more than one version of the same `d` — in whatever order they arrive. The
    // loop used to keep the last, which meant a stale definition could overwrite
    // a newer one and show an old name or old art.
    const byCoord = new Map<string, NostrEvent>();
    for (const definition of definitions) {
        if (definition.pubkey !== PALAVRA_PUBLISHER) continue;
        const dTag = tagValue(definition, 'd');
        if (!dTag) continue;
        const coord = `${KIND_BADGE_DEFINITION}:${PALAVRA_PUBLISHER}:${dTag}`;
        const existing = byCoord.get(coord);
        if (supersedes(definition, existing)) byCoord.set(coord, definition);
    }

    const badges: EarnedBadge[] = [];
    for (const [coord, { awardId, awardedAt }] of wanted) {
        const definition = byCoord.get(coord);
        // An award whose definition the relays don't hold has no name to show.
        // Skipped rather than rendered as a blank tile.
        if (!definition) continue;
        const name = tagValue(definition, 'name');
        if (!name) continue;
        badges.push({
            coord,
            awardId,
            name,
            description: tagValue(definition, 'description'),
            image: tagValue(definition, 'image'),
            thumb: tagValue(definition, 'thumb'),
            awardedAt,
        });
    }

    // Newest first — the most recent month is the one worth seeing.
    return badges.sort((a, b) => b.awardedAt - a.awardedAt);
}

/** One `a`/`e` pair from a profile badge list. */
export interface ProfileBadgeRef {
    coord: string;
    awardId: string;
}

/**
 * The badge list currently on someone's profile, or null if the read failed.
 *
 * Null rather than an empty list on purpose, and the distinction is the whole
 * safety of the write below: kind 30008 is *one replaceable event holding
 * every badge a person displays*, so anything that publishes it replaces the
 * lot. Treating a failed read as "displays no badges" would republish the list
 * with only ours in it and silently strip every badge the person had earned
 * anywhere else. That is the same mistake the profile editor made once — see
 * the note in publishNostrProfile — and it is worse here, because the evidence
 * that they ever had those badges is gone from their profile.
 *
 * Which means the distinction has to be one the reader can actually make.
 * `pool.query` cannot make it — it returns whatever arrived and swallows the
 * abort, so a relay that never answered comes back as an empty array, exactly
 * like a person who displays nothing. queryComplete reports whether every
 * relay finished, and only that answer is allowed to mean "no list".
 */
export async function fetchProfileBadges(pubkey: string): Promise<ProfileBadgeRef[] | null> {
    // Their own write relays as well as ours: a list published from another
    // client to a relay set we don't ask is otherwise invisible, and invisible
    // is what the write below would replace.
    const relays = await relaysForAuthors([pubkey]);
    const { events, answered, asked } = await queryComplete(
        [{ kinds: [KIND_PROFILE_BADGES], authors: [pubkey], '#d': [D_PROFILE_BADGES], limit: 1 }],
        { signal: AbortSignal.timeout(PROFILE_BADGE_READ_TIMEOUT_MS), relays },
    );
    // Checked locally against the filter, not taken on the relay's word: these
    // tags are copied into an event signed with this identity's key, so
    // somebody else's badge list accepted here becomes this one's.
    const mine = matching(events, {
        kind: KIND_PROFILE_BADGES, author: pubkey, dTag: D_PROFILE_BADGES,
    });
    if (mine.length === 0) {
        // A majority has to have answered before "nothing came back" is
        // allowed to mean "displays nothing" — the same bar the contact list
        // write applies, and for the same reason: below it, the write would
        // replace a list it never saw.
        if (answered * 2 <= asked) {
            console.warn(
                `Only ${answered} of ${asked} relays finished answering for the profile badge `
                + 'list, so it is unknown rather than empty.',
            );
            return null;
        }
        return [];
    }
    // Newest wins. `limit: 1` is per relay, so several relays can each
    // return their own version of this replaceable event and the first in
    // the array is not necessarily the current one. Taking a stale version
    // here would be the worst kind of wrong: the write below replaces the
    // whole list, so it would republish an old one and drop whatever has
    // been added since. Ties on created_at break on the id, so two versions
    // signed in the same second don't resolve by whichever relay was quicker.
    return profileBadgeRefs(newestEvent(mine)!.tags);
}

/**
 * The `a`/`e` pairs in a kind-30008 tag list.
 *
 * NIP-58 orders these as consecutive pairs rather than as a structure, so they
 * are read positionally: an `a` takes the `e` that follows it. Anything
 * unpaired is dropped rather than guessed at — a coordinate with someone
 * else's receipt attached would be a worse thing to republish than nothing.
 *
 * Pure, so the pairing rule can be tested without a relay.
 */
export function profileBadgeRefs(tags: string[][]): ProfileBadgeRef[] {
    const refs: ProfileBadgeRef[] = [];
    for (let i = 0; i < tags.length; i++) {
        if (tags[i][0] !== 'a' || !tags[i][1]) continue;
        const next = tags[i + 1];
        if (!next || next[0] !== 'e' || !next[1]) continue;
        refs.push({ coord: tags[i][1], awardId: next[1] });
        i++;
    }
    return refs;
}

/** The tag list for a kind-30008 event, in the pairs NIP-58 expects. */
export function profileBadgeTags(refs: ProfileBadgeRef[]): string[][] {
    return [
        ['d', D_PROFILE_BADGES],
        ...refs.flatMap(({ coord, awardId }) => [['a', coord], ['e', awardId]]),
    ];
}

/**
 * Add badges to the signed-in identity's profile. Never removes any.
 *
 * `shown` is what to make sure is listed, not the list to end up with —
 * passing fewer badges takes nothing away. Removal is deliberately absent
 * because this cannot tell "you no longer have that badge" from "the relays
 * did not return its definition just now", and fetchBadges drops an award in
 * the second case; a function that trusted `shown` as complete would delete
 * months-old badges off the back of one slow relay. Nothing in the app asks to
 * remove a badge, so this costs nothing.
 *
 * Everything already on the list is kept, ours and anyone else's alike.
 *
 * Throws rather than returning false, so the caller can tell the difference
 * between "published" and "nothing happened" and say so. Publishing this is
 * always an explicit action: it changes what strangers see next to a person's
 * name in every Nostr client, which is not something to do on their behalf.
 */
export async function setPalavraProfileBadges(
    pubkey: string,
    shown: EarnedBadge[],
): Promise<void> {
    const current = await fetchProfileBadges(pubkey);
    if (current === null) {
        // Refusing is the safe half of the read/modify/write. Publishing here
        // would strip every badge from every other issuer.
        throw new Error('Could not read the current badge list, so it was not replaced.');
    }

    // Everything already listed is kept — including our own badges that `shown`
    // does not mention.
    //
    // The first version removed every coordinate of ours and re-added only
    // `shown`, which quietly made this a delete. fetchBadges drops an award
    // whose definition the relays did not return, so one incomplete read would
    // have published a list with badges the person had been displaying for
    // months simply missing. That is the same failure the refusal above guards
    // against, arriving by a different door: do not delete what you could not
    // confirm. Nothing in the app asks to remove a badge, so there is no case
    // this costs us.
    const listed = new Set(current.map((ref) => ref.coord));
    const added = shown
        .filter(({ coord }) => !listed.has(coord))
        .map(({ coord, awardId }) => ({ coord, awardId }));
    const refs = [...current, ...added];
    // Nothing new to say. Republishing an identical list would only bump its
    // timestamp and spend a signature.
    if (added.length === 0) return;

    const event = await signNostrEvent({
        kind: KIND_PROFILE_BADGES,
        created_at: Math.floor(Date.now() / 1000),
        tags: profileBadgeTags(refs),
        content: '',
    });
    if (event.pubkey !== pubkey) {
        throw new Error('The badge list was signed by a different identity; it was not published.');
    }
    await pool.event(event, { signal: AbortSignal.timeout(RELAY_PUBLISH_TIMEOUT_MS) });
}
