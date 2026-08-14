import { expect, test } from '@playwright/test';
import { buildHTML } from '../src/lib/generator';
import { defaultProject, SkinProject } from '../src/lib/schema';

const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

test('hosted iOS export uploads only a PNG body, never a media source', async ({ page }) => {
  test.setTimeout(150_000);
  await page.addInitScript(() => localStorage.setItem('ao3skin_imgbb_scene_ack', '1'));
  await page.route('**/api/image-proxy**', route => route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }));
  await page.route('https://picsum.photos/**', route => route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }));
  await page.route('https://i.ytimg.com/**', route => route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }));

  let uploadBody = Buffer.alloc(0);
  let uploadType = '';
  await page.route('**/api/image-upload', async route => {
    uploadBody = route.request().postDataBuffer() || Buffer.alloc(0);
    uploadType = route.request().headers()['content-type'] || '';
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, url: 'https://i.ibb.co/ios-scene.png' }) });
  });

  await page.goto('/?template=ios-rich-group-scene');
  await page.getByRole('button', { name: 'Get AO3 image code' }).click();
  await expect(page.getByRole('heading', { name: 'Your AO3 code' })).toBeVisible({ timeout: 120_000 });

  // ImgBB receives the finished raster and nothing else. Not the audio file,
  // not the video, not the addresses of either.
  expect(uploadType).toBe('image/png');
  expect(uploadBody.subarray(1, 4).toString('ascii')).toBe('PNG');
  const bodyText = uploadBody.toString('latin1');
  expect(bodyText).not.toContain('mpthreetest.mp3');
  expect(bodyText).not.toContain('archive.org');
  expect(bodyText).not.toContain('youtube.com');
  expect(bodyText).not.toContain('XlcK4VYSWZk');
  await expect(page.getByRole('textbox', { name: 'AO3 hosted image code' })).toHaveValue(/ios-scene\.png/);
});

test('a hosted chunk resolves a reply whose target is in an earlier chunk', () => {
  // Not a browser concern, but it belongs beside the upload contract: the
  // chunking path must hand the renderer the whole scene, or a reply that spans
  // a chunk boundary renders "Original message unavailable" in the PNG.
  const project: SkinProject = defaultProject();
  project.template = 'ios';
  project.messages = [
    { id: 'a', sender: 'Sam', content: 'The side door is open.', outgoing: false, timestamp: '22:14' },
    { id: 'b', sender: 'You', content: 'Checking now.', outgoing: true, timestamp: '22:16', iosReply: { messageId: 'a' } },
  ];

  const laterChunk: SkinProject = { ...project, messages: [project.messages[1]] };
  const withContext = buildHTML(laterChunk, 'static', { sourceMessages: project.messages });
  expect(withContext).toContain('Replying to Sam');
  expect(withContext).toContain('The side door is open.');
  expect(withContext).not.toContain('Original message unavailable');

  // And without the full scene it degrades honestly rather than silently.
  expect(buildHTML(laterChunk, 'static')).toContain('Original message unavailable');
});
