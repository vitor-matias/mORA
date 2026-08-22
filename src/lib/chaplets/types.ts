/** A prayer said once, at the opening or the close of a chaplet. */
export interface ChapletPrayer {
    title: string;
    text: string;
    /** Said n times in a row (e.g. the threefold «Deus santo, Deus forte»). */
    repeat?: number;
}

/** One group of beads: an announcement, then the large bead and its smalls. */
export interface ChapletGroup {
    /** Announced before the beads — a sorrow, a salutation, a praise. */
    title: string;
    /** Read while the announcement is on screen. */
    meditation?: string;
    /** Replaces the chaplet's own large-bead prayer for this group. */
    largeBead?: string;
    /** One entry per small bead, when each says something different (the
        Coroa das Doze Estrelas). Otherwise the chaplet's `smallBead` is
        repeated `smallBeads` times. */
    smallBeadTexts?: string[];
}

export interface Chaplet {
    /** Stable slug — it is the URL (`/coroas/<id>`). */
    id: string;
    title: string;
    /** One line under the title, in the chooser and the page header. */
    subtitle: string;
    /** Where it comes from and when it is prayed. */
    note: string;
    /** Rough length, so the chooser can say what it is asking for. */
    duration: string;
    /** How the beads are laid out, in words ("7 grupos de 7 contas"). */
    shape: string;
    opening: ChapletPrayer[];
    /** The prayer of the large bead that opens each group. */
    largeBead: { title: string; text: string };
    /** The prayer repeated on the small beads. */
    smallBead: { title: string; text: string };
    smallBeads: number;
    /** Said after the small beads of every group (usually the Glória). */
    afterEachGroup?: ChapletPrayer;
    groups: ChapletGroup[];
    ending: ChapletPrayer[];
}

export type ChapletStepKind = 'abertura' | 'anuncio' | 'grande' | 'conta' | 'remate' | 'final';

export interface ChapletStep {
    id: string;
    kind: ChapletStepKind;
    title: string;
    content: string;
    /** 1-based, for "Grupo 3 de 7". Absent on opening and closing steps. */
    groupIndex?: number;
    /** Position on the bead strip: 0 is the large bead, 1..n the smalls,
        n+1 the closing prayer of the group. */
    beadIndex?: number;
}
