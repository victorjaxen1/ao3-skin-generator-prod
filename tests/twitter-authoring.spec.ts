import { expect, test } from '@playwright/test';

const preview = (page: any) => page.locator('#workskin').first();

test('authors a thread, edits its relationship, and switches modes without data loss', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.goto('/?platform=twitter');
  await expect(page.getByText('Write your first post below')).toBeVisible();

  await page.getByRole('button', { name: 'Open settings' }).click();
  await page.getByRole('combobox', { name: 'Scene mode' }).selectOption('thread');
  await page.keyboard.press('Escape');

  const composer = page.getByPlaceholder("What's happening?");
  await composer.fill('The root post');
  await page.getByRole('button', { name: 'Send message' }).click();

  await expect(page.getByRole('button', { name: 'Reply', pressed: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Reply to post' })).toContainText('The root post');

  await composer.fill('The authored reply');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(preview(page).locator('.tweet.reply')).toHaveCount(1);
  await expect(preview(page)).toContainText('Replying to');

  const cards = page.locator('[id^="timeline-msg-"]');
  await cards.nth(1).click();
  await expect(cards.nth(1).getByRole('combobox', { name: 'Post relationship' })).toHaveValue('reply');
  await expect(cards.nth(1).getByRole('combobox', { name: 'Reply parent' })).toContainText('The root post');
  await expect(cards.nth(1).getByText('@user', { exact: true })).toBeVisible();
  const timestamp = cards.nth(1).getByRole('textbox', { name: 'Post timestamp' });
  await timestamp.fill('Custom time');
  await cards.nth(1).getByRole('button', { name: 'Use automatic timestamp' }).click();
  await expect(timestamp).not.toHaveValue('Custom time');

  await page.getByRole('button', { name: 'Open settings' }).click();
  await page.getByRole('combobox', { name: 'Scene mode' }).selectOption('timeline');
  await page.keyboard.press('Escape');
  await expect(preview(page).locator('.tweet.reply')).toHaveCount(0);
  await expect(preview(page)).toContainText('Replying to');

  await page.getByRole('button', { name: 'Open settings' }).click();
  await page.getByRole('combobox', { name: 'Scene mode' }).selectOption('thread');
  await page.keyboard.press('Escape');
  await expect(preview(page).locator('.tweet.reply')).toHaveCount(1);

  const downloadPromise = page.waitForEvent('download', { timeout: 90_000 });
  await page.getByRole('button', { name: 'Save PNG' }).first().click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.png$/i);
  await download.saveAs(testInfo.outputPath('twitter-thread.png'));
});

test('single-post mode expands the focal post and hides relationship controls', async ({ page }) => {
  await page.goto('/?platform=twitter');
  await page.getByRole('button', { name: 'Open settings' }).click();
  await page.getByRole('combobox', { name: 'Scene mode' }).selectOption('single');
  await page.keyboard.press('Escape');

  await page.getByPlaceholder("What's happening?").fill('One focal post');
  await page.getByRole('button', { name: 'Send message' }).click();

  await expect(page.getByText('Relationship', { exact: true })).toHaveCount(0);
  await expect(preview(page).locator('.tweet.expanded')).toHaveCount(1);
});

test('authors, reorders, and removes a four-image grid with accessible descriptions', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/?platform=twitter');
  await page.getByPlaceholder("What's happening?").fill('A four-image story');
  await page.getByRole('button', { name: 'Send message' }).click();
  const card = page.locator('[id^="timeline-msg-"]').first();
  await card.click();
  await card.getByRole('button', { name: 'Media' }).click();

  for (let index = 1; index <= 4; index += 1) {
    await card.getByRole('button', { name: /Add image/i }).click();
    await card.getByRole('textbox', { name: `Image ${index} address` }).fill(`https://example.com/image-${index}.png`);
    await card.getByRole('textbox', { name: `Image ${index} description` }).fill(`Story image ${index}`);
  }
  await expect(preview(page).locator('.media-count-4')).toHaveCount(1);
  await expect(preview(page).locator('.twitter-media-image')).toHaveCount(4);

  await card.getByRole('button', { name: 'Move image 4 earlier' }).click();
  await expect(preview(page).locator('.twitter-media-image').nth(2)).toHaveAttribute('alt', 'Story image 4');
  await card.getByRole('button', { name: 'Remove image 2' }).click();
  await expect(preview(page).locator('.media-count-3')).toHaveCount(1);
});

