// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { enrichReadingHtml, extractReadings, parseRefrainBlock } from './readingHtml';

// Every fixture below is upstream markup, copied verbatim from the liturgy
// API for the date named. The API varies the shape day to day, and each of
// these shapes has broken the reading view at some point.

/** The rendered document, for querying. */
function render(html: string): Document {
    return new DOMParser().parseFromString(enrichReadingHtml(html), 'text/html');
}

/** The refrain box under the psalm header, as [refrain, ...alternatives]. */
function refrainLines(doc: Document): string[] {
    const box = doc.querySelector('.psalm-refrain');
    if (!box) return [];
    const alts = Array.from(box.querySelectorAll('.psalm-refrain-alt')).map((e) => e.textContent ?? '');
    const clone = box.cloneNode(true) as Element;
    clone.querySelectorAll('.psalm-refrain-alt, .psalm-refrain-note').forEach((e) => e.remove());
    return [(clone.textContent ?? '').trim(), ...alts];
}

const repeatsNote = (doc: Document) => doc.querySelector('.psalm-refrain-note')?.textContent ?? null;

describe('parseRefrainBlock', () => {
    it('reads a refrain that spans two lines', () => {
        expect(parseRefrainBlock([
            'Refrão: Dai graças ao Senhor, porque Ele é bom,',
            'porque é eterna a sua misericórdia. Repete-se',
        ])).toEqual({
            refrains: ['Dai graças ao Senhor, porque Ele é bom, porque é eterna a sua misericórdia.'],
            repeats: true,
            trailing: [],
        });
    });

    it('splits "Ou:" alternatives out of the refrain', () => {
        expect(parseRefrainBlock([
            'Refrão: Glória, Senhor, ao vosso nome! Repete-se',
            'Ou: Aleluia. Repete-se',
        ])).toEqual({
            refrains: ['Glória, Senhor, ao vosso nome!', 'Aleluia.'],
            repeats: true,
            trailing: [],
        });
    });

    it('accepts "Repete-se" on a line of its own', () => {
        expect(parseRefrainBlock([
            'Refrão: O Senhor está perto de quantos O invocam.',
            'Repete-se',
        ])).toEqual({
            refrains: ['O Senhor está perto de quantos O invocam.'],
            repeats: true,
            trailing: [],
        });
    });

    it('hands back body text the API spilled in past the rubric', () => {
        expect(parseRefrainBlock([
            'Refrão: A minha alma tem sede de Vós, meu Deus.',
            'Repete-se',
            'Senhor, sois o meu Deus:',
            'desde a aurora Vos procuro.',
        ])).toEqual({
            refrains: ['A minha alma tem sede de Vós, meu Deus.'],
            repeats: true,
            trailing: ['Senhor, sois o meu Deus:', 'desde a aurora Vos procuro.'],
        });
    });

    it('leaves the flag down when the missal prints no "Repete-se"', () => {
        expect(parseRefrainBlock([
            'Refrão: Em todo o tempo e lugar bendirei o Senhor.',
            'Ou: Saboreai e vede como o Senhor é bom.',
        ])).toEqual({
            refrains: ['Em todo o tempo e lugar bendirei o Senhor.', 'Saboreai e vede como o Senhor é bom.'],
            repeats: false,
            trailing: [],
        });
    });
});

