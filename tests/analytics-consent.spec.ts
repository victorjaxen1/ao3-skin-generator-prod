import { expect, test } from '@playwright/test';

test('Google Analytics is not requested before consent and can be changed later', async ({ page }) => {
  let analyticsRequests = 0;
  await page.route('https://www.googletagmanager.com/gtag/js**', async route => {
    analyticsRequests += 1;
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Help improve AO3 SkinGen?' })).toBeVisible();
  expect(analyticsRequests).toBe(0);

  await page.getByRole('button', { name: 'Don’t allow' }).click();
  await expect(page.getByRole('button', { name: 'Privacy' })).toBeVisible();
  expect(analyticsRequests).toBe(0);
  expect(await page.evaluate(() => localStorage.getItem('ao3skingen_analytics_consent'))).toBe('denied');

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Help improve AO3 SkinGen?' })).toBeHidden();
  expect(analyticsRequests).toBe(0);

  await page.getByRole('button', { name: 'Privacy' }).click();
  await page.getByRole('button', { name: 'Allow analytics' }).click();
  await expect.poll(() => analyticsRequests).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem('ao3skingen_analytics_consent'))).toBe('granted');

  await page.getByRole('button', { name: 'Privacy' }).click();
  await page.getByRole('button', { name: 'Don’t allow' }).click();
  expect(await page.evaluate(() => localStorage.getItem('ao3skingen_analytics_consent'))).toBe('denied');
  expect(await page.evaluate(() => document.cookie.includes('_ga'))).toBe(false);
});
