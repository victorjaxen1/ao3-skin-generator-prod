import { SiteSkinTheme } from './theme';
import { mixHex, normalizeHex, readableOn, tagTypeColors, TAG_TYPES } from './colors';

/**
 * theme → AO3 site skin CSS.
 *
 * Two invariants hold this file together, and both are enforced by tests
 * rather than by care:
 *
 * 1. **One owner per (selector, property).** No selector below is given the
 *    same property twice. The prototype painted `#main` with
 *    `background-color` in two separate rules and the later one silently ate
 *    the Page colour control (plan §4.2). A selector may appear in more than
 *    one rule — `#header` takes its background from the accent and its text
 *    from a derived foreground — but never for the same property. If one
 *    property needs to react to two controls, that is a design conversation,
 *    not a second `!important`.
 *
 * 2. **Every declaration carries `!important`.** Not defensive clutter: a user
 *    site skin loads with role "user", which means AO3's own stylesheets are
 *    still there and are full of ID- and class-scoped rules. `body {…}` loses
 *    to `#dashboard.own`, `h1 {…}` loses to `.heading`. `important()` below
 *    applies it structurally so nobody can forget.
 *
 * The output is also the preview's stylesheet — see mockPage.ts. There is no
 * second rendering path that could disagree with this one.
 */

interface Rule {
  selectors: string[];
  decls: [property: string, value: string][];
}

const TAG_SHAPE: Record<SiteSkinTheme['shape']['tagStyle'], { radius: string; border: boolean }> = {
  // 999px, not 9999px: AO3's number grammar is generous but not unlimited, and
  // 999px is already far past any tag's height.
  pill: { radius: '999px', border: true },
  label: { radius: '3px', border: true },
  plain: { radius: '0px', border: false },
};

/** Everything the theme implies but does not literally contain. */
export function derive(theme: SiteSkinTheme) {
  const accent = normalizeHex(theme.colors.accent);
  const surface = normalizeHex(theme.colors.surface);
  const background = normalizeHex(theme.colors.background);
  const text = normalizeHex(theme.colors.text);

  // 'auto' is right whenever the header is a flat colour — readableOn is
  // guaranteed to contrast with it. It is only a guess once a banner is in
  // play, which is the case the override exists for.
  const headerFg =
    theme.header.textColor === 'light'
      ? '#ffffff'
      : theme.header.textColor === 'dark'
      ? '#241f20'
      : readableOn(accent);

  return {
    accent,
    surface,
    background,
    text,
    /** Legible on the accent-painted header. Fixes plan §4.4. */
    headerFg,
    /** A darker accent for the header's edge and its dropdown panels. */
    headerDeep: mixHex(accent, '#000000', 0.75),
    /** Card edges: the accent, mostly dissolved into the card. */
    border: mixHex(accent, surface, 0.27),
    tagBorder: mixHex(accent, surface, 0.45),
    /**
     * The scrollbar thumb. Further toward the accent than a card edge, because
     * a scrollbar is a thing you aim at rather than a boundary you notice.
     */
    scrollThumb: mixHex(accent, surface, 0.7),
    /** One legible colour per tag type. Emitted only when the control is on. */
    tagColors: tagTypeColors({ accent, surface, background }),
    /**
     * A glow *behind* the header text, so it survives a busy banner. The
     * opposite of the foreground: dark text gets a light halo and vice versa,
     * which is what makes it readable over an image whose brightness we
     * cannot measure.
     */
    headerShadow: headerFg === '#ffffff' ? '#000000' : '#ffffff',
  };
}

