import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchTextViaCorsProxy, ownProxyRoute } from './corsProxy';

const CALENDAR = 'BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART;VALUE=DATE:20260906\nEND:VEVENT';
const isCalendar = (body: string) => body.includes('BEGIN:VEVENT');

/** Minimal localStorage stand-in — the module remembers the winning route. */
function installStorage() {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
    });
    return store;
}

const ok = (body: string) => ({ ok: true, text: async () => body });
const status = (code: number) => ({ ok: false, status: code, text: async () => '' });

beforeEach(() => {
    installStorage();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('fetchTextViaCorsProxy', () => {
    it('returns the body from the first route that works', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ok(CALENDAR)));
        await expect(fetchTextViaCorsProxy('https://example.test/a.ics', { validate: isCalendar }))
            .resolves.toBe(CALENDAR);
    });

    it('falls through when a proxy 403s (the corsproxy.io failure mode)', async () => {
        const fetchMock = vi.fn(async (url: string) =>
            url.includes('codetabs') ? status(403) : ok(CALENDAR)
        );
        vi.stubGlobal('fetch', fetchMock);
        await expect(fetchTextViaCorsProxy('https://example.test/a.ics', { validate: isCalendar }))
            .resolves.toBe(CALENDAR);
    });

    it('rejects a 200 that is the proxy\'s own error page, not the resource', async () => {
        const fetchMock = vi.fn(async (url: string) =>
            url.includes('codetabs') ? ok('<html>rate limit exceeded</html>') : ok(CALENDAR)
        );
        vi.stubGlobal('fetch', fetchMock);
        // Without body validation the chain would stop on the 200 above.
        await expect(fetchTextViaCorsProxy('https://example.test/a.ics', { validate: isCalendar }))
            .resolves.toBe(CALENDAR);
    });

    it('returns null when every route fails', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => status(502)));
        await expect(fetchTextViaCorsProxy('https://example.test/a.ics', { validate: isCalendar }))
            .resolves.toBeNull();
    });

    it('tries the preferred route before any public proxy', async () => {
        const seen: string[] = [];
        vi.stubGlobal('fetch', vi.fn(async (url: string) => {
            seen.push(url);
            return ok(CALENDAR);
        }));
        await fetchTextViaCorsProxy('https://example.test/a.ics', {
            preferredUrls: ['https://worker.test/ics'],
            validate: isCalendar,
        });
        expect(seen[0]).toBe('https://worker.test/ics');
    });

    it('percent-encodes the target so a query string survives the proxy', async () => {
        const seen: string[] = [];
        vi.stubGlobal('fetch', vi.fn(async (url: string) => {
            seen.push(url);
            return ok(CALENDAR);
        }));
        await fetchTextViaCorsProxy('https://example.test/a?x=1&y=2', { validate: isCalendar });
        expect(seen[0]).not.toContain('&y=2');
        expect(seen[0]).toContain(encodeURIComponent('https://example.test/a?x=1&y=2'));
    });

    it('does not wait out a hung route before starting the next one', async () => {
        vi.useFakeTimers();
        try {
            const fetchMock = vi.fn(async (url: string) => {
                // First route never settles; the timeout is far longer than the hedge.
                if (url.includes('codetabs')) return await new Promise<never>(() => {});
                return ok(CALENDAR);
            });
            vi.stubGlobal('fetch', fetchMock);
            const pending = fetchTextViaCorsProxy('https://example.test/a.ics', {
                validate: isCalendar,
                timeoutMs: 60_000,
                hedgeDelayMs: 100,
            });
            await vi.advanceTimersByTimeAsync(150);
            await expect(pending).resolves.toBe(CALENDAR);
            expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
        } finally {
            vi.useRealTimers();
        }
    });

    it('starts with the route that worked last time', async () => {
        vi.stubGlobal('fetch', vi.fn(async (url: string) =>
            url.includes('allorigins') ? ok(CALENDAR) : status(502)
        ));
        await fetchTextViaCorsProxy('https://example.test/a.ics', { validate: isCalendar });

        const seen: string[] = [];
        vi.stubGlobal('fetch', vi.fn(async (url: string) => {
            seen.push(url);
            return ok(CALENDAR);
        }));
        await fetchTextViaCorsProxy('https://example.test/b.ics', { validate: isCalendar });
        expect(seen[0]).toContain('allorigins');
    });
});

describe('ownProxyRoute', () => {
    it('builds a route from a configured base', () => {
        expect(ownProxyRoute('https://w.test', '/ics')).toBe('https://w.test/ics');
    });

    it('strips a trailing slash rather than emitting a double one', () => {
        expect(ownProxyRoute('https://w.test/', '/ics')).toBe('https://w.test/ics');
    });

    it('ignores an unset, blank or non-absolute base', () => {
        // A blank-but-present env var used to build a same-origin "/ics",
        // which GitHub Pages answers with the SPA shell.
        expect(ownProxyRoute(undefined, '/ics')).toBeNull();
        expect(ownProxyRoute('   ', '/ics')).toBeNull();
        expect(ownProxyRoute('w.test', '/ics')).toBeNull();
    });
});
