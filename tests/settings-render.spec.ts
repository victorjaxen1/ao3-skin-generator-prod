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
  // Group chat is who is in the conversation, so it lives with the people now
  // rather than in Settings. Everything asserted below is generator output and
  // is unchanged.
  const sheet = page.getByRole('dialog', { name: 'People' });
  await page.getByRole('button', { name: 'Open people' }).click();
  await sheet.getByRole('switch', { name: 'Group chat mode' }).click();
  await sheet.locator('[placeholder="Family Chat"]').fill('Avengers Assemble');
  await page.waitForTimeout(500);

  const html = await skin(page).innerHTML();
  console.log('[IOS GROUP]', html.match(/<div class="ios-header">.*?<\/div>/s)?.[0]);
  expect(html).toContain('Avengers Assemble');
});

test('WhatsApp group mode shows group name and participant count', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /blank WhatsApp/i }).click();
  const sheet = page.getByRole('dialog', { name: 'People' });
  await page.getByRole('button', { name: 'Open people' }).click();
  await sheet.getByRole('switch', { name: 'Group chat mode' }).click();
  await sheet.locator('[placeholder="Work Team"]').fill('Team Cap');
  // Members are now created through the same complete-profile form as every
  // other identity, rather than by appending a blank participant row.
  for (const name of ['Bucky', 'Sam']) {
    await sheet.getByRole('button', { name: 'Add person' }).click();
    await sheet.getByPlaceholder('Person name').fill(name);
    await sheet.getByRole('button', { name: 'Add to this conversation' }).click();
  }
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
  // left the existing tweet showing the old name. The header title now opens
  // the account editor instead of editing the name in place.
  await page.getByRole('button', { name: /Edit identity for/i }).click();
  const accounts = page.getByRole('dialog', { name: 'Accounts' });
  await accounts.getByPlaceholder('Display name').fill('Nat Romanoff');
  await accounts.getByRole('button', { name: 'Save changes' }).click();
  await accounts.getByRole('button', { name: 'Close' }).click();
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

// ───────────────────────────────────────────────────────────────────────────
// The split the People panel exists to enforce: Settings answers "how does it
// look", the People panel answers "who is in it". These pin the boundary, so a
// later change cannot quietly put identity back into Settings and leave two
// places to look for the same thing.
// ───────────────────────────────────────────────────────────────────────────

test('settings holds no identity fields — those live with the people', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /blank iMessage/i }).click();
  await page.getByRole('button', { name: 'Open settings' }).click();
  await expect(page.getByText('Contact photo')).toHaveCount(0);
  await expect(page.getByRole('switch', { name: 'Group chat mode' })).toHaveCount(0);
});

test('your own name reaches the hidden speaker label, retroactively', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /blank iMessage/i }).click();
  await expect(page.getByPlaceholder('Add a message…')).toBeVisible();

  // Written BEFORE the rename — the stamped sender is 'You'.
  await page.getByPlaceholder('Add a message…').fill('on my way');
  await page.getByRole('button', { name: 'Send message' }).click();
  await page.waitForTimeout(300);

  // "You" is a scene identity now, edited through the same form as everyone
  // else rather than through a bare "Your name" field.
  const sheet = page.getByRole('dialog', { name: 'People' });
  await page.getByRole('button', { name: 'Open people' }).click();
  await sheet.getByRole('button', { name: /^You/ }).click();
  await sheet.getByPlaceholder('Person name').fill('Rhys');
  await sheet.getByRole('button', { name: 'Save changes' }).click();
  await sheet.getByRole('button', { name: 'Close' }).click();
  await page.waitForTimeout(500);

  // The label is what a reader gets with Hide Creator's Style on, and it is
  // resolved at render time — so the message written before the rename carries
  // the new name too.
  const html = await skin(page).innerHTML();
  console.log('[YOUR NAME]', html.match(/<dt class="visually-hidden">[^<]*<\/dt>/g));
  expect(html).toContain('>Rhys: <');
  expect(html).not.toContain('>You: <');
});

test('WhatsApp hides the online status controls in group mode', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /blank WhatsApp/i }).click();
  await page.getByRole('button', { name: 'Open settings' }).click();
  await expect(page.getByRole('switch', { name: 'Online status' })).toBeVisible();
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Open people' }).click();
  await page.getByRole('switch', { name: 'Group chat mode' }).click();
  await page.keyboard.press('Escape');

  // A group header shows the member count instead and never reads
  // androidStatusText, so these two were live controls over dead settings.
  await page.getByRole('button', { name: 'Open settings' }).click();
  await expect(page.getByRole('switch', { name: 'Online status' })).toHaveCount(0);
});

test('Google keeps its search-shaping rows out of Advanced', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /blank Google/i }).click();
  await page.getByRole('button', { name: 'Open settings' }).click();
  // Visible without expanding anything. The engine variant only swaps a logo
  // and a CSS class — suggestions and the correction render for all three
  // variants alike, and they are most of what makes a Google mock read as real.
  await expect(page.getByText('Autocomplete suggestions')).toBeVisible();
  await expect(page.getByText('Did you mean')).toBeVisible();
});

test('a reaction lands inside the bubble, where the only rule for it can match', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /blank iMessage/i }).click();
  await expect(page.getByPlaceholder('Add a message…')).toBeVisible();

  await page.getByPlaceholder('Add a message…').fill('you free tonight?');
  await page.getByRole('button', { name: 'Message options' }).click();
  await page.getByRole('button', { name: 'React with ❤️' }).click();
  await page.getByRole('button', { name: 'Send message' }).click();
  await page.waitForTimeout(400);

  // Presence is not the assertion — the emoji was always present. It used to be
  // emitted as a SIBLING of the bubble, and the only rule that styles it is
  // `#workskin dd.bubble .reaction`, a descendant selector, so it rendered as
  // unstyled inline text in the preview, the PNG and on AO3 alike.
  const html = await skin(page).innerHTML();
  expect(html).toMatch(/<dd class="bubble[^"]*"[^>]*>(?:(?!<\/dd>).)*class="reaction"/s);
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
