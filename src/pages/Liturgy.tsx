import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronRight, ChevronLeft, Calendar, CheckCircle2, RotateCcw } from "lucide-react";
import DOMPurify from "dompurify";
import { fetchDailyLiturgy, fetchLiturgicalColorFromCalendar, getDefaultMassDate } from "@/lib/liturgy";
import type { DailyLiturgy, LiturgicalDayInfo } from "@/lib/liturgy";
import { useAppStore, isCompletedToday } from "@/store/app";
import { formatDisplayDate, formatISODate } from "@/lib/format";
import { useAutoScroll } from "@/lib/useAutoScroll";
import { PageHeader } from "@/components/layout/PageHeader";
import { AutoScrollButton, AutoScrollSpeedRow, AutoScrollFab } from "@/components/AutoScroll";
import { DayCard } from "@/components/DayInfo";
import { SaintOfDayCard } from "@/components/SaintOfDay";

// Labels that open a liturgical reading section.
const SECTION_LABEL_RE = /^(LEITURA\s+(I{1,3}|IV)|SALMO RESPONSORIAL|EVANGELHO|ALELUIA|ACLAMAÇÃO)/i;
// Lines that close a reading ("Palavra do Senhor.", "Palavra da salvação.").
const ENDING_RE = /^Palavra (do Senhor|da salvação|do Evangelho)/i;
// First line of a reading body paragraph — the scripture source attribution.
const SOURCE_RE = /^(Leitura (do|da|de|aos|ao)|Do Livro|Da Carta|Do Profeta|Dos Actos|Do Apocalipse|Da Primeira|Da Segunda|Da Terceira|Evangelho de Nosso Senhor)/i;

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

