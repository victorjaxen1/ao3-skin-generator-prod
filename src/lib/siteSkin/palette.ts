/**
 * Colours out of a picture.
 *
 * The engine behind the Magic Picker (`docs/MAGIC-PICKER-IMPLEMENTATION.md`
 * §5). It takes raw RGBA bytes and returns a `SiteSkinTheme` — nothing else
 * changes, which is the invariant that keeps the whole feature cheap: the
 * compiler, the lint, the preview and the export all apply unmodified, because
 * the thing produced *is* a theme.
 *
 * **This file never touches the DOM and knows nothing about URLs.** It takes an
 * `ArrayLike<number>` of RGBA bytes and returns hex strings. Two reasons, and
 * both are load-bearing:
 *
 *  - the whole of the mapping below is unit-tested against synthetic pixel
 *    arrays with no browser in the room (`tests/palette.unit.spec.ts`), which is
 *    what makes the contrast floor a *proof* rather than a spot-check;
 *  - Phase C (a website's palette) is then a thin fetcher in front of this file
 *    rather than a second extraction system. `imageSample.ts` is the only place
 *    that knows what a canvas is.
 */

import { SiteSkinTheme, HeaderTextColor } from './theme';
import {
  bestTextColor,
  contrastRatio,
  findReadabilityIssues,
  fixAccent,
  mixHex,
  normalizeHex,
} from './colors';

/** Which way round the extracted theme runs. Both are always computed. */
export type Polarity = 'light' | 'dark';

export const POLARITIES: readonly Polarity[] = ['light', 'dark'];

/**
 * One id for every extraction, forever.
 *
 * `site-skin.tsx` keys activation on `site-skin:${theme.meta.id}`, so a
 * per-extraction id would fragment that metric into noise.
 *
 * **It must also be a member of `TEMPLATE_IDS` in `analytics.ts`**, which is not
 * obvious and is the subject of §5f.4. That allowlist rejects the *whole event*
 * on an unknown id, so without it a generated theme records no
 * `template_selected`, no `project_activated` and no export funnel at all. A
 * test in `tests/palette.unit.spec.ts` pins it, because the existing drift test
 * in `analytics.unit.spec.ts` iterates the catalog and this theme is
 * deliberately not in the catalog.
 */
export const MAGIC_THEME_ID = 'from-image';

export const MAGIC_THEME_NAME = 'From your image';

/* ── The quantizer ────────────────────────────────────────────────────────── */

export interface Swatch {
  hex: string;
  /** Share of the pixels that survived the alpha floor, 0–1. */
  weight: number;
  /** `(max - min) / 255` over the channels. Cheap, and monotonic with saturation. */
  chroma: number;
  /** Perceptual-ish luma, 0–1. Used only for ordering, never for contrast. */
  lightness: number;
}

/**
 * Below this, a pixel is margin rather than art.
 *
 * **Load-bearing.** Fan art PNGs are full of transparent margin, and the canvas
 * reports those pixels as transparent *black* or transparent *white* depending
 * on the encoder. Without a floor they quantize as one enormous neutral cluster
 * and every extracted theme comes out cream.
 */
const ALPHA_FLOOR = 125;

/** 4 bits per channel → 4,096 bins. Fine enough to separate, coarse enough to count. */
const BIN_SHIFT = 4;

/**
 * Bins closer than this in channel space are the same colour to a human.
 *
 * A smooth gradient lands in dozens of adjacent bins; without the merge pass the
 * "dominant" swatch is an arbitrary slice of a sky and every weight is tiny, so
 * the 2% deliberateness floor below rejects everything.
 */
const MERGE_DISTANCE = 42;

/** A cluster smaller than this is an artefact, not a decision. */
const MIN_DELIBERATE = 0.02;

function rgbOf(hex: string): [number, number, number] {
  const h = normalizeHex(hex).slice(1);
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function toHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
      .join('')
  );
}

interface Bin {
  r: number;
  g: number;
  b: number;
  n: number;
}

/**
 * RGBA bytes → a short list of colours, most populous first.
 *
 * Popularity binning rather than median cut: it is ~40 lines instead of ~120,
 * it needs no dependency, and on a 64×64 sample the difference is not visible.
 * The merge pass is what makes it behave like median cut on photographs.
 */
