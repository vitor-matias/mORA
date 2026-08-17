// Awards the monthly podium badges (NIP-58).
//
//   node badges.js                  # award last month, if it hasn't been
//   node badges.js 2026-07          # award a specific month
//   node badges.js --dry-run        # work out the podium, publish nothing
//
// Needs PALAVRA_NSEC — the same publisher identity that signs the puzzles.
// That is the whole reason this can exist: a NIP-58 badge means something only
// because a *known* key issued it, and clients already pin this one to decide
// which puzzles are real. A badge anyone could mint for themselves would be
// worth exactly nothing, so there is no client-side version of this file.
//
// Three events per place, per month:
//
//   kind 30009  the badge definition — addressable, so its name and (later)
//               its image can be corrected without reissuing anything
//   kind 8      the award, naming one winner
//
// The third, kind 30008, is not here: NIP-58 has the *recipient* publish that
// to put a badge on their profile, so it is the app's job and the winner's
// choice. Nothing here touches anyone else's profile.
//
// Two things this file is careful about, because both are irreversible. It
// refuses to award a month that has not finished, and it refuses to award one
// twice — an award is a permanent public event naming a person, and there is
// no unsaying it.

import { pathToFileURL } from 'node:url';
import DEFAULT_RELAYS from '../../src/relays.json' with { type: 'json' };

import WebSocket from 'ws';
import { finalizeEvent, getPublicKey } from 'nostr-tools/pure';
import { nip19 } from 'nostr-tools';

// The app's own reader and the app's own scoring rule, not copies of them.
// A badge decided by a second implementation of "who won" is a badge handed to
// the wrong person the first time the two disagree, and it would be handed out
// silently, once a month, to someone who would then have it forever. Node
// reads these with --experimental-strip-types; see package.json.
import {
    countPerGroup,
    entriesFromEvents,
    filtersFor,
    inGroupsOf,
} from '../../src/lib/palavra/results.ts';
import {
    liveThrough,
    monthDays,
    monthOf,
    shiftMonth,
    tallyMonth,
} from '../../src/lib/palavra/scoring.ts';

const configuredRelays = (process.env.PALAVRA_RELAYS ?? '')
    .split(',').map((r) => r.trim()).filter(Boolean);
const RELAYS = configuredRelays.length > 0 ? configuredRelays : DEFAULT_RELAYS;

/** NIP-58. */
const KIND_BADGE_DEFINITION = 30009;
const KIND_BADGE_AWARD = 8;

const RELAY_TIMEOUT_MS = 10_000;

/** How many places get a badge. */
const PODIUM = 3;

/** Matches the client's monthly read: a filter per week, so a relay that
    truncates can only ever cut one week short. */
const CHUNK_DAYS = 7;
const CHUNK_LIMIT = 500;

/** The budget a single day gets when its week came back full — the daily
    board's own limit, as in social.ts. */
const DAY_LIMIT = 200;

const MONTH_NAMES = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const PLACE_NAMES = ['1.º lugar', '2.º lugar', '3.º lugar'];

/**
 * Where the badge art is served from, e.g. https://mora.app/.
 *
 * The app works its own URL out from `window.location`, which is no help here,
 * so this is configured. It matters more than most env vars: the URL is baked
 * into a signed definition that sits on relays indefinitely, and every client
 * that ever renders the badge fetches it from there. Moving the app later
 * means republishing the definitions — which is possible precisely because
 * they are addressable, and is why the awards point at a coordinate rather
 * than at a picture.
 */
