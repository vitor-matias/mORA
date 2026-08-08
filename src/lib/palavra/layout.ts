/** Tailwind's `gap-1.5` in rem. The board's rows render this and the
    measurement that sizes them subtracts it, so both have to read the same
    number from the same place. */
const GAP_REM = 0.375;

/**
 * `gap-1.5` resolved against the current root font size.
 *
 * Not the 6px it comes to at the default 16px root. A reader who has raised
 * their browser or OS text size moves every `rem` on the page, and a hardcoded
 * 6 would then under-count five gaps of it and size the board too tall — the
 * same class of mistake as the fixed `30rem` this measurement replaced, just
 * smaller and harder to notice.
 *
 * mORA's own text-size control is not the case that bites: it sets CSS
 * variables scoped to reading content and leaves `rem` alone.
 */
export function gapPx(): number {
    const root = parseFloat(getComputedStyle(document.documentElement).fontSize);
    return GAP_REM * (Number.isFinite(root) && root > 0 ? root : 16);
}
