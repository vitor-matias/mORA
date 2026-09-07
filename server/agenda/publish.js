// Publishes the Portuguese liturgical calendar to Nostr, one event per day.
//
//   node publish.js              # publish whatever changed, then exit
//   node publish.js --dry-run    # work out what would go, but send nothing
//   node publish.js --force      # republish every day, changed or not
//   node publish.js --max 50     # cap this run (default 150)
//
// Why this exists: liturgia.pt and vatican.va both serve their feeds without
// CORS headers, so a browser cannot read them directly. The app used to go
// through public CORS proxies, and every one of them eventually died, went
// key-only, or started answering 200 with its own error page in the body —
// which left the calendar silently blank on people's phones.
//
// Relays are the way out: they're WebSocket, so CORS never applies, and the
// app already talks to them for Palavra. This job fetches the feeds
// server-side, where CORS is not a thing, and mirrors them onto the relays
// the app already reads.
//
// One event per day, keyed on the date, because that is the unit the app
// actually asks for: colouring today costs one ~1.5KB event instead of
// pulling down the 366KB year the proxies used to serve for the same answer.
//
// Signs with PALAVRA_NSEC — the same identity that signs the daily puzzle,
// because one key signs everything mORA publishes. Clients pin the matching
// pubkey (VITE_PALAVRA_PUBLISHER_PUBKEY) so nobody else's event can pose as
// the calendar.

import { pathToFileURL } from 'node:url';
// The same relay list and the same parser the app uses, not copies of them: a
// calendar published where the app doesn't look, or parsed a hair differently
// from how the app would have parsed it, is a bug nothing else would catch.
import DEFAULT_RELAYS from '../../src/relays.json' with { type: 'json' };
import { parseIcsToDays } from '../../src/lib/icsCalendar.ts';

import WebSocket from 'ws';
import { finalizeEvent, getPublicKey } from 'nostr-tools/pure';
import { nip19 } from 'nostr-tools';
import { sha256 } from '@noble/hashes/sha2';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';

const configuredRelays = (process.env.AGENDA_RELAYS ?? '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);

// `??` wouldn't do: AGENDA_RELAYS set but blank — what a declared-and-empty
// CI variable produces — parses to an empty list, which `??` never sees.
const RELAYS = configuredRelays.length > 0 ? configuredRelays : DEFAULT_RELAYS;

const KIND = 30078; // NIP-78 app-specific data, same as Palavra uses.
const TOPIC = 'moraagenda';
const RELAY_TIMEOUT_MS = 15_000;

/**
 * Sent in batches this size, with a breath between them: a year is 365
 * events, and firing them all at eight relays at once is how a publisher gets
 * dropped. Politeness, not a limit — a run publishes everything missing.
 *
 * Capping a run instead was a mistake worth remembering: it left the calendar
 * incomplete for days, and did not even buy what it was for, since the relays
 * that rate-limit did so within the cap anyway.
 */
const BATCH_SIZE = 10;
const BATCH_PAUSE_MS = 400;

const ICS_URL = 'https://www.liturgia.pt/agenda/agenda.ics';
const VATICAN_INDEX_URL = 'https://www.vatican.va/content/leo-xiv/pt/prayers.html';

const dayDTag = (date) => `mora-agenda:${date}`;
const themeDTag = (month) => `mora-vatican-theme:${month}`;

const ITALIAN_MONTHS = [
    'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
    'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
];

const hashOf = (text) => bytesToHex(sha256(utf8ToBytes(text)));
const today = () => new Date().toISOString().slice(0, 10);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The publisher identity: the same key that signs Palavra.
 *
 * One key signs everything mORA publishes. The feeds are told apart by their
 * `d` and `t` tags, never by who signed them, so a key of its own would buy
 * nothing but a second secret to set up, and a second pubkey for the app to
 * pin — which, forgotten, would publish a calendar no client would read.
 */
function loadSecretKey() {
    const nsec = process.env.PALAVRA_NSEC;
    if (!nsec) {
        console.error('PALAVRA_NSEC is not set. It is the same key that signs Palavra; see server/palavra.');
        process.exit(1);
    }
    let decoded;
    try {
        decoded = nip19.decode(nsec);
    } catch {
        // nip19.decode throws on anything that isn't valid bech32, and a typo
        // in a secret is the likeliest way to get here.
        console.error('PALAVRA_NSEC is not a valid nsec.');
        process.exit(1);
    }
    if (decoded.type !== 'nsec') {
        console.error('PALAVRA_NSEC is not an nsec.');
        process.exit(1);
    }
    return decoded.data;
}

// ── The feeds ────────────────────────────────────────────────────────────

async function fetchText(url, label) {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`${label} responded ${res.status}`);
    const text = await res.text();
    if (!text) throw new Error(`${label} responded with an empty body`);
    return text;
}

