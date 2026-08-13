import { SiteSkinTheme } from './theme';

/**
 * The launch catalog.
 *
 * Ported from the UX prototype's twelve templates, which were well chosen and
 * already carried exactly our field set. Three things changed in the port:
 *
 *  - `radius` snapped to the four values the Card corners control offers, so
 *    opening a template always shows the control in a state it can return to.
 *  - `tagRadius` became a named `tagStyle`; 999px → pill, small → label,
 *    0 → plain.
 *  - font strings normalised to entries in FONT_STACKS, which are the stacks
 *    verified against AO3's `sanitize_css_font`.
 *
 * `category` is the badge; `moods` is what the filter chips match. Most of
 * these are honestly two things at once and the chips should say so.
 *
 * Two later fields follow one rule each, so the catalog stays predictable:
 * `scrollbar` is on everywhere — a scrollbar in the wrong colour is the one
 * piece of chrome no theme wants — and `tagColors` is off for every template
 * carrying the `minimal` mood, because four tag hues is exactly what a reader
 * choosing "minimal" is asking us not to do.
 */

const GEORGIA = 'Georgia, serif';
const PALATINO = "'Palatino Linotype', Palatino, serif";
const TREBUCHET = "'Trebuchet MS', Verdana, sans-serif";
const ARIAL = 'Arial, Helvetica, sans-serif';
const COURIER = "'Courier New', Courier, monospace";

/** The original twelve are pure colour themes; the banner slot starts empty. */
const NO_BANNER: SiteSkinTheme['header'] = {
  bannerUrl: '',
  bannerHeight: '15em',
  hideLogo: false,
  textColor: 'auto',
  textShadow: false,
};

/**
 * Tuned for a banner the user supplies: the AO3 roundel out of the way, a glow
 * ready for whatever brightness the image turns out to be, and a header colour
 * chosen to sit *underneath* a photograph rather than to be looked at.
 *
 * **We ship no images.** These are aesthetics, not fandoms. Naming a preset
 * after a series and baking in its art would make us the distributor of
 * somebody's trademark and somebody else's artwork — which is a different act
 * from one reader choosing an image for their own browser. The fandom
 * specificity comes from the URL the user pastes, and that is theirs to
 * choose.
 */
function bannerReady(height: string): SiteSkinTheme['header'] {
  return { bannerUrl: '', bannerHeight: height, hideLogo: true, textShadow: true, textColor: 'auto' };
}

