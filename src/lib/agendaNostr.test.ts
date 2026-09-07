import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';

// Everything here arrives from a relay, which will hand back whatever it is
// given. The publisher's signature is checked by the pool, but these tests
// pin down the layer after that: what the app agrees to *render*. A day with
// a junk colour, or a theme linking somewhere other than vatican.va, has to
// read as "nothing published" rather than reaching the screen.

const query = vi.fn();
vi.mock('@/lib/pool', () => ({ pool: { query: (...args: unknown[]) => query(...args) } }));

const PUBLISHER = 'a'.repeat(64);
vi.stubEnv('VITE_PALAVRA_PUBLISHER_PUBKEY', PUBLISHER);

const { fetchAgendaDays, fetchVaticanTheme, resolvePublisher } = await import('./agendaNostr');

const event = (dTag: string, content: string, extraTag: string[]): NostrEvent => ({
    id: '0'.repeat(64),
    created_at: 1,
    pubkey: PUBLISHER,
    kind: 30078,
    tags: [['d', dTag], ['t', 'moraagenda'], extraTag],
    content,
    sig: '0'.repeat(128),
});

const day = (date: string, content: string) => event(`mora-agenda:${date}`, content, ['date', date]);
const theme = (month: string, content: string) => event(`mora-vatican-theme:${month}`, content, ['month', month]);

beforeEach(() => query.mockReset());

describe('resolvePublisher', () => {
    it('pins the configured key', () => {
        const key = 'B'.repeat(64);
        expect(resolvePublisher(key)).toBe(key.toLowerCase());
        expect(resolvePublisher(`  ${key}  `)).toBe(key.toLowerCase());
    });

    it('refuses an npub rather than pinning something that can never match', () => {
        expect(resolvePublisher('npub1abcdef')).toBe('');
    });

    it('is empty when nothing is configured', () => {
        expect(resolvePublisher(undefined)).toBe('');
        expect(resolvePublisher('')).toBe('');
    });
});

describe('fetchAgendaDays', () => {
    it('returns the published day', async () => {
        query.mockResolvedValue([day('2026-05-28', JSON.stringify({
            color: 'verde', dayName: 'Quinta-feira', description: 'Ofício da féria.',
        }))]);
        const days = await fetchAgendaDays(['2026-05-28']);
        expect(days.get('2026-05-28')).toEqual({
            color: 'verde', dayName: 'Quinta-feira', description: 'Ofício da féria.',
        });
    });

    it('ignores a day whose colour is not a liturgical colour', async () => {
        query.mockResolvedValue([day('2026-05-28', JSON.stringify({
            color: 'chartreuse', dayName: 'Quinta-feira', description: '',
        }))]);
        expect((await fetchAgendaDays(['2026-05-28'])).size).toBe(0);
    });

    it('ignores content that is not JSON at all', async () => {
        query.mockResolvedValue([day('2026-05-28', 'not json')]);
        expect((await fetchAgendaDays(['2026-05-28'])).size).toBe(0);
    });

    it('ignores an event for a date that was never asked for', async () => {
        // A relay answering a filter with something else entirely shouldn't
        // be able to write over a day the caller is showing.
        query.mockResolvedValue([day('2026-12-25', JSON.stringify({
            color: 'branco', dayName: 'Natal', description: '',
        }))]);
        expect((await fetchAgendaDays(['2026-05-28'])).size).toBe(0);
    });

    it('asks for nothing when there are no dates', async () => {
        expect((await fetchAgendaDays([])).size).toBe(0);
        expect(query).not.toHaveBeenCalled();
    });
});

describe('fetchVaticanTheme', () => {
    it('returns a theme that points at vatican.va', async () => {
        const url = 'https://www.vatican.va/content/leo-xiv/pt/prayers/documents/20260901-popesprayer-settembre.html';
        query.mockResolvedValue([theme('2026-09', JSON.stringify({ title: 'Setembro: Pelo cuidado com a água', url }))]);
        expect(await fetchVaticanTheme('2026-09')).toEqual({ title: 'Setembro: Pelo cuidado com a água', url });
    });

    it('refuses a theme linking anywhere else', async () => {
        query.mockResolvedValue([theme('2026-09', JSON.stringify({
            title: 'Setembro: Pelo cuidado com a água',
            url: 'https://example.com/phish',
        }))]);
        expect(await fetchVaticanTheme('2026-09')).toBeNull();
    });

    it('returns null when nothing is published for the month', async () => {
        query.mockResolvedValue([]);
        expect(await fetchVaticanTheme('2026-09')).toBeNull();
    });
});
