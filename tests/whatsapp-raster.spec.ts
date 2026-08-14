import { expect, test } from '@playwright/test';
import { readFile } from 'fs/promises';

test.describe.configure({ mode: 'serial' });

const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

function pngDimensions(bytes: Buffer) {
  expect(bytes.subarray(1, 4).toString()).toBe('PNG');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

test('real Save PNG captures the rich WhatsApp fixture as static fiction UI', async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.route('**/api/image-proxy**', route => route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }));
  await page.goto('/?template=whatsapp-group-chat');
  const scene = page.locator('#workskin').first();
  await expect(scene.locator('.wa-reply')).toHaveCount(1);
  await expect(scene.locator('.wa-link-preview')).toHaveCount(1);
  await expect(scene.locator('.wa-audio')).toHaveCount(1);
  await expect(scene.locator('.wa-video')).toHaveCount(1);
  await expect(scene.locator('audio,video')).toHaveCount(0);

  const quality = page.getByRole('button', { name: /Export quality/ });
  await quality.click();
  await page.getByRole('menuitemradio', { name: /1. resolution/ }).click();
  const downloadPromise = page.waitForEvent('download', { timeout: 90_000 });
  await page.getByRole('button', { name: 'Save PNG' }).first().click();
  const download = await downloadPromise;
  const output = testInfo.outputPath('whatsapp-rich-1x.png');
  await download.saveAs(output);
  const size = pngDimensions(await readFile(output));
  expect(size.width).toBeGreaterThanOrEqual(320);
  expect(size.width).toBeLessThanOrEqual(500);
  expect(size.height).toBeGreaterThan(500);
});

test('WhatsApp 2× raster is materially double resolution and still fully expanded', async ({ page }, testInfo) => {
  // A full-height 2× html2canvas render is CPU-heavy under software rendering.
  // Keep it serial with this file and give the real browser enough time to
  // finish instead of replacing this with a mocked canvas.
  test.setTimeout(300_000);
  await page.route('**/api/image-proxy**', route => route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }));
  await page.goto('/?template=whatsapp-group-chat');
  const quality = page.getByRole('button', { name: /Export quality/ });
  await quality.click();
  await page.getByRole('menuitemradio', { name: /2. resolution/ }).click();
  const downloadPromise = page.waitForEvent('download', { timeout: 90_000 });
  await page.getByRole('button', { name: 'Save PNG' }).first().click();
  const download = await downloadPromise;
  const output = testInfo.outputPath('whatsapp-rich-2x.png');
  await download.saveAs(output);
  const size = pngDimensions(await readFile(output));
  expect(size.width).toBeGreaterThanOrEqual(640);
  expect(size.width).toBeLessThanOrEqual(1000);
  expect(size.height).toBeGreaterThan(1000);
});
