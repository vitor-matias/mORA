export type PrayerCategoryId =
    | 'comuns'
    | 'dia'
    | 'senhor'
    | 'espirito'
    | 'maria'
    | 'fatima'
    | 'santos'
    | 'vida'
    | 'defuntos'
    | 'salmos'
    | 'formulas';

export interface Prayer {
    /** Stable slug — it is the URL (`/devocionario/<id>`) and the favourites
        key, so renaming one breaks saved links and saved favourites. */
    id: string;
    title: string;
    category: PrayerCategoryId;
    /** One line of provenance or occasion, shown under the title. */
    note?: string;
    /** The prayer itself. A blank line separates stanzas; single newlines are
        sense-lines and are rendered as written — liturgical text is mostly
        verse, and reflowing it into prose loses the phrasing you pray by. */
    text: string;
    /** The Latin, for the prayers still commonly prayed or sung in Latin. */
    latin?: string;
    /** Other names people search by (an incipit, a Latin title, a devotion). */
    aka?: string[];
    /** When the prayer is also prayed bead by bead, the chaplet in
        `src/lib/chaplets` that walks it — the reading view offers it. */
    chapletId?: string;
}

export interface PrayerCategory {
    id: PrayerCategoryId;
    /** Chip label — short enough for the filter row on a phone. */
    label: string;
    /** Section heading when the list is grouped, and the empty-state subject. */
    heading: string;
}

/** Display order — this is the order of the filter chips and of the grouped
    list, and it runs from the prayers everyone knows to the reference matter
    at the back, the way a printed devocionário is laid out. */
export const PRAYER_CATEGORIES: readonly PrayerCategory[] = [
    { id: 'comuns', label: 'Essenciais', heading: 'Orações essenciais' },
    { id: 'dia', label: 'Ao longo do dia', heading: 'Ao longo do dia' },
    { id: 'senhor', label: 'A Jesus', heading: 'A Nosso Senhor e à Eucaristia' },
    { id: 'espirito', label: 'Espírito Santo', heading: 'Ao Espírito Santo e à Santíssima Trindade' },
    { id: 'maria', label: 'Nossa Senhora', heading: 'A Nossa Senhora' },
    { id: 'fatima', label: 'Fátima', heading: 'As orações de Fátima' },
    { id: 'santos', label: 'Anjos e Santos', heading: 'Aos Anjos e aos Santos' },
    { id: 'vida', label: 'Pela vida', heading: 'Pela vida e pelos outros' },
    { id: 'defuntos', label: 'Defuntos', heading: 'Pelos fiéis defuntos' },
    { id: 'salmos', label: 'Salmos e cânticos', heading: 'Salmos e cânticos' },
    { id: 'formulas', label: 'Fórmulas da fé', heading: 'Fórmulas da fé' },
];
