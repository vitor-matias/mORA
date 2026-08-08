// Private leagues, on NIP-51.
//
// A league is a **kind 30000 follow set** — a standard Nostr list, so other
// clients can read it as one — addressed as `30000:<creator>:mora-palavra-league:<id>`.
// Its `title` tag names it; its `p` tags are the roster the creator declared.
//
// Membership is *self-asserted*, not granted. You join by adding the league's
// coordinate to your own `mora-palavra-leagues` list, so the standings query is
// "everyone who says they're in this league" rather than "everyone the creator
// added". That makes joining permissionless — no countersigning, no admin who
// has to be online — which is the only arrangement that works when the creator
// may never open the app again.
//
// **"Private" here means unlisted, and the UI says so.** NIP-51 can encrypt the
// member list into the event content, and that hides *who is in* the league.
// It cannot hide the scores: results are public events by design, because
// that's what makes them verifiable and readable by any client. A league keeps
// its roster quiet and its existence hard to stumble on; it is not a private
// channel, and calling it one would be a lie a user could act on.

import type { NostrEvent } from '@nostrify/nostrify';
import { nip19 } from 'nostr-tools';
import { pool, RELAYS } from '@/lib/pool';
import { currentPubkey } from '@/store/auth';
import {
    KIND_APP_STATE,
    RELAY_PUBLISH_TIMEOUT_MS,
    RELAY_QUERY_TIMEOUT_MS,
    signNostrEvent,
} from '@/lib/nostr';
import { relaysForAuthors } from '@/lib/relayList';
import { resultDTag } from './nostr';
import { entriesFromEvents, rank, withNames } from './social';
import type { LeaderboardEntry } from './types';

/** NIP-51 follow set. */
const KIND_FOLLOW_SET = 30000;

/** The `d` prefix for a league roster, and the list of leagues one belongs to. */
const LEAGUE_D_PREFIX = 'mora-palavra-league:';
const D_MY_LEAGUES = 'mora-palavra-leagues';

const MAX_LEAGUE_NAME = 40;
const MAX_LEAGUES = 20;
const MAX_MEMBERS_QUERIED = 100;

export interface League {
    /** `30000:<pubkey>:<d>` — the addressable coordinate, and its identity. */
    coord: string;
    creator: string;
    dTag: string;
    name: string;
}

export type LeagueStanding = LeaderboardEntry;

function tagValue(event: { tags: string[][] }, name: string): string | undefined {
    return event.tags.find((tag) => tag[0] === name)?.[1];
}

function coordOf(creator: string, dTag: string): string {
    return `${KIND_FOLLOW_SET}:${creator}:${dTag}`;
}

/** Split a coordinate, rejecting anything that isn't one of ours. */
export function parseCoord(coord: string): { creator: string; dTag: string } | null {
    const [kind, creator, ...rest] = coord.split(':');
    const dTag = rest.join(':');
    if (kind !== String(KIND_FOLLOW_SET)) return null;
    if (!/^[0-9a-f]{64}$/i.test(creator ?? '')) return null;
    if (!dTag.startsWith(LEAGUE_D_PREFIX)) return null;
    // The kind and creator are fixed-width; this was the one part an invite
    // could make arbitrarily long, and it ends up in relay filters.
    if (dTag.length > LEAGUE_D_PREFIX.length + 64) return null;
    return { creator, dTag };
}

/** A shareable invite. `naddr` carries the coordinate and a relay hint, so the
    recipient's client can find the league without already knowing where. */
export function leagueInvite(league: League): string {
    return nip19.naddrEncode({
        kind: KIND_FOLLOW_SET,
        pubkey: league.creator,
        identifier: league.dTag,
        // The hint the doc comment above promises. Without it the coordinate
        // alone only resolves for a recipient already querying a relay that
        // holds the league — which every mORA client is, so the omission was
        // invisible in testing and broke exactly the case invites are for:
        // someone on another client.
        relays: [...RELAYS],
    });
}

