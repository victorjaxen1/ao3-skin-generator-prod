import { test, expect } from '@playwright/test';
import {
  isPropertyAllowed,
  isShorthandProperty,
  isCustomProperty,
  lintAo3Css,
  isAo3Safe,
  checkAo3ImageUrl,
  stripCssComments,
} from '../src/lib/siteSkin/ao3Css';
import { AO3_PROPERTIES, AO3_SHORTHANDS } from '../src/lib/siteSkin/ao3Properties';

/**
 * These encode AO3's real behaviour, not our preferences. If one fails after a
 * change to ao3Properties.ts, check upstream before "fixing" the test — the
 * allowlist is copied data and the test is the thing protecting users from a
 * skin that will not save.
 */

test.describe('the allowlist data', () => {
  test('matches the counts copied from otwarchive', () => {
    expect(AO3_PROPERTIES).toHaveLength(182);
    expect(AO3_SHORTHANDS).toHaveLength(20);
  });

  test('has no duplicates and no stray whitespace', () => {
    for (const list of [AO3_PROPERTIES, AO3_SHORTHANDS]) {
      expect(new Set(list).size).toBe(list.length);
      expect(list.every(p => p === p.trim() && p.length > 0)).toBe(true);
    }
  });
});

test.describe('property acceptance', () => {
  // Exact members of SUPPORTED_CSS_PROPERTIES.
  for (const p of ['color', 'display', 'content', 'opacity', 'box-shadow', 'filter', 'position', 'width', 'z-index', 'aspect-ratio']) {
    test(`accepts "${p}" (listed outright)`, () => {
      expect(isPropertyAllowed(p)).toBe(true);
    });
  }

  // The substring-shorthand rule is what makes ordinary CSS viable at all.
  for (const [p, why] of [
    ['background-color', 'background'],
    ['border-radius', 'border'],
    ['border-top', 'border'],
    ['text-align', 'text'],
    ['text-decoration', 'text'],
    ['font-family', 'font'],
    ['margin-bottom', 'margin'],
    ['padding-left', 'padding'],
    ['column-gap', 'column'],
    ['list-style-type', 'list-style'],
  ] as const) {
    test(`accepts "${p}" via the "${why}" shorthand`, () => {
      expect(isShorthandProperty(p)).toBe(true);
      expect(isPropertyAllowed(p)).toBe(true);
    });
  }

  // The ones people reach for that AO3 will refuse.
  for (const p of ['gap', 'animation', 'pointer-events', 'backdrop-filter']) {
    test(`rejects "${p}"`, () => {
      expect(isPropertyAllowed(p)).toBe(false);
    });
  }

  test('accepts grid-template-columns — surprising, but correct', () => {
    // It contains "column", so AO3's unanchored shorthand test passes it even
    // though grid-template-columns is not in SUPPORTED_CSS_PROPERTIES.
    // Do not "fix" this: rejecting it here would block CSS AO3 accepts.
    // Note the asymmetry — bare `gap` has no shorthand substring and fails.
    expect(isPropertyAllowed('grid-template-columns')).toBe(true);
    expect(isPropertyAllowed('gap')).toBe(false);
  });

  test('accepts vendor-prefixed supported properties', () => {
    expect(isPropertyAllowed('-webkit-box-shadow')).toBe(true);
  });

  test('accepts a well-formed custom property but not a malformed one', () => {
    expect(isCustomProperty('--page-bg')).toBe(true);
    expect(isCustomProperty('--Page_BG2')).toBe(true);
    expect(isCustomProperty('--')).toBe(false);
    expect(isPropertyAllowed('--page bg')).toBe(false);
  });
});

