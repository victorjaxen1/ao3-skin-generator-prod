import { test } from '@playwright/test';

test('LANDING: what a first-time visitor actually sees', async ({ page }, testInfo) => {
  // Fresh context = empty localStorage = genuine first visit.
  await page.goto('/');

  // Snapshot the very first paint, before effects settle.
  await testInfo.attach('first-paint.png', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });

  await page.waitForLoadState('networkidle');

  const pickerVisible = await page
    .getByRole('heading', { name: 'AO3 SkinGen' })
    .isVisible()
    .catch(() => false);

  const composerVisible = await page
    .getByPlaceholder('Add a message…')
    .isVisible()
    .catch(() => false);

  const seededText = await page
    .getByText(/waiting at the cafe/i)
    .first()
    .isVisible()
    .catch(() => false);

  console.log(`  [MEASURE] platform picker visible: ${pickerVisible}`);
  console.log(`  [MEASURE] composer visible (skipped straight to workspace): ${composerVisible}`);
  console.log(`  [MEASURE] pre-seeded "Alice" conversation present: ${seededText}`);
  console.log(`  [MEASURE] localStorage empty at start: true (fresh context)`);

  await testInfo.attach('settled.png', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
});
