import { test, expect, Page } from '@playwright/test';

/**
 * Friction instrumentation. Each test reports a measurement rather than
 * asserting a "correct" answer, except where something is outright broken.
 */

const log = (label: string, value: unknown) =>
  console.log(`  [MEASURE] ${label}: ${value}`);

/** Count every element a user could plausibly click on the current screen. */
async function affordanceCount(page: Page) {
  return page.locator('button, a, input, textarea, select, [role="button"]').count();
}

// ───────────────────────────────────────────────────────────────────────────
// Task 1 — cold start to a saved image
// ───────────────────────────────────────────────────────────────────────────
test('TASK: cold start → iMessage with 2 messages → export', async ({ page }, testInfo) => {
  let steps = 0;

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'AO3 SkinGen' })).toBeVisible();

  log('landing affordances', await affordanceCount(page));
  await testInfo.attach('01-landing.png', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });

  // Step 1: choose platform
  await page.getByRole('button', { name: 'Start a blank iMessage conversation' }).click();
  steps++;

  const composer = page.getByPlaceholder('Add a message…');
  await expect(composer).toBeVisible();

  await testInfo.attach('02-workspace.png', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });

  // Steps 2-5: two messages, each = type + send
  const send = page.locator('button:right-of(textarea)').first();
  for (const text of ['hey are you awake', 'its 3am. why']) {
    await composer.fill(text);
    steps++;
    await send.click();
    steps++;
  }

  // Text renders in timeline, preview, and hidden capture pane.
  await expect(page.getByText('hey are you awake').first()).toBeVisible();

  // Step 6: export
  const saveImage = page.getByRole('button', { name: 'Save PNG' });
  await expect(saveImage).toBeVisible();
  steps++;

  log('steps to first export (excl. typing chars)', steps);
  await testInfo.attach('03-ready-to-export.png', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Task 2 — is there any preview feedback while composing?
// ───────────────────────────────────────────────────────────────────────────
test('FEEDBACK: preview visibility while composing', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start a blank iMessage conversation' }).click();

  const composer = page.getByPlaceholder('Add a message…');
  await composer.fill('does this show up anywhere');
  await page.locator('button:right-of(textarea)').first().click();

  // The desktop preview column is the only user-visible render of the result.
  const previewLabel = page.getByText('Preview', { exact: true }).first();
  const previewVisible = await previewLabel.isVisible().catch(() => false);

  log('preview pane visible', previewVisible);
  log('viewport', JSON.stringify(page.viewportSize()));

  await testInfo.attach('preview-state.png', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Task 3 — do template chips disclose their platform?
// ───────────────────────────────────────────────────────────────────────────
test('DISCLOSURE: template chip announces its platform', async ({ page }) => {
  await page.goto('/');

  const chip = page.getByRole('button', { name: /Group Chat/ });
  await expect(chip).toBeVisible();

  const chipText = (await chip.textContent())?.trim();
  const chipLabel = await chip.getAttribute('aria-label');
  log('chip label', chipText);
  log('chip aria-label', chipLabel ?? '(none)');

  await chip.click();

  // Read the resulting platform from the workspace.
  const header = page.locator('header, [class*="header"]').first();
  log('post-click header text', (await header.textContent())?.trim().slice(0, 80));
});

// ───────────────────────────────────────────────────────────────────────────
// Task 4 — controls with no accessible name
// ───────────────────────────────────────────────────────────────────────────
test('A11Y: icon-only controls lacking an accessible name', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start a blank iMessage conversation' }).click();
  await expect(page.getByPlaceholder('Add a message…')).toBeVisible();

  const unnamed = await page.$$eval('button', (btns) =>
    btns
      .filter((b) => {
        const text = (b.textContent || '').trim();
        const aria = b.getAttribute('aria-label');
        const title = b.getAttribute('title');
        return !text && !aria && !title;
      })
      .map((b) => (b.outerHTML || '').slice(0, 110))
  );

  const titleOnly = await page.$$eval('button', (btns) =>
    btns.filter((b) => {
      const text = (b.textContent || '').trim();
      const aria = b.getAttribute('aria-label');
      return !text && !aria && !!b.getAttribute('title');
    }).length
  );

  log('buttons with NO accessible name', unnamed.length);
  log('buttons named only by title= (invisible on touch)', titleOnly);

  await testInfo.attach('unnamed-buttons.txt', {
    body: unnamed.join('\n\n') || '(none)',
    contentType: 'text/plain',
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Task 5 — how much of the AO3 payoff is hidden on arrival at export
// ───────────────────────────────────────────────────────────────────────────
test('DISCLOSURE: AO3 instructions on arrival at export', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start a blank iMessage conversation' }).click();

  const composer = page.getByPlaceholder('Add a message…');
  await composer.fill('test');
  await page.locator('button:right-of(textarea)').first().click();

  const howTo = page.getByRole('button', { name: 'How to use' });
  await expect(howTo).toBeVisible();

  const pasteHintBefore = await page
    .getByText(/paste/i)
    .first()
    .isVisible()
    .catch(() => false);
  log('AO3 paste guidance visible before clicking How to use', pasteHintBefore);

  await howTo.click();
  const pasteHintAfter = await page
    .getByText(/paste/i)
    .first()
    .isVisible()
    .catch(() => false);
  log('…after clicking', pasteHintAfter);
});
