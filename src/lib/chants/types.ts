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

interface ChantBase {
    /** Stable slug — used as the anchor in the page and in shared links. */
    id: string;
    title: string;
    category: ChantCategoryId;
    /** Composer, provenance, and when it is sung. */
    note: string;
}

/**
 * A chant has to have words to sing, from one of three places: its own
 * Portuguese text, its own Latin (O sanctissima is sung only in Latin), or a
 * prayer in the Devocionário it is sung from. An entry with none of them
 * renders as an empty card, which nothing else would catch.
 */
export type Chant = ChantBase & (
    | { text: string; latin?: string; prayerId?: string }
    | { latin: string; text?: string; prayerId?: string }
    | { prayerId: string; text?: string; latin?: string }
);

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
