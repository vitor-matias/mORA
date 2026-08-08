// Publishes the day's puzzle to Nostr.
//
// This replaces the always-on HTTP server. The app is already a Nostr client,
// so making the puzzle a Nostr event removes a whole transport: no uptime to
// serve, no hosting, no CORS, no rate limiting — and the archive comes free,
// because every past day is still an event on the relays.
//
//   node publish.js --watch      # run it and leave it: publishes, then sleeps
//                                # until the next 00:00 UTC, forever
//   node publish.js              # publish today and exit
//   node publish.js 2026-08-08   # one specific day
//   node publish.js --backfill 7 # last 7 days, skipping any already published
//
// Needs PALAVRA_NSEC — the publisher identity. Clients pin the matching pubkey
// and ignore puzzles signed by anyone else, so this key is what makes a puzzle
// *the* puzzle. Generate it once with `npm run keygen` and keep it.

import { pathToFileURL } from 'node:url';
import WebSocket from 'ws';
import { finalizeEvent, getPublicKey } from 'nostr-tools/pure';
import { nip19 } from 'nostr-tools';
import { sha256 } from '@noble/hashes/sha2';
import { utf8ToBytes } from '@noble/hashes/utils';
import { answerHash, normalizeWord, obfuscateAnswer } from './palavra.js';
import { VERSES } from './verses.js';

// Must stay in step with DEFAULT_RELAYS in src/lib/pool.ts — a puzzle
// published only where the app doesn't look is a day with no puzzle.
const RELAYS = (process.env.PALAVRA_RELAYS
    ?? 'wss://relay.damus.io,wss://nos.lol,wss://relay.primal.net,wss://nostr.mom,wss://relay.ditto.pub')
    .split(',').map((r) => r.trim()).filter(Boolean);

/** NIP-78 application data, addressable — one event per day, replaceable. */
const KIND = 30078;
const RELAY_TIMEOUT_MS = 10_000;

/** How far back to heal a gap. A fresh key shouldn't try to publish all of
    history, and a process that has been off for months probably shouldn't
    silently backfill them either. */
const MAX_GAP_DAYS = 60;

/** A little after midnight, so a slightly fast clock can't ask for a date the
    publisher itself considers to be in the future. */
const AFTER_MIDNIGHT_MS = 5_000;

const puzzleDTag = (date) => `mora-palavra-p:${date}`;
const isoDate = (ms) => new Date(ms).toISOString().slice(0, 10);
const utcToday = () => isoDate(Date.now());

/**
 * Epoch seconds of the midnight that ends `date` — when the puzzle after this
 * one unlocks.
 *
 * Derived from the puzzle day rather than from the clock. Reading `Date.now()`
 * here would make `buildPuzzle` return different bytes for the same date
 * depending on when it ran, which breaks the determinism the backfill relies
 * on, and would give a backfilled archive day the rollover of the day it was
 * published on instead of its own.
 */
function nextPuzzleAtFor(date) {
    return Math.floor(Date.parse(`${date}T00:00:00Z`) / 1000) + 86400;
}

/** Epoch ms of the next 00:00 UTC — when the watch loop should wake. */
function nextWakeMs() {
    const next = new Date();
    next.setUTCHours(24, 0, 0, 0);
    return next.getTime();
}

/** Day zero of the cycle counter. Arbitrary, but fixed forever: moving it
    re-deals every past and future day. */
const EPOCH_MS = Date.UTC(2026, 0, 1);

/**
 * Which verse a given day gets. Deterministic, so any republish of the same
 * date produces byte-identical output — that is what makes backfilling safe.
 *
 * A shuffled cycle rather than `hash(date) % pool`. Hashing straight to an
 * index looks fine and isn't: it's the birthday problem — measured against
 * this pool it repeated a verse on 140 days of a 365-day year while never
 * showing a large share of them at all.
 *
 * The cycle is counted from a fixed epoch, not per calendar year, and **each
 * complete pass through the pool is reshuffled** — the seed is the cycle
 * number. Tying it to the year instead would leave the tail of every
 * permutation unreached (the pool doesn't divide into 365 days) and would restart
 * the same walk each January. This way every verse is used exactly once per
 * cycle, and the next cycle deals a different order.
 */
