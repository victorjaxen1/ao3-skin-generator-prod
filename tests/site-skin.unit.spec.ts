import { test, expect } from '@playwright/test';
import { compile, compileRules, derive } from '../src/lib/siteSkin/compile';
import { TEMPLATES, cloneTheme, findTemplate } from '../src/lib/siteSkin/templates';
import { FONT_STACKS, validateTheme, SiteSkinTheme } from '../src/lib/siteSkin/theme';
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
import { mockDocument, mockBody } from '../src/lib/siteSkin/mockPage';

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
            for (const tagStyle of ['pill', 'label', 'plain'] as const) {
              const theme: SiteSkinTheme = {
                ...SAMPLE,
                shape: { ...SAMPLE.shape, tagStyle, tagColors },
                details: { divider, dropCap, scrollbar },
              };
              const label = `${tagStyle}/${tagColors}/${divider}/${dropCap}/${scrollbar}`;
              expect(lintAo3Css(compile(theme)), label).toEqual([]);
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
});

// ── Ownership: the §4 defects, as regressions ─────────────────────────────

test.describe('region ownership', () => {
  test('no selector is given the same property twice', () => {
    // Defect 4.2: the prototype set background-color on #main in two rules,
    // and the later one silently ate the Page colour control.
    const seen = new Map<string, string>();
    for (const rule of compileRules(SAMPLE)) {
      for (const selector of rule.selectors) {
        for (const [property] of rule.decls) {
          const key = `${selector} { ${property} }`;
          expect(seen.has(key), `${key} is owned by two rules`).toBe(false);
          seen.set(key, property);
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
    // Enumerated here, so adding a sixth is a deliberate act with a test to
    // change rather than a quiet omission.
    const AUTHOR_WINS = [
      'blockquote',
      'address',
      '#workskin',
      '#chapters .userstuff > hr',
      '#chapters .userstuff > hr::after',
      '#chapters .userstuff > p:first-of-type::first-letter',
    ];

    const themed = { ...SAMPLE, details: { ...SAMPLE.details, divider: true, dropCap: true } };
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
