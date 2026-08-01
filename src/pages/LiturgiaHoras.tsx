import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { ChevronRight, ChevronLeft, ChevronDown, Calendar, Clock, Cross, BookOpenText, Sunrise, Sun, Sunset, MoonStar, CheckCircle2, RotateCcw, Info } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import DOMPurify from "dompurify";
import { fetchDailyLiturgy } from "@/lib/liturgy";
import type { DailyLiturgy, LiturgyHourPart } from "@/lib/liturgy";
import { useAppStore, isCompletedToday } from "@/store/app";
import { PageHeader } from "@/components/layout/PageHeader";
import { AutoScrollButton, AutoScrollSpeedRow, AutoScrollFab } from "@/components/AutoScroll";
import { useAutoScroll } from "@/lib/useAutoScroll";
import { getHourForTime } from "@/lib/hours";
import { formatDisplayDate, formatISODate } from "@/lib/format";
import { loadProprio, loadComum } from "@/lib/breviary/data";
import { saintsForDay, hasRenderableOffice, assembleHour } from "@/lib/breviary/assemble";
import type { ProprioEntry } from "@/lib/breviary/proprio";
import type { ComumDoc } from "@/lib/breviary/comum";
import { BreviaryBlocks } from "@/components/BreviaryBlocks";

// "Salmos e cântico do Domingo I." at the commons' Laudes points at Sunday
// Week I of the psalter. The psalter is fixed, so the psalmody of any
// "Semana I do Saltério" Sunday serves — probe recent Sundays (cached daily
// fetches) and keep the result for the whole session.
let sundayIPsalmodyCache: string | null = null;

function partHtmlOf(liturgy: DailyLiturgy | null, title: string): string | null {
    const part = liturgy?.memories?.[0]?.parts.find(p => p.title === title);
    if (!part) return null;
    return [...part.verses].sort((a, b) => a.order - b.order).map(v => v.text).join('');
}

/** The HTML between the Salmodia heading and the Leitura breve heading. */
function cutPsalmody(html: string): string | null {
    const salmodiaAt = html.search(/salmodia/i);
    const start = salmodiaAt > 0 ? html.lastIndexOf('<h3', salmodiaAt) : -1;
    const leituraAt = html.search(/leitura\s+breve/i);
    const end = leituraAt > 0 ? html.lastIndexOf('<h3', leituraAt) : -1;
    if (start < 0 || end <= start) return null;
    return html.slice(start, end);
}

// Classes that make API-served HTML match the page's typography — shared by
// every spliced render.
const API_HTML_CLASSES = "content-text text-zinc-800 dark:text-zinc-200 [&_p]:mb-3 [&_p:last-child]:mb-0 [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-liturgy-600 dark:[&_h3]:text-liturgy-400 [&_h3]:mt-6 [&_h3]:mb-2 [&_h6]:text-sm [&_h6]:font-semibold [&_h6]:text-zinc-500 [&_h6]:mb-4";

// The Ofício de Defuntos prays Completas "como no domingo" — serve the most
// recent Sunday's Compline, whatever day is being viewed.
let sundayComplineCache: { title: string; html: string } | null = null;

async function findSundayCompline(from: Date): Promise<{ title: string; html: string } | null> {
    if (sundayComplineCache) return sundayComplineCache;
    const d = new Date(from);
    d.setDate(d.getDate() - d.getDay()); // this week's Sunday
    try {
        const data = await fetchDailyLiturgy(formatISODate(d));
        const part = data?.memories?.[0]?.parts.find(p => p.title.startsWith('Compl'));
        if (part) {
            const html = [...part.verses].sort((a, b) => a.order - b.order).map(v => v.text).join('');
            sundayComplineCache = { title: part.title, html };
        }
    } catch {
        // Offline — the caller keeps the day's Compline.
    }
    return sundayComplineCache;
}

async function findSundayIPsalmody(from: Date): Promise<string | null> {
    if (sundayIPsalmodyCache) return sundayIPsalmodyCache;
    const d = new Date(from);
    d.setDate(d.getDate() - d.getDay()); // this week's Sunday
    for (let i = 0; i < 4; i++) {
        try {
            const data = await fetchDailyLiturgy(formatISODate(d));
            const html = partHtmlOf(data, 'Laudes');
            if (html && /Semana I do Saltério/i.test(html)) {
                sundayIPsalmodyCache = cutPsalmody(html);
                return sundayIPsalmodyCache;
            }
        } catch {
            // Offline or API hiccup — caller keeps the pointer rubric.
        }
        d.setDate(d.getDate() - 7);
    }
    return null;
}

// The 5 canonical moments we display
interface HourMoment {
    id: string;
    label: string;
    shortLabel: string;
    icon: LucideIcon;
    parts: LiturgyHourPart[];
}

/**
 * Maps the raw API parts into the 5 canonical hours.
 * - Ofício de Leitura: Invitatório + Ofício de Leitura
 * - Laudes: Invitatório + Laudes
 * - Hora Intermédia: Tércia (base) with Leitura sections from Sexta & Noa appended
 * - Vésperas: Vésperas
 * - Completas: Completas
 */
