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
import { PUBLISHER_PUBKEY } from '@/lib/publisher';
import { parseDaySections } from '@/lib/icsCalendar';
import type { DaySection, LiturgicalColor, LiturgicalDayInfo } from '@/lib/icsCalendar';

/** NIP-78 application data, addressable — one event per day. */
const KIND_AGENDA = 30078;

const COLORS: LiturgicalColor[] = ['verde', 'roxo', 'vermelho', 'branco', 'rosa'];

// The same pin the puzzle reads — one identity signs everything mORA
// publishes, resolved once in src/lib/publisher.ts.
const AGENDA_PUBLISHER = PUBLISHER_PUBKEY;

const dayDTag = (date: string) => `mora-agenda:${date}`;
const themeDTag = (month: string) => `mora-vatican-theme:${month}`;

const SECTION_KINDS = ['celebration', 'office', 'mass', 'readings', 'notes', 'text'];

const isStringList = (value: unknown): value is string[] =>
    Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'string');

/**
 * One section, or null if it is not one. Every field the renderer reads is
 * checked here, because a section that is half a section would reach the
 * screen as a blank row rather than as the absent day it really is.
 */
function asSection(value: unknown): DaySection | null {
    if (!value || typeof value !== 'object') return null;
    const s = value as Record<string, unknown>;
    if (typeof s.kind !== 'string' || !SECTION_KINDS.includes(s.kind)) return null;

    if (s.kind === 'notes') return isStringList(s.items) ? { kind: 'notes', items: s.items } : null;
    if (s.kind === 'readings') {
        if (!Array.isArray(s.items) || s.items.length === 0) return null;
        const items: { label?: string; ref: string }[] = [];
        for (const item of s.items) {
            if (!item || typeof item !== 'object') return null;
            const { label, ref } = item as Record<string, unknown>;
            if (typeof ref !== 'string') return null;
            if (label !== undefined && typeof label !== 'string') return null;
            items.push(label === undefined ? { ref } : { label, ref });
        }
        return { kind: 'readings', items };
    }

    if (typeof s.text !== 'string') return null;
    if (s.kind === 'celebration') {
        if (s.rank !== undefined && typeof s.rank !== 'string') return null;
        return s.rank === undefined
            ? { kind: 'celebration', text: s.text }
            : { kind: 'celebration', text: s.text, rank: s.rank };
    }
    if (s.kind === 'office') {
        if (s.colors !== undefined && typeof s.colors !== 'string') return null;
        return s.colors === undefined
            ? { kind: 'office', text: s.text }
            : { kind: 'office', text: s.text, colors: s.colors };
    }
    return { kind: s.kind as 'mass' | 'text', text: s.text };
}

/**
 * The classified description, or undefined so the caller parses it itself.
 *
 * Undefined rather than null on anything doubtful: `description` is published
 * beside the sections and the same parser that produced them reads it, so a
 * day whose sections don't survive this check still renders — it costs a
 * parse, not the day. Dropping the day over its formatting would be worse.
 */
function asSections(value: unknown): DaySection[] | undefined {
    if (!Array.isArray(value) || value.length === 0) return undefined;
    const sections: DaySection[] = [];
    for (const raw of value) {
        const section = asSection(raw);
        if (!section) return undefined;
        sections.push(section);
    }
    return sections;
}

/** Relays hand back whatever they like; only a well-formed day is a day. */
function asDayInfo(content: string): LiturgicalDayInfo | null {
    try {
        const parsed = JSON.parse(content) as Partial<LiturgicalDayInfo>;
        if (!parsed || typeof parsed !== 'object') return null;
        if (!COLORS.includes(parsed.color as LiturgicalColor)) return null;
        if (typeof parsed.dayName !== 'string' || typeof parsed.description !== 'string') return null;
        return {
            color: parsed.color as LiturgicalColor,
            dayName: parsed.dayName,
            description: parsed.description,
            // Events published before sections existed carry none. They are
            // addressable, so they are replaced on the publisher's next run;
            // until then the app parses them the same way the publisher will,
            // rather than keeping a second way of reading a day around.
            sections: asSections(parsed.sections) ?? parseDaySections(parsed.description),
        };
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
