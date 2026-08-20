import { expect, Page, test } from '@playwright/test';

/**
 * The layout renders a mobile and a desktop preview and hides one with CSS, so
 * an unscoped `#workskin` selector matches two elements and the hidden one
 * wins on `.first()`. Always go through the visible instance.
 */
const preview = (page: Page, selector: string) => page.locator(`#workskin:visible ${selector}`);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('ao3SkinProject');
    localStorage.removeItem('ao3skin_universal_characters');
    localStorage.setItem('ao3skingen_analytics_consent', 'denied');
  });
});

test('creates and edits a scene-scoped Twitter account with a stable identity', async ({ page }) => {
  await page.goto('/?platform=twitter');

  await page.getByRole('button', { name: 'Add account' }).click();
  await expect(page.getByRole('dialog', { name: 'Accounts' })).toBeVisible();
  await page.getByPlaceholder('Display name').fill('Morgan Lee');
  await page.getByPlaceholder('username').fill('@morganlee');
  await page.getByRole('checkbox', { name: 'Verified' }).check();
  await page.getByRole('button', { name: 'Add to this scene' }).click();
  await page.getByRole('button', { name: 'Close' }).click();

  await page.getByRole('combobox', { name: 'Posting as' }).selectOption({ label: 'Morgan Lee' });
  await page.getByPlaceholder("What's happening?").fill('A stable account post');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(preview(page, '.tweet .name').last()).toHaveText('Morgan Lee');
  await expect(preview(page, '.tweet .handle').last()).toHaveText('@morganlee');

  await page.getByRole('button', { name: 'Edit Morgan Lee' }).last().click();
  await page.getByPlaceholder('Display name').fill('Morgan L.');
  await page.getByPlaceholder('username').fill('morgan_l');
  await page.getByRole('button', { name: 'Save changes' }).click();

  await expect(preview(page, '.tweet .name').last()).toHaveText('Morgan L.');
  await expect(preview(page, '.tweet .handle').last()).toHaveText('@morgan_l');
});

test('keeps message-body editing separate from preview identity editing', async ({ page }) => {
  await page.goto('/?template=twitter-character-thread');

  await preview(page, '.tweet .name').last().click();
  await expect(page.getByRole('dialog', { name: 'Accounts' })).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();

  const body = preview(page, '.tweet .body').last();
  const messageId = await body.evaluate(element => element.closest('[data-message-id]')?.getAttribute('data-message-id'));
  await body.click();
  await expect(page.locator(`#timeline-msg-${messageId} textarea`)).toBeVisible();
});

test('Google exposes result details but no identity controls', async ({ page }) => {
  await page.goto('/?platform=google');

  // The query used to be reachable only through the header title, which reads
  // "Google" until something is typed into it — so the one setting the whole
  // platform is about looked like a label. It is a field in the editor now.
  const query = page.getByRole('textbox', { name: 'Search query' });
  await query.fill('whose jacket is in the wren maddox soundcheck video');
  await expect(preview(page, '.search-text')).toHaveText('whose jacket is in the wren maddox soundcheck video');

  await expect(page.getByRole('button', { name: 'Add result details' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Add person|Add account|Open people|Open accounts|character library/i })).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Posting as' })).toHaveCount(0);
});

test('mobile chat keeps identity, message options, send, and attachment-only messages usable', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto('/?platform=ios');

  await expect(page.getByRole('button', { name: 'Add person' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Message options' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send message' })).toBeVisible();

  await page.getByRole('button', { name: 'Add person' }).click();
  await page.getByPlaceholder('Person name').fill('Casey');
  await page.getByRole('button', { name: 'Add to this conversation' }).click();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('button', { name: 'Edit identity for Casey' })).toBeVisible();

  // Attachments are behind a kind chooser now — none / images / link / audio /
  // video — so an image address only exists once "images" is the chosen kind.
  await page.getByRole('button', { name: 'Message options' }).click();
  await page.getByRole('button', { name: 'images', exact: true }).click();
  await page.getByLabel('Image 1 address').fill('/assets/alex-avatar.png');
  // An undescribed image is a validation error, not a sendable message — the
  // work skin has to survive with images off, so Send stays disabled until the
  // picture says what it is.
  await page.getByLabel('Image 1 description').fill('Alex smiling at the camera');
  await page.getByRole('button', { name: 'Send message' }).click();
  // iMessage photos are `.ios-image`; `.message-image` is the older single-
  // image bubble the other chat platforms still render.
  const attachment = preview(page, '.ios-image').last();
  await expect(attachment).toHaveAttribute('src', '/assets/alex-avatar.png');
  await expect(attachment).toBeVisible();
});

