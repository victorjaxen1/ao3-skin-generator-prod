import { test, expect } from '@playwright/test';
import { compile, compileRules, derive } from '../src/lib/siteSkin/compile';
import { TEMPLATES, cloneTheme, findTemplate, gradientFor } from '../src/lib/siteSkin/templates';
import {
  FONT_STACKS,
  FONT_GROUP_LABELS,
  fontStacksFor,
  validateTheme,
  SiteSkinTheme,
  TAG_SEPARATORS,
} from '../src/lib/siteSkin/theme';
import { lintAo3Css, isLegalFontStack, checkAo3ImageUrl, stripCssComments } from '../src/lib/siteSkin/ao3Css';
import {
  mixHex,
  normalizeHex,
  contrastRatio,
  readableOn,
  bestTextColor,
  fixAccent,
  findReadabilityIssues,
  WCAG_LARGE_MIN,
} from '../src/lib/siteSkin/colors';
import { mockDocument, mockBody, AO3_BASE_CSS } from '../src/lib/siteSkin/mockPage';

/**
 * The compiler's contract, pinned.
 *
 * The three §4 defects the prototype shipped — a doubly-painted #main, a
 * compounding font scale, and an invisible header — are all things that look
 * fine in a diff and only fail on a real AO3 page. They are tests here rather
 * than review notes for exactly that reason.
 */

const SAMPLE = cloneTheme(TEMPLATES[0]);

// ── The safety gate ───────────────────────────────────────────────────────

test.describe('every launch template compiles to CSS AO3 accepts', () => {
  for (const template of TEMPLATES) {
    test(`${template.meta.name} passes the lint`, () => {
      expect(lintAo3Css(compile(template))).toEqual([]);
    });
  }

  test('the export carries no comments at all', () => {
    // WORK-SKIN §13: a work skin saved with comments came back from the archive
    // missing eleven consecutive rules, and they returned when the comments
    // went. AO3 deletes comments on save regardless, so nothing here is worth
    // the exposure — the two instructions this file used to carry are in
    // ExportSkinDialog's steps instead, pinned by tests/site-skin.spec.ts.
    for (const template of TEMPLATES) {
      expect(compile(template), template.meta.name).not.toContain('/*');
    }
  });

  test('every detail toggle combination also passes', () => {
    for (const divider of [true, false]) {
      for (const dropCap of [true, false]) {
        for (const scrollbar of [true, false]) {
          for (const tagColors of [true, false]) {
            for (const requiredTagsAsText of [true, false]) {
              for (const tagLabels of [true, false]) {
                for (const tagSeparator of TAG_SEPARATORS) {
                  for (const tagStyle of ['pill', 'label', 'plain'] as const) {
                    const theme: SiteSkinTheme = {
                      ...SAMPLE,
                      shape: { ...SAMPLE.shape, tagStyle, tagColors },
                      reading: {
                        requiredTagsAsText,
                        tagLabels,
                        tagSeparator: tagSeparator.value,
                        statIcons: requiredTagsAsText,
                      },
                      details: { divider, dropCap, scrollbar },
                    };
                    const label = `${tagStyle}/${tagColors}/${divider}/${dropCap}/${scrollbar}/${requiredTagsAsText}/${tagLabels}/${tagSeparator.value}`;
                    expect(lintAo3Css(compile(theme)), label).toEqual([]);
                  }
                }
              }
            }
          }
        }
      }
    }
  });
});

test.describe('the font stacks we offer', () => {
  for (const stack of FONT_STACKS) {
    test(`"${stack.value}" survives sanitize_css_font`, () => {
      // AO3 runs font-family through its own branch, which allows letters,
      // digits, dashes and spaces only. A period in a family name fails the
      // whole declaration and takes the skin down with it.
      expect(isLegalFontStack(stack.value)).toBe(true);
    });
  }

  test('rejects a family name with a character AO3 will not take', () => {
    expect(isLegalFontStack('"Foo.Bar", serif')).toBe(false);
    expect(isLegalFontStack('Foo_Bar, serif')).toBe(false);
  });

  /**
   * The migration guard, and it is the one test in this block whose absence
   * would cost users something they cannot get back.
   *
   * `validateTheme` accepts a font only if the string is a member of
   * `FONT_STACKS`, and a stored theme holds the literal stack string. So
   * "improving" `Georgia, serif` into a deeper chain is not an edit to a list —
   * it silently resets every saved theme that had chosen it, because the stored
   * string stops being found. **The bank is append-only**, and these seven are
   * pinned byte for byte to say so out loud.
   */
  test('the original seven stacks are byte-identical, forever', () => {
    expect(FONT_STACKS.slice(0, 7).map(f => f.value)).toEqual([
      'Georgia, serif',
      "'Palatino Linotype', Palatino, serif",
      "'Times New Roman', Times, serif",
      'Arial, Helvetica, sans-serif',
      "'Trebuchet MS', Verdana, sans-serif",
      'Verdana, Geneva, sans-serif',
      "'Courier New', Courier, monospace",
    ]);
  });

  test('every stack ends in a generic family, so nobody lands on nothing', () => {
    // A font-family is a suggestion. If a reader has none of the named faces
    // and the stack does not end in a generic, their device falls through to
    // AO3's defaults — which is our styling silently not applying rather than
    // degrading. The generic is the floor.
    const GENERIC = ['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy'];
    for (const stack of FONT_STACKS) {
      const last = stack.value.split(',').pop()!.trim();
      expect(GENERIC, stack.value).toContain(last);
    }
  });

  test('no stack carries a character sanitize_css_font refuses', () => {
    // Belt and braces beside isLegalFontStack: that function is our port of
    // AO3's rule, and this asserts the two characters that have actually
    // bitten — a period and an underscore — against the raw string.
    for (const stack of FONT_STACKS) {
      expect(stack.value, stack.value).not.toMatch(/[._]/);
    }
  });

  test('handwriting and display faces are never offered for body text', () => {
    // A script face behind every blurb summary and every chapter makes the
    // archive harder to read, which is the opposite of what a reading skin is
    // for. The rule lives in the bank rather than in the editor so that the
    // storage boundary enforces it too.
    for (const stack of fontStacksFor('body')) {
      expect(['script', 'display'], stack.label).not.toContain(stack.group);
    }
    // And the split is real rather than vacuous.
    expect(fontStacksFor('heading').length).toBeGreaterThan(fontStacksFor('body').length);
    expect(FONT_STACKS.some(f => f.group === 'script')).toBe(true);
  });

  test('a stored theme cannot smuggle a script face into body text', () => {
    // The editor never offers one, so this is about JSON that did not come from
    // the editor — a hand-edited localStorage entry, or a theme saved before a
    // stack changed role.
    const script = FONT_STACKS.find(f => f.group === 'script')!;
    const restored = validateTheme(
      {
        ...JSON.parse(JSON.stringify(SAMPLE)),
        typography: { ...SAMPLE.typography, bodyFont: script.value, headingFont: script.value },
      },
      SAMPLE
    );
    // Heading keeps it — that is where it is legal.
    expect(restored.typography.headingFont).toBe(script.value);
    // Body falls back to the template's own font, not to a global default, so
    // the repaired theme still looks deliberate.
    expect(restored.typography.bodyFont).not.toBe(script.value);
    expect(fontStacksFor('body').some(f => f.value === restored.typography.bodyFont)).toBe(true);
  });

  test('every template still picks fonts the bank offers for that role', () => {
    for (const template of TEMPLATES) {
      expect(
        fontStacksFor('heading').some(f => f.value === template.typography.headingFont),
        `${template.meta.name} heading`
      ).toBe(true);
      expect(
        fontStacksFor('body').some(f => f.value === template.typography.bodyFont),
        `${template.meta.name} body`
      ).toBe(true);
    }
  });

  test('every group has a label, so no optgroup renders untitled', () => {
    for (const stack of FONT_STACKS) {
      expect(FONT_GROUP_LABELS[stack.group], stack.value).toBeTruthy();
    }
  });
});

// ── Banner image addresses ────────────────────────────────────────────────

test.describe('AO3 image address rules', () => {
  // Verdicts, not preferences. Each of these is what URI_REGEX in
  // css_cleaner.rb does, and the whole value of the field is telling the user
  // BEFORE they paste into AO3 and get "your skin could not be saved".
  const accepted = [
    'https://i.imgur.com/aBcD123.png',
    'https://i.postimg.cc/abc/banner.jpg',
    'https://i.ibb.co/xyz/header.jpeg',
    'https://64.media.tumblr.com/5aea8357/s1280x1920/e04cae44.jpg',
    'https://raw.githubusercontent.com/user/repo/main/banner.png',
    'https://wolfbatcat.github.io/ao3-rose-pine/assets/icon.png',
    'https://example.co.uk/a/b/c.gif',
    'https://EXAMPLE.com/Banner.PNG', // matching happens downcased
  ];
  for (const url of accepted) {
    test(`accepts ${url}`, () => {
      expect(checkAo3ImageUrl(url).ok).toBe(true);
    });
  }

  const refused: [url: string, because: string][] = [
    ['https://cdn.discordapp.com/attachments/1/2/a.png?ex=68&is=67', 'query string'],
    ['https://drive.google.com/file/d/abc/view', 'no image extension'],
    ['https://www.dropbox.com/s/abc/banner.png?dl=0', 'query string'],
    ['https://files.catbox.moe/abc123.png', '.moe is not on AO3’s TLD list'],
    ['https://example.com/banner.webp', 'webp is not supported'],
    ['https://example.com/banner.svg', 'svg is not supported'],
    ['https://example.app/banner.png', '.app is not on AO3’s TLD list'],
    ['https://example.com/my banner.png', 'space in the path'],
    ['https://example.com/my%20banner.png', 'percent-encoding'],
    ['ftp://example.com/banner.png', 'not http(s)'],
    ['i.imgur.com/abc.png', 'no scheme'],
  ];
  for (const [url, because] of refused) {
    test(`refuses ${url} — ${because}`, () => {
      const verdict = checkAo3ImageUrl(url);
      expect(verdict.ok).toBe(false);
      // A refusal with no explanation is worse than no check at all.
      expect(verdict.problem, 'no problem stated').toBeTruthy();
      expect(verdict.fix, 'no way forward offered').toBeTruthy();
    });
  }

  test('an empty address is fine — a banner is optional', () => {
    expect(checkAo3ImageUrl('').ok).toBe(true);
    expect(checkAo3ImageUrl('   ').ok).toBe(true);
  });

  test('a refused address blocks export, it does not merely warn', () => {
    // AO3 rejects the entire skin over one bad url(), so the export gate has
    // to treat this as fatal rather than cosmetic.
    const withBadBanner = compile({
      ...SAMPLE,
      header: { ...SAMPLE.header, bannerUrl: 'https://cdn.discordapp.com/a/b.png?ex=1' },
    });
    expect(lintAo3Css(withBadBanner).length).toBeGreaterThan(0);
  });

  test('an accepted address compiles and passes the lint', () => {
    const css = compile({
      ...SAMPLE,
      header: { ...SAMPLE.header, bannerUrl: 'https://i.imgur.com/aBcD123.png' },
    });
    expect(lintAo3Css(css)).toEqual([]);
    expect(css).toContain('background-image: url("https://i.imgur.com/aBcD123.png")');
    expect(css).toContain('background-size: cover');
  });
});

