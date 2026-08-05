import { test, expect } from '@playwright/test';

/**
 * Guards three fixes: accessible names on icon controls, template chips
 * disclosing their platform and confirming destructive loads, and the AO3
 * guidance being visible to newcomers.
 */

// ───────────────────────────────────────────────────────────────────────────
// Accessible names
// ───────────────────────────────────────────────────────────────────────────
test('A11Y: every control has an accessible name', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start a blank iMessage conversation' }).click();
  await expect(page.getByPlaceholder('Add a message…')).toBeVisible();

  const audit = await page.$$eval('button', (btns) => {
    const unnamed: string[] = [];
    let titleOnly = 0;
    for (const b of btns) {
      const text = (b.textContent || '').trim();
      const aria = b.getAttribute('aria-label');
      const title = b.getAttribute('title');
      if (!text && !aria && !title) unnamed.push((b.outerHTML || '').slice(0, 120));
      if (!text && !aria && title) titleOnly++;
    }
    return { unnamed, titleOnly };
  });

  console.log(`  [MEASURE] buttons with NO accessible name: ${audit.unnamed.length}`);
  console.log(`  [MEASURE] buttons named only by title=: ${audit.titleOnly}`);

  await testInfo.attach('unnamed.txt', {
    body: audit.unnamed.join('\n\n') || '(none)',
    contentType: 'text/plain',
  });

  expect(audit.unnamed.length, 'controls with no accessible name').toBe(0);
  expect(audit.titleOnly, 'controls relying on title= alone (invisible on touch)').toBe(0);
});

test('A11Y: send button is reachable by name', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start a blank iMessage conversation' }).click();

  const composer = page.getByPlaceholder('Add a message…');
  await composer.click();
  await composer.fill('named send button');

  const send = page.getByRole('button', { name: 'Send message' });
  await expect(send).toBeVisible();
  await send.click();
  await expect(page.getByText('named send button').first()).toBeVisible();
  console.log('  [MEASURE] send button usable via accessible name: true');
});

// ───────────────────────────────────────────────────────────────────────────
// Template chip disclosure + destructive confirm
// ───────────────────────────────────────────────────────────────────────────
test('DISCLOSURE: chips are grouped under their platform', async ({ page }) => {
  await page.goto('/');

  const chip = page.getByRole('button', { name: /Group Chat/ });
  await expect(chip).toBeVisible();

  const label = await chip.getAttribute('aria-label');
  console.log(`  [MEASURE] chip aria-label: ${label}`);
  expect(label).toContain('WhatsApp');

  // The platform heading must be present on the picker itself.
  await expect(page.getByText('iMessage', { exact: true }).first()).toBeVisible();
  console.log('  [MEASURE] platform headings rendered: true');
});

test('SAFETY: first visit loads a template without a confirm prompt', async ({ page }) => {
  await page.goto('/');

  let prompted = false;
  page.on('dialog', async (d) => { prompted = true; await d.accept(); });

  await page.getByRole('button', { name: /Group Chat/ }).click();
  await expect(page.getByPlaceholder('Add a message…')).toBeVisible();

  console.log(`  [MEASURE] confirm shown on first visit: ${prompted} (want false)`);
  expect(prompted).toBe(false);
});

test('SAFETY: replacing existing work asks first', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start a blank iMessage conversation' }).click();

  const composer = page.getByPlaceholder('Add a message…');
  await composer.click();
  await composer.fill('work I would hate to lose');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByText('work I would hate to lose').first()).toBeVisible();

  // Back to the picker, then try to load a template over the top.
  await page.getByRole('button', { name: 'Back to platforms' }).click();

  let dialogText = '';
  page.on('dialog', async (d) => { dialogText = d.message(); await d.dismiss(); });

  await page.getByRole('button', { name: /Group Chat/ }).click();
  await page.waitForTimeout(500);

  console.log(`  [MEASURE] confirm text: ${dialogText || '(none)'}`);
  expect(dialogText).toContain('replaces your current conversation');

  // Dismissing leaves you on the picker, so there must be a way back to the
  // work rather than being forced to discard it.
  const resume = page.getByRole('button', { name: /Keep editing/ });
  await expect(resume).toBeVisible();
  await resume.click();

  await expect(page.getByText('work I would hate to lose').first()).toBeVisible();
  console.log('  [MEASURE] work preserved and reachable after dismissing: true');
});

test('SAFETY: no escape hatch is offered when there is nothing to lose', async ({ page }) => {
  await page.goto('/');
  const resume = page.getByRole('button', { name: /Keep editing/ });
  const visible = await resume.isVisible().catch(() => false);
  console.log(`  [MEASURE] "Keep editing" shown on first visit: ${visible} (want false)`);
  expect(visible).toBe(false);
});

// ───────────────────────────────────────────────────────────────────────────
// AO3 guidance
// ───────────────────────────────────────────────────────────────────────────
test('DISCLOSURE: AO3 guidance is visible to a newcomer', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start a blank iMessage conversation' }).click();
  await expect(page.getByPlaceholder('Add a message…')).toBeVisible();

  const visible = await page.getByText(/paste/i).first().isVisible().catch(() => false);
  console.log(`  [MEASURE] AO3 paste guidance visible without clicking: ${visible}`);
  expect(visible).toBe(true);

  const howTo = page.getByRole('button', { name: 'How to use' });
  await expect(howTo).toHaveAttribute('aria-expanded', 'true');
});

test('DISCLOSURE: dismissing the guidance is remembered', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start a blank iMessage conversation' }).click();

  const howTo = page.getByRole('button', { name: 'How to use' });
  await expect(howTo).toHaveAttribute('aria-expanded', 'true');
  await howTo.click();
  await expect(howTo).toHaveAttribute('aria-expanded', 'false');

  // persistProject is debounced 500ms; reloading sooner loses the project and
  // lands on the picker, where "How to use" does not exist.
  await page.waitForTimeout(1200);
  await page.reload();
  await page.waitForLoadState('networkidle');

  const howToAfter = page.getByRole('button', { name: 'How to use' });
  await expect(howToAfter).toHaveAttribute('aria-expanded', 'false');
  console.log('  [MEASURE] guidance stays dismissed after reload: true');
});