test('iMessage group members stay distinct and old messages follow a rename', async ({ page }) => {
  await page.goto('/?platform=ios');

  await page.getByRole('button', { name: 'Open people' }).click();
  const sheet = page.getByRole('dialog', { name: 'People' });
  await sheet.getByRole('switch', { name: 'Group chat mode' }).click();

  for (const name of ['Robin Park', 'Devi Rao']) {
    await sheet.getByRole('button', { name: 'Add person' }).click();
    await sheet.getByPlaceholder('Person name').fill(name);
    await sheet.getByRole('button', { name: 'Add to this conversation' }).click();
  }
  await sheet.getByRole('button', { name: 'Close' }).click();

  // Post one message as each member so the rename has something to follow.
  // The group member selector only shows while the composer is on "them", and
  // the composer auto-alternates back to "you" after each send.
  const speaker = page.getByRole('combobox', { name: 'Speaking as' });
  for (const [name, text] of [['Robin Park', 'robin speaks'], ['Devi Rao', 'devi speaks']]) {
    if (await speaker.count() === 0) {
      await page.getByRole('button', { name: /^Sending as .* — tap to switch$/ }).click();
    }
    await expect(speaker).toBeVisible();
    await speaker.selectOption({ label: name });
    await page.getByPlaceholder('Add a message…').fill(text);
    await page.getByRole('button', { name: 'Send message' }).click();
  }

  // Anchor each assertion to its own message rather than to list position.
  // iMessage names its sender `.ios-group-sender`; `.group-sender` is
  // WhatsApp's, and the two carry different type sizes and display modes.
  const senderOf = (text: string) =>
    page.locator('#workskin:visible [data-message-id]', { hasText: text }).locator('.ios-group-sender');
  await expect(senderOf('robin speaks')).toHaveText('Robin Park');
  await expect(senderOf('devi speaks')).toHaveText('Devi Rao');

  // Rename the first member only. The second must not move with it.
  await page.getByRole('button', { name: 'Open people' }).click();
  await sheet.getByRole('button', { name: /Robin Park/ }).click();
  await sheet.getByPlaceholder('Person name').fill('Robin P.');
  await sheet.getByRole('button', { name: 'Save changes' }).click();
  await sheet.getByRole('button', { name: 'Close' }).click();

  await expect(senderOf('robin speaks')).toHaveText('Robin P.');
  await expect(senderOf('devi speaks')).toHaveText('Devi Rao');
});

test('people added before group mode stay in the iMessage group roster', async ({ page }) => {
  await page.goto('/?platform=ios');

  await page.getByRole('button', { name: 'Open people' }).click();
  const sheet = page.getByRole('dialog', { name: 'People' });

  await sheet.getByRole('button', { name: 'Add person' }).click();
  await sheet.getByPlaceholder('Person name').fill('Casey');
  await sheet.getByRole('button', { name: 'Add to this conversation' }).click();

  await sheet.getByRole('button', { name: 'Add person' }).click();
  await sheet.getByPlaceholder('Person name').fill('Samuel');
  await sheet.getByRole('button', { name: 'Add to this conversation' }).click();

  await expect(sheet.getByRole('button', { name: /Casey/ })).toBeVisible();
  await expect(sheet.getByRole('button', { name: /Samuel/ })).toBeVisible();
  await sheet.getByRole('switch', { name: 'Group chat mode' }).click();

  const group = sheet.getByRole('heading', { name: 'People in the group' }).locator('..');
  await expect(group.getByRole('button', { name: /Casey/ })).toBeVisible();
  await expect(group.getByRole('button', { name: /Samuel/ })).toBeVisible();
});

test('WhatsApp group participant edits refresh old message names and avatars', async ({ page }) => {
  await page.goto('/?template=whatsapp-group-chat');

  const alexRow = page.locator('#workskin:visible [data-message-id]', { hasText: 'Anyone free for coffee tomorrow?' });
  const before = await alexRow.locator('.group-avatar').getAttribute('src');
  expect(before, 'the template participant should start with an avatar').toBeTruthy();
  const replacementAvatar = '/assets/jordan-avatar.png';

  const sheet = page.getByRole('dialog', { name: 'People' });
  await page.getByRole('button', { name: 'Open people' }).click();
  await sheet.getByRole('button', { name: /^Alex/ }).click();
  await sheet.getByPlaceholder('Person name').fill('Alexis');
  await sheet.getByLabel('Avatar image address').fill(replacementAvatar);
  await sheet.getByRole('button', { name: 'Save changes' }).click();
  await sheet.getByRole('button', { name: 'Close' }).click();

  await expect(alexRow.locator('.group-sender')).toHaveText('Alexis');
  await expect(alexRow.locator('.group-avatar')).toHaveAttribute('src', replacementAvatar);
  expect(replacementAvatar).not.toBe(before);
});