function buildRules(theme: SiteSkinTheme): Rule[] {
  const d = derive(theme);
  const tag = TAG_SHAPE[theme.shape.tagStyle];
  const rules: Rule[] = [];

  // ── Page ────────────────────────────────────────────────────────────────
  // AO3 sets no background on #main (05-region-main.css), so body showing
  // through IS the page colour. Do not add a #main background.
  rules.push({
    selectors: ['body'],
    decls: [
      ['background-color', d.background],
      ['color', d.text],
      ['font-family', theme.typography.bodyFont],
      // Set the scale exactly once. AO3's own #header/#main 0.875em then
      // scales with it; setting it again on either would multiply (§4.3).
      ['font-size', `${Math.round(theme.typography.baseFontScale * 100)}%`],
    ],
  });

  // Summaries and notes set their own font, so they need naming separately.
  // Code blocks are left alone on purpose.
  rules.push({
    selectors: ['blockquote', 'address'],
    decls: [['font-family', theme.typography.bodyFont]],
  });

  // Mirrors AO3's own `h1, h2, h3, h4, h5, h6, .heading` selector. Without
  // `.heading` the heading font never applies to an AO3 heading (§4.5).
  rules.push({
    selectors: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', '.heading'],
    decls: [['font-family', theme.typography.headingFont]],
  });

  // ── Header ──────────────────────────────────────────────────────────────
  // The banner sits on #header with the accent underneath it as a fallback,
  // so a slow or dead image degrades to the theme colour rather than to white.
  const banner = theme.header.bannerUrl.trim();
  rules.push({
    selectors: ['#header'],
    decls: [
      ['background-color', d.accent],
      ...(banner
        ? ([
            ['background-image', `url("${banner}")`],
            ['background-position', 'center'],
            ['background-repeat', 'no-repeat'],
            ['background-size', 'cover'],
          ] as [string, string][])
        : []),
      ['border-bottom', `4px solid ${d.headerDeep}`],
    ],
  });

  // AO3's header is only as tall as its contents, which is a couple of lines.
  // Without a height there is nowhere for a banner to show.
  if (banner) {
    rules.push({
      selectors: ['#header .heading'],
      decls: [['height', theme.header.bannerHeight]],
    });
  }

  if (theme.header.hideLogo) {
    // display, not visibility: hiding it should close the gap, not leave one.
    rules.push({
      selectors: ['#header .logo'],
      decls: [['display', 'none']],
    });
  }

  // Gated on the banner on purpose. With a flat header the foreground is
  // already derived to contrast with it, so a glow would be noise; it earns
  // its place only when there is an image whose brightness we cannot measure.
  if (banner && theme.header.textShadow) {
    rules.push({
      selectors: ['#header .heading a', '#header .primary a'],
      decls: [['text-shadow', `0 0 12px ${d.headerShadow}`]],
    });
  }

  // `.primary` is the navigation bar. It carries its OWN red background plus a
  // tiled texture image, so painting only #header leaves AO3's red strip in
  // place on every theme (§4.9). Separate rule, and no border of its own —
  // #header's bottom edge already sits directly below it.
  rules.push({
    selectors: ['#header .primary'],
    decls: [
      ['background-color', d.accent],
      ['background-image', 'none'],
    ],
  });

  // Header text, kept readable against the accent colour.
  rules.push({
    selectors: [
      '#header',
      '#header a',
      '#header a:visited',
      '#header .heading',
      '#header .heading a',
      '#header .primary a',
    ],
    decls: [['color', d.headerFg]],
  });

  // Dropdown panels and the hover/open states that reveal them. One rule, so
  // the panel and the trigger can never drift apart.
  rules.push({
    selectors: [
      '#header .menu',
      '#header .menu li',
      '#small_login',
      '#header .actions a:hover',
      '#header .actions a:focus',
      '#header .dropdown:hover a',
      '#header .open a',
    ],
    decls: [
      ['background-color', d.headerDeep],
      ['background-image', 'none'],
      ['color', d.headerFg],
    ],
  });

  // ── Cards ───────────────────────────────────────────────────────────────
  // `.listbox li.blurb` is deliberately absent: 11-group-listbox.css sets only
  // display and box-shadow there, so `li.blurb` already reaches those.
  rules.push({
    selectors: ['li.blurb', '#dashboard', '#workskin'],
    decls: [
      ['background-color', d.surface],
      ['border-color', d.border],
      ['border-radius', theme.shape.cardRadius],
    ],
  });

  // The footer is a card too, but AO3 tiles a red texture over it (§4.6).
  rules.push({
    selectors: ['#footer'],
    decls: [
      ['background-color', d.surface],
      ['background-image', 'none'],
    ],
  });

  // Chrome where AO3 hard-codes a foreground that our surfaces would swallow:
  // white footer text, and the dashboard's non-link current item (§4.6, §4.7).
  rules.push({
    selectors: ['#footer', '#footer .heading', '#footer button', '#dashboard span'],
    decls: [['color', d.text]],
  });

  rules.push({
    selectors: ['#dashboard .current'],
    decls: [['background-color', d.border]],
  });

  // ── Accent ──────────────────────────────────────────────────────────────
  rules.push({
    selectors: ['a', 'a:link', 'a:visited', 'a.tag'],
    decls: [['color', d.accent]],
  });

  rules.push({
    selectors: ['#main h1', '#main h2', '#main h3', '#main h4', '#main h5', '#main h6', '#main .heading'],
    decls: [['color', d.accent]],
  });

  rules.push({
    selectors: ['a.tag'],
    decls: [
      ['border', tag.border ? `1px solid ${d.tagBorder}` : '0'],
      ['border-radius', tag.radius],
      ['padding', tag.border ? '0.18em 0.5em' : '0'],
    ],
  });

  rules.push({
    selectors: ['a.tag:hover'],
    decls: [
      ['background-color', d.accent],
      ['color', d.headerFg],
    ],
  });

  // ── Tags, by type ───────────────────────────────────────────────────────
  // Two selectors per type, because AO3 marks the type up in two different
  // places: `li.warnings` on a blurb in a listing (works/_work_module) and
  // `dd.warning` in a work's metadata table (works/_meta). Both are rendered in
  // the mock, so both are watchable rather than taken on trust.
  //
  // Higher specificity than the plain `a.tag` accent rule above, so these win
  // where they apply and the accent still covers fandoms and everything else.
  // `border-color` follows the text only when the tag shape has a border at
  // all; on 'plain' the shape rule emits `border: 0` and an edge colour would
  // be a declaration with nothing to colour.
  if (theme.shape.tagColors) {
    const TAG_SELECTORS: Record<(typeof TAG_TYPES)[number], string[]> = {
      warning: ['li.warnings a.tag', 'dd.warning a.tag'],
      relationship: ['li.relationships a.tag', 'dd.relationship a.tag'],
      character: ['li.characters a.tag', 'dd.character a.tag'],
      freeform: ['li.freeforms a.tag', 'dd.freeform a.tag'],
    };
    for (const type of TAG_TYPES) {
      const color = d.tagColors[type];
      rules.push({
        selectors: TAG_SELECTORS[type],
        decls: [['color', color], ...(tag.border ? ([['border-color', color]] as [string, string][]) : [])],
      });
    }
  }

  // ── Scrollbar ───────────────────────────────────────────────────────────
  // AO3 validates declarations, not selectors — `clean_css_code` only ever
  // refuses a selector containing @font-face — so a vendor pseudo-element is
  // carried through untouched, and `width`/`background-color`/`border-radius`
  // are ordinary allowed properties. Chromium-only, which is why it is a
  // detail toggle and not part of the palette.
  if (theme.details.scrollbar) {
    rules.push({
      selectors: ['::-webkit-scrollbar'],
      decls: [
        ['width', '12px'],
        ['height', '12px'],
      ],
    });
    rules.push({
      selectors: ['::-webkit-scrollbar-track'],
      decls: [['background-color', d.surface]],
    });
    rules.push({
      selectors: ['::-webkit-scrollbar-thumb'],
      decls: [
        ['background-color', d.scrollThumb],
        ['border-radius', '999px'],
      ],
    });
    rules.push({
      selectors: ['::-webkit-scrollbar-thumb:hover'],
      decls: [['background-color', d.accent]],
    });
  }

  // ── Fixed corrections, owned by no control ──────────────────────────────
  // System messages set a pale background and no colour, so they inherit body
  // text — cream on pale blue for every dark theme (§4.8). Their BACKGROUNDS
  // are left alone on purpose: blue/yellow/red is AO3's meaning-carrying code,
  // not decoration. `.error` and `.alert.flash` already carry their own #900.
  rules.push({
    selectors: ['.notice', '.comment_notice', '.kudos_notice', 'ul.notes'],
    decls: [['color', '#2a2a2a']],
  });

  // ── Details ─────────────────────────────────────────────────────────────
  // Scoped to #chapters, not #workskin: `:first-of-type` matches once per
  // PARENT, so an unscoped selector decorates the summary and every set of
  // notes as well as the chapter (§4.1). #chapters covers both the
  // multi-chapter `.userstuff.module` and the single-chapter `.userstuff`.
  if (theme.details.divider) {
    rules.push({
      selectors: ['#chapters .userstuff hr'],
      decls: [
        // Longhands, not `border: 0` followed by `border-top`. AO3 parses our
        // CSS with the css_parser gem before storing it, and relying on
        // declaration order within a rule set to resolve a shorthand against
        // its own longhand is the kind of thing a re-serialising parser is
        // entitled to change. These three cannot be reordered into a
        // different meaning. AO3's own `.userstuff hr` sets a full 1px box, so
        // zeroing three sides is required, not tidiness.
        ['border-color', d.accent],
        ['border-style', 'solid'],
        ['border-width', '1px 0 0'],
        ['margin', '2em auto'],
        ['overflow', 'visible'],
        ['text-align', 'center'],
      ],
    });
    rules.push({
      selectors: ['#chapters .userstuff hr::after'],
      decls: [
        ['background-color', d.surface],
        ['color', d.accent],
        // Safe despite the non-ASCII: AO3 branches on `content` before the
        // value grammar, and accepts any fully-quoted string.
        ['content', '"❦"'],
        ['padding', '0 0.8em'],
        ['position', 'relative'],
        ['top', '-0.75em'],
      ],
    });
  }

  if (theme.details.dropCap) {
    rules.push({
      selectors: ['#chapters .userstuff p:first-of-type::first-letter'],
      decls: [
        ['color', d.accent],
        ['float', 'left'],
        ['font-family', theme.typography.headingFont],
        ['font-size', '4em'],
        ['line-height', '0.8'],
        ['padding', '0.1em 0.12em 0 0'],
      ],
    });
  }

  return rules;
}

