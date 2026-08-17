/**
 * AO3 CSS safety check.
 *
 * Mirrors otwarchive's `CssCleaner#clean_css_code` closely enough to catch, at
 * build time, anything AO3 would reject at save time.
 *
 * Why this matters more than it looks: AO3 does not silently drop an unknown
 * property. It refuses the whole skin and shows the user an error. So a single
 * stray declaration turns "copy this into AO3" into a dead end at the exact
 * moment the user expects a payoff. Everything we emit must pass this first.
 *
 * The rules encoded here (verified against otwarchive commit
 * cf1d7f997047eaca14370985dafd156a91696313, 12 Aug 2026):
 *
 *   legal_property?(p)          p is in SUPPORTED_CSS_PROPERTIES, or matches
 *                               -(moz|ms|o|webkit)-<supported> as a SUBSTRING
 *   legal_shorthand_property?(p) p CONTAINS one of the shorthand names —
 *                               unanchored, which is why `border-radius` and
 *                               `background-color` pass while `gap` does not
 *   custom_property?(p)         p matches /\A--[0-9a-z\-_]+\z/i
 *
 * A declaration survives if any of the three hold. A rule set whose
 * declarations are ALL dropped is itself an error (`:no_rules_for_selectors`),
 * so an empty rule is a failure, not a no-op.
 *
 * The value grammar was rebuilt on 16 Aug 2026 from the Ruby source rather than
 * approximated (§17, Corrections 5–9). The acceptance test is
 * `scripts/ao3-corpus-differential.mjs` against `scripts/ao3-sanitizer-oracle.mjs`,
 * and the bar is **0 false accepts and 0 false rejects** over the 115-skin
 * corpus. Run it before and after any change here — being stricter than AO3 is
 * the failure this file keeps having, and it is invisible without that harness.
 */

import {
  AO3_PROPERTIES,
  AO3_SHORTHANDS,
  AO3_VENDOR_PREFIXES,
  AO3_URL_PROPERTIES,
  AO3_IMAGE_EXTENSIONS,
  AO3_TLDS,
} from './ao3Properties';

export type ViolationKind =
  | 'banned_property'
  | 'invalid_custom_property_name'
  | 'banned_value_for_property'
  | 'font_face'
  | 'media_block'
  | 'empty_rule'
  | 'work_skin_custom_property'
  | 'work_skin_var'
  | 'work_skin_position_fixed';

/**
 * Work skins are checked by `WorkSkin#clean_css`, which layers three extra
 * refusals on top of everything a site skin must satisfy — and, separately,
 * prefixes every selector with `#workskin`.
 *
 * Custom properties and var() are the surprising ones: both are perfectly
 * legal in a site skin and neither is allowed here.
 */
export type SkinMode = 'site' | 'work';

export interface Violation {
  kind: ViolationKind;
  /** Property or selector the problem attaches to. */
  subject: string;
  /** Plain-language explanation, safe to show a developer (not an end user). */
  message: string;
}

const CUSTOM_PROPERTY = /^--[0-9a-z\-_]+$/i;
const PREFIXED = new RegExp(`-(${AO3_VENDOR_PREFIXES.join('|')})-(${AO3_PROPERTIES.join('|')})`);
const SHORTHAND = new RegExp(AO3_SHORTHANDS.join('|'));

/** AO3: `legal_property?` */
export function isLegalProperty(property: string): boolean {
  return AO3_PROPERTIES.includes(property) || PREFIXED.test(property);
}

/**
 * AO3: `legal_shorthand_property?` — an unanchored substring test.
 *
 * Deliberately as loose as the original. Tightening it here would reject CSS
 * that AO3 actually accepts, which is the more annoying failure: we would be
 * blocking a working skin.
 */
export function isShorthandProperty(property: string): boolean {
  return SHORTHAND.test(property);
}

export function isCustomProperty(property: string): boolean {
  return CUSTOM_PROPERTY.test(property);
}

/** True when AO3 would keep this property. */
export function isPropertyAllowed(property: string): boolean {
  const p = property.trim().toLowerCase();
  return isLegalProperty(p) || isShorthandProperty(p) || isCustomProperty(p);
}

