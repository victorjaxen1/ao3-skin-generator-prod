/**
 * Shrink the bundled chrome and avatar PNGs in `public/assets`.
 *
 * Why this exists. The avatars shipped as 1024x768 full-colour PNGs — up to
 * 965KB each — for images painted as ~40px circles. A WhatsApp group scene
 * pulls several megabytes of them, and the PNG export gives an image 3 seconds
 * to arrive (`waitForImages` in ExportPanel) before it gives up and rasterises
 * without it. On a fast connection they land; on a slower one they silently do
 * not, and the exported PNG has blank gaps where the photos should be. That is
 * a real report from a real download, not a hypothetical.
 *
 * Two policies, because the assets are two different kinds of picture:
 *
 *   photos    resize to 640px wide and quantise to a 256-colour palette. 640
 *             covers the largest painted size (a .wa-image is ~157 CSS px, and
 *             a 3x export triples it) with headroom. 256 colours was chosen by
 *             looking: at the size these are actually painted, 256 is
 *             indistinguishable from the original and 128 visibly bands the
 *             skin tones and darkens the background.
 *
 *   graphics  quantise only, never resize. Logos and glyphs are flat colour, so
 *             a palette costs them nothing and they quantise extremely well —
 *             but they are crisp-edged, and downsampling one to save bytes
 *             would show. Preserve the geometry, take the palette win.
 *
 * The filenames never change. These URLs are absolutised into published work
 * skins and are live hotlinks from works already on AO3, so the bytes may be
 * replaced but the addresses may not.
 *
 * Idempotent: a file is only rewritten when the result is actually smaller, so
 * re-running does nothing on already-optimised assets.
 *
 * Usage:  node scripts/optimize-assets.mjs [--dry]
 */
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const DIR = path.join(process.cwd(), 'public', 'assets');
const DRY = process.argv.includes('--dry');
const MIN_BYTES = 120 * 1024;
const PHOTO_WIDTH = 640;
const COLOURS = 256;

// Photos are the ones that carry a real photographic image: the avatars, plus
// the two Twitter media samples. Everything else in here is chrome.
const isPhoto = (name) => /avatar|character-thread|upload-media/i.test(name);

const files = fs.readdirSync(DIR).filter((f) => f.toLowerCase().endsWith('.png'));
let before = 0;
let after = 0;
let changed = 0;

for (const name of files) {
  const file = path.join(DIR, name);
  const original = fs.readFileSync(file);
  before += original.length;

  if (original.length < MIN_BYTES) {
    after += original.length;
    continue;
  }

  const photo = isPhoto(name);
  let pipeline = sharp(original);
  if (photo) pipeline = pipeline.resize({ width: PHOTO_WIDTH, withoutEnlargement: true });
  const output = await pipeline
    .png({ palette: true, colours: COLOURS, compressionLevel: 9, effort: 10 })
    .toBuffer();

  if (output.length >= original.length) {
    after += original.length;
    console.log(`  skip  ${name} — already smaller than the optimised result`);
    continue;
  }

  const saved = ((1 - output.length / original.length) * 100).toFixed(1);
  console.log(
    `  ${photo ? 'photo' : 'chrome'} ${name.padEnd(30)} ` +
      `${String(Math.round(original.length / 1024)).padStart(4)}KB -> ` +
      `${String(Math.round(output.length / 1024)).padStart(4)}KB  (${saved}% smaller)`,
  );

  if (!DRY) fs.writeFileSync(file, output);
  after += output.length;
  changed += 1;
}

console.log(
  `\n${DRY ? '[dry run] ' : ''}${changed} file(s) rewritten. ` +
    `public/assets: ${Math.round(before / 1024)}KB -> ${Math.round(after / 1024)}KB ` +
    `(${((1 - after / before) * 100).toFixed(1)}% smaller).`,
);
