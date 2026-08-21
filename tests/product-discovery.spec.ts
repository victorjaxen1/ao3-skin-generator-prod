import { expect, test } from '@playwright/test';

test('compact writer tools sit after Site skin and before starter templates', async ({ page }) => {
  await page.goto('/');

  const siteSkin = page.getByRole('link', { name: /Site skin/i });
  const writerTools = page.getByRole('heading', { name: 'Writing the fic too?' });
  const templates = page.getByText('Or start from a template', { exact: true });
  await expect(siteSkin).toBeVisible();
  await expect(writerTools).toBeVisible();
  await expect(templates).toBeVisible();

  const order = await page.locator('body').evaluate(() => {
    const site = document.querySelector('a[href="/site-skin"]');
    const writer = document.querySelector('[aria-labelledby^="more-tools-"]');
    const template = [...document.querySelectorAll('p')].find(node => node.textContent?.trim() === 'Or start from a template');
    if (!site || !writer || !template) return null;
    return {
      siteBeforeWriter: Boolean(site.compareDocumentPosition(writer) & Node.DOCUMENT_POSITION_FOLLOWING),
      writerBeforeTemplates: Boolean(writer.compareDocumentPosition(template) & Node.DOCUMENT_POSITION_FOLLOWING),
    };
  });
  expect(order).toEqual({ siteBeforeWriter: true, writerBeforeTemplates: true });

  for (const name of ['Draft without re-editing', 'Keep a series bible']) {
    const link = page.getByRole('link', { name });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    const url = new URL(await link.getAttribute('href') ?? '');
    expect(url.searchParams.get('utm_source')).toBe('ao3skingen');
    expect(url.searchParams.get('utm_medium')).toBe('referral');
    expect(url.searchParams.get('utm_campaign')).toBe('writer_toolkit');
    expect(url.searchParams.get('utm_content')).toBe('platform_picker_compact');
  }
});

test('returning authors can voluntarily expand Writer tools in Settings', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /blank iMessage/i }).click();
  await page.getByRole('button', { name: 'Open settings' }).click();

  const dialog = page.getByRole('dialog', { name: 'iMessage settings' });
  const toggle = dialog.getByRole('button', { name: /Writer tools from this developer/i });
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle).not.toBeFocused();
  await expect(dialog.getByRole('link', { name: /Try WordFokus free/i })).toHaveCount(0);

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  const wordFokus = dialog.getByRole('link', { name: /WordFokus.*Try WordFokus free/i });
  await expect(wordFokus).toBeVisible();
  await expect(wordFokus).toHaveAttribute('target', '_blank');
  await expect(wordFokus).toHaveAttribute('rel', 'noopener noreferrer');
  expect(new URL(await wordFokus.getAttribute('href') ?? '').searchParams.get('utm_content')).toBe('workspace_settings');
});

test('a qualified compact view emits one fixed analytics event under consent', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('ao3skingen_analytics_consent', 'granted');
    const analyticsWindow = window as typeof window & {
      __AO3SKINGEN_ANALYTICS_READY__?: boolean;
      __promotionCalls?: unknown[][];
      gtag?: (...args: unknown[]) => void;
    };
    analyticsWindow.__promotionCalls = [];
    analyticsWindow.__AO3SKINGEN_ANALYTICS_READY__ = true;
    analyticsWindow.gtag = (...args: unknown[]) => analyticsWindow.__promotionCalls?.push(args);
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Writing the fic too?' })).toBeVisible();
  await page.waitForTimeout(1200);

  const calls = await page.evaluate(() => (window as typeof window & { __promotionCalls?: unknown[][] }).__promotionCalls ?? []);
  const views = calls.filter(call => call[0] === 'event' && call[1] === 'product_promo_viewed');
  expect(views).toHaveLength(2);
  expect(views).toEqual(expect.arrayContaining([
    ['event', 'product_promo_viewed', {
      product: 'wordfokus', placement: 'platform_picker_compact', variant: 'compact',
    }],
    ['event', 'product_promo_viewed', {
      product: 'worldkonstruct', placement: 'platform_picker_compact', variant: 'compact',
    }],
  ]));
});

test('the Release 1 rollout keeps work-skin success free of contextual recommendations', async ({ page }) => {
  await page.goto('/?template=google-news-articles', { waitUntil: 'domcontentloaded' });
  await page.locator('#workskin:visible').first().waitFor({ state: 'visible', timeout: 30_000 });
  await page.getByRole('button', { name: /work skin/i }).click();

  const dialog = page.getByRole('dialog', { name: 'Work skin' });
  await dialog.getByRole('button', { name: 'Copy work skin CSS' }).click();
  await dialog.getByRole('button', { name: 'Copy scene HTML' }).click();

  await expect(dialog.getByRole('heading', {
    name: 'Your scene is ready. Writing the next chapter in Google Docs?',
  })).toHaveCount(0);
  await expect(dialog.getByRole('link', { name: /Try (WordFokus|WorldKonstruct) free/i })).toHaveCount(0);
});
