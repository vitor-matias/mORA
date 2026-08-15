import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { House, BookOpen, Clock, User } from "lucide-react";
import { Rosary } from "@/components/icons";
import { useAppStore } from "@/store/app";

const tabs = [
    { to: "/", label: "Início", icon: House, end: true },
    { to: "/liturgia", label: "Missa", icon: BookOpen, end: false },
    { to: "/liturgia-horas", label: "Horas", icon: Clock, end: false },
    { to: "/terco", label: "Terço", icon: Rosary, end: false },
    { to: "/perfil", label: "Perfil", icon: User, end: false },
];

/**
 * Main navigation, in two forms by viewport:
 *
 * Below xl — a floating bottom bar that gets out of the way while praying:
 * it slides off on sustained downward scroll (including the slow autoscroll)
 * and returns on scroll-up or near the top of the page. During an active
 * rosary session it stays hidden — the step card and Continuar deserve the
 * whole screen, and it removes the accidental-exit risk right under the big
 * button. A page can ask for the same treatment by setting `bottomBarYielded`
 * — Palavra does, while its keyboard is up.
 *
 * At xl and up — a slim sticky top bar: wordmark left, the five destinations
 * inline. Desktop navigation must stay off the bottom edge, where OS
 * taskbars can cover it (reported on KDE Plasma, whose panel may overlap a
 * maximized window). It doesn't hide on scroll: on desktop it covers no
 * content, and a mouse poses no accidental-tap risk during a rosary session.
 * Sticky, not fixed, so it reserves its own height in the page flow.
 * It shows on every route, Home included — persistent chrome that appears
 * and disappears between pages reads as broken (Home instead drops its own
 * duplicate profile shortcut on xl).
 */
export function TabBar() {
    const { pathname } = useLocation();
    const rosarySession = useAppStore((s) => s.rosarySession);
    const bottomBarYielded = useAppStore((s) => s.bottomBarYielded);
    const [hidden, setHidden] = useState(false);
    // Drives the top bar's scrolled hairline (content slides directly under
    // it on xl — there is no second bar to provide the separation).
    const [barScrolled, setBarScrolled] = useState(() => window.scrollY > 8);

    useEffect(() => {
        let lastY = window.scrollY;
        let downAcc = 0;
        let upAcc = 0;

        const onScroll = () => {
            const y = window.scrollY;
            const delta = y - lastY;
            lastY = y;
            setBarScrolled(y > 8);

            if (y < 80) {
                downAcc = upAcc = 0;
                setHidden(false);
                return;
            }
            // Accumulate per direction so both a flick and the slow
            // autoscroll (sub-pixel deltas per frame) eventually trigger,
            // while touch jitter resets the counters.
            if (delta > 0) {
                downAcc += delta;
                upAcc = 0;
                if (downAcc > 24) setHidden(true);
            } else if (delta < 0) {
                upAcc -= delta;
                downAcc = 0;
                if (upAcc > 24) setHidden(false);
            }
        };

        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    // Every route change lands at the top of a new page — start visible.
    // (State adjustment during render, per React docs, instead of an effect.)
    const [lastPath, setLastPath] = useState(pathname);
    if (pathname !== lastPath) {
        setLastPath(pathname);
        setHidden(false);
    }

    const inRosarySession = pathname === '/terco' && rosarySession !== null;
    // Palavra's on-screen keyboard is the other claimant on this strip: its
    // bottom row sits exactly where the bar floats, so the last row was both
    // clipped and a mistap away from leaving the game.
    const hide = hidden || inRosarySession || bottomBarYielded;

    return (
        <>
            <nav
                aria-label="Navegação principal"
                aria-hidden={hide}
                className={`xl:hidden fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 transition-transform duration-300 ease-out ${
                    hide ? 'translate-y-[150%]' : 'translate-y-0'
                }`}
            >
                <div className="max-w-md lg:max-w-xl mx-auto flex surface rounded-3xl px-1">
                    {tabs.map(({ to, label, icon: Icon, end }) => (
                        <NavLink
                            key={to}
                            to={to}
                            end={end}
                            tabIndex={hide ? -1 : undefined}
                            className={({ isActive }) =>
                                `flex-1 flex flex-col items-center justify-center gap-0.5 pt-2 pb-1.5 min-h-[3.5rem] text-[0.65rem] font-medium transition-colors ${
                                    isActive
                                        ? 'text-liturgy-700 dark:text-liturgy-400'
                                        : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'
                                }`
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    <Icon
                                        size={22}
                                        strokeWidth={isActive ? 2.4 : 1.8}
                                        aria-hidden="true"
                                    />
                                    <span>{label}</span>
                                </>
                            )}
                        </NavLink>
                    ))}
                </div>
            </nav>
            {/* Desktop top bar — display:none below xl keeps it out of the
                accessibility tree, so only one nav landmark is exposed. */}
            <nav
                aria-label="Navegação principal"
                className={`hidden xl:block sticky top-0 z-40 app-bar ${barScrolled ? 'app-bar-scrolled' : ''}`}
            >
                <div className="max-w-5xl 2xl:max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-6">
                    {/* Wordmark — the favicon mark, tinted by the day's
                        liturgical color like the rest of the chrome. */}
                    <NavLink to="/" end className="flex items-center gap-2.5 shrink-0">
                        <svg viewBox="0 0 64 64" className="h-7 w-7" aria-hidden="true">
                            <rect width="64" height="64" rx="14" className="fill-liturgy-600 dark:fill-liturgy-500" />
                            <path d="M32 12v40M20 26h24" stroke="#FAF9F6" strokeWidth="7" strokeLinecap="round" />
                        </svg>
                        <span className="text-lg font-bold tracking-tight page-title">mORA</span>
                    </NavLink>
                    {/* Spacer: holds the wordmark left and the nav right. It
                        was PageHeader's portal target back when the page title
                        merged in here on scroll; the header is sticky at every
                        width now, so nothing fills it. */}
                    <div className="flex-1 min-w-0" />
                    <div className="flex items-center gap-1 shrink-0">
                        {tabs.map(({ to, label, icon: Icon, end }) => (
                            <NavLink
                                key={to}
                                to={to}
                                end={end}
                                className={({ isActive }) =>
                                    `flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                                        isActive
                                            ? 'text-liturgy-700 dark:text-liturgy-300 bg-liturgy-500/10 dark:bg-liturgy-500/15'
                                            : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                                    }`
                                }
                            >
                                {({ isActive }) => (
                                    <>
                                        <Icon
                                            size={18}
                                            strokeWidth={isActive ? 2.4 : 1.8}
                                            aria-hidden="true"
                                        />
                                        {label}
                                    </>
                                )}
                            </NavLink>
                        ))}
                    </div>
                </div>
            </nav>
        </>
    );
}
