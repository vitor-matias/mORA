import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, BookOpen, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAppStore, completedDates, emptyStreak, STREAK_ITEMS, type StreakItem } from "@/store/app";
import { useAuthStore } from "@/store/auth";
import { CANONICAL_HOURS } from "@/lib/hours";
import { formatISODate } from "@/lib/format";
import { liveStreak, weekDates } from "@/lib/week";

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

function StreakBadge({ run }: { run: number }) {
    return run > 0
        ? <span className="text-liturgy-700 dark:text-liturgy-300 font-semibold">🔥 {run} {run === 1 ? "dia seguido" : "dias seguidos"}</span>
        : <span className="text-zinc-400 dark:text-zinc-500">Sem sequência</span>;
}

function DayDots({ week, today, done, label, size = "h-9 w-9" }: { week: string[]; today: string; done: Set<string>; label: string; size?: string }) {
    return (
        <ol className="grid grid-cols-7 gap-1.5">
            {week.map((date) => {
                const prayed = done.has(date);
                const future = date > today;
                return (
                    <li key={date} className="flex justify-center">
                        <span
                            className={`${size} rounded-full flex items-center justify-center ${
                                prayed
                                    ? "bg-liturgy-600 text-white"
                                    : future
                                        ? "border border-dashed border-zinc-200 dark:border-zinc-800"
                                        : "border border-zinc-200 dark:border-zinc-700"
                            } ${date === today ? "ring-2 ring-liturgy-600/40 ring-offset-2 ring-offset-transparent" : ""}`}
                        >
                            {prayed && <Check size={14} strokeWidth={3} aria-hidden="true" />}
                            <span className="sr-only">
                                {label}, {new Date(date + "T12:00").toLocaleDateString("pt-PT", { weekday: "long", day: "numeric" })}: {prayed ? "rezado" : future ? "por vir" : "por rezar"}
                            </span>
                        </span>
                    </li>
                );
            })}
        </ol>
    );
}

function WeekdayHeader({ week, today }: { week: string[]; today: string }) {
    return (
        <div className="grid grid-cols-7 gap-1.5 mb-1.5" aria-hidden="true">
            {week.map((date, i) => (
                <span key={date} className={`text-center text-[0.7rem] ${date === today ? "font-bold text-liturgy-700 dark:text-liturgy-300" : "text-zinc-400 dark:text-zinc-500"}`}>
                    {WEEKDAYS[i]}
                </span>
            ))}
        </div>
    );
}

/** "Esta semana", "Semana passada", or the span: "11 – 17 out." */
function weekLabel(week: string[], offset: number): string {
    if (offset === 0) return "Esta semana";
    if (offset === -1) return "Semana passada";
    const day = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(iso + "T12:00").toLocaleDateString("pt-PT", opts);
    return `${day(week[0], { day: "numeric" })} – ${day(week[6], { day: "numeric", month: "short" })}`;
}

function WeekNav({ label, onPrev, onNext, canPrev, canNext }: { label: string; onPrev: () => void; onNext: () => void; canPrev: boolean; canNext: boolean }) {
    const button = "pressable pressable-small p-2.5 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none";
    return (
        <div className="flex items-center justify-between gap-1 surface rounded-xl px-1 py-1">
            <button type="button" onClick={onPrev} disabled={!canPrev} aria-label="Semana anterior" className={button}>
                <ChevronLeft size={18} />
            </button>
            <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-200" aria-live="polite">{label}</span>
            <button type="button" onClick={onNext} disabled={!canNext} aria-label="Semana seguinte" className={button}>
                <ChevronRight size={18} />
            </button>
        </div>
    );
}

function CardHeader({ icon: Icon, label, to, count, run }: { icon: typeof Clock; label: string; to: string; count: number; run: number | null }) {
    return (
        <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 shrink-0 rounded-2xl icon-chip text-liturgy-700 dark:text-liturgy-300 flex items-center justify-center">
                <Icon size={18} strokeWidth={2.2} aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
                <Link to={to} className="text-base font-bold leading-tight hover:underline">{label}</Link>
                <p className="text-zinc-500 text-xs mt-0.5">{count} de 7 dias</p>
            </div>
            {run !== null && <p className="text-sm shrink-0"><StreakBadge run={run} /></p>}
        </div>
    );
}