/**
 * AO3: `sanitize_css_font`. Reached only for the exact property `font-family`,
 * and it replaces the value grammar entirely — which is the only reason a
 * stack like `'Palatino Linotype', Palatino, serif` is legal at all.
 *
 * Each comma-separated name, after downcasing and stripping !important, must be
 * alphanumerics, dashes and spaces, optionally quoted. A period (`"Foo 2.0"`),
 * a slash or an underscore fails the whole declaration.
 *
 * Note this does NOT apply to the `font` shorthand, which takes the token path
 * and chokes on quoted names — so the compiler must never emit `font:`.
 */
const FONT_NAME = /^('?[a-z0-9\- ]+'?|"?[a-z0-9\- ]+"?)$/;

export function isLegalFontStack(value: string): boolean {
  const stripped = value.toLowerCase().replace(/!important/g, '').trim();
  if (!stripped) return false;
  return stripped.split(',').every(name => FONT_NAME.test(name.trim()));
}

/* ── The value grammar ─────────────────────────────────────────────────────
 *
 * VALUE_REGEX and friends, rebuilt from `css_cleaner.rb` rather than
 * approximated. The version this replaced tested one token at a time against a
 * hand-written pattern, and was stricter than AO3 in five measurable ways
 * (§17 of SITE-SKIN-IMPLEMENTATION.md — 34 false rejects across a 3,942
 * declaration corpus, 0 false accepts).
 *
 * The mechanism the approximation missed: AO3 applies the pattern
 * **repeatedly** over the whole stripped value — `^(VALUE_REGEX,?\s*)+$` — so
 * values nobody would call well-formed still parse, by being read as two
 * tokens with no separator between them:
 *
 *   0.5375em   →  0.537    + 5em
 *   0.75rem    →  0.75     + rem   (ALPHA_REGEX, not a unit)
 *   20vw, 70ch →  20       + vw
 *   1fr        →  1        + fr
 *   #00000044  →  #000000  + 44
 *   1000       →  100      + 0
 *
 * That is why `rem`, `vw`, `ch` and `fr` work without appearing in
 * UNITS_REGEX, and why 8-digit hex passes. §3 documented exactly this for
 * `1000` and told the reader not to tighten the check; the implementation
 * tightened it anyway for every case except the one a test pinned.
 *
 * Two constants carry Ruby subtleties that a careless port gets wrong:
 *
 *  - NUMBER_WITH_UNIT_REGEX is built in a **double-quoted** Ruby string, where
 *    `\s` is the escape for a literal space, not the character class. The
 *    spaces below are literal on purpose.
 *  - Regexp#to_s wraps each constant in a non-capturing group when it is
 *    interpolated, which is what `g()` reproduces. Without it the alternations
 *    bind wrongly.
 */
const g = (source: string) => `(?:${source})`;

const ALPHA_REGEX = '[a-z\\-]+';
const UNITS_REGEX = 'deg|cm|em|ex|in|mm|pc|pt|px|s|%';
const NUMBER_REGEX = '-?\\.?\\d{1,3}\\.?\\d{0,3}';
const NUMBER_WITH_UNIT_REGEX = `${g(NUMBER_REGEX)} *${g(UNITS_REGEX)}? *,? *`;
const PAREN_NUMBER_REGEX = `\\(\\s*${g(NUMBER_WITH_UNIT_REGEX)}+\\s*\\)`;

const TRANSFORM_FUNCTION_REGEX = `${g('scalex?y?|translatex?y?|skewx?y?|rotatex?y?|matrix')}${g(PAREN_NUMBER_REGEX)}`;
const SHAPE_FUNCTION_REGEX = `${g('rect')}${g(PAREN_NUMBER_REGEX)}`;
const RGBA_REGEX = `rgba?${g(PAREN_NUMBER_REGEX)}`;
const HSLA_REGEX = `hsla?${g(PAREN_NUMBER_REGEX)}`;
const COLOR_REGEX = `#[0-9a-f]{3,6}|${ALPHA_REGEX}|${g(RGBA_REGEX)}|${g(HSLA_REGEX)}`;
const COLOR_STOP_REGEX = `color-stop\\s*\\(${g(NUMBER_WITH_UNIT_REGEX)}\\s*,?\\s*${g(COLOR_REGEX)}\\s*\\)`;
const FILTER_FUNCTION_REGEX = `${g('blur|brightness|contrast|grayscale|hue-rotate|invert|opacity|saturate|sepia')}${g(PAREN_NUMBER_REGEX)}`;
const DROP_SHADOW_VALUE_REGEX = `\\(\\s*${g(`${g(NUMBER_WITH_UNIT_REGEX)}|${g(COLOR_REGEX)}\\s*`)}+\\s*\\)`;
const DROP_SHADOW_FUNCTION_REGEX = `${g('drop-shadow')}${g(DROP_SHADOW_VALUE_REGEX)}`;
const CUSTOM_PROPERTY_NAME_REGEX = '\\-\\-[0-9a-z\\-_]+';
const VAR_FUNCTION_REGEX = `var${g(`\\(\\s*${g(CUSTOM_PROPERTY_NAME_REGEX)}\\s*\\)`)}`;

