import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronRight, ChevronLeft, ChevronDown, Clock, Cross, BookOpenText, Sunrise, Sun, Sunset, MoonStar, CheckCircle2, RotateCcw, Info } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import DOMPurify from "dompurify";
import { fetchDailyLiturgy } from "@/lib/liturgy";
import type { DailyLiturgy, LiturgyHourPart } from "@/lib/liturgy";
import { useAppStore, isCompletedToday, STREAK_ITEMS, type StreakItem } from "@/store/app";
import { PageHeader } from "@/components/layout/PageHeader";
import { AutoScrollButton, AutoScrollSpeedRow, AutoScrollFab } from "@/components/AutoScroll";
import { useAutoScroll } from "@/lib/useAutoScroll";
import { useDayRollover } from "@/lib/useDayRollover";
import { getDefaultHoursDate, getHourForTime } from "@/lib/hours";
import { formatISODate } from "@/lib/format";
import { DateNav } from "@/components/DateNav";
import { loadProprio, loadComum } from "@/lib/breviary/data";
import { saintsForDay, hasRenderableOffice, assembleHour, complementSeries, withPsalmody } from "@/lib/breviary/assemble";
import type { ProprioEntry } from "@/lib/breviary/proprio";
import type { ComumDoc } from "@/lib/breviary/comum";
import { ApiHtml, BreviaryBlocks } from "@/components/BreviaryBlocks";
import type { AssembledSection } from "@/lib/breviary/assemble";

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

/** The API hour's `<h3>` section whose heading matches `re`, up to the next one. */
function apiSection(html: string, re: RegExp): string | null {
    for (const m of html.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/g)) {
        if (!re.test(m[1].replace(/<[^>]+>/g, ''))) continue;
        const end = html.indexOf('<h3', m.index + m[0].length);
        return html.slice(m.index, end < 0 ? undefined : end);
    }
    return null;
}

/** The gospel canticle's own text in its API section: title line to the closing antiphon. */
function canticleBody(section: string): string | null {
    const start = section.search(/<p[^>]*>\s*<strong>/); // "Lc 1, 68-79"
    const lastAnt = section.lastIndexOf('Ant.');
    const end = lastAnt > 0 ? section.lastIndexOf('<p', lastAnt) : -1;
    return start > 0 && end > start ? section.slice(start, end) : null;
}

interface ApiParts {
    opening: string | null;
    closing: string | null;
    /** Benedictus/Magnificat text, between the antiphon and its repeat. */
    canticle: string | null;
    /** "Oração dominical" — the full Pai nosso the commons only cue. */
    paiNosso: string | null;
}

/**
 * Completes an alternative office with the fixed texts the books only
 * imply, taken from the day's API hour: the opening and closing (the
 * official app serves the standard ones even on All Souls), the gospel
 * canticle and the Pai nosso. Opening goes atop the first hour section
 * (not the Invitatório), closing at the very end.
 */
/**
 * The API's own rubric ("Isto omite-se quando o Ofício de Laudes começa com
 * o Invitatório."), which some days' Laudes lack.
 */
function withInvitatoryNote(opening: string, hour: string | undefined): string {
    if (/omite-se/i.test(opening) || (hour !== 'Laudes' && hour !== 'Ofício de Leitura')) return opening;
    const office = hour === 'Laudes' ? 'Ofício de Laudes' : 'Ofício de leitura';
    return `${opening}<p><span style="color: #ff0000;">Isto omite-se quando o ${office} começa com o Invitatório.</span></p>`;
}

