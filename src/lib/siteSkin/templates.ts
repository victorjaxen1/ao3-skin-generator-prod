import { HeaderGradient, SiteSkinTheme } from './theme';

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
 * Three later fields follow one rule each, so the catalog stays predictable:
 * `scrollbar` is on everywhere — a scrollbar in the wrong colour is the one
 * piece of chrome no theme wants — `tagColors` is off for every template
 * carrying the `minimal` mood, because four tag hues is exactly what a reader
 * choosing "minimal" is asking us not to do, and `gradient` follows the mood
 * the same way (see GRADIENT_BY_MOOD below).
 */

const GEORGIA = 'Georgia, serif';
const PALATINO = "'Palatino Linotype', Palatino, serif";
const TREBUCHET = "'Trebuchet MS', Verdana, sans-serif";
const ARIAL = 'Arial, Helvetica, sans-serif';
const COURIER = "'Courier New', Courier, monospace";

/**
 * **How a premade gets a header of its own, without us shipping an image.**
 *
 * Until now every template painted `#header` a flat accent, which is the one
 * place a palette-only theme looks like a recolour rather than a design. The
 * fix considered first was shipping our own banner images; it was rejected, and
 * the reasons are worth keeping because they are not technical. It would make
 * us a *permanent* image host — a saved skin points at our URL forever, renaming
 * a file breaks every skin using it silently, and every AO3 page view by every
 * user of that skin bills bandwidth to us, scaling with the feature succeeding.
 * Original art built to evoke a franchise would also move the IP question from
 * "a palette is nobody's property" (settled) to trade dress (not settled).
 *
 * A gradient derived from the accent costs zero bytes, has no host, cannot
 * expire, and adds no declaration shape the release gate does not already have
 * to prove. So the catalog uses one, by mood:
 *
 * | Mood carried | Gradient | Why |
 * | --- | --- | --- |
 * | `minimal` | `none` | Flat *is* the design. Same argument that turns
 *   `tagColors` off for these six — a reader choosing "minimal" is asking us to
 *   stop, and on High Contrast a fade would eat the contrast it is named for |
 * | `decorative` | `diagonal` | The most expressive of the three, on the themes
 *   whose whole point is expression |
 * | neither | `vertical` | A quiet darkening toward the nav bar |
 *
 * `minimal` is tested before `decorative` because Terminal Green carries both
 * and the restraint has to win.
 *
 * The four banner-ready templates get one too. It layers *under* whatever image
 * the user pastes, so it costs them nothing and it means those four are not
 * bare headers while the banner field is still empty.
 */
export function gradientFor(moods: readonly SiteSkinTheme['meta']['moods'][number][]): HeaderGradient {
  if (moods.includes('minimal')) return 'none';
  return moods.includes('decorative') ? 'diagonal' : 'vertical';
}

/**
 * **Off in all sixteen, and that is a decision rather than an oversight.**
 *
 * Turning AO3's required-tag icons into words changes the shape of every blurb
 * in every listing on the archive — the icon block goes away, the header
 * reflows, and four phrases appear where four symbols were. It is the most
 * requested customisation in the corpus and the one accessibility win on this
 * roadmap, and it is still not something a reader who picked *Rose Tea* asked
 * for. A palette should not rewrite what the page says.
 *
 * So it ships as a control a reader turns on, one section below the palette,
 * rather than as a property of any theme. If a later template wants it on, it
 * is one field — but then that template is making a claim about how AO3 should
 * read, and it should say so on its card.
 */
/**
 * Depth, off in all sixteen — for now, and unlike the reading controls this is
 * a *temporary* default rather than a principled one.
 *
 * The reading controls are off because they change what a page says, and a
 * palette has no business doing that. Texture and elevation only change how it
 * looks, which is exactly what a template is for. They ship off here because
 * the sixteen were designed without them and turning one on retroactively
 * would change a theme somebody already saved; the templates that *use* depth
 * are the ones §18b's catalog pass adds next.
 */
const SURFACE_DEFAULTS: SiteSkinTheme['surface'] = {
  texture: 'none',
  elevation: 'flat',
  glow: false,
  frame: 'none',
};

