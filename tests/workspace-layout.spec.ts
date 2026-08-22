import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1920, height: 839 } });

test('Google examples do not leave unused space above the export bar', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('ao3SkinProject');
    localStorage.setItem('ao3skin_help_dismissed', '1');
    localStorage.setItem('ao3skingen_analytics_consent', 'denied');
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const googleExample = page.getByRole('button', { name: 'Search History — Google template' });
  await googleExample.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await googleExample.click();
  await page.locator('#workskin:visible').first().waitFor({ state: 'visible' });

  const layout = await page.evaluate(() => {
    const exportButton = document.querySelector<HTMLButtonElement>('button[aria-label="Save PNG"]')!;
    const exportBar = exportButton.closest<HTMLElement>('.fixed')!;
    const workspace = document.querySelector<HTMLElement>('[data-testid="workspace-content"]')!;
    const editor = workspace.firstElementChild as HTMLElement;
    const barRect = exportBar.getBoundingClientRect();
    const workspaceRect = workspace.getBoundingClientRect();
    const editorRect = editor.getBoundingClientRect();
    const rootStyle = getComputedStyle(document.documentElement);
    return {
      exportHeight: barRect.height,
      exportTop: barRect.top,
      workspaceBottom: workspaceRect.bottom,
      editorBottom: editorRect.bottom,
      exportVar: rootStyle.getPropertyValue('--export-bar-h'),
      analyticsVar: rootStyle.getPropertyValue('--analytics-consent-h'),
      workspacePaddingBottom: getComputedStyle(workspace).paddingBottom,
      scrollY: window.scrollY,
    };
  });

  expect(layout.scrollY).toBe(0);
  expect(layout.workspaceBottom - layout.editorBottom).toBeLessThanOrEqual(layout.exportHeight + 2);
  expect(layout.exportTop - layout.editorBottom).toBeLessThanOrEqual(2);
});
