import { afterEach, describe, expect, it } from 'vitest';
import { gapPx } from './layout';

/** The suite runs in node, so the two DOM globals `gapPx` reads are stubbed
    directly rather than pulling in a whole document implementation. */
function withRootFontSize(fontSize: string) {
    const g = globalThis as Record<string, unknown>;
    g.document = { documentElement: {} };
    g.getComputedStyle = () => ({ fontSize }) as CSSStyleDeclaration;
}

afterEach(() => {
    const g = globalThis as Record<string, unknown>;
    delete g.document;
    delete g.getComputedStyle;
});

describe('gapPx', () => {
    it('is 6px at the default 16px root', () => {
        withRootFontSize('16px');
        expect(gapPx()).toBe(6);
    });

    // The reason this isn't the constant 6 it used to be: browser and OS text
    // scaling move every rem on the page, and under-counting five gaps of it
    // sizes the board too tall.
    it('grows with the reader’s browser text size', () => {
        withRootFontSize('20px');
        expect(gapPx()).toBe(7.5);
    });

    it('falls back to 16px when the root size is unreadable', () => {
        withRootFontSize('');
        expect(gapPx()).toBe(6);
    });
});