/**
 * Resumo da Semana (titled "A Semana", which fits a phone header) — this week's Mass readings and each of the Hours, day by day,
 * with the running streaks. Everything feeds from the streaks the Missa and
 * Horas pages record, so the Nostr sync that already carries those carries
 * this.
 */
export default function Semana() {
    const streaks = useAppStore((s) => s.streaks);
    const shareStreaks = useAppStore((s) => s.shareStreaks);
    const signedIn = useAuthStore((s) => !!(s.login?.pubkey ?? s.lockedPubkey));

    // 0 is this week, -1 last week, and so on.
    const [offset, setOffset] = useState(0);
    const now = new Date();
    const today = formatISODate(now);
    const week = weekDates(new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset * 7));
    // Persisted state from before the per-hour items lacks them.
    const streak = (item: StreakItem) => streaks[item] ?? emptyStreak();
    const daysOf = (item: StreakItem) => new Set(completedDates(streak(item)));
    const inWeek = (done: Set<string>) => week.filter((d) => done.has(d)).length;
    // Back as far as the oldest day anything was prayed; before that every week is empty.
    const oldest = STREAK_ITEMS.map((item) => completedDates(streak(item))[0]).filter(Boolean).sort()[0];
    const canPrev = !!oldest && oldest < week[0];
    // A streak is about today, so it only shows on this week.
    const live = (item: StreakItem) => offset === 0 ? liveStreak(streak(item), today) : null;

    const mass = daysOf("liturgy");
    const hours = daysOf("liturgy_hours");

    return (
        <div className="flex-1 w-full flex flex-col">
            <PageHeader title="A Semana" subtitle="Missa e Liturgia das Horas, dia a dia" backTo="/" />
            <div className="p-6 pb-8 w-full max-w-md lg:max-w-2xl mx-auto space-y-4">
                <WeekNav label={weekLabel(week, offset)} onPrev={() => setOffset(offset - 1)} onNext={() => setOffset(offset + 1)} canPrev={canPrev} canNext={offset < 0} />
                <section className="p-4 surface rounded-2xl">
                    <CardHeader icon={BookOpen} label="Leituras da Missa" to="/liturgia" count={inWeek(mass)} run={live("liturgy")} />
                    <WeekdayHeader week={week} today={today} />
                    <DayDots week={week} today={today} done={mass} label="Leituras da Missa" />
                </section>

                <section className="p-4 surface rounded-2xl">
                    <CardHeader icon={Clock} label="Liturgia das Horas" to="/liturgia-horas" count={inWeek(hours)} run={live("liturgy_hours")} />
                    <WeekdayHeader week={week} today={today} />
                    <div className="space-y-3">
                        {CANONICAL_HOURS.map((hour) => {
                            const item = `hour_${hour.id}` as StreakItem;
                            const done = daysOf(item);
                            return (
                                <div key={hour.id}>
                                    <div className="flex items-baseline justify-between gap-2 mb-1.5 text-xs">
                                        <span className="font-medium">{hour.label}</span>
                                        <span className="text-zinc-500">{inWeek(done)}/7{live(item) !== null && <> · <StreakBadge run={live(item)!} /></>}</span>
                                    </div>
                                    <DayDots week={week} today={today} done={done} label={hour.label} size="h-7 w-7" />
                                </div>
                            );
                        })}
                    </div>
                </section>

                <p className="text-xs text-zinc-500 leading-relaxed text-balance">
                    {signedIn && shareStreaks
                        ? "Sincronizado entre os seus dispositivos, encriptado."
                        : <>Para ver a mesma semana noutros dispositivos, ative <Link to="/perfil" className="underline">Sincronizar entre dispositivos</Link> no Perfil{signedIn ? "" : " depois de entrar com a sua conta Nostr"}.</>}
                </p>
            </div>
        </div>
    );
}
