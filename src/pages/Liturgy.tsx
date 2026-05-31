import { useState, useEffect, useMemo } from "react";
import { ChevronRight, Calendar, Filter } from "lucide-react";
import DOMPurify from "dompurify";
import { fetchDailyLiturgy } from "@/lib/liturgy";
import type { DailyLiturgy } from "@/lib/liturgy";
import { useAppStore } from "@/store/app";

// Labels that open a liturgical reading section.
const SECTION_LABEL_RE = /^(LEITURA\s+(I{1,3}|IV)|SALMO RESPONSORIAL|EVANGELHO|ALELUIA|ACLAMAÇÃO)/i;
// Lines that close a reading ("Palavra do Senhor.", "Palavra da salvação.").
const ENDING_RE = /^Palavra (do Senhor|da salvação|do Evangelho)/i;
// First line of a reading body paragraph — the scripture source attribution.
const SOURCE_RE = /^(Leitura (do|da|de|aos|ao)|Do Livro|Da Carta|Do Profeta|Dos Actos|Do Apocalipse|Da Primeira|Da Segunda|Da Terceira|Evangelho de Nosso Senhor)/i;

/**
 * Adds semantic CSS classes to the reading HTML so the stylesheet can render
 * proper typographic hierarchy:
 *
 *   .reading-section-header  — the LEITURA / SALMO / EVANGELHO line
 *     .reading-label          — the ALL-CAPS section name
 *     .reading-ref            — the scripture reference  (e.g. "Ex 34, 4b-6")
 *     .reading-title          — the descriptive title    (e.g. «O Senhor…»)
 *   .reading-source           — "Leitura do Livro do Êxodo" attribution
 *   .reading-ending           — "Palavra do Senhor." / "Palavra da salvação."
 */
function enrichReadingTypography(doc: Document): void {
    // ── Pass 1: split "Palavra do Senhor." out of body paragraphs ───────
    // The API embeds the acclamation as the last <br>-separated line inside
    // the reading paragraph rather than as its own <p>. Splitting it out
    // lets the stylesheet centre and style it independently.
    doc.querySelectorAll('p').forEach((p) => {
        const nodes = Array.from(p.childNodes);

        // Find the last <br> in this paragraph.
        let lastBrIdx = -1;
        for (let i = nodes.length - 1; i >= 0; i--) {
            if (nodes[i].nodeName === 'BR') { lastBrIdx = i; break; }
        }
        if (lastBrIdx === -1) return;

        // Is the text after the last <br> an ending line?
        const afterNodes = nodes.slice(lastBrIdx + 1);
        const endingNode = afterNodes.find(
            (n) => n.nodeType === Node.TEXT_NODE && ENDING_RE.test(n.textContent?.trim() ?? '')
        );
        if (!endingNode) return;

        // Detach the <br> and the ending text from this paragraph.
        p.removeChild(nodes[lastBrIdx]);
        p.removeChild(endingNode);

        // Insert a standalone ending paragraph immediately after.
        const endingP = doc.createElement('p');
        endingP.className = 'reading-ending';
        endingP.textContent = (endingNode.textContent ?? '').trim();
        p.after(endingP);
    });

    // ── Pass 2: section headers, source lines ────────────────────────────
    doc.querySelectorAll('p').forEach((p) => {
        // Section headers
        const firstEl = p.children[0] as HTMLElement | undefined;
        if (firstEl?.tagName === 'STRONG' && SECTION_LABEL_RE.test(firstEl.textContent?.trim() ?? '')) {
            p.classList.add('reading-section-header');
            firstEl.classList.add('reading-label');

            let seenBr = false;
            for (const node of Array.from(p.childNodes)) {
                if (node === firstEl) continue;
                if (node.nodeName === 'BR') { seenBr = true; continue; }
                if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
                    const span = doc.createElement('span');
                    span.className = seenBr ? 'reading-title' : 'reading-ref';
                    span.textContent = node.textContent;
                    node.replaceWith(span);
                }
            }
            return;
        }

        // Source attribution ("Leitura do Livro do Êxodo")
        const firstChild = p.firstChild;
        const hasBr = Array.from(p.childNodes).some((n) => n.nodeName === 'BR');
        if (hasBr && firstChild?.nodeType === Node.TEXT_NODE
            && SOURCE_RE.test(firstChild.textContent?.trim() ?? '')) {
            const span = doc.createElement('span');
            span.className = 'reading-source';
            span.textContent = firstChild.textContent;
            firstChild.replaceWith(span);
        }
    });
}

