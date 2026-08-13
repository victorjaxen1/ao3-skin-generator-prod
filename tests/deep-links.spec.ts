import { expect, test } from '@playwright/test';

test('a valid platform link opens a blank platform workspace', async ({ page }) => {
  await page.goto('/?platform=twitter');
  // The non-Google header title opens the identity editor rather than editing
  // inline, so it names the identity instead of the field.
  await expect(page.getByRole('button', { name: /Edit identity for X \/ Twitter/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'AO3 SkinGen' })).toBeHidden();
});

test('an invalid platform link falls back to the platform picker', async ({ page }) => {
  await page.goto('/?platform=not-a-platform');
  await expect(page.getByRole('heading', { name: 'AO3 SkinGen' })).toBeVisible();
});
