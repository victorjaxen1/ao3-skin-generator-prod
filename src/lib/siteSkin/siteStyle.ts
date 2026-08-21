/**
 * Somebody else's HTML and CSS → the handful of signals AO3 can actually carry.
 *
 * Phase C of the Magic Picker (`docs/MAGIC-PICKER-IMPLEMENTATION.md` §6c). Like
 * `palette.ts`, **this file does no I/O**: it takes strings and returns a plain
 * object, which is what lets the whole of the extraction be tested against saved
 * markup with no network and no browser. `lib/server/siteFetch.ts` is the only
 * part that touches the wire, and `/api/site-palette` is the only part that
 * touches a request.
 *
 * ## No headless browser, and no DOM parser either
 *
 * §6c: a headless browser on Netlify functions is real infrastructure for a
 * marginal gain. So this is regex over text, and it is *deliberately* lossy —
 * a React SPA whose HTML is an empty `<div id="root">` yields `theme-color` and
 * `og:image` and nothing else. **That is the expected case, not a failure**,
 * which is exactly why §6a makes `og:image` the primary signal: it is the one
 * that survives a site rendering itself in JavaScript.
 *
 * The output feeds Phase B unchanged — `swatchesFromColors` turns the colours
 * below into the `Swatch[]` the quantizer already produces, so the contrast
 * floor, the readability proof and the compiler all apply without a line of new
 * colour maths.
 */

import { CARD_RADII } from './theme';
import { luminance, normalizeHex } from './colors';

export interface ExtractedColor {
  hex: string;
  /** Not a pixel count — a judgement about how much of the page this colour is. */
  weight: number;
}

export interface SiteStyle {
  colors: ExtractedColor[];
  /** The raw declaration as written on the site — `fontClassify` reads it. */
  headingFont: string | null;
  bodyFont: string | null;
  /** Pixels, unsnapped. `snapRadius` is the AO3-shaped answer. */
  radius: number | null;
  /** Absolute, already resolved against the page. The primary signal — §6a. */
  ogImage: string | null;
  themeColor: string | null;
  /** The site's *own* polarity, when its body background says so. §6e. */
  polarity: 'light' | 'dark' | null;
  title: string | null;
}

export const EMPTY_SITE_STYLE: SiteStyle = {
  colors: [],
  headingFont: null,
  bodyFont: null,
  radius: null,
  ogImage: null,
  themeColor: null,
  polarity: null,
  title: null,
};

/* ── Colour values ────────────────────────────────────────────────────────── */

/** The named colours worth the bytes: the ones people actually type. */
const NAMED: Record<string, string> = {
  white: '#ffffff',
  black: '#000000',
  red: '#ff0000',
  blue: '#0000ff',
  green: '#008000',
  navy: '#000080',
  teal: '#008080',
  purple: '#800080',
  orange: '#ffa500',
  gold: '#ffd700',
  pink: '#ffc0cb',
  gray: '#808080',
  grey: '#808080',
  silver: '#c0c0c0',
  maroon: '#800000',
  olive: '#808000',
  beige: '#f5f5dc',
  ivory: '#fffff0',
  crimson: '#dc143c',
  indigo: '#4b0082',
};

function hslToHex(h: number, s: number, l: number): string {
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const hue = (((h % 360) + 360) % 360) / 60;
  const second = chroma * (1 - Math.abs((hue % 2) - 1));
  const [r, g, b] =
    hue < 1 ? [chroma, second, 0]
    : hue < 2 ? [second, chroma, 0]
    : hue < 3 ? [0, chroma, second]
    : hue < 4 ? [0, second, chroma]
    : hue < 5 ? [second, 0, chroma]
    : [chroma, 0, second];
  const m = l - chroma / 2;
  return (
    '#' +
    [r, g, b]
      .map(v => Math.round(Math.max(0, Math.min(1, v + m)) * 255).toString(16).padStart(2, '0'))
      .join('')
  );
}

/**
 * One CSS colour value → `#rrggbb`, or null.
 *
 * **A colour that is mostly transparent is discarded, not flattened.** An
 * `rgba(0,0,0,.06)` shadow tint is not a colour the site chose to show; treating
 * it as opaque black is how a light site acquires a black accent.
 */