export function quantize(pixels: ArrayLike<number>): Swatch[] {
  const bins = new Map<number, Bin>();
  let sampled = 0;

  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if (pixels[i + 3] < ALPHA_FLOOR) continue;
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const key = ((r >> BIN_SHIFT) << 8) | ((g >> BIN_SHIFT) << 4) | (b >> BIN_SHIFT);
    const bin = bins.get(key);
    if (bin) {
      bin.r += r;
      bin.g += g;
      bin.b += b;
      bin.n += 1;
    } else {
      bins.set(key, { r, g, b, n: 1 });
    }
    sampled += 1;
  }

  if (sampled === 0) return [];

  const ordered = [...bins.values()].sort((a, b) => b.n - a.n);
  const merged: Bin[] = [];

  for (const bin of ordered) {
    const [br, bg, bb] = [bin.r / bin.n, bin.g / bin.n, bin.b / bin.n];
    const near = merged.find(kept => {
      const dr = kept.r / kept.n - br;
      const dg = kept.g / kept.n - bg;
      const db = kept.b / kept.n - bb;
      return Math.sqrt(dr * dr + dg * dg + db * db) <= MERGE_DISTANCE;
    });
    if (near) {
      near.r += bin.r;
      near.g += bin.g;
      near.b += bin.b;
      near.n += bin.n;
    } else {
      merged.push({ ...bin });
    }
  }

  return merged
    .map(bin => {
      const r = bin.r / bin.n;
      const g = bin.g / bin.n;
      const b = bin.b / bin.n;
      return {
        hex: toHex(r, g, b),
        weight: bin.n / sampled,
        chroma: (Math.max(r, g, b) - Math.min(r, g, b)) / 255,
        lightness: (0.299 * r + 0.587 * g + 0.114 * b) / 255,
      };
    })
    .sort((a, b) => b.weight - a.weight);
}

/* ── The mapping ──────────────────────────────────────────────────────────── */

/**
 * How far the page colour is allowed to travel from its pole.
 *
 * Small on purpose. The background carries a *hint* of the image rather than
 * its dominant colour, because AO3 is a wall of text and a saturated page is
 * unreadable at any contrast ratio. It is also what bounds the contrast floor
 * below: a background this close to white or black always leaves one of the two
 * text colours comfortably clear of 4.5:1.
 */
const CAST_TINT: Record<Polarity, number> = { light: 0.12, dark: 0.18 };

/** Not pure black: a page of #000 reads as a rendering error rather than a theme. */
const POLE: Record<Polarity, string> = { light: '#ffffff', dark: '#0d0d0f' };

/**
 * How far a card sits off the page.
 *
 * A *ratio*, not a mix weight, because the same weight is a large step on a dark
 * page and an invisible one on a light page. 1.12 is measured off the shipped
 * catalog: Paper & Ink (#f4efe5 → #fffdf8) and Moonlit Library (#101725 →
 * #182238) both sit at ~1.10–1.15.
 */
export const SURFACE_TARGET = 1.12;

/** The overall colour of the image — every swatch, weighted by how much of it there is. */
export function imageCast(swatches: readonly Swatch[]): string {
  if (swatches.length === 0) return '#808080';
  let r = 0;
  let g = 0;
  let b = 0;
  let total = 0;
  for (const swatch of swatches) {
    const [sr, sg, sb] = rgbOf(swatch.hex);
    r += sr * swatch.weight;
    g += sg * swatch.weight;
    b += sb * swatch.weight;
    total += swatch.weight;
  }
  return total > 0 ? toHex(r / total, g / total, b / total) : '#808080';
}

/**
 * The most saturated colour anybody actually chose.
 *
 * Two filters and both matter. **Population** — a colour occupying less than 2%
 * of the image is a JPEG artefact or a single bright pixel, not a decision.
 * **Lightness** — near-black and near-white swatches carry no usable hue, and
 * picking one produces an accent that `fixAccent` then has to invent a colour
 * for. Each filter falls back rather than failing: a genuinely monochrome image
 * gets a monochrome accent, which is honest.
 */
