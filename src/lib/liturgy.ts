export interface LiturgyHourVerse {
    id: string;
    text: string;
    audio_url: string | null;
    order: number;
}

export interface LiturgyHourPart {
    title: string;
    order: number;
    verses: LiturgyHourVerse[];
}

export interface LiturgyMemory {
    date: string;
    title: string;
    type: string;
    week_name: string | null;
    parts: LiturgyHourPart[];
}

export interface DailyLiturgy {
    date: string;
    liturgicalColor: string;
    saintOfDay: string;
    htmlContent: string;
    memories: LiturgyMemory[];
}

// ---- Daily liturgy cache (mass text + hours + day info, keyed by date) -----
// The liturgy for a given calendar date is fixed, so it can be cached safely.
// Only successful responses are cached — never the offline fallback.
const LITURGY_CACHE_PREFIX = 'mora_liturgy_';

function formatLocalDate(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function readLiturgyCache(dateStr: string): DailyLiturgy | null {
    try {
        const raw = localStorage.getItem(LITURGY_CACHE_PREFIX + dateStr);
        return raw ? (JSON.parse(raw) as DailyLiturgy) : null;
    } catch {
        return null;
    }
}

function writeLiturgyCache(dateStr: string, data: DailyLiturgy): void {
    try {
        localStorage.setItem(LITURGY_CACHE_PREFIX + dateStr, JSON.stringify(data));
        pruneLiturgyCache();
    } catch (e) {
        console.warn('Failed to cache liturgy:', e);
    }
}

// Drop cached entries for past dates so storage stays bounded.
function pruneLiturgyCache(): void {
    try {
        const todayStr = formatLocalDate(new Date());
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith(LITURGY_CACHE_PREFIX)) continue;
            const dateStr = key.slice(LITURGY_CACHE_PREFIX.length);
            if (dateStr < todayStr) localStorage.removeItem(key);
        }
    } catch {
        // ignore storage access errors
    }
}

/**
 * The date whose Mass the user most likely wants right now. From Saturday
 * 16:00 onward, evening (vigil) Masses already belong liturgically to
 * Sunday, so the readings default to Sunday; any other time it's today.
 */
export function getDefaultMassDate(now: Date = new Date()): Date {
    if (now.getDay() === 6 && now.getHours() >= 16) {
        const sunday = new Date(now);
        sunday.setDate(now.getDate() + 1);
        return sunday;
    }
    return now;
}

/**
 * Resolves the day's liturgy, or null when the API genuinely has no Mass
 * for that date. Network/API failures are thrown, so callers can tell an
 * outage apart from an empty day.
 */
export async function fetchDailyLiturgy(dateStr: string): Promise<DailyLiturgy | null> {
    const cached = readLiturgyCache(dateStr);
    if (cached) return cached;

    try {
        const query = `query DailyLiturgy($date: String!, $rite: String!) {
            liturgyWithMemories(date: $date, rite: $rite) { 
                date 
                type 
                week_name 
                rite 
                masses {
                    title
                    date
                    text
                } 
                memories {
                    date
                    title
                    type
                    week_name
                    parts {
                        title
                        order
                        verses { id text audio_url order }
                    }
                }
            } 
        }`;

        const response = await fetch('https://apiapp.glauco.it/liturgiadashoras/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: query,
                variables: { date: dateStr, rite: 'portoghese' }
            })
        });

        if (!response.ok) {
            throw new Error('Failed to fetch liturgy');
        }

        const json = await response.json();
        const data = json.data?.liturgyWithMemories;

        if (!data || !data.masses || data.masses.length === 0) {
            return null;
        }

        const mass = data.masses[0];

        // Try to infer color from title roughly
        let color = 'Verde';
        const titleLower = mass.title.toLowerCase();
        if (titleLower.includes('quaresma') || titleLower.includes('advento')) color = 'Roxo';
        else if (titleLower.includes('mártir') || titleLower.includes('espírito santo')) color = 'Vermelho';
        else if (titleLower.includes('solenidade') || titleLower.includes('festa')) color = 'Branco';

        const result: DailyLiturgy = {
            date: dateStr,
            liturgicalColor: color,
            saintOfDay: mass.title,
            htmlContent: mass.text,
            memories: data.memories || []
        };

        writeLiturgyCache(dateStr, result);
        return result;

    } catch (error) {
        console.error('Error fetching liturgy:', error);
        throw error;
    }
}

