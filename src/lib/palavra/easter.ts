/**
 * Easter Sunday as `YYYY-MM-DD`, by the Gregorian computus (Meeus's form).
 *
 * Pure arithmetic rather than a read from the liturgy API: the badge job runs
 * unattended and has to name a permanent medal from this.
 */
export function easterSunday(year: number): string {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const n = h + l - 7 * m + 114;
    const month = Math.floor(n / 31);
    const day = (n % 31) + 1;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Whether a `YYYY-MM` month holds that year's Easter Sunday. */
export function isEasterMonth(month: string): boolean {
    return easterSunday(Number(month.slice(0, 4))).startsWith(month);
}
