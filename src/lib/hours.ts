// Canonical-hour selection by time of day — shared by Home (context card)
// and LiturgiaHoras (default selection).

export interface HourSelection {
    /** Canonical moment id used by LiturgiaHoras ('oficio' | 'laudes' | 'intermedia' | 'vesperas' | 'completas') */
    id: string;
    /** Sub-hour of Hora Intermédia, when applicable */
    subHour: 'Tércia' | 'Sexta' | 'Noa' | null;
    /** Display label, e.g. "Laudes", "Hora Intermédia (Sexta)" */
    label: string;
}

export interface CanonicalHour {
    id: string;
    label: string;
    /** Time proposed when the user first switches this reminder on. */
    defaultTime: string;
}

/** The Hours a user can be reminded of, in the order they fall in the day. */
export const CANONICAL_HOURS: CanonicalHour[] = [
    { id: 'oficio', label: 'Ofício de Leitura', defaultTime: '05:30' },
    { id: 'laudes', label: 'Laudes', defaultTime: '07:00' },
    { id: 'intermedia', label: 'Hora Intermédia', defaultTime: '12:00' },
    { id: 'vesperas', label: 'Vésperas', defaultTime: '19:00' },
    { id: 'completas', label: 'Completas', defaultTime: '21:30' },
];

/**
 * The day whose office the user most likely wants right now. Until 02:00 the
 * hour on offer is still Completas (see getHourForTime), and that is the
 * previous day's night prayer — Saturday night's is "Compl. dep. Vésp. I" of
 * Sunday, listed under Saturday — so the date stays on yesterday until then.
 */
export function getDefaultHoursDate(now: Date = new Date()): Date {
    if (now.getHours() >= 2) return now;
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    return yesterday;
}

export function getHourForTime(now: Date = new Date()): HourSelection {
    const h = now.getHours();
    if (h >= 6 && h < 9) return { id: 'laudes', subHour: null, label: 'Laudes' };
    if (h >= 9 && h < 12) return { id: 'intermedia', subHour: 'Tércia', label: 'Hora Intermédia (Tércia)' };
    if (h >= 12 && h < 15) return { id: 'intermedia', subHour: 'Sexta', label: 'Hora Intermédia (Sexta)' };
    if (h >= 15 && h < 18) return { id: 'intermedia', subHour: 'Noa', label: 'Hora Intermédia (Noa)' };
    if (h >= 18 && h < 21) return { id: 'vesperas', subHour: null, label: 'Vésperas' };
    if (h >= 21 || h < 2) return { id: 'completas', subHour: null, label: 'Completas' };
    return { id: 'oficio', subHour: null, label: 'Ofício de Leitura' };
}
