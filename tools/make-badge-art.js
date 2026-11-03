// Draws the podium badge art in gold, silver and bronze: one shape per month,
// for that month's theme, plus the original open book.
//
//   npm run make-badge-art
//
// Writes public/badges/palavra-{MM}-{1,2,3}.png and -thumb.png, Easter's
// palavra-pascoa-{1,2,3}.png, and the book's
// palavra-{1,2,3}.png. The book is no longer awarded, but definitions already
// signed point at it, so those files stay. Committed to the
// repo rather than generated at build time: the URLs go into signed NIP-58
// badge definitions that live on relays forever, so the bytes behind them have
// to be stable and reviewable, not whatever a build step produced that day.
//
// The shape is Material Symbols `menu_book`, Apache-2.0, path data taken
// verbatim from google/material-design-icons. Not the 📖 emoji, which would
// have been easier: the good emoji fonts (Apple Color Emoji chief among them)
// are proprietary, so a PNG traced from one is a licensing problem in a way an
// Apache-2.0 icon is not. And not hand-drawn either — the first attempt at that
// produced a convincing cardboard box.
//
// PNG rather than SVG, which would have been a tenth of the code. These images
// are fetched by other people's Nostr clients, and a good number of them refuse
// SVG outright or sanitise it into nothing — an image format chosen for our
// convenience that half the audience won't render defeats the entire point of
// putting badges on a profile.
//
// So this rasterises the path itself, with no dependencies: flatten the curves
// to polylines, scanline-fill with the nonzero rule SVG specifies, downsample
// for antialiasing, and wrap the pixels in the three chunks a PNG needs around
// a node:zlib stream. Adding a native-binary image library to fill one icon
// would be a poor trade.

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'badges');

/** NIP-58 suggests a large `image` and a small `thumb`. */
const IMAGE_SIZE = 512;
const THUMB_SIZE = 128;

/** Sub-samples per axis. The size that actually gets shown is the thumbnail,
    and unsampled edges step visibly there. */
const SUPERSAMPLE = 4;

/** Fraction of the canvas left empty around the icon, so it isn't flush to the
    edge when a client crops it to a circle. */
const PADDING = 0.08;

/**
 * Material Symbols `menu_book`, outlined, 24px — Apache-2.0.
 * google/material-design-icons, symbols/web/menu_book/materialsymbolsoutlined.
 *
 * Verbatim, including the trailing `M280-494Z` degenerate subpath. Its declared
 * viewBox is `0 -960 960 960`, so y runs from -960 to 0 — but nothing here
 * reads it: `place` fits the path to its own ink instead, which is why the
 * coordinates end up back on screen.
 */
const ICON = {
    path: 'M560-564v-68q33-14 67.5-21t72.5-7q26 0 51 4t49 10v64q-24-9-48.5-13.5T700-600q-38 0-73 9.5T560-564Zm0 220v-68q33-14 67.5-21t72.5-7q26 0 51 4t49 10v64q-24-9-48.5-13.5T700-380q-38 0-73 9t-67 27Zm0-110v-68q33-14 67.5-21t72.5-7q26 0 51 4t49 10v64q-24-9-48.5-13.5T700-490q-38 0-73 9.5T560-454ZM260-320q47 0 91.5 10.5T440-278v-394q-41-24-87-36t-93-12q-36 0-71.5 7T120-692v396q35-12 69.5-18t70.5-6Zm260 42q44-21 88.5-31.5T700-320q36 0 70.5 6t69.5 18v-396q-33-14-68.5-21t-71.5-7q-47 0-93 12t-87 36v394Zm-40 118q-48-38-104-59t-116-21q-42 0-82.5 11T100-198q-21 11-40.5-1T40-234v-482q0-11 5.5-21T62-752q46-24 96-36t102-12q58 0 113.5 15T480-740q51-30 106.5-45T700-800q52 0 102 12t96 36q11 5 16.5 15t5.5 21v482q0 23-19.5 35t-40.5 1q-37-20-77.5-31T700-240q-60 0-116 21t-104 59ZM280-494Z',
};

const lerp = (a, b, t) => a + (b - a) * t;

/** A circle as a polygon fine enough to look round at 512px: clockwise, or
    with `direction` -1 counter-wound, to cut a hole. */
function circle(cx, cy, r, direction = 1) {
    const points = Array.from({ length: 48 }, (_, i) => {
        const angle = direction * (i / 48) * 2 * Math.PI;
        return `${(cx + r * Math.cos(angle)).toFixed(2)} ${(cy + r * Math.sin(angle)).toFixed(2)}`;
    });
    return `M${points.join('L')}Z`;
}

