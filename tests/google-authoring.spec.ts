import { expect, test } from '@playwright/test';

const preview = (page: any) => page.locator('#workskin').first();

test('authors and edits a Google result while preserving search settings', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/?platform=google');

  await page.getByRole('textbox', { name: 'Search query' }).fill('fictional archive research');
  await page.getByPlaceholder(/^Title of the search result/).fill('A useful result');
  await page.getByRole('button', { name: 'Add result details' }).click();
  await page.getByPlaceholder(/^URL \(e\.g\./).fill('https://example.com/first');
  await page.getByPlaceholder(/^Description snippet/).fill('The original result description.');
  await page.getByRole('button', { name: 'Add result', exact: true }).click();

  await expect(preview(page).locator('.search-text')).toContainText('fictional archive research');
  await expect(preview(page).locator('.search-result')).toHaveCount(3);
  await expect(preview(page).locator('.result-title').last()).toContainText('A useful result');
  await expect(preview(page)).toContainText('The original result description.');

  const card = page.locator('[id^="timeline-msg-"]').last();
  await card.click();
  await card.locator('textarea').first().fill('An edited result title');
  await card.getByPlaceholder('URL').fill('https://example.com/edited');
  await card.getByPlaceholder('Description').fill('The edited result description.');
  await expect(preview(page).locator('.result-title').last()).toContainText('An edited result title');
  await expect(preview(page).locator('.result-url').last()).toContainText('example.com/edited');
  await expect(preview(page)).toContainText('The edited result description.');

  await page.getByRole('button', { name: 'Open settings' }).click();
  await page.getByRole('combobox', { name: 'Search engine' }).selectOption('naver');
  await page.getByRole('switch', { name: 'Did you mean' }).click();
  await page.getByRole('textbox', { name: 'Correction' }).fill('fiction archive research');
  await page.keyboard.press('Escape');

  await expect(preview(page).locator('.naver-green')).toHaveText('NAVER');
  await expect(preview(page)).toContainText('fiction archive research');
  await expect(page.getByRole('textbox', { name: 'Search query' })).toHaveValue('fictional archive research');
});

test('keeps Google query, result, and export actions usable at 360px', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/?platform=google');

  await expect(page.getByRole('textbox', { name: 'Search query' })).toBeVisible();
  await expect(page.getByPlaceholder(/^Title of the search result/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add result', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open accessible work skin export' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
