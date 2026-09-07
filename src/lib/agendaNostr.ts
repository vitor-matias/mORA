// The liturgical calendar, read from Nostr.
//
// liturgia.pt and vatican.va both serve their feeds without CORS headers, so
// a browser cannot read them directly. This app used to go through public
// CORS proxies and every one of them eventually died, went key-only, or
// started answering 200 with its own error page in the body — which left the
// calendar silently blank.
//
// Relays are the way out: WebSocket, so CORS never applies, and the app
// already talks to them. A GitHub Action (server/agenda) fetches the feeds
// server-side and mirrors them here, one addressable event per day.

import { pool } from '@/lib/pool';
import { RELAY_QUERY_TIMEOUT_MS } from '@/lib/nostr';
import type { LiturgicalColor, LiturgicalDayInfo } from '@/lib/icsCalendar';

/** NIP-78 application data, addressable — one event per day. */
const KIND_AGENDA = 30078;

const HEX64_RE = /^[0-9a-f]{64}$/i;
const COLORS: LiturgicalColor[] = ['verde', 'roxo', 'vermelho', 'branco', 'rosa'];

/**
 * Which key's calendar is *the* calendar: the same identity that signs
 * Palavra, because one key signs everything mORA publishes. The two feeds are
 * told apart by their `d` and `t` tags, never by who signed them, so a second
 * identity would buy nothing but a second secret to set up and rotate.
 *
 * Read from the environment here rather than imported from
 * src/lib/palavra/api.ts, which exports the same pin: that module pulls in the
 * game store and the puzzle logic behind it, and the liturgical colour is
 * rendered by Layout on every page.
 */
export function resolvePublisher(configured: string | undefined): string {
    const pubkey = configured?.trim() ?? '';
    // An npub or a truncated key is the easy mistake, and unchecked it fails
    // in the worst way: the pin never matches, so every day looks like
    // "nothing published" with nothing on screen to point at.
    if (pubkey && !HEX64_RE.test(pubkey)) {
        console.warn('VITE_PALAVRA_PUBLISHER_PUBKEY must be 64 hex characters, not an npub.');
        return '';
    }
    return pubkey.toLowerCase();
}

export const AGENDA_PUBLISHER = resolvePublisher(
    import.meta.env.VITE_PALAVRA_PUBLISHER_PUBKEY as string | undefined,
);

const dayDTag = (date: string) => `mora-agenda:${date}`;
const themeDTag = (month: string) => `mora-vatican-theme:${month}`;

/** Relays hand back whatever they like; only a well-formed day is a day. */
function asDayInfo(content: string): LiturgicalDayInfo | null {
    try {
        const parsed = JSON.parse(content) as Partial<LiturgicalDayInfo>;
        if (!parsed || typeof parsed !== 'object') return null;
        if (!COLORS.includes(parsed.color as LiturgicalColor)) return null;
        if (typeof parsed.dayName !== 'string' || typeof parsed.description !== 'string') return null;
        return { color: parsed.color as LiturgicalColor, dayName: parsed.dayName, description: parsed.description };
    } catch {
        return null;
    }
}

/**
 * The published entry for each of `dates` (YYYY-MM-DD).
 *
 * One query for all of them: a month of the directory is a single REQ with
 * its dates in one `#d` filter, not a round trip per cell. Days nobody has
 * published are simply absent from the result.
 */
export async function fetchAgendaDays(dates: string[]): Promise<Map<string, LiturgicalDayInfo>> {
    const found = new Map<string, LiturgicalDayInfo>();
    if (!AGENDA_PUBLISHER || dates.length === 0) return found;

    const wanted = [...new Set(dates)];
    const events = await pool.query(
        [{
            kinds: [KIND_AGENDA],
            authors: [AGENDA_PUBLISHER],
            '#d': wanted.map(dayDTag),
            limit: wanted.length,
        }],
        { signal: AbortSignal.timeout(RELAY_QUERY_TIMEOUT_MS) },
    );

    for (const event of events) {
        const date = event.tags.find((t) => t[0] === 'date')?.[1];
        if (!date || !wanted.includes(date)) continue;
        const info = asDayInfo(event.content);
        if (info) found.set(date, info);
    }
    return found;
}

/** vatican.va's own short theme for the month, as the publisher scraped it. */
export async function fetchVaticanTheme(month: string): Promise<{ title: string; url: string } | null> {
    if (!AGENDA_PUBLISHER) return null;

    const events = await pool.query(
        [{ kinds: [KIND_AGENDA], authors: [AGENDA_PUBLISHER], '#d': [themeDTag(month)], limit: 1 }],
        { signal: AbortSignal.timeout(RELAY_QUERY_TIMEOUT_MS) },
    );

    const event = events[0];
    if (!event) return null;
    try {
        const parsed = JSON.parse(event.content) as { title?: unknown; url?: unknown };
        if (typeof parsed.title !== 'string' || typeof parsed.url !== 'string') return null;
        // vatican.va is the only place this may point. The content is signed
        // by our own publisher, but a bug there shouldn't be able to turn the
        // card into a link to somewhere else entirely.
        if (!parsed.title || !parsed.url.startsWith('https://www.vatican.va/')) return null;
        return { title: parsed.title, url: parsed.url };
    } catch {
        return null;
    }
}