export const TEMPLATES: readonly SiteSkinTheme[] = [
  {
    schemaVersion: 1,
    meta: { id: 'moonlit', name: 'Moonlit Library', category: 'dark', moods: ['dark', 'decorative'] },
    colors: { background: '#101725', surface: '#182238', text: '#e8e0cf', accent: '#7761a8' },
    typography: { headingFont: GEORGIA, bodyFont: GEORGIA, baseFontScale: 1 },
    shape: { cardRadius: '10px', tagStyle: 'pill', tagColors: true },
    header: NO_BANNER,
    details: { divider: true, dropCap: true, scrollbar: true },
  },
  {
    schemaVersion: 1,
    meta: { id: 'paper', name: 'Paper & Ink', category: 'light', moods: ['light', 'minimal'] },
    colors: { background: '#f4efe5', surface: '#fffdf8', text: '#2f2a24', accent: '#7f2e2e' },
    typography: { headingFont: PALATINO, bodyFont: GEORGIA, baseFontScale: 1 },
    shape: { cardRadius: '4px', tagStyle: 'label', tagColors: false },
    header: NO_BANNER,
    details: { divider: false, dropCap: true, scrollbar: true },
  },
  {
    schemaVersion: 1,
    meta: { id: 'lavender', name: 'Lavender Cloud', category: 'light', moods: ['light'] },
    colors: { background: '#f1edf7', surface: '#fbf9ff', text: '#383142', accent: '#735a9b' },
    typography: { headingFont: TREBUCHET, bodyFont: TREBUCHET, baseFontScale: 1 },
    shape: { cardRadius: '18px', tagStyle: 'pill', tagColors: true },
    header: NO_BANNER,
    details: { divider: false, dropCap: false, scrollbar: true },
  },
  {
    schemaVersion: 1,
    meta: { id: 'crimson', name: 'Crimson Archive', category: 'decorative', moods: ['light', 'decorative'] },
    colors: { background: '#f5eded', surface: '#fffafa', text: '#2d2326', accent: '#8f1738' },
    typography: { headingFont: GEORGIA, bodyFont: ARIAL, baseFontScale: 1 },
    shape: { cardRadius: '10px', tagStyle: 'label', tagColors: true },
    header: NO_BANNER,
    details: { divider: true, dropCap: true, scrollbar: true },
  },
  {
    schemaVersion: 1,
    meta: { id: 'forest', name: 'Forest Study', category: 'dark', moods: ['dark', 'decorative'] },
    colors: { background: '#17251e', surface: '#20342a', text: '#eee5ce', accent: '#b69255' },
    typography: { headingFont: PALATINO, bodyFont: GEORGIA, baseFontScale: 1 },
    shape: { cardRadius: '4px', tagStyle: 'label', tagColors: true },
    header: NO_BANNER,
    details: { divider: true, dropCap: true, scrollbar: true },
  },
  {
    schemaVersion: 1,
    meta: { id: 'ocean', name: 'Ocean Glass', category: 'minimal', moods: ['light', 'minimal'] },
    colors: { background: '#eaf4f4', surface: '#f9ffff', text: '#243536', accent: '#287c83' },
    typography: { headingFont: TREBUCHET, bodyFont: ARIAL, baseFontScale: 1 },
    shape: { cardRadius: '18px', tagStyle: 'pill', tagColors: false },
    header: NO_BANNER,
    details: { divider: false, dropCap: false, scrollbar: true },
  },
  {
    schemaVersion: 1,
    meta: { id: 'rose', name: 'Rose Tea', category: 'decorative', moods: ['light', 'decorative'] },
    colors: { background: '#f6eceb', surface: '#fffafa', text: '#463638', accent: '#a65368' },
    typography: { headingFont: PALATINO, bodyFont: GEORGIA, baseFontScale: 1 },
    shape: { cardRadius: '18px', tagStyle: 'pill', tagColors: true },
    header: NO_BANNER,
    details: { divider: true, dropCap: true, scrollbar: true },
  },
  {
    schemaVersion: 1,
    meta: { id: 'contrast', name: 'High Contrast', category: 'minimal', moods: ['dark', 'minimal'] },
    colors: { background: '#090909', surface: '#171717', text: '#ffffff', accent: '#ffdf56' },
    typography: { headingFont: ARIAL, bodyFont: ARIAL, baseFontScale: 1.1 },
    shape: { cardRadius: '0px', tagStyle: 'plain', tagColors: false },
    header: NO_BANNER,
    details: { divider: false, dropCap: false, scrollbar: true },
  },
  {
    schemaVersion: 1,
    meta: { id: 'terminal', name: 'Terminal Green', category: 'dark', moods: ['dark', 'minimal'] },
    colors: { background: '#07110b', surface: '#0d1d12', text: '#c8f5d2', accent: '#52cf78' },
    typography: { headingFont: TREBUCHET, bodyFont: TREBUCHET, baseFontScale: 1 },
    shape: { cardRadius: '4px', tagStyle: 'label', tagColors: false },
    header: NO_BANNER,
    details: { divider: false, dropCap: false, scrollbar: true },
  },
  {
    schemaVersion: 1,
    meta: { id: 'golden', name: 'Golden Hour', category: 'light', moods: ['light'] },
    colors: { background: '#f5ead5', surface: '#fff9ed', text: '#3c3024', accent: '#b4662d' },
    typography: { headingFont: GEORGIA, bodyFont: ARIAL, baseFontScale: 1 },
    shape: { cardRadius: '10px', tagStyle: 'pill', tagColors: true },
    header: NO_BANNER,
    details: { divider: false, dropCap: false, scrollbar: true },
  },
  {
    schemaVersion: 1,
    meta: { id: 'gothic', name: 'Gothic Velvet', category: 'decorative', moods: ['dark', 'decorative'] },
    // Accent lightened from the prototype's #a5375d, which sat at 2.69:1
    // against these surfaces — every link and tag on the page, below the bar.
    // #b35575 is what our own "Fix accent colour" produces from it, so the
    // catalog and the repair button agree on what this theme should be.
    colors: { background: '#180d13', surface: '#2b151f', text: '#f1dfe5', accent: '#b35575' },
    typography: { headingFont: PALATINO, bodyFont: GEORGIA, baseFontScale: 1 },
    shape: { cardRadius: '4px', tagStyle: 'label', tagColors: true },
    header: NO_BANNER,
    details: { divider: true, dropCap: true, scrollbar: true },
  },
  {
    schemaVersion: 1,
    meta: { id: 'clean', name: 'Clean Slate', category: 'minimal', moods: ['light', 'minimal'] },
    colors: { background: '#f2f3f4', surface: '#ffffff', text: '#25282a', accent: '#52606d' },
    typography: { headingFont: ARIAL, bodyFont: ARIAL, baseFontScale: 1 },
    shape: { cardRadius: '4px', tagStyle: 'label', tagColors: false },
    header: NO_BANNER,
    details: { divider: false, dropCap: false, scrollbar: true },
  },

  // ── Banner-ready ────────────────────────────────────────────────────────
  {
    schemaVersion: 1,
    meta: { id: 'academia', name: 'Midnight Academia', category: 'dark', moods: ['dark', 'decorative'] },
    colors: { background: '#0f1117', surface: '#191d28', text: '#e6e0d4', accent: '#c9a227' },
    typography: { headingFont: PALATINO, bodyFont: GEORGIA, baseFontScale: 1 },
    shape: { cardRadius: '4px', tagStyle: 'label', tagColors: true },
    header: bannerReady('15em'),
    details: { divider: true, dropCap: true, scrollbar: true },
  },
  {
    schemaVersion: 1,
    meta: { id: 'shoujo', name: 'Soft Shoujo', category: 'light', moods: ['light', 'decorative'] },
    colors: { background: '#fdf2f6', surface: '#fffafc', text: '#46323c', accent: '#b4557e' },
    typography: { headingFont: TREBUCHET, bodyFont: TREBUCHET, baseFontScale: 1 },
    shape: { cardRadius: '18px', tagStyle: 'pill', tagColors: true },
    header: bannerReady('15em'),
    details: { divider: false, dropCap: true, scrollbar: true },
  },
  {
    schemaVersion: 1,
    meta: { id: 'neon', name: 'Neon Terminal', category: 'dark', moods: ['dark', 'minimal'] },
    colors: { background: '#05070a', surface: '#0d1218', text: '#d5e6ea', accent: '#35d0c0' },
    typography: { headingFont: COURIER, bodyFont: COURIER, baseFontScale: 1 },
    shape: { cardRadius: '0px', tagStyle: 'plain', tagColors: false },
    header: bannerReady('10em'),
    details: { divider: false, dropCap: false, scrollbar: true },
  },
  {
    schemaVersion: 1,
    meta: { id: 'western', name: 'Sun-Bleached Western', category: 'decorative', moods: ['light', 'decorative'] },
    colors: { background: '#f3e7d3', surface: '#fdf6ea', text: '#3b2f22', accent: '#9c4a21' },
    typography: { headingFont: GEORGIA, bodyFont: GEORGIA, baseFontScale: 1 },
    shape: { cardRadius: '4px', tagStyle: 'label', tagColors: true },
    header: bannerReady('22em'),
    details: { divider: true, dropCap: true, scrollbar: true },
  },
];

