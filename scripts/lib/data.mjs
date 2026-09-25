import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const IMAGES_DIR = join(ROOT, '.github', 'images');
export const SHOTS_DIR = join(IMAGES_DIR, 'shots');
export const PLACEHOLDER = 'placeholder.webp';

const byName = (a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });

export const slug = (s) =>
  s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Load resources.yml, validate it and return { defaults, sections, entries }. Throws on invalid data. */
export function loadData(file = join(ROOT, 'resources.yml')) {
  const raw = parse(readFileSync(file, 'utf8'));
  const errors = [];
  const defaults = raw.defaults ?? {};
  const knownTags = new Set(raw.tags ?? []);
  const ids = new Set();
  const urls = new Set();
  const entries = [];

  // Extras are captured like any entry but not listed in the grid (e.g. images used in the README intro).
  const extras = (raw.extras ?? []).map((e) => ({ ...e, id: e.id ?? slug(e.name ?? ''), tags: [], shot: e.shot ?? {}, extra: true }));
  for (const e of extras) {
    if (!e.name || !e.url) errors.push(`extras › ${e.name ?? '?'}: name and url are required`);
    if (ids.has(e.id)) errors.push(`extras › ${e.name}: duplicate id "${e.id}"`);
    ids.add(e.id);
    entries.push(e);
  }

  const sections = (raw.sections ?? []).map((section) => {
    if (!section.id || !section.title) errors.push(`section missing id/title: ${JSON.stringify(section)}`);
    const groups = (section.groups ?? []).map((group) => {
      const list = (group.entries ?? []).map((e) => {
        const where = `${section.id} › ${group.title ?? '(default)'} › ${e.name ?? '?'}`;
        if (!e.name || !e.url) errors.push(`${where}: name and url are required`);
        const id = e.id ?? slug(e.name ?? '');
        if (ids.has(id)) errors.push(`${where}: duplicate id "${id}"`);
        ids.add(id);
        if (urls.has(e.url)) errors.push(`${where}: duplicate url ${e.url}`);
        urls.add(e.url);
        for (const t of e.tags ?? []) if (!knownTags.has(t)) errors.push(`${where}: unknown tag "${t}"`);
        const shot = e.shot ?? {};
        if (shot.manual && !existsSync(join(IMAGES_DIR, shot.manual)))
          errors.push(`${where}: manual image not found: .github/images/${shot.manual}`);
        const entry = { ...e, id, tags: e.tags ?? [], shot, section: section.id };
        entries.push(entry);
        return entry;
      });
      return { title: group.title, entries: list.sort(byName) };
    });
    return { ...section, groups };
  });

  if (errors.length) {
    const err = new Error(`resources.yml is invalid:\n  - ${errors.join('\n  - ')}`);
    err.validation = errors;
    throw err;
  }
  return { defaults, sections, entries };
}

/** Path of the image (relative to .github/images) the README should show for an entry. */
export function imageFor(entry) {
  if (entry.shot.manual) return entry.shot.manual;
  const rel = `shots/${entry.id}.webp`;
  return existsSync(join(IMAGES_DIR, rel)) ? rel : PLACEHOLDER;
}
