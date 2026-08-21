import { expect, test } from '@playwright/test';
import { mkdir } from 'fs/promises';
import path from 'path';

const evidenceDir = path.join(process.cwd(), 'tmp', 'workskin-workspace-ux-final');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ao3skingen_analytics_consent', 'denied'));
  await mkdir(evidenceDir, { recursive: true });
});

for (const width of [360, 390, 412]) {
  test(`workspace remains usable without horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 360 ? 740 : 844 });
    await page.goto('/?platform=ios');
    await expect(page.getByRole('button', { name: 'Back to platforms' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open project backup' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open settings' })).toBeVisible();
    await expect(page.getByText('Saved in this browser')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Undo project change' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open accessible work skin export' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: path.join(evidenceDir, `mobile-${width}.png`) });
  });
}

test('390px work-skin modal opens on the primary CSS action', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?platform=ios');
  await page.getByRole('button', { name: 'Open accessible work skin export' }).click();
  const dialog = page.getByRole('dialog', { name: 'Copy your work skin to AO3' });
  const copyCss = dialog.getByRole('button', { name: 'Copy work skin CSS' });
  await expect(copyCss).toBeFocused();
  const box = await copyCss.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y + box!.height).toBeLessThanOrEqual(844);
  await page.screenshot({ path: path.join(evidenceDir, 'mobile-390-workskin.png') });
});

test('desktop keeps authoring and preview side by side', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/?platform=ios');
  await expect(page.getByText('Preview', { exact: true }).last()).toBeVisible();
  await expect(page.getByPlaceholder('Add a message…')).toBeVisible();
  await page.screenshot({ path: path.join(evidenceDir, 'desktop-ios.png') });
});
