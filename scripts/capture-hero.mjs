/**
 * Capture the landing page hero image from the running application.
 *
 * The hero should show the tool being *used* — a rich scene in the timeline
 * beside the live preview — rather than a bare phone mockup, because the thing
 * being sold is an editor, not a picture.
 *
 * Usage:
 *   node scripts/capture-hero.mjs [baseUrl] [outFile]
 *
 * Defaults to http://127.0.0.1:3200 and public/hero-scene-builder.png. Run it
 * against a build of the current tree, not the live site, so the shot matches
 * the code being shipped.
 */
import { chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const baseUrl = process.argv[2] || 'http://127.0.0.1:3200';
const outFile = process.argv[3] || path.join(here, '..', 'public', 'hero-scene-builder.png');
const EXAMPLE_ID = 'ios-rich-group-scene';

const browser = await chromium.launch({ channel: process.env.UX_CHANNEL || 'msedge' });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  // A retina-density shot, so the image still looks sharp scaled down into a
  // hero slot on a high-DPI screen.
  deviceScaleFactor: 2,
});
const page = await context.newPage();

const failedImages = [];
page.on('response', response => {
  const type = response.request().resourceType();
  if (type === 'image' && !response.ok()) failedImages.push(`${response.status()} ${response.url()}`);
});
page.on('requestfailed', request => {
  if (request.resourceType() === 'image') failedImages.push(`FAILED ${request.url()}`);
});

await page.goto(baseUrl, { waitUntil: 'networkidle' });

// The picker labels the newest examples with their raw id, so match either the
// friendly label or the id itself.
const exampleButton = page.getByRole('button', { name: new RegExp(EXAMPLE_ID, 'i') });
await exampleButton.first().click();

// Analytics consent defaults to off and asks on first visit. Correct product
// behaviour, wrong for a promotional screenshot — so answer it, and answer it
// with "Don't allow", because a screenshot must never imply consent was given.
const denyButton = page.getByRole('button', { name: /don.?t allow|no thanks|decline|deny|reject/i });
if (await denyButton.count()) {
  await denyButton.first().click().catch(() => {});
  await page.waitForTimeout(400);
}

// Let remote example imagery settle before the shutter.
await page.waitForLoadState('networkidle');
await page.waitForTimeout(2500);

// Capture the live DOM, NOT the application's Save PNG.
//
// Save PNG goes through html2canvas, which clips the last line of any bubble
// text sitting above media — the scene's fractional 20.2608px line-height is
// not reproduced faithfully. The browser renders the same markup correctly, and
// `scripts/check-bubble-clip.mjs` measures the DOM to prove it. A promotional
// image must not ship a rendering defect, so the shutter goes here.
//
// The preview pane scrolls, so the scene is taller than its container. Release
// the container's height for the shot and put it straight back.
// Lift the generated markup and stylesheet out of the preview and re-render
// them on a bare page.
//
// Expanding the preview's own scroll container was tried first and produced a
// broken shot: the export bar and help panel are fixed, so they bleed over a
// scene that is suddenly 3000px tall. Re-rendering standalone gives the whole
// conversation at full height with no application chrome to collide with, and
// it is still the browser painting the same markup — which is the property that
// matters, since html2canvas is the thing being avoided.
const extracted = await page.evaluate(() => {
  const workskin = [...document.querySelectorAll('#workskin')]
    .find(el => el.getBoundingClientRect().height > 0);
  if (!workskin) return null;
  const styles = [...document.querySelectorAll('style')].map(s => s.textContent).join('\n');
  return { html: workskin.outerHTML, styles };
});
if (!extracted) throw new Error('Could not find a rendered #workskin in the preview.');

const scenePage = await context.newPage();
await scenePage.setContent(
  `<!doctype html><html><head><meta charset="utf-8"><style>
     html,body{margin:0;padding:0;background:#fff;}
     #workskin{width:375px;margin:0 auto;background:#fff;padding-bottom:0 !important;}
   </style><style>${extracted.styles}</style></head>
   <body>${extracted.html}</body></html>`,
  { waitUntil: 'networkidle' }
);
await scenePage.waitForTimeout(2500);

await scenePage.locator('#workskin').screenshot({ path: outFile });

// The full conversation is about 1:4.5 — a great asset, an impossible hero.
// Also emit a crop through the four-photo grid, which is the densest and most
// legible stretch: group colours, a stacked Tapback, a reply carrying its
// quoted original, and the photo grid, ending on the read receipt.
// `clip` is ignored on an element screenshot, so the crop has to come from a
// page screenshot with an explicit region.
const cropFile = outFile.replace(/\.png$/i, '-crop.png');
const box = await scenePage.locator('#workskin').boundingBox();
await scenePage.screenshot({
  path: cropFile,
  clip: { x: box.x, y: box.y, width: box.width, height: Math.min(box.height, 700) },
});
await scenePage.close();

console.log(`hero written: ${outFile}`);
console.log(`hero crop written: ${cropFile}`);
if (failedImages.length) {
  console.log(`\nWARNING: ${failedImages.length} image request(s) did not load — the hero may show broken images:`);
  for (const entry of [...new Set(failedImages)]) console.log('  ' + entry);
} else {
  console.log('all image requests loaded');
}

await browser.close();