function withApiParts(sections: AssembledSection[], api: ApiParts): AssembledSection[] {
    const first = sections.findIndex(s => s.title !== 'Invitatório');
    const opening = api.opening && withInvitatoryNote(api.opening, sections[first]?.title);
    return sections.map((s, i) => {
        let blocks = s.blocks.map(b =>
            api.paiNosso && b.kind === 'rubrica' && b.text === 'Pai nosso' ? { kind: 'html', text: api.paiNosso } : b);
        const ants = blocks.filter(b => b.kind === 'ant-benedictus' || b.kind === 'ant-magnificat');
        if (api.canticle && ants.length > 0) {
            const at = blocks.lastIndexOf(ants[ants.length - 1]) + 1;
            // With alternatives ("Ou", per audience) the reader repeats their own choice.
            const repeat = ants.length === 1 ? [{ kind: ants[0].kind, text: ants[0].text }] : [];
            blocks = [...blocks.slice(0, at), { kind: 'html', text: api.canticle }, ...repeat, ...blocks.slice(at)];
        }
        return {
            ...s,
            blocks: [
                ...(opening && i === first ? [{ kind: 'html', text: opening }] : []),
                ...blocks,
                ...(api.closing && i === sections.length - 1 ? [{ kind: 'html', text: api.closing }] : []),
            ],
        };
    });
}

// The Ofício de Defuntos prays Completas "como no domingo" — serve the most
// recent Sunday's Compline, whatever day is being viewed. Cached per Sunday
// so navigating to another week or season fetches that week's text.
interface SundayCompline { key: string; title: string; html: string }
const sundayComplineCache = new Map<string, SundayCompline>();

/** The ISO date of the week's Sunday for the viewed date. */
function sundayKeyFor(from: Date): string {
    const d = new Date(from);
    d.setDate(d.getDate() - d.getDay());
    return formatISODate(d);
}

