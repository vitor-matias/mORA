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

const { fetchAgendaDays, fetchVaticanTheme } = await import('./agendaNostr');

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

describe('fetchAgendaDays', () => {
    it('returns the published day', async () => {
        query.mockResolvedValue([day('2026-05-28', JSON.stringify({
            color: 'verde', dayName: 'Quinta-feira', description: 'Ofício da féria.',
        }))]);
        const days = await fetchAgendaDays(['2026-05-28']);
        expect(days.get('2026-05-28')).toEqual({
            color: 'verde',
            dayName: 'Quinta-feira',
            description: 'Ofício da féria.',
            // Published before sections existed, so they are parsed here.
            sections: [{ kind: 'office', text: 'Ofício da féria.' }],
        });
    });

    it('returns the sections the publisher classified', async () => {
        const sections = [
            { kind: 'celebration', text: 'S. Matias, apóstolo', rank: 'FESTA' },
            { kind: 'office', text: 'Ofício da festa.', colors: 'Vermelho' },
            { kind: 'readings', items: [{ label: 'Ev', ref: 'Jo 15, 9-17' }, { ref: 'ou Jo 15, 1-8' }] },
            { kind: 'notes', items: ['Proibidas as Missas de defuntos.'] },
        ];
        query.mockResolvedValue([day('2026-05-14', JSON.stringify({
            color: 'vermelho', dayName: 'Quinta-feira', description: 'S. Matias, apóstolo – FESTA', sections,
        }))]);
        expect((await fetchAgendaDays(['2026-05-14'])).get('2026-05-14')?.sections).toEqual(sections);
    });

    it('falls back to the prose when the published sections are malformed', async () => {
        // The description is published beside them, and the same parser the
        // publisher ran reads it — so a day is never dropped, or blanked, over
        // the formatting half of it.
        const day2026 = (sections: unknown) => day('2026-05-28', JSON.stringify({
            color: 'verde', dayName: 'Quinta-feira', description: 'Ofício da féria.', sections,
        }));
        for (const sections of [
            'not an array',
            [{ kind: 'sermon', text: 'unknown kind' }],
            [{ kind: 'mass' }],
            [{ kind: 'readings', items: [{ label: 'L 1' }] }],
            [{ kind: 'notes', items: [{ not: 'a string' }] }],
            [{ kind: 'celebration', text: 'Dia', rank: 7 }],
        ]) {
            query.mockResolvedValue([day2026(sections)]);
            const info = (await fetchAgendaDays(['2026-05-28'])).get('2026-05-28');
            expect(info?.description).toBe('Ofício da féria.');
            expect(info?.sections).toEqual([{ kind: 'office', text: 'Ofício da féria.' }]);
        }
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
