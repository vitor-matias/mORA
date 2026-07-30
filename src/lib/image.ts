/**
 * Turns a picked image file into a small square data URI suitable for a Nostr
 * profile (kind 0).
 *
 * The picture travels inside the profile event itself, so size is the whole
 * problem: relays cap event size, and a phone photo is several megabytes. We
 * cover-crop to a square, scale down, and step the quality until the encoded
 * result fits the budget below.
 */

/** Encoded budget for the data URI. Comfortably inside relay event limits
    while still looking sharp on a 64px avatar at 2×. */
export const MAX_AVATAR_BYTES = 24 * 1024;

const AVATAR_SIZE = 256;
const QUALITY_STEPS = [0.8, 0.65, 0.5, 0.4, 0.3];

export class ImageTooLargeError extends Error {
    bytes: number;
    constructor(bytes: number) {
        super(`A imagem continua demasiado grande (${Math.round(bytes / 1024)} kB).`);
        this.name = 'ImageTooLargeError';
        this.bytes = bytes;
    }
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
    if ('createImageBitmap' in window) {
        try {
            return await createImageBitmap(file);
        } catch {
            // Falls through to the <img> path — Safari has historically
            // refused some formats here that it will happily render.
        }
    }
    const url = URL.createObjectURL(file);
    try {
        return await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
            img.src = url;
        });
    } finally {
        // The bitmap is drawn to a canvas synchronously by the caller, but the
        // element keeps its own decoded copy, so the URL can go now.
        URL.revokeObjectURL(url);
    }
}

function encode(canvas: HTMLCanvasElement, type: string, quality: number): string | null {
    const url = canvas.toDataURL(type, quality);
    // A browser without the requested encoder silently hands back PNG.
    return url.startsWith(`data:${type}`) ? url : null;
}

/** Rough decoded size of a data URI's payload. */
function dataUrlBytes(dataUrl: string): number {
    const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
    return Math.floor((base64.length * 3) / 4);
}

export async function fileToAvatarDataUrl(file: File): Promise<string> {
    if (!file.type.startsWith('image/')) {
        throw new Error('O ficheiro escolhido não é uma imagem.');
    }

    const source = await loadBitmap(file);
    const width = 'width' in source ? source.width : 0;
    const height = 'height' in source ? source.height : 0;
    if (!width || !height) throw new Error('Não foi possível ler a imagem.');

    // Cover crop: take the largest centred square, so portraits and landscapes
    // both fill the circle instead of getting letterboxed.
    const side = Math.min(width, height);
    const sx = (width - side) / 2;
    const sy = (height - side) / 2;

    const canvas = document.createElement('canvas');
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Não foi possível processar a imagem.');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
    if ('close' in source) source.close();

    let smallest: string | null = null;
    for (const type of ['image/webp', 'image/jpeg']) {
        for (const quality of QUALITY_STEPS) {
            const encoded = encode(canvas, type, quality);
            if (!encoded) break; // encoder unavailable — try the next type
            if (dataUrlBytes(encoded) <= MAX_AVATAR_BYTES) return encoded;
            if (!smallest || encoded.length < smallest.length) smallest = encoded;
        }
    }

    throw new ImageTooLargeError(smallest ? dataUrlBytes(smallest) : 0);
}