async function findSundayCompline(from: Date): Promise<SundayCompline | null> {
    const key = sundayKeyFor(from);
    const cached = sundayComplineCache.get(key);
    if (cached) return cached;
    try {
        const data = await fetchDailyLiturgy(key);
        const parts = data?.memories?.[0]?.parts ?? [];
        // Sunday has two Complines; the Office of the Dead uses the one
        // after second Vespers.
        const part = parts.find(p => /Vésp\. II/.test(p.title))
            ?? parts.find(p => p.title.startsWith('Compl'));
        if (part) {
            const html = [...part.verses].sort((a, b) => a.order - b.order).map(v => v.text).join('');
            const entry = { key, title: part.title, html };
            sundayComplineCache.set(key, entry);
            return entry;
        }
    } catch {
        // Offline — the caller keeps the day's Compline.
    }
    return null;
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

/**
 * Sticky "Ir para Laudes" at the foot of the Invitatório: jumps to the
 * next section's Hino (its top when there is none).
 */
function SkipInvitatory({ target, onSkip }: { target: string | undefined; onSkip: () => void }) {
    // bottom-24 clears the floating tab bar, which is hidden from xl up.
    return (
        <div className="sticky bottom-24 xl:bottom-4 z-20 pb-2 pt-2">
            <button
                onClick={() => {
                    onSkip();
                    const sectionEl = target ? document.getElementById(`section-${target}`) : null;
                    if (!sectionEl) return;
                    const hinoEl = Array.from(sectionEl.querySelectorAll('h3, h6, font[color="red"], span.text-liturgy-700'))
                        .find(el => el.textContent?.trim().toLowerCase() === 'hino');
                    (hinoEl ?? sectionEl).scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
                className="w-full py-3 px-4 text-sm font-bold shadow-lg shadow-liturgy-900/10 bg-liturgy-700 hover:bg-liturgy-800 dark:bg-liturgy-400 dark:hover:bg-liturgy-300 text-white dark:text-zinc-950 rounded-2xl flex items-center justify-center gap-2 pressable"
            >
                Ir para {target || 'seguinte'}
                <ChevronRight size={16} className="rotate-90" />
            </button>
        </div>
    );
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
    const navigate = useNavigate();
    // From lg the sidebar carries the title, so the header is not rendered at
    // all rather than hidden with CSS: hidden, it would still portal its back
    // orb and the day into the global top bar, leaving two back buttons.
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
    const [retryToken, setRetryToken] = useState(0);

    // Date being viewed — browsable like the Missa page.
    const [selectedDate, setSelectedDate] = useState(() => getDefaultHoursDate());
    const selectedDateStr = formatISODate(selectedDate);
    const isToday = selectedDateStr === formatISODate(getDefaultHoursDate());
    const changeDay = (delta: number) => {
        setSelectedDate(prev => {
            const next = new Date(prev);
            next.setDate(prev.getDate() + delta);
            return next;
        });
    };
    // A tapped reminder opens "?hora=<id>&n=<nonce>"; each tap, even for the
    // same Hour, replaces whatever the user picked since (adjusting state
    // while rendering, per the React docs).
    const [searchParams] = useSearchParams();
    const hourParam = searchParams.get('hora');
    const tapKey = searchParams.toString();
    const [seenTapKey, setSeenTapKey] = useState(tapKey);
    const [userActiveHour, setUserActiveHour] = useState<string | null>(hourParam);
    if (tapKey !== seenTapKey) {
        setSeenTapKey(tapKey);
        setUserActiveHour(hourParam);
    }
    const [userActiveSubHour, setUserActiveSubHour] = useState<string | null>(null);
    const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set([]));

    const { streaks, incrementStreak } = useAppStore();

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

    // The Hora Intermédia's "Salmodia Complementar" alternative, chosen by
    // whoever already prayed another minor Hour with the proper psalmody.
    const [useComplement, setUseComplement] = useState(false);
    const neededComumId = useComplement && altComumId && altComumId in comuns ? 'complementar' : altComumId;

    useEffect(() => {
        const id = neededComumId;
        if (!id || id in comuns) return;
        let cancelled = false;
        loadComum(id)
            .then((doc) => { if (!cancelled) setComuns((prev) => ({ ...prev, [id]: doc })); })
            .catch(() => { if (!cancelled) setComuns((prev) => ({ ...prev, [id]: null })); });
        return () => { cancelled = true; };
    }, [neededComumId, comuns]);

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
    const sundayKey = sundayKeyFor(new Date(selectedDateStr + 'T00:00:00'));
    const [sundayComplineState, setSundayComplineState] = useState<SundayCompline | null>(null);
    const sundayCompline = sundayComplineState?.key === sundayKey
        ? sundayComplineState
        : sundayComplineCache.get(sundayKey) ?? null;
    useEffect(() => {
        if (altOffice !== 'defuntos' || sundayCompline) return;
        let cancelled = false;
        findSundayCompline(new Date(selectedDateStr + 'T00:00:00'))
            .then((r) => { if (!cancelled && r) setSundayComplineState(r); });
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

    // A PWA resumed from the background on a later day keeps showing the day
    // it was left at. Re-anchor to today when the app returns on a new date.
    useDayRollover(
        () => formatISODate(getDefaultHoursDate()),
        () => setSelectedDate(getDefaultHoursDate())
    );

    const markAsPrayed = useCallback(async (hour: string) => {
        incrementStreak('liturgy_hours');
        const item = `hour_${hour}` as StreakItem;
        if (STREAK_ITEMS.includes(item)) incrementStreak(item);
        try {
            const { publishStreakToNostr } = await import('@/lib/nostr');
            await publishStreakToNostr();
        } catch (error) {
            // Best-effort sync — a chunk-load failure (e.g. offline) must
            // never break the completion action itself.
            console.warn('Streak sync skipped:', error);
        }
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
    const hourStreak = activeHour ? streaks[`hour_${activeHour}` as StreakItem] : undefined;
    const hourPrayedToday = !!hourStreak && isCompletedToday(hourStreak);

    // Completion is automatic: reaching the end of the prayed hour counts the
    // day and that Hour, once each per day. Requires real overflow so a short
    // spinner/error page can't count; when the whole text fits the viewport,
    // a dwell timer counts instead — the streak must stay earnable there.
    const autoCompletedRef = useRef(false);
    // The Hour the last run watched. Switching to another one while parked at
    // the bottom of the last must not count it unread.
    const watchedHourRef = useRef<string | null>(null);
    useEffect(() => {
        // Browsing another day's office doesn't earn today's streak.
        if (loading || !liturgy || !activeHour || hourPrayedToday || !isToday) return;
        autoCompletedRef.current = false;

        const complete = () => {
            if (autoCompletedRef.current) return;
            autoCompletedRef.current = true;
            markAsPrayed(activeHour);
        };
        const atEnd = () => {
            const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
            return maxScroll > 0 && window.scrollY >= maxScroll - 2;
        };
        // Armed at once unless the Hour just changed, so scroll restoration
        // landing at the end still counts. After a switch the reader has to
        // have been somewhere other than the end first.
        const switched = watchedHourRef.current !== null && watchedHourRef.current !== activeHour;
        watchedHourRef.current = activeHour;
        let armed = !switched || !atEnd();
        const onScroll = () => {
            if (!atEnd()) armed = true;
            else if (armed) complete();
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
    }, [loading, liturgy, activeHour, hourPrayedToday, isToday, markAsPrayed]);


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
    // alternative texts (Completas; the Ofício de Leitura outside the
    // Defuntos) and keeps the API office on screen.
    const assembledBase = useMemo(() => {
        if (altOffice === null || !activeHour) return null;
        if (altLoading) return undefined;
        return assembleHour(altEntry, altComum, activeHour, activeSubHour, pascal);
    }, [altOffice, altLoading, altEntry, altComum, activeHour, activeSubHour, pascal]);

    const complement = complementSeries(assembledBase, activeSubHour);
    const complementDoc = comuns['complementar'];
    const assembled = useMemo(() => {
        if (!assembledBase || !complement || !useComplement || !complementDoc) return assembledBase;
        return withPsalmody(assembledBase, complementDoc.hours[complement] ?? []);
    }, [assembledBase, complement, useComplement, complementDoc]);

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

    // Close the chooser on Escape or a click outside the panel. Detection by
    // data attribute, not ref: the chooser renders twice (mobile flow and
    // desktop sidebar) and a single ref would only cover one instance.
    useEffect(() => {
        if (!chooserOpen) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setChooserOpen(false); };
        const onPointer = (e: PointerEvent) => {
            if (!(e.target instanceof Element && e.target.closest('[data-office-chooser]'))) {
                setChooserOpen(false);
            }
        };
        document.addEventListener('keydown', onKey);
        document.addEventListener('pointerdown', onPointer);
        return () => {
            document.removeEventListener('keydown', onKey);
            document.removeEventListener('pointerdown', onPointer);
        };
    }, [chooserOpen]);

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

    // Rendered twice — mobile flow and desktop sidebar — same as the Missa
    // page's date pill. Each render site mounts its own DateNav instance,
    // which owns its picker input ref internally.
    const dateNav = (
        <DateNav
            selectedDate={selectedDate}
            selectedDateStr={selectedDateStr}
            isToday={isToday}
            onChangeDay={changeDay}
            onSelectDate={setSelectedDate}
        />
    );

    // Office chooser: the API office by default, a saint of the day or the
    // Ofício de Defuntos on demand. Also rendered in both layouts.
    const officeChooser = (
        <div data-office-chooser className="relative shrink-0">
            <button
                type="button"
                onClick={() => setChooserOpen(o => !o)}
                aria-expanded={chooserOpen}
                aria-haspopup="menu"
                className={`pressable w-full flex items-center justify-center gap-2 py-2 px-4 rounded-2xl text-sm ${altActive
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
                        type="button"
                        onClick={() => selectOffice(null)}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60 ${altOffice === null ? 'font-semibold text-liturgy-700 dark:text-liturgy-400' : ''}`}
                    >
                        Ofício do dia
                        <span className="block text-xs text-zinc-500 dark:text-zinc-400 font-normal">{liturgy?.saintOfDay}</span>
                    </button>
                    {saints.map((saint, i) => {
                        const available = hasRenderableOffice(saint);
                        return (
                            <button
                                type="button"
                                key={`${saint.day}-${i}`}
                                onClick={() => available && selectOffice(i)}
                                disabled={!available}
                                className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${available
                                    ? `hover:bg-zinc-50 dark:hover:bg-zinc-800/60 ${altOffice === i ? 'font-semibold text-liturgy-700 dark:text-liturgy-400' : ''}`
                                    : 'opacity-50 cursor-not-allowed'}`}
                            >
                                {saint.name}
                                <span className="block text-xs text-zinc-500 dark:text-zinc-400 font-normal">
                                    {[saint.descriptor, saint.rank].filter(Boolean).join(' — ')}
                                    {!available && ' — texto não disponível'}
                                </span>
                            </button>
                        );
                    })}
                    <button
                        type="button"
                        onClick={() => selectOffice('defuntos')}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60 ${altOffice === 'defuntos' ? 'font-semibold text-liturgy-700 dark:text-liturgy-400' : ''}`}
                    >
                        Ofício de Defuntos
                        <span className="block text-xs text-zinc-500 dark:text-zinc-400 font-normal">Pelos fiéis defuntos</span>
                    </button>
                </div>
            )}
        </div>
    );

    return (
        <div className="flex-1 w-full flex flex-col">

            {/* ── Header ───────────────────────────────────────────────────
                Below lg only — from lg the sidebar carries the title. */}
            {/* The sidebar only exists once the hours have loaded, so while it
                is loading or after it failed there is nothing to carry the
                title or the way back — the header stands in for it. */}
            {(!hasSidebar || loading || canonicalHours.length === 0) && (
                <PageHeader
                    title="Liturgia das Horas"
                    subtitle={loading ? 'A carregar...' : liturgy?.saintOfDay}
                />
            )}

            {/* ── Page body ────────────────────────────────────────────────── */}
            <div className="max-w-5xl 2xl:max-w-6xl mx-auto w-full px-4 sm:px-6 pt-4 lg:pt-8 pb-20 flex-1 flex flex-col lg:flex-row lg:gap-12 lg:items-start">

                {/* ── Desktop sidebar ──────────────────────────────────────── */}
                {!loading && canonicalHours.length > 0 && (
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
                                Liturgia das Horas
                            </h1>
                        </div>
                        {dateNav}
                        {officeChooser}
                        <nav aria-label="Horas do Ofício" className="surface rounded-3xl p-3">
                            <p className="text-[0.65rem] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-2 px-2">
                                Horas
                            </p>
                            <ul className="space-y-0.5">
                                {canonicalHours.map(moment => (
                                    <li key={moment.id}>
                                        <button
                                            onClick={() => selectHour(moment.id)}
                                            className={`w-full text-left text-sm py-1.5 px-2 rounded-lg transition-colors flex items-center gap-2 ${
                                                activeHour === moment.id
                                                    ? 'text-liturgy-700 dark:text-liturgy-400 bg-liturgy-50 dark:bg-liturgy-950/30 font-semibold'
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
                                                                ? 'text-liturgy-700 dark:text-liturgy-400 font-semibold bg-liturgy-50/50 dark:bg-liturgy-950/20'
                                                                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/40'
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
                            <div className="h-8 w-8 rounded-full border-4 border-zinc-200 dark:border-zinc-800 border-t-liturgy-700 dark:border-t-liturgy-400 animate-spin" />
                            <p className="text-zinc-500 dark:text-zinc-400">A obter a liturgia de hoje...</p>
                        </div>
                    ) : canonicalHours.length > 0 ? (
                        <div className="space-y-5 flex-1 flex flex-col">
                            {/* Mobile: date + office controls in the flow; on
                                lg+ both live in the sidebar, like Missa. */}
                            <div className="lg:hidden space-y-5 shrink-0">
                                {dateNav}
                                {officeChooser}
                            </div>

                            {/* Mobile: horizontal hour buttons — icon + label, so
                                first-time users don't have to decode pictograms */}
                            {/* auto-fit: five across at the default size; at the larger text
                                sizes (or on a narrow phone) the buttons wrap to a second
                                row rather than truncate their labels. */}
                            <div className="lg:hidden grid grid-cols-[repeat(auto-fit,minmax(3.9rem,1fr))] gap-1 pb-1 shrink-0">
                                {canonicalHours.map(moment => (
                                    <button
                                        key={moment.id}
                                        onClick={() => selectHour(moment.id)} aria-label={moment.label}
                                        aria-pressed={activeHour === moment.id}
                                        className={`pressable pressable-small min-w-0 flex flex-col items-center gap-1 py-2.5 px-0.5 rounded-2xl ${activeHour === moment.id
                                            ? 'bg-liturgy-100 dark:bg-liturgy-900/60 border border-liturgy-200 dark:border-liturgy-800 text-liturgy-700 dark:text-liturgy-300 shadow-sm'
                                            : 'surface text-zinc-500 dark:text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
                                            }`}
                                    >
                                        <moment.icon size={20} strokeWidth={activeHour === moment.id ? 2.4 : 1.8} aria-hidden="true" />
                                        <span className="text-[0.65rem] font-medium leading-none truncate max-w-full">{moment.shortLabel}</span>
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
                                            className={`pressable flex-1 py-1.5 px-3 text-xs font-medium rounded-lg ${activeSubHour === sub
                                                ? 'bg-liturgy-50 dark:bg-liturgy-950/30 text-liturgy-700 dark:text-liturgy-400 border border-liturgy-200 dark:border-liturgy-800'
                                                : 'bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 border border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800'
                                                }`}
                                        >
                                            {sub}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Proper or Salmodia Complementar psalmody (Defuntos' Sexta/Noa) */}
                            {altActive && complement && (
                                <div className="space-y-1.5">
                                    <div className="flex gap-2" role="group" aria-label="Salmodia">
                                        {[false, true].map(on => (
                                            <button
                                                key={String(on)}
                                                onClick={() => setUseComplement(on)}
                                                aria-pressed={useComplement === on}
                                                className={`pressable flex-1 py-1.5 px-3 text-xs font-medium rounded-lg ${useComplement === on
                                                    ? 'bg-liturgy-50 dark:bg-liturgy-950/30 text-liturgy-700 dark:text-liturgy-400 border border-liturgy-200 dark:border-liturgy-800'
                                                    : 'bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 border border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800'
                                                    }`}
                                            >
                                                {on ? `Complementar (${complement.replace('Série', 'série')})` : 'Salmodia própria'}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                        Se já rezaste outra Hora Intermédia hoje com a salmodia própria, reza esta com a complementar.
                                    </p>
                                </div>
                            )}

                            {/* Content */}
                            <div className="flex-1">
                                {altActive && assembled === undefined ? (
                                    <div className="flex flex-col items-center justify-center space-y-3 py-16">
                                        <div className="h-6 w-6 rounded-full border-4 border-zinc-200 dark:border-zinc-800 border-t-liturgy-700 dark:border-t-liturgy-400 animate-spin" />
                                        <p className="text-sm text-zinc-500 dark:text-zinc-400">A carregar o ofício...</p>
                                    </div>
                                ) : altActive && assembled && assembled.sections.length > 0 ? (
                                    <div className="space-y-6">
                                        {altEntry && (
                                            <div className="surface rounded-3xl p-4 space-y-1.5">
                                                <p className="font-bold text-zinc-900 dark:text-zinc-100">{altEntry.name}</p>
                                                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                                    {[altEntry.descriptor, altEntry.rank].filter(Boolean).join(' — ')}
                                                </p>
                                                {altEntry.bio && (
                                                    <p className="text-sm italic text-zinc-500 dark:text-zinc-400 whitespace-pre-line">{altEntry.bio}</p>
                                                )}
                                                {altEntry.commonsText && (
                                                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{altEntry.commonsText}</p>
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
                                            const renderHtml = (html: string) => <ApiHtml html={html} />;
                                            const partHtml = (title: string) => partHtmlOf(liturgy, title);
                                            const apiHtml = displayParts.map(p =>
                                                [...p.verses].sort((a, b) => a.order - b.order).map(v => v.text).join(''));
                                            const findSection = (re: RegExp) => apiHtml.map(h => apiSection(h, re)).find(Boolean) ?? null;
                                            const canticleSection = findSection(/Cântico evangélico/i);
                                            const api: ApiParts = {
                                                opening: findSection(/Invocação inicial/i),
                                                closing: findSection(/Despedida|Conclusão/i),
                                                canticle: canticleSection && canticleBody(canticleSection),
                                                paiNosso: findSection(/Oração dominical/i),
                                            };

                                            // Hora Intermédia: the hymn and psalmody are the
                                            // day's — splice the API sub-hour up to its Leitura
                                            // breve, with the saint/common antiphon substituted.
                                            // The Defuntos bring their own hymn and psalms.
                                            if (activeHour === 'intermedia' && assembled.sections[0]
                                                && !assembled.sections[0].blocks.some(b => b.kind === 'salmo')) {
                                                // The spliced psalmody already opens with the invocation.
                                                const sec = withApiParts(assembled.sections, { ...api, opening: null })[0];
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
                                                return <BreviaryBlocks sections={withApiParts(assembled.sections, api)} />;
                                            }

                                            const framed = withApiParts(assembled.sections, api);

                                            // "Salmo invitatório." in the common is a pointer to
                                            // the invitatory psalm — resolve it with the day's
                                            // Invitatório from the API, the saint's antiphon
                                            // replacing the day's.
                                            const inv = framed.find(s => s.title === 'Invitatório');
                                            const rest = framed.filter(s => s.title !== 'Invitatório');
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
                                                            {rest.length > 0 && <SkipInvitatory target={rest[0].title} onSkip={scroll.stop} />}
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
                                            <h3 className="text-sm font-bold text-liturgy-700 dark:text-liturgy-400 uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800 pb-2">
                                                {sundayCompline.title}
                                            </h3>
                                            <ApiHtml html={sundayCompline.html} />
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
                                                                className="pressable pressable-card w-full flex items-center justify-between text-sm font-bold text-liturgy-700 dark:text-liturgy-400 uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800 pb-2"
                                                            >
                                                                {part.title}
                                                                <ChevronRight className={`transition-transform ${!isCollapsed ? 'rotate-90' : ''}`} size={16} />
                                                            </button>
                                                        ) : (
                                                            <h3 className="text-sm font-bold text-liturgy-700 dark:text-liturgy-400 uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800 pb-2">
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
                                                                        [&_em]:italic
                                                                    "
                                                                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(verse.text) }}
                                                                    />
                                                                </div>
                                                            ))}
                                                            {/* Quick scroll button — sticky at the bottom */}
                                                            {part.title === 'Invitatório' && displayParts.length > 1 && (
                                                                <SkipInvitatory
                                                                    target={displayParts.find(p => p.title !== 'Invitatório')?.title}
                                                                    onSkip={scroll.stop}
                                                                />
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                        ) : (
                                            <div className="text-center p-8 surface rounded-3xl">
                                                <Clock className="mx-auto text-zinc-300 dark:text-zinc-700 mb-3" size={32} />
                                                <p className="text-zinc-500 dark:text-zinc-400">Sem conteúdo disponível para esta hora.</p>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* Completion is automatic (reaching the end of the
                                hour), recorded per Hour. This confirms this
                                one was; the count is the day streak, any Hour. */}
                            {hourPrayedToday && (
                                <div className="mt-6 mb-2">
                                    <div className="flex items-center justify-center gap-2 py-4 px-6 rounded-3xl surface surface-accent text-liturgy-700 dark:text-liturgy-300 text-sm font-semibold">
                                        <CheckCircle2 size={18} aria-hidden="true" />
                                        Rezado hoje — {streaks.liturgy_hours.days} {streaks.liturgy_hours.days === 1 ? 'dia' : 'dias'} seguidos
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 surface rounded-3xl">
                            <p className="text-zinc-500 dark:text-zinc-400 text-center">
                                Não foi possível carregar a Liturgia das Horas. Verifica a tua ligação à internet.
                            </p>
                            <button
                                onClick={() => setRetryToken(t => t + 1)}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-liturgy-700 hover:bg-liturgy-800 dark:bg-liturgy-400 dark:hover:bg-liturgy-300 text-white dark:text-zinc-950 text-sm font-semibold pressable"
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
