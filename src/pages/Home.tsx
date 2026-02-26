import { useEffect } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Fingerprint, Clock, User } from "lucide-react";
import { useAppStore } from "@/store/app";
import { useAuthStore } from "@/store/auth";
import { useTranslations } from "@/lib/i18n";

export default function Home() {
    const { streaks } = useAppStore();
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

    const areas = [
        { path: "/terco", label: t.rosaryTitle, description: t.rosaryDesc, icon: Fingerprint, lightBg: "bg-liturgy-50 text-liturgy-600 dark:bg-liturgy-950/30 dark:text-liturgy-400" },
        { path: "/liturgia", label: t.liturgyTitle, description: t.liturgyDesc, icon: BookOpen, lightBg: "bg-liturgy-50 text-liturgy-600 dark:bg-liturgy-950/30 dark:text-liturgy-400" },
        { path: "/liturgia-horas", label: t.hoursTitle, description: t.hoursDesc, icon: Clock, lightBg: "bg-liturgy-50 text-liturgy-600 dark:bg-liturgy-950/30 dark:text-liturgy-400" },
    ];

    const displayName = profile?.display_name || profile?.name || null;

    return (
        <div className="p-6 pt-12 space-y-8 h-full relative overflow-hidden">
            {/* Thematic Background Gradient */}
            <div className="absolute top-0 inset-x-0 h-64 bg-gradient-to-br from-liturgy-100 to-transparent dark:from-liturgy-900/20 -z-10 mix-blend-multiply opacity-50"></div>

            <header className="flex items-start justify-between relative z-10 w-full gap-4">
                <div className="flex-1">
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white mb-2">
                        {displayName ? `Olá, ${displayName}` : t.greeting}
                    </h1>
                    {/* Liturgical Day Subtitle */}
                    <p className="text-zinc-500 text-lg">{t.whatToPray}</p>
                </div>
                <Link
                    to="/perfil"
                    className="shrink-0 h-12 w-12 rounded-full bg-zinc-100 dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 overflow-hidden flex items-center justify-center hover:border-liturgy-400 dark:hover:border-liturgy-600 transition-colors"
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

            {/* Streak Banner */}
            <section className="bg-white dark:bg-zinc-900 rounded-2xl p-5 shadow-sm border border-zinc-100 dark:border-zinc-800 flex items-center justify-between relative z-10">
                <div>
                    <h2 className="text-sm font-semibold text-zinc-500 mb-1">{t.progress}</h2>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold">{streaks.rosary.days} {t.streakDays}</span>
                        <span className="text-zinc-400 text-sm pb-1">{t.consecutively}</span>
                    </div>
                </div>
                <div className="h-12 w-12 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-500 flex items-center justify-center text-xl">
                    🔥
                </div>
            </section>

            {/* Main Navigation Grid */}
            <div className="grid grid-cols-2 gap-4">
                {areas.map((area) => (
                    <Link
                        key={area.path}
                        to={area.path}
                        className="group relative flex flex-col p-4 bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-zinc-100 dark:border-zinc-800 hover:shadow-md hover:border-zinc-200 dark:hover:border-zinc-700 transition-all active:scale-[0.98] overflow-hidden"
                    >
                        <div className={`h-10 w-10 rounded-2xl ${area.lightBg} flex items-center justify-center mb-3 transition-transform group-hover:scale-110`}>
                            <area.icon size={20} strokeWidth={2.5} />
                        </div>
                        <h3 className="text-lg font-bold mb-1 leading-tight">{area.label}</h3>
                        <p className="text-zinc-500 text-xs leading-relaxed line-clamp-2">{area.description}</p>
                    </Link>
                ))}
            </div>
        </div>
    );
}
