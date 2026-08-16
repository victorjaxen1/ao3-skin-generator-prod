/**
 * Capture one preview image per starter example for `public/examples-gallery.html`.
 *
 * The gallery's chat cards were screenshots of a product that no longer exists —
 * taken before the August platform rebuilds, and served from a third-party host
 * (`media.publit.io`) that nothing in this repository can keep in step. This
 * script replaces both problems at once: the shots come from a build of the
 * current tree, and they are written into `public/gallery/` so the app's own
 * host serves them.
 *
 * Usage:
 *   node scripts/capture-gallery-cards.mjs [baseUrl] [idFilter]
 *
 * Defaults to http://127.0.0.1:3500 and every example in `examples.ts`. The
 * optional second argument is a substring, so a single card can be re-taken:
 *
 *   node scripts/capture-gallery-cards.mjs http://127.0.0.1:3500 twitter-video
 *
 * Run it against a local production build, never the live site, or the pictures
 * will show whatever is deployed rather than what is being shipped.
 *
 * Three properties are borrowed from `capture-hero.mjs` and each one was learned
 * the hard way — see §6 of docs/RENDER-DEFECTS-AND-GALLERY-HANDOFF.md:
 *
 *  - the shutter goes on the **DOM**, not on Save PNG, because html2canvas is a
 *    third renderer with its own defects and a promotional image must not ship
 *    one;
 *  - the scene is lifted onto a bare page, because the export bar and the
 *    consent banner are fixed and will paint across a naive screenshot;
 *  - analytics is declined, because a marketing screenshot must never imply
 *    consent was given.
 *
 * And one that is this script's own: **a failed image request fails the run.**
 * Learning 24 is that a missing picture which resolves like a present one
 * silently deletes work. A gallery card whose avatars did not load is exactly
 * that defect, published.
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const baseUrl = process.argv[2] || 'http://127.0.0.1:3500';
const idFilter = process.argv[3] || '';
const outDir = path.join(repoRoot, 'public', 'gallery');

/**
 * The example ids, read from `getExampleNames` in `examples.ts`.
 *
 * That function is a flat literal per platform and
 * `tests/examples-catalog.unit.spec.ts` already asserts it agrees with
 * `TEMPLATE_EXAMPLES`, so parsing it cannot drift from the real catalogue
 * without a test going red first. Importing the module would mean compiling TS
 * from a plain `.mjs` script for no gain.
 */
function exampleIds() {
  const source = fs.readFileSync(path.join(repoRoot, 'src', 'lib', 'examples.ts'), 'utf8');
  // `\r?\n` and not `\n`: this file is checked out with CRLF endings on Windows.
  const block = source.match(/export function getExampleNames[\s\S]*?\r?\n\}\r?\n/);
  if (!block) throw new Error('getExampleNames not found in examples.ts');
  const ids = [...block[0].matchAll(/\{ id: '([^']+)'/g)].map(match => match[1]);
  if (!ids.length) throw new Error('getExampleNames matched no ids — has its shape changed?');
  return ids;
}

// The scene renders at the preview's own width. Taller scenes are cropped from
// the top rather than scaled down, so every card lands on the same aspect and a
// twelve-post thread does not produce a card three screens tall.
const CARD_WIDTH = 375;
const CARD_MAX_HEIGHT = 460;

const ids = exampleIds().filter(id => id.includes(idFilter));
if (!ids.length) throw new Error(`No example id matches "${idFilter}".`);

fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ channel: process.env.UX_CHANNEL || 'msedge' });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  // Retina, so the card still looks sharp in a grid column wider than 375px.
  deviceScaleFactor: 2,
});

const written = [];
const problems = [];

