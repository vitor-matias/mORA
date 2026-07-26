import { useEffect, useRef } from 'react';
import { useAppStore } from '@/store/app';
import { useTranslations } from '@/lib/i18n';
import { verifyPushSubscription } from '@/lib/push';

export function useNotifications() {
    const { notificationTime, pushSubscribed } = useAppStore();
    const t = useTranslations().home; // Re-use strings for notification if possible
    const hasNotifiedToday = useRef(false);

    // The persisted flag can go stale (permission revoked, subscription
    // expired outside the app) — reconcile once per app start so the
    // fallback timer below isn't left disabled with no push active.
    useEffect(() => {
        verifyPushSubscription();
    }, []);

    useEffect(() => {
        // With a server-side push subscription active this in-app timer would
        // only duplicate the notification — it exists for the unconfigured
        // (no push server) fallback.
        if (!notificationTime || pushSubscribed) return;

        const checkTime = () => {
            const now = new Date();
            const currentHours = now.getHours().toString().padStart(2, '0');
            const currentMinutes = now.getMinutes().toString().padStart(2, '0');
            const currentTime = `${currentHours}:${currentMinutes}`;

            // Reset notification flag at midnight
            if (currentTime === "00:00") {
                hasNotifiedToday.current = false;
            }

            if (currentTime === notificationTime && !hasNotifiedToday.current) {
                hasNotifiedToday.current = true;

                if (Notification.permission === 'granted') {
                    // Try to use a service worker for the notification if available
                    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                        navigator.serviceWorker.ready.then(registration => {
                            registration.showNotification("mORA", {
                                body: "É hora de rezar o " + t.rosaryTitle,
                                icon: '/pwa-192x192.png'
                            });
                        });
                    } else {
                        // Fallback to standard Notification
                        new Notification("mORA", {
                            body: "É hora de rezar o " + t.rosaryTitle,
                            icon: '/pwa-192x192.png'
                        });
                    }
                }
            }
        };

        // Check every minute
        const intervalId = setInterval(checkTime, 60000);

        // Initial check in case they just opened it exactly on time
        checkTime();

        return () => clearInterval(intervalId);
    }, [notificationTime, pushSubscribed, t.rosaryTitle]);
}
