// Draws the podium badge art: an open book in gold, silver and bronze.
//
//   npm run make-badge-art
//
// Writes public/badges/palavra-{1,2,3}.png and -thumb.png. Committed to the
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

/** Three stops each, light to dark, read top to bottom down the icon. The
    light top stop is what makes the metal look lit rather than flat. */
const METALS = {
    1: { name: 'gold', stops: [[255, 245, 190], [230, 168, 23], [140, 90, 11]] },
    2: { name: 'silver', stops: [[246, 248, 250], [188, 194, 201], [118, 125, 133]] },
    3: { name: 'bronze', stops: [[242, 205, 168], [193, 120, 60], [110, 59, 20]] },
};

const lerp = (a, b, t) => a + (b - a) * t;

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

const { subpaths, bounds } = place(ICON.path);

mkdirSync(OUT_DIR, { recursive: true });
for (const [place_, { name, stops }] of Object.entries(METALS)) {
    for (const [suffix, size] of [['', IMAGE_SIZE], ['-thumb', THUMB_SIZE]]) {
        const file = join(OUT_DIR, `palavra-${place_}${suffix}.png`);
        writeFileSync(file, toPng(size, render(size, stops, subpaths, bounds)));
        console.log(`${name.padEnd(6)} ${size}×${size}  →  public/badges/palavra-${place_}${suffix}.png`);
    }
}
