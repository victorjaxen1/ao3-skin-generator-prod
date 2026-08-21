import { expect, test } from '@playwright/test';
import { createProjectFile } from '../src/lib/projectFile';
import { defaultProject } from '../src/lib/schema';
import { createSiteThemeFile } from '../src/lib/projectFile';
import { cloneTheme, TEMPLATES } from '../src/lib/siteSkin/templates';

test('downloads, previews, and safely replaces a scene project backup', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start a blank iMessage conversation' }).click();

  await page.getByRole('button', { name: 'Open project backup' }).click();
  await expect(page.getByRole('dialog', { name: 'Project backup' })).toBeVisible();

  const firstDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download project backup' }).click();
  expect((await firstDownload).suggestedFilename()).toMatch(/^ao3skingen-.*\.json$/);

  const replacement = defaultProject();
  replacement.id = 'restored-project';
  replacement.template = 'android';
  replacement.settings.androidContactName = 'Restored contact';
  replacement.messages = [{
    id: 'restored-message',
    sender: 'Restored contact',
    content: 'Backup restored message',
    outgoing: false,
  }];
  const file = createProjectFile(replacement, [{ id: 'restored-character', name: 'Morgan', usageCount: 0 }], new Date('2026-08-12T12:00:00.000Z'));

  await page.locator('input[type="file"][accept*="json"]').setInputFiles({
    name: 'restore.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(file)),
  });
  const preview = page.getByLabel('Backup preview');
  await expect(preview).toContainText('android');
  await expect(preview).toContainText('1');
  await expect(preview).toContainText('Characters');

  const safetyDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Replace current project' }).click();
  expect((await safetyDownload).suggestedFilename()).toContain('before-import');

  await expect(page.getByText('Backup restored message').first()).toBeVisible();
  await page.getByRole('button', { name: 'Open project backup' }).click();
  await page.getByRole('button', { name: 'Close' }).click();
});

test('work-skin handoff exposes preflight and no-skin reading order', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start a blank iMessage conversation' }).click();
  await page.getByRole('button', { name: 'Open accessible work skin export' }).click();

  const dialog = page.getByRole('dialog', { name: 'Copy your work skin to AO3' });
  await dialog.getByText(/Checks and warnings/).click();
  await expect(dialog.getByText('Fallback speaker order is identifiable')).toBeVisible();
  await dialog.getByRole('tab', { name: 'Without work skin / downloads' }).click();
  await expect(dialog.getByText(/reading order and text your export is designed to preserve/i)).toBeVisible();
  await expect(dialog.getByLabel('Scene transcript')).toContainText('You (10:15)');

  const transcriptDownload = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download transcript (.txt)' }).click();
  expect((await transcriptDownload).suggestedFilename()).toMatch(/transcript\.txt$/);
});

test('site-skin handoff downloads and safely restores its separate theme format', async ({ page }) => {
  await page.goto('/site-skin?template=moonlit');
  await page.getByRole('button', { name: 'Install on AO3' }).click();
  const dialog = page.getByRole('dialog', { name: 'Install your site skin' });
  await dialog.getByText('Editable theme backup').click();

  const firstDownload = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download theme backup' }).click();
  expect((await firstDownload).suggestedFilename()).toMatch(/^ao3skingen-site-theme-.*\.json$/);

  const replacement = cloneTheme(TEMPLATES.find(theme => theme.meta.id === 'paper')!);
  const file = createSiteThemeFile(replacement, new Date('2026-08-12T12:00:00.000Z'));
  await dialog.locator('input[type="file"][accept*="json"]').setInputFiles({
    name: 'theme.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(file)),
  });
  await expect(dialog).toContainText(replacement.meta.name);

  const safetyDownload = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Replace current theme' }).click();
  expect((await safetyDownload).suggestedFilename()).toContain('before-import');
  await expect(dialog).toContainText(replacement.meta.name);
});
