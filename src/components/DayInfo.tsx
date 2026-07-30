import { useState } from "react";
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
