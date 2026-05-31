import { Outlet } from "react-router-dom";
import { useEffect } from "react";
import { useAppStore, CONTENT_FONT_SCALE } from "@/store/app";
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
        const mq = window.matchMedia('(prefers-color-scheme: dark)');

        // Applies the dark class + mobile system/status-bar colour. Factored out
        // so the initial run and the OS-theme listener stay consistent.
        const applyDarkMode = (isDark: boolean) => {
            document.documentElement.classList.toggle('dark', isDark);

            // Status bar matches the page background: zinc-950 in dark, white in light.
            const themeColor = isDark ? '#09090b' : '#ffffff';
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

        document.documentElement.setAttribute('data-theme', liturgicalColor);

        // Font size — set as CSS variables so only content (prayer/reading)
        // areas pick it up, not the UI chrome.
        const sizeConfig = CONTENT_FONT_SCALE[fontSize] || CONTENT_FONT_SCALE.medium;
        document.documentElement.style.setProperty('--content-font-size', `${sizeConfig.size}px`);
        document.documentElement.style.setProperty('--content-line-height', String(sizeConfig.lineHeight));

        // Font family — set as CSS variable so only content areas pick it up (not UI)
        const familyMap: Record<string, string> = {
            // "Lora" is a screen-optimised reading serif loaded in index.html.
            // The "system" (Predefinido) default uses it so all users get a
            // comfortable reading experience out of the box.
            system: '"Lora", Georgia, "Times New Roman", serif',
            serif: '"Lora", Georgia, "Times New Roman", serif',
            sans: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        };
        document.documentElement.style.setProperty('--content-font-family', familyMap[fontFamily] || 'inherit');

        return () => {
            mq.removeEventListener('change', onSchemeChange);
        };
    }, [theme, liturgicalColor, fontSize, fontFamily]);

    return (
        <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors duration-300">
            {/* max-w-md on mobile/tablet; individual pages control width on lg+ */}
            <main className="flex-1 w-full max-w-md lg:max-w-none mx-auto flex flex-col">
                <Outlet />
            </main>
        </div>
    );
}
