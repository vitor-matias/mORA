import { useRef } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { formatDisplayDate, formatShortDisplayDate } from "@/lib/format";

/**
 * Prev / next day pill with a native date picker on the label — shared by
 * the Missa and Horas pages, which each render one instance per layout
 * (mobile flow, desktop sidebar). The input ref lives inside the component:
 * a page-level ref shared across instances would bind to whichever mounted
 * last, and showPicker() would anchor to a display:none input.
 */
export function DateNav({
    selectedDate,
    selectedDateStr,
    isToday,
    onChangeDay,
    onSelectDate,
}: {
    selectedDate: Date;
    /** Local YYYY-MM-DD of selectedDate (feeds the native picker). */
    selectedDateStr: string;
    isToday: boolean;
    onChangeDay: (delta: number) => void;
    onSelectDate: (date: Date) => void;
}) {
    const inputRef = useRef<HTMLInputElement>(null);

    return (
        <div className="flex items-center justify-between gap-1 surface rounded-xl px-1 py-1 shrink-0">
            <button
                type="button"
                onClick={() => onChangeDay(-1)}
                aria-label="Dia anterior"
                className="p-2.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
                <ChevronLeft size={18} />
            </button>
            <div className="relative flex-1">
                <button
                    type="button"
                    onClick={() => {
                        const input = inputRef.current;
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
                        {isToday ? 'Hoje' : (
                            // Full-width pill on mobile fits the weekday; the
                            // lg+ sidebar pill doesn't, and the day card
                            // names it anyway.
                            <>
                                <span className="lg:hidden">{formatDisplayDate(selectedDate)}</span>
                                <span className="hidden lg:inline">{formatShortDisplayDate(selectedDate)}</span>
                            </>
                        )}
                    </span>
                </button>
                {/* Sibling overlay, not a child — an interactive element
                    inside a <button> is invalid HTML. Not aria-hidden: the
                    focus() fallback moves real focus here on browsers
                    without showPicker(), and focusing an aria-hidden element
                    is a WCAG failure — so it stays in the accessibility tree
                    with its own label, out of the tab order. */}
                <input
                    ref={inputRef}
                    type="date"
                    aria-label="Escolher data"
                    tabIndex={-1}
                    value={selectedDateStr}
                    onChange={(e) => {
                        if (e.target.value) onSelectDate(new Date(e.target.value + 'T00:00:00'));
                    }}
                    className="absolute inset-0 opacity-0 pointer-events-none"
                />
            </div>
            <button
                type="button"
                onClick={() => onChangeDay(1)}
                aria-label="Dia seguinte"
                className="p-2.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
                <ChevronRight size={18} />
            </button>
        </div>
    );
}
