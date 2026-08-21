import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ao3skingen_analytics_consent', 'denied'));
});

test('protects settings-only work and keeps replacement cancel side-effect free', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start a blank Google conversation' }).click();
  const query = page.getByRole('textbox', { name: 'Search query' });
  await query.fill('settings only work');
  await expect(page.getByText('Saving…')).toBeVisible();
  await expect(page.getByText('Saved in this browser')).toBeVisible();

  await page.getByRole('button', { name: 'Back to platforms' }).click();
  await expect(page.getByRole('button', { name: 'Keep editing my project' })).toBeVisible();
  await page.getByRole('button', { name: 'Start a blank WhatsApp conversation' }).click();

  const dialog = page.getByRole('dialog', { name: 'Replace your current project?' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Keep editing current project' })).toBeFocused();
  await dialog.getByRole('button', { name: 'Keep editing current project' }).click();
  await page.getByRole('button', { name: 'Keep editing my project' }).click();
  await expect(query).toHaveValue('settings only work');
});

test('stored zero-post Twitter project resumes directly', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start a blank X / Twitter conversation' }).click();
  await page.waitForTimeout(700);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Open accounts' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start a blank X / Twitter conversation' })).toBeHidden();
});

test('backup and work-skin dialogs enter focus, close on Escape, and restore focus', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start a blank iMessage conversation' }).click();

  const backupOpener = page.getByRole('button', { name: 'Open project backup' });
  await backupOpener.click();
  const backup = page.getByRole('dialog', { name: 'Project backup' });
  await expect(backup.getByRole('button', { name: 'Download project backup' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(backup).toBeHidden();
  await expect(backupOpener).toBeFocused();

  const workSkinOpener = page.getByRole('button', { name: 'Open accessible work skin export' });
  await workSkinOpener.click();
  const workSkin = page.getByRole('dialog', { name: 'Copy your work skin to AO3' });
  await expect(workSkin.getByRole('button', { name: 'Copy work skin CSS' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(workSkin).toBeHidden();
  await expect(workSkinOpener).toBeFocused();
});

test('visible project history preserves native text undo', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start a blank Google conversation' }).click();
  const query = page.getByRole('textbox', { name: 'Search query' });
  const undo = page.getByRole('button', { name: 'Undo project change' });
  const redo = page.getByRole('button', { name: 'Redo project change' });
  await expect(undo).toBeDisabled();
  await expect(redo).toBeDisabled();

  await query.fill('first saved query');
  await expect(undo).toBeEnabled({ timeout: 2_000 });
  await query.click();
  await query.press('End');
  await query.type(' extra');
  await query.press('Control+z');
  await expect(query).toHaveValue(/first saved query/);
  await expect(query).not.toHaveValue('');
  const nativeUndoValue = await query.inputValue();
  await page.waitForTimeout(600);

  await undo.click();
  await expect(redo).toBeEnabled();
  await redo.click();
  await expect(query).toHaveValue(nativeUndoValue);
});

test('first-use export help stays compact and work-skin action leads the handoff', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Start a blank iMessage conversation' }).click();
  await expect(page.getByRole('button', { name: 'Not sure which export to use? Compare the options.' })).toBeVisible();
  await expect(page.getByText('Get AO3 image code — uploads')).toBeHidden();

  await page.getByRole('button', { name: 'Open accessible work skin export' }).click();
  const dialog = page.getByRole('dialog', { name: 'Copy your work skin to AO3' });
  const copyCss = dialog.getByRole('button', { name: 'Copy work skin CSS' });
  const box = await copyCss.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y + box!.height).toBeLessThanOrEqual(844);
  await expect(dialog.getByRole('button', { name: 'Copy scene HTML' })).toBeAttached();
});

test('clipboard denial exposes and focuses the matching manual fallback', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start a blank iMessage conversation' }).click();
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error('denied')) },
    });
  });
  await page.getByRole('button', { name: 'Open accessible work skin export' }).click();
  const dialog = page.getByRole('dialog', { name: 'Copy your work skin to AO3' });
  await dialog.getByRole('button', { name: 'Copy work skin CSS' }).click();
  await expect(dialog.getByRole('alert')).toContainText('blocked the clipboard');
  await expect(dialog.getByLabel('Work skin CSS')).toBeFocused();
});
