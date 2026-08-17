// Draws the podium badge art: a cross in gold, silver and bronze.
//
//   node tools/make-badge-art.js
//
// Writes public/badges/palavra-{1,2,3}.png and -thumb.png. Committed to the
// repo rather than generated at build time: the URLs go into signed NIP-58
// badge definitions that live on relays forever, so the bytes behind them have
// to be stable and reviewable, not whatever a build step produced that day.
//
// PNG rather than SVG, which would have been a tenth of the code. These images
// are fetched by other people's Nostr clients, and a good number of them refuse
// SVG outright or sanitise it into nothing — an image format chosen for our
// convenience that half the audience won't render defeats the entire point of
// putting badges on a profile.
//
// No image library either. A cross is rectangles, and a PNG is three chunks
// around a zlib stream, so node:zlib is the only thing needed. Adding a
// native-binary dependency to draw two overlapping boxes would be a poor trade.

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'badges');

/** NIP-58 suggests 1024×1024 for `image` and something small for `thumb`. */
const IMAGE_SIZE = 512;
const THUMB_SIZE = 128;

/**
 * A Latin cross, in fractions of the canvas.
 *
 * The crossbar sits above centre rather than halfway down, which is what makes
 * it read as a cross rather than a plus sign.
 */
const CROSS = {
    vertical: { x0: 0.430, x1: 0.570, y0: 0.090, y1: 0.910 },
    horizontal: { x0: 0.235, x1: 0.765, y0: 0.285, y1: 0.425 },
};

/** Three stops each, light to dark, read top to bottom down the cross. The
    light top stop is what makes the metal look lit rather than flat. */
const METALS = {
    1: { name: 'gold', stops: [[255, 245, 190], [230, 168, 23], [140, 90, 11]] },
    2: { name: 'silver', stops: [[246, 248, 250], [188, 194, 201], [118, 125, 133]] },
    3: { name: 'bronze', stops: [[242, 205, 168], [193, 120, 60], [110, 59, 20]] },
};

/** A darker edge, so the shape still reads on a light background — profile
    grids are white as often as they are black. */
const OUTLINE_SCALE = 0.55;
const OUTLINE_WIDTH = 0.012;

const lerp = (a, b, t) => a + (b - a) * t;

/** The metal colour at a vertical position through the cross, 0 to 1. */
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

const inBox = (x, y, box) => x >= box.x0 && x <= box.x1 && y >= box.y0 && y <= box.y1;

/** Whether a point is inside the cross, optionally grown by `grow` for the
    outline pass. */
function inCross(x, y, grow = 0) {
    const swell = (box) => ({
        x0: box.x0 - grow, x1: box.x1 + grow, y0: box.y0 - grow, y1: box.y1 + grow,
    });
    return inBox(x, y, swell(CROSS.vertical)) || inBox(x, y, swell(CROSS.horizontal));
}

/**
 * RGBA pixels for one badge.
 *
 * Supersampled 4×4 per pixel. Without it the cross has visibly stepped edges
 * at thumbnail size, which is the size most clients actually show.
 */
function render(size, stops) {
    const pixels = Buffer.alloc(size * size * 4);
    const samples = 4;

    for (let py = 0; py < size; py++) {
        for (let px = 0; px < size; px++) {
            let inside = 0;
            let edge = 0;
            let sumT = 0;

            for (let sy = 0; sy < samples; sy++) {
                for (let sx = 0; sx < samples; sx++) {
                    const x = (px + (sx + 0.5) / samples) / size;
                    const y = (py + (sy + 0.5) / samples) / size;
                    if (inCross(x, y)) {
                        inside++;
                        // Position down the cross itself, so the gradient runs
                        // the length of the shape rather than of the canvas.
                        sumT += (y - CROSS.vertical.y0) / (CROSS.vertical.y1 - CROSS.vertical.y0);
                    } else if (inCross(x, y, OUTLINE_WIDTH)) {
                        edge++;
                    }
                }
            }

            const total = samples * samples;
            const offset = (py * size + px) * 4;
            if (inside === 0 && edge === 0) continue;

            const [r, g, b] = metalAt(stops, Math.min(1, Math.max(0, sumT / (inside || 1))));
            if (inside > 0) {
                // Body over outline where a pixel straddles both.
                const alpha = inside / total;
                const edgeAlpha = edge / total;
                const cover = Math.min(1, alpha + edgeAlpha);
                // Blend the two colours by how much of each the pixel holds,
                // then let `cover` carry the transparency.
                const mix = alpha / (alpha + edgeAlpha || 1);
                pixels[offset] = Math.round(lerp(r * OUTLINE_SCALE, r, mix));
                pixels[offset + 1] = Math.round(lerp(g * OUTLINE_SCALE, g, mix));
                pixels[offset + 2] = Math.round(lerp(b * OUTLINE_SCALE, b, mix));
                pixels[offset + 3] = Math.round(cover * 255);
            } else {
                pixels[offset] = Math.round(r * OUTLINE_SCALE);
                pixels[offset + 1] = Math.round(g * OUTLINE_SCALE);
                pixels[offset + 2] = Math.round(b * OUTLINE_SCALE);
                pixels[offset + 3] = Math.round((edge / total) * 255);
            }
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

mkdirSync(OUT_DIR, { recursive: true });
for (const [place, { name, stops }] of Object.entries(METALS)) {
    for (const [suffix, size] of [['', IMAGE_SIZE], ['-thumb', THUMB_SIZE]]) {
        const file = join(OUT_DIR, `palavra-${place}${suffix}.png`);
        writeFileSync(file, toPng(size, render(size, stops)));
        console.log(`${name.padEnd(6)} ${size}×${size}  →  public/badges/palavra-${place}${suffix}.png`);
    }
}
