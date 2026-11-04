// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { minePalavraEvent, POW_MINIMUM, POW_TARGET } from './pow';

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

it('drops to the minimum when the target takes too long, rather than losing the result', async () => {
    vi.useFakeTimers();
    const asked: number[] = [];
    const tags = [['nonce', '1', String(POW_MINIMUM)]];
    vi.stubGlobal('Worker', class {
        onmessage?: (event: { data: unknown }) => void;
        terminate() { /* Nothing to stop. */ }
        postMessage({ difficulty }: { difficulty: number }) {
            asked.push(difficulty);
            // Silent at the target, which is what an unlucky run looks like.
            if (difficulty === POW_MINIMUM) {
                queueMicrotask(() => this.onmessage?.({ data: { ok: true, created_at: 1, tags } }));
            }
        }
    });

    const mining = minePalavraEvent({ kind: 1, created_at: 1, tags: [], content: '' }, 'pubkey');
    await vi.advanceTimersByTimeAsync(15_000);

    await expect(mining).resolves.toMatchObject({ tags });
    expect(asked).toEqual([POW_TARGET, POW_MINIMUM]);
});
