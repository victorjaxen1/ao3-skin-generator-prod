import { test, expect, Page } from '@playwright/test';

/**
 * The work-skin export, end to end.
 *
 * Run against a local build, since playwright.config.ts points the browser
 * projects at the deployed site:
 *
 *   npm run dev
 *   UX_BASE_URL=http://localhost:3000 npx playwright test --project=desktop tests/work-skin.spec.ts
 */

async function openTemplate(page: Page, template: string) {
  await page.goto(`/?template=${template}`, { waitUntil: 'domcontentloaded' });
  await page.locator('#workskin:visible').first().waitFor({ state: 'visible', timeout: 20000 });
}

test('Twitter offers a work skin; iOS does not', async ({ page }) => {
  await openTemplate(page, 'twitter-verified-account');
  await expect(page.getByRole('button', { name: /work skin/i })).toBeVisible();

  // iOS still needs `animation` for its typing indicator, which AO3 bans —
  // so it is not offered rather than offered and broken.
  await openTemplate(page, 'ios-two-person-chat');
  await expect(page.getByRole('button', { name: /work skin/i })).toHaveCount(0);
});

test('the modal hands over two pieces, each with its own destination', async ({ page }) => {
  await openTemplate(page, 'twitter-verified-account');
  await page.getByRole('button', { name: /work skin/i }).click();

  await expect(page.getByText('AO3-safe check passed')).toBeVisible();
  await expect(page.getByText('Preferences → Skins → Create Work Skin')).toBeVisible();
  // The step everyone forgets: the HTML does nothing without the skin attached.
  await expect(page.getByText('Select Work Skin')).toBeVisible();

  await expect(page.getByRole('button', { name: 'Copy the CSS' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Copy the HTML' })).toBeEnabled();
});

test('the exported CSS and HTML are what AO3 will accept', async ({ page }) => {
  await openTemplate(page, 'twitter-verified-account');
  await page.getByRole('button', { name: /work skin/i }).click();

  const css = await page.getByLabel('Work skin CSS').inputValue();
  const html = await page.getByLabel('Work skin HTML').inputValue();

  // `gap` is rejected by AO3 while `column-gap` passes — the substring quirk.
  expect(css).not.toMatch(/[;{]\s*gap\s*:/);
  expect(css).toContain('#workskin');

  // Elements AO3 strips, and the relative paths it would rewrite to its own
  // domain and 404 on.
  expect(html).not.toContain('<button');
  expect(html).not.toContain('<svg');
  expect(html).not.toContain('src="/assets/');
  expect(html).not.toContain('data-message-id');
  expect(html).toContain('https://');
});

test('the image export still works alongside it', async ({ page }) => {
  // The work skin is an addition, not a replacement — the two primary
  // buttons must survive it.
  await openTemplate(page, 'twitter-verified-account');
  await expect(page.getByRole('button', { name: 'Save Image' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy for AO3' })).toBeVisible();
});
