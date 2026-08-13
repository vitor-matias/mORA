import { describe, expect, it } from 'vitest';
import { inferMassOrdo, resolveMassOrdo } from './massOrdo';

/** Descriptions copied verbatim from the 2026 liturgia.pt agenda feed. */
const ICS = {
    sundayOrdinary:
        'Verde – Ofício do domingo (Semana IV do Saltério). Te Deum.\n'
        + '† Missa própria, Glória, Credo, pf. dominical.\n\n'
        + 'L 1: Is 56, 1. 6-7; Sl 66 (67), 2-3. 5. 6 e 8\nL 2: Rm 11, 13-15. 29-32\nEv: Mt 15, 21-28',
    sundayLent:
        'Roxo – Ofício próprio (Semana II do Saltério).\n'
        + '† Missa própria, Credo, pf. próprio.\n\nL 1: Gn 12, 1-4a',
    sundayAdvent:
        'Roxo ou rosa – Ofício próprio (Semana III do Saltério). Te Deum.\n'
        + '† Missa própria, Credo, pf. I ou II do Advento.',
    feria:
        'Branco – Ofício da féria.\nMissa da féria, pf. da Epifania ou do Natal.\n\nL 1: 1Jo 4, 7-10',
    optionalMemorial:
        'S. João Eudes, presbítero – MF\nVerde ou br. – Ofício da féria ou da memória.\nMissa à escolha.',
    solemnityOnSaturday:
        'ASSUNÇÃO DA VIRGEM SANTA MARIA – SOLENIDADE\nBranco – Ofício da solenidade. Te Deum.\n'
        + 'Missa do dia, própria, Glória, Credo, pf. próprio.',
    pentecost:
        'Vermelho – Ofício da solenidade. Te Deum.\n'
        + '† Missa própria do dia, Glória, sequência, Credo, pf. próprio.',
    goodFriday: 'Vermelho.',
    // 14 August: a memorial whose entry also carries the Assumption's vigil,
    // celebrated that evening but belonging to the 15th.
    memorialWithVigilOfTomorrow:
        'S. Maximiliano Maria Kolbe, presbítero e mártir – MO\nVermelho – Ofício da memória.\n'
        + 'Missa da memória.\n\nL 1: Ez 16, 1-15. 60. 63\nEv: Mt 19, 3-12\n\n'
        + '* Na Ordem Franciscana – S. Maximiliano Maria Kolbe, da I Ordem – MO\n\n\n'
        + 'ASSUNÇÃO DA VIRGEM SANTA MARIA\nSOLENIDADE\n\nSexta-feira à tarde\nBranco.\n'
        + 'Missa da Vigília, Glória, Credo, pf. próprio.\n\nEv: Lc 11, 27-28',
    // Holy Thursday: here the evening heading introduces the day's *own* Mass,
    // and the Chrism Mass above it is described in prose ("A Missa do Crisma…"),
    // so no Mass line precedes the heading.
    holyThursday:
        'Roxo.\nOfício próprio.\n\n'
        + 'A Missa do Crisma celebra-se com paramentos brancos e diz-se Glória e pf. próprio.\n'
        + 'L 1: Is 61, 1-3a. 6a. 8b-9\nEv: Lc 4, 16-21\n\n\nTRÍDUO PASCAL\n\n'
        + 'QUINTA-FEIRA DA SEMANA SANTA à tarde\nMISSA VESPERTINA DA CEIA DO SENHOR\nBranco.\n'
        + 'Missa própria, Glória, pf. da Eucaristia.\n\nL 1: Ex 12, 1-8. 11-14',
    // Christmas lists several Masses of the same day, and they agree.
    christmas:
        'Branco – Ofício da solenidade. Te Deum.\n'
        + 'Missa própria do dia, Glória, Credo, pf. próprio.\n\n'
        + 'Missa da noite\nEv: Lc 2, 1-14\n\nMissa da aurora\nEv: Lc 2, 15-20\n\n'
        + '† Missa do dia\nEv: Jo 1, 1-18',
};

