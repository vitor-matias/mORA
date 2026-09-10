// Which of the two big optional Mass parts — the Glória and the Credo — belong
// to a given day. The guided Mass ("Missa explicada") walks a newcomer through the
// celebration in order, so it has to get this right: printing the Credo on a
// Tuesday feria, or dropping the Glória on Easter Sunday, teaches the wrong
// shape of the Mass.
//
// Three sources, best first:
//
//   1. The liturgia.pt ICS description, which spells it out per day:
//        "† Missa própria, Glória, Credo, pf. dominical."   → both
//        "† Missa própria, Credo, pf. próprio."             → Credo only (Lent)
//        "Missa da féria, pf. da Epifania ou do Natal."     → neither
//      365/365 days of the 2026 feed carry such a line, bar Good Friday and
//      Holy Saturday, which have no Mass at all.
//   2. The Mass HTML itself, which on some solemnities embeds the rubrics
//      "Diz-se o Glória." / "Diz-se o Credo.".
//   3. Failing both (offline with no cached calendar), the general rules.

export interface MassOrdo {
    /** Whether the hymn "Glória a Deus nas alturas" is said. */
    gloria: boolean;
    /** Whether the profession of faith is said. */
    credo: boolean;
}

/** Lines like "† Missa própria, Glória, Credo, pf. dominical." */
const MASS_LINE_RE = /^\s*[†*]?\s*Missa\b/;

/**
 * The heading that introduces a Mass anticipated on the evening before a
 * solemnity: "Sábado à tarde", "Sexta-feira à tarde", "Terça-feira à tarde".
 * Everything under it describes the *next* day's celebration.
 *
 * The space before "à" is matched explicitly rather than with `\b`, which in
 * JavaScript is defined over ASCII `\w` and so never fires before "à".
 */
const EVENING_MASS_RE = /^[^\n]{0,40}\sà\s+tarde\s*$/i;

/**
 * Reads the day's Mass line(s) out of an ICS description. Christmas lists
 * several ("Missa da noite", "Missa da aurora", "† Missa do dia"), so every
 * matching line is considered — they agree on Glória/Credo.
 *
 * Collection stops at an anticipated evening Mass, because that one belongs to
 * tomorrow: on 14 August the day is a memorial ("Missa da memória.") and the
 * Assumption's "Missa da Vigília, Glória, Credo" sits further down the same
 * entry, which would otherwise print both on a memorial. Six days of the year
 * carry such a vigil.
 *
 * The cut only applies once the day's own Mass has been found. On Holy
 * Thursday the heading is "QUINTA-FEIRA DA SEMANA SANTA à tarde" and what
 * follows *is* the day's only Mass, so cutting first would leave nothing and
 * silently drop the Glória that the Ceia do Senhor does have.
 */
function massLines(description: string): string[] {
    const lines: string[] = [];
    for (const line of description.split('\n')) {
        if (lines.length > 0 && EVENING_MASS_RE.test(line)) break;
        if (MASS_LINE_RE.test(line)) lines.push(line);
    }
    return lines;
}

/**
 * The liturgical season, in as much detail as the guided Mass needs: the
 * Glória is omitted through Advent and Lent. Derived from the day name, which
 * spells the season out ("DOMINGO III DO ADVENTO", "Quarta-feira da II semana
 * da Quaresma", "Quarta-feira DE CINZAS").
 */
function isPenitentialSeason(text: string): boolean {
    return /\b(advento|quaresma|cinzas)\b/i.test(text);
}

/**
 * Solemnities and feasts, as the Portuguese calendar writes them: the rank
 * follows the title, either spelled out ("– SOLENIDADE", "– FESTA") or as the
 * memorial abbreviations MO (memória obrigatória) / MF (memória facultativa).
 */
function hasRank(text: string, re: RegExp): boolean {
    return re.test(text);
}

/**
 * Last-resort rules, used only when neither the calendar nor the Mass text
 * says. Deliberately conservative: it would rather omit an optional part than
 * invent one.
 *
 * Glória — Sundays outside Advent and Lent, plus solemnities and feasts.
 * Credo  — Sundays and solemnities (not feasts, not memorials, not ferias).
 */
export function inferMassOrdo(date: Date, dayName = ''): MassOrdo {
    const isSunday = date.getDay() === 0;
    const penitential = isPenitentialSeason(dayName);
    const solemnity = hasRank(dayName, /\bSOLENIDADE\b/i);
    const feast = hasRank(dayName, /\bFESTA\b/i);

    return {
        gloria: solemnity || feast || (isSunday && !penitential),
        credo: solemnity || isSunday,
    };
}

/**
 * Resolves whether today's Mass has the Glória and the Credo.
 *
 * @param date        the day being shown
 * @param description the liturgia.pt ICS description for that day, when loaded
 * @param dayName     the ICS summary / Mass title, used by the fallback rules
 *                    and to spot a solemnity that displaces a Sunday
 * @param massHtml    the Mass text from the API, read for embedded rubrics
 */
export function resolveMassOrdo(
    date: Date,
    description?: string | null,
    dayName?: string | null,
    massHtml?: string | null,
): MassOrdo {
    // 1. The calendar's own Mass line — authoritative where present.
    if (description) {
        const lines = massLines(description);
        if (lines.length > 0) {
            const joined = lines.join(' ');
            return {
                gloria: /\bGlória\b/i.test(joined),
                credo: /\bCredo\b/i.test(joined),
            };
        }
    }

    // 2. Rubrics embedded in the Mass text ("Diz-se o Glória."). Read as
    //    positive evidence only, and unioned with the rules below: a text that
    //    prints one rubric and not the other is saying nothing about the other,
    //    so a lone "Diz-se o Glória." must not silently drop a Sunday's Credo.
    if (massHtml) {
        const gloria = /Diz-se\s+o\s+Glória/i.test(massHtml);
        const credo = /Diz-se\s+o\s+Credo/i.test(massHtml);
        if (gloria || credo) {
            const inferred = inferMassOrdo(date, `${dayName ?? ''}\n${description ?? ''}`);
            return { gloria: gloria || inferred.gloria, credo: credo || inferred.credo };
        }
    }

    // 3. General rules. The ICS description, when we have it, names the rank
    //    on its first line even when the summary doesn't ("Sábado da semana
    //    XIX" / "ASSUNÇÃO DA VIRGEM SANTA MARIA – SOLENIDADE"), so feed both.
    return inferMassOrdo(date, `${dayName ?? ''}\n${description ?? ''}`);
}