export function parseCssColor(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  if (!value || value === 'transparent' || value === 'currentcolor' || value === 'inherit') {
    return null;
  }
  if (NAMED[value]) return NAMED[value];

  const hex = value.match(/^#([0-9a-f]{3,8})$/);
  if (hex) {
    const digits = hex[1];
    if (digits.length === 3 || digits.length === 4) {
      if (digits.length === 4 && parseInt(digits[3] + digits[3], 16) < 128) return null;
      return normalizeHex('#' + digits.slice(0, 3).split('').map(c => c + c).join(''));
    }
    if (digits.length === 6) return normalizeHex('#' + digits);
    if (digits.length === 8) {
      return parseInt(digits.slice(6), 16) < 128 ? null : normalizeHex('#' + digits.slice(0, 6));
    }
    return null;
  }

  const fn = value.match(/^(rgba?|hsla?)\(([^)]+)\)$/);
  if (!fn) return null;
  const parts = fn[2].split(/[\s,/]+/).filter(Boolean);
  if (parts.length < 3) return null;
  const alpha = parts.length > 3 ? Number(parts[3].replace('%', '')) : 1;
  if (Number.isFinite(alpha) && (parts[3]?.includes('%') ? alpha < 50 : alpha < 0.5)) return null;

  if (fn[1].startsWith('rgb')) {
    const [r, g, b] = parts.slice(0, 3).map(part =>
      part.endsWith('%') ? (Number(part.slice(0, -1)) / 100) * 255 : Number(part)
    );
    if ([r, g, b].some(v => !Number.isFinite(v))) return null;
    return normalizeHex(
      '#' +
        [r, g, b]
          .map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0'))
          .join('')
    );
  }

  const h = Number(parts[0].replace(/deg$/, ''));
  const s = Number(parts[1].replace('%', '')) / 100;
  const l = Number(parts[2].replace('%', '')) / 100;
  if ([h, s, l].some(v => !Number.isFinite(v))) return null;
  return hslToHex(h, Math.max(0, Math.min(1, s)), Math.max(0, Math.min(1, l)));
}

/* ── CSS ──────────────────────────────────────────────────────────────────── */

export interface CssRule {
  selector: string;
  declarations: string;
}

/** Enough for any real stylesheet; a bound rather than a judgement. */
const MAX_CSS_CHARS = 2_000_000;
const MAX_RULES = 4000;

/**
 * CSS text → flat rules.
 *
 * At-rules are stepped *into* rather than parsed: the inner `a { color: red }`
 * of a `@media` block is a rule on its own terms and the wrapper is skipped, so
 * a media query costs nothing here.
 *
 * **Scanned with `indexOf`, and it must stay that way.** The obvious version of
 * this function is one regex — `/([^{}]+)\{([^{}]*)\}/g` — and it is a denial of
 * service. On text with no braces in it, `[^{}]+` matches to the end, fails to
 * find `{`, backtracks a character at a time, then the engine advances the start
 * position and does it again: quadratic. Measured at over two minutes on 200 KB,
 * and this function is fed a **1 MB response from an address a stranger typed**.
 * A linear scan has no such shape.
 */
export function readCssRules(css: string): CssRule[] {
  const text = (css.length > MAX_CSS_CHARS ? css.slice(0, MAX_CSS_CHARS) : css).replace(
    /\/\*[\s\S]*?\*\//g,
    ' '
  );
  const rules: CssRule[] = [];
  let cursor = 0;
  let selectorStart = 0;

  while (cursor < text.length && rules.length < MAX_RULES) {
    const open = text.indexOf('{', cursor);
    if (open < 0) break;
    const close = text.indexOf('}', open + 1);
    if (close < 0) break;
    const nextOpen = text.indexOf('{', open + 1);

    // Another block opens before this one closes, so this was a wrapper
    // (`@media`, `@supports`, `@layer`). Step inside and read what it contains.
    if (nextOpen >= 0 && nextOpen < close) {
      cursor = open + 1;
      selectorStart = open + 1;
      continue;
    }

    // Whatever preceded the brace, after any stray `}` that closed a wrapper.
    const raw = text.slice(selectorStart, open);
    const selector = raw.slice(raw.lastIndexOf('}') + 1).trim().replace(/\s+/g, ' ');
    if (selector && !selector.startsWith('@')) {
      rules.push({ selector: selector.toLowerCase(), declarations: text.slice(open + 1, close) });
    }
    cursor = close + 1;
    selectorStart = close + 1;
  }

  return rules;
}

