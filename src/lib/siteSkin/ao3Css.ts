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
} from './ao3Properties';

export type ViolationKind =
  | 'banned_property'
  | 'invalid_custom_property_name'
  | 'banned_value_for_property'
  | 'font_face'
  | 'media_block'
  | 'empty_rule';

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
 * Values AO3 cannot parse. Its VALUE_REGEX admits transform/filter/shape/
 * drop-shadow/url/color-stop/var functions, colors, numbers with units and
 * bare keywords — and nothing else. `color-mix()` is the one modern function
 * most likely to be reached for, so it is named explicitly.
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
    const ok = /^'[^']*'$/.test(v) || /^"[^"]*"$/.test(v) || v === 'none' || /^url\(/i.test(v);
    if (!ok) {
      return {
        kind: 'banned_value_for_property',
        subject: property,
        message: `content must be one fully-quoted string, a url(), or none. Got: ${v}`,
      };
    }
    return null;
  }

  if (/\burl\s*\(/i.test(v) && !AO3_URL_PROPERTIES.includes(property)) {
    return {
      kind: 'banned_value_for_property',
      subject: property,
      message: `url() is only allowed on ${AO3_URL_PROPERTIES.join(', ')} — not on ${property}.`,
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
export function lintAo3Css(css: string): Violation[] {
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
export function isAo3Safe(css: string): boolean {
  return lintAo3Css(css).length === 0;
}