test.describe('the header controls', () => {
  const withBanner = (over: Partial<SiteSkinTheme['header']> = {}) => ({
    ...SAMPLE,
    header: { ...SAMPLE.header, bannerUrl: 'https://i.imgur.com/x.png', ...over },
  });

  test('a banner gives the header a height, or there is nowhere for it to show', () => {
    expect(compile(withBanner({ bannerHeight: '15em' }))).toContain('height: 15em');
    // Structural, not a substring search: the drop cap's `line-height` also
    // contains "height:", which is how this assertion was wrong the first time.
    // The scrollbar's own `height` (its thickness when horizontal) is a
    // different thing from the header's, and is excluded rather than allowed to
    // weaken the assertion.
    const heights = compileRules(SAMPLE)
      .filter(r => !r.selectors.some(s => s.startsWith('::-webkit-scrollbar')))
      .filter(r => r.decls.some(([p]) => p === 'height'));
    expect(heights).toEqual([]);
  });

  test('the accent stays underneath as a fallback for a dead image', () => {
    const rule = compileRules(withBanner()).find(r => r.selectors.includes('#header'))!;
    expect(rule.decls).toContainEqual(['background-color', derive(SAMPLE).accent]);
  });

  test('hiding the logo closes the gap rather than leaving one', () => {
    const css = compile({ ...SAMPLE, header: { ...SAMPLE.header, hideLogo: true } });
    expect(css).toContain('#header .logo');
    expect(css).toContain('display: none');
    expect(css).not.toContain('visibility: hidden');
  });

  test('the glow is only emitted with a banner, and opposes the text colour', () => {
    // On a flat header the foreground already contrasts by construction, so a
    // glow would be a control with no visible effect.
    expect(compile({ ...SAMPLE, header: { ...SAMPLE.header, textShadow: true } })).not.toContain(
      'text-shadow'
    );
    const css = compile(withBanner({ textShadow: true }));
    const d = derive(SAMPLE);
    expect(css).toContain(`text-shadow: 0 0 12px ${d.headerShadow}`);
    expect(d.headerShadow).not.toBe(d.headerFg);
  });

  test('the mock renders a logo, so the toggle is verifiable', () => {
    expect(mockBody('browse')).toContain('class="logo"');
  });

  test('the header text override wins over the accent-derived colour', () => {
    // The escape hatch for a banner whose brightness we cannot measure.
    // Without it a dark image under a light accent leaves the title
    // unreadable, and the only other lever — the accent — repaints every link
    // on the site.
    const light = derive(withBanner({ textColor: 'light' }));
    const dark = derive(withBanner({ textColor: 'dark' }));
    expect(light.headerFg).toBe('#ffffff');
    expect(dark.headerFg).toBe('#241f20');
    // The glow follows the chosen colour, not the accent.
    expect(light.headerShadow).toBe('#000000');
    expect(dark.headerShadow).toBe('#ffffff');
  });

  test("'auto' still derives from the accent, and every template ships auto", () => {
    expect(derive(withBanner({ textColor: 'auto' })).headerFg).toBe(derive(SAMPLE).headerFg);
    for (const template of TEMPLATES) {
      expect(template.header.textColor, template.meta.name).toBe('auto');
    }
  });

  /**
   * The header gradient — a header of its own for a palette-only template,
   * costing zero bytes and no host.
   *
   * The alternative was shipping our own banner images, which would have made
   * us a permanent image host for skins we cannot contact the owners of, on
   * bandwidth that scales with the feature succeeding. §11's "we ship no
   * images" survives revision 6 intact because of this control.
   */
  const withGradient = (gradient: SiteSkinTheme['header']['gradient']) => ({
    ...SAMPLE,
    header: { ...SAMPLE.header, gradient },
  });

  test('flat emits no gradient at all', () => {
    expect(compile(withGradient('none'))).not.toContain('linear-gradient');
  });

  /**
   * The catalog's gradients follow the mood, and this is where that rule is
   * the specification rather than sixteen independent judgement calls.
   *
   * It matters because the alternative to a gradient was shipping our own
   * banner images — which would have made us a permanent image host, on
   * bandwidth that scales with the feature succeeding, for skins whose owners
   * we cannot contact when a file moves. A per-template literal that drifted
   * from the rule would quietly reopen "why is this one flat?" as a taste
   * argument; pinning it to the mood keeps it a decision.
   */
  test('every template carries the gradient its moods imply', () => {
    for (const template of TEMPLATES) {
      expect(template.header.gradient, template.meta.name).toBe(
        gradientFor(template.meta.moods)
      );
    }
  });

  test('minimal stays flat; everything else paints, and all sixteen still lint', () => {
    // Restraint beats expression where a template carries both moods —
    // Terminal Green is `dark, minimal` and must not fade.
    for (const template of TEMPLATES) {
      const css = compile(template);
      const minimal = template.meta.moods.includes('minimal');
      expect(css.includes('linear-gradient'), template.meta.name).toBe(!minimal);
      // The gate has to re-prove every declaration shape we ship, so a catalog
      // change is only safe if it adds none the lint has not already seen.
      expect(lintAo3Css(css), template.meta.name).toEqual([]);
    }
    // Four flat templates would be a rounding error; six is the rule holding.
    expect(TEMPLATES.filter(t => t.header.gradient === 'none')).toHaveLength(6);
    expect(TEMPLATES.filter(t => t.header.gradient === 'diagonal')).toHaveLength(8);
    expect(TEMPLATES.filter(t => t.header.gradient === 'vertical')).toHaveLength(2);
  });

  test('a banner-ready template keeps its gradient underneath the banner', () => {
    // The four exist for an image the user has not pasted yet. Without this
    // they are a flat accent block until they do — and once they do, the
    // gradient is what a dead host degrades to.
    const academia = TEMPLATES.find(t => t.meta.id === 'academia')!;
    expect(academia.header.gradient).toBe('diagonal');

    const withImage = compileRules({
      ...academia,
      header: { ...academia.header, bannerUrl: 'https://i.imgur.com/x.png' },
    }).find(r => r.selectors.includes('#header'))!;
    const images = withImage.decls.filter(([p]) => p === 'background-image');
    expect(images).toHaveLength(1);
    expect(images[0][1].indexOf('url(')).toBeLessThan(images[0][1].indexOf('linear-gradient'));
  });

  test('a gradient runs accent → headerDeep, in literal hex', () => {
    const d = derive(SAMPLE);
    expect(compile(withGradient('vertical'))).toContain(
      `background-image: linear-gradient(180deg, ${d.accent}, ${d.headerDeep})`
    );
    expect(compile(withGradient('diagonal'))).toContain(
      `linear-gradient(135deg, ${d.accent}, ${d.headerDeep})`
    );
    // AO3 has no color-mix(), so both stops must already be resolved.
    expect(compile(withGradient('vertical'))).not.toContain('color-mix');
  });

  test('the banner and the gradient stack in one declaration, banner on top', () => {
    // Two rules setting background-image on #header would be defect 4.2 again:
    // equal specificity, later wins, and one of the two controls quietly stops
    // working. Layer order is paint order, so the gradient is the banner's
    // fallback — a dead image degrades to it rather than to a flat fill.
    const rule = compileRules({
      ...withBanner(),
      header: { ...SAMPLE.header, bannerUrl: 'https://i.imgur.com/x.png', gradient: 'vertical' },
    }).find(r => r.selectors.includes('#header'))!;

    const images = rule.decls.filter(([p]) => p === 'background-image');
    expect(images).toHaveLength(1);
    expect(images[0][1]).toBe(
      `url("https://i.imgur.com/x.png"), linear-gradient(180deg, ${derive(SAMPLE).accent}, ${
        derive(SAMPLE).headerDeep
      })`
    );
  });

  test('the nav bar goes transparent under a gradient, so the header is one surface', () => {
    // AO3's .primary carries its own red fill and a tiled texture. Painting it
    // a flat accent is right for a flat header and wrong for a fading one — it
    // lays an opaque band across the middle of the gradient. What must NOT
    // change is `background-image: none`; that is what removes the tile, and
    // dropping it brings AO3's texture back regardless of the colour beneath.
    const primary = (theme: SiteSkinTheme) =>
      compileRules(theme).find(r => r.selectors.includes('#header .primary'))!;

    expect(primary(withGradient('none')).decls).toContainEqual([
      'background-color',
      derive(SAMPLE).accent,
    ]);
    expect(primary(withGradient('vertical')).decls).toContainEqual([
      'background-color',
      'transparent',
    ]);
    for (const g of ['none', 'vertical', 'diagonal'] as const) {
      expect(primary(withGradient(g)).decls, g).toContainEqual(['background-image', 'none']);
    }
  });

  test('a gradient alone gets no background-size, which it does not need', () => {
    const rule = compileRules(withGradient('vertical')).find(r => r.selectors.includes('#header'))!;
    expect(rule.decls.some(([p]) => p === 'background-image')).toBe(true);
    expect(rule.decls.some(([p]) => p === 'background-size')).toBe(false);
  });

  test('a gradient header lints clean — the §17 correction, end to end', () => {
    // This is the assertion that would have failed before Phase 11. AO3 routes
    // any token containing `gradient` to sanitize_css_gradient rather than to
    // the value grammar, and our lint did not model that branch, so it refused
    // every gradient the archive accepts.
    for (const gradient of ['vertical', 'diagonal'] as const) {
      expect(lintAo3Css(compile(withGradient(gradient))), gradient).toEqual([]);
      expect(lintAo3Css(compile({ ...withBanner(), header: { ...SAMPLE.header, bannerUrl: 'https://i.imgur.com/x.png', gradient } })), gradient).toEqual([]);
    }
  });
});

// ── Reading: required tags as words ───────────────────────────────────────

/**
 * The accessibility control, and the one place this product is measurably
 * better than the snippet everybody copies.
 *
 * Two claims are worth pinning beyond "the CSS came out": that we **un-hide**
 * AO3's own words rather than generating any, and that we identify the four
 * tags by their **class** rather than by their position in the list. The corpus
 * add-on does the latter with `li+li+li` offsets hand-tuned to one person's
 * font size, and it breaks for everyone else.
 */
