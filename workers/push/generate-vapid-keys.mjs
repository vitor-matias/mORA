// Generates a VAPID key pair for the push Worker.
// Run once: node generate-vapid-keys.mjs
import { webcrypto as crypto } from 'node:crypto';

const pair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify']
);

const publicRaw = Buffer.from(await crypto.subtle.exportKey('raw', pair.publicKey));
const privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey);

console.log('# App (.env) — safe to expose:');
console.log(`VITE_VAPID_PUBLIC_KEY=${publicRaw.toString('base64url')}`);
console.log('');
console.log('# Worker secrets — keep private:');
console.log(`npx wrangler secret put VAPID_PUBLIC_KEY      # ${publicRaw.toString('base64url')}`);
console.log(`npx wrangler secret put VAPID_PRIVATE_KEY_JWK # ${JSON.stringify(privateJwk)}`);
console.log('npx wrangler secret put VAPID_SUBJECT         # mailto:you@example.com');
