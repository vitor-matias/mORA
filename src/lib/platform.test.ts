import { afterEach, describe, expect, it } from 'vitest';
import { isIOS } from './platform';

const IPHONE_UA =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IPAD_UA =
    'Mozilla/5.0 (iPad; CPU OS 12_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1.1 Mobile/15E148 Safari/604.1';
const IPOD_UA =
    'Mozilla/5.0 (iPod touch; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1';
const MAC_SAFARI_UA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const ANDROID_UA =
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';

/** The suite runs in node, so the one global `isIOS` reads is stubbed
    directly rather than pulling in a whole `navigator` implementation. */
function asDevice(userAgent: string, platform: string, maxTouchPoints = 0) {
    (globalThis as Record<string, unknown>).navigator = { userAgent, platform, maxTouchPoints };
}

afterEach(() => {
    delete (globalThis as Record<string, unknown>).navigator;
});

describe('isIOS', () => {
    it('is false when there is no navigator at all', () => {
        expect(isIOS()).toBe(false);
    });

    it('recognizes an iPhone', () => {
        asDevice(IPHONE_UA, 'iPhone');
        expect(isIOS()).toBe(true);
    });

    it('recognizes an iPad reporting its own platform', () => {
        asDevice(IPAD_UA, 'iPad');
        expect(isIOS()).toBe(true);
    });

    it('recognizes an iPod touch', () => {
        asDevice(IPOD_UA, 'iPod');
        expect(isIOS()).toBe(true);
    });

    // iPadOS 13+ reports "MacIntel" like a real Mac and only gives itself
    // away through touch support — the one thing an actual Mac lacks.
    it('recognizes iPadOS 13+ masquerading as a Mac', () => {
        asDevice(IPAD_UA, 'MacIntel', 5);
        expect(isIOS()).toBe(true);
    });

    it('is false on an actual Mac', () => {
        asDevice(MAC_SAFARI_UA, 'MacIntel', 0);
        expect(isIOS()).toBe(false);
    });

    it('is false on Android', () => {
        asDevice(ANDROID_UA, 'Linux armv8l');
        expect(isIOS()).toBe(false);
    });
});