// Parses a ?date=YYYY-MM-DD param. Round-trip check because JS normalizes
// overflowed dates (Feb 30 → Mar 2) instead of yielding NaN.
function parseDateParam(param: string | null): Date | null {
    if (!param || !/^\d{4}-\d{2}-\d{2}$/.test(param)) return null;
    const d = new Date(param + 'T00:00:00');
    const [year, month, day] = param.split('-').map(Number);
    const valid = !Number.isNaN(d.getTime())
        && d.getFullYear() === year
        && d.getMonth() === month - 1
        && d.getDate() === day;
    return valid ? d : null;
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

    const { streaks, incrementStreak, setLiturgicalColorOverride } = useAppStore();

    // Date being viewed — a ?date=YYYY-MM-DD param (e.g. from the calendar
    // page) wins; otherwise today (or Sunday from Saturday 16:00, when vigil
    // Masses start). Browsable via the date nav either way.
    const [searchParams] = useSearchParams();
    const dateParam = searchParams.get('date');
    const [selectedDate, setSelectedDate] = useState(
        () => parseDateParam(dateParam) ?? getDefaultMassDate()
    );

    // Re-sync when ?date= changes while mounted (e.g. an in-app link to
    // another /liturgia?date=…, or back/forward that only swaps the query) —
    // the initializer alone only covers fresh mounts. State adjustment
    // during render, per React docs, instead of an effect (see TabBar).
    const [lastDateParam, setLastDateParam] = useState(dateParam);
    if (dateParam !== lastDateParam) {
        setLastDateParam(dateParam);
        const d = parseDateParam(dateParam);
        if (d && formatISODate(d) !== formatISODate(selectedDate)) {
            setSelectedDate(d);
        }
    }
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

    const markAsRead = useCallback(async () => {
        incrementStreak('liturgy');
        try {
            const { publishStreakToNostr } = await import('@/lib/nostr');
            await publishStreakToNostr();
        } catch (error) {
            // Best-effort sync — a chunk-load failure (e.g. offline) must
            // never break the completion action itself.
            console.warn('Streak sync skipped:', error);
        }
    }, [incrementStreak]);

    // Completion is automatic: reaching the end of the readings counts the
    // day. Requires real overflow so a short spinner/error page can't count;
    // when the whole text fits the viewport (nothing to scroll), a dwell
    // timer counts instead — otherwise the streak would be unearnable there.
    const autoCompletedRef = useRef(false);
    useEffect(() => {
        if (loading || !liturgy || !canMarkPrayed || readToday) return;
        autoCompletedRef.current = false;

        const complete = () => {
            if (autoCompletedRef.current) return;
            autoCompletedRef.current = true;
            markAsRead();
        };
        const onScroll = () => {
            const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
            if (maxScroll > 0 && window.scrollY >= maxScroll - 2) complete();
        };
        const dwellTimer = window.setTimeout(() => {
            const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
            if (maxScroll <= 0) complete();
        }, 20000);

        onScroll(); // scroll restoration may land already at the end
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => {
            window.clearTimeout(dwellTimer);
            window.removeEventListener('scroll', onScroll);
        };
    }, [loading, liturgy, canMarkPrayed, readToday, markAsRead]);

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

    // Hands-free scrolling through the readings.
    const scroll = useAutoScroll(displayHtml);
    const { stop: stopScroll } = scroll;

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

    const scrollToSection = useCallback((id: string) => {
        stopScroll();
        const el = document.getElementById(id);
        if (el) {
            const offset = 130; // clear the sticky header (incl. mobile chips row)
            const top = el.getBoundingClientRect().top + window.scrollY - offset;
            window.scrollTo({ top, behavior: 'smooth' });
        }
    }, [stopScroll]);

    // Commentary expand/collapse (event delegation on article).
    const handleToggleCommentary = (e: React.MouseEvent<HTMLElement>) => {
        const toggle = (e.target as HTMLElement).closest('.commentary-toggle');
        if (!toggle) return;
        const container = toggle.closest('.reading-commentary');
        if (!container) return;
        const isOpen = container.classList.toggle('collapsed') === false;
        toggle.setAttribute('aria-expanded', String(isOpen));
    };

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
                            ? 'surface text-liturgy-700 dark:text-liturgy-400'
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
        <div className="flex items-center justify-between gap-1 surface rounded-xl px-1 py-1">
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

    // Keyed by date so the expanded state resets when browsing to another day.
    // The prefix keeps it distinct from the saint card's key — they render as
    // siblings, so a bare date would be a duplicate key.
    const dateCard = liturgy && (
        <DayCard
            key={`day-${selectedDateStr}`}
            dateLabel={formatDisplayDate(new Date(liturgy.date + 'T00:00:00'))}
            color={dayInfo?.color}
            title={dayInfo?.dayName ?? liturgy.saintOfDay}
            description={dayInfo?.description}
        />
    );

    // Keyed by date so the expanded state resets when browsing to another day.
    const saintCard = liturgy?.saint && (
        <SaintOfDayCard key={`saint-${selectedDateStr}`} saint={liturgy.saint} />
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
                        {saintCard}

                        {filterButton}

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

                        <div className="flex flex-col gap-2">
                            <AutoScrollSpeedRow scroll={scroll} />
                            <AutoScrollButton scroll={scroll} />
                        </div>
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
                                {saintCard}
                            </div>

                            {/* Filter + autoscroll row — mobile / tablet only.
                                Speed controls live in the floating pill while
                                scrolling, so they aren't duplicated here. */}
                            <div className="lg:hidden flex items-center gap-2 mb-6">
                                <div className="flex-1">{filterButton}</div>
                                <div className="shrink-0"><AutoScrollButton scroll={scroll} /></div>
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

                            {/* Completion is automatic (reaching the end of the
                                readings) and only for today's — or, during
                                Saturday-evening vigil time, Sunday's. This
                                confirms it happened. */}
                            {canMarkPrayed && readToday && (
                                <div className="mt-10 mb-4">
                                    <div className="flex items-center justify-center gap-2 py-4 px-6 rounded-2xl surface surface-accent text-liturgy-700 dark:text-liturgy-300 text-sm font-semibold">
                                        <CheckCircle2 size={18} aria-hidden="true" />
                                        Rezado hoje — {streaks.liturgy.days} {streaks.liturgy.days === 1 ? 'dia' : 'dias'} seguidos
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col gap-4">
                            {/* The sidebar (and its date nav) only renders on
                                success, so this must show on all breakpoints */}
                            <div className="lg:max-w-sm">{dateNav}</div>
                            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 surface rounded-2xl">
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
            {!loading && liturgy && <AutoScrollFab scroll={scroll} />}
        </div>
    );
}
