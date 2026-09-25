// Generate README.md from README.template.md + resources.yml.
// Usage: node scripts/build-readme.mjs [--check]   (--check fails if README.md is out of date)
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadData, imageFor, ROOT, SHOTS_DIR } from './lib/data.mjs';

const check = process.argv.includes('--check');
const README = join(ROOT, 'README.md');
const MARKER = '<!-- RESOURCES -->';
const HEADER = '<!-- Generated from resources.yml and README.template.md by `npm run build`. Edit those instead. -->\n';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Hover text: name, tags and note (GitHub shows it as a tooltip; screen readers get the alt text).
const tooltip = (e) => [e.name, e.tags.join(' · '), e.note].filter(Boolean).join(' · ');

function image(entry, width) {
  const title = esc(tooltip(entry));
  return `  <a href="${esc(entry.url)}"><img width="${width}" src=".github/images/${imageFor(entry)}" alt="${title}" title="${title}" /></a>`;
}

// Rows of three; a leftover pair shares a row half and half, and a single leftover gets the full width.
// (No <table>: GitHub always draws table borders.)
function rows(entries, columns) {
  const out = [];
  for (let i = 0; i < entries.length; i += columns) {
    const chunk = entries.slice(i, i + columns);
    const width = chunk.length === 1 ? '100%' : chunk.length === 2 ? '49%' : `${Math.floor(100 / chunk.length) - 1}%`;
    out.push(`<p align="center">\n${chunk.map((e) => image(e, width)).join('\n')}\n</p>`);
  }
  return out.join('\n\n');
}

function render() {
  let data;
  try {
    data = loadData();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  const { defaults, sections, entries } = data;
  const columns = defaults.columns ?? 3;
  const out = [];
  for (const section of sections) {
    out.push(`## ${section.emoji ? `${section.emoji} ` : ''}${section.title}`);
    if (section.intro) out.push(section.intro.trim());
    if (section.callout) out.push(`> [!${section.callout.type}]\n> ${section.callout.text.trim().replace(/\n/g, '\n> ')}`);
    for (const group of section.groups) {
      if (group.title) out.push(`#### ${group.title}`);
      out.push(rows(group.entries, columns));
    }
  }
  const template = readFileSync(join(ROOT, 'README.template.md'), 'utf8');
  if (!template.includes(MARKER)) throw new Error(`README.template.md is missing ${MARKER}`);
  return { readme: HEADER + template.replace(MARKER, out.join('\n\n').trim()), entries };
}

const { readme, entries } = render();

// Every image the README points at must exist.
const missing = [...readme.matchAll(/src="(\.github\/images\/[^"]+)"/g)].map((m) => m[1]).filter((p) => !existsSync(join(ROOT, p)));
if (missing.length) {
  console.error(`README references missing images:\n  ${missing.join('\n  ')}`);
  process.exit(1);
}

// Screenshots nobody uses any more (warn only).
const used = new Set(entries.map((e) => `${e.id}.webp`));
const orphans = existsSync(SHOTS_DIR) ? readdirSync(SHOTS_DIR).filter((f) => f.endsWith('.webp') && !used.has(f)) : [];
if (orphans.length) console.warn(`Unused screenshots (safe to delete): ${orphans.join(', ')}`);

const placeholders = entries.filter((e) => imageFor(e) === 'placeholder.webp').map((e) => e.id);
if (placeholders.length) console.warn(`Using placeholder image for: ${placeholders.join(', ')}`);

if (check) {
  const current = existsSync(README) ? readFileSync(README, 'utf8') : '';
  if (current !== readme) {
    console.error('README.md is out of date. Run `npm run build` and commit the result.');
    process.exit(1);
  }
  console.log('README.md is up to date.');
} else {
  writeFileSync(README, readme);
  console.log(`Wrote README.md (${entries.filter((e) => !e.extra).length} resources).`);
}
