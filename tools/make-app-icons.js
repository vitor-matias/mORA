// Derives every home-screen and browser icon from one master image.
//
//   npm run make-app-icons
//
// Reads tools/icon-master-512.png and writes the six files in public/ that
// index.html and the PWA manifest point at. Committed to the repo rather than
// generated at build time, same as the badge art: these bytes end up cached in
// launchers and app switchers, so they want to be stable and reviewable.
//
// The master is deliberately *full bleed* — the praying hands on an unbroken
// #1D1D1D field, no rounded corners of its own. That is the shape Android's
// adaptive-icon pipeline wants, and it is the single fix for the icon looking
// like a small black square floating in a white circle: an icon that declares
// no `purpose: "maskable"` entry cannot be cropped by the launcher, so Chrome
// shrinks it onto a white plate instead. Given a maskable icon it crops to
// whatever shape the device uses and the artwork fills the whole slot.
//
// From that master this produces two families:
//
//   pwa-maskable-*   full bleed, opaque. The launcher supplies the shape.
//   pwa-*            the rounded square, with the corners cut to *transparent*
//                    rather than white. Used for `purpose: "any"` — desktop
//                    installs and the tab strip, which draw the icon as-is on
//                    a background we do not control.
//
// plus apple-touch-icon.png, which is opaque full bleed because iOS discards
// alpha (compositing it onto black) and applies its own corner radius.
//
// No dependencies, for the reasons make-badge-art.js gives at length: decoding
// a PNG is inflate plus an unfilter loop, and node:zlib already has the hard
// half. Adding a native image library to resize one picture would be a poor
// trade.

