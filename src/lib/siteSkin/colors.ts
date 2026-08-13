/**
 * Colour maths for site skins.
 *
 * Every function here exists because AO3's value grammar has no `color-mix()`,
 * no `hsl()` arithmetic and no relative colour syntax. Anything derived has to
 * be resolved to a literal 6-digit hex before it reaches the compiler, so all
 * of it happens up here in TypeScript where it can be tested.
 *
 * `mixHex`, `lum` and `ratio` are ported from the UX prototype unchanged in
 * behaviour — they were correct, and matching them keeps the compiled output
 * comparable to the design the prototype demonstrated.
 */

export type Hex = string;

/** #abc and #AABBCC both normalise to #aabbcc. */
export function normalizeHex(hex: string): Hex {
  let h = hex.trim().replace(/^#/, '').toLowerCase();
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (!/^[0-9a-f]{6}$/.test(h)) return '#000000';
  return `#${h}`;
}

function channels(hex: string): [number, number, number] {
  const h = normalizeHex(hex).slice(1);
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

/**
 * Blend `a` into `b`. `weight` is how much of `a` survives, so
 * mixHex(accent, surface, 0.27) is "mostly the card colour, tinted by accent".
 */
export function mixHex(a: string, b: string, weight: number): Hex {
  const ca = channels(a);
  const cb = channels(b);
  const out = ca.map((v, i) => Math.round(v * weight + cb[i] * (1 - weight)));
  return '#' + out.map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
}

/** WCAG relative luminance. */
export function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map(v => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1 (identical) to 21 (black on white). */
export function contrastRatio(a: string, b: string): number {
  const l1 = luminance(a);
  const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/**
 * Black or white, whichever is legible on `hex`.
 *
 * This is what fixes defect 4.4 — the header paints itself with the accent
 * colour, and without a foreground derived from it the site navigation is
 * accent-on-accent and invisible. The prototype had this function but only ever
 * used it to tint gallery thumbnails, never in the compiled CSS.
 *
 * The dark option is #241f20 rather than pure black: on a mid-tone accent it
 * reads as intentional rather than as a rendering error, and it still clears
 * 4.5:1 wherever plain black would.
 */
export function readableOn(hex: string): Hex {
  const dark = '#241f20';
  const light = '#ffffff';
  return contrastRatio(dark, hex) >= contrastRatio(light, hex) ? dark : light;
}

export const WCAG_BODY_MIN = 4.5;
/** Links, tags and headings are large or bold more often than not. */
export const WCAG_LARGE_MIN = 3;

export interface ReadabilityIssue {
  id: 'text' | 'accent';
  /** Shown next to the colour controls. No CSS vocabulary. */
  message: string;
  /** The label of the single action that repairs it. */
  fixLabel: string;
  ratio: number;
  required: number;
}

/**
 * Readability, which is NOT the same question as "will AO3 accept this".
 * See §9 of the implementation plan: conflating the two tells users their skin
 * is broken when it is merely dim, or safe when it is unreadable.
 *
 * Two checks, because the accent colour paints every link, tag and heading on
 * the page. A theme can pass the text check and still be unusable if its accent
 * disappears into its cards — which is the case the prototype never looked for.
 */
export function findReadabilityIssues(colors: {
  background: string;
  surface: string;
  text: string;
  accent: string;
}): ReadabilityIssue[] {
  const issues: ReadabilityIssue[] = [];

  const textRatio = Math.min(
    contrastRatio(colors.text, colors.background),
    contrastRatio(colors.text, colors.surface)
  );
  if (textRatio < WCAG_BODY_MIN) {
    issues.push({
      id: 'text',
      message: 'Body text is hard to read against your page or card colour.',
      fixLabel: 'Fix text colour',
      ratio: textRatio,
      required: WCAG_BODY_MIN,
    });
  }

  const accentRatio = Math.min(
    contrastRatio(colors.accent, colors.background),
    contrastRatio(colors.accent, colors.surface)
  );
  if (accentRatio < WCAG_LARGE_MIN) {
    issues.push({
      id: 'accent',
      message: 'Links, tags and headings are hard to read — your accent is too close to your page or card colour.',
      fixLabel: 'Fix accent colour',
      ratio: accentRatio,
      required: WCAG_LARGE_MIN,
    });
  }

  return issues;
}

/* ── Tags, coloured by what they are ──────────────────────────────────────── */

export type TagType = 'warning' | 'relationship' | 'character' | 'freeform';

export const TAG_TYPES: readonly TagType[] = ['warning', 'relationship', 'character', 'freeform'];

/**
 * The hue each tag type starts from.
 *
 * Chosen for the meaning readers already attach to them on AO3 — warnings read
 * as red, relationships as rose, characters as blue, freeforms as green — not
 * for novelty. They are only starting points: every one is pulled most of the
 * way toward the theme's accent below, so a theme acquires four *relatives* of
 * its accent rather than four unrelated colours.
 */
const TAG_ANCHORS: Readonly<Record<TagType, Hex>> = {
  warning: '#a3302a',
  relationship: '#a3417a',
  character: '#2f6ba3',
  freeform: '#3f7a4a',
};

/** How much of the anchor hue survives the blend with the accent. */
const TAG_ANCHOR_WEIGHT = 0.62;

/**
 * Four literal hex colours, one per tag type, guaranteed legible on both the
 * page and the cards.
 *
 * `fixAccent` does the guaranteeing, which is the whole reason this goes through
 * it rather than emitting the anchors directly: a red tag on a Gothic Velvet
 * card would otherwise sit below 3:1 and the type colouring would make the page
 * *harder* to read than the accent it replaced.
 */
export function tagTypeColors(colors: {
  background: string;
  surface: string;
  accent: string;
}): Record<TagType, Hex> {
  const out = {} as Record<TagType, Hex>;
  for (const type of TAG_TYPES) {
    const tinted = mixHex(TAG_ANCHORS[type], colors.accent, TAG_ANCHOR_WEIGHT);
    out[type] = fixAccent(tinted, colors.background, colors.surface);
  }
  return out;
}

/** Whichever of near-black / near-white is more legible on both backgrounds. */
export function bestTextColor(background: string, surface: string): Hex {
  const light = '#ffffff';
  const dark = '#1d191a';
  const lightScore = Math.min(contrastRatio(light, surface), contrastRatio(light, background));
  const darkScore = Math.min(contrastRatio(dark, surface), contrastRatio(dark, background));
  return lightScore > darkScore ? light : dark;
}

/**
 * Push the accent away from the backgrounds until links are legible, keeping
 * its hue.
 *
 * Repeated mixing toward white or black preserves the character of the colour
 * far better than snapping to a computed "accessible" hue would — a muted plum
 * stays a plum, it just gets lighter. We step rather than solve because the
 * target is a ratio against two different backgrounds at once.
 */
export function fixAccent(accent: string, background: string, surface: string): Hex {
  const towards = luminance(surface) > 0.4 ? '#000000' : '#ffffff';
  let candidate = normalizeHex(accent);

  for (let i = 0; i < 12; i++) {
    const ratio = Math.min(
      contrastRatio(candidate, background),
      contrastRatio(candidate, surface)
    );
    if (ratio >= WCAG_LARGE_MIN) return candidate;
    candidate = mixHex(candidate, towards, 0.85);
  }

  // Nothing in the hue's range clears the bar against both backgrounds; fall
  // back to plain legibility rather than returning something still unreadable.
  return bestTextColor(background, surface);
}
