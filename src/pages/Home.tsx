import { useEffect } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Clock, User, Flame, ChevronRight, ArrowRight, CalendarDays, Puzzle } from "lucide-react";
import { Rosary } from "@/components/icons";
import { useAppStore } from "@/store/app";
import { useAuthStore } from "@/store/auth";
import { derivePalavraStats, isFinished, usePalavraStore } from "@/store/palavra";
import { MAX_GUESSES } from "@/lib/palavra/types";
import { useTranslations } from "@/lib/i18n";
import { getGreeting, formatDisplayDate, formatISODate, formatUTCDate } from "@/lib/format";
import { getHourForTime } from "@/lib/hours";
import { getMysteryForToday, MYSTERY_LABELS } from "@/lib/rosary";
import { getDefaultMassDate } from "@/lib/liturgy";
import { DayDescription, LiturgicalColorDot } from "@/components/DayInfo";
import { stripReadingLines } from "@/lib/dayInfo";

export default function Home() {
    const { streaks, liturgicalColor, liturgicalDayName, liturgicalDescription, liturgicalColorDate } = useAppStore();
    const { profile, setProfile } = useAuthStore();
    const pubkey = useAuthStore((s) => s.login?.pubkey ?? s.lockedPubkey);
    const t = useTranslations().home;
    const tPalavra = useTranslations().palavra;

    useEffect(() => {
        // Always re-asks the relays, rather than trusting a cached profile:
        // this is where the app first shows the avatar and name, and the
        // only way it notices an edit made from another Nostr client.
        if (!pubkey) return;
        let cancelled = false;
        import("@/lib/nostr").then(({ fetchNostrProfile }) => {
            fetchNostrProfile(pubkey).then(p => {
                // A relay round-trip outlasts a sign-out: without this, the
                // answer for whoever was signed in when it was asked lands on
                // whoever is signed in when it returns, and the greeting and
                // avatar show someone else's name.
                if (!cancelled && p) setProfile(p);
            });
        });
        return () => { cancelled = true; };
    }, [pubkey, setProfile]);

    const displayName = profile?.display_name || profile?.name || null;
    const greeting = displayName
        ? `${getGreeting().slice(0, -1)}, ${displayName}.`
        : getGreeting();

    const currentHour = getHourForTime();
    const mysteryLabel = MYSTERY_LABELS[getMysteryForToday()];
    // From Saturday 16:00 the Missa page opens on Sunday's (vigil) readings
    const anticipatingSunday = formatISODate(getDefaultMassDate()) !== formatISODate(new Date());

    // The persisted day info may be yesterday's if today's calendar fetch
    // hasn't succeeded yet — only show it when it belongs to today.
    const infoIsToday = liturgicalColorDate === formatISODate(new Date());
    const todayDayName = infoIsToday ? liturgicalDayName : null;
    // Without the readings list: this card says what day it is, and the
    // references belong on the Missa page where they're actually read.
    const todayDescription = infoIsToday && liturgicalDescription
        ? stripReadingLines(liturgicalDescription)
        : null;

    // The Palavra row carries its own state, the way the prayer rows carry
    // today's mystery and the current Hour — a daily game nobody is reminded
    // about doesn't build a streak.
    const palavraPlays = usePalavraStore((s) => s.plays);
    const palavraContext = (() => {
        const todayPlay = palavraPlays[formatUTCDate(new Date())];
        const { currentStreak } = derivePalavraStats(palavraPlays);
        const streakSuffix = currentStreak > 0 ? tPalavra.homeStreak(currentStreak) : '';
        if (!todayPlay || !isFinished(todayPlay)) {
            return `${tPalavra.homeIdle}${streakSuffix}`;
        }
        return todayPlay.solved
            ? `${tPalavra.homeSolved(todayPlay.guesses.length, MAX_GUESSES)}${streakSuffix}`
            : tPalavra.homeLost;
    })();

    // Two-tier hub: "Rezar" is the daily practice, "Explorar" hosts every
    // secondary feature — new ones join this list instead of a new tab.
    const prayerAreas = [
        { path: "/liturgia", label: t.liturgyTitle, context: anticipatingSunday ? "As leituras da missa de domingo" : "As leituras da missa de hoje", icon: BookOpen },
        { path: "/liturgia-horas", label: t.hoursTitle, context: `Agora: ${currentHour.label}`, icon: Clock },
        { path: "/terco", label: t.rosaryTitle, context: `Hoje: Mistérios ${mysteryLabel}`, icon: Rosary },
    ];
    const exploreAreas = [
        { path: "/diretorio", label: "Diretório Litúrgico", context: "Festas, solenidades e tempos do ano", icon: CalendarDays },
        { path: "/palavra", label: tPalavra.title, context: palavraContext, icon: Puzzle },
    ];

    const streakItems = [
        { label: 'Terço', days: streaks.rosary.days },
        { label: 'Missa', days: streaks.liturgy.days },
        { label: 'Horas', days: streaks.liturgy_hours.days },
    ];
    const hasAnyStreak = streakItems.some(s => s.days > 0);

    return (
        <div className="p-6 pt-12 space-y-6 h-full relative overflow-hidden max-w-md lg:max-w-5xl 2xl:max-w-6xl mx-auto w-full">
            <header className="flex items-start justify-between relative z-10 w-full gap-4">
                <div className="flex-1">
                    <h1 className="text-3xl font-bold tracking-tight page-title mb-2">
                        {greeting}
                    </h1>
                    <p className="text-zinc-500 text-lg">{t.whatToPray}</p>
                </div>
                {/* xl:hidden — the global top bar already carries Perfil, and
                    a launcher shouldn't duplicate the chrome above it. */}
                <Link
                    to="/perfil"
                    aria-label="Perfil e configurações"
                    className="xl:hidden shrink-0 h-12 w-12 rounded-full bg-white dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 overflow-hidden flex items-center justify-center hover:border-liturgy-400 dark:hover:border-liturgy-600 transition-colors"
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

            {/* Desktop: hero and progress share a row */}
            <div className="space-y-6 lg:space-y-0 lg:grid lg:grid-cols-5 lg:gap-6 lg:items-stretch relative z-10">
            {/* Liturgical day hero */}
            <section className="relative z-10 surface surface-accent rounded-3xl p-5 lg:col-span-3">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-liturgy-600 dark:text-liturgy-400 mb-1.5">
                    {/* The dot is the color signal; its name is already in the
                        description text, so no "Cor litúrgica" line here. */}
                    {infoIsToday && <LiturgicalColorDot color={liturgicalColor} />}
                    {formatDisplayDate(new Date())}
                </p>
                <h2 className="text-lg font-semibold leading-snug text-liturgy-900 dark:text-liturgy-100 line-clamp-2">
                    {todayDayName || 'A liturgia de hoje'}
                </h2>
                {todayDescription && <DayDescription text={todayDescription} className="mt-2" />}
                {/* Full-width footer CTA — since the color label moved into
                    the title dot, a lone right-aligned pill floated oddly. */}
                <Link
                    to="/liturgia-horas"
                    className="mt-4 flex items-center justify-center gap-1.5 text-sm font-semibold cta-primary rounded-xl px-3.5 py-2.5 transition-colors active:scale-[0.98]"
                >
                    Rezar agora <ArrowRight size={15} aria-hidden="true" />
                </Link>
            </section>

            {/* Streaks */}
            <section className="relative z-10 surface rounded-2xl px-5 py-4 lg:col-span-2 lg:rounded-3xl">
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
            </div>

            {/* Main navigation */}
            <div className="relative z-10 space-y-3">
                {[
                    { title: 'Rezar', items: prayerAreas },
                    { title: 'Explorar', items: exploreAreas },
                ].map(({ title, items }) => (
                    <section key={title} className="space-y-3">
                        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 pt-2">
                            {title}
                        </h2>
                        {/* Desktop: tiles across the frame instead of a
                            phone-style stack of full-width rows. */}
                        <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-4">
                        {items.map((area) => (
                            <Link
                                key={area.path}
                                to={area.path}
                                className="group flex items-center gap-4 p-4 surface rounded-2xl transition-all active:scale-[0.99]"
                            >
                                <div className="h-11 w-11 shrink-0 rounded-2xl icon-chip text-liturgy-700 dark:text-liturgy-300 flex items-center justify-center transition-transform group-hover:scale-110">
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
                    </section>
                ))}
            </div>
        </div>
    );
}
