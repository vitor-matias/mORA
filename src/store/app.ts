import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { RosaryBeadMode } from '@/lib/rosary';
import { formatISODate } from '@/lib/format';

export interface StreakData {
    days: number;
    lastCompletedDate: string | null;
}

export type StreakItem = 'rosary' | 'liturgy' | 'liturgy_hours';

export const STREAK_ITEMS: readonly StreakItem[] = ['rosary', 'liturgy', 'liturgy_hours'];

export type Streaks = Record<StreakItem, StreakData>;

/** An in-progress rosary, so an accidental exit never loses the user's place. */
export interface RosarySession {
    date: string; // YYYY-MM-DD — sessions don't survive to the next day
    mode: RosaryBeadMode;
    step: number;
}

export function isCompletedToday(streak: StreakData): boolean {
    return streak.lastCompletedDate === formatISODate(new Date());
}

// ── Cross-device streak merging ──────────────────────────────────────────
// Every device keeps its own count and publishes a snapshot; nothing else
// knows what the others recorded, so pulling one in means reconciling two
// partial histories rather than picking a winner.

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Whole days from `a` to `b`, both YYYY-MM-DD. */
function daysApart(a: string, b: string): number {
    const diff = new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime();
    return Math.round(diff / 86400000);
}

/** A snapshot from a relay is only as trustworthy as its shape — and a device
    with a wrong clock could otherwise park a streak in the future, where no
    later prayer can ever extend it. */
function isUsableStreak(value: unknown): value is StreakData {
    if (!value || typeof value !== 'object') return false;
    const { days, lastCompletedDate } = value as StreakData;
    if (typeof days !== 'number' || !Number.isFinite(days) || days < 0) return false;
    if (lastCompletedDate === null) return true;
    if (typeof lastCompletedDate !== 'string' || !ISO_DATE_RE.test(lastCompletedDate)) return false;
    return lastCompletedDate <= formatISODate(new Date());
}

function mergeStreakEntry(local: StreakData, remote: StreakData): StreakData {
    if (!remote.lastCompletedDate) return local;
    if (!local.lastCompletedDate) return remote;
    // Same day on both: whichever counted higher already accounts for the
    // other's history.
    if (local.lastCompletedDate === remote.lastCompletedDate) {
        return local.days >= remote.days ? local : remote;
    }

    const [earlier, later] = local.lastCompletedDate < remote.lastCompletedDate
        ? [local, remote]
        : [remote, local];
    // Consecutive days on two devices are one unbroken streak: praying Monday
    // on the phone and Tuesday on the laptop is two days, but neither device
    // can see that alone. A wider gap means the streak really did break, and
    // the later device's own count is the truth.
    const consecutive = daysApart(earlier.lastCompletedDate!, later.lastCompletedDate!) === 1;
    return {
        days: consecutive ? Math.max(later.days, earlier.days + 1) : later.days,
        lastCompletedDate: later.lastCompletedDate,
    };
}

/** Folds a snapshot from another device into this one's streaks. Unusable or
    missing entries leave the local value untouched. */
export function mergeStreaks(local: Streaks, remote: unknown): Streaks {
    if (!remote || typeof remote !== 'object') return local;
    const incoming = remote as Record<string, unknown>;
    const merged = { ...local };
    for (const item of STREAK_ITEMS) {
        const entry = incoming[item];
        if (!isUsableStreak(entry)) continue;
        merged[item] = mergeStreakEntry(local[item], entry);
    }
    return merged;
}

export function streaksEqual(a: Streaks, b: Streaks): boolean {
    return STREAK_ITEMS.every((item) =>
        a[item].days === b[item].days && a[item].lastCompletedDate === b[item].lastCompletedDate);
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
    streaks: Streaks;
    incrementStreak: (item: StreakItem) => void;
    /** Replaces the whole set — used by the Nostr pull after merging. */
    setStreaks: (streaks: Streaks) => void;

    // Publishing streaks to Nostr relays is opt-in (and encrypted) — prayer
    // activity is sensitive by default.
    shareStreaks: boolean;
    setShareStreaks: (share: boolean) => void;

    // Preferences
    theme: ThemeMode;
    setTheme: (theme: ThemeMode) => void;
    notificationTime: string | null;
    setNotificationTime: (time: string | null) => void;
    /** Liturgy of the Hours reminders: canonical-hour id → "HH:MM". A missing
        key means that Hour is not being reminded. */
    hourReminders: Record<string, string>;
    setHourReminder: (hourId: string, time: string | null) => void;
    // True while this browser holds a server-registered Web Push
    // subscription; the in-app reminder timer stands down then.
    pushSubscribed: boolean;
    setPushSubscribed: (subscribed: boolean) => void;
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
            hourReminders: {},
            setHourReminder: (hourId, time) => set((state) => {
                const next = { ...state.hourReminders };
                if (time) next[hourId] = time; else delete next[hourId];
                return { hourReminders: next };
            }),
            pushSubscribed: false,
            setPushSubscribed: (pushSubscribed) => set({ pushSubscribed }),
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
            }),
            setStreaks: (streaks) => set({ streaks })
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