// Normalised only when there is something to normalise: `''.replace(/\/*$/,
// '/')` is `'/'`, because the pattern happily matches zero slashes at the end
// of an empty string. That slipped through as a truthy APP_URL, which put a
// *relative* image URL into a signed event — and a relative URL in an event on
// a relay resolves against nothing, which is the broken-image case this is
// meant to avoid.
// BASE_URL is accepted as well, because that is what the repository variable
// is called and someone running this by hand will reach for the name they
// already set.
const configuredAppUrl = (process.env.PALAVRA_APP_URL || process.env.BASE_URL || '').trim();
const APP_URL = configuredAppUrl ? configuredAppUrl.replace(/\/*$/, '/') : '';

const artUrls = (place) => ({
    image: `${APP_URL}badges/palavra-${place}.png`,
    thumb: `${APP_URL}badges/palavra-${place}-thumb.png`,
});

/**
 * The art tags for each place, dropped for any whose files aren't actually
 * being served yet.
 *
 * NIP-58 allows a definition with no image, and a definition carrying a
 * *broken* one is worse than that: clients cache what they fetch, 404s
 * included, so a badge published a few minutes before its art went live can
 * show an empty tile in someone's client long after the file appears. Checking
 * first costs one HEAD per URL, once a month.
 *
 * This is not a hypothetical ordering worry. The art is served by the app's own
 * deployment, so the very first run after a release is exactly the moment the
 * two can disagree.
 */
async function artTagsByPlace(places) {
    if (!APP_URL) return new Map(places.map((place) => [place, []]));

    const reachable = async (url) => {
        try {
            const response = await fetch(url, {
                method: 'HEAD',
                signal: AbortSignal.timeout(RELAY_TIMEOUT_MS),
            });
            return response.ok;
        } catch {
            // Unreachable is not "missing", but it is not "confirmed serving"
            // either, and only the latter justifies baking the URL into a
            // permanent event.
            return false;
        }
    };

    const checked = await Promise.all(places.map(async (place) => {
        const { image, thumb } = artUrls(place);
        const [imageOk, thumbOk] = await Promise.all([reachable(image), reachable(thumb)]);
        if (!imageOk || !thumbOk) {
            console.warn(
                `The art for place ${place} is not being served yet (${image}), `
                + 'so its badge is published without an image. Because a definition is '
                + 'addressable, republishing later adds the art without reissuing the award.',
            );
            return [place, []];
        }
        return [place, [['image', image, '512x512'], ['thumb', thumb, '128x128']]];
    }));
    return new Map(checked);
}

const isoDate = (ms) => new Date(ms).toISOString().slice(0, 10);
const utcToday = () => isoDate(Date.now());
/** `mora-palavra-2026-07-1` — one identifier per place per month, so a win is
    a distinct badge that still reads correctly years later. */
const badgeDTag = (month, place) => `mora-palavra-${month}-${place}`;
const badgeCoord = (pubkey, month, place) =>
    `${KIND_BADGE_DEFINITION}:${pubkey}:${badgeDTag(month, place)}`;

function badgeName(month) {
    const [year, mon] = month.split('-');
    return `Palavra — ${MONTH_NAMES[Number(mon) - 1]} ${year}`;
}

function loadSecretKey() {
    const nsec = process.env.PALAVRA_NSEC;
    if (!nsec) {
        console.error('PALAVRA_NSEC is not set. Run `npm run keygen` and set it.');
        process.exit(1);
    }
    let decoded;
    try {
        decoded = nip19.decode(nsec);
    } catch {
        console.error('PALAVRA_NSEC is not a valid nsec. Run `npm run keygen`.');
        process.exit(1);
    }
    if (decoded.type !== 'nsec') {
        console.error('PALAVRA_NSEC is not an nsec.');
        process.exit(1);
    }
    return decoded.data;
}

// ── Relay I/O ────────────────────────────────────────────────────────────

/**
 * Every event matching `filters` on one relay, and whether the relay finished.
 *
 * `complete` is only true on EOSE — the relay's own statement that it has sent
 * everything it holds. A timeout, a socket error, a close before EOSE, or a
 * CLOSED (which is how a relay refuses a filter) all yield whatever arrived so
 * far, and that is *not* the same as an answer. Conflating the two is how a
 * badge ends up on the wrong profile: if the one relay holding a month's
 * results times out, an incomplete read looks exactly like a quiet month.
 */
function queryOn(url, filters) {
    return new Promise((resolve) => {
        const found = [];
        let settled = false;
        const finish = (complete) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            try { socket.close(); } catch { /* already closing */ }
            resolve({ url, events: found, complete });
        };
        const socket = new WebSocket(url);
        const timer = setTimeout(() => finish(false), RELAY_TIMEOUT_MS);
        socket.on('open', () => socket.send(JSON.stringify(['REQ', 'badges', ...filters])));
        socket.on('message', (raw) => {
            try {
                const msg = JSON.parse(raw.toString());
                if (msg[0] === 'EVENT' && msg[2]) found.push(msg[2]);
                if (msg[0] === 'EOSE') finish(true);
                // The relay declined the subscription. Whatever it sent first
                // is a fragment, not a result set.
                if (msg[0] === 'CLOSED') finish(false);
            } catch { /* not for us */ }
        });
        socket.on('error', () => finish(false));
        socket.on('close', () => finish(false));
    });
}

