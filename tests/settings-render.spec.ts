import { test, expect } from '@playwright/test';

/**
 * Every control in here used to be a lie: the setting existed, the toggle
 * rendered, and the generator never read it — the iOS status bar sat behind an
 * unreachable `else`, and the group names and WhatsApp online status were only
 * honoured on code paths the default settings never took.
 *
 * These assert the settings actually reach the output, so they cannot quietly
 * go dead again.
 */

const skin = (page: any) => page.locator('#workskin').first();

test('iMessage status bar renders when enabled (was unreachable)', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /blank iMessage/i }).click();
  await page.getByRole('button', { name: 'Open settings' }).click();
  await page.getByRole('button', { name: 'Advanced' }).click();
  await page.getByRole('switch', { name: 'Phone status bar' }).click();
  await page.waitForTimeout(500);

  const html = await skin(page).innerHTML();
  console.log('[STATUS BAR]', html.slice(0, 200));
  expect(html).toContain('ios-status-bar');
  expect(html).toContain('9:41');
});

test('iMessage group name renders in the header (was dead)', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /blank iMessage/i }).click();
  await page.getByRole('button', { name: 'Open settings' }).click();
  await page.getByRole('switch', { name: 'Group chat mode' }).click();
  await page.locator('[placeholder="Family Chat"]').fill('Avengers Assemble');
  await page.waitForTimeout(500);

  const html = await skin(page).innerHTML();
  console.log('[IOS GROUP]', html.match(/<div class="ios-header">.*?<\/div>/s)?.[0]);
  expect(html).toContain('Avengers Assemble');
});

test('WhatsApp group mode shows group name and participant count', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /blank WhatsApp/i }).click();
  await page.getByRole('button', { name: 'Open settings' }).click();
  await page.getByRole('switch', { name: 'Group chat mode' }).click();
  await page.locator('[placeholder="Work Team"]').fill('Team Cap');
  await page.getByRole('button', { name: '+ Add' }).click();
  await page.getByRole('button', { name: '+ Add' }).click();
  await page.waitForTimeout(500);

  const html = await skin(page).innerHTML();
  console.log('[WA GROUP]', html.match(/android-header-name-wrapper.*?<\/div><\/div>/s)?.[0]);
  expect(html).toContain('Team Cap');
  expect(html).toContain('2 participants');
});

test('Twitter: renaming updates tweets that are already written', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /blank X|blank Twitter/i }).click();

  await expect(page.getByPlaceholder(/What's happening/)).toBeVisible();
  await page.getByPlaceholder(/What's happening/).fill('first post');
  await page.getByRole('button', { name: 'Send message' }).click();
  await page.waitForTimeout(300);

  // Identity used to be stamped onto the tweet at send time, so this rename
  // left the existing tweet showing the old name.
  await page.getByRole('button', { name: /Edit display name/i }).click();
  await page.keyboard.type('Nat Romanoff');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);

  await expect(skin(page)).toContainText('Nat Romanoff');
});

test('Google: the results bar is generated from the query', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /blank Google/i }).click();
  // The workspace mounts asynchronously; interacting before it does is what
  // makes these flaky under load.
  await expect(page.getByRole('button', { name: /Edit search query/i })).toBeVisible();
  await page.getByRole('button', { name: /Edit search query/i }).click();
  await page.keyboard.type('captain jack sparrow');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);

  const stats = await page.locator('#workskin .search-stats').first().textContent();
  console.log('[GOOGLE STATS]', stats);
  // Plausible numbers instead of two more fields to fill in.
  expect(stats).toMatch(/^About [\d,]+ results \(\d\.\d\d seconds\)$/);
});

// One test per platform rather than a loop: each gets a fresh context, so a
// project saved by the previous platform can't skip the picker. (persistProject
// is debounced 500ms, which defeats clearing localStorage in-page.)
for (const [name, platform] of [
  ['iMessage', /blank iMessage/i],
  ['WhatsApp', /blank WhatsApp/i],
  ['Google', /blank Google/i],
] as const) {
  test(`${name} settings offer exactly one Advanced section`, async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: platform }).click();
    await page.getByRole('button', { name: 'Open settings' }).click();
    // Two sections both labelled "Advanced" is one place too many to look.
    await expect(page.getByRole('button', { name: 'Advanced' })).toHaveCount(1);
  });
}
