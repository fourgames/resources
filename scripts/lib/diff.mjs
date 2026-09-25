import sharp from 'sharp';

const W = 160;
const H = 100;

const normalize = (buf) =>
  sharp(buf).flatten({ background: '#000' }).grayscale().resize(W, H, { fit: 'fill' }).blur(1).raw().toBuffer();

/** Share of pixels (0..1) that visibly differ between two images, ignoring tiny noise. */
export async function diffRatio(a, b) {
  const [x, y] = await Promise.all([normalize(a), normalize(b)]);
  let changed = 0;
  for (let i = 0; i < x.length; i++) if (Math.abs(x[i] - y[i]) > 32) changed++;
  return changed / x.length;
}