/**
 * Union across relays, deduplicated by event id, plus the relays that failed.
 *
 * An event held anywhere counts: a result the board can see is a result the
 * podium must count. But a relay that could not be read might have been holding
 * the very result that decides the order, so the caller is told which ones went
 * unread rather than being handed a total that looks authoritative.
 */
async function query(filters) {
    const perRelay = await Promise.all(RELAYS.map((url) => queryOn(url, filters)));
    const byId = new Map();
    for (const { events } of perRelay) {
        for (const event of events) if (!byId.has(event.id)) byId.set(event.id, event);
    }
    return {
        events: newestVersions([...byId.values()]),
        unread: perRelay.filter((relay) => !relay.complete).map((relay) => relay.url),
    };
}

/** NIP-01 replaceable ranges. */
const isReplaceable = (kind) => kind === 0 || kind === 3 || (kind >= 10_000 && kind < 20_000);
const isAddressable = (kind) => kind >= 30_000 && kind < 40_000;

/**
 * One event per replaceable or addressable coordinate, newest kept.
 *
 * The app never needs this: its NPool collects into an NSet, which drops an
 * older version of the same coordinate as it goes, and pool.ts says as much.
 * This file talks to relays over a raw socket and so inherits none of that —
 * it deduplicates by event id, and two *different* versions of the same
 * addressable event have two different ids, so both survived.
 *
 * That matters because results are addressable, one per author per day. Replay
 * a day and the relays hold both versions; entriesFromEvents drops created_at,
 * and tallyMonth keeps the first result it sees for an author's day. So the
 * version that scored was whichever relay answered first — and a stale loss
 * arriving ahead of its replacement could cost someone the month.
 *
 * Ties break on the id, as NSet's own comparison does, so the outcome does not
 * depend on relay order in any case.
 */
export function newestVersions(events) {
    const newest = new Map();
    const rest = [];
    for (const event of events) {
        if (!isReplaceable(event.kind) && !isAddressable(event.kind)) {
            rest.push(event);
            continue;
        }
        const dTag = isAddressable(event.kind)
            ? event.tags?.find(([name]) => name === 'd')?.[1] ?? ''
            : '';
        const coord = `${event.kind}:${event.pubkey}:${dTag}`;
        const held = newest.get(coord);
        const wins = !held
            || event.created_at > held.created_at
            || (event.created_at === held.created_at && event.id < held.id);
        if (wins) newest.set(coord, event);
    }
    return [...rest, ...newest.values()];
}

function sendTo(url, event) {
    return new Promise((resolve) => {
        let settled = false;
        const finish = (ok) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            try { socket.close(); } catch { /* already closing */ }
            resolve(ok);
        };
        const socket = new WebSocket(url);
        const timer = setTimeout(() => finish(false), RELAY_TIMEOUT_MS);
        socket.on('open', () => socket.send(JSON.stringify(['EVENT', event])));
        socket.on('message', (raw) => {
            try {
                const msg = JSON.parse(raw.toString());
                if (msg[0] === 'OK' && msg[1] === event.id) finish(msg[2] === true);
            } catch { /* not for us */ }
        });
        socket.on('error', () => finish(false));
        socket.on('close', () => finish(false));
    });
}

/** Publish to every relay. One acceptance is enough for the event to exist. */
async function broadcast(event) {
    const results = await Promise.all(RELAYS.map((url) => sendTo(url, event)));
    return results.some(Boolean);
}

// ── The podium ───────────────────────────────────────────────────────────

/**
 * The month's top finishers, scored exactly as the app scores them.
 *
 * The reader and the rule both come from src/, so the proof-of-work gate, the
 * bounds checks, the `d`/`date` agreement and the points table are the same
 * ones the board applies. If they were restated here they would drift, and the
 * first sign of the drift would be a badge on the wrong profile.
 */
export async function podiumFor(month) {
    const days = monthDays(month);
    const { events, unreadRelays, saturatedDays } = await resultEventsFor(days);
    const results = days.flatMap((date) =>
        entriesFromEvents(events, date).map((entry) => ({ ...entry, date })));

    return {
        podium: tallyMonth(results, liveThrough(month, utcToday()), PODIUM),
        unreadRelays,
        saturatedDays,
    };
}