/** A Latin cross, clockwise like `circle`, so overlaps add rather than cancel. */
function cross(cx, top, height, width, thickness) {
    const half = thickness / 2;
    const armY = top + height * 0.28;
    return `M${cx - half} ${top}h${thickness}v${height}h${-thickness}Z`
        + `M${cx - width / 2} ${armY}h${width}v${thickness}h${-width}Z`;
}

/** Sixteen beads and a crucifix. Material has no rosary, and the beads are the
    sign: fewer than a real decade so they stay separate dots at 36px. */
function rosary() {
    const beads = Array.from({ length: 16 }, (_, i) => {
        const angle = (i / 16) * 2 * Math.PI;
        return circle(480 + 270 * Math.cos(angle), 330 + 270 * Math.sin(angle), 46);
    });
    return [...beads, circle(480, 706, 40), cross(480, 760, 280, 190, 56)].join('');
}

const rect = (x, y, width, height) => `M${x} ${y}h${width}v${height}h${-width}Z`;

/** A falling drop, point up. */
const drop = (x, y, s) => `M${x} ${y}c${34 * s} ${60 * s} ${58 * s} ${100 * s} ${58 * s} ${140 * s}`
    + `c0 ${40 * s} ${-28 * s} ${65 * s} ${-58 * s} ${65 * s}`
    + `c${-30 * s} 0 ${-58 * s} ${-25 * s} ${-58 * s} ${-65 * s}`
    + `c0 ${-40 * s} ${24 * s} ${-80 * s} ${58 * s} ${-140 * s}Z`;

/** The Holy Name: IHS, the cross rising from the H. */
function ihs() {
    return rect(40, 340, 170, 90) + rect(80, 340, 90, 500) + rect(40, 750, 170, 90)
        + rect(290, 340, 100, 500) + rect(610, 340, 100, 500) + rect(290, 545, 420, 90)
        + 'M1000 340L1000 430L890 430C850 430 840 450 840 480C840 510 855 530 890 545L960 575'
        + 'C1015 600 1040 640 1040 700C1040 790 985 840 900 840L810 840L810 750L900 750'
        + 'C935 750 950 730 950 700C950 670 935 650 900 635L830 605C775 580 750 535 750 480'
        + 'C750 395 805 340 890 340Z'
        + cross(500, 40, 505, 230, 76);
}

/** Lent: the crown of thorns, two wavy branches woven into a ring. Each branch
    is an outer edge and a counter-wound inner one, so only the band fills. */
function crownOfThorns() {
    const branch = (phase) => {
        const edge = (offset, direction) => `M${Array.from({ length: 180 }, (_, i) => {
            const a = direction * (i / 180) * 2 * Math.PI;
            const r = 340 + 42 * Math.sin(8 * a + phase) + offset;
            return `${(500 + r * Math.cos(a)).toFixed(1)} ${(500 + r * Math.sin(a)).toFixed(1)}`;
        }).join('L')}Z`;
        return edge(32, 1) + edge(-32, -1);
    };
    const thorns = Array.from({ length: 16 }, (_, i) => {
        const degrees = (i / 16) * 360 + 11;
        const a = (degrees * Math.PI) / 180;
        const [cos, sin] = [Math.cos(a), Math.sin(a)];
        return flame(500 + 350 * cos, 500 + 350 * sin, degrees, 150, 46)
            + (i % 2 ? flame(500 + 330 * cos, 500 + 330 * sin, degrees + 180, 90, 36) : '');
    });
    return branch(0) + branch(Math.PI) + thorns.join('');
}

/** Our Lady of Fátima, as her statue shows her: the royal crown and halo, the
    open mantle with its embroidered border, the heart in its thorns above her
    joined hands, the rosary, the cloud and the holm oak. Material has no figure
    of her. Everything inside the mantle runs against its winding, so the nonzero
    fill cuts it out, and no two cuts may overlap, which would wind back to filled. */