test.describe('value rules', () => {
  test('rejects color-mix(), which the prototype preview relies on', () => {
    const v = lintAo3Css('#main { background-color: color-mix(in srgb, #fff 50%, #000); }');
    const banned = v.find(x => x.kind === 'banned_value_for_property');
    expect(banned).toBeDefined();
    expect(banned!.message).toContain('literal');
    // It was the only declaration, so the rule is also left empty — which AO3
    // reports as a second, separate error.
    expect(v.some(x => x.kind === 'empty_rule')).toBe(true);
  });

  test('allows url() only on the six permitted properties', () => {
    const img = 'https://i.imgur.com/abc123.png';
    expect(isAo3Safe(`#main { background-image: url("${img}"); }`)).toBe(true);
    expect(isAo3Safe(`#main { content: url("${img}"); }`)).toBe(true); // content allows url()
    const bad = lintAo3Css(`#main { cursor: url("${img}"); }`);
    expect(bad.some(x => x.kind === 'banned_value_for_property')).toBe(true);
  });

  test('a relative url() is refused — AO3 requires a full address', () => {
    // An earlier version of this test asserted `url(x.png)` was fine. It is
    // not: URI_REGEX demands either a scheme and an allowlisted domain, or a
    // path beginning /images (AO3's own assets). The property gate alone was
    // never the whole rule, and the address grammar is the part that bites.
    expect(isAo3Safe('#main { background-image: url(x.png); }')).toBe(false);
    expect(isAo3Safe('#main { content: url(x.png); }')).toBe(false);
    expect(isAo3Safe('#main { background-image: url("/images/skins/tile.png"); }')).toBe(true);
  });

  /**
   * AO3 anchors the address by construction: URI_REGEX sits inside
   * `url\(\s*` … `\s*\)`, so it must start right after the paren and be fully
   * consumed before it closes. Our AO3_URI was unanchored, so `\/images`
   * matched *inside* a path and waved through six addresses AO3 refuses.
   *
   * These are false-accepts, which is the quieter of the two failure modes and
   * the worse one for the user: we promise the paste will work, and then AO3
   * says "your skin could not be saved" after they have left the app.
   */
  test('the address must match end to end, not merely contain a legal-looking part', () => {
    // An unallowlisted TLD is not rescued by an /images/ path segment.
    expect(checkAo3ImageUrl('https://cdn.example.xyz/images/banner.png').ok).toBe(false);
    expect(checkAo3ImageUrl('https://evil.app/images/x.jpg').ok).toBe(false);
    expect(checkAo3ImageUrl('https://nope.moe/images/a.gif').ok).toBe(false);

    // Nor is a missing scheme.
    expect(checkAo3ImageUrl('javascript:alert(1)/images/x.png').ok).toBe(false);

    // Trailing anything means the closing paren never lines up.
    expect(checkAo3ImageUrl('https://ok.com/a.png extra-junk').ok).toBe(false);
    expect(checkAo3ImageUrl('https://ok.com/a.png"); body{display:none}').ok).toBe(false);

    // The legitimate shapes still pass.
    expect(checkAo3ImageUrl('https://i.imgur.com/abc123.png').ok).toBe(true);
    expect(checkAo3ImageUrl('https://postimg.cc/gallery/banner.jpg').ok).toBe(true);
    expect(checkAo3ImageUrl('https://user.github.io/assets/header.gif').ok).toBe(true);
    expect(checkAo3ImageUrl('/images/skins/textures/tiles/red-ao3.png').ok).toBe(true);
  });

  test('names the actual reason, so the export dialog can say something useful', () => {
    expect(checkAo3ImageUrl('https://cdn.example.xyz/images/b.png').problem).toContain('.xyz');
    expect(checkAo3ImageUrl('https://example.com/pic.webp').problem).toContain('.webp');
    expect(checkAo3ImageUrl('https://x.com/a.png?ex=1').problem).toContain('?');
    // A space must not be reported as an extension called "png extra-junk".
    expect(checkAo3ImageUrl('https://ok.com/a.png extra').fix).toContain('Spaces');
  });

  test('a function\'s comma-separated arguments are one token, not four', () => {
    // AO3 tokenises on whitespace and commas but NOT inside parens. An earlier
    // version of this lint split naively and shredded rgba(255, 255, 255, 0.5)
    // into `rgba(255`, `255`, `255`, `0.5)` — rejecting colours the archive
    // accepts. Being stricter than AO3 blocks working CSS and looks like AO3's
    // fault, so it is the one failure mode this file must not have.
    expect(isAo3Safe('#main { background-color: rgba(255, 255, 255, 0.5); }')).toBe(true);
    expect(isAo3Safe('#main { color: hsla(200, 50%, 40%, 0.9); }')).toBe(true);
    expect(isAo3Safe('#main { box-shadow: 0 2px 6px rgba(60, 64, 67, 0.3); }')).toBe(true);
    // calc() genuinely is absent from VALUE_REGEX, so it still fails.
    expect(isAo3Safe('#main { max-width: calc(100% - 20px); }')).toBe(false);
  });

  /**
   * §17, Corrections 5–9. All five were the same failure — being stricter than
   * AO3 — found by differential testing rather than by anything breaking, and
   * measured at 34 false rejects across the published-skin corpus.
   *
   * The harness that found them is checked in and is the acceptance test for
   * this file: `npx tsx scripts/ao3-corpus-differential.mjs <corpus>` must
   * report **0 false accepts and 0 false rejects**. These tests are the
   * cheap daily version of it; they are not a substitute for running it.
   */
  test('Correction 5: gradients are legal, on any property that takes the token path', () => {
    // AO3's sanitize_css_token forks on the substring `gradient` into
    // sanitize_css_gradient, which we did not model at all — so the lint
    // refused every one of the corpus's 57 gradient declarations for a year
    // while the archive stored them happily.
    expect(isAo3Safe('body { background: linear-gradient(to bottom, #fab0b9, #ce9ffd); }')).toBe(true);
    expect(isAo3Safe('body { background-image: radial-gradient(circle at 50% 0%, #402060 0%, #100818 70%); }')).toBe(true);
    expect(isAo3Safe('body { background: repeating-linear-gradient(45deg, #eee 0px, #eee 10px, #ddd 20px); }')).toBe(true);
    expect(isAo3Safe('body { background: conic-gradient(#f00, #0f0, #00f); }')).toBe(true);
    expect(isAo3Safe('#header { background-image: linear-gradient(180deg, rgba(20,20,30,1) 0%, rgba(60,20,80,1) 100%); }')).toBe(true);
    expect(isAo3Safe('li.blurb { border-image: linear-gradient(45deg, #bf242c 0%, #7fcf5d 100%) 1; }')).toBe(true);

    // A gradient layered under a url() — both halves have to pass.
    expect(isAo3Safe('#header { background: linear-gradient(#0008, #0008), url("https://i.imgur.com/a.png"); }')).toBe(true);

    // The interior is still tokenised, so it is not a hole in the grammar.
    expect(isAo3Safe('body { background: linear-gradient(to bottom, calc(1px), #fff); }')).toBe(false);

    // And the fork is on the token path only. `color` is a plain listed
    // property, matched whole, so no gradient reaches it.
    expect(isAo3Safe('a { color: linear-gradient(#fff, #000); }')).toBe(false);
  });

  test('Correction 6: the value grammar repeats, so rem/vw/ch/fr and long decimals pass', () => {
    // `^(VALUE_REGEX,?\s*)+$` — applied repeatedly. `0.5375em` is read as
    // `0.537` + `5em`, and `rem` is not a unit at all: ALPHA_REGEX sweeps it up
    // as a bare keyword on the next iteration. §3 documented this mechanism for
    // `1000` → `100` + `0` and said not to tighten the check; the old
    // implementation tightened it anyway for every case but that one.
    expect(isAo3Safe('body { margin: 0.5375em 0; }')).toBe(true);
    expect(isAo3Safe('body { margin: 0.5625em; }')).toBe(true);
    expect(isAo3Safe('li.blurb { border-radius: 0.75rem; }')).toBe(true);
    expect(isAo3Safe('#main { max-width: 20vw; }')).toBe(true);
    expect(isAo3Safe('#main { max-width: 70ch; }')).toBe(true);
    expect(isAo3Safe('#main { grid-template-columns: 1fr 1fr; }')).toBe(true);
    expect(isAo3Safe('#main { width: 1000px; }')).toBe(true);
  });

  test('Correction 7: hex longer than six digits passes, as colour plus keyword', () => {
    // `#[0-9a-f]{3,6}` consumes six and the repetition eats the tail: `44` is a
    // number, `c` is a bare keyword. This was filed as the LAST thing to do
    // because "it does not bite while we emit no alpha colours" — and then §18b
    // asked for `box-shadow: 0 2px 8px #00000044`, which is simply how a soft
    // shadow is written.
    expect(isAo3Safe('li.blurb { box-shadow: 0 2px 8px #00000044; }')).toBe(true);
    expect(isAo3Safe('li.blurb { border-color: #0f4a59c; }')).toBe(true);
  });

  test('Correction 8: the font shorthand is refused only when a token fails', () => {
    // A blanket refusal by property name was stricter than the archive.
    // `font: Georgia, serif` tokenises to two bare keywords and AO3 keeps it.
    expect(isAo3Safe('body { font: Georgia, serif; }')).toBe(true);

    // §3's *guidance* is unchanged and still right — never emit the shorthand,
    // because it misses sanitize_css_font and a quoted family name has nowhere
    // legal to be. The difference is that the refusal now comes from the
    // grammar rather than from us.
    const quoted = lintAo3Css('body { font: "Palatino Linotype", serif; }');
    expect(quoted.some(v => v.kind === 'banned_value_for_property')).toBe(true);
    expect(quoted[0].message).toContain('font-family');

    // font-family itself still takes its own branch, where quotes are fine.
    expect(isAo3Safe(`body { font-family: 'Palatino Linotype', Palatino, serif; }`)).toBe(true);
  });

  test('Correction 9: aspect-ratio has its own branch — the first upstream drift found', () => {
    expect(isAo3Safe('#header { aspect-ratio: 16/9; }')).toBe(true);
    expect(isAo3Safe('#header { aspect-ratio: auto; }')).toBe(true);
    expect(isAo3Safe('#header { aspect-ratio: 1; }')).toBe(true);
    // It is a narrow branch, not a pass-through to the value grammar.
    expect(isAo3Safe('#header { aspect-ratio: 16px / 9px; }')).toBe(false);
  });

  test('content must be one fully-quoted string, url(), or none', () => {
    // The decorative divider glyph — confirmed safe: any fully quoted string.
    expect(isAo3Safe('#workskin hr::after { content: "❦"; }')).toBe(true);
    expect(isAo3Safe(`#workskin hr::after { content: 'x'; }`)).toBe(true);
    expect(isAo3Safe('#main::after { content: none; }')).toBe(true);
    expect(isAo3Safe('#main::after { content: hello; }')).toBe(false);
    expect(isAo3Safe('#main::after { content: var(--x); }')).toBe(false);
  });
});

