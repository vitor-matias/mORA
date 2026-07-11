// Portuguese-aware text helpers for UI display.

/** Uppercase only the first letter — for pt-PT dates ("sábado, 11 de julho"
 *  → "Sábado, 11 de julho"). Unlike the CSS `capitalize` utility this never
 *  capitalizes particles ("De", "Da"). */
export function capitalizeFirst(text: string): string {
    if (!text) return text;
    return text.charAt(0).toLocaleUpperCase('pt-PT') + text.slice(1);
}

/** Format a date for display headers, e.g. "Sábado, 11 de julho". */
export function formatDisplayDate(date: Date): string {
    return capitalizeFirst(
        date.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })
    );
}

/** Local YYYY-MM-DD (no UTC drift). */
export function formatISODate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/** Time-of-day greeting. */
export function getGreeting(now: Date = new Date()): string {
    const h = now.getHours();
    if (h >= 6 && h < 13) return 'Bom dia.';
    if (h >= 13 && h < 20) return 'Boa tarde.';
    return 'Boa noite.';
}
