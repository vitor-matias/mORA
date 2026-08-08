/// <reference lib="webworker" />
// NIP-13 mining, off the main thread.
//
// minePow is a tight sha256 loop — around a million hashes at difficulty 20,
// which is a second or two of solid blocking. That happens right after a game
// ends, while the result panel is animating in and the player may be reaching
// for the share button, so it cannot run on the main thread.

import { minePow } from 'nostr-tools/nip13';
import type { UnsignedEvent } from 'nostr-tools/pure';

export interface MineRequest {
    unsigned: UnsignedEvent;
    difficulty: number;
}

self.onmessage = (event: MessageEvent<MineRequest>) => {
    const { unsigned, difficulty } = event.data;
    try {
        const mined = minePow(unsigned, difficulty);
        self.postMessage({ ok: true, created_at: mined.created_at, tags: mined.tags });
    } catch {
        self.postMessage({ ok: false });
    }
};