function fatima() {
    // Only the arc clear of the mantle: a full ring would fill the cuts it crossed.
    const halo = Array.from({ length: 49 }, (_, i) => (lerp(128, 412, i / 48) * Math.PI) / 180);
    const arc = (r, angles) => angles.map((a) => `${(500 + r * Math.cos(a)).toFixed(1)} ${(300 + r * Math.sin(a)).toFixed(1)}`);

    const crown = [
        cross(500, -30, 62, 40, 14),
        circle(500, 52, 24),
        'M395 190C350 120 405 75 465 75L535 75C595 75 650 120 605 190Z',
        'M478 180L478 95C420 100 390 140 420 180Z',
        'M580 180C610 140 580 100 522 95L522 180Z',
        rect(385, 195, 230, 46),
        ...[420, 460, 500, 540, 580].map((x) => circle(x, 218, 9, -1)),
    ];

    const embroidery = Array.from({ length: 9 }, (_, i) => {
        const [x, y] = [lerp(395, 318, i / 8), lerp(470, 930, i / 8)];
        return circle(x, y, 9, -1) + circle(1000 - x, y, 9, -1);
    });

    const rosary = Array.from({ length: 4 }, (_, i) => {
        const t = i / 4;
        const [x, y] = [lerp(464, 500, t) - 8 * Math.sin(Math.PI * t), lerp(738, 845, t)];
        return circle(x, y, 9, -1) + circle(1000 - x, y, 9, -1);
    });

    const cloud = [[255, 1000, 58], [365, 990, 74], [500, 1040, 72], [635, 990, 74], [745, 1000, 58]];
    // Leaves small and apart, or the oak reads as a second cloud.
    const leaves = [[270, 1175, 28], [320, 1145, 32], [375, 1125, 30], [430, 1150, 30], [340, 1190, 26], [400, 1180, 26]]
        .flatMap(([cx, cy, r]) => [circle(cx, cy, r), circle(1000 - cx, cy, r)]);

    return [
        `M${arc(282, halo).join('L')}L${arc(268, [...halo].reverse()).join('L')}Z`,
        ...crown,
        'M425 238L575 238C600 280 625 335 650 400C672 450 682 520 690 600C702 720 715 820 728 900'
        + 'C732 930 738 950 745 970Q500 1005 255 970C262 950 268 930 272 900C285 820 298 720 310 600'
        + 'C318 520 328 450 350 400C375 335 400 280 425 238Z',
        // Face.
        'M500 262C450 262 440 365 500 405C560 365 550 262 500 262Z',
        // The mantle's open edges.
        'M418 420L345 945L372 952L436 430Z',
        'M564 430L628 952L655 945L582 420Z',
        ...embroidery,
        // The heart: flame, ring of thorns, heart.
        'M500 438C490 450 486 462 490 472L510 472C514 462 510 450 500 438Z',
        circle(500, 540, 62, -1) + circle(500, 540, 50),
        'M500 585L540 545C555 525 545 500 522 502C510 503 503 512 500 520C497 512 490 503 478 502C455 500 445 525 460 545Z',
        // Hands.
        'M500 610C480 645 470 680 470 720L530 720C530 680 520 645 500 610Z',
        ...rosary,
        circle(500, 858, 11, -1),
        circle(500, 878, 7, -1),
        'M493 893L493 912L476 912L476 926L493 926L493 965L507 965L507 926L524 926L524 912L507 912L507 893Z',
        ...cloud.map(([cx, cy, r]) => circle(cx, cy, r)),
        // The holm oak: trunk, two branches, leaves.
        'M478 1170L522 1170L540 1265L460 1265Z',
        'M480 1215L385 1155L400 1140L490 1185Z',
        'M510 1185L600 1140L615 1155L520 1215Z',
        ...leaves,
    ].join('');
}

/** The Immaculate Heart: a flame above it, a wreath of roses around it. */
function immaculateHeart() {
    const rose = (cx, cy) => Array.from({ length: 5 }, (_, i) => {
        const a = (i / 5) * 2 * Math.PI - Math.PI / 2;
        return circle(cx + 34 * Math.cos(a), cy + 34 * Math.sin(a), 28);
    }).join('');
    // Clear of the top, where the flame stands.
    const wreath = Array.from({ length: 18 }, (_, i) => (i / 18) * 360)
        .filter((fromTop) => fromTop > 30 && fromTop < 330)
        .map((fromTop) => {
            const a = ((fromTop - 90) * Math.PI) / 180;
            return rose(480 + 535 * Math.cos(a), -480 + 535 * Math.sin(a));
        });
    return FAVORITE + wreath.join('')
        // Narrow at the base, so the flame leaves the heart's two lobes showing.
        + flame(480, -715, -90, 310, 110)
        + flame(445, -725, -106, 190, 66, -10)
        + flame(515, -725, -74, 190, 66, 10);
}

/** The Old Testament: the Tablets of the Law, the light of Sinai above them. The
    numerals run against the tablets' winding, so the nonzero fill cuts them out;
    V and X are single outlines, because crossed bars would wind back to filled. */
