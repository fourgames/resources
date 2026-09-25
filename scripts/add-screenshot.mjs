// Turn your own screenshot into a pinned image for a site the bot can't capture.
// Usage: npm run add-screenshot -- <image file> <id>
//   - A macOS window screenshot (Cmd+Shift+4, Space, click the window) already has a frame: it's just resized.
//   - Any other screenshot (fully opaque) gets the standard browser frame.
// Then set `shot: { manual: manual/<id>.webp }` on that entry in resources.yml and run `npm run build`.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { IMAGES_DIR } from './lib/data.mjs';
import { frame, encode, FRAME_SIZE } from './lib/frame.mjs';

const [file, id] = process.argv.slice(2);
if (!file || !/^[a-z0-9-]+$/.test(id ?? '')) {
  console.error('Usage: npm run add-screenshot -- <image file> <id>   (id: lowercase letters, digits, dashes)');
  process.exit(1);
}

// Window screenshots have transparent corners and shadow; plain screenshots are fully opaque.
const { isOpaque } = await sharp(file).stats();
const out = !isOpaque
  ? await encode(await sharp(file).resize({ width: FRAME_SIZE.width, kernel: 'lanczos3' }).png().toBuffer())
  : await frame(await sharp(file).toBuffer());

mkdirSync(join(IMAGES_DIR, 'manual'), { recursive: true });
const dest = join(IMAGES_DIR, 'manual', `${id}.webp`);
writeFileSync(dest, out);
console.log(`Saved ${dest} (${(out.length / 1024).toFixed(0)} KB)`);
console.log(`Now set this on "${id}" in resources.yml:  shot: { manual: manual/${id}.webp }`);