/** `color: red; --x: blue` → the pairs, lowercased property names. */
export function readDeclarations(block: string): Array<[string, string]> {
  return block
    .split(';')
    .map(part => {
      const at = part.indexOf(':');
      if (at < 0) return null;
      return [part.slice(0, at).trim().toLowerCase(), part.slice(at + 1).trim()] as [string, string];
    })
    .filter((pair): pair is [string, string] => Boolean(pair && pair[0] && pair[1]));
}

/**
 * How much a declaration counts, by where it was found.
 *
 * §6c asks for "specificity as a proxy for area", and the honest version of that
 * is coarser than it sounds: what actually covers a page is the body background,
 * then the design tokens on `:root`, and everything else is a component. So this
 * is three tiers rather than a specificity calculator — a calculator would rank
 * `.sidebar .badge.is-new` above `body`, which is precisely backwards for the
 * question being asked.
 */
const PAGE_SELECTOR = /(^|,)\s*(html|body|:root|\*)\b/;
const WEIGHTS = {
  themeColor: 6,
  pageBackground: 5,
  token: 2,
  pageText: 2,
  background: 1,
  text: 0.6,
  accent: 0.8,
};

const HEADING_SELECTOR = /(^|,|\s)(h1|h2|h3|\.title|\.heading|\.headline|\.display)\b/;
const BODY_SELECTOR = /(^|,)\s*(html|body|:root|\.prose|\.content)\b/;
const CARD_SELECTOR = /(card|btn|button|panel|tile|box|badge|chip|modal|input)/;

/** Colours a page always has and that carry no taste. Kept, but never as accents. */
function isNeutralish(hex: string): boolean {
  const l = luminance(hex);
  return l > 0.93 || l < 0.02;
}

/**
 * The whole extraction: markup plus whatever stylesheets were fetched.
 *
 * `cssTexts` may be empty — a site whose CSS is unreachable still yields its
 * meta tags, which is the case §6c says to accept rather than engineer around.
 */
