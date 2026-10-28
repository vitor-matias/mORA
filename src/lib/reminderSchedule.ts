// The Web Push the server sends carries no payload (see workers/push/worker.js
// — payload-less pushes need only a VAPID JWT, no RFC 8291 encryption), so the
// service worker has no way of knowing *which* reminder just fired. The app
// writes its reminder schedule into the Cache API whenever it changes, and the
// service worker reads it back on `push` and matches by local clock time.
//
// Imported by both the app and src/sw.ts — keep it free of DOM/React deps.

export interface ReminderEntry {
    /** Local time this reminder is due, "HH:MM". */
    time: string;
    title: string;
    body: string;
    /** 0 (Sunday) – 6: due only on that weekday. Absent: every day. */
    weekday?: number;
    /** Local YYYY-MM-DD the body was written for. A push on another day
        (the app not opened since last week) shows `staleBody` instead. */
    date?: string;
    staleBody?: string;
    /** In-app route (hash path) to open when the notification is tapped. */
    url?: string;
}

/** The server and the push tag know an entry by this: "HH:MM", or
    "6@HH:MM" for a weekly one. */
export function reminderKey(entry: Pick<ReminderEntry, 'time' | 'weekday'>): string {
    return entry.weekday === undefined ? entry.time : `${entry.weekday}@${entry.time}`;
}

function localISODate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** The body to show at `now`: a dated one only on its own day. */
export function reminderBody(entry: ReminderEntry, now: Date): string {
    return entry.date && entry.date !== localISODate(now) && entry.staleBody ? entry.staleBody : entry.body;
}

/**
 * Mirrors DELIVERY_WINDOW_MIN in workers/push/worker.js: the Worker only sends
 * a reminder between its time and this many minutes after. Both the label
 * matching below and the in-app fallback timer derive their windows from it, so
 * the push and no-push paths behave the same. Keep the two in step.
 */
export const DELIVERY_WINDOW_MIN = 15;

/**
 * Slack on top of the delivery window for push-service latency and for device
 * clocks that disagree with the server's. Without it a push sent at the very
 * end of the window would arrive just outside it and lose its label.
 */
const CLOCK_SKEW_ALLOWANCE_MIN = 5;

const CACHE_NAME = 'mora-reminder-schedule';
// Same-origin path that is not a real route, so nothing else can collide.
const SCHEDULE_URL = '/__mora-reminder-schedule';
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * The cache outlives any single app version, so what comes back may predate a
 * schema change or be partially written. Entries are validated rather than
 * trusted: one malformed record must not throw inside the push handler, which
 * would leave the user with no notification at all.
 */
function isReminderEntry(value: unknown): value is ReminderEntry {
    if (typeof value !== 'object' || value === null) return false;
    const entry = value as Record<string, unknown>;
    const optionalString = (key: string) => entry[key] === undefined || typeof entry[key] === 'string';
    return typeof entry.time === 'string' && TIME_PATTERN.test(entry.time)
        && typeof entry.title === 'string'
        && typeof entry.body === 'string'
        && (entry.weekday === undefined || (Number.isInteger(entry.weekday) && (entry.weekday as number) >= 0 && (entry.weekday as number) <= 6))
        && optionalString('date') && optionalString('staleBody')
        && (entry.url === undefined || (typeof entry.url === 'string' && entry.url.startsWith('/')));
}

/**
 * The route to open for a tapped reminder. The nonce makes every tap a new
 * location, so a second reminder for the same Hour still registers as a
 * navigation (an identical hash would be ignored).
 */
export function reminderRoute(url: string, now = Date.now()): string {
    return `${url}${url.includes('?') ? '&' : '?'}n=${now}`;
}

/** "<date it fell due> <key>": a 23:55 reminder seen at 00:05 belongs to yesterday. */
export function reminderMark(entry: ReminderEntry, now: Date): string {
    const [h, m] = entry.time.split(':').map(Number);
    const due = new Date(now);
    if (now.getHours() * 60 + now.getMinutes() < h * 60 + m) due.setDate(due.getDate() - 1);
    return `${localISODate(due)} ${reminderKey(entry)}`;
}

