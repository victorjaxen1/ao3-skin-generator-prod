import { test, expect } from '@playwright/test';
import {
  isPropertyAllowed,
  isShorthandProperty,
  isCustomProperty,
  lintAo3Css,
  isAo3Safe,
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
    expect(AO3_PROPERTIES).toHaveLength(181);
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
  for (const p of ['color', 'display', 'content', 'opacity', 'box-shadow', 'filter', 'position', 'width', 'z-index']) {
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
  for (const p of ['gap', 'animation', 'pointer-events', 'backdrop-filter', 'aspect-ratio']) {
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
