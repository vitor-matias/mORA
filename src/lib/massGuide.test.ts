import { describe, expect, it } from 'vitest';
import { buildGuidedMassHtml, extractMassTexts } from './massGuide';

/**
 * Shapes taken from real apiapp.glauco.it responses. The two differ on
 * purpose: a Sunday marks every label with <strong>, while the Assumption
 * leaves "Oração sobre as oblatas" bare and adds an <h1> and <em> rubrics.
 */
const SUNDAY = [
    '<p><strong>Antífona de entrada</strong> Sl 83, 10-11<br />Senhor Deus, nosso protetor.</p>',
    '<p><strong>Oração coleta</strong><br />Senhor nosso Deus,<br />que preparastes bens invisíveis.</p>',
    '<p><strong>LEITURA I</strong> Is 56, 1.6-7<br />«Conduzirei os filhos dos estrangeiros»</p>',
    '<p>Leitura do Livro de Isaías<br />Eis o que diz o Senhor.<br />Palavra do Senhor.</p>',
    '<p><strong>SALMO RESPONSORIAL</strong> Salmo 66 (67)<br />Refrão: Louvado sejais, Senhor.</p>',
    '<p>Deus Se compadeça de nós. Refrão</p>',
    '<p><strong>EVANGELHO</strong> Mt 15, 21-28<br />«Mulher, é grande a tua fé»</p>',
    // A commentary paragraph precedes the text on most days, so the
    // attribution is not the first block of the body.
    '<p><i>Esta leitura vem culminar as duas anteriores.</i></p>',
    '<p>Evangelho de Nosso Senhor Jesus Cristo segundo São Mateus<br />Naquele tempo.</p>',
    '<p><strong>Oração sobre as oblatas</strong><br />Aceitai, Senhor, a nossa oblação.</p>',
    '<p><strong>Antífona da comunhão</strong> Sl 129, 7<br />No Senhor está a misericórdia.</p>',
    '<p>Ou: Cf. Jo 6, 51<br />Eu sou o pão vivo descido do céu.</p>',
    '<p><strong>Oração depois da comunhão</strong><br />Senhor, que neste sacramento.</p>',
].join('\n');

const ASSUMPTION = [
    '<h1><b>Missa do dia</b></h1>',
    '<p><strong>Antífona de entrada</strong> Cf. Ap 12, 1<br />Apareceu no céu um sinal grandioso.</p>',
    '<p>Ou: Exultemos de alegria no Senhor.</p>',
    '<p><em>Diz-se o Glória.</em></p>',
    '<p><strong>Oração coleta</strong><br />Deus todo-poderoso e eterno.</p>',
    '<p><strong>LEITURA I</strong> Ap 11, 19a<br />«Uma mulher revestida de sol»</p>',
    '<p>Leitura do Apocalipse de São João<br />O templo de Deus abriu-se no Céu.</p>',
    '<p><strong>EVANGELHO</strong> Lc 1, 39-56<br />«O Todo-Poderoso fez em mim maravilhas»</p>',
    '<p>Evangelho de Nosso Senhor Jesus Cristo segundo São Lucas<br />Naqueles dias.</p>',
    '<p><em>Diz-se o Credo.</em></p>',
    '<p>Oração sobre as oblatas<br />Suba até Vós, Senhor, a nossa humilde oferta.</p>',
    '<p><strong>Prefácio</strong> A glória da Assunção de Maria<br />V. O Senhor esteja convosco.</p>',
    '<p>Senhor, Pai santo, Deus eterno e omnipotente.</p>',
    '<p><strong>Antífona da comunhão</strong> Cf. Lc 1, 48-49<br />Todas as gerações me proclamarão.</p>',
    '<p><strong>Oração depois da comunhão</strong><br />Tendo recebido os sacramentos.</p>',
    '<p><em>Pode utilizar-se a fórmula de bênção solene.</em></p>',
].join('\n');

const BOTH = { gloria: true, credo: true };
const NEITHER = { gloria: false, credo: false };

