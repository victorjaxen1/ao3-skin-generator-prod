import { expect, test } from '@playwright/test';
import { readFile } from 'fs/promises';

function pngDimensions(bytes: Buffer) {
  expect(bytes.subarray(1, 4).toString()).toBe('PNG');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

test('real Save PNG captures a Google scene at 2×', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.goto('/?template=google-news-articles');
  const quality = page.getByRole('button', { name: /Export quality/ });
  await quality.click();
  await page.getByRole('menuitemradio', { name: '2× resolution' }).click();
  const downloadPromise = page.waitForEvent('download', { timeout: 90_000 });
  await page.getByRole('button', { name: 'Save PNG' }).first().click();
  const output = testInfo.outputPath('google-news-2x.png');
  await (await downloadPromise).saveAs(output);
  const size = pngDimensions(await readFile(output));
  expect(size.width).toBeGreaterThanOrEqual(640);
  expect(size.height).toBeGreaterThan(500);
});
