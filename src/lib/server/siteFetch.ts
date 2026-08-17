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
 *  - **`readTextBytes` caps the body** before it is a string. Text differs from
 *    an image in one way that matters: the cap *truncates* rather than refusing,
 *    because half a page still carries its meta tags — see the comment there.
 *
 * What is new here, and it is the rule that keeps this from being a general
 * purpose proxy: **the fetched body never reaches the client.** `/api/site-palette`
 * returns extracted values — hex strings, a font declaration, a number — and
 * nothing else. An endpoint that returned the HTML would be an open relay for
 * reading any page our server can reach, with our IP and our egress.
 */

import { DnsResolver, RemoteImageError, validateRemoteImageUrl } from './imageSecurity';
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

      const bytes = await readTextBytes(response, options.maxBytes);
      if (bytes.length === 0) throw new RemoteImageError('EMPTY_RESPONSE', 502);
      // `fatal: false` on purpose — the cap can land mid-character, and one
      // replacement glyph in a document we only ever regex over is not a fault.
      return { text: new TextDecoder('utf-8').decode(bytes), url: url.toString() };
    }
    throw new RemoteImageError('TOO_MANY_REDIRECTS', 502);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * The cap, applied by **stopping** rather than by refusing.
 *
 * `readResponseBytes` throws `TOO_LARGE`, which is right for an image — half a
 * PNG is not a picture. It is wrong for a page. The signals we want are meta
 * tags and declarations, the ones that matter are near the top, and a document
 * cut off at a megabyte still yields all of them. The measured cost of the
 * strict version was total: nytimes.com (1.24 MB), linear.app (1.26 MB) and
 * figma.com all returned *"that page is too large to read"* to a person who
 * pasted a perfectly ordinary link, and every one of them parses fine truncated.
 *
 * Cancelling the stream at the cap also spends less time and less memory than
 * downloading a body in order to reject it, which is the other half of why
 * those sites were failing — see §14 in the plan.
 *
 * The cap itself is unchanged, so the bound a hostile host is held to is
 * unchanged: it can still never make us hold more than `maxBytes`.
 */
async function readTextBytes(response: Response, maxBytes: number): Promise<Uint8Array> {
  if (!response.body) throw new RemoteImageError('EMPTY_RESPONSE', 502);

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
  }
  await reader.cancel().catch(() => undefined);

  const bytes = new Uint8Array(Math.min(total, maxBytes));
  let offset = 0;
  for (const chunk of chunks) {
    if (offset >= bytes.length) break;
    bytes.set(chunk.subarray(0, bytes.length - offset), offset);
    offset += chunk.byteLength;
  }
  return bytes;
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

/**
 * One deadline for the whole extraction, and it is not a nicety.
 *
 * Each fetch used to carry its own 8-second timeout, so the worst case was a
 * page plus three stylesheets — **32 seconds**, against a Netlify function that
 * is killed at 10. A slow site did not produce "that site took too long"; it
 * produced whatever a platform returns when it stops a function mid-sentence,
 * which is not a sentence we wrote.
 *
 * 9 seconds leaves a moment to serialise the answer inside that 10. The
 * stylesheets are the right thing to sacrifice when it runs short: they are
 * already optional (a page that yields only meta tags is a smaller result, not
 * a failure), and the head has usually paid for itself by then.
 */
const TOTAL_BUDGET_MS = 9_000;

/** Under this there is no point starting another sheet; spend it on the answer. */
const MIN_SHEET_MS = 1_200;

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
  options: {
    fetchImpl?: typeof fetch;
    resolver?: DnsResolver;
    timeoutMs?: number;
    /** The whole extraction's budget. See `TOTAL_BUDGET_MS`. */
    budgetMs?: number;
  } = {}
): Promise<SiteStyleResult> {
  const deadline = Date.now() + (options.budgetMs ?? TOTAL_BUDGET_MS);
  const left = () => deadline - Date.now();
  // An explicit per-fetch timeout still caps a single hop; the budget caps them
  // all, and the smaller of the two always wins.
  const within = (ms: number) => Math.max(1, Math.min(options.timeoutMs ?? Infinity, ms));

  const page = await fetchValidatedText(rawUrl, {
    kind: 'html',
    maxBytes: HTML_BYTES,
    timeoutMs: within(left()),
    fetchImpl: options.fetchImpl,
    resolver: options.resolver,
  });

  const links = readStylesheetLinks(page.text, page.url).slice(0, MAX_STYLESHEETS);
  const sheets: string[] = [];
  for (const link of links) {
    if (left() < MIN_SHEET_MS) break;
    try {
      const sheet = await fetchValidatedText(link, {
        kind: 'css',
        maxBytes: CSS_BYTES,
        timeoutMs: within(left()),
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
