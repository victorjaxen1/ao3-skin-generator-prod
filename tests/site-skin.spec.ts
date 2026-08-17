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
  // `> hr`, not any descendant: the mock's chapter also contains an author work
  // skin with an `<hr>` of its own, which our ornament deliberately misses.
  await expect(frame.locator('#chapters .userstuff > hr')).toBeVisible();

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
  expect(css).toContain('#chapters .userstuff > p:first-of-type::first-letter');

  await page.getByRole('switch', { name: 'Drop cap' }).click();
  css = await exportedCss(page);
  expect(css).not.toContain('first-letter');
  // And never the unscoped form, which decorates summaries and notes too.
  expect(css).not.toContain('#workskin p:first-of-type');
});

test('the drop cap and divider leave an author work skin alone', async ({ page }) => {
  // Plan §14. Shipped, then seen on a real AO3 page: the drop cap landed on
  // every chat bubble, caption and footer line of a work skin, because
  // `:first-of-type` matches once per parent and a work skin is nested markup.
  //
  // Counted in the DOM rather than asserted as a string, so the test measures
  // what the browser does with the selector, not what we hoped it meant.
  await openEditor(page); // Moonlit Library ships divider + drop cap on.
  await page.getByRole('tab', { name: 'Reading' }).click();
  const frame = page.frameLocator('iframe[title="Site skin preview"]');

  await expect(frame.locator('#workskin .chat .bubble').first()).toBeVisible();

  const counts = await frame.locator('#chapters').evaluate(el => ({
    // What our selectors actually reach.
    capped: el.querySelectorAll('.userstuff > p:first-of-type').length,
    ruled: el.querySelectorAll('.userstuff > hr').length,
    // What the descendant form used to reach. Both numbers being higher is the
    // bug, and is why this test would have failed before the fix.
    loose: el.querySelectorAll('.userstuff p:first-of-type').length,
    looseRules: el.querySelectorAll('.userstuff hr').length,
  }));

  expect(counts.capped).toBe(1); // one capital, at the top of the chapter
  expect(counts.ruled).toBe(1); // one ornament, the author's rule untouched
  expect(counts.loose).toBeGreaterThan(1);
  expect(counts.looseRules).toBeGreaterThan(1);

  // And what the browser actually paints. getComputedStyle reads pseudo-element
  // styles, so this measures the rendered result rather than our intent: the
  // chapter's opening letter is enlarged, the bubble's is not.
  const firstLetterSize = (selector: string) =>
    frame
      .locator(selector)
      .first()
      .evaluate(el => ({
        cap: parseFloat(getComputedStyle(el, '::first-letter').fontSize),
        body: parseFloat(getComputedStyle(el).fontSize),
      }));

  const chapter = await firstLetterSize('#chapters .userstuff > p');
  expect(chapter.cap).toBeGreaterThan(chapter.body * 3);

  const bubble = await firstLetterSize('#workskin .chat .bubble p');
  expect(bubble.cap).toBeCloseTo(bubble.body, 1);

  // The author's own typography survives too. Their work skin is rendered in
  // the body, after our stylesheet, and scoped to #workskin — so it wins on
  // order and specificity, and would lose only to an `!important` of ours.
  const fontOf = (selector: string) =>
    frame.locator(selector).first().evaluate(el => getComputedStyle(el).fontFamily);

  expect(await fontOf('#workskin blockquote.note')).toContain('Courier');
  // While a blockquote the author did not style still follows the theme.
  expect(await fontOf('.preface blockquote.userstuff')).toContain('Georgia');

  const css = await exportedCss(page);
  expect(css).not.toContain('#chapters .userstuff p:first-of-type');
  expect(css).not.toContain('#chapters .userstuff hr');
});

