/**
 * Download the published-site-skin corpus that SITE-SKIN-IMPLEMENTATION.md §16
 * is based on: every repository belonging to two prolific AO3 skin authors.
 *
 *   node scripts/ao3-fetch-corpus.mjs <outdir>
 *
 * Then:
 *   npx tsx scripts/ao3-corpus-differential.mjs <outdir>
 *
 * Public repos, unauthenticated API. Nothing here is redistributed — the corpus
 * is read to calibrate our sanitizer model and is not checked in.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

const OWNERS = ['memorizingthedigitsofpi', 'Ao3SiteSkins'];
const out = process.argv[2];
if (!out) {
  console.error('usage: node scripts/ao3-fetch-corpus.mjs <outdir>');
  process.exit(1);
}
fs.mkdirSync(out, { recursive: true });

for (const owner of OWNERS) {
  const res = await fetch(`https://api.github.com/users/${owner}/repos?per_page=100`);
  if (!res.ok) throw new Error(`${owner}: ${res.status} ${res.statusText}`);
  const repos = await res.json();
  console.log(`${owner}: ${repos.length} repositories`);
  for (const r of repos) {
    const dest = path.join(out, `${r.name}.tar.gz`);
    if (fs.existsSync(dest)) continue;
    const tar = await fetch(`https://codeload.github.com/${r.full_name}/tar.gz/refs/heads/${r.default_branch}`);
    if (!tar.ok) {
      console.warn(`  skip ${r.name}: ${tar.status}`);
      continue;
    }
    await pipeline(tar.body, fs.createWriteStream(dest));
    console.log(`  ${r.name} (${r.stargazers_count}★)`);
  }
}
console.log(`\nNow extract them: for f in ${out}/*.tar.gz; do tar --force-local -xzf "$f" -C ${out}; done`);
