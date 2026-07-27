import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";

/**
 * The one sticky page header every page shares: frosted glass bar, back
 * orb, halo title — collapsing as the page scrolls. `children` render
 * full-width under the title row (e.g. the Missa section chips).
 */
export function PageHeader({
    title,
    subtitle,
    backTo = '/',
    action,
    width = 'max-w-5xl',
    children,
}: {
    title: string;
    subtitle?: ReactNode;
    backTo?: string;
    action?: ReactNode;
    /** Tailwind max-width classes matching the page's content column, so the
     *  title lines up with what's beneath it. */
    width?: string;
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

    return (
        // At rest the header sits directly on the page background. The bar
        // only appears once the page scrolls, when content needs separating
        // from the title.
        <header className={`sticky top-0 z-30 transition-all duration-300 ${
            isScrolled ? 'app-bar app-bar-scrolled py-3' : 'pt-10 pb-4 lg:pt-12 lg:pb-5'
        }`}>
            <div className={`${width} mx-auto px-6 flex items-center gap-4`}>
                <button
                    type="button"
                    aria-label="Voltar ao início"
                    onClick={() => navigate(backTo)}
                    className={`bg-zinc-100/80 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full shadow-sm transition-all shrink-0 ${
                        isScrolled ? 'p-1.5' : 'p-2'
                    }`}
                >
                    <ChevronRight className="rotate-180" size={isScrolled ? 20 : 24} />
                </button>
                <div className="min-w-0 flex-1">
                    <h1 className={`font-bold tracking-tight page-title transition-all truncate ${
                        isScrolled ? 'text-xl' : 'text-3xl'
                    }`}>
                        {title}
                    </h1>
                    {subtitle && (
                        <p className={`text-zinc-500 font-medium mt-0.5 transition-all truncate ${
                            isScrolled ? 'text-xs opacity-80' : 'text-sm'
                        }`}>
                            {subtitle}
                        </p>
                    )}
                </div>
                {action}
            </div>
            {children}
        </header>
    );
}