test.describe('required tags as words', () => {
  const withWords = (requiredTagsAsText: boolean, tagColors = SAMPLE.shape.tagColors) => ({
    ...SAMPLE,
    shape: { ...SAMPLE.shape, tagColors },
    reading: { ...SAMPLE.reading, requiredTagsAsText },
  });

  test('off in every shipped template, and off emits nothing at all', () => {
    // It changes the shape of every listing on the archive. A reader who
    // picked a palette did not ask for that, which is the decision recorded in
    // templates.ts — and this is where a template quietly acquiring it fails.
    for (const template of TEMPLATES) {
      expect(template.reading.requiredTagsAsText, template.meta.name).toBe(false);
      expect(compile(template), template.meta.name).not.toContain('required-tags');
    }
    expect(compile(withWords(false))).not.toContain('required-tags');
    expect(compile(withWords(false))).not.toContain('span.text');
  });

  test('every AO3 default that hides the words is undone', () => {
    // Each row here is a real rule in 13-group-blurb.css. Leaving any one of
    // them standing leaves the control half-working in a way that looks like
    // our bug: the words appear inside a 25px box, or behind the sprite, or
    // with 65px of empty space still reserved beside them.
    const rules = compileRules(withWords(true));
    const declsFor = (selector: string) =>
      rules.filter(r => r.selectors.includes(selector)).flatMap(r => r.decls);

    // position: absolute; top: 0; width: 60px
    expect(declsFor('.blurb ul.required-tags')).toEqual(
      expect.arrayContaining([
        ['position', 'static'],
        ['width', 'auto'],
      ])
    );

    // display: block; width: 25px; height: 25px — on all three levels
    for (const selector of [
      '.blurb ul.required-tags li',
      '.blurb ul.required-tags li a',
      '.blurb ul.required-tags li span',
    ]) {
      expect(declsFor(selector), selector).toEqual(
        expect.arrayContaining([
          ['display', 'inline'],
          ['height', 'auto'],
          ['width', 'auto'],
        ])
      );
    }

    // The absolute positioning of the third and fourth icons.
    expect(declsFor('.blurb ul.required-tags li + li + li')).toEqual(
      expect.arrayContaining([
        ['left', 'auto'],
        ['position', 'static'],
        ['top', 'auto'],
      ])
    );

    // height: 0; width: 0; font-size: 0.001em; color: transparent
    expect(declsFor('.blurb span.text')).toEqual(
      expect.arrayContaining([
        ['color', 'inherit'],
        ['font-size', '1em'],
      ])
    );

    // The sprite. Same defect as the footer's red tile if it survives (§4.6).
    expect(declsFor('.blurb ul.required-tags li span')).toContainEqual([
      'background-image',
      'none',
    ]);

    // The 65px the icon block used to occupy, and the 55px floor under it.
    expect(declsFor('.blurb .header .heading')).toContainEqual(['margin-left', '0']);
    expect(declsFor('.blurb .header ul')).toContainEqual(['margin-left', '0']);
    expect(declsFor('.blurb .header')).toContainEqual(['min-height', '0']);
  });

  test('the fourth icon needs no rule of its own', () => {
    // AO3 positions it with `li+li+li+li`, which is more specific than our
    // `li+li+li` — but ours carries !important and beats it anyway, and
    // `li+li+li` already matches the fourth item. A second selector would be a
    // redundant owner of `top`, which is how §4.2 started.
    const selectors = compileRules(withWords(true)).flatMap(r => r.selectors);
    expect(selectors).toContain('.blurb ul.required-tags li + li + li');
    expect(selectors).not.toContain('.blurb ul.required-tags li + li + li + li');
  });

  test('the four tags are identified by class, never by position', () => {
    const rules = compileRules(withWords(true, true));
    const colored = rules.filter(r => r.decls.some(([p]) => p === 'color'));

    for (const type of ['rating', 'warnings', 'category', 'iswip']) {
      expect(
        colored.some(r => r.selectors.some(s => s.includes(`.required-tags .${type}`))),
        type
      ).toBe(true);
    }
    // Nothing decides what a tag *means* from where it sits in the list. The
    // adjacency rule that does exist only resets AO3's positioning.
    for (const rule of colored) {
      for (const selector of rule.selectors) {
        expect(selector.includes('+'), `${selector} colours by position`).toBe(false);
      }
    }
  });

  test('the type colours are the theme’s own, and only when tags are coloured', () => {
    const d = derive(withWords(true, true));
    const css = compile(withWords(true, true));
    expect(css).toContain(`.blurb ul.required-tags .warnings {\n  color: ${d.tagColors.warning}`);
    expect(css).toContain(`.blurb ul.required-tags .category {\n  color: ${d.tagColors.relationship}`);

    // Four hues, four different colours — the whole point is telling a rating
    // from a warning at a glance.
    const used = new Set([
      d.tagColors.warning,
      d.tagColors.relationship,
      d.tagColors.character,
      d.tagColors.freeform,
    ]);
    expect(used.size).toBe(4);

    // With "colour tags by type" off, the words inherit like any other text.
    // A reader who asked for one colour scheme does not get four here either.
    expect(compile(withWords(true, false))).not.toContain('.required-tags .warnings');
  });

  test('the words the control reveals are AO3’s, already in the mock', () => {
    // Invariant 4, and the claim the feature rests on: this un-hides content
    // rather than generating it. If the mock had to add the words, the control
    // would be inventing them on AO3 too — and it cannot, because CSS has no
    // way to know a work's rating.
    const browse = mockBody('browse');
    expect(browse).toContain('<ul class="required-tags">');
    expect(browse).toContain('<span class="text">No Archive Warnings Apply</span>');
    expect(browse).toContain('rating');
    expect(browse).toContain('iswip');
    // A work in progress and a completed one, so the status is a real signal
    // in the preview rather than the same word four times.
    expect(browse).toContain('Work in Progress');
    expect(browse).toContain('Complete Work');
    // AO3's own hiding, without which the control has nothing to undo.
    expect(AO3_BASE_CSS).toContain('.blurb span.text { height: 0; width: 0;');
    expect(AO3_BASE_CSS).toContain('.blurb .header { min-height: 55px;');

    // And AO3's own source order, which decides a real cascade question: both
    // selectors are (0,2,1), so the later `margin: 0` is the only thing keeping
    // the icon block out of the 65px gutter it exists to create.
    expect(AO3_BASE_CSS.indexOf('.blurb .header .heading, .blurb .header ul')).toBeLessThan(
      AO3_BASE_CSS.indexOf('.blurb ul.required-tags { position: absolute;')
    );
  });

  test('a stored theme cannot smuggle anything through the reading group', () => {
    const restored = validateTheme(
      { ...SAMPLE, reading: { requiredTagsAsText: 'yes please', tagLabels: 1 } },
      SAMPLE
    );
    expect(restored.reading.requiredTagsAsText).toBe(SAMPLE.reading.requiredTagsAsText);
    expect(restored.reading.tagLabels).toBe(SAMPLE.reading.tagLabels);

    const missing = validateTheme({ ...SAMPLE, reading: undefined }, SAMPLE);
    expect(missing.reading.requiredTagsAsText).toBe(SAMPLE.reading.requiredTagsAsText);
    expect(missing.reading.tagSeparator).toBe(SAMPLE.reading.tagSeparator);

    const kept = validateTheme(
      { ...SAMPLE, reading: { requiredTagsAsText: true, tagLabels: true, tagSeparator: 'line' } },
      SAMPLE
    );
    expect(kept.reading.requiredTagsAsText).toBe(true);
    expect(kept.reading.tagLabels).toBe(true);
    expect(kept.reading.tagSeparator).toBe('line');

    // The separator reaches a `content` string and a `float`, so a stored value
    // that is not one of the three is a stored theme writing CSS.
    const forged = validateTheme(
      { ...SAMPLE, reading: { ...SAMPLE.reading, tagSeparator: '"; float: right; content: "' } },
      SAMPLE
    );
    expect(forged.reading.tagSeparator).toBe(SAMPLE.reading.tagSeparator);
  });
});

