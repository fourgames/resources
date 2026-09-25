// Turn your own screenshot into a pinned image for a site the bot can't capture.
// Usage: npm run add-screenshot -- <image file> <id>
// Screenshot just the page content (e.g. Cmd+Shift+4 and drag over the page, roughly 16:9).
// It gets the same rounded corners and shadow as the automatic screenshots.
// Then set `shot: { manual: manual/<id>.webp }` on that entry in resources.yml and run `npm run build`.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { IMAGES_DIR } from './lib/data.mjs';
import { frame } from './lib/frame.mjs';

const [file, id] = process.argv.slice(2);
if (!file || !/^[a-z0-9-]+$/.test(id ?? '')) {
  console.error('Usage: npm run add-screenshot -- <image file> <id>   (id: lowercase letters, digits, dashes)');
  process.exit(1);
}

const out = await frame(await sharp(file).png().toBuffer());

mkdirSync(join(IMAGES_DIR, 'manual'), { recursive: true });
const dest = join(IMAGES_DIR, 'manual', `${id}.webp`);
writeFileSync(dest, out);
console.log(`Saved ${dest} (${(out.length / 1024).toFixed(0)} KB)`);
console.log(`Now set this on "${id}" in resources.yml:  shot: { manual: manual/${id}.webp }`);
