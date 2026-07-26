import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { RosaryBeadMode } from '@/lib/rosary';

interface StreakData {
    days: number;
    lastCompletedDate: string | null;
}

export type ThemeMode = 'system' | 'light' | 'dark';
export type FontSize = 'small' | 'medium' | 'large' | 'xlarge';
export type FontFamily = 'system' | 'serif' | 'sans';
export type AutoScrollSpeed = 1 | 2 | 3;

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
    toggleRosaryMode: () => void;
    streaks: {
        rosary: StreakData;
        liturgy: StreakData;
        liturgy_hours: StreakData;
    };
    incrementStreak: (item: 'rosary' | 'liturgy' | 'liturgy_hours') => void;

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
            toggleRosaryMode: () => set((state) => ({
                rosaryMode: state.rosaryMode === 'beginner' ? 'advanced' : 'beginner'
            })),

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
                const today = new Date();
                // Adjust for timezone to get local YYYY-MM-DD
                const userToday = new Date(today.getTime() - (today.getTimezoneOffset() * 60000))
                    .toISOString().split('T')[0];

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
        }
    )
);
