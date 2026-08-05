import { test, expect } from '@playwright/test';

/**
 * Guards the fix for the picker gate: a first-time visitor must SEE the picker,
 * a returning visitor with saved work must NOT.
 */

test('RETURNING: saved work skips the picker', async ({ page }) => {
  // First visit — pick a platform and type something, which persists.
  await page.goto('/');
  await page.getByRole('button', { name: 'Start a blank iMessage conversation' }).click();

  const composer = page.getByPlaceholder('Add a message…');
  await composer.click();
  await composer.fill('saved from a previous session');
  await page.locator('button:right-of(textarea)').first().click();
  // The text renders in the timeline, the preview, and the hidden capture pane.
  await expect(page.getByText('saved from a previous session').first()).toBeVisible();

  // Give the 500ms debounced persist time to land.
  await page.waitForTimeout(1200);

  // Reload — same origin, so localStorage survives.
  await page.reload();
  await page.waitForLoadState('networkidle');

  const pickerBack = await page
    .getByRole('heading', { name: 'AO3 SkinGen' })
    .isVisible()
    .catch(() => false);
  const workVisible = await page
    .getByText('saved from a previous session')
    .first()
    .isVisible()
    .catch(() => false);

  console.log(`  [MEASURE] picker shown to returning visitor: ${pickerBack} (want false)`);
  console.log(`  [MEASURE] previous work restored: ${workVisible} (want true)`);

  expect(pickerBack).toBe(false);
  expect(workVisible).toBe(true);
});

test('FIRST VISIT: picker is shown', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: 'AO3 SkinGen' })).toBeVisible();
  console.log('  [MEASURE] first-time visitor sees picker: true');
});

test('TEMPLATE LINK: bypasses the picker', async ({ page }) => {
  await page.goto('/?template=ios-two-person-chat');
  await page.waitForLoadState('networkidle');

  const pickerVisible = await page
    .getByRole('heading', { name: 'AO3 SkinGen' })
    .isVisible()
    .catch(() => false);
  console.log(`  [MEASURE] picker shown for ?template= link: ${pickerVisible} (want false)`);
  expect(pickerVisible).toBe(false);
});
