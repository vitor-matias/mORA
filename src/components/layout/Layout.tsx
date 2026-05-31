import { Outlet } from "react-router-dom";
import { useEffect } from "react";
import { useAppStore } from "@/store/app";
import { useNotifications } from "@/lib/useNotifications";
import { fetchLiturgicalColorFromCalendar, preloadUpcomingLiturgy } from "@/lib/liturgy";

export function Layout() {
    const { theme, liturgicalColor, fontSize, fontFamily } = useAppStore();
    useNotifications();

    // Fetch/parse Liturgical Color on every load (cheap — ICS is cached in localStorage)
    useEffect(() => {
        async function checkLiturgicalColor() {
            const today = new Date();
            const dateStr = today.toISOString().split('T')[0];
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
        const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        if (isDark) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }

        // Keep the mobile system/status bar colour in sync with the theme
        // (matches the page background: zinc-950 in dark, white in light).
        const themeColor = isDark ? '#09090b' : '#ffffff';
        let meta = document.querySelector('meta[name="theme-color"]');
        if (!meta) {
            meta = document.createElement('meta');
            meta.setAttribute('name', 'theme-color');
            document.head.appendChild(meta);
        }
        meta.setAttribute('content', themeColor);

        document.documentElement.setAttribute('data-theme', liturgicalColor);

        // Font size — set as CSS variables so only content (prayer/reading)
        // areas pick it up, not the UI chrome. Each step pairs a generous
        // reading size with a line-height tuned for that size (larger text
        // wants a slightly tighter ratio).
        const sizeMap: Record<string, { size: string; lineHeight: string }> = {
            small: { size: '18px', lineHeight: '1.7' },
            medium: { size: '21px', lineHeight: '1.65' },
            large: { size: '26px', lineHeight: '1.6' },
            xlarge: { size: '32px', lineHeight: '1.5' },
        };
        const sizeConfig = sizeMap[fontSize] || sizeMap.medium;
        document.documentElement.style.setProperty('--content-font-size', sizeConfig.size);
        document.documentElement.style.setProperty('--content-line-height', sizeConfig.lineHeight);

        // Font family — set as CSS variable so only content areas pick it up (not UI)
        const familyMap: Record<string, string> = {
            system: 'inherit',
            serif: 'Georgia, "Times New Roman", Times, serif',
            sans: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        };
        document.documentElement.style.setProperty('--content-font-family', familyMap[fontFamily] || 'inherit');
    }, [theme, liturgicalColor, fontSize, fontFamily]);

    return (
        <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors duration-300">
            <main className="flex-1 w-full max-w-md mx-auto flex flex-col">
                <Outlet />
            </main>
        </div>
    );
}
