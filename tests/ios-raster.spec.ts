import { expect, test } from '@playwright/test';
import { readFile } from 'fs/promises';

/**
 * §14.5 — what the PNG actually contains.
 *
 * Nothing in the unit or injection suites can see a rasteriser bug: html2canvas
 * is not the browser, and three shipped defects were found in one session by
 * exporting a picture and looking at it. This drives the real **Save PNG**
 * button, because the export path has fixes the preview does not — a preview
 * screenshot proves nothing about the PNG.
 */

test.describe.configure({ mode: 'serial' });

const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

function pngDimensions(bytes: Buffer) {
  expect(bytes.subarray(1, 4).toString()).toBe('PNG');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

test('real Save PNG captures the rich iOS fixture as static fiction UI', async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  // Stub, never abort. A failed image is not the same box as a loaded one —
  // Chrome sizes the broken-image placeholder whenever the failure lands, which
  // is not at a fixed point relative to load, and that made two identical
  // renders differ by 6.69px once already.
  await page.route('**/api/image-proxy**', route => route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }));
  await page.route('https://picsum.photos/**', route => route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }));
  await page.route('https://i.ytimg.com/**', route => route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }));

  await page.goto('/?template=ios-rich-group-scene');
  const scene = page.locator('#workskin').first();
  await expect(scene.locator('blockquote.ios-reply')).toHaveCount(1);
  await expect(scene.locator('.ios-images-4')).toHaveCount(1);
  await expect(scene.locator('a.ios-link-preview')).toHaveCount(1);
  await expect(scene.locator('.ios-audio-card')).toHaveCount(1);
  await expect(scene.locator('.ios-video-card')).toHaveCount(1);
  await expect(scene.locator('.ios-tapbacks')).toHaveCount(2);
  await expect(scene.locator('.ios-event')).toHaveCount(2);
  // The whole point of the two-mode boundary: no native player chrome can
  // reach the rasteriser, because html2canvas cannot draw it anyway.
  await expect(scene.locator('audio,video,iframe')).toHaveCount(0);

  const quality = page.getByRole('button', { name: /Export quality/ });
  await quality.click();
  await page.getByRole('menuitemradio', { name: /1. resolution/ }).click();
  const downloadPromise = page.waitForEvent('download', { timeout: 90_000 });
  await page.getByRole('button', { name: 'Save PNG' }).first().click();
  const download = await downloadPromise;
  const output = testInfo.outputPath('ios-rich-1x.png');
  await download.saveAs(output);
  const size = pngDimensions(await readFile(output));
  expect(size.width).toBeGreaterThanOrEqual(320);
  expect(size.width).toBeLessThanOrEqual(500);
  // Tall, because a reply, four images, a link, a voice note and a video card
  // are all in one scene. A short capture means something got clipped.
  expect(size.height).toBeGreaterThan(700);
});

test('rich iOS fixture exports at materially doubled 2× resolution', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await page.route('**/api/image-proxy**', route => route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }));
  await page.route('https://picsum.photos/**', route => route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }));
  await page.route('https://i.ytimg.com/**', route => route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }));
  await page.goto('/?template=ios-rich-group-scene');
  const quality = page.getByRole('button', { name: /Export quality/ });
  await quality.click();
  await page.getByRole('menuitemradio', { name: /2. resolution/ }).click();
  const downloadPromise = page.waitForEvent('download', { timeout: 90_000 });
  await page.getByRole('button', { name: 'Save PNG' }).first().click();
  const output = testInfo.outputPath('ios-rich-2x.png');
  await (await downloadPromise).saveAs(output);
  const size = pngDimensions(await readFile(output));
  expect(size.width).toBeGreaterThanOrEqual(640);
  expect(size.width).toBeLessThanOrEqual(1000);
  expect(size.height).toBeGreaterThan(1400);
});

test('a scrollable phone frame still exports the whole conversation', async ({ page }, testInfo) => {
  test.setTimeout(200_000);
  await page.route('**/api/image-proxy**', route => route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }));
  await page.route('https://picsum.photos/**', route => route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }));
  await page.route('https://i.ytimg.com/**', route => route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }));

  await page.goto('/?template=ios-rich-group-scene');

  // Establish the unclipped height first, then turn on the fixed-height window
  // and prove the capture is unchanged. Comparing against a fixed number would
  // pass for the wrong reason the moment the fixture grows.
  const quality = page.getByRole('button', { name: /Export quality/ });
  await quality.click();
  await page.getByRole('menuitemradio', { name: /1. resolution/ }).click();
  let downloadPromise = page.waitForEvent('download', { timeout: 90_000 });
  await page.getByRole('button', { name: 'Save PNG' }).first().click();
  const unclipped = pngDimensions(await readFile(await (async () => {
    const output = testInfo.outputPath('ios-unclipped.png');
    await (await downloadPromise).saveAs(output);
    return output;
  })()));

  await page.getByRole('button', { name: 'Open settings' }).click();
  await page.getByRole('combobox', { name: 'Frame' }).selectOption('phone');
  await page.getByRole('button', { name: 'Advanced' }).click();
  await page.getByRole('switch', { name: 'Fixed-height scroll window' }).click();
  await page.keyboard.press('Escape');
  // `.first()` because the page renders the scene twice — the desktop preview
  // and the mobile one — and both legitimately carry the class.
  await expect(page.locator('#workskin').first().locator('.chat.ios-scroll')).toHaveCount(1);

  downloadPromise = page.waitForEvent('download', { timeout: 90_000 });
  await page.getByRole('button', { name: 'Save PNG' }).first().click();
  const output = testInfo.outputPath('ios-scrolled.png');
  await (await downloadPromise).saveAs(output);
  const scrolled = pngDimensions(await readFile(output));

  // The frame adds a status/input bar, so allow growth — but the message list
  // must not be cut down to the 32em window.
  expect(scrolled.height).toBeGreaterThanOrEqual(unclipped.height);
});
