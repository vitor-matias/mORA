import { useEffect, useRef } from 'react';

/**
 * Fires `onRollover` when the app returns to the foreground and `computeKey`
 * yields a different value than it did last time (e.g. the local date, or the
 * default Mass date). Installed PWAs are resumed from the background with
 * days-old page state; this is the shared "it's a new day" signal that lets
 * each page re-anchor itself.
 *
 * Deliberately only checks on visibilitychange, not on a midnight timer: a
 * page being actively read must never be yanked to the next day mid-text.
 */
export function useDayRollover(computeKey: () => string, onRollover: () => void): void {
    const keyRef = useRef(computeKey());
    // Latest-render closures, so the event handler never acts on stale props.
    const cbRef = useRef({ computeKey, onRollover });
    useEffect(() => {
        cbRef.current = { computeKey, onRollover };
    });

    useEffect(() => {
        const check = () => {
            if (document.visibilityState !== 'visible') return;
            const next = cbRef.current.computeKey();
            if (next === keyRef.current) return;
            keyRef.current = next;
            cbRef.current.onRollover();
        };
        document.addEventListener('visibilitychange', check);
        return () => document.removeEventListener('visibilitychange', check);
    }, []);
}
