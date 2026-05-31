import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { ChevronRight, Calendar, Filter, Play, Pause, Minus, Plus } from "lucide-react";
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

// Canonical section IDs for stable TOC anchor links.
const SECTION_ID_MAP: Array<[RegExp, string]> = [
    [/^LEITURA\s+I$/i,          'leitura-i'],
    [/^LEITURA\s+II/i,           'leitura-ii'],
    [/^LEITURA\s+III/i,          'leitura-iii'],
    [/^SALMO\s+RESPONSORIAL/i,   'salmo'],
    [/^EVANGELHO/i,              'evangelho'],
];

function getSectionId(label: string): string {
    return (
        SECTION_ID_MAP.find(([re]) => re.test(label))?.[1]
        ?? label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    );
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

        if (firstEl?.tagName === 'STRONG' && SECTION_LABEL_RE.test(label)) {
            p.classList.add('reading-section-header');
            p.id = getSectionId(label);
            firstEl.classList.add('reading-label');

            // Collect ref text and title parts separately, removing all <br>s
            // from the header so block/inline mixing doesn't create ghost lines.
            let seenBr = false;
            const titleParts: string[] = [];
            const toRemove: ChildNode[] = [];

            for (const node of Array.from(p.childNodes)) {
                if (node === firstEl) continue;
                if (node.nodeName === 'BR') {
                    seenBr = true;
                    toRemove.push(node); // strip <br> from the header
                    continue;
                }
                if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
                    if (!seenBr) {
                        const span = doc.createElement('span');
                        span.className = 'reading-ref';
                        span.textContent = node.textContent;
                        node.replaceWith(span);
                    } else {
                        titleParts.push(node.textContent.trim());
                        toRemove.push(node);
                    }
                }
            }

            toRemove.forEach((n) => n.parentNode?.removeChild(n));

            if (titleParts.length > 0) {
                const titleSpan = doc.createElement('span');
                titleSpan.className = 'reading-title';
                titleSpan.textContent = titleParts.join(' ');
                p.appendChild(titleSpan);
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

// Pixels-per-second for each speed level (1 = slow, 2 = medium, 3 = fast).
const SCROLL_SPEEDS = [22, 42, 72] as const;

interface TocEntry { id: string; label: string; }

export default function Liturgy() {
    const [liturgy, setLiturgy] = useState<DailyLiturgy | null>(null);
    const [loading, setLoading] = useState(true);
    const [showOnlyReadings, setShowOnlyReadings] = useState(true);
    const [dateCardExpanded, setDateCardExpanded] = useState(false);

    // Autoscroll
    const [isAutoScrolling, setIsAutoScrolling] = useState(false);
    const [scrollSpeed, setScrollSpeed] = useState(2);
    const rafRef = useRef<number | null>(null);
    const lastTimeRef = useRef<number | null>(null);
    // Float accumulator for the scroll position. window.scrollTo/scrollBy
    // round to whole pixels per call, so the sub-pixel per-frame delta
    // (~0.3px at 120fps) would otherwise round to 0 and never advance.
    const scrollAccRef = useRef(0);
    // Speed kept in a ref so changes apply to the running loop immediately.
    const speedRef = useRef(scrollSpeed);
    useEffect(() => { speedRef.current = scrollSpeed; }, [scrollSpeed]);

    // Table of contents
    const articleRef = useRef<HTMLElement>(null);
    const [sections, setSections] = useState<TocEntry[]>([]);
    const [activeSection, setActiveSection] = useState('');

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
                const postStart = html.slice(startIdx);
                const endMatch = postStart.search(
                    /<p>(?:<b>(?:Oração sobre as oblatas|Prefácio)|Diz-se o Credo|<strong>(?:Credo|Oração sobre as oblatas))/i
                );
                const endIdx = endMatch !== -1 ? startIdx + endMatch : html.length;
                let extracted = html.substring(startIdx, endIdx);
                extracted = extracted.replace(
                    /<p><strong>(?:ALELUIA|ACLAMAÇÃO ANTES DO EVANGELHO)<\/strong>[\s\S]*?(?=<p><strong>EVANGELHO<\/strong>)/i,
                    ''
                );
                result = extracted;
            }
        }
        return makeCommentariesCollapsible(result);
    }, [liturgy, showOnlyReadings]);

    // Rebuild TOC after the article renders with new content.
    // We depend on both displayHtml (content) and loading (mount gate).
    // Fall back to document.querySelector in case the ref isn't captured yet.
    useEffect(() => {
        if (loading || !liturgy) return;
        const el = articleRef.current ?? document.querySelector<HTMLElement>('article');
        if (!el) return;
        const id = window.setTimeout(() => {
            const headers = el.querySelectorAll<HTMLElement>('[id].reading-section-header');
            if (headers.length === 0) return;
            setSections(Array.from(headers).map((h) => ({
                id: h.id,
                label: (h.querySelector('.reading-label') as HTMLElement | null)
                    ?.textContent?.trim() ?? h.id,
            })));
            setActiveSection('');
        }, 50);
        return () => window.clearTimeout(id);
    }, [displayHtml, loading, liturgy]);

    // Highlight the section currently in view (scrollspy).
    // An IntersectionObserver band is unreliable here: sections are long, so
    // between two headers nothing sits in the band and the highlight sticks
    // on the first one. Instead, on each scroll we pick the last header whose
    // top has crossed a line just below the sticky header.
    useEffect(() => {
        if (sections.length === 0) return;

        const onScroll = () => {
            // At (near) the page bottom the last headers can't reach the line,
            // so force the final section active.
            const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
            if (window.scrollY >= maxScroll - 2) {
                setActiveSection(sections[sections.length - 1].id);
                return;
            }

            const line = 140; // px below viewport top (clears the sticky header)
            let current = sections[0].id;
            for (const { id } of sections) {
                const el = document.getElementById(id);
                if (el && el.getBoundingClientRect().top - line <= 0) {
                    current = id;
                }
            }
            setActiveSection(current);
        };

        onScroll(); // set initial state
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, [sections]);

    // ── Autoscroll ────────────────────────────────────────────────────────

    const stopAutoScroll = useCallback(() => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        lastTimeRef.current = null;
        setIsAutoScrolling(false);
    }, []);

    const startAutoScroll = useCallback(() => {
        setIsAutoScrolling(true);
        // Seed the float accumulator with the current position so we don't
        // jump on start.
        scrollAccRef.current = window.scrollY;
        lastTimeRef.current = null;

        const step = (time: number) => {
            if (lastTimeRef.current !== null) {
                // Cap elapsed so a backgrounded tab doesn't leap on return.
                const elapsed = Math.min((time - lastTimeRef.current) / 1000, 0.1);
                const pxPerSec = SCROLL_SPEEDS[speedRef.current - 1];
                scrollAccRef.current += pxPerSec * elapsed;
                window.scrollTo(0, scrollAccRef.current);

                const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
                if (scrollAccRef.current >= maxScroll - 1) {
                    stopAutoScroll();
                    return;
                }
            }
            lastTimeRef.current = time;
            rafRef.current = requestAnimationFrame(step);
        };
        rafRef.current = requestAnimationFrame(step);
    }, [stopAutoScroll]);

    const toggleAutoScroll = useCallback(() => {
        if (isAutoScrolling) stopAutoScroll(); else startAutoScroll();
    }, [isAutoScrolling, startAutoScroll, stopAutoScroll]);

    // Pause when the user manually scrolls (touchmove = drag, not tap).
    // Using touchmove rather than touchstart means tapping speed/stop
    // controls won't accidentally cancel the scroll mid-session.
    useEffect(() => {
        if (!isAutoScrolling) return;
        const stop = () => stopAutoScroll();
        window.addEventListener('wheel', stop, { passive: true });
        window.addEventListener('touchmove', stop, { passive: true });
        return () => {
            window.removeEventListener('wheel', stop);
            window.removeEventListener('touchmove', stop);
        };
    }, [isAutoScrolling, stopAutoScroll]);

    // Clean up on unmount.
    useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

    const scrollToSection = useCallback((id: string) => {
        stopAutoScroll();
        const el = document.getElementById(id);
        if (el) {
            const offset = 88; // clear the sticky header
            const top = el.getBoundingClientRect().top + window.scrollY - offset;
            window.scrollTo({ top, behavior: 'smooth' });
        }
    }, [stopAutoScroll]);

    // Commentary expand/collapse (event delegation on article).
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
        const handleScroll = () => setIsScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // ── Shared UI pieces rendered in both sidebar (desktop) and toolbar (mobile) ──

    const filterButton = (
        <button
            onClick={() => setShowOnlyReadings(!showOnlyReadings)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors border w-full justify-center lg:justify-start ${
                showOnlyReadings
                    ? 'bg-liturgy-100 dark:bg-liturgy-900/40 text-liturgy-700 dark:text-liturgy-400 border-liturgy-200 dark:border-liturgy-800'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-transparent hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
        >
            <Filter size={15} />
            {showOnlyReadings ? 'Apenas Leituras' : 'Missal Completo'}
        </button>
    );

    const speedControls = isAutoScrolling ? (
        <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg px-2 py-1.5">
            <button
                onClick={() => setScrollSpeed((s) => Math.max(1, s - 1))}
                aria-label="Mais lento"
                className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors p-0.5"
            >
                <Minus size={12} />
            </button>
            <span className="text-zinc-500 dark:text-zinc-400 text-xs font-mono w-3 text-center select-none">
                {scrollSpeed}
            </span>
            <button
                onClick={() => setScrollSpeed((s) => Math.min(3, s + 1))}
                aria-label="Mais rápido"
                className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors p-0.5"
            >
                <Plus size={12} />
            </button>
        </div>
    ) : null;

    const scrollButton = (
        <button
            onClick={toggleAutoScroll}
            aria-label={isAutoScrolling ? 'Parar auto-scroll' : 'Iniciar auto-scroll'}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors border w-full justify-center lg:justify-start ${
                isAutoScrolling
                    ? 'bg-liturgy-600 dark:bg-liturgy-500 text-white border-liturgy-700 dark:border-liturgy-600'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-transparent hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
        >
            {isAutoScrolling ? <Pause size={15} /> : <Play size={15} className="translate-x-px" />}
            {isAutoScrolling ? 'Parar scroll' : 'Auto-scroll'}
        </button>
    );

    const dateCard = liturgy && (
        <div className="bg-liturgy-50 dark:bg-liturgy-950/20 border border-liturgy-100 dark:border-liturgy-900/50 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1">
                <Calendar className="text-liturgy-600 dark:text-liturgy-400 shrink-0" size={17} />
                <p
                    className="font-semibold text-liturgy-900 dark:text-liturgy-100 capitalize leading-snug"
                    style={{ fontFamily: 'var(--content-font-family, inherit)', fontSize: '0.9rem' }}
                >
                    {new Date(liturgy.date).toLocaleDateString('pt-PT', {
                        weekday: 'long', day: 'numeric', month: 'long',
                    })}
                </p>
            </div>
            {liturgicalDescription && (
                <>
                    <p
                        className={`text-liturgy-800 dark:text-liturgy-300 leading-snug whitespace-pre-line pl-6 ${dateCardExpanded ? '' : 'line-clamp-4'}`}
                        style={{ fontFamily: 'var(--content-font-family, inherit)', fontSize: '0.78rem' }}
                    >
                        {liturgicalDescription}
                    </p>
                    <button
                        onClick={() => setDateCardExpanded((v) => !v)}
                        className="mt-1 pl-6 text-liturgy-600 dark:text-liturgy-400 hover:text-liturgy-800 dark:hover:text-liturgy-200 transition-colors"
                        style={{ fontSize: '0.72rem', fontFamily: 'Inter, sans-serif' }}
                    >
                        {dateCardExpanded ? '▴ Ver menos' : '▾ Ver mais'}
                    </button>
                </>
            )}
        </div>
    );

    return (
        <div className="flex-1 w-full flex flex-col">

            {/* ── Sticky header ────────────────────────────────────────────── */}
            <header className={`sticky top-0 z-30 bg-[#FAF9F6]/90 dark:bg-[#121212]/90 backdrop-blur-md border-b transition-all duration-300 ${
                isScrolled
                    ? 'border-zinc-200/50 dark:border-zinc-800/50 shadow-sm py-3'
                    : 'border-transparent py-5 lg:py-6'
            }`}>
                <div className="max-w-5xl mx-auto px-6 flex items-center gap-4">
                    <button
                        onClick={() => window.history.back()}
                        className={`bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 rounded-full shadow-sm transition-all shrink-0 ${
                            isScrolled ? 'p-1.5' : 'p-2'
                        }`}
                    >
                        <ChevronRight className="rotate-180" size={isScrolled ? 20 : 24} />
                    </button>
                    <div className="min-w-0 flex-1">
                        <h1 className={`font-bold tracking-tight text-zinc-900 dark:text-zinc-50 transition-all truncate ${
                            isScrolled ? 'text-xl' : 'text-2xl lg:text-3xl'
                        }`}>
                            Missa Diária
                        </h1>
                        <p className={`text-zinc-500 capitalize font-medium mt-0.5 transition-all truncate ${
                            isScrolled ? 'text-xs opacity-80' : 'text-sm'
                        }`}>
                            {liturgy?.saintOfDay || 'A carregar...'}
                        </p>
                    </div>
                </div>
            </header>

            {/* ── Page body ────────────────────────────────────────────────── */}
            <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 pt-4 lg:pt-8 pb-20 flex-1 flex flex-col lg:flex-row lg:gap-12 lg:items-start">

                {/* ── Desktop sidebar ──────────────────────────────────────── */}
                {!loading && liturgy && (
                    <aside className="hidden lg:flex flex-col gap-4 w-52 xl:w-60 shrink-0 sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pb-4">
                        {dateCard}

                        <div className="flex flex-col gap-2">
                            {filterButton}
                            {speedControls && (
                                <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800">
                                    <span className="text-xs text-zinc-500 dark:text-zinc-400">Velocidade</span>
                                    {speedControls}
                                </div>
                            )}
                            {scrollButton}
                        </div>

                        {sections.length > 0 && (
                            <nav aria-label="Secções das leituras" className="mt-1">
                                <p className="text-[0.65rem] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-2 px-2">
                                    Secções
                                </p>
                                <ul className="space-y-0.5">
                                    {sections.map(({ id, label }) => (
                                        <li key={id}>
                                            <button
                                                onClick={() => scrollToSection(id)}
                                                className={`w-full text-left text-sm py-1.5 px-2 rounded-lg transition-colors ${
                                                    activeSection === id
                                                        ? 'text-liturgy-600 dark:text-liturgy-400 bg-liturgy-50 dark:bg-liturgy-950/30 font-semibold'
                                                        : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
                                                }`}
                                            >
                                                {/* Title-case but keep Roman numerals (I, II, III, IV) uppercase */}
                                                {label.toLowerCase().replace(/\b\w+/g, (w) =>
                                                    /^(i{1,3}|iv)$/i.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)
                                                )}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </nav>
                        )}
                    </aside>
                )}

                {/* ── Main content ─────────────────────────────────────────── */}
                <div className="flex-1 min-w-0 flex flex-col">
                    {loading ? (
                        <div className="flex-1 flex flex-col items-center justify-center space-y-4 py-20">
                            <div className="h-8 w-8 rounded-full border-4 border-zinc-200 border-t-amber-500 animate-spin" />
                            <p className="text-zinc-400">A obter leituras de hoje...</p>
                        </div>
                    ) : liturgy ? (
                        <>
                            {/* Date card — mobile / tablet only */}
                            <div className="lg:hidden mb-4">{dateCard}</div>

                            {/* Filter + autoscroll row — mobile / tablet only */}
                            <div className="lg:hidden flex items-center gap-2 mb-6">
                                <div className="flex-1">{filterButton}</div>
                                {speedControls}
                                <div className="flex-1">{scrollButton}</div>
                            </div>

                            {/* Reading article */}
                            <article
                                ref={articleRef}
                                className="
                                    content-text flex-1
                                    text-zinc-800 dark:text-zinc-200
                                    [&_strong]:font-bold [&_strong]:text-zinc-900 dark:[&_strong]:text-zinc-100
                                    [&_em]:italic [&_em]:text-zinc-700 dark:[&_em]:text-zinc-300
                                    [&_i]:italic [&_i]:text-zinc-700 dark:[&_i]:text-zinc-300
                                    [&_br]:my-0
                                "
                                onClick={handleToggleCommentary}
                            >
                                <div dangerouslySetInnerHTML={{ __html: displayHtml }} />
                            </article>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-zinc-50 dark:bg-zinc-900 rounded-2xl">
                            <p className="text-zinc-500">Não foi possível carregar a liturgia de hoje.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Floating autoscroll FAB — mobile / tablet only ────────── */}
            {!loading && liturgy && (
                <div className="lg:hidden fixed bottom-6 right-4 z-40 flex flex-col items-end gap-2">
                    {isAutoScrolling && (
                        <div className="flex items-center gap-1.5 bg-zinc-900/90 dark:bg-zinc-800 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-lg">
                            <button
                                onClick={() => setScrollSpeed((s) => Math.max(1, s - 1))}
                                aria-label="Mais lento"
                                className="text-zinc-300 hover:text-white transition-colors p-0.5"
                            >
                                <Minus size={14} />
                            </button>
                            <span className="text-zinc-300 text-xs font-mono w-3 text-center select-none">
                                {scrollSpeed}
                            </span>
                            <button
                                onClick={() => setScrollSpeed((s) => Math.min(3, s + 1))}
                                aria-label="Mais rápido"
                                className="text-zinc-300 hover:text-white transition-colors p-0.5"
                            >
                                <Plus size={14} />
                            </button>
                        </div>
                    )}
                    <button
                        onClick={toggleAutoScroll}
                        aria-label={isAutoScrolling ? 'Parar auto-scroll' : 'Iniciar auto-scroll'}
                        className={`h-14 w-14 rounded-full shadow-xl flex items-center justify-center transition-colors duration-200 ${
                            isAutoScrolling
                                ? 'bg-liturgy-600 text-white ring-4 ring-liturgy-400/25'
                                : 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                        }`}
                    >
                        {isAutoScrolling
                            ? <Pause size={18} />
                            : <Play size={18} className="translate-x-px" />}
                    </button>
                </div>
            )}
        </div>
    );
}
