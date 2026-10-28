import { Link } from "react-router-dom";
import { Check, BookOpen, Clock } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAppStore, completedDates, type StreakData } from "@/store/app";
import { useAuthStore } from "@/store/auth";
import { daysApart, formatISODate } from "@/lib/format";

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

const ITEMS = [
    { key: "liturgy", label: "Leituras da Missa", to: "/liturgia", icon: BookOpen },
    { key: "liturgy_hours", label: "Liturgia das Horas", to: "/liturgia-horas", icon: Clock },
] as const;

/** The stored count only moves when someone prays, so a streak last extended
    three days ago still reads as its old number. Today or yesterday keeps it
    alive; anything older has broken. */
function liveStreak(streak: StreakData, today: string): number {
    if (!streak.lastCompletedDate) return 0;
    return daysApart(streak.lastCompletedDate, today) <= 1 ? streak.days : 0;
}

/**
 * A Semana — this week's Mass readings and Hours, day by day, with the
 * running streak for each. The week starts on Sunday, as the liturgical one
 * (and the psalter) does. Both feed from the same streaks the Missa and Horas
 * pages record, so the Nostr sync that already carries those carries this.
 */
export default function Semana() {
    const streaks = useAppStore((s) => s.streaks);
    const shareStreaks = useAppStore((s) => s.shareStreaks);
    const signedIn = useAuthStore((s) => !!(s.login?.pubkey ?? s.lockedPubkey));

    const now = new Date();
    const today = formatISODate(now);
    const week = Array.from({ length: 7 }, (_, i) =>
        formatISODate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + i)));

    return (
        <div className="flex-1 w-full flex flex-col">
            <PageHeader title="A Semana" subtitle="Missa e Liturgia das Horas, dia a dia" backTo="/" />
            <div className="p-6 pb-8 w-full max-w-md lg:max-w-2xl mx-auto space-y-4">
                {ITEMS.map(({ key, label, to, icon: Icon }) => {
                    const streak = streaks[key];
                    const done = new Set(completedDates(streak));
                    const count = week.filter((d) => done.has(d)).length;
                    const run = liveStreak(streak, today);
                    return (
                        <section key={key} className="p-4 surface rounded-2xl">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="h-10 w-10 shrink-0 rounded-2xl icon-chip text-liturgy-700 dark:text-liturgy-300 flex items-center justify-center">
                                    <Icon size={18} strokeWidth={2.2} aria-hidden="true" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <Link to={to} className="text-base font-bold leading-tight hover:underline">{label}</Link>
                                    <p className="text-zinc-500 text-xs mt-0.5">
                                        {count} de 7 esta semana
                                    </p>
                                </div>
                                <p className="text-sm font-semibold text-liturgy-700 dark:text-liturgy-300 shrink-0">
                                    {run > 0
                                        ? <>🔥 {run} {run === 1 ? "dia seguido" : "dias seguidos"}</>
                                        : <span className="text-zinc-400 dark:text-zinc-500 font-normal">Sem sequência</span>}
                                </p>
                            </div>
                            <ol className="grid grid-cols-7 gap-1.5">
                                {week.map((date, i) => {
                                    const prayed = done.has(date);
                                    const future = date > today;
                                    return (
                                        <li key={date} className="flex flex-col items-center gap-1.5">
                                            <span className={`text-[0.7rem] ${date === today ? "font-bold text-liturgy-700 dark:text-liturgy-300" : "text-zinc-400 dark:text-zinc-500"}`} aria-hidden="true">
                                                {WEEKDAYS[i]}
                                            </span>
                                            <span
                                                className={`h-9 w-9 rounded-full flex items-center justify-center ${
                                                    prayed
                                                        ? "bg-liturgy-600 text-white"
                                                        : future
                                                            ? "border border-dashed border-zinc-200 dark:border-zinc-800"
                                                            : "border border-zinc-200 dark:border-zinc-700"
                                                } ${date === today ? "ring-2 ring-liturgy-600/40 ring-offset-2 ring-offset-transparent" : ""}`}
                                            >
                                                {prayed && <Check size={16} strokeWidth={3} aria-hidden="true" />}
                                                <span className="sr-only">
                                                    {new Date(date + "T12:00").toLocaleDateString("pt-PT", { weekday: "long", day: "numeric" })}: {prayed ? "rezado" : future ? "por vir" : "por rezar"}
                                                </span>
                                            </span>
                                        </li>
                                    );
                                })}
                            </ol>
                        </section>
                    );
                })}

                <p className="text-xs text-zinc-500 leading-relaxed text-balance">
                    {signedIn && shareStreaks
                        ? "Sincronizado entre os seus dispositivos, encriptado."
                        : <>Para ver a mesma semana noutros dispositivos, ative <Link to="/perfil" className="underline">Sincronizar entre dispositivos</Link> no Perfil{signedIn ? "" : " depois de entrar com a sua conta Nostr"}.</>}
                </p>
            </div>
        </div>
    );
}