/**
 * Warms the cache for today and the next few days so the Mass and Liturgy of
 * the Hours load instantly (and work offline) on subsequent opens. Fetches
 * sequentially to avoid hammering the API, skips days already cached, and
 * never throws. Day info (saint/colour) is part of each cached entry; the
 * liturgical calendar ICS is cached separately by fetchLiturgicalColorFromCalendar.
 */
export async function preloadUpcomingLiturgy(days = 5): Promise<void> {
    // Capture the base date once so the range can't drift if the clock crosses
    // midnight while the (sequential) fetches are in flight.
    const base = new Date();
    for (let i = 0; i <= days; i++) {
        const d = new Date(base);
        d.setDate(base.getDate() + i);
        const dateStr = formatLocalDate(d);

        if (readLiturgyCache(dateStr)) continue;
        try {
            await fetchDailyLiturgy(dateStr);
        } catch {
            // best-effort preload; ignore failures
        }
    }
}

export type LiturgicalColor = 'verde' | 'roxo' | 'vermelho' | 'branco' | 'rosa';

export type LiturgicalDayInfo = {
    color: LiturgicalColor;
    dayName: string;
    description: string;
};

/** Fetches (or reads from cache) the raw liturgia.pt ICS text, unfolded. */
async function loadCalendarICS(): Promise<string | null> {
    const CACHE_KEY = 'mora_agenda_ics_v4';
    const CACHE_DAYS = 90;
    const now = Date.now();

    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
        try {
            const parsed = JSON.parse(cached);
            const ageDays = (now - parsed.timestamp) / (1000 * 60 * 60 * 24);
            if (ageDays < CACHE_DAYS && parsed.text && parsed.text.includes('BEGIN:VEVENT')) {
                return parsed.text;
            }
        } catch (e) {
            console.warn('Failed to parse cached ICS:', e);
        }
    }

    const icsUrl = 'https://www.liturgia.pt/agenda/agenda.ics';

    // liturgia.pt doesn't send CORS headers, so the request has to go
    // through a CORS proxy. These are public and occasionally go down,
    // so we try a few in order until one returns a valid calendar.
    const proxyBuilders: Array<(u: string) => string> = [
        (u) => `https://api.codetabs.com/v1/proxy/?quest=${u}`,
        (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
        (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    ];

    let text = '';
    const PROXY_TIMEOUT_MS = 8000;
    for (const buildProxyUrl of proxyBuilders) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);
        try {
            const response = await fetch(buildProxyUrl(icsUrl), { signal: controller.signal });
            if (!response.ok) continue;

            const body = await response.text();
            if (!body.includes('BEGIN:VEVENT')) continue; // not a usable calendar

            // Remove ICS line folding (\r\n followed by a space)
            text = body.replace(/\r?\n /g, '');
            break;
        } catch (e) {
            if (e instanceof DOMException && e.name === 'AbortError') {
                console.warn('ICS proxy timed out, trying next');
            } else {
                console.warn('ICS proxy failed, trying next:', e);
            }
        } finally {
            clearTimeout(timer);
        }
    }

    if (!text) return null;

    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: now, text }));
    } catch (e) {
        console.warn('Failed to cache ICS text:', e);
    }
    return text;
}

