import { fetchAgendaDays } from "@/lib/agendaNostr";

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

export interface SaintOfDay {
    name: string;
    date: string;
    /** HTML: biography, then the day's numbered Roman Martyrology entries. */
    description: string;
}

export interface DailyLiturgy {
    date: string;
    /** The date the API says the Mass belongs to. Cached entries lacking it
        or mismatching `date` are treated as cache misses — see readLiturgyCache. */
    massDate?: string;
    liturgicalColor: string;
    saintOfDay: string;
    htmlContent: string;
    memories: LiturgyMemory[];
    saint: SaintOfDay | null;
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

function readLiturgyCacheEntry(dateStr: string): DailyLiturgy | null {
    try {
        const raw = localStorage.getItem(LITURGY_CACHE_PREFIX + dateStr);
        return raw ? (JSON.parse(raw) as DailyLiturgy) : null;
    } catch {
        return null;
    }
}

// A valid entry must carry a massDate matching its key: caches written
// before fetchDailyLiturgy verified masses[0] could freeze another day's
// Mass under this date (seen in the wild: a Sunday key holding Monday's
// Mass). massDate also postdates the `saint` field, so this one check
// covers both migrations. Anything else counts as a miss and the day is
// re-fetched with the verified query; fetchDailyLiturgy still falls back
// to the raw entry when the re-fetch fails (e.g. offline).
function readLiturgyCache(dateStr: string): DailyLiturgy | null {
    const entry = readLiturgyCacheEntry(dateStr);
    return entry && entry.massDate === dateStr ? entry : null;
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
                saint {
                    name
                    date
                    description
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

        // The upstream has been seen answering with another day's liturgy
        // (an ~5-minute server-cache window in late July 2026 served Monday's
        // Mass for a Sunday query). Wrong-day data must never render or be
        // cached: treat it as an outage — the catch below falls back to a
        // stale entry or the retry UI, both more honest than wrong readings.
        if (data.date && data.date !== dateStr) {
            console.warn(`Liturgy for ${dateStr} answered with ${data.date}; treating as outage`);
            throw new Error(`Liturgy response is for ${data.date}, not ${dateStr}`);
        }
        const masses: Array<{ title: string; date?: string; text: string }> = data.masses;
        const mass = masses.find((m) => m.date === dateStr);
        if (!mass) {
            console.warn(`No Mass dated ${dateStr} in response; got:`, masses.map((m) => m.date));
            throw new Error(`No Mass dated ${dateStr} in liturgy response`);
        }

        // Try to infer color from title roughly
        let color = 'Verde';
        const titleLower = mass.title.toLowerCase();
        if (titleLower.includes('quaresma') || titleLower.includes('advento')) color = 'Roxo';
        else if (titleLower.includes('mártir') || titleLower.includes('espírito santo')) color = 'Vermelho';
        else if (titleLower.includes('solenidade') || titleLower.includes('festa')) color = 'Branco';

        const result: DailyLiturgy = {
            date: dateStr,
            massDate: mass.date,
            liturgicalColor: color,
            saintOfDay: mass.title,
            htmlContent: mass.text,
            memories: data.memories || [],
            saint: data.saint ?? null
        };

        // mass.date === dateStr is guaranteed above, so whatever renders is
        // also safe to cache; massDate stamps the entry for readLiturgyCache.
        writeLiturgyCache(dateStr, result);
        return result;

    } catch (error) {
        console.error('Error fetching liturgy:', error);
        // An old-format cache entry still holds readings — better stale
        // than an error page when the re-fetch fails (e.g. offline).
        // Not written back, so it upgrades on the next successful fetch.
        const stale = readLiturgyCacheEntry(dateStr);
        if (stale) return { ...stale, saint: stale.saint ?? null };
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

// The liturgical day info now arrives already parsed, one Nostr event per
// day (see src/lib/agendaNostr.ts). The types and the ICS parsing they came
// from live in src/lib/icsCalendar.ts, which the publisher shares.
export type { LiturgicalColor, LiturgicalDayInfo } from '@/lib/icsCalendar';

// ── Day cache ────────────────────────────────────────────────────────────
//
// Cached per day, because that is the unit that arrives and the unit the app
// asks for.
//
// There is no expiry on a day that has already happened: the entry for 15
// January 2026 *is* 15 January 2026, and ageing it out would only mean
// fetching the same bytes again to learn the same thing. Only days still in
// the future are re-checked, and only occasionally, because those are the
// only ones the Secretariado can still issue a correction for.
const DAY_CACHE_PREFIX = 'mora_agenda_d_';

/** How long a *future* day's copy is trusted before it's checked again. */
const FUTURE_RECHECK_DAYS = 7;

/** Cached days before this many days ago are dropped, purely to bound storage. */
const KEEP_PAST_DAYS = 400;

type CachedDay = { at: number; info: LiturgicalDayInfoValue };
type LiturgicalDayInfoValue = import('@/lib/icsCalendar').LiturgicalDayInfo;

function readDayCache(dateStr: string, todayStr: string): { info: LiturgicalDayInfoValue; fresh: boolean } | null {
    try {
        const raw = localStorage.getItem(DAY_CACHE_PREFIX + dateStr);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as CachedDay;
        if (!parsed?.info?.color) return null;
        // Past and present are settled; only the future is worth re-asking.
        const settled = dateStr <= todayStr;
        const ageDays = (Date.now() - parsed.at) / (1000 * 60 * 60 * 24);
        return { info: parsed.info, fresh: settled || ageDays < FUTURE_RECHECK_DAYS };
    } catch {
        // Storage blocked (e.g. private browsing), or a corrupt entry.
        return null;
    }
}

function writeDayCache(dateStr: string, info: LiturgicalDayInfoValue): void {
    try {
        localStorage.setItem(DAY_CACHE_PREFIX + dateStr, JSON.stringify({ at: Date.now(), info }));
    } catch {
        // Out of quota is the likely one. Drop the old days and try once more
        // before giving up — losing the cache entirely would mean re-reading
        // the relays on every single navigation.
        pruneDayCache();
        try {
            localStorage.setItem(DAY_CACHE_PREFIX + dateStr, JSON.stringify({ at: Date.now(), info }));
        } catch {
            // ignore storage errors (private browsing, still out of quota)
        }
    }
}

function pruneDayCache(): void {
    try {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - KEEP_PAST_DAYS);
        const oldest = formatLocalDate(cutoff);
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith(DAY_CACHE_PREFIX)) continue;
            if (key.slice(DAY_CACHE_PREFIX.length) < oldest) localStorage.removeItem(key);
        }
    } catch {
        // ignore storage access errors
    }
}

