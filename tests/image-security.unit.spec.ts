import { test, expect } from '@playwright/test';
import {
  detectImageType,
  fetchValidatedImage,
  isBlockedIp,
  RemoteImageError,
  validateRemoteImageUrl,
} from '../src/lib/server/imageSecurity';
import { checkUploadRateLimit, uploadImageToProvider } from '../src/pages/api/image-upload';

const PNG = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xdb, 0]);
const WEBP = Uint8Array.from([...Buffer.from('RIFF'), 0, 0, 0, 0, ...Buffer.from('WEBP'), 0]);
const GIF = Uint8Array.from(Buffer.from('GIF89a!'));
const publicDns = async () => [{ address: '93.184.216.34' }];

function imageResponse(bytes: Uint8Array, type: string, headers: Record<string, string> = {}) {
  return new Response(bytes, { status: 200, headers: { 'content-type': type, ...headers } });
}

test.describe('image signatures', () => {
  test('recognises only supported raster magic bytes', () => {
    expect(detectImageType(PNG)).toBe('image/png');
    expect(detectImageType(JPEG)).toBe('image/jpeg');
    expect(detectImageType(WEBP)).toBe('image/webp');
    expect(detectImageType(GIF)).toBe('image/gif');
    expect(detectImageType(Uint8Array.from(Buffer.from('<svg></svg>')))).toBeNull();
  });
});

test.describe('remote image network boundary', () => {
  for (const address of [
    '127.0.0.1', '10.0.0.1', '169.254.169.254', '192.168.1.1',
    '0.0.0.0', '100.64.0.1', '198.51.100.2', '224.0.0.1',
    '::1', 'fc00::1', 'fe80::1', 'ff02::1', '::ffff:127.0.0.1', '::ffff:7f00:1',
  ]) {
    test(`blocks ${address}`, () => expect(isBlockedIp(address)).toBe(true));
  }

  test('rejects a public hostname when DNS reaches a private address', async () => {
    await expect(validateRemoteImageUrl('https://example.com/a.png', async () => [{ address: '10.0.0.4' }]))
      .rejects.toMatchObject({ code: 'PRIVATE_ADDRESS', status: 403 });
  });

  test('rejects arbitrary ports', async () => {
    await expect(validateRemoteImageUrl('https://example.com:8443/a.png', publicDns))
      .rejects.toMatchObject({ code: 'PORT_NOT_ALLOWED' });
  });

  for (const url of ['https://[::1]/a.png', 'https://[::ffff:127.0.0.1]/a.png', 'https://[::ffff:7f00:1]/a.png']) {
    test(`rejects literal IPv6 internal target ${url}`, async () => {
      await expect(validateRemoteImageUrl(url, publicDns)).rejects.toMatchObject({ code: 'PRIVATE_ADDRESS', status: 403 });
    });
  }

  test('validates every redirect target before following it', async () => {
    const fetchImpl = async () => new Response(null, { status: 302, headers: { location: 'https://internal.example/a.png' } });
    const resolver = async (host: string) => [{ address: host === 'internal.example' ? '192.168.1.2' : '93.184.216.34' }];
    await expect(fetchValidatedImage('https://example.com/a.png', { fetchImpl: fetchImpl as typeof fetch, resolver, maxBytes: 100 }))
      .rejects.toMatchObject({ code: 'PRIVATE_ADDRESS' });
  });

  test('stops redirect loops', async () => {
    const fetchImpl = async () => new Response(null, { status: 302, headers: { location: '/again' } });
    await expect(fetchValidatedImage('https://example.com/a.png', { fetchImpl: fetchImpl as typeof fetch, resolver: publicDns, maxBytes: 100, maxRedirects: 2 }))
      .rejects.toMatchObject({ code: 'TOO_MANY_REDIRECTS' });
  });

  test('streams and stops an oversized response without Content-Length', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new Uint8Array(8)); controller.enqueue(new Uint8Array(8)); controller.close(); },
    });
    const fetchImpl = async () => new Response(stream, { headers: { 'content-type': 'image/png' } });
    await expect(fetchValidatedImage('https://example.com/a.png', { fetchImpl: fetchImpl as typeof fetch, resolver: publicDns, maxBytes: 10 }))
      .rejects.toMatchObject({ code: 'TOO_LARGE' });
  });

  test('rejects a MIME/header mismatch', async () => {
    const fetchImpl = async () => imageResponse(PNG, 'image/jpeg');
    await expect(fetchValidatedImage('https://example.com/a.jpg', { fetchImpl: fetchImpl as typeof fetch, resolver: publicDns, maxBytes: 100 }))
      .rejects.toMatchObject({ code: 'TYPE_MISMATCH' });
  });

  test('rejects SVG declared as PNG', async () => {
    const fetchImpl = async () => imageResponse(Uint8Array.from(Buffer.from('<svg></svg>')), 'image/png');
    await expect(fetchValidatedImage('https://example.com/a.png', { fetchImpl: fetchImpl as typeof fetch, resolver: publicDns, maxBytes: 100 }))
      .rejects.toMatchObject({ code: 'TYPE_MISMATCH' });
  });

  test('returns a fixed timeout error', async () => {
    const fetchImpl = (_url: URL | RequestInfo, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('provider detail', 'AbortError')));
    });
    await expect(fetchValidatedImage('https://example.com/a.png', { fetchImpl: fetchImpl as typeof fetch, resolver: publicDns, maxBytes: 100, timeoutMs: 5 }))
      .rejects.toMatchObject({ code: 'TIMEOUT' });
  });

  for (const [type, bytes] of [['image/png', PNG], ['image/jpeg', JPEG], ['image/webp', WEBP]] as const) {
    test(`accepts valid ${type}`, async () => {
      const result = await fetchValidatedImage(`https://example.com/a.${type.split('/')[1]}`, {
        fetchImpl: (async () => imageResponse(bytes, type)) as typeof fetch,
        resolver: publicDns,
        maxBytes: 100,
      });
      expect(result.type).toBe(type);
      expect(result.bytes).toEqual(bytes);
    });
  }
});

test.describe('provider boundary', () => {
  test('warm-instance rate limit refuses the twenty-first upload', () => {
    const ip = `203.0.114.${Math.floor(Math.random() * 200) + 1}`;
    for (let i = 0; i < 20; i++) expect(checkUploadRateLimit(ip).allowed).toBe(true);
    const refused = checkUploadRateLimit(ip);
    expect(refused.allowed).toBe(false);
    expect(refused.retryAfter).toBeGreaterThan(0);
  });
  test('returns only the provider display URL on success', async () => {
    const fetchImpl = async () => new Response(JSON.stringify({ success: true, data: { display_url: 'https://i.ibb.co/example/image.png', delete_url: 'secret' } }), { status: 200 });
    await expect(uploadImageToProvider(PNG, 'image/png', 'not-logged', fetchImpl as typeof fetch))
      .resolves.toBe('https://i.ibb.co/example/image.png');
  });

  test('sanitizes provider errors', async () => {
    const fetchImpl = async () => new Response('provider secret detail', { status: 400 });
    await expect(uploadImageToProvider(PNG, 'image/png', 'not-logged', fetchImpl as typeof fetch))
      .rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });
  });
});