function tablets() {
    const glyphs = {
        I: [20, (x, y) => `M${x} ${y}v90h20v-90Z`],
        V: [70, (x, y) => `M${x} ${y}l28 90h14l28-90h-18l-17 60-17-60Z`],
        X: [70, (x, y) => `M${x} ${y}l25 45-25 45h18l17-32 17 32h18l-25-45 25-45h-18l-17 32-17-32Z`],
    };
    const numeral = (text, cx, y) => {
        const width = [...text].reduce((sum, glyph) => sum + glyphs[glyph][0] + 10, -10);
        let x = cx - width / 2;
        return [...text].map((glyph) => {
            const [advance, draw] = glyphs[glyph];
            const path = draw(x, y);
            x += advance + 10;
            return path;
        }).join('');
    };
    const tablet = (x) => `M${x} 900V280C${x} 170 ${x + 70} 110 ${x + 180} 110C${x + 290} 110 ${x + 360} 170 ${x + 360} 280V900Z`;
    const rays = Array.from({ length: 9 }, (_, i) => {
        const degrees = -150 + 15 * i;
        const a = (degrees * Math.PI) / 180;
        return flame(500 + 470 * Math.cos(a), 520 + 470 * Math.sin(a), degrees, i % 2 ? 90 : 130, 40);
    });
    const rows = [270, 400, 530, 660, 790];
    return [
        ...rays,
        tablet(130),
        tablet(510),
        ...['I', 'II', 'III', 'IV', 'V'].map((text, i) => numeral(text, 310, rows[i])),
        ...['VI', 'VII', 'VIII', 'IX', 'X'].map((text, i) => numeral(text, 690, rows[i])),
    ].join('');
}

/** The Old Testament again: Noah's ark on the waters, under the rainbow. */
function noahsArk() {
    const rainbow = (outer, inner) => {
        const angles = Array.from({ length: 49 }, (_, i) => Math.PI * (1 + i / 48));
        const at = (r) => (a) => `${(500 + r * Math.cos(a)).toFixed(1)} ${(520 + r * Math.sin(a)).toFixed(1)}`;
        return `M${angles.map(at(outer)).join('L')}L${[...angles].reverse().map(at(inner)).join('L')}Z`;
    };
    const wave = (top, from, to) => {
        const edge = (y, xs) => xs.map((x) => `${x} ${(y + 22 * Math.sin(x / 70)).toFixed(1)}`);
        const xs = Array.from({ length: 41 }, (_, i) => from + ((to - from) * i) / 40);
        return `M${[...edge(top, xs), ...edge(top + 36, [...xs].reverse())].join('L')}Z`;
    };
    return [
        rainbow(470, 435),
        rainbow(405, 370),
        // The hull, its ends raised, and a plank cut against its winding.
        'M165 500C230 565 330 580 500 580C670 580 770 565 835 500C825 620 770 740 690 775L310 775C230 740 175 620 165 500Z',
        'M225 662Q500 712 775 662L785 640Q500 690 215 640Z',
        // The house: walls, roof and three windows, likewise cut.
        rect(330, 380, 340, 205),
        'M290 390L500 245L710 390Z',
        ...[395, 475, 555].map((x) => `M${x} 440v60h50v-60Z`),
        wave(800, 60, 940),
        wave(875, 170, 830),
    ].join('');
}

/** A tongue of flame, clockwise, from a base point outward along `degrees`. */
function flame(x, y, degrees, length, width, lean = 0) {
    const a = (degrees * Math.PI) / 180;
    const [dx, dy, nx, ny] = [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a)];
    const at = (along, across) => `${(x + dx * along + nx * across).toFixed(1)} ${(y + dy * along + ny * across).toFixed(1)}`;
    return `M${at(0, -width / 2)}Q${at(length * 0.55, -width * 0.6)} ${at(length, lean)}`
        + `Q${at(length * 0.6, width * 0.35)} ${at(0, width / 2)}Z`;
}

/** The Sacred Heart: the heart in an aureole of flame, bound with thorns, the
    cross rising from a flame above it and blood falling below. The thorns run
    against the heart's winding, so they cut through it and paint beyond it. */
