import { test, expect, Page } from '@playwright/test';

/**
 * The site-skin journey, end to end: gallery → editor → preview states →
 * export → copy.
 *
 * Following tests/settings-render.spec.ts: assert that the *compiled CSS*
 * carries the change, not merely that a control moved. A control that toggles
 * its own aria-pressed and changes nothing downstream is the exact failure
 * these tests exist to catch.
 *
 * NOTE ON RUNNING THESE. playwright.config.ts points the browser projects at
 * the deployed site by default, and this feature may not be deployed yet. Run
 * against a local build:
 *
 *   npm run dev
 *   UX_BASE_URL=http://localhost:3000 npx playwright test --project=desktop tests/site-skin.spec.ts
 */

/** The CSS the user would copy, read out of the export dialog. */
async function exportedCss(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'Copy to AO3' }).click();
  const textarea = page.getByLabel('Site skin CSS');
  await expect(textarea).toBeVisible();
  const css = await textarea.inputValue();
  await page.getByRole('button', { name: 'Close' }).click();
  return css;
}

async function openEditor(page: Page, templateName = 'Moonlit Library') {
  await page.goto('/site-skin');
  await page.evaluate(() => localStorage.removeItem('ao3SiteSkinTheme'));
  await page.reload();
  await page.getByRole('button', { name: new RegExp(templateName) }).click();
  await expect(page.getByRole('button', { name: 'Copy to AO3' })).toBeVisible();
}

test('the picker offers the site skin builder as its own thing', async ({ page }) => {
  await page.goto('/');
  const link = page.getByRole('link', { name: /Site skin/ });
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(/\/site-skin/);
  await expect(page.getByRole('heading', { name: 'Make AO3 feel like yours' })).toBeVisible();
});

test('a ?template= link opens the editor on that template', async ({ page }) => {
  // What the examples gallery links to. Landing on the gallery instead would
  // make every card on that page a dead end.
  await page.goto('/site-skin?template=gothic');
  await expect(page.getByRole('button', { name: 'Copy to AO3' })).toBeVisible();
  await expect(page.getByText('Gothic Velvet')).toBeVisible();

  // Its accent, not the default template's.
  await expect(page.getByLabel('Accent', { exact: true })).toHaveValue('#b35575');
});

test('a banner-ready template arrives with its header controls set', async ({ page }) => {
  await page.goto('/site-skin?template=western');
  await expect(page.getByText('Sun-Bleached Western')).toBeVisible();
  await expect(page.getByRole('switch', { name: "Hide AO3's logo" })).toHaveAttribute(
    'aria-checked',
    'true'
  );
});

test('an unknown template id falls back to the gallery, not a silent default', async ({ page }) => {
  await page.goto('/site-skin?template=not-a-real-template');
  await expect(page.getByRole('heading', { name: 'Make AO3 feel like yours' })).toBeVisible();
});

test('mood filters narrow the gallery', async ({ page }) => {
  await page.goto('/site-skin');
  // A saved theme adds a "Keep editing …" button carrying the same name, so
  // the counts below only mean what they say on a clean slate.
  await page.evaluate(() => localStorage.removeItem('ao3SiteSkinTheme'));
  await page.reload();
  await expect(page.getByRole('button', { name: /Moonlit Library/ })).toHaveCount(1);

  await page.getByRole('button', { name: 'Light', exact: true }).click();
  // Moonlit Library is dark + decorative, so it should drop out.
  await expect(page.getByRole('button', { name: /Moonlit Library/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Paper & Ink/ })).toHaveCount(1);
});

test('the editor opens with the chosen template and reports reviewed checks passed', async ({ page }) => {
  await openEditor(page);
  await expect(page.getByText('Moonlit Library')).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Checks passed' })).toBeVisible();
});

test('the preview renders AO3 markup inside an isolated iframe', async ({ page }) => {
  await openEditor(page);

  const frame = page.frameLocator('iframe[title="Site skin preview"]');
  await expect(frame.locator('#header')).toBeVisible();
  await expect(frame.locator('li.blurb').first()).toBeVisible();

  // The skin restyles `body`. If the iframe were not doing its job, the
  // application around it would have been repainted too.
  const appBackground = await page.evaluate(
    () => getComputedStyle(document.body).backgroundColor
  );
  const previewBackground = await frame
    .locator('body')
    .evaluate(el => getComputedStyle(el).backgroundColor);
  expect(previewBackground).toBe('rgb(16, 23, 37)'); // #101725
  expect(appBackground).not.toBe(previewBackground);
});

test('each preview state renders the selectors its rules depend on', async ({ page }) => {
  await openEditor(page);
  const frame = page.frameLocator('iframe[title="Site skin preview"]');

  await page.getByRole('tab', { name: 'Reading' }).click();
  await expect(frame.locator('#workskin')).toBeVisible();
  await expect(frame.locator('#chapters .userstuff hr')).toBeVisible();

  await page.getByRole('tab', { name: 'Dashboard' }).click();
  await expect(frame.locator('#dashboard')).toBeVisible();
  await expect(frame.locator('#dashboard span.current')).toBeVisible();

  await page.getByRole('tab', { name: 'Browse' }).click();
  await expect(frame.locator('li.blurb').first()).toBeVisible();
});