function verseForDate(date) {
    const n = VERSES.length;
    const dayIndex = Math.floor((Date.parse(`${date}T00:00:00Z`) - EPOCH_MS) / 86400000);
    // Floor division and a non-negative remainder, so dates before the epoch
    // (a deep backfill) land somewhere sensible rather than off the array.
    const cycle = Math.floor(dayIndex / n);
    const position = ((dayIndex % n) + n) % n;
    return VERSES[shuffledOrder(cycle, n)[position]];
}

const orderCache = new Map();

/** A stable permutation of 0..n-1 for one pass through the pool. */
function shuffledOrder(cycle, n) {
    const key = `${cycle}:${n}`;
    const cached = orderCache.get(key);
    if (cached) return cached;

    // Fisher-Yates driven by a hash chain, so it needs no PRNG library and is
    // reproducible anywhere the same seed is used.
    const order = Array.from({ length: n }, (_, i) => i);
    let digest = sha256(utf8ToBytes(`mora-palavra-order:${cycle}`));
    let at = 0;
    const nextByte = () => {
        if (at >= digest.length) { digest = sha256(digest); at = 0; }
        return digest[at++];
    };
    for (let i = n - 1; i > 0; i--) {
        // Two bytes, rejection-free enough for shuffling a few hundred items.
        const r = ((nextByte() << 8) | nextByte()) % (i + 1);
        [order[i], order[r]] = [order[r], order[i]];
    }
    orderCache.set(key, order);
    return order;
}

export function buildPuzzle(date) {
    const { ref, full, verse, answer } = verseForDate(date);
    return {
        date,
        ref,
        // The whole verse, for the app to show once the game is over. Carried
        // rather than linked: the translation lives here, so sending a few
        // hundred bytes means the passage reads in the app and offline.
        full,
        verse,
        length: normalizeWord(answer).length,
        answerHash: answerHash(date, answer),
        answerCipher: obfuscateAnswer(date, answer),
        nextPuzzleAt: nextPuzzleAtFor(date),
    };
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
        // nip19.decode throws on anything that isn't valid bech32, and a typo
        // in an env file is the likeliest way to get here.
        console.error('PALAVRA_NSEC is not a valid nsec. Run `npm run keygen`.');
        process.exit(1);
    }
    if (decoded.type !== 'nsec') {
        console.error('PALAVRA_NSEC is not an nsec.');
        process.exit(1);
    }
    return decoded.data;
}

/** Which puzzle dates this publisher already has on a relay. */
function publishedDatesOn(url, pubkey, since) {
    return new Promise((resolve) => {
        const found = new Set();
        let settled = false;
        const finish = () => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            try { socket.close(); } catch { /* already closing */ }
            resolve(found);
        };
        const socket = new WebSocket(url);
        const timer = setTimeout(finish, RELAY_TIMEOUT_MS);
        socket.on('open', () => socket.send(JSON.stringify(
            ['REQ', 'gap', { kinds: [KIND], authors: [pubkey], '#t': ['morapalavra'], since, limit: 500 }],
        )));
        socket.on('message', (raw) => {
            try {
                const msg = JSON.parse(raw.toString());
                if (msg[0] === 'EVENT') {
                    const date = msg[2]?.tags?.find((t) => t[0] === 'date')?.[1];
                    if (date) found.add(date);
                }
                if (msg[0] === 'EOSE') finish();
            } catch { /* not for us */ }
        });
        socket.on('error', finish);
        socket.on('close', finish);
    });
}

/** Union across relays: a day published anywhere counts as published. */
async function publishedDates(pubkey, sinceDays) {
    const since = Math.floor((Date.now() - sinceDays * 86400000) / 1000);
    const sets = await Promise.all(RELAYS.map((url) => publishedDatesOn(url, pubkey, since)));
    const all = new Set();
    for (const set of sets) for (const d of set) all.add(d);
    return all;
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

async function publish(date, secretKey) {
    const puzzle = buildPuzzle(date);
    const event = finalizeEvent({
        kind: KIND,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
            ['d', puzzleDTag(date)],
            ['date', date],
            ['t', 'morapalavra'],
            ['client', 'mora-palavra'],
        ],
        content: JSON.stringify(puzzle),
    }, secretKey);

    const results = await Promise.all(RELAYS.map((url) => sendTo(url, event)));
    const accepted = results.filter(Boolean).length;
    console.log(`${date}  ${puzzle.ref.padEnd(20)} ${puzzle.length} letras  → ${accepted}/${RELAYS.length} relays`);
    // One relay is enough for the puzzle to exist; zero is a failed day.
    return accepted > 0;
}