function sacredHeart() {
    // Clear of the top, where the cross and its flame stand.
    const aureole = Array.from({ length: 26 }, (_, i) => (i / 26) * 360)
        .filter((fromTop) => fromTop > 32 && fromTop < 328)
        .map((fromTop, i) => {
            const degrees = fromTop - 90;
            const a = (degrees * Math.PI) / 180;
            return flame(480 + 475 * Math.cos(a), -480 + 475 * Math.sin(a), degrees, i % 2 ? 130 : 195, 74, i % 2 ? -20 : 20);
        });

    // Pointed at both ends, so the band leaves the heart as a thorn, not a stub.
    const centre = (x) => -470 - (x - 95) * 0.19 + 40 * Math.sin((Math.PI * (x - 95)) / 816);
    const thorns = [[55, centre(95)]];
    for (let i = 0; i <= 12; i++) {
        const x = 95 + 68 * i;
        thorns.push([x, centre(x) + 30]);
        // Short of the ends: a thorn past the heart's edge paints as a shard.
        if (i < 10 && i % 2) thorns.push([x + 34, centre(x + 34) + 86]);
    }
    thorns.push([928, centre(911)]);
    for (let i = 12; i >= 0; i--) {
        const x = 95 + 68 * i;
        thorns.push([x, centre(x) - 30]);
        if (i > 0 && i < 12 && i % 2 === 0) thorns.push([x - 34, centre(x - 34) - 86]);
    }

    return FAVORITE
        + `M${thorns.map(([x, y]) => `${x} ${y.toFixed(1)}`).join('L')}Z`
        + aureole.join('')
        + flame(480, -740, -90, 240, 170)
        + flame(390, -760, -112, 170, 100, -14)
        + flame(570, -760, -68, 170, 100, 14)
        + cross(480, -1180, 300, 190, 66)
        + drop(350, -230, 0.6) + drop(285, -290, 0.5);
}

/** The Star of Bethlehem: four long rays and four short, the lowest longest. */
function bethlehem() {
    // Heavy for a star, because a thinner one vanishes at 36px.
    const radii = [400, 115, 240, 115, 400, 115, 240, 115, 660, 115, 240, 115, 400, 115, 240, 115];
    return `M${radii.map((r, i) => {
        const a = (i / 16) * 2 * Math.PI - Math.PI / 2;
        return `${(500 + r * Math.cos(a)).toFixed(1)} ${(500 + r * Math.sin(a)).toFixed(1)}`;
    }).join('L')}Z`;
}

/** A ring around a head, clear of it. */
const halo = (cx, cy, r) => circle(cx, cy, r + 18) + circle(cx, cy, r, -1);

/** Easter: the cross in a burst of light. */
function easter() {
    const rays = [30, 60, 120, 150, 210, 240, 300, 330].map((degrees) => {
        const angle = (degrees * Math.PI) / 180;
        const at = (r, a) => `${(500 + r * Math.cos(a)).toFixed(1)} ${(338 + r * Math.sin(a)).toFixed(1)}`;
        return `M${at(275, angle)}L${at(440, angle - 0.11)}L${at(440, angle + 0.11)}Z`;
    });
    return cross(500, 40, 900, 460, 110) + rays.join('');
}

/** Material Symbols, filled, 24px — Apache-2.0, verbatim from
    google/material-design-icons, symbols/web/<name>/materialsymbolsoutlined/
    <name>_fill1_24px.svg. Filled because these get read at 36px beside a name.
    WINE_BAR alone drops its last subpath, a window that read as a wine level. */
const FAMILY_RESTROOM = 'M720-720q-33 0-56.5-23.5T640-800q0-33 23.5-56.5T720-880q33 0 56.5 23.5T800-800q0 33-23.5 56.5T720-720ZM680-80v-320q0-40-20.5-72T607-522l35-103q8-25 29.5-40t48.5-15q27 0 48.5 15t29.5 40l102 305H800v240H680ZM500-500q-25 0-42.5-17.5T440-560q0-25 17.5-42.5T500-620q25 0 42.5 17.5T560-560q0 25-17.5 42.5T500-500ZM220-720q-33 0-56.5-23.5T140-800q0-33 23.5-56.5T220-880q33 0 56.5 23.5T300-800q0 33-23.5 56.5T220-720ZM140-80v-280H80v-240q0-33 23.5-56.5T160-680h120q33 0 56.5 23.5T360-600v240h-60v280H140Zm300 0v-160h-40v-160q0-25 17.5-42.5T460-460h80q25 0 42.5 17.5T600-400v160h-40v160H440Z';
const WINE_BAR = 'M320-120v-80h120v-164q-86-14-143-80t-57-156v-240h480v240q0 90-57 156t-143 80v164h120v80H320Z';
const FAVORITE = 'm480-120-58-52q-101-91-167-157T150-447.5Q111-500 95.5-544T80-634q0-94 63-157t157-63q52 0 99 22t81 62q34-40 81-62t99-22q94 0 157 63t63 157q0 46-15.5 90T810-447.5Q771-395 705-329T538-172l-58 52Z';
const CANDLE = 'M480-640q-48 0-80-33.5T370-755q2-52 36.5-91.5T480-920q39 34 73.5 73.5T590-755q2 48-30 81.5T480-640Zm330 360q13 0 21.5-8.5T840-310q0-13-8.5-21.5T810-340q-13 0-21.5 8.5T780-310q0 13 8.5 21.5T810-280ZM720-80H240q-50 0-85-35t-35-85v-80h240v-240q0-33 23.5-56.5T440-600h80q33 0 56.5 23.5T600-520v240h104q-2-8-3-15t-1-15q0-46 32-78t78-32q46 0 78 32t32 78q0 38-22.5 67T840-204v4q0 50-35 85t-85 35Z';

