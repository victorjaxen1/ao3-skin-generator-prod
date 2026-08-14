import { expect, test } from '@playwright/test';
import { defaultProject } from '../src/lib/schema';

const preview = (page: import('@playwright/test').Page) => page.locator('#workskin').first();
const composer = (page: import('@playwright/test').Page) => page.getByPlaceholder('Add a message…');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ao3skingen_analytics_consent', 'denied'));
});

test('authors replies, links, media, reactions, events, and safely deletes a reply target', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/?platform=android');

  await composer(page).fill('The first clue');
  await page.getByRole('button', { name: 'Send message' }).click();

  await page.getByRole('button', { name: 'Message options' }).click();
  const replyPicker = page.getByRole('combobox', { name: 'Reply to earlier message' });
  const replyTarget = await replyPicker.locator('option').last().getAttribute('value');
  await replyPicker.selectOption(replyTarget!);
  await page.getByRole('button', { name: 'Add reaction' }).click();
  await page.getByRole('textbox', { name: 'Reaction 1 emoji' }).fill('😮');
  await page.getByRole('spinbutton', { name: 'Reaction 1 count' }).fill('2');
  await composer(page).fill('I found it too');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(preview(page).locator('.wa-reply')).toHaveCount(1);
  await expect(preview(page).locator('.wa-reactions')).toContainText('😮 ×2');

  await page.getByRole('button', { name: 'Message options' }).click();
  await page.getByRole('button', { name: 'link', exact: true }).click();
  await page.getByRole('textbox', { name: 'Link address' }).fill('https://example.com/clue');
  await page.getByRole('textbox', { name: 'Link title' }).fill('Case notes');
  await page.getByRole('textbox', { name: 'Link description' }).fill('The complete timeline.');
  await composer(page).fill('Read this next');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(preview(page).locator('.wa-link-preview')).toContainText('Case notes');

  await page.getByRole('button', { name: 'Message options' }).click();
  await page.getByRole('button', { name: 'audio', exact: true }).click();
  await page.getByRole('textbox', { name: 'Media address' }).fill('https://example.com/note.mp3');
  await page.getByRole('textbox', { name: 'Voice message transcript' }).fill('The latch moved at midnight.');
  await expect(page.locator('audio')).toHaveCount(0);
  await page.getByRole('button', { name: 'Load media preview' }).click();
  await expect(page.locator('audio source[type="audio/mpeg"]')).toHaveAttribute('src', 'https://example.com/note.mp3');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(preview(page).locator('.wa-audio')).toContainText('The latch moved at midnight.');
  await expect(preview(page).locator('audio,video')).toHaveCount(0);

  await page.getByRole('button', { name: 'Message options' }).click();
  await page.getByRole('button', { name: 'Date', exact: true }).click();
  await page.getByRole('textbox', { name: 'Divider text' }).fill('Later that night');
  await expect(page.getByRole('button', { name: 'Send message' })).toBeEnabled();
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(preview(page).locator('.wa-event-date')).toContainText('Later that night');

  await page.getByRole('button', { name: 'Post options for The first clue' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete a replied-to message?' });
  await expect(dialog).toContainText('1 later message replies to it');
  await dialog.getByRole('button', { name: 'Delete and remove reply previews' }).click();
  await expect(preview(page).locator('.wa-reply')).toHaveCount(0);
  await expect(preview(page)).toContainText('I found it too');
});

test('switches WhatsApp frames without losing messages and keeps mobile authoring on-screen', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/?platform=android');
  await composer(page).fill('Frame-safe message');
  await page.getByRole('button', { name: 'Send message' }).click();

  await page.getByRole('button', { name: 'Open settings' }).click();
  await page.getByRole('combobox', { name: 'Frame' }).selectOption('phone');
  await page.getByRole('button', { name: 'Advanced' }).click();
  await page.getByRole('switch', { name: 'Fixed-height scroll window' }).click();
  await page.keyboard.press('Escape');
  await expect(preview(page).locator('.wa-frame-phone.wa-scroll')).toHaveCount(1);
  await expect(preview(page)).toContainText('Frame-safe message');

  await page.getByRole('button', { name: 'Open settings' }).click();
  await page.getByRole('combobox', { name: 'Frame' }).selectOption('bubbles');
  await page.keyboard.press('Escape');
  await expect(preview(page).locator('.wa-frame-bubbles')).toHaveCount(1);
  await expect(preview(page)).toContainText('Frame-safe message');
  await expect(page.getByRole('button', { name: 'Send message' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('previews a direct WhatsApp video only after consent and keeps the scene/PNG path static', async ({ page }) => {
  await page.goto('/?platform=android');
  await page.getByRole('button', { name: 'Message options' }).click();
  await page.getByRole('button', { name: 'video', exact: true }).click();
  await page.getByRole('combobox', { name: 'Video source' }).selectOption('direct');
  await page.getByRole('textbox', { name: 'Media address' }).fill('https://example.com/clue.mp4');
  await page.getByRole('textbox', { name: 'Video poster address' }).fill('https://example.com/clue-poster.png');
  await page.getByRole('textbox', { name: 'Video description' }).fill('The door opens from the inside.');
  await expect(page.locator('video')).toHaveCount(0);
  await page.getByRole('button', { name: 'Load media preview' }).click();
  await expect(page.locator('video source[type="video/mp4"]')).toHaveAttribute('src', 'https://example.com/clue.mp4');
  await page.getByRole('textbox', { name: 'Media address' }).fill('https://example.com/clue-updated.mp4');
  await expect(page.locator('video')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Load media preview' })).toBeVisible();
  await page.getByRole('button', { name: 'Load media preview' }).click();
  await expect(page.locator('video source[type="video/mp4"]')).toHaveAttribute('src', 'https://example.com/clue-updated.mp4');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(preview(page).locator('.wa-video')).toContainText('The door opens from the inside.');
  await expect(preview(page).locator('video,audio')).toHaveCount(0);
});

test('authors WhatsApp YouTube as a static thumbnail and exports the real AO3 player', async ({ page }) => {
  await page.goto('/?platform=android');
  await page.getByRole('button', { name: 'Message options' }).click();
  await page.getByRole('button', { name: 'video', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Video source' })).toHaveValue('youtube');
  await expect(page.getByRole('textbox', { name: 'Video poster address' })).toHaveValue('');
  await page.getByRole('textbox', { name: 'Media address' }).fill('https://www.youtube.com/watch?v=XlcK4VYSWZk');
  await page.getByRole('textbox', { name: 'Video poster address' }).fill('f');
  await expect(page.locator('iframe[title="WhatsApp YouTube video preview"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Load media preview' }).click();
  await expect(page.locator('iframe[title="WhatsApp YouTube video preview"]')).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/XlcK4VYSWZk');
  await page.getByRole('button', { name: 'Send message' }).click();

  await expect(preview(page).locator('iframe,video,audio')).toHaveCount(0);
  await expect(preview(page).locator('img[src="https://i.ytimg.com/vi/XlcK4VYSWZk/hqdefault.jpg"]')).toHaveCount(1);
  await page.getByRole('button', { name: /accessible work skin/i }).click();
  const workHtml = await page.getByLabel('Work skin HTML').inputValue();
  expect(workHtml).toContain('<iframe src="https://www.youtube-nocookie.com/embed/XlcK4VYSWZk"');
  expect(workHtml).not.toContain('<video');
});

test('exports WhatsApp audio with AO3 anonymous CORS and a typed direct MP3 source', async ({ page }) => {
  await page.goto('/?platform=android');
  await page.getByRole('button', { name: 'Message options' }).click();
  await page.getByRole('button', { name: 'audio', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Media file type' })).toHaveValue('audio/mpeg');
  await page.getByRole('textbox', { name: 'Media address' }).fill('https://archive.org/download/testmp3testfile/mpthreetest.mp3');
  await page.getByRole('textbox', { name: 'Voice message transcript' }).fill('Playable voice message.');
  await page.getByRole('button', { name: 'Send message' }).click();
  await page.getByRole('button', { name: /accessible work skin/i }).click();
  const workHtml = await page.getByLabel('Work skin HTML').inputValue();
  expect(workHtml).toContain('<audio class="wa-native-audio" title="Voice message" controls="controls" crossorigin="anonymous" preload="metadata">');
  expect(workHtml).toContain('<source src="https://archive.org/download/testmp3testfile/mpthreetest.mp3" type="audio/mpeg">');
});

test('repairs the exact non-CORS W3 audio sample already saved in the current project', async ({ page }) => {
  const project = defaultProject();
  project.template = 'android';
  project.messages = [{
    id: 'legacy-audio', sender: 'You', content: '', outgoing: true,
    whatsappMedia: {
      kind: 'audio',
      url: 'https://media.w3.org/2010/07/bunny/04-Death_Becomes_Fur.oga',
      mimeType: 'audio/ogg',
      transcript: 'Existing saved voice message.',
    },
  }];
  await page.addInitScript(value => localStorage.setItem('ao3SkinProject', JSON.stringify(value)), project);
  await page.goto('/');
  await expect(preview(page).locator('.wa-media-source')).toHaveAttribute('href', 'https://archive.org/download/testmp3testfile/mpthreetest.mp3');
  await page.getByRole('button', { name: /accessible work skin/i }).click();
  const workHtml = await page.getByLabel('Work skin HTML').inputValue();
  expect(workHtml).toContain('<source src="https://archive.org/download/testmp3testfile/mpthreetest.mp3" type="audio/mpeg">');
});
