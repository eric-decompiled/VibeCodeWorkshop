#!/usr/bin/env node
// Snapshot every historical index.html into history/vNN-<slug>.html.
// Run: npm run build:history

import { execFileSync } from 'node:child_process';
import { writeFileSync, readdirSync, unlinkSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(repoRoot, 'history');

const git = (...args) =>
  execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const slugify = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'version';

// Rewrite relative `assets/...` references so snapshots in /history/ still resolve them
// from the repo root at /assets/...
// Rewrite every quoted `assets/...` literal — covers HTML attrs, fetch(),
// loadAudio('assets/...'), inline JS string concatenation, etc.
const fixAssetPaths = (html) => html.replace(/(["'])assets\//g, '$1../assets/');

// Wipe previous snapshots (but not manifest until we write it).
mkdirSync(outDir, { recursive: true });
for (const f of readdirSync(outDir)) {
  if (/^v\d+-.*\.html$/.test(f) || f === 'manifest.json') unlinkSync(join(outDir, f));
}

// Use `main` (not HEAD) so snapshots include commits past a detached checkout.
const log = git('log', '--reverse', '--pretty=%H|%h|%s|%aI', 'main', '--', 'index.html')
  .trim()
  .split('\n')
  .filter(Boolean);

const manifest = [];
let n = 0;

for (const line of log) {
  const [full, hash, subject, date] = line.split('|');
  let html;
  try {
    html = git('show', `${full}:index.html`);
  } catch {
    continue;
  }
  n += 1;
  const num = String(n).padStart(2, '0');
  const file = `v${num}-${slugify(subject)}.html`;
  writeFileSync(join(outDir, file), fixAssetPaths(html));
  manifest.push({ n, hash, subject, date, file });
}

writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

console.log(`wrote ${manifest.length} snapshots to ${outDir}`);
