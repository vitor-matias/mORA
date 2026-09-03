import { formatISODate } from "@/lib/format";
import { fetchDailyLiturgy } from "@/lib/liturgy";

export interface Intention {
    title: string;
    sourceLabel: string;
    sourceUrl: string;
}

const WPJSON_BASE = 'https://redemundialdeoracaodopapa.pt/wp-json/wp/v2';
const CACHE_PREFIX = 'mora_intention_';
const NETWORK_LABEL = 'Rede Mundial de Oração do Papa';

// The Church's traditional monthly devotions — fixed, the same every year, so
// (unlike the Pope's own intention) there's no live source to fetch this from.
// These vary by country; August/September deliberately follow the
// commonly-cited Brazilian convention (Vocações/Bíblia) rather than the
// Imaculado Coração de Maria/Dores de Maria pairing some Portugal-focused
// sources use for those two months.
const MONTHLY_DEVOTIONS = [
    'Santíssimo Nome de Jesus', 'Sagrada Família', 'São José',
    'Eucaristia e Espírito Santo', 'Imaculado Coração de Maria', 'Sagrado Coração de Jesus',
    'Preciosíssimo Sangue de Cristo', 'Vocações', 'Bíblia',
    'Rosário', 'Almas do Purgatório', 'Advento e Natal',
];

/** The Church's traditional devotion for the current month (e.g. "Vocações" for August). */
export function getMonthlyDevotion(now: Date = new Date()): string {
    return MONTHLY_DEVOTIONS[now.getMonth()];
}

// The Church's traditional devotion for each day of the week — also fixed,
// indexed like Date.getDay() (0 = Sunday).
const WEEKDAY_DEVOTIONS = [
    'A Festa do Senhor',
    'Espírito Santo e Defuntos',
    'Anjos da Guarda',
    'São José',
    'Dia da Eucaristia',
    'A Paixão de Jesus',
    'Virgem Maria',
];

/** The Church's traditional devotion for the current day of the week (e.g. "A Paixão de Jesus" on Fridays). */
export function getWeekdayDevotion(now: Date = new Date()): string {
    return WEEKDAY_DEVOTIONS[now.getDay()];
}

// The WP REST API returns HTML (paragraphs, entities). Block-level tags are
// turned into newlines before handing the markup to the browser's own parser
// for entity decoding — safer and less brittle than a hand-rolled entity map,
// and textContent never executes anything the response contains.
function stripHtml(html: string): string {
    const withBreaks = html
        .replace(/<\/(p|div|li)>/gi, '\n')
        .replace(/<br\s*\/?>/gi, '\n');
    const div = document.createElement('div');
    div.innerHTML = withBreaks;
    return (div.textContent || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .join('\n')
        .trim();
}

function readCache(key: string): Intention | null {
    try {
        const raw = localStorage.getItem(CACHE_PREFIX + key);
        return raw ? (JSON.parse(raw) as Intention) : null;
    } catch {
        return null;
    }
}

function writeCache(key: string, value: Intention): void {
    try {
        localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(value));
        pruneCache();
    } catch {
        // ignore storage errors (private browsing, quota)
    }
}

// A week's cache key is that week's Sunday — usually a past date even while
// the entry is still current — so pruning has to compare each key against
// the still-valid key for its own kind, not just against today's date.
function pruneCache(): void {
    try {
        const now = new Date();
        const validDatePart: Record<string, string> = {
            day: formatISODate(now),
            week: formatISODate(getCurrentWeekSunday(now)),
            month: formatISODate(now).slice(0, 7),
        };
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith(CACHE_PREFIX)) continue;
            const rest = key.slice(CACHE_PREFIX.length);
            const separatorIndex = rest.indexOf('_');
            const kind = rest.slice(0, separatorIndex);
            const datePart = rest.slice(separatorIndex + 1);
            if (datePart !== validDatePart[kind]) localStorage.removeItem(key);
        }
    } catch {
        // ignore storage access errors
    }
}

// vatican.va sends no CORS headers, so it's fetched through the same public
// proxy chain src/lib/liturgy.ts already uses for liturgia.pt's calendar.
const PROXY_TIMEOUT_MS = 8000;

async function fetchTextViaProxy(url: string): Promise<string | null> {
    const candidateUrls = [
        `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(url)}`,
        `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
        `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    ];
    for (const proxyUrl of candidateUrls) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);
        try {
            const response = await fetch(proxyUrl, { signal: controller.signal });
            if (!response.ok) continue;
            const text = await response.text();
            if (text) return text;
        } catch {
            // try the next proxy
        } finally {
            clearTimeout(timer);
        }
    }
    return null;
}

const ITALIAN_MONTHS = [
    'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
    'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
];

/**
 * vatican.va's own short theme for the month (e.g. "Pela evangelização na
 * cidade") — the WP source above only carries the full "Rezemos para que..."
 * paragraph, never this shorter official phrasing. The document URL embeds
 * an unpredictable publish day, so it's discovered from the PT prayers index
 * rather than guessed; the theme itself lives in the document's <title> tag
 * ("Mensagem em vídeo … – Agosto de 2026: Pela evangelização na cidade").
 */
