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

const CACHE_NAME = 'mora-reminder-schedule';
// Same-origin path that is not a real route, so nothing else can collide.
const SCHEDULE_URL = '/__mora-reminder-schedule';

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
        return Array.isArray(parsed) ? (parsed as ReminderEntry[]) : [];
    } catch {
        return [];
    }
}

/**
 * The scheduled reminder nearest `now`, within `windowMin` minutes either side.
 * The server may fire up to DELIVERY_WINDOW_MIN late, so this has to tolerate
 * drift rather than demand an exact match.
 */
export function matchReminder(
    entries: ReminderEntry[],
    now: Date,
    windowMin = 30
): ReminderEntry | null {
    const minutes = now.getHours() * 60 + now.getMinutes();
    let best: ReminderEntry | null = null;
    let bestDelta = Infinity;
    for (const entry of entries) {
        const [h, m] = entry.time.split(':').map(Number);
        if (Number.isNaN(h) || Number.isNaN(m)) continue;
        // Compare around a 24h circle, so 23:50 and 00:05 are 15 minutes apart.
        const raw = Math.abs(minutes - (h * 60 + m));
        const delta = Math.min(raw, 1440 - raw);
        if (delta < bestDelta) {
            bestDelta = delta;
            best = entry;
        }
    }
    return bestDelta <= windowMin ? best : null;
}
