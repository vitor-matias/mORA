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
