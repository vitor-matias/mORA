import { useEffect, useMemo, useRef } from 'react';
import { useAppStore } from '@/store/app';
import { useTranslations } from '@/lib/i18n';
import { verifyPushSubscription } from '@/lib/push';
import { CANONICAL_HOURS } from '@/lib/hours';
import { formatISODate } from '@/lib/format';
import { writeReminderSchedule, type ReminderEntry } from '@/lib/reminderSchedule';

/**
 * Every reminder this device is set up for — the daily rosary reminder plus
 * whichever Hours the user switched on — sorted by time of day. Single source
 * of truth for both the in-app timer below and the service worker's text.
 */
export function buildReminderSchedule(
    notificationTime: string | null,
    hourReminders: Record<string, string>,
    rosaryTitle: string
): ReminderEntry[] {
    const entries: ReminderEntry[] = [];
    if (notificationTime) {
        entries.push({
            time: notificationTime,
            title: 'mORA — Hora da oração 🙏',
            body: `É hora de rezar o ${rosaryTitle}`,
        });
    }
    for (const hour of CANONICAL_HOURS) {
        const time = hourReminders[hour.id];
        if (time) {
            entries.push({
                time,
                title: 'mORA — Liturgia das Horas 🙏',
                body: `É hora de rezar ${hour.label}`,
            });
        }
    }
    return entries.sort((a, b) => a.time.localeCompare(b.time));
}

export function useNotifications() {
    const { notificationTime, hourReminders, pushSubscribed } = useAppStore();
    const t = useTranslations().home;
    // Which reminder times already fired today, so the minute tick can't
    // repeat one. Reset when the local date rolls over.
    const firedToday = useRef<{ date: string; times: Set<string> }>({ date: '', times: new Set() });

    // The persisted flag can go stale (permission revoked, subscription
    // expired outside the app) — reconcile once per app start so the
    // fallback timer below isn't left disabled with no push active.
    useEffect(() => {
        verifyPushSubscription();
    }, []);

    const schedule = useMemo(
        () => buildReminderSchedule(notificationTime, hourReminders, t.rosaryTitle),
        [notificationTime, hourReminders, t.rosaryTitle]
    );

    // Hand the schedule to the service worker even when push is active — that
    // is exactly when it is needed, to label a payload-less push.
    useEffect(() => {
        writeReminderSchedule(schedule);
    }, [schedule]);

    useEffect(() => {
        // With a server-side push subscription active this in-app timer would
        // only duplicate the notification — it exists for the unconfigured
        // (no push server) fallback.
        if (pushSubscribed || schedule.length === 0) return;

        const check = () => {
            if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
            const now = new Date();
            const today = formatISODate(now);
            if (firedToday.current.date !== today) {
                firedToday.current = { date: today, times: new Set() };
            }
            const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

            for (const entry of schedule) {
                if (entry.time !== hhmm || firedToday.current.times.has(entry.time)) continue;
                firedToday.current.times.add(entry.time);

                const options: NotificationOptions = {
                    body: entry.body,
                    icon: '/pwa-192x192.png',
                    tag: `mora-reminder-${entry.time}`,
                };
                // Prefer the service worker: a page-owned Notification is
                // dismissed with the tab on mobile.
                if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                    navigator.serviceWorker.ready.then((registration) =>
                        registration.showNotification(entry.title, options)
                    );
                } else {
                    new Notification(entry.title, options);
                }
            }
        };

        // Check every minute
        const intervalId = setInterval(check, 60000);

        // Initial check in case they just opened it exactly on time
        check();

        return () => clearInterval(intervalId);
    }, [schedule, pushSubscribed]);
}