for (const id of ids) {
  const page = await context.newPage();
  const failedImages = [];
  page.on('response', response => {
    // `>= 400`, not `!response.ok()`. A 302 is not a failure: two example scenes
    // use hosts that redirect, the browser follows, and the image arrives. An
    // alarm that fires on working code teaches you to ignore the alarm.
    if (response.request().resourceType() === 'image' && response.status() >= 400) {
      failedImages.push(`${response.status()} ${response.url()}`);
    }
  });
  page.on('requestfailed', request => {
    if (request.resourceType() === 'image') failedImages.push(`FAILED ${request.url()}`);
  });

  await page.goto(`${baseUrl}/?template=${encodeURIComponent(id)}`, { waitUntil: 'networkidle' });

  const denyButton = page.getByRole('button', { name: /don.?t allow|no thanks|decline|deny|reject/i });
  if (await denyButton.count()) {
    await denyButton.first().click().catch(() => {});
    await page.waitForTimeout(300);
  }

  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // There are two `#workskin` nodes: the off-screen Save PNG target and the
  // visible preview. Select on measured height, not on document order.
  const extracted = await page.evaluate(() => {
    const workskin = [...document.querySelectorAll('#workskin')]
      .find(el => el.getBoundingClientRect().height > 0);
    if (!workskin) return null;
    const styles = [...document.querySelectorAll('style')].map(s => s.textContent).join('\n');
    return { html: workskin.outerHTML, styles };
  });
  if (!extracted) {
    problems.push(`${id}: no visible #workskin — did the deep link load the example?`);
    await page.close();
    continue;
  }

  const scenePage = await context.newPage();
  const sceneFailures = [];
  scenePage.on('response', response => {
    // `>= 400`, not `!response.ok()`. A 302 is not a failure: two example scenes
    // use hosts that redirect, the browser follows, and the image arrives. An
    // alarm that fires on working code teaches you to ignore the alarm.
    if (response.request().resourceType() === 'image' && response.status() >= 400) {
      sceneFailures.push(`${response.status()} ${response.url()}`);
    }
  });
  scenePage.on('requestfailed', request => {
    if (request.resourceType() === 'image') sceneFailures.push(`FAILED ${request.url()}`);
  });

  await scenePage.setContent(
    `<!doctype html><html><head><meta charset="utf-8"><base href="${baseUrl}/"><style>
       html,body{margin:0;padding:0;background:#fff;}
       #workskin{width:${CARD_WIDTH}px;margin:0 auto;background:#fff;padding-bottom:0 !important;}
     </style><style>${extracted.styles}</style></head>
     <body>${extracted.html}</body></html>`,
    { waitUntil: 'networkidle' }
  );
  await scenePage.waitForTimeout(1500);

  // Every image must have decoded before the shutter. `img.complete` is true of
  // an image that finished by failing, so naturalWidth is the honest check.
  const blankImages = await scenePage.evaluate(() =>
    [...document.querySelectorAll('img')]
      .filter(img => !img.naturalWidth)
      .map(img => img.getAttribute('src') || '(no src)')
  );

  const box = await scenePage.locator('#workskin').boundingBox();
  const outFile = path.join(outDir, `${id}.png`);
  await scenePage.screenshot({
    path: outFile,
    fullPage: true,
    clip: { x: box.x, y: box.y, width: box.width, height: Math.min(box.height, CARD_MAX_HEIGHT) },
  });

  const missing = [...new Set([...failedImages, ...sceneFailures, ...blankImages])];
  if (missing.length) {
    problems.push(`${id}: ${missing.length} image(s) did not load — ${missing.join(', ')}`);
  }
  written.push(`${path.relative(repoRoot, outFile)} (${Math.round(box.height)}px scene)`);

  await scenePage.close();
  await page.close();
}

await browser.close();

for (const entry of written) console.log(`wrote ${entry}`);

if (problems.length) {
  console.error(`\n${problems.length} card(s) captured with a defect:`);
  for (const problem of problems) console.error(`  ${problem}`);
  console.error('\nA card with a missing image is worse than no card. Fix and re-run.');
  process.exit(1);
}
console.log(`\n${written.length} card(s) captured, every image loaded.`);
