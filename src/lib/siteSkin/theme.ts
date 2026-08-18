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
export type HeaderGradient = 'none' | 'vertical' | 'diagonal';
export type TagSeparator = 'comma' | 'bullet' | 'line';

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
    /**
     * Colour tags by what they *are* — warnings, relationships, characters,
     * freeforms — instead of painting all four with the accent.
     *
     * Semantic rather than decorative, which is why it is here at all: the
     * colour tells you what kind of tag you are reading before you read it.
     * The four hues are derived from the accent (see colors.tagTypeColors), so
     * a theme stays a theme rather than acquiring four unrelated colours.
     */
    tagColors: boolean;
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
    /**
     * A gradient painted on the header, derived from the accent — no image, no
     * host, nothing to expire.
     *
     * This is what gives a palette-only template a header of its own. The
     * alternative considered and rejected was shipping our own banner images:
     * it would have made us a permanent image host (every AO3 page view of
     * every skin using one, billed to us, forever — and a renamed file breaks
     * skins we cannot contact the owners of), and it would have put us in the
     * position §11 and §16 both refuse, of distributing artwork. A gradient
     * costs zero bytes and cannot break.
     *
     * It layers *under* `bannerUrl` rather than competing with it, so the two
     * controls are independent and a dead banner degrades to the gradient.
     */
    gradient: HeaderGradient;
  };
  /**
   * Legibility, not decoration — which is why it is not part of `details`.
   *
   * `details` is a divider glyph and a drop cap: things a reader turns on
   * because they like them. These change what a page *says*, and the first one
   * makes AO3 more usable rather than merely prettier.
   */
  reading: {
    /**
     * Show AO3's rating / warning / category / status icons as their real
     * words.
     *
     * This does not invent content. `tags_helper.rb#get_symbols_for` already
     * puts the words in the DOM inside `span.text` and then hides them —
     * `height: 0; width: 0; font-size: 0.001em; color: transparent` — while a
     * sprite is painted over the outer span. So the control un-hides what is
     * there, which is why it is an accessibility win rather than a redesign:
     * the icons carry meaning that only a reader who has memorised them can
     * read, and everyone else hovers for a tooltip.
     *
     * Off in every shipped template. It changes the shape of every listing on
     * the archive, and a reader who picked a colour scheme did not ask for
     * that.
     */
    requiredTagsAsText: boolean;
    /**
     * Print the tag group's name — "Relationships:", "Characters:" — before the
     * first tag of each group in a listing.
     *
     * AO3 emits one `<li>` per tag, every tag in a group carrying the group's
     * class and nothing marking where a group starts (`tags_helper.rb#blurb_tag_block`).
     * So a "group" is a run of same-class siblings, and the label belongs on the
     * first `li` of each run — which CSS can only express by enumerating the
     * ways one group can follow another. See compile.ts for the ten rules.
     *
     * Off in every shipped template, for `requiredTagsAsText`'s reason: it
     * changes what every listing on the archive says.
     */
    tagLabels: boolean;
    /**
     * How tags in a listing are separated from one another.
     *
     * AO3 puts the comma in CSS rather than in the markup — `.commas li:after
     * { content: ", " }` in 09-roles-states.css — so all three options are one
     * owned selector and `comma` is the archive's own default, emitted as
     * nothing at all.
     *
     * `line` is the one readers ask for: one tag group per line, which is the
     * whole reason the adjacency list above is worth building.
     */
    tagSeparator: TagSeparator;
    /**
     * Replace the stat labels a listing repeats on every row — "Words:",
     * "Kudos:", "Hits:" — with one icon each.
     *
     * **The label is hidden, not removed.** The corpus add-on does
     * `dl.stats dt { display: none }`, which takes it out of the accessibility
     * tree and leaves a screen reader reading a bare number. Ours uses AO3's
     * own visually-hidden technique, so the word is still announced and only
     * the pixels go.
     *
     * Only the seven stats that get an icon are hidden. A work page also
     * carries "Published:" and a date, and a listing carries "Language:" —
     * neither has an obvious glyph, and a date with no label at all is worse
     * than a date with one.
     */
    statIcons: boolean;
  };
  details: {
    divider: boolean;
    dropCap: boolean;
    /**
     * A scrollbar in the theme's colours, via `::-webkit-scrollbar`.
     *
     * Legal because AO3 validates *declarations*, never selectors — the only
     * selector it refuses is one containing `@font-face` (css_cleaner.rb maps
     * `rs.selectors` through a gsub and a prefix test and nothing else). The
     * declarations inside are ordinary `width`, `background-color` and
     * `border-radius`.
     *
     * Chromium-only by nature, and none of the three published skins in plan
     * §11 does it.
     */
    scrollbar: boolean;
  };
}

/** Which shelf a stack sits on in the picker. Drives the `<optgroup>`s. */
export type FontGroup = 'serif' | 'sans' | 'display' | 'script' | 'mono';

/** Where a stack may be used. Script and display faces are headings only. */
export type FontRole = 'heading' | 'body';

export interface FontStack {
  value: string;
  label: string;
  group: FontGroup;
  roles: readonly FontRole[];
}

