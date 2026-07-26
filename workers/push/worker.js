// mORA push reminder Worker.
//
// HTTP API (called by the app, src/lib/push.ts):
//   POST   /subscriptions  { subscription, time: "HH:MM", tz: "Europe/Lisbon" }
//   DELETE /subscriptions  { endpoint }
//
// A cron trigger (every 5 min, wrangler.toml) walks the KV-stored
// subscriptions and delivers a payload-less push to everyone whose local
// time has just passed their chosen reminder time. Payload-less pushes need
// no RFC 8291 encryption — only a VAPID JWT — and the service worker
// (src/sw.ts) supplies the notification text.
//
// Bindings/secrets (see README.md): SUBSCRIPTIONS (KV),
// VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY_JWK, VAPID_SUBJECT.

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

// How long after the chosen minute a reminder may still fire. Covers cron
// jitter and the 5-minute schedule without ever double-sending (lastSentDate
// guards that).
const DELIVERY_WINDOW_MIN = 15;

// Known Web Push service hosts. Restricting endpoints to these prevents the
// worker from being abused as a credentialed requester to arbitrary servers
// (SSRF) or as an oracle for VAPID JWTs with attacker-chosen `aud` values.
const PUSH_HOST_SUFFIXES = [
    'fcm.googleapis.com',            // Chrome / Chromium
    '.push.services.mozilla.com',    // Firefox
    '.push.apple.com',               // Safari (web.push.apple.com + regions)
    '.notify.windows.com',           // Edge (WNS)
    '.push.samsungosp.com',          // Samsung Internet
];

function isAllowedPushEndpoint(endpoint) {
    try {
        const { protocol, hostname } = new URL(endpoint);
        if (protocol !== 'https:') return false;
        return PUSH_HOST_SUFFIXES.some((h) =>
            h.startsWith('.') ? hostname === h.slice(1) || hostname.endsWith(h) : hostname === h
        );
    } catch {
        return false;
    }
}

const json = (status, body) =>
    new Response(body ? JSON.stringify(body) : null, {
        status,
        headers: { 'Content-Type': 'application/json', ...CORS },
    });

async function endpointKey(endpoint) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const b64url = (bytes) =>
    btoa(String.fromCharCode(...new Uint8Array(bytes)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function vapidHeaders(endpoint, env) {
    const { origin } = new URL(endpoint);
    const encoder = new TextEncoder();

    const header = b64url(encoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
    const claims = b64url(encoder.encode(JSON.stringify({
        aud: origin,
        exp: Math.floor(Date.now() / 1000) + 12 * 3600,
        sub: env.VAPID_SUBJECT,
    })));

    const key = await crypto.subtle.importKey(
        'jwk',
        JSON.parse(env.VAPID_PRIVATE_KEY_JWK),
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign']
    );
    // WebCrypto ECDSA signatures are already the raw r||s form JWT wants.
    const signature = await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        key,
        encoder.encode(`${header}.${claims}`)
    );

    return {
        Authorization: `vapid t=${header}.${claims}.${b64url(signature)}, k=${env.VAPID_PUBLIC_KEY}`,
        TTL: '86400',
        Urgency: 'normal',
    };
}

/** @returns {'sent' | 'gone' | 'failed'} */
async function sendPush(subscription, env) {
    try {
        const res = await fetch(subscription.endpoint, {
            method: 'POST',
            headers: await vapidHeaders(subscription.endpoint, env),
        });
        if (res.status === 404 || res.status === 410) return 'gone';
        return res.ok || res.status === 201 ? 'sent' : 'failed';
    } catch {
        return 'failed';
    }
}

function localParts(tz, now) {
    try {
        const fmt = new Intl.DateTimeFormat('en-CA', {
            timeZone: tz,
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
        });
        const p = Object.fromEntries(fmt.formatToParts(now).map(({ type, value }) => [type, value]));
        return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
    } catch {
        return null; // unknown timezone — subscription is skipped
    }
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

        // Authoritative CORS proxy for the liturgia.pt calendar, so the app
        // doesn't have to rely on rotating public proxies. Cached at the
        // Cloudflare edge for 6 hours.
        if (url.pathname === '/ics' && request.method === 'GET') {
            try {
                const res = await fetch('https://www.liturgia.pt/agenda/agenda.ics', {
                    cf: { cacheTtl: 21600, cacheEverything: true },
                });
                if (!res.ok) return json(502, { error: 'calendar upstream unavailable' });
                return new Response(await res.text(), {
                    headers: { 'Content-Type': 'text/calendar; charset=utf-8', ...CORS },
                });
            } catch {
                return json(502, { error: 'calendar upstream unavailable' });
            }
        }

        if (url.pathname !== '/subscriptions') return json(404, { error: 'not found' });

        let body;
        try {
            body = await request.json();
        } catch {
            return json(400, { error: 'invalid JSON' });
        }

        if (request.method === 'POST') {
            const { subscription, time, tz } = body ?? {};
            const endpoint = subscription?.endpoint;
            if (
                typeof endpoint !== 'string' || !isAllowedPushEndpoint(endpoint) ||
                typeof subscription?.keys?.p256dh !== 'string' ||
                typeof subscription?.keys?.auth !== 'string' ||
                typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) ||
                typeof tz !== 'string' || tz.length > 64 || !localParts(tz, new Date())
            ) {
                return json(400, { error: 'invalid subscription payload' });
            }
            await env.SUBSCRIPTIONS.put(
                await endpointKey(endpoint),
                JSON.stringify({ subscription, time, tz, lastSentDate: null })
            );
            return json(201, { ok: true });
        }

        if (request.method === 'DELETE') {
            const { endpoint } = body ?? {};
            if (typeof endpoint !== 'string') return json(400, { error: 'endpoint required' });
            await env.SUBSCRIPTIONS.delete(await endpointKey(endpoint));
            return json(200, { ok: true });
        }

        return json(405, { error: 'method not allowed' });
    },

    // Full KV scan per tick — fine at personal-use scale. If this ever
    // serves many users, partition keys by delivery-time bucket so each
    // tick only lists the buckets due now.
    async scheduled(_event, env, ctx) {
        ctx.waitUntil((async () => {
            const now = new Date();
            let cursor;
            do {
                const page = await env.SUBSCRIPTIONS.list({ cursor });
                cursor = page.list_complete ? undefined : page.cursor;

                for (const { name: key } of page.keys) {
                    const raw = await env.SUBSCRIPTIONS.get(key);
                    if (!raw) continue;
                    let rec;
                    try {
                        rec = JSON.parse(raw);
                    } catch {
                        // A corrupt record must not abort the whole run.
                        await env.SUBSCRIPTIONS.delete(key);
                        continue;
                    }

                    const local = localParts(rec.tz, now);
                    if (!local || rec.lastSentDate === local.date) continue;

                    const [h, m] = rec.time.split(':').map(Number);
                    const target = h * 60 + m;
                    if (local.minutes < target || local.minutes - target >= DELIVERY_WINDOW_MIN) continue;

                    const outcome = await sendPush(rec.subscription, env);
                    if (outcome === 'gone') {
                        await env.SUBSCRIPTIONS.delete(key);
                    } else if (outcome === 'sent') {
                        rec.lastSentDate = local.date;
                        await env.SUBSCRIPTIONS.put(key, JSON.stringify(rec));
                    }
                    // 'failed' → retried on the next cron tick within the window
                }
            } while (cursor);
        })());
    },
};
