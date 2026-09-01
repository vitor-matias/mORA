import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, ChevronLeft, RotateCcw } from "lucide-react";
import { enrichReadingHtml, extractReadings } from "@/lib/readingHtml";
import { fetchDailyLiturgy, fetchLiturgicalColorFromCalendar, getDefaultMassDate } from "@/lib/liturgy";
import type { DailyLiturgy, LiturgicalDayInfo } from "@/lib/liturgy";
import { buildGuidedMassHtml } from "@/lib/massGuide";
import { resolveMassOrdo } from "@/lib/massOrdo";
import { useAppStore, isCompletedToday, clampMassMode } from "@/store/app";
import type { MassMode } from "@/store/app";
import { formatDisplayDate, formatISODate } from "@/lib/format";
import { useAutoScroll } from "@/lib/useAutoScroll";
import { useDayRollover } from "@/lib/useDayRollover";
import { PageHeader } from "@/components/layout/PageHeader";
import { AutoScrollButton, AutoScrollSpeedRow, AutoScrollFab } from "@/components/AutoScroll";
import { DayCard } from "@/components/DayInfo";
import { DateNav } from "@/components/DateNav";
import { SaintOfDayCard } from "@/components/SaintOfDay";


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


interface TocEntry { id: string; label: string; }

export default function Liturgy() {
    const navigate = useNavigate();
    // From lg the sidebar carries the title, so the header is not rendered at
    // all rather than hidden with CSS: hidden, it would still portal its back
    // orb and the day into the global top bar, leaving two back buttons and
    // the day named twice.
    const [hasSidebar, setHasSidebar] = useState(
        () => window.matchMedia('(min-width: 1024px)').matches
    );
    useEffect(() => {
        const mq = window.matchMedia('(min-width: 1024px)');
        const onChange = () => setHasSidebar(mq.matches);
        mq.addEventListener('change', onChange);
        // Re-read on subscribe, rather than trusting the initializer alone:
        // a width change between that first read and this listener going up
        // fires with nobody listening, and the page would sit on the wrong
        // side of the breakpoint until the next one. Cheap insurance for a
        // mismatch that shows as a header and a sidebar both claiming the
        // title, with two back buttons between them.
        onChange();
        return () => mq.removeEventListener('change', onChange);
    }, []);

    const [liturgy, setLiturgy] = useState<DailyLiturgy | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadFailed, setLoadFailed] = useState(false);
    const [retryToken, setRetryToken] = useState(0);

    // Selected field by field: a bare useAppStore() subscribes this page to
    // every setting in the store, so changing the theme or the font size
    // would re-render the whole reading. The setters are stable references,
    // so they never trigger one.
    const streaks = useAppStore((s) => s.streaks);
    const incrementStreak = useAppStore((s) => s.incrementStreak);
    const setLiturgicalColorOverride = useAppStore((s) => s.setLiturgicalColorOverride);
    const setMassMode = useAppStore((s) => s.setMassMode);
    // Clamped on read: the persisted store rehydrates unvalidated, and an
    // older build wrote a boolean here under a different key.
    const massMode = clampMassMode(useAppStore((s) => s.massMode));

    // Date being viewed — a ?date=YYYY-MM-DD param (e.g. from the calendar
    // page) wins; otherwise today (or Sunday from Saturday 16:00, when vigil
    // Masses start). Browsable via the date nav either way.
    const [searchParams, setSearchParams] = useSearchParams();
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
    // An installed PWA is often resumed from the background days later with
    // this page still mounted on whatever day it was left at. When the app
    // returns to the foreground and the default date has meanwhile moved on
    // (midnight passed, or the Saturday-16:00 vigil switch), re-anchor to it
    // — dropping any stale ?date= pin the restored URL still carries.
    useDayRollover(
        () => formatISODate(getDefaultMassDate()),
        () => {
            setSelectedDate(getDefaultMassDate());
            if (dateParam) setSearchParams({}, { replace: true });
        }
    );

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
    const chipsRef = useRef<HTMLElement>(null);
    const [sections, setSections] = useState<TocEntry[]>([]);
    const [activeSection, setActiveSection] = useState('');

    const readToday = isCompletedToday(streaks.liturgy);
    // A Mass with no text is not a Mass to read: the API has been seen
    // answering with an entry whose body is empty, and `liturgy` alone being
    // truthy then renders an empty article that still counts down to "read".
    const hasContent = !!liturgy?.htmlContent;

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
        // hasContent, not just `liturgy`: the API can answer with a Mass whose
        // text is empty, and the dwell timer below fires on anything that does
        // not overflow the viewport — including a blank article. That recorded
        // the day as prayed without ever showing it.
        if (loading || !hasContent || !canMarkPrayed || readToday) return;
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
    }, [loading, hasContent, canMarkPrayed, readToday, markAsRead]);

    const displayHtml = useMemo(() => {
        if (!liturgy?.htmlContent) return '';

        let result: string;
        if (massMode === 'explicada') {
            // Whether this day's Mass carries the Glória and the Credo. Only
            // the guided mode prints them, so the resolution lives inside this
            // branch rather than in a memo of its own — the other two modes
            // never pay for the scan. The calendar entry states it outright;
            // the Mass text and the general rules back it up.
            const ordo = resolveMassOrdo(
                selectedDate,
                dayInfo?.description,
                dayInfo?.dayName ?? liturgy.saintOfDay,
                liturgy.htmlContent,
            );
            result = buildGuidedMassHtml(liturgy.htmlContent, ordo);
        } else if (massMode === 'missal') {
            result = liturgy.htmlContent;
        } else {
            result = extractReadings(liturgy.htmlContent);
        }
        return enrichReadingHtml(result);
        // selectedDateStr is the stable identity of selectedDate
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [liturgy, massMode, dayInfo, selectedDateStr]);

    // Hands-free scrolling through the readings.
    const scroll = useAutoScroll(displayHtml);
    const { stop: stopScroll } = scroll;

    // Swapping the day swaps the whole article without remounting it, so a
    // running scroll would carry on through the new day's text at whatever
    // position it had reached. Keyed on the date rather than patched into each
    // control, so the prev/next buttons, the date picker and an external
    // ?date= change are all covered.
    useEffect(() => { stopScroll(); }, [selectedDateStr, stopScroll]);

    // Rebuild TOC after the article renders with new content.
    // We depend on both displayHtml (content) and loading (mount gate).
    // Fall back to document.querySelector in case the ref isn't captured yet.
    useEffect(() => {
        // Every path that cannot produce a table of contents clears it rather
        // than leaving the last one standing: a day still loading, a day the
        // API has none for, or text whose mode yields no headers. Left alone,
        // yesterday's chips stay on screen and each one scrolls to an anchor
        // that is no longer in the document.
        const clear = () => {
            setSections([]);
            setActiveSection('');
        };
        if (loading || !hasContent) return clear();
        const el = articleRef.current ?? document.querySelector<HTMLElement>('article');
        if (!el) return clear();
        const id = window.setTimeout(() => {
            // Both reading sections and prayer/Mass-part headers carry
            // data-toc-label, in document order. data-toc-skip opts a section
            // out — the guided Mass uses it for the Aleluia, which is styled
            // as a reading but too slight to navigate to.
            const headers = el.querySelectorAll<HTMLElement>('[id][data-toc-label]:not([data-toc-skip])');
            if (headers.length === 0) return clear();
            setSections(Array.from(headers).map((h) => ({
                id: h.id,
                label: h.getAttribute('data-toc-label') ?? h.id,
            })));
            setActiveSection('');
        }, 50);
        return () => window.clearTimeout(id);
    }, [displayHtml, loading, hasContent]);

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

            // px below viewport top (clears the sticky chrome: collapsed
            // header + chips row below xl, the 56px global top bar at xl —
            // both fit under one constant)
            const line = 170;
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

    // Keep the active chip in view as the reader moves down the page. The nav's
    // own scrollLeft is set rather than scrollIntoView, which would also move
    // the page vertically and fight the scroll that triggered this.
    useEffect(() => {
        const nav = chipsRef.current;
        if (!nav || !activeSection) return;
        const chip = nav.querySelector<HTMLElement>(`[data-section="${CSS.escape(activeSection)}"]`);
        if (!chip) return;
        const left = chip.offsetLeft - (nav.clientWidth - chip.offsetWidth) / 2;
        nav.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
    }, [activeSection]);

    const scrollToSection = useCallback((id: string) => {
        stopScroll();
        const el = document.getElementById(id);
        if (el) {
            // Clear the sticky chrome (collapsed header incl. mobile chips
            // row below xl; the shorter global top bar at xl)
            const offset = 130;
            const top = el.getBoundingClientRect().top + window.scrollY - offset;
            window.scrollTo({ top, behavior: 'smooth' });
        }
    }, [stopScroll]);

    // Two disclosures, both by event delegation on the article: the guided
    // Mass's explanations, behind the info button beside each part's title,
    // and the readings' commentaries. Each opens in place and stays open —
    // nothing overlaps, so nothing has to be dismissed to read on.
    const handleArticleClick = (e: React.MouseEvent<HTMLElement>) => {
        const info = (e.target as HTMLElement).closest('.mass-info');
        if (info) {
            const part = info.closest('.mass-explain');
            if (!part) return;
            info.setAttribute('aria-expanded', String(part.classList.toggle('open')));
            return;
        }

        const toggle = (e.target as HTMLElement).closest('.commentary-toggle');
        if (!toggle) return;
        const container = toggle.closest('.reading-commentary');
        if (!container) return;
        const isOpen = container.classList.toggle('collapsed') === false;
        toggle.setAttribute('aria-expanded', String(isOpen));
    };

    // ── Shared UI pieces rendered in both sidebar (desktop) and toolbar (mobile) ──

    // Segmented control: every option always visible, so the label never
    // reads as "the action a click would take" vs "the current state".
    // "Explicada" walks a newcomer through the whole celebration in order.
    const filterButton = (
        <div role="group" aria-label="Conteúdo a mostrar" className="flex w-full bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1 gap-1">
            {([
                ['leituras', 'Leituras', 'Só as leituras do dia'],
                ['missal', 'Missal', 'Todos os textos próprios do dia'],
                ['explicada', 'Explicada', 'A Missa passo a passo, para quem está a começar'],
            ] as [MassMode, string, string][]).map(([value, label, hint]) => (
                <button
                    key={value}
                    type="button"
                    onClick={() => { stopScroll(); setMassMode(value); }}
                    aria-pressed={massMode === value}
                    title={hint}
                    className={`flex-1 px-1.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        massMode === value
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
    // Each of its render sites (sidebar, mobile toolbar, empty state) mounts
    // its own DateNav instance, which owns its picker input ref internally.
    const dateNav = (
        <DateNav
            selectedDate={selectedDate}
            selectedDateStr={selectedDateStr}
            isToday={isToday}
            onChangeDay={changeDay}
            onSelectDate={setSelectedDate}
        />
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

            {/* ── Header ───────────────────────────────────────────────────
                Below lg only. From lg the sidebar carries the title instead:
                it is pinned and always in view, so a second bar at the top of
                the page would be a shrinking duplicate of something already on
                screen, and it would cost the reading column its height. */}
            {/* The sidebar only exists once the day has loaded, so while it is
                loading or after it failed there is nothing to carry the title
                or the way back — the header stands in for it. */}
            {(!hasSidebar || loading || !hasContent) && (
            <PageHeader
                title="Missa Diária"
                subtitle={loading ? 'A carregar...' : liturgy?.saintOfDay ?? 'Sem leituras'}
            >
                {/* Mobile section chips — quick jumps without the desktop sidebar */}
                {!loading && sections.length > 0 && (
                    <nav
                        ref={chipsRef}
                        aria-label="Secções das leituras"
                        className="lg:hidden max-w-5xl mx-auto px-6 mt-2 flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    >
                        {sections.map(({ id, label }) => (
                            <button
                                key={id}
                                type="button"
                                data-section={id}
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
            )}

            {/* ── Page body ────────────────────────────────────────────────── */}
            <div className="max-w-5xl 2xl:max-w-6xl mx-auto w-full px-4 sm:px-6 pt-4 lg:pt-8 pb-20 flex-1 flex flex-col lg:flex-row lg:gap-12 lg:items-start">

                {/* ── Desktop sidebar ──────────────────────────────────────────
                    Never moves: with no header above it the sidebar starts
                    higher than top-24, so it is pinned from the first paint.
                    That matters most under autoscroll, where the reader has
                    let go of the page. */}
                {!loading && hasContent && (
                    <aside className="hidden lg:flex flex-col gap-4 w-72 xl:w-80 shrink-0 sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pb-4">
                        {/* The page's title, which from lg lives here rather
                            than in a header bar above the reading. */}
                        <div className="flex items-center gap-3 min-w-0">
                            <button
                                type="button"
                                aria-label="Voltar ao início"
                                onClick={() => navigate('/')}
                                className="bg-zinc-100/80 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full shadow-sm transition-all shrink-0 p-1.5"
                            >
                                <ChevronLeft size={18} />
                            </button>
                            <h1 className="text-xl font-bold tracking-tight page-title truncate">
                                Missa Diária
                            </h1>
                        </div>

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
                    ) : hasContent ? (
                        <>
                            {/* Date nav + date card — mobile / tablet only */}
                            <div className="lg:hidden mb-4 space-y-3">
                                {dateNav}
                                {dateCard}
                                {saintCard}
                            </div>

                            {/* Mode picker — mobile / tablet only. Autoscroll
                                isn't duplicated here: the floating pill is
                                always on screen below lg and does the same job,
                                and three modes need the full width. */}
                            <div className="lg:hidden mb-6">{filterButton}</div>

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
                                onClick={handleArticleClick}
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
            {!loading && hasContent && <AutoScrollFab scroll={scroll} />}
        </div>
    );
}
