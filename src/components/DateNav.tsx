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
    maxDateStr,
}: {
    selectedDate: Date;
    /**
     * YYYY-MM-DD of `selectedDate`, which feeds the native picker.
     *
     * Which calendar it is counted in is the caller's business — Missa and the
     * Hours key their days locally, Palavra keys them in UTC because that is
     * when a puzzle rolls over. This component only needs the two date strings
     * below to agree with each other.
     */
    selectedDateStr: string;
    isToday: boolean;
    onChangeDay: (delta: number) => void;
    onSelectDate: (date: Date) => void;
    /**
     * The last day that can be chosen, YYYY-MM-DD. Opt-in, because most pages
     * here have no such limit — the readings and the Hours exist for any date
     * you care to look up, so their pickers stay open-ended.
     *
     * Palavra is the exception: tomorrow's puzzle hasn't been published, and
     * the publisher refuses to publish ahead on purpose, so offering the day
     * is offering an error.
     *
     * **Must be counted the same way as `selectedDateStr`** — both local or
     * both UTC. The comparison below is lexicographic, which is exactly right
     * for YYYY-MM-DD and silently off by a day if the two are mixed, for the
     * hours where the two calendars disagree and nowhere else.
     */
    maxDateStr?: string;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    // Compared as strings, which YYYY-MM-DD sorts correctly, rather than
    // parsed back into Dates — a timezone round trip at this boundary is what
    // made the puzzle 404 for the first hour of the day once already. It
    // assumes both strings count days the same way; see `maxDateStr`.
    const atMax = Boolean(maxDateStr && selectedDateStr >= maxDateStr);

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
                    // `max` greys out later days in the native calendar, which
                    // is the whole point — but it is advisory, so the handler
                    // refuses them too rather than trusting the widget.
                    max={maxDateStr}
                    onChange={(e) => {
                        if (!e.target.value) return;
                        if (maxDateStr && e.target.value > maxDateStr) return;
                        onSelectDate(new Date(e.target.value + 'T00:00:00'));
                    }}
                    className="absolute inset-0 opacity-0 pointer-events-none"
                />
            </div>
            <button
                type="button"
                onClick={() => onChangeDay(1)}
                aria-label="Dia seguinte"
                disabled={atMax}
                className="p-2.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-30 disabled:pointer-events-none"
            >
                <ChevronRight size={18} />
            </button>
        </div>
    );
}
