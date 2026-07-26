# mORA push Worker

Delivers the daily prayer reminder as real Web Push — it reaches the user
even with the app closed, unlike the in-app fallback timer. Runs on
Cloudflare Workers (free tier is plenty): subscriptions live in KV, a cron
trigger every 5 minutes sends a payload-less, VAPID-authenticated push to
everyone whose chosen local time has just passed, and the app's service
worker ([src/sw.ts](../../src/sw.ts)) renders the notification text.

## Deploy

1. **Generate VAPID keys** (once):

   ```bash
   node generate-vapid-keys.mjs
   ```

2. **Create the KV namespace** and paste its id into `wrangler.toml`:

   ```bash
   npx wrangler kv namespace create SUBSCRIPTIONS
   ```

3. **Set the secrets** (values printed by step 1):

   ```bash
   npx wrangler secret put VAPID_PUBLIC_KEY
   npx wrangler secret put VAPID_PRIVATE_KEY_JWK
   npx wrangler secret put VAPID_SUBJECT   # e.g. mailto:you@example.com
   ```

4. **Deploy**:

   ```bash
   npx wrangler deploy
   ```

5. **Point the app at it** — create `.env` in the repo root (see
   `.env.example`) with the deployed Worker URL and the public key:

   ```
   VITE_PUSH_SERVER_URL=https://mora-push.<your-subdomain>.workers.dev
   VITE_VAPID_PUBLIC_KEY=<from step 1>
   ```

   and rebuild the app. Without these two vars the app keeps the old
   in-app reminder and never contacts the Worker.

## Notes

- iOS delivers Web Push only to PWAs installed on the home screen (iOS 16.4+).
- Pushes carry no payload, so no subscriber keys are used server-side and no
  message content ever transits the push service — the notification text is
  fixed in the service worker.
- Dead subscriptions (push service answers 404/410) are pruned automatically.
