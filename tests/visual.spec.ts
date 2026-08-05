import { test } from '@playwright/test';

test('VISUAL: landing then workspace', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await testInfo.attach('01-landing.png', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });

  await page.getByRole('button', { name: /iMessage/ }).click();
  await page.getByPlaceholder('Add a message…').waitFor();
  await page.waitForTimeout(500);
  await testInfo.attach('02-workspace.png', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
});