function buildCanonicalHours(rawParts: LiturgyHourPart[]): HourMoment[] {
    const byTitle = (title: string) => rawParts.find(p => p.title === title);
    const byPrefix = (prefix: string) => rawParts.find(p => p.title.startsWith(prefix));

    const invitatorioPart = byTitle('Invitatório');
    const oficio = byTitle('Ofício de Leitura');
    const laudes = byTitle('Laudes');
    const tercia = byTitle('Tércia');
    const sexta = byTitle('Sexta');
    const noa = byTitle('Noa');
    // On Saturdays/Sundays the API renames these (e.g. "Vésperas I/II",
    // "Compl. dep. Vésp. II"), so match by prefix rather than exact title.
    const vesperas = byPrefix('Vésperas');
    const completas = byPrefix('Completas') || byPrefix('Compl');

    const moments: HourMoment[] = [];

    // 1. Ofício de Leitura (with Invitatório)
    {
        const parts: LiturgyHourPart[] = [];
        if (invitatorioPart) parts.push(invitatorioPart);
        if (oficio) parts.push(oficio);
        if (parts.length > 0) {
            moments.push({ id: 'oficio', label: 'Ofício de Leitura', shortLabel: 'Ofício', icon: BookOpenText, parts });
        }
    }

    // 2. Laudes (with Invitatório)
    {
        const parts: LiturgyHourPart[] = [];
        if (invitatorioPart) parts.push(invitatorioPart);
        if (laudes) parts.push(laudes);
        if (parts.length > 0) {
            moments.push({ id: 'laudes', label: 'Laudes', shortLabel: 'Laudes', icon: Sunrise, parts });
        }
    }

    // 3. Hora Intermédia (Tércia + Sexta + Noa readings combined)
    {
        const parts: LiturgyHourPart[] = [];
        if (tercia) {
            parts.push({ ...tercia, title: 'Tércia' });
        }
        if (sexta) {
            parts.push({ ...sexta, title: 'Sexta' });
        }
        if (noa) {
            parts.push({ ...noa, title: 'Noa' });
        }
        if (parts.length > 0) {
            moments.push({ id: 'intermedia', label: 'Hora Intermédia', shortLabel: 'Interm.', icon: Sun, parts });
        }
    }

    // 4. Vésperas — keep the API title ("Vésperas I"/"Vésperas II" on
    // Saturdays/Sundays): first/second Vespers is a real liturgical
    // distinction, not noise.
    if (vesperas) {
        moments.push({ id: 'vesperas', label: vesperas.title, shortLabel: 'Vésperas', icon: Sunset, parts: [vesperas] });
    }

    // 5. Completas (API abbreviates e.g. "Compl. dep. Vésp. I")
    if (completas) {
        const label = completas.title.startsWith('Completas') ? completas.title : 'Completas';
        moments.push({ id: 'completas', label, shortLabel: 'Completas', icon: MoonStar, parts: [completas] });
    }

    return moments;
}