/**
 * Publish every day that is missing, oldest first.
 *
 * The gap is worked out from the relays rather than from any local record, so
 * a machine that was rebuilt, restored, or simply off for a week catches up on
 * its own — and a second publisher running elsewhere doesn't double-post.
 */
async function fillGap(secretKey, pubkey, days = MAX_GAP_DAYS) {
    const already = await publishedDates(pubkey, days);
    const wanted = Array.from({ length: days }, (_, i) => isoDate(Date.now() - i * 86400000)).reverse();
    const missing = wanted.filter((date) => !already.has(date));

    if (missing.length === 0) {
        console.log(`nothing missing in the last ${days} days (latest: ${[...already].sort().pop() ?? 'none'})`);
        return true;
    }
    console.log(`${missing.length} day(s) missing — publishing oldest first`);
    let ok = true;
    for (const date of missing) ok = await publish(date, secretKey) && ok;
    return ok;
}

// ── Entry point ──────────────────────────────────────────────────────────

async function main() {
    const args = process.argv.slice(2);
    const secretKey = loadSecretKey();
    const pubkey = getPublicKey(secretKey);
    console.log(`publisher ${pubkey}`);
    console.log(`relays    ${RELAYS.join(', ')}\n`);

    if (args.includes('--watch')) {
        // Self-scheduling: no cron, no timezone confusion in a crontab, and the
        // gap check on every wake means a missed or slept-through cycle heals
        // itself rather than leaving a day with no puzzle.
        console.log('watch mode — publishing on each 00:00 UTC rollover\n');
        for (;;) {
            try {
                await fillGap(secretKey, pubkey);
            } catch (error) {
                // Never let a bad night kill the process: the next wake retries,
                // and the gap check will still see the day as missing.
                console.error('publish cycle failed:', error?.message ?? error);
            }
            // Recomputed from the clock every time rather than accumulated, so
            // drift and suspend-resume can't walk the schedule off midnight.
            const wakeAt = nextWakeMs() + AFTER_MIDNIGHT_MS;
            console.log(`next run ${new Date(wakeAt).toISOString()}\n`);
            await new Promise((resolve) => setTimeout(resolve, Math.max(1000, wakeAt - Date.now())));
        }
    }

    const backfillAt = args.indexOf('--backfill');
    let failed = false;

    if (backfillAt !== -1) {
        const days = Number(args[backfillAt + 1] ?? 7);
        if (!Number.isInteger(days) || days < 1 || days > MAX_GAP_DAYS) {
            console.error(`--backfill needs a whole number of days, 1 to ${MAX_GAP_DAYS}.`);
            process.exit(1);
        }
        failed = !await fillGap(secretKey, pubkey, days);
    } else {
        const date = args.find((a) => !a.startsWith('--')) ?? utcToday();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            console.error(`"${date}" is not YYYY-MM-DD`);
            process.exit(1);
        }
        // The shape check passes 2026-02-30, and Date.parse does *not* reject
        // it — V8 rolls it forward to March 2. Left alone the publisher
        // signs a puzzle under a date that does not exist and that no client
        // will ever ask for. Round-tripping through the formatter is the only
        // check that catches it.
        const parsed = Date.parse(`${date}T00:00:00Z`);
        if (Number.isNaN(parsed) || isoDate(parsed) !== date) {
            console.error(`"${date}" is not a real date`);
            process.exit(1);
        }
        if (date > utcToday()) {
            // Publishing ahead would put tomorrow's answer on a public relay today.
            console.error(`${date} is in the future`);
            process.exit(1);
        }
        failed = !await publish(date, secretKey);
    }

    process.exit(failed ? 1 : 0);
}

// Guarded, so importing this module doesn't run the CLI. `buildPuzzle` is
// exported to be checked from elsewhere, and unguarded top-level code meant
// merely importing it demanded PALAVRA_NSEC and then exited the process —
// which made the determinism the backfill depends on impossible to assert.
// process.argv[1] is undefined under `node -e`, where pathToFileURL throws.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