const READING_DEFAULTS: SiteSkinTheme['reading'] = {
  requiredTagsAsText: false,
  // Same argument, one control along. Group labels rewrite every listing on the
  // archive — "Relationships:" where there was nothing — and a reader who
  // picked a palette did not ask for that either.
  tagLabels: false,
  // AO3's own separator, which emits no CSS at all.
  tagSeparator: 'comma',
  // The third of the same argument: icons where words were is a change to what
  // every listing says, and a palette does not get to make it.
  statIcons: false,
};

/** The original twelve are pure colour themes; the banner slot starts empty. */
function noBanner(gradient: HeaderGradient): SiteSkinTheme['header'] {
  return {
    bannerUrl: '',
    bannerHeight: '15em',
    hideLogo: false,
    textColor: 'auto',
    textShadow: false,
    gradient,
  };
}

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
function bannerReady(height: string, gradient: HeaderGradient): SiteSkinTheme['header'] {
  return {
    bannerUrl: '',
    bannerHeight: height,
    hideLogo: true,
    textShadow: true,
    textColor: 'auto',
    // Under the banner, not instead of it — so these four are not bare
    // accent blocks while the address field is still empty, and a banner that
    // dies later degrades to a gradient rather than to a flat fill.
    gradient,
  };
}

export const TEMPLATES: readonly SiteSkinTheme[] = [
  {
    schemaVersion: 1,
    meta: { id: 'moonlit', name: 'Moonlit Library', category: 'dark', moods: ['dark', 'decorative'] },
    colors: { background: '#101725', surface: '#182238', text: '#e8e0cf', accent: '#7761a8' },
    typography: { headingFont: GEORGIA, bodyFont: GEORGIA, baseFontScale: 1, headingStyle: 'normal' },
    shape: { cardRadius: '10px', tagStyle: 'pill', tagColors: true },
    header: noBanner('diagonal'),
    surface: SURFACE_DEFAULTS,
    reading: READING_DEFAULTS,
    details: { ornament: 'none', divider: true, dropCap: true, scrollbar: true },
  },
  {
    schemaVersion: 1,
    meta: { id: 'paper', name: 'Paper & Ink', category: 'light', moods: ['light', 'minimal'] },
    colors: { background: '#f4efe5', surface: '#fffdf8', text: '#2f2a24', accent: '#7f2e2e' },
    typography: { headingFont: PALATINO, bodyFont: GEORGIA, baseFontScale: 1, headingStyle: 'normal' },
    shape: { cardRadius: '4px', tagStyle: 'label', tagColors: false },
    header: noBanner('none'),
    surface: SURFACE_DEFAULTS,
    reading: READING_DEFAULTS,
    details: { ornament: 'none', divider: false, dropCap: true, scrollbar: true },
  },
  {
    schemaVersion: 1,
    meta: { id: 'lavender', name: 'Lavender Cloud', category: 'light', moods: ['light'] },
    colors: { background: '#f1edf7', surface: '#fbf9ff', text: '#383142', accent: '#735a9b' },
    typography: { headingFont: TREBUCHET, bodyFont: TREBUCHET, baseFontScale: 1, headingStyle: 'normal' },
    shape: { cardRadius: '18px', tagStyle: 'pill', tagColors: true },
    header: noBanner('vertical'),
    surface: SURFACE_DEFAULTS,
    reading: READING_DEFAULTS,
    details: { ornament: 'none', divider: false, dropCap: false, scrollbar: true },
  },
  {
    schemaVersion: 1,
    meta: { id: 'crimson', name: 'Crimson Archive', category: 'decorative', moods: ['light', 'decorative'] },
    colors: { background: '#f5eded', surface: '#fffafa', text: '#2d2326', accent: '#8f1738' },
    typography: { headingFont: GEORGIA, bodyFont: ARIAL, baseFontScale: 1, headingStyle: 'normal' },
    shape: { cardRadius: '10px', tagStyle: 'label', tagColors: true },
    header: noBanner('diagonal'),
    surface: SURFACE_DEFAULTS,
    reading: READING_DEFAULTS,
    details: { ornament: 'none', divider: true, dropCap: true, scrollbar: true },
  },
  {
    schemaVersion: 1,
    meta: { id: 'forest', name: 'Forest Study', category: 'dark', moods: ['dark', 'decorative'] },
    colors: { background: '#17251e', surface: '#20342a', text: '#eee5ce', accent: '#b69255' },
    typography: { headingFont: PALATINO, bodyFont: GEORGIA, baseFontScale: 1, headingStyle: 'normal' },
    shape: { cardRadius: '4px', tagStyle: 'label', tagColors: true },
    header: noBanner('diagonal'),
    surface: SURFACE_DEFAULTS,
    reading: READING_DEFAULTS,
    details: { ornament: 'none', divider: true, dropCap: true, scrollbar: true },
  },
  {
    schemaVersion: 1,
    meta: { id: 'ocean', name: 'Ocean Glass', category: 'minimal', moods: ['light', 'minimal'] },
    colors: { background: '#eaf4f4', surface: '#f9ffff', text: '#243536', accent: '#287c83' },
    typography: { headingFont: TREBUCHET, bodyFont: ARIAL, baseFontScale: 1, headingStyle: 'normal' },
    shape: { cardRadius: '18px', tagStyle: 'pill', tagColors: false },
    header: noBanner('none'),
    surface: SURFACE_DEFAULTS,
    reading: READING_DEFAULTS,
    details: { ornament: 'none', divider: false, dropCap: false, scrollbar: true },
  },
  {
    schemaVersion: 1,
    meta: { id: 'rose', name: 'Rose Tea', category: 'decorative', moods: ['light', 'decorative'] },
    colors: { background: '#f6eceb', surface: '#fffafa', text: '#463638', accent: '#a65368' },
    typography: { headingFont: PALATINO, bodyFont: GEORGIA, baseFontScale: 1, headingStyle: 'normal' },
    shape: { cardRadius: '18px', tagStyle: 'pill', tagColors: true },
    header: noBanner('diagonal'),
    surface: SURFACE_DEFAULTS,
    reading: READING_DEFAULTS,
    details: { ornament: 'none', divider: true, dropCap: true, scrollbar: true },
  },
  {
    schemaVersion: 1,
    meta: { id: 'contrast', name: 'High Contrast', category: 'minimal', moods: ['dark', 'minimal'] },
    colors: { background: '#090909', surface: '#171717', text: '#ffffff', accent: '#ffdf56' },
    typography: { headingFont: ARIAL, bodyFont: ARIAL, baseFontScale: 1.1, headingStyle: 'normal' },
    shape: { cardRadius: '0px', tagStyle: 'plain', tagColors: false },
    header: noBanner('none'),
    surface: SURFACE_DEFAULTS,
    reading: READING_DEFAULTS,
    details: { ornament: 'none', divider: false, dropCap: false, scrollbar: true },
  },
  {
    schemaVersion: 1,
    meta: { id: 'terminal', name: 'Terminal Green', category: 'dark', moods: ['dark', 'minimal'] },
    colors: { background: '#07110b', surface: '#0d1d12', text: '#c8f5d2', accent: '#52cf78' },
    typography: { headingFont: TREBUCHET, bodyFont: TREBUCHET, baseFontScale: 1, headingStyle: 'normal' },
    shape: { cardRadius: '4px', tagStyle: 'label', tagColors: false },
    header: noBanner('none'),
    surface: SURFACE_DEFAULTS,
    reading: READING_DEFAULTS,
    details: { ornament: 'none', divider: false, dropCap: false, scrollbar: true },
  },
  {
    schemaVersion: 1,
    meta: { id: 'golden', name: 'Golden Hour', category: 'light', moods: ['light'] },
    colors: { background: '#f5ead5', surface: '#fff9ed', text: '#3c3024', accent: '#b4662d' },
    typography: { headingFont: GEORGIA, bodyFont: ARIAL, baseFontScale: 1, headingStyle: 'normal' },
    shape: { cardRadius: '10px', tagStyle: 'pill', tagColors: true },
    header: noBanner('vertical'),
    surface: SURFACE_DEFAULTS,
    reading: READING_DEFAULTS,
    details: { ornament: 'none', divider: false, dropCap: false, scrollbar: true },
  },
  {
    schemaVersion: 1,
    meta: { id: 'gothic', name: 'Gothic Velvet', category: 'decorative', moods: ['dark', 'decorative'] },
    // Accent lightened from the prototype's #a5375d, which sat at 2.69:1
    // against these surfaces — every link and tag on the page, below the bar.
    // #b35575 is what our own "Fix accent colour" produces from it, so the
    // catalog and the repair button agree on what this theme should be.
    colors: { background: '#180d13', surface: '#2b151f', text: '#f1dfe5', accent: '#b35575' },
    typography: { headingFont: PALATINO, bodyFont: GEORGIA, baseFontScale: 1, headingStyle: 'normal' },
    shape: { cardRadius: '4px', tagStyle: 'label', tagColors: true },
    header: noBanner('diagonal'),
    surface: SURFACE_DEFAULTS,
    reading: READING_DEFAULTS,
    details: { ornament: 'none', divider: true, dropCap: true, scrollbar: true },
  },
  {
    schemaVersion: 1,
    meta: { id: 'clean', name: 'Clean Slate', category: 'minimal', moods: ['light', 'minimal'] },
    colors: { background: '#f2f3f4', surface: '#ffffff', text: '#25282a', accent: '#52606d' },
    typography: { headingFont: ARIAL, bodyFont: ARIAL, baseFontScale: 1, headingStyle: 'normal' },
    shape: { cardRadius: '4px', tagStyle: 'label', tagColors: false },
    header: noBanner('none'),
    surface: SURFACE_DEFAULTS,
    reading: READING_DEFAULTS,
    details: { ornament: 'none', divider: false, dropCap: false, scrollbar: true },
  },

  // ── Banner-ready ────────────────────────────────────────────────────────
  {
    schemaVersion: 1,
    meta: { id: 'academia', name: 'Midnight Academia', category: 'dark', moods: ['dark', 'decorative'] },
    colors: { background: '#0f1117', surface: '#191d28', text: '#e6e0d4', accent: '#c9a227' },
    typography: { headingFont: PALATINO, bodyFont: GEORGIA, baseFontScale: 1, headingStyle: 'normal' },
    shape: { cardRadius: '4px', tagStyle: 'label', tagColors: true },
    header: bannerReady('15em', 'diagonal'),
    surface: SURFACE_DEFAULTS,
    reading: READING_DEFAULTS,
    details: { ornament: 'none', divider: true, dropCap: true, scrollbar: true },
  },
  {
    schemaVersion: 1,
    meta: { id: 'shoujo', name: 'Soft Shoujo', category: 'light', moods: ['light', 'decorative'] },
    colors: { background: '#fdf2f6', surface: '#fffafc', text: '#46323c', accent: '#b4557e' },
    typography: { headingFont: TREBUCHET, bodyFont: TREBUCHET, baseFontScale: 1, headingStyle: 'normal' },
    shape: { cardRadius: '18px', tagStyle: 'pill', tagColors: true },
    header: bannerReady('15em', 'diagonal'),
    surface: SURFACE_DEFAULTS,
    reading: READING_DEFAULTS,
    details: { ornament: 'none', divider: false, dropCap: true, scrollbar: true },
  },
  {
    schemaVersion: 1,
    meta: { id: 'neon', name: 'Neon Terminal', category: 'dark', moods: ['dark', 'minimal'] },
    colors: { background: '#05070a', surface: '#0d1218', text: '#d5e6ea', accent: '#35d0c0' },
    typography: { headingFont: COURIER, bodyFont: COURIER, baseFontScale: 1, headingStyle: 'normal' },
    shape: { cardRadius: '0px', tagStyle: 'plain', tagColors: false },
    header: bannerReady('10em', 'none'),
    surface: SURFACE_DEFAULTS,
    reading: READING_DEFAULTS,
    details: { ornament: 'none', divider: false, dropCap: false, scrollbar: true },
  },
  {
    schemaVersion: 1,
    meta: { id: 'western', name: 'Sun-Bleached Western', category: 'decorative', moods: ['light', 'decorative'] },
    colors: { background: '#f3e7d3', surface: '#fdf6ea', text: '#3b2f22', accent: '#9c4a21' },
    typography: { headingFont: GEORGIA, bodyFont: GEORGIA, baseFontScale: 1, headingStyle: 'normal' },
    shape: { cardRadius: '4px', tagStyle: 'label', tagColors: true },
    header: bannerReady('22em', 'diagonal'),
    surface: SURFACE_DEFAULTS,
    reading: READING_DEFAULTS,
    details: { ornament: 'none', divider: true, dropCap: true, scrollbar: true },
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
    surface: { ...theme.surface },
    reading: { ...theme.reading },
    details: { ...theme.details },
  };
}
