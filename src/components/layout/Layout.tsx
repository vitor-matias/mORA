import { Outlet } from "react-router-dom";
import { useEffect } from "react";
import { useAppStore } from "@/store/app";
import { useNotifications } from "@/lib/useNotifications";
import { fetchLiturgicalColorFromCalendar } from "@/lib/liturgy";

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
    }, []);

    // Apply color theme, dark mode, font settings
    useEffect(() => {
        const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        if (isDark) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }

        document.documentElement.setAttribute('data-theme', liturgicalColor);

        // Font size — set as CSS variable so only content areas pick it up (not UI)
        const sizeMap: Record<string, string> = { small: '14px', medium: '16px', large: '18px', xlarge: '20px' };
        document.documentElement.style.setProperty('--content-font-size', sizeMap[fontSize] || '16px');

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
