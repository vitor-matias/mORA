import { useEffect } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Cross, Clock, User, Flame, ChevronRight, ArrowRight, CalendarDays } from "lucide-react";
import { useAppStore } from "@/store/app";
import { useAuthStore } from "@/store/auth";
import { useTranslations } from "@/lib/i18n";
import { getGreeting, formatDisplayDate, formatISODate } from "@/lib/format";
import { getHourForTime } from "@/lib/hours";
import { getMysteryForToday, MYSTERY_LABELS } from "@/lib/rosary";
import { getDefaultMassDate } from "@/lib/liturgy";

const COLOR_LABELS: Record<string, string> = {
    verde: 'Verde',
    roxo: 'Roxo',
    vermelho: 'Vermelho',
    branco: 'Branco',
    rosa: 'Rosa',
};

export default function Home() {
    const { streaks, liturgicalColor, liturgicalDayName, liturgicalColorDate } = useAppStore();
    const { pubkey, profile, setProfile } = useAuthStore();
    const t = useTranslations().home;

    useEffect(() => {
        if (pubkey && !profile) {
            import("@/lib/nostr").then(({ fetchNostrProfile }) => {
                fetchNostrProfile(pubkey).then(p => {
                    if (p) setProfile(p);
                });
            });
        }
    }, [pubkey, profile, setProfile]);

    const displayName = profile?.display_name || profile?.name || null;
    const greeting = displayName
        ? `${getGreeting().slice(0, -1)}, ${displayName}.`
        : getGreeting();

    const currentHour = getHourForTime();
    const mysteryLabel = MYSTERY_LABELS[getMysteryForToday()];
    // From Saturday 16:00 the Missa page opens on Sunday's (vigil) readings
    const anticipatingSunday = formatISODate(getDefaultMassDate()) !== formatISODate(new Date());

    // The persisted day name may be yesterday's if today's calendar fetch
    // hasn't succeeded yet — only show it when it belongs to today.
    const todayDayName = liturgicalColorDate === formatISODate(new Date()) ? liturgicalDayName : null;

    const areas = [
        { path: "/terco", label: t.rosaryTitle, context: `Hoje: Mistérios ${mysteryLabel}`, icon: Cross },
        { path: "/liturgia", label: t.liturgyTitle, context: anticipatingSunday ? "As leituras da missa de domingo" : "As leituras da missa de hoje", icon: BookOpen },
        { path: "/liturgia-horas", label: t.hoursTitle, context: `Agora: ${currentHour.label}`, icon: Clock },
        { path: "/diretorio", label: "Diretório Litúrgico", context: "Festas, solenidades e tempos do ano", icon: CalendarDays },
    ];

    const streakItems = [
        { label: 'Terço', days: streaks.rosary.days },
        { label: 'Missa', days: streaks.liturgy.days },
        { label: 'Horas', days: streaks.liturgy_hours.days },
    ];
    const hasAnyStreak = streakItems.some(s => s.days > 0);

    return (
        <div className="p-6 pt-12 space-y-6 h-full relative overflow-hidden max-w-md lg:max-w-xl mx-auto w-full">
            {/* Thematic Background Gradient */}
            <div className="absolute top-0 inset-x-0 h-64 bg-gradient-to-br from-liturgy-100 to-transparent dark:from-liturgy-900/20 -z-10 mix-blend-multiply opacity-50"></div>

            <header className="flex items-start justify-between relative z-10 w-full gap-4">
                <div className="flex-1">
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white mb-2">
                        {greeting}
                    </h1>
                    <p className="text-zinc-500 text-lg">{t.whatToPray}</p>
                </div>
                <Link
                    to="/perfil"
                    aria-label="Perfil e configurações"
                    className="shrink-0 h-12 w-12 rounded-full bg-white dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 overflow-hidden flex items-center justify-center hover:border-liturgy-400 dark:hover:border-liturgy-600 transition-colors"
                >
                    {profile?.picture ? (
                        <img
                            src={profile.picture}
                            alt={displayName || 'Perfil'}
                            className="h-full w-full object-cover"
                        />
                    ) : (
                        <User size={22} className="text-zinc-400" />
                    )}
                </Link>
            </header>

            {/* Liturgical day hero */}
            <section className="relative z-10 bg-liturgy-50 dark:bg-liturgy-950/20 border border-liturgy-100 dark:border-liturgy-900/50 rounded-3xl p-5">
                <p className="text-xs font-bold uppercase tracking-widest text-liturgy-600 dark:text-liturgy-400 mb-1.5">
                    {formatDisplayDate(new Date())}
                </p>
                <h2
                    className="text-lg font-semibold leading-snug text-liturgy-900 dark:text-liturgy-100 line-clamp-2"
                    style={{ fontFamily: 'var(--content-font-family, inherit)' }}
                >
                    {todayDayName || 'A liturgia de hoje'}
                </h2>
                <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-liturgy-800 dark:text-liturgy-300">
                        <span className="h-2.5 w-2.5 rounded-full bg-liturgy-500 ring-2 ring-liturgy-200 dark:ring-liturgy-900" aria-hidden="true" />
                        Cor litúrgica: {COLOR_LABELS[liturgicalColor] || 'Verde'}
                    </span>
                    <Link
                        to="/liturgia-horas"
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-white dark:text-zinc-950 bg-liturgy-700 hover:bg-liturgy-800 dark:bg-liturgy-400 dark:hover:bg-liturgy-300 rounded-xl px-3.5 py-2 transition-colors active:scale-[0.97]"
                    >
                        Rezar agora <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                </div>
            </section>

            {/* Streaks */}
            <section className="relative z-10 bg-white dark:bg-zinc-900 rounded-2xl px-5 py-4 shadow-sm border border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center justify-between mb-2.5">
                    <h2 className="text-sm font-semibold text-zinc-500">{t.progress}</h2>
                    <Flame size={16} className="text-orange-500" aria-hidden="true" />
                </div>
                {hasAnyStreak ? (
                    <div className="grid grid-cols-3 divide-x divide-zinc-100 dark:divide-zinc-800">
                        {streakItems.map(({ label, days }) => (
                            <div key={label} className="text-center first:text-left last:text-right px-1">
                                <p className="text-xl font-bold leading-tight">
                                    {days}<span className="text-xs font-medium text-zinc-400 ml-1">{days === 1 ? 'dia' : 'dias'}</span>
                                </p>
                                <p className="text-xs text-zinc-500">{label}</p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-zinc-500">
                        Comece hoje — cada oração concluída conta um dia.
                    </p>
                )}
            </section>

            {/* Main navigation */}
            <div className="relative z-10 space-y-3">
                {areas.map((area) => (
                    <Link
                        key={area.path}
                        to={area.path}
                        className="group flex items-center gap-4 p-4 bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-800 hover:shadow-md hover:border-zinc-200 dark:hover:border-zinc-700 transition-all active:scale-[0.99]"
                    >
                        <div className="h-11 w-11 shrink-0 rounded-2xl bg-liturgy-50 text-liturgy-600 dark:bg-liturgy-950/30 dark:text-liturgy-400 flex items-center justify-center transition-transform group-hover:scale-110">
                            <area.icon size={20} strokeWidth={2.2} aria-hidden="true" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-base font-bold leading-tight">{area.label}</h3>
                            <p className="text-zinc-500 text-xs mt-0.5 truncate">{area.context}</p>
                        </div>
                        <ChevronRight size={18} className="text-zinc-300 dark:text-zinc-600 shrink-0" aria-hidden="true" />
                    </Link>
                ))}
            </div>
        </div>
    );
}
