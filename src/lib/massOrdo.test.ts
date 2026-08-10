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