test.describe('tag group labels and the separator', () => {
  const withTags = (reading: Partial<SiteSkinTheme['reading']>): SiteSkinTheme => ({
    ...SAMPLE,
    reading: { ...SAMPLE.reading, ...reading },
  });

  /**
   * The ten selectors, written out rather than generated.
   *
   * The compiler builds them from a loop, so a test that built them the same
   * way would pass on a loop that had lost a group. Four `:first-child`,
   * because `hide_warnings?` and `hide_freeform?` mean any group can be first;
   * six adjacency, because a group can follow any group that precedes it in
   * AO3's order rather than only the one immediately before it.
   */
  const GROUP_STARTS = [
    'ul.tags li.warnings:first-child',
    'ul.tags li.relationships:first-child',
    'ul.tags li.warnings + li.relationships',
    'ul.tags li.characters:first-child',
    'ul.tags li.warnings + li.characters',
    'ul.tags li.relationships + li.characters',
    'ul.tags li.freeforms:first-child',
    'ul.tags li.warnings + li.freeforms',
    'ul.tags li.relationships + li.freeforms',
    'ul.tags li.characters + li.freeforms',
  ];

  test('off in every shipped template, and off emits nothing at all', () => {
    for (const template of TEMPLATES) {
      expect(template.reading.tagLabels, template.meta.name).toBe(false);
      expect(template.reading.tagSeparator, template.meta.name).toBe('comma');
    }
    // 'comma' is AO3's own separator, so the correct output is no rule at all:
    // a theme saved before this control existed still compiles byte-identically.
    const css = compile(withTags({}));
    expect(css).not.toContain('ul.tags');
    expect(css).not.toContain(':not(:last-child)');
  });

  test('every way a tag group can start carries its label', () => {
    const rules = compileRules(withTags({ tagLabels: true }));
    const emitted = rules.flatMap(r => r.selectors).filter(s => s.endsWith('::before'));
    expect(emitted.sort()).toEqual(GROUP_STARTS.map(s => `${s}::before`).sort());
  });

  test('each label is AO3s own wording, on the group it names', () => {
    const rules = compileRules(withTags({ tagLabels: true }));
    const contentFor = (selector: string) =>
      rules
        .find(r => r.selectors.includes(`${selector}::before`))!
        .decls.find(([property]) => property === 'content')![1];

    // A label on the wrong run is the one defect this control can have that
    // still looks finished: every group is labelled, and one of them lies.
    expect(contentFor('ul.tags li.warnings:first-child')).toBe('"Archive Warnings: "');
    expect(contentFor('ul.tags li.warnings + li.relationships')).toBe('"Relationships: "');
    expect(contentFor('ul.tags li.relationships + li.characters')).toBe('"Characters: "');
    expect(contentFor('ul.tags li.characters + li.freeforms')).toBe('"Additional Tags: "');
    expect(contentFor('ul.tags li.warnings + li.freeforms')).toBe('"Additional Tags: "');
  });

  test('the separator never overrides AO3s suppression on the last tag', () => {
    // AO3 ends its own list with `.commas li:last-child:after { content: none }`.
    // Ours carries !important, so a bare `.commas li::after` would beat that and
    // hang a bullet off the end of every tag list - visible at the end of a
    // line, which is exactly where a reader is looking.
    for (const tagSeparator of ['bullet', 'line'] as const) {
      const rules = compileRules(withTags({ tagSeparator }));
      const separators = rules.filter(r =>
        r.selectors.some(s => s.startsWith('ul.tags') && s.includes('::after'))
      );
      expect(separators, tagSeparator).toHaveLength(1);
      expect(separators[0].selectors, tagSeparator).toEqual([
        'ul.tags.commas li:not(:last-child)::after',
      ]);
    }
  });

  test('bullets replace the comma; lines remove it', () => {
    const contentOf = (theme: SiteSkinTheme) =>
      compileRules(theme)
        .find(r => r.selectors[0] === 'ul.tags.commas li:not(:last-child)::after')!
        .decls.find(([property]) => property === 'content')![1];

    expect(contentOf(withTags({ tagSeparator: 'bullet' }))).toBe('" • "');
    // A comma before a line break is the artifact this option exists to avoid.
    expect(contentOf(withTags({ tagSeparator: 'line' }))).toBe('""');
  });

  test('one group per line clears on the same ten selectors as the labels', () => {
    // The two controls share one list, and the way a second copy of it would
    // drift is a group quietly sharing a line with the one before it.
    const rules = compileRules(withTags({ tagSeparator: 'line' }));
    const clearing = rules.find(r => r.decls.some(([property]) => property === 'clear'))!;
    expect(clearing.selectors.sort()).toEqual([...GROUP_STARTS].sort());
  });

  test('the floated tag list is contained, or it lands on the summary', () => {
    // §26c.1, in a second place. A `ul` whose every child floats has no height,
    // so the blockquote below it is laid out at the top of the tag block and the
    // tags overlap somebody's summary. Correct on a short tag list; wrong the
    // moment it wraps, which is every popular work.
    const rules = compileRules(withTags({ tagSeparator: 'line' }));
    const container = rules.find(r => r.selectors.includes('ul.tags'))!;
    expect(container.decls).toEqual([['overflow', 'hidden']]);

    const tagRules = (all: ReturnType<typeof compileRules>) =>
      all.filter(r => r.selectors.every(s => s.startsWith('ul.tags')));
    const floated = tagRules(rules).find(r =>
      r.decls.some(([property]) => property === 'float')
    )!;
    expect(floated.selectors).toEqual([
      'ul.tags li.warnings',
      'ul.tags li.relationships',
      'ul.tags li.characters',
      'ul.tags li.freeforms',
    ]);

    // Bullets float nothing, so nothing needs containing.
    const bullets = tagRules(compileRules(withTags({ tagSeparator: 'bullet' })));
    expect(bullets.some(r => r.decls.some(([property]) => property === 'float'))).toBe(false);
    expect(bullets.some(r => r.selectors.includes('ul.tags'))).toBe(false);
  });

  test('the mock exercises all ten, and AO3s comma is in it to be replaced', () => {
    // Invariant 4: a rule that cannot be watched ships unverified. Three of the
    // ten had no blurb to land on until the mock gained two - a listing that
    // starts with characters, and one that jumps warnings to additional tags.
    const groupsOf = (html: string) =>
      [...html.matchAll(/<ul class="tags commas">([\s\S]*?)<\/ul>/g)].map(m =>
        [...m[1].matchAll(/<li class="(\w+)"/g)].map(li => li[1])
      );

    const runs = [...groupsOf(mockBody('browse')), ...groupsOf(mockBody('dashboard'))];
    const seen = new Set<string>();
    for (const groups of runs) {
      groups.forEach((group, i) => {
        if (i === 0) seen.add(`ul.tags li.${group}:first-child`);
        else if (groups[i - 1] !== group) seen.add(`ul.tags li.${groups[i - 1]} + li.${group}`);
      });
    }
    expect([...seen].sort()).toEqual([...GROUP_STARTS].sort());

    // And the thing the separator replaces is actually rendered. Without AO3's
    // own rule in the base CSS the preview shows tags separated by nothing, and
    // "Commas" looks identical to "Bullets" with the bullets missing.
    expect(AO3_BASE_CSS).toContain('.commas li:after { content: ", "; }');
    expect(AO3_BASE_CSS).toContain('.commas li:last-child:after');
  });
});

test.describe('stats as icons', () => {
  const withIcons = (statIcons: boolean): SiteSkinTheme => ({
    ...SAMPLE,
    reading: { ...SAMPLE.reading, statIcons },
  });

  /** The seven that get a glyph, and the four that keep their word. */
  const ICONED = ['words', 'chapters', 'comments', 'kudos', 'bookmarks', 'hits', 'collections'];
  const LABELLED = ['published', 'status', 'updated', 'language'];

  test('off in every shipped template, and off emits nothing at all', () => {
    for (const template of TEMPLATES) {
      expect(template.reading.statIcons, template.meta.name).toBe(false);
    }
    expect(compile(withIcons(false))).not.toContain('dl.stats');
  });

  test('the label is hidden the way AO3 hides its own, not removed', () => {
    // The corpus add-on uses `display: none`, which takes "Kudos" out of the
    // accessibility tree and leaves a screen reader reading a bare number. The
    // whole argument for §18c-2 was that we are the version that gets this
    // right, so this assertion is the one that would make this control a
    // contradiction if it ever failed.
    const rules = compileRules(withIcons(true));
    const hiding = rules.find(r => r.selectors.includes('dl.stats dt.kudos'))!;
    const properties = hiding.decls.map(([property]) => property);
    expect(properties).not.toContain('display');
    expect(properties).not.toContain('visibility');
    expect(hiding.decls).toEqual([
      ['clip', 'rect(0, 0, 0, 0)'],
      ['height', '1px'],
      ['overflow', 'hidden'],
      ['position', 'absolute'],
      ['width', '1px'],
    ]);

    // `clip-path` is refused by AO3's sanitizer outright and `clip` is not,
    // which is why the deprecated property is the correct one here.
    expect(compile(withIcons(true))).not.toContain('clip-path');
  });

  test('only the labels that gain an icon lose their word', () => {
    // A work page's stats open with "Published: 2026-08-06". Hiding every `dt`
    // in `dl.stats` — which is what §18c-5's spec literally says — leaves that
    // date as a number with no label and no glyph, on every work on the archive.
    const rules = compileRules(withIcons(true));
    const hidden = rules
      .filter(r => r.selectors.some(s => s.includes('dl.stats dt')))
      .flatMap(r => r.selectors);

    expect(hidden.sort()).toEqual(ICONED.map(stat => `dl.stats dt.${stat}`).sort());
    for (const stat of LABELLED) {
      expect(hidden, stat).not.toContain(`dl.stats dt.${stat}`);
    }
  });

  test('every hidden label is replaced by exactly one glyph', () => {
    // A label hidden with no icon to take its place is a stat the reader can no
    // longer identify, and the two halves live in two different rules — so
    // nothing but this test keeps them in step.
    const rules = compileRules(withIcons(true));
    const iconed = rules
      .filter(r => r.selectors.some(s => s.startsWith('dl.stats dd.')))
      .map(r => {
        expect(r.selectors).toHaveLength(1);
        expect(r.decls).toHaveLength(1);
        return r.selectors[0];
      });

    expect(iconed.sort()).toEqual(ICONED.map(stat => `dl.stats dd.${stat}::before`).sort());

    for (const rule of rules) {
      for (const [property, value] of rule.decls) {
        if (property !== 'content' || !rule.selectors[0].startsWith('dl.stats')) continue;
        // Fully quoted, and not empty — an icon rule that lost its glyph would
        // hide a label and put nothing in its place.
        expect(value.startsWith('"') && value.endsWith('"'), rule.selectors[0]).toBe(true);
        expect(value.length, rule.selectors[0]).toBeGreaterThan(3);
      }
    }
  });

  test('the mock renders both places AO3 puts a stats list', () => {
    // Invariant 4, and the reason the "only seven" rule above is watchable:
    // the listing's stats and the work page's stats are different rows, and the
    // work page is the one that carries a date.
    const browse = mockBody('browse');
    for (const stat of ICONED.filter(s => s !== 'collections')) {
      expect(browse, stat).toContain(`<dd class="${stat}"`);
    }
    expect(browse).toContain('<dt class="language">');

    const reading = mockBody('reading');
    expect(reading).toContain('<dd class="stats">');
    expect(reading).toContain('<dt class="published">');
    expect(reading).toContain('<dd class="kudos">');

    // AO3's own rules for that second context, or the preview lays the row out
    // in a way the real page never would.
    expect(AO3_BASE_CSS).toContain('.meta .stats dl');
  });
});

// ── Ownership: the §4 defects, as regressions ─────────────────────────────