export default function LiturgiaHoras() {
    const [liturgy, setLiturgy] = useState<DailyLiturgy | null>(null);
    const [loading, setLoading] = useState(true);
    const [retryToken, setRetryToken] = useState(0);

    // Date being viewed — browsable like the Missa page.
    const [selectedDate, setSelectedDate] = useState(() => new Date());
    const dateInputRef = useRef<HTMLInputElement>(null);
    const selectedDateStr = formatISODate(selectedDate);
    const isToday = selectedDateStr === formatISODate(new Date());
    const changeDay = (delta: number) => {
        setSelectedDate(prev => {
            const next = new Date(prev);
            next.setDate(prev.getDate() + delta);
            return next;
        });
    };
    const [userActiveHour, setUserActiveHour] = useState<string | null>(null);
    const [userActiveSubHour, setUserActiveSubHour] = useState<string | null>(null);
    const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set([]));

    const { streaks, incrementStreak } = useAppStore();
    const prayedToday = isCompletedToday(streaks.liturgy_hours);

    // ── Alternative offices (Próprio dos Santos / Ofício de Defuntos) ──
    // Default remains the API office; the user can switch to a saint
    // celebrated today or to the Ofício de Defuntos. Data is the static
    // JSON under public/lh/ (see tools/parse-lh.ts generate).
    // Keyed by date so navigating resets the selection — a saint index for
    // another day would point at the wrong entry.
    const [saintsState, setSaintsState] = useState<{ dateStr: string; saints: ProprioEntry[] } | null>(null);
    const saints = saintsState?.dateStr === selectedDateStr ? saintsState.saints : [];
    const [altState, setAltState] = useState<{ dateStr: string; sel: 'defuntos' | number } | null>(null);
    const altOffice = altState?.dateStr === selectedDateStr ? altState.sel : null;
    const [chooserOpen, setChooserOpen] = useState(false);
    // Loaded commons by id; null marks a failed load so the office still
    // renders from whatever the saint's proper entry brings.
    const [comuns, setComuns] = useState<Record<string, ComumDoc | null>>({});

    useEffect(() => {
        let cancelled = false;
        const date = new Date(selectedDateStr + 'T00:00:00');
        loadProprio(date.getMonth() + 1)
            .then((entries) => {
                if (!cancelled) {
                    setSaintsState({ dateStr: selectedDateStr, saints: saintsForDay(entries, date.getDate()) });
                }
            })
            .catch(() => {
                // The chooser simply offers no saints.
            });
        return () => { cancelled = true; };
    }, [selectedDateStr]);

    const altEntry = typeof altOffice === 'number' ? saints[altOffice] ?? null : null;
    // Feasts with a fully proper office have no common to load.
    const altComumId = altOffice === 'defuntos' ? 'defuntos' : altEntry?.commons[0] ?? null;

    useEffect(() => {
        if (!altComumId || altComumId in comuns) return;
        let cancelled = false;
        loadComum(altComumId)
            .then((doc) => { if (!cancelled) setComuns((prev) => ({ ...prev, [altComumId]: doc })); })
            .catch(() => { if (!cancelled) setComuns((prev) => ({ ...prev, [altComumId]: null })); });
        return () => { cancelled = true; };
    }, [altComumId, comuns]);

    const altComum = altComumId ? comuns[altComumId] ?? null : null;
    const altLoading = altOffice !== null && altComumId !== null && !(altComumId in comuns);

    // Sunday Week I psalmody for the commons' Laudes (see findSundayIPsalmody).
    const [sundayPsalmody, setSundayPsalmody] = useState<string | null>(sundayIPsalmodyCache);
    useEffect(() => {
        if (altOffice === null || sundayPsalmody) return;
        let cancelled = false;
        findSundayIPsalmody(new Date(selectedDateStr + 'T00:00:00'))
            .then((html) => { if (!cancelled && html) setSundayPsalmody(html); });
        return () => { cancelled = true; };
    }, [altOffice, sundayPsalmody, selectedDateStr]);

    // Sunday Compline for the Ofício de Defuntos (see findSundayCompline).
    const [sundayCompline, setSundayCompline] = useState<{ title: string; html: string } | null>(sundayComplineCache);
    useEffect(() => {
        if (altOffice !== 'defuntos' || sundayCompline) return;
        let cancelled = false;
        findSundayCompline(new Date(selectedDateStr + 'T00:00:00'))
            .then((r) => { if (!cancelled && r) setSundayCompline(r); });
        return () => { cancelled = true; };
    }, [altOffice, sundayCompline, selectedDateStr]);

    useEffect(() => {
        let cancelled = false;
        async function loadLiturgy() {
            setLoading(true);
            try {
                const data = await fetchDailyLiturgy(selectedDateStr);
                if (cancelled) return;
                setLiturgy(data);
            } catch {
                // Same generic error state either way on this page
                if (cancelled) return;
                setLiturgy(null);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        loadLiturgy();
        return () => { cancelled = true; };
    }, [selectedDateStr, retryToken]);

    const markAsPrayed = useCallback(async () => {
        incrementStreak('liturgy_hours');
        try {
            const { publishStreakToNostr } = await import('@/lib/nostr');
            await publishStreakToNostr();
        } catch (error) {
            // Best-effort sync — a chunk-load failure (e.g. offline) must
            // never break the completion action itself.
            console.warn('Streak sync skipped:', error);
        }
    }, [incrementStreak]);

    // Completion is automatic: reaching the end of the prayed hour counts the
    // day (one per day, whatever hour). Requires real overflow so a short
    // spinner/error page can't count; when the whole text fits the viewport,
    // a dwell timer counts instead — the streak must stay earnable there.
    const autoCompletedRef = useRef(false);
    useEffect(() => {
        // Browsing another day's office doesn't earn today's streak.
        if (loading || !liturgy || prayedToday || !isToday) return;
        autoCompletedRef.current = false;

        const complete = () => {
            if (autoCompletedRef.current) return;
            autoCompletedRef.current = true;
            markAsPrayed();
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
    }, [loading, liturgy, prayedToday, isToday, markAsPrayed]);

    const canonicalHours = useMemo(() => {
        if (!liturgy?.memories || liturgy.memories.length === 0) return [];
        // memories[0] is the main day entry containing all parts
        const allParts = liturgy.memories[0].parts;
        return buildCanonicalHours(allParts);
    }, [liturgy]);

    // Default hour/sub-hour based on the current time of day, derived from the
    // loaded data (no effect needed — avoids cascading renders).
    const defaultSelection = useMemo<{ hour: string | null; subHour: string | null }>(() => {
        if (canonicalHours.length === 0) return { hour: null, subHour: null };
        const current = getHourForTime();
        const found = canonicalHours.find(m => m.id === current.id);
        return { hour: found ? found.id : canonicalHours[0].id, subHour: current.subHour };
    }, [canonicalHours]);

    // User selection takes precedence over the time-of-day default — but only
    // if it still refers to an existing hour, otherwise fall back to the default
    // so selectedMoment always resolves.
    const activeHour = (userActiveHour && canonicalHours.some(m => m.id === userActiveHour))
        ? userActiveHour
        : defaultSelection.hour;
    const activeSubHour = userActiveSubHour ?? defaultSelection.subHour;

    const selectedMoment = canonicalHours.find(m => m.id === activeHour);

    // For Hora Intermédia, pick which sub-hour to show
    const displayParts = useMemo(() => {
        if (!selectedMoment) return [];
        if (selectedMoment.id === 'intermedia' && activeSubHour) {
            const found = selectedMoment.parts.find(p => p.title === activeSubHour);
            return found ? [found] : selectedMoment.parts;
        }
        return selectedMoment.parts;
    }, [selectedMoment, activeSubHour]);

    // The Easter-season alternatives in the commons ("Tempo Pascal" blocks)
    // follow the API's naming of the current week.
    const pascal = /páscoa|pascal/i.test(
        `${liturgy?.memories?.[0]?.week_name ?? ''} ${liturgy?.saintOfDay ?? ''}`
    );

    // undefined = still loading the common; null = this hour has no
    // alternative texts (Ofício de Leitura, Completas) and keeps the API
    // office on screen.
    const assembled = useMemo(() => {
        if (altOffice === null || !activeHour) return null;
        if (altLoading) return undefined;
        return assembleHour(altEntry, altComum, activeHour, activeSubHour, pascal);
    }, [altOffice, altLoading, altEntry, altComum, activeHour, activeSubHour, pascal]);

    const altActive = altOffice !== null;

    // Hands-free scrolling through the hour, same as the Missa page. The key
    // covers everything that changes the page height, so `atPageEnd` is
    // re-measured after switching hour or folding the Invitatório away.
    const scroll = useAutoScroll(`${activeHour}:${activeSubHour}:${collapsedSections.size}:${loading}:${String(altOffice)}:${altLoading}:${selectedDateStr}`);

    // Switching what's on screen mid-scroll would leave the loop running
    // through text the user didn't choose — stop and let them restart.
    const selectHour = (id: string) => {
        scroll.stop();
        setUserActiveHour(id);
        if (id === 'intermedia') {
            setUserActiveSubHour('Tércia');
        } else {
            setUserActiveSubHour(null);
        }
    };

    const selectSubHour = (sub: string) => {
        scroll.stop();
        setUserActiveSubHour(sub);
    };

    const selectOffice = (value: 'defuntos' | number | null) => {
        scroll.stop();
        setAltState(value === null ? null : { dateStr: selectedDateStr, sel: value });
        setChooserOpen(false);
    };

    const officeLabel = altOffice === null
        ? 'Ofício do dia'
        : altOffice === 'defuntos'
            ? 'Ofício de Defuntos'
            : altEntry?.name ?? 'Ofício do dia';

    return (
        <div className="flex-1 w-full flex flex-col">

            {/* ── Sticky header ────────────────────────────────────────────── */}
            <PageHeader
                title="Liturgia das Horas"
                subtitle={loading ? 'A carregar...' : liturgy?.saintOfDay}
            />

            {/* ── Page body ────────────────────────────────────────────────── */}
            <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 pt-4 lg:pt-8 pb-20 flex-1 flex flex-col lg:flex-row lg:gap-12 lg:items-start">

                {/* ── Desktop sidebar ──────────────────────────────────────── */}
                {!loading && canonicalHours.length > 0 && (
                    <aside className="hidden lg:flex flex-col gap-4 w-52 xl:w-60 shrink-0 sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pb-4">
                        <nav aria-label="Horas do Ofício">
                            <p className="text-[0.65rem] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-2 px-2">
                                Horas
                            </p>
                            <ul className="space-y-0.5">
                                {canonicalHours.map(moment => (
                                    <li key={moment.id}>
                                        <button
                                            onClick={() => selectHour(moment.id)}
                                            className={`w-full text-left text-sm py-1.5 px-2 rounded-lg transition-colors flex items-center gap-2 ${
                                                activeHour === moment.id
                                                    ? 'text-liturgy-600 dark:text-liturgy-400 bg-liturgy-50 dark:bg-liturgy-950/30 font-semibold'
                                                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
                                            }`}
                                        >
                                            <moment.icon size={16} strokeWidth={activeHour === moment.id ? 2.4 : 2} aria-hidden="true" className="shrink-0" />
                                            <span>{moment.label}</span>
                                        </button>
                                        {moment.id === 'intermedia' && activeHour === 'intermedia' && (
                                            <div className="ml-7 mt-0.5 flex flex-col gap-0.5">
                                                {['Tércia', 'Sexta', 'Noa'].map(sub => (
                                                    <button
                                                        key={sub}
                                                        onClick={() => selectSubHour(sub)}
                                                        className={`text-left text-xs py-1 px-2 rounded-lg transition-colors ${
                                                            activeSubHour === sub
                                                                ? 'text-liturgy-600 dark:text-liturgy-400 font-semibold bg-liturgy-50/50 dark:bg-liturgy-950/20'
                                                                : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/40'
                                                        }`}
                                                    >
                                                        {sub}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </nav>

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
                            <div className="h-8 w-8 rounded-full border-4 border-zinc-200 border-t-liturgy-500 animate-spin" />
                            <p className="text-zinc-400">A obter a liturgia de hoje...</p>
                        </div>
                    ) : canonicalHours.length > 0 ? (
                        <div className="space-y-5 flex-1 flex flex-col">
                            {/* Prev / next day navigation with a native date
                                picker on the label — same as the Missa page */}
                            <div className="flex items-center justify-between gap-1 surface rounded-xl px-1 py-1 shrink-0">
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
                                    {/* Sibling overlay, not a child — an interactive
                                        element inside a <button> is invalid HTML. */}
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

                            {/* Office chooser: the API office by default, a saint
                                of the day or the Ofício de Defuntos on demand */}
                            <div className="relative shrink-0">
                                <button
                                    onClick={() => setChooserOpen(o => !o)}
                                    aria-expanded={chooserOpen}
                                    className={`w-full flex items-center justify-center gap-2 py-2 px-4 rounded-2xl text-sm transition-colors ${altActive
                                        ? 'bg-liturgy-50 dark:bg-liturgy-950/30 text-liturgy-700 dark:text-liturgy-300 border border-liturgy-200 dark:border-liturgy-800'
                                        : 'surface text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                                        }`}
                                >
                                    <Cross size={14} aria-hidden="true" className="shrink-0" />
                                    <span className="font-semibold truncate">{officeLabel}</span>
                                    <ChevronDown size={14} aria-hidden="true" className={`shrink-0 transition-transform ${chooserOpen ? 'rotate-180' : ''}`} />
                                </button>
                                {chooserOpen && (
                                    <div className="absolute z-30 mt-2 w-full rounded-2xl surface shadow-lg border border-zinc-100 dark:border-zinc-800 overflow-hidden">
                                        <button
                                            onClick={() => selectOffice(null)}
                                            className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60 ${altOffice === null ? 'font-semibold text-liturgy-600 dark:text-liturgy-400' : ''}`}
                                        >
                                            Ofício do dia
                                            <span className="block text-xs text-zinc-400 font-normal">{liturgy?.saintOfDay}</span>
                                        </button>
                                        {saints.map((saint, i) => {
                                            const available = hasRenderableOffice(saint);
                                            return (
                                                <button
                                                    key={`${saint.day}-${i}`}
                                                    onClick={() => available && selectOffice(i)}
                                                    disabled={!available}
                                                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${available
                                                        ? `hover:bg-zinc-50 dark:hover:bg-zinc-800/60 ${altOffice === i ? 'font-semibold text-liturgy-600 dark:text-liturgy-400' : ''}`
                                                        : 'opacity-50 cursor-not-allowed'}`}
                                                >
                                                    {saint.name}
                                                    <span className="block text-xs text-zinc-400 font-normal">
                                                        {[saint.descriptor, saint.rank].filter(Boolean).join(' — ')}
                                                        {!available && ' — texto não disponível'}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                        <button
                                            onClick={() => selectOffice('defuntos')}
                                            className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60 ${altOffice === 'defuntos' ? 'font-semibold text-liturgy-600 dark:text-liturgy-400' : ''}`}
                                        >
                                            Ofício de Defuntos
                                            <span className="block text-xs text-zinc-400 font-normal">Pelos fiéis defuntos</span>
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Mobile: horizontal hour buttons — icon + label, so
                                first-time users don't have to decode pictograms */}
                            <div className="lg:hidden flex justify-center gap-1.5 pb-1 shrink-0">
                                {canonicalHours.map(moment => (
                                    <button
                                        key={moment.id}
                                        onClick={() => selectHour(moment.id)} aria-label={moment.label}
                                        aria-pressed={activeHour === moment.id}
                                        className={`flex-1 min-w-0 flex flex-col items-center gap-1 py-2.5 px-1 rounded-2xl transition-all ${activeHour === moment.id
                                            ? 'bg-liturgy-100 dark:bg-liturgy-900/60 border border-liturgy-200 dark:border-liturgy-800 text-liturgy-700 dark:text-liturgy-300 shadow-sm'
                                            : 'surface text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'
                                            }`}
                                    >
                                        <moment.icon size={20} strokeWidth={activeHour === moment.id ? 2.4 : 1.8} aria-hidden="true" />
                                        <span className="text-[0.6rem] font-medium leading-none truncate max-w-full">{moment.shortLabel}</span>
                                    </button>
                                ))}
                            </div>

                            {/* Mobile: sub-hour selector for Hora Intermédia */}
                            {activeHour === 'intermedia' && (
                                <div className="lg:hidden flex gap-2 shrink-0">
                                    {['Tércia', 'Sexta', 'Noa'].map(sub => (
                                        <button
                                            key={sub}
                                            onClick={() => selectSubHour(sub)}
                                            className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-lg transition-all ${activeSubHour === sub
                                                ? 'bg-liturgy-50 dark:bg-liturgy-950/30 text-liturgy-700 dark:text-liturgy-400 border border-liturgy-200 dark:border-liturgy-800'
                                                : 'bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 border border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800'
                                                }`}
                                        >
                                            {sub}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Content */}
                            <div className="flex-1">
                                {altActive && assembled === undefined ? (
                                    <div className="flex flex-col items-center justify-center space-y-3 py-16">
                                        <div className="h-6 w-6 rounded-full border-4 border-zinc-200 border-t-liturgy-500 animate-spin" />
                                        <p className="text-sm text-zinc-400">A carregar o ofício...</p>
                                    </div>
                                ) : altActive && assembled && assembled.sections.length > 0 ? (
                                    <div className="space-y-6">
                                        {altEntry && (
                                            <div className="surface rounded-2xl p-4 space-y-1.5">
                                                <p className="font-bold text-zinc-900 dark:text-zinc-100">{altEntry.name}</p>
                                                <p className="text-sm text-zinc-500">
                                                    {[altEntry.descriptor, altEntry.rank].filter(Boolean).join(' — ')}
                                                </p>
                                                {altEntry.bio && (
                                                    <p className="text-sm italic text-zinc-500 dark:text-zinc-400 whitespace-pre-line">{altEntry.bio}</p>
                                                )}
                                                {altEntry.commonsText && (
                                                    <p className="text-xs text-zinc-400">{altEntry.commonsText}</p>
                                                )}
                                            </div>
                                        )}
                                        {(() => {
                                            // The saint's antiphons replace the day's wherever the
                                            // API text repeats them (invitatory psalm, psalmody).
                                            // Numbered markers ("Ant. 1") map onto the common's
                                            // numbered antiphons; bare repeats keep the current one.
                                            const substituteAnt = (html: string, ants: { n?: number; text?: string }[]) => {
                                                if (ants.length === 0) return html;
                                                let current: string | undefined;
                                                return html.replace(
                                                    /(<span[^>]*>\s*Ant\.?\s*(\d*)\s*<\/span>)([\s\S]*?)(?=<\/p>)/g,
                                                    (all, label: string, num: string) => {
                                                        if (num) current = ants.find(a => a.n === Number(num))?.text ?? current;
                                                        const text = current ?? ants[0]?.text;
                                                        return text ? `${label} ${text}` : all;
                                                    }
                                                );
                                            };
                                            const renderHtml = (html: string) => (
                                                <div className={API_HTML_CLASSES} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />
                                            );
                                            const partHtml = (title: string) => {
                                                const part = liturgy?.memories?.[0]?.parts.find(p => p.title === title);
                                                if (!part) return null;
                                                return [...part.verses].sort((a, b) => a.order - b.order).map(v => v.text).join('');
                                            };

                                            // Hora Intermédia: the hymn and psalmody are the
                                            // day's — splice the API sub-hour up to its Leitura
                                            // breve, with the saint/common antiphon substituted.
                                            if (activeHour === 'intermedia' && assembled.sections[0]) {
                                                const sec = assembled.sections[0];
                                                const secAnt = sec.blocks.find(b => b.kind.startsWith('ant'))?.text;
                                                const bodyBlocks = sec.blocks.filter(b => !b.kind.startsWith('ant'));
                                                const html = partHtml(activeSubHour ?? 'Tércia');
                                                let psalmody = '';
                                                if (html) {
                                                    const at = html.search(/leitura\s+breve/i);
                                                    const cut = at > 0 ? html.lastIndexOf('<h3', at) : -1;
                                                    if (cut > 0) psalmody = html.slice(0, cut);
                                                }
                                                if (psalmody) {
                                                    return (
                                                        <div className="space-y-3">
                                                            <BreviaryBlocks sections={[{ title: sec.title, blocks: [] }]} />
                                                            {renderHtml(substituteAnt(psalmody, secAnt ? [{ text: secAnt }] : []))}
                                                            <BreviaryBlocks sections={[{ title: '', blocks: bodyBlocks }]} />
                                                        </div>
                                                    );
                                                }
                                                return <BreviaryBlocks sections={assembled.sections} />;
                                            }

                                            // "Salmo invitatório." in the common is a pointer to
                                            // the invitatory psalm — resolve it with the day's
                                            // Invitatório from the API, the saint's antiphon
                                            // replacing the day's.
                                            const inv = assembled.sections.find(s => s.title === 'Invitatório');
                                            const rest = assembled.sections.filter(s => s.title !== 'Invitatório');
                                            const invHtml = inv ? partHtml('Invitatório') : null;
                                            const invAnt = inv?.blocks.find(b => b.kind.startsWith('ant'))?.text;
                                            const invBlocks = inv?.blocks.filter(b => {
                                                if (b.kind === 'rubrica' && /^Salmo invitatório/i.test(b.text ?? '')) return false;
                                                if (invHtml && b.kind.startsWith('ant')) return false; // substituted below
                                                return true;
                                            }) ?? [];

                                            // Laudes: "Salmos e cântico do Domingo I." resolved
                                            // into the actual Sunday Week I psalmody, with the
                                            // common's numbered antiphons substituted in.
                                            const laudesSec = rest.find(s => s.title === 'Laudes');
                                            const psalterRubric = laudesSec?.blocks.findIndex(
                                                b => b.kind === 'rubrica' && /^Salmos e cântico/i.test(b.text ?? '')
                                            ) ?? -1;
                                            let laudesRender = laudesSec ? <BreviaryBlocks sections={[laudesSec]} /> : null;
                                            if (laudesSec && psalterRubric >= 0 && sundayPsalmody) {
                                                const numberedAnts = laudesSec.blocks.filter(b => b.kind === 'ant' && b.n !== undefined);
                                                const pre = laudesSec.blocks.slice(0, psalterRubric);
                                                const post = laudesSec.blocks
                                                    .slice(psalterRubric + 1)
                                                    .filter(b => !(b.kind === 'ant' && b.n !== undefined));
                                                laudesRender = (
                                                    <div className="space-y-3">
                                                        <BreviaryBlocks sections={[{ title: 'Laudes', blocks: pre }]} />
                                                        {renderHtml(substituteAnt(sundayPsalmody, numberedAnts))}
                                                        <BreviaryBlocks sections={[{ title: '', blocks: post }]} />
                                                    </div>
                                                );
                                            }

                                            return (
                                                <>
                                                    {inv && (
                                                        <div className="space-y-3">
                                                            <BreviaryBlocks sections={[{ title: 'Invitatório', blocks: invBlocks }]} />
                                                            {invHtml && renderHtml(substituteAnt(invHtml, invAnt ? [{ text: invAnt }] : []))}
                                                        </div>
                                                    )}
                                                    {laudesRender}
                                                    <BreviaryBlocks sections={rest.filter(s => s.title !== 'Laudes')} />
                                                </>
                                            );
                                        })()}
                                    </div>
                                ) : altActive && altOffice === 'defuntos' && activeHour === 'completas' && sundayCompline ? (
                                    <div className="space-y-4">
                                        {/* The office's own rubric, surfaced as the banner */}
                                        <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-liturgy-50/60 dark:bg-liturgy-950/20 text-liturgy-700 dark:text-liturgy-300 text-sm">
                                            <Info size={16} aria-hidden="true" className="shrink-0 mt-0.5" />
                                            <span>Completas como no Domingo.</span>
                                        </div>
                                        <div className="space-y-3">
                                            <h3 className="text-sm font-bold text-liturgy-600 dark:text-liturgy-400 uppercase tracking-widest border-b border-zinc-100 dark:border-zinc-800 pb-2">
                                                {sundayCompline.title}
                                            </h3>
                                            <div className={API_HTML_CLASSES} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(sundayCompline.html) }} />
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        {altActive && (
                                            <div className="mb-4 flex items-start gap-2.5 p-3.5 rounded-2xl bg-liturgy-50/60 dark:bg-liturgy-950/20 text-liturgy-700 dark:text-liturgy-300 text-sm">
                                                <Info size={16} aria-hidden="true" className="shrink-0 mt-0.5" />
                                                <span>{assembled?.note ?? 'Esta hora reza-se como no Ofício do dia.'}</span>
                                            </div>
                                        )}
                                        {displayParts.length > 0 ? (
                                    <div className="space-y-6">
                                        {displayParts.map(part => {
                                            const isInvitatory = part.title === 'Invitatório';
                                            const isCollapsed = isInvitatory && collapsedSections.has(part.title);
                                            const toggleSection = () => setCollapsedSections(prev => {
                                                const next = new Set(prev);
                                                if (next.has(part.title)) next.delete(part.title);
                                                else next.add(part.title);
                                                return next;
                                            });
                                            return (
                                                <div key={part.title + part.order} id={`section-${part.title}`} className="space-y-3">
                                                    {/* Section header */}
                                                    {selectedMoment && activeHour !== 'intermedia' && (
                                                        isInvitatory ? (
                                                            <button
                                                                onClick={toggleSection}
                                                                className="w-full flex items-center justify-between text-sm font-bold text-liturgy-600 dark:text-liturgy-400 uppercase tracking-widest border-b border-zinc-100 dark:border-zinc-800 pb-2"
                                                            >
                                                                {part.title}
                                                                <ChevronRight className={`transition-transform ${!isCollapsed ? 'rotate-90' : ''}`} size={16} />
                                                            </button>
                                                        ) : (
                                                            <h3 className="text-sm font-bold text-liturgy-600 dark:text-liturgy-400 uppercase tracking-widest border-b border-zinc-100 dark:border-zinc-800 pb-2">
                                                                {part.title}
                                                            </h3>
                                                        )
                                                    )}
                                                    {/* Content — hidden if collapsed */}
                                                    {!isCollapsed && (
                                                        <div className="space-y-4">
                                                            {[...part.verses].sort((a, b) => a.order - b.order).map(verse => (
                                                                <div key={verse.id}>
                                                                    {verse.audio_url && (
                                                                        <audio
                                                                            controls
                                                                            preload="none"
                                                                            src={verse.audio_url}
                                                                            className="w-full h-10 mb-3"
                                                                        >
                                                                            <a href={verse.audio_url}>Ouvir áudio</a>
                                                                        </audio>
                                                                    )}
                                                                    <div
                                                                        className="
                                                                        content-text
                                                                        text-zinc-800 dark:text-zinc-200
                                                                        [&_p]:mb-3 [&_p:last-child]:mb-0
                                                                        [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-liturgy-600 dark:[&_h3]:text-liturgy-400 [&_h3]:mt-6 [&_h3]:mb-2
                                                                        [&_h6]:text-sm [&_h6]:font-semibold [&_h6]:text-zinc-500 [&_h6]:mb-4
                                                                        [&_strong]:font-bold [&_strong]:text-zinc-900 dark:[&_strong]:text-zinc-100
                                                                        [&_em]:italic [&_em]:text-zinc-600 dark:[&_em]:text-zinc-400
                                                                    "
                                                                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(verse.text) }}
                                                                    />
                                                                </div>
                                                            ))}
                                                            {/* Quick scroll button — sticky at the bottom */}
                                                            {part.title === 'Invitatório' && displayParts.length > 1 && (
                                                                <div className="sticky bottom-4 z-20 pb-2 pt-2">
                                                                    <button
                                                                        onClick={() => {
                                                                            scroll.stop();
                                                                            const nextPart = displayParts.find(p => p.title !== 'Invitatório');
                                                                            if (nextPart) {
                                                                                const sectionEl = document.getElementById(`section-${nextPart.title}`);
                                                                                if (sectionEl) {
                                                                                    // Try to find the "Salmodia" heading inside the next section
                                                                                    const salmodiaEl = Array.from(sectionEl.querySelectorAll('h3, h6, font[color="red"], span.text-liturgy-600'))
                                                                                        .find(el => el.textContent?.trim().toLowerCase() === 'hino');

                                                                                    if (salmodiaEl) {
                                                                                        salmodiaEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                                                    } else {
                                                                                        // Fallback to top of the section
                                                                                        sectionEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                                                    }
                                                                                }
                                                                            }
                                                                        }}
                                                                        className="w-full py-3 px-4 text-sm font-bold shadow-lg shadow-liturgy-900/10 bg-liturgy-700 hover:bg-liturgy-800 dark:bg-liturgy-400 dark:hover:bg-liturgy-300 text-white dark:text-zinc-950 rounded-2xl flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                                                                    >
                                                                        Ir para {displayParts.find(p => p.title !== 'Invitatório')?.title || 'seguinte'}
                                                                        <ChevronRight size={16} className="rotate-90" />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                        ) : (
                                            <div className="text-center p-8 bg-zinc-50 dark:bg-zinc-900 rounded-2xl">
                                                <Clock className="mx-auto text-zinc-300 dark:text-zinc-700 mb-3" size={32} />
                                                <p className="text-zinc-500">Sem conteúdo disponível para esta hora.</p>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* Completion is automatic (reaching the end of the
                                hour) — one per day, whatever hour was prayed.
                                This confirms it happened. */}
                            {prayedToday && (
                                <div className="mt-6 mb-2">
                                    <div className="flex items-center justify-center gap-2 py-4 px-6 rounded-2xl surface surface-accent text-liturgy-700 dark:text-liturgy-300 text-sm font-semibold">
                                        <CheckCircle2 size={18} aria-hidden="true" />
                                        Rezado hoje — {streaks.liturgy_hours.days} {streaks.liturgy_hours.days === 1 ? 'dia' : 'dias'} seguidos
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 surface rounded-2xl">
                            <p className="text-zinc-500 text-center">
                                Não foi possível carregar a Liturgia das Horas. Verifique a sua ligação à internet.
                            </p>
                            <button
                                onClick={() => setRetryToken(t => t + 1)}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-liturgy-700 hover:bg-liturgy-800 dark:bg-liturgy-400 dark:hover:bg-liturgy-300 text-white dark:text-zinc-950 text-sm font-semibold transition-colors active:scale-[0.97]"
                            >
                                <RotateCcw size={15} aria-hidden="true" />
                                Tentar novamente
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Floating autoscroll FAB — mobile / tablet only ────────── */}
            {!loading && canonicalHours.length > 0 && <AutoScrollFab scroll={scroll} />}
        </div>
    );
}
