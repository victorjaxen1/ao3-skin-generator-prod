/**
 * A website's address → the handful of values a skin can carry.
 *
 * Magic Picker Phase C2 (`docs/MAGIC-PICKER-IMPLEMENTATION.md` §6b). The first
 * endpoint in this product that fetches **non-image** content from an arbitrary
 * host, which is why it is the one with a security note attached to it.
 *
 * The shape is copied from `/api/image-proxy` on purpose — same origin check,
 * same per-IP window, same "never leak the upstream error" mapping — and the
 * host validation, the manual redirect loop and the byte cap all live in
 * `lib/server/siteFetch.ts` on top of the reviewed helpers in `imageSecurity.ts`.
 *
 * **The rule that makes this narrow rather than general: the fetched body is
 * never returned.** What goes back is a fixed set of extracted values — hex
 * strings, two font declarations, a number, an image address. There is no
 * parameter, and no code path, that echoes the page. Returning the HTML would
 * make this an open relay for reading any page our server can reach, from our
 * IP, and no amount of host validation would fix that.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { RemoteImageError } from '../../lib/server/imageSecurity';
import { fetchSiteStyle } from '../../lib/server/siteFetch';

export const config = { api: { bodyParser: { sizeLimit: '8kb' } } };

const WINDOW_MS = 60_000;
// Lower than the image proxy's 60: that one serves an export fetching many
// images at once, this one is a person pasting a link.
const MAX_PER_WINDOW = 20;
const hits = new Map<string, number[]>();

const SAFE_ERRORS: Record<string, string> = {
  INVALID_URL: 'That does not look like a web address.',
  HTTPS_REQUIRED: 'Only https:// addresses are supported.',
  PORT_NOT_ALLOWED: 'Addresses using custom ports are not supported.',
  PRIVATE_ADDRESS: 'Private or internal addresses are not allowed.',
  UNREACHABLE: 'Could not reach that site.',
  TIMEOUT: 'That site took too long to respond.',
  BAD_REDIRECT: 'That site returned an invalid redirect.',
  TOO_MANY_REDIRECTS: 'That address redirects too many times.',
  HOST_BLOCKED: 'That site blocks other sites from reading it.',
  UPSTREAM_ERROR: 'That site could not serve the page.',
  TOO_LARGE: 'That page is too large to read.',
  EMPTY_RESPONSE: 'That site returned an empty page.',
  UNSUPPORTED_TYPE: 'That address is not a web page.',
};

function header(req: NextApiRequest, name: string): string {
  const value = req.headers[name];
  return (Array.isArray(value) ? value[0] : value || '').trim();
}

function clientIp(req: NextApiRequest): string {
  const netlify = header(req, 'x-nf-client-connection-ip');
  if (netlify) return netlify;
  const forwarded = header(req, 'x-forwarded-for').split(',').map(value => value.trim()).filter(Boolean);
  return forwarded[forwarded.length - 1] || req.socket?.remoteAddress || 'unknown';
}

function rateLimit(ip: string): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter(time => time > now - WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(ip, recent);
    return { allowed: false, retryAfter: Math.ceil((recent[0] + WINDOW_MS - now) / 1000) };
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5_000) hits.clear();
  return { allowed: true, retryAfter: 0 };
}

function isForeignOrigin(req: NextApiRequest): boolean {
  const origin = header(req, 'origin');
  if (!origin) return false;
  const host = header(req, 'x-forwarded-host') || header(req, 'host');
  if (!host) return true;
  try { return new URL(origin).host !== host; } catch { return true; }
}

function safeParse(raw: string): { url?: string } | null {
  try { return JSON.parse(raw); } catch { return null; }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  if (isForeignOrigin(req)) {
    return res.status(403).json({ error: 'Cross-site requests are not allowed.' });
  }

  const limit = rateLimit(clientIp(req));
  if (!limit.allowed) {
    res.setHeader('Retry-After', String(limit.retryAfter));
    return res.status(429).json({ error: 'Too many sites at once. Wait a moment and try again.' });
  }

  const body = typeof req.body === 'string' ? safeParse(req.body) : req.body;
  if (!body?.url || typeof body.url !== 'string' || body.url.length > 2000) {
    return res.status(400).json({ error: 'Missing required parameter: url.' });
  }

  try {
    const result = await fetchSiteStyle(body.url);
    // Field by field, deliberately. A spread of `result.style` would carry
    // whatever a future extractor adds to that object out to the client, and the
    // whole safety argument for this endpoint is that its output is a fixed,
    // enumerated set of values rather than "whatever we parsed".
    return res.status(200).json({
      url: result.url,
      stylesheetsRead: result.stylesheetsRead,
      colors: result.style.colors,
      headingFont: result.style.headingFont,
      bodyFont: result.style.bodyFont,
      radius: result.style.radius,
      ogImage: result.style.ogImage,
      themeColor: result.style.themeColor,
      polarity: result.style.polarity,
      // `title` is parsed but deliberately **not** returned. Everything above is
      // a measurement — a colour, a font name, a number, an address the client
      // then re-validates. A title is the page's own *content*, and nothing in
      // the product consumes it. Sending it would be the first crack in the one
      // sentence that makes this endpoint narrow.
    });
  } catch (error) {
    const problem = error instanceof RemoteImageError ? error : new RemoteImageError('UNREACHABLE', 502);
    return res.status(problem.status).json({ error: SAFE_ERRORS[problem.code] || SAFE_ERRORS.UNREACHABLE });
  }
}
