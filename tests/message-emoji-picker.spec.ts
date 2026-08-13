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
}

test('Google results do not show conversation emoji controls', async ({ page }) => {
  await page.goto('/?platform=google');
  await expect(page.getByRole('button', { name: 'Add emoji to message' })).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Message emoji picker' })).toHaveCount(0);
});
