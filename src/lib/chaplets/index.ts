import type { Chaplet, ChapletStep } from './types';
import { CHAPLETS } from './chaplets';

export type { Chaplet, ChapletStep, ChapletGroup, ChapletPrayer } from './types';
export { CHAPLETS } from './chaplets';

const BY_ID = new Map(CHAPLETS.map((c) => [c.id, c]));

export function getChaplet(id: string | undefined): Chaplet | undefined {
    return id ? BY_ID.get(id) : undefined;
}

/** How many beads the strip has to draw for one group: the large bead, the
    smalls, and the group's closing prayer when it has one. */
export function beadsPerGroup(chaplet: Chaplet): number {
    return 1 + chaplet.smallBeads + (chaplet.afterEachGroup ? 1 : 0);
}

function repeatSuffix(repeat: number | undefined): string {
    return repeat && repeat > 1 ? `\n\n(${repeat} vezes)` : '';
}

/**
 * Expands a chaplet into the flat list of steps the player walks through.
 * Every bead is its own step — the point of praying a chaplet on a phone is
 * that the phone counts, so the reader never has to.
 */
export function generateChapletSequence(chaplet: Chaplet): ChapletStep[] {
    const steps: ChapletStep[] = [];

    chaplet.opening.forEach((prayer, i) => {
        steps.push({
            id: `abertura-${i}`,
            kind: 'abertura',
            title: prayer.title,
            content: prayer.text + repeatSuffix(prayer.repeat),
        });
    });

    chaplet.groups.forEach((group, g) => {
        const groupIndex = g + 1;

        // The announcement carries no bead: it is what the large bead is
        // prayed for, not a bead of its own.
        if (group.meditation) {
            steps.push({
                id: `g${groupIndex}-anuncio`,
                kind: 'anuncio',
                title: group.title,
                content: group.meditation,
                groupIndex,
            });
        }

        steps.push({
            id: `g${groupIndex}-grande`,
            kind: 'grande',
            title: group.meditation ? chaplet.largeBead.title : `${group.title} · ${chaplet.largeBead.title}`,
            content: group.largeBead ?? chaplet.largeBead.text,
            groupIndex,
            beadIndex: 0,
        });

        for (let bead = 1; bead <= chaplet.smallBeads; bead++) {
            steps.push({
                id: `g${groupIndex}-conta-${bead}`,
                kind: 'conta',
                title: chaplet.smallBeads > 1
                    ? `${chaplet.smallBead.title} ${bead} de ${chaplet.smallBeads}`
                    : chaplet.smallBead.title,
                content: group.smallBeadTexts?.[bead - 1] ?? chaplet.smallBead.text,
                groupIndex,
                beadIndex: bead,
            });
        }

        if (chaplet.afterEachGroup) {
            steps.push({
                id: `g${groupIndex}-remate`,
                kind: 'remate',
                title: chaplet.afterEachGroup.title,
                content: chaplet.afterEachGroup.text + repeatSuffix(chaplet.afterEachGroup.repeat),
                groupIndex,
                beadIndex: chaplet.smallBeads + 1,
            });
        }
    });

    chaplet.ending.forEach((prayer, i) => {
        steps.push({
            id: `final-${i}`,
            kind: 'final',
            title: prayer.title,
            content: prayer.text + repeatSuffix(prayer.repeat),
        });
    });

    return steps;
}
