// Line-breaking rules for the office's verse, applied to the API's HTML and
// to ours alike (both reach the page through ApiHtml). The hanging indent
// itself is CSS (index.css, .office p:has(br)); these are the bits CSS cannot
// say.

// Tags between the space and the mark: our markers are wrapped in a rubric
// span, so " <span class="rubric">*</span>".
const TAGS = '((?:<[^>]*>)*)';

/**
 * - A no-break space before the mediant (*) and the flexa (†), so neither
 *   wraps onto a line of its own.
 * - "Ant. 1", "Sl 118", "Salmo 15" never split between label and number.
 * - The antiphon's paragraph is classed, so it can stand slightly apart.
 */
export function officeTypography(html: string): string {
    return html
        .replace(new RegExp(` ${TAGS}(?=[*†])`, 'g'), ' $1')
        .replace(new RegExp(`\\b(Ant\\.|Sl|Salmo)${TAGS} (?=\\d)`, 'g'), '$1$2 ')
        .replace(new RegExp(`<p>(?=${TAGS}Ant\\.)`, 'g'), '<p class="antiphon">');
}
