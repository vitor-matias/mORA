import { createLucideIcon } from "lucide-react";

/**
 * A rosary: a loop of beads with the short strand hanging from the joining
 * bead. Built with `createLucideIcon` so it takes `size` and `strokeWidth`
 * exactly like the stock icons it sits beside.
 *
 * Laid out as an ellipse (rx 7.5, ry 6 around 12,8.5) rather than a circle:
 * the strand needs the bottom of the box, and a circle small enough to leave
 * room for it left the whole icon visibly narrower than its neighbours. Eight
 * beads is the most that fit — the gap between two of them is only a little
 * wider than a bead once the active tab thickens the stroke, and any more
 * would close the loop into a solid ring.
 */
export const Rosary = createLucideIcon("Rosary", [
    ["circle", { cx: "12", cy: "2.5", r: "1.1", key: "bead-n" }],
    ["circle", { cx: "17.3", cy: "4.26", r: "1.1", key: "bead-ne" }],
    ["circle", { cx: "19.5", cy: "8.5", r: "1.1", key: "bead-e" }],
    ["circle", { cx: "17.3", cy: "12.74", r: "1.1", key: "bead-se" }],
    ["circle", { cx: "12", cy: "14.5", r: "1.1", key: "bead-s" }],
    ["circle", { cx: "6.7", cy: "12.74", r: "1.1", key: "bead-sw" }],
    ["circle", { cx: "4.5", cy: "8.5", r: "1.1", key: "bead-w" }],
    ["circle", { cx: "6.7", cy: "4.26", r: "1.1", key: "bead-nw" }],
    ["path", { d: "M12 15.8v2.4", key: "strand" }],
    ["circle", { cx: "12", cy: "19.6", r: "1.1", key: "bead-drop" }],
]);
