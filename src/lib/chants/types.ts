export type ChantCategoryId =
    | 'natal'
    | 'quaresma'
    | 'pascoa'
    | 'eucaristia'
    | 'espirito'
    | 'maria'
    | 'louvor'
    | 'exequias'
    | 'cf-reflexao'
    | 'cf-animacao';

export interface Chant {
    /** Stable slug — used as the anchor in the page and in shared links. */
    id: string;
    title: string;
    category: ChantCategoryId;
    /** Composer, provenance, and when it is sung. */
    note: string;
    /** The sung text in Portuguese. Omitted when `prayerId` supplies it. */
    text?: string;
    /** The Latin, for what is sung in Latin. */
    latin?: string;
    /** When the words are already in the Devocionário, the prayer they come
        from — the page renders that text and links to it, so the two never
        drift apart. */
    prayerId?: string;
}

export interface ChantCategory {
    id: ChantCategoryId;
    label: string;
    heading: string;
}

/** Liturgical order, the way a hymnal is arranged: the year first, then the
    sacraments and devotions, then what is sung at a funeral. */
export const CHANT_CATEGORIES: readonly ChantCategory[] = [
    { id: 'natal', label: 'Advento e Natal', heading: 'Advento e Natal' },
    { id: 'quaresma', label: 'Quaresma e Cruz', heading: 'Quaresma e Cruz' },
    { id: 'pascoa', label: 'Páscoa', heading: 'Tempo Pascal' },
    { id: 'eucaristia', label: 'Eucaristia', heading: 'Eucaristia e Adoração' },
    { id: 'espirito', label: 'Espírito Santo', heading: 'Ao Espírito Santo' },
    { id: 'maria', label: 'Nossa Senhora', heading: 'A Nossa Senhora' },
    { id: 'louvor', label: 'Louvor', heading: 'Louvor e acção de graças' },
    { id: 'exequias', label: 'Exéquias', heading: 'Exéquias' },
    { id: 'cf-reflexao', label: 'CF · Reflexão', heading: 'Convívios Fraternos — músicas de reflexão' },
    { id: 'cf-animacao', label: 'CF · Animação', heading: 'Convívios Fraternos — músicas de animação' },
];