/** The coordinate behind an invite, or null if it isn't a league. */
export function parseInvite(invite: string): string | null {
    try {
        const trimmed = invite.trim().replace(/^nostr:/, '');
        const decoded = nip19.decode(trimmed);
        if (decoded.type !== 'naddr') return null;
        const { kind, pubkey, identifier } = decoded.data;
        if (kind !== KIND_FOLLOW_SET || !identifier.startsWith(LEAGUE_D_PREFIX)) return null;
        return coordOf(pubkey, identifier);
    } catch {
        return null;
    }
}

// ── Membership ───────────────────────────────────────────────────────────

/**
 * The league coordinates this identity claims to be in, or `null` if the read
 * failed.
 *
 * The distinction matters because the membership list is a single addressable
 * event: anything that writes it replaces the whole thing. Collapsing a failed
 * read to `[]` — indistinguishable from "belongs to no leagues" — meant one
 * relay timeout during a join republished the list with only the new league in
 * it, silently dropping every other membership, with no way back.
 */
async function readMyLeagueCoords(pubkey: string): Promise<string[] | null> {
    try {
        const [event] = await pool.query(
            [{ kinds: [KIND_APP_STATE], authors: [pubkey], '#d': [D_MY_LEAGUES], limit: 1 }],
            { signal: AbortSignal.timeout(RELAY_QUERY_TIMEOUT_MS) },
        );
        if (!event) return [];
        return event.tags
            .filter((tag) => tag[0] === 'a' && parseCoord(tag[1] ?? ''))
            .map((tag) => tag[1])
            .slice(0, MAX_LEAGUES);
    } catch (error) {
        console.warn('Could not load league memberships.', error);
        return null;
    }
}

/** The league coordinates this identity claims to be in. For display: a failed
    read reads as "none", which is the right thing for a list and the wrong
    thing for anything about to rewrite it. */
export async function fetchMyLeagueCoords(pubkey: string): Promise<string[]> {
    return await readMyLeagueCoords(pubkey) ?? [];
}

/** Replaces the membership list. Addressable, so this is one event per user. */
async function publishMyLeagues(coords: string[]): Promise<void> {
    const event = await signNostrEvent({
        kind: KIND_APP_STATE,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
            ['d', D_MY_LEAGUES],
            ['client', 'mora'],
            ...coords.slice(0, MAX_LEAGUES).map((coord) => ['a', coord]),
        ],
        content: '',
    });
    await pool.event(event, { signal: AbortSignal.timeout(RELAY_PUBLISH_TIMEOUT_MS) });
}

export async function joinLeague(coord: string): Promise<void> {
    const pubkey = currentPubkey();
    if (!pubkey || !parseCoord(coord)) return;
    const current = await readMyLeagueCoords(pubkey);
    // Refuse rather than guess. Writing on an unreadable list is what erases
    // the other memberships; the caller shows the failure and the player
    // retries, which costs nothing.
    if (current === null) throw new Error('Could not read the membership list; not rewriting it.');
    if (current.includes(coord)) return;
    await publishMyLeagues([...current, coord]);
}

export async function leaveLeague(coord: string): Promise<void> {
    const pubkey = currentPubkey();
    if (!pubkey) return;
    const current = await readMyLeagueCoords(pubkey);
    if (current === null) throw new Error('Could not read the membership list; not rewriting it.');
    if (!current.includes(coord)) return;
    await publishMyLeagues(current.filter((entry) => entry !== coord));
}

/**
 * Create a league and join it.
 *
 * The id is random rather than derived from the name: two people creating
 * "Família" would otherwise collide on the same `d`, and since the coordinate
 * includes the creator's pubkey they'd be different leagues with confusingly
 * identical invites.
 */
