import { test, expect, Page } from '@playwright/test';

/**
 * The work-skin export, end to end.
 *
 * Run against a local build, since playwright.config.ts points the browser
 * projects at the deployed site:
 *
 *   npm run dev
 *   UX_BASE_URL=http://localhost:3000 npx playwright test --project=desktop tests/work-skin.spec.ts
 */

async function openTemplate(page: Page, template: string) {
  await page.goto(`/?template=${template}`, { waitUntil: 'domcontentloaded' });
  await page.locator('#workskin:visible').first().waitFor({ state: 'visible', timeout: 20000 });
}

/**
 * This test used to be "Twitter offers a work skin; iOS does not", and it
 * asserted iOS offered *no* button, because iOS needed `animation` for its
 * typing indicator and AO3 bans it. That stopped being true on 7 Aug 2026 when
 * the indicator was rebuilt as static descending-opacity dots and iOS and
 * Android both shipped — but the test lives in a browser project, so the unit
 * gate never ran it and nobody noticed it asserting the opposite of the
 * product for a day.
 *
 * `supportsWorkSkin` is the gate, and all four platforms now pass it.
 */
test('every platform offers a work skin', async ({ page }) => {
  for (const template of [
    'twitter-verified-account',
    'ios-two-person-chat',
    'whatsapp-chat',
    'google-search-history',
  ]) {
    await openTemplate(page, template);
    await expect(
      page.getByRole('button', { name: /work skin/i }),
      template
    ).toBeVisible();
  }
});

