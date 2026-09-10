import { describe, expect, it } from 'vitest';
import { statusBarColor } from './statusBar';

// The one decision here is whose colour to publish: the page's, or the
// launch colour Android 15+ shows whatever we ask for. Everything else is
// measurement.

const page = 'rgb(15 33 28)';
const launch = '#FAF9F6';
const base = { pageTop: page, launchColor: launch, drawsUnderBar: false, standalone: true, androidMajor: null };

describe('statusBarColor', () => {
    it('publishes the launch colour on Android 15+ installed apps', () => {
        // The OS shows the launch colour regardless; Chrome only uses our
        // value to choose the icon colour, and a light value gets dark icons.
        expect(statusBarColor({ ...base, androidMajor: 15 })).toBe(launch);
        expect(statusBarColor({ ...base, androidMajor: 17 })).toBe(launch);
    });

    it('keeps the page colour where Chrome still paints the bar', () => {
        expect(statusBarColor({ ...base, androidMajor: 14 })).toBe(page);
    });

    it('keeps the page colour in a browser tab', () => {
        // Chrome's own toolbar takes theme-color as given, on every release.
        expect(statusBarColor({ ...base, androidMajor: 17, standalone: false })).toBe(page);
    });

    it('keeps the page colour once the page draws under the bar', () => {
        // The bar then is the page: iOS today, Android when Chrome's
        // edge-to-edge for installed apps ships — no code change needed.
        expect(statusBarColor({ ...base, androidMajor: 17, drawsUnderBar: true })).toBe(page);
    });

    it('keeps the page colour off Android or before the version is known', () => {
        expect(statusBarColor({ ...base, androidMajor: null })).toBe(page);
    });
});
