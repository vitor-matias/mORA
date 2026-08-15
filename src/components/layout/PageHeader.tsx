import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";

/**
 * The one page header every page shares: back orb, halo title. `children`
 * render full-width under the title row (e.g. the Missa section chips). All
 * pages share the same max-w-5xl frame; content narrower than the frame
 * centers within it, it does not shrink the header.
 *
 * Sticky at every width, collapsing into a frosted bar as the page scrolls.
 * At xl it used to stay in flow and scroll away instead, on the grounds that
 * the global top bar already supplies sticky chrome and two bars should not
 * stack; the page title was dropped and only the subtitle merged into the top
 * bar. But desktop is where the vertical room is least scarce, and losing the
 * title there is what nobody expects — so it now behaves as it does everywhere
 * else, and the top-bar slot is left to whatever else wants it.
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

    const collapsed = isScrolled;

    return (
        <>
            {/* At rest the header sits directly on the page background; the bar
                appears once the page scrolls, when the content needs separating
                from the title. */}
            {/* xl:top-14 clears the global top bar, which is h-14 and sticky at
                top-0 there; below xl that bar is absent (the tab bar sits at the
                foot instead) and the header takes the top itself. */}
            <header className={`sticky top-0 xl:top-14 z-30 transition-all duration-300 ${
                collapsed ? 'app-bar app-bar-scrolled py-3' : 'pt-10 pb-4 lg:pt-12 lg:pb-5'
            }`}>
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