test('the modal hands over two pieces, each with its own destination', async ({ page }) => {
  await openTemplate(page, 'twitter-verified-account');
  await page.getByRole('button', { name: /work skin/i }).click();

  await expect(page.getByText(/Passes the bundled AO3 CSS checks/)).toBeVisible();
  await expect(page.getByText('Preferences → Skins → Create Work Skin')).toBeVisible();
  // The step everyone forgets: the HTML does nothing without the skin attached.
  await expect(page.getByText('Select Work Skin')).toBeVisible();

  await expect(page.getByRole('button', { name: 'Copy work skin CSS' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Copy scene HTML' })).toBeEnabled();
});

/**
 * The three facts AO3 does not tell an author until it has cost them something.
 *
 * None of these is compiler work — they are the last thing standing between a
 * clean export and somebody using it unaided (BACKLOG 5). Each has a specific
 * failure: a duplicate title is a validation error at submit, a second work
 * skin silently replaces the one the fic was using, and an image host that
 * stops serving takes the pictures out of an already-posted chapter.
 */
test('the modal states the three things AO3 will not', async ({ page }) => {
  await openTemplate(page, 'twitter-verified-account');
  await page.getByRole('button', { name: /work skin/i }).click();

  const dialog = page.getByRole('dialog', { name: 'Work skin' });

  // Unique across the whole archive, not per account.
  await expect(dialog).toContainText('unique across the whole of AO3');
  await expect(dialog).toContainText('yourname — chat skins');

  // One skin per work: an author who has one already must merge, not create.
  await expect(dialog).toContainText('A work can select only one');

  // The images are not AO3's, and the modal must not pretend otherwise.
  await expect(dialog).toContainText('AO3 does not copy those files');
});

test('the exported CSS and HTML are what AO3 will accept', async ({ page }) => {
  await openTemplate(page, 'twitter-verified-account');
  await page.getByRole('button', { name: /work skin/i }).click();
  await page.getByRole('button', { name: 'Copy CSS manually' }).click();
  await page.getByRole('button', { name: 'Copy HTML manually' }).click();

  const css = await page.getByLabel('Work skin CSS').inputValue();
  const html = await page.getByLabel('Work skin HTML').inputValue();

  // `gap` is rejected by AO3 while `column-gap` passes — the substring quirk.
  expect(css).not.toMatch(/[;{]\s*gap\s*:/);
  expect(css).toContain('#workskin');

  // Elements AO3 strips, and the relative paths it would rewrite to its own
  // domain and 404 on.
  expect(html).not.toContain('<button');
  expect(html).not.toContain('<svg');
  expect(html).not.toContain('src="/assets/');
  expect(html).not.toContain('data-message-id');
  expect(html).toContain('https://');
});

/**
 * BACKLOG 10 — the choice, which exists because AO3 gives a work exactly one
 * skin slot.
 *
 * An author whose chapter 4 is a different app cannot save a second skin: they
 * would have to merge two stylesheets by hand, or lose the first. So the wider
 * skin has to be offered at the moment they are about to save one. The master
 * skin is the default because it prevents a later manual merge.
 */
test('the author can take one skin for everything, or just this platform', async ({ page }) => {
  await openTemplate(page, 'twitter-verified-account');
  await page.getByRole('button', { name: /work skin/i }).click();

  const dialog = page.getByRole('dialog', { name: 'Work skin' });
  const justThis = dialog.getByRole('radio', { name: 'Just Twitter' });
  const allFour = dialog.getByRole('radio', { name: 'All four platforms' });

  // The complete skin is the default, so later chapters never require a
  // second skin or a manual merge.
  await expect(allFour).toHaveAttribute('aria-checked', 'true');
  await dialog.getByRole('button', { name: 'Copy CSS manually' }).click();
  await dialog.getByRole('button', { name: 'Copy HTML manually' }).click();
  const everythingByDefault = await page.getByLabel('Work skin CSS').inputValue();

  await justThis.click();
  await expect(justThis).toHaveAttribute('aria-checked', 'true');
  const onePlatform = await page.getByLabel('Work skin CSS').inputValue();
  expect(onePlatform).toContain('#workskin');
  expect(onePlatform, 'the platform skin should not carry the other three')
    .not.toContain('.chat.ios');

  await allFour.click();
  await expect(allFour).toHaveAttribute('aria-checked', 'true');

  const everything = await page.getByLabel('Work skin CSS').inputValue();
  expect(everything).toBe(everythingByDefault);
  // All four platforms, each scoped to its own container class, plus the
  // version stamp that a comment cannot carry because AO3 deletes comments.
  for (const scope of ['.twitter', '.google', '.ios', '.android']) {
    expect(everything, `the master skin is missing ${scope}`).toContain(scope);
  }
  expect(everything).toMatch(/\.ao3skingen-v\d+::after\{content:'\d+';\}/);
  // Both themes travel with it, so a later chapter can be dark.
  expect(everything).toContain('.theme-dark');
  expect(everything.length).toBeGreaterThan(onePlatform.length);

  // The title advice follows the choice — a skin covering four platforms
  // should not be called "yourname — Twitter".
  await expect(dialog).toContainText('yourname — chat skins');

  // The markup is the same either way: the choice is about the stylesheet.
  const html = await page.getByLabel('Work skin HTML').inputValue();
  await justThis.click();
  expect(await page.getByLabel('Work skin HTML').inputValue()).toBe(html);
});

test('the image export still works alongside it', async ({ page }) => {
  // The work skin is an addition, not a replacement — the two primary
  // buttons must survive it.
  await openTemplate(page, 'twitter-verified-account');
  await expect(page.getByRole('button', { name: 'Save PNG' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Get AO3 image code' })).toBeVisible();
});

test('content preflight errors never disable the CSS or HTML copy actions', async ({ page }) => {
  await page.addInitScript(project => localStorage.setItem('ao3SkinProject', JSON.stringify(project)), {
    id: 'copy-despite-content-warning', template: 'android',
    settings: { bubbleOpacity: 1, senderColor: '#dcf8c6', receiverColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif', maxWidthPx: 600, useDarkNeutral: false },
    messages: [{ id: 'broken', sender: 'You', content: '', outgoing: true, whatsappMedia: { kind: 'audio', url: 'not-a-file', mimeType: 'audio/mpeg' } }],
  });
  await page.goto('/');
  await page.getByRole('button', { name: /work skin/i }).click();
  const dialog = page.getByRole('dialog', { name: 'Work skin' });
  await expect(dialog).toContainText('content warning');
  await expect(dialog).not.toContainText('blocking content issue');
  await expect(dialog.getByRole('button', { name: 'Copy work skin CSS' })).toBeEnabled();
  await expect(dialog.getByRole('button', { name: 'Copy scene HTML' })).toBeEnabled();
});

test('Twitter video players exist only in copied work HTML, never the raster preview or ImgBB payload', async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(project => localStorage.setItem('ao3SkinProject', JSON.stringify(project)), {
    id: 'media-boundary', template: 'twitter',
    settings: {
      bubbleOpacity: 1, senderColor: '#1DA1F2', receiverColor: '#f5f8fa',
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', maxWidthPx: 600,
      useDarkNeutral: false, twitterSceneMode: 'timeline', twitterTheme: 'light',
      twitterShowMetrics: false, fictionLabel: true, fictionLabelText: 'Fictional scene',
    },
    messages: [{
      id: 'video', sender: 'User', content: 'Watch this', outgoing: true,
      twitterVideo: { source: 'youtube', url: 'https://youtu.be/bN8449nalT8?feature=share', title: 'Story clip', description: 'Transcript.' },
    }],
  });
  await page.goto('/');

  const preview = page.locator('#workskin').first();
  await expect(preview.locator('.twitter-video-card')).toHaveCount(1);
  await expect(preview.locator('iframe,video,source,track')).toHaveCount(0);

  await page.getByRole('button', { name: /work skin/i }).click();
  await page.getByRole('button', { name: 'Copy HTML manually' }).click();
  const workHtml = await page.getByLabel('Work skin HTML').inputValue();
  expect(workHtml).toContain('<iframe');
  expect(workHtml).toContain('https://www.youtube-nocookie.com/embed/bN8449nalT8');
  expect(workHtml).not.toContain('feature=share');

  await page.getByRole('button', { name: 'Close' }).click();
  const onePixelPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  await page.route('**/api/image-proxy**', route => route.fulfill({ status: 200, contentType: 'image/png', body: onePixelPng }));
  let uploadContentType = '';
  let uploadKind = '';
  let uploadBody = Buffer.alloc(0);
  await page.route('**/api/image-upload', async route => {
    uploadContentType = route.request().headers()['content-type'] || '';
    uploadKind = route.request().headers()['x-upload-kind'] || '';
    uploadBody = route.request().postDataBuffer() || Buffer.alloc(0);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, url: 'https://i.ibb.co/static-scene.png' }) });
  });
  await page.getByRole('button', { name: 'Get AO3 image code' }).click();
  await page.getByRole('dialog', { name: 'Confirm hosted image upload' }).getByRole('button', { name: 'Upload and get AO3 code' }).click();
  await expect(page.getByRole('heading', { name: 'Your AO3 code' })).toBeVisible({ timeout: 90_000 });
  expect(uploadContentType).toBe('image/png');
  expect(uploadKind).toBe('rendered-scene');
  expect(uploadBody.subarray(1, 4).toString()).toBe('PNG');
  expect(uploadBody.toString('utf8')).not.toContain('youtube');
});
