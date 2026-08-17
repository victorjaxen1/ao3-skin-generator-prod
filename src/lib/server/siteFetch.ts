/**
 * Fetching a *page*, safely — the one genuinely new attack surface in the Magic
 * Picker (`docs/MAGIC-PICKER-IMPLEMENTATION.md` §6b).
 *
 * Everything else in Phase C is string handling. This file takes a URL a
 * stranger typed and asks our server to open it, which is the shape of every
 * SSRF write-up ever published, so it is deliberately built out of parts that
 * already exist and have already been reviewed:
 *
 *  - **`validateRemoteImageUrl` does the host check.** HTTPS only, no
 *    credentials, no port but 443, `localhost` and the GCE metadata name by
 *    name, and — the part people get wrong — a DNS resolution followed by an
 *    IP-range check on *every* address it returns. Do not write a second one.
 *  - **The redirect loop is manual and re-validates each hop.** A redirect to
 *    `169.254.169.254` is the classic bypass and `fetch`'s default
 *    `redirect: 'follow'` is how it lands.
 *  - **`readResponseBytes` caps the body** before it is a string.
 *
 * What is new here, and it is the rule that keeps this from being a general
 * purpose proxy: **the fetched body never reaches the client.** `/api/site-palette`
 * returns extracted values — hex strings, a font declaration, a number — and
 * nothing else. An endpoint that returned the HTML would be an open relay for
 * reading any page our server can reach, with our IP and our egress.
 */

import {
  DnsResolver,
  RemoteImageError,
  readResponseBytes,
  validateRemoteImageUrl,
} from './imageSecurity';
import {
  SiteStyle,
  absoluteImageUrl,
  collectSiteStyle,
  readStylesheetLinks,
} from '../siteSkin/siteStyle';

export type DocumentKind = 'html' | 'css';

const ACCEPTED: Record<DocumentKind, readonly string[]> = {
  html: ['text/html', 'application/xhtml+xml'],
  css: ['text/css'],
};

export interface FetchTextOptions {
  kind: DocumentKind;
  maxBytes: number;
  maxRedirects?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  resolver?: DnsResolver;
}

export interface FetchedText {
  text: string;
  /** After redirects — what relative URLs in the document resolve against. */
  url: string;
}

/**
 * The image fetcher's twin, for text.
 *
 * Not a generalisation of `fetchValidatedImage`: that one ends in a magic-bytes
 * check, which is the whole of its type safety and has no analogue here. Text
 * gets a `content-type` allowlist instead, which is weaker — hence the rule
 * above about never returning the body.
 */
export async function fetchValidatedText(
  rawUrl: string,
  options: FetchTextOptions
): Promise<FetchedText> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const maxRedirects = options.maxRedirects ?? 4;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 8_000);
  let current = rawUrl;

  try {
    for (let redirects = 0; redirects <= maxRedirects; redirects++) {
      const url = await validateRemoteImageUrl(current, options.resolver);
      let response: Response;
      try {
        response = await fetchImpl(url, {
          headers: {
            'User-Agent': 'AO3-SkinGen-Site-Reader/1.0',
            Accept: ACCEPTED[options.kind].join(','),
          },
          redirect: 'manual',
          signal: controller.signal,
        });
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new RemoteImageError('TIMEOUT', 504);
        }
        throw new RemoteImageError('UNREACHABLE', 502);
      }

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) throw new RemoteImageError('BAD_REDIRECT', 502);
        if (redirects === maxRedirects) throw new RemoteImageError('TOO_MANY_REDIRECTS', 502);
        current = new URL(location, url).toString();
        continue;
      }
      if (!response.ok) {
        throw new RemoteImageError(response.status === 403 ? 'HOST_BLOCKED' : 'UPSTREAM_ERROR', 502);
      }

      const declared = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      if (!ACCEPTED[options.kind].includes(declared)) {
        throw new RemoteImageError('UNSUPPORTED_TYPE', 422);
      }

      const bytes = await readResponseBytes(response, options.maxBytes);
      if (bytes.length === 0) throw new RemoteImageError('EMPTY_RESPONSE', 502);
      return { text: new TextDecoder('utf-8').decode(bytes), url: url.toString() };
    }
    throw new RemoteImageError('TOO_MANY_REDIRECTS', 502);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Enough to catch a site's own theme, few enough to stay inside a function
 * timeout — and few enough to bound what a hostile page can make us do. Every
 * `<link rel=stylesheet>` on the fetched page is an address *that page* chose,
 * so this number is also the amplification factor: one request in, four out,
 * each capped at a megabyte and each re-validated against the same host rules.
 */
const MAX_STYLESHEETS = 3;
const HTML_BYTES = 1024 * 1024;
const CSS_BYTES = 1024 * 1024;

export interface SiteStyleResult {
  style: SiteStyle;
  /** After redirects, so the client can say which page it actually read. */
  url: string;
  /** How many linked stylesheets were readable. Low is normal, and fine. */
  stylesheetsRead: number;
}

/**
 * A URL → the signals, and never the page.
 *
 * A stylesheet that fails is skipped rather than fatal: sites put their CSS
 * behind CDNs that rate-limit, block unknown agents or serve
 * `application/octet-stream`, and the meta tags alone are still a usable result.
 * Only the page itself failing is an error worth showing the user.
 */
export async function fetchSiteStyle(
  rawUrl: string,
  options: { fetchImpl?: typeof fetch; resolver?: DnsResolver; timeoutMs?: number } = {}
): Promise<SiteStyleResult> {
  const page = await fetchValidatedText(rawUrl, {
    kind: 'html',
    maxBytes: HTML_BYTES,
    timeoutMs: options.timeoutMs,
    fetchImpl: options.fetchImpl,
    resolver: options.resolver,
  });

  const links = readStylesheetLinks(page.text, page.url).slice(0, MAX_STYLESHEETS);
  const sheets: string[] = [];
  for (const link of links) {
    try {
      const sheet = await fetchValidatedText(link, {
        kind: 'css',
        maxBytes: CSS_BYTES,
        timeoutMs: options.timeoutMs,
        fetchImpl: options.fetchImpl,
        resolver: options.resolver,
      });
      sheets.push(sheet.text);
    } catch {
      /* see the comment above: a missing stylesheet is a smaller result, not a failure */
    }
  }

  const style = collectSiteStyle(page.text, sheets);
  return {
    style: { ...style, ogImage: absoluteImageUrl(style.ogImage, page.url) },
    url: page.url,
    stylesheetsRead: sheets.length,
  };
}