test('a colour change reaches the compiled CSS and the preview together', async ({ page }) => {
  await openEditor(page);

  // exact, or it also matches the "Preview page" tablist.
  await page.getByLabel('Page', { exact: true }).fill('#123456');

  const frame = page.frameLocator('iframe[title="Site skin preview"]');
  await expect
    .poll(() => frame.locator('body').evaluate(el => getComputedStyle(el).backgroundColor))
    .toBe('rgb(18, 52, 86)');

  expect(await exportedCss(page)).toContain('#123456');
});

test('the text size control changes the compiled scale, once', async ({ page }) => {
  await openEditor(page);
  await page.getByRole('button', { name: 'Largest', exact: true }).click();

  const css = await exportedCss(page);
  expect(css).toContain('font-size: 125%');
  // Exactly one percentage font-size, on body. More than one multiplies.
  expect(css.match(/font-size: \d+%/g)).toHaveLength(1);
});

test('the detail toggles add and remove their rules', async ({ page }) => {
  await openEditor(page);

  let css = await exportedCss(page);
  expect(css).toContain('#chapters .userstuff p:first-of-type::first-letter');

  await page.getByRole('switch', { name: 'Drop cap' }).click();
  css = await exportedCss(page);
  expect(css).not.toContain('first-letter');
  // And never the unscoped form, which decorates summaries and notes too.
  expect(css).not.toContain('#workskin p:first-of-type');
});

test('a low-contrast accent is warned about, and the fix repairs it', async ({ page }) => {
  await openEditor(page);

  // Drag the accent almost onto the card colour.
  await page.getByLabel('Accent').fill('#192339');

  const warning = page.getByRole('status').filter({ hasText: 'Links, tags and headings' });
  await expect(warning).toBeVisible();

  // Readability is not a safety question: the skin still saves on AO3.
  await expect(page.getByRole('status').filter({ hasText: 'Checks passed' })).toBeVisible();

  await page.getByRole('button', { name: 'Fix accent colour' }).click();
  await expect(warning).toHaveCount(0);
});

test('the export dialog copies the CSS and explains the AO3 step', async ({ page }) => {
  await openEditor(page);
  await page.getByRole('button', { name: 'Copy to AO3' }).click();

  await expect(page.getByText(/Passes the bundled AO3 CSS checks/)).toBeVisible();

  // Scoped to the instruction steps, and these two assertions are the reason
  // the export can be comment-free: both phrases used to ship as CSS comments
  // in the paste box, and moving them here is what let `compile()` drop every
  // comment (WORK-SKIN §13f). If these stop passing, the instruction has been
  // lost, not just moved.
  const steps = page.locator('ol li');
  await expect(steps.filter({ hasText: "Open AO3's skin editor" })).toContainText(
    'Preferences → Skins → Create Site Skin'
  );
  // Choosing "replace archive skin entirely" strips the layout our CSS sits on.
  await expect(steps.filter({ hasText: 'Paste it into the CSS box' })).toContainText(
    'add on to archive skin'
  );

  const copy = page.getByRole('button', { name: 'Copy site skin CSS' });
  await expect(copy).toBeEnabled();
});

test('a banner reaches the preview and the compiled CSS', async ({ page }) => {
  await openEditor(page, 'Midnight Academia');

  const banner = 'https://placehold.co/1600x500/2b2416/c9a227.png';
  await page.getByLabel('Banner image').fill(banner);

  const frame = page.frameLocator('iframe[title="Site skin preview"]');
  await expect
    .poll(
      () => frame.locator('#header').evaluate(el => getComputedStyle(el).backgroundImage),
      { timeout: 10000 }
    )
    .toContain(banner);

  // The banner-ready presets hide AO3's roundel, so it should be gone.
  await expect(frame.locator('#header .logo')).toBeHidden();

  const css = await exportedCss(page);
  expect(css).toContain(`url("${banner}")`);
  expect(css).toContain('background-size: cover');
  expect(css).toContain('#header .logo');
});

test('a Discord link is refused before the user ever reaches AO3', async ({ page }) => {
  await openEditor(page, 'Midnight Academia');

  // The single most common paste in fandom, and the one AO3 silently hates.
  await page
    .getByLabel('Banner image')
    .fill('https://cdn.discordapp.com/attachments/1/2/art.png?ex=68&is=67&hm=ab');

  const warning = page.getByRole('status').filter({ hasText: 'won’t accept an address' });
  await expect(warning).toBeVisible();
  await expect(warning).toContainText('imgur');

  // And it is a hard stop, not a nudge: AO3 would refuse the entire skin.
  await page.getByRole('button', { name: 'Copy to AO3' }).click();
  await expect(page.getByText('AO3 would refuse this skin')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy site skin CSS' })).toBeDisabled();
});

test('work survives a reload', async ({ page }) => {
  await openEditor(page);
  await page.getByLabel('Accent').fill('#ff8800');
  await expect(page.getByText('Saving…')).toHaveCount(0, { timeout: 5000 });

  await page.reload();
  await page.getByRole('button', { name: /Keep editing/ }).click();
  expect(await exportedCss(page)).toContain('#ff8800');
});