/** Each month's shape. The Material ones gain the plain geometry that makes
    them the Holy Family and the chalice with its host rather than a restroom
    sign and a glass of wine. */
const MONTH_ICONS = {
    '01': ihs(),
    '02': FAMILY_RESTROOM + halo(220, -800, 105) + halo(720, -800, 105) + halo(500, -560, 80),
    '03': crownOfThorns(),
    '04': WINE_BAR + circle(480, -1030, 160),
    '05': fatima(),
    '06': sacredHeart(),
    '07': noahsArk(),
    '08': immaculateHeart(),
    '09': tablets(),
    '10': rosary(),
    '11': CANDLE,
    '12': bethlehem(),
};

/** Three stops each, light to dark, read top to bottom down the icon. The
    light top stop is what makes the metal look lit rather than flat. */
const METALS = {
    1: { name: 'gold', stops: [[255, 245, 190], [230, 168, 23], [140, 90, 11]] },
    2: { name: 'silver', stops: [[246, 248, 250], [188, 194, 201], [118, 125, 133]] },
    3: { name: 'bronze', stops: [[242, 205, 168], [193, 120, 60], [110, 59, 20]] },
};

/** The metal colour at a vertical position through the icon, 0 to 1. */
function metalAt(stops, t) {
    const [top, mid, bottom] = stops;
    const [from, to, local] = t < 0.5
        ? [top, mid, t / 0.5]
        : [mid, bottom, (t - 0.5) / 0.5];
    return [
        Math.round(lerp(from[0], to[0], local)),
        Math.round(lerp(from[1], to[1], local)),
        Math.round(lerp(from[2], to[2], local)),
    ];
}

// ── SVG path → polylines ─────────────────────────────────────────────────

/** Commands and numbers, in order. Numbers in path data may run together with
    no separator when a sign or a leading `.` marks the boundary. */
function tokenize(path) {
    const tokens = [];
    const re = /([MmLlHhVvCcSsQqTtZz])|(-?(?:\d*\.\d+|\d+))/g;
    let match;
    while ((match = re.exec(path)) !== null) {
        tokens.push(match[1] ?? Number(match[2]));
    }
    return tokens;
}

/** How finely to flatten a curve, from the size of its control polygon. One
    segment per two user units keeps facets under a pixel at 2048px. */
const flatness = (...points) => {
    let length = 0;
    for (let i = 1; i < points.length; i++) {
        length += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    }
    return Math.max(4, Math.ceil(length / 2));
};

/**
 * Flatten a path to closed polylines.
 *
 * Every subpath is closed whether or not it ends in `Z`: the fill rule only
 * has meaning for closed regions, and SVG closes an unclosed subpath itself
 * when filling it.
 */
