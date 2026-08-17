/**
 * Client for `/api/site-palette`.
 *
 * The twin of `lib/imageProxy.ts`, and as thin: the endpoint returns extracted
 * values and never the page it read (see the file comment there for why that
 * rule is the whole safety argument), so there is nothing to sanitise here — the
 * shape below *is* the contract.
 *
 * No caching, unlike the image proxy. That one repeats an avatar across every
 * message of an export; this one runs when a person presses a button.
 */

import { EMPTY_SITE_STYLE, SiteStyle } from './siteStyle';

const ENDPOINT = '/api/site-palette';

export interface SitePalette extends SiteStyle {
  /** After redirects — the page actually read. */
  url: string;
  stylesheetsRead: number;
}

/** Field by field, because a response is JSON somebody could serve us anything as. */
export async function fetchSitePalette(url: string): Promise<SitePalette> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || `Could not read that site (HTTP ${res.status}).`);

  const colors = Array.isArray(body?.colors)
    ? body.colors
        .filter((c: unknown): c is { hex: string; weight: number } =>
          Boolean(c) &&
          typeof (c as any).hex === 'string' &&
          typeof (c as any).weight === 'number' &&
          Number.isFinite((c as any).weight)
        )
        .slice(0, 32)
    : [];

  const text = (value: unknown, max: number) =>
    typeof value === 'string' && value ? value.slice(0, max) : null;

  return {
    ...EMPTY_SITE_STYLE,
    colors,
    headingFont: text(body?.headingFont, 200),
    bodyFont: text(body?.bodyFont, 200),
    radius: typeof body?.radius === 'number' && Number.isFinite(body.radius) ? body.radius : null,
    ogImage: text(body?.ogImage, 2000),
    themeColor: text(body?.themeColor, 64),
    polarity: body?.polarity === 'light' || body?.polarity === 'dark' ? body.polarity : null,
    // Not requested and not read — the endpoint does not send the page's title,
    // and the reason is in its file comment.
    title: null,
    url: text(body?.url, 2000) || url,
    stylesheetsRead: typeof body?.stylesheetsRead === 'number' ? body.stylesheetsRead : 0,
  };
}