import { deflateSync, inflateSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MASTER = join(ROOT, 'tools', 'icon-master-512.png');
const OUT_DIR = join(ROOT, 'public');

/** Corner radius of the `purpose: "any"` icons, as a fraction of the edge.
    Matches the radius the previous hand-made icon had, so installs that keep
    showing the old artwork do not visibly change shape when they refresh. */
const CORNER_RADIUS = 0.145;

/** Sub-samples per axis when deciding how much of a corner pixel is inside the
    rounded rect. Four is enough for an edge that reads as smooth at 192px. */
const SUPERSAMPLE = 4;

const OUTPUTS = [
    { file: 'pwa-192x192.png', size: 192, rounded: true },
    { file: 'pwa-512x512.png', size: 512, rounded: true },
    { file: 'pwa-maskable-192x192.png', size: 192, rounded: false },
    { file: 'pwa-maskable-512x512.png', size: 512, rounded: false },
    { file: 'apple-touch-icon.png', size: 180, rounded: false },
];

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

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Reads the one PNG flavour the master is written in: 8-bit truecolour, no
    alpha, no interlace. Anything else throws rather than being guessed at —
    a silently misread master would produce six wrong icons. */
function readPng(path) {
    const file = readFileSync(path);
    if (!file.subarray(0, 8).equals(SIGNATURE)) throw new Error(`${path}: not a PNG`);

    let width = 0, height = 0;
    const idat = [];
    for (let at = 8; at < file.length;) {
        const length = file.readUInt32BE(at);
        const type = file.toString('ascii', at + 4, at + 8);
        const data = file.subarray(at + 8, at + 8 + length);
        at += 12 + length;

        if (type === 'IHDR') {
            width = data.readUInt32BE(0);
            height = data.readUInt32BE(4);
            const [depth, colour, compression, filter, interlace] = data.subarray(8);
            if (depth !== 8 || colour !== 2 || compression !== 0 || filter !== 0 || interlace !== 0) {
                throw new Error(`${path}: expected 8-bit non-interlaced RGB, got depth ${depth} colour ${colour} interlace ${interlace}`);
            }
        } else if (type === 'IDAT') {
            idat.push(data);
        } else if (type === 'IEND') {
            break;
        }
    }

    // Undo the per-scanline filters. `a` is the pixel to the left, `b` the one
    // above, `c` the one up-and-left; all read as zero off the edge of the image.
    const raw = inflateSync(Buffer.concat(idat));
    const stride = width * 3;
    const pixels = Buffer.alloc(stride * height);
    for (let y = 0; y < height; y++) {
        const filter = raw[y * (stride + 1)];
        const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
        for (let i = 0; i < stride; i++) {
            const a = i >= 3 ? pixels[y * stride + i - 3] : 0;
            const b = y > 0 ? pixels[(y - 1) * stride + i] : 0;
            const c = y > 0 && i >= 3 ? pixels[(y - 1) * stride + i - 3] : 0;
            let value = line[i];
            if (filter === 1) value += a;
            else if (filter === 2) value += b;
            else if (filter === 3) value += (a + b) >> 1;
            else if (filter === 4) {
                const p = a + b - c;
                const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
                value += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
            } else if (filter !== 0) {
                throw new Error(`${path}: unknown scanline filter ${filter}`);
            }
            pixels[y * stride + i] = value & 0xff;
        }
    }
    return { width, height, pixels };
}

/** 8-bit truecolour, with alpha only when the icon actually has transparent
    corners — an opaque RGBA icon would be a third larger for nothing. Every
    scanline uses filter 0; deflate does well enough on flat artwork like this
    that picking filters per line is not worth the code. */
function toPng(size, pixels, channels) {
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(size, 0);
    ihdr.writeUInt32BE(size, 4);
    ihdr[8] = 8;                          // bit depth
    ihdr[9] = channels === 4 ? 6 : 2;     // truecolour, with or without alpha
    ihdr[10] = 0;                         // deflate
    ihdr[11] = 0;                         // adaptive filtering
    ihdr[12] = 0;                         // no interlace

    const stride = size * channels;
    const raw = Buffer.alloc((stride + 1) * size);
    for (let y = 0; y < size; y++) {
        raw[y * (stride + 1)] = 0;
        pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
    }

    return Buffer.concat([
        SIGNATURE,
        chunk('IHDR', ihdr),
        chunk('IDAT', deflateSync(raw, { level: 9 })),
        chunk('IEND', Buffer.alloc(0)),
    ]);
}

// ── Resampling ───────────────────────────────────────────────────────────

/** Box filter: each destination pixel averages the source rectangle it covers,
    weighted by how much of each edge pixel falls inside. 512 → 192 is not a
    whole-number ratio, so nearest-neighbour would visibly break up the thin
    salmon linework the hands are drawn in. */
function resample(src, size) {
    const { width, height, pixels } = src;
    const out = Buffer.alloc(size * size * 3);
    const scaleX = width / size, scaleY = height / size;

    for (let y = 0; y < size; y++) {
        const top = y * scaleY, bottom = top + scaleY;
        for (let x = 0; x < size; x++) {
            const left = x * scaleX, right = left + scaleX;
            let r = 0, g = 0, b = 0, total = 0;

            for (let sy = Math.floor(top); sy < Math.min(Math.ceil(bottom), height); sy++) {
                const coverY = Math.min(bottom, sy + 1) - Math.max(top, sy);
                for (let sx = Math.floor(left); sx < Math.min(Math.ceil(right), width); sx++) {
                    const cover = coverY * (Math.min(right, sx + 1) - Math.max(left, sx));
                    const at = (sy * width + sx) * 3;
                    r += pixels[at] * cover;
                    g += pixels[at + 1] * cover;
                    b += pixels[at + 2] * cover;
                    total += cover;
                }
            }

            const at = (y * size + x) * 3;
            out[at] = Math.round(r / total);
            out[at + 1] = Math.round(g / total);
            out[at + 2] = Math.round(b / total);
        }
    }
    return out;
}

/** Adds an alpha channel that cuts the canvas down to a rounded square, the
    corners antialiased by subsampling. */
function roundCorners(rgb, size) {
    const radius = size * CORNER_RADIUS;
    const out = Buffer.alloc(size * size * 4);
    const step = 1 / SUPERSAMPLE;
    const samples = SUPERSAMPLE * SUPERSAMPLE;

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            let inside = 0;
            for (let sy = 0; sy < SUPERSAMPLE; sy++) {
                for (let sx = 0; sx < SUPERSAMPLE; sx++) {
                    const px = x + (sx + 0.5) * step, py = y + (sy + 0.5) * step;
                    // Clamp to the corner circle centres; on the straight
                    // edges this collapses to a zero-length distance.
                    const cx = Math.min(Math.max(px, radius), size - radius);
                    const cy = Math.min(Math.max(py, radius), size - radius);
                    const dx = px - cx, dy = py - cy;
                    if (dx * dx + dy * dy <= radius * radius) inside++;
                }
            }
            const from = (y * size + x) * 3, to = (y * size + x) * 4;
            out[to] = rgb[from];
            out[to + 1] = rgb[from + 1];
            out[to + 2] = rgb[from + 2];
            out[to + 3] = Math.round((inside / samples) * 255);
        }
    }
    return out;
}

// ── Entry point ──────────────────────────────────────────────────────────

const master = readPng(MASTER);
console.log(`master ${master.width}×${master.height}  ${MASTER.slice(ROOT.length + 1)}`);

for (const { file, size, rounded } of OUTPUTS) {
    const rgb = resample(master, size);
    const pixels = rounded ? roundCorners(rgb, size) : rgb;
    writeFileSync(join(OUT_DIR, file), toPng(size, pixels, rounded ? 4 : 3));
    console.log(`  ${size}×${size}`.padEnd(12) + (rounded ? 'rounded' : 'full bleed').padEnd(12) + `→  public/${file}`);
}
