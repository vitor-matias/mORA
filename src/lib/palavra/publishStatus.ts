import { create } from 'zustand';

/**
 * Where the publish of a finished game stands while it is still in doubt.
 *
 * A result that made it out is already recorded: `publishedResults` in the
 * Palavra store, which the boards and the catch-up read. This tracks the other
 * case, an attempt that hasn't landed, which nothing used to record. Without
 * it, a publish that failed looked exactly like one that hadn't started, and
 * both looked like an empty board. The player who had just finished read
 * "nobody has published today" with no hint that the nobody included them.
 *
 * That is the ordinary failure with a remote signer. Every result is signed by
 * another app (Amber, nsec.app) over relays, and when that app doesn't answer
 * within NConnectSigner's 60-second wait the publish fails. One attempt was
 * all the page made, and nothing on screen said so.
 *
 * Not persisted. An attempt belongs to the session that made it; after a
 * reload the catch-up starts a fresh one.
 */
export type PublishState = 'publishing' | 'failed';

export const usePublishStatus = create<{ byKey: Record<string, PublishState> }>(() => ({ byKey: {} }));

export function publishKey(pubkey: string, date: string): string {
    return `${pubkey}:${date}`;
}

/** Record an attempt's state, or clear it with null once it has landed. */
export function setPublishState(pubkey: string, date: string, state: PublishState | null): void {
    const key = publishKey(pubkey, date);
    usePublishStatus.setState(({ byKey }) => {
        const next = { ...byKey };
        if (state === null) delete next[key];
        else next[key] = state;
        return { byKey: next };
    });
}