export const FONT_GROUP_LABELS: Record<FontGroup, string> = {
  serif: 'Serif',
  sans: 'Sans-serif',
  display: 'Display',
  script: 'Handwriting',
  mono: 'Monospace',
};

/**
 * Installed fonts only — a bank of *names*, never of files.
 *
 * AO3 rejects `@font-face` outright, `src` is not one of its 181 allowed
 * properties, and `url()` is permitted only on background, border and
 * list-style. There is therefore no reachable path to loading a font file:
 * not one we host, and not one from Google Fonts or any other library. A
 * `font-family` here is a **suggestion** — the reader's device walks the stack
 * until it finds something it already has, then falls through to AO3's own
 * defaults, then to whatever it defaults to on its own.
 *
 * That is the whole technique, and it is what published AO3 authors do: the
 * long-running tutorial "Fonts, and colors, and work skins, oh my!"
 * (archiveofourown.org/works/28934610) says it outright — *"Since embedding the
 * fonts isn't an option on AO3, you can only enter a picture (hosted elsewhere)
 * or hope that your reader's device has at least one of the fonts that you list
 * in a given rule"* — and its own stacks run up to fifteen names deep.
 *
 * So each stack below names a **Windows candidate, then a macOS counterpart,
 * then a generic family**. Android and iOS carry few of these classics and will
 * mostly land on the generic, which is expected: the chains are ordered so that
 * the thing a reader falls through to is still a defensible choice rather than
 * an accident.
 *
 * Every family name must survive `sanitize_css_font`, which allows letters,
 * digits, dashes and spaces and nothing else — no periods, no underscores.
 * `tests/site-skin.unit.spec.ts` runs all of these through our port of that
 * rule, so a stray character fails the build rather than a user's save.
 *
 * ## Do not edit the first seven values
 *
 * `validateTheme` accepts a font only if the string is a member of this list,
 * and a stored theme holds the literal stack string. Deepening
 * `'Georgia, serif'` into a longer chain would therefore not be an improvement
 * — it would silently reset every saved theme that had chosen it, because the
 * old string would no longer be found here. **This list is append-only.** A test
 * pins those seven byte for byte.
 */
export const FONT_STACKS: readonly FontStack[] = [
  // ── The original seven. Byte-identical, permanently. See above. ──────────
  { value: 'Georgia, serif', label: 'Georgia — classic book', group: 'serif', roles: ['heading', 'body'] },
  { value: "'Palatino Linotype', Palatino, serif", label: 'Palatino — literary', group: 'serif', roles: ['heading', 'body'] },
  { value: "'Times New Roman', Times, serif", label: 'Times — newsprint', group: 'serif', roles: ['heading', 'body'] },
  { value: 'Arial, Helvetica, sans-serif', label: 'Arial — plain', group: 'sans', roles: ['heading', 'body'] },
  { value: "'Trebuchet MS', Verdana, sans-serif", label: 'Trebuchet — friendly', group: 'sans', roles: ['heading', 'body'] },
  { value: 'Verdana, Geneva, sans-serif', label: 'Verdana — wide and clear', group: 'sans', roles: ['heading', 'body'] },
  { value: "'Courier New', Courier, monospace", label: 'Courier — typewriter', group: 'mono', roles: ['heading', 'body'] },

  // ── Serif ────────────────────────────────────────────────────────────────
  { value: 'Cambria, Constantia, Georgia, serif', label: 'Cambria — modern book', group: 'serif', roles: ['heading', 'body'] },
  { value: "Baskerville, 'Baskerville Old Face', 'Hoefler Text', Georgia, serif", label: 'Baskerville — elegant', group: 'serif', roles: ['heading', 'body'] },
  { value: "Garamond, 'Book Antiqua', Palatino, serif", label: 'Garamond — old-style', group: 'serif', roles: ['heading', 'body'] },
  // Didot and Bodoni are high-contrast faces: hairline strokes that disappear
  // at body sizes on a low-DPI screen. Heading only, deliberately.
  { value: "Didot, 'Bodoni MT', 'Times New Roman', serif", label: 'Didot — high fashion', group: 'serif', roles: ['heading'] },

  // ── Sans-serif ───────────────────────────────────────────────────────────
  { value: "'Segoe UI', Candara, Optima, sans-serif", label: 'Segoe — crisp interface', group: 'sans', roles: ['heading', 'body'] },
  { value: 'Tahoma, Geneva, Verdana, sans-serif', label: 'Tahoma — compact', group: 'sans', roles: ['heading', 'body'] },
  { value: "'Gill Sans', 'Gill Sans MT', Calibri, sans-serif", label: 'Gill Sans — humanist', group: 'sans', roles: ['heading', 'body'] },
  { value: "Futura, 'Century Gothic', 'Avant Garde', sans-serif", label: 'Futura — geometric', group: 'sans', roles: ['heading', 'body'] },
  { value: "'Franklin Gothic Medium', 'Arial Narrow', Helvetica, sans-serif", label: 'Franklin — newsstand', group: 'sans', roles: ['heading', 'body'] },

  // ── Display — headings only ──────────────────────────────────────────────
  { value: "Rockwell, 'Bookman Old Style', Georgia, serif", label: 'Rockwell — slab', group: 'display', roles: ['heading'] },
  { value: "Copperplate, 'Copperplate Gothic Light', 'Century Gothic', sans-serif", label: 'Copperplate — engraved', group: 'display', roles: ['heading'] },
  { value: "Impact, Haettenschweiler, 'Arial Black', sans-serif", label: 'Impact — poster', group: 'display', roles: ['heading'] },

  // ── Handwriting — headings only ──────────────────────────────────────────
  { value: "'Segoe Script', 'Bradley Hand', 'Brush Script MT', cursive", label: 'Segoe Script — handwritten', group: 'script', roles: ['heading'] },
  { value: "'Snell Roundhand', 'Palace Script MT', 'Edwardian Script ITC', cursive", label: 'Snell — formal script', group: 'script', roles: ['heading'] },
  { value: "'Comic Sans MS', 'Chalkboard SE', 'Marker Felt', cursive", label: 'Comic Sans — casual', group: 'script', roles: ['heading'] },

  // ── Monospace ────────────────────────────────────────────────────────────
  { value: "Consolas, Menlo, Monaco, 'Lucida Console', monospace", label: 'Consolas — modern code', group: 'mono', roles: ['heading', 'body'] },
  { value: "'American Typewriter', 'Courier New', monospace", label: 'American Typewriter — vintage', group: 'mono', roles: ['heading', 'body'] },
];