/* The address grammar. Shared with checkAo3ImageUrl below, which is the same
 * rule read back to the user in plain language — see the long note there for
 * why `?` in an address kills the whole skin. */
const DOMAIN_REGEX = `https?://\\w[\\w\\-\\.]+\\.${g(AO3_TLDS.join('|'))}`;
const URI_REGEX = `${g(`\\/images|${g(DOMAIN_REGEX)}`)}/[\\w\\-\\./]*[\\w\\-]\\.${g(AO3_IMAGE_EXTENSIONS.join('|'))}`;
const URL_REGEX = `${g(URI_REGEX)}|"${g(URI_REGEX)}"|'${g(URI_REGEX)}'`;
const URL_FUNCTION_REGEX = `url\\(\\s*${g(URL_REGEX)}\\s*\\)`;

const VALUE_REGEX = [
  TRANSFORM_FUNCTION_REGEX,
  URL_FUNCTION_REGEX,
  COLOR_STOP_REGEX,
  COLOR_REGEX,
  NUMBER_WITH_UNIT_REGEX,
  ALPHA_REGEX,
  SHAPE_FUNCTION_REGEX,
  FILTER_FUNCTION_REGEX,
  DROP_SHADOW_FUNCTION_REGEX,
  VAR_FUNCTION_REGEX,
]
  .map(g)
  .join('|');

/** The repeating application — `^(VALUE_REGEX,?\s*)+$`. */
const VALUE_FULL = new RegExp(`^${g(`${g(VALUE_REGEX)},?\\s*`)}+$`, 'i');

/**
 * AO3: `sanitize_css_value`.
 *
 * One caveat, and it can only make us stricter in a direction that has never
 * bitten: upstream also accepts a value whose comma-separated parts are all in
 * `SUPPORTED_CSS_KEYWORDS`. `ALPHA_REGEX` already sweeps up every bare word, so
 * the keyword list can only rescue values containing punctuation the grammar
 * refuses. The corpus differential runs at 0/0 without it.
 */
function isLegalValue(value: string): boolean {
  return VALUE_FULL.test(value.toLowerCase().replace(/!important/g, '').trim());
}

/**
 * AO3: `sanitize_css_gradient` — the branch this file did not know existed,
 * and the largest capability gap it ever had (§17, Correction 5).
 *
 * `sanitize_css_token` sends any token containing the substring `gradient` here
 * instead of to the value grammar. It splits `name(interior)`, requires `name`
 * to contain `gradient`, and recursively tokenises the interior. So **every**
 * gradient function is legal — linear, radial, conic, repeating, vendor-prefixed
 * — on any property that takes the token path, which is every property whose
 * name contains a shorthand substring: `background`, `background-image`,
 * `background-color`, `border-image`, `list-style-image`.
 *
 * §11 read "AO3 permits gradients" off a published skin a year ago. It was
 * right, nothing was built on it, and the lint quietly refused all 57 gradient
 * declarations in the corpus in the meantime.
 */
const GRADIENT_CALL = /^([a-z\-]+)\((.*)\)/i;

function isLegalGradient(token: string): boolean {
  const match = token.match(GRADIENT_CALL);
  if (!match) return false;

  const [, name, interior] = match;
  return /gradient/i.test(name) && areTokensLegal(interior);
}

/** AO3: `sanitize_css_token` — the gradient fork, then the value grammar. */
function isLegalToken(token: string): boolean {
  return /gradient/i.test(token) ? isLegalGradient(token) : isLegalValue(token.trim());
}

/** AO3: `tokenize_and_sanitize_css_value`. Empty is a refusal, not a pass. */
function areTokensLegal(value: string): boolean {
  const tokens = tokenizeValue(value);
  return tokens.length > 0 && tokens.every(isLegalToken);
}

