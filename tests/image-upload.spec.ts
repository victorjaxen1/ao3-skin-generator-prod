import { test, expect } from '@playwright/test';

test.describe('image upload route boundary', () => {
  test('rejects GET', async ({ request }) => {
    const response = await request.get('/api/image-upload');
    expect(response.status()).toBe(405);
    expect(await response.json()).toEqual({
      ok: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' },
    });
  });

  test('rejects a foreign browser origin before reading bytes', async ({ request }) => {
    const response = await request.post('/api/image-upload', {
      headers: {
        origin: 'https://someone-elses-site.example',
        'content-type': 'image/png',
        'x-upload-kind': 'selected-file',
      },
      data: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    });
    expect(response.status()).toBe(403);
    expect(await response.json()).toEqual({
      ok: false,
      error: { code: 'ORIGIN_NOT_ALLOWED', message: 'Cross-site uploads are not allowed.' },
    });
  });

  test('never exposes provider configuration details', async ({ request, baseURL }) => {
    const origin = new URL(baseURL!).origin;
    const response = await request.post('/api/image-upload', {
      headers: {
        origin,
        'content-type': 'image/png',
        'x-upload-kind': 'selected-file',
      },
      data: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    });
    // With a local provider key configured, the deliberately truncated PNG can
    // reach ImgBB and return our sanitized upstream-failure status (502).
    expect([400, 413, 415, 422, 502, 503]).toContain(response.status());
    const text = await response.text();
    expect(text).not.toMatch(/NEXT_PUBLIC|api\.imgbb\.com|key=/i);
  });
});
