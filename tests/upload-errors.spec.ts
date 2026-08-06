import { test, expect } from '@playwright/test';

/**
 * A failed image upload used to produce nothing at all: the client retries
 * twice with 5s then 10s backoff, so a dead network meant up to ~35 seconds of
 * spinner followed by silence. Both call sites threw the error message away.
 *
 * These block the ImgBB API and assert a human-readable message appears.
 */

const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

async function blockImgbb(page: import('@playwright/test').Page) {
  await page.route(/api\.imgbb\.com/, (route) => route.abort('failed'));
}

test('compose bar reports a failed upload instead of failing silently', async ({ page }) => {
  // Retries with backoff mean the failure surfaces ~15s after the click.
  test.setTimeout(90000);
  await blockImgbb(page);

  await page.goto('/');
  await page.getByRole('button', { name: 'Start a blank iMessage conversation' }).click();
  await page.getByRole('button', { name: /Add details/ }).click();

  await page
    .getByLabel('Upload an image file')
    .setInputFiles({ name: 'test.png', mimeType: 'image/png', buffer: ONE_PIXEL_PNG });

  // Any wording is fine; the requirement is that something explains itself.
  // Scoped to the compose area — Next's route announcer is also role=alert.
  await expect(
    page.locator('[role="alert"]').filter({ hasText: /upload|network|connection/i })
  ).toBeVisible({ timeout: 60000 });
});

test('a bad image address is called out rather than silently ignored', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start a blank iMessage conversation' }).click();
  await page.getByRole('button', { name: /Add details/ }).click();

  const field = page.getByLabel('Image address for this message');
  await field.fill('https://example.com/not-an-image-page');
  await field.blur();

  await expect(page.getByText(/may not be a direct image link/i)).toBeVisible();
});

test('a share-page URL is rewritten and the rewrite is disclosed', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start a blank iMessage conversation' }).click();
  await page.getByRole('button', { name: /Add details/ }).click();

  const field = page.getByLabel('Image address for this message');
  // An Imgur gallery page is not a direct image; normalisation fixes it.
  await field.fill('https://imgur.com/aBcDeFg');
  await field.blur();

  await expect(field).toHaveValue('https://i.imgur.com/aBcDeFg.jpg');
  await expect(page.getByText(/converted to a direct image link/i)).toBeVisible();
});