/**
 * Split a value the way AO3's `tokenize_and_sanitize_css_value` does: on
 * whitespace and commas, but **not inside parentheses**.
 *
 * The distinction is the whole game for functions that take a comma-separated
 * argument list. `rgba(255, 255, 255, 0.5)` is one token to AO3 and is legal.
 * Splitting naively on commas turns it into `rgba(255`, `255`, `255`, `0.5)`,
 * none of which parse — so a naive splitter rejects colours AO3 happily
 * accepts. Being stricter than the archive is the one failure mode this file
 * must not have: it blocks working CSS and the user has no way to tell we are
 * the ones who are wrong.
 */
function tokenizeValue(value: string): string[] {
  const tokens: string[] = [];
  let buffer = '';
  let depth = 0;

  for (const ch of value) {
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);

    if (depth === 0 && /[\s,]/.test(ch)) {
      if (buffer) tokens.push(buffer);
      buffer = '';
      continue;
    }
    buffer += ch;
  }

  if (buffer) tokens.push(buffer);
  return tokens;
}

/* ── Image URLs ────────────────────────────────────────────────────────────
 *
 * AO3's URI_REGEX, reproduced:
 *
 *   (\/images|https?://\w[\w\-\.]+\.(TLD)) \/ [\w\-\.\/]* [\w\-] \.(jpg|jpeg|png|gif)
 *
 * and URL_REGEX wraps it so the whole thing — optionally quoted — must be
 * consumed before the closing paren of url().
 *
 * The consequence people trip over: `?` is not in `[\w\-\.\/]`, so a query
 * string means the match stops early, the closing quote never lines up, and
 * AO3 blanks the declaration and refuses the skin. Discord CDN links, Google
 * Drive links and Dropbox links all carry query strings and all fail. This is
 * not a rule we can soften — it is what the archive does — so the only useful
 * thing we can do is say so before the user pastes into AO3 and gets a
 * generic error.
 */
/*
 * Anchored at BOTH ends, which upstream achieves by construction rather than by
 * anchors: URI_REGEX is wrapped in URL_FUNCTION_REGEX as `url\(\s*` + URI +
 * `\s*\)`, so the address must begin immediately after the paren and be fully
 * consumed before it closes.
 *
 * Leaving this unanchored — as an earlier version did — accepts six shapes AO3
 * refuses, all of them because `\/images` matches *inside* the path rather than
 * at the start: `https://cdn.example.xyz/images/banner.png` has an
 * unallowlisted TLD, but the bare substring `/images/banner.png` satisfies the
 * pattern on its own. Trailing junk (`…/a.png"); body{display:none}`) slipped
 * through for the same reason.
 */
const AO3_URI = new RegExp(`^${URI_REGEX}$`, 'i');

/** The character set URI_REGEX permits after the scheme. No `?`, `:`, space, `%`. */
const AO3_URI_CHARS = /^[\w\-./]+$/;

export interface ImageUrlVerdict {
  ok: boolean;
  /** Plain language, addressed to the user. Absent when ok. */
  problem?: string;
  /** What to do about it. Absent when ok. */
  fix?: string;
}

/**
 * Would AO3 accept this image address inside url()?
 *
 * `ok` is exactly AO3's answer — the regex above is its regex. The wording is
 * best-effort: we re-test the parts separately to name the most likely cause,
 * because "your skin could not be saved" is what AO3 says and it helps nobody.
 */