test.describe('structural rules', () => {
  test('rejects @font-face', () => {
    expect(lintAo3Css('@font-face { font-family: X; }').some(v => v.kind === 'font_face')).toBe(true);
  });

  test('rejects @media, which AO3 flattens rather than honours', () => {
    const v = lintAo3Css('@media screen { #main { color: #fff; } }');
    expect(v.some(x => x.kind === 'media_block')).toBe(true);
  });

  test('flags a rule whose declarations would all be dropped', () => {
    // AO3 errors on an emptied rule set rather than ignoring it.
    const v = lintAo3Css('#main { animation: x 1s; }');
    expect(v.some(x => x.kind === 'banned_property')).toBe(true);
    expect(v.some(x => x.kind === 'empty_rule')).toBe(true);
  });

  test('a rule keeping at least one declaration is not an empty rule', () => {
    const v = lintAo3Css('#main { animation: x 1s; color: #fff; }');
    expect(v.some(x => x.kind === 'banned_property')).toBe(true);
    expect(v.some(x => x.kind === 'empty_rule')).toBe(false);
  });

  test('ignores comments', () => {
    expect(isAo3Safe('/* animation: nope */ #main { color: #fff; }')).toBe(true);
  });

  test('!important does not affect acceptance', () => {
    expect(isAo3Safe('#main { background-color: #fff !important; }')).toBe(true);
  });
});