/** Extracts a day's info from one unfolded VEVENT block, or null if no color is derivable. */
function parseVEventInfo(event: string): { dateStr: string; info: LiturgicalDayInfo } | null {
    const dtMatch = event.match(/DTSTART(?:;VALUE=DATE)?:(\d{4})(\d{2})(\d{2})/);
    if (!dtMatch) return null;
    const dateStr = `${dtMatch[1]}-${dtMatch[2]}-${dtMatch[3]}`;

    const descMatch = event.match(/\r?\nDESCRIPTION:(.*?)(?=\r?\n[A-Z-]+[;:]|$)/s);
    const summaryMatch = event.match(/\r?\nSUMMARY:(.*?)(?=\r?\n[A-Z-]+[;:]|$)/s);

    let color: LiturgicalColor | undefined;
    let dayName = summaryMatch ? summaryMatch[1].trim() : '';
    let description = '';

    // Clean up ICS escaped characters using split/join (avoids regex escaping issues)
    const bs = String.fromCharCode(92); // backslash character
    dayName = dayName.split(bs + 'n').join(' ').split(bs + ',').join(',').split(bs + ';').join(';');

    if (descMatch) {
        const rawDesc = descMatch[1].trim();
        description = rawDesc.split(bs + 'n').join('\n').split(bs + ',').join(',').split(bs + ';').join(';');

        const descLower = rawDesc.toLowerCase();
        // Pick the color that appears first — descriptions can mention
        // secondary colors in diocesan notes that would mask the primary.
        const colorCandidates: Array<[LiturgicalColor, number]> = (
            [
                ['verde', descLower.indexOf('verde')],
                ['roxo', descLower.indexOf('roxo')],
                ['branco', descLower.indexOf('branco')],
                ['vermelho', descLower.indexOf('vermelho')],
                ['rosa', descLower.indexOf('rosa')],
            ] as Array<[LiturgicalColor, number]>
        ).filter(([, i]) => i !== -1).sort(([, a], [, b]) => a - b);
        if (colorCandidates.length > 0) color = colorCandidates[0][0];
    }

    // Fall back to inferring color from the day name when the
    // ICS description doesn't spell out the color explicitly.
    if (!color && dayName) {
        const nameLower = dayName.toLowerCase();
        if (nameLower.includes('mártir') || nameLower.includes('martir')) color = 'vermelho';
        else if (nameLower.includes('quaresma') || nameLower.includes('advento')) color = 'roxo';
        else if (nameLower.includes('solenidade') || nameLower.includes('assunção') || nameLower.includes('natal') || nameLower.includes('páscoa')) color = 'branco';
    }

    if (!color) return null;
    return { dateStr, info: { color, dayName, description } };
}

// Parsed-calendar memo: the ICS text is stable for a session, so the full
// date→info map is built once and shared by the calendar page and the
// per-date lookups.
let calendarMapPromise: Promise<Map<string, LiturgicalDayInfo> | null> | null = null;

/**
 * The whole liturgical calendar as a map of YYYY-MM-DD → day info.
 * Returns null when the ICS can't be fetched at all (offline, proxies down).
 */
export function fetchLiturgicalCalendarMap(): Promise<Map<string, LiturgicalDayInfo> | null> {
    if (!calendarMapPromise) {
        calendarMapPromise = (async () => {
            try {
                const text = await loadCalendarICS();
                if (!text) return null;
                const map = new Map<string, LiturgicalDayInfo>();
                for (const event of text.split('BEGIN:VEVENT')) {
                    const parsed = parseVEventInfo(event);
                    // First event with a derivable color wins for each date.
                    if (parsed && !map.has(parsed.dateStr)) map.set(parsed.dateStr, parsed.info);
                }
                return map;
            } catch (error) {
                console.error('Error parsing calendar:', error);
                return null;
            }
        })();
        // A failed fetch shouldn't poison the session — allow a retry next call.
        calendarMapPromise.then((map) => { if (!map) calendarMapPromise = null; });
    }
    return calendarMapPromise;
}

export async function fetchLiturgicalColorFromCalendar(date: Date): Promise<LiturgicalDayInfo | null> {
    const map = await fetchLiturgicalCalendarMap();
    return map?.get(formatLocalDate(date)) ?? null;
}
