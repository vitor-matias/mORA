// Where the day's puzzle comes from.
//
// There is no server. A cron publishes each day's puzzle to Nostr at 00:00 UTC
// (server/palavra/publish.js) as an addressable event, and this reads it back.
// The app was already a Nostr client for everything social, so putting the
// puzzle on the same transport removes an entire moving part: no uptime to
// maintain, no CORS, no rate limiting — and the archive is free, because every
// past day is still an event on the relays.
//
// The one thing that has to be trusted is *who published it*. Anyone can write
// an event claiming to be today's puzzle, so the publisher's pubkey is pinned
// and everything else is ignored. That pin is the whole security model here.
//
// With VITE_PALAVRA_PUBLISHER_PUBKEY unset the module falls through to ./mock,
// so the game is playable with no setup at all.

import type { NostrEvent } from '@nostrify/nostrify';
import { verifyEvent } from 'nostr-tools/pure';
import { pool } from '@/lib/pool';
import { RELAY_QUERY_TIMEOUT_MS } from '@/lib/nostr';
import { usePalavraStore } from '@/store/palavra';
import {
    MAX_WORD_LENGTH,
    MIN_WORD_LENGTH,
    BLANK_MARKER,
    type DailyChallenge,
} from './types';

/** NIP-78 application data, addressable — one puzzle event per day. */
const KIND_PUZZLE = 30078;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const HEX64_RE = /^[0-9a-f]{64}$/i;

const CONFIGURED_PUBLISHER = (import.meta.env.VITE_PALAVRA_PUBLISHER_PUBKEY as string | undefined)?.trim() ?? '';

// An npub or a truncated key is the easy mistake here, and left unchecked it
// fails in the worst way: the pin never matches, so every single day looks
// like "no puzzle published" with nothing to point at. Falling back to the
// mock at least keeps the game playable and says on screen that it's a demo.
const PUBLISHER = !CONFIGURED_PUBLISHER || HEX64_RE.test(CONFIGURED_PUBLISHER)
    ? CONFIGURED_PUBLISHER.toLowerCase()
    : '';

if (CONFIGURED_PUBLISHER && !PUBLISHER) {
    console.warn(
        'VITE_PALAVRA_PUBLISHER_PUBKEY must be 64 hex characters, not an npub. Falling back to the demo puzzles.',
    );
}

/** True while the game is running against the built-in mock. The UI says so
    rather than passing a demo puzzle off as the real one. */
export const PALAVRA_IS_MOCK = !PUBLISHER;

export function puzzleDTag(date: string): string {
    return `mora-palavra-p:${date}`;
}

// A verse is rendered as text, never as markup, so the cap here is about
// layout rather than safety: a bad payload shouldn't be able to push a
// megabyte of prose into the puzzle card. The pool aims well under this
// (35–110 characters) — the card sits directly above the board, so a long
// verse pushes the keyboard off a laptop screen. This is the outer bound at
// which the page visibly breaks, not the editorial target.
const MAX_VERSE_LENGTH = 220;
const MAX_REF_LENGTH = 80;
const MAX_FULL_LENGTH = 600;

function isNonEmptyString(value: unknown, max: number): value is string {
    return typeof value === 'string' && value.length > 0 && value.length <= max;
}

/** Within the next 48 hours — a global daily can never be further off. */
function isPlausibleRollover(value: unknown): boolean {
    if (typeof value !== 'number' || !Number.isFinite(value)) return false;
    const ms = value * 1000;
    return ms > Date.now() && ms < Date.now() + 48 * 60 * 60 * 1000;
}

/**
 * Accept a puzzle only if every field is usable, and throw otherwise.
 *
 * A half-valid challenge is worse than none: a missing `length` would render
 * a zero-column board, and an `answerCipher` that doesn't match `answerHash`
 * would make the game unwinnable with no visible reason. Better to show the
 * error state than a puzzle that cannot be solved.
 */