test.describe('region ownership', () => {
  test('no selector is given the same property twice', () => {
    // Defect 4.2: the prototype set background-color on #main in two rules,
    // and the later one silently ate the Page colour control.
    //
    // Run with every optional control ON as well as with the shipped defaults.
    // A conditional block is exactly where a second owner hides: the rules are
    // not emitted at all for most themes, so a duplicate would pass this test
    // for every template in the catalog and still break the one skin whose
    // owner had turned the control on.
    const themes: [string, SiteSkinTheme][] = [
      ['as shipped', SAMPLE],
      [
        'every control on, one group per line',
        {
          ...SAMPLE,
          shape: { ...SAMPLE.shape, tagColors: true },
          reading: { requiredTagsAsText: true, tagLabels: true, tagSeparator: 'line', statIcons: true },
          details: { divider: true, dropCap: true, scrollbar: true },
        },
      ],
      // The separator is the one control with three states rather than two, and
      // `bullet` emits a different rule set from `line` — so a duplicate owner
      // introduced by one of them would hide behind the other.
      [
        'every control on, bullets',
        {
          ...SAMPLE,
          shape: { ...SAMPLE.shape, tagColors: true },
          reading: { requiredTagsAsText: true, tagLabels: true, tagSeparator: 'bullet', statIcons: true },
          details: { divider: true, dropCap: true, scrollbar: true },
        },
      ],
    ];

    for (const [label, theme] of themes) {
      const seen = new Map<string, string>();
      for (const rule of compileRules(theme)) {
        for (const selector of rule.selectors) {
          for (const [property] of rule.decls) {
            const key = `${selector} { ${property} }`;
            expect(seen.has(key), `${label}: ${key} is owned by two rules`).toBe(false);
            seen.set(key, property);
          }
        }
      }
    }
  });

  test('#main is never given a background', () => {
    // AO3's own 05-region-main.css sets none, so body showing through IS the
    // page colour. Painting #main is how "Page" stops meaning anything.
    for (const rule of compileRules(SAMPLE)) {
      const paintsMain = rule.selectors.includes('#main');
      const hasBackground = rule.decls.some(([p]) => p.startsWith('background'));
      expect(paintsMain && hasBackground).toBe(false);
    }
  });

  test('the text-size scale is emitted exactly once, on body', () => {
    // Defect 4.3: the prototype set a percentage font-size on body,
    // #outer.wrapper AND #main in one rule, and nested percentages multiply.
    // The drop cap's `font-size: 4em` is a different thing and is allowed —
    // what must be unique is the percentage that scales the whole page.
    const carriers = compileRules({ ...SAMPLE, details: { ...SAMPLE.details, divider: true, dropCap: true } })
      .filter(r => r.decls.some(([p, v]) => p === 'font-size' && v.endsWith('%')))
      .flatMap(r => r.selectors);
    expect(carriers).toEqual(['body']);
  });

  test('the drop cap is scoped to chapter text, never to #workskin', () => {
    // Defect 4.1: :first-of-type matches once per PARENT, so an unscoped
    // selector decorates the summary and every set of notes too.
    const css = compile({ ...SAMPLE, details: { ...SAMPLE.details, divider: false, dropCap: true } });
    expect(css).toContain('#chapters .userstuff > p:first-of-type::first-letter');
    expect(css).not.toContain('#workskin p:first-of-type');
  });

  test('the details rules reach direct children only, never into a work skin', () => {
    // Plan §14, found on a real AO3 page. A work skin is nested markup inside
    // the chapter — divs inside divs, each holding a <p> — and every one of
    // those divs is a parent that `:first-of-type` matches. The descendant form
    // put a floated 4em capital on every chat bubble in the work.
    //
    // Asserted as the ABSENCE of the descendant form, because that is the bug:
    // a `>` sitting somewhere in the stylesheet proves nothing if the loose
    // selector is still there too.
    const css = compile({ ...SAMPLE, details: { ...SAMPLE.details, divider: true, dropCap: true } });
    expect(css).not.toContain('#chapters .userstuff p:first-of-type');
    expect(css).not.toContain('#chapters .userstuff hr');
    expect(css).toContain('#chapters .userstuff > p:first-of-type::first-letter');
    expect(css).toContain('#chapters .userstuff > hr');
    expect(css).toContain('#chapters .userstuff > hr::after');
  });

  test('the Reading mock contains an author work skin for those rules to spare', () => {
    // Without nested markup in the mock, an over-reaching selector looks
    // perfect until a reader turns the skin on over a real fic — which is
    // exactly how this shipped.
    const reading = mockBody('reading');
    expect(reading).toContain('class="chat ios"');
    expect(reading).toContain('class="bubble in"');
    // A <p> that is :first-of-type inside its own parent, and must stay plain.
    expect(reading).toMatch(/<div class="bubble in"><p>/);
    // An author's own <hr>, which must not receive our ornament.
    expect(reading).toContain('<hr class="rule" />');
  });

  test('every declaration carries !important, except where an author must win', () => {
    // A user site skin loads with role "user", so AO3's ID- and class-scoped
    // defaults are still there and outrank ours on specificity.
    //
    // The exceptions are not an escape hatch: they are the rules that can land
    // inside somebody's story (plan §14). A work skin is rendered in the body,
    // after our stylesheet, and scoped to #workskin — so `!important` is the
    // only thing that would let a reader's theme rewrite an author's layout.
    // Enumerated here, so adding a seventh is a deliberate act with a test to
    // change rather than a quiet omission.
    const AUTHOR_WINS = [
      'blockquote',
      'address',
      '#workskin',
      '#chapters .userstuff > hr',
      '#chapters .userstuff > hr::after',
      '#chapters .userstuff > p:first-of-type',
      '#chapters .userstuff > p:first-of-type::first-letter',
    ];

    // Every optional block on, so the conditional rules are inside the sweep
    // rather than skipped by it. A required-tags rule lands in a listing, never
    // inside a work, so it belongs on the loud side of this test.
    const themed = {
      ...SAMPLE,
      reading: {
        requiredTagsAsText: true,
        tagLabels: true,
        tagSeparator: 'line' as const,
        statIcons: true,
      },
      details: { ...SAMPLE.details, divider: true, dropCap: true },
    };
    let counted = 0;

    for (const rule of compileRules(themed)) {
      const quiet = rule.selectors.every(s => AUTHOR_WINS.includes(s));
      // A rule must be wholly one or the other; a mixed rule would give one of
      // its selectors the wrong cascade weight.
      expect(
        rule.selectors.some(s => AUTHOR_WINS.includes(s)),
        `${rule.selectors.join(', ')} mixes author-wins and chrome selectors`
      ).toBe(quiet);
      if (!quiet) counted += rule.decls.length;
    }
    expect(counted).toBeGreaterThan(30);

    // And the emitted text agrees with the structure.
    const body = stripCssComments(compile(themed));
    for (const block of body.split('\n\n')) {
      const selectors = block.slice(0, block.indexOf('{')).split(',').map(s => s.trim());
      const quiet = selectors.every(s => AUTHOR_WINS.includes(s));
      const declarations = block.match(/[a-z-]+\s*:[^;{}]+;/g) ?? [];
      for (const declaration of declarations) {
        if (quiet) expect(declaration, `${selectors[0]}: ${declaration}`).not.toContain('!important');
        else expect(declaration, `${selectors[0]}: ${declaration}`).toContain('!important');
      }
    }
  });

  test('the rules that reach into a work do not shout at its author', () => {
    // The specific failure: a reader's site skin overriding a work skin. AO3
    // renders a work skin in the BODY, after our stylesheet, and prefixes every
    // selector with #workskin — so the author beats us on order and specificity
    // both, and only `!important` could take that away from them.
    const css = compile({ ...SAMPLE, details: { ...SAMPLE.details, divider: true, dropCap: true } });

    const ruleFor = (selector: string) =>
      css.split('\n\n').find(block => block.startsWith(`${selector} {`))!;

    for (const selector of [
      '#workskin',
      '#chapters .userstuff > hr',
      '#chapters .userstuff > p:first-of-type',
      '#chapters .userstuff > p:first-of-type::first-letter',
    ]) {
      expect(ruleFor(selector), selector).toBeDefined();
      expect(ruleFor(selector), selector).not.toContain('!important');
    }

    // Chrome still shouts, or half the skin does nothing on a real page (§3b).
    expect(ruleFor('#header .primary')).toContain('!important');
    expect(css).toContain('background-color: #101725 !important'); // body
  });
});

/**
 * §18a. Seven of sixteen templates have a dark page, and until these rules
 * landed AO3's own defaults left light-grey islands on every one of them: every
 * button, every pagination number, every form field, every comment byline.
 *
 * The tests that matter here are not "is it painted" — that is one assertion —
 * but the two decisions that are easy to undo by accident.
 */