describe('resolveMassOrdo — from the calendar description', () => {
    it('gives both on a Sunday in Ordinary Time', () => {
        expect(resolveMassOrdo(new Date('2026-08-16T00:00:00'), ICS.sundayOrdinary))
            .toEqual({ gloria: true, credo: true });
    });

    it('drops the Glória but keeps the Credo on a Sunday of Lent', () => {
        expect(resolveMassOrdo(new Date('2026-03-01T00:00:00'), ICS.sundayLent))
            .toEqual({ gloria: false, credo: true });
    });

    it('drops the Glória but keeps the Credo on a Sunday of Advent', () => {
        expect(resolveMassOrdo(new Date('2026-12-13T00:00:00'), ICS.sundayAdvent))
            .toEqual({ gloria: false, credo: true });
    });

    it('gives neither on a weekday feria', () => {
        expect(resolveMassOrdo(new Date('2026-01-06T00:00:00'), ICS.feria))
            .toEqual({ gloria: false, credo: false });
    });

    it('gives neither on an optional memorial ("Missa à escolha")', () => {
        expect(resolveMassOrdo(new Date('2026-08-19T00:00:00'), ICS.optionalMemorial))
            .toEqual({ gloria: false, credo: false });
    });

    it('gives both on a solemnity that falls on a Saturday', () => {
        expect(resolveMassOrdo(new Date('2026-08-15T00:00:00'), ICS.solemnityOnSaturday))
            .toEqual({ gloria: true, credo: true });
    });

    it('is not confused by the sequence listed alongside them', () => {
        expect(resolveMassOrdo(new Date('2026-05-24T00:00:00'), ICS.pentecost))
            .toEqual({ gloria: true, credo: true });
    });

    it('ignores the vigil Mass that belongs to tomorrow\'s solemnity', () => {
        expect(resolveMassOrdo(new Date('2026-08-14T00:00:00'), ICS.memorialWithVigilOfTomorrow))
            .toEqual({ gloria: false, credo: false });
    });

    it('keeps the day\'s own Mass when the evening heading introduces it', () => {
        expect(resolveMassOrdo(new Date('2026-04-02T00:00:00'), ICS.holyThursday))
            .toEqual({ gloria: true, credo: false });
    });

    it('reads every Mass of a day that has several', () => {
        expect(resolveMassOrdo(new Date('2026-12-25T00:00:00'), ICS.christmas))
            .toEqual({ gloria: true, credo: true });
    });

    it('ignores a "Glória" that is not on the Mass line', () => {
        const desc = 'Branco – Ofício da féria.\nMissa da féria, pf. comum.\n'
            + '* Hino Glória a Deus no encerramento do congresso diocesano.';
        expect(resolveMassOrdo(new Date('2026-01-08T00:00:00'), desc))
            .toEqual({ gloria: false, credo: false });
    });
});

describe('resolveMassOrdo — falling back to the Mass text', () => {
    it('reads the rubrics embedded in the day\'s HTML', () => {
        const html = '<p><b>Oração coleta</b><br />Deus todo-poderoso…</p>'
            + '<p>Diz-se o Glória.</p><p>Diz-se o Credo.</p>';
        expect(resolveMassOrdo(new Date('2026-08-15T00:00:00'), null, 'Sábado da semana XIX', html))
            .toEqual({ gloria: true, credo: true });
    });

    it('does not let a lone rubric drop the other part', () => {
        // A text that prints one rubric says nothing about the other, so the
        // general rules still supply it: a Sunday keeps its Credo.
        const html = '<p><em>Diz-se o Glória.</em></p><p>Oração coleta…</p>';
        expect(resolveMassOrdo(new Date('2026-08-16T00:00:00'), null, 'DOMINGO XX DO TEMPO COMUM', html))
            .toEqual({ gloria: true, credo: true });
    });

    it('still trusts a rubric the rules alone would miss', () => {
        // A weekday solemnity the day name does not identify as one.
        const html = '<p><em>Diz-se o Glória.</em></p><p><em>Diz-se o Credo.</em></p>';
        expect(resolveMassOrdo(new Date('2026-08-15T00:00:00'), null, 'Sábado da semana XIX', html))
            .toEqual({ gloria: true, credo: true });
    });

    it('is used when the calendar has no Mass line at all', () => {
        // Good Friday: no Mass, so no Mass line — and nothing in the HTML.
        expect(resolveMassOrdo(new Date('2026-04-03T00:00:00'), ICS.goodFriday, 'Sexta-feira Santa'))
            .toEqual({ gloria: false, credo: false });
    });
});

describe('inferMassOrdo — the offline rules', () => {
    it('gives both on an ordinary Sunday', () => {
        expect(inferMassOrdo(new Date('2026-08-16T00:00:00'), 'DOMINGO XX DO TEMPO COMUM'))
            .toEqual({ gloria: true, credo: true });
    });

    it('omits the Glória on a Sunday of Lent', () => {
        expect(inferMassOrdo(new Date('2026-03-01T00:00:00'), 'DOMINGO II DA QUARESMA'))
            .toEqual({ gloria: false, credo: true });
    });

    it('omits the Glória on a Sunday of Advent', () => {
        expect(inferMassOrdo(new Date('2026-12-13T00:00:00'), 'DOMINGO III DO ADVENTO'))
            .toEqual({ gloria: false, credo: true });
    });

    it('gives both on a solemnity', () => {
        expect(inferMassOrdo(new Date('2026-08-15T00:00:00'), 'ASSUNÇÃO DA VIRGEM SANTA MARIA – SOLENIDADE'))
            .toEqual({ gloria: true, credo: true });
    });

    it('gives the Glória but not the Credo on a feast', () => {
        expect(inferMassOrdo(new Date('2026-09-14T00:00:00'), 'Exaltação da Santa Cruz – FESTA'))
            .toEqual({ gloria: true, credo: false });
    });

    it('gives neither on a weekday memorial', () => {
        expect(inferMassOrdo(new Date('2026-08-11T00:00:00'), 'Terça-feira da semana XIX – S. Clara, virgem – MO'))
            .toEqual({ gloria: false, credo: false });
    });

    it('gives neither on a plain weekday', () => {
        expect(inferMassOrdo(new Date('2026-04-16T00:00:00'), 'Quinta-feira da semana II'))
            .toEqual({ gloria: false, credo: false });
    });
});
