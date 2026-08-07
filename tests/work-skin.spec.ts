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

/**
 * This test used to be "Twitter offers a work skin; iOS does not", and it
 * asserted iOS offered *no* button, because iOS needed `animation` for its
 * typing indicator and AO3 bans it. That stopped being true on 7 Aug 2026 when
 * the indicator was rebuilt as static descending-opacity dots and iOS and
 * Android both shipped — but the test lives in a browser project, so the unit
 * gate never ran it and nobody noticed it asserting the opposite of the
 * product for a day.
 *
 * `supportsWorkSkin` is the gate, and all four platforms now pass it.
 */
test('every platform offers a work skin', async ({ page }) => {
  for (const template of [
    'twitter-verified-account',
    'ios-two-person-chat',
    'whatsapp-chat',
    'google-search-history',
  ]) {
    await openTemplate(page, template);
    await expect(
      page.getByRole('button', { name: /work skin/i }),
      template
    ).toBeVisible();
  }
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
