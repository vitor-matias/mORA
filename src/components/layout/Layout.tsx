import { Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useAppStore, CONTENT_FONT_SCALE } from "@/store/app";
import { useNotifications } from "@/lib/useNotifications";
import { useNostrSync } from "@/lib/useNostrSync";
import { fetchLiturgicalColorFromCalendar, preloadUpcomingLiturgy } from "@/lib/liturgy";
import { formatISODate } from "@/lib/format";
import { TabBar } from "./TabBar";

// Each page starts at the top — without this, the previous page's scroll
// position carries over across route changes.
function ScrollToTop() {
    const { pathname } = useLocation();
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [pathname]);
    return null;
}

export function Layout() {
    const { theme, liturgicalColor, liturgicalColorOverride, fontSize, fontFamily } = useAppStore();
    useNotifications();
    useNostrSync();

    // Fetch/parse Liturgical Color on every load (cheap — ICS is cached in localStorage)
    useEffect(() => {
        async function checkLiturgicalColor() {
            const today = new Date();
            // Local date, matching how consumers (Home) compare it
            const dateStr = formatISODate(today);
            const { setLiturgicalColor } = useAppStore.getState();
            const dayInfo = await fetchLiturgicalColorFromCalendar(today);
            if (dayInfo) {
                setLiturgicalColor(dayInfo.color, dateStr, dayInfo.dayName, dayInfo.description);
            }
        }
        checkLiturgicalColor();

        // Warm the cache for the next few days of Mass + Liturgy of the Hours
        // once the app is open. Deferred to idle time so it never competes with
        // the content the user is opening right now.
        const w = window as typeof window & {
            requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
            cancelIdleCallback?: (id: number) => void;
        };
        const kickoff = () => { preloadUpcomingLiturgy(5); };
        let cancel: () => void;
        if (w.requestIdleCallback) {
            const id = w.requestIdleCallback(kickoff, { timeout: 5000 });
            cancel = () => w.cancelIdleCallback?.(id);
        } else {
            const id = window.setTimeout(kickoff, 2000);
            cancel = () => window.clearTimeout(id);
        }
        return cancel;
    }, []);

    // Apply color theme, dark mode, font settings
    useEffect(() => {
        const mq = window.matchMedia('(prefers-color-scheme: dark)');

        // Applies the dark class + mobile system/status-bar colour. Factored out
        // so the initial run and the OS-theme listener stay consistent.
        const applyDarkMode = (isDark: boolean) => {
            document.documentElement.classList.toggle('dark', isDark);

            // Status bar matches the page background. Read --app-bg (set by the
            // .dark class we just toggled) rather than repeating the literals,
            // so the bar can't drift from the page under it.
            const appBg = getComputedStyle(document.documentElement)
                .getPropertyValue('--app-bg')
                .trim();
            const themeColor = appBg
                ? `rgb(${appBg})`
                : (isDark ? '#121212' : '#FAF9F6'); // stylesheet not applied yet
            let meta = document.querySelector('meta[name="theme-color"]');
            if (!meta) {
                meta = document.createElement('meta');
                meta.setAttribute('name', 'theme-color');
                document.head.appendChild(meta);
            }
            meta.setAttribute('content', themeColor);
        };

        const resolveIsDark = () => theme === 'dark' || (theme === 'system' && mq.matches);
        applyDarkMode(resolveIsDark());

        // When following the system, react live to OS appearance changes.
        const onSchemeChange = () => applyDarkMode(resolveIsDark());
        if (theme === 'system') {
            mq.addEventListener('change', onSchemeChange);
        }

        // A page browsing another day's liturgy may temporarily override
        // today's color (e.g. Missa on a past/future date).
        document.documentElement.setAttribute('data-theme', liturgicalColorOverride ?? liturgicalColor);

        // Font size — set as CSS variables so only content (prayer/reading)
        // areas pick it up, not the UI chrome.
        const sizeConfig = CONTENT_FONT_SCALE[fontSize] || CONTENT_FONT_SCALE.medium;
        document.documentElement.style.setProperty('--content-font-size', `${sizeConfig.size}px`);
        document.documentElement.style.setProperty('--content-line-height', String(sizeConfig.lineHeight));

        // Font family — set as CSS variable so only content areas pick it up (not UI)
        const familyMap: Record<string, string> = {
            // "Predefinido" matches the app chrome, so readings and UI are one
            // family by default. "Serifada" opts into Lora, a screen-optimised
            // reading serif loaded in index.html. (These two used to resolve to
            // the same serif, which made the setting look broken.)
            system: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            serif: '"Lora", Georgia, "Times New Roman", serif',
            sans: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        };
        document.documentElement.style.setProperty('--content-font-family', familyMap[fontFamily] || 'inherit');

        return () => {
            mq.removeEventListener('change', onSchemeChange);
        };
    }, [theme, liturgicalColor, liturgicalColorOverride, fontSize, fontFamily]);

    return (
        <div className="flex flex-col min-h-screen bg-[rgb(var(--app-bg))] text-zinc-900 dark:text-zinc-100 transition-colors duration-300">
            <ScrollToTop />
            {/* Faint backdrop wash tinted by the day's liturgical color */}
            <div aria-hidden="true" className="app-ambient" />
            {/* max-w-md on mobile/tablet; individual pages control width on lg+.
                Bottom padding clears the floating tab bar plus the device
                safe-area inset it hovers over. */}
            <main className="relative z-10 flex-1 w-full max-w-md lg:max-w-none mx-auto flex flex-col pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
                <Outlet />
            </main>
            <TabBar />
        </div>
    );
}
