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
 * 2. **Every declaration carries `!important` — except where it would trample
 *    an author.** The rule is not defensive clutter: a user site skin loads with
 *    role "user", which means AO3's own stylesheets are still there and are full
 *    of ID- and class-scoped rules. `body {…}` loses to `#dashboard.own`,
 *    `h1 {…}` loses to `.heading`.
 *
 *    But AO3's chrome is not the only thing our selectors can reach. A **work
 *    skin** is the author's own design, rendered in the page body — after our
 *    stylesheet — and scoped by AO3 to `#workskin`. Shouting at it means a
 *    reader's theme silently rewrites somebody's story layout, which is what
 *    happened: see `Rule.authorWins` and plan §14. Rules that can land inside a
 *    work are emitted quietly and win against AO3's defaults on specificity or
 *    source order instead.
 *
 * The output is also the preview's stylesheet — see mockPage.ts. There is no
 * second rendering path that could disagree with this one.
 */

interface Rule {
  selectors: string[];
  decls: [property: string, value: string][];
  /**
   * Emit this rule **without** `!important`, so an author's work skin wins.
   *
   * The invariant above is right for AO3's chrome and wrong the moment a rule
   * can land inside somebody's story. A work skin is rendered by
   * `works/show.html.erb` **in the body**, after our stylesheet in `<head>`, and
   * every one of its rules is `#workskin`-prefixed by AO3 itself. So an author
   * beats us on both source order and specificity — *unless we shout*, and then
   * we beat them on nothing but volume.
   *
   * Each rule marked here was checked against the AO3 default it still has to
   * overcome, and wins that one on specificity or source order alone. The two
   * questions are separate: "does our rule beat AO3's default" (yes, without
   * `!important`) and "does it beat the author's" (no, deliberately).
   */
  authorWins?: true;
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

  // The header gradient runs accent → headerDeep, so it needs no colour the
  // theme does not already imply and cannot drift away from the accent.
  //
  // Both stops are literal hex by the time they are emitted, for the same
  // reason everything else here is: AO3 has no color-mix(). And the whole
  // function is legal because AO3 routes any token containing `gradient` to
  // sanitize_css_gradient rather than to the value grammar — the branch §17
  // (Correction 5) found. Before that landed, our own lint refused this.
  const headerDeep = mixHex(accent, '#000000', 0.75);
  const gradientAngle: Record<string, string> = { vertical: '180deg', diagonal: '135deg' };
  const headerGradient =
    theme.header.gradient === 'none'
      ? ''
      : `linear-gradient(${gradientAngle[theme.header.gradient]}, ${accent}, ${headerDeep})`;