/**
 * vatican.va's own short theme for a month (e.g. "Pelo cuidado com a água").
 *
 * The document URL embeds an unpredictable publish day, so it's discovered
 * from the PT prayers index rather than guessed. Returns the raw <title>; the
 * app derives the theme text from it, so that parsing stays in one place.
 *
 * A month with no document yet is normal, not an error — the Vatican
 * publishes these a few weeks ahead at most.
 */
async function fetchVaticanTheme(month) {
    const italianMonth = ITALIAN_MONTHS[Number(month.slice(5, 7)) - 1];
    const indexHtml = await fetchText(VATICAN_INDEX_URL, 'vatican.va index');

    const linkMatch = indexHtml.match(
        new RegExp(`href="(/content/leo-xiv/pt/prayers/documents/\\d{8}-popesprayer-${italianMonth}\\.html)"`),
    );
    if (!linkMatch) return null;

    const url = `https://www.vatican.va${linkMatch[1]}`;
    const titleMatch = (await fetchText(url, 'vatican.va document')).match(/<title>([^<]*)<\/title>/i);
    if (!titleMatch) return null;

    return { title: titleMatch[1].trim(), url };
}

// ── Relays ───────────────────────────────────────────────────────────────

/**
 * What this publisher already has on one relay: d tag → content hash.
 *
 * `complete` says whether the relay actually finished answering (EOSE) as
 * opposed to timing out or dropping the connection. The difference matters:
 * a relay that answers "I have nothing" is a relay that needs everything,
 * while one that never answered says nothing about what it holds. Both hand
 * back an empty map, so without this flag they are indistinguishable — and a
 * newly added, still-empty relay would be quietly skipped forever.
 */
function publishedHashesOn(url, pubkey) {
    return new Promise((resolve) => {
        const found = new Map();
        let settled = false;
        const finish = (complete) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            try { socket.close(); } catch { /* already closing */ }
            resolve({ hashes: found, complete });
        };
        const socket = new WebSocket(url);
        const timer = setTimeout(() => finish(false), RELAY_TIMEOUT_MS);
        // A year of days plus the themes, with room to spare. Relays cap
        // `limit` themselves; whatever comes back is treated as "what this
        // relay has", and anything missing simply gets republished.
        socket.on('open', () => socket.send(JSON.stringify(
            ['REQ', 'agenda', { kinds: [KIND], authors: [pubkey], '#t': [TOPIC], limit: 500 }],
        )));
        socket.on('message', (raw) => {
            try {
                const msg = JSON.parse(raw.toString());
                if (msg[0] === 'EVENT') {
                    const tags = msg[2]?.tags ?? [];
                    const d = tags.find((t) => t[0] === 'd')?.[1];
                    // Falls back to hashing the content, so events written
                    // before the hash tag existed still compare equal.
                    const hash = tags.find((t) => t[0] === 'hash')?.[1]
                        ?? (typeof msg[2]?.content === 'string' ? hashOf(msg[2].content) : null);
                    if (d && hash) found.set(d, hash);
                }
                if (msg[0] === 'EOSE') finish(true);
            } catch { /* not for us */ }
        });
        socket.on('error', () => finish(false));
        socket.on('close', () => finish(false));
    });
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

async function publish(entry, secretKey, dryRun) {
    const event = finalizeEvent({
        kind: KIND,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
            ['d', entry.dTag],
            ['t', TOPIC],
            ['hash', hashOf(entry.content)],
            ['client', 'mora-agenda'],
            ...entry.tags,
        ],
        content: entry.content,
    }, secretKey);

    if (dryRun) return true;

    const results = await Promise.all(RELAYS.map((url) => sendTo(url, event)));
    const accepted = results.filter(Boolean).length;
    if (accepted === 0) console.warn(`  ${entry.dTag} reached no relay`);
    // One relay is enough for the app to find it; zero means nothing shipped.
    return accepted > 0;
}

// ── Main ─────────────────────────────────────────────────────────────────

/** Everything that should be on the relays right now: d tag → content. */
export async function buildEntries(ics, theme, themeMonth) {
    const entries = [];

    const days = parseIcsToDays(ics);
    for (const [date, info] of days) {
        entries.push({
            dTag: dayDTag(date),
            // Exactly the shape the app renders — the prose and the sections
            // parsed out of it — so the app only has to JSON.parse. Adding a
            // field changes every day's content hash, which is what makes the
            // next run republish the year without being asked to.
            content: JSON.stringify(info),
            tags: [['date', date]],
            date,
        });
    }

    if (theme) {
        entries.push({
            dTag: themeDTag(themeMonth),
            content: JSON.stringify(theme),
            tags: [['month', themeMonth]],
            // Sorts with today: it is this month's theme, wanted now.
            date: today(),
        });
    }

    return entries;
}

