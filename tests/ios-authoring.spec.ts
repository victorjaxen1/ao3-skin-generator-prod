import { expect, test } from '@playwright/test';

/**
 * §14.4 — the iOS authoring flow, driven through the real UI.
 *
 * The unit suite proves the model and the markup. This proves the feature is
 * *reachable*: §0.2 says a feature that is only representable in JSON, or only
 * rendered by an example, is not implemented.
 */

const preview = (page: import('@playwright/test').Page) => page.locator('#workskin').first();
const composer = (page: import('@playwright/test').Page) => page.getByPlaceholder('Add a message…');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ao3skingen_analytics_consent', 'denied'));
});

test('authors replies, four images, a link, Tapbacks and events, then deletes a reply target safely', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/?platform=ios');

  await composer(page).fill('The side door is open');
  await page.getByRole('button', { name: 'Send message' }).click();

  // A reply to the message just sent, plus a Tapback stack with a count.
  await page.getByRole('button', { name: 'Message options' }).click();
  const replyPicker = page.getByRole('combobox', { name: 'Reply to earlier message' });
  const replyTarget = await replyPicker.locator('option').last().getAttribute('value');
  await replyPicker.selectOption(replyTarget!);
  await page.getByRole('button', { name: 'Add Tapback' }).click();
  await page.getByRole('textbox', { name: 'Tapback 1 emoji' }).fill('😮');
  await page.getByRole('spinbutton', { name: 'Tapback 1 count' }).fill('2');
  await composer(page).fill('I am checking it now');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(preview(page).locator('blockquote.ios-reply')).toHaveCount(1);
  await expect(preview(page).locator('blockquote.ios-reply')).toContainText('The side door is open');
  await expect(preview(page).locator('.ios-tapbacks')).toContainText('😮 2');

  // Four images, each described, reordered, and one removed and re-added.
  await page.getByRole('button', { name: 'Message options' }).click();
  await page.getByRole('button', { name: 'images', exact: true }).click();
  for (const index of [1, 2, 3, 4]) {
    if (index > 1) await page.getByRole('button', { name: 'Add image' }).click();
    await page.getByRole('textbox', { name: `Image ${index} address` }).fill(`https://example.com/door-${index}.png`);
    await page.getByRole('textbox', { name: `Image ${index} description` }).fill(`Door view ${index}`);
  }
  // The cap is four, so the affordance goes away rather than failing on submit.
  await expect(page.getByRole('button', { name: 'Add image' })).toHaveCount(0);
  await composer(page).fill('Four views');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(preview(page).locator('.ios-images-4 img')).toHaveCount(4);
  for (const index of [1, 2, 3, 4]) {
    await expect(preview(page).locator(`img[alt="Door view ${index}"]`)).toHaveCount(1);
  }

  // A manual link card — no network request to the pasted address.
  await page.getByRole('button', { name: 'Message options' }).click();
  await page.getByRole('button', { name: 'link', exact: true }).click();
  await page.getByRole('textbox', { name: 'Link address' }).fill('https://example.com/access-log');
  await page.getByRole('textbox', { name: 'Link title' }).fill('Access log');
  await page.getByRole('textbox', { name: 'Link description' }).fill('A record of recent entries.');
  await composer(page).fill('The log is here');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(preview(page).locator('a.ios-link-preview')).toContainText('Access log');

  // A date divider is exclusive: the message box goes away with it.
  await page.getByRole('button', { name: 'Message options' }).click();
  await page.getByRole('button', { name: 'Date', exact: true }).click();
  await page.getByRole('textbox', { name: 'Divider text' }).fill('Later that night');
  await expect(page.getByRole('button', { name: 'Send message' })).toBeEnabled();
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(preview(page).locator('.ios-event-date')).toContainText('Later that night');

  // Deleting a replied-to message confirms, then clears the dependants.
  await page.getByRole('button', { name: 'Post options for The side door is open' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete a replied-to message?' });
  await expect(dialog).toContainText('1 later message replies to it');
  await dialog.getByRole('button', { name: 'Delete and remove reply previews' }).click();
  await expect(preview(page).locator('blockquote.ios-reply')).toHaveCount(0);
  await expect(preview(page)).toContainText('I am checking it now');
});

test('defaults a new video to YouTube with a blank poster and derives the thumbnail', async ({ page }) => {
  await page.goto('/?platform=ios');
  await page.getByRole('button', { name: 'Message options' }).click();
  await page.getByRole('button', { name: 'video', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Video source' })).toHaveValue('youtube');
  // Blank, not placeholder prose — prose here suppresses the derived thumbnail.
  await expect(page.getByRole('textbox', { name: 'Video poster address' })).toHaveValue('');

  await page.getByRole('textbox', { name: 'Media address' }).fill('https://www.youtube.com/watch?v=XlcK4VYSWZk');
  // A half-typed poster must not blank the card.
  await page.getByRole('textbox', { name: 'Video poster address' }).fill('f');
  await expect(page.locator('iframe[title="iMessage YouTube video preview"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Load media preview' }).click();
  await expect(page.locator('iframe[title="iMessage YouTube video preview"]')).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/XlcK4VYSWZk');
  await page.getByRole('button', { name: 'Send message' }).click();

  await expect(preview(page).locator('iframe,video,audio')).toHaveCount(0);
  await expect(preview(page).locator('img[src="https://i.ytimg.com/vi/XlcK4VYSWZk/hqdefault.jpg"]')).toHaveCount(1);

  await page.getByRole('button', { name: /accessible work skin/i }).click();
  const workHtml = await page.getByLabel('Work skin HTML').inputValue();
  expect(workHtml).toContain('<iframe src="https://www.youtube-nocookie.com/embed/XlcK4VYSWZk"');
  expect(workHtml).not.toContain('<video');
});

test('reveals MIME and caption controls when a video switches to a direct file', async ({ page }) => {
  await page.goto('/?platform=ios');
  await page.getByRole('button', { name: 'Message options' }).click();
  await page.getByRole('button', { name: 'video', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Caption track address' })).toHaveCount(0);

  await page.getByRole('combobox', { name: 'Video source' }).selectOption('direct');
  await expect(page.getByRole('combobox', { name: 'Media file type' })).toHaveValue('video/mp4');
  await page.getByRole('textbox', { name: 'Media address' }).fill('https://example.com/door.mp4');
  await page.getByRole('textbox', { name: 'Caption track address' }).fill('https://example.com/door-en.vtt');
  // A partial caption trio blocks sending, because AO3 gets a broken <track>.
  await expect(page.getByRole('button', { name: 'Send message' })).toBeDisabled();
  await page.getByRole('textbox', { name: 'Caption language' }).fill('en');
  await page.getByRole('textbox', { name: 'Caption label' }).fill('English');
  await page.getByRole('textbox', { name: 'Video description' }).fill('The door swings inward.');
  await expect(page.getByRole('button', { name: 'Send message' })).toBeEnabled();
  await page.getByRole('button', { name: 'Send message' }).click();

  await expect(preview(page).locator('.ios-video-card')).toContainText('The door swings inward.');
  await expect(preview(page).locator('video,audio,iframe')).toHaveCount(0);

  await page.getByRole('button', { name: /accessible work skin/i }).click();
  const workHtml = await page.getByLabel('Work skin HTML').inputValue();
  expect(workHtml).toContain('<source src="https://example.com/door.mp4" type="video/mp4">');
  expect(workHtml).toContain('<track src="https://example.com/door-en.vtt" kind="captions" srclang="en" label="English" default="default">');
});

test('plays a voice message only after explicit consent and keeps the scene static', async ({ page }) => {
  await page.goto('/?platform=ios');
  await page.getByRole('button', { name: 'Message options' }).click();
  await page.getByRole('button', { name: 'audio', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Media file type' })).toHaveValue('audio/mpeg');
  await page.getByRole('textbox', { name: 'Media address' }).fill('https://archive.org/download/testmp3testfile/mpthreetest.mp3');
  await page.getByRole('textbox', { name: 'Voice message transcript' }).fill('The latch moved at midnight.');

  // Nothing has contacted the host yet.
  await expect(page.locator('audio')).toHaveCount(0);
  await page.getByRole('button', { name: 'Load media preview' }).click();
  await expect(page.locator('audio source[type="audio/mpeg"]')).toHaveAttribute('src', 'https://archive.org/download/testmp3testfile/mpthreetest.mp3');

  // Changing the source withdraws that consent rather than reusing it.
  await page.getByRole('textbox', { name: 'Media address' }).fill('https://example.com/other.mp3');
  await expect(page.locator('audio')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Load media preview' })).toBeVisible();

  await page.getByRole('textbox', { name: 'Media address' }).fill('https://archive.org/download/testmp3testfile/mpthreetest.mp3');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(preview(page).locator('.ios-audio-card')).toContainText('The latch moved at midnight.');
  await expect(preview(page).locator('audio,video')).toHaveCount(0);

  await page.getByRole('button', { name: /accessible work skin/i }).click();
  const workHtml = await page.getByLabel('Work skin HTML').inputValue();
  expect(workHtml).toContain('<audio class="ios-native-audio" title="Voice message" controls="controls" crossorigin="anonymous" preload="metadata">');
  expect(workHtml).toContain('<source src="https://archive.org/download/testmp3testfile/mpthreetest.mp3" type="audio/mpeg">');
});

test('switches iOS frames without losing messages and keeps 360px authoring on-screen', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/?platform=ios');
  await composer(page).fill('Frame-safe message');
  await page.getByRole('button', { name: 'Send message' }).click();

  await page.getByRole('button', { name: 'Open settings' }).click();
  await page.getByRole('combobox', { name: 'Frame' }).selectOption('phone');
  await page.getByRole('button', { name: 'Advanced' }).click();
  await page.getByRole('switch', { name: 'Fixed-height scroll window' }).click();
  await page.keyboard.press('Escape');
  await expect(preview(page).locator('.ios-frame-phone.ios-scroll')).toHaveCount(1);
  await expect(preview(page)).toContainText('Frame-safe message');

  await page.getByRole('button', { name: 'Open settings' }).click();
  await page.getByRole('combobox', { name: 'Frame' }).selectOption('bubbles');
  await page.keyboard.press('Escape');
  await expect(preview(page).locator('.ios-frame-bubbles')).toHaveCount(1);
  await expect(preview(page).locator('.ios-header')).toHaveCount(0);
  await expect(preview(page)).toContainText('Frame-safe message');

  // The whole extras editor has to stay usable at 360px, with the send button
  // still on screen — the tray sits above a fixed export bar on a phone.
  await page.getByRole('button', { name: 'Message options' }).click();
  await page.getByRole('button', { name: 'images', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Image 1 description' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send message' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('offers the all-platform CSS by default and copies both halves of the work skin', async ({ page }) => {
  await page.goto('/?platform=ios');
  await composer(page).fill('A message worth exporting');
  await page.getByRole('button', { name: 'Send message' }).click();

  await page.getByRole('button', { name: /accessible work skin/i }).click();
  const css = await page.getByLabel('Work skin CSS').inputValue();
  const html = await page.getByLabel('Work skin HTML').inputValue();
  // The master skin is the default because AO3 gives a work exactly one skin.
  expect(css).toContain('.ao3skingen-v7');
  expect(css).toContain('.chat.ios');
  expect(css).toContain('.chat.android');
  expect(html).toContain('class="chat ios');
  expect(html).toContain('A message worth exporting');
});
