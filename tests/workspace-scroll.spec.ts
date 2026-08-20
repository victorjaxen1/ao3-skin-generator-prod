import { expect, Page, test } from '@playwright/test';

/**
 * The workspace is exactly one viewport tall and scrolls internally. If the
 * document itself ever scrolls, the whole editor slides up and leaves a blank
 * strip under it — the header stays put (sticky) and the export bar stays put
 * (fixed), so the only thing that moves is the part you were working in.
 *
 * It took a real report to find, because the overflow that arms it is a few
 * pixels and comes from outside our own tree (Next's route announcer and the
 * dev error-overlay portal are siblings of #__next). Google shows it worst:
 * its scene is the tallest relative to its preview column.
 */

const wheelHard = async (page: Page, x = 640, y = 20) => {
  await page.mouse.move(x, y);
  for (let i = 0; i < 6; i++) await page.mouse.wheel(0, 400);
  await page.waitForTimeout(400);
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('ao3skingen_analytics_consent', 'denied');
  });
});

for (const example of ['News Articles', 'Search History']) {
  test(`the workspace document does not scroll: ${example}`, async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 840 });
    await page.goto('/');
    await page.getByRole('button', { name: example }).first().click();
    await page.getByRole('button', { name: 'Save PNG' }).first().waitFor();
    await page.waitForTimeout(1000);

    // Over the header, so no internal scroll region can absorb it.
    await wheelHard(page, 960, 20);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });
}

test('the picker and site skin still scroll, and the lock lifts on the way out', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 700 });

  await page.goto('/');
  await page.getByRole('button', { name: /iMessage/ }).first().waitFor();
  await wheelHard(page, 640, 400);
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

  await page.goto('/site-skin');
  await page.waitForTimeout(1000);
  await wheelHard(page, 640, 400);
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

  // A locked workspace must not leave the picker locked behind it.
  await page.goto('/?platform=google');
  await page.getByRole('button', { name: 'Save PNG' }).first().waitFor();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: 'Back to platforms' }).click();
  await page.waitForTimeout(600);
  await wheelHard(page, 640, 400);
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
});
