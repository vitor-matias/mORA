import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { LiturgicalColor } from "@/lib/liturgy";
import { parseDaySections } from "@/lib/icsCalendar";
import type { DaySection } from "@/lib/icsCalendar";
import { COLOR_DOTS, isEmptySection, splitSections, withoutReadings } from "@/lib/dayInfo";

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

/** The rank the day is kept at — a badge, because it is a classification and
    reads as one, where "– FESTA" trailing the title reads as part of it. */
function RankBadge({ rank }: { rank: string }) {
    return (
        <span className="inline-block rounded-md bg-liturgy-100 dark:bg-liturgy-900/60 px-1.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-liturgy-700 dark:text-liturgy-300 align-middle">
            {rank}
        </span>
    );
}

/**
 * A labelled line — "Ofício", "Missa" — so the eye can find the one it wants
 * instead of reading the paragraph to the end.
 *
 * Most of these lines already open with the label's own word ("Ofício da
 * festa.", "Missa própria, Glória…"). Prefixing those would say it twice, so
 * the word is emphasised where it stands instead.
 */
function LabelledLine({ label, text }: { label: string; text: string }) {
    const opensWithLabel = text.toLowerCase().startsWith(label.toLowerCase());
    return (
        <p className="text-sm text-liturgy-800/80 dark:text-liturgy-200/70">
            <span className="font-semibold text-liturgy-700 dark:text-liturgy-300">
                {opensWithLabel ? text.slice(0, label.length) : `${label}:`}
            </span>
            {opensWithLabel ? text.slice(label.length) : ` ${text}`}
        </p>
    );
}

/**
 * One classified section.
 *
 * `dayColor` is the day's own colour: an office line naming exactly that
 * colour is saying what the dot beside the date already says, so it is
 * dropped. A line naming a choice ("Verde, verm. ou br.") is kept — that is
 * a decision the priest makes, not a repetition.
 */
function Section({ section, dayColor }: { section: DaySection; dayColor?: LiturgicalColor }) {
    switch (section.kind) {
        case 'celebration':
            return (
                <p className="text-sm font-semibold text-liturgy-900 dark:text-liturgy-100">
                    {section.text}
                    {section.text && section.rank ? ' ' : ''}
                    {section.rank && <RankBadge rank={section.rank} />}
                </p>
            );
        case 'office': {
            const repeatsTheDot = !!dayColor
                && section.colors?.toLowerCase() === COLOR_DOTS[dayColor].label.toLowerCase();
            const colors = repeatsTheDot ? null : section.colors;
            if (!section.text) return colors ? <LabelledLine label="Cor" text={colors} /> : null;
            return <LabelledLine label="Ofício" text={colors ? `${colors} — ${section.text}` : section.text} />;
        }
        case 'mass':
            // The dagger marks a Mass with a Creed in the printed directory;
            // nothing on screen explains it, so it reads as a stray glyph.
            return <LabelledLine label="Missa" text={section.text.replace(/^†\s*/, '')} />;
        case 'readings':
            return (
                <ul className="space-y-0.5">
                    {section.items.map((item, i) => (
                        <li key={i} className="text-sm text-liturgy-800/80 dark:text-liturgy-200/70">
                            {item.label && (
                                <span className="font-semibold text-liturgy-700 dark:text-liturgy-300">{item.label}: </span>
                            )}
                            {item.ref}
                        </li>
                    ))}
                </ul>
            );
        case 'notes':
            // Notes are pulled out and rendered together — see splitSections.
            return null;
        case 'text':
            return <p className="text-sm text-liturgy-800/80 dark:text-liturgy-200/70">{section.text}</p>;
    }
}

/**
 * The day as the publisher classified it, with the "*" remarks behind
 * "Ver mais" wherever the feed happened to put them.
 */
function SectionList({ sections, dayColor, expanded, onToggle }: {
    sections: DaySection[];
    dayColor?: LiturgicalColor;
    expanded: boolean;
    onToggle: () => void;
}) {
    const { main, notes } = splitSections(sections);
    const visible = main.filter((section) => !isEmptySection(section));
    return (
        <>
            <div className="space-y-1.5">
                {visible.map((section, i) => <Section key={i} section={section} dayColor={dayColor} />)}
            </div>
            {notes.length > 0 && (
                <>
                    {expanded && (
                        <ul className="mt-2 space-y-1">
                            {notes.map((note, i) => (
                                <li key={i} className="flex gap-1.5 text-sm text-liturgy-800/70 dark:text-liturgy-200/60">
                                    <span aria-hidden="true" className="text-liturgy-500">•</span>
                                    <span>{note}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                    <button
                        type="button"
                        onClick={onToggle}
                        className="mt-1 text-xs text-liturgy-600 dark:text-liturgy-400 hover:text-liturgy-800 dark:hover:text-liturgy-200 transition-colors"
                    >
                        {expanded ? '▴ Ver menos' : `▾ Ver mais (${notes.length})`}
                    </button>
                </>
            )}
        </>
    );
}

/** Collapsible day card: date and day name up front, the day's description
    (rank, colour, readings list) behind a tap — same shape as the "Santo do
    dia" card, so the sidebar stays scannable on a laptop screen. */
export function DayCard({ dateLabel, color, title, description, sections, className = '' }: {
    dateLabel: string;
    color?: LiturgicalColor;
    title: string;
    description?: string | null;
    sections?: DaySection[] | null;
    className?: string;
}) {
    const [expanded, setExpanded] = useState(false);
    // Trimmed once: a whitespace-only description would otherwise show a
    // chevron that expands to an empty body.
    const body = description?.trim() ?? '';
    const hasBody = (sections?.length ?? 0) > 0 || body.length > 0;

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
            {expanded && hasBody && (
                <div className="px-4 pb-4">
                    {/* The card itself is the collapse, so the whole day goes
                        in at once — including the remarks, which have no
                        second "Ver mais" of their own to hide behind here. */}
                    <DayDescription text={body} sections={sections} color={color} notesOpen />
                </div>
            )}
        </section>
    );
}

/**
 * A day's description, rendered from its sections.
 *
 * `sections` comes off the published event; `text` is the same day as prose,
 * and is parsed here for the one case that has neither — a store rehydrated
 * from a version that persisted only the prose, until the day's first fetch
 * lands. One path either way: reading a day two different ways is what put
 * Easter's readings behind a "Ver mais".
 */
export function DayDescription({ text, sections, color, hideReadings = false, notesOpen = false, className = '' }: {
    text: string;
    sections?: DaySection[] | null;
    color?: LiturgicalColor;
    /** For cards that say which day it is rather than what is read at Mass. */
    hideReadings?: boolean;
    /** Start with the remarks already open (the card is the collapse). */
    notesOpen?: boolean;
    className?: string;
}) {
    const [expanded, setExpanded] = useState(notesOpen);
    const resolved = useMemo(
        () => (sections && sections.length > 0 ? sections : parseDaySections(text)),
        [sections, text],
    );

    return (
        <div className={className}>
            <SectionList
                sections={hideReadings ? withoutReadings(resolved) : resolved}
                dayColor={color}
                expanded={expanded}
                onToggle={() => setExpanded((v) => !v)}
            />
        </div>
    );
}
