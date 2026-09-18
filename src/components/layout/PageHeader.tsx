import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";

// The collapsed sizes, as fractions of the resting ones: text-3xl → text-xl
// for the title, text-sm → text-xs for the subtitle, and the back orb from
// p-2 around a 24px chevron (40px) to p-1.5 around a 20px one (32px).
const TITLE_SCALE = 20 / 30;
const SUBTITLE_SCALE = 12 / 14;
const ORB_SCALE = 32 / 40;
// pb-3 — the collapsed bar's bottom padding.
const COLLAPSED_PADDING_BOTTOM = 12;
// Scroll distance over which the title collapses, when the header's own
// ride up is shorter than this (in the installed iOS app it is zero).
const MIN_COLLAPSE_DISTANCE = 48;

// Per-element transforms, written once as calc()s of --collapse (0 at rest,
// 1 collapsed) and of targets measured from the layout. Only --collapse
// changes while scrolling, and nothing it drives is a layout property except
// the two text widths, which keep a scaled-down line from truncating early.
const lerpScale = (k: number) => `(1 - var(--collapse) * ${1 - k})`;
const ORB_STYLE: CSSProperties = {
    transformOrigin: 'left top',
    transform: `translateY(calc(var(--collapse) * var(--orb-y))) scale(calc${lerpScale(ORB_SCALE)})`,
};
const TITLE_STYLE: CSSProperties = {
    transformOrigin: 'left top',
    transform: `translate(calc(var(--collapse) * var(--text-x)), calc(var(--collapse) * var(--title-y))) scale(calc${lerpScale(TITLE_SCALE)})`,
    width: `calc((100% - var(--collapse) * var(--text-x)) / ${lerpScale(TITLE_SCALE)})`,
};
const SUBTITLE_STYLE: CSSProperties = {
    transformOrigin: 'left top',
    transform: `translate(calc(var(--collapse) * var(--text-x)), calc(var(--collapse) * var(--sub-y))) scale(calc${lerpScale(SUBTITLE_SCALE)})`,
    width: `calc((100% - var(--collapse) * var(--text-x)) / ${lerpScale(SUBTITLE_SCALE)})`,
    opacity: 'calc(1 - var(--collapse) * 0.2)',
};
const ACTION_STYLE: CSSProperties = {
    transform: 'translateY(calc(var(--collapse) * var(--action-y)))',
};
const CHILDREN_STYLE: CSSProperties = {
    transform: 'translateY(calc(var(--collapse) * var(--row-shift) * -1))',
};
// The frosted layer fades in as the title collapses, and its lower edge rises
// with the row. The day's wash on it is pinned to the viewport's top edge
// (--bar-origin), so while the header rides up the gradient still lines up
// with .app-ambient behind it.
const BAR_STYLE: CSSProperties = {
    opacity: 'var(--collapse)',
    transform: 'translateY(calc(var(--collapse) * var(--bar-shift) * -1))',
    backgroundPosition: '0 var(--bar-origin)',
};

