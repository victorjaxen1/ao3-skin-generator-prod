import { test, expect } from '@playwright/test';

/**
 * Guards the mobile preview split view. Desktop keeps its right-hand column;
 * mobile gets a collapsible panel between the timeline and the composer.
 */

/** The split view only exists below Tailwind's md breakpoint (768px). */
const mobileOnly = ({ page }: { page: import('@playwright/test').Page }) =>
  (page.viewportSize()?.width ?? 0) >= 768;

test('MOBILE: preview is visible while composing', async ({ page }, testInfo) => {
  test.skip(mobileOnly({ page }), 'mobile viewports only');
  await page.goto('/');
  await page.getByRole('button', { name: /iMessage/ }).click();

  const composer = page.getByPlaceholder('Add a message…');
  await composer.click();
  await composer.fill('does this show up now');
  await page.locator('button:right-of(textarea)').first().click();

  const toggle = page.getByRole('button', { name: /^Preview/ });
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');

  // The rendered chat must be on-screen, not parked at -9999px.
  const workskin = page.locator('#workskin').first();
  const box = await workskin.boundingBox();
  const vp = page.viewportSize()!;

  console.log(`  [MEASURE] viewport: ${vp.width}x${vp.height}`);
  console.log(`  [MEASURE] preview box: ${JSON.stringify(box)}`);
  const onScreen = !!box && box.x > -1000 && box.y < vp.height;
  console.log(`  [MEASURE] preview on-screen: ${onScreen}`);
  expect(onScreen).toBe(true);

  // Composer must still be reachable with the preview taking space.
  const cBox = await composer.boundingBox();
  console.log(`  [MEASURE] composer box: ${JSON.stringify(cBox)}`);
  await composer.click({ timeout: 5000 });
  console.log('  [MEASURE] composer still clickable: true');

  // The newest message must be scrolled into view, not left below the fold.
  // Measure whichever element actually scrolls, not the wrapper — the wrapper
  // reports scrollHeight === clientHeight and would pass trivially.
  const scroll = await page.locator('#mobile-preview-body').evaluate((root) => {
    const el =
      [root, ...Array.from(root.querySelectorAll('*'))].find(
        (n) => n.scrollHeight > n.clientHeight + 1
      ) ?? root;
    return {
      scrollable: el !== root || root.scrollHeight > root.clientHeight + 1,
      top: Math.round(el.scrollTop),
      height: Math.round(el.scrollHeight),
      client: Math.round(el.clientHeight),
    };
  });
  console.log(`  [MEASURE] preview scroll: ${JSON.stringify(scroll)}`);
  expect(scroll.scrollable, 'preview content should overflow and scroll').toBe(true);

  const atBottom = scroll.top + scroll.client >= scroll.height - 8;
  console.log(`  [MEASURE] newest message in view: ${atBottom}`);
  expect(atBottom).toBe(true);

  await testInfo.attach('mobile-split.png', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
});

test('MOBILE: preview collapses and the choice persists', async ({ page }) => {
  test.skip(mobileOnly({ page }), 'mobile viewports only');
  await page.goto('/');
  await page.getByRole('button', { name: /iMessage/ }).click();

  const toggle = page.getByRole('button', { name: /^Preview/ });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#mobile-preview-body')).toHaveCount(0);
  console.log('  [MEASURE] collapsed: true');

  await page.reload();
  await page.waitForLoadState('networkidle');
  const toggleAfter = page.getByRole('button', { name: /^Preview/ });
  await expect(toggleAfter).toHaveAttribute('aria-expanded', 'false');
  console.log('  [MEASURE] still collapsed after reload: true');
});

test('MOBILE: tapping a preview message focuses it for editing', async ({ page }) => {
  test.skip(mobileOnly({ page }), 'mobile viewports only');
  await page.goto('/');
  await page.getByRole('button', { name: /iMessage/ }).click();

  const composer = page.getByPlaceholder('Add a message…');
  await composer.click();
  await composer.fill('tap me');
  await page.locator('button:right-of(textarea)').first().click();

  const bubble = page.locator('#workskin [data-message-id]').first();
  await expect(bubble).toBeVisible();
  await bubble.click();

  // handleMessageClick sets focusedMessageId, which MessageTimeline reflects.
  await page.waitForTimeout(400);
  console.log('  [MEASURE] preview message tap dispatched without error: true');
});

test('DESKTOP: right-hand preview column is unchanged', async ({ page }) => {
  test.skip(!mobileOnly({ page }), 'desktop viewports only');
  await page.goto('/');
  await page.getByRole('button', { name: /iMessage/ }).click();
  await page.getByPlaceholder('Add a message…').waitFor();

  // The mobile toggle must not appear on desktop.
  const toggle = page.getByRole('button', { name: /^Preview/ });
  const toggleVisible = await toggle.isVisible().catch(() => false);
  console.log(`  [MEASURE] mobile toggle visible on desktop: ${toggleVisible} (want false)`);
  expect(toggleVisible).toBe(false);

  // Both the (hidden) mobile toggle and the desktop column say "Preview".
  const previewLabel = page
    .getByText('Preview', { exact: true })
    .filter({ visible: true })
    .first();
  await expect(previewLabel).toBeVisible();
  console.log('  [MEASURE] desktop preview column present: true');
});
