/**
 * Motion primitives for the few things in the app a finger can move or
 * interrupt: the floating tab bar, the bottom sheets, the collapsing header.
 *
 * A spring rather than a CSS transition, because a transition has a fixed
 * duration and restarts from its own start when it is retargeted — a bar
 * told to hide and then show again mid-slide snaps back to its curve's
 * origin. A spring retargets from wherever it is, at whatever speed it is
 * moving, so reversing it is continuous.
 *
 * Configured the way Apple's UIKit/SwiftUI springs are, by `response` (roughly
 * how long it takes to get there, in seconds) and `dampingRatio` (1 settles
 * without overshoot; below 1 overshoots). Critically damped is the default
 * for anything the app moves on its own; a little bounce is reserved for
 * motion a flick handed over, where overshoot reads as momentum.
 */

export interface SpringConfig {
    response: number;
    dampingRatio: number;
}

/** App-initiated motion: no overshoot. */
export const SPRING_SMOOTH: SpringConfig = { response: 0.35, dampingRatio: 1 };
/** After a released drag: the drawer/sheet values Apple ships. */
export const SPRING_MOMENTUM: SpringConfig = { response: 0.3, dampingRatio: 0.8 };

export interface Spring {
    /** The value on screen right now — what an interruption starts from. */
    readonly value: number;
    /** Units per second. */
    readonly velocity: number;
    readonly animating: boolean;
    /**
     * Retarget. Keeps the current velocity unless one is given. `restWhen`
     * ends the motion early, where it is — for an exit, which is over once
     * the thing is out of sight, not once it has crept the last pixel.
     */
    to(target: number, options?: {
        velocity?: number;
        config?: SpringConfig;
        onRest?: () => void;
        restWhen?: (value: number) => boolean;
    }): void;
    /** Move without animating, e.g. under a finger. Zeroes the velocity. */
    set(value: number): void;
    /** Stop where it is — a grab mid-flight. */
    stop(): void;
}

// Integrated in fixed small steps: a dropped frame then costs extra steps
// rather than one large, unstable one.
const STEP = 1 / 240;

export function createSpring(
    initial: number,
    onUpdate: (value: number) => void,
    config: SpringConfig = SPRING_SMOOTH,
): Spring {
    let value = initial;
    let velocity = 0;
    let target = initial;
    let cfg = config;
    let frame = 0;
    let last = 0;
    let onRest: (() => void) | undefined;
    let restWhen: ((value: number) => boolean) | undefined;

    const rest = () => {
        velocity = 0;
        frame = 0;
        restWhen = undefined;
        onUpdate(value);
        const done = onRest;
        onRest = undefined;
        done?.();
    };

    const tick = (now: number) => {
        // At most two frames' worth: a tab that was in the background
        // resumes where it was rather than integrating the whole gap.
        let remaining = Math.min(Math.max(0, (now - last) / 1000), 1 / 30);
        last = now;
        const stiffness = (2 * Math.PI / cfg.response) ** 2;
        const damping = (4 * Math.PI * cfg.dampingRatio) / cfg.response;
        while (remaining > 0) {
            const h = Math.min(STEP, remaining);
            velocity += (-stiffness * (value - target) - damping * velocity) * h;
            value += velocity * h;
            remaining -= h;
        }
        if (restWhen?.(value)) {
            rest();
            return;
        }
        if (Math.abs(value - target) < 0.1 && Math.abs(velocity) < 2) {
            value = target;
            rest();
            return;
        }
        onUpdate(value);
        frame = requestAnimationFrame(tick);
    };

    const cancel = () => {
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
    };

    return {
        get value() { return value; },
        get velocity() { return velocity; },
        get animating() { return frame !== 0; },
        to(next, options) {
            target = next;
            if (options?.velocity !== undefined) velocity = options.velocity;
            if (options?.config) cfg = options.config;
            onRest = options?.onRest;
            restWhen = options?.restWhen;
            if (!frame) {
                last = performance.now();
                frame = requestAnimationFrame(tick);
            }
        },
        set(next) {
            cancel();
            value = target = next;
            velocity = 0;
            onRest = undefined;
            restWhen = undefined;
            onUpdate(value);
        },
        stop() {
            cancel();
            target = value;
            velocity = 0;
            onRest = undefined;
            restWhen = undefined;
        },
    };
}

/**
 * How far past its release point a flick would carry — the exponential decay
 * UIScrollView uses, from Apple's Designing Fluid Interfaces sample. 0.998 is
 * normal scroll deceleration: a 2000px/s flick carries ~1000px, enough to
 * throw away even a tall sheet, while a 300px/s let-go carries ~150px. (0.99
 * lands five times sooner; measured on the 750px Como jogar sheet, a real
 * flick then fell short of halfway and the sheet came back.)
 */
export function project(velocity: number, decelerationRate = 0.998): number {
    return (velocity / 1000) * decelerationRate / (1 - decelerationRate);
}

/** Past an edge, follow the finger less the further it goes. */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
    return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

// px/s — well above any real flick (~2000–5000).
const MAX_VELOCITY = 8000;

/**
 * Release velocity from the last ~100ms of samples, not the last pair: two
 * pointer events a millisecond apart give a wild number, and a finger that
 * stopped before lifting should hand over no speed at all.
 */
export class VelocityTracker {
    private samples: { t: number; y: number }[] = [];

    add(y: number, t = performance.now()) {
        this.samples.push({ t, y });
        while (this.samples.length > 2 && t - this.samples[0].t > 100) this.samples.shift();
    }

    reset() {
        this.samples = [];
    }

    /**
     * Units per second. Samples closer together than a few milliseconds
     * (coalesced events) say nothing reliable about speed, and one bad pair
     * must not be able to fling a sheet at 100,000px/s — hence the floor on
     * the span and the cap on the result.
     */
    velocity(now = performance.now()): number {
        const recent = this.samples.filter((s) => now - s.t <= 100);
        if (recent.length < 2) return 0;
        const first = recent[0];
        const lastSample = recent[recent.length - 1];
        const dt = (lastSample.t - first.t) / 1000;
        if (dt < 0.004) return 0;
        const v = (lastSample.y - first.y) / dt;
        return Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, v));
    }
}

export function prefersReducedMotion(): boolean {
    return typeof window !== 'undefined'
        && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}
