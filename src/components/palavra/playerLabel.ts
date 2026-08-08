import { nip19 } from 'nostr-tools';

/**
 * How to name someone with no profile.
 *
 * An npub rather than raw hex: it is what every other Nostr client shows, so
 * a player can recognise their own row, and the checksum makes the truncation
 * unambiguous in a way the middle of a hex string is not.
 */
export function shortPubkey(pubkey: string): string {
    try {
        const npub = nip19.npubEncode(pubkey);
        return `${npub.slice(0, 10)}…${npub.slice(-4)}`;
    } catch {
        return `${pubkey.slice(0, 8)}…`;
    }
}

export function playerLabel(row: { name?: string; pubkey: string }): string {
    return row.name || shortPubkey(row.pubkey);
}

/** A duration, as a player reads it: "1m 23s", "48s". */
export function formatDuration(ms: number): string {
    if (!Number.isFinite(ms) || ms <= 0) return '—';
    const total = Math.round(ms / 1000);
    const minutes = Math.floor(total / 60);
    return minutes > 0 ? `${minutes}m ${total % 60}s` : `${total}s`;
}
