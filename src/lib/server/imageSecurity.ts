import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export type AllowedImageType = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';

const SIGNATURES: Array<{ type: AllowedImageType; matches: (bytes: Uint8Array) => boolean }> = [
  { type: 'image/png', matches: b => b.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => b[i] === v) },
  { type: 'image/jpeg', matches: b => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: 'image/gif', matches: b => b.length >= 6 && (ascii(b, 0, 6) === 'GIF87a' || ascii(b, 0, 6) === 'GIF89a') },
  { type: 'image/webp', matches: b => b.length >= 12 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP' },
];

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.slice(start, end));
}

export function detectImageType(bytes: Uint8Array): AllowedImageType | null {
  return SIGNATURES.find(signature => signature.matches(bytes))?.type ?? null;
}

function ipv4Number(address: string): number | null {
  const parts = address.split('.');
  if (parts.length !== 4) return null;
  const numbers = parts.map(Number);
  if (numbers.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return null;
  return numbers.reduce((value, part) => value * 256 + part, 0) >>> 0;
}

function inIpv4Cidr(address: number, base: string, prefix: number): boolean {
  const baseNumber = ipv4Number(base)!;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (address & mask) === (baseNumber & mask);
}

const BLOCKED_IPV4: Array<[string, number]> = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24],
  ['224.0.0.0', 4], ['240.0.0.0', 4],
];

function expandIpv6(address: string): number[] | null {
  const zoneFree = address.toLowerCase().split('%')[0];
  const mappedDotted = zoneFree.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  let normalized = zoneFree;
  if (mappedDotted) {
    const value = ipv4Number(mappedDotted[2]);
    if (value === null) return null;
    normalized = `${mappedDotted[1]}${(value >>> 16).toString(16)}:${(value & 0xffff).toString(16)}`;
  }
  const halves = normalized.split('::');
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves[1] ? halves[1].split(':') : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || missing < 0) return null;
  const groups = [...left, ...Array(missing).fill('0'), ...right].map(group => parseInt(group || '0', 16));
  return groups.length === 8 && groups.every(group => Number.isInteger(group) && group >= 0 && group <= 0xffff)
    ? groups
    : null;
}

export function isBlockedIp(address: string): boolean {
  const version = isIP(address.split('%')[0]);
  if (version === 4) {
    const value = ipv4Number(address)!;
    return BLOCKED_IPV4.some(([base, prefix]) => inIpv4Cidr(value, base, prefix));
  }
  if (version !== 6) return true;
  const groups = expandIpv6(address);
  if (!groups) return true;

  // IPv4-mapped IPv6, including hexadecimal forms such as ::ffff:7f00:1.
  if (groups.slice(0, 5).every(group => group === 0) && groups[5] === 0xffff) {
    const mapped = ((groups[6] << 16) | groups[7]) >>> 0;
    return BLOCKED_IPV4.some(([base, prefix]) => inIpv4Cidr(mapped, base, prefix));
  }

  const first = groups[0];
  return (
    groups.every(group => group === 0) || // unspecified
    groups.slice(0, 7).every(group => group === 0) && groups[7] === 1 || // loopback
    (first & 0xfe00) === 0xfc00 || // unique-local fc00::/7
    (first & 0xffc0) === 0xfe80 || // link-local fe80::/10
    (first & 0xff00) === 0xff00 || // multicast ff00::/8
    (groups[0] === 0x2001 && groups[1] === 0x0db8) // documentation
  );
}

export type DnsResolver = (hostname: string) => Promise<Array<{ address: string }>>;

const defaultResolver: DnsResolver = async hostname => lookup(hostname, { all: true, verbatim: true });

export async function validateRemoteImageUrl(raw: string, resolver: DnsResolver = defaultResolver): Promise<URL> {
  let url: URL;
  try { url = new URL(raw); } catch { throw new RemoteImageError('INVALID_URL', 400); }
  if (url.protocol !== 'https:') throw new RemoteImageError('HTTPS_REQUIRED', 400);
  if (url.username || url.password) throw new RemoteImageError('INVALID_URL', 400);
  if (url.port && url.port !== '443') throw new RemoteImageError('PORT_NOT_ALLOWED', 403);
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (/^(localhost|metadata\.google\.internal)$/i.test(hostname)) {
    throw new RemoteImageError('PRIVATE_ADDRESS', 403);
  }
  if (isIP(hostname) && isBlockedIp(hostname)) throw new RemoteImageError('PRIVATE_ADDRESS', 403);

  let addresses: Array<{ address: string }>;
  try { addresses = await resolver(hostname); } catch { throw new RemoteImageError('UNREACHABLE', 502); }
  if (addresses.length === 0 || addresses.some(item => isBlockedIp(item.address))) {
    throw new RemoteImageError('PRIVATE_ADDRESS', 403);
  }
  return url;
}

export class RemoteImageError extends Error {
  constructor(public code: string, public status: number) {
    super(code);
  }
}

export async function readResponseBytes(response: Response, maxBytes: number): Promise<Uint8Array> {
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > maxBytes) throw new RemoteImageError('TOO_LARGE', 413);
  if (!response.body) throw new RemoteImageError('EMPTY_RESPONSE', 502);

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new RemoteImageError('TOO_LARGE', 413);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

export interface SafeImageResult { bytes: Uint8Array; type: AllowedImageType }

export async function fetchValidatedImage(
  rawUrl: string,
  options: {
    fetchImpl?: typeof fetch;
    resolver?: DnsResolver;
    maxBytes: number;
    maxRedirects?: number;
    timeoutMs?: number;
    headers?: HeadersInit;
  }
): Promise<SafeImageResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const resolver = options.resolver ?? defaultResolver;
  const maxRedirects = options.maxRedirects ?? 4;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 10_000);
  let current = rawUrl;

  try {
    for (let redirects = 0; redirects <= maxRedirects; redirects++) {
      const url = await validateRemoteImageUrl(current, resolver);
      let response: Response;
      try {
        response = await fetchImpl(url, { headers: options.headers, redirect: 'manual', signal: controller.signal });
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') throw new RemoteImageError('TIMEOUT', 504);
        throw new RemoteImageError('UNREACHABLE', 502);
      }

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) throw new RemoteImageError('BAD_REDIRECT', 502);
        if (redirects === maxRedirects) throw new RemoteImageError('TOO_MANY_REDIRECTS', 502);
        current = new URL(location, url).toString();
        continue;
      }
      if (!response.ok) throw new RemoteImageError(response.status === 403 ? 'HOST_BLOCKED' : 'UPSTREAM_ERROR', 502);

      const declaredType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      if (declaredType === 'image/svg+xml') throw new RemoteImageError('UNSUPPORTED_TYPE', 422);
      const bytes = await readResponseBytes(response, options.maxBytes);
      const detected = detectImageType(bytes);
      if (!detected || detected !== declaredType) throw new RemoteImageError('TYPE_MISMATCH', 422);
      return { bytes, type: detected };
    }
    throw new RemoteImageError('TOO_MANY_REDIRECTS', 502);
  } finally {
    clearTimeout(timeout);
  }
}