test('authors independent quote, poll, translation, activity, and dim-theme states', async ({ page }) => {
  await page.goto('/?platform=twitter');
  await page.getByPlaceholder("What's happening?").fill('Rich narrative post');
  await page.getByRole('button', { name: 'Send message' }).click();
  const card = page.locator('[id^="timeline-msg-"]').first();
  await card.click();

  await card.getByRole('button', { name: 'Quote post' }).click();
  await card.getByRole('button', { name: 'Add quote post' }).click();
  await card.getByRole('textbox', { name: 'Quoted account name' }).fill('Outside Witness');
  await card.getByRole('textbox', { name: 'Quoted account handle' }).fill('@witness');
  await card.getByRole('textbox', { name: 'Quoted post text' }).fill('I saw the whole thing.');

  await card.getByRole('button', { name: 'Poll' }).click();
  await card.getByRole('button', { name: 'Add poll' }).click();
  await card.getByRole('combobox', { name: 'Poll state' }).selectOption('closed');
  await card.getByRole('textbox', { name: 'Poll option 1' }).fill('Believe them');
  await card.getByRole('textbox', { name: 'Poll option 2' }).fill('Doubt them');
  await card.getByRole('spinbutton', { name: 'Percentage for option 1' }).fill('60');
  await card.getByRole('spinbutton', { name: 'Percentage for option 2' }).fill('40');

  await card.getByRole('button', { name: 'Translation' }).click();
  await card.getByRole('button', { name: 'Add translation' }).click();
  await card.getByRole('textbox', { name: 'Original language' }).fill('French');
  await card.getByRole('textbox', { name: 'Translated post text' }).fill('The translated clue');

  await card.getByRole('button', { name: 'Activity and account label' }).click();
  await card.getByRole('textbox', { name: 'Account label' }).fill('Parody account');
  await card.getByRole('combobox', { name: 'Activity type' }).selectOption('liked');

  await page.getByRole('button', { name: 'Open settings' }).click();
  await page.getByRole('combobox', { name: 'Theme' }).selectOption('dim');
  await page.keyboard.press('Escape');

  await expect(preview(page).locator('.theme-dim')).toHaveCount(1);
  await expect(preview(page)).toContainText('I saw the whole thing.');
  await expect(preview(page)).toContainText('60%');
  await expect(preview(page)).toContainText('Translated from French');
  await expect(preview(page)).toContainText('Parody account');
});

test('loads video preview only after consent and keeps static output in the scene preview', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/?platform=twitter');
  await page.getByPlaceholder("What's happening?").fill('A video post');
  await page.getByRole('button', { name: 'Message options' }).click();
  await page.getByRole('button', { name: 'Media' }).click();
  await page.getByRole('button', { name: 'Video' }).click();
  await page.getByRole('textbox', { name: 'Video address' }).fill('https://youtu.be/bN8449nalT8');
  await page.getByRole('textbox', { name: 'Video title' }).fill('Fictional clip');
  await page.getByRole('textbox', { name: 'Video description or transcript' }).fill('A short transcript fallback.');

  await expect(page.locator('iframe[title^="Video preview"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Load video preview' }).click();
  await expect(page.locator('iframe[title="Video preview: Fictional clip"]')).toHaveAttribute('src', /youtube-nocookie\.com/);
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(preview(page).locator('.twitter-video-card')).toHaveCount(1);
  await expect(preview(page).locator('iframe,video')).toHaveCount(0);
  await expect(preview(page)).toContainText('A short transcript fallback.');
});

test('offers explicit reply promotion or reparenting when deleting a parent', async ({ page }) => {
  await page.goto('/?platform=twitter');
  await page.getByRole('button', { name: 'Open settings' }).click();
  await page.getByRole('combobox', { name: 'Scene mode' }).selectOption('thread');
  await page.keyboard.press('Escape');
  const composer = page.getByPlaceholder("What's happening?");
  for (const text of ['Root', 'Middle', 'Leaf']) {
    await composer.fill(text);
    await page.getByRole('button', { name: 'Send message' }).click();
  }
  await page.getByRole('button', { name: 'Post options for Middle' }).click();
  await page.getByRole('button', { name: 'Delete' }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete a post with replies?' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: /Reparent replies/ }).click();
  await expect(page.getByText('Middle', { exact: true })).toHaveCount(0);
  await expect(preview(page).locator('.tweet.reply')).toHaveCount(1);
  await expect(preview(page)).toContainText('Leaf');
});

test('keeps the core authoring controls inside a 360px viewport', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/?platform=twitter');
  await expect(page.getByPlaceholder("What's happening?")).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send message' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
