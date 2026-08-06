import { test, expect } from '@playwright/test';

/**
 * The image proxy is what makes "paste any image address" true at export time.
 * These hit the endpoint directly — fast, and they cover the security controls
 * that a UI test would never reach.
 */

// Redirects to fastly.picsum.photos, which serves 200 with no
// Access-Control-Allow-Origin — the exact case html2canvas silently drops.
const NO_CORS_IMAGE = 'https://picsum.photos/id/237/80/80.jpg';

test.describe('image proxy', () => {
  test('converts a non-CORS image to a data URI', async ({ request }) => {
    const res = await request.post('/api/image-proxy', {
      data: { url: NO_CORS_IMAGE },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.dataUri).toMatch(/^data:image\/[a-z+.-]+;base64,/i);
    expect(body.dataUri.length).toBeGreaterThan(100);
  });

  test('rejects non-HTTPS addresses', async ({ request }) => {
    const res = await request.post('/api/image-proxy', {
      data: { url: 'http://example.com/cat.png' },
    });
    expect(res.status()).toBe(400);
  });

  // SSRF: a user-supplied address must never be able to reach our own network.
  for (const url of [
    'https://localhost/secret.png',
    'https://127.0.0.1/secret.png',
    'https://10.0.0.1/secret.png',
    'https://192.168.1.1/secret.png',
    'https://169.254.169.254/latest/meta-data/',
    'https://metadata.google.internal/computeMetadata/v1/',
  ]) {
    test(`refuses the internal address ${url}`, async ({ request }) => {
      const res = await request.post('/api/image-proxy', { data: { url } });
      expect(res.status()).toBe(403);
    });
  }

  test('refuses an address that is not an image', async ({ request }) => {
    const res = await request.post('/api/image-proxy', {
      data: { url: 'https://example.com/' },
    });
    expect(res.status()).toBe(422);
  });

  test('rejects a missing url', async ({ request }) => {
    const res = await request.post('/api/image-proxy', { data: {} });
    expect(res.status()).toBe(400);
  });

  test('rejects GET', async ({ request }) => {
    const res = await request.get('/api/image-proxy');
    expect(res.status()).toBe(405);
  });

  // Without these the endpoint is an open image proxy anyone can point at
  // arbitrary hosts using our bandwidth.
  test('refuses a request a browser made from another site', async ({ request }) => {
    const res = await request.post('/api/image-proxy', {
      headers: { origin: 'https://someone-elses-site.example' },
      data: { url: NO_CORS_IMAGE },
    });
    expect(res.status()).toBe(403);
  });

  test('rate-limits a caller hammering the endpoint', async ({ request }) => {
    // The limit is 60/min; fire enough to cross it. Bad URLs are rejected
    // before any upstream fetch, so this stays fast and hits nobody else.
    //
    // A unique caller IP per run, or this test would exhaust the budget for
    // the real client address and 429 the export tests running beside it.
    const isolatedIp = `198.51.100.${Math.floor(Math.random() * 254) + 1}`;
    let sawTooMany = false;
    let retryAfter: string | null = null;

    for (let i = 0; i < 75; i++) {
      const res = await request.post('/api/image-proxy', {
        headers: { 'x-nf-client-connection-ip': isolatedIp },
        data: { url: 'not-a-url' },
      });
      if (res.status() === 429) {
        sawTooMany = true;
        retryAfter = res.headers()['retry-after'];
        break;
      }
    }

    expect(sawTooMany, 'should start refusing before 75 requests').toBe(true);
    expect(Number(retryAfter)).toBeGreaterThan(0);
  });
});
