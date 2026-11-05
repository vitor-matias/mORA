import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore, SCROLL_LEVELS, scrollLevelIndex, scrollSpeedAt } from '@/store/app';

/** Quiet time after the gesture (and its momentum) before auto-scroll resumes. */
const SETTLE_MS = 200;

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
    // The speed lives in the persisted store rather than in component state,
    // so the +/- controls change the remembered speed: whatever pace was last
    // used comes back on the next reading, on either page, and the Profile
    // picker shows it. The store keeps a label; resolving it here is also what
    // keeps a corrupted stored value from reaching SCROLL_LEVELS.
    const speed = useAppStore((s) => scrollLevelIndex(s.autoScrollSpeed));
    const setAutoScrollSpeed = useAppStore((s) => s.setAutoScrollSpeed);

    const [isScrolling, setIsScrolling] = useState(false);
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
    // Set while the reader is moving the page by hand: the loop holds off
    // instead of fighting their drag or its momentum.
    const manualRef = useRef<{ fromY: number; settle?: number } | null>(null);

    const endManual = useCallback(() => {
        window.clearTimeout(manualRef.current?.settle);
        manualRef.current = null;
    }, []);

    const stop = useCallback(() => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        lastTimeRef.current = null;
        endManual();
        setIsScrolling(false);
    }, [endManual]);

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
            if (manualRef.current) {
                // Follow the reader's position so we resume from where they left it.
                scrollAccRef.current = window.scrollY;
            } else if (lastTimeRef.current !== null) {
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

    // Stepped off the live store value rather than the rendered one: a quick
    // double-tap fires both handlers before React re-renders, and a stale
    // closure would make the second tap repeat the first step.
    const stepSpeed = useCallback((delta: number) => {
        const current = scrollLevelIndex(useAppStore.getState().autoScrollSpeed);
        setAutoScrollSpeed(scrollSpeedAt(current + delta));
    }, [setAutoScrollSpeed]);

    const slower = useCallback(() => stepSpeed(-1), [stepSpeed]);
    const faster = useCallback(() => stepSpeed(1), [stepSpeed]);

    // A manual scroll that moves the page less than a screen (a nudge to catch
    // up with, or wait for, the text) only pauses the loop until the page
    // settles; moving it further means the reader is navigating, so it stops.
    // Judged by distance, not time, so slow nudges and trackpad inertia count.
    // touchmove rather than touchstart, so tapping the controls changes nothing.
    useEffect(() => {
        if (!isScrolling) return;
        let touching = false;
        const move = () => {
            if (!manualRef.current) manualRef.current = { fromY: window.scrollY };
            window.clearTimeout(manualRef.current.settle);
        };
        // Resume once input and momentum have both been quiet for a moment.
        const settle = () => {
            const m = manualRef.current;
            if (!m) return;
            if (Math.abs(window.scrollY - m.fromY) > window.innerHeight) { stop(); return; }
            if (touching) return;
            window.clearTimeout(m.settle);
            m.settle = window.setTimeout(endManual, SETTLE_MS);
        };
        // A finger landing mid-settle (catching the momentum) must hold the
        // pause; with no manual scroll under way, a tap on the controls is a no-op.
        const onTouchStart = () => {
            touching = true;
            window.clearTimeout(manualRef.current?.settle);
        };
        const onTouchEnd = () => { touching = false; settle(); };
        const onWheel = () => { move(); settle(); };
        window.addEventListener('touchstart', onTouchStart, { passive: true });
        window.addEventListener('touchmove', move, { passive: true });
        window.addEventListener('touchend', onTouchEnd, { passive: true });
        window.addEventListener('touchcancel', onTouchEnd, { passive: true });
        window.addEventListener('wheel', onWheel, { passive: true });
        window.addEventListener('scroll', settle, { passive: true });
        return () => {
            window.removeEventListener('touchstart', onTouchStart);
            window.removeEventListener('touchmove', move);
            window.removeEventListener('touchend', onTouchEnd);
            window.removeEventListener('touchcancel', onTouchEnd);
            window.removeEventListener('wheel', onWheel);
            window.removeEventListener('scroll', settle);
        };
    }, [isScrolling, stop, endManual]);

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
