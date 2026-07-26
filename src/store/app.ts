import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { RosaryBeadMode } from '@/lib/rosary';
import { formatISODate } from '@/lib/format';

interface StreakData {
    days: number;
    lastCompletedDate: string | null;
}

export type StreakItem = 'rosary' | 'liturgy' | 'liturgy_hours';

/** An in-progress rosary, so an accidental exit never loses the user's place. */
export interface RosarySession {
    date: string; // YYYY-MM-DD — sessions don't survive to the next day
    mode: RosaryBeadMode;
    step: number;
}

export function isCompletedToday(streak: StreakData): boolean {
    return streak.lastCompletedDate === formatISODate(new Date());
}

export type ThemeMode = 'system' | 'light' | 'dark';
export type FontSize = 'small' | 'medium' | 'large' | 'xlarge';
export type FontFamily = 'system' | 'serif' | 'sans';

// Autoscroll speed levels (px/s). ½ is a meditative half-pace below 1.
// Lives here (like CONTENT_FONT_SCALE) because both the Missa page and the
// Profile default-speed picker render from it.
export const SCROLL_LEVELS = [
    { label: '½', pps: 11 },
    { label: '1', pps: 22 },
    { label: '2', pps: 42 },
    { label: '3', pps: 72 },
] as const;

// Index into SCROLL_LEVELS.
export type AutoScrollSpeed = 0 | 1 | 2 | 3;

// Persisted values rehydrate from JSON unvalidated — clamp to a valid index
// so a corrupted store entry can't crash SCROLL_LEVELS lookups.
export function clampScrollLevel(value: number): AutoScrollSpeed {
    if (!Number.isInteger(value)) return 2;
    return Math.min(Math.max(value, 0), SCROLL_LEVELS.length - 1) as AutoScrollSpeed;
}

// Single source of truth for the content (prayer/reading) text scale.
// Each step pairs a reading size (px) with a line-height tuned for it.
// Consumed by Layout (applies the CSS variables) and Profile (size picker preview).
export const CONTENT_FONT_SCALE: Record<FontSize, { size: number; lineHeight: number }> = {
    small: { size: 18, lineHeight: 1.7 },
    medium: { size: 21, lineHeight: 1.65 },
    large: { size: 26, lineHeight: 1.6 },
    xlarge: { size: 32, lineHeight: 1.5 },
};

interface AppState {
    rosaryMode: RosaryBeadMode;
    setRosaryMode: (mode: RosaryBeadMode) => void;
    toggleRosaryMode: () => void;
    rosarySession: RosarySession | null;
    setRosarySession: (session: RosarySession | null) => void;
    streaks: {
        rosary: StreakData;
        liturgy: StreakData;
        liturgy_hours: StreakData;
    };
    incrementStreak: (item: StreakItem) => void;

    // Publishing streaks to Nostr relays is opt-in (and encrypted) — prayer
    // activity is sensitive by default.
    shareStreaks: boolean;
    setShareStreaks: (share: boolean) => void;

    // Preferences
    theme: ThemeMode;
    setTheme: (theme: ThemeMode) => void;
    notificationTime: string | null;
    setNotificationTime: (time: string | null) => void;
    liturgicalColor: 'verde' | 'roxo' | 'vermelho' | 'branco' | 'rosa';
    liturgicalDayName: string | null;
    liturgicalDescription: string | null;
    liturgicalColorDate: string | null;
    setLiturgicalColor: (color: 'verde' | 'roxo' | 'vermelho' | 'branco' | 'rosa', date: string, dayName: string | null, description: string | null) => void;
    // Page-level theme override while browsing another day's liturgy
    // (e.g. Missa on a past/future date). Never persisted — a stale override
    // must not outlive the page that set it.
    liturgicalColorOverride: 'verde' | 'roxo' | 'vermelho' | 'branco' | 'rosa' | null;
    setLiturgicalColorOverride: (color: 'verde' | 'roxo' | 'vermelho' | 'branco' | 'rosa' | null) => void;
    fontSize: FontSize;
    setFontSize: (size: FontSize) => void;
    fontFamily: FontFamily;
    setFontFamily: (family: FontFamily) => void;
    autoScrollSpeed: AutoScrollSpeed;
    setAutoScrollSpeed: (speed: AutoScrollSpeed) => void;
}

export const useAppStore = create<AppState>()(
    persist(
        (set) => ({
            rosaryMode: 'beginner',
            setRosaryMode: (rosaryMode) => set({ rosaryMode }),
            toggleRosaryMode: () => set((state) => ({
                rosaryMode: state.rosaryMode === 'beginner' ? 'advanced' : 'beginner'
            })),
            rosarySession: null,
            setRosarySession: (rosarySession) => set({ rosarySession }),
            shareStreaks: false,
            setShareStreaks: (shareStreaks) => set({ shareStreaks }),

            // Default preferences
            theme: 'system',
            setTheme: (theme) => set({ theme }),
            notificationTime: null,
            setNotificationTime: (notificationTime) => set({ notificationTime }),
            liturgicalColor: 'verde',
            liturgicalDayName: null,
            liturgicalDescription: null,
            liturgicalColorDate: null,
            setLiturgicalColor: (liturgicalColor, liturgicalColorDate, liturgicalDayName, liturgicalDescription) => set({ liturgicalColor, liturgicalColorDate, liturgicalDayName, liturgicalDescription }),
            liturgicalColorOverride: null,
            setLiturgicalColorOverride: (liturgicalColorOverride) => set({ liturgicalColorOverride }),
            fontSize: 'medium',
            setFontSize: (fontSize) => set({ fontSize }),
            fontFamily: 'system',
            setFontFamily: (fontFamily) => set({ fontFamily }),
            autoScrollSpeed: 2,
            setAutoScrollSpeed: (autoScrollSpeed) => set({ autoScrollSpeed }),
            streaks: {
                rosary: { days: 0, lastCompletedDate: null },
                liturgy: { days: 0, lastCompletedDate: null },
                liturgy_hours: { days: 0, lastCompletedDate: null }
            },
            incrementStreak: (item) => set((state) => {
                const userToday = formatISODate(new Date());

                const currentStreak = state.streaks[item] ?? { days: 0, lastCompletedDate: null };

                if (currentStreak.lastCompletedDate === userToday) {
                    // Already completed today, no streak increment needed.
                    return { streaks: state.streaks };
                }

                let newDays = 1;
                if (currentStreak.lastCompletedDate) {
                    const lastDate = new Date(currentStreak.lastCompletedDate);
                    const currentDate = new Date(userToday);
                    const diffTime = Math.abs(currentDate.getTime() - lastDate.getTime());
                    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

                    if (diffDays === 1) {
                        // Completed yesterday
                        newDays = currentStreak.days + 1;
                    }
                    // If diffDays > 1, Missed a day, streak resets to 1 (which is the default of newDays)
                }

                return {
                    streaks: {
                        ...state.streaks,
                        [item]: { days: newDays, lastCompletedDate: userToday }
                    }
                };
            })
        }),
        {
            name: 'mora-app-storage',
            // The override is transient page state; persisting it would leave
            // a wrong theme stuck after a hard close mid-browse.
            partialize: (state) => Object.fromEntries(
                Object.entries(state).filter(([key]) => key !== 'liturgicalColorOverride')
            ) as Omit<AppState, 'liturgicalColorOverride'>,
        }
    )
);
