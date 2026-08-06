/**
 * Client for the image proxy (src/pages/api/image-proxy.ts).
 *
 * Used only by the export pipeline. Remote images display fine in the preview,
 * but html2canvas requests them with crossOrigin='anonymous', so any host that
 * doesn't send Access-Control-Allow-Origin fails to load and leaves a hole in
 * the exported PNG with no warning. Swapping those images for same-origin
 * `data:` URIs just before rasterising fixes that.
 *
 * Deliberately NOT used at paste time. Projects are capped at 500 KB in
 * localStorage and base64 inflates by ~33%, so storing data URIs would blow
 * the cap on a single photo and lose the user's work. The project keeps the
 * remote URL; the conversion is transient.
 */

const PROXY_ENDPOINT = '/api/image-proxy';

// One export renders several chunks, and an avatar repeats on every message.
// Fetching it once per render would be slow and rude to the upstream host.
const cache = new Map<string, Promise<string>>();

/** True for an address html2canvas cannot rasterise without CORS cooperation. */
export function needsProxy(src: string): boolean {
  if (!src) return false;
  if (src.startsWith('data:') || src.startsWith('blob:')) return false;
  try {
    return new URL(src, window.location.href).origin !== window.location.origin;
  } catch {
    return false;
  }
}

/** Fetch a remote image through the proxy and return it as a `data:` URI. */
export async function proxyImageToDataUri(url: string): Promise<string> {
  const cached = cache.get(url);
  if (cached) return cached;

  const request = (async () => {
    const res = await fetch(PROXY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body?.dataUri) {
      throw new Error(body?.error || `Image proxy failed (HTTP ${res.status})`);
    }
    return body.dataUri as string;
  })();

  cache.set(url, request);
  // A failure shouldn't be cached — the next export should try again.
  request.catch(() => cache.delete(url));
  return request;
}

export interface FailedImage {
  url: string;
  /** Server-supplied, safe to show to the user. */
  reason: string;
}

/**
 * Replace every cross-origin <img> in `root` with a data URI, in place.
 *
 * Best-effort: an image the proxy can't fetch keeps its original src and will
 * be missing from the export. Returns what failed and why, so the caller can
 * say something true — "that site blocks downloads" and "you're going too fast"
 * need different advice.
 */
export async function inlineCrossOriginImages(root: HTMLElement): Promise<FailedImage[]> {
  const images = Array.from(root.querySelectorAll('img')).filter(img =>
    needsProxy(img.getAttribute('src') || '')
  );
  if (images.length === 0) return [];

  const failed: FailedImage[] = [];

  await Promise.all(
    images.map(async img => {
      const src = img.getAttribute('src')!;
      try {
        img.setAttribute('src', await proxyImageToDataUri(src));
      } catch (err) {
        failed.push({
          url: src,
          reason: err instanceof Error ? err.message : 'Could not load that image.',
        });
      }
    })
  );

  return failed;
}