function flatten(path) {
    const tokens = tokenize(path);
    const subpaths = [];
    let current = [];
    let x = 0, y = 0, startX = 0, startY = 0;
    // Reflected control point for the shorthand curve commands.
    let lastControl = null;
    let command = null;
    let i = 0;

    const moveTo = (nx, ny) => {
        if (current.length > 1) subpaths.push(current);
        current = [[nx, ny]];
        x = startX = nx;
        y = startY = ny;
    };
    const lineTo = (nx, ny) => {
        current.push([nx, ny]);
        x = nx;
        y = ny;
    };
    const quadTo = (cx, cy, nx, ny) => {
        const steps = flatness([x, y], [cx, cy], [nx, ny]);
        for (let s = 1; s <= steps; s++) {
            const t = s / steps;
            const u = 1 - t;
            current.push([
                u * u * x + 2 * u * t * cx + t * t * nx,
                u * u * y + 2 * u * t * cy + t * t * ny,
            ]);
        }
        lastControl = [cx, cy];
        x = nx;
        y = ny;
    };
    const cubicTo = (c1x, c1y, c2x, c2y, nx, ny) => {
        const steps = flatness([x, y], [c1x, c1y], [c2x, c2y], [nx, ny]);
        for (let s = 1; s <= steps; s++) {
            const t = s / steps;
            const u = 1 - t;
            current.push([
                u * u * u * x + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * nx,
                u * u * u * y + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * ny,
            ]);
        }
        lastControl = [c2x, c2y];
        x = nx;
        y = ny;
    };

    const num = () => tokens[i++];

    while (i < tokens.length) {
        if (typeof tokens[i] === 'string') {
            command = tokens[i++];
            if (command === 'Z' || command === 'z') {
                if (current.length > 1) subpaths.push(current);
                current = [[startX, startY]];
                x = startX;
                y = startY;
                lastControl = null;
                continue;
            }
        }
        const relative = command === command.toLowerCase();
        const dx = relative ? x : 0;
        const dy = relative ? y : 0;

        switch (command.toUpperCase()) {
            case 'M': {
                const nx = num() + dx;
                const ny = num() + dy;
                moveTo(nx, ny);
                // Subsequent coordinate pairs after an M are implicit L.
                command = relative ? 'l' : 'L';
                lastControl = null;
                break;
            }
            case 'L': lineTo(num() + dx, num() + dy); lastControl = null; break;
            case 'H': lineTo(num() + dx, y); lastControl = null; break;
            case 'V': lineTo(x, num() + dy); lastControl = null; break;
            case 'Q': quadTo(num() + dx, num() + dy, num() + dx, num() + dy); break;
            case 'T': {
                // Reflect the previous control point through the current one.
                const [cx, cy] = lastControl
                    ? [2 * x - lastControl[0], 2 * y - lastControl[1]]
                    : [x, y];
                quadTo(cx, cy, num() + dx, num() + dy);
                break;
            }
            case 'C':
                cubicTo(num() + dx, num() + dy, num() + dx, num() + dy, num() + dx, num() + dy);
                break;
            case 'S': {
                const [c1x, c1y] = lastControl
                    ? [2 * x - lastControl[0], 2 * y - lastControl[1]]
                    : [x, y];
                cubicTo(c1x, c1y, num() + dx, num() + dy, num() + dx, num() + dy);
                break;
            }
            default:
                throw new Error(`Unsupported path command: ${command}`);
        }
    }
    if (current.length > 1) subpaths.push(current);
    return subpaths;
}

// ── Rasteriser ───────────────────────────────────────────────────────────

/**
 * Coverage mask for the icon at `size`, supersampled.
 *
 * Scanline fill rather than a per-pixel point-in-shape test. Testing every
 * sub-sample against every edge is 4.2 million samples against several hundred
 * edges, which is thousands of times more work than walking each scanline once
 * and filling between crossings.
 *
 * Nonzero winding, which is what SVG's default `fill-rule` means and what this
 * icon is drawn for: the page lines are subpaths wound against the body, and
 * the even-odd rule would fill some of them solid.
 */
function coverage(size, subpaths) {
    const high = size * SUPERSAMPLE;
    const counts = new Uint8Array(size * size);

    // Edges as {x0,y0,x1,y1}, in device space, skipping horizontals — they
    // never cross a scanline and only invite division by zero.
    const edges = [];
    for (const points of subpaths) {
        for (let i = 0; i < points.length; i++) {
            const [ax, ay] = points[i];
            const [bx, by] = points[(i + 1) % points.length];
            if (ay !== by) edges.push([ax, ay, bx, by]);
        }
    }

    for (let row = 0; row < high; row++) {
        const y = (row + 0.5) / high;
        const crossings = [];
        for (const [ax, ay, bx, by] of edges) {
            if ((ay > y) === (by > y)) continue;
            const t = (y - ay) / (by - ay);
            // +1 downwards, -1 upwards: the winding direction at this crossing.
            crossings.push([ax + t * (bx - ax), by > ay ? 1 : -1]);
        }
        if (crossings.length === 0) continue;
        crossings.sort((a, b) => a[0] - b[0]);

        let winding = 0;
        for (let c = 0; c < crossings.length - 1; c++) {
            winding += crossings[c][1];
            if (winding === 0) continue;
            // Inside from this crossing to the next: mark the sub-samples in
            // between, accumulating into the pixel they belong to.
            const from = Math.max(0, Math.ceil(crossings[c][0] * high - 0.5));
            const to = Math.min(high - 1, Math.floor(crossings[c + 1][0] * high - 0.5));
            const py = Math.floor(row / SUPERSAMPLE);
            for (let col = from; col <= to; col++) {
                counts[py * size + Math.floor(col / SUPERSAMPLE)]++;
            }
        }
    }
    return counts;
}