test('tags coloured by type reach the preview, in both AO3 markups', async ({ page }) => {
  await openEditor(page); // Moonlit Library ships with the control on.
  const frame = page.frameLocator('iframe[title="Site skin preview"]');

  const warningColor = () =>
    frame.locator('li.warnings a.tag').first().evaluate(el => getComputedStyle(el).color);
  const freeformColor = () =>
    frame.locator('li.freeforms a.tag').first().evaluate(el => getComputedStyle(el).color);

  // Different kinds of tag, different colours — that is the whole feature.
  expect(await warningColor()).not.toBe(await freeformColor());

  // The work page marks the type up on the `dd`, not the `li`, so it needs its
  // own selector and its own check.
  await page.getByRole('tab', { name: 'Reading' }).click();
  const metaWarning = await frame
    .locator('dd.warning a.tag')
    .first()
    .evaluate(el => getComputedStyle(el).color);
  const metaFreeform = await frame
    .locator('dd.freeform a.tag')
    .first()
    .evaluate(el => getComputedStyle(el).color);
  expect(metaWarning).not.toBe(metaFreeform);

  await page.getByRole('tab', { name: 'Browse' }).click();
  await page.getByRole('switch', { name: 'Colour tags by type' }).click();

  // Off, every tag is the accent again, and none of the rules ship.
  //
  // Both sides are read inside the poll. Reading the expected value outside it
  // captures a colour from before the stylesheet was patched, and the poll then
  // waits for a match that will never come — which is how this test flaked once
  // before it was written this way.
  await expect
    .poll(async () => (await warningColor()) === (await freeformColor()))
    .toBe(true);
  const css = await exportedCss(page);
  expect(css).not.toContain('li.warnings');
  expect(css).not.toContain('dd.freeform');
});

/**
 * §18c-2. AO3 renders a work's rating, warnings, category and status as four
 * sprite icons, and puts the real words in the DOM hidden behind them. This is
 * the control that shows the words — the one item on this roadmap that makes
 * the archive more usable rather than better looking.
 *
 * Read from the browser rather than from our string, because "the rule was
 * emitted" and "the words are visible" are different claims: AO3 hides them
 * with four separate declarations across three selectors, and missing any one
 * leaves text that is transparent, or 0.001em tall, or trapped in a 25px box.
 */
test('required tags become words a reader can actually read', async ({ page }) => {
  await openEditor(page); // Moonlit Library — ships with the control off.
  const frame = page.frameLocator('iframe[title="Site skin preview"]');

  const words = frame.locator('.blurb ul.required-tags .warnings .text').first();
  const wordStyle = () =>
    words.evaluate(el => {
      const s = getComputedStyle(el);
      const box = el.getBoundingClientRect();
      return { color: s.color, fontSize: parseFloat(s.fontSize), width: box.width };
    });

  // AO3's own hiding, reproduced faithfully in the mock: transparent text at
  // one thousandth of an em. Without this half of the test the control could
  // "work" against a mock that was never hiding anything.
  const hidden = await wordStyle();
  expect(hidden.color).toBe('rgba(0, 0, 0, 0)');
  // AO3 asks for 0.001em; Chrome reports 6px, because it refuses to compute a
  // font smaller than its own minimum. Which is the reason AO3 also paints the
  // text transparent and collapses the box — and the reason this control has to
  // undo all three rather than any one of them.
  expect(hidden.fontSize).toBeLessThan(8);
  // 25px, not 0: AO3's `.required-tags li span` rule is more specific than its
  // own `.blurb span.text { width: 0 }`, so the words are clamped to the icon
  // box rather than collapsed. Either way there is nothing readable in there.
  expect(hidden.width).toBeLessThanOrEqual(25);

  await page.getByRole('switch', { name: 'Required tags as words' }).click();

  await expect.poll(async () => (await wordStyle()).fontSize).toBeGreaterThan(10);
  const shown = await wordStyle();
  expect(shown.color).not.toBe('rgba(0, 0, 0, 0)');
  expect(shown.width).toBeGreaterThan(50);

  // The sprite has to go with it, or the words sit on top of the icon.
  const sprite = await frame
    .locator('.blurb ul.required-tags .warnings')
    .first()
    .evaluate(el => getComputedStyle(el).backgroundImage);
  expect(sprite).toBe('none');

  // And the 65px AO3 reserved beside the icons is given back to the title.
  const headerMargin = await frame
    .locator('.blurb .header .heading')
    .first()
    .evaluate(el => getComputedStyle(el).marginLeft);
  expect(headerMargin).toBe('0px');

  const css = await exportedCss(page);
  expect(css).toContain('.blurb ul.required-tags');
  expect(css).toContain('background-image: none');
  // Identified by class, never by position — the corpus add-on's `li+li+li`
  // offsets are tuned to one person's font size and break for everyone else.
  expect(css).toContain('.required-tags .warnings');
});

