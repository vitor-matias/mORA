import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore, SCROLL_LEVELS, clampScrollLevel } from '@/store/app';

export interface AutoScroll {
    isScrolling: boolean;
    /** Index into SCROLL_LEVELS. */
    speed: number;
    slower: () => void;
    faster: () => void;
    toggle: () => void;
    stop: () => void;
    /** Nothing left to scroll — starting would do nothing. */
    atPageEnd: boolean;
}

/**
 * Hands-free scrolling of the window for long prayer texts: a rAF loop at the
 * configured px/s that stops at the bottom, pauses on any manual scroll, and
 * holds a screen wake lock while it runs. Shared by the Missa and Liturgia das
 * Horas pages.
 *
 * `contentKey` re-measures `atPageEnd` whenever the rendered text changes —
 * the page height isn't final at the moment the content state updates.
 */
export function useAutoScroll(contentKey: unknown): AutoScroll {
    const autoScrollSpeed = useAppStore((s) => s.autoScrollSpeed);

    const [isScrolling, setIsScrolling] = useState(false);
    // Starts at the default configured in Profile — the +/- controls only
    // adjust this session, not the saved default.
    const [speed, setSpeed] = useState<number>(() => clampScrollLevel(autoScrollSpeed));
    const [atPageEnd, setAtPageEnd] = useState(false);

    const rafRef = useRef<number | null>(null);
    const lastTimeRef = useRef<number | null>(null);
    // Float accumulator for the scroll position. window.scrollTo/scrollBy
    // round to whole pixels per call, so the sub-pixel per-frame delta
    // (~0.3px at 120fps) would otherwise round to 0 and never advance.
    const scrollAccRef = useRef(0);
    // Speed kept in a ref so changes apply to the running loop immediately.
    const speedRef = useRef(speed);
    useEffect(() => { speedRef.current = speed; }, [speed]);

    const stop = useCallback(() => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        lastTimeRef.current = null;
        setIsScrolling(false);
    }, []);

    const start = useCallback(() => {
        // A double-tap can call this twice before `isScrolling` re-renders;
        // without this the first loop keeps running untracked and `stop()`
        // only ever cancels the last one.
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        setIsScrolling(true);
        // Seed the float accumulator with the current position so we don't
        // jump on start.
        scrollAccRef.current = window.scrollY;
        lastTimeRef.current = null;

        const step = (time: number) => {
            if (lastTimeRef.current !== null) {
                // Cap elapsed so a backgrounded tab doesn't leap on return.
                const elapsed = Math.min((time - lastTimeRef.current) / 1000, 0.1);
                const pxPerSec = SCROLL_LEVELS[speedRef.current].pps;
                scrollAccRef.current += pxPerSec * elapsed;
                // Scroll to a whole pixel even though the accumulator is a
                // float: a fractional offset re-rasterizes the sticky header
                // and sidebar at a different sub-pixel phase every frame, and
                // that static text visibly shimmers. The moving text doesn't
                // suffer for it — at these speeds 1px steps read as smooth.
                window.scrollTo(0, Math.round(scrollAccRef.current));

                const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
                if (scrollAccRef.current >= maxScroll - 1) {
                    stop();
                    return;
                }
            }
            lastTimeRef.current = time;
            rafRef.current = requestAnimationFrame(step);
        };
        rafRef.current = requestAnimationFrame(step);
    }, [stop]);

    const toggle = useCallback(() => {
        if (isScrolling) stop(); else start();
    }, [isScrolling, start, stop]);

    const slower = useCallback(() => setSpeed((s) => Math.max(0, s - 1)), []);
    const faster = useCallback(() => setSpeed((s) => Math.min(SCROLL_LEVELS.length - 1, s + 1)), []);

    // Pause when the user manually scrolls (touchmove = drag, not tap).
    // Using touchmove rather than touchstart means tapping speed/stop
    // controls won't accidentally cancel the scroll mid-session.
    useEffect(() => {
        if (!isScrolling) return;
        const onManualScroll = () => stop();
        window.addEventListener('wheel', onManualScroll, { passive: true });
        window.addEventListener('touchmove', onManualScroll, { passive: true });
        return () => {
            window.removeEventListener('wheel', onManualScroll);
            window.removeEventListener('touchmove', onManualScroll);
        };
    }, [isScrolling, stop]);

    // Keep the screen awake while autoscrolling — otherwise the phone dims
    // and locks mid-reading. The browser releases the lock whenever the tab
    // is hidden, so re-acquire it when the page becomes visible again.
    useEffect(() => {
        if (!isScrolling || !('wakeLock' in navigator)) return;
        let sentinel: WakeLockSentinel | null = null;
        let cancelled = false;

        const acquire = async () => {
            try {
                const lock = await navigator.wakeLock.request('screen');
                if (cancelled) {
                    lock.release().catch(() => {});
                    return;
                }
                // A concurrent acquire may have won the race — release the
                // older lock so it can't linger unreleased.
                if (sentinel && sentinel !== lock && !sentinel.released) {
                    sentinel.release().catch(() => {});
                }
                sentinel = lock;
                // The platform can revoke the lock while we're still visible
                // (e.g. battery saver kicks in); try once to get it back.
                // Hidden-tab revocations re-acquire via visibilitychange.
                // Only the *tracked* lock re-acquires — releasing a superseded
                // lock firing this handler must not start a request loop.
                lock.addEventListener('release', () => {
                    if (!cancelled && sentinel === lock && document.visibilityState === 'visible') {
                        sentinel = null;
                        acquire();
                    }
                });
            } catch {
                // Denied (e.g. battery saver) — autoscroll still works,
                // the screen just won't be kept on.
            }
        };

        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') acquire();
        };

        acquire();
        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => {
            cancelled = true;
            document.removeEventListener('visibilitychange', onVisibilityChange);
            sentinel?.release().catch(() => {});
        };
    }, [isScrolling]);

    // Track whether the page is scrolled to (or has) no further content, so
    // the start button can be disabled when there is nowhere to go.
    useEffect(() => {
        const update = () => {
            const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
            setAtPageEnd(maxScroll <= 0 || window.scrollY >= maxScroll - 2);
        };
        // Measure after the content paints (its height isn't final here).
        const t = window.setTimeout(update, 60);
        window.addEventListener('scroll', update, { passive: true });
        window.addEventListener('resize', update);
        return () => {
            window.clearTimeout(t);
            window.removeEventListener('scroll', update);
            window.removeEventListener('resize', update);
        };
    }, [contentKey]);

    // Clean up on unmount.
    useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

    return { isScrolling, speed, slower, faster, toggle, stop, atPageEnd };
}
