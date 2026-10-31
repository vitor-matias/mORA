// Renders assembled breviary blocks (src/lib/breviary/assemble.ts) exactly
// like the API-served office: the blocks are serialised into the API's own
// markup (red-span h3 headings, <br />-joined lines, stanza paragraphs) and
// styled by the same classes, so both renders cannot drift apart.

import DOMPurify from "dompurify";
import type { AssembledSection } from "@/lib/breviary/assemble";
import type { ComumBlock } from "@/lib/breviary/comum";

// Classes that make API-served HTML match the page's typography — shared by
// every spliced render.
const API_HTML_CLASSES = "content-text text-zinc-800 dark:text-zinc-200 [&_p]:mb-3 [&_p:last-child]:mb-0 [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-liturgy-600 dark:[&_h3]:text-liturgy-400 [&_h3]:mt-6 [&_h3]:mb-2 [&_h6]:text-sm [&_h6]:font-semibold [&_h6]:text-zinc-500 [&_h6]:mb-4 [&_strong]:font-bold [&_strong]:text-zinc-900 dark:[&_strong]:text-zinc-100 [&_em]:italic";

/** API office HTML, sanitized and styled like the rest of the page. */
export function ApiHtml({ html }: { html: string }) {
    return <div className={API_HTML_CLASSES} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />;
}

// --- The API's markup vocabulary. It paints rubrics with literal inline
// --- red (#ff0000), so ours do too.

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const red = (html: string) => `<span style="color: #ff0000;">${html}</span>`;
const h3 = (html: string) => `<h3>${red(html)}</h3>`;
const p = (html: string) => `<p>${html}</p>`;
const lines = (text: string) => text.split('\n').map(esc).join('<br />\n');

// Implied after every psalm and canticle; the API prints it, the book not.
const GLORIA = p('Glória ao Pai e ao Filho *<br />\ne ao Espírito Santo,<br />\ncomo era no princípio, *<br />\nagora e sempre. Amen.');
// Daniel 3's canticle is the one that ends in its own doxology instead.
const NO_GLORIA = /Dn 3, ?57/;

const KIND_LABEL: Record<string, string> = {
    'hino': 'Hino',
    'leitura': 'Leitura breve',
    'responsório': 'Responsório breve',
    'leitura-1': 'Primeira leitura',
    'leitura-2': 'Segunda leitura',
    'preces': 'Preces',
    'oração': 'Oração',
};

/** V./R. markers (and the responsory's "*") red, the spoken text plain. */
function dialogue(text: string): string {
    return text
        .split('\n')
        .map((line) => {
            const m = line.match(/^([VR]\.)\s*(.*)$/);
            return m ? `${red(m[1])} ${esc(m[2]).replace(/ \* /g, ` ${red('*')} `)}` : esc(line);
        })
        .join('<br />\n');
}

/**
 * Preces as the API sets them: the intro with its response in italics,
 * then one paragraph per petition, its second half after a red dash.
 */
function preces(text: string): string {
    const paras: string[] = [];
    let cur: string | null = null;
    let prev = '';
    for (const line of text.split('\n')) {
        if (cur !== null && line.startsWith('—')) {
            cur += `<br />\n${red('—')} ${esc(line.replace(/^—\s*/, ''))}`;
        } else if (cur !== null && paras.length === 0 && prev.endsWith(':')) {
            cur += `<br />\n<em>${esc(line)}</em>`;
        } else {
            if (cur !== null) paras.push(p(cur));
            cur = esc(line);
        }
        prev = line;
    }
    if (cur !== null) paras.push(p(cur));
    return paras.join('\n');
}

/**
 * An alternative ("Ou", "Por vários Defuntos") follows its kind-mate with
 * only rubrics between — the book does not repeat the header for it.
 */
function isAlternative(blocks: ComumBlock[], i: number): boolean {
    // Variant siblings with their own ref (one leitura per audience) keep it.
    if (blocks[i].ref || blocks[i].variant) return false;
    for (let j = i - 1; j >= 0; j--) {
        if (blocks[j].kind === blocks[i].kind) return true;
        if (blocks[j].kind !== 'rubrica') return false;
    }
    return false;
}

