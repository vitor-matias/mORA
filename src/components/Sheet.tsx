import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type ReactNode, type Ref, type RefObject } from 'react';
import {
    createSpring,
    prefersReducedMotion,
    project,
    rubberband,
    SPRING_MOMENTUM,
    SPRING_SMOOTH,
    VelocityTracker,
    type Spring,
} from '@/lib/motion';

// Disabled controls excluded: a disabled button cannot take focus, so making
// it the trap's first or last stop let Tab escape the dialog.
const FOCUSABLE_SELECTOR = 'button:not([disabled]), [href], input:not([disabled]), '
    + 'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Movement before a touch commits to dragging the sheet or scrolling it.
const HYSTERESIS = 8;

// From sm up a sheet is a centred card.
const WIDE = '(min-width: 640px)';

export interface SheetHandle {
    /** Animate out, then call onClose. */
    close(): void;
}

/**
 * Every modal in the app: the dim, the focus handling, and the motion.
 *
 * `variant="sheet"` is a bottom sheet on a phone — it rises from the bottom
 * edge, follows the finger when pulled down (from its grabber, or from
 * anywhere once its content is scrolled to the top), and a flick throws it
 * away: the release velocity is projected forward, and the sheet goes if
 * that lands past halfway, carrying the finger's speed into the spring. It
 * can be caught mid-flight, and it leaves the way it came. From sm up, and
 * for `variant="alert"` everywhere, it is a centred card that grows in from
 * 96% and shrinks back out the same way.
 *
 * Closing is always animated, so every close path inside goes through
 * `close()` on the ref (a SheetHandle); `onClose` fires once the exit has
 * finished, and the parent unmounts the sheet then. Escape closes.
 * `dismissible={false}` turns off the scrim tap and the drag, for a dialog
 * that wants its button pressed. Keystrokes stop here — Palavra reads bare letters page-wide as
 * guesses.
 *
 * Reduce Motion: the same timing, as a cross-fade in place. A drag still
 * moves the sheet — that motion is the user's own.
 */
