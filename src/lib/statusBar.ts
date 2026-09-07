// What to publish as theme-color, given who actually paints the status bar.
//
// theme-color is a request. Browsers that paint the bar honour it (Safari's
// tab tint, Chrome on Android up to 14); where the page draws under the bar
// (iOS with black-translucent, Chrome once its edge-to-edge for installed
// apps ships) the bar simply *is* the page. Android 15+ is the odd one out:
// Chrome still asks the OS to paint our colour, the OS ignores the request
// and shows the window behind the bar — the manifest's launch colour — while
// Chrome picks the bar's icon colour from the colour it *thinks* it painted.
// Publishing the dark page colour there gave white icons on a near-white
// strip: the clock vanished in dark mode. Measured on a Pixel 8a, Android 17,
// Chrome 152: strip #FAF9F6, icons #FFFFFF, safe-area-inset-top 0.
//
// So on that platform the honest value is the strip's real colour, which at
// least makes the icons legible. The strip stays light over a dark page until
// Chrome lets the page draw under it — at which point the inset turns
// non-zero and this falls back to the page colour on its own.

let androidMajorLookup: Promise<number | null> | null = null;

/** Chrome freezes the UA string at "Android 10", so the real major version
    only comes from Client Hints, asynchronously. Null where unavailable.
    Asked once; every later call shares the answer. */
export function androidPlatformMajor(): Promise<number | null> {
    androidMajorLookup ??= lookUpAndroidMajor();
    return androidMajorLookup;
}

async function lookUpAndroidMajor(): Promise<number | null> {
    const uaData = (navigator as Navigator & {
        userAgentData?: {
            platform: string;
            getHighEntropyValues(hints: string[]): Promise<{ platformVersion?: string }>;
        };
    }).userAgentData;
    if (!uaData || uaData.platform !== 'Android') return null;
    try {
        const { platformVersion } = await uaData.getHighEntropyValues(['platformVersion']);
        const major = Number.parseInt(platformVersion ?? '', 10);
        return Number.isFinite(major) ? major : null;
    } catch {
        return null;
    }
}

/** True when the page extends under the status bar — the inset is then how
    much of it the bar covers, and the bar shows the page. */
export function drawsUnderStatusBar(): boolean {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;top:0;left:0;padding-top:env(safe-area-inset-top, 0px);visibility:hidden;pointer-events:none';
    document.body.appendChild(probe);
    const inset = Number.parseFloat(getComputedStyle(probe).paddingTop);
    probe.remove();
    return inset > 0;
}

export type StatusBarContext = {
    /** What the page paints at its top edge — the colour we would like. */
    pageTop: string;
    /** The manifest's launch colour — what Android 15+ shows regardless. */
    launchColor: string;
    /** From drawsUnderStatusBar(). */
    drawsUnderBar: boolean;
    /** Installed app (display-mode: standalone), as opposed to a browser tab. */
    standalone: boolean;
    /** From androidPlatformMajor(); null off Android or before it resolves. */
    androidMajor: number | null;
};

/** The first Android release whose OS ignores an app's status-bar colour. */
const ANDROID_EDGE_TO_EDGE = 15;

/** The theme-color to publish. */
export function statusBarColor({ pageTop, launchColor, drawsUnderBar, standalone, androidMajor }: StatusBarContext): string {
    if (drawsUnderBar) return pageTop;
    const osPaintsLaunchColor = standalone && androidMajor !== null && androidMajor >= ANDROID_EDGE_TO_EDGE;
    return osPaintsLaunchColor ? launchColor : pageTop;
}
