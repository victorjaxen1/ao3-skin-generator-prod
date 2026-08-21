import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }, testInfo) => {
  const leaveConsentUnanswered = testInfo.title.includes('analytics consent');
  await page.addInitScript((unanswered: boolean) => {
    if (unanswered) localStorage.removeItem('ao3skingen_analytics_consent');
    else localStorage.setItem('ao3skingen_analytics_consent', 'denied');
    localStorage.removeItem('ao3SiteSkinTheme');
  }, leaveConsentUnanswered);
});

test('the compact gallery shows a complete first template card in the viewport', async ({ page }) => {
  await page.goto('/site-skin');
  await expect(page.getByRole('button', { name: 'Match a picture or website' })).toBeVisible();
  await expect(page.getByLabel('Image address')).toHaveCount(0);

  const card = page.getByRole('button', { name: /Moonlit Library/ });
  const box = await card.boundingBox();
  expect(box).not.toBeNull();
  expect((box?.y || 0) + (box?.height || 0)).toBeLessThanOrEqual(await page.evaluate(() => window.innerHeight));
});

test('mobile uses one reachable scrolling editor pane', async ({ page }) => {
  await page.goto('/site-skin');
  await page.getByRole('button', { name: /Moonlit Library/ }).click();

  const preview = page.getByTestId('site-skin-preview-pane');
  const customize = page.getByTestId('site-skin-customize-pane');
  await expect(preview).toBeVisible();
  await expect(customize).toBeHidden();

  await page.getByRole('tab', { name: 'Customize' }).click();
  await expect(customize).toBeVisible();
  await expect(preview).toBeHidden();

  await page.getByRole('button', { name: /^Details/ }).click();
  const scrollbar = page.getByRole('switch', { name: 'Themed scrollbar' });
  await scrollbar.scrollIntoViewIfNeeded();
  await scrollbar.click();

  const metrics = await customize.evaluate(element => ({
    top: element.scrollTop,
    height: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  expect(metrics.scrollHeight).toBeGreaterThan(metrics.height);
  expect(metrics.top).toBeGreaterThan(0);

  const documentMetrics = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    height: document.documentElement.scrollHeight,
    viewport: window.innerHeight,
  }));
  expect(documentMetrics.width).toBeLessThanOrEqual(documentMetrics.clientWidth);
  expect(documentMetrics.height).toBeLessThanOrEqual(documentMetrics.viewport);
});

test('compact header actions do not overlap at target widths', async ({ page }) => {
  const sizes = [
    { width: 360, height: 740 },
    { width: 390, height: 844 },
    { width: 412, height: 915 },
  ];

  for (const size of sizes) {
    await page.setViewportSize(size);
    await page.goto('/site-skin');
    await page.getByRole('button', { name: /Moonlit Library/ }).click();

    const geometry = await page.locator('header').evaluate(element => {
      const header = element.getBoundingClientRect();
      const children = Array.from(element.children).map(child => {
        const rect = child.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width };
      });
      return { header: { height: header.height, left: header.left, right: header.right }, children };
    });

    expect(geometry.header.height).toBeLessThanOrEqual(60);
    expect(geometry.header.left).toBeGreaterThanOrEqual(0);
    expect(geometry.header.right).toBeLessThanOrEqual(size.width);
    expect(geometry.children[1].width).toBeGreaterThanOrEqual(64);
    for (let index = 0; index < geometry.children.length - 1; index += 1) {
      expect(geometry.children[index].right).toBeLessThanOrEqual(geometry.children[index + 1].left + 0.5);
    }
    await expect(page.getByRole('button', { name: 'Install' })).toHaveCSS('white-space', 'nowrap');
  }
});

test('mobile Install dialog scrolls internally and contains focus', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/site-skin');
  await page.getByRole('button', { name: /Moonlit Library/ }).click();
  await page.getByRole('button', { name: 'Install' }).click();

  const dialog = page.getByRole('dialog', { name: 'Install your site skin' });
  const scrollRegion = dialog.locator('.overflow-y-auto');
  const dialogBox = await dialog.boundingBox();
  expect(dialogBox).not.toBeNull();
  expect(dialogBox!.y).toBeGreaterThanOrEqual(0);
  expect(dialogBox!.y + dialogBox!.height).toBeLessThanOrEqual(740);

  const before = await scrollRegion.evaluate(element => ({
    height: element.clientHeight,
    scrollHeight: element.scrollHeight,
    top: element.scrollTop,
  }));
  expect(before.scrollHeight).toBeGreaterThan(before.height);
  await scrollRegion.evaluate(element => { element.scrollTop = element.scrollHeight; });
  expect(await scrollRegion.evaluate(element => element.scrollTop)).toBeGreaterThan(before.top);

  for (let index = 0; index < 12; index += 1) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')))).toBe(true);
  }
});

test('analytics consent leaves the final editor controls reachable', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/site-skin');
  const consent = page.getByRole('heading', { name: 'Optional analytics' });
  await expect(consent).toBeVisible();

  await page.getByRole('button', { name: /Moonlit Library/ }).click();
  await page.getByRole('tab', { name: 'Customize' }).click();
  await page.getByRole('button', { name: /^Details/ }).click();
  const scrollbar = page.getByRole('switch', { name: 'Themed scrollbar' });
  const pane = page.getByTestId('site-skin-customize-pane');
  await pane.evaluate(element => { element.scrollTop = element.scrollHeight; });

  const positions = await Promise.all([
    scrollbar.boundingBox(),
    consent.locator('..').boundingBox(),
  ]);
  expect(positions[0]).not.toBeNull();
  expect(positions[1]).not.toBeNull();
  expect(positions[0]!.y + positions[0]!.height).toBeLessThanOrEqual(positions[1]!.y);
  const initiallyChecked = await scrollbar.getAttribute('aria-checked');
  await scrollbar.click();
  await expect(scrollbar).toHaveAttribute('aria-checked', initiallyChecked === 'true' ? 'false' : 'true');
});