test('a representative site skin passes end to end', () => {
  const css = `
/* Moonlit Library */
body,
#outer.wrapper {
  background-color: #101725 !important;
  color: #e8e0cf !important;
  font-family: Georgia, serif;
  font-size: 100%;
}
#header {
  background-color: #7761a8 !important;
  border-color: #4d3f6d !important;
}
li.blurb,
#dashboard {
  background-color: #182238 !important;
  border-color: #3a3550 !important;
  border-radius: 10px;
}
a, a:link, a:visited, a.tag {
  color: #7761a8 !important;
}
a.tag {
  border: 1px solid #4f4571;
  border-radius: 999px;
  padding: 0.18em 0.5em;
}
`.trim();

  expect(lintAo3Css(css)).toEqual([]);
});


test.describe('stripCssComments', () => {
  /**
   * The single most repeated mistake in this codebase: matching a pattern
   * against raw CSS and hitting the prose instead of the code. It has produced
   * four wrong answers, and every one of them made us STRICTER than AO3 —
   * refusing CSS the archive would have accepted. AO3 never sees a comment at
   * all, so a comment cannot change what saves.
   */
  test('a comment mentioning a banned at-rule does not fail the lint', () => {
    // The exact regression: the Twitter work skin became unexportable the day
    // its stylesheet grew a comment explaining why em is used instead of @media.
    const css = `
      /* NOTE ON UNITS. AO3 forbids @media in skin CSS, so em is the only
         responsive lever available. Nor can we use @font-face. */
      #workskin .chat { width: 34.375em; }
    `;
    expect(lintAo3Css(css, 'work')).toEqual([]);
    expect(lintAo3Css(css, 'site')).toEqual([]);
  });

  test('a real @media outside a comment is still caught', () => {
    // The guard on the guard: stripping comments must not blind the lint.
    const css = '/* explaining @media */ @media (min-width: 40em) { #workskin .chat { width: 20em; } }';
    expect(lintAo3Css(css).some(v => v.kind === 'media_block')).toBe(true);
  });

  test('values in a comment are not mistaken for declarations', () => {
    // How two tests went wrong: scanning for stray px found "16px" in prose.
    expect(stripCssComments('/* converted against a 16px base */ a { color: red; }'))
      .not.toContain('16px');
  });

  test('separate comments do not swallow the rules between them', () => {
    // The namespacing prototype lost seven rules to a greedy match.
    const out = stripCssComments('/* one */ a { color: red; } /* two */ b { color: blue; }');
    expect(out).toContain('a { color: red; }');
    expect(out).toContain('b { color: blue; }');
    expect(out).not.toContain('one');
    expect(out).not.toContain('two');
  });

  test('a stylesheet with no comments is returned unchanged', () => {
    const css = '#workskin .chat { width: 100%; }';
    expect(stripCssComments(css)).toBe(css);
  });
});
