import { useState, useEffect, useMemo } from "react";
import { ChevronRight, Clock } from "lucide-react";
import DOMPurify from "dompurify";
import { fetchDailyLiturgy } from "@/lib/liturgy";
import type { DailyLiturgy, LiturgyHourPart } from "@/lib/liturgy";
import { useAppStore } from "@/store/app";

// The 5 canonical moments we display
interface HourMoment {
    id: string;
    label: string;
    icon: string;
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
            moments.push({ id: 'oficio', label: 'Ofício de Leitura', icon: '📖', parts });
        }
    }

    // 2. Laudes (with Invitatório)
    {
        const parts: LiturgyHourPart[] = [];
        if (invitatorioPart) parts.push(invitatorioPart);
        if (laudes) parts.push(laudes);
        if (parts.length > 0) {
            moments.push({ id: 'laudes', label: 'Laudes', icon: '🌅', parts });
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
            moments.push({ id: 'intermedia', label: 'Hora Intermédia', icon: '☀️', parts });
        }
    }

    // 4. Vésperas
    if (vesperas) {
        moments.push({ id: 'vesperas', label: 'Vésperas', icon: '🌇', parts: [vesperas] });
    }

    // 5. Completas
    if (completas) {
        moments.push({ id: 'completas', label: 'Completas', icon: '🌙', parts: [completas] });
    }

    return moments;
}

export default function LiturgiaHoras() {
    const [liturgy, setLiturgy] = useState<DailyLiturgy | null>(null);
    const [loading, setLoading] = useState(true);
    const [userActiveHour, setUserActiveHour] = useState<string | null>(null);
    const [userActiveSubHour, setUserActiveSubHour] = useState<string | null>(null);
    const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set([]));

    const { incrementStreak } = useAppStore();

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
            if (data?.memories && data.memories.length > 0) {
                incrementStreak('liturgy_hours');
            }
            setLoading(false);
        }

        loadLiturgy();
    }, [incrementStreak]);

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

        const hour = new Date().getHours();
        let defaultMoment = 'oficio';
        let defaultSubHour: string | null = null;

        if (hour >= 6 && hour < 9) {
            defaultMoment = 'laudes';
        } else if (hour >= 9 && hour < 12) {
            defaultMoment = 'intermedia';
            defaultSubHour = 'Tércia';
        } else if (hour >= 12 && hour < 15) {
            defaultMoment = 'intermedia';
            defaultSubHour = 'Sexta';
        } else if (hour >= 15 && hour < 18) {
            defaultMoment = 'intermedia';
            defaultSubHour = 'Noa';
        } else if (hour >= 18 && hour < 21) {
            defaultMoment = 'vesperas';
        } else {
            defaultMoment = 'completas';
        }

        const found = canonicalHours.find(m => m.id === defaultMoment);
        return { hour: found ? found.id : canonicalHours[0].id, subHour: defaultSubHour };
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

    const [isScrolled, setIsScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const selectHour = (id: string) => {
        setUserActiveHour(id);
        if (id === 'intermedia') {
            setUserActiveSubHour('Tércia');
        } else {
            setUserActiveSubHour(null);
        }
    };

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
                        type="button" aria-label="Voltar" onClick={() => window.history.back()}
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
                            Liturgia das Horas
                        </h1>
                        <p className={`text-zinc-500 capitalize font-medium mt-0.5 transition-all truncate ${
                            isScrolled ? 'text-xs opacity-80' : 'text-sm'
                        }`}>
                            {liturgy ? liturgy.saintOfDay : 'A carregar...'}
                        </p>
                    </div>
                </div>
            </header>

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
                                            <span>{moment.icon}</span>
                                            <span>{moment.label}</span>
                                        </button>
                                        {moment.id === 'intermedia' && activeHour === 'intermedia' && (
                                            <div className="ml-7 mt-0.5 flex flex-col gap-0.5">
                                                {['Tércia', 'Sexta', 'Noa'].map(sub => (
                                                    <button
                                                        key={sub}
                                                        onClick={() => setUserActiveSubHour(sub)}
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
                            {/* Mobile: horizontal hour buttons */}
                            <div className="lg:hidden flex justify-center gap-2 pb-1 shrink-0">
                                {canonicalHours.map(moment => (
                                    <button
                                        key={moment.id}
                                        onClick={() => selectHour(moment.id)} aria-label={moment.label} title={moment.label}
                                        className={`flex-1 max-w-[4rem] aspect-square flex items-center justify-center text-xl rounded-2xl transition-all ${activeHour === moment.id
                                            ? 'bg-liturgy-100 dark:bg-liturgy-900/60 border border-liturgy-200 dark:border-liturgy-800 shadow-sm scale-110 z-10'
                                            : 'bg-zinc-100 dark:bg-zinc-900 border border-transparent hover:bg-zinc-200 dark:hover:bg-zinc-800 opacity-60 hover:opacity-100'
                                            }`}
                                    >
                                        <span>{moment.icon}</span>
                                    </button>
                                ))}
                            </div>

                            {/* Mobile: sub-hour selector for Hora Intermédia */}
                            {activeHour === 'intermedia' && (
                                <div className="lg:hidden flex gap-2 shrink-0">
                                    {['Tércia', 'Sexta', 'Noa'].map(sub => (
                                        <button
                                            key={sub}
                                            onClick={() => setUserActiveSubHour(sub)}
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
                                                                <div
                                                                    key={verse.id}
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
                                                            ))}
                                                            {/* Quick scroll button — sticky at the bottom */}
                                                            {part.title === 'Invitatório' && displayParts.length > 1 && (
                                                                <div className="sticky bottom-4 z-20 pb-2 pt-2">
                                                                    <button
                                                                        onClick={() => {
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
                                                                        className="w-full py-3 px-4 text-sm font-bold shadow-lg shadow-liturgy-900/10 bg-liturgy-600 dark:bg-liturgy-700 text-white hover:bg-liturgy-700 dark:hover:bg-liturgy-600 rounded-2xl flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
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
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-zinc-50 dark:bg-zinc-900 rounded-2xl">
                            <p className="text-zinc-500">Não foi possível carregar a Liturgia das Horas de hoje.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
