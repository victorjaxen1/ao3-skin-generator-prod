import { expect, test } from '@playwright/test';

test('Google Analytics is not requested before consent and can be changed later', async ({ page }) => {
  let analyticsRequests = 0;
  await page.route('https://www.googletagmanager.com/gtag/js**', async route => {
    analyticsRequests += 1;
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Optional analytics' })).toBeVisible();
  expect(analyticsRequests).toBe(0);

  await page.getByRole('button', { name: 'Don’t allow' }).click();
  await expect(page.getByRole('button', { name: 'Privacy choices' })).toBeVisible();
  expect(analyticsRequests).toBe(0);
  expect(await page.evaluate(() => localStorage.getItem('ao3skingen_analytics_consent'))).toBe('denied');

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Optional analytics' })).toBeHidden();
  expect(analyticsRequests).toBe(0);

  await page.getByRole('button', { name: 'Privacy choices' }).click();
  await page.getByRole('button', { name: 'Allow analytics' }).click();
  await expect.poll(() => analyticsRequests).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem('ao3skingen_analytics_consent'))).toBe('granted');

  await page.getByRole('button', { name: 'Privacy choices' }).click();
  await page.getByRole('button', { name: 'Don’t allow' }).click();
  expect(await page.evaluate(() => localStorage.getItem('ao3skingen_analytics_consent'))).toBe('denied');
  expect(await page.evaluate(() => document.cookie.includes('_ga'))).toBe(false);
});

test('privacy choices stay in the export bar and clear of composer controls', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.addInitScript(() => localStorage.setItem('ao3skingen_analytics_consent', 'denied'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Start a blank iMessage conversation' }).click();

  const privacy = page.getByTestId('privacy-control');
  await expect(privacy).toBeVisible();
  await expect(privacy.locator('xpath=ancestor::div[contains(@class,"fixed")]').first()).toBeVisible();

  const controls = [
    page.getByRole('button', { name: /Sending as/ }),
    page.getByRole('button', { name: 'Add details (timestamp, image, etc.)' }),
    page.getByRole('button', { name: 'Send message' }),
  ];
  const privacyBox = await privacy.boundingBox();
  expect(privacyBox).not.toBeNull();
  for (const control of controls) {
    const controlBox = await control.boundingBox();
    expect(controlBox).not.toBeNull();
    const overlaps = Boolean(
      privacyBox && controlBox &&
      privacyBox.x < controlBox.x + controlBox.width &&
      privacyBox.x + privacyBox.width > controlBox.x &&
      privacyBox.y < controlBox.y + controlBox.height &&
      privacyBox.y + privacyBox.height > controlBox.y
    );
    expect(overlaps).toBe(false);
  }

  await privacy.click();
  await expect(page.getByRole('dialog', { name: 'Optional analytics' })).toBeVisible();
});
