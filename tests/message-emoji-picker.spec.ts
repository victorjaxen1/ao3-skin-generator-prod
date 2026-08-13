import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('ao3SkinProject');
    localStorage.setItem('ao3skingen_analytics_consent', 'denied');
  });
});

for (const platform of ['ios', 'android', 'twitter'] as const) {
  test(`${platform} inserts a message emoji at the cursor and sends it`, async ({ page }) => {
    await page.goto(`/?platform=${platform}`);

    const composer = page.getByPlaceholder(platform === 'twitter' ? "What's happening?" : 'Add a message…');
    await composer.fill('hello world');
    await composer.evaluate(element => (element as HTMLTextAreaElement).setSelectionRange(6, 6));

    const trigger = page.getByRole('button', { name: 'Add emoji to message' });
    await trigger.click();
    await expect(page.getByRole('group', { name: 'Message emoji picker' }).getByRole('button')).toHaveCount(9);
    await page.getByRole('button', { name: 'Insert 😂' }).click();

    await expect(composer).toHaveValue('hello 😂world');
    await expect(composer).toBeFocused();
    await page.getByRole('button', { name: 'Send message' }).click();

    await expect(page.locator('#workskin:visible [data-message-id]', { hasText: 'hello 😂world' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Message emoji picker' })).toHaveCount(0);
  });

  test(`${platform} inserts emoji while editing an existing message`, async ({ page }) => {
    await page.goto(`/?platform=${platform}`);

    const composer = page.getByPlaceholder(platform === 'twitter' ? "What's happening?" : 'Add a message…');
    await composer.fill('edit this message');
    await page.getByRole('button', { name: 'Send message' }).click();

    const matchingCard = page.locator('[id^="timeline-msg-"]', { hasText: 'edit this message' }).last();
    const cardId = await matchingCard.getAttribute('id');
    expect(cardId).toBeTruthy();
    const card = page.locator(`[id="${cardId}"]`);
    await card.getByText('edit this message', { exact: true }).first().click();
    const editor = card.locator('textarea').first();
    await expect(editor).toBeVisible();
    await editor.fill('hello world');
    await editor.evaluate(element => (element as HTMLTextAreaElement).setSelectionRange(6, 6));

    await card.getByRole('button', { name: 'Add emoji to message' }).click();
    await expect(card.getByRole('group', { name: 'Message emoji picker' }).getByRole('button')).toHaveCount(9);
    await card.getByRole('button', { name: 'Insert 🎉' }).click();

    await expect(editor).toHaveValue('hello 🎉world');
    await expect(editor).toBeFocused();
    await expect(page.locator('#workskin:visible [data-message-id]', { hasText: 'hello 🎉world' })).toBeVisible();
  });
}

test('Google results do not show conversation emoji controls', async ({ page }) => {
  await page.goto('/?platform=google');
  await expect(page.getByRole('button', { name: 'Add emoji to message' })).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Message emoji picker' })).toHaveCount(0);

  const card = page.locator('[id^="timeline-msg-"]').first();
  await card.locator('button').last().click();
  await card.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(card.locator('textarea').first()).toBeVisible();
  await expect(card.getByRole('button', { name: 'Add emoji to message' })).toHaveCount(0);
});
