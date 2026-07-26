import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, ChevronLeft, BookOpen, RotateCcw } from "lucide-react";
import { fetchLiturgicalCalendarMap } from "@/lib/liturgy";
import type { LiturgicalColor, LiturgicalDayInfo } from "@/lib/liturgy";
import { formatISODate } from "@/lib/format";
import { useAppStore } from "@/store/app";

// Fixed swatches per liturgical color — the calendar shows every day's own
// color at once, so these can't follow the app-wide `data-theme` palette.
const COLOR_DOTS: Record<LiturgicalColor, { bg: string; label: string }> = {
    verde: { bg: '#059669', label: 'Verde' },
    roxo: { bg: '#9333ea', label: 'Roxo' },
    vermelho: { bg: '#dc2626', label: 'Vermelho' },
    branco: { bg: '#e4e4e7', label: 'Branco' },
    rosa: { bg: '#ec4899', label: 'Rosa' },
};

const WEEKDAYS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D']; // Monday-first, pt-PT

function firstOfMonth(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), 1);
}

export default function LiturgicalDirectory() {
    const navigate = useNavigate();
    const todayStr = formatISODate(new Date());

    const [viewMonth, setViewMonth] = useState(() => firstOfMonth(new Date()));
    const [selected, setSelected] = useState<string>(todayStr);
    const [calendar, setCalendar] = useState<Map<string, LiturgicalDayInfo> | null>(null);
    const [loading, setLoading] = useState(true);
    const [retryToken, setRetryToken] = useState(0);

    useEffect(() => {
        let cancelled = false;
        fetchLiturgicalCalendarMap().then((map) => {
            if (cancelled) return;
            setCalendar(map);
            setLoading(false);
        });
        return () => { cancelled = true; };
    }, [retryToken]);

    // Loading starts true and is re-armed by the retry button, never inside
    // the effect (avoids a cascading render).
    const retry = () => {
        setLoading(true);
        setRetryToken((t) => t + 1);
    };

    // The 42 cells (6 weeks) covering the viewed month, Monday-first.
    const cells = useMemo(() => {
        const start = new Date(viewMonth);
        start.setDate(1 - ((viewMonth.getDay() + 6) % 7));
        return Array.from({ length: 42 }, (_, i) => {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            return { date: d, dateStr: formatISODate(d), inMonth: d.getMonth() === viewMonth.getMonth() };
        });
    }, [viewMonth]);

    const changeMonth = (delta: number) => {
        setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
    };

    const goToToday = () => {
        setViewMonth(firstOfMonth(new Date()));
        setSelected(todayStr);
    };

    const selectedInfo = calendar?.get(selected) ?? null;

    // Theme the whole app to the selected day's liturgical color while
    // browsing (same override mechanism as the Missa page on other dates).
    const setLiturgicalColorOverride = useAppStore((s) => s.setLiturgicalColorOverride);
    useEffect(() => {
        const isToday = selected === todayStr;
        setLiturgicalColorOverride(!isToday && selectedInfo?.color ? selectedInfo.color : null);
        return () => setLiturgicalColorOverride(null);
    }, [selected, selectedInfo, todayStr, setLiturgicalColorOverride]);

    const monthLabel = viewMonth.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
    const isCurrentMonth = viewMonth.getMonth() === new Date().getMonth()
        && viewMonth.getFullYear() === new Date().getFullYear();

    return (
        <div className="p-6 pt-12 max-w-md lg:max-w-xl mx-auto space-y-6 flex-1 w-full flex flex-col">
            <header className="flex items-center gap-4">
                <button
                    onClick={() => navigate('/')}
                    aria-label="Voltar ao início"
                    className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 p-2 rounded-full"
                >
                    <ChevronRight className="rotate-180" size={24} />
                </button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-halo">Diretório Litúrgico</h1>
                    <p className="text-zinc-500">O ano litúrgico, dia a dia</p>
                </div>
            </header>

            <section className="glass-panel rounded-2xl p-3">
                {/* Month navigation */}
                <div className="flex items-center justify-between mb-2">
                    <button
                        type="button"
                        onClick={() => changeMonth(-1)}
                        aria-label="Mês anterior"
                        className="p-2 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold capitalize text-zinc-700 dark:text-zinc-200">
                            {monthLabel}
                        </span>
                        {!isCurrentMonth && (
                            <button
                                type="button"
                                onClick={goToToday}
                                className="text-xs font-medium text-liturgy-600 dark:text-liturgy-400 hover:text-liturgy-700 px-2 py-1 rounded-lg hover:bg-liturgy-50 dark:hover:bg-liturgy-900/30 transition-colors"
                            >
                                Hoje
                            </button>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={() => changeMonth(1)}
                        aria-label="Mês seguinte"
                        className="p-2 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>

                {/* Weekday header */}
                <div className="grid grid-cols-7 mb-1">
                    {WEEKDAYS.map((w, i) => (
                        <span key={i} className="text-center text-[0.65rem] font-semibold uppercase text-zinc-400 select-none">
                            {w}
                        </span>
                    ))}
                </div>

                {/* Day grid */}
                <div className="grid grid-cols-7 gap-y-0.5">
                    {cells.map(({ dateStr, date, inMonth }) => {
                        const info = calendar?.get(dateStr);
                        const isToday = dateStr === todayStr;
                        const isSelected = dateStr === selected;
                        return (
                            <button
                                type="button"
                                key={dateStr}
                                onClick={() => setSelected(dateStr)}
                                aria-label={date.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' })}
                                aria-pressed={isSelected}
                                className={`relative mx-auto flex h-8 w-9 flex-col items-center justify-center rounded-lg text-xs transition-colors ${
                                    isSelected
                                        ? 'bg-liturgy-600 dark:bg-liturgy-500 text-white font-semibold'
                                        : isToday
                                            ? 'bg-liturgy-50 dark:bg-liturgy-900/40 text-liturgy-700 dark:text-liturgy-300 font-semibold'
                                            : inMonth
                                                ? 'text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                                                : 'text-zinc-300 dark:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                                }`}
                            >
                                <span className="leading-none">{date.getDate()}</span>
                                <span
                                    aria-hidden="true"
                                    className={`mt-0.5 h-1 w-1 rounded-full ${info ? '' : 'opacity-0'} ${info?.color === 'branco' && !isSelected ? 'ring-1 ring-zinc-300 dark:ring-zinc-600' : ''}`}
                                    style={info ? { backgroundColor: COLOR_DOTS[info.color].bg } : undefined}
                                />
                            </button>
                        );
                    })}
                </div>
            </section>

            {/* Selected day details */}
            <section className="glass-panel glow-ring rounded-2xl p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-liturgy-600 dark:text-liturgy-400 mb-1.5 capitalize">
                    {new Date(selected + 'T00:00:00').toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                {loading ? (
                    <div className="h-5 w-2/3 rounded bg-liturgy-100 dark:bg-liturgy-900/50 animate-pulse" />
                ) : selectedInfo ? (
                    <>
                        <h2
                            className="text-base font-semibold leading-snug text-liturgy-900 dark:text-liturgy-100"
                            style={{ fontFamily: 'var(--content-font-family, inherit)' }}
                        >
                            {selectedInfo.dayName}
                        </h2>
                        <span className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-liturgy-800 dark:text-liturgy-300">
                            <span
                                aria-hidden="true"
                                className={`h-2.5 w-2.5 rounded-full ${selectedInfo.color === 'branco' ? 'ring-1 ring-zinc-300 dark:ring-zinc-600' : ''}`}
                                style={{ backgroundColor: COLOR_DOTS[selectedInfo.color].bg }}
                            />
                            Cor litúrgica: {COLOR_DOTS[selectedInfo.color].label}
                        </span>
                        {selectedInfo.description && (
                            <p className="mt-2 text-sm text-liturgy-800/80 dark:text-liturgy-200/70 whitespace-pre-line">
                                {selectedInfo.description}
                            </p>
                        )}
                    </>
                ) : calendar ? (
                    <p className="text-sm text-liturgy-800/80 dark:text-liturgy-200/70">
                        Sem informação litúrgica para este dia.
                    </p>
                ) : (
                    <div>
                        <p className="text-sm text-liturgy-800/80 dark:text-liturgy-200/70">
                            Não foi possível carregar o calendário. Verifique a ligação à internet.
                        </p>
                        <button
                            type="button"
                            onClick={retry}
                            className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-liturgy-700 dark:text-liturgy-300 hover:text-liturgy-800 transition-colors"
                        >
                            <RotateCcw size={14} /> Tentar novamente
                        </button>
                    </div>
                )}
                <button
                    type="button"
                    onClick={() => navigate(`/liturgia?date=${selected}`)}
                    className="mt-4 w-full inline-flex items-center justify-center gap-2 text-sm font-semibold cta-primary rounded-xl px-3.5 py-2.5 transition-colors active:scale-[0.98]"
                >
                    <BookOpen size={16} aria-hidden="true" /> Ver leituras da Missa
                </button>
            </section>
        </div>
    );
}
