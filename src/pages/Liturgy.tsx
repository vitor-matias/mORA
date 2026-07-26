import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronRight, ChevronLeft, Calendar, Play, Pause, Minus, Plus, CheckCircle2, RotateCcw } from "lucide-react";
import DOMPurify from "dompurify";
import { fetchDailyLiturgy, fetchLiturgicalColorFromCalendar, getDefaultMassDate } from "@/lib/liturgy";
import type { DailyLiturgy, LiturgicalDayInfo } from "@/lib/liturgy";
import { useAppStore, isCompletedToday, SCROLL_LEVELS, clampScrollLevel } from "@/store/app";
import { formatDisplayDate, formatISODate } from "@/lib/format";
import { PageHeader } from "@/components/layout/PageHeader";

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
            p.setAttribute('data-toc-label', readingDisplayLabel(label));
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

        // Prayer / Mass-part headers (full missal only): "Antífona de entrada",
        // "Oração coleta", "Oração sobre as oblatas", "Prefácio", etc. These use
        // a <b> heading followed by <br>, distinct from the readings' <strong>.
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
            const span = doc.createElement('span');
            span.className = 'reading-source';
            span.textContent = firstChild.textContent;
            firstChild.replaceWith(span);
        }
    });

    // ── Pass 3: surface the responsorial-psalm refrain ───────────────────
    doc.querySelectorAll('p.reading-section-header').forEach((header) => {
        const label = header.querySelector('.reading-label')?.textContent ?? '';
        if (!/^SALMO/i.test(label)) return;

        // The header title carries "(R. 97a) Refrão: … Repete-se" — lift the
        // refrain into its own highlighted line right under the header.
        const title = header.querySelector('.reading-title');
        const titleText = title?.textContent ?? '';
        const m = titleText.match(/Refrão:\s*(.*)$/i);
        if (title && m) {
            let refrain = m[1].trim();
            const repeats = /\bRepete-se\b\.?\s*$/i.test(refrain);
            refrain = refrain.replace(/\s*Repete-se\.?\s*$/i, '').trim();

            const refrainP = doc.createElement('p');
            refrainP.className = 'psalm-refrain';
            refrainP.textContent = `℟ ${refrain}`;
            if (repeats) {
                const note = doc.createElement('span');
                note.className = 'psalm-refrain-note';
                note.textContent = 'Repete-se';
                refrainP.appendChild(note);
            }
            // Keep only the psalm-number reference in the small title
            const before = titleText.slice(0, m.index ?? 0).trim();
            if (before) title.textContent = before; else title.remove();
            header.after(refrainP);
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

interface TocEntry { id: string; label: string; }

export default function Liturgy() {
    const [liturgy, setLiturgy] = useState<DailyLiturgy | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadFailed, setLoadFailed] = useState(false);
    const [retryToken, setRetryToken] = useState(0);
    const [showOnlyReadings, setShowOnlyReadings] = useState(true);
    const [dateCardExpanded, setDateCardExpanded] = useState(false);

    const { streaks, incrementStreak, setLiturgicalColorOverride, autoScrollSpeed } = useAppStore();

    // Date being viewed — a ?date=YYYY-MM-DD param (e.g. from the calendar
    // page) wins; otherwise today (or Sunday from Saturday 16:00, when vigil
    // Masses start). Browsable via the date nav either way.
    const [searchParams] = useSearchParams();
    const [selectedDate, setSelectedDate] = useState(() => {
        const param = searchParams.get('date');
        if (param && /^\d{4}-\d{2}-\d{2}$/.test(param)) {
            const d = new Date(param + 'T00:00:00');
            // Round-trip check: JS normalizes overflowed dates (Feb 30 →
            // Mar 2) instead of yielding NaN, so compare the components.
            const [year, month, day] = param.split('-').map(Number);
            if (
                !Number.isNaN(d.getTime()) &&
                d.getFullYear() === year &&
                d.getMonth() === month - 1 &&
                d.getDate() === day
            ) return d;
        }
        return getDefaultMassDate();
    });
    const dateInputRef = useRef<HTMLInputElement>(null);
    const selectedDateStr = formatISODate(selectedDate);
    const isToday = selectedDateStr === formatISODate(new Date());
    // Completion also applies to the anticipated Sunday on Saturday evening —
    // praying the vigil readings is praying "today".
    const canMarkPrayed = isToday || selectedDateStr === formatISODate(getDefaultMassDate());

    // Day info is stored keyed by date, so info from a previous date is
    // simply stale (renders as "not loaded") rather than needing a reset.
    const [dayInfoState, setDayInfoState] = useState<{ dateStr: string; info: LiturgicalDayInfo | null } | null>(null);
    const dayInfo = dayInfoState?.dateStr === selectedDateStr ? dayInfoState.info : null;

    // Autoscroll
    const [isAutoScrolling, setIsAutoScrolling] = useState(false);
    // Index into SCROLL_LEVELS; starts at the default configured in Profile —
    // the +/- controls only adjust this session, not the saved default.
    const [scrollSpeed, setScrollSpeed] = useState<number>(() => clampScrollLevel(autoScrollSpeed));
    // Nothing left to scroll — the start button is pointless then
    const [atPageEnd, setAtPageEnd] = useState(false);
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

    const readToday = isCompletedToday(streaks.liturgy);

    // Theme the app to the color of the day being read: browsing another
    // date overrides today's liturgical color for as long as we're here.
    useEffect(() => {
        setLiturgicalColorOverride(!isToday && dayInfo?.color ? dayInfo.color : null);
        return () => setLiturgicalColorOverride(null);
    }, [dayInfo, isToday, setLiturgicalColorOverride]);

    useEffect(() => {
        let cancelled = false;
        async function loadLiturgy() {
            setLoading(true);
            setLoadFailed(false);
            try {
                // null = the API has no Mass for this date (not an outage)
                const data = await fetchDailyLiturgy(selectedDateStr);
                if (cancelled) return;
                setLiturgy(data);
            } catch {
                if (cancelled) return;
                setLiturgy(null);
                setLoadFailed(true);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        loadLiturgy();
        return () => { cancelled = true; };
    }, [selectedDateStr, retryToken]);

    // Day name / description for the date being viewed (parsed from the
    // cached liturgical-calendar ICS — cheap, no network after first load).
    useEffect(() => {
        let cancelled = false;
        fetchLiturgicalColorFromCalendar(selectedDate).then(info => {
            if (!cancelled) setDayInfoState({ dateStr: selectedDateStr, info });
        });
        return () => { cancelled = true; };
        // selectedDateStr is the stable identity of selectedDate
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedDateStr]);

    const changeDay = (delta: number) => {
        setSelectedDate(prev => {
            const next = new Date(prev);
            next.setDate(prev.getDate() + delta);
            return next;
        });
    };

    const markAsRead = async () => {
        incrementStreak('liturgy');
        try {
            const { publishStreakToNostr } = await import('@/lib/nostr');
            await publishStreakToNostr();
        } catch (error) {
            // Best-effort sync — a chunk-load failure (e.g. offline) must
            // never break the completion action itself.
            console.warn('Streak sync skipped:', error);
        }
    };

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
            // Both reading sections and prayer/Mass-part headers carry
            // data-toc-label, in document order.
            const headers = el.querySelectorAll<HTMLElement>('[id][data-toc-label]');
            if (headers.length === 0) return;
            setSections(Array.from(headers).map((h) => ({
                id: h.id,
                label: h.getAttribute('data-toc-label') ?? h.id,
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

            const line = 170; // px below viewport top (clears the sticky header + chips row)
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
                const pxPerSec = SCROLL_LEVELS[speedRef.current].pps;
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

    // Freeze the ambient aurora while autoscrolling — the page already
    // repaints every frame, so pausing the animation (see index.css) keeps
    // compositing cheap on low-end GPUs.
    useEffect(() => {
        document.documentElement.classList.toggle('autoscrolling', isAutoScrolling);
        return () => document.documentElement.classList.remove('autoscrolling');
    }, [isAutoScrolling]);

    // Keep the screen awake while autoscrolling — otherwise the phone dims
    // and locks mid-reading. The browser releases the lock whenever the tab
    // is hidden, so re-acquire it when the page becomes visible again.
    useEffect(() => {
        if (!isAutoScrolling || !('wakeLock' in navigator)) return;
        let sentinel: WakeLockSentinel | null = null;
        let cancelled = false;

        const acquire = async () => {
            try {
                const lock = await navigator.wakeLock.request('screen');
                if (cancelled) {
                    lock.release().catch(() => {});
                    return;
                }
                // A concurrent acquire may have won the race — release the
                // older lock so it can't linger unreleased.
                if (sentinel && sentinel !== lock && !sentinel.released) {
                    sentinel.release().catch(() => {});
                }
                sentinel = lock;
                // The platform can revoke the lock while we're still visible
                // (e.g. battery saver kicks in); try once to get it back.
                // Hidden-tab revocations re-acquire via visibilitychange.
                // Only the *tracked* lock re-acquires — releasing a superseded
                // lock firing this handler must not start a request loop.
                lock.addEventListener('release', () => {
                    if (!cancelled && sentinel === lock && document.visibilityState === 'visible') {
                        sentinel = null;
                        acquire();
                    }
                });
            } catch {
                // Denied (e.g. battery saver) — autoscroll still works,
                // the screen just won't be kept on.
            }
        };

        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') acquire();
        };

        acquire();
        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => {
            cancelled = true;
            document.removeEventListener('visibilitychange', onVisibilityChange);
            sentinel?.release().catch(() => {});
        };
    }, [isAutoScrolling]);

    // Clean up on unmount.
    useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

    const scrollToSection = useCallback((id: string) => {
        stopAutoScroll();
        const el = document.getElementById(id);
        if (el) {
            const offset = 130; // clear the sticky header (incl. mobile chips row)
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

    // Track whether the page is scrolled to (or has) no further content, so
    // the autoscroll start button can be disabled when there is nowhere to go.
    useEffect(() => {
        const update = () => {
            const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
            setAtPageEnd(maxScroll <= 0 || window.scrollY >= maxScroll - 2);
        };
        // Measure after the article paints (content height isn't final here).
        const t = window.setTimeout(update, 60);
        window.addEventListener('scroll', update, { passive: true });
        window.addEventListener('resize', update);
        return () => {
            window.clearTimeout(t);
            window.removeEventListener('scroll', update);
            window.removeEventListener('resize', update);
        };
    }, [displayHtml, loading]);

    // ── Shared UI pieces rendered in both sidebar (desktop) and toolbar (mobile) ──

    // Segmented control: both options always visible, so the label never
    // reads as "the action a click would take" vs "the current state".
    const filterButton = (
        <div role="group" aria-label="Conteúdo a mostrar" className="flex w-full bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1 gap-1">
            {([[true, 'Leituras'], [false, 'Missal']] as [boolean, string][]).map(([value, label]) => (
                <button
                    key={label}
                    onClick={() => setShowOnlyReadings(value)}
                    aria-pressed={showOnlyReadings === value}
                    className={`flex-1 px-2 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        showOnlyReadings === value
                            ? 'glass-panel text-liturgy-700 dark:text-liturgy-400'
                            : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                    }`}
                >
                    {label}
                </button>
            ))}
        </div>
    );

    // Prev / next day navigation with a native date picker on the label.
    const dateNav = (
        <div className="flex items-center justify-between gap-1 glass-panel rounded-xl px-1 py-1">
            <button
                onClick={() => changeDay(-1)}
                aria-label="Dia anterior"
                className="p-2.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
                <ChevronLeft size={18} />
            </button>
            <div className="relative flex-1">
                <button
                    type="button"
                    onClick={() => {
                        const input = dateInputRef.current;
                        if (!input) return;
                        if ('showPicker' in input) {
                            try { input.showPicker(); } catch { input.focus(); }
                        } else {
                            (input as HTMLInputElement).focus();
                        }
                    }}
                    className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200 py-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                    <Calendar size={15} className="text-liturgy-600 dark:text-liturgy-400 shrink-0" aria-hidden="true" />
                    <span className="truncate">
                        {isToday ? 'Hoje' : formatDisplayDate(selectedDate)}
                    </span>
                </button>
                {/* Sibling overlay, not a child — an interactive element
                    inside a <button> is invalid HTML. The button above is
                    the control; this input only hosts the native picker. */}
                <input
                    ref={dateInputRef}
                    type="date"
                    aria-hidden="true"
                    tabIndex={-1}
                    value={selectedDateStr}
                    onChange={(e) => {
                        if (e.target.value) setSelectedDate(new Date(e.target.value + 'T00:00:00'));
                    }}
                    className="absolute inset-0 opacity-0 pointer-events-none"
                />
            </div>
            <button
                onClick={() => changeDay(1)}
                aria-label="Dia seguinte"
                className="p-2.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
                <ChevronRight size={18} />
            </button>
        </div>
    );

    const speedControls = isAutoScrolling ? (
        <div className="flex items-center gap-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg px-1 py-0.5">
            <button
                onClick={() => setScrollSpeed((s) => Math.max(0, s - 1))}
                aria-label="Mais lento"
                className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors p-2"
            >
                <Minus size={15} />
            </button>
            <span className="text-zinc-500 dark:text-zinc-400 text-xs font-semibold w-3 text-center select-none">
                {SCROLL_LEVELS[scrollSpeed].label}
            </span>
            <button
                onClick={() => setScrollSpeed((s) => Math.min(SCROLL_LEVELS.length - 1, s + 1))}
                aria-label="Mais rápido"
                className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors p-2"
            >
                <Plus size={15} />
            </button>
        </div>
    ) : null;

    const scrollButton = (
        <button
            onClick={toggleAutoScroll}
            disabled={!isAutoScrolling && atPageEnd}
            aria-label={isAutoScrolling ? 'Parar auto-scroll' : 'Iniciar auto-scroll'}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors border w-full justify-center lg:justify-start disabled:opacity-40 disabled:cursor-not-allowed ${
                isAutoScrolling
                    ? 'bg-liturgy-100 dark:bg-liturgy-900/40 text-liturgy-700 dark:text-liturgy-300 border-liturgy-200 dark:border-liturgy-800'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-transparent hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
        >
            {isAutoScrolling ? <Pause size={15} /> : <Play size={15} className="translate-x-px" />}
            {isAutoScrolling ? 'Parar scroll' : 'Auto-scroll'}
        </button>
    );

    const dateCard = liturgy && (
        <div className="glass-panel glow-ring rounded-2xl p-4">
            <p
                className="font-semibold text-liturgy-900 dark:text-liturgy-100 leading-snug text-base"
                style={{ fontFamily: 'var(--content-font-family, inherit)' }}
            >
                {formatDisplayDate(new Date(liturgy.date + 'T00:00:00'))}
            </p>
            {dayInfo?.description && (
                <>
                    <p
                        className={`mt-1 text-liturgy-800 dark:text-liturgy-300 leading-snug whitespace-pre-line text-sm ${dateCardExpanded ? '' : 'line-clamp-4'}`}
                        style={{ fontFamily: 'var(--content-font-family, inherit)' }}
                    >
                        {dayInfo.description}
                    </p>
                    <button
                        onClick={() => setDateCardExpanded((v) => !v)}
                        className="mt-1 text-xs text-liturgy-600 dark:text-liturgy-400 hover:text-liturgy-800 dark:hover:text-liturgy-200 transition-colors"
                        style={{ fontFamily: 'Inter, sans-serif' }}
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
            <PageHeader
                title="Missa Diária"
                subtitle={loading ? 'A carregar...' : liturgy?.saintOfDay ?? 'Sem leituras'}
            >
                {/* Mobile section chips — quick jumps without the desktop sidebar */}
                {!loading && sections.length > 0 && (
                    <nav
                        aria-label="Secções das leituras"
                        className="lg:hidden max-w-5xl mx-auto px-6 mt-2 flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    >
                        {sections.map(({ id, label }) => (
                            <button
                                key={id}
                                onClick={() => scrollToSection(id)}
                                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                                    activeSection === id
                                        ? 'bg-liturgy-100 dark:bg-liturgy-900/50 text-liturgy-700 dark:text-liturgy-300'
                                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </nav>
                )}
            </PageHeader>

            {/* ── Page body ────────────────────────────────────────────────── */}
            <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 pt-4 lg:pt-8 pb-20 flex-1 flex flex-col lg:flex-row lg:gap-12 lg:items-start">

                {/* ── Desktop sidebar ──────────────────────────────────────── */}
                {!loading && liturgy && (
                    <aside className="hidden lg:flex flex-col gap-4 w-52 xl:w-60 shrink-0 sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pb-4">
                        {dateNav}
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
                                                {/* Labels are pre-formatted at enrichment time */}
                                                {label}
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
                            {/* Date nav + date card — mobile / tablet only */}
                            <div className="lg:hidden mb-4 space-y-3">
                                {dateNav}
                                {dateCard}
                            </div>

                            {/* Filter + autoscroll row — mobile / tablet only.
                                Speed controls live in the floating pill while
                                scrolling, so they aren't duplicated here. */}
                            <div className="lg:hidden flex items-center gap-2 mb-6">
                                <div className="flex-1">{filterButton}</div>
                                <div className="shrink-0">{scrollButton}</div>
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

                            {/* Explicit completion — the streak counts prayer,
                                not page loads, and only for today's readings
                                (or Sunday's during Saturday-evening vigil time). */}
                            {canMarkPrayed && (
                                <div className="mt-10 mb-4">
                                    {readToday ? (
                                        <div className="flex items-center justify-center gap-2 py-4 px-6 rounded-2xl glass-panel glow-ring text-liturgy-700 dark:text-liturgy-300 text-sm font-semibold">
                                            <CheckCircle2 size={18} aria-hidden="true" />
                                            Rezado hoje — {streaks.liturgy.days} {streaks.liturgy.days === 1 ? 'dia' : 'dias'} seguidos
                                        </div>
                                    ) : (
                                        <button
                                            onClick={markAsRead}
                                            className="w-full py-4 px-6 rounded-2xl bg-liturgy-700 hover:bg-liturgy-800 dark:bg-liturgy-400 dark:hover:bg-liturgy-300 text-white dark:text-zinc-950 font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-liturgy-900/10"
                                        >
                                            <CheckCircle2 size={18} aria-hidden="true" />
                                            Rezei as leituras de hoje
                                        </button>
                                    )}
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col gap-4">
                            {/* The sidebar (and its date nav) only renders on
                                success, so this must show on all breakpoints */}
                            <div className="lg:max-w-sm">{dateNav}</div>
                            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 glass-panel rounded-2xl">
                                <p className="text-zinc-500 text-center">
                                    {loadFailed
                                        ? 'Não foi possível carregar as leituras. Verifique a sua ligação à internet.'
                                        : 'Sem leituras disponíveis para este dia.'}
                                </p>
                                <button
                                    onClick={() => setRetryToken(t => t + 1)}
                                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-liturgy-700 hover:bg-liturgy-800 dark:bg-liturgy-400 dark:hover:bg-liturgy-300 text-white dark:text-zinc-950 text-sm font-semibold transition-colors active:scale-[0.97]"
                                >
                                    <RotateCcw size={15} aria-hidden="true" />
                                    Tentar novamente
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Floating autoscroll FAB — mobile / tablet only ────────── */}
            {!loading && liturgy && (
                <div className="lg:hidden fixed bottom-24 right-4 z-40">
                    {isAutoScrolling ? (
                        /* One cohesive pill: speed on the left, pause on the
                           right. Semi-transparent so text scrolling behind it
                           stays readable. */
                        <div className="flex items-stretch h-12 rounded-full bg-zinc-900/60 dark:bg-zinc-800/60 backdrop-blur-md shadow-xl overflow-hidden">
                            <button
                                onClick={() => setScrollSpeed((s) => Math.max(0, s - 1))}
                                aria-label="Mais lento"
                                className="pl-4 pr-2.5 flex items-center text-zinc-300 hover:text-white active:text-white transition-colors"
                            >
                                <Minus size={16} />
                            </button>
                            <span className="flex items-center text-white text-sm font-semibold tabular-nums w-4 justify-center select-none">
                                {SCROLL_LEVELS[scrollSpeed].label}
                            </span>
                            <button
                                onClick={() => setScrollSpeed((s) => Math.min(SCROLL_LEVELS.length - 1, s + 1))}
                                aria-label="Mais rápido"
                                className="pl-2.5 pr-3 flex items-center text-zinc-300 hover:text-white active:text-white transition-colors"
                            >
                                <Plus size={16} />
                            </button>
                            <div className="w-px my-3 bg-white/20" aria-hidden="true" />
                            <button
                                onClick={toggleAutoScroll}
                                aria-label="Parar auto-scroll"
                                className="pl-3.5 pr-4 flex items-center text-white transition-colors"
                            >
                                <Pause size={17} fill="currentColor" strokeWidth={0} />
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={toggleAutoScroll}
                            disabled={atPageEnd}
                            aria-label="Iniciar auto-scroll"
                            className="h-12 w-12 rounded-full shadow-xl flex items-center justify-center bg-zinc-900/60 dark:bg-zinc-100/70 backdrop-blur-md text-white dark:text-zinc-900 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <Play size={17} fill="currentColor" strokeWidth={0} className="translate-x-px" />
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