describe('extractMassTexts', () => {
    it('picks up every slot on a Sunday', () => {
        const { slots } = extractMassTexts(SUNDAY);
        expect(Object.keys(slots).sort()).toEqual(
            ['coleta', 'comunhao', 'entrada', 'oblatas', 'poscomunhao'].sort(),
        );
    });

    it('drops the label but keeps the scripture reference and the text', () => {
        const { slots } = extractMassTexts(SUNDAY);
        expect(slots.entrada).not.toContain('Antífona de entrada');
        expect(slots.entrada).toContain('Sl 83, 10-11');
        expect(slots.entrada).toContain('Senhor Deus, nosso protetor');
    });

    it('splits the readings into one segment each, in order', () => {
        const { readings } = extractMassTexts(SUNDAY);
        expect(readings.map((r) => r.kind)).toEqual(['leitura', 'salmo', 'evangelho']);
    });

    it('keeps each reading header verbatim and its text in the body', () => {
        const { readings } = extractMassTexts(SUNDAY);
        const [first, psalm, gospel] = readings;
        // The existing typography pass keys off these <strong> headers.
        expect(first.header).toContain('<strong>LEITURA I</strong>');
        expect(first.body).toContain('Eis o que diz o Senhor');
        expect(first.body).not.toContain('SALMO'); // the next segment's
        expect(psalm.body).toContain('Deus Se compadeça');
        expect(gospel.header).toContain('<strong>EVANGELHO</strong>');
        expect(gospel.body).toContain('Naquele tempo');
    });

    it('keeps the propers out of the readings and vice versa', () => {
        const { slots, readings } = extractMassTexts(SUNDAY);
        const allReadings = readings.map((r) => r.header + r.body).join('');
        expect(allReadings).not.toContain('Aceitai, Senhor');
        expect(Object.values(slots).join('')).not.toContain('Eis o que diz o Senhor');
    });

    it('gathers continuation paragraphs into the slot they belong to', () => {
        const { slots } = extractMassTexts(SUNDAY);
        expect(slots.comunhao).toContain('No Senhor está a misericórdia');
        expect(slots.comunhao).toContain('Eu sou o pão vivo'); // the "Ou:" alternative
        expect(slots.comunhao).not.toContain('neste sacramento'); // next slot
    });

    it('handles a bare, unwrapped label', () => {
        const { slots } = extractMassTexts(ASSUMPTION);
        expect(slots.oblatas).toContain('Suba até Vós');
        expect(slots.oblatas).not.toContain('Oração sobre as oblatas');
    });

    it('leaves out the preface, and does not leak it into a neighbour', () => {
        const { slots, readings } = extractMassTexts(ASSUMPTION);
        const all = Object.values(slots).join('') + readings.map((r) => r.header + r.body).join('');
        expect(all).not.toContain('A glória da Assunção de Maria');
        expect(all).not.toContain('Pai santo, Deus eterno e omnipotente');
    });

    it('leaves out the "Diz-se o Glória" rubrics and the Mass heading', () => {
        const { slots } = extractMassTexts(ASSUMPTION);
        const all = Object.values(slots).join('');
        expect(all).not.toContain('Diz-se o');
        expect(all).not.toContain('Missa do dia');
        expect(all).not.toContain('bênção solene');
    });

    it('does not confuse the "Ou:" antiphon alternative for a new slot', () => {
        const { slots } = extractMassTexts(ASSUMPTION);
        expect(slots.entrada).toContain('Exultemos de alegria');
    });

    it('survives an empty document', () => {
        expect(extractMassTexts('')).toEqual({ slots: {}, readings: [] });
    });

    it('separates readings from the orations even on irregular markup', () => {
        // What the readings-only view is built from. The Assumption marks its
        // offertory prayer with no <strong> and wraps "Diz-se o Credo" in an
        // <em>, which is exactly what defeated the old marker-based slice and
        // let the orations and the preface leak into the readings.
        const { readings } = extractMassTexts(ASSUMPTION);
        const readingsHtml = readings.map((r) => r.header + r.body).join('');
        expect(readingsHtml).toContain('O templo de Deus abriu-se no Céu');
        expect(readingsHtml).not.toContain('Suba até Vós');            // oblatas
        expect(readingsHtml).not.toContain('A glória da Assunção');    // prefácio
        expect(readingsHtml).not.toContain('Todas as gerações');       // comunhão
        expect(readingsHtml).not.toContain('Diz-se o');                // rubric
    });

    it('keeps only the first Mass when a day carries two', () => {
        // A solemnity's text can hold a vigil Mass and a day Mass, each under
        // its own <h1>. The guided layout renders one celebration, so the
        // second Mass contributes nothing: not its propers, not its readings,
        // and not slots the first Mass happens to lack.
        const twoMasses = [
            '<h1><b>Missa da vigília</b></h1>',
            '<p><strong>Antífona de entrada</strong> Sl 1<br />Antífona da vigília.</p>',
            '<p><strong>Oração coleta</strong><br />Coleta da vigília.</p>',
            '<p><strong>LEITURA I</strong> Gn 1, 1<br />«Da vigília»</p>',
            '<p>Leitura do Livro do Génesis<br />Texto da vigília.</p>',
            '<h1><b>Missa do dia</b></h1>',
            '<p><strong>Antífona de entrada</strong> Sl 2<br />Antífona do dia.</p>',
            '<p>Continuação que pertence à segunda Missa.</p>',
            '<p><strong>LEITURA I</strong> Is 1, 1<br />«Do dia»</p>',
            '<p>Leitura do Livro de Isaías<br />Texto do dia.</p>',
            '<p><strong>Antífona da comunhão</strong> Sl 3<br />Comunhão só do dia.</p>',
        ].join('\n');

        const { slots, readings } = extractMassTexts(twoMasses);
        expect(slots.entrada).toContain('Antífona da vigília');
        expect(slots.entrada).not.toContain('Antífona do dia');
        expect(slots.entrada).not.toContain('Continuação que pertence');
        expect(slots.coleta).toContain('Coleta da vigília');
        // A slot only the second Mass carries stays empty…
        expect(slots.comunhao).toBeUndefined();
        // …and its readings never join the first Mass's.
        expect(readings).toHaveLength(1);
        expect(readings[0].body).toContain('Texto da vigília');
        expect(readings.map((r) => r.header + r.body).join('')).not.toContain('do dia');
    });

    it('reads past a heading that does not name a Mass', () => {
        // A division heading inside one celebration must not end extraction:
        // everything after it still belongs to the same Mass.
        const inner = [
            '<p><strong>Antífona de entrada</strong> Sl 1<br />Antífona.</p>',
            '<h2>Liturgia da Palavra</h2>',
            '<p><strong>LEITURA I</strong> Is 1, 1<br />«Tema»</p>',
            '<p>Leitura do Livro de Isaías<br />Texto da leitura.</p>',
            '<h2>Liturgia Eucarística</h2>',
            '<p><strong>Oração sobre as oblatas</strong><br />Sobre as oblatas.</p>',
            '<p><strong>Oração depois da comunhão</strong><br />Depois da comunhão.</p>',
        ].join('\n');

        const { slots, readings } = extractMassTexts(inner);
        expect(readings).toHaveLength(1);
        expect(readings[0].body).toContain('Texto da leitura');
        expect(slots.oblatas).toContain('Sobre as oblatas');
        expect(slots.poscomunhao).toContain('Depois da comunhão');
        // The heading still closes the open run, so it never joins a slot.
        expect(Object.values(slots).join('')).not.toContain('Liturgia da Palavra');
    });

    it('stops at a repeated label when no heading separates the Masses', () => {
        const noHeading = [
            '<p><strong>Antífona de entrada</strong> Sl 1<br />Primeira antífona.</p>',
            '<p><strong>Oração coleta</strong><br />Primeira coleta.</p>',
            '<p><strong>Antífona de entrada</strong> Sl 2<br />Segunda antífona.</p>',
            '<p><strong>Oração coleta</strong><br />Segunda coleta.</p>',
            '<p><strong>LEITURA I</strong> Is 1, 1<br />«Da segunda Missa»</p>',
        ].join('\n');

        const { slots, readings } = extractMassTexts(noHeading);
        expect(slots.entrada).toContain('Primeira antífona');
        expect(slots.entrada).not.toContain('Segunda antífona');
        expect(slots.coleta).toContain('Primeira coleta');
        expect(slots.coleta).not.toContain('Segunda coleta');
        expect(readings).toHaveLength(0);
    });
});