function blockHtml(block: ComumBlock, alternative: boolean): string {
    const text = block.text ?? '';
    const label = alternative ? null : KIND_LABEL[block.kind];
    switch (block.kind) {
        case 'html': // spliced-in API sections (Invocação inicial, Despedida)
            return text;
        case 'rubrica':
            // "Ou" between alternatives is the API's bold rubric.
            return /^Ou\b/.test(text) && text.length < 30 ? p(`<strong>${red(esc(text))}</strong>`) : p(red(lines(text)));
        case 'salmo': {
            const stanzas: string[][] = [];
            for (const v of block.verses ?? []) {
                if (v.stanza || stanzas.length === 0) stanzas.push([]);
                stanzas[stanzas.length - 1].push(esc(v.text));
            }
            return [
                p(`<strong>${red(esc(block.ref ?? ''))}</strong>`),
                block.title ? p(red(esc(block.title))) : '',
                block.source ? p(`<em>${esc(block.source)}</em>`) : '',
                ...stanzas.map((s) => p(s.join('<br />\n'))),
                NO_GLORIA.test(block.ref ?? '') ? '' : GLORIA,
            ].join('\n');
        }
        case 'ant':
        case 'ant-benedictus':
        case 'ant-magnificat':
            return p(`${red(`Ant.${block.n ? ` ${block.n}` : ''}`)} ${esc(text)}`);
        case 'leitura':
            return (label ? h3(esc(`${label}${block.ref ? ` ${block.ref}` : ''}`)) : '') + p(lines(text));
        case 'leitura-1':
        case 'leitura-2':
            return [
                label ? h3(label) : '',
                block.source || block.ref
                    ? p(`${lines(block.source ?? '')}${block.ref ? ` ${red(esc(block.ref))}` : ''}`)
                    : '',
                block.title ? p(`<em>${red(esc(block.title))}</em>`) : '',
                ...text.split('\n\n').map((para) => p(esc(para))),
            ].join('\n');
        case 'responsório':
            return (label ? h3(label) : '') + p(dialogue(text));
        case 'responsório-leitura': // a red line, not a heading, in the API
            return p(red(esc(`Responsório${block.ref ? ` ${block.ref}` : ''}`))) + p(dialogue(text));
        case 'versículo':
            return p(dialogue(text));
        case 'hino':
            return (label ? h3(label) : '') + text.split('\n\n').map((s) => p(lines(s))).join('\n');
        case 'preces':
            return (label ? h3(label) : '') + preces(text);
        default:
            return (label ? h3(label) : '') + p(lines(text));
    }
}

/** A section's blocks in the API's markup, with its structural headings. */
function blocksHtml(blocks: ComumBlock[]): string {
    // "Salmodia" heads the antiphon(s) leading into the first psalm.
    let salmodiaAt = blocks.findIndex((b) => b.kind === 'salmo');
    while (salmodiaAt > 0 && blocks[salmodiaAt - 1].kind === 'ant') salmodiaAt--;
    const canticleAt = blocks.findIndex((b) => b.kind === 'ant-benedictus' || b.kind === 'ant-magnificat');

    return blocks
        .map((block, i) => {
            const heads = [
                i === salmodiaAt ? h3('Salmodia') : '',
                i === canticleAt
                    ? h3(`Cântico evangélico (<em>${block.kind === 'ant-benedictus' ? 'Benedictus' : 'Magnificat'}</em>)`)
                    : '',
                // Audience variant and seasonal alternatives keep their
                // rubric label — choosing is the reader's call, as in the book.
                block.variant || block.season ? p(red(esc([block.variant, block.season].filter(Boolean).join(' — ')))) : '',
            ];
            return heads.join('') + blockHtml(block, isAlternative(blocks, i));
        })
        .join('\n');
}

export function BreviaryBlocks({ sections }: { sections: AssembledSection[] }) {
    return (
        <div className="space-y-6">
            {sections.map((section) => (
                <div key={section.title} id={`section-${section.title}`} className="space-y-3">
                    {/* Same header style the page gives API-fed sections. An
                        empty title renders blocks alone (spliced layouts). */}
                    {section.title && (
                        <h3 className="text-sm font-bold text-liturgy-700 dark:text-liturgy-400 uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800 pb-2">
                            {section.title}
                        </h3>
                    )}
                    {section.blocks.length > 0 && <ApiHtml html={blocksHtml(section.blocks)} />}
                </div>
            ))}
        </div>
    );
}