export function pickAccent(swatches: readonly Swatch[]): string {
  if (swatches.length === 0) return '#5a5a5a';
  const deliberate = swatches.filter(s => s.weight >= MIN_DELIBERATE);
  const pool = deliberate.length ? deliberate : swatches;
  const hued = pool.filter(s => s.lightness > 0.1 && s.lightness < 0.92);
  const ranked = [...(hued.length ? hued : pool)].sort(
    (a, b) => b.chroma - a.chroma || b.weight - a.weight
  );
  return ranked[0].hex;
}

/**
 * The card colour: the page, stepped toward white until it is visibly a card.
 *
 * **Toward white in both polarities**, which is the correction in §5f.2. Every
 * shipped template has a surface lighter than its background — a card is raised,
 * and that reads the same way on a dark theme as on a light one. Deriving it
 * from `text` instead inverts it on light themes.
 *
 * The fallback exists for a page that is already at the pole (a photograph of
 * snow, extracted light). A card cannot separate from white by getting whiter,
 * so it separates the other way rather than vanishing.
 */
export function liftSurface(background: string): string {
  // Interpolate from the background to the pole, rather than stepping a
  // percentage off the previous candidate. The compounding version never
  // arrives: mixing 6% white into a candidate repeatedly is Zeno's arrow, so a
  // page at luminance 0.87 — where the *only* colour clearing the target is
  // very near pure white — ran out of iterations short of it and fell through
  // to the fallback, producing a darker card on a light theme. A test over the
  // mid-grey fixture caught it; the arithmetic is why it is written this way.
  const STEPS = 40;
  for (let step = 1; step <= STEPS; step++) {
    const candidate = mixHex('#ffffff', background, step / STEPS);
    if (contrastRatio(candidate, background) >= SURFACE_TARGET) return candidate;
  }
  for (let step = 1; step <= STEPS; step++) {
    const candidate = mixHex('#000000', background, step / STEPS);
    if (contrastRatio(candidate, background) >= SURFACE_TARGET) return candidate;
  }
  return normalizeHex(background);
}

/**
 * Swatches → the four colour fields, guaranteed to pass the editor's own
 * readability check.
 *
 * The order is not negotiable and each step depends on the one above:
 * background from the cast, surface from the background, text from both, accent
 * last so `fixAccent` is measuring against the finished page.
 *
 * **The loop is the feature.** A mid-tone page is the one input that defeats
 * both text colours at once — neither white nor near-black clears 4.5:1 against
 * a luminance of ~0.2 — and pushing it further toward its pole is exactly the
 * repair. Six iterations is far more than the bound needs; it terminates because
 * every pass moves the background 18% closer to a pole where the floor is met by
 * a wide margin.
 *
 * So the extractor cannot emit a palette the editor would then warn about, which
 * is the promise §5c makes. It is asserted over 200+ synthetic images.
 */
export function colorsFromSwatches(
  swatches: readonly Swatch[],
  polarity: Polarity
): SiteSkinTheme['colors'] {
  const pole = POLE[polarity];
  const rawAccent = pickAccent(swatches);
  let background = mixHex(imageCast(swatches), pole, CAST_TINT[polarity]);
  let colors = resolve(background, rawAccent);

  for (let i = 0; i < 6 && findReadabilityIssues(colors).length > 0; i++) {
    background = mixHex(pole, background, 0.18);
    colors = resolve(background, rawAccent);
  }

  return colors;
}

function resolve(background: string, rawAccent: string): SiteSkinTheme['colors'] {
  const surface = liftSurface(background);
  const text = bestTextColor(background, surface);
  return {
    background: normalizeHex(background),
    surface,
    text,
    accent: fixAccent(rawAccent, background, surface),
  };
}

/* ── Themes ───────────────────────────────────────────────────────────────── */

/**
 * A complete theme around an extracted palette.
 *
 * Everything that is not a colour is a deliberate neutral, because an image
 * carries no evidence about any of it: Georgia at the default scale, soft
 * corners, pill tags, no divider and no drop cap. Phase C is where fonts and
 * `cardRadius` stop being defaults — a stylesheet has a `font-family` to read
 * and a photograph does not.
 *
 * `category` and `moods` follow the polarity, so a generated theme cannot claim
 * a mood it contradicts if it is ever filtered or listed.
 */