/**
 * §18a. Until these rules landed, a reader could install a black theme and find
 * every button, pagination number, form field and comment byline still wearing
 * AO3's 2010 grey. It read as the skin being half-finished, because it was.
 *
 * Computed style rather than string matching, because every interesting
 * question here is a cascade question: our rules have to beat AO3's defaults in
 * `#main`, and — the part that is easy to get wrong — must NOT beat AO3's own
 * header and footer exemptions.
 */
test('AO3s grey chrome is repainted, and the header and footer are spared', async ({ page }) => {
  await openEditor(page); // Moonlit Library — a dark page, so grey is obvious.
  const frame = page.frameLocator('iframe[title="Site skin preview"]');

  const style = (selector: string, property: 'backgroundColor' | 'backgroundImage') =>
    frame
      .locator(selector)
      .first()
      .evaluate((el, p) => getComputedStyle(el)[p as 'backgroundColor'], property);

  const AO3_BUTTON_GREY = 'rgb(238, 238, 238)';
  const AO3_BYLINE_GREY = 'rgb(221, 221, 221)';
  const TRANSPARENT = 'rgba(0, 0, 0, 0)';

  // The button. AO3 lays a white-to-grey gradient OVER its #eee, so killing the
  // colour without the image leaves the control looking untouched — the same
  // defect as the footer's red tile in §4.6.
  const buttonBg = await style('#main .actions a', 'backgroundColor');
  expect(buttonBg).not.toBe(AO3_BUTTON_GREY);
  expect(await style('#main .actions a', 'backgroundImage')).toBe('none');
  expect(await style('#main input[type="submit"]', 'backgroundColor')).toBe(buttonBg);

  // A field is the PAGE colour — recessed inside the card, not raised like a
  // button — so it must differ from both the button and AO3's white.
  const fieldBg = await style('#main #tag_search', 'backgroundColor');
  expect(fieldBg).not.toBe('rgb(255, 255, 255)');
  expect(fieldBg).not.toBe(buttonBg);

  // The scoping decision, and the only place it can be verified. §18a's table
  // specifies a bare `.actions a`; we emit `#main .actions a` because AO3
  // exempts its own header and footer from the button cascade with ID-scoped
  // rules that are NOT !important — so a bare selector from us would defeat
  // them and put a button chip behind every nav link on the site.
  expect(await style('#header .primary a', 'backgroundColor')).toBe(TRANSPARENT);
  expect(await style('#footer a', 'backgroundColor')).toBe(TRANSPARENT);

  // Comments, which live in the Reading state — and outside the work skin.
  await page.getByRole('tab', { name: 'Reading' }).click();
  const bylineBg = await style('.comment h4.byline', 'backgroundColor');
  expect(bylineBg).not.toBe(AO3_BYLINE_GREY);
  expect(bylineBg).toBe(buttonBg); // both are controlBg

  // AO3 alternates comment rows with #eee. Ours alternates too, at our contrast.
  const alternating = await style('li.comment.even', 'backgroundColor');
  expect(alternating).not.toBe(AO3_BUTTON_GREY);
  expect(alternating).not.toBe(await style('#comment_1', 'backgroundColor'));

  const css = await exportedCss(page);
  expect(css).toContain('#main .actions a');
  expect(css).toContain('.comment h4.byline');
  expect(css).toContain('.autocomplete .dropdown ul li.selected');
});