async function fetchVaticanThemeTitle(now: Date): Promise<{ title: string; url: string } | null> {
    const indexUrl = 'https://www.vatican.va/content/leo-xiv/pt/prayers.html';
    const indexHtml = await fetchTextViaProxy(indexUrl);
    if (!indexHtml) return null;

    const italianMonth = ITALIAN_MONTHS[now.getMonth()];
    const linkMatch = indexHtml.match(
        new RegExp(`href="(/content/leo-xiv/pt/prayers/documents/\\d{8}-popesprayer-${italianMonth}\\.html)"`)
    );
    if (!linkMatch) return null;
    const docUrl = `https://www.vatican.va${linkMatch[1]}`;

    const docHtml = await fetchTextViaProxy(docUrl);
    if (!docHtml) return null;
    const titleMatch = docHtml.match(/<title>([^<]*)<\/title>/i);
    if (!titleMatch) return null;

    const fullTitle = stripHtml(titleMatch[1]);
    const segments = fullTitle.split(': ');
    const theme = segments.length > 1 ? segments[segments.length - 1].trim() : fullTitle;
    if (!theme) return null;
    return { title: theme, url: docUrl };
}

async function fetchLatestPost(postType: string): Promise<{ title: string; url: string; monthKey: string; slug: string } | null> {
    const res = await fetch(`${WPJSON_BASE}/${postType}?per_page=1&orderby=date&order=desc`);
    if (!res.ok) return null;
    const items = await res.json();
    const item = items?.[0];
    if (!item) return null;
    const title = stripHtml(item.title?.rendered ?? '');
    if (!title || typeof item.date !== 'string') return null;
    return {
        title,
        url: item.link || 'https://redemundialdeoracaodopapa.pt/',
        monthKey: item.date.slice(0, 7),
        slug: typeof item.slug === 'string' ? item.slug : '',
    };
}

const PORTUGUESE_MONTHS = [
    'janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

/**
 * intencoes_mensais slugs name the month the intention is actually *for*
 * (e.g. "setembro-2026-intencao-do-papa"), unlike the post's own `date` field:
 * the Network routinely publishes a day or more before that month starts, so
 * date-derived month keys lag behind and reject a perfectly valid early post.
 */
function parseMonthKeyFromSlug(slug: string): string | null {
    const match = slug.match(/^([a-z]+)-(\d{4})-/);
    if (!match) return null;
    const monthIndex = PORTUGUESE_MONTHS.indexOf(match[1]);
    if (monthIndex === -1) return null;
    return `${match[2]}-${String(monthIndex + 1).padStart(2, '0')}`;
}

/** The Pope's Prayer Network publishes a new short reflection every calendar day. */
export async function fetchDailyIntention(now: Date = new Date()): Promise<Intention | null> {
    const dateStr = formatISODate(now);
    const cached = readCache(`day_${dateStr}`);
    if (cached) return cached;
    try {
        const post = await fetchLatestPost('meditacao_diaria');
        if (!post) return null;
        const intention: Intention = { title: post.title, sourceLabel: NETWORK_LABEL, sourceUrl: post.url };
        writeCache(`day_${dateStr}`, intention);
        return intention;
    } catch (e) {
        console.warn('Failed to fetch daily intention:', e);
        return null;
    }
}

/** Sunday-starting week, matching the liturgical week's own naming (it takes
 *  its title from the Sunday that opens it). */
function getCurrentWeekSunday(now: Date): Date {
    const sunday = new Date(now);
    sunday.setDate(now.getDate() - now.getDay());
    return sunday;
}

/** No Church body publishes a rotating weekly intention — the closest real,
 *  official content is this week's own Sunday Mass, already served by the
 *  CEP liturgy API this app uses elsewhere (src/lib/liturgy.ts). */
export async function fetchWeeklyIntention(now: Date = new Date()): Promise<Intention | null> {
    const sundayStr = formatISODate(getCurrentWeekSunday(now));
    const cached = readCache(`week_${sundayStr}`);
    if (cached) return cached;
    try {
        const liturgy = await fetchDailyLiturgy(sundayStr);
        if (!liturgy?.saintOfDay) return null;
        const intention: Intention = {
            title: liturgy.saintOfDay,
            sourceLabel: 'Liturgia da Igreja em Portugal',
            sourceUrl: 'https://www.liturgia.pt/',
        };
        writeCache(`week_${sundayStr}`, intention);
        return intention;
    } catch (e) {
        console.warn('Failed to fetch weekly intention:', e);
        return null;
    }
}

/** The Pope's own prayer intention for the month, chosen months in advance. */
export async function fetchMonthlyIntention(now: Date = new Date()): Promise<Intention | null> {
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const cached = readCache(`month_${monthKey}`);
    if (cached) return cached;

    // vatican.va's own short theme is the better title, but it goes through a
    // proxy chain that can be down — the WP source below is CORS-open and
    // reliable, so it's the fallback when the scrape doesn't pan out.
    try {
        const vatican = await fetchVaticanThemeTitle(now);
        if (vatican) {
            const intention: Intention = { title: vatican.title, sourceLabel: 'Vaticano', sourceUrl: vatican.url };
            writeCache(`month_${monthKey}`, intention);
            return intention;
        }
    } catch (e) {
        console.warn('Failed to fetch Vatican theme title, falling back to WP source:', e);
    }

    try {
        const post = await fetchLatestPost('intencoes_mensais');
        // "Latest" isn't necessarily *this* month — the Network sometimes
        // publishes a few days before that month starts (so its `date` still
        // reads as last month) or a fetch right after rollover can still see
        // last month's post. The slug names the actual target month, which is
        // what the post's own date can't be trusted for; fall back to the
        // date-derived key only if the slug doesn't parse. Caching a
        // mismatched title under this month's key would keep showing the
        // wrong intention for the rest of the month.
        const postMonthKey = (post && parseMonthKeyFromSlug(post.slug)) || post?.monthKey;
        if (!post || postMonthKey !== monthKey) return null;
        const intention: Intention = {
            title: post.title,
            sourceLabel: NETWORK_LABEL,
            sourceUrl: post.url,
        };
        writeCache(`month_${monthKey}`, intention);
        return intention;
    } catch (e) {
        console.warn('Failed to fetch monthly intention:', e);
        return null;
    }
}