async function main() {
    const dryRun = process.argv.includes('--dry-run');
    const force = process.argv.includes('--force');
    // A run publishes everything that is missing. --max is an escape hatch
    // for publishing by hand against a relay that is struggling, not
    // something the scheduled job uses.
    const maxIndex = process.argv.indexOf('--max');
    const maxPerRun = maxIndex === -1 ? Infinity : Number(process.argv[maxIndex + 1]);
    if (!(maxPerRun > 0)) {
        console.error('--max needs a positive number.');
        process.exit(1);
    }

    const secretKey = loadSecretKey();
    const pubkey = getPublicKey(secretKey);
    console.log(`Publishing as ${nip19.npubEncode(pubkey)}`);
    console.log(`Relays: ${RELAYS.join(', ')}`);

    const ics = await fetchText(ICS_URL, 'liturgia.pt');

    // The theme is a nicety on top of the calendar. A Vatican outage must not
    // stop the calendar — the thing people actually open the app for — from
    // being published, so this failing is logged and shrugged off.
    const themeMonth = new Date().toISOString().slice(0, 7);
    let theme = null;
    try {
        theme = await fetchVaticanTheme(themeMonth);
        console.log(theme
            ? `Vatican theme for ${themeMonth}: ${theme.title}`
            : `Vatican theme for ${themeMonth}: not published yet`);
    } catch (error) {
        console.warn(`Vatican theme for ${themeMonth} could not be fetched: ${error.message}`);
    }

    const entries = await buildEntries(ics, theme, themeMonth);
    if (entries.length === 0) throw new Error('the calendar feed parsed to no days at all');
    console.log(`Feed has ${entries.length} entries (${ics.length} bytes in)`);

    const perRelay = force
        ? []
        : await Promise.all(RELAYS.map((url) => publishedHashesOn(url, pubkey)));
    // "Answered" means finished answering, empty-handed or not — a relay with
    // nothing on it is precisely the one that needs everything.
    const answered = perRelay.filter(({ complete }) => complete);

    const stale = entries.filter((entry) => {
        if (force) return true;
        // Nothing answered: publish rather than assume. Better a redundant
        // write than a day the app can't find.
        if (answered.length === 0) return true;
        const hash = hashOf(entry.content);
        // Republish unless every relay that answered already has this exact
        // content — otherwise a relay that dropped an event, or one added to
        // the list later, would never be filled in.
        return !answered.every(({ hashes }) => hashes.get(entry.dTag) === hash);
    });

    if (stale.length === 0) {
        console.log('Nothing changed — nothing to publish.');
        return;
    }

    // Today first, then forward, then back into the past.
    //
    // The order only shows when a run cannot finish — a relay refusing
    // events, a job cancelled — but that is exactly when it matters: the home
    // screen and the Mass ask for today, and the directory for the month
    // around it. Publishing by date instead put a cold start's whole first
    // run into January and left today missing, which is precisely how this
    // went wrong the first time it ran for real.
    const todayStr = today();
    const ordered = [...stale].sort((a, b) => {
        const aAhead = a.date >= todayStr;
        const bAhead = b.date >= todayStr;
        if (aAhead !== bAhead) return aAhead ? -1 : 1;
        // Ahead: soonest first. Behind: most recent first.
        return aAhead ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date);
    });
    const batch = ordered.slice(0, maxPerRun);
    console.log(
        `${stale.length} entr${stale.length === 1 ? 'y' : 'ies'} to publish`
        + `${stale.length > batch.length ? `, capped at ${batch.length} this run` : ''}`
        + `${dryRun ? ' (dry run, sending nothing)' : ''}`,
    );

    let sent = 0;
    let failed = 0;
    for (let i = 0; i < batch.length; i += BATCH_SIZE) {
        const slice = batch.slice(i, i + BATCH_SIZE);
        const outcomes = await Promise.all(slice.map((entry) => publish(entry, secretKey, dryRun)));
        sent += outcomes.filter(Boolean).length;
        failed += outcomes.filter((ok) => !ok).length;
        if (i + BATCH_SIZE < batch.length) await sleep(BATCH_PAUSE_MS);
    }

    console.log(`Published ${sent}/${batch.length}${failed ? ` (${failed} reached no relay)` : ''}`);
    // Some failures are ordinary — one relay down, one event refused. All of
    // them failing means the run achieved nothing, and CI should say so.
    if (sent === 0) throw new Error('nothing reached any relay');
}

// Only when run directly: buildEntries is exported for the tests, and
// unguarded top-level code would make merely importing it demand PALAVRA_NSEC
// and then exit the process.
// process.argv[1] is undefined under `node -e`, where pathToFileURL throws.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch((error) => {
        console.error(error.message);
        process.exit(1);
    });
}
