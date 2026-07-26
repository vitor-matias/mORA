// Web Push subscription management. The heavy lifting (cron scheduling,
// VAPID-authenticated delivery) lives in the Cloudflare Worker under
// workers/push/ — this module only creates/removes the browser
// subscription and registers it with that server.
//
// Both env vars come from .env (see .env.example); when they're absent the
// app silently keeps the in-app reminder fallback (useNotifications).
import { useAppStore } from '@/store/app';

const SERVER_URL = import.meta.env.VITE_PUSH_SERVER_URL as string | undefined;
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export function isPushConfigured(): boolean {
    return Boolean(
        SERVER_URL &&
        VAPID_PUBLIC_KEY &&
        typeof navigator !== 'undefined' &&
        'serviceWorker' in navigator &&
        typeof window !== 'undefined' &&
        'PushManager' in window
    );
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

// serviceWorker.ready never resolves when no SW is registered (e.g. dev
// server), which would hang the subscribe flow forever.
function readyWithTimeout(ms: number): Promise<ServiceWorkerRegistration> {
    return Promise.race([
        navigator.serviceWorker.ready,
        new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('service worker not ready')), ms)
        ),
    ]);
}

/**
 * Subscribes this browser to the daily reminder push at `time` (HH:MM,
 * user's local timezone). Returns true when the server accepted it.
 */
export async function enablePushReminder(time: string): Promise<boolean> {
    if (!isPushConfigured()) return false;
    try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return false;

        const registration = await readyWithTimeout(5000);
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!).buffer as ArrayBuffer,
        });

        const res = await fetch(`${SERVER_URL}/subscriptions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                subscription: subscription.toJSON(),
                time,
                tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
            }),
        });
        if (!res.ok) throw new Error(`subscription rejected: ${res.status}`);

        useAppStore.getState().setPushSubscribed(true);
        return true;
    } catch (e) {
        console.warn('Push subscribe failed, keeping in-app fallback:', e);
        useAppStore.getState().setPushSubscribed(false);
        return false;
    }
}

/** Removes the browser subscription and tells the server to forget it. */
export async function disablePushReminder(): Promise<void> {
    useAppStore.getState().setPushSubscribed(false);
    if (!isPushConfigured()) return;
    try {
        const registration = await readyWithTimeout(5000);
        const subscription = await registration.pushManager.getSubscription();
        if (!subscription) return;

        await fetch(`${SERVER_URL}/subscriptions`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: subscription.endpoint }),
        }).catch(() => {
            // Server cleanup is best-effort — it also drops dead
            // subscriptions on its own when a push bounces.
        });
        await subscription.unsubscribe();
    } catch (e) {
        console.warn('Push unsubscribe failed:', e);
    }
}