export function Sheet({
    ref,
    onClose,
    labelledBy,
    variant = 'sheet',
    dismissible = true,
    initialFocus,
    className = '',
    children,
}: {
    ref?: Ref<SheetHandle>;
    onClose: () => void;
    labelledBy: string;
    variant?: 'sheet' | 'alert';
    dismissible?: boolean;
    initialFocus?: RefObject<HTMLElement | null>;
    /** Classes for the content area (spacing, alignment). */
    className?: string;
    children: ReactNode;
}) {
    // Followed live, not read once: a phone rotated (or a window widened)
    // past sm with a sheet open turns it into the centred card, and back.
    const [narrow, setNarrow] = useState(() => !window.matchMedia(WIDE).matches);
    useEffect(() => {
        const mq = window.matchMedia(WIDE);
        const onChange = () => setNarrow(!mq.matches);
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
    }, []);
    const bottomSheet = variant === 'sheet' && narrow;
    const scrimRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const bodyRef = useRef<HTMLDivElement>(null);
    const handleRef = useRef<HTMLDivElement>(null);
    const spring = useRef<Spring | null>(null);
    const height = useRef(0);
    // Set while the user's finger has moved the sheet, so Reduce Motion
    // renders what they are doing as movement rather than as a fade.
    const userMoved = useRef(false);
    // The form last shown (null before the first), and whether an exit is
    // under way — together they tell a layout switch from an opening.
    const shownAs = useRef<boolean | null>(null);
    const closing = useRef(false);
    const onCloseRef = useRef(onClose);
    useLayoutEffect(() => { onCloseRef.current = onClose; });

    // The spring's value is, for a bottom sheet, how far down it has been
    // pushed in px (0 = open, its height = gone); for a centred card, how
    // closed it is, 0 → 1.
    const closedValue = useCallback(
        () => (bottomSheet ? height.current || window.innerHeight : 1),
        [bottomSheet],
    );

    useLayoutEffect(() => {
        const scrim = scrimRef.current;
        const panel = panelRef.current;
        if (!scrim || !panel) return;
        height.current = panel.offsetHeight;
        const observer = new ResizeObserver(() => { height.current = panel.offsetHeight; });
        observer.observe(panel);

        const render = (v: number) => {
            const reduced = prefersReducedMotion() && !userMoved.current;
            const closed = bottomSheet
                ? Math.min(1, Math.max(0, v / (height.current || 1)))
                : Math.min(1, Math.max(0, v));
            scrim.style.opacity = String(1 - closed);
            if (reduced) {
                panel.style.transform = '';
                panel.style.opacity = String(1 - closed);
            } else if (bottomSheet) {
                panel.style.transform = `translate3d(0, ${v.toFixed(2)}px, 0)`;
                panel.style.opacity = '';
            } else {
                panel.style.transform = `scale(${(1 - 0.04 * closed).toFixed(4)})`;
                panel.style.opacity = String(1 - closed);
            }
        };
        const s = createSpring(closedValue(), render);
        spring.current = s;
        const switched = shownAs.current !== null && shownAs.current !== bottomSheet;
        shownAs.current = bottomSheet;
        if (!switched) {
            // Opening (or StrictMode's second run of the same mount).
            s.set(closedValue());
            s.to(0, { config: SPRING_SMOOTH });
        } else if (closing.current) {
            // The layout changed mid-exit: the exit is what was asked for.
            s.set(closedValue());
            onCloseRef.current();
        } else {
            // The layout changed while open: stay open, in the new form,
            // rather than play the entrance again.
            s.set(0);
        }
        return () => {
            observer.disconnect();
            s.stop();
        };
    }, [bottomSheet, closedValue]);

    // Out the way it came in. Aimed a little past closed and finished the
    // moment it gets there — the panel is out of sight then, and a critically
    // damped spring would otherwise spend another ~200ms creeping over the
    // last pixels while the dialog, invisible, still blocked the page.
    const exit = useCallback((velocity?: number) => {
        const closed = closedValue();
        closing.current = true;
        spring.current?.to(closed + (bottomSheet ? 24 : 0.15), {
            velocity,
            config: SPRING_SMOOTH,
            restWhen: (v) => v >= closed,
            onRest: () => {
                userMoved.current = false;
                onCloseRef.current();
            },
        });
    }, [bottomSheet, closedValue]);
    const close = useCallback(() => exit(), [exit]);
    useImperativeHandle(ref, () => ({ close }), [close]);

    // Where the sheet goes when let go: projected from the release speed,
    // so a short quick flick dismisses and a long slow drag back up does not.
    // A finger still moving up at release always keeps it.
    const release = useCallback((velocity: number) => {
        const s = spring.current;
        if (!s) return;
        const projected = s.value + project(velocity);
        if (dismissible && velocity > -100 && projected > height.current / 2) {
            exit(velocity);
        } else {
            s.to(0, { velocity, config: SPRING_MOMENTUM, onRest: () => { userMoved.current = false; } });
        }
    }, [dismissible, exit]);

    // Dragging. Touch events rather than pointer events for the finger: the
    // choice between moving the sheet and scrolling its content is made on
    // the first real move, and only a non-passive touchmove can still cancel
    // the scroll at that point (iOS Safari has no directional touch-action).
    // The mouse gets the grabber through pointer events.
    useEffect(() => {
        const panel = panelRef.current;
        const body = bodyRef.current;
        const handle = handleRef.current;
        if (!bottomSheet || !dismissible || !panel || !body || !handle) return;

        const tracker = new VelocityTracker();
        let drag: {
            startX: number;
            startY: number;
            origin: number;
            decided: 'drag' | 'scroll' | null;
            fromHandle: boolean;
        } | null = null;

        const begin = (x: number, y: number, fromHandle: boolean) => {
            const s = spring.current;
            if (!s) return;
            // A sheet still moving is caught where it is.
            const caught = s.animating;
            if (caught) {
                s.stop();
                closing.current = false;
            }
            drag = { startX: x, startY: y, origin: s.value, decided: caught ? 'drag' : null, fromHandle };
            tracker.reset();
            tracker.add(y);
        };
        const move = (x: number, y: number, cancel: () => void) => {
            if (!drag) return;
            const dx = x - drag.startX;
            const dy = y - drag.startY;
            const scrollable = body.scrollHeight > body.clientHeight + 1;
            const atTop = body.scrollTop <= 0;
            if (drag.decided === null) {
                // Pulling down on content already at its top would start the
                // scroller's own bounce; hold it off while deciding.
                if (drag.fromHandle || (atTop && dy > 0) || !scrollable) cancel();
                if (Math.abs(dx) < HYSTERESIS && Math.abs(dy) < HYSTERESIS) return;
                if (Math.abs(dx) > Math.abs(dy)) { drag.decided = 'scroll'; return; }
                drag.decided = drag.fromHandle || !scrollable || (atTop && dy > 0) ? 'drag' : 'scroll';
                if (drag.decided === 'scroll') return;
                // Track 1:1 from here, so crossing the threshold is no jump.
                drag.startY = y;
            }
            if (drag.decided !== 'drag') return;
            cancel();
            userMoved.current = true;
            const raw = drag.origin + (y - drag.startY);
            spring.current?.set(raw < 0 ? rubberband(raw, height.current) : raw);
            tracker.add(y);
        };
        // A sheet caught mid-flight and let go without moving is released
        // too, at no speed: it finishes opening, or closes if it was
        // already more than half gone.
        const end = () => {
            if (drag?.decided === 'drag') release(tracker.velocity());
            drag = null;
        };

        const onTouchStart = (e: TouchEvent) => {
            if (e.touches.length !== 1) { drag = null; return; }
            const t = e.touches[0];
            begin(t.clientX, t.clientY, handle.contains(e.target as Node));
        };
        const onTouchMove = (e: TouchEvent) => {
            const t = e.touches[0];
            if (!t) return;
            move(t.clientX, t.clientY, () => { if (e.cancelable) e.preventDefault(); });
        };
        const onPointerDown = (e: PointerEvent) => {
            if (e.pointerType !== 'mouse' || e.button !== 0) return;
            handle.setPointerCapture(e.pointerId);
            begin(e.clientX, e.clientY, true);
        };
        const onPointerMove = (e: PointerEvent) => {
            if (e.pointerType !== 'mouse') return;
            move(e.clientX, e.clientY, () => e.preventDefault());
        };
        const onPointerUp = (e: PointerEvent) => {
            if (e.pointerType !== 'mouse') return;
            end();
        };

        panel.addEventListener('touchstart', onTouchStart, { passive: true });
        panel.addEventListener('touchmove', onTouchMove, { passive: false });
        panel.addEventListener('touchend', end);
        panel.addEventListener('touchcancel', end);
        handle.addEventListener('pointerdown', onPointerDown);
        handle.addEventListener('pointermove', onPointerMove);
        handle.addEventListener('pointerup', onPointerUp);
        handle.addEventListener('pointercancel', onPointerUp);
        return () => {
            panel.removeEventListener('touchstart', onTouchStart);
            panel.removeEventListener('touchmove', onTouchMove);
            panel.removeEventListener('touchend', end);
            panel.removeEventListener('touchcancel', end);
            handle.removeEventListener('pointerdown', onPointerDown);
            handle.removeEventListener('pointermove', onPointerMove);
            handle.removeEventListener('pointerup', onPointerUp);
            handle.removeEventListener('pointercancel', onPointerUp);
        };
    }, [bottomSheet, dismissible, release]);

    // Focus goes into the dialog on mount and back to whatever opened it
    // once it has gone.
    useEffect(() => {
        const previouslyFocused = document.activeElement as HTMLElement | null;
        (initialFocus?.current ?? panelRef.current)?.focus();
        return () => previouslyFocused?.focus();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
    }, []);

    const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        event.stopPropagation();
        if (event.key === 'Escape') { close(); return; }
        if (event.key !== 'Tab') return;
        const focusable = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
        if (!focusable || focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    };

    return (
        <div className={`fixed inset-0 z-50 flex justify-center ${bottomSheet ? 'items-end' : 'items-center p-4'}`}>
            <div
                ref={scrimRef}
                aria-hidden="true"
                className="scrim absolute inset-0 touch-none"
                onClick={dismissible ? close : undefined}
            />
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={labelledBy}
                tabIndex={-1}
                onKeyDown={onKeyDown}
                className={`surface relative flex flex-col shadow-2xl outline-none ${
                    bottomSheet
                        // The page under a sheet that bounces past its
                        // resting place must not show: the ::after runs the
                        // sheet's own surface on down past the screen edge.
                        ? "w-full rounded-t-3xl border-b-0 max-h-[92dvh] pb-[env(safe-area-inset-bottom)] after:content-[''] after:absolute after:inset-x-[-1px] after:top-full after:h-screen after:bg-[rgb(var(--surface-bg))]"
                        : 'w-full max-w-sm rounded-3xl max-h-[85vh]'
                }`}
            >
                {bottomSheet && (
                    <div
                        ref={handleRef}
                        className="touch-none cursor-grab active:cursor-grabbing flex justify-center pt-2.5 pb-1 shrink-0"
                    >
                        <span aria-hidden="true" className="h-1.5 w-10 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                    </div>
                )}
                <div
                    ref={bodyRef}
                    className={`overflow-y-auto overscroll-contain px-6 pb-6 ${bottomSheet ? 'pt-2' : 'pt-6'} ${className}`}
                >
                    {children}
                </div>
            </div>
        </div>
    );
}
