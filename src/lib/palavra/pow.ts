// Proof of work on result events (NIP-13).
//
// What this is for, precisely: results are self-reported, so nothing stops one
// person publishing one fabricated win a day. PoW does not fix that and is not
// meant to — mining a single event costs a second or two, which any cheat will
// happily pay.
//
// What it does stop is *volume*. Without it, a script can mint a thousand
// keypairs and flood the daily board with a thousand fabricated entries for
// nothing, and the leaderboard becomes worthless overnight. With it, each fake
// entry costs real CPU, which turns a free attack into a tediously expensive
// one. Spam gate, not an honesty check — and the UI shouldn't imply otherwise.

import { getPow } from 'nostr-tools/nip13';
import type { UnsignedEvent } from 'nostr-tools/pure';
import type { EventTemplate } from '@/lib/nostr';

/** What we aim for when publishing. ~1M hashes; a second or two in a worker. */
export const POW_TARGET = 20;

/**
 * What we require when reading. Lower than the target on purpose: a phone that
 * gave up early, or a future build that mines less, should still be listed.
 * The gate only needs to make bulk forgery expensive, and every bit below the
 * target halves that cost, so the gap is kept small.
 */
export const POW_MINIMUM = 16;

/** How long to let mining run before giving up and publishing unmined. */
const MINE_TIMEOUT_MS = 15_000;

export function eventPow(id: string): number {
    return getPow(id);
}

export function meetsPow(id: string): boolean {
    return getPow(id) >= POW_MINIMUM;
}

/**
 * Mine a template so its id carries `POW_TARGET` leading zero bits.
 *
 * Returns the template with a `nonce` tag and the `created_at` the miner
 * settled on — both must be passed to the signer unchanged, because the id is
 * a pure function of them, and changing either afterwards throws the work away.
 *
 * Falls back to the original, unmined template on any failure — the caller is
 * what decides whether to publish it. `publishPalavraResult` does not: every
 * reader applies `meetsPow`, so an unmined event is invisible everywhere in
 * this app and putting it on relays achieves nothing but traffic. Either way
 * the player's own record is local and unaffected.
 */
export async function minePalavraEvent(
    template: EventTemplate,
    pubkey: string,
    difficulty = POW_TARGET,
): Promise<EventTemplate> {
    if (typeof Worker === 'undefined') return template;

    let worker: Worker;
    try {
        worker = new Worker(new URL('./powWorker.ts', import.meta.url), { type: 'module' });
    } catch (error) {
        console.warn('Could not start the PoW worker; the result will not be published.', error);
        return template;
    }

    // The miner needs the pubkey because the id is computed over it, but the
    // template handed to the signer must not carry one — the signer fills it.
    const unsigned = { ...template, pubkey } as UnsignedEvent;

    try {
        return await new Promise<EventTemplate>((resolve) => {
            const finish = (result: EventTemplate) => {
                window.clearTimeout(timer);
                worker.terminate();
                resolve(result);
            };
            const timer = window.setTimeout(() => {
                console.warn('PoW mining timed out; the result will not be published.');
                finish(template);
            }, MINE_TIMEOUT_MS);

            worker.postMessage({ unsigned, difficulty });

            worker.onmessage = (event: MessageEvent<{ ok: boolean; created_at?: number; tags?: string[][] }>) => {
                const { ok, created_at, tags } = event.data;
                finish(ok && created_at && tags ? { ...template, created_at, tags } : template);
            };
            worker.onerror = () => finish(template);
        });
    } catch (error) {
        console.warn('PoW mining failed; publishing unmined.', error);
        worker.terminate();
        return template;
    }
}