describe('buildGuidedMassHtml', () => {
    it('lays out the five divisions in celebration order', () => {
        const html = buildGuidedMassHtml(SUNDAY, BOTH);
        const order = ['Ritos Iniciais', 'Liturgia da Palavra', 'Liturgia Eucarística',
            'Ritos da Comunhão', 'Ritos de Conclusão'];
        const positions = order.map((t) => html.indexOf(`>${t}</h2>`));
        expect(positions.every((p) => p !== -1)).toBe(true);
        expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    });

    it('gives each division a table-of-contents anchor', () => {
        const html = buildGuidedMassHtml(SUNDAY, BOTH);
        expect(html).toContain('id="ritos-iniciais" data-toc-label="Ritos Iniciais"');
        expect(html).toContain('id="liturgia-eucaristica" data-toc-label="Liturgia Eucarística"');
    });

    it('adds the Ato Penitencial and the Credo to the table of contents', () => {
        const html = buildGuidedMassHtml(SUNDAY, BOTH);
        expect(html).toContain('id="ato-penitencial" data-toc-label="Ato Penitencial"');
        expect(html).toContain('id="credo" data-toc-label="Profissão de Fé"');
        // Only the marked ones — every part would swamp the chips row.
        expect(html).not.toContain('id="kyrie" data-toc-label');
        expect(html).not.toContain('id="santo" data-toc-label');
    });

    it('puts a part\'s explanation behind the button beside its title', () => {
        const html = buildGuidedMassHtml(SUNDAY, BOTH);
        const start = html.indexOf('id="sinal-da-cruz"');
        const part = html.slice(start, html.indexOf('</section>', start));

        expect(part).toContain('aria-controls="sinal-da-cruz-nota"');
        expect(part).toContain('<div class="mass-note" id="sinal-da-cruz-nota"');
        expect(part).toContain('Foram estas as palavras do nosso baptismo');
        // The heading names the part and nothing else: it is what a screen
        // reader announces, and what the table of contents is built from.
        const heading = part.slice(part.indexOf('<h3'), part.indexOf('</h3>'));
        expect(heading).not.toContain('mass-note');
        expect(heading).toContain('mass-info');
    });

    it('pairs every button with the panel it opens', () => {
        const html = buildGuidedMassHtml(SUNDAY, BOTH);
        const targets = [...html.matchAll(/aria-controls="([^"]+)"/g)].map((m) => m[1]);
        expect(targets.length).toBeGreaterThan(10);
        for (const id of targets) {
            expect(html).toContain(`<div class="mass-note" id="${id}"`);
        }
        // One panel per button, and no orphan panels.
        expect(html.match(/class="mass-note"/g)).toHaveLength(targets.length);
        expect(new Set(targets).size).toBe(targets.length);
    });

    it('drops the Credo anchor on a day that has no Credo', () => {
        expect(buildGuidedMassHtml(SUNDAY, NEITHER)).not.toContain('data-toc-label="Profissão de Fé"');
    });

    it('keeps the Aleluia out of the table of contents', () => {
        const withAlleluia = SUNDAY.replace(
            '<p><strong>EVANGELHO</strong>',
            '<p><strong>ALELUIA</strong> cf. Mt 4, 2<br />Refrão: Aleluia.</p>\n<p><strong>EVANGELHO</strong>',
        );
        const html = buildGuidedMassHtml(withAlleluia, BOTH);
        // Still styled as a reading, but marked so the page's TOC skips it.
        expect(html).toContain('<p data-toc-skip="1"><strong>ALELUIA</strong>');
        expect(html).toContain('id="mass-aleluia-1"');
    });

    it('includes the Glória and the Credo when the day has them', () => {
        const html = buildGuidedMassHtml(SUNDAY, BOTH);
        expect(html).toContain('Glória a Deus nas alturas');
        expect(html).toContain('Creio em um só Deus');
    });

    it('omits both when the day has neither', () => {
        const html = buildGuidedMassHtml(SUNDAY, NEITHER);
        expect(html).not.toContain('Glória a Deus nas alturas');
        expect(html).not.toContain('Creio em um só Deus');
        // The rest of the Mass is untouched.
        expect(html).toContain('Santo, Santo, Santo');
        expect(html).toContain('Pai nosso, que estais nos céus');
    });

    it('omits the Glória but keeps the Credo in Lent', () => {
        const html = buildGuidedMassHtml(SUNDAY, { gloria: false, credo: true });
        expect(html).not.toContain('Glória a Deus nas alturas');
        expect(html).toContain('Creio em um só Deus');
    });

    it('threads the day\'s propers into the right parts', () => {
        const html = buildGuidedMassHtml(SUNDAY, BOTH);
        const at = (needle: string) => html.indexOf(needle);
        expect(at('Senhor Deus, nosso protetor')).toBeGreaterThan(-1);     // entrance
        expect(at('que preparastes bens invisíveis')).toBeGreaterThan(at('Senhor Deus, nosso protetor'));
        expect(at('<strong>LEITURA I</strong>')).toBeGreaterThan(at('que preparastes bens invisíveis'));
        expect(at('Aceitai, Senhor, a nossa oblação')).toBeGreaterThan(at('<strong>LEITURA I</strong>'));
        expect(at('Senhor, que neste sacramento')).toBeGreaterThan(at('Aceitai, Senhor, a nossa oblação'));
    });

    it('puts the response after each reading, not once at the end', () => {
        const html = buildGuidedMassHtml(SUNDAY, BOTH);
        const first = html.indexOf('<strong>LEITURA I</strong>');
        const psalm = html.indexOf('<strong>SALMO RESPONSORIAL</strong>');
        const gospel = html.indexOf('<strong>EVANGELHO</strong>');
        const gracas = html.indexOf('Graças a Deus.');
        // "Graças a Deus" answers the first reading, before the psalm starts.
        expect(gracas).toBeGreaterThan(first);
        expect(gracas).toBeLessThan(psalm);
        // The Gospel gets its own acclamation, after its text.
        const gloriaAVos = html.lastIndexOf('Glória a Vós, Senhor.');
        expect(gloriaAVos).toBeGreaterThan(gospel);
        expect(html.indexOf('Naquele tempo')).toBeLessThan(gloriaAVos);
    });

    it('frames the Gospel with its dialogue before and acclamation after', () => {
        const html = buildGuidedMassHtml(SUNDAY, BOTH);
        const seg = html.slice(html.indexOf('id="mass-evangelho-1"'));
        const part = seg.slice(0, seg.indexOf('</section>'));
        expect(part.indexOf('segundo são Mateus')).toBeLessThan(part.indexOf('Naquele tempo'));
        expect(part.lastIndexOf('Glória a Vós, Senhor.')).toBeGreaterThan(part.indexOf('Naquele tempo'));
    });

    it('announces the day\'s own evangelist, not a placeholder', () => {
        expect(buildGuidedMassHtml(SUNDAY, BOTH)).toContain('segundo são Mateus');
        expect(buildGuidedMassHtml(SUNDAY, BOTH)).not.toContain('segundo são N.');
        expect(buildGuidedMassHtml(ASSUMPTION, BOTH)).toContain('segundo são Lucas');
    });

    it('does not print the Gospel attribution twice', () => {
        const html = buildGuidedMassHtml(SUNDAY, BOTH);
        const seg = html.slice(html.indexOf('id="mass-evangelho-1"'));
        const part = seg.slice(0, seg.indexOf('</section>'));
        expect(part.match(/Jesus Cristo,? segundo/gi)).toHaveLength(1);
        expect(part).toContain('Naquele tempo');
    });

    it('strips the attribution when it stands alone in its own paragraph', () => {
        const alone = '<p><strong>EVANGELHO</strong> Lc 1, 1</p>'
            + '<p>Evangelho de Nosso Senhor Jesus Cristo segundo São Lucas</p>'
            + '<p>Naqueles dias, Maria pôs-se a caminho.</p>';
        const html = buildGuidedMassHtml(alone, NEITHER);
        const seg = html.slice(html.indexOf('id="mass-evangelho-1"'));
        const part = seg.slice(0, seg.indexOf('</section>'));
        expect(part).toContain('segundo são Lucas');
        expect(part.match(/Jesus Cristo,? segundo/gi)).toHaveLength(1);
        expect(part).toContain('Maria pôs-se a caminho');
    });

    it('frames a reading from above, leaving header and text unbroken', () => {
        const html = buildGuidedMassHtml(SUNDAY, BOTH);
        const start = html.indexOf('id="mass-leitura-1"');
        const part = html.slice(start, html.indexOf('</section>', start));
        // Cue and note come before the header, not between it and the text.
        // (The header is styled into .reading-section-header at render time;
        // in the built HTML it is still the API's <strong> block.)
        const header = part.indexOf('<strong>LEITURA I</strong>');
        expect(part.indexOf('mass-cue')).toBeLessThan(header);
        expect(part.indexOf('mass-note')).toBeLessThan(header);
        expect(header).toBeLessThan(part.indexOf('Eis o que diz o Senhor'));
    });

    it('escapes quotes, since labels are interpolated into attributes', () => {
        // No title carries a quote today; this pins the escaping so one could.
        const html = buildGuidedMassHtml(SUNDAY, BOTH);
        const attrs = html.match(/data-toc-label="[^"]*"/g) ?? [];
        expect(attrs.length).toBeGreaterThan(0);
        for (const attr of attrs) expect(attr.slice(16, -1)).not.toContain('"');
    });

    it('falls back to the placeholder when the attribution is missing', () => {
        const odd = '<p><strong>EVANGELHO</strong> Mt 1, 1</p><p>Naquele tempo, Jesus disse.</p>';
        expect(buildGuidedMassHtml(odd, NEITHER)).toContain('segundo são N.');
    });

    it('explains a reading once, not again on the second of the same kind', () => {
        // A Sunday has two readings before the Gospel; they work identically.
        const twoReadings = SUNDAY.replace(
            '<p><strong>EVANGELHO</strong>',
            '<p><strong>LEITURA II</strong> Rm 11, 13-15<br />«Os dons de Deus»</p>\n'
            + '<p>Leitura da Epístola aos Romanos<br />Irmãos.<br />Palavra do Senhor.</p>\n'
            + '<p><strong>EVANGELHO</strong>',
        );
        const html = buildGuidedMassHtml(twoReadings, BOTH);
        const part = (id: string) => {
            const start = html.indexOf(`id="${id}"`);
            return html.slice(start, html.indexOf('</section>', start));
        };
        expect(part('mass-leitura-1')).toContain('mass-info');
        expect(part('mass-leitura-2')).not.toContain('mass-info');
        // The posture badge still marks the second reading.
        expect(part('mass-leitura-2')).toContain('mass-posture-sentado');
        // …and its response is still there.
        expect(part('mass-leitura-2')).toContain('Graças a Deus.');
    });

    it('does not repeat an acclamation the API text already carries', () => {
        const html = buildGuidedMassHtml(SUNDAY, BOTH);
        const seg = html.slice(html.indexOf('id="mass-leitura-1"'));
        const part = seg.slice(0, seg.indexOf('</section>'));
        // The reading ends with the lector's line already; only the answer is added.
        expect(part.match(/Palavra do Senhor/g)).toHaveLength(1);
    });

    it('supplies the lector\'s line when the API text lacks it', () => {
        const bare = '<p><strong>LEITURA I</strong> Is 1, 1</p><p>Leitura do Livro de Isaías<br />Assim diz o Senhor.</p>';
        const html = buildGuidedMassHtml(bare, NEITHER);
        expect(html).toContain('Palavra do Senhor.');
        expect(html).toContain('Graças a Deus.');
    });

    it('gives the Mistério da fé its own part, with the acclamations visible', () => {
        const html = buildGuidedMassHtml(SUNDAY, BOTH);
        const start = html.indexOf('id="misterio-da-fe"');
        expect(start).toBeGreaterThan(-1);
        const part = html.slice(start, html.indexOf('</section>', start));

        // All three acclamations, each tagged once.
        expect(part).toContain('Anunciamos, Senhor, a vossa morte');
        expect(part).toContain('Quando comemos deste pão');
        expect(part).toContain('Glória a Vós, que morrestes na cruz');
        expect(part.match(/mass-variant-tag/g)).toHaveLength(2);

        // The rest of the Eucharistic Prayer follows the acclamation and is
        // collapsed — but every acclamation stays above it, in the open.
        expect(part.indexOf('Glória a Vós, que morrestes na cruz'))
            .toBeLessThan(part.indexOf('reading-commentary'));
        expect(part).toContain('Celebrando agora, Senhor');
    });

    it('ends the Eucharistic Prayer before the doxology part', () => {
        const html = buildGuidedMassHtml(SUNDAY, BOTH);
        const start = html.indexOf('id="doxologia"');
        const part = html.slice(start, html.indexOf('</section>', start));
        expect(part).not.toContain('reading-commentary');
        expect(part).toContain('Por Cristo, com Cristo, em Cristo');
        expect(part).toContain('Amen.');
    });

    it('collapses every proper — the antiphons and the three orations', () => {
        const html = buildGuidedMassHtml(SUNDAY, BOTH);
        const part = (id: string) => {
            const start = html.indexOf(`id="${id}"`);
            return html.slice(start, html.indexOf('</section>', start));
        };

        for (const id of ['entrada', 'coleta', 'oblatas', 'comunhao', 'pos-comunhao']) {
            expect(part(id), id).toContain('mass-collapsed-proper');
        }
        expect(part('entrada')).toContain('Senhor Deus, nosso protetor');
        expect(part('coleta')).toContain('que preparastes bens invisíveis');

        // The assembly's "Amen" answers the oration, so it stays visible
        // outside the toggle.
        const coleta = part('coleta');
        expect(coleta.indexOf('Amen.')).toBeGreaterThan(coleta.indexOf('commentary-body'));
        expect(coleta).toContain('mass-line-response');
    });

    it('leaves the readings open — they are what the mode is for', () => {
        const html = buildGuidedMassHtml(SUNDAY, BOTH);
        const start = html.indexOf('id="mass-leitura-1"');
        const part = html.slice(start, html.indexOf('</section>', start));
        expect(part).not.toContain('mass-collapsed-proper');
        expect(part).toContain('Eis o que diz o Senhor');
    });

    it('marks the assembly\'s parts so they can be highlighted', () => {
        const html = buildGuidedMassHtml(SUNDAY, BOTH);
        expect(html).toContain('mass-line-response');
        expect(html).toContain('>Todos</span>');
    });

    it('collapses the presidential prayers behind the existing toggle', () => {
        const html = buildGuidedMassHtml(SUNDAY, BOTH);
        // Same markup as the reading commentaries, so the article's delegated
        // click handler drives these too.
        expect(html).toContain('reading-commentary mass-collapse mass-celebrant collapsed');
        expect(html).toContain('aria-expanded="false"');
        expect(html).toContain('Vós, Senhor, sois verdadeiramente santo');
        expect(html).toContain('Oração Eucarística II — até à consagração');
    });

    it('tags an alternative form once, not on every line of it', () => {
        const html = buildGuidedMassHtml(SUNDAY, BOTH);
        // The greeting offers one alternative — a call and its response.
        const greeting = html.slice(html.indexOf('id="saudacao"'), html.indexOf('id="ato-penitencial"'));
        expect(greeting.match(/mass-variant-tag/g)).toHaveLength(1);
        expect(greeting.match(/mass-line-variant/g)).toHaveLength(2);
    });

    it('offers the Greek Kyrie as one alternative, not three', () => {
        const html = buildGuidedMassHtml(SUNDAY, BOTH);
        const start = html.indexOf('id="kyrie"');
        const part = html.slice(start, html.indexOf('</section>', start));
        expect(part).toContain('Kýrie, eléison.');
        expect(part).toContain('Christe, eléison.');
        // One exchange, so a single "Ou" tag covers the whole Greek form.
        expect(part.match(/mass-line-variant/g)).toHaveLength(1);
        expect(part.match(/mass-variant-tag/g)).toHaveLength(1);
    });

    it('prints a repeated invocation once, not as call and answer', () => {
        const html = buildGuidedMassHtml(SUNDAY, BOTH);
        const start = html.indexOf('id="kyrie"');
        const part = html.slice(start, html.indexOf('</section>', start));

        // Two litanies, the Portuguese and the Greek, each one block of three
        // invocations rather than six labelled pairs.
        expect(part.match(/mass-line-echo/g)).toHaveLength(2);
        expect(part.match(/mass-said/g)).toHaveLength(6);
        expect(part).toContain('Sacerdote, e todos repetem');
        // Counted from the first line, since the explanation above them
        // quotes «Kýrie, eléison» too.
        const said = part.slice(part.indexOf('mass-line'));
        expect(said.match(/Senhor, tende piedade de nós/g)).toHaveLength(2);
        expect(said.match(/Kýrie, eléison/g)).toHaveLength(2);
        // Nothing is left saying only the priest speaks these words.
        expect(part).not.toContain('>Todos<');
    });

    it('leaves an exchange alone when the answer is not the call', () => {
        const html = buildGuidedMassHtml(SUNDAY, BOTH);
        const greeting = html.slice(html.indexOf('id="saudacao"'), html.indexOf('id="ato-penitencial"'));
        expect(greeting).not.toContain('mass-line-echo');
        expect(greeting).toContain('Bendito seja Deus, que nos reuniu no amor de Cristo.');
        expect(greeting.match(/mass-line-response/g)).toHaveLength(2);
    });

    it('keeps "Orai, irmãos" inside the presentation of the gifts', () => {
        const html = buildGuidedMassHtml(SUNDAY, BOTH);
        expect(html).not.toContain('id="orai-irmaos"');
        const start = html.indexOf('id="apresentacao-dons"');
        const part = html.slice(start, html.indexOf('</section>', start));
        expect(part).toContain('Orai, irmãos, para que o meu e vosso sacrifício');
        expect(part).toContain('Receba o Senhor por tuas mãos');
        // The posture changes partway through, so the cue moves inline.
        expect(part).toContain('mass-posture-sentado');
        expect(part.indexOf('mass-cue')).toBeLessThan(part.indexOf('Orai, irmãos, para que'));
        expect(part).toContain('mass-posture-pe');
    });

    it('does not pin the dismissal on a deacon, and lists all five forms', () => {
        const html = buildGuidedMassHtml(SUNDAY, BOTH);
        const start = html.indexOf('id="despedida"');
        const part = html.slice(start, html.indexOf('</section>', start));
        expect(part).toContain('Sacerdote ou diácono');
        expect(part).not.toContain('>Diácono<');
        expect(part).toContain('Anunciai o Evangelho do Senhor.');
        expect(part).toContain('Glorificai a Deus com a vossa vida.');
        expect(part).toContain('A alegria do Senhor seja a vossa força.');
        expect(part).toContain('Levai a todos a alegria do Senhor ressuscitado.');
        // Four alternatives listed back to back, each tagged separately.
        expect(part.match(/mass-variant-tag/g)).toHaveLength(4);
        // One response covers every form, so it comes once, at the end.
        expect(part.match(/Graças a Deus\./g)).toHaveLength(1);
        expect(part.indexOf('Graças a Deus.')).toBeGreaterThan(part.indexOf('Levai a todos'));
    });

    it('opens the greeting with the missal\'s first form', () => {
        const html = buildGuidedMassHtml(SUNDAY, BOTH);
        const start = html.indexOf('id="saudacao"');
        const part = html.slice(start, html.indexOf('</section>', start));
        expect(part.indexOf('A graça de nosso Senhor')).toBeLessThan(part.indexOf('O Senhor esteja convosco.'));
        expect(part.indexOf('Bendito seja Deus, que nos reuniu')).toBeLessThan(part.indexOf('Ele está no meio de nós.'));
        expect(part.match(/mass-variant-tag/g)).toHaveLength(1);
    });

    it('carries a posture cue on the parts that need one', () => {
        const html = buildGuidedMassHtml(SUNDAY, BOTH);
        expect(html).toContain('mass-posture-sentado');
        expect(html).toContain('mass-posture-joelhos-ou-pe');
        expect(html).toContain('>De pé</span>');
    });

    it('escapes text rather than emitting raw markup', () => {
        const html = buildGuidedMassHtml('', BOTH);
        expect(html).not.toContain('<script');
        // Verse breaks survive as <br>.
        expect(html).toContain('Santo, Santo, Santo,<br />Senhor Deus do Universo.');
    });

    it('still renders the skeleton when the API gave us nothing', () => {
        const html = buildGuidedMassHtml('', BOTH);
        expect(html).toContain('Ritos Iniciais');
        expect(html).toContain('Ide em paz e o Senhor vos acompanhe');
        // Parts that exist only to hold a proper are dropped, not left empty.
        expect(html).not.toContain('id="pos-comunhao"');
    });

    it('works on a day whose markup is irregular', () => {
        const html = buildGuidedMassHtml(ASSUMPTION, BOTH);
        expect(html).toContain('Suba até Vós');
        expect(html).toContain('Apareceu no céu um sinal grandioso');
        expect(html).toContain('<strong>EVANGELHO</strong>');
        expect(html).not.toContain('Diz-se o Credo');
    });
});
