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
    return typeof entry.time === 'string' && TIME_PATTERN.test(entry.time)
        && typeof entry.title === 'string'
        && typeof entry.body === 'string';
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
    windowMin = DELIVERY_WINDOW_MIN + CLOCK_SKEW_ALLOWANCE_MIN
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
        if (elapsed < 0) elapsed += 1440;
        if (elapsed < bestElapsed) {
            bestElapsed = elapsed;
            best = entry;
        }
    }
    return bestElapsed <= windowMin ? best : null;
}
