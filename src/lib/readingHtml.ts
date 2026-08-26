import DOMPurify from "dompurify";

/**
 * Turns the liturgy API's loosely-marked-up Mass text into the semantic HTML
 * the reading view styles and navigates:
 *
 *   extractReadings()   — slice the readings out of a full missal text
 *   enrichReadingHtml() — sanitize, fold commentaries away, add the classes
 *                         and anchor ids the stylesheet and TOC rely on
 *
 * The upstream markup is inconsistent day to day (labels in <b> or <strong>,
 * refrains wrapped in <em> or bare, "Ou:" alternatives inline or in their own
 * paragraph), so most of what follows is shape-tolerance.
 */

// Labels that open a liturgical reading section.
const SECTION_LABEL_RE = /^(LEITURA\s+(I{1,3}|IV)|SALMO RESPONSORIAL|EVANGELHO|ALELUIA|ACLAMAÇÃO)/i;
// Lines that close a reading ("Palavra do Senhor.", "Palavra da salvação.").
const ENDING_RE = /^Palavra (do Senhor|da salvação|do Evangelho)/i;
// First line of a reading body paragraph — the scripture source attribution.
const SOURCE_RE = /^(Leitura (do|da|de|aos|ao)|Do Livro|Da Carta|Do Profeta|Dos Actos|Do Apocalipse|Da Primeira|Da Segunda|Da Terceira|Evangelho de Nosso Senhor)/i;

// ── Responsorial-psalm refrain block ────────────────────────────────────
// "Refrão: … Repete-se", optionally followed by "Ou:" alternatives, all
// laid out as <br>-separated lines.
const REFRAIN_RE = /^Refrão:\s*/i;
const ALT_RE = /^Ou:\s*/i;
// The rubric that closes a refrain; it also shows up on a line of its own.
const REPEATS_RE = /\s*Repete-se\.?\s*$/i;
// A response reference the API sometimes breaks onto its own line, spacing
// and all: "(R. 33a ou Aleluia)", "(R . 97a )".
const RESPONSE_REF_RE = /^\(\s*R\s*\..*\)$/i;

function normalizeLine(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
}

/** An element's text, split at its <br>s and with blank lines dropped. */
function elementLines(el: Element): string[] {
    const lines: string[] = [];
    let line = '';
    for (const node of Array.from(el.childNodes)) {
        if (node.nodeName === 'BR') {
            lines.push(line);
            line = '';
            continue;
        }
        line += node.textContent ?? '';
    }
    lines.push(line);
    return lines.map(normalizeLine).filter(Boolean);
}

/**
 * Reads a refrain block into the refrain itself plus any "Ou:" alternatives.
 * A refrain runs until "Repete-se" (which the missal prints once per
 * response, so the flag covers the whole block); anything after that rubric
 * that isn't another "Ou:" is body text the API spilled into the block, and
 * comes back as `trailing` for the caller to re-emit.
 */
export function parseRefrainBlock(lines: string[]): { refrains: string[]; repeats: boolean; trailing: string[] } {
    const refrains: string[] = [];
    const trailing: string[] = [];
    let repeats = false;
    let closed = false; // the refrain being read hit its "Repete-se"

    for (const line of lines) {
        if (ALT_RE.test(line)) {
            refrains.push(line.replace(ALT_RE, ''));
            closed = false;
        } else if (closed) {
            trailing.push(line);
            continue;
        } else if (refrains.length === 0) {
            refrains.push(line.replace(REFRAIN_RE, ''));
        } else {
            refrains[refrains.length - 1] += ` ${line}`;
        }

        const current = refrains[refrains.length - 1];
        if (REPEATS_RE.test(current)) {
            refrains[refrains.length - 1] = current.replace(REPEATS_RE, '');
            repeats = true;
            closed = true;
        }
    }

    return { refrains: refrains.map((r) => r.trim()).filter(Boolean), repeats, trailing };
}