// Days already loaded this session, so paging the directory back and forth
// costs nothing after the first visit and the per-date lookups share
// whatever the directory has already pulled in.
const dayMemo = new Map<string, LiturgicalDayInfoValue>();

/**
 * The given days (YYYY-MM-DD) of the liturgical calendar.
 *
 * Only the days asked for are fetched. That is the point of the per-day
 * split: colouring today costs one ~700-byte event rather than the 366KB
 * year the app used to pull through a proxy for the same answer.
 *
 * A day that can't be loaded is simply absent from the result; every caller
 * renders "no info for this day" rather than failing.
 */
export async function fetchLiturgicalDays(dates: string[]): Promise<Map<string, LiturgicalDayInfoValue>> {
    const wanted = [...new Set(dates)];
    const todayStr = formatLocalDate(new Date());
    const days = new Map<string, LiturgicalDayInfoValue>();

    const missing: string[] = [];
    for (const dateStr of wanted) {
        // Only a settled day short-circuits here. A future day carries an
        // age in the cache and is re-checked once a week; letting the memo
        // answer for it would pin it for the life of the tab — and this app
        // is installed to a home screen and left open for days, so that is a
        // correction nobody would see until they happened to reload.
        const remembered = dayMemo.get(dateStr);
        if (remembered && dateStr <= todayStr) {
            days.set(dateStr, remembered);
            continue;
        }
        const cached = readDayCache(dateStr, todayStr);
        if (cached) {
            // A stale future day is still shown; it's only also re-fetched.
            days.set(dateStr, cached.info);
            if (cached.fresh) {
                dayMemo.set(dateStr, cached.info);
                continue;
            }
        }
        missing.push(dateStr);
    }

    if (missing.length === 0) return days;

    try {
        // One query for every missing day, so a month of the directory is a
        // single round trip rather than one per cell.
        const fetched = await fetchAgendaDays(missing);
        for (const [dateStr, info] of fetched) {
            dayMemo.set(dateStr, info);
            writeDayCache(dateStr, info);
            days.set(dateStr, info);
        }
    } catch (error) {
        // Offline, or no relay answered. Anything already cached above still
        // shows; the rest simply has no info, and the next call tries again.
        console.warn('Could not read the liturgical calendar from the relays:', error);
    }

    return days;
}

export async function fetchLiturgicalColorFromCalendar(date: Date): Promise<LiturgicalDayInfoValue | null> {
    const days = await fetchLiturgicalDays([formatLocalDate(date)]);
    return days.get(formatLocalDate(date)) ?? null;
}