export function collectSiteStyle(html: string, cssTexts: readonly string[] = []): SiteStyle {
  const meta = readMeta(html);
  const css = [...extractInlineStyles(html), ...cssTexts].join('\n');
  const rules = readCssRules(css);

  const weights = new Map<string, number>();
  const add = (raw: string, weight: number) => {
    const hex = parseCssColor(raw);
    if (!hex) return;
    weights.set(hex, (weights.get(hex) || 0) + weight);
  };

  let headingFont: string | null = null;
  let bodyFont: string | null = null;
  let pageBackground: string | null = null;
  const radii = new Map<number, number>();

  if (meta.themeColor) add(meta.themeColor, WEIGHTS.themeColor);

  for (const rule of rules) {
    const isPage = PAGE_SELECTOR.test(rule.selector);
    for (const [property, value] of readDeclarations(rule.declarations)) {
      if (property.startsWith('--')) {
        // Design tokens. The best signal on a modern site (§6c) and also the
        // noisiest — a token file holds every shade of every ramp — so each one
        // counts for less than the page's own background does.
        add(value, WEIGHTS.token);
        continue;
      }
      if (property === 'background-color' || property === 'background') {
        const hex = parseCssColor(value.split(/\s+/)[0]);
        if (isPage && hex && !pageBackground) pageBackground = hex;
        add(value.split(/\s+/)[0], isPage ? WEIGHTS.pageBackground : WEIGHTS.background);
        continue;
      }
      if (property === 'color') {
        add(value, isPage ? WEIGHTS.pageText : WEIGHTS.text);
        continue;
      }
      if (property === 'border-color' || property === 'fill' || property === 'accent-color') {
        add(value, WEIGHTS.accent);
        continue;
      }
      if (property === 'font-family') {
        if (!headingFont && HEADING_SELECTOR.test(rule.selector)) headingFont = value;
        if (!bodyFont && BODY_SELECTOR.test(rule.selector)) bodyFont = value;
        continue;
      }
      if (property === 'border-radius' && CARD_SELECTOR.test(rule.selector)) {
        const px = Number((value.match(/^(-?\d+(?:\.\d+)?)px/) || [])[1]);
        if (Number.isFinite(px) && px >= 0 && px <= 40) {
          radii.set(Math.round(px), (radii.get(Math.round(px)) || 0) + 1);
        }
      }
    }
  }

  const colors = [...weights.entries()]
    .map(([hex, weight]) => ({ hex, weight }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 24);

  const commonest = [...radii.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];

  return {
    colors,
    headingFont,
    bodyFont,
    radius: commonest ? commonest[0] : null,
    ogImage: meta.ogImage,
    themeColor: meta.themeColor,
    polarity: pageBackground ? (luminance(pageBackground) > 0.4 ? 'light' : 'dark') : null,
    title: meta.title,
  };
}

/* ── Markup ───────────────────────────────────────────────────────────────── */

function attribute(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  if (!match) return null;
  return (match[2] ?? match[3] ?? match[4] ?? '').trim();
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'");
}

interface MetaSignals {
  themeColor: string | null;
  ogImage: string | null;
  title: string | null;
}

/** `<meta>`, `<title>` — the part of a page that survives client-side rendering. */
export function readMeta(html: string): MetaSignals {
  let themeColor: string | null = null;
  let ogImage: string | null = null;
  const twitterImages: string[] = [];

  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const key = (attribute(tag, 'name') || attribute(tag, 'property') || '').toLowerCase();
    const content = attribute(tag, 'content');
    if (!key || !content) continue;
    if (key === 'theme-color' && !themeColor) themeColor = decodeEntities(content);
    if ((key === 'og:image' || key === 'og:image:secure_url') && !ogImage) {
      ogImage = decodeEntities(content);
    }
    if (key === 'twitter:image' || key === 'twitter:image:src') {
      twitterImages.push(decodeEntities(content));
    }
  }

  const title = (html.match(/<title[^>]*>([\s\S]{0,300}?)<\/title>/i) || [])[1];

  return {
    themeColor,
    ogImage: ogImage || twitterImages[0] || null,
    title: title ? decodeEntities(title.replace(/\s+/g, ' ').trim()).slice(0, 120) : null,
  };
}

/** `<link rel="stylesheet">` hrefs, resolved against the page. */
export function readStylesheetLinks(html: string, base: string): string[] {
  const links: string[] = [];
  for (const tag of html.match(/<link\b[^>]*>/gi) || []) {
    const rel = (attribute(tag, 'rel') || '').toLowerCase();
    if (!rel.split(/\s+/).includes('stylesheet')) continue;
    const href = attribute(tag, 'href');
    if (!href) continue;
    try {
      links.push(new URL(decodeEntities(href), base).toString());
    } catch {
      /* a malformed href is not worth a failure */
    }
  }
  return links;
}

export function extractInlineStyles(html: string): string[] {
  return (html.match(/<style\b[^>]*>([\s\S]*?)<\/style>/gi) || []).map(block =>
    block.replace(/^<style\b[^>]*>/i, '').replace(/<\/style>$/i, '')
  );
}

