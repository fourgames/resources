import sharp from 'sharp';

// Bump when the frame look changes: every screenshot gets re-framed on the next capture run.
export const FRAME_VERSION = 2;

const W = 800; // output width; a full-width README image is ~830 CSS px, thumbnails far smaller
const PAD_X = 16;
const PAD_TOP = 12;
const PAD_BOTTOM = 24; // room for the drop shadow
const RADIUS = 12;
const WIN_W = W - PAD_X * 2; // 768
const WIN_H = Math.round((WIN_W * 9) / 16); // 432, 16:9 like the 1440x810 capture viewport
const H = PAD_TOP + WIN_H + PAD_BOTTOM;
const MAX_BYTES = 80 * 1024;

const svg = (w, h, body) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${body}</svg>`);

const mask = () => svg(WIN_W, WIN_H, `<rect width="${WIN_W}" height="${WIN_H}" rx="${RADIUS}" fill="#fff"/>`);

// A faint edge keeps dark pages from melting into GitHub's dark background.
const border = () =>
  svg(WIN_W, WIN_H, `<rect x=".5" y=".5" width="${WIN_W - 1}" height="${WIN_H - 1}" rx="${RADIUS}"
    fill="none" stroke="#fff" stroke-opacity=".12"/>`);

const shadow = () =>
  svg(W, H, `<defs><filter id="s" x="-10%" y="-10%" width="120%" height="130%">
      <feGaussianBlur stdDeviation="7"/></filter></defs>
    <rect x="${PAD_X}" y="${PAD_TOP + 5}" width="${WIN_W}" height="${WIN_H}" rx="${RADIUS}"
      fill="#000" fill-opacity=".45" filter="url(#s)"/>`);

/** Round the corners of a screenshot (any size, cropped to 16:9) and give it a soft drop shadow. Returns WebP. */
export async function frame(raw) {
  const card = await sharp(raw)
    .resize(WIN_W, WIN_H, { fit: 'cover', position: 'top', kernel: 'lanczos3' })
    .flatten({ background: '#000' })
    .composite([{ input: mask(), blend: 'dest-in' }, { input: border() }])
    .png()
    .toBuffer();

  const png = await sharp(shadow()).composite([{ input: card, top: PAD_TOP, left: PAD_X }]).png().toBuffer();
  return encode(png);
}

/** Encode to WebP, stepping quality down until it fits the size budget. */
export async function encode(input) {
  let out;
  for (const quality of [82, 74, 66, 58]) {
    out = await sharp(input).webp({ quality, alphaQuality: 90, effort: 6, smartSubsample: true }).toBuffer();
    if (out.length <= MAX_BYTES) return out;
  }
  console.warn(`Image is ${(out.length / 1024).toFixed(0)} KB even at quality 58 (budget ${MAX_BYTES / 1024} KB)`);
  return out;
}

export const FRAME_SIZE = { width: W, height: H };
