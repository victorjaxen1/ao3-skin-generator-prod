import { expect, test } from '@playwright/test';

const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

test('hosted export keeps a long thread across relationship-aware partitions', async ({ page }) => {
  test.setTimeout(180_000);
  const messages = Array.from({ length: 18 }, (_, index) => ({
    id: `long-${index + 1}`,
    sender: 'Thread Author',
    content: index === 0 ? 'The thread root' : `Thread continuation post ${index + 1}`,
    outgoing: true,
    timestamp: `8:${String(index).padStart(2, '0')} PM`,
    ...(index ? { parentId: `long-${index}` } : {}),
  }));
  await page.addInitScript(project => localStorage.setItem('ao3SkinProject', JSON.stringify(project)), {
    id: 'hosted-thread',
    template: 'twitter',
    settings: {
      bubbleOpacity: 1, senderColor: '#1DA1F2', receiverColor: '#f5f8fa',
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', maxWidthPx: 600,
      useDarkNeutral: false, twitterSceneMode: 'thread', twitterTheme: 'light',
      twitterShowMetrics: false, fictionLabel: true, fictionLabelText: 'Fictional scene',
    },
    messages,
  });
  await page.route('**/api/image-proxy**', route => route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }));
  let uploads = 0;
  await page.route('**/api/image-upload', route => {
    uploads += 1;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, url: `https://i.ibb.co/thread-part-${uploads}.png` }) });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Get AO3 image code' }).click();
  const consent = page.getByRole('dialog', { name: 'Confirm hosted image upload' });
  await consent.getByRole('button', { name: 'Upload and get AO3 code' }).click();
  await expect(page.getByRole('heading', { name: 'Your AO3 code' })).toBeVisible({ timeout: 120_000 });
  expect(uploads).toBe(2);
  const code = page.getByRole('textbox', { name: 'AO3 hosted image code' });
  const value = await code.inputValue();
  expect(value).toContain('thread-part-1.png');
  expect(value).toContain('thread-part-2.png');
  expect(value).toContain('Part 2 of 2');
});