describe('the responsorial-psalm refrain', () => {
    it('keeps a refrain that arrives wrapped in <em> (2026-08-23)', () => {
        const doc = render(
            '<p><strong>SALMO RESPONSORIAL</strong> Salmo 137 (138), 1-2a.2bc-3.6. 8bc (R. 8bc)<br />\n' +
            'Refrão: <em>Senhor, a vossa misericórdia é eterna:</em><br />\n' +
            '<em>não abandoneis a obra das vossas mãos.</em> Repete-se</p>\n' +
            '<p>Ou: <em>Pela vossa misericórdia,</em><br />\n' +
            '<em>não nos abandoneis, Senhor.</em> Repete-se</p>'
        );

        expect(refrainLines(doc)).toEqual([
            '℟ Senhor, a vossa misericórdia é eterna: não abandoneis a obra das vossas mãos.',
            'Ou: Pela vossa misericórdia, não nos abandoneis, Senhor.',
        ]);
        expect(repeatsNote(doc)).toBe('Repete-se');
        // the header keeps only its reference — no italic text stranded in it
        expect(doc.querySelector('#salmo')?.textContent)
            .toBe('SALMO RESPONSORIAL Salmo 137 (138), 1-2a.2bc-3.6. 8bc (R. 8bc)');
    });

    it('separates an "Ou:" alternative sharing the header (2026-05-04)', () => {
        const doc = render(
            '<p><strong>SALMO RESPONSORIAL</strong> Salmo 113 B (115), 1-2.3-4.15-16 (R. 1b)<br />\n' +
            'Refrão: Glória, Senhor, ao vosso nome! Repete-se<br />\n' +
            'Ou: Aleluia. Repete-se</p>'
        );

        expect(refrainLines(doc)).toEqual(['℟ Glória, Senhor, ao vosso nome!', 'Ou: Aleluia.']);
        expect(repeatsNote(doc)).toBe('Repete-se');
    });

    it('lifts a multi-line refrain paragraph that follows the header (2026-07-30)', () => {
        const doc = render(
            '<p><strong>SALMO RESPONSORIAL</strong> Salmo 145 (146), 2abc.2d-4.5-6 (R.5a)</p>\n' +
            '<p>Refrão: Feliz o que tem por auxílio o Deus de Jacob. Repete-se<br />\n' +
            'Ou: Aleluia. Repete-se</p>'
        );

        expect(refrainLines(doc)).toEqual(['℟ Feliz o que tem por auxílio o Deus de Jacob.', 'Ou: Aleluia.']);
        // the plain paragraph is consumed, not left sitting there as body text
        expect(doc.body.textContent).not.toContain('Refrão: Feliz');
    });

    it('gathers alternatives that each get their own paragraph (2026-04-12)', () => {
        const doc = render(
            '<p><strong>SALMO RESPONSORIAL</strong> Salmo 117 (118), 2-4.13-15.22-24 (R. 1)<br />\n' +
            'Refrão: Dai graças ao Senhor, porque Ele é bom,<br />\n' +
            'porque é eterna a sua misericórdia. Repete-se</p>\n' +
            '<p>Ou: Aclamai o Senhor, porque Ele é bom:<br />\n' +
            'o seu amor é para sempre. Repete-se</p>\n' +
            '<p>Ou: Aleluia. Repete-se</p>'
        );

        expect(refrainLines(doc)).toEqual([
            '℟ Dai graças ao Senhor, porque Ele é bom, porque é eterna a sua misericórdia.',
            'Ou: Aclamai o Senhor, porque Ele é bom: o seu amor é para sempre.',
            'Ou: Aleluia.',
        ]);
        expect(doc.querySelectorAll('.psalm-refrain')).toHaveLength(1);
    });

    it('rescues a stanza the API ran into the refrain paragraph (2026-08-30)', () => {
        const doc = render(
            '<p><strong>SALMO RESPONSORIAL</strong> Salmo 62 (63), 2.3-4.5-6.8-9 (R. 2b)<br />\n' +
            'Refrão: A minha alma tem sede de Vós, meu Deus.<br />\n' +
            'Repete-se<br />\n' +
            'Senhor, sois o meu Deus:<br />\n' +
            'desde a aurora Vos procuro.</p>'
        );

        expect(refrainLines(doc)).toEqual(['℟ A minha alma tem sede de Vós, meu Deus.']);
        const stanza = doc.querySelector('.psalm-refrain')?.nextElementSibling;
        expect(stanza?.className).toBe('');
        expect(stanza?.innerHTML).toBe('Senhor, sois o meu Deus:<br>desde a aurora Vos procuro.');
    });

    it('returns a broken-off "(R. …)" line to the scripture reference (2026-05-19)', () => {
        const doc = render(
            '<p><strong>SALMO RESPONSORIAL</strong> Salmo 67 (68), 10-11.20-21<br />\n' +
            '(R. 33a ou Aleluia)<br />\n' +
            'Refrão: Povos da terra, cantai ao Senhor. Repete-se<br />\n' +
            'Ou: Aleluia. Repete-se</p>'
        );

        expect(doc.querySelector('.reading-ref')?.textContent?.trim())
            .toBe('Salmo 67 (68), 10-11.20-21 (R. 33a ou Aleluia)');
        expect(doc.querySelector('.reading-title')).toBeNull();
    });

    it('keeps a refrain wrapped in <strong> (2026-06-23 vigil)', () => {
        const doc = render(
            '<p><strong>SALMO RESPONSORIAL</strong> Salmo 70 (71), 1-2.3-4a.5-6ab.15ab e 17 (R. cf. 6b)<br />\n' +
            'Refrão: <strong>Desde o meu nascimento, sois a minha esperança.</strong></p>'
        );

        expect(refrainLines(doc)).toEqual(['℟ Desde o meu nascimento, sois a minha esperança.']);
        expect(repeatsNote(doc)).toBeNull();
    });

    it('marks the "Refrão" cue closing each stanza', () => {
        const doc = render(
            '<p><strong>SALMO RESPONSORIAL</strong> Salmo 145 (146), 2abc (R.5a)<br />\n' +
            'Refrão: Feliz o que tem por auxílio o Deus de Jacob. Repete-se</p>\n' +
            '<p>Louva, minha alma, o Senhor.<br />\n' +
            'enquanto viver. Refrão</p>'
        );

        const cues = Array.from(doc.querySelectorAll('.psalm-cue')).map((e) => e.textContent);
        expect(cues).toEqual(['℟ Refrão']);
        expect(doc.querySelector('.psalm-cue')?.parentElement?.textContent)
            .toContain('enquanto viver.');
    });
});

