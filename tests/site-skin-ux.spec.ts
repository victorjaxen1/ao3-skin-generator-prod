import { expect, Page, test } from '@playwright/test';

async function cleanGallery(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('ao3skingen_analytics_consent', 'denied');
  });
  await page.goto('/site-skin');
  await page.evaluate(() => localStorage.removeItem('ao3SiteSkinTheme'));
  await page.reload();
}

async function openEditor(page: Page) {
  await cleanGallery(page);
  await page.getByRole('button', { name: /Moonlit Library/ }).click();
  await expect(page.getByRole('button', { name: /^Install(?: on AO3)?$/ })).toBeVisible();
}

test('settled undo and redo preserve the history cursor and truncate branches', async ({ page }) => {
  await openEditor(page);

  const ticking = page.getByRole('button', { name: 'Page pattern: Ticking' });
  const gingham = page.getByRole('button', { name: 'Page pattern: Gingham' });
  const dots = page.getByRole('button', { name: 'Page pattern: Dots' });
  const undo = page.getByRole('button', { name: 'Undo last change' });
  const redo = page.getByRole('button', { name: 'Redo last change' });

  await page.getByRole('button', { name: /^Depth/ }).click();
  await ticking.click();
  await page.waitForTimeout(700);
  await gingham.click();
  await page.waitForTimeout(700);

  await undo.click();
  await page.waitForTimeout(700);
  await expect(ticking).toHaveAttribute('aria-pressed', 'true');
  await expect(redo).toBeEnabled();

  await redo.click();
  await expect(gingham).toHaveAttribute('aria-pressed', 'true');

  await undo.click();
  await dots.click();
  await page.waitForTimeout(700);
  await expect(dots).toHaveAttribute('aria-pressed', 'true');
  await expect(redo).toBeDisabled();
});

test('selecting another template protects the current browser save', async ({ page }) => {
  await openEditor(page);
  await page.getByLabel('Accent', { exact: true }).fill('#123456');
  await page.getByRole('button', { name: 'Templates' }).click();

  const paper = page.getByRole('button', { name: /Paper & Ink/ });
  await paper.click();
  const dialog = page.getByRole('dialog', { name: 'Start over with Paper & Ink?' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Keep current theme' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(paper).toBeFocused();

  await paper.click();
  await dialog.getByRole('button', { name: 'Start with Paper & Ink' }).click();
  await expect(page.getByText('Paper & Ink', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Undo last change' })).toBeDisabled();
});

test('site-skin dialogs contain focus and restore it to their opener', async ({ page }) => {
  await openEditor(page);
  const opener = page.getByRole('button', { name: 'Install on AO3' });
  await opener.click();
  const dialog = page.getByRole('dialog', { name: 'Install your site skin' });
  await expect(dialog).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const active = document.activeElement;
    return Boolean(active?.closest('[role="dialog"]'));
  })).toBe(true);

  for (let index = 0; index < 10; index += 1) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')))).toBe(true);
  }
  for (let index = 0; index < 10; index += 1) {
    await page.keyboard.press('Shift+Tab');
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')))).toBe(true);
  }
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('');

  const paletteOpener = page.getByRole('button', { name: 'Take these from a picture or a site' });
  await paletteOpener.click();
  const paletteDialog = page.getByRole('dialog', { name: 'Build colours from a picture or a website' });
  await expect(paletteDialog).toBeVisible();
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(paletteDialog).toHaveCount(0);
  await expect(paletteOpener).toBeFocused();
});

