import { expect, test } from '@playwright/test';

const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

test('hosted WhatsApp export uploads only a PNG body, never source media', async ({ page }) => {
  test.setTimeout(150_000);
  await page.addInitScript(() => localStorage.setItem('ao3skin_imgbb_scene_ack', '1'));
  await page.route('**/api/image-proxy**', route => route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }));
  let uploadBody = Buffer.alloc(0);
  let uploadType = '';
  await page.route('**/api/image-upload', async route => {
    uploadBody = route.request().postDataBuffer() || Buffer.alloc(0);
    uploadType = route.request().headers()['content-type'] || '';
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, url: 'https://i.ibb.co/whatsapp-scene.png' }) });
  });
  await page.goto('/?template=whatsapp-group-chat');
  await page.getByRole('button', { name: 'Get AO3 image code' }).click();
  await expect(page.getByRole('heading', { name: 'Your AO3 code' })).toBeVisible({ timeout: 120_000 });
  expect(uploadType).toBe('image/png');
  expect(uploadBody.subarray(1, 4).toString('ascii')).toBe('PNG');
  const bodyText = uploadBody.toString('latin1');
  expect(bodyText).not.toContain('media.w3.org');
  expect(bodyText).not.toContain('trailer.mp4');
  expect(bodyText).not.toContain('Death_Becomes_Fur.oga');
  await expect(page.getByRole('textbox', { name: 'AO3 hosted image code' })).toHaveValue(/whatsapp-scene\.png/);
});
