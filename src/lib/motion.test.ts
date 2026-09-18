import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createSpring, project, rubberband, SPRING_MOMENTUM, VelocityTracker } from './motion';

/** The suite runs in node: frames are driven by hand, 60 per second of a
    clock the test owns, so every run integrates exactly the same steps. */
let now = 0;
let queue: ((t: number) => void)[] = [];
const realPerformance = globalThis.performance;

function frames(n: number) {
    for (let i = 0; i < n; i++) {
        now += 1000 / 60;
        const run = queue;
        queue = [];
        run.forEach((cb) => cb(now));
    }
}

beforeEach(() => {
    now = 0;
    queue = [];
    const g = globalThis as Record<string, unknown>;
    g.requestAnimationFrame = (cb: (t: number) => void) => { queue.push(cb); return queue.length; };
    g.cancelAnimationFrame = () => { queue = []; };
    g.performance = { now: () => now };
});

afterEach(() => {
    const g = globalThis as Record<string, unknown>;
    delete g.requestAnimationFrame;
    delete g.cancelAnimationFrame;
    g.performance = realPerformance;
});

describe('createSpring', () => {
    it('settles on its target without overshoot when critically damped', () => {
        const seen: number[] = [];
        const s = createSpring(0, (v) => seen.push(v));
        s.to(100);
        frames(120);
        expect(s.value).toBe(100);
        expect(s.animating).toBe(false);
        expect(Math.max(...seen)).toBeLessThanOrEqual(100);
    });

    it('overshoots when under-damped', () => {
        const seen: number[] = [];
        const s = createSpring(0, (v) => seen.push(v), SPRING_MOMENTUM);
        s.to(100);
        frames(120);
        expect(Math.max(...seen)).toBeGreaterThan(100);
        expect(s.value).toBe(100);
    });

    it('turns around from where it is, with the speed it has', () => {
        const s = createSpring(0, () => {});
        s.to(100);
        frames(6);
        const at = s.value;
        const speed = s.velocity;
        expect(speed).toBeGreaterThan(0);
        s.to(0);
        frames(1);
        // No jump back to the start, and still carried forward for a moment
        // before turning — velocity is continuous through the retarget.
        expect(Math.abs(s.value - at)).toBeLessThan(speed / 30);
        expect(s.value).toBeGreaterThan(at);
        frames(120);
        expect(s.value).toBe(0);
    });

    it('takes a handed-over velocity', () => {
        const s = createSpring(0, () => {});
        s.to(0, { velocity: 1000 });
        frames(1);
        expect(s.value).toBeGreaterThan(10);
    });

    it('ends early when restWhen says so, and calls onRest once', () => {
        let rested = 0;
        const s = createSpring(0, () => {});
        s.to(124, { restWhen: (v) => v >= 100, onRest: () => { rested++; } });
        frames(120);
        expect(rested).toBe(1);
        expect(s.value).toBeGreaterThanOrEqual(100);
        expect(s.value).toBeLessThan(124);
    });

    it('stops where it is when caught', () => {
        let rested = 0;
        const s = createSpring(0, () => {});
        s.to(100, { onRest: () => { rested++; } });
        frames(5);
        const caught = s.value;
        s.stop();
        frames(60);
        expect(s.value).toBe(caught);
        expect(rested).toBe(0);
    });
});

describe('project', () => {
    it('carries a flick about half its speed in px at normal deceleration', () => {
        expect(project(2000)).toBeCloseTo(998, 0);
        expect(project(-300)).toBeCloseTo(-149.7, 1);
        expect(project(0)).toBe(0);
    });
});

describe('rubberband', () => {
    it('follows less the further it goes, and never reaches the dimension', () => {
        const a = rubberband(50, 700);
        const b = rubberband(500, 700);
        expect(a).toBeLessThan(50);
        expect(b - a).toBeLessThan(450);
        expect(rubberband(1e6, 700)).toBeLessThan(700);
        expect(rubberband(-50, 700)).toBeCloseTo(-a);
    });
});

describe('VelocityTracker', () => {
    it('measures over the recent samples', () => {
        const t = new VelocityTracker();
        t.add(0, 0);
        t.add(10, 10);
        t.add(20, 20);
        expect(t.velocity(20)).toBeCloseTo(1000);
    });

    it('ignores samples too close together to mean anything, and caps the rest', () => {
        const t = new VelocityTracker();
        t.add(0, 0);
        t.add(60, 0.2);
        expect(t.velocity(0.2)).toBe(0);
        const u = new VelocityTracker();
        u.add(0, 0);
        u.add(500, 10);
        expect(u.velocity(10)).toBe(8000);
    });

    it('reports no speed for a finger that stopped before lifting', () => {
        const t = new VelocityTracker();
        t.add(0, 0);
        t.add(50, 20);
        expect(t.velocity(300)).toBe(0);
    });
});