/**
 * §22. The four page types out of nine that a real skin author screenshots and
 * we had never styled — Profile, Collections, Own works, the filter sidebar —
 * all of which fail through `.listbox`.
 *
 * This has to be a browser test rather than a compiler one. Every claim in it
 * is about a cascade: whether our rule actually beats AO3's on a real page,
 * with AO3's own stylesheet loaded first and our `!important` doing the work.
 * The compiler test can only say we emitted a declaration; only this one can
 * say it won. And the whole §22 gap existed *because* nothing rendered these
 * regions — a rule that cannot be seen is a rule nobody can check.
 */
test('AO3s listboxes, indexes and meta tables take the theme', async ({ page }) => {
  await openEditor(page); // Moonlit Library — a dark page, so light grey shouts.
  const frame = page.frameLocator('iframe[title="Site skin preview"]');

  const style = (selector: string, property: 'backgroundColor' | 'boxShadow' | 'borderColor') =>
    frame
      .locator(selector)
      .first()
      .evaluate((el, p) => getComputedStyle(el)[p as 'backgroundColor'], property);

  const AO3_LISTBOX_GREY = 'rgb(221, 221, 221)';
  const WHITE = 'rgb(255, 255, 255)';
  const AO3_SHADING = 'rgb(238, 238, 238)';

  // The profile's listboxes live on the Dashboard state, because the dashboard
  // IS the "your account" page — which is where a reader meets a listbox.
  await page.getByRole('tab', { name: 'Dashboard' }).click();

  const outer = await style('#user-works', 'backgroundColor');
  const inner = await style('#user-works .index', 'backgroundColor');
  expect(outer).not.toBe(AO3_LISTBOX_GREY);
  expect(inner).not.toBe(WHITE);

  // The polarity, and the only place it is observable. AO3 paints the outer box
  // darker than the inner panel so the panel reads as the card; mapping outer →
  // page and inner → card keeps that in either polarity. Painting both the same
  // would pass every compiler assertion and lose the distinction on the page.
  expect(outer).not.toBe(inner);

  // AO3 rings the outer box with a white 1px shadow and bevels the inner panel
  // with an inset grey one. A background colour reaches neither, so without
  // these the boxes keep a light edge on every dark theme — the same defect as
  // the footer's red tile.
  expect(await style('#user-works', 'boxShadow')).toBe('none');
  expect(await style('#user-works .index', 'boxShadow')).toBe('none');

  // dl.index's values and the statistics page's even rows: both AO3 shades #eee
  // / #ededed, both ours at the theme's contrast.
  const indexValue = await style('dl.index dd', 'backgroundColor');
  expect(indexValue).not.toBe('rgb(237, 237, 237)');
  expect(await style('.statistics .index li:nth-of-type(even)', 'backgroundColor')).toBe(indexValue);

  // §22c — the regression. Every relationship tag in every listing carried a
  // pale grey chip, and "colour tags by type" only ever set the text on it.
  await page.getByRole('tab', { name: 'Browse' }).click();
  expect(await style('li.relationships a', 'backgroundColor')).toBe('rgba(0, 0, 0, 0)');
  expect(await style('li.relationships a', 'backgroundColor')).not.toBe(AO3_SHADING);

  // The work meta table, on every work page — its border, and the grey halo
  // AO3 hangs off the `.wrapper` it is always inside.
  await page.getByRole('tab', { name: 'Reading' }).click();
  expect(await style('dl.meta', 'borderColor')).not.toBe('rgb(204, 204, 204)');
  expect(await style('.work > .wrapper', 'boxShadow')).toBe('none');

  const css = await exportedCss(page);
  expect(css).toContain('.listbox');
  expect(css).toContain('.listbox .index');
  expect(css).toContain('li.relationships a');
});

/**
 * The font bank, and the one rule in it that protects readers rather than taste.
 *
 * AO3 rejects `@font-face`, so a skin can never supply a font file — the bank is
 * a bank of NAMES, and the only lever we have is how many faces a stack names
 * before it gives up. Growing it 7 → 24 made the picker's shape the question:
 * grouped, role-split, and honest about the fact that a font is a suggestion.
 */
