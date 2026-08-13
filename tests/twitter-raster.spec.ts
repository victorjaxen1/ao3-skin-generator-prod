import { expect, test } from '@playwright/test';
import { readFile } from 'fs/promises';

const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

function pngDimensions(bytes: Buffer) {
  expect(bytes.subarray(1, 4).toString()).toBe('PNG');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

test('real Save PNG preserves rich media geometry at 1× and 2×', async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.route('**/api/image-proxy**', route => route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }));
  await page.goto('/?platform=twitter');
  await page.getByPlaceholder("What's happening?").fill('Raster fixture with media and a deliberately long account-safe line');
  await page.getByRole('button', { name: 'Message options' }).click();
  await page.getByRole('button', { name: 'Media' }).click();
  for (let index = 1; index <= 4; index += 1) {
    await page.getByRole('button', { name: /Add image/i }).click();
    await page.getByRole('textbox', { name: `Image ${index} address` }).fill(`https://example.com/raster-${index}.png`);
    await page.getByRole('textbox', { name: `Image ${index} description` }).fill(`Raster image ${index}`);
  }
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.locator('#workskin').first().locator('.media-count-4')).toHaveCount(1);

  const quality = page.getByRole('button', { name: /Export quality/ });
  await quality.click();
  await page.getByRole('menuitemradio', { name: '1× resolution' }).click();
  const oneDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save PNG' }).first().click();
  const one = await oneDownload;
  const onePath = testInfo.outputPath('twitter-rich-1x.png');
  await one.saveAs(onePath);

  await quality.click();
  await page.getByRole('menuitemradio', { name: '2× resolution' }).click();
  const twoDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save PNG' }).first().click();
  const two = await twoDownload;
  const twoPath = testInfo.outputPath('twitter-rich-2x.png');
  await two.saveAs(twoPath);

  const oneSize = pngDimensions(await readFile(onePath));
  const twoSize = pngDimensions(await readFile(twoPath));
  expect(twoSize.width).toBe(oneSize.width * 2);
  // html2canvas rounds fractional line boxes independently at each scale.
  // Canvas width is exact; height may differ by one CSS line's rounding but
  // must remain materially 2× rather than cropping or adding a second card.
  expect(Math.abs(twoSize.height - oneSize.height * 2)).toBeLessThanOrEqual(32);
  expect(oneSize.width).toBeGreaterThan(300);
  expect(oneSize.height).toBeGreaterThan(300);
});