const SHOWN_URL = '/__mora-reminder-shown';

/** Marks of the reminders the service worker has shown, today's and yesterday's. */
export async function readShownReminders(): Promise<Set<string>> {
    if (typeof caches === 'undefined') return new Set();
    try {
        const res = await (await caches.open(CACHE_NAME)).match(SHOWN_URL);
        const parsed: unknown = res ? await res.json() : [];
        return new Set(Array.isArray(parsed) ? parsed.filter((m): m is string => typeof m === 'string') : []);
    } catch {
        return new Set();
    }
}

export async function recordShownReminder(mark: string, now: Date): Promise<void> {
    if (typeof caches === 'undefined') return;
    try {
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        const keep = [localISODate(now), localISODate(yesterday)];
        const marks = [...await readShownReminders(), mark].filter((m) => keep.some((d) => m.startsWith(d)));
        await (await caches.open(CACHE_NAME)).put(SHOWN_URL, new Response(JSON.stringify([...new Set(marks)])));
    } catch {
        // Worst case a second push repeats the first one's text.
    }
}

export async function writeReminderSchedule(entries: ReminderEntry[]): Promise<void> {
    if (typeof caches === 'undefined') return;
    try {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(
            SCHEDULE_URL,
            new Response(JSON.stringify(entries), { headers: { 'Content-Type': 'application/json' } })
        );
    } catch {
        // Storage blocked/full — the worker just falls back to generic text.
    }
}

export async function readReminderSchedule(): Promise<ReminderEntry[]> {
    if (typeof caches === 'undefined') return [];
    try {
        const cache = await caches.open(CACHE_NAME);
        const res = await cache.match(SCHEDULE_URL);
        if (!res) return [];
        const parsed: unknown = await res.json();
        return Array.isArray(parsed) ? parsed.filter(isReminderEntry) : [];
    } catch {
        return [];
    }
}

/**
 * The reminder this push is most likely announcing: the most recently *due*
 * one, within `windowMin` minutes. The server may fire up to
 * DELIVERY_WINDOW_MIN late, so this tolerates drift rather than demanding an
 * exact match — but it only ever looks backwards, because the server never
 * pushes before a reminder's time. Matching the nearest in either direction
 * would label a late 07:00 push as the 07:20 reminder.
 */
export function matchReminder(
    entries: ReminderEntry[],
    now: Date,
    windowMin = DELIVERY_WINDOW_MIN + CLOCK_SKEW_ALLOWANCE_MIN,
    /** reminderMark()s already shown: two pushes due together (a daily
        reminder and the weekly summary, both 22:00 on a Saturday) arrive
        indistinguishable, so the second has to take the other entry. */
    shown: ReadonlySet<string> = new Set()
): ReminderEntry | null {
    const minutes = now.getHours() * 60 + now.getMinutes();
    let best: ReminderEntry | null = null;
    let bestElapsed = Infinity;
    for (const entry of entries) {
        // Exported, so callers may pass entries that never went through
        // readReminderSchedule's filter.
        if (!isReminderEntry(entry)) continue;
        const [h, m] = entry.time.split(':').map(Number);
        // Minutes since the reminder fell due, wrapping midnight so a 23:55
        // reminder is 10 minutes old at 00:05 rather than 1430 minutes early.
        let elapsed = minutes - (h * 60 + m);
        let dueDay = now.getDay();
        if (elapsed < 0) {
            elapsed += 1440;
            dueDay = (dueDay + 6) % 7;
        }
        if (entry.weekday !== undefined && entry.weekday !== dueDay) continue;
        if (shown.has(reminderMark(entry, now))) continue;
        if (elapsed < bestElapsed) {
            bestElapsed = elapsed;
            best = entry;
        }
    }
    return bestElapsed <= windowMin ? best : null;
}
