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
// Matches either the raw id or the friendly picker label. The picker showed raw
// ids until `4c0c4e0` labelled them, and this script broke the moment it did —
// so accept both rather than track which side is current.
const EXAMPLE_MATCH = /rich group scene|ios-rich-group-scene/i;

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
const exampleButton = page.getByRole('button', { name: EXAMPLE_MATCH });
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
const box = await scenePage.locator('#workskin').boundingBox();

const cropFile = outFile.replace(/\.png$/i, '-crop.png');
await scenePage.screenshot({
  path: cropFile,
  clip: { x: box.x, y: box.y, width: box.width, height: Math.min(box.height, 700) },
});

// A second crop, framed on the video card.
//
// The hero slot is about 620px tall against a conversation that is ~1700, so it
// holds roughly three message blocks and the only real question is which three.
// The top-of-conversation crop spent them on two plain text bubbles and a reply,
// which is the least distinctive thing this product does — every fake-screenshot
// site can draw a grey bubble. Playable video in a work skin is the thing none of
// them can do, so that is what the hero should be pointing at.
//
// Anchored to the real element rather than to measured pixel offsets, because
// the example's content shifts whenever anyone edits it and a hardcoded y would
// silently start framing the wrong bubble.
const videoCard = scenePage.locator('.ios-video-card').first();
const highlightFile = outFile.replace(/\.png$/i, '-video.png');
if (await videoCard.count()) {
  const cardBox = await videoCard.boundingBox();
  // Reach upward for the sender's line above the card, so the frame still reads
  // as a conversation rather than as a floating media player.
  const top = Math.max(box.y, cardBox.y - 90);
  const bottom = Math.min(box.y + box.height, cardBox.y + cardBox.height + 44);
  await scenePage.screenshot({
    path: highlightFile,
    // `fullPage` is required, not cosmetic: the video card sits ~2800px down a
    // 900px viewport, and without it the clip is "outside the resulting image".
    fullPage: true,
    clip: { x: box.x, y: top, width: box.width, height: bottom - top },
  });
  console.log(`hero video crop written: ${highlightFile}`);
} else {
  console.log('WARNING: no .ios-video-card found — video crop skipped');
}
// A 1200x630 social card.
//
// og:image and twitter:image want landscape at a fixed size; the hero crop is
// portrait, so reusing it would letterbox badly in every feed that renders it.
//
// One phone, not two. The first attempt overlapped a second column for density
// and its left edge sliced the first column's bubbles mid-word — dense, and
// unmistakably broken at a glance, which is the worst thing a share card can
// be. A single angled phone with room around it reads as intentional.
const cardFile = outFile.replace(/\.png$/i, '-social.png');
const cardPage = await context.newPage();
await cardPage.setViewportSize({ width: 1200, height: 630 });
await cardPage.setContent(
  `<!doctype html><html><head><meta charset="utf-8"><style>
     html,body{margin:0;padding:0;width:1200px;height:630px;overflow:hidden;
       background:linear-gradient(135deg,#e8f0fe 0%,#f8f9fa 100%);font-family:'Segoe UI',Roboto,Arial,sans-serif;}
     .wrap{display:flex;height:630px;align-items:center;gap:40px;padding:0 56px;box-sizing:border-box;}
     .copy{flex:0 0 470px;}
     .copy h1{font-size:52px;line-height:1.1;margin:0 0 18px;color:#202124;font-weight:700;letter-spacing:-0.5px;}
     .copy h1 em{font-style:normal;color:#1a73e8;}
     .copy p{font-size:23px;line-height:1.45;color:#5f6368;margin:0 0 22px;}
     .chips{display:flex;gap:10px;flex-wrap:wrap;}
     .chip{background:#fff;border:1px solid #dadce0;border-radius:50px;padding:8px 16px;font-size:16px;color:#3c4043;font-weight:500;}
     .stage{flex:1;display:flex;justify-content:center;align-items:center;height:630px;}
     .phone{width:375px;height:560px;background:#fff;border-radius:26px;
       box-shadow:0 22px 60px rgba(32,33,36,0.26);overflow:hidden;
       transform:rotate(-3deg);}
   </style><style>${extracted.styles}</style></head>
   <body><div class="wrap">
     <div class="copy">
       <h1>Social-media scenes<br>for <em>AO3</em></h1>
       <p>Build a conversation, then publish it as a picture &mdash; or as real text your readers can select.</p>
       <div class="chips"><span class="chip">Free, no signup</span><span class="chip">iMessage &middot; WhatsApp &middot; X &middot; Google</span></div>
     </div>
     <div class="stage"><div class="phone">${extracted.html}</div></div>
   </div></body></html>`,
  { waitUntil: 'networkidle' }
);
await cardPage.waitForTimeout(2500);
await cardPage.screenshot({ path: cardFile, clip: { x: 0, y: 0, width: 1200, height: 630 } });
await cardPage.close();

await scenePage.close();

console.log(`hero written: ${outFile}`);
console.log(`hero crop written: ${cropFile}`);
console.log(`social card written: ${cardFile}`);
if (failedImages.length) {
  console.log(`\nWARNING: ${failedImages.length} image request(s) did not load — the hero may show broken images:`);
  for (const entry of [...new Set(failedImages)]) console.log('  ' + entry);
} else {
  console.log('all image requests loaded');
}

await browser.close();
