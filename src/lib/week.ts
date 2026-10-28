// The prayed week, shared by Resumo da Semana and the Saturday-night summary.
import { completedDates, emptyStreak, type StreakData, type StreakItem, type Streaks } from '@/store/app';
import { CANONICAL_HOURS } from '@/lib/hours';
import { daysApart, formatISODate } from '@/lib/format';

/** When the weekly summary goes out: Saturday night, after Completas. */
export const WEEKLY_SUMMARY = { weekday: 6, time: '22:00' } as const;

/** The stored count only moves when someone prays, so a streak last extended
    three days ago still reads as its old number. Today or yesterday keeps it
    alive; anything older has broken. */
export function liveStreak(streak: StreakData, today: string): number {
    if (!streak.lastCompletedDate) return 0;
    return daysApart(streak.lastCompletedDate, today) <= 1 ? streak.days : 0;
}

/** Sunday to Saturday around `now`, as the liturgical week (and the psalter) runs. */
export function weekDates(now: Date): string[] {
    return Array.from({ length: 7 }, (_, i) =>
        formatISODate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + i)));
}

/** Days of `now`'s week that `item` was prayed. */
export function daysThisWeek(streaks: Streaks, item: StreakItem, now: Date): number {
    const done = new Set(completedDates(streaks[item] ?? emptyStreak()));
    return weekDates(now).filter((d) => done.has(d)).length;
}

/** One line for the notification: the Mass, the Hours, and which Hours. */
export function weekSummary(streaks: Streaks, now: Date): string {
    const mass = daysThisWeek(streaks, 'liturgy', now);
    const hours = daysThisWeek(streaks, 'liturgy_hours', now);
    const perHour = CANONICAL_HOURS
        .map((h) => [h.label, daysThisWeek(streaks, `hour_${h.id}` as StreakItem, now)] as const)
        .filter(([, n]) => n > 0)
        .map(([label, n]) => `${label} ${n}`);
    const run = liveStreak(streaks.liturgy_hours ?? emptyStreak(), formatISODate(now));
    return [
        `Missa: ${mass} de 7 dias.`,
        `Horas: ${hours} de 7 dias${perHour.length ? ` (${perHour.join(', ')})` : ''}.`,
        run > 1 ? `🔥 ${run} dias seguidos.` : '',
    ].filter(Boolean).join(' ');
}
