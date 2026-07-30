import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { LiturgicalColor } from "@/lib/liturgy";
import { COLOR_DOTS, splitDayDescription } from "@/lib/dayInfo";

/** Bare color dot for titles — the glanceable signal without repeating the
    color name the day description already states. Same visual language as
    the Diretório calendar grid. */
export function LiturgicalColorDot({ color, className = '' }: { color: LiturgicalColor; className?: string }) {
    const label = `Cor litúrgica: ${COLOR_DOTS[color].label}`;
    return (
        <span
            role="img"
            aria-label={label}
            title={label}
            className={`inline-block h-2.5 w-2.5 rounded-full align-middle ${color === 'branco' ? 'ring-1 ring-zinc-300 dark:ring-zinc-600' : ''} ${className}`}
            style={{ backgroundColor: COLOR_DOTS[color].bg }}
        />
    );
}

/** Collapsible day card: date and day name up front, the day's description
    (rank, colour, readings list) behind a tap — same shape as the "Santo do
    dia" card, so the sidebar stays scannable on a laptop screen. */
export function DayCard({ dateLabel, color, title, description, className = '' }: {
    dateLabel: string;
    color?: LiturgicalColor;
    title: string;
    description?: string | null;
    className?: string;
}) {
    const [expanded, setExpanded] = useState(false);
    const hasBody = Boolean(description);

    return (
        <section className={`surface surface-accent rounded-2xl ${className}`}>
            <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
                disabled={!hasBody}
                className="w-full flex items-start justify-between gap-2 p-4 text-left"
            >
                <span>
                    <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-liturgy-600 dark:text-liturgy-400 mb-1.5">
                        {/* The dot is the color signal; its name is already in
                            the description text, so no "Cor litúrgica" line. */}
                        {color && <LiturgicalColorDot color={color} />}
                        {dateLabel}
                    </span>
                    <span className="block text-base font-semibold leading-snug text-liturgy-900 dark:text-liturgy-100">
                        {title}
                    </span>
                </span>
                {hasBody && (
                    <ChevronDown
                        size={16}
                        aria-hidden="true"
                        className={`mt-0.5 shrink-0 text-liturgy-600/70 dark:text-liturgy-400/70 transition-transform ${expanded ? 'rotate-180' : ''}`}
                    />
                )}
            </button>
            {expanded && description && (
                // Whole description at once — the card itself is the collapse,
                // so a second "Ver mais" inside it would just be another tap.
                <p className="px-4 pb-4 text-sm text-liturgy-800/80 dark:text-liturgy-200/70 whitespace-pre-line">
                    {description.trim()}
                </p>
            )}
        </section>
    );
}

/** Day description shown up to the readings, trailing remarks behind "Ver mais". */
export function DayDescription({ text, className = '' }: { text: string; className?: string }) {
    const [expanded, setExpanded] = useState(false);
    const { main, notes } = splitDayDescription(text);
    return (
        <div className={className}>
            <p className="text-sm text-liturgy-800/80 dark:text-liturgy-200/70 whitespace-pre-line">
                {expanded && notes ? `${main}\n\n${notes}` : main}
            </p>
            {notes && (
                <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    className="mt-1 text-xs text-liturgy-600 dark:text-liturgy-400 hover:text-liturgy-800 dark:hover:text-liturgy-200 transition-colors"
                >
                    {expanded ? '▴ Ver menos' : '▾ Ver mais'}
                </button>
            )}
        </div>
    );
}
