import { useEffect, useMemo, useRef } from 'react';
import { useAppStore } from '@/store/app';
import { useTranslations } from '@/lib/i18n';
import { verifyPushSubscription } from '@/lib/push';
import { CANONICAL_HOURS } from '@/lib/hours';
import { formatISODate, joinWithE } from '@/lib/format';
import { writeReminderSchedule, DELIVERY_WINDOW_MIN, type ReminderEntry } from '@/lib/reminderSchedule';

/**
 * Every reminder this device is set up for — the daily rosary reminder plus
 * whichever Hours the user switched on — sorted by time of day, at most one
 * entry per time. Single source of truth for both the in-app timer below and
 * the service worker's text.
 *
 * Times must be unique: the push server de-dupes them and the service worker
 * matches a single entry per push, so two prayers due at the same minute have
 * to share one message or the second would never be announced at all.
 */
export function buildReminderSchedule(
    notificationTime: string | null,
    hourReminders: Record<string, string>,
    rosaryTitle: string
): ReminderEntry[] {
    const drafts: { time: string; isHour: boolean; label: string }[] = [];
    if (notificationTime) {
        drafts.push({ time: notificationTime, isHour: false, label: `o ${rosaryTitle}` });
    }
    for (const hour of CANONICAL_HOURS) {
        const time = hourReminders[hour.id];
        if (time) drafts.push({ time, isHour: true, label: hour.label });
    }

    const byTime = new Map<string, typeof drafts>();
    for (const draft of drafts) {
        const group = byTime.get(draft.time);
        if (group) group.push(draft);
        else byTime.set(draft.time, [draft]);
    }

    return [...byTime.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([time, group]) => ({
            time,
            title: group.every((d) => d.isHour)
                ? 'mORA — Liturgia das Horas 🙏'
                : 'mORA — Hora da oração 🙏',
            body: `É hora de rezar ${joinWithE(group.map((d) => d.label))}`,
        }));
}

export function useNotifications() {
    const { notificationTime, hourReminders, pushSubscribed } = useAppStore();
    const t = useTranslations().home;
    // "<due date> <HH:MM>" for each reminder already shown, so a repeated tick
    // inside the catch-up window can't show it twice. Keyed by the date the
    // reminder was due (not today's) so a near-midnight reminder is not
    // suppressed the following night. Pruned in check().
    const fired = useRef<Set<string>>(new Set());

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
            const minutes = now.getHours() * 60 + now.getMinutes();
            const today = formatISODate(now);
            const yesterday = formatISODate(new Date(now.getTime() - 86400000));

            for (const entry of schedule) {
                const [h, m] = entry.time.split(':').map(Number);
                // Minutes since the reminder fell due, wrapping midnight, and
                // the date it was due on — a 23:55 reminder seen at 00:05
                // belongs to yesterday, or tonight's would look already sent.
                let elapsed = minutes - (h * 60 + m);
                let dueDate = today;
                if (elapsed < 0) {
                    elapsed += 1440;
                    dueDate = yesterday;
                }
                // A window rather than an exact minute match: this tick can be
                // late or skipped entirely (timer drift, background throttling,
                // the device sleeping), and an exact match would drop the
                // reminder for good.
                if (elapsed >= DELIVERY_WINDOW_MIN) continue;

                const mark = `${dueDate} ${entry.time}`;
                if (fired.current.has(mark)) continue;
                fired.current.add(mark);

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

            // Only today's and yesterday's marks can still suppress anything.
            if (fired.current.size > 32) {
                for (const mark of fired.current) {
                    if (!mark.startsWith(today) && !mark.startsWith(yesterday)) {
                        fired.current.delete(mark);
                    }
                }
            }
        };

        // Align to the minute boundary so checks land just after HH:MM:00
        // rather than at whatever second the app happened to start on.
        let intervalId: number | undefined;
        const alignId = window.setTimeout(() => {
            check();
            intervalId = window.setInterval(check, 60000);
        }, 60000 - (Date.now() % 60000));

        // Initial check in case they just opened it on time
        check();

        return () => {
            window.clearTimeout(alignId);
            if (intervalId !== undefined) window.clearInterval(intervalId);
        };
    }, [schedule, pushSubscribed]);
}