export const TEMPLATE_DESCRIPTIONS: Readonly<Record<string, string>> = {
  moonlit: 'Deep navy, parchment type, quiet glow',
  paper: 'Warm paper with crisp editorial type',
  lavender: 'Soft violet with gentle rounded cards',
  crimson: 'A richer, calmer take on classic AO3',
  forest: 'Moss, paper, and a vintage reading room',
  ocean: 'Clear blue-green with airy spacing',
  rose: 'Muted blush and cozy book typography',
  contrast: 'Black, white, and unmistakable hierarchy',
  terminal: 'Retro monochrome without visual clutter',
  golden: 'Warm amber and soft cream surfaces',
  gothic: 'Black cherry with ornate serif details',
  clean: 'Neutral, compact, and distraction-free',
  academia: 'Ink and old gold — add your own banner',
  shoujo: 'Blush pastels and rounded cards — add your own banner',
  neon: 'Monospace on black, cyan glow — add your own banner',
  western: 'Sand, rust and a wide horizon — add your own banner',
};

/** Templates whose header is designed around an image the user supplies. */
export const BANNER_READY_IDS: readonly string[] = ['academia', 'shoujo', 'neon', 'western'];

export const DEFAULT_TEMPLATE = TEMPLATES[0];

export function findTemplate(id: string): SiteSkinTheme | undefined {
  return TEMPLATES.find(t => t.meta.id === id);
}

/** A fresh, mutable copy — the editor must never write into the catalog. */
export function cloneTheme(theme: SiteSkinTheme): SiteSkinTheme {
  return {
    schemaVersion: 1,
    meta: { ...theme.meta, moods: [...theme.meta.moods] },
    colors: { ...theme.colors },
    typography: { ...theme.typography },
    header: { ...theme.header },
    shape: { ...theme.shape },
    details: { ...theme.details },
  };
}