test('the font picker is grouped, and body text is never offered a script face', async ({
  page,
}) => {
  await openEditor(page);

  const headings = page.getByLabel('Headings', { exact: true });
  const body = page.getByLabel('Body text', { exact: true });

  // Grouped rather than a flat wall of twenty-four.
  const groupsOn = (loc: typeof headings) =>
    loc.evaluate(el =>
      Array.from((el as HTMLSelectElement).querySelectorAll('optgroup')).map(g => g.label)
    );
  expect(await groupsOn(headings)).toContain('Handwriting');
  expect(await groupsOn(headings)).toContain('Serif');

  // The rule that matters: a handwriting face behind every blurb summary and
  // every chapter would make the archive harder to read, which is the opposite
  // of what a reading skin is for.
  expect(await groupsOn(body)).not.toContain('Handwriting');
  expect(await groupsOn(body)).not.toContain('Display');

  const optionCount = (loc: typeof headings) =>
    loc.evaluate(el => (el as HTMLSelectElement).options.length);
  expect(await optionCount(headings)).toBeGreaterThan(await optionCount(body));

  // A heading face reaches the compiled CSS and the preview together — the
  // specimen line in the rail is a typeface sample, never the source of truth.
  await headings.selectOption({ label: 'Snell — formal script' });
  const frame = page.frameLocator('iframe[title="Site skin preview"]');
  await expect
    .poll(() =>
      frame
        .locator('#main h2.heading')
        .first()
        .evaluate(el => getComputedStyle(el).fontFamily)
    )
    .toContain('Snell');

  const css = await exportedCss(page);
  expect(css).toContain('Snell Roundhand');
  // Still legal: sanitize_css_font takes letters, digits, dashes and spaces.
  expect(css).not.toMatch(/font-family:[^;]*[._]/);
});

