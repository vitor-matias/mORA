import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
});

describe('promptInstall', () => {
    it('opens a captured prompt once, since an event can only prompt once', async () => {
        const target = new EventTarget();
        vi.stubGlobal('window', target);
        const { promptInstall } = await import('./useInstallPrompt');

        const prompt = vi.fn(async () => {});
        const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt });
        target.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);

        promptInstall();
        promptInstall();
        expect(prompt).toHaveBeenCalledTimes(1);
    });

    it('does nothing once the app is installed', async () => {
        const target = new EventTarget();
        vi.stubGlobal('window', target);
        const { promptInstall } = await import('./useInstallPrompt');

        const prompt = vi.fn(async () => {});
        target.dispatchEvent(Object.assign(new Event('beforeinstallprompt'), { prompt }));
        target.dispatchEvent(new Event('appinstalled'));

        promptInstall();
        expect(prompt).not.toHaveBeenCalled();
    });
});

describe('isIOS', () => {
    it.each([
        ['iPhone', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X)', platform: 'iPhone', maxTouchPoints: 5 }, true],
        ['iPadOS, posing as a Mac', { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel', maxTouchPoints: 5 }, true],
        ['a real Mac', { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel', maxTouchPoints: 0 }, false],
        ['Android', { userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 9)', platform: 'Linux armv81', maxTouchPoints: 5 }, false],
    ])('%s', async (_name, navigator, expected) => {
        vi.stubGlobal('navigator', navigator);
        const { isIOS } = await import('./useInstallPrompt');
        expect(isIOS()).toBe(expected);
    });
});