describe('section headers', () => {
    it('reads labels marked up with <b> as well as <strong> (2026-06-04)', () => {
        const doc = render(
            '<p><b>SALMO RESPONSORIAL</b> Salmo 147, 12-13.14-15.19-20<br />\n' +
            '(R. 12a ou Aleluia)<br />\n' +
            'Refrão: Jerusalém, louva o teu Senhor. Repete-se<br />\n' +
            'Ou: Aleluia. Repete-se</p>'
        );

        const header = doc.querySelector('#salmo');
        expect(header?.className).toBe('reading-section-header');
        expect(header?.getAttribute('data-toc-label')).toBe('Salmo Responsorial');
        expect(refrainLines(doc)).toEqual(['℟ Jerusalém, louva o teu Senhor.', 'Ou: Aleluia.']);
    });

    it('still treats a <b> Mass part as a prayer header', () => {
        const doc = render(
            '<p><b>Oração coleta</b><br />\nSenhor nosso Deus,<br />\nconduzi a vossa família.</p>'
        );

        const header = doc.querySelector('p');
        expect(header?.className).toBe('reading-prayer-header');
        expect(header?.querySelector('.reading-prayer-label')?.textContent).toBe('Oração coleta');
    });

    it('leaves a reading commentary out of the header title', () => {
        // The refrain parsing folds inline markup into a psalm header's title.
        // Reading headers must not do the same: theirs is a whole commentary.
        const commentary = 'Esta leitura, que se refere à vocação do profeta Jeremias, '
            + 'ajuda-nos a compreender a vocação e a missão de João Batista.';
        const doc = render(
            '<p><strong>LEITURA I</strong> Jer 1, 4-10<br />\n' +
            '«Antes de te formar no seio materno, Eu te escolhi»<br />\n' +
            `<em>${commentary}</em></p>`
        );

        expect(doc.querySelector('.reading-title')?.textContent)
            .toBe('«Antes de te formar no seio materno, Eu te escolhi»');
        expect(doc.querySelector('.reading-section-header em')?.textContent).toBe(commentary);
    });

    it('splits the reference, title and closing line of a reading', () => {
        const doc = render(
            '<p><strong>LEITURA II</strong> Rm 11, 33-36<br />\n' +
            '«D’Ele, por Ele e para Ele são todas as coisas»</p>\n' +
            '<p>Leitura da Epístola do apóstolo São Paulo aos Romanos<br />\n' +
            'Como é profunda a riqueza de Deus!<br />\n' +
            'Palavra do Senhor.</p>'
        );

        expect(doc.querySelector('#leitura-ii .reading-ref')?.textContent?.trim()).toBe('Rm 11, 33-36');
        expect(doc.querySelector('#leitura-ii .reading-title')?.textContent)
            .toBe('«D’Ele, por Ele e para Ele são todas as coisas»');
        expect(doc.querySelector('.reading-source')?.textContent)
            .toBe('Leitura da Epístola do apóstolo São Paulo aos Romanos');
        expect(doc.querySelector('.reading-ending')?.textContent).toBe('Palavra do Senhor.');
    });

    it('suffixes the anchor id when a day repeats a section', () => {
        const doc = render(
            '<p><strong>EVANGELHO</strong> Lc 10, 38-42<br />\n«Marta recebeu-O»</p>\n' +
            '<p><strong>EVANGELHO</strong> Jo 11, 19-27<br />\n«Eu sou a ressurreição»</p>'
        );

        const ids = Array.from(doc.querySelectorAll('[data-toc-label]')).map((e) => e.id);
        expect(ids).toEqual(['evangelho', 'evangelho-2']);
        const labels = Array.from(doc.querySelectorAll('[data-toc-label]'))
            .map((e) => e.getAttribute('data-toc-label'));
        expect(labels).toEqual(['Evangelho (Lc 10)', 'Evangelho (Jo 11)']);
    });
});