test('editor sections disclose progressively and reset through undo history', async ({ page }) => {
  await openEditor(page);

  const colours = page.locator('button[aria-controls="site-skin-section-colors"]');
  const header = page.locator('button[aria-controls="site-skin-section-header"]');
  const type = page.locator('button[aria-controls="site-skin-section-typography"]');
  await expect(colours).toHaveAttribute('aria-expanded', 'true');
  await expect(header).toHaveAttribute('aria-expanded', 'false');
  await expect(type).toHaveAttribute('aria-expanded', 'false');

  await header.click();
  await type.click();
  await expect(header).toHaveAttribute('aria-expanded', 'true');
  await expect(type).toHaveAttribute('aria-expanded', 'true');

  await page.getByRole('button', { name: 'Header fade: Vertical' }).click();
  const reset = page.getByRole('button', { name: 'Reset Header section' });
  await expect(reset).toBeVisible();
  await expect(header).toContainText('Vertical fade');
  await page.waitForTimeout(700);

  await reset.click();
  await expect(reset).toHaveCount(0);
  await expect(header).toContainText('Diagonal fade');
  await page.waitForTimeout(700);

  await page.getByRole('button', { name: 'Undo last change' }).click();
  await expect(page.getByRole('button', { name: 'Header fade: Vertical' })).toHaveAttribute('aria-pressed', 'true');
});

test('a returning catalog theme resets to its original template baseline', async ({ page }) => {
  await openEditor(page);
  await page.getByLabel('Accent', { exact: true }).fill('#ff8800');
  await page.waitForTimeout(700);

  await page.reload();
  await page.getByRole('button', { name: /Keep editing/ }).click();
  await expect(page.getByLabel('Accent', { exact: true })).toHaveValue('#ff8800');
  await page.getByRole('button', { name: 'Reset Colours section' }).click();
  await expect(page.getByLabel('Accent', { exact: true })).toHaveValue('#7761a8');
});

test('showcase is calm and Inspect exposes the component coverage states', async ({ page }) => {
  await openEditor(page);
  const frame = page.frameLocator('iframe[title="Site skin preview"]');
  const inspect = page.getByRole('button', { name: 'Inspect components' });

  await expect(frame.locator('#header .dropdown.open')).toHaveCount(0);
  await expect(frame.locator('.autocomplete .dropdown ul')).toBeHidden();
  await expect(inspect).toHaveAttribute('aria-pressed', 'false');

  await inspect.click();
  await expect(inspect).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Showing open menus and form states')).toBeVisible();
  await expect(frame.locator('#header .dropdown.open')).toBeVisible();
  await expect(frame.locator('.autocomplete .dropdown ul')).toBeVisible();

  await inspect.click();
  await expect(frame.locator('#header .dropdown.open')).toHaveCount(0);
  await expect(frame.locator('.autocomplete .dropdown ul')).toBeHidden();
});

test('Reading metadata contains the floated Stats row before the work begins', async ({ page }) => {
  await openEditor(page);
  await page.getByRole('tab', { name: 'Reading' }).click();

  const frame = page.frameLocator('iframe[title="Site skin preview"]');
  const bounds = await frame.locator('body').evaluate(() => {
    const metadata = document.querySelector('dl.work.meta');
    const stats = document.querySelector('dl.work.meta > dd.stats');
    const work = document.querySelector('#work-skin');
    if (!metadata || !stats || !work) return null;
    return {
      metadataBottom: metadata.getBoundingClientRect().bottom,
      statsBottom: stats.getBoundingClientRect().bottom,
      workTop: work.getBoundingClientRect().top,
    };
  });

  expect(bounds).not.toBeNull();
  expect(bounds!.statsBottom).toBeLessThanOrEqual(bounds!.metadataBottom);
  expect(bounds!.metadataBottom).toBeLessThanOrEqual(bounds!.workTop);
});

test('clipboard denial opens the manual CSS fallback', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error('denied')) },
    });
  });
  await openEditor(page);
  await page.getByRole('button', { name: 'Install on AO3' }).click();

  const css = page.getByLabel('Site skin CSS');
  await expect(css).toBeHidden();
  await page.getByRole('button', { name: 'Copy site skin CSS' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'clipboard' })).toBeVisible();
  await expect(css).toBeVisible();
});

test('successful copy gives installation-oriented live feedback', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.resolve() },
    });
  });
  await openEditor(page);
  await page.getByRole('button', { name: 'Install on AO3' }).click();
  await page.getByRole('button', { name: 'Copy site skin CSS' }).click();
  await expect(page.getByText('Copied. Keep this tab open while you paste it into AO3.')).toBeVisible();
});
