import type { NextApiRequest, NextApiResponse } from 'next';
import { detectImageType, AllowedImageType } from '../../lib/server/imageSecurity';

export const config = { api: { bodyParser: false } };

const SELECTED_FILE_MAX_BYTES = 8 * 1024 * 1024;
const RENDERED_SCENE_MAX_BYTES = 12 * 1024 * 1024;
const WINDOW_MS = 60_000;
const MAX_UPLOADS_PER_WINDOW = 20;
const MAX_DAILY_UPLOADS = Number(process.env.IMAGE_UPLOAD_DAILY_LIMIT || 500);
const MAX_DAILY_BYTES = Number(process.env.IMAGE_UPLOAD_DAILY_BYTES || 1024 * 1024 * 1024);

type UploadKind = 'selected-file' | 'rendered-scene';
type UploadErrorCode =
  | 'METHOD_NOT_ALLOWED' | 'ORIGIN_NOT_ALLOWED' | 'RATE_LIMITED' | 'BUDGET_EXHAUSTED'
  | 'UPLOAD_DISABLED' | 'NOT_CONFIGURED' | 'INVALID_KIND' | 'INVALID_TYPE'
  | 'TYPE_MISMATCH' | 'TOO_LARGE' | 'EMPTY_UPLOAD' | 'PROVIDER_TIMEOUT'
  | 'PROVIDER_UNAVAILABLE';

const SAFE_MESSAGES: Record<UploadErrorCode, string> = {
  METHOD_NOT_ALLOWED: 'Method not allowed.',
  ORIGIN_NOT_ALLOWED: 'Cross-site uploads are not allowed.',
  RATE_LIMITED: 'Too many uploads. Wait a moment and try again.',
  BUDGET_EXHAUSTED: 'Image hosting is temporarily unavailable for today.',
  UPLOAD_DISABLED: 'Image hosting is temporarily disabled.',
  NOT_CONFIGURED: 'Image hosting is not configured.',
  INVALID_KIND: 'This upload request is invalid.',
  INVALID_TYPE: 'Choose a PNG, JPEG, WebP, or GIF image.',
  TYPE_MISMATCH: 'The file contents do not match its image type.',
  TOO_LARGE: 'That image is too large to upload.',
  EMPTY_UPLOAD: 'Choose an image to upload.',
  PROVIDER_TIMEOUT: 'The image host took too long to respond. Try again.',
  PROVIDER_UNAVAILABLE: 'The image host could not accept this upload. Try again later.',
};

function fail(res: NextApiResponse, status: number, code: UploadErrorCode, retryAfter?: number) {
  if (retryAfter) res.setHeader('Retry-After', String(retryAfter));
  return res.status(status).json({ ok: false, error: { code, message: SAFE_MESSAGES[code] } });
}

function header(req: NextApiRequest, name: string): string {
  const value = req.headers[name];
  return (Array.isArray(value) ? value[0] : value || '').trim();
}

export function isAllowedUploadOrigin(req: NextApiRequest): boolean {
  const origin = header(req, 'origin');
  if (!origin) return false;
  const host = header(req, 'x-forwarded-host') || header(req, 'host');
  const protocol = header(req, 'x-forwarded-proto') || (process.env.NODE_ENV === 'production' ? 'https' : 'http');
  const configured = (process.env.IMAGE_UPLOAD_ALLOWED_ORIGINS || '')
    .split(',').map(value => value.trim()).filter(Boolean);
  const known = new Set([
    host ? `${protocol}://${host}` : '',
    'https://ao3skingen.netlify.app',
    'https://app.ao3skingen.wordfokus.com',
    ...(process.env.NODE_ENV !== 'production' ? ['http://localhost:3000', 'http://127.0.0.1:3000'] : []),
    ...configured,
  ].filter(Boolean));
  try { return known.has(new URL(origin).origin); } catch { return false; }
}

const recentUploads = new Map<string, number[]>();
let daily = { date: '', uploads: 0, bytes: 0 };

function clientIp(req: NextApiRequest): string {
  return header(req, 'x-nf-client-connection-ip') || req.socket?.remoteAddress || 'unknown';
}

export function checkUploadRateLimit(ip: string): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const recent = (recentUploads.get(ip) || []).filter(time => time > now - WINDOW_MS);
  if (recent.length >= MAX_UPLOADS_PER_WINDOW) {
    recentUploads.set(ip, recent);
    return { allowed: false, retryAfter: Math.ceil((recent[0] + WINDOW_MS - now) / 1000) };
  }
  recent.push(now);
  recentUploads.set(ip, recent);
  if (recentUploads.size > 5_000) recentUploads.clear();
  return { allowed: true, retryAfter: 0 };
}