/**
 * Wraps each fully-italic paragraph (the introductory commentary that precedes
 * the readings) in a collapsible block, collapsed by default. Toggling is
 * handled via event delegation on the article (see handleToggleCommentary).
 * Also enriches section headers, source lines and endings with semantic
 * classes for the reading typography stylesheet.
 *
 * The incoming HTML comes from a remote API and is rendered with
 * dangerouslySetInnerHTML, so it is sanitized with DOMPurify first to strip
 * scripts, inline event handlers and javascript: URLs (the app keeps a Nostr
 * private key in localStorage, so an injected script would be high-impact).
 */
function makeCommentariesCollapsible(html: string): string {
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

        // A commentary paragraph is one whose entire content is italic.
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

    // Run after commentaries so we don't process already-wrapped nodes.
    enrichReadingTypography(doc);

    return doc.body.innerHTML;
}

export default function Liturgy() {
    const [liturgy, setLiturgy] = useState<DailyLiturgy | null>(null);
    const [loading, setLoading] = useState(true);
    const [showOnlyReadings, setShowOnlyReadings] = useState(true);

    const { incrementStreak, liturgicalDescription } = useAppStore();

    useEffect(() => {
        async function loadLiturgy() {
            setLoading(true);
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;

            const data = await fetchDailyLiturgy(dateStr);
            setLiturgy(data);
            if (data?.saintOfDay !== 'Sem Ligação') {
                incrementStreak('liturgy');
                const { publishStreakToNostr } = await import('@/lib/nostr');
                publishStreakToNostr();
            }
            setLoading(false);
        }

        loadLiturgy();
    }, [incrementStreak]);

    const displayHtml = useMemo(() => {
        if (!liturgy?.htmlContent) return '';

        let result: string;
        if (!showOnlyReadings) {
            result = liturgy.htmlContent;
        } else {
            const html = liturgy.htmlContent;
            const startIdx = html.indexOf('<p><strong>LEITURA I');
            if (startIdx === -1) {
                result = html;
            } else {
                // End markers use <b> tags (not <strong>) in the API response;
                // Credo appears as plain text "Diz-se o Credo."
                const postStart = html.slice(startIdx);
                const endMatch = postStart.search(
                    /<p>(?:<b>(?:Oração sobre as oblatas|Prefácio)|Diz-se o Credo|<strong>(?:Credo|Oração sobre as oblatas))/i
                );
                const endIdx = endMatch !== -1 ? startIdx + endMatch : html.length;

                let extracted = html.substring(startIdx, endIdx);

                // Remove Gospel acclamation — API uses "ALELUIA" heading, not "ACLAMAÇÃO ANTES DO EVANGELHO"
                extracted = extracted.replace(
                    /<p><strong>(?:ALELUIA|ACLAMAÇÃO ANTES DO EVANGELHO)<\/strong>[\s\S]*?(?=<p><strong>EVANGELHO<\/strong>)/i,
                    ''
                );
                result = extracted;
            }
        }

        return makeCommentariesCollapsible(result);
    }, [liturgy, showOnlyReadings]);

    // Expand/collapse the italic commentary blocks (event delegation, since the
    // content is injected HTML).
    const handleToggleCommentary = (e: React.MouseEvent<HTMLElement>) => {
        const toggle = (e.target as HTMLElement).closest('.commentary-toggle');
        if (!toggle) return;
        const container = toggle.closest('.reading-commentary');
        if (!container) return;
        const isOpen = container.classList.toggle('collapsed') === false;
        toggle.setAttribute('aria-expanded', String(isOpen));
    };

    const [isScrolled, setIsScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <div className="max-w-md mx-auto flex-1 w-full flex flex-col">
            <header className={`sticky top-0 z-30 bg-[#FAF9F6]/90 dark:bg-[#121212]/90 backdrop-blur-md flex flex-col shrink-0 border-b transition-all duration-300 ${isScrolled
                ? 'p-4 pt-6 gap-2 border-zinc-200/50 dark:border-zinc-800/50 shadow-sm'
                : 'p-6 pt-12 gap-4 border-transparent'
                }`}>
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => window.history.back()}
                        className={`bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 rounded-full shadow-sm transition-all duration-300 flex-shrink-0 ${isScrolled ? 'p-1.5' : 'p-2'
                            }`}
                    >
                        <ChevronRight className="rotate-180" size={isScrolled ? 20 : 24} />
                    </button>
                    <div className="min-w-0">
                        <h1 className={`font-bold tracking-tight text-zinc-900 dark:text-zinc-50 transition-all duration-300 truncate ${isScrolled ? 'text-xl' : 'text-3xl'
                            }`}>Missa Diária</h1>
                        <p className={`text-zinc-500 capitalize font-medium mt-0.5 transition-all duration-300 truncate ${isScrolled ? 'text-xs opacity-80' : 'text-sm'
                            }`}>{liturgy?.saintOfDay || 'A carregar...'}</p>
                    </div>
                </div>
            </header>

            <div className="p-6 pt-2 space-y-6 flex-1 flex flex-col">

                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                        <div className="h-8 w-8 rounded-full border-4 border-zinc-200 border-t-amber-500 animate-spin"></div>
                        <p className="text-zinc-400">A obter leituras de hoje...</p>
                    </div>
                ) : liturgy ? (
                    <div className="space-y-6 flex-1 flex flex-col">
                        {/* Header Info Banner */}
                        <div className="bg-liturgy-50 dark:bg-liturgy-950/20 border border-liturgy-100 dark:border-liturgy-900/50 rounded-2xl p-4 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                <Calendar className="text-liturgy-600 dark:text-liturgy-400" size={24} />
                                <div>
                                    <p
                                        className="font-semibold text-liturgy-900 dark:text-liturgy-100 capitalize"
                                        style={{ fontSize: 'var(--content-font-size, 21px)', fontFamily: 'var(--content-font-family, inherit)' }}
                                    >
                                        {new Date(liturgy.date).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}
                                    </p>
                                    {liturgicalDescription && (
                                        <p
                                            className="mt-1 text-liturgy-800 dark:text-liturgy-300 leading-snug whitespace-pre-line"
                                            style={{ fontSize: 'calc(var(--content-font-size, 21px) * 0.82)', fontFamily: 'var(--content-font-family, inherit)' }}
                                        >
                                            {liturgicalDescription}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Filter Toggle */}
                        <div className="flex items-center justify-end">
                            <button
                                onClick={() => setShowOnlyReadings(!showOnlyReadings)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${showOnlyReadings
                                    ? 'bg-liturgy-100 dark:bg-liturgy-900/40 text-liturgy-700 dark:text-liturgy-400 border-liturgy-200 dark:border-liturgy-800'
                                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-transparent hover:bg-zinc-200 dark:hover:bg-zinc-700'
                                    }`}
                            >
                                <Filter size={16} />
                                {showOnlyReadings ? 'Apenas Leituras' : 'Missal Completo'}
                            </button>
                        </div>

                        {/* Mass Readings */}
                        <article className="
                        flex-1
                        content-text
                        text-zinc-800 dark:text-zinc-200
                        [&_strong]:font-bold [&_strong]:text-zinc-900 dark:[&_strong]:text-zinc-100
                        [&_em]:italic [&_em]:text-zinc-700 dark:[&_em]:text-zinc-300
                        [&_i]:italic [&_i]:text-zinc-700 dark:[&_i]:text-zinc-300
                        [&_br]:mb-2
                    "
                            onClick={handleToggleCommentary}
                        >
                            <div dangerouslySetInnerHTML={{ __html: displayHtml }} />
                        </article>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-zinc-50 dark:bg-zinc-900 rounded-2xl">
                        <p className="text-zinc-500">Não foi possível carregar a liturgia de hoje.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
