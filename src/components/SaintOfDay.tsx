import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import DOMPurify from "dompurify";
import type { SaintOfDay } from "@/lib/liturgy";

// First Roman Martyrology entry — numbered "2." onwards ("1." is the saint
// the biography already covers); an asterisk marks optional memorials.
const ENTRY_RE = /^\d+\*?\.\s/;

/**
 * Splits the saint description into the biography and the trailing Roman
 * Martyrology entries ("2. Em Roma, …") listing the day's other saints.
 * Empty spacer paragraphs (&nbsp;) are dropped along the way.
 */
function splitSaintDescription(html: string): { bio: string; others: string | null } {
    if (typeof DOMParser === 'undefined' || !html) return { bio: html, others: null };
    // The source joins saint names with &nbsp;, welding whole phrases into
    // unbreakable chunks that overflow the narrow sidebar card \u2014 normalise
    // them to plain spaces (.seculo spans keep their nowrap via CSS instead).
    const normalized = html.replace(/&nbsp;|\u00a0/g, ' ');
    const children = Array.from(new DOMParser().parseFromString(normalized, 'text/html').body.children);
    const isEmpty = (el: Element) => !(el.textContent ?? '').trim();
    const join = (els: Element[]) => els.filter((el) => !isEmpty(el)).map((el) => el.outerHTML).join('');
    const splitIdx = children.findIndex((el) => ENTRY_RE.test(el.textContent?.trim() ?? ''));
    if (splitIdx === -1) return { bio: join(children), others: null };
    return {
        bio: join(children.slice(0, splitIdx)),
        others: join(children.slice(splitIdx)) || null,
    };
}

const BODY_HTML_CLASSES = `
    text-sm leading-relaxed text-zinc-600 dark:text-zinc-300 space-y-2 break-words
    [&_strong]:font-semibold [&_strong]:text-zinc-800 dark:[&_strong]:text-zinc-100
    [&_.seculo]:text-xs [&_.seculo]:text-zinc-400 dark:[&_.seculo]:text-zinc-500 [&_.seculo]:whitespace-nowrap
`;

/** Collapsible "Santo do dia" card: name up front, biography and the day's
    other saints (Roman Martyrology) behind a tap. */
export function SaintOfDayCard({ saint, className = '' }: { saint: SaintOfDay; className?: string }) {
    const [expanded, setExpanded] = useState(false);
    const { bio, others } = useMemo(
        () => splitSaintDescription(DOMPurify.sanitize(saint.description)),
        [saint.description]
    );
    const hasBody = Boolean(bio || others);

    return (
        <section className={`surface rounded-2xl ${className}`}>
            <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
                disabled={!hasBody}
                className="w-full flex items-start justify-between gap-2 p-4 text-left"
            >
                <span>
                    <span className="block text-xs font-bold uppercase tracking-widest text-liturgy-600 dark:text-liturgy-400 mb-1">
                        Santo do dia
                    </span>
                    <span className="block text-sm font-semibold leading-snug text-zinc-800 dark:text-zinc-100">
                        {saint.name}
                    </span>
                </span>
                {hasBody && (
                    <ChevronDown
                        size={16}
                        aria-hidden="true"
                        className={`mt-0.5 shrink-0 text-zinc-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
                    />
                )}
            </button>
            {expanded && hasBody && (
                <div className="px-4 pb-4 space-y-3">
                    {bio && (
                        <div className={BODY_HTML_CLASSES} dangerouslySetInnerHTML={{ __html: bio }} />
                    )}
                    {others && (
                        <div>
                            <p className="text-[0.65rem] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-2">
                                Outros santos do dia
                            </p>
                            <div className={BODY_HTML_CLASSES} dangerouslySetInnerHTML={{ __html: others }} />
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}