/** An `og:image` is worth having only if it is an address we can fetch. */
export function absoluteImageUrl(candidate: string | null, base: string): string | null {
  if (!candidate) return null;
  try {
    const url = new URL(candidate, base);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

/* ── Handing over to the theme ────────────────────────────────────────────── */

/** The site's radius → the nearest one AO3's four options can express. */
export function snapRadius(px: number | null): string | null {
  if (px === null || !Number.isFinite(px)) return null;
  let best = CARD_RADII[0];
  for (const option of CARD_RADII) {
    if (Math.abs(parseInt(option.value, 10) - px) < Math.abs(parseInt(best.value, 10) - px)) {
      best = option;
    }
  }
  return best.value;
}

/**
 * Hued colours a site gets by **not choosing one**.
 *
 * The distinction this table draws is not "colours frameworks contain" — it is
 * colours that appear because nobody picked. `$primary` is what a stock
 * Bootstrap build paints its buttons when the SASS was never recompiled, so a
 * page carrying it is telling us about its toolchain, not its taste. That is
 * the opposite of a Tailwind palette, where `bg-blue-500` is a designer typing
 * a decision, and it is why Tailwind's ramp is deliberately absent below.
 *
 * **Matched exactly, never approximately.** A recompiled Bootstrap with a
 * customised `$primary` is precisely the case where the stylesheet *does* carry
 * the brand, and a near-match rule would throw that away — the one input we
 * most want to keep.
 *
 * Only the hued defaults are listed. Every framework's greys are the same greys
 * every hand-written site uses, they carry the page's polarity, and dropping
 * them would cost the background its cast for nothing. Bootstrap's `$secondary`
 * (`#6c757d`) reads chroma 0.07 and belongs with them, so it is not here.
 */
const FRAMEWORK_ACCENTS: ReadonlyMap<string, string> = new Map([
  // Bootstrap 3 — .btn-primary through .btn-danger.
  ['#337ab7', 'Bootstrap'], ['#5cb85c', 'Bootstrap'], ['#5bc0de', 'Bootstrap'],
  ['#f0ad4e', 'Bootstrap'], ['#d9534f', 'Bootstrap'],
  // Bootstrap 4.
  ['#007bff', 'Bootstrap'], ['#28a745', 'Bootstrap'], ['#17a2b8', 'Bootstrap'],
  ['#ffc107', 'Bootstrap'], ['#dc3545', 'Bootstrap'],
  // Bootstrap 5 — $primary, $success and $info moved; $warning and $danger did not.
  ['#0d6efd', 'Bootstrap'], ['#198754', 'Bootstrap'], ['#0dcaf0', 'Bootstrap'],
  // Foundation.
  ['#1779ba', 'Foundation'], ['#3adb76', 'Foundation'], ['#ffae00', 'Foundation'],
  ['#cc4b37', 'Foundation'],
  // Bulma.
  ['#00d1b2', 'Bulma'], ['#3273dc', 'Bulma'], ['#209cee', 'Bulma'],
  ['#23d160', 'Bulma'], ['#ffdd57', 'Bulma'], ['#ff3860', 'Bulma'],
  // Semantic UI.
  ['#2185d0', 'Semantic UI'], ['#21ba45', 'Semantic UI'], ['#db2828', 'Semantic UI'],
  // Material Design's 500s, as Materialize and the MDC themes ship them.
  ['#2196f3', 'Material'], ['#3f51b5', 'Material'], ['#26a69a', 'Material'],
]);

/**
 * Which framework ships this exact colour as a default, if any.
 *
 * Exported because `siteTheme.ts` has to ask the question of *the accent the
 * mapping would otherwise pick* — one colour, after the ranking — and it names
 * the framework in the sentence it shows the user.
 */
export function stockAccentFramework(hex: string): string | null {
  return FRAMEWORK_ACCENTS.get(normalizeHex(hex)) ?? null;
}

/**
 * The colours worth handing to the quantizer.
 *
 * Near-white and near-black are dropped *only* when something else survives:
 * every site has them, they say nothing about taste, and leaving them in makes
 * the weighted cast of every site the same off-white. A monochrome site keeps
 * them, because then they are the answer.
 *
 * Framework defaults are deliberately **not** dropped here, and the measurement
 * is worth keeping: pruning the table above off this list does not reach the
 * accent, because a framework ships its derived shades too. Bootstrap emits
 * `darken($warning, 10%)` as `#d39e00`, which is in no table of base defaults
 * and out-chromas a real brand colour, so heyoliver.com came back gold instead
 * of blue. The override that works replaces the accent outright — see
 * `frameworkOverride` in `siteTheme.ts`.
 */
export function meaningfulColors(colors: readonly ExtractedColor[]): ExtractedColor[] {
  const hued = colors.filter(c => !isNeutralish(c.hex));
  return hued.length >= 2 ? hued : [...colors];
}
