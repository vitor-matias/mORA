/**
 * Vibration for the guided prayers, graded by what just happened, so the
 * phone in a pocket or a lap says more than "something was tapped".
 *
 * A bead is a tick: short enough to feel like a bead passing the thumb rather
 * than a buzz (the old 50ms pulse was a notification's length, on every one
 * of ~80 steps). Closing a decade is two, so the end of a mystery can be felt
 * without looking. Finishing is its own, longer figure, and fires once.
 *
 * Android only, in practice: iOS Safari has no Vibration API. The call is a
 * no-op wherever it is missing.
 */
const PATTERNS = {
    bead: 12,
    group: [12, 70, 24],
    complete: [20, 90, 20, 90, 40],
} satisfies Record<string, number | number[]>;

export type Haptic = keyof typeof PATTERNS;

export function haptic(kind: Haptic): void {
    if (typeof navigator === 'undefined') return;
    navigator.vibrate?.(PATTERNS[kind]);
}