/** The stacks offered for one role, in catalog order. */
export function fontStacksFor(role: FontRole): readonly FontStack[] {
  return FONT_STACKS.filter(f => f.roles.includes(role));
}

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

/**
 * The separator between tags in a listing.
 *
 * `comma` is AO3's own and emits no CSS, which is what makes it a safe default:
 * a theme that never touched this control produces byte-identical output to one
 * saved before the control existed.
 */
export const TAG_SEPARATORS: readonly { value: TagSeparator; label: string }[] = [
  { value: 'comma', label: 'Commas' },
  { value: 'bullet', label: 'Bullets' },
  { value: 'line', label: 'One group per line' },
];

export const HEADER_TEXT_COLORS: readonly { value: HeaderTextColor; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export const HEADER_GRADIENTS: readonly { value: HeaderGradient; label: string }[] = [
  { value: 'none', label: 'Flat' },
  { value: 'vertical', label: 'Vertical' },
  { value: 'diagonal', label: 'Diagonal' },
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
  // Role-aware, so a stored theme cannot put a handwriting face behind every
  // listing on the archive. The editor never offers one for body text, but the
  // storage boundary is what has to hold when the JSON did not come from the
  // editor — a hand-edited localStorage entry, or a theme saved before a stack
  // changed role. Falls back to the template's own font, not to a global
  // default, so the repair is a theme that still looks deliberate.
  const font = (v: unknown, d: string, role: FontRole) =>
    typeof v === 'string' && fontStacksFor(role).some(f => f.value === v) ? v : d;
  const mood = (v: unknown, d: Mood): Mood => (MOODS.includes(v as Mood) ? (v as Mood) : d);

  const meta = raw.meta ?? {};
  const colors = raw.colors ?? {};
  const typography = raw.typography ?? {};
  const shape = raw.shape ?? {};
  const header = raw.header ?? {};
  const reading = raw.reading ?? {};
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
      headingFont: font(typography.headingFont, fallback.typography.headingFont, 'heading'),
      bodyFont: font(typography.bodyFont, fallback.typography.bodyFont, 'body'),
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
      tagColors:
        typeof shape.tagColors === 'boolean' ? shape.tagColors : fallback.shape.tagColors,
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
      gradient: HEADER_GRADIENTS.some(g => g.value === header.gradient)
        ? header.gradient
        : fallback.header.gradient,
    },
    reading: {
      requiredTagsAsText:
        typeof reading.requiredTagsAsText === 'boolean'
          ? reading.requiredTagsAsText
          : fallback.reading.requiredTagsAsText,
      tagLabels:
        typeof reading.tagLabels === 'boolean' ? reading.tagLabels : fallback.reading.tagLabels,
      // Membership, not a string check: the value reaches a `content` string and
      // a `float`, so a stored theme that carried anything else would be writing
      // CSS. Falls back to the template's own rather than to 'comma', so a
      // half-corrupt theme keeps the separator its owner chose.
      tagSeparator: TAG_SEPARATORS.some(t => t.value === reading.tagSeparator)
        ? reading.tagSeparator
        : fallback.reading.tagSeparator,
      statIcons:
        typeof reading.statIcons === 'boolean' ? reading.statIcons : fallback.reading.statIcons,
    },
    details: {
      divider: typeof details.divider === 'boolean' ? details.divider : fallback.details.divider,
      dropCap: typeof details.dropCap === 'boolean' ? details.dropCap : fallback.details.dropCap,
      scrollbar:
        typeof details.scrollbar === 'boolean' ? details.scrollbar : fallback.details.scrollbar,
    },
  };
}