export function sanitizeChallenge(raw: unknown, expectedDate: string): DailyChallenge {
    if (!raw || typeof raw !== 'object') throw new Error('Desafio inválido.');
    const input = raw as Record<string, unknown>;

    const { date, ref, full, verse, length, answerHash, answerCipher, nextPuzzleAt } = input;

    if (typeof date !== 'string' || !ISO_DATE_RE.test(date)) throw new Error('Desafio sem data válida.');
    // A challenge for another day would be scored against the wrong cipher —
    // the keystream is derived from the date.
    if (date !== expectedDate) throw new Error('O desafio recebido é de outro dia.');
    if (!isNonEmptyString(ref, MAX_REF_LENGTH)) throw new Error('Desafio sem referência bíblica.');
    if (!isNonEmptyString(verse, MAX_VERSE_LENGTH)) throw new Error('Desafio sem versículo.');
    // At least one. More than one is allowed and is the point: where a verse
    // repeats the hidden word, every occurrence is blanked, so the answer
    // isn't printed beside its own gap. It is what makes João 1,1 — "havia o
    // Verbo; o Verbo estava em Deus; e o Verbo era Deus" — playable at all.
    if (!verse.includes(BLANK_MARKER)) {
        throw new Error('O versículo não marca a palavra escondida.');
    }
    if (!Number.isInteger(length) || (length as number) < MIN_WORD_LENGTH || (length as number) > MAX_WORD_LENGTH) {
        throw new Error('O desafio tem um comprimento de palavra fora do previsto.');
    }
    if (typeof answerHash !== 'string' || !HEX64_RE.test(answerHash)) throw new Error('Desafio sem verificação.');
    if (!isNonEmptyString(answerCipher, 128)) throw new Error('Desafio sem resposta cifrada.');

    return {
        date,
        ref,
        // Rendered as text after the reveal. Dropped rather than trusted if it
        // still carries a blank marker — that would mean the publisher sent
        // the puzzle text here by mistake, and printing "{{blank}}" at the
        // player is worse than printing nothing.
        ...(isNonEmptyString(full, MAX_FULL_LENGTH) && !full.includes(BLANK_MARKER)
            ? { full: full as string }
            : {}),
        verse,
        length: length as number,
        answerHash,
        answerCipher,
        // A rollover in the past would freeze the countdown at "0m"; one far
        // in the future would park it at a number that never moves. Either way
        // the local next-midnight fallback is better than a wrong figure.
        ...(isPlausibleRollover(nextPuzzleAt) ? { nextPuzzleAt: nextPuzzleAt as number } : {}),
    };
}

/**
 * The day's puzzle: cache first, then the relays.
 *
 * Cache-first rather than network-first because a puzzle for a given date
 * never changes — it is an addressable event the publisher writes once — so
 * re-fetching it buys nothing and costs a relay round-trip on every open. It
 * is also what makes the PWA work on a train: the guesses were always
 * persisted, but without this the verse and cipher weren't, so a day already
 * in progress came back as an error card.
 *
 * Only validated puzzles are ever cached, so a cache hit is always playable.
 */
export async function fetchDailyChallenge(date: string): Promise<DailyChallenge> {
    const cached = usePalavraStore.getState().challenges[date];
    if (cached) return cached;

    const challenge = await fetchFreshChallenge(date);
    usePalavraStore.getState().cacheChallenge(challenge);
    return challenge;
}

async function fetchFreshChallenge(date: string): Promise<DailyChallenge> {
    if (PALAVRA_IS_MOCK) {
        const { mockDailyChallenge } = await import('./mock');
        return mockDailyChallenge(date);
    }

    let events: NostrEvent[];
    try {
        events = await pool.query(
            [{ kinds: [KIND_PUZZLE], authors: [PUBLISHER], '#d': [puzzleDTag(date)], limit: 1 }],
            { signal: AbortSignal.timeout(RELAY_QUERY_TIMEOUT_MS) },
        );
    } catch (error) {
        console.warn('Could not reach the relays for the puzzle.', error);
        throw new Error('Não foi possível contactar os relés.');
    }

    // Filtering by `authors` asks the relay nicely; checking the pubkey and
    // the signature here is what actually enforces it. A hostile relay is free
    // to answer with whatever it likes, and the pinned publisher is the only
    // thing standing between that and a forged puzzle.
    const event = events.find((candidate) => candidate.pubkey === PUBLISHER && verifyEvent(candidate));
    if (!event) throw new Error('Ainda não há desafio para este dia.');

    let payload: unknown;
    try {
        payload = JSON.parse(event.content);
    } catch {
        throw new Error('Desafio ilegível.');
    }
    return sanitizeChallenge(payload, date);
}