/**
 * Every result event for a month, re-reading any week that came back full,
 * and naming the days it still could not read whole.
 *
 * The same self-healing read the board does — see fetchMonthEvents in
 * social.ts — and here it matters more. A filter returning its whole limit may
 * have been cut short, and truncation keeps the *newest* events, so a busy
 * week silently loses its earliest days. On the board that is a total slightly
 * wrong for an afternoon. Here it is a permanent public badge on the wrong
 * person's profile, decided in a job nobody watches run.
 *
 * So `incomplete` is not a warning to log and move past: the caller refuses to
 * award on it. A month that cannot be read whole has no podium worth minting.
 */
async function resultEventsFor(days) {
    const weeks = inGroupsOf(days, CHUNK_DAYS);
    const first = await query(filtersFor(weeks, CHUNK_LIMIT));

    const perWeek = countPerGroup(first.events, weeks);
    const full = weeks.filter((_, index) => perWeek[index] >= CHUNK_LIMIT);
    if (full.length === 0) {
        return { events: first.events, unreadRelays: first.unread, saturatedDays: [] };
    }

    const singles = full.flat().map((day) => [day]);
    const rest = await query(filtersFor(singles, DAY_LIMIT));

    const perDay = countPerGroup(rest.events, singles);

    // Overlap between the two reads is fine: query() dedupes by event id, and
    // the tally counts one result per author per day regardless.
    return {
        events: [...first.events, ...rest.events],
        unreadRelays: [...new Set([...first.unread, ...rest.unread])],
        saturatedDays: singles.filter((_, index) => perDay[index] >= DAY_LIMIT).flat(),
    };
}

/**
 * Which places this publisher has already awarded for a month, and whether the
 * answer can be trusted.
 *
 * The same rule the podium read applies, and for a sharper reason. If the relay
 * holding a previous award is the one that did not finish answering, this comes
 * back without that place and the caller cheerfully awards it a second time —
 * and an award cannot be withdrawn. A partial answer here is worse than no
 * answer, so it is reported rather than returned as fact.
 */
async function alreadyAwarded(pubkey, month) {
    const coords = Array.from({ length: PODIUM }, (_, i) => badgeCoord(pubkey, month, i + 1));
    const { events, unread } = await query([{
        kinds: [KIND_BADGE_AWARD], authors: [pubkey], '#a': coords,
    }]);
    const awarded = new Set();
    for (const event of events) {
        const coord = event.tags.find((t) => t[0] === 'a')?.[1];
        const place = coords.indexOf(coord);
        if (place !== -1) awarded.add(place + 1);
    }
    return { awarded, unread };
}

function definitionEvent(month, place, art, secretKey) {
    return finalizeEvent({
        kind: KIND_BADGE_DEFINITION,
        created_at: Math.floor(Date.now() / 1000),
        // An open book in gold, silver or bronze — tools/make-badge-art.js
        // renders them, public/badges/ holds them, the app serves them.
        tags: [
            ['d', badgeDTag(month, place)],
            ['name', badgeName(month)],
            ['description', `${PLACE_NAMES[place - 1]} da classificação mensal da Palavra Bíblica do Dia`],
            ...art,
            ['t', PALAVRA_TOPIC],
        ],
        content: '',
    }, secretKey);
}

function awardEvent(pubkey, month, place, winner, secretKey) {
    return finalizeEvent({
        kind: KIND_BADGE_AWARD,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['a', badgeCoord(pubkey, month, place)], ['p', winner]],
        content: '',
    }, secretKey);
}

// ── Entry point ──────────────────────────────────────────────────────────

