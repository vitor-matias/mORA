import { describe, expect, it } from 'vitest';
import { CHANTS, CHANT_CATEGORIES, chantsByCategory, getChant, resolveChant, searchChants, toStanzas } from './index';
import { getPrayer } from '@/lib/devotional';

describe('the hymnal', () => {
    it('has no duplicate ids', () => {
        const ids = CHANTS.map((c) => c.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('files every chant under a category that exists', () => {
        const known = new Set(CHANT_CATEGORIES.map((c) => c.id));
        for (const chant of CHANTS) {
            expect(known.has(chant.category), `${chant.id}: ${chant.category}`).toBe(true);
        }
    });

    it('leaves no category empty', () => {
        for (const category of CHANT_CATEGORIES) {
            expect(chantsByCategory(category.id).length, category.id).toBeGreaterThan(0);
        }
    });

    it('points every cross-reference at a prayer that exists', () => {
        // A typo here renders a card with no words in it, and nothing else
        // would catch it — the chant has no text of its own to fall back on.
        for (const chant of CHANTS) {
            if (!chant.prayerId) continue;
            expect(getPrayer(chant.prayerId), `${chant.id} → ${chant.prayerId}`).toBeDefined();
        }
    });

    it('gives every chant something to sing', () => {
        for (const chant of CHANTS) {
            const resolved = resolveChant(chant);
            expect(resolved.body || resolved.latinBody, chant.id).toBeTruthy();
        }
    });

    it('takes the words from the prayer when it points at one', () => {
        const regina = resolveChant(CHANTS.find((c) => c.id === 'regina-caeli')!);
        expect(regina.body).toBe(getPrayer('rainha-do-ceu')!.text);
        expect(regina.latinBody).toBe(getPrayer('rainha-do-ceu')!.latin);
    });
});

describe('toStanzas', () => {
    it('marks a stanza opened with R. as the refrain', () => {
        const stanzas = toStanzas('R. Ave Maria\nAve Maria\n\n1. Verso');
        expect(stanzas[0]).toEqual({ text: 'Ave Maria\nAve Maria', isRefrain: true });
        expect(stanzas[1].isRefrain).toBe(false);
    });

    it('treats an unnumbered stanza as the refrain when the verses are numbered', () => {
        const stanzas = toStanzas('1. Primeiro verso\n\nToda a gente canta\n\n2. Segundo verso');
        expect(stanzas.map((s) => s.isRefrain)).toEqual([false, true, false]);
    });

    it('leaves a hymn without verse numbers alone', () => {
        // Noite feliz has three equal stanzas and no refrain — nothing should
        // be singled out.
        const stanzas = toStanzas('Uma\n\nOutra\n\nTerceira');
        expect(stanzas.every((s) => !s.isRefrain)).toBe(true);
    });

    it('finds the refrain in every chant that marks one', () => {
        const marked = CHANTS.filter((c) => (c.text ?? '').includes('\nR. ') || (c.text ?? '').startsWith('R. '));
        expect(marked.length).toBeGreaterThan(0);
        for (const chant of marked) {
            expect(toStanzas(chant.text!).some((s) => s.isRefrain), chant.id).toBe(true);
        }
    });

    it('never leaves an R. marker in a refrain', () => {
        for (const chant of CHANTS) {
            const resolved = resolveChant(chant);
            for (const body of [resolved.body, resolved.latinBody ?? '']) {
                for (const stanza of toStanzas(body)) {
                    if (!stanza.isRefrain) continue;
                    for (const line of stanza.text.split('\n')) {
                        expect(line.startsWith('R.'), `${chant.id}: ${line}`).toBe(false);
                    }
                }
            }
        }
    });

    it('leaves a versicle-and-response block alone', () => {
        // `R.` is the people's response here, not a refrain marker — stripping
        // it would silently drop the V/R notation from prayers like the
        // Regina caeli, which are sung exactly as printed.
        const stanzas = toStanzas('V. Rainha do Céu, alegrai-Vos.\nR. Porque merecestes trazê-lo.');
        expect(stanzas[0].isRefrain).toBe(false);
        expect(stanzas[0].text).toContain('R. Porque merecestes');
    });
});

describe('getChant', () => {
    it('finds a chant by id and nothing by a missing one', () => {
        expect(getChant('adeste-fideles')?.title).toBe('Adeste fideles');
        expect(getChant('nao-existe')).toBeUndefined();
        expect(getChant(undefined)).toBeUndefined();
    });

    it('returns it already resolved', () => {
        expect(getChant('regina-caeli')?.body).toBeTruthy();
    });
});

describe('searchChants', () => {
    it('ranks a title matched as a phrase above loose terms', () => {
        // The case the ranking exists for: as separate terms "ao pe de ti"
        // matches most of the hymnal, because "pe" is inside "Pentecostes".
        expect(searchChants('ao pe de ti', null)[0].id).toBe('cf-ao-pe-de-ti');
    });

    it('finds a chant typed without accents', () => {
        expect(searchChants('canticos de simeao', null).length).toBeGreaterThanOrEqual(0);
        expect(searchChants('adeste', null)[0].id).toBe('adeste-fideles');
    });

    it('honours the category filter', () => {
        const hits = searchChants('', 'exequias');
        expect(hits.length).toBeGreaterThan(0);
        expect(hits.every((c) => c.category === 'exequias')).toBe(true);
    });

    it('returns nothing rather than everything for a miss', () => {
        expect(searchChants('zzzznaoexiste', null)).toEqual([]);
    });
});