  return {
    accent,
    surface,
    background,
    text,
    /** Legible on the accent-painted header. Fixes plan §4.4. */
    headerFg,
    /** A darker accent for the header's edge and its dropdown panels. */
    headerDeep,
    /** The header's gradient layer, or '' when the control is off. */
    headerGradient,
    /** Card edges: the accent, mostly dissolved into the card. */
    border: mixHex(accent, surface, 0.27),
    tagBorder: mixHex(accent, surface, 0.45),
    /**
     * A button sits slightly proud of the card it is on — in either polarity,
     * which is why it mixes toward the TEXT colour rather than toward white or
     * black. On a dark theme that lightens; on a light theme it darkens; the
     * control reads as raised either way without a second control to say so.
     *
     * **Note the argument order.** `mixHex(a, b, weight)` keeps `weight` of the
     * FIRST colour, so "surface nudged 10% toward text" is
     * `mixHex(text, surface, 0.1)` — not `mixHex(surface, text, 0.1)`, which is
     * 90% text and produces a cream button carrying cream text on every dark
     * theme. That inversion was written here first and survived a green test
     * suite, because the tests compared the emitted value against `d.controlBg`
     * rather than against a contrast floor. The floor is asserted now.
     */
    controlBg: mixHex(text, surface, 0.1),
    /** A visible edge on that button, without becoming a second accent. */
    controlBorder: mixHex(text, surface, 0.25),
    /**
     * A form field reads as *recessed*, and the page colour inside a card is
     * exactly that — so this needs no maths of its own. It is the one derived
     * value here that is just another name for something the theme already has,
     * and it is named anyway so the ownership table can point at it.
     */
    fieldBg: background,
    /** AO3's alternating comment shading, at our contrast rather than #eee. */
    commentAlt: mixHex(text, surface, 0.05),
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
  //
  // No `!important`, and it does not need one: AO3's font for these comes from
  // `blockquote, pre, address { font: 1em … }` in 02-elements at (0,0,1), the
  // same specificity as ours, and we load after it. `.userstuff blockquote` in
  // 21-userstuff sets margins and a border but no font at all. What the missing
  // `!important` buys is that an author styling a blockquote inside their work
  // — `#workskin blockquote.note`, (1,0,1), rendered later — keeps their font.
  rules.push({
    selectors: ['blockquote', 'address'],
    decls: [['font-family', theme.typography.bodyFont]],
    authorWins: true,
  });

  // Mirrors AO3's own `h1, h2, h3, h4, h5, h6, .heading` selector. Without
  // `.heading` the heading font never applies to an AO3 heading (§4.5).
  rules.push({
    selectors: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', '.heading'],
    decls: [['font-family', theme.typography.headingFont]],
  });

  // ── Header ──────────────────────────────────────────────────────────────
  // Three things can paint the header, and they stack rather than compete:
  // the banner on top, the gradient beneath it, the flat accent beneath both.
  //
  // Layer order in a `background-image` list is paint order — first is
  // frontmost — so listing them this way means each one is the fallback for
  // the one above it. A banner that is slow, deleted or blocked degrades to
  // the gradient; a theme with no gradient degrades to the accent. That is a
  // better version of what this comment used to promise, which was degrading
  // to the theme colour rather than to white.
  //
  // Both layers live in ONE declaration on purpose. Two rules setting
  // `background-image` on `#header` would be defect §4.2 again — equal
  // specificity, later wins, and the first control silently stops working.
  // Invariant 1 is one owner per (selector, property), not per control.
  const banner = theme.header.bannerUrl.trim();
  const headerLayers = [
    ...(banner ? [`url("${banner}")`] : []),
    ...(d.headerGradient ? [d.headerGradient] : []),
  ];
  rules.push({
    selectors: ['#header'],
    decls: [
      ['background-color', d.accent],
      ...(headerLayers.length
        ? ([['background-image', headerLayers.join(', ')]] as [string, string][])
        : []),
      // Emitted only for a banner: a gradient already fills its box. When both
      // layers are present these apply to both, which is harmless — `cover` and
      // `no-repeat` are what a gradient does anyway.
      ...(banner
        ? ([
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
  //
  // Under a gradient it goes transparent rather than flat. An opaque accent
  // strip laid across a fading header is a visible band, and the header stops
  // reading as one surface — which is the whole point of the control.
  // `background-image: none` stays in both cases: it is what removes AO3's
  // tile, and without it the strip keeps its texture no matter what colour
  // sits underneath.
  rules.push({
    selectors: ['#header .primary'],
    decls: [
      ['background-color', d.headerGradient ? 'transparent' : d.accent],
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
    selectors: ['li.blurb', '#dashboard'],
    decls: [
      ['background-color', d.surface],
      ['border-color', d.border],
      ['border-radius', theme.shape.cardRadius],
    ],
  });

  // `#workskin` gets the same card treatment in its own rule, so it can be the
  // one that yields. AO3's defaults paint it not at all — it is the container a
  // work skin is scoped to — so no `!important` is needed to reach it, and
  // leaving it off means an author who chose a background for their work keeps
  // it. A reader still gets their card colour on every work that has no skin,
  // which is nearly all of them.
  rules.push({
    selectors: ['#workskin'],
    decls: [
      ['background-color', d.surface],
      ['border-color', d.border],
      ['border-radius', theme.shape.cardRadius],
    ],
    authorWins: true,
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

  // ── Reading: required tags as words ─────────────────────────────────────
  //
  // AO3 renders a work's rating, warnings, category and completion status as
  // four sprite icons in a 2×2 block at the left of every blurb. The words are
  // already in the DOM — `tags_helper.rb#get_symbols_for` emits
  // `<span class="text">General Audiences</span>` inside each — and
  // 13-group-blurb.css then hides them with `height: 0; width: 0;
  // font-size: 0.001em; color: transparent` and paints a sprite over the outer
  // span. So none of what follows invents content: it undoes the hiding.
  //
  // Which is why this is the accessibility control rather than a decoration.
  // The icons are legible to a reader who has memorised them and to nobody
  // else; everyone else hovers for a `title` tooltip, which is not available at
  // all on a phone.
  //
  // **The inner span classes are the target, never `li+li+li`.** AO3 gives the
  // `li`s no class and positions them by adjacency, so the corpus's version of
  // this hangs its offsets off `li+li+li` and breaks the moment a reader's font
  // size differs from the author's. `.rating`, `.warnings`, `.category` and
  // `.iswip` are on the inner spans and are stable.
  if (theme.reading.requiredTagsAsText) {
    // Out of the absolutely-positioned icon block and back into the flow.
    rules.push({
      selectors: ['.blurb ul.required-tags'],
      decls: [
        ['position', 'static'],
        ['width', 'auto'],
      ],
    });

    // AO3 sizes all three levels to the 25px sprite. `display: inline` rather
    // than `inline-block` so a long warning phrase wraps like text instead of
    // holding a rigid box open.
    rules.push({
      selectors: [
        '.blurb ul.required-tags li',
        '.blurb ul.required-tags li a',
        '.blurb ul.required-tags li span',
      ],
      decls: [
        ['display', 'inline'],
        ['height', 'auto'],
        ['width', 'auto'],
      ],
    });

    // One rule, not two. AO3 positions the third `li` with `li+li+li` and the
    // fourth with `li+li+li+li` — but `li+li+li` matches the fourth as well
    // (it is preceded by two `li`s), and every declaration here carries
    // `!important`, which beats AO3's more specific fourth rule outright. A
    // second selector for the fourth would be a redundant owner of `top`.
    rules.push({
      selectors: ['.blurb ul.required-tags li + li + li'],
      decls: [
        ['left', 'auto'],
        ['position', 'static'],
        ['top', 'auto'],
      ],
    });

    // Separate owner from the `display/height/width` rule above, because this
    // one is about the *text* AO3 hid rather than the box it hid it in.
    rules.push({
      selectors: ['.blurb span.text'],
      decls: [
        ['color', 'inherit'],
        ['font-size', '1em'],
      ],
    });

    // The sprite itself. Without this the icon is still painted, now behind
    // the words — the same defect as the footer's red tile (§4.6).
    rules.push({
      selectors: ['.blurb ul.required-tags li span'],
      decls: [['background-image', 'none']],
    });

    // Space between the four phrases, or they run together as one sentence.
    rules.push({
      selectors: ['.blurb ul.required-tags li'],
      decls: [['padding-right', '1em']],
    });

    // AO3 reserves the left 65px of every blurb header for the icon block and
    // gives the header a 55px floor to fit it. Both are dead space once the
    // block is gone, and leaving them turns the control into "the icons became
    // words and the layout stayed wrong".
    //
    // `margin-left`, not the `margin` shorthand AO3 uses: a longhand with
    // `!important` overrides that one component and leaves the other three
    // alone. (It is also an allowed property — it contains `margin`, §3.)
    rules.push({
      selectors: ['.blurb .header .heading', '.blurb .header ul'],
      decls: [['margin-left', '0']],
    });

    rules.push({
      selectors: ['.blurb .header'],
      decls: [['min-height', '0']],
    });

    // And now the part nobody else's version of this has: the words are
    // theme-aware.
    //
    // Two of the four mappings are exact — a warning is a warning, and AO3's
    // categories (F/M, Gen, Multi) are relationship shapes. The other two are
    // assignments rather than derivations, chosen so that all four are told
    // apart at a glance: the rating takes the character hue because it reads as
    // informational, and the completion status takes the freeform hue because
    // "Complete Work" in green is the reading a reader already expects. Said
    // plainly here rather than dressed up as semantics.
    if (theme.shape.tagColors) {
      const REQUIRED_TAG_COLORS: [selector: string, color: string][] = [
        ['.blurb ul.required-tags .rating', d.tagColors.character],
        ['.blurb ul.required-tags .warnings', d.tagColors.warning],
        ['.blurb ul.required-tags .category', d.tagColors.relationship],
        ['.blurb ul.required-tags .iswip', d.tagColors.freeform],
      ];
      for (const [selector, color] of REQUIRED_TAG_COLORS) {
        rules.push({ selectors: [selector], decls: [['color', color]] });
      }
    }
  }

  // ── Chrome: buttons, fields, pagination, comments ───────────────────────
  //
  // Seven of our sixteen templates have a dark page, and on every one of them
  // AO3's own defaults left light-grey islands we never repainted: every
  // button (Post, Comment, Kudos, Subscribe, Sort & Filter), every pagination
  // number, every search and comment box, every comment byline. A reader
  // installs Neon Terminal, opens a work, and the comment button is 2010 grey.
  // That reads as the skin being half-finished, because it was.
  //
  // **Everything here is scoped to `#main`, and §18a's table is not.** That is a
  // deliberate departure, and the reason is our own `!important`. AO3 styles its
  // buttons with a bare `.actions a, .actions button, …` in 08-actions.css, and
  // then *exempts* the header and the footer from it with ID-scoped rules —
  // `#header a, #header fieldset, … { background: transparent }` at (1,0,1) and
  // `#footer a, #footer button { background: transparent }` at (1,0,1), both of
  // which beat `.actions a` at (0,1,1) on the real page.
  //
  // Emitting the bare selector the way the corpus does would break both
  // exemptions, because our declaration carries `!important` and AO3's does not
  // — so a shouted (0,1,1) beats a quiet (1,0,1). The visible result would be a
  // button-coloured chip behind every header nav link and every footer link, on
  // every page. Scoping to `#main` keeps AO3's own structure intact: the header
  // and footer are already owned by the rules above, and every control §18a is
  // actually about — pagination, comment boxes, filter forms, work actions —
  // lives inside `#main` anyway.
  //
  // None of these can land inside a work. Comments live in `#feedback`, which is
  // a sibling of `#work-skin`, so §14b's authorWins question does not arise.
  const CONTROL_SELECTORS = [
    '#main .actions a',
    '#main .actions a:link',
    '#main .action',
    '#main .action:link',
    '#main .actions button',
    '#main .actions input',
    '#main input[type="submit"]',
    '#main button',
    '#main .actions label',
  ];
  rules.push({
    selectors: CONTROL_SELECTORS,
    decls: [
      ['background-color', d.controlBg],
      // Load-bearing, not tidiness. 08-actions.css layers
      // `linear-gradient(#fff 2%, #ddd 95%, #bbb 100%)` (plus four
      // vendor-prefixed copies) ON TOP of `background: #eee`. A background-color
      // alone leaves that white-to-grey gradient sitting over it and the control
      // looks like it does nothing — the same defect as the footer's red tile.
      ['background-image', 'none'],
      ['border-color', d.controlBorder],
      ['color', d.text],
    ],
  });

  rules.push({
    selectors: [
      '#main .actions a:hover',
      '#main .actions a:focus',
      '#main .actions button:hover',
      '#main .actions button:focus',
      '#main .actions input:hover',
      '#main .actions input:focus',
      '#main .action:hover',
      '#main .action:focus',
    ],
    decls: [
      ['background-color', d.accent],
      ['color', d.headerFg],
    ],
  });

  // Pagination's current page. `#dashboard .current` is a separate owner above
  // and stays that way — the dashboard's current item is a nav highlight, this
  // is a page number, and the dashboard is a sibling of #main rather than
  // inside it, so the two selectors can never meet.
  rules.push({
    selectors: ['#main .current', '#main a.current', '#main .current a', '#main .current a:visited'],
    decls: [
      ['background-color', d.accent],
      ['color', d.headerFg],
    ],
  });

  // A field is the page colour inside a card: recessed rather than raised.
  // `.actions input` above is a submit button and outranks this at (1,1,1),
  // which is what keeps a button from being painted like a text box.
  rules.push({
    selectors: ['#main input', '#main textarea', '#main select'],
    decls: [
      ['background-color', d.fieldBg],
      ['border-color', d.controlBorder],
      ['color', d.text],
    ],
  });

  // Kills AO3's `input:focus { background: #f3efec }` — a cream flash on a
  // black theme, which is the most jarring half-second in the product.
  rules.push({
    selectors: ['#main input:focus', '#main textarea:focus', '#main select:focus'],
    decls: [['background-color', d.fieldBg]],
  });

  rules.push({
    selectors: ['#main .filters dt', '#main fieldset legend', '#main form.verbose legend'],
    decls: [
      ['background-color', d.controlBg],
      ['color', d.text],
    ],
  });

  /**
   * The form container itself, which AO3 paints `#ddd` with a `2px solid
   * #f3efec` border and an `inset 1px 0 5px #999` bevel (07-interactions.css).
   *
   * **This was the largest unstyled block on the archive.** Every fieldset gets
   * it — the comment form under every work, search, preferences, posting — so a
   * reader on a dark theme met a light-grey slab with a cream edge at the bottom
   * of every page they read. It was invisible to us because `mockPage.ts`
   * carried a *reconstructed* `fieldset` rule with no background at all, which
   * is §21b's trap and §22d's rule in one: a region the mock renders wrongly is
   * worse than one it omits, because it looks finished.
   *
   * **`#main` is load-bearing, not tidiness.** AO3 exempts its own header with
   * `#header fieldset { background: transparent }` — a silent (1,0,1). A bare
   * `fieldset` from us, shouted, would beat that and repaint the login dropdown
   * inside the header we already own. Three bugs share that root (§14b, §18a,
   * §20b); scoping here is what stops this being the fourth.
   *
   * The polarity follows `.listbox` (§22e) and AO3's own relationship: the outer
   * container takes the page colour, the panel nested inside it takes the card
   * colour. Like the listbox pair it is a judgement rather than a measurement —
   * the border is what keeps the form legible as a block once its fill matches
   * the page.
   */
  rules.push({
    selectors: ['#main fieldset', '#main form dl'],
    decls: [
      ['background-color', d.background],
      ['border-color', d.border],
      ['box-shadow', 'none'],
    ],
  });

  rules.push({
    selectors: ['#main fieldset fieldset', '#main fieldset dl dl'],
    decls: [['background-color', d.surface]],
  });

  // ── Comments ────────────────────────────────────────────────────────────
  rules.push({
    selectors: ['li.comment', 'div.comment'],
    decls: [
      ['background-color', d.surface],
      ['border-color', d.border],
    ],
  });

  rules.push({
    selectors: ['.comment h4.byline'],
    decls: [
      ['background-color', d.controlBg],
      ['color', d.text],
    ],
  });

  rules.push({
    selectors: ['.thread .even'],
    decls: [['background-color', d.commentAlt]],
  });

  // ── Listboxes, indexes and meta tables ──────────────────────────────────
  //
  // §22. A published skin advertises itself with nine screenshots — Main,
  // Profile, Footer, Filters, Forms, Works, Comments, Collections, Own works —
  // and an audit of every selector we can emit against AO3's own stylesheets
  // said we covered five of them. The four we did not all failed through the
  // same construct: `.listbox`, which is what AO3 wraps a profile's Fandoms,
  // Works, Series and Bookmarks sections in, and the filter sidebar, and every
  // collection listing. On a dark template each one was a light-grey box
  // holding a white panel — §18a's defect, one region deeper.
  //
  // **The polarity of the pair is deliberate.** AO3 paints the outer box #ddd
  // and the inner panel #fff: outer darker, inner lighter, inner reads as the
  // card. Mapping outer → `background` and inner → `surface` keeps that
  // relationship in either polarity and reuses the two colours the Page and
  // Cards controls already mean. Painting both `surface` would flatten a
  // distinction AO3 is using to separate a container from its contents.
  //
  // **`box-shadow: none` is load-bearing**, for the same reason
  // `background-image: none` is on the footer and the buttons: 11-group-listbox
  // lays a white 1px ring *outside* the box and a grey bevel *inside* the panel,
  // and neither is reachable by a background colour. These are the first
  // `box-shadow` declarations the compiler emits, so §18b's card-elevation
  // control must add its shadows to *these* rules rather than to new ones —
  // otherwise invariant 1 breaks the moment both ship.
  rules.push({
    selectors: ['.listbox'],
    decls: [
      ['background-color', d.background],
      ['border-color', d.border],
      ['box-shadow', 'none'],
    ],
  });

  rules.push({
    selectors: ['.listbox .index'],
    decls: [
      ['background-color', d.surface],
      ['box-shadow', 'none'],
    ],
  });

  // §22e also listed `.listbox > .heading` for the text colour, and it is
  // deliberately absent. AO3's `.listbox > .heading { color: #2a2a2a }` is
  // (0,2,0) and every listbox on the archive lives inside `#main`, where our
  // own `#main .heading` accent rule is (1,1,0) and already beats it. Emitting
  // the row would add a rule that loses to another of ours on every page it
  // could apply to — a dead declaration that reads like a working one. The
  // heading is accent-coloured, like every other heading in `#main`.

  // AO3's `.wrapper:has(> table, > .meta)` puts a grey halo around the work
  // metadata table on every work page. Low priority in the audit only because
  // nothing in the preview rendered a `.wrapper` around a `dl.meta`; the mock
  // does now, which is what turned it from invisible into a visible grey ring
  // on seven dark templates (§22d).
  rules.push({
    selectors: ['.wrapper:has(> table, > .meta)'],
    decls: [['box-shadow', 'none']],
  });

  // The work metadata table's own edge — on every work page, and on Profile,
  // Series, Collections and Stats besides.
  //
  // §22e's row also named `dl.meta .wrapper`, AO3's "wrapped data" mod, and it
  // is deliberately absent. Grepping every template in otwarchive `master` for
  // `wrapper` finds thirty-three, and **every one of them is the div AO3 wraps
  // *around* a meta list** — `works/_meta`, `stats/index`, `profile/show`,
  // `series/show`, `collection_profile/show`. Not one is inside a `dl.meta`. So
  // 12-group-meta's `dl.meta .wrapper` styles markup the archive does not
  // currently render, and emitting it would put a declaration in every user's
  // pasted stylesheet that can never match anything.
  rules.push({
    selectors: ['dl.meta'],
    decls: [['border-color', d.border]],
  });

  // The alternating shading AO3 uses to make a long list of paired data
  // readable — #ededed on an index's values, #eee on the statistics page's even
  // rows. Same job as the comment thread's, so it takes the same colour rather
  // than a third one that would have to be kept in step by hand.
  rules.push({
    selectors: ['dl.index dd', '.statistics .index li:nth-of-type(even)'],
    decls: [['background-color', d.commentAlt]],
  });

  // §22c — the regression, not a gap. `li.relationships a { background: #eee }`
  // gives every relationship tag in every listing a pale grey chip, and our
  // "colour tags by type" control sets that tag's TEXT colour and leaves the
  // chip alone. So on a dark theme thirteen templates rendered a light pill
  // carrying tinted text — a worse result than the accent it replaced, in the
  // feature §13 shipped to make listings more readable.
  //
  // Unconditional, because the grey chip is wrong on a dark theme whether or
  // not the reader turned tag colours on. `transparent` rather than a colour:
  // whatever the tag is sitting on — a blurb, a listbox panel, the page — is
  // already ours, and naming one of them here would be a second owner for it.
  //
  // Loses to `a.tag:hover` (0,2,1) at (0,1,2), so hovering still paints the
  // accent. That is the reason this is one declaration and not a hover pair.
  rules.push({
    selectors: ['li.relationships a'],
    decls: [['background-color', 'transparent']],
  });

  // ── Autocomplete ────────────────────────────────────────────────────────
  // Not scoped to #main: AO3 attaches the dropdown next to the field it serves,
  // and a tag field can appear outside the main region. Nothing else of ours
  // targets `.autocomplete`, so there is no exemption to preserve here.
  rules.push({
    selectors: ['.autocomplete .dropdown ul li'],
    decls: [
      ['background-color', d.surface],
      ['color', d.text],
    ],
  });

  rules.push({
    selectors: ['.autocomplete .dropdown ul li.selected'],
    decls: [
      ['background-color', d.accent],
      ['color', d.headerFg],
    ],
  });

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
  // **Direct children of the chapter body, and nothing deeper.** Both selectors
  // below say `>` for the same reason, and it is the reason §4.1 existed
  // already without going far enough:
  //
  // `:first-of-type` matches once per PARENT. Scoping to `#chapters .userstuff`
  // keeps the drop cap off the summary and the notes, but the chapter body
  // itself can contain hundreds of parents — because that is exactly what a
  // WORK SKIN is. An author's chat mock-up, ours included, is nested divs each
  // holding a `<p>`, so a descendant selector put a floated 4em capital on
  // every bubble, every caption and every ad line in the work. Seen on a real
  // AO3 page on 13 Aug 2026; see plan §14.
  //
  // The same argument applies to `hr`: an author using a rule inside their own
  // markup should not have our ornament welded onto it.
  //
  // `>` degrades the right way. A prose chapter opens with a top-level `<p>`
  // and still gets its capital; a chapter that opens with a work skin's
  // container gets nothing, which is the correct amount of our decoration to
  // put inside someone else's design. Note `:first-child` would NOT do — AO3
  // renders `<h3 class="landmark heading">Chapter Text</h3>` first, so the
  // opening paragraph is never the first child.
  if (theme.details.divider) {
    rules.push({
      selectors: ['#chapters .userstuff > hr'],
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
      // Beats AO3's `.userstuff hr` (0,1,1) with (0,2,2) and no `!important`.
      // Loses to an author's `#workskin hr` (1,0,1), which is the point.
      authorWins: true,
    });
    rules.push({
      selectors: ['#chapters .userstuff > hr::after'],
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
      authorWins: true,
    });
  }

  if (theme.details.dropCap) {
    rules.push({
      selectors: ['#chapters .userstuff > p:first-of-type::first-letter'],
      decls: [
        ['color', d.accent],
        ['float', 'left'],
        ['font-family', theme.typography.headingFont],
        ['font-size', '4em'],
        ['line-height', '0.8'],
        ['padding', '0.1em 0.12em 0 0'],
      ],
      // Nothing in AO3's defaults styles ::first-letter, so there is nothing to
      // shout over — and an author we do still reach keeps the power to override.
      authorWins: true,
    });
  }

  return rules;
}

function serialize(rules: Rule[]): string {
  return rules
    .map(rule => {
      // `!important` unless the rule can land inside somebody's story — see
      // Rule.authorWins. Applied structurally either way, so nobody can forget.
      const bang = rule.authorWins ? '' : ' !important';
      const body = rule.decls
        .map(([property, value]) => `  ${property}: ${value}${bang};`)
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