async function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    // Bounded to real months. `2026-13` would otherwise reach badgeName, which
    // indexes MONTH_NAMES and would sign "Palavra — undefined 2026" into a
    // permanent definition. monthDays rejects it a few steps later too, but a
    // guard on the argument should not depend on that.
    //
    // Refused rather than ignored: falling through to last month would award a
    // month nobody asked for, which is a strange thing to do quietly when the
    // output is permanent.
    const monthArg = args.find((a) => /^\d{4}-\d{1,2}$/.test(a));
    if (monthArg !== undefined && !/^\d{4}-(0[1-9]|1[0-2])$/.test(monthArg)) {
        console.error(`${monthArg} is not a month. Expected YYYY-MM, 01 to 12.`);
        process.exit(1);
    }
    const month = monthArg ?? shiftMonth(monthOf(utcToday()), -1);

    // A podium is only a podium once the month is over. Awarding mid-month
    // would name whoever happens to be ahead, permanently and in public, and
    // there is no way to take it back when the standings move the next day.
    //
    // The bar is on *awarding*, not on looking: a dry run publishes nothing,
    // and seeing who is ahead with a week to go is the main reason to run one.
    const unfinished = month >= monthOf(utcToday());
    if (unfinished && !dryRun) {
        console.error(
            `${month} has not finished. A podium can only be awarded once its month is over.`
            + ' Use --dry-run to see the standings so far.',
        );
        process.exit(1);
    }

    // Read before signing: a dry run of an unfinished month shouldn't need the
    // publisher's key at all, since it never publishes.
    const { podium, unreadRelays, saturatedDays } = await podiumFor(month);
    const readable = unreadRelays.length === 0 && saturatedDays.length === 0;
    if (podium.length === 0) {
        console.log(`No results found for ${month}; nothing to award.`);
        return;
    }

    console.log(`${badgeName(month)} — podium:`);
    podium.forEach((row, i) => {
        console.log(`  ${i + 1}. ${row.pubkey.slice(0, 12)}…  ${row.points} pts over ${row.played} days`);
    });

    // Two different causes, said in their own words rather than under one
    // vague heading: one is a relay that never answered, the other is a day
    // busier than a single query can return. Both make the totals a floor
    // rather than a count, and either can put the order wrong.
    if (unreadRelays.length > 0) {
        console.error(
            `\nThese relays did not finish answering: ${unreadRelays.join(', ')}. `
            + 'Any results only they hold are missing from the totals above.',
        );
    }
    if (saturatedDays.length > 0) {
        console.error(
            `\nThese days are busier than one query can read: ${saturatedDays.join(', ')}. `
            + 'Their totals are a floor, not a count.',
        );
    }

    const art = await artTagsByPlace(podium.map((_, index) => index + 1));
    const withArt = [...art.values()].filter((tags) => tags.length > 0).length;
    console.log(
        `\n${withArt} of ${podium.length} badges would carry art`
        + `${APP_URL ? '' : ' (no app URL configured)'}.`,
    );

    if (dryRun) {
        console.log(
            `\n--dry-run: nothing published.${unfinished ? ' This month is still running.' : ''}`
            + `${readable ? '' : ' The month could not be read in full, so a real run would refuse it.'}`,
        );
        return;
    }

    // Refused, not warned. The board can render a total that is slightly off
    // for an afternoon; a badge is permanent, public, and names a person. If
    // the month cannot be read whole there is no podium worth minting from it.
    if (!readable) {
        console.error('Not awarding a podium computed from an incomplete month.');
        process.exit(1);
    }

    const secretKey = loadSecretKey();
    const pubkey = getPublicKey(secretKey);
    const { awarded, unread } = await alreadyAwarded(pubkey, month);
    if (unread.length > 0) {
        console.error(
            `Could not check which places are already awarded: ${unread.join(', ')} `
            + 'did not finish answering. Declining rather than risking a second award '
            + 'for a place, which cannot be withdrawn.',
        );
        process.exit(1);
    }
    let failed = false;

    for (const [index, row] of podium.entries()) {
        const place = index + 1;
        if (awarded.has(place)) {
            console.log(`Place ${place} for ${month} is already awarded; leaving it alone.`);
            continue;
        }

        // Definition first. An award pointing at a coordinate no relay holds
        // renders as a nameless badge in every client, so the thing it names
        // has to exist before anything points at it.
        if (!await broadcast(definitionEvent(month, place, art.get(place) ?? [], secretKey))) {
            console.error(`Could not publish the definition for place ${place}; not awarding it.`);
            failed = true;
            continue;
        }
        if (!await broadcast(awardEvent(pubkey, month, place, row.pubkey, secretKey))) {
            console.error(`Could not publish the award for place ${place}.`);
            failed = true;
            continue;
        }
        console.log(`Awarded place ${place} to ${row.pubkey.slice(0, 12)}…`);
    }

    process.exit(failed ? 1 : 0);
}

// process.argv[1] is undefined under `node -e`, where pathToFileURL throws.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