// Canonical section IDs for stable TOC anchor links.
const SECTION_ID_MAP: Array<[RegExp, string]> = [
    [/^LEITURA\s+I$/i,          'leitura-i'],
    [/^LEITURA\s+III/i,          'leitura-iii'], // before II — "III" also starts with "II"
    [/^LEITURA\s+II/i,           'leitura-ii'],
    [/^SALMO\s+RESPONSORIAL/i,   'salmo'],
    [/^EVANGELHO/i,              'evangelho'],
];

function slugify(label: string): string {
    return label
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip combining accents
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

function getSectionId(label: string): string {
    return SECTION_ID_MAP.find(([re]) => re.test(label))?.[1] ?? slugify(label);
}

// Display label for the TOC: reading headers are ALL-CAPS in the source
// ("LEITURA I") and want title-case with Roman numerals kept uppercase.
function readingDisplayLabel(label: string): string {
    return label
        .toLowerCase()
        .split(/\s+/)
        .map((w) => (/^(i{1,3}|iv)$/i.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
        .join(' ');
}

/**
 * Adds semantic CSS classes and anchor IDs to the reading HTML so the
 * stylesheet renders proper typographic hierarchy and the TOC can navigate:
 *
 *   .reading-section-header[id]  — the LEITURA / SALMO / EVANGELHO line
 *     .reading-label              — the ALL-CAPS section name
 *     .reading-ref                — the scripture reference
 *     .reading-title              — the descriptive title in «»
 *   .reading-source               — "Leitura do Livro do Êxodo" attribution
 *   .reading-ending               — "Palavra do Senhor." / "Palavra da salvação."
 */
function enrichReadingTypography(doc: Document): void {
    // Header lines as Pass 2 split them, for Pass 3 to read the psalm refrain
    // back out of — the flattened .reading-title has lost the line breaks the
    // refrain and its "Ou:" alternatives are separated by.
    const headerLines = new Map<Element, string[]>();

    // ── Pass 1: split "Palavra do Senhor." out of body paragraphs ───────
    doc.querySelectorAll('p').forEach((p) => {
        const nodes = Array.from(p.childNodes);
        let lastBrIdx = -1;
        for (let i = nodes.length - 1; i >= 0; i--) {
            if (nodes[i].nodeName === 'BR') { lastBrIdx = i; break; }
        }
        if (lastBrIdx === -1) return;

        const afterNodes = nodes.slice(lastBrIdx + 1);
        const endingNode = afterNodes.find(
            (n) => n.nodeType === Node.TEXT_NODE && ENDING_RE.test(n.textContent?.trim() ?? '')
        );
        if (!endingNode) return;

        p.removeChild(nodes[lastBrIdx]);
        p.removeChild(endingNode);

        const endingP = doc.createElement('p');
        endingP.className = 'reading-ending';
        endingP.textContent = (endingNode.textContent ?? '').trim();
        p.after(endingP);
    });

    // ── Pass 2: section headers, source lines ────────────────────────────
    doc.querySelectorAll('p').forEach((p) => {
        const firstEl = p.children[0] as HTMLElement | undefined;
        const label = firstEl?.textContent?.trim() ?? '';

        // Solemnities sometimes arrive with the whole Mass in <b> rather than
        // <strong> (Corpus Christi, Sacred Heart). Either tag opens a reading
        // section; the <b> branch below only ever sees the prayer headers,
        // whose labels don't match SECTION_LABEL_RE.
        if ((firstEl?.tagName === 'STRONG' || firstEl?.tagName === 'B') && SECTION_LABEL_RE.test(label)) {
            p.classList.add('reading-section-header');
            p.id = getSectionId(label);
            p.setAttribute('data-toc-label', readingDisplayLabel(label));
            firstEl.classList.add('reading-label');

            // Split the header at its <br>s: what precedes the first one is
            // the scripture reference, the rest are title lines (the <br>s
            // themselves go, so block/inline mixing can't add ghost lines).
            const isPsalm = /^SALMO/i.test(label);
            let seenBr = false;
            let line = '';
            const titleLines: string[] = [];
            const toRemove: ChildNode[] = [];

            for (const node of Array.from(p.childNodes)) {
                if (node === firstEl) continue;
                if (node.nodeName === 'BR') {
                    if (seenBr) titleLines.push(line);
                    line = '';
                    seenBr = true;
                    toRemove.push(node); // strip <br> from the header
                    continue;
                }
                if (!seenBr) {
                    if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
                        const span = doc.createElement('span');
                        span.className = 'reading-ref';
                        span.textContent = node.textContent;
                        node.replaceWith(span);
                    }
                    continue;
                }
                // Inline markup counts as part of a psalm header's lines:
                // refrains arrive wrapped in <em>/<strong>, and skipping
                // elements stranded that text up here while the refrain
                // below rendered empty. Other headers leave their elements
                // (a long <em> in one is a commentary, not a title) and the
                // whitespace spacing them out exactly where they are.
                if (!isPsalm && (node.nodeType !== Node.TEXT_NODE || !node.textContent?.trim())) continue;
                line += node.textContent ?? '';
                toRemove.push(node);
            }
            if (seenBr) titleLines.push(line);

            toRemove.forEach((n) => n.parentNode?.removeChild(n));

            const lines = titleLines.map(normalizeLine).filter(Boolean);
            if (lines.length > 0) {
                headerLines.set(p, lines);
                const titleSpan = doc.createElement('span');
                titleSpan.className = 'reading-title';
                titleSpan.textContent = lines.join(' ');
                p.appendChild(titleSpan);
            }
            return;
        }

        // Prayer / Mass-part headers (full missal only): "Antífona de entrada",
        // "Oração coleta", "Oração sobre as oblatas", "Prefácio", etc. These use
        // a <b> heading followed by <br>; the reading sections above have first
        // claim on <b>, so what reaches here is only ever a Mass part.
        const hasBrInP = Array.from(p.childNodes).some((n) => n.nodeName === 'BR');
        if (firstEl?.tagName === 'B' && hasBrInP && label.length > 0 && label.length <= 48) {
            p.classList.add('reading-prayer-header');
            p.id = getSectionId(label);
            p.setAttribute('data-toc-label', label);
            firstEl.classList.add('reading-prayer-label');

            // The label is display:block; drop the <br> right after it (and any
            // whitespace text node between) so it doesn't add an empty line.
            let n = firstEl.nextSibling;
            while (n && n.nodeType === Node.TEXT_NODE && !n.textContent?.trim()) {
                const next = n.nextSibling;
                n.parentNode?.removeChild(n);
                n = next;
            }
            if (n && n.nodeName === 'BR') n.parentNode?.removeChild(n);
            return;
        }

        // Source attribution ("Leitura do Livro do Êxodo")
        const firstChild = p.firstChild;
        const hasBr = Array.from(p.childNodes).some((n) => n.nodeName === 'BR');
        if (hasBr && firstChild?.nodeType === Node.TEXT_NODE
            && SOURCE_RE.test(firstChild.textContent?.trim() ?? '')) {
            // Long attributions arrive split by <br> ("Leitura da Primeira
            // Epístola do apóstolo São Paulo<br>aos Coríntios"). Absorb
            // continuation lines — they start lowercase, unlike the body
            // ("Irmãos:", "Naqueles dias", …) — so the dashed rule doesn't
            // cut the attribution mid-sentence.
            const parts = [firstChild.textContent ?? ''];
            let n = firstChild.nextSibling;
            while (
                n?.nodeName === 'BR' &&
                n.nextSibling?.nodeType === Node.TEXT_NODE &&
                /^[a-záàâãéêíóôõúç]/.test(n.nextSibling.textContent?.trim() ?? '')
            ) {
                const textNode = n.nextSibling;
                parts.push((textNode.textContent ?? '').trim());
                const after = textNode.nextSibling;
                p.removeChild(n);
                p.removeChild(textNode);
                n = after;
            }
            const span = doc.createElement('span');
            span.className = 'reading-source';
            span.textContent = parts.join(' ').replace(/\s+/g, ' ').trim();
            firstChild.replaceWith(span);
        }
    });

    // ── Pass 3: surface the responsorial-psalm refrain ───────────────────
    doc.querySelectorAll('p.reading-section-header').forEach((header) => {
        const label = header.querySelector('.reading-label')?.textContent ?? '';
        if (!/^SALMO/i.test(label)) return;

        // The refrain block arrives as <br>-separated lines, either inside
        // the header ("(R. 97a) Refrão: … Repete-se") or as its own plain
        // paragraph right after it on days where the API keeps them apart.
        // Either way, lift the whole block into one highlighted box.
        let block: string[] = [];
        const lines = headerLines.get(header) ?? [];
        const refrainIdx = lines.findIndex((l) => REFRAIN_RE.test(l));
        if (refrainIdx >= 0) {
            block = lines.slice(refrainIdx);

            // Rebuild the small title from what is left, handing a "(R. 8bc)"
            // continuation line back to the reference it was split from
            // rather than showing it as the reading's descriptive title.
            const rest = lines.slice(0, refrainIdx);
            const refPart = rest.filter((l) => RESPONSE_REF_RE.test(l));
            const titlePart = rest.filter((l) => !RESPONSE_REF_RE.test(l));
            const refSpan = header.querySelector('.reading-ref');
            if (refSpan && refPart.length > 0) {
                refSpan.textContent = `${(refSpan.textContent ?? '').trimEnd()} ${refPart.join(' ')}`;
            }
            const title = header.querySelector('.reading-title');
            if (titlePart.length > 0) {
                if (title) title.textContent = titlePart.join(' ');
            } else {
                title?.remove();
            }
        } else {
            const next = header.nextElementSibling;
            if (next?.tagName === 'P' && next.classList.length === 0) {
                const nextLines = elementLines(next);
                if (REFRAIN_RE.test(nextLines[0] ?? '')) {
                    block = nextLines;
                    next.remove();
                }
            }
        }

        // Extra "Ou:" refrains sometimes get a paragraph of their own — the
        // Easter octave gives Sunday II three responses this way.
        let sibling = header.nextElementSibling;
        while (sibling?.tagName === 'P' && sibling.classList.length === 0) {
            const altLines = elementLines(sibling);
            if (!ALT_RE.test(altLines[0] ?? '')) break;
            block = block.concat(altLines);
            const after = sibling.nextElementSibling;
            sibling.remove();
            sibling = after;
        }

        if (block.length > 0) {
            const { refrains, repeats, trailing } = parseRefrainBlock(block);
            if (refrains.length > 0) {
                const refrainP = doc.createElement('p');
                refrainP.className = 'psalm-refrain';
                refrainP.append(`℟ ${refrains[0]}`);
                for (const alt of refrains.slice(1)) {
                    const altSpan = doc.createElement('span');
                    altSpan.className = 'psalm-refrain-alt';
                    altSpan.textContent = `Ou: ${alt}`;
                    refrainP.appendChild(altSpan);
                }
                if (repeats) {
                    const note = doc.createElement('span');
                    note.className = 'psalm-refrain-note';
                    note.textContent = 'Repete-se';
                    refrainP.appendChild(note);
                }
                header.after(refrainP);

                // Upstream occasionally runs the psalm's first stanza into the
                // refrain paragraph. Give it back its own lines instead of
                // burying it inside the highlighted box.
                if (trailing.length > 0) {
                    const stanza = doc.createElement('p');
                    trailing.forEach((l, i) => {
                        if (i > 0) stanza.appendChild(doc.createElement('br'));
                        stanza.append(l);
                    });
                    refrainP.after(stanza);
                }
            }
        }

        // Color the "Refrão" cue that closes each stanza
        let node = header.nextElementSibling;
        while (node && !node.classList.contains('reading-section-header')) {
            const last = node.lastChild;
            if (node.tagName === 'P' && !node.classList.contains('psalm-refrain')
                && last && last.nodeType === Node.TEXT_NODE && /Refrão\s*$/.test(last.textContent ?? '')) {
                last.textContent = (last.textContent ?? '').replace(/\s*Refrão\s*$/, ' ');
                const cue = doc.createElement('span');
                cue.className = 'psalm-cue';
                cue.textContent = '℟ Refrão';
                node.appendChild(cue);
            }
            node = node.nextElementSibling;
        }
    });

    // ── Pass 4: dedupe anchor ids ────────────────────────────────────────
    // Days with alternative readings repeat a section header (e.g. the
    // optional gospel on the memorial of Sts Martha, Mary and Lazarus gives
    // two EVANGELHO sections). Same id twice breaks the TOC: both chips
    // scroll to and highlight the first. Suffix repeat ids and tell the
    // labels apart by their scripture reference (book + chapter).
    const anchors = Array.from(doc.querySelectorAll<HTMLElement>('[id][data-toc-label]'));
    const idTotals = new Map<string, number>();
    anchors.forEach((h) => idTotals.set(h.id, (idTotals.get(h.id) ?? 0) + 1));
    const idSeen = new Map<string, number>();
    anchors.forEach((h) => {
        if ((idTotals.get(h.id) ?? 0) < 2) return;
        const base = h.id;
        const n = (idSeen.get(base) ?? 0) + 1;
        idSeen.set(base, n);
        if (n > 1) h.id = `${base}-${n}`;
        const ref = h.querySelector('.reading-ref')?.textContent?.split(',')[0].trim();
        const label = h.getAttribute('data-toc-label') ?? '';
        h.setAttribute('data-toc-label', ref ? `${label} (${ref})` : `${label} ${n}`);
    });
}

/**
 * Slices the readings out of a full missal text, dropping the prayers that
 * frame them and the Alleluia verse the reading view doesn't show.
 *
 * The section labels arrive in <b> on some solemnities and <strong> on most
 * days, so every marker here has to accept either — anchoring on <strong>
 * alone made these days miss the "LEITURA I" start and fall back to the whole
 * missal, prayers and all.
 */
export function extractReadings(html: string): string {
    const start = html.search(/<p>\s*<(?:b|strong)>LEITURA I\b/i);
    if (start === -1) return html;

    // What follows the Gospel is the offertory and on: stop at whichever
    // marker comes first. The emphasis around them varies too (<b>, <strong>,
    // <em>, or nothing at all), so none of it is required.
    const postStart = html.slice(start);
    const endMatch = postStart.search(
        /<p>\s*(?:<(?:b|strong)>\s*)?(?:Oração sobre as oblatas|Prefácio|Credo)\b|<p>\s*(?:<em>\s*)?Diz-se o Credo/i
    );
    const end = endMatch !== -1 ? start + endMatch : html.length;

    return html.slice(start, end).replace(
        /<p>\s*<(b|strong)>(?:ALELUIA|ACLAMAÇÃO ANTES DO EVANGELHO)<\/\1>[\s\S]*?(?=<p>\s*<(b|strong)>EVANGELHO<\/\2>)/i,
        ''
    );
}

export function enrichReadingHtml(html: string): string {
    if (typeof DOMParser === 'undefined' || !html) return html;

    const safe = DOMPurify.sanitize(html);
    const doc = new DOMParser().parseFromString(safe, 'text/html');

    doc.querySelectorAll('p').forEach((p) => {
        const directText = Array.from(p.childNodes)
            .filter((n) => n.nodeType === Node.TEXT_NODE)
            .map((n) => n.textContent || '')
            .join('')
            .trim();
        const childEls = Array.from(p.children);
        const allItalic = childEls.length > 0 &&
            childEls.every((c) => c.tagName === 'I' || c.tagName === 'EM');

        if (directText || !allItalic) return;

        const wrapper = doc.createElement('div');
        wrapper.className = 'reading-commentary collapsed';
        wrapper.innerHTML =
            '<button type="button" class="commentary-toggle" aria-expanded="false">' +
            '<span class="commentary-chevron" aria-hidden="true">▸</span>' +
            '<span>Comentário</span>' +
            '</button>' +
            '<div class="commentary-body"></div>';
        wrapper.querySelector('.commentary-body')!.appendChild(p.cloneNode(true));
        p.replaceWith(wrapper);
    });

    enrichReadingTypography(doc);
    return doc.body.innerHTML;
}
