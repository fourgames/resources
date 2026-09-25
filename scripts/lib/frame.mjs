import sharp from 'sharp';

// Bump when the frame look changes: every screenshot gets re-framed on the next capture run.
export const FRAME_VERSION = 1;

const W = 800; // output width; thumbnails display at ~240 CSS px, so this covers 3x displays
const PAD_X = 16;
const PAD_TOP = 12;
const PAD_BOTTOM = 24; // room for the drop shadow
const BAR = 30; // title bar height
const RADIUS = 10;
const WIN_W = W - PAD_X * 2; // 768
const CONTENT_H = Math.round(WIN_W / 1.6); // 480, same aspect as the 1440x900 viewport
const WIN_H = BAR + CONTENT_H;
const H = PAD_TOP + WIN_H + PAD_BOTTOM;
const MAX_BYTES = 80 * 1024;

const svg = (w, h, body) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${body}</svg>`);

const titleBar = () => {
  const pillW = Math.round(WIN_W * 0.4);
  return svg(WIN_W, WIN_H, `
    <rect width="${WIN_W}" height="${BAR}" fill="#2b2b2d"/>
    <rect y="${BAR - 1}" width="${WIN_W}" height="1" fill="#000" fill-opacity=".45"/>
    <circle cx="16" cy="${BAR / 2}" r="5.5" fill="#ff5f57"/>
    <circle cx="34" cy="${BAR / 2}" r="5.5" fill="#febc2e"/>
    <circle cx="52" cy="${BAR / 2}" r="5.5" fill="#28c840"/>
    <rect x="${(WIN_W - pillW) / 2}" y="7" width="${pillW}" height="${BAR - 14}" rx="${(BAR - 14) / 2}" fill="#3c3c3f"/>`);
};

const windowMask = () =>
  svg(WIN_W, WIN_H, `<rect width="${WIN_W}" height="${WIN_H}" rx="${RADIUS}" fill="#fff"/>`);

const windowBorder = () =>
  svg(WIN_W, WIN_H, `<rect x=".5" y=".5" width="${WIN_W - 1}" height="${WIN_H - 1}" rx="${RADIUS}"
    fill="none" stroke="#fff" stroke-opacity=".14"/>`);

const shadow = () =>
  svg(W, H, `<defs><filter id="s" x="-10%" y="-10%" width="120%" height="130%">
      <feGaussianBlur stdDeviation="7"/></filter></defs>
    <rect x="${PAD_X}" y="${PAD_TOP + 5}" width="${WIN_W}" height="${WIN_H}" rx="${RADIUS}"
      fill="#000" fill-opacity=".45" filter="url(#s)"/>`);

/**
 * Wrap a raw page screenshot (any size, ~16:10) in a dark macOS-style browser window. Returns WebP.
 * fit 'cover' (default) crops to fill; 'contain' letterboxes, e.g. for 16:9 video thumbnails.
 */
export async function frame(raw, { fit = 'cover' } = {}) {
  const content = await sharp(raw)
    .resize(WIN_W, CONTENT_H, { fit, position: fit === 'contain' ? 'centre' : 'top', kernel: 'lanczos3', background: '#000' })
    .flatten({ background: '#000' })
    .toBuffer();

  const win = await sharp(titleBar())
    .composite([
      { input: content, top: BAR, left: 0 },
      { input: windowMask(), blend: 'dest-in' },
      { input: windowBorder() },
    ])
    .png()
    .toBuffer();

  const canvas = sharp(shadow()).composite([{ input: win, top: PAD_TOP, left: PAD_X }]);
  const png = await canvas.png().toBuffer();
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