export function checkAo3ImageUrl(raw: string): ImageUrlVerdict {
  const url = raw.trim();
  if (!url) return { ok: true };

  // AO3 downcases the value before matching, so we do too. It returns the
  // original afterwards, which is why the emitted URL keeps its capitals.
  const lower = url.toLowerCase();

  if (AO3_URI.test(lower) && !/[?#]/.test(lower)) return { ok: true };

  if (!/^https?:\/\//.test(lower)) {
    return {
      ok: false,
      problem: 'This needs to be a full web address.',
      fix: 'It should start with https:// — right-click the image and choose “Copy image address”.',
    };
  }

  if (/[?#]/.test(lower)) {
    return {
      ok: false,
      problem: 'AO3 won’t accept an address with a “?” or “#” in it.',
      fix: 'Discord, Google Drive and Dropbox links all have one. Re-upload the image to imgur.com or postimg.cc and use that link instead.',
    };
  }

  // Checked before the extension, or a trailing space turns into the nonsense
  // "AO3 doesn't accept .png extra-junk images".
  if (!AO3_URI_CHARS.test(lower.replace(/^https?:\/\//, ''))) {
    return {
      ok: false,
      problem: 'AO3 won’t accept this address.',
      fix: 'Addresses may only contain letters, numbers, dots, dashes and slashes. Spaces, %20, colons and other symbols are refused.',
    };
  }

  const extension = lower.split('/').pop()?.split('.').pop() ?? '';
  if (!AO3_IMAGE_EXTENSIONS.includes(extension)) {
    return {
      ok: false,
      problem: extension
        ? `AO3 doesn’t accept .${extension} images.`
        : 'This address doesn’t end in an image file.',
      fix: 'It has to end in .jpg, .jpeg, .png or .gif. WebP is the usual culprit — save the image and re-upload it as a PNG.',
    };
  }

  const host = lower.replace(/^https?:\/\//, '').split('/')[0];
  const tld = host.split('.').pop() ?? '';
  if (!AO3_TLDS.includes(tld)) {
    return {
      ok: false,
      problem: `AO3 doesn’t allow images from .${tld} addresses.`,
      fix: 'Its list of allowed domains is an old one and never got updated — .moe, .app and .xyz are all missing. Re-upload to imgur.com or postimg.cc.',
    };
  }

  return {
    ok: false,
    problem: 'AO3 won’t accept this address.',
    fix: 'Addresses may only contain letters, numbers, dots, dashes and slashes. Spaces, %20 and other symbols are refused.',
  };
}

/**
 * AO3: the `aspect-ratio` branch, added upstream between `font-family` and
 * `content`. It is the first real upstream drift this project has found — the
 * Sources section recorded "no upstream drift" as of 7 Aug 2026, and this
 * branch was not in our model, so `aspect-ratio: 16/9` was refused (§17,
 * Correction 9). Re-verify the branch list when re-verifying the allowlists.
 */
const NUMBER_OR_RATIO_REGEX = `${g(NUMBER_REGEX)}${g(` *\\/ *${g(NUMBER_REGEX)}`)}?`;
const ASPECT_RATIO = new RegExp(
  `^${g(`${g(ALPHA_REGEX)}|${g('(?:auto +)?')}${g(NUMBER_OR_RATIO_REGEX)}${g(' +auto')}?`)}$`,
  'i'
);

/**
 * Values AO3 cannot parse.
 *
 * The branch order below mirrors `sanitize_css_declaration_value` exactly:
 * font-family, aspect-ratio, content, the url() gate, then — and the split
 * matters — the **token** path for shorthand and custom properties, the
 * whole-value path for everything else. Reordering any of it produces wrong
 * answers: `content: url(...)` and `font-family: 'Palatino Linotype'` are legal
 * only because their branch runs before the general one, and a gradient is
 * legal only because `background-image` reaches the token path.
 */
function checkValue(property: string, value: string): Violation | null {
  const v = value.trim();

  if (property === 'font-family') {
    if (!isLegalFontStack(v)) {
      return {
        kind: 'banned_value_for_property',
        subject: property,
        message: `Font names may only contain letters, digits, dashes and spaces (optionally quoted). Got: ${v}`,
      };
    }
    return null;
  }

  if (property === 'aspect-ratio') {
    return ASPECT_RATIO.test(v.replace(/!important/gi, '').trim())
      ? null
      : {
          kind: 'banned_value_for_property',
          subject: property,
          message: `aspect-ratio takes a keyword, a number, or a ratio like 16/9. Got: ${v}`,
        };
  }

  // `content` is handled BEFORE the url() gate, matching the branch order in
  // sanitize_css_declaration_value. Getting this backwards wrongly rejects
  // `content: url(...)`, which sanitize_css_content explicitly permits.
  if (property === 'content') {
    if (/\bvar\b/i.test(v)) {
      return {
        kind: 'banned_value_for_property',
        subject: property,
        message: 'var() is rejected inside content.',
      };
    }
    // sanitize_css_content anchors the url() form against the FULL
    // URL_FUNCTION_REGEX, so `content: url(x.png)` is refused for the same
    // reason a relative banner address is: there is no scheme and no domain.
    if (/^url\(/i.test(v)) {
      const inner = v.match(/url\(\s*['"]?(.*?)['"]?\s*\)/i)?.[1] ?? '';
      const verdict = checkAo3ImageUrl(inner);
      return verdict.ok
        ? null
        : {
            kind: 'banned_value_for_property',
            subject: property,
            message: `${verdict.problem} ${verdict.fix}`,
          };
    }

    const ok = /^'[^']*'$/.test(v) || /^"[^"]*"$/.test(v) || v === 'none';
    if (!ok) {
      return {
        kind: 'banned_value_for_property',
        subject: property,
        message: `content must be one fully-quoted string, a url(), or none. Got: ${v}`,
      };
    }
    return null;
  }

  // The url() gate. A value merely *mentioning* url() on a property that does
  // not take one is dropped before the grammar runs at all.
  if (/\burl\b/i.test(v) && !AO3_URL_PROPERTIES.includes(property)) {
    return {
      kind: 'banned_value_for_property',
      subject: property,
      message: `url() is only allowed on ${AO3_URL_PROPERTIES.join(', ')} — not on ${property}.`,
    };
  }

  // Shorthand and custom properties take the token path, where gradients are
  // legal; everything else is matched whole, where they are not. This is the
  // split that makes `background-image: linear-gradient(…)` work and
  // `color: linear-gradient(…)` fail, and it is AO3's, not a choice of ours.
  //
  // The address inside a url() is validated by URL_FUNCTION_REGEX as part of
  // the grammar, which is what makes the export dialog the last line of
  // defence: a banner AO3 would refuse cannot be copied out of this app.
  const legal =
    isShorthandProperty(property) || isCustomProperty(property)
      ? areTokensLegal(v)
      : isLegalValue(v);

  return legal ? null : diagnoseValue(property, v);
}

/**
 * Reached only once the grammar has already decided AO3 drops the declaration.
 * The grammar answers *whether*; this answers *why*, most specific cause first.
 *
 * Keeping the two apart is deliberate. Every diagnostic that also acted as a
 * refusal — the blanket `font` rejection is the one §17 caught — is a place
 * where a helpful message quietly became a rule stricter than the archive.
 */
function diagnoseValue(property: string, value: string): Violation {
  const violation = (message: string): Violation => ({
    kind: 'banned_value_for_property',
    subject: property,
    message,
  });

  if (/\bcolor-mix\s*\(/i.test(value)) {
    return violation(
      `color-mix() is not in AO3's value grammar. Resolve it to a literal colour before emitting (see colors.ts mixHex).`
    );
  }

  if (/\burl\s*\(/i.test(value)) {
    const inner = value.match(/url\(\s*['"]?(.*?)['"]?\s*\)/i)?.[1] ?? '';
    const verdict = checkAo3ImageUrl(inner);
    if (!verdict.ok) return violation(`${verdict.problem} ${verdict.fix}`);
  }

  if (property === 'font') {
    // The shorthand is no longer refused on sight — `font: Georgia, serif`
    // tokenises cleanly and AO3 keeps it (§17, Correction 8). It reaches this
    // message only when a token actually fails, which for a font stack is
    // almost always a quoted family name: the shorthand misses
    // sanitize_css_font, so quotes have nowhere legal to be.
    return violation(
      'The `font` shorthand misses AO3\'s font-family branch and is tokenised instead, which rejects any quoted family name. Emit font-family, font-size and font-style separately.'
    );
  }

  const bad = tokenizeValue(value).find(token => !isLegalToken(token));
  return violation(
    bad !== undefined
      ? `"${bad}" is not a value AO3 can parse. Each token must be a hex/rgb()/hsl() colour, a gradient, a bare keyword, or a number with an optional unit.`
      : `"${value}" is not a value AO3 can parse.`
  );
}

/**
 * Remove CSS comments before pattern-matching a stylesheet.
 *
 * **Call this before any regex that decides something about CSS.** Forgetting
 * it has produced four separate wrong answers in this codebase:
 *
 * 1. `lintAo3Css` refused a perfectly legal stylesheet because a *comment*
 *    explaining the em conversion contained the word `@media`
 * 2. and 3. two tests read values out of comments and asserted on them — one
 *    scanning for stray `px` found the "16px base" mentioned in prose
 * 4. the namespacing prototype missed seven rules that followed a comment
 *
 * The failure is always the same shape and always in the same direction: we
 * end up **stricter than AO3**, which is the one thing this file must never
 * be. AO3 never sees a comment at all — `css_parser` hands `clean_css_code`
 * parsed rule sets — so a comment can say anything without affecting what the
 * archive accepts.
 *
 * Known limits, stated because the naive regex is the right tool here and a
 * real tokeniser would not be: a `/*` appearing inside a quoted value would be
 * treated as a comment start, and an unterminated comment is left in place
 * rather than swallowing the rest of the file. Neither can occur in CSS we
 * generate, and we only ever feed this our own output.
 */
export function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * Lint a compiled stylesheet.
 *
 * A deliberately small parser: we only ever feed it CSS we generated
 * ourselves, so it does not need to survive hostile input — it needs to be
 * obvious enough that a reader can confirm it matches AO3's rules.
 */
export function lintAo3Css(css: string, mode: SkinMode = 'site'): Violation[] {
  const violations: Violation[] = [];

  // Comments come off FIRST, before the at-rule checks below — a stylesheet
  // whose comment explains why we avoid @media must not be refused for saying
  // so. See stripCssComments for the four times that went wrong.
  const withoutComments = stripCssComments(css);

  if (/@font-face/i.test(withoutComments)) {
    violations.push({
      kind: 'font_face',
      subject: '@font-face',
      message: 'AO3 rejects @font-face outright. Use the web-safe font stacks.',
    });
  }

  if (/@media/i.test(withoutComments)) {
    violations.push({
      kind: 'media_block',
      subject: '@media',
      message:
        'AO3 has no @media in skin CSS — media is a field on the skin itself, and the cleaner flattens the block, silently changing what the rules apply to.',
    });
  }

  // Walk `selector { declarations }` pairs.
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;

  while ((match = ruleRe.exec(withoutComments)) !== null) {
    const selector = match[1].trim().replace(/\s+/g, ' ');
    const body = match[2];

    const declarations = body
      .split(';')
      .map(d => d.trim())
      .filter(Boolean);

    let kept = 0;

    for (const declaration of declarations) {
      const idx = declaration.indexOf(':');
      if (idx === -1) continue;

      const property = declaration.slice(0, idx).trim().toLowerCase();
      const value = declaration.slice(idx + 1).replace(/!important\s*$/i, '').trim();

      // Work-skin-only refusals, from WorkSkin#clean_css. Each is checked
      // before the shared rules because each is a hard stop that the shared
      // rules would wave through — a custom property and a var() are both
      // perfectly legal in a site skin.
      if (mode === 'work') {
        if (isCustomProperty(property)) {
          violations.push({
            kind: 'work_skin_custom_property',
            subject: property,
            message: `Work skins cannot define custom properties. "${property}" (in ${selector}) is fine in a site skin but rejected here.`,
          });
          continue;
        }
        if (/\bvar\b/i.test(value)) {
          violations.push({
            kind: 'work_skin_var',
            subject: property,
            message: `Work skins cannot use var(). Resolve "${property}" (in ${selector}) to a literal value.`,
          });
          continue;
        }
        if (property === 'position' && value.toLowerCase() === 'fixed') {
          violations.push({
            kind: 'work_skin_position_fixed',
            subject: property,
            message: `Work skins cannot use position: fixed (in ${selector}) — it would let a work escape its own page region.`,
          });
          continue;
        }
      }

      if (!isPropertyAllowed(property)) {
        violations.push({
          kind: property.startsWith('--') ? 'invalid_custom_property_name' : 'banned_property',
          subject: property,
          message: `AO3 does not accept "${property}" (in ${selector}). It is not a supported property, contains no shorthand, and is not a valid custom property.`,
        });
        continue;
      }

      const valueProblem = checkValue(property, value);
      if (valueProblem) {
        violations.push({ ...valueProblem, message: `${valueProblem.message} (in ${selector})` });
        continue;
      }

      kept++;
    }

    // AO3 errors on a rule set left with nothing in it.
    if (declarations.length > 0 && kept === 0) {
      violations.push({
        kind: 'empty_rule',
        subject: selector,
        message: `Every declaration in "${selector}" would be dropped, which AO3 reports as an error rather than ignoring.`,
      });
    }
  }

  return violations;
}

/** Convenience for the export gate. */
export function isAo3Safe(css: string, mode: SkinMode = 'site'): boolean {
  return lintAo3Css(css, mode).length === 0;
}
