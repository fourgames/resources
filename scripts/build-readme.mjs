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

function cell(entry, width) {
  const href = esc(entry.url);
  const lines = [
    `<a href="${href}"><img src=".github/images/${imageFor(entry)}" width="${width}" alt="${esc(entry.name)}"></a><br>`,
    `<a href="${href}"><b>${esc(entry.name)}</b></a>`,
  ];
  if (entry.tags.length) lines.push(`<br><sub>${entry.tags.map(esc).join(' · ')}</sub>`);
  if (entry.note) lines.push(`<br><sub><i>${esc(entry.note)}</i></sub>`);
  for (const link of entry.links) lines.push(`<br><sub><a href="${esc(link.url)}">${esc(link.label)}</a></sub>`);
  return lines.join('\n');
}

function table(entries, { columns, thumbWidth }) {
  const rows = [];
  const regular = entries.filter((e) => !e.featured);
  for (let i = 0; i < regular.length; i += columns) {
    const chunk = regular.slice(i, i + columns);
    const cells = chunk.map((e) => `<td align="center" valign="top" width="${Math.floor(100 / columns)}%">\n${cell(e, thumbWidth)}\n</td>`);
    while (cells.length < columns) cells.push(`<td width="${Math.floor(100 / columns)}%"></td>`);
    rows.push(`<tr>\n${cells.join('\n')}\n</tr>`);
  }
  for (const e of entries.filter((e) => e.featured)) {
    rows.push(`<tr>\n<td align="center" colspan="${columns}">\n${cell(e, thumbWidth * 2)}\n</td>\n</tr>`);
  }
  return `<table>\n${rows.join('\n')}\n</table>`;
}

function render() {
  const { defaults, sections, entries } = loadData();
  const opts = { columns: defaults.columns ?? 3, thumbWidth: defaults.thumbWidth ?? 240 };
  const out = [];
  for (const section of sections) {
    out.push(`## ${section.emoji ? `${section.emoji} ` : ''}${section.title}`);
    if (section.intro) out.push(section.intro.trim());
    if (section.callout) out.push(`> [!${section.callout.type}]\n> ${section.callout.text.trim().replace(/\n/g, '\n> ')}`);
    for (const group of section.groups) {
      if (group.title) out.push(`#### ${group.title}`);
      out.push(table(group.entries, opts));
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
  console.log(`Wrote README.md (${entries.length} resources).`);
}