describe('extractReadings', () => {
    const readings = '<p><strong>LEITURA I</strong> Dt 8, 2-3<br />\n«Deu-te o alimento»</p>\n'
        + '<p><strong>EVANGELHO</strong> Jo 6, 51<br />\nPalavra da salvação.</p>\n';

    it('drops the prayers framing the readings', () => {
        const html = '<p><strong>Antífona de entrada</strong><br />\nOs pensamentos do Senhor.</p>\n'
            + readings
            + '<p><strong>Oração sobre as oblatas</strong><br />\nSuba até Vós, Senhor.</p>';

        expect(extractReadings(html)).toBe(readings);
    });

    it('finds the readings when the labels are marked up with <b> (2026-06-04)', () => {
        const bReadings = readings.replace(/strong>/g, 'b>');
        const html = '<p><b>Antífona de entrada</b><br />\nOs pensamentos do Senhor.</p>\n'
            + bReadings
            + '<p><b>Oração sobre as oblatas</b><br />\nSuba até Vós, Senhor.</p>';

        expect(extractReadings(html)).toBe(bReadings);
    });

    it('stops at an offertory prayer that carries no emphasis at all (2026-08-15)', () => {
        const html = readings + '<p><em>Diz-se o Credo.</em></p>\n<p>Oração sobre as oblatas<br />\nSuba até Vós.</p>';

        expect(extractReadings(html)).toBe(readings);
    });

    it('drops the Alleluia verse between the psalm and the Gospel', () => {
        const html = '<p><strong>LEITURA I</strong> Dt 8, 2-3<br />\n«Deu-te o alimento»</p>\n'
            + '<p><strong>ALELUIA</strong> Jo 6, 51<br />\nRefrão: Aleluia. Repete-se</p>\n'
            + '<p><strong>EVANGELHO</strong> Jo 6, 51<br />\nPalavra da salvação.</p>\n';

        expect(extractReadings(html)).not.toContain('ALELUIA');
        expect(extractReadings(html)).toContain('EVANGELHO');
    });

    it('hands back the whole text when there is no reading to find', () => {
        const html = '<p><strong>Antífona de entrada</strong><br />\nOs pensamentos do Senhor.</p>';
        expect(extractReadings(html)).toBe(html);
    });

    it('does not mistake a later reading for the first one', () => {
        // "LEITURA I" is a prefix of "LEITURA II"/"III"/"IV". Without a token
        // boundary a day missing its first reading would be sliced from
        // whichever reading came next, losing the fallback.
        const html = '<p><strong>Antífona de entrada</strong><br />\nOs pensamentos do Senhor.</p>\n'
            + '<p><strong>LEITURA II</strong> Rm 11, 33-36<br />\n«D’Ele são todas as coisas»</p>';

        expect(extractReadings(html)).toBe(html);
    });
});