test.describe('chrome regions', () => {
  const DARK = cloneTheme(TEMPLATES.find(t => t.meta.category === 'dark') ?? TEMPLATES[0]);
  const css = compile(DARK);
  const d = derive(DARK);

  test('buttons, fields, pagination, comments and autocomplete are all repainted', () => {
    for (const selector of [
      '#main .actions a',
      '#main button',
      '#main input',
      '#main input:focus',
      '#main .current',
      '#main fieldset legend',
      'li.comment',
      '.comment h4.byline',
      '.thread .even',
      '.autocomplete .dropdown ul li',
      '.autocomplete .dropdown ul li.selected',
    ]) {
      expect(css, selector).toContain(`${selector}`);
    }
    // None of AO3's greys survive on a dark theme.
    expect(css).toContain(`background-color: ${d.controlBg}`);
    expect(css).toContain(`background-color: ${d.commentAlt}`);
    expect(css).toContain(`background-color: ${d.fieldBg}`);
  });

  test('the button rule kills AO3s gradient, not just its background colour', () => {
    // 08-actions.css layers linear-gradient(#fff 2%, #ddd 95%, #bbb 100%) on TOP
    // of background: #eee, plus four vendor-prefixed copies. A background-color
    // alone leaves the white-to-grey gradient sitting over it, and the control
    // looks like it does nothing — the same defect as the footer's red tile.
    const buttonRule = css.split('\n\n').find(block => block.startsWith('#main .actions a,'))!;
    expect(buttonRule).toBeDefined();
    expect(buttonRule).toContain('background-image: none');
  });

  /**
   * The decision most likely to be "simplified" back into a bug.
   *
   * §18a's table specifies bare `.actions a`, `button`, `input` — which is what
   * AO3 itself uses and what the corpus uses. We cannot, because our
   * declarations carry `!important`. AO3 exempts its own header and footer from
   * the button cascade with ID-scoped rules at (1,0,1) that beat `.actions a` at
   * (0,1,1) — but those exemptions are NOT `!important`, so a shouted bare
   * selector from us defeats them and puts a button-coloured chip behind every
   * header nav link and every footer link, on every page.
   */
  test('no control selector is emitted bare, or it would repaint the header and footer', () => {
    const selectors = compileRules(DARK).flatMap(r => r.selectors);
    for (const bare of [
      '.actions a',
      '.actions a:link',
      '.actions button',
      '.actions input',
      '.actions label',
      'button',
      'input',
      'textarea',
      'select',
      'input[type="submit"]',
      '.current',
      'fieldset legend',
    ]) {
      expect(selectors, `"${bare}" must be scoped to #main`).not.toContain(bare);
    }
    // And the scoped forms really are there, so this is not passing vacuously.
    expect(selectors).toContain('#main .actions a');
    expect(selectors).toContain('#main input');
  });

  test('the dashboard keeps its own current-item colour', () => {
    // Two owners for two different affordances: #dashboard .current is a nav
    // highlight, #main .current is a page number. They can never collide —
    // #dashboard is a SIBLING of #main, not inside it — but a future reader
    // seeing two `.current` rules should find the reason pinned rather than
    // "fix" one of them away.
    const rules = compileRules(DARK);
    const dashboard = rules.find(r => r.selectors.includes('#dashboard .current'))!;
    const pagination = rules.find(r => r.selectors.includes('#main .current'))!;
    expect(dashboard.decls).toContainEqual(['background-color', d.border]);
    expect(pagination.decls).toContainEqual(['background-color', d.accent]);
  });

  test('every control is watchable in the preview, and the comment thread sits outside the work', () => {
    // Invariant 4. §14c is what forgetting it costs.
    const browse = mockBody('browse');
    expect(browse).toContain('class="actions"');
    expect(browse).toContain('class="pagination actions"');
    expect(browse).toContain('class="current"');
    expect(browse).toContain('type="submit"');
    // Rendered OPEN, or the .selected rule ships unverified — the same argument
    // that put the header dropdown in the mock.
    expect(browse).toContain('class="autocomplete"');
    expect(browse).toContain('<li class="selected">');

    const reading = mockBody('reading');
    expect(reading).toContain('id="feedback"');
    expect(reading).toContain('class="comment group even"');
    expect(reading).toContain('h4 class="byline heading"');
    expect(reading).toContain('<textarea');

    // #feedback is a SIBLING of #work-skin, never a child. That is what makes
    // `!important` safe on every comment rule: an author's work skin is scoped
    // to #workskin by AO3 and cannot reach a comment, so there is no author to
    // trample (§14b). Nesting it inside the work would quietly make that false.
    const workSkinStart = reading.indexOf('id="work-skin"');
    const feedbackStart = reading.indexOf('id="feedback"');
    const workSkinEnd = reading.indexOf('</div>', reading.indexOf('id="chapters"'));
    expect(workSkinStart).toBeGreaterThan(-1);
    expect(feedbackStart).toBeGreaterThan(workSkinEnd);
  });

  test('every template still lints clean with the chrome rules', () => {
    for (const template of TEMPLATES) {
      expect(lintAo3Css(compile(template)), template.meta.name).toEqual([]);
    }
  });

  /**
   * The test that earns its place, and the one whose absence let a real bug
   * through a green suite.
   *
   * `mixHex(a, b, weight)` keeps `weight` of the FIRST colour. The chrome
   * colours were first written as `mixHex(surface, text, 0.1)` — which is 90%
   * text — so on every dark template `controlBg` came out a light cream and
   * then carried cream text on top of it. Invisible buttons, on seven of
   * sixteen templates: defect §4.4 exactly, in a new region.
   *
   * Every assertion above still passed, because they compared the emitted value
   * against `d.controlBg` and were therefore tautological. A derived colour is
   * only meaningfully tested against a contrast floor.
   *
   * 4.5:1 is WCAG AA for body text, which is what a button label and a comment
   * are. The byline and the comment body both sit on these, so both are checked.
   */
  for (const template of TEMPLATES) {
    test(`${template.meta.name}: every chrome surface carries legible text`, () => {
      const t = derive(template);
      const surfaces: [string, string][] = [
        ['controlBg (buttons, bylines, legends)', t.controlBg],
        ['fieldBg (inputs, textareas)', t.fieldBg],
        ['commentAlt (alternating comments)', t.commentAlt],
      ];
      for (const [name, bg] of surfaces) {
        expect(contrastRatio(t.text, bg), `${name} ${bg} vs text ${t.text}`).toBeGreaterThanOrEqual(4.5);
      }
      // The hover and .current states swap to the accent with the header
      // foreground on it — the same pairing the header already guarantees.
      expect(contrastRatio(t.headerFg, t.accent), 'headerFg on accent').toBeGreaterThanOrEqual(WCAG_LARGE_MIN);
      // And a button has to be distinguishable from the card it sits on, or the
      // whole control is invisible in a different way.
      expect(contrastRatio(t.controlBg, t.surface), 'controlBg vs surface').toBeGreaterThan(1.05);
    });
  }
});

/**
 * §22. The region audit — the four page types out of nine that a real skin
 * author screenshots and we had never styled.
 *
 * These tests exist in a particular shape because of how the gap was found. It
 * was not found by looking at the preview: the preview showed three
 * finished-looking states and would have gone on showing them indefinitely,
 * because a region absent from `mockPage.ts` is not "not yet styled" — it is
 * invisible, and invisible is indistinguishable from finished (§22d). It was
 * found by reading AO3's own stylesheets.
 *
 * So half of what follows asserts things about `AO3_BASE_CSS` rather than about
 * our compiler. Those are the tests that would have caught this.
 */
test.describe('listboxes, indexes and meta tables', () => {
  const DARK = cloneTheme(TEMPLATES.find(t => t.meta.category === 'dark') ?? TEMPLATES[0]);
  const css = compile(DARK);
  const d = derive(DARK);

  test('the mock carries AO3s real rules, not a summary of what we override', () => {
    // §21b's lesson, and the reason this block is about AO3's CSS rather than
    // ours: every one of these was missing until 17 Aug 2026, which is exactly
    // why the preview could not show the gap. Transcribed verbatim from
    // public/stylesheets/site/2.0/*.
    expect(AO3_BASE_CSS).toContain('.listbox, fieldset fieldset.listbox');
    expect(AO3_BASE_CSS).toContain('box-shadow: 0 0 0 1px #fff');   // 11, outer ring
    expect(AO3_BASE_CSS).toContain('box-shadow: inset 1px 1px 3px #bbb'); // 11, inner bevel
    expect(AO3_BASE_CSS).toContain('li.relationships a { background: #eee; }');
    expect(AO3_BASE_CSS).toContain('.statistics .index li:nth-of-type(even)');
    expect(AO3_BASE_CSS).toContain('background: #ededed');          // 10, dl.index dd
    expect(AO3_BASE_CSS).toContain('.wrapper:has(> table, > .meta)');

    // dl.meta's border was transcribed as #ddd for a year. AO3 says #ccc, and a
    // mock one shade kinder than the real page is a mock that flatters us.
    expect(AO3_BASE_CSS).toContain('dl.meta { border: 1px solid #ccc;');
    expect(AO3_BASE_CSS).not.toContain('dl.meta { border: 1px solid #ddd;');
  });

  test('every region the audit named is watchable in the preview', () => {
    // Invariant 4. Four of AO3's nine screenshot-worthy page types are reached
    // through the profile, so the Dashboard state is where they belong — a
    // fourth preview tab would cost a tab and prove nothing extra.
    const dashboard = mockBody('dashboard');
    expect(dashboard).toContain('class="fandom listbox group"');
    expect(dashboard).toContain('class="work listbox group"');
    expect(dashboard).toContain('class="index group"');
    expect(dashboard).toContain('class="subscription index group"');
    expect(dashboard).toContain('class="statistics index group"');
    // The listbox pattern is an outer box holding an inner panel, and the
    // polarity of that pair is the decision most easily undone by accident. A
    // mock with only one of the two cannot show it at all.
    expect(dashboard).toMatch(/class="work listbox group"[\s\S]*class="index group"/);

    // AO3's meta pattern: "meta is always wrapped in <div class='wrapper'>",
    // which is what 10-types-groups hangs its grey halo off.
    expect(mockBody('reading')).toMatch(/<div class="wrapper">\s*<dl class="work meta group">/);

    // And the chip §22c is about is already in every listing in the mock.
    expect(mockBody('browse')).toContain('<li class="relationships">');
  });

  test('the listbox pair keeps AO3s polarity: outer is the page, inner is the card', () => {
    // AO3 paints the outer box #ddd and the inner panel #fff — outer darker,
    // inner lighter, inner reads as the card. Painting both `surface` would
    // flatten a distinction AO3 is using to separate a container from its
    // contents, and would look right in a diff.
    const rules = compileRules(DARK);
    const outer = rules.find(r => r.selectors.includes('.listbox'))!;
    const inner = rules.find(r => r.selectors.includes('.listbox .index'))!;
    expect(outer.decls).toContainEqual(['background-color', d.background]);
    expect(inner.decls).toContainEqual(['background-color', d.surface]);
    expect(d.background).not.toBe(d.surface);
    expect(outer.decls).toContainEqual(['border-color', d.border]);
  });

  test('both of AO3s listbox shadows are killed, not just its colours', () => {
    // Same defect as the footer's red tile and the buttons' gradient: AO3 lays
    // a white 1px ring OUTSIDE the outer box and a grey bevel INSIDE the panel,
    // and a background colour reaches neither. This is the first box-shadow the
    // compiler emits — §18b's card elevation must extend these two rules rather
    // than adding new ones, or invariant 1 breaks the moment both ship.
    // `#main fieldset` joined these on 17 Aug 2026 (§25): AO3 bevels every form
    // container with `inset 1px 0 5px #999` from the same instinct.
    const shadowed = ['.listbox', '.listbox .index', '.wrapper:has(> table, > .meta)', '#main fieldset'];
    for (const selector of shadowed) {
      const rule = compileRules(DARK).find(r => r.selectors.includes(selector));
      expect(rule, `${selector} is unowned`).toBeDefined();
      expect(rule!.decls, selector).toContainEqual(['box-shadow', 'none']);
    }
    // Enumerated rather than counted. The old assertion pinned the *number* of
    // box-shadow rules at three, which is a proxy for the thing it cares about
    // and broke the moment a fourth AO3 shadow was legitimately killed. Assert
    // the set, so adding one is a deliberate edit here and removing one still
    // fails.
    const shadows = compileRules(DARK).filter(r => r.decls.some(([p]) => p === 'box-shadow'));
    expect(shadows.flatMap(r => r.selectors).filter(s => shadowed.includes(s)).sort())
      .toEqual([...shadowed].sort());
    expect(shadows).toHaveLength(shadowed.length);
  });

  test('the form container is repainted, and never outside #main', () => {
    // §25. AO3 paints every fieldset #ddd with a cream border and an inset grey
    // bevel, so the comment form under every work was a light slab on every dark
    // theme. The mock could not show it: it carried a reconstructed `fieldset`
    // rule with no background, which is §21b's trap.
    const rules = compileRules(DARK);
    const d = derive(DARK);

    const outer = rules.find(r => r.selectors.includes('#main fieldset'))!;
    expect(outer.decls).toContainEqual(['background-color', d.background]);
    expect(outer.decls).toContainEqual(['border-color', d.border]);

    const inner = rules.find(r => r.selectors.includes('#main fieldset fieldset'))!;
    expect(inner.decls).toContainEqual(['background-color', d.surface]);
    expect(d.background).not.toBe(d.surface);
  });

  test('no fieldset rule is emitted unscoped, because AO3 exempts its own header', () => {
    /**
     * The fourth bug with this root, caught before it shipped.
     *
     * AO3 carves its header out of its own form cascade with
     * `#header a, #header fieldset, #header form, … { background: transparent }`
     * — a quiet (1,0,1) carrying no `!important`. Every declaration we emit
     * carries one, so a bare `fieldset` selector from us at (0,0,1) still beats
     * it, and the login dropdown inside the header we already own would be
     * repainted with the page colour.
     *
     * §14b, §18a and §20b are the same mistake. The rule is: before emitting a
     * bare element or class selector, check whether AO3 exempts something from
     * it with an ID.
     */
    for (const template of TEMPLATES) {
      for (const rule of compileRules(template)) {
        for (const selector of rule.selectors) {
          if (!/(^|\s)fieldset\b/.test(selector)) continue;
          expect(
            selector.startsWith('#main '),
            `"${selector}" (${template.meta.name}) reaches #header fieldset`
          ).toBe(true);
        }
      }
    }
  });

  test('the listbox heading is deliberately unowned, and this is why', () => {
    // §22e listed `.listbox > .heading` for the text colour. It is not emitted,
    // because it would be a rule that loses to another of OURS on every page it
    // could apply to: every listbox on the archive is inside #main, our
    // `#main .heading` accent rule is (1,1,0), and `.listbox > .heading` is
    // (0,2,0). Both carry !important, so specificity decides and the accent
    // wins. AO3's own #2a2a2a is already beaten by the same rule.
    //
    // A dead declaration that reads like a working one is worse than a missing
    // one, so the omission is pinned rather than left to be "fixed" back in.
    expect(css).not.toContain('.listbox > .heading');
    expect(css).toContain('#main .heading');
  });

  test('the relationship chip goes, whether or not tags are coloured', () => {
    // §22c, a regression rather than a gap. AO3 gives every relationship tag in
    // every listing a pale grey chip; our "colour tags by type" control set the
    // tag's TEXT colour and left the chip, so thirteen templates rendered
    // tinted text on a light pill — worse than the accent it replaced.
    for (const tagColors of [true, false]) {
      const out = compile({ ...DARK, shape: { ...DARK.shape, tagColors } });
      expect(out, `tagColors: ${tagColors}`).toContain('li.relationships a {');
      expect(out, `tagColors: ${tagColors}`).toContain('background-color: transparent');
    }
  });

  test('the chip rule still loses to the tag hover, so hovering paints', () => {
    // `a.tag:hover` is (0,2,1); `li.relationships a` is (0,1,2). Both shout, so
    // specificity decides and hover wins. That is the whole reason this is one
    // declaration rather than a hover pair of its own — and it is the kind of
    // thing that is true today and quietly false after a selector is "tidied".
    const rules = compileRules(DARK);
    const chip = rules.find(r => r.selectors.includes('li.relationships a'))!;
    const hover = rules.find(r => r.selectors.includes('a.tag:hover'))!;
    expect(chip.authorWins).toBeUndefined();
    expect(hover.authorWins).toBeUndefined();
    expect(hover.decls).toContainEqual(['background-color', d.accent]);
    // And the chip does not try to own a hover of its own.
    expect(rules.some(r => r.selectors.some(s => s.startsWith('li.relationships a:')))).toBe(false);
  });

  test('dl.meta is owned; its unused "wrapped data" mod is not', () => {
    // §22e's row named `dl.meta .wrapper` too. Grepping every template in
    // otwarchive master for `wrapper` finds thirty-three, and every one is the
    // div AO3 wraps AROUND a meta list — works/_meta, stats/index,
    // profile/show, series/show, collection_profile/show. None is inside a
    // dl.meta. 12-group-meta's rule styles markup the archive does not render,
    // so emitting it would put a permanently dead declaration in the stylesheet
    // every user pastes.
    expect(css).toContain('dl.meta {');
    expect(css).not.toContain('dl.meta .wrapper');

    // The wrapper AO3 *does* render is the one carrying the grey halo, and that
    // is owned — on the work page and on the four other pages that use it.
    expect(css).toContain('.wrapper:has(> table, > .meta)');
  });

  test('the index and statistics shadings reuse the comment colour', () => {
    // Same job — making a long list of paired data readable — so the same
    // colour rather than a third one that has to be kept in step by hand.
    const rule = compileRules(DARK).find(r => r.selectors.includes('dl.index dd'))!;
    expect(rule.decls).toContainEqual(['background-color', d.commentAlt]);
    expect(rule.selectors).toContain('.statistics .index li:nth-of-type(even)');
    expect(css).toContain('dl.meta');
  });

  for (const template of TEMPLATES) {
    test(`${template.meta.name}: the listbox pair is still two visible surfaces`, () => {
      // The polarity argument only holds if page and card are actually
      // different colours. If a template ever set them equal — which nothing
      // forbids — the outer box would vanish into the page and AO3's
      // container-versus-contents distinction would be lost, silently, on
      // Profile, Collections, Own works and the filter sidebar at once.
      //
      // A ratio rather than an inequality, for the reason §18a's chrome test
      // learned the hard way: two hex strings can differ and be
      // indistinguishable. 1.05 is the same floor `controlBg vs surface` uses.
      const t = derive(template);
      expect(contrastRatio(t.background, t.surface), 'page vs card').toBeGreaterThan(1.05);
    });
  }

  test('every template still lints clean with the region rules', () => {
    // box-shadow is the one property here the compiler had never emitted, and
    // it only became legal when §17's corrections landed. The gate has to prove
    // every declaration shape we ship, so a catalog that stopped linting would
    // mean sixteen templates failing at save time rather than one.
    for (const template of TEMPLATES) {
      expect(lintAo3Css(compile(template)), template.meta.name).toEqual([]);
    }
  });
});