export async function createLeague(name: string): Promise<League | null> {
    const creator = currentPubkey();
    if (!creator) return null;
    const clean = name.replace(/\s+/g, ' ').trim().slice(0, MAX_LEAGUE_NAME);
    if (!clean) return null;

    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const dTag = `${LEAGUE_D_PREFIX}${id}`;

    const event = await signNostrEvent({
        kind: KIND_FOLLOW_SET,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
            ['d', dTag],
            ['title', clean],
            ['client', 'mora'],
            // The creator is the first member. Others join by listing the
            // coordinate themselves, so this stays a seed rather than a gate.
            ['p', creator],
        ],
        content: '',
    });
    await pool.event(event, { signal: AbortSignal.timeout(RELAY_PUBLISH_TIMEOUT_MS) });

    const league: League = { coord: coordOf(creator, dTag), creator, dTag, name: clean };
    // The roster event is already on the relays by this point, and joining is
    // a separate read-modify-write. If it fails, returning null would strand a
    // published league the creator can neither see nor invite anyone to — the
    // UI drives its list from the membership event, and `leagueInvite` needs
    // this object. Hand it back either way and let the caller retry.
    try {
        await joinLeague(league.coord);
    } catch (error) {
        console.warn('League created, but the membership list was not updated.', error);
    }
    return league;
}

// ── Reading ──────────────────────────────────────────────────────────────

function toLeague(event: NostrEvent): League | null {
    const dTag = tagValue(event, 'd');
    if (!dTag?.startsWith(LEAGUE_D_PREFIX)) return null;
    return {
        coord: coordOf(event.pubkey, dTag),
        creator: event.pubkey,
        dTag,
        // Names are attacker-controlled — collapse and cap, as elsewhere.
        name: (tagValue(event, 'title') || 'Liga')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, MAX_LEAGUE_NAME) || 'Liga',
    };
}

/** Resolve league metadata for a set of coordinates. */
export async function fetchLeagues(coords: string[]): Promise<League[]> {
    const parsed = coords.map(parseCoord).filter((entry): entry is { creator: string; dTag: string } => Boolean(entry));
    if (parsed.length === 0) return [];
    try {
        const events = await pool.query(
            [{
                kinds: [KIND_FOLLOW_SET],
                authors: [...new Set(parsed.map((entry) => entry.creator))],
                '#d': parsed.map((entry) => entry.dTag),
            }],
            { signal: AbortSignal.timeout(RELAY_QUERY_TIMEOUT_MS) },
        );
        // The filter above is a cross-product of authors × d-tags, so it can
        // return a league from creator A with creator B's d-tag. Keep only the
        // coordinates actually asked for.
        const wanted = new Set(coords);
        return events.flatMap((event) => {
            const league = toLeague(event);
            return league && wanted.has(league.coord) ? league : [];
        });
    } catch (error) {
        console.warn('Could not load leagues.', error);
        return [];
    }
}

/** Everyone who claims membership of this league. */
export async function fetchLeagueMembers(coord: string): Promise<string[]> {
    try {
        const events = await pool.query(
            [{ kinds: [KIND_APP_STATE], '#d': [D_MY_LEAGUES], '#a': [coord], limit: MAX_MEMBERS_QUERIED }],
            { signal: AbortSignal.timeout(RELAY_QUERY_TIMEOUT_MS) },
        );
        return [...new Set(events.map((event) => event.pubkey))];
    } catch (error) {
        console.warn('Could not load league members.', error);
        return [];
    }
}

/**
 * One day's standings within a league.
 *
 * Members are resolved first so their own write relays can be queried — a
 * league is exactly the case where the default relay set is least likely to
 * hold everyone's events.
 */
export async function fetchLeagueStandings(coord: string, date: string): Promise<LeagueStanding[]> {
    const members = await fetchLeagueMembers(coord);
    if (members.length === 0) return [];

    const relays = await relaysForAuthors(members);
    let events: NostrEvent[];
    try {
        events = await pool.query(
            [{ kinds: [KIND_APP_STATE], authors: members, '#d': [resultDTag(date)] }],
            { signal: AbortSignal.timeout(RELAY_QUERY_TIMEOUT_MS), relays },
        );
    } catch (error) {
        console.warn('Could not load league standings.', error);
        return [];
    }

    // Reuse the leaderboard's reader so a league ranks by exactly the same
    // rules, proof-of-work gate included.
    const rows = entriesFromEvents(events, date).sort(rank);
    return withNames(rows);
}
