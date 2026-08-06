/**
 * Image proxy — returns a base64 `data:` URI for a remote image.
 *
 * Why a data URI rather than a proxied stream: a `data:` URI is same-origin by
 * definition. It cannot taint a canvas, it needs no CORS headers on the
 * upstream host, and because the fetch happens server-side it defeats hotlink
 * blocking. One mechanism covers loading, CORS and hotlinking at once.
 *
 * This exists for export. In the preview the browser loads remote images
 * directly and they display fine; it is html2canvas that needs CORS, and a
 * host without the headers silently drops the image from the PNG. The export
 * pipeline calls this just before rasterising — see ExportPanel.renderChunk.
 *
 * Adapted from the WorldKonstruct image-proxy Edge Function. The security
 * controls come from there; Pinterest resolution and the export-time trigger
 * are specific to this app. It lives as a Next API route rather than a
 * standalone Netlify function so it also runs under `next dev`/`next start`
 * and can be tested locally — the Netlify Next plugin deploys it as a
 * serverless function either way.
 */

import type { NextApiRequest, NextApiResponse } from 'next';

// The body is a single URL. Anything larger is not a legitimate call.
export const config = { api: { bodyParser: { sizeLimit: '8kb' } } };

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

// SSRF protection: never let a user-supplied URL reach our own network.
const PRIVATE_HOST_PATTERNS: RegExp[] = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^::1$/,
  /^fc[0-9a-f]{2}:/i, // ULA IPv6
  /^fd[0-9a-f]{2}:/i,
  /^169\.254\./, // link-local
  /^0\./,
  /^metadata\.google\.internal$/i,
];

export function isPrivateHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '');
  return PRIVATE_HOST_PATTERNS.some(p => p.test(host));
}

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

// ─── Abuse limits ────────────────────────────────────────────────────────────
//
// Without these the endpoint is an open image proxy: anyone could point it at
// arbitrary hosts and burn our bandwidth and function minutes. Two cheap
// defences, neither of which gets in a real user's way.
//
// Caveat, stated plainly: this counter lives in the memory of one warm
// serverless instance. It throttles a single caller hammering one instance —
// it is not a distributed quota, and it resets on cold start. If abuse ever
// becomes a real problem, this needs a shared store (Netlify Blobs, Upstash).

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 60; // An export needs one call per distinct image.
const MAX_TRACKED_IPS = 5_000; // Bound the map so it can't grow without limit.

const hits = new Map<string, number[]>();

function rateLimit(ip: string): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;

  if (hits.size > MAX_TRACKED_IPS) {
    for (const [key, times] of hits) {
      if (times[times.length - 1] < cutoff) hits.delete(key);
    }
    // Still oversized: the map is being flooded with fresh IPs, so drop it
    // wholesale rather than let it grow unbounded.
    if (hits.size > MAX_TRACKED_IPS) hits.clear();
  }

  const recent = (hits.get(ip) || []).filter(t => t > cutoff);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(ip, recent);
    return { allowed: false, retryAfter: Math.ceil((recent[0] + WINDOW_MS - now) / 1000) };
  }

  recent.push(now);
  hits.set(ip, recent);
  return { allowed: true, retryAfter: 0 };
}

function clientIp(req: NextApiRequest): string {
  // Netlify sets x-nf-client-connection-ip itself, so it can't be spoofed by
  // the caller. Prefer it. Falling back to X-Forwarded-For, take the LAST
  // entry — the one the nearest proxy appended. The first entry is whatever
  // the client sent, which would let an abuser rotate past the limit.
  const nf = req.headers['x-nf-client-connection-ip'];
  const direct = Array.isArray(nf) ? nf[0] : nf;
  if (direct) return direct.trim();

  const forwarded = req.headers['x-forwarded-for'];
  const chain = (Array.isArray(forwarded) ? forwarded.join(',') : forwarded || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  return chain[chain.length - 1] || req.socket?.remoteAddress || 'unknown';
}

/**
 * Reject calls a browser made from another site.
 *
 * Browsers attach Origin to every cross-origin POST, so this stops the endpoint
 * being embedded in someone else's page. A non-browser client can forge the
 * header — the rate limit is what covers that case. A missing Origin is allowed
 * rather than blocked, so a browser that omits it can't break exports.
 */
function isForeignOrigin(req: NextApiRequest): boolean {
  const origin = req.headers.origin;
  if (!origin) return false;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (!host) return false;
  try {
    return new URL(origin).host !== (Array.isArray(host) ? host[0] : host);
  } catch {
    return true;
  }
}

/**
 * A pinterest.com/pin/* URL is an HTML page, not an image. The real image is
 * in its og:image meta tag — and unlike the page, i.pinimg.com serves the
 * bytes happily to a non-browser client.
 */
async function resolvePinterestPin(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html' },
    redirect: 'follow',
  });
  if (!res.ok) return url;
  const html = await res.text();
  const match =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  return match ? match[1].replace(/&amp;/g, '&') : url;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (isForeignOrigin(req)) {
    return res.status(403).json({ error: 'Cross-site requests are not allowed' });
  }

  const limit = rateLimit(clientIp(req));
  if (!limit.allowed) {
    res.setHeader('Retry-After', String(limit.retryAfter));
    return res.status(429).json({
      error: 'Too many images at once. Wait a moment and export again.',
    });
  }

  const body = typeof req.body === 'string' ? safeParse(req.body) : req.body;
  const url = body?.url;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing required parameter: url' });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  if (parsed.protocol !== 'https:') {
    return res.status(400).json({ error: 'Only HTTPS image addresses are supported' });
  }

  if (isPrivateHost(parsed.hostname)) {
    return res.status(403).json({ error: 'Private or internal addresses are not allowed' });
  }

  let target = url;
  if (/(^|\.)pinterest\.[a-z.]+$/i.test(parsed.hostname) && /^\/pin\//.test(parsed.pathname)) {
    try {
      const resolved = new URL(await resolvePinterestPin(url));
      if (resolved.protocol === 'https:' && !isPrivateHost(resolved.hostname)) {
        target = resolved.toString();
      }
    } catch {
      // Fall through and try the original URL.
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      headers: {
        // Some CDNs refuse anything that doesn't look like a browser.
        'User-Agent': BROWSER_UA,
        Accept: 'image/avif,image/webp,image/*,*/*;q=0.8',
      },
      redirect: 'follow',
    });
  } catch (err) {
    return res.status(502).json({ error: `Could not reach that image: ${(err as Error).message}` });
  }

  if (!upstream.ok) {
    return res.status(502).json({
      error:
        upstream.status === 403
          ? 'That site blocks other sites from loading its images.'
          : `The image host returned HTTP ${upstream.status}.`,
    });
  }

  const mimeType = (upstream.headers.get('Content-Type') || 'image/jpeg').split(';')[0].trim();
  if (!/^image\//i.test(mimeType)) {
    return res.status(422).json({ error: `That address is not an image (${mimeType}).` });
  }

  if (Number(upstream.headers.get('Content-Length') || 0) > MAX_BYTES) {
    return res.status(413).json({ error: 'That image is larger than 8 MB.' });
  }

  const buffer = Buffer.from(await upstream.arrayBuffer());
  if (buffer.byteLength > MAX_BYTES) {
    return res.status(413).json({ error: 'That image is larger than 8 MB.' });
  }

  return res.status(200).json({
    dataUri: `data:${mimeType};base64,${buffer.toString('base64')}`,
    mimeType,
  });
}

function safeParse(raw: string): { url?: string } | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