function hasDailyBudget(bytes: number): boolean {
  const date = new Date().toISOString().slice(0, 10);
  if (daily.date !== date) daily = { date, uploads: 0, bytes: 0 };
  return daily.uploads < MAX_DAILY_UPLOADS && daily.bytes + bytes <= MAX_DAILY_BYTES;
}

function recordDailyUsage(bytes: number) {
  daily.uploads += 1;
  daily.bytes += bytes;
}

export async function readUpload(req: NextApiRequest, maxBytes: number): Promise<Buffer> {
  const declared = Number(header(req, 'content-length') || 0);
  if (declared > maxBytes) throw new UploadRouteError('TOO_LARGE');
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += bytes.length;
    if (total > maxBytes) throw new UploadRouteError('TOO_LARGE');
    chunks.push(bytes);
  }
  if (total === 0) throw new UploadRouteError('EMPTY_UPLOAD');
  return Buffer.concat(chunks, total);
}

class UploadRouteError extends Error {
  constructor(public code: UploadErrorCode) { super(code); }
}

export async function uploadImageToProvider(
  bytes: Uint8Array,
  type: AllowedImageType,
  apiKey: string,
  fetchImpl: typeof fetch = fetch
): Promise<string> {
  const attempts = 2;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const form = new FormData();
      form.append('key', apiKey);
      form.append('image', new Blob([bytes], { type }), `upload.${type.split('/')[1]}`);
      const response = await fetchImpl('https://api.imgbb.com/1/upload', {
        method: 'POST', body: form, signal: controller.signal,
      });
      if (!response.ok) {
        if (attempt === 0 && (response.status === 429 || response.status >= 500)) continue;
        throw new UploadRouteError('PROVIDER_UNAVAILABLE');
      }
      const body = await response.json().catch(() => null) as { success?: boolean; data?: { display_url?: unknown } } | null;
      const url = body?.success && typeof body.data?.display_url === 'string' ? body.data.display_url : '';
      if (!/^https:\/\//i.test(url)) throw new UploadRouteError('PROVIDER_UNAVAILABLE');
      return url;
    } catch (error) {
      if (error instanceof UploadRouteError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        if (attempt === 0) continue;
        throw new UploadRouteError('PROVIDER_TIMEOUT');
      }
      if (attempt === 0) continue;
      throw new UploadRouteError('PROVIDER_UNAVAILABLE');
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new UploadRouteError('PROVIDER_UNAVAILABLE');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return fail(res, 405, 'METHOD_NOT_ALLOWED'); }
  if (!isAllowedUploadOrigin(req)) return fail(res, 403, 'ORIGIN_NOT_ALLOWED');
  if (process.env.IMAGE_UPLOADS_ENABLED === 'false') return fail(res, 503, 'UPLOAD_DISABLED');
  const apiKey = process.env.IMGBB_API_KEY;
  if (!apiKey) return fail(res, 503, 'NOT_CONFIGURED');

  const rate = checkUploadRateLimit(clientIp(req));
  if (!rate.allowed) return fail(res, 429, 'RATE_LIMITED', rate.retryAfter);

  const kind = header(req, 'x-upload-kind') as UploadKind;
  if (kind !== 'selected-file' && kind !== 'rendered-scene') return fail(res, 400, 'INVALID_KIND');
  const maxBytes = kind === 'selected-file' ? SELECTED_FILE_MAX_BYTES : RENDERED_SCENE_MAX_BYTES;
  const declaredType = header(req, 'content-type').split(';')[0].toLowerCase();
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(declaredType)) {
    return fail(res, 415, 'INVALID_TYPE');
  }

  try {
    const bytes = await readUpload(req, maxBytes);
    const detected = detectImageType(bytes);
    if (!detected || detected !== declaredType) return fail(res, 422, 'TYPE_MISMATCH');
    if (!hasDailyBudget(bytes.length)) return fail(res, 503, 'BUDGET_EXHAUSTED');
    const url = await uploadImageToProvider(bytes, detected, apiKey);
    recordDailyUsage(bytes.length);
    return res.status(200).json({ ok: true, provider: 'imgbb', url });
  } catch (error) {
    const code = error instanceof UploadRouteError ? error.code : 'PROVIDER_UNAVAILABLE';
    const status = code === 'TOO_LARGE' ? 413 : code === 'EMPTY_UPLOAD' ? 400 : code === 'PROVIDER_TIMEOUT' ? 504 : 502;
    return fail(res, status, code);
  }
}