test.describe('the header is legible', () => {
  // Defect 4.4: the prototype painted #header with the accent AND coloured
  // every `a` with the same accent, so the site navigation vanished. Its own
  // preview hid this by hard-coding white in the mock only.
  for (const template of TEMPLATES) {
    test(`${template.meta.name}: header text contrasts with the header`, () => {
      const d = derive(template);
      expect(contrastRatio(d.headerFg, d.accent)).toBeGreaterThanOrEqual(WCAG_LARGE_MIN);
    });
  }

  test('the header foreground is actually emitted for #header a', () => {
    const rules = compileRules(SAMPLE);
    const fg = rules.find(
      r => r.selectors.includes('#header a') && r.decls.some(([p]) => p === 'color')
    );
    expect(fg, 'no rule colours #header a').toBeDefined();
    expect(fg!.decls.find(([p]) => p === 'color')![1]).toBe(derive(SAMPLE).headerFg);
  });

  test('AO3\'s red navigation strip and footer texture are both removed', () => {
    // Both carry a tiled background IMAGE, which a background-color alone
    // leaves sitting on top (§4.6, §4.9).
    const rules = compileRules(SAMPLE);
    for (const selector of ['#header .primary', '#footer']) {
      const rule = rules.find(r => r.selectors.includes(selector));
      expect(rule, `${selector} is unowned`).toBeDefined();
      expect(rule!.decls).toContainEqual(['background-image', 'none']);
    }
  });
});

// ── Tags coloured by type ─────────────────────────────────────────────────

test.describe('tag colours by type', () => {
  const on = (theme: SiteSkinTheme = SAMPLE): SiteSkinTheme => ({
    ...theme,
    shape: { ...theme.shape, tagColors: true },
  });

  test('both AO3 markups are targeted — a listing and a work page', () => {
    // The type class is on the `li` in works/_work_module and on the `dd` in
    // works/_meta. Emitting only one of them colours half the site.
    const css = compile(on());
    for (const selector of [
      'li.warnings a.tag',
      'dd.warning a.tag',
      'li.relationships a.tag',
      'dd.relationship a.tag',
      'li.characters a.tag',
      'dd.character a.tag',
      'li.freeforms a.tag',
      'dd.freeform a.tag',
    ]) {
      expect(css, selector).toContain(selector);
    }
  });

  test('turning it off emits nothing, so the accent still owns every tag', () => {
    const css = compile({ ...SAMPLE, shape: { ...SAMPLE.shape, tagColors: false } });
    expect(css).not.toContain('li.warnings');
    expect(css).not.toContain('dd.freeform');
    expect(css).toContain('a.tag');
  });

  test('the four colours are distinct, and each is legible on page and cards', () => {
    // Without the contrast floor this control would make a page HARDER to read
    // than the accent it replaces — a red tag on a near-black card.
    for (const template of TEMPLATES) {
      const colors = derive(on(template)).tagColors;
      const values = Object.values(colors);
      expect(new Set(values).size, `${template.meta.name}: duplicate tag colours`).toBe(4);
      for (const [type, color] of Object.entries(colors)) {
        const ratio = Math.min(
          contrastRatio(color, template.colors.background),
          contrastRatio(color, template.colors.surface)
        );
        expect(ratio, `${template.meta.name}/${type}`).toBeGreaterThanOrEqual(WCAG_LARGE_MIN);
      }
    }
  });

  test('the border follows the text, but only when the tag shape has one', () => {
    const bordered = compileRules(on({ ...SAMPLE, shape: { ...SAMPLE.shape, tagStyle: 'label', tagColors: true } }));
    const plain = compileRules(on({ ...SAMPLE, shape: { ...SAMPLE.shape, tagStyle: 'plain', tagColors: true } }));
    const warning = (rules: ReturnType<typeof compileRules>) =>
      rules.find(r => r.selectors.includes('li.warnings a.tag'))!;

    expect(warning(bordered).decls.map(([p]) => p)).toEqual(['color', 'border-color']);
    // On 'plain' the shape rule emits `border: 0`, so an edge colour would be a
    // declaration with nothing to colour.
    expect(warning(plain).decls.map(([p]) => p)).toEqual(['color']);
  });

  test('the mock renders both markups, so the control is watchable', () => {
    // Plan §10: a rule that cannot be previewed honestly does not ship.
    const browse = mockBody('browse');
    expect(browse).toContain('<li class="warnings">');
    expect(browse).toContain('<li class="relationships">');
    expect(browse).toContain('<li class="characters">');
    expect(browse).toContain('<li class="freeforms">');

    const reading = mockBody('reading');
    expect(reading).toContain('class="warning tags"');
    expect(reading).toContain('class="relationship tags"');
    expect(reading).toContain('class="character tags"');
    expect(reading).toContain('class="freeform tags"');
  });
});

// ── The themed scrollbar ──────────────────────────────────────────────────

