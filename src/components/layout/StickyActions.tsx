import type { ReactNode } from "react";

/**
 * The back/advance row at the foot of a guided prayer page, stuck to the
 * bottom of the viewport instead of sitting at the end of the page.
 *
 * A bead is turned by tapping the button, so the button has to be there at
 * every step. On the long steps — a mystery announcement, the Salve Rainha,
 * any of the chaplet prayers at a large reading size — the card grew past
 * the fold and finishing a bead meant scrolling down to look for Continuar
 * first.
 *
 * `clearsBottomBar` lifts the buttons over the floating tab bar for the
 * steps where the bar is still on screen (before praying starts); once the
 * page yields the bar, they drop to the bar's own inset. At xl the navigation
 * lives in the top bar and only breathing room is left.
 *
 * The clearance is padding inside the rail rather than a `bottom` offset:
 * stuck at bottom-0 the frosted fill runs to the edge of the screen, so no
 * strip of the card is left showing beneath the buttons.
 */
export function StickyActions({
    clearsBottomBar = false,
    children,
}: {
    clearsBottomBar?: boolean;
    children: ReactNode;
}) {
    return (
        <div
            className={`action-rail sticky bottom-0 z-20 -mx-6 px-6 pt-4 flex items-stretch gap-3 xl:pb-8 ${
                clearsBottomBar
                    ? 'pb-[calc(5.5rem+env(safe-area-inset-bottom))]'
                    : 'pb-[calc(0.75rem+env(safe-area-inset-bottom))]'
            }`}
        >
            {children}
        </div>
    );
}