/** RGBA pixels for one badge. */
function render(size, stops, subpaths, bounds) {
    const pixels = Buffer.alloc(size * size * 4);
    const counts = coverage(size, subpaths);
    const max = SUPERSAMPLE * SUPERSAMPLE;

    for (let py = 0; py < size; py++) {
        // The gradient is purely vertical, so it comes from the pixel's own row
        // and runs the height of the icon rather than of the canvas.
        const t = (((py + 0.5) / size) - bounds.top) / (bounds.bottom - bounds.top);
        const [r, g, b] = metalAt(stops, Math.min(1, Math.max(0, t)));

        for (let px = 0; px < size; px++) {
            const cover = Math.min(max, counts[py * size + px]);
            if (cover === 0) continue;
            const offset = (py * size + px) * 4;
            pixels[offset] = r;
            pixels[offset + 1] = g;
            pixels[offset + 2] = b;
            pixels[offset + 3] = Math.round((cover / max) * 255);
        }
    }
    return pixels;
}

// ── PNG container ────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
    const table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        table[n] = c;
    }
    return table;
})();

function crc32(buffer) {
    let c = -1;
    for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
}

function chunk(type, data) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
}

/** 8-bit RGBA, no interlace. Each scanline is prefixed with filter byte 0 —
    the "no filtering" case, which costs a little size and no correctness. */
function toPng(size, pixels) {
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(size, 0);
    ihdr.writeUInt32BE(size, 4);
    ihdr[8] = 8;   // bit depth
    ihdr[9] = 6;   // colour type: truecolour with alpha
    ihdr[10] = 0;  // deflate
    ihdr[11] = 0;  // adaptive filtering
    ihdr[12] = 0;  // no interlace

    const stride = size * 4;
    const raw = Buffer.alloc((stride + 1) * size);
    for (let y = 0; y < size; y++) {
        raw[y * (stride + 1)] = 0;
        pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
    }

    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', ihdr),
        chunk('IDAT', deflateSync(raw, { level: 9 })),
        chunk('IEND', Buffer.alloc(0)),
    ]);
}

// ── Entry point ──────────────────────────────────────────────────────────

/** The icon in 0..1 canvas space: centred, scaled to fit inside the padding,
    aspect ratio kept. */
function place(path) {
    const raw = flatten(path);

    // The icon's own ink, not its viewBox: `menu_book` is wider than it is
    // tall, and fitting the square viewBox would leave it looking shrunken.
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const points of raw) {
        for (const [x, y] of points) {
            minX = Math.min(minX, x); maxX = Math.max(maxX, x);
            minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        }
    }

    const usable = 1 - 2 * PADDING;
    const scale = Math.min(usable / (maxX - minX), usable / (maxY - minY));
    const offsetX = (1 - (maxX - minX) * scale) / 2;
    const offsetY = (1 - (maxY - minY) * scale) / 2;

    const subpaths = raw.map((points) => points.map(([x, y]) => [
        offsetX + (x - minX) * scale,
        offsetY + (y - minY) * scale,
    ]));
    return {
        subpaths,
        bounds: { top: offsetY, bottom: offsetY + (maxY - minY) * scale },
    };
}

const ARTWORK = [
    ['', ICON.path],
    ...Object.entries(MONTH_ICONS).map(([month, path]) => [`${month}-`, path]),
    // Awarded in place of March's or April's, whichever holds Easter that year.
    ['pascoa-', easter()],
];

mkdirSync(OUT_DIR, { recursive: true });
for (const [prefix, path] of ARTWORK) {
    const { subpaths, bounds } = place(path);
    for (const [place_, { name, stops }] of Object.entries(METALS)) {
        for (const [suffix, size] of [['', IMAGE_SIZE], ['-thumb', THUMB_SIZE]]) {
            const file = `palavra-${prefix}${place_}${suffix}.png`;
            writeFileSync(join(OUT_DIR, file), toPng(size, render(size, stops, subpaths, bounds)));
            console.log(`${name.padEnd(6)} ${size}×${size}  →  public/badges/${file}`);
        }
    }
}
