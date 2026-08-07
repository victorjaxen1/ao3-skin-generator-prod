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
 * The rules encoded here (verified against otwarchive master, 6 Aug 2026):
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

/**
 * An approximation of AO3's VALUE_REGEX, applied to a single token.
 *
 * Faithful to the parts a theme compiler can actually reach: colors, numbers
 * with units, and bare keywords. The function forms (transform/filter/shape/
 * drop-shadow/color-stop/var) are admitted wholesale rather than parsed,
 * because v1 emits none of them and a half-right parser here would be worse
 * than an honest passthrough.
 *
 * The number rule is `-?\.?\d{1,3}\.?\d{0,3}`, which reads like a three-digit
 * cap but is not one: `1000` matches as `100` + `0`, since the optional dot
 * between the two digit runs is optional. Do not tighten this to three digits
 * — that would reject values AO3 accepts. We emit `999px` for pill tags out of
 * convention, not necessity.
 */
const AO3_NUMBER = String.raw`-?\.?\d{1,3}\.?\d{0,3}`;
const AO3_TOKEN = new RegExp(
  '^(' +
    // colors: #rgb..#rrggbb, rgb(a)/hsl(a), or a bare keyword (which also
    // covers named colours, `solid`, `none`, `auto`, `left`…)
    String.raw`#[0-9a-f]{3,6}` + '|' +
    String.raw`(rgba?|hsla?)\([^()]*\)` + '|' +
    String.raw`[a-z\-]+` + '|' +
    // numbers, with or without a unit
    `${AO3_NUMBER}(deg|cm|em|ex|in|mm|pc|pt|px|s|%)?` + '|' +
    // function forms we do not emit but do not want to mis-reject
    String.raw`(scale|translate|skew|rotate|matrix|rect|blur|brightness|contrast|grayscale|hue-rotate|invert|opacity|saturate|sepia|drop-shadow|color-stop|var|url)[a-z]*\([^()]*\)` +
  ')$',
  'i'
);

function isLegalToken(token: string): boolean {
  return AO3_TOKEN.test(token.trim());
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
const AO3_URI = new RegExp(
  '(?:\\/images|https?:\\/\\/\\w[\\w\\-.]+\\.(?:' + AO3_TLDS.join('|') + '))' +
    '\\/[\\w\\-./]*[\\w-]\\.(?:' + AO3_IMAGE_EXTENSIONS.join('|') + ')',
  'i'
);

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
 * Values AO3 cannot parse.
 *
 * The branch order below mirrors `sanitize_css_declaration_value` exactly:
 * font-family, then content, then the url() gate, then the value grammar.
 * Reordering any of it produces wrong answers — `content: url(...)` and
 * `font-family: 'Palatino Linotype'` are both legal only because their branch
 * runs before the general one.
 */
function checkValue(property: string, value: string): Violation | null {
  const v = value.trim();

  if (/\bcolor-mix\s*\(/i.test(v)) {
    return {
      kind: 'banned_value_for_property',
      subject: property,
      message: `color-mix() is not in AO3's value grammar. Resolve it to a literal colour before emitting (see colors.ts mixHex).`,
    };
  }

  if (property === 'font') {
    return {
      kind: 'banned_value_for_property',
      subject: property,
      message:
        'The `font` shorthand misses AO3\'s font-family branch and is tokenised instead, which rejects any quoted family name. Emit font-family, font-size and font-style separately.',
    };
  }

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

  if (/\burl\s*\(/i.test(v)) {
    if (!AO3_URL_PROPERTIES.includes(property)) {
      return {
        kind: 'banned_value_for_property',
        subject: property,
        message: `url() is only allowed on ${AO3_URL_PROPERTIES.join(', ')} — not on ${property}.`,
      };
    }

    // The property is permitted, but the address inside still has to satisfy
    // AO3's URI grammar. Checking it here rather than only in the editor makes
    // the export dialog the last line of defence: a banner AO3 would refuse
    // cannot be copied out of this app.
    const inner = v.match(/url\(\s*['"]?(.*?)['"]?\s*\)/i)?.[1] ?? '';
    const verdict = checkAo3ImageUrl(inner);
    if (!verdict.ok) {
      return {
        kind: 'banned_value_for_property',
        subject: property,
        message: `${verdict.problem} ${verdict.fix}`,
      };
    }
    return null;
  }

  // Everything else meets the value grammar. AO3 tokenises on spaces and
  // commas and sanitises each token, so we do the same; a value is legal only
  // if every token is.
  const bad = tokenizeValue(v).find(token => !isLegalToken(token));

  if (bad !== undefined) {
    return {
      kind: 'banned_value_for_property',
      subject: property,
      message: `"${bad}" is not a value AO3 can parse. Each token must be a hex/rgb()/hsl() colour, a bare keyword, or a number with an optional unit.`,
    };
  }

  return null;
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

  if (/@font-face/i.test(css)) {
    violations.push({
      kind: 'font_face',
      subject: '@font-face',
      message: 'AO3 rejects @font-face outright. Use the web-safe font stacks.',
    });
  }

  if (/@media/i.test(css)) {
    violations.push({
      kind: 'media_block',
      subject: '@media',
      message:
        'AO3 has no @media in skin CSS — media is a field on the skin itself, and the cleaner flattens the block, silently changing what the rules apply to.',
    });
  }

  // Strip comments, then walk `selector { declarations }` pairs.
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
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
