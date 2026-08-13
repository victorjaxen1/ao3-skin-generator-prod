import { test, expect } from '@playwright/test';

/**
 * A failed image upload used to produce nothing at all. Uploads now cross the
 * same-origin server boundary, and both entry points explain the transfer
 * before it begins and surface a fixed safe error when it fails.
 *
 * These stub the same-origin upload boundary and assert consent plus errors.
 */

const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

async function failUploadRoute(page: import('@playwright/test').Page) {
  await page.route('**/api/image-upload', route => route.fulfill({
    status: 502,
    contentType: 'application/json',
    body: JSON.stringify({ ok: false, error: { code: 'PROVIDER_UNAVAILABLE', message: 'The image host could not accept this upload. Try again later.' } }),
  }));
}

test('compose bar reports a failed upload instead of failing silently', async ({ page }) => {
  await failUploadRoute(page);

  await page.goto('/');
  await page.getByRole('button', { name: 'Start a blank iMessage conversation' }).click();
  await page.getByRole('button', { name: 'Message options' }).click();

  await page
    .getByLabel('Upload an image file')
    .setInputFiles({ name: 'test.png', mimeType: 'image/png', buffer: ONE_PIXEL_PNG });

  await expect(page.getByRole('dialog', { name: 'Confirm public image upload' })).toBeVisible();
  await page.getByRole('button', { name: 'Upload publicly' }).click();

  // Any wording is fine; the requirement is that something explains itself.
  // Scoped to the compose area — Next's route announcer is also role=alert.
  await expect(
    page.locator('[role="alert"]').filter({ hasText: /upload|network|connection/i })
  ).toBeVisible();
});

test('hosted scene stays local until the disclosure is accepted', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/image-upload', route => {
    requests += 1;
    return route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ ok: false, error: { code: 'PROVIDER_UNAVAILABLE', message: 'Upload unavailable.' } }) });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Start a blank iMessage conversation' }).click();
  await page.getByRole('button', { name: 'Get AO3 image code' }).click();
  await expect(page.getByRole('dialog', { name: 'Confirm hosted image upload' })).toBeVisible();
  expect(requests).toBe(0);
  await page.getByRole('button', { name: 'Cancel' }).click();
  expect(requests).toBe(0);
});

test('a bad image address is called out rather than silently ignored', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start a blank iMessage conversation' }).click();
  await page.getByRole('button', { name: 'Message options' }).click();

  const field = page.getByLabel('Image address for this message');
  await field.fill('https://example.com/not-an-image-page');
  await field.blur();

  await expect(page.getByText(/may not be a direct image link/i)).toBeVisible();
});

test('a share-page URL is rewritten and the rewrite is disclosed', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start a blank iMessage conversation' }).click();
  await page.getByRole('button', { name: 'Message options' }).click();

  const field = page.getByLabel('Image address for this message');
  // An Imgur gallery page is not a direct image; normalisation fixes it.
  await field.fill('https://imgur.com/aBcDeFg');
  await field.blur();

  await expect(field).toHaveValue('https://i.imgur.com/aBcDeFg.jpg');
  await expect(page.getByText(/converted to a direct image link/i)).toBeVisible();
});