function serialize(rules: Rule[]): string {
  return rules
    .map(rule => {
      const body = rule.decls
        .map(([property, value]) => `  ${property}: ${value} !important;`)
        .join('\n');
      return `${rule.selectors.join(',\n')} {\n${body}\n}`;
    })
    .join('\n\n');
}

/**
 * The single source of truth for both the preview and the export.
 *
 * If a control does not change this string, it does not change AO3 — and
 * because the preview renders this same string over an AO3-shaped mock DOM, it
 * does not change the preview either. That equivalence is structural, not a
 * promise.
 *
 * ## Why there are no comments in the output
 *
 * This used to open with three header comments — the theme name, "Paste into
 * Preferences → Skins → Create Site Skin", and "leave the skin type on add on
 * to archive skin" — plus a note above two of the rules.
 *
 * **AO3 deletes every comment on save**, so none of them ever reached a reader
 * or even the author reopening their own skin; they existed only in the paste
 * box. And on 7 Aug 2026 a work skin saved with comments came back from the
 * archive missing eleven consecutive rules, three times reproduced, with the
 * rules returning the moment the comments went (WORK-SKIN §13). The mechanism
 * is still not proven, which is exactly why nothing here is worth the exposure.
 *
 * The two instructions were the only reason not to strip them blind — losing
 * the "add on to archive skin" warning would have traded a possible bug for a
 * certain one. Both now live in `ExportSkinDialog`'s numbered steps, where the
 * user actually reads them, and `tests/site-skin.spec.ts` pins them there.
 *
 * Do not reintroduce comments here without saving on real AO3 and diffing the
 * stored CSS rule by rule.
 */
export function compile(theme: SiteSkinTheme): string {
  return `${serialize(buildRules(theme))}\n`;
}

/** Exposed for the ownership tests in tests/site-skin.unit.spec.ts. */
export function compileRules(theme: SiteSkinTheme): Rule[] {
  return buildRules(theme);
}