test('the picker says plainly that a font may not reach the reader', async ({ page }) => {
  // Load-bearing rather than a disclaimer. The specimens render with the fonts
  // on the machine looking at them, so without this the picker over-promises to
  // exactly the person least able to check.
  await openEditor(page);
  await expect(
    page.getByText(/doesn't allow skins to supply font files/i)
  ).toBeVisible();
});

test('the themed scrollbar is emitted, and removable', async ({ page }) => {
  await openEditor(page);

  let css = await exportedCss(page);
  expect(css).toContain('::-webkit-scrollbar-thumb');

  await page.getByRole('switch', { name: 'Themed scrollbar' }).click();
  css = await exportedCss(page);
  expect(css).not.toContain('scrollbar');
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

test('the header fade reaches the preview, and stacks under a banner', async ({ page }) => {
  // The control that lets a palette-only template have a header of its own
  // without us hosting a single image. Asserted against the browser's own
  // computed style, not against our string: a gradient that compiles but does
  // not paint is exactly the failure invariant 4 exists to catch.
  await openEditor(page, 'Midnight Academia');

  const frame = page.frameLocator('iframe[title="Site skin preview"]');
  const headerImage = () =>
    frame.locator('#header').evaluate(el => getComputedStyle(el).backgroundImage);

  // The catalog ships this one with a fade, so the arriving state is the
  // painted one — that is the decision recorded in the plan's §20d, and this
  // is where a silent revert to a flat accent header would show up.
  await expect.poll(headerImage, { timeout: 10000 }).toContain('linear-gradient');

  // Flat has to actually remove it. A control that only ever adds is the half
  // of the toggle nobody tests.
  await page.getByLabel('Header fade').getByRole('button', { name: 'Flat' }).click();
  await expect.poll(headerImage, { timeout: 10000 }).toBe('none');

  await page.getByLabel('Header fade').getByRole('button', { name: 'Diagonal' }).click();
  await expect.poll(headerImage, { timeout: 10000 }).toContain('linear-gradient');
  expect(await exportedCss(page)).toContain('linear-gradient(135deg');

  // AO3's navigation strip carries its own opaque fill. Under a gradient it
  // has to get out of the way, or the header reads as two bands rather than
  // one surface.
  await expect
    .poll(() =>
      frame.locator('#header .primary').evaluate(el => getComputedStyle(el).backgroundColor)
    )
    .toMatch(/rgba\(0, 0, 0, 0\)|transparent/);

  // A banner layers on top rather than replacing it — so a dead image degrades
  // to the gradient instead of to a flat fill.
  const banner = 'https://placehold.co/1600x500/2b2416/c9a227.png';
  await page.getByLabel('Banner image').fill(banner);
  await expect.poll(headerImage, { timeout: 10000 }).toContain(banner);

  const withBoth = await headerImage();
  expect(withBoth).toContain('linear-gradient');
  expect(withBoth.indexOf(banner)).toBeLessThan(withBoth.indexOf('linear-gradient'));
});

test('the export dialog warns about image hosting, but only with a banner', async ({ page }) => {
  // AO3 hotlinks the image rather than storing it, so the skin outlives the
  // picture only if the host does. A published work skin lost every image in
  // every fic using it to a free-tier bandwidth cap (plan §12), which is a
  // failure one paragraph here prevents.
  await openEditor(page, 'Midnight Academia');

  await page.getByRole('button', { name: 'Copy to AO3' }).click();
  await expect(page.getByText('About your banner image')).toHaveCount(0);
  await page.getByRole('button', { name: 'Close' }).click();

  await page.getByLabel('Banner image').fill('https://i.imgur.com/aBcD123.png');
  await page.getByRole('button', { name: 'Copy to AO3' }).click();

  const note = page.locator('section', { hasText: 'About your banner image' });
  await expect(note).toBeVisible();
  await expect(note).toContainText('does not store a copy');
  await expect(note).toContainText('postimg.cc');
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

/**
 * The Magic Picker (docs/MAGIC-PICKER-IMPLEMENTATION.md §5).
 *
 * These deliberately never reach the network. A test that pasted a real image
 * address would be measuring imgur's uptime, and the extraction itself is
 * covered exhaustively without a browser in tests/palette.unit.spec.ts. What is
 * only checkable here is that both doors exist, that the promise on them is the
 * one §3 settled, and that the client-side pre-check fires before a round trip.
 */
test('the gallery offers a way out of the sixteen', async ({ page }) => {
  await page.goto('/site-skin');
  await page.evaluate(() => localStorage.removeItem('ao3SiteSkinTheme'));
  await page.reload();

  const panel = page.getByRole('heading', { name: /None of these\?/ });
  await expect(panel).toBeVisible();

  // §3 is a product decision, not copy: we promise colours and never a match,
  // because "match" sets up a comparison we lose on every single use.
  const body = await page.locator('body').innerText();
  expect(body).toContain('We read its colours');
  expect(body.toLowerCase()).not.toContain('match this');

  // And it says what a skin cannot carry, in the same breath.
  await expect(page.getByText(/A skin can carry colours, not layout or fonts/)).toBeVisible();
});

test('a paste that is not an address is refused without a round trip', async ({ page }) => {
  await page.goto('/site-skin');
  await page.evaluate(() => localStorage.removeItem('ao3SiteSkinTheme'));
  await page.reload();

  // Fail here, not after a proxy fetch: the commonest paste error deserves the
  // fastest possible answer, and the proxy is HTTPS-only anyway.
  await page.getByLabel('Image address').fill('my-picture.png');
  await page.getByRole('button', { name: 'Get the colours' }).click();
  // Filtered, because Next's own route announcer is a second role="alert".
  await expect(page.getByRole('alert').filter({ hasText: 'full address' })).toContainText('https://');

  // Still on the gallery — nothing was applied.
  await expect(page.getByRole('heading', { name: 'Make AO3 feel like yours' })).toBeVisible();
});

test('the editor carries the same picker, beside the colours it sets', async ({ page }) => {
  await openEditor(page);

  await page.getByRole('button', { name: 'Take these from a picture' }).click();
  const dialog = page.getByRole('dialog', { name: 'Build colours from a picture' });
  await expect(dialog).toBeVisible();

  // It must say what it leaves alone. The gallery adopts a whole theme; this
  // one replaces four hex strings and must not quietly reset the user's fonts.
  await expect(dialog).toContainText('Your fonts and shapes stay as they are');

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});
