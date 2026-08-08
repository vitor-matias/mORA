// Portuguese-aware text helpers for UI display.

/** Uppercase only the first letter — for pt-PT dates ("sábado, 11 de julho"
 *  → "Sábado, 11 de julho"). Unlike the CSS `capitalize` utility this never
 *  capitalizes particles ("De", "Da"). */
export function capitalizeFirst(text: string): string {
    if (!text) return text;
    return text.charAt(0).toLocaleUpperCase('pt-PT') + text.slice(1);
}

/** Join items the Portuguese way: "a", "a e b", "a, b e c". */
export function joinWithE(items: string[]): string {
    if (items.length <= 1) return items[0] ?? '';
    return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
}

/** Format a date for display headers, e.g. "Sábado, 11 de julho". */
export function formatDisplayDate(date: Date): string {
    return capitalizeFirst(
        date.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })
    );
}

/** Weekday-less variant, e.g. "11 de julho" — for tight spots (the desktop
 *  sidebar's date pill) where the full form truncates and the weekday is
 *  shown by the day card anyway. */
export function formatShortDisplayDate(date: Date): string {
    return date.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' });
}

/** Local YYYY-MM-DD (no UTC drift). */
export function formatISODate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * UTC YYYY-MM-DD.
 *
 * Distinct from formatISODate, which is deliberately local: prayer streaks
 * belong to the user's own day, so praying at 23:00 counts for that evening
 * wherever they are. The Palavra puzzle is the opposite — one global daily,
 * rolling over at 00:00 UTC, so that everyone plays the same word inside the
 * same window and a speed ranking compares like with like. Mixing the two up
 * would put a Lisbon player on tomorrow's puzzle an hour early in summer.
 */
export function formatUTCDate(date: Date): string {
    return date.toISOString().slice(0, 10);
}

/** The moment the next puzzle unlocks: the next 00:00 UTC. */
export function nextUTCMidnight(from: Date = new Date()): Date {
    const next = new Date(from);
    next.setUTCHours(24, 0, 0, 0);
    return next;
}

/** Whole days from `a` to `b`, both YYYY-MM-DD.
 *  Built from the date parts in UTC rather than parsed as local time: local
 *  midnights are 23 or 25 hours apart across a DST change (and don't exist at
 *  all in a few zones), which rounding happens to absorb — but the streak
 *  rules turn on this being exactly 1, so they shouldn't rest on that. */
export function daysApart(a: string, b: string): number {
    const utc = (iso: string) => {
        const [y, m, d] = iso.split('-').map(Number);
        return Date.UTC(y, m - 1, d);
    };
    return (utc(b) - utc(a)) / 86400000;
}

/** Time-of-day greeting. */
export function getGreeting(now: Date = new Date()): string {
    const h = now.getHours();
    if (h >= 6 && h < 13) return 'Bom dia.';
    if (h >= 13 && h < 20) return 'Boa tarde.';
    return 'Boa noite.';
}