test.describe('the themed scrollbar', () => {
  test('emits vendor pseudo-elements AO3 accepts', () => {
    // AO3 validates declarations, never selectors: clean_css_code maps
    // rs.selectors through a gsub and a prefix test, refusing only @font-face.
    // The declarations inside are plain width/background-color/border-radius.
    const css = compile({ ...SAMPLE, details: { ...SAMPLE.details, scrollbar: true } });
    expect(css).toContain('::-webkit-scrollbar {');
    expect(css).toContain('::-webkit-scrollbar-track {');
    expect(css).toContain('::-webkit-scrollbar-thumb {');
    expect(css).toContain('::-webkit-scrollbar-thumb:hover {');
    expect(lintAo3Css(css)).toEqual([]);
  });

  test('the track is the card colour and the thumb is closer to the accent', () => {
    const d = derive(SAMPLE);
    const rules = compileRules({ ...SAMPLE, details: { ...SAMPLE.details, scrollbar: true } });
    const track = rules.find(r => r.selectors.includes('::-webkit-scrollbar-track'))!;
    const thumb = rules.find(r => r.selectors.includes('::-webkit-scrollbar-thumb'))!;
    expect(track.decls).toContainEqual(['background-color', d.surface]);
    expect(thumb.decls).toContainEqual(['background-color', d.scrollThumb]);
    expect(d.scrollThumb).not.toBe(d.surface);
  });

  test('turning it off emits no scrollbar rules at all', () => {
    const css = compile({ ...SAMPLE, details: { ...SAMPLE.details, scrollbar: false } });
    expect(css).not.toContain('scrollbar');
  });
});

// ── Colour maths ──────────────────────────────────────────────────────────

test.describe('colour maths', () => {
  test('normalizeHex expands shorthand and rejects nonsense', () => {
    expect(normalizeHex('#ABC')).toBe('#aabbcc');
    expect(normalizeHex('7761a8')).toBe('#7761a8');
    expect(normalizeHex('not a colour')).toBe('#000000');
  });

  test('mixHex is a plain linear blend, and always emits 6 digits', () => {
    expect(mixHex('#ffffff', '#000000', 0.5)).toBe('#808080');
    expect(mixHex('#ffffff', '#000000', 1)).toBe('#ffffff');
    expect(mixHex('#ffffff', '#000000', 0)).toBe('#000000');
    expect(mixHex('#010203', '#010203', 0.5)).toMatch(/^#[0-9a-f]{6}$/);
  });

  test('contrastRatio matches the WCAG extremes', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrastRatio('#7761a8', '#7761a8')).toBeCloseTo(1, 5);
  });

  test('readableOn picks the legible side of a colour', () => {
    expect(readableOn('#ffffff')).toBe('#241f20');
    expect(readableOn('#101725')).toBe('#ffffff');
  });

  test('a low-contrast theme is reported, and the fix repairs it', () => {
    const colors = { background: '#f0f0f0', surface: '#ffffff', text: '#dddddd', accent: '#eeeeee' };
    const issues = findReadabilityIssues(colors);
    expect(issues.map(i => i.id).sort()).toEqual(['accent', 'text']);

    const fixedText = bestTextColor(colors.background, colors.surface);
    const fixedAccent = fixAccent(colors.accent, colors.background, colors.surface);
    expect(findReadabilityIssues({ ...colors, text: fixedText, accent: fixedAccent })).toEqual([]);
  });

  test('a legible theme reports nothing', () => {
    for (const template of TEMPLATES) {
      const issues = findReadabilityIssues(template.colors);
      expect(issues, `${template.meta.name}: ${issues.map(i => i.id).join(', ')}`).toEqual([]);
    }
  });

  test('fixAccent keeps the hue rather than snapping to grey', () => {
    // A plum stays a plum; it just moves far enough to be readable.
    const fixed = fixAccent('#6b5a80', '#5f5170', '#655678');
    expect(contrastRatio(fixed, '#655678')).toBeGreaterThanOrEqual(WCAG_LARGE_MIN);
    const [r, , b] = [1, 3, 5].map(i => parseInt(fixed.slice(i, i + 2), 16));
    expect(b).toBeGreaterThan(r); // still on the blue side of neutral
  });
});

// ── Theme validation ──────────────────────────────────────────────────────

test.describe('validateTheme', () => {
  test('replaces anything it cannot vouch for', () => {
    const result = validateTheme(
      {
        meta: { id: 'x', name: 'Mine', category: 'nonsense', moods: ['dark', 'bogus'] },
        colors: { background: 'red', surface: '#FFF000', text: '#123456', accent: 'javascript:x' },
        typography: { headingFont: 'Comic Sans MS, cursive', bodyFont: 'Georgia, serif', baseFontScale: 99 },
        shape: { cardRadius: 'huge', tagStyle: 'sparkly', tagColors: 'sometimes' },
        details: { divider: 'yes', dropCap: false, scrollbar: 1 },
      },
      SAMPLE
    );

    expect(result.meta.category).toBe(SAMPLE.meta.category); // 'nonsense' dropped
    expect(result.meta.moods).toEqual(['dark']); // 'bogus' filtered out
    expect(result.colors.background).toBe(SAMPLE.colors.background); // 'red' is not a hex
    expect(result.colors.surface).toBe('#fff000'); // valid, normalised
    expect(result.colors.accent).toBe(SAMPLE.colors.accent);
    expect(result.typography.headingFont).toBe(SAMPLE.typography.headingFont); // not offered
    expect(result.typography.baseFontScale).toBe(SAMPLE.typography.baseFontScale);
    expect(result.shape.cardRadius).toBe(SAMPLE.shape.cardRadius);
    expect(result.shape.tagStyle).toBe(SAMPLE.shape.tagStyle);
    expect(result.shape.tagColors).toBe(SAMPLE.shape.tagColors); // a string is not a boolean
    expect(result.details.divider).toBe(SAMPLE.details.divider); // 'yes' is not a boolean
    expect(result.details.dropCap).toBe(false);
    expect(result.details.scrollbar).toBe(SAMPLE.details.scrollbar); // 1 is not a boolean
  });

  test('a validated theme still compiles to legal CSS', () => {
    expect(lintAo3Css(compile(validateTheme(null, SAMPLE)))).toEqual([]);
  });

  test('a template round-trips through JSON unchanged', () => {
    for (const template of TEMPLATES) {
      const round = validateTheme(JSON.parse(JSON.stringify(template)), SAMPLE);
      expect(round, template.meta.name).toEqual(template);
    }
  });
});

// ── The preview is the same stylesheet ────────────────────────────────────

test.describe('preview and export cannot disagree', () => {
  test('the preview document embeds the exported CSS verbatim', () => {
    const css = compile(SAMPLE);
    expect(mockDocument('browse', css)).toContain(css);
  });

  test("AO3's base stylesheet is never part of the export", () => {
    const css = compile(SAMPLE);
    expect(css).not.toContain('red-ao3.png');
    expect(css).not.toContain('Lucida Grande');
  });

  test('every state uses AO3 selectors the compiler actually targets', () => {
    const browse = mockBody('browse');
    const reading = mockBody('reading');
    const dashboard = mockBody('dashboard');

    // The header rules are only verifiable because an open dropdown is
    // rendered — plan §10: if it cannot be previewed, it does not ship. It
    // opens in Browse only; an absolutely-positioned panel left open in every
    // state would obscure a slice of each one.
    expect(browse).toContain('class="primary navigation actions"');
    expect(browse).toContain('class="dropdown open"');
    expect(browse).toContain('class="menu dropdown-menu"');
    expect(reading).toContain('class="menu dropdown-menu"');
    expect(reading).not.toContain('class="dropdown open"');
    expect(browse).toContain('li id="work_1" class="work blurb group"');
    expect(browse).toContain('class="notice"');
    expect(browse).toContain('a class="tag"');

    // The drop-cap and divider selectors depend on this exact nesting.
    expect(reading).toContain('id="workskin"');
    expect(reading).toContain('id="chapters"');
    expect(reading).toContain('class="userstuff module"');
    expect(reading).toContain('<hr />');
    // The summary blockquote stays, so an escaped drop cap is visible at a glance.
    expect(reading).toContain('class="summary module"');

    // #dashboard span is styled because AO3 hard-codes #111 on it.
    expect(dashboard).toContain('id="dashboard" class="region own"');
    expect(dashboard).toContain('<span class="current">');
  });
});

test('findTemplate resolves catalog ids', () => {
  expect(findTemplate('moonlit')?.meta.name).toBe('Moonlit Library');
  expect(findTemplate('nope')).toBeUndefined();
});

/**
 * The drop cap's float, contained.
 *
 * Found on real AO3 (P1/P2) and invisible in every preview before it, because
 * the mock opened with a three-line paragraph — tall enough to contain the float
 * by accident. A one-line opening paragraph is an ordinary way to start a
 * chapter, and it let the capital overhang into the paragraph below.
 */
test.describe('the drop cap does not indent the paragraph after it', () => {
  const withCap = { ...SAMPLE, details: { ...SAMPLE.details, dropCap: true } };
  const without = { ...SAMPLE, details: { ...SAMPLE.details, dropCap: false } };

  test('the containing paragraph gets a block formatting context', () => {
    const rule = compileRules(withCap).find(
      r => r.selectors.length === 1 && r.selectors[0] === '#chapters .userstuff > p:first-of-type'
    );
    expect(rule, 'the drop cap paragraph rule is missing').toBeDefined();
    expect(rule!.decls).toEqual([['overflow', 'hidden']]);
  });

  test('and it is quiet, because it lands inside an author work', () => {
    // Same argument as the ::first-letter rule it accompanies (§14b). An author
    // who wants their own opening paragraph back must be able to take it.
    const block = compile(withCap)
      .split('\n\n')
      .find(b => b.startsWith('#chapters .userstuff > p:first-of-type {'))!;
    expect(block).toBeDefined();
    expect(block).not.toContain('!important');
  });

  test('nothing is emitted when the drop cap is off', () => {
    expect(compile(without)).not.toContain('#chapters .userstuff > p:first-of-type {');
  });

  test('it is a different selector from the letter, so invariant 1 holds', () => {
    // `p:first-of-type` and `p:first-of-type::first-letter` style different
    // elements. Neither shares a property with the other, and the paragraph rule
    // must not have swallowed the letter's.
    const rules = compileRules(withCap);
    const para = rules.find(r => r.selectors[0] === '#chapters .userstuff > p:first-of-type')!;
    const letter = rules.find(
      r => r.selectors[0] === '#chapters .userstuff > p:first-of-type::first-letter'
    )!;
    expect(letter).toBeDefined();
    const shared = para.decls
      .map(([property]) => property)
      .filter(property => letter.decls.some(([other]) => other === property));
    expect(shared).toEqual([]);
    expect(letter.decls.map(([property]) => property)).toContain('float');
  });

  test('the reading mock still opens with a short paragraph', () => {
    // The whole reason this defect was invisible. If someone lengthens this
    // paragraph the preview stops showing the case the rule exists for, and the
    // next person will find it on AO3 again rather than here (invariant 4).
    const opening = mockDocument('reading', compile(withCap)).match(
      /<div class="userstuff module"[^>]*>[\s\S]*?<p>([^<]*)<\/p>/
    );
    expect(opening, 'the chapter body no longer starts with a paragraph').toBeTruthy();
    expect(opening![1].trim().length).toBeLessThan(60);
  });
});
