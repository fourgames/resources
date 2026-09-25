// Screenshot every resource, frame it, and replace the committed image only when the site visibly changed.
// Usage: node scripts/capture.mjs [--only id,id] [--force] [--concurrency 4]
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';
import { loadData, ROOT, SHOTS_DIR } from './lib/data.mjs';
import { capturePage, fetchImage } from './lib/page.mjs';
import { frame, FRAME_VERSION } from './lib/frame.mjs';
import { diffRatio } from './lib/diff.mjs';

const { values: args } = parseArgs({
  options: {
    only: { type: 'string' },
    force: { type: 'boolean', default: false },
    concurrency: { type: 'string', default: '4' },
  },
});

const DAY = 86_400_000;
const CACHE = join(ROOT, '.cache');
const MANIFEST = join(SHOTS_DIR, 'manifest.json');
mkdirSync(join(CACHE, 'raw'), { recursive: true });
mkdirSync(SHOTS_DIR, { recursive: true });

const { defaults, entries } = loadData();
const only = args.only ? new Set(args.only.split(',').map((s) => s.trim()).filter(Boolean)) : null;
if (only) for (const id of only) if (!entries.some((e) => e.id === id)) throw new Error(`--only: unknown id "${id}"`);

const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};
const report = [];
const now = new Date();

async function processEntry(context, entry) {
  const row = { id: entry.id, status: '', diff: '', kb: '', reason: '' };
  report.push(row);
  if (entry.shot.manual) return Object.assign(row, { status: 'manual' });
  if (entry.shot.skip && !only?.has(entry.id)) return Object.assign(row, { status: 'skipped' });

  const attempt = () => (entry.shot.image ? fetchImage(entry.shot.image) : capturePage(context, entry, defaults));
  let result = await attempt();
  if (!result.ok) {
    await new Promise((r) => setTimeout(r, 5000));
    result = await attempt();
  }
  if (!result.ok) return Object.assign(row, { status: 'failed', reason: result.reason });

  writeFileSync(join(CACHE, 'raw', `${entry.id}.png`), result.png);
  const next = await frame(result.png);
  const file = join(SHOTS_DIR, `${entry.id}.webp`);
  const meta = manifest[entry.id];
  row.kb = (next.length / 1024).toFixed(0);

  let replace = false;
  let reason = '';
  if (!existsSync(file)) [replace, reason] = [true, 'new'];
  else if (args.force) [replace, reason] = [true, 'forced'];
  else if (meta?.frameVersion !== FRAME_VERSION) [replace, reason] = [true, 'frame changed'];
  else {
    const ratio = await diffRatio(readFileSync(file), next);
    row.diff = `${(ratio * 100).toFixed(1)}%`;
    const ageDays = meta?.capturedAt ? (now - new Date(meta.capturedAt)) / DAY : Infinity;
    const threshold = entry.shot.diffThreshold ?? defaults.diffThreshold ?? 0.05;
    if (ratio <= threshold) reason = 'no visible change';
    else if (ageDays < (defaults.minAgeDays ?? 14)) reason = `changed, but image is only ${ageDays.toFixed(0)}d old`;
    else [replace, reason] = [true, 'site changed'];
  }

  if (replace) {
    writeFileSync(file, next);
    manifest[entry.id] = { capturedAt: now.toISOString(), frameVersion: FRAME_VERSION };
  }
  return Object.assign(row, { status: replace ? 'updated' : 'unchanged', reason });
}

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: defaults.viewport ?? { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  colorScheme: 'dark',
  reducedMotion: 'reduce',
  locale: 'en-US',
  timezoneId: 'UTC',
});

const queue = entries.filter((e) => !only || only.has(e.id));
const workers = Array.from({ length: Math.max(1, Number(args.concurrency)) }, async () => {
  while (queue.length) {
    const entry = queue.shift();
    const row = await processEntry(context, entry);
    console.log(`${row.status.padEnd(9)} ${entry.id.padEnd(22)} ${row.diff.padStart(6)} ${row.reason}`);
  }
});
await Promise.all(workers);
await browser.close();

// Keep the manifest in step with the data: drop ids that no longer exist.
const known = new Set(entries.map((e) => e.id));
for (const id of Object.keys(manifest)) if (!known.has(id)) delete manifest[id];
const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(MANIFEST, JSON.stringify(sorted, null, 2) + '\n');

report.sort((a, b) => a.id.localeCompare(b.id));
writeFileSync(join(CACHE, 'report.json'), JSON.stringify(report, null, 2));
const failed = report.filter((r) => r.status === 'failed');
const counts = Object.entries(Object.groupBy(report, (r) => r.status)).map(([k, v]) => `${v.length} ${k}`).join(', ');
console.log(`\n${counts}`);

if (process.env.GITHUB_STEP_SUMMARY) {
  const lines = [
    `### Screenshot capture: ${counts}`,
    '',
    '| id | status | diff | KB | reason |',
    '|---|---|---|---|---|',
    ...report.map((r) => `| ${r.id} | ${r.status === 'failed' ? '❌ failed' : r.status} | ${r.diff} | ${r.kb} | ${r.reason} |`),
  ];
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n');
}
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `failed_count=${failed.length}\n`);
