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
 * Bottom navigation that gets out of the way while praying: it slides off
 * on sustained downward scroll (including the slow autoscroll) and returns
 * on scroll-up or near the top of the page. During an active rosary session
 * it stays hidden — the step card and Continuar deserve the whole screen,
 * and it removes the accidental-exit risk right under the big button.
 */
export function TabBar() {
    const { pathname } = useLocation();
    const rosarySession = useAppStore((s) => s.rosarySession);
    const [hidden, setHidden] = useState(false);

    useEffect(() => {
        let lastY = window.scrollY;
        let downAcc = 0;
        let upAcc = 0;

        const onScroll = () => {
            const y = window.scrollY;
            const delta = y - lastY;
            lastY = y;

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
    const hide = hidden || inRosarySession;

    return (
        <nav
            aria-label="Navegação principal"
            aria-hidden={hide}
            className={`fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 transition-transform duration-300 ease-out ${
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
    );
}
