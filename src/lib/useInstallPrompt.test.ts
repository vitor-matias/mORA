// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { promptInstall, useCanInstall } from './useInstallPrompt';

function offerInstall() {
    const prompt = vi.fn(async () => {});
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt });
    act(() => { window.dispatchEvent(event); });
    return { event, prompt };
}

/** Mounts the hook and reports the value of its latest render. */
function renderCanInstall() {
    let canInstall: boolean | undefined;
    function Probe() {
        canInstall = useCanInstall();
        return null;
    }
    act(() => { createRoot(document.createElement('div')).render(createElement(Probe)); });
    return () => canInstall;
}

beforeAll(() => {
    (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
});

// The captured event lives in module state, shared between tests.
afterEach(() => {
    act(() => { window.dispatchEvent(new Event('appinstalled')); });
});

describe('useCanInstall', () => {
    it('follows the browser offering the install and the app being installed', () => {
        const canInstall = renderCanInstall();
        expect(canInstall()).toBe(false);

        offerInstall();
        expect(canInstall()).toBe(true);

        act(() => { window.dispatchEvent(new Event('appinstalled')); });
        expect(canInstall()).toBe(false);
    });

    it('turns off once the prompt is used, and back on when the browser offers again', () => {
        const canInstall = renderCanInstall();
        offerInstall();

        act(() => { promptInstall(); });
        expect(canInstall()).toBe(false);

        offerInstall();
        expect(canInstall()).toBe(true);
    });
});

describe('promptInstall', () => {
    it('opens a captured prompt once, since an event can only prompt once', () => {
        const { event, prompt } = offerInstall();
        expect(event.defaultPrevented).toBe(true);

        act(() => {
            promptInstall();
            promptInstall();
        });
        expect(prompt).toHaveBeenCalledTimes(1);
    });

    it('does nothing once the app is installed', () => {
        const { prompt } = offerInstall();
        act(() => { window.dispatchEvent(new Event('appinstalled')); });

        act(() => { promptInstall(); });
        expect(prompt).not.toHaveBeenCalled();
    });
});
