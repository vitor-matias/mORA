/**
 * The shared CORS workaround.
 *
 * Several sources mORA depends on — liturgia.pt's calendar feed, vatican.va —
 * serve no `Access-Control-Allow-Origin`, so a browser can't read them
 * directly and the app has no server of its own to proxy through (it ships as
 * static files on GitHub Pages). The fallback is a chain of public CORS
 * proxies, which are free, unaffiliated and go down without warning.
 *
 * Trying them strictly in order made a single dead route expensive: every
 * request paid that route's full timeout before moving on, so one outage
 * turned into ~30s of blank UI even though a working proxy sat two entries
 * down the list. Instead the routes are *hedged* — a route that hasn't
 * answered within HEDGE_DELAY_MS doesn't block the next one from starting,
 * and the first usable body wins. A dead proxy then costs a couple of seconds
 * once, not the whole load, and the route that answered is remembered so the
 * next call starts with it.
 */

const DEFAULT_TIMEOUT_MS = 8000;

/** How long a route gets to itself before the next one is started alongside. */
const HEDGE_DELAY_MS = 2500;

const LAST_GOOD_KEY = 'mora_cors_proxy_last_good';

interface ProxyRoute {
    id: string;
    build: (targetUrl: string) => string;
}

/**
 * Every entry percent-encodes the target: an un-encoded URL is fine only
 * until the target grows a query string of its own, at which point the
 * proxy swallows everything after the first `&`.
 */
const PROXY_ROUTES: ProxyRoute[] = [
    {
        id: 'codetabs',
        build: (u) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(u)}`,
    },
    {
        id: 'allorigins',
        build: (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    },
    {
        id: 'corsproxy',
        build: (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
    },
];

function readLastGoodRouteId(): string | null {
    try {
        return localStorage.getItem(LAST_GOOD_KEY);
    } catch {
        return null; // storage blocked (private browsing) — order stays default
    }
}

function rememberRoute(id: string | null): void {
    if (!id) return;
    try {
        localStorage.setItem(LAST_GOOD_KEY, id);
    } catch {
        // ignore storage access errors
    }
}

/** The proxy chain, with whichever route last worked moved to the front. */
function orderedRoutes(): ProxyRoute[] {
    const lastGood = readLastGoodRouteId();
    if (!lastGood) return PROXY_ROUTES;
    const preferred = PROXY_ROUTES.filter((r) => r.id === lastGood);
    return preferred.length ? [...preferred, ...PROXY_ROUTES.filter((r) => r.id !== lastGood)] : PROXY_ROUTES;
}

export interface CorsProxyOptions {
    /**
     * Routes to try ahead of the public chain — a proxy under our own control
     * (the mORA Worker), which is preferred whenever it is deployed. Not
     * reordered and never remembered: it is already first.
     */
    preferredUrls?: string[];
    /**
     * Decides whether a 200 response is actually the resource. Proxies answer
     * with their own HTML or JSON error pages under a 200, so without this a
     * "success" can be an outage notice — and the chain would stop on it
     * instead of falling through to a route that works.
     */
    validate?: (body: string) => boolean;
    timeoutMs?: number;
    hedgeDelayMs?: number;
}

interface Attempt {
    index: number;
    routeId: string | null;
    text: string | null;
}

/**
 * Fetches `targetUrl` as text through the first route that returns a body
 * `validate` accepts, or null when every route fails.
 */
export async function fetchTextViaCorsProxy(
    targetUrl: string,
    options: CorsProxyOptions = {}
): Promise<string | null> {
    const {
        preferredUrls = [],
        validate = (body: string) => body.length > 0,
        timeoutMs = DEFAULT_TIMEOUT_MS,
        hedgeDelayMs = HEDGE_DELAY_MS,
    } = options;

    const candidates: Array<{ url: string; routeId: string | null }> = [
        ...preferredUrls.map((url) => ({ url, routeId: null })),
        ...orderedRoutes().map((route) => ({ url: route.build(targetUrl), routeId: route.id })),
    ];
    if (candidates.length === 0) return null;

    const controllers: AbortController[] = [];

    const run = async (index: number): Promise<Attempt> => {
        const { url, routeId } = candidates[index];
        const controller = new AbortController();
        controllers[index] = controller;
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, { signal: controller.signal });
            if (!response.ok) return { index, routeId, text: null };
            const body = await response.text();
            return { index, routeId, text: validate(body) ? body : null };
        } catch (e) {
            if (!(e instanceof DOMException && e.name === 'AbortError')) {
                console.warn(`CORS route failed, trying another (${routeId ?? 'own proxy'}):`, e);
            }
            return { index, routeId, text: null };
        } finally {
            clearTimeout(timer);
        }
    };

    const pending = new Map<number, Promise<Attempt>>();
    let next = 0;
    let hedgeTimer: ReturnType<typeof setTimeout> | undefined;

    try {
        while (pending.size > 0 || next < candidates.length) {
            if (next < candidates.length) {
                const index = next++;
                pending.set(index, run(index));
            }

            // Only wait out the hedge delay while there is another route left
            // to start; once the list is exhausted, wait for what's in flight.
            const hedge: Promise<'hedge'> | null = next < candidates.length
                ? new Promise((resolve) => { hedgeTimer = setTimeout(() => resolve('hedge'), hedgeDelayMs); })
                : null;

            const settled = await Promise.race<Attempt | 'hedge'>(
                hedge ? [...pending.values(), hedge] : [...pending.values()]
            );
            clearTimeout(hedgeTimer);

            if (settled === 'hedge') continue; // slow route — start the next one alongside it

            pending.delete(settled.index);
            if (settled.text !== null) {
                rememberRoute(settled.routeId);
                return settled.text;
            }
        }
        return null;
    } finally {
        clearTimeout(hedgeTimer);
        for (const controller of controllers) controller?.abort();
    }
}

/**
 * Normalises a configured proxy base into a route for `path`, or null when
 * nothing usable is configured. A blank-but-present environment variable and
 * a trailing slash are both real deployment mistakes: the first would build a
 * same-origin `/ics` that GitHub Pages answers with the SPA shell, the second
 * a `//ics` that the Worker 404s.
 */
export function ownProxyRoute(baseUrl: string | undefined, path: string): string | null {
    const base = baseUrl?.trim().replace(/\/+$/, '');
    if (!base || !/^https?:\/\//i.test(base)) return null;
    return `${base}${path}`;
}
