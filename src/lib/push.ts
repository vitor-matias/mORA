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

function bufferEquals(a: ArrayBuffer | null, b: Uint8Array): boolean {
    if (!a || a.byteLength !== b.byteLength) return false;
    const view = new Uint8Array(a);
    return view.every((byte, i) => byte === b[i]);
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

// Server calls are bounded so a hung request can never strand the browser
// subscription or the app state mid-flow.
function fetchWithTimeout(url: string, init: RequestInit, ms = 8000): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

/**
 * Subscribes this browser to reminder pushes at `times` (HH:MM, user's local
 * timezone) — the daily rosary reminder plus any Liturgy of the Hours the user
 * enabled. Returns true when the server accepted it.
 */
export async function enablePushReminder(times: string[]): Promise<boolean> {
    // Dedupe/sort here so the count we check against the server's ack below is
    // the same set the server stores.
    const wanted = [...new Set(times)].sort();
    if (!isPushConfigured() || wanted.length === 0) return false;
    try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            // A previously subscribed browser may have had permission revoked
            // — stand down so the in-app fallback takes over again.
            useAppStore.getState().setPushSubscribed(false);
            return false;
        }

        const registration = await readyWithTimeout(5000);
        const expectedKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY!);

        // Reuse an existing subscription (e.g. the user is just changing the
        // reminder time) — re-subscribing can reject with InvalidStateError.
        // But only when it was created with the current VAPID key: after a
        // key rotation the stale subscription would accept pushes the Worker
        // can no longer sign for, silently killing delivery.
        let subscription = await registration.pushManager.getSubscription();
        if (subscription && !bufferEquals(subscription.options.applicationServerKey, expectedKey)) {
            await subscription.unsubscribe();
            subscription = null;
        }
        subscription ??= await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: expectedKey.buffer as ArrayBuffer,
        });

        const res = await fetchWithTimeout(`${SERVER_URL}/subscriptions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                subscription: subscription.toJSON(),
                // `time` lets a not-yet-redeployed Worker keep serving the
                // single-reminder case, which is all it understands.
                time: wanted[0],
                times: wanted,
                tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
            }),
        });
        if (!res.ok) throw new Error(`subscription rejected: ${res.status}`);

        // A Worker predating multi-time reminders reads only `time`, stores the
        // first one and still answers 201. Trusting that would set
        // pushSubscribed, stand the in-app timer down, and silently drop every
        // reminder but the earliest. A current Worker echoes how many times it
        // stored; when that doesn't match, tear the registration back down so
        // the fallback keeps covering all of them.
        if (wanted.length > 1) {
            const ack = await res.json().catch(() => null);
            if (ack?.times !== wanted.length) {
                console.warn('Push server has no multi-reminder support; keeping the in-app fallback.');
                await disablePushReminder();
                return false;
            }
        }

        useAppStore.getState().setPushSubscribed(true);
        return true;
    } catch (e) {
        console.warn('Push subscribe failed, keeping in-app fallback:', e);
        useAppStore.getState().setPushSubscribed(false);
        return false;
    }
}

/**
 * Reconciles the persisted pushSubscribed flag with reality — permission can
 * be revoked and subscriptions can expire outside the app, which would
 * otherwise leave the in-app fallback timer disabled with no push either.
 */
export async function verifyPushSubscription(): Promise<void> {
    const { pushSubscribed, setPushSubscribed } = useAppStore.getState();
    if (!pushSubscribed) return;
    if (!isPushConfigured() || Notification.permission !== 'granted') {
        setPushSubscribed(false);
        return;
    }
    try {
        const registration = await readyWithTimeout(5000);
        if (!(await registration.pushManager.getSubscription())) {
            setPushSubscribed(false);
        }
    } catch {
        // SW not ready (e.g. dev server) — keep the flag rather than flap.
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

        await fetchWithTimeout(`${SERVER_URL}/subscriptions`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: subscription.endpoint }),
        }).catch(() => {
            // Server cleanup is best-effort (and time-bounded) — it also
            // drops dead subscriptions on its own when a push bounces.
        });
        await subscription.unsubscribe();
    } catch (e) {
        console.warn('Push unsubscribe failed:', e);
    }
}