export function themeFromPalette(
  colors: SiteSkinTheme['colors'],
  polarity: Polarity
): SiteSkinTheme {
  return {
    schemaVersion: 1,
    meta: {
      id: MAGIC_THEME_ID,
      name: MAGIC_THEME_NAME,
      category: polarity,
      moods: [polarity],
    },
    colors: { ...colors },
    typography: {
      headingFont: 'Georgia, serif',
      bodyFont: 'Georgia, serif',
      baseFontScale: 1,
    },
    shape: { cardRadius: '10px', tagStyle: 'pill', tagColors: true },
    header: {
      bannerUrl: '',
      bannerHeight: '15em',
      hideLogo: false,
      textShadow: false,
      textColor: 'auto',
      // A fade the palette already implies, so a generated theme is not a bare
      // accent block. Costs no bytes and no host — SITE-SKIN §19b-bis.
      gradient: 'vertical',
    },
    reading: { requiredTagsAsText: false },
    details: { divider: false, dropCap: false, scrollbar: true },
  };
}

/** Both polarities from one set of pixels. The user picks; we do not guess. */
export function paletteFromPixels(pixels: ArrayLike<number>): Record<Polarity, SiteSkinTheme> {
  const swatches = quantize(pixels);
  return {
    light: themeFromPalette(colorsFromSwatches(swatches, 'light'), 'light'),
    dark: themeFromPalette(colorsFromSwatches(swatches, 'dark'), 'dark'),
  };
}

/* ── The banner, when the address happens to be usable as one ─────────────── */

export interface BannerReading {
  /** Measured, not guessed — which is the whole point. */
  textColor: Exclude<HeaderTextColor, 'auto'>;
  /** On for a busy image, where a glow is the difference between legible and not. */
  textShadow: boolean;
  meanLuminance: number;
  /** Standard deviation of per-pixel luminance. High means busy. */
  spread: number;
}

const BUSY_SPREAD = 0.16;

/**
 * What `header.textColor: 'auto'` could never know.
 *
 * `theme.ts` and SITE-SKIN §4b both say outright that we cannot measure the
 * brightness of a photograph, which is the entire reason the manual override
 * exists. Once the pixels have been fetched, we can — so the guess becomes a
 * measurement and `textShadow` becomes a recommendation rather than a toggle
 * whose purpose is invisible until you try it.
 *
 * **Only meaningful when the sampled image is actually the banner** (§5f.3). In
 * Phase B it usually is not: the picker's most valuable case is an address AO3
 * refuses as a banner but that reads perfectly well as colour. The caller gates
 * this on `checkAo3ImageUrl` and on the user opting in.
 *
 * Measured over the whole image because the banner is painted `cover` and
 * `center`, so no region of it is reliably the one under the title.
 */
export function readBannerBrightness(pixels: ArrayLike<number>): BannerReading {
  const values: number[] = [];
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if (pixels[i + 3] < ALPHA_FLOOR) continue;
    const [r, g, b] = [pixels[i], pixels[i + 1], pixels[i + 2]].map(v => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    });
    values.push(0.2126 * r + 0.7152 * g + 0.0722 * b);
  }

  if (values.length === 0) {
    return { textColor: 'light', textShadow: true, meanLuminance: 0, spread: 0 };
  }

  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  const spread = Math.sqrt(variance);

  return {
    // 0.18 rather than 0.5: luminance is already perceptually weighted, and the
    // midpoint of *perceived* brightness sits far below the midpoint of the
    // scale. Picking 0.5 puts white text on images that plainly read as light.
    textColor: mean > 0.18 ? 'dark' : 'light',
    textShadow: spread > BUSY_SPREAD,
    meanLuminance: mean,
    spread,
  };
}

/** The theme with the picture behind its header, sized and read for it. */
export function withBanner(
  theme: SiteSkinTheme,
  bannerUrl: string,
  reading: BannerReading
): SiteSkinTheme {
  return {
    ...theme,
    header: {
      ...theme.header,
      bannerUrl,
      // The roundel out of the way and a real height, because a banner in a
      // two-line header is not a banner. Matches the four banner-ready
      // templates in `templates.ts`.
      hideLogo: true,
      bannerHeight: '15em',
      textColor: reading.textColor,
      textShadow: reading.textShadow,
    },
  };
}
