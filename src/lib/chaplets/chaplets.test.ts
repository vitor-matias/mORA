import { describe, expect, it } from 'vitest';
import { CHAPLETS, beadsPerGroup, generateChapletSequence, getChaplet } from './index';

describe('the chaplets', () => {
    it('has no duplicate ids', () => {
        const ids = CHAPLETS.map((c) => c.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('uses url-safe ids', () => {
        for (const chaplet of CHAPLETS) {
            expect(chaplet.id, chaplet.title).toMatch(/^[a-z0-9-]+$/);
        }
    });

    it('always has an opening, some groups and an ending', () => {
        for (const chaplet of CHAPLETS) {
            expect(chaplet.opening.length, chaplet.id).toBeGreaterThan(0);
            expect(chaplet.groups.length, chaplet.id).toBeGreaterThan(0);
            expect(chaplet.ending.length, chaplet.id).toBeGreaterThan(0);
            expect(chaplet.smallBeads, chaplet.id).toBeGreaterThan(0);
        }
    });

    it('gives a per-bead text list exactly one entry per small bead', () => {
        // A short list would leave later beads silently falling back to the
        // generic prayer, which reads as a bug halfway through a group.
        for (const chaplet of CHAPLETS) {
            for (const group of chaplet.groups) {
                if (!group.smallBeadTexts) continue;
                expect(group.smallBeadTexts.length, `${chaplet.id}/${group.title}`)
                    .toBe(chaplet.smallBeads);
            }
        }
    });
});

describe('generateChapletSequence', () => {
    it('walks every bead of every group', () => {
        for (const chaplet of CHAPLETS) {
            const steps = generateChapletSequence(chaplet);
            const beads = steps.filter((s) => s.kind === 'grande' || s.kind === 'conta').length;
            expect(beads, chaplet.id).toBe(chaplet.groups.length * (1 + chaplet.smallBeads));
        }
    });

    it('numbers the bead strip within a group', () => {
        const chaplet = getChaplet('divina-misericordia')!;
        const steps = generateChapletSequence(chaplet);
        const first = steps.filter((s) => s.groupIndex === 1);
        expect(first.map((s) => s.beadIndex)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
        expect(beadsPerGroup(chaplet)).toBe(11);
    });

    it('counts the closing prayer of a group as a bead when there is one', () => {
        const chaplet = getChaplet('doze-estrelas')!;
        expect(beadsPerGroup(chaplet)).toBe(1 + chaplet.smallBeads + 1);
        const steps = generateChapletSequence(chaplet);
        expect(steps.filter((s) => s.kind === 'remate')).toHaveLength(chaplet.groups.length);
    });

    it('uses the per-bead texts where a group provides them', () => {
        const steps = generateChapletSequence(getChaplet('doze-estrelas')!);
        const firstBead = steps.find((s) => s.groupIndex === 1 && s.beadIndex === 1)!;
        expect(firstBead.content).toContain('predestinou para Mãe');
    });

    it('marks a repeated prayer as such', () => {
        const steps = generateChapletSequence(getChaplet('divina-misericordia')!);
        const last = steps.find((s) => s.title === 'Deus santo')!;
        expect(last.content).toContain('(3 vezes)');
    });

    it('opens and closes with the once-said prayers', () => {
        const steps = generateChapletSequence(getChaplet('lagrimas')!);
        expect(steps[0].kind).toBe('abertura');
        expect(steps[steps.length - 1].kind).toBe('final');
    });
});
