import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Clock, User, Lock, LockOpen, HandHeart, ArrowRight, CalendarDays, CalendarCheck, Puzzle, ExternalLink, BookMarked, Music, Book } from "lucide-react";
import { Rosary } from "@/components/icons";
import { useAppStore } from "@/store/app";
import { useAuthStore } from "@/store/auth";
import { derivePalavraStats, isFinished, usePalavraStore } from "@/store/palavra";
import { MAX_GUESSES } from "@/lib/palavra/types";
import { useTranslations } from "@/lib/i18n";
import { getGreeting, formatDisplayDate, formatISODate, formatUTCDate } from "@/lib/format";
import { getHourForTime } from "@/lib/hours";
import { getMysteryForToday, MYSTERY_LABELS } from "@/lib/rosary";
import { suggestedPrayer } from "@/lib/devotional/suggestion";
import { getDefaultMassDate } from "@/lib/liturgy";
import { fetchMonthlyIntention, getMonthlyDevotion, getWeekdayDevotion, type Intention } from "@/lib/intentions";
import { COLOR_DOTS } from "@/lib/dayInfo";

export default function Home() {
    const { liturgicalColor, liturgicalDayName, liturgicalSections, liturgicalColorDate } = useAppStore();
    const { profile, setProfile } = useAuthStore();
    const pubkey = useAuthStore((s) => s.login?.pubkey ?? s.lockedPubkey);
    const hasProtectedKey = useAuthStore((s) => Boolean(s.protectedKey));
    const isLocked = useAuthStore((s) => s.isLocked);
    const lockKey = useAuthStore((s) => s.lock);
    const t = useTranslations().home;
    const tPalavra = useTranslations().palavra;

    useEffect(() => {
        // Only a cold cache — a device that has never seen this identity's
        // profile — needs this. Once there's a cached copy, useNostrSync
        // keeps it fresh on the app's usual schedule (start, sign-in,
        // foreground), so this effect doesn't need to re-ask on every visit.
        if (!pubkey || profile) return;
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
    }, [pubkey, profile, setProfile]);

    const displayName = profile?.display_name || profile?.name || null;
    const greeting = displayName
        ? `${getGreeting().slice(0, -1)}, ${displayName}.`
        : getGreeting();

    const currentHour = getHourForTime();
    const mysteryLabel = MYSTERY_LABELS[getMysteryForToday()];
    // The Devocionário row carries the day's suggestion, which follows the
    // same weekday devotion the Intenções card shows under "Hoje".
    const devotionalSuggestion = suggestedPrayer();
    // From Saturday 16:00 the Missa page opens on Sunday's (vigil) readings
    const anticipatingSunday = formatISODate(getDefaultMassDate()) !== formatISODate(new Date());

    // The persisted day info may be yesterday's if today's calendar fetch
    // hasn't succeeded yet — only show it when it belongs to today.
    const infoIsToday = liturgicalColorDate === formatISODate(new Date());
    const todayDayName = infoIsToday ? liturgicalDayName : null;
    const todaySections = infoIsToday ? liturgicalSections : null;

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
        // One row for everything prayed on beads: the page it opens lists the
        // Rosary first, then the other chaplets.
        { path: "/coroas", label: t.chapletsTitle, context: `Hoje: Mistérios ${mysteryLabel}`, icon: Rosary },
        { path: "/devocionario", label: t.devotionalTitle, context: t.devotionalDesc(devotionalSuggestion.title), icon: BookMarked },
        { path: "/canticos", label: t.chantsTitle, context: t.chantsDesc, icon: Music },
    ];
    // An entry with an `href` leaves the app: the Bíblia is read on the
    // Capuchinhos' own site rather than carried here.
    const exploreAreas: { path: string; href?: string; label: string; context: string; icon: typeof BookOpen }[] = [
        { path: "/biblia", href: "https://biblia.capuchinhos.org/", label: "Bíblia Sagrada", context: "Tradução da Difusora Bíblica", icon: Book },
        { path: "/semana", label: "A Semana", context: "Missa e Horas rezadas, dia a dia", icon: CalendarCheck },
        { path: "/diretorio", label: "Diretório Litúrgico", context: "Festas, solenidades e tempos do ano", icon: CalendarDays },
        { path: "/palavra", label: tPalavra.title, context: palavraContext, icon: Puzzle },
    ];

    // The weekday/monthly devotions are fixed Church tradition — same every
    // year, so no fetch needed. Only the Pope's own monthly intention is live.
    const weekdayDevotion = getWeekdayDevotion();
    const monthlyDevotion = getMonthlyDevotion();
    const [monthIntention, setMonthIntention] = useState<Intention | null>(null);
    const [intentionLoading, setIntentionLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        fetchMonthlyIntention()
            .then((month) => { if (!cancelled) setMonthIntention(month); })
            .finally(() => { if (!cancelled) setIntentionLoading(false); });
        return () => { cancelled = true; };
    }, []);

    // What the day celebrates, when it is more than the weekday: the feast or
    // memorial is the card's headline, with its rank as a chip and the
    // weekday ("Quarta-feira da semana XXX") beneath. The rest of the day's
    // description lives on Missa, Horas and Diretório.
    const celebration = todaySections?.find((section) => section.kind === 'celebration');
    const todayHeadline = celebration?.text || todayDayName;
    const todayWeekday = celebration?.text && todayDayName !== celebration.text ? todayDayName : null;
    const todayRank = celebration?.rank ?? null;

    const intentions = (
        <>
            <div className="flex items-center justify-between mb-2.5">
                <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">{t.intentions}</h2>
                <HandHeart size={16} className="text-liturgy-700 dark:text-liturgy-400" aria-hidden="true" />
            </div>
            <ul className="flex-1 space-y-3">
                <li>
                    <p className="text-xs font-semibold text-liturgy-700 dark:text-liturgy-400 mb-0.5">{t.intentionToday}</p>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-snug">{weekdayDevotion}</p>
                </li>
                <li>
                    <p className="text-xs font-semibold text-liturgy-700 dark:text-liturgy-400 mb-0.5">{t.intentionThisMonth}</p>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-snug">{monthlyDevotion}</p>
                </li>
                {intentionLoading ? (
                    <li className="text-sm text-zinc-500 dark:text-zinc-400">{t.intentionPopeLoading}</li>
                ) : monthIntention ? (
                    <li>
                        <a
                            href={monthIntention.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => {
                                // A plain target="_blank" opens a tab in every modern
                                // browser — passing window features is what actually
                                // forces a separate window. Only a plain left-click is
                                // upgraded to that; modified clicks (ctrl/cmd/shift/middle)
                                // fall through to the browser's own new-tab/new-window
                                // handling instead of being overridden.
                                if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                                e.preventDefault();
                                window.open(monthIntention.sourceUrl, '_blank', 'noopener,noreferrer,width=480,height=800');
                            }}
                            className="group block"
                        >
                            <p className="text-xs font-semibold text-liturgy-700 dark:text-liturgy-400 mb-0.5">{t.intentionPope}</p>
                            <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-snug flex items-start gap-1.5">
                                <span>{monthIntention.title}</span>
                                <ExternalLink size={12} className="shrink-0 mt-1 text-zinc-500 dark:text-zinc-400 group-hover:text-liturgy-700 dark:group-hover:text-liturgy-400 transition-colors" aria-hidden="true" />
                            </p>
                        </a>
                    </li>
                ) : null}
            </ul>
        </>
    );

    // The root's top padding carries env(safe-area-inset-top): Home has no
    // PageHeader to take it, and the page draws under the status bar (see the
    // viewport meta in index.html). Not at xl, where the in-flow top bar
    // already takes the inset (as PageHeader's xl variant also leaves it).
    return (
        <div className="p-6 pt-[calc(3rem+env(safe-area-inset-top))] xl:pt-12 space-y-6 h-full relative overflow-hidden max-w-md lg:max-w-5xl 2xl:max-w-6xl mx-auto w-full">
            <header className="flex items-start justify-between relative z-10 w-full gap-4">
                <div className="flex-1">
                    <h1 className="text-3xl font-extrabold tracking-tight page-title mb-1">
                        {greeting}
                    </h1>
                    <p className="text-zinc-600 dark:text-zinc-400 text-lg">{t.whatToPray}</p>
                </div>
                {/* Shown at every width, unlike the profile link beside it:
                    the desktop top bar has no way to lock the key. */}
                {hasProtectedKey && (
                    <button
                        type="button"
                        onClick={() => {
                            if (!isLocked) return lockKey();
                            import("@/lib/nostr").then(({ unlockIfNeeded }) => unlockIfNeeded()).catch(() => {});
                        }}
                        aria-label={isLocked ? 'Desbloquear a chave' : 'Bloquear a chave'}
                        className="pressable pressable-small shrink-0 h-12 w-12 rounded-full surface flex items-center justify-center"
                    >
                        {isLocked
                            ? <Lock size={20} className="text-zinc-500 dark:text-zinc-400" aria-hidden="true" />
                            : <LockOpen size={20} className="text-liturgy-700 dark:text-liturgy-400" aria-hidden="true" />}
                    </button>
                )}
                {/* xl:hidden — the global top bar already carries Perfil, and
                    a launcher shouldn't duplicate the chrome above it. */}
                <Link
                    to="/perfil"
                    aria-label="Perfil e configurações"
                    className="pressable pressable-small xl:hidden shrink-0 h-12 w-12 rounded-full surface overflow-hidden flex items-center justify-center"
                >
                    {profile?.picture ? (
                        <img
                            src={profile.picture}
                            alt={displayName || 'Perfil'}
                            className="h-full w-full object-cover"
                        />
                    ) : (
                        <User size={22} className="text-zinc-500 dark:text-zinc-400" />
                    )}
                </Link>
            </header>

            {/* Desktop: the day and the intentions share a row */}
            <div className="space-y-6 lg:space-y-0 lg:grid lg:grid-cols-5 lg:gap-6 lg:items-stretch relative z-10">
            {/* The day: a solid card in the season's colour, 700 by day and 800
                by night like the other day cards. White text holds AA on both
                in every season (5.0:1 and up), which is why nothing here is
                tinted or translucent. */}
            <section className={`relative rounded-3xl p-5 lg:col-span-3 ${
                // Until today's calendar answers, the stored colour may be
                // yesterday's: a plain tile rather than a season the day may
                // not be (and rather than a dark slab saying nothing).
                infoIsToday ? 'on-season bg-liturgy-700 dark:bg-liturgy-800 text-white' : 'surface text-zinc-900 dark:text-white'
            }`}>
                <div>
                    <p className="text-xs font-bold uppercase tracking-widest">
                        {formatDisplayDate(new Date())}
                        {infoIsToday && <span className="sr-only"> · Cor litúrgica: {COLOR_DOTS[liturgicalColor].label}</span>}
                    </p>
                    <h2 className="mt-2 text-2xl font-extrabold leading-tight tracking-tight line-clamp-3">
                        {todayHeadline || 'A liturgia de hoje'}
                    </h2>
                    {todayWeekday && <p className="mt-1 text-sm font-medium">{todayWeekday}</p>}
                    {todayRank && (
                        <span className="mt-3 inline-block rounded-full border border-white/60 px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-widest">
                            {todayRank}
                        </span>
                    )}
                    <div className="mt-5 flex items-center justify-between gap-3">
                        <span className="text-sm min-w-0">Agora: {currentHour.label}</span>
                        <Link
                            to="/liturgia-horas"
                            className={`pressable shrink-0 inline-flex items-center gap-1.5 rounded-full px-4 min-h-[44px] text-sm font-bold ${
                                infoIsToday ? 'bg-white text-liturgy-700' : 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                            }`}
                        >
                            Rezar <ArrowRight size={15} aria-hidden="true" />
                        </Link>
                    </div>
                </div>
            </section>

            {/* Intentions: beside the day on desktop; on a phone it comes
                after the Rezar tiles (below), so the tiles sit under the day. */}
            <section className="hidden lg:flex relative z-10 surface rounded-3xl px-5 py-4 lg:col-span-2 flex-col">
                {intentions}
            </section>
            </div>

            {/* The hub, as Bento tiles: two columns on a phone, three on
                desktop. Missa is the wide feature tile, so the five Rezar
                tiles fill 2-2-2 / 3-3 with no holes; Palavra is wide only on
                the phone, to pair up the three Explorar tiles. Every tile
                carries its own state for today. */}
            <div className="relative z-10 space-y-3">
                {[
                    { title: 'Rezar', items: prayerAreas, feature: '/liturgia', wide: null },
                    { title: 'Explorar', items: exploreAreas, feature: null, wide: '/palavra' },
                ].map(({ title, items, feature, wide }) => (
                    <section key={title} className="space-y-3">
                        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 pt-2">
                            {title}
                        </h2>
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                        {items.map((area) => {
                            const href = 'href' in area ? area.href : undefined;
                            const body = (
                            <>
                                <div className="flex items-start justify-between">
                                    <div className={`shrink-0 rounded-2xl icon-chip text-liturgy-700 dark:text-liturgy-300 flex items-center justify-center ${
                                        area.path === feature ? 'h-12 w-12' : 'h-10 w-10'
                                    }`}>
                                        <area.icon size={area.path === feature ? 24 : 20} strokeWidth={2.2} aria-hidden="true" />
                                    </div>
                                    {href && <ExternalLink size={14} className="text-zinc-500 dark:text-zinc-400 shrink-0" aria-hidden="true" />}
                                </div>
                                <div className="min-w-0">
                                    <h3 className={`font-bold leading-tight ${area.path === feature ? 'text-xl lg:text-2xl tracking-tight' : 'text-base'}`}>{area.label}</h3>
                                    <p className={`text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2 ${area.path === feature ? 'text-sm' : 'text-xs'}`}>{area.context}</p>
                                </div>
                            </>
                            );
                            const className = `pressable pressable-card flex flex-col justify-between gap-4 p-4 min-h-[8rem] surface rounded-3xl ${
                                area.path === feature ? 'col-span-2' : ''
                            } ${area.path === wide ? 'col-span-2 lg:col-span-1' : ''}`;
                            return href ? (
                                <a key={area.path} href={href} target="_blank" rel="noopener noreferrer" className={className}>
                                    {body}
                                </a>
                            ) : (
                                <Link key={area.path} to={area.path} className={className}>
                                    {body}
                                </Link>
                            );
                        })}
                        </div>
                        {title === 'Rezar' && (
                            <section className="lg:hidden surface rounded-3xl px-5 py-4 flex flex-col !mt-6">
                                {intentions}
                            </section>
                        )}
                    </section>
                ))}
            </div>
        </div>
    );
}
