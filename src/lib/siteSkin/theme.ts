/**
 * The site skin theme object.
 *
 * Deliberately NOT an extension of SkinProject/SkinSettings. The two products
 * share a shell and nothing else: one rasterises a conversation to a PNG, the
 * other emits CSS text. Merging their settings objects is the mistake the
 * platform audit spent ~60 deleted fields undoing, and it would be a bigger
 * mistake here because the field sets have no overlap at all.
 */

import { checkAo3ImageUrl } from './ao3Css';

export type Mood = 'dark' | 'light' | 'minimal' | 'decorative';
export type TagStyle = 'pill' | 'label' | 'plain';
export type HeaderTextColor = 'auto' | 'light' | 'dark';

export interface SiteSkinTheme {
  schemaVersion: 1;
  meta: {
    id: string;
    name: string;
    /** The single badge on a gallery card. */
    category: Mood;
    /** What the filter chips match. A theme is honestly often two things. */
    moods: readonly Mood[];
  };
  colors: {
    background: string;
    surface: string;
    text: string;
    accent: string;
  };
  typography: {
    headingFont: string;
    bodyFont: string;
    /** 1 = AO3's own size. Emitted once, on body, as a percentage. */
    baseFontScale: number;
  };
  shape: {
    cardRadius: string;
    tagStyle: TagStyle;
  };
  /**
   * The only group where the user supplies content rather than picking from a
   * set. A banner is what makes a skin feel like *theirs* rather than a tint —
   * and it is also the one field that can be refused by AO3, so it carries its
   * own validation all the way from the input to the export gate.
   */
  header: {
    /** Empty means no banner. Must satisfy AO3's URI grammar — see ao3Css. */
    bannerUrl: string;
    bannerHeight: string;
    hideLogo: boolean;
    /** A glow behind the header title, for legibility over a busy image. */
    textShadow: boolean;
    /**
     * 'auto' derives the header foreground from the accent, which is correct
     * for a flat header and guaranteed to contrast. Over a banner it is a
     * guess: we cannot measure the brightness of an image, so the person
     * looking at it has to be able to overrule us. Without this a dark banner
     * under a light accent leaves the title unreadable and the only escape is
     * changing the accent — which would recolour every link on the site.
     */
    textColor: HeaderTextColor;
  };
  details: {
    divider: boolean;
    dropCap: boolean;
  };
}

/**
 * Web-safe stacks only.
 *
 * AO3 rejects @font-face outright, so there are no webfonts to be had — and
 * every family name has to survive `sanitize_css_font`, which allows letters,
 * digits, dashes and spaces and nothing else. No periods, no underscores.
 * `tests/site-skin.unit.spec.ts` checks that against the real rule, so adding
 * a stack with a stray character fails the build rather than a user's save.
 */
export const FONT_STACKS: readonly { value: string; label: string }[] = [
  { value: 'Georgia, serif', label: 'Georgia — classic book' },
  { value: "'Palatino Linotype', Palatino, serif", label: 'Palatino — literary' },
  { value: "'Times New Roman', Times, serif", label: 'Times — newsprint' },
  { value: 'Arial, Helvetica, sans-serif', label: 'Arial — plain' },
  { value: "'Trebuchet MS', Verdana, sans-serif", label: 'Trebuchet — friendly' },
  { value: 'Verdana, Geneva, sans-serif', label: 'Verdana — wide and clear' },
  { value: "'Courier New', Courier, monospace", label: 'Courier — typewriter' },
];

export const FONT_SCALES: readonly { value: number; label: string }[] = [
  { value: 0.9, label: 'Small' },
  { value: 1, label: 'Default' },
  { value: 1.1, label: 'Large' },
  { value: 1.25, label: 'Largest' },
];

export const CARD_RADII: readonly { value: string; label: string }[] = [
  { value: '0px', label: 'Square' },
  { value: '4px', label: 'Soft' },
  { value: '10px', label: 'Rounded' },
  { value: '18px', label: 'Pillowy' },
];

export const TAG_STYLES: readonly { value: TagStyle; label: string }[] = [
  { value: 'pill', label: 'Pill' },
  { value: 'label', label: 'Label' },
  { value: 'plain', label: 'Plain' },
];

