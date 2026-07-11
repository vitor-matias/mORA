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