/**
 * The one page header every page shares: back orb, halo title. `children`
 * render full-width under the title row (e.g. the Missa section chips). All
 * pages share the same max-w-5xl frame; content narrower than the frame
 * centers within it, it does not shrink the header.
 *
 * Below xl it is sticky and collapses into a frosted bar as the page
 * scrolls — continuously, following the scroll offset, so it tracks the
 * finger, reverses with it, and never shifts the page (see .page-header).
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

    // Only the xl portal is switched by a threshold now. Hysteresis kept so
    // the portal copy doesn't flicker when resting right at the line.
    const [isScrolled, setIsScrolled] = useState(false);
    useEffect(() => {
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

    const headerRef = useRef<HTMLElement>(null);
    const rowRef = useRef<HTMLDivElement>(null);
    const orbRef = useRef<HTMLButtonElement>(null);
    const blockRef = useRef<HTMLDivElement>(null);
    const titleRef = useRef<HTMLHeadingElement>(null);
    const subtitleRef = useRef<HTMLParagraphElement>(null);
    const actionRef = useRef<HTMLDivElement>(null);
    // Set by measure(): the scroll distance over which --collapse runs 0 → 1,
    // and how far the frosted layer's lower edge rises over it.
    const collapseDistance = useRef(MIN_COLLAPSE_DISTANCE);
    const barShift = useRef(0);

    // Drive --collapse from the scroll offset. Scroll events arrive once per
    // frame, ahead of rendering, so writing here lands in the same frame.
    const update = useRef(() => {});
    useLayoutEffect(() => {
        if (isXl) return;
        const header = headerRef.current;
        if (!header) return;
        update.current = () => {
            const p = Math.min(1, Math.max(0, window.scrollY / collapseDistance.current));
            header.style.setProperty('--collapse', p.toFixed(4));
            // The layer's top edge, relative to the viewport's: the header's
            // own offset plus the layer's rise inside it.
            const layerTop = header.getBoundingClientRect().top - p * barShift.current;
            header.style.setProperty('--bar-origin', `${(-layerTop).toFixed(2)}px`);
        };
        const onScroll = () => update.current();
        update.current();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => {
            window.removeEventListener('scroll', onScroll);
            update.current = () => {};
        };
    }, [isXl]);

    // Measure where each piece of the row sits at rest and where it should
    // sit collapsed, and hand the differences to CSS. Layout sizes only
    // (offset*), which transforms don't touch, so this can run at any scroll
    // position. After every render — the action and subtitle come and go —
    // and whenever the header resizes (breakpoints, the chips arriving).
    useLayoutEffect(() => {
        if (isXl) return;
        const header = headerRef.current;
        const row = rowRef.current;
        const orb = orbRef.current;
        const block = blockRef.current;
        const titleEl = titleRef.current;
        if (!header || !row || !orb || !block || !titleEl) return;

        const measure = () => {
            const sub = subtitleRef.current;
            const act = actionRef.current;
            const R = row.offsetHeight;
            const O = orb.offsetHeight;
            const B = block.offsetHeight;
            const T = titleEl.offsetHeight;
            const subTop = sub ? sub.offsetTop - titleEl.offsetTop : 0;
            const S = sub?.offsetHeight ?? 0;
            const A = act?.offsetHeight ?? 0;

            const O2 = O * ORB_SCALE;
            const T2 = T * TITLE_SCALE;
            const B2 = sub ? T2 + (subTop - T) + S * SUBTITLE_SCALE : T2;
            const R2 = Math.max(O2, B2, A);
            // The row centres its items; these are their tops within it.
            const centre = (outer: number, inner: number) => (outer - inner) / 2;
            const blockTop = centre(R, B);
            const blockTop2 = centre(R2, B2);

            const style = getComputedStyle(header);
            const ride = -parseFloat(style.top) || 0;
            const paddingBottom = parseFloat(style.paddingBottom) || 0;
            const rowShift = R - R2;
            collapseDistance.current = Math.max(MIN_COLLAPSE_DISTANCE, ride);
            barShift.current = rowShift + paddingBottom - COLLAPSED_PADDING_BOTTOM;

            const px = (n: number) => `${n.toFixed(2)}px`;
            header.style.setProperty('--orb-y', px(centre(R2, O2) - centre(R, O)));
            header.style.setProperty('--text-x', px(-orb.offsetWidth * (1 - ORB_SCALE)));
            header.style.setProperty('--title-y', px(blockTop2 - blockTop));
            header.style.setProperty('--sub-y', px(blockTop2 + T2 + (subTop - T) - (blockTop + subTop)));
            header.style.setProperty('--action-y', px(centre(R2, A) - centre(R, A)));
            header.style.setProperty('--row-shift', px(rowShift));
            header.style.setProperty('--bar-shift', px(barShift.current));
            update.current();
        };

        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(header);
        observer.observe(row);
        return () => observer.disconnect();
    });

    // The top bar's portal target, looked up when it is about to be used
    // rather than held in state. It cannot be found during the first render —
    // Layout hasn't committed yet — but the portal only opens once the page
    // has scrolled, by which point it has long existed. Fetching it into state
    // from an effect meant a second render on every mount to obtain something
    // that isn't needed until much later.
    const slot = isXl && isScrolled
        ? document.getElementById('global-bar-page-slot')
        : null;

    const collapsing = !isXl;

    return (
        <>
            {isXl && isScrolled && slot && createPortal(
                <div className="flex items-center gap-3 min-w-0 animate-in fade-in slide-in-from-bottom-1 duration-200">
                    <button
                        type="button"
                        aria-label="Voltar ao início"
                        onClick={() => navigate(backTo)}
                        className="pressable pressable-small bg-zinc-100/80 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full shadow-sm shrink-0 p-1"
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
            {/* At rest the header sits directly on the page background; the
                frosted layer only fades in as the page scrolls under it.
                While the xl portal copy is up, inert takes this off-screen
                original (back orb, action) out of the tab order and
                accessibility tree — otherwise keyboard and screen-reader
                users meet every control twice. */}
            <header
                ref={headerRef}
                inert={isXl && isScrolled}
                className={collapsing ? 'page-header z-30' : 'pt-12 pb-5'}
            >
                {collapsing && (
                    <div
                        aria-hidden="true"
                        className="app-bar app-bar-scrolled absolute inset-0 -z-10"
                        style={BAR_STYLE}
                    />
                )}
                {/* One frame for every page (matches the desktop top bar), so
                    the back orb and title never shift between routes. */}
                <div
                    ref={rowRef}
                    className="pointer-events-auto max-w-5xl 2xl:max-w-6xl mx-auto px-6 flex items-center gap-4"
                >
                    <button
                        ref={orbRef}
                        type="button"
                        aria-label="Voltar ao início"
                        onClick={() => navigate(backTo)}
                        style={collapsing ? ORB_STYLE : undefined}
                        className="bg-zinc-100/80 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full shadow-sm shrink-0 p-2 transition-colors active:bg-zinc-200 dark:active:bg-zinc-700 [-webkit-tap-highlight-color:transparent]"
                    >
                        <ChevronRight className="rotate-180" size={24} />
                    </button>
                    <div ref={blockRef} className="min-w-0 flex-1">
                        <h1
                            ref={titleRef}
                            style={collapsing ? TITLE_STYLE : undefined}
                            className="text-3xl font-bold tracking-tight page-title truncate"
                        >
                            {title}
                        </h1>
                        {subtitle && (
                            <p
                                ref={subtitleRef}
                                style={collapsing ? SUBTITLE_STYLE : undefined}
                                className="text-sm text-zinc-500 font-medium mt-0.5 truncate"
                            >
                                {subtitle}
                            </p>
                        )}
                    </div>
                    {action && (
                        <div
                            ref={actionRef}
                            style={collapsing ? ACTION_STYLE : undefined}
                            className="shrink-0"
                        >
                            {action}
                        </div>
                    )}
                </div>
                {children && (
                    <div
                        className="pointer-events-auto"
                        style={collapsing ? CHILDREN_STYLE : undefined}
                    >
                        {children}
                    </div>
                )}
            </header>
        </>
    );
}
