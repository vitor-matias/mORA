import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";

/**
 * The one page header every page shares: back orb, halo title. `children`
 * render full-width under the title row (e.g. the Missa section chips). All
 * pages share the same max-w-5xl frame; content narrower than the frame
 * centers within it, it does not shrink the header.
 *
 * Below xl it is sticky, collapsing into a frosted bar as the page scrolls.
 * At xl the global top bar already provides sticky chrome, so instead of
 * stacking two bars the header stays in flow and scrolls away; once the page
 * scrolls, its compact title row merges into the top bar via the
 * #global-bar-page-slot portal target that TabBar renders.
 */
export function PageHeader({
    title,
    subtitle,
    backTo = '/',
    action,
    children,
}: {
    title: string;
    subtitle?: ReactNode;
    backTo?: string;
    action?: ReactNode;
    children?: ReactNode;
}) {
    const navigate = useNavigate();

    const [isScrolled, setIsScrolled] = useState(false);
    useEffect(() => {
        // Hysteresis: collapsing shrinks the page by ~30px, which shifts
        // scrollY back below a single threshold and re-expands (flicker).
        // The two thresholds are spaced wider than that height delta.
        const onScroll = () => setIsScrolled((prev) =>
            prev ? window.scrollY > 8 : window.scrollY > 56
        );
        onScroll(); // a restored/hash-anchored page can mount already scrolled
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const [isXl, setIsXl] = useState(
        () => window.matchMedia('(min-width: 1280px)').matches
    );
    useEffect(() => {
        const mq = window.matchMedia('(min-width: 1280px)');
        const onChange = () => setIsXl(mq.matches);
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
    }, []);

    // The top bar's portal target exists from Layout's first commit on; look
    // it up after mount because during the very first render it isn't in the
    // DOM yet.
    const [slot, setSlot] = useState<HTMLElement | null>(null);
    useEffect(() => {
        setSlot(document.getElementById('global-bar-page-slot'));
    }, []);

    // Collapse styling only applies to the sub-xl sticky variant; at xl the
    // header keeps its resting size and simply scrolls off.
    const collapsed = isScrolled && !isXl;

    return (
        <>
            {isXl && isScrolled && slot && createPortal(
                <div className="flex items-center gap-3 min-w-0 animate-in fade-in slide-in-from-bottom-1 duration-200">
                    <button
                        type="button"
                        aria-label="Voltar ao início"
                        onClick={() => navigate(backTo)}
                        className="bg-zinc-100/80 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full shadow-sm transition-all shrink-0 p-1"
                    >
                        <ChevronRight className="rotate-180" size={16} />
                    </button>
                    {/* Subtitle only — the nav's active pill already names the
                        page, and the subtitle (the liturgical day) is the
                        information worth keeping while reading. Title is the
                        fallback for pages without one. */}
                    <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400 truncate">
                        {subtitle ?? title}
                    </span>
                    {action && <div className="shrink-0">{action}</div>}
                </div>,
                slot
            )}
            {/* At rest the header sits directly on the page background. The
                sub-xl bar only appears once the page scrolls, when content
                needs separating from the title. */}
            <header className={isXl
                ? 'pt-12 pb-5'
                : `sticky top-0 z-30 transition-all duration-300 ${
                    collapsed ? 'app-bar app-bar-scrolled py-3' : 'pt-10 pb-4 lg:pt-12 lg:pb-5'
                }`
            }>
                {/* One frame for every page (matches the desktop top bar), so
                    the back orb and title never shift between routes. */}
                <div className="max-w-5xl 2xl:max-w-6xl mx-auto px-6 flex items-center gap-4">
                    <button
                        type="button"
                        aria-label="Voltar ao início"
                        onClick={() => navigate(backTo)}
                        className={`bg-zinc-100/80 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full shadow-sm transition-all shrink-0 ${
                            collapsed ? 'p-1.5' : 'p-2'
                        }`}
                    >
                        <ChevronRight className="rotate-180" size={collapsed ? 20 : 24} />
                    </button>
                    <div className="min-w-0 flex-1">
                        <h1 className={`font-bold tracking-tight page-title transition-all truncate ${
                            collapsed ? 'text-xl' : 'text-3xl'
                        }`}>
                            {title}
                        </h1>
                        {subtitle && (
                            <p className={`text-zinc-500 font-medium mt-0.5 transition-all truncate ${
                                collapsed ? 'text-xs opacity-80' : 'text-sm'
                            }`}>
                                {subtitle}
                            </p>
                        )}
                    </div>
                    {action}
                </div>
                {children}
            </header>
        </>
    );
}
