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

    it('lifts a refrain out of a header that carries no emphasis (2026-09-06)', () => {
        const doc = render(
            '<p>SALMO RESPONSORIAL Salmo 94 (95), 1-2.6-7.8-9 (R. cf. 8)<br />\n' +
            'Refrão: Se hoje ouvirdes a voz do Senhor,<br />\n' +
            'não fecheis os vossos corações.<br />\n' +
            'Repete-se</p>\n' +
            '<p>Vinde, exultemos de alegria no Senhor,<br />\n' +
            'aclamemos a Deus, nosso Salvador. Refrão</p>'
        );

        const header = doc.querySelector('#salmo');
        expect(header?.className).toBe('reading-section-header');
        expect(header?.getAttribute('data-toc-label')).toBe('Salmo Responsorial');
        expect(header?.querySelector('.reading-ref')?.textContent?.trim())
            .toBe('Salmo 94 (95), 1-2.6-7.8-9 (R. cf. 8)');
        expect(refrainLines(doc))
            .toEqual(['℟ Se hoje ouvirdes a voz do Senhor, não fecheis os vossos corações.']);
        expect(repeatsNote(doc)).toBe('Repete-se');
        // the refrain lines are gone from the header, not doubled up in it
        expect(header?.textContent).not.toContain('Refrão');
        expect(Array.from(doc.querySelectorAll('.psalm-cue')).map((e) => e.textContent))
            .toEqual(['℟ Refrão']);
    });

    it('reads a header whose bold is cut across the label', () => {
        const doc = render(
            '<p><strong>SALMO</strong> RESPONSORIAL Salmo 94 (95), 1-2 (R. cf. 8)<br />\n' +
            'Refrão: Se hoje ouvirdes a voz do Senhor. Repete-se</p>'
        );

        expect(doc.querySelector('#salmo')?.querySelector('.reading-label')?.textContent)
            .toBe('SALMO RESPONSORIAL');
        expect(doc.querySelector('.reading-ref')?.textContent?.trim()).toBe('Salmo 94 (95), 1-2 (R. cf. 8)');
        expect(refrainLines(doc)).toEqual(['℟ Se hoje ouvirdes a voz do Senhor.']);
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

    it('picks up an unemphasized reading header, reference and all', () => {
        const doc = render(
            '<p>LEITURA II Rm 13, 8-10<br />\n«O amor é a plenitude da Lei»</p>\n' +
            '<p>Leitura da Epístola do apóstolo São Paulo aos Romanos<br />\n' +
            'Irmãos: A ninguém fiqueis a dever coisa alguma.<br />\n' +
            'Palavra do Senhor.</p>'
        );

        expect(doc.querySelector('#leitura-ii')?.getAttribute('data-toc-label')).toBe('Leitura II');
        expect(doc.querySelector('#leitura-ii .reading-ref')?.textContent?.trim()).toBe('Rm 13, 8-10');
        expect(doc.querySelector('#leitura-ii .reading-title')?.textContent)
            .toBe('«O amor é a plenitude da Lei»');
        expect(doc.querySelector('.reading-source')?.textContent)
            .toBe('Leitura da Epístola do apóstolo São Paulo aos Romanos');
    });

    it('keeps the fourth reading whole, numeral and all', () => {
        // "IV" opens with the "I" of the shorter numerals: matched in the
        // wrong order the header reads "LEITURA I" and its reference starts
        // with the leftover "V".
        const doc = render(
            '<p>LEITURA IV Dan 3, 14-20<br />\n«Deus enviou o seu anjo»</p>\n' +
            '<p><strong>LEITURA IV</strong> Dan 3, 14-20<br />\n«Deus enviou o seu anjo»</p>'
        );

        const headers = Array.from(doc.querySelectorAll('[data-toc-label]'));
        expect(headers.map((h) => h.querySelector('.reading-label')?.textContent))
            .toEqual(['LEITURA IV', 'LEITURA IV']);
        expect(headers.map((h) => h.getAttribute('data-toc-label')))
            .toEqual(['Leitura IV (Dan 3)', 'Leitura IV (Dan 3)']);
        expect(headers.map((h) => h.querySelector('.reading-ref')?.textContent?.trim()))
            .toEqual(['Dan 3, 14-20', 'Dan 3, 14-20']);
    });

    it('does not read the Gospel attribution as a header of its own', () => {
        // "Evangelho de Nosso Senhor…" opens the body of every Gospel; only
        // the ALL-CAPS label the missal prints is a section header.
        const doc = render(
            '<p><strong>EVANGELHO</strong> Mt 18, 15-20<br />\n«Se te ouvir, ganhaste o teu irmão»</p>\n' +
            '<p>Evangelho de Nosso Senhor Jesus Cristo segundo São Mateus<br />\n' +
            'Naquele tempo, disse Jesus aos seus discípulos:<br />\n' +
            'Palavra da salvação.</p>'
        );

        expect(Array.from(doc.querySelectorAll('[data-toc-label]')).map((e) => e.id)).toEqual(['evangelho']);
        expect(doc.querySelector('.reading-source')?.textContent)
            .toBe('Evangelho de Nosso Senhor Jesus Cristo segundo São Mateus');
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

    it('gives the Sequence a section of its own, verse lines kept', () => {
        // Easter, Pentecost, Corpus Christi: a hymn between the second reading
        // and the Alleluia, its verses <br>-separated in the label's paragraph.
        const doc = render(
            '<p><strong>LEITURA II</strong> Col 3, 1-4<br />\n«Buscai as coisas do alto»</p>\n' +
            '<p><strong>SEQUÊNCIA</strong><br />\n' +
            'Cristãos, oferecei<br />\n' +
            'à Vítima pascal<br />\n' +
            'sacrifícios de louvor.</p>\n' +
            '<p>O Cordeiro resgatou as ovelhas:<br />\n' +
            'Cristo inocente reconciliou<br />\n' +
            'os pecadores com o Pai.</p>\n' +
            '<p><strong>EVANGELHO</strong> Jo 20, 1-9<br />\n«Ele devia ressuscitar»</p>'
        );

        const header = doc.querySelector('#sequencia');
        expect(header?.className).toBe('reading-section-header');
        expect(header?.getAttribute('data-toc-label')).toBe('Sequência');
        expect(header?.querySelector('.reading-label')?.textContent).toBe('SEQUÊNCIA');
        // no scripture reference, and the verses are not folded into a title
        expect(header?.querySelector('.reading-ref')).toBeNull();
        expect(header?.querySelector('.reading-title')).toBeNull();
        expect(header?.textContent?.trim()).toBe('SEQUÊNCIA');

        const hymn = header?.nextElementSibling;
        expect(hymn?.tagName).toBe('P');
        expect(hymn?.className).toBe('');
        expect(hymn?.innerHTML).toBe('\nCristãos, oferecei<br>\nà Vítima pascal<br>\nsacrifícios de louvor.');
        expect(hymn?.nextElementSibling?.textContent).toContain('O Cordeiro resgatou as ovelhas');

        expect(Array.from(doc.querySelectorAll('[data-toc-label]')).map((e) => e.id))
            .toEqual(['leitura-ii', 'sequencia', 'evangelho']);
    });

    it('shows a rubric on the Sequence label line where a reference would go', () => {
        // Our Lady of Sorrows: the Stabat Mater is optional, and the missal
        // says so beside the label.
        const doc = render(
            '<p><strong>SEQUÊNCIA</strong> (ad libitum)<br />\n' +
            'Estava a Mãe dolorosa<br />\n' +
            'junto da cruz, lacrimosa.</p>'
        );

        const header = doc.querySelector('#sequencia');
        expect(header?.querySelector('.reading-ref')?.textContent).toBe('(ad libitum)');
        expect(header?.nextElementSibling?.innerHTML)
            .toBe('\nEstava a Mãe dolorosa<br>\njunto da cruz, lacrimosa.');
    });

    it('reads a Sequence label that carries no emphasis, accent or not', () => {
        const doc = render(
            '<p>SEQUENCIA<br />\nVinde, ó Santo Espírito,<br />\nvinde, Amor ardente.</p>'
        );

        const header = doc.querySelector('#sequencia');
        expect(header?.className).toBe('reading-section-header');
        expect(header?.getAttribute('data-toc-label')).toBe('Sequência');
        expect(header?.nextElementSibling?.textContent).toContain('Vinde, ó Santo Espírito,');
    });

    it('keeps an optional Sequence printed in italics out of the commentary fold', () => {
        // Our Lady of Sorrows: the Stabat Mater is ad libitum, and the missal
        // sets optional parts in italics, label and stanzas alike — exactly
        // the shape a folded-away commentary has.
        const doc = render(
            '<p><strong>SALMO RESPONSORIAL</strong> Salmo 30 (31), 2-3a (R. 17b)<br />\n' +
            'Refrão: Salvai-me, Senhor, pela vossa misericórdia. Repete-se</p>\n' +
            '<p><em>Sequência (facultativa)</em></p>\n' +
            '<p><em>Estava a Mãe dolorosa</em><br />\n<em>junto da cruz, lacrimosa,</em><br />\n' +
            '<em>vendo o Filho que pendia.</em></p>\n' +
            '<p><em>Sua alma agoniada,</em><br />\n<em>triste e amargurada,</em><br />\n' +
            '<em>uma espada traspassava.</em></p>\n' +
            '<p><strong>ALELUIA</strong><br />\nRefrão: Aleluia. Repete-se<br />\n' +
            '<em>Feliz a Virgem Maria.</em></p>\n' +
            '<p><strong>EVANGELHO</strong> Jo 19, 25-27<br />\n«Eis o teu filho»</p>'
        );

        const header = doc.querySelector('#sequencia');
        expect(header?.className).toBe('reading-section-header');
        expect(header?.getAttribute('data-toc-label')).toBe('Sequência');
        expect(header?.querySelector('.reading-ref')?.textContent).toBe('(facultativa)');
        // the stanzas stay in view, not behind a "Comentário" toggle
        expect(doc.querySelector('.reading-commentary')).toBeNull();
        expect(header?.nextElementSibling?.textContent).toContain('Estava a Mãe dolorosa');
        expect(Array.from(doc.querySelectorAll('[data-toc-label]')).map((e) => e.id))
            .toEqual(['salmo', 'sequencia', 'aleluia', 'evangelho']);
    });

    it('still folds a commentary that follows the Sequence section', () => {
        const doc = render(
            '<p><em>Sequência</em><br />\n<em>Estava a Mãe dolorosa.</em></p>\n' +
            '<p><strong>EVANGELHO</strong> Jo 19, 25-27<br />\n«Eis o teu filho»</p>\n' +
            '<p><em>O evangelista mostra-nos Maria junto da cruz.</em></p>'
        );

        expect(doc.querySelector('#sequencia')?.nextElementSibling?.textContent)
            .toContain('Estava a Mãe dolorosa.');
        expect(doc.querySelector('.reading-commentary .commentary-body')?.textContent)
            .toBe('O evangelista mostra-nos Maria junto da cruz.');
    });

    it('reads a mixed-case Sequence label with no markup at all', () => {
        const doc = render(
            '<p>Sequência (ad libitum)<br />\nEstava a Mãe dolorosa<br />\njunto da cruz, lacrimosa.</p>'
        );

        const header = doc.querySelector('#sequencia');
        expect(header?.querySelector('.reading-label')?.textContent).toBe('Sequência');
        expect(header?.querySelector('.reading-ref')?.textContent).toBe('(ad libitum)');
        expect(header?.nextElementSibling?.innerHTML)
            .toBe('\nEstava a Mãe dolorosa<br>\njunto da cruz, lacrimosa.');
    });

    it('leaves a Sequence header alone when the hymn has its own paragraph', () => {
        const doc = render(
            '<p><strong>SEQUÊNCIA</strong></p>\n' +
            '<p>Terra, exulta de alegria,<br />\nlouva o teu pastor e guia.</p>'
        );

        const header = doc.querySelector('#sequencia');
        expect(header?.textContent).toBe('SEQUÊNCIA');
        expect(doc.querySelectorAll('p')).toHaveLength(2);
        expect(header?.nextElementSibling?.textContent).toContain('Terra, exulta de alegria,');
    });

    it('stops colouring "Refrão" cues at the Sequence', () => {
        // The psalm's cue walk runs to the next section header; the Sequence
        // is one now, so a hymn verse ending in that word is not a cue.
        const doc = render(
            '<p><strong>SALMO RESPONSORIAL</strong> Salmo 117 (118), 1-2 (R. 24)<br />\n' +
            'Refrão: Este é o dia que o Senhor fez. Repete-se</p>\n' +
            '<p>Dai graças ao Senhor, porque Ele é bom. Refrão</p>\n' +
            '<p><strong>SEQUÊNCIA</strong><br />\nCristãos, oferecei<br />\nRefrão</p>'
        );

        expect(doc.querySelectorAll('.psalm-cue')).toHaveLength(1);
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

    it('finds the readings when no label is marked up at all (2026-09-06)', () => {
        const bareReadings = '<p>LEITURA I Ez 33, 7-9<br />\n«Se não falares ao pecador»</p>\n'
            + '<p>EVANGELHO Mt 18, 15-20<br />\nPalavra da salvação.</p>\n';
        const html = '<p><b>Antífona de entrada</b><br />\nOs pensamentos do Senhor.</p>\n'
            + bareReadings
            + '<p><b>Oração sobre as oblatas</b><br />\nSuba até Vós, Senhor.</p>';

        expect(extractReadings(html)).toBe(bareReadings);
    });

    it('drops an unemphasized Alleluia verse too', () => {
        const html = '<p>LEITURA I Ez 33, 7-9<br />\n«Se não falares ao pecador»</p>\n'
            + '<p>ALELUIA 2 Cor 5, 19<br />\nRefrão: Aleluia. Repete-se</p>\n'
            + '<p>EVANGELHO Mt 18, 15-20<br />\nPalavra da salvação.</p>\n';

        expect(extractReadings(html)).not.toContain('ALELUIA');
        expect(extractReadings(html)).toContain('EVANGELHO');
    });

    it('finds the readings when the bold is cut across the label', () => {
        const splitReadings = '<p><strong>LEITURA</strong> I Dt 8, 2-3<br />\n«Deu-te o alimento»</p>\n'
            + '<p><b>EVANGE</b>LHO Jo 6, 51<br />\nPalavra da salvação.</p>\n';
        const html = '<p><b>Antífona de entrada</b><br />\nOs pensamentos do Senhor.</p>\n'
            + splitReadings
            + '<p><b>Oração sobre as oblatas</b><br />\nSuba até Vós, Senhor.</p>';

        expect(extractReadings(html)).toBe(splitReadings);
    });

    it('drops the Alleluia verse whatever emphasis frames the labels', () => {
        const html = '<p><strong>LEITURA I</strong> Dt 8, 2-3<br />\n«Deu-te o alimento»</p>\n'
            + '<p><b>ALELUIA</b> Jo 6, 51<br />\nRefrão: Aleluia. Repete-se</p>\n'
            + '<p>EVANGELHO Jo 6, 51<br />\nPalavra da salvação.</p>\n';

        // the verse goes, and the readings around it keep their own markup
        expect(extractReadings(html)).toBe(
            '<p><strong>LEITURA I</strong> Dt 8, 2-3<br />\n«Deu-te o alimento»</p>\n'
            + '<p>EVANGELHO Jo 6, 51<br />\nPalavra da salvação.</p>\n'
        );
    });

    it('keeps the Sequence in the readings view', () => {
        const html = '<p><strong>LEITURA II</strong> Col 3, 1-4<br />\n«Buscai as coisas do alto»</p>\n'
            + '<p><strong>SEQUÊNCIA</strong><br />\nCristãos, oferecei<br />\nà Vítima pascal.</p>\n'
            + '<p><strong>ALELUIA</strong> 1 Cor 5, 7b-8a<br />\nRefrão: Aleluia. Repete-se</p>\n'
            + '<p><strong>EVANGELHO</strong> Jo 20, 1-9<br />\nPalavra da salvação.</p>\n';

        // LEITURA II alone can't open the slice; frame it with a first reading
        const readings = '<p><strong>LEITURA I</strong> Act 10, 34a.37-43<br />\n«Comemos e bebemos com Ele»</p>\n' + html;
        const result = extractReadings(readings);
        expect(result).toContain('SEQUÊNCIA');
        expect(result).toContain('Cristãos, oferecei');
        expect(result).not.toContain('ALELUIA');
    });

    it('does not drop a Sequence printed after the Alleluia along with the verse', () => {
        const html = '<p><strong>LEITURA I</strong> Act 10, 34a.37-43<br />\n«Comemos e bebemos com Ele»</p>\n'
            + '<p><strong>ALELUIA</strong> 1 Cor 5, 7b-8a<br />\nRefrão: Aleluia. Repete-se</p>\n'
            + '<p><strong>SEQUÊNCIA</strong><br />\nCristãos, oferecei<br />\nà Vítima pascal.</p>\n'
            + '<p><strong>EVANGELHO</strong> Jo 20, 1-9<br />\nPalavra da salvação.</p>\n';

        const result = extractReadings(html);
        expect(result).not.toContain('ALELUIA');
        expect(result).toContain('SEQUÊNCIA');
        expect(result).toContain('EVANGELHO');
    });

    it('leaves a psalm refrain of "Aleluia" alone', () => {
        // The bare-label pass is ALL-CAPS only, so a refrain that reads
        // "Aleluia." can't swallow the psalm and the Gospel with it.
        const html = '<p>LEITURA I Ez 33, 7-9<br />\n«Se não falares ao pecador»</p>\n'
            + '<p>SALMO RESPONSORIAL Salmo 94 (95), 1-2<br />\nRefrão: Aleluia. Repete-se</p>\n'
            + '<p>Aleluia. Repete-se</p>\n'
            + '<p>EVANGELHO Mt 18, 15-20<br />\nPalavra da salvação.</p>\n';

        expect(extractReadings(html)).toBe(html);
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