test('two Twitter accounts with the same display name remain separate identities', async ({ page }) => {
  await page.goto('/?platform=twitter');

  for (const handle of ['first_one', 'second_one']) {
    await page.getByRole('button', { name: 'Add account' }).click();
    await page.getByPlaceholder('Display name').fill('Same Name');
    await page.getByPlaceholder('username').fill(handle);
    await page.getByRole('button', { name: 'Add to this scene' }).click();
    await page.getByRole('button', { name: 'Close' }).click();
  }

  // Both must be selectable, and each post must carry its own handle.
  const postingAs = page.getByRole('combobox', { name: 'Posting as' });
  await expect(postingAs.locator('option', { hasText: 'Same Name' })).toHaveCount(2);

  const values = await postingAs.locator('option').evaluateAll(options =>
    options.filter(option => option.textContent === 'Same Name').map(option => (option as HTMLOptionElement).value)
  );
  expect(new Set(values).size, 'same-name accounts must have distinct ids').toBe(2);

  for (const [index, text] of [[0, 'post from the first'], [1, 'post from the second']] as const) {
    await postingAs.selectOption(values[index]);
    await page.getByPlaceholder("What's happening?").fill(text);
    await page.getByRole('button', { name: 'Send message' }).click();
  }

  // A blank project ships with seed posts, so anchor to the new posts by text.
  const handleOf = (text: string) =>
    page.locator('#workskin:visible [data-message-id]', { hasText: text }).locator('.handle');
  await expect(handleOf('post from the first')).toHaveText('@first_one');
  await expect(handleOf('post from the second')).toHaveText('@second_one');
});

test('timeline sender and preview avatar open the same identity editor', async ({ page }) => {
  await page.goto('/?template=twitter-character-thread');

  await page.getByRole('button', { name: 'Edit Alex Rivers' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Accounts' });
  await expect(dialog).toBeVisible();
  const fromTimeline = await dialog.getByPlaceholder('username').inputValue();
  await page.getByRole('button', { name: 'Close' }).click();

  await preview(page, '.tweet .avatar').first().click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByPlaceholder('username')).toHaveValue(fromTimeline);
});

test('the identity sheet closes on Escape and returns focus to its opener', async ({ page }) => {
  await page.goto('/?platform=ios');

  const opener = page.getByRole('button', { name: 'Open people' });
  await opener.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'People' })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'People' })).toHaveCount(0);
  await expect(opener).toBeFocused();
});

const GOOGLE_TEMPLATES = ['google-search-history', 'google-research-montage', 'google-news-articles'];

for (const templateId of GOOGLE_TEMPLATES) {
  test(`Google template ${templateId} exposes no identity controls`, async ({ page }) => {
    await page.goto(`/?template=${templateId}`);

    await expect(page.getByRole('button', { name: /Add person|Add account|Open people|Open accounts/i })).toHaveCount(0);
    await expect(page.getByRole('combobox', { name: /Posting as|Speaking as/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Edit identity for/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Add result details' })).toBeVisible();
  });
}

const AVATAR_TEMPLATES = [
  'twitter-character-thread',
  'twitter-verified-account',
  'twitter-media-image',
  'ios-contact-avatar',
  'whatsapp-profile-picture',
  'whatsapp-group-chat',
];

for (const templateId of AVATAR_TEMPLATES) {
  test(`quick template ${templateId} renders every avatar it references`, async ({ page }) => {
    await page.goto(`/?template=${templateId}`);
    await expect(preview(page, 'img').first()).toBeAttached();

    // Wait for the preview's images to settle before measuring them.
    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll('#workskin img')).every(img => (img as HTMLImageElement).complete)
    );

    const broken = await preview(page, 'img').evaluateAll(images =>
      (images as HTMLImageElement[])
        .filter(image => image.naturalWidth === 0)
        .map(image => image.getAttribute('src') || '(no src)')
    );
    expect(broken, `broken images in ${templateId}`).toEqual([]);
  });
}

for (const templateId of ['twitter-character-thread', 'whatsapp-profile-picture']) {
  test(`PNG export succeeds for ${templateId} with its avatars intact`, async ({ page }) => {
    await page.goto(`/?template=${templateId}`);
    await expect(preview(page, 'img').first()).toBeAttached();

    const download = page
      .waitForEvent('download', { timeout: 60000 })
      .then(() => 'DOWNLOAD')
      .catch(() => 'NO DOWNLOAD');
    await page.getByRole('button', { name: 'Save PNG' }).first().click();

    expect(await download).toBe('DOWNLOAD');
    await expect(page.getByText(/couldn't be included/i)).toHaveCount(0);
  });
}
