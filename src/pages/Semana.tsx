import { Link } from "react-router-dom";
import { Check, BookOpen, Clock } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAppStore, completedDates, emptyStreak, type StreakItem } from "@/store/app";
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

function CardHeader({ icon: Icon, label, to, count, run }: { icon: typeof Clock; label: string; to: string; count: number; run: number }) {
    return (
        <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 shrink-0 rounded-2xl icon-chip text-liturgy-700 dark:text-liturgy-300 flex items-center justify-center">
                <Icon size={18} strokeWidth={2.2} aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
                <Link to={to} className="text-base font-bold leading-tight hover:underline">{label}</Link>
                <p className="text-zinc-500 text-xs mt-0.5">{count} de 7 dias esta semana</p>
            </div>
            <p className="text-sm shrink-0"><StreakBadge run={run} /></p>
        </div>
    );
}

/**
 * Resumo da Semana — this week's Mass readings and each of the Hours, day by day,
 * with the running streaks. Everything feeds from the streaks the Missa and
 * Horas pages record, so the Nostr sync that already carries those carries
 * this.
 */
export default function Semana() {
    const streaks = useAppStore((s) => s.streaks);
    const shareStreaks = useAppStore((s) => s.shareStreaks);
    const signedIn = useAuthStore((s) => !!(s.login?.pubkey ?? s.lockedPubkey));

    const today = formatISODate(new Date());
    const week = weekDates(new Date());
    // Persisted state from before the per-hour items lacks them.
    const streak = (item: StreakItem) => streaks[item] ?? emptyStreak();
    const daysOf = (item: StreakItem) => new Set(completedDates(streak(item)));
    const inWeek = (done: Set<string>) => week.filter((d) => done.has(d)).length;

    const mass = daysOf("liturgy");
    const hours = daysOf("liturgy_hours");

    return (
        <div className="flex-1 w-full flex flex-col">
            <PageHeader title="Resumo da Semana" subtitle="Missa e Liturgia das Horas, dia a dia" backTo="/" />
            <div className="p-6 pb-8 w-full max-w-md lg:max-w-2xl mx-auto space-y-4">
                <section className="p-4 surface rounded-2xl">
                    <CardHeader icon={BookOpen} label="Leituras da Missa" to="/liturgia" count={inWeek(mass)} run={liveStreak(streak("liturgy"), today)} />
                    <WeekdayHeader week={week} today={today} />
                    <DayDots week={week} today={today} done={mass} label="Leituras da Missa" />
                </section>

                <section className="p-4 surface rounded-2xl">
                    <CardHeader icon={Clock} label="Liturgia das Horas" to="/liturgia-horas" count={inWeek(hours)} run={liveStreak(streak("liturgy_hours"), today)} />
                    <WeekdayHeader week={week} today={today} />
                    <div className="space-y-3">
                        {CANONICAL_HOURS.map((hour) => {
                            const item = `hour_${hour.id}` as StreakItem;
                            const done = daysOf(item);
                            return (
                                <div key={hour.id}>
                                    <div className="flex items-baseline justify-between gap-2 mb-1.5 text-xs">
                                        <span className="font-medium">{hour.label}</span>
                                        <span className="text-zinc-500">{inWeek(done)}/7 · <StreakBadge run={liveStreak(streak(item), today)} /></span>
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