export const HEADER_TEXT_COLORS: readonly { value: HeaderTextColor; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export const BANNER_HEIGHTS: readonly { value: string; label: string }[] = [
  { value: '6em', label: 'Slim' },
  { value: '10em', label: 'Medium' },
  { value: '15em', label: 'Tall' },
  { value: '22em', label: 'Hero' },
];

export const MOODS: readonly Mood[] = ['dark', 'light', 'minimal', 'decorative'];

/** Hosts whose direct links satisfy AO3's URI grammar. Shown as a hint. */
export const BANNER_HOST_HINT =
  'imgur.com, postimg.cc, ibb.co and tumblr all work. Discord and Google Drive links do not.';

const HEX = /^#[0-9a-fA-F]{6}$/;
const LENGTH = /^\d{1,3}px$/;

/**
 * Coerce anything that came out of localStorage into a theme we can compile.
 *
 * Storage is user-writable and survives across versions of this app, so this is
 * the boundary where a half-valid object stops being a runtime error later and
 * becomes a known-good theme now. Unknown fields are dropped, not carried.
 */
export function validateTheme(input: unknown, fallback: SiteSkinTheme): SiteSkinTheme {
  if (!input || typeof input !== 'object') return fallback;
  const raw = input as Record<string, any>;

  const color = (v: unknown, d: string) => (typeof v === 'string' && HEX.test(v.trim()) ? v.trim().toLowerCase() : d);
  const font = (v: unknown, d: string) =>
    typeof v === 'string' && FONT_STACKS.some(f => f.value === v) ? v : d;
  const mood = (v: unknown, d: Mood): Mood => (MOODS.includes(v as Mood) ? (v as Mood) : d);

  const meta = raw.meta ?? {};
  const colors = raw.colors ?? {};
  const typography = raw.typography ?? {};
  const shape = raw.shape ?? {};
  const header = raw.header ?? {};
  const details = raw.details ?? {};

  const moods = Array.isArray(meta.moods)
    ? meta.moods.filter((m: unknown): m is Mood => MOODS.includes(m as Mood))
    : [];

  return {
    schemaVersion: 1,
    meta: {
      id: typeof meta.id === 'string' && meta.id ? meta.id.slice(0, 64) : fallback.meta.id,
      name: typeof meta.name === 'string' && meta.name ? meta.name.slice(0, 80) : fallback.meta.name,
      category: mood(meta.category, fallback.meta.category),
      moods: moods.length ? moods : fallback.meta.moods,
    },
    colors: {
      background: color(colors.background, fallback.colors.background),
      surface: color(colors.surface, fallback.colors.surface),
      text: color(colors.text, fallback.colors.text),
      accent: color(colors.accent, fallback.colors.accent),
    },
    typography: {
      headingFont: font(typography.headingFont, fallback.typography.headingFont),
      bodyFont: font(typography.bodyFont, fallback.typography.bodyFont),
      baseFontScale: FONT_SCALES.some(s => s.value === typography.baseFontScale)
        ? typography.baseFontScale
        : fallback.typography.baseFontScale,
    },
    shape: {
      cardRadius:
        typeof shape.cardRadius === 'string' && LENGTH.test(shape.cardRadius)
          ? shape.cardRadius
          : fallback.shape.cardRadius,
      tagStyle: TAG_STYLES.some(t => t.value === shape.tagStyle)
        ? shape.tagStyle
        : fallback.shape.tagStyle,
    },
    header: {
      // Validated, not merely length-capped. A stored theme is user-writable
      // and an address AO3 refuses would block export with no obvious cause,
      // so anything that fails the grammar is dropped at the boundary.
      bannerUrl:
        typeof header.bannerUrl === 'string' && checkAo3ImageUrl(header.bannerUrl).ok
          ? header.bannerUrl.trim().slice(0, 500)
          : '',
      bannerHeight: BANNER_HEIGHTS.some(h => h.value === header.bannerHeight)
        ? header.bannerHeight
        : fallback.header.bannerHeight,
      hideLogo: typeof header.hideLogo === 'boolean' ? header.hideLogo : fallback.header.hideLogo,
      textShadow:
        typeof header.textShadow === 'boolean' ? header.textShadow : fallback.header.textShadow,
      textColor: HEADER_TEXT_COLORS.some(c => c.value === header.textColor)
        ? header.textColor
        : fallback.header.textColor,
    },
    details: {
      divider: typeof details.divider === 'boolean' ? details.divider : fallback.details.divider,
      dropCap: typeof details.dropCap === 'boolean' ? details.dropCap : fallback.details.dropCap,
    },
  };
}
