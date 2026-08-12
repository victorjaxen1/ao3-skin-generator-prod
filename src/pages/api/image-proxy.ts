/** Export-time remote-image proxy with redirect, DNS, byte, type, and timeout validation. */
import type { NextApiRequest, NextApiResponse } from 'next';
import { fetchValidatedImage, RemoteImageError } from '../../lib/server/imageSecurity';

export const config = { api: { bodyParser: { sizeLimit: '8kb' } } };

const MAX_BYTES = 8 * 1024 * 1024;
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 60;
const hits = new Map<string, number[]>();

const SAFE_ERRORS: Record<string, string> = {
  INVALID_URL: 'Invalid image address.',
  HTTPS_REQUIRED: 'Only HTTPS image addresses are supported.',
  PORT_NOT_ALLOWED: 'Image addresses using custom ports are not supported.',
  PRIVATE_ADDRESS: 'Private or internal addresses are not allowed.',
  UNREACHABLE: 'Could not reach that image host.',
  TIMEOUT: 'That image host took too long to respond.',
  BAD_REDIRECT: 'That image host returned an invalid redirect.',
  TOO_MANY_REDIRECTS: 'That image address redirects too many times.',
  HOST_BLOCKED: 'That site blocks other sites from loading its images.',
  UPSTREAM_ERROR: 'The image host could not serve that image.',
  TOO_LARGE: 'That image is larger than 8 MB.',
  EMPTY_RESPONSE: 'That image host returned an empty response.',
  UNSUPPORTED_TYPE: 'SVG images are not supported.',
  TYPE_MISMATCH: 'That address did not return a supported PNG, JPEG, WebP, or GIF image.',
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
  if (isForeignOrigin(req)) return res.status(403).json({ error: 'Cross-site requests are not allowed.' });

  const limit = rateLimit(clientIp(req));
  if (!limit.allowed) {
    res.setHeader('Retry-After', String(limit.retryAfter));
    return res.status(429).json({ error: 'Too many images at once. Wait a moment and export again.' });
  }

  const body = typeof req.body === 'string' ? safeParse(req.body) : req.body;
  if (!body?.url || typeof body.url !== 'string') return res.status(400).json({ error: 'Missing required parameter: url.' });

  try {
    const result = await fetchValidatedImage(body.url, {
      maxBytes: MAX_BYTES,
      maxRedirects: 4,
      timeoutMs: 10_000,
      headers: {
        'User-Agent': 'AO3-SkinGen-Image-Proxy/1.0',
        Accept: 'image/png,image/jpeg,image/webp,image/gif',
      },
    });
    return res.status(200).json({
      dataUri: `data:${result.type};base64,${Buffer.from(result.bytes).toString('base64')}`,
      mimeType: result.type,
    });
  } catch (error) {
    const problem = error instanceof RemoteImageError ? error : new RemoteImageError('UNREACHABLE', 502);
    return res.status(problem.status).json({ error: SAFE_ERRORS[problem.code] || SAFE_ERRORS.UNREACHABLE });
  }
}
