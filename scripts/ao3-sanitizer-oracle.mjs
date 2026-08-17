/**
 * A faithful port of otwarchive lib/css_cleaner.rb value sanitisation,
 * built directly from the Ruby source (fetched 16 Aug 2026), used ONLY as a
 * differential oracle against src/lib/siteSkin/ao3Css.ts.
 *
 * Ruby subtleties preserved:
 *  - Regexp#to_s wraps each constant in a non-capturing group, so interpolation
 *    groups correctly. We do the same with (?:...).
 *  - Lines 11-12 of css_cleaner.rb write `\s` inside a DOUBLE-quoted Ruby
 *    string, where `\s` is the escape for a literal SPACE, not the character
 *    class. So NUMBER_WITH_UNIT separates on spaces only. Lines 13/25/33/40
 *    use single quotes or `\\s`, which really are `\s`.
 */

const g = (s) => `(?:${s})`;

const ALPHA = '[a-z\\-]+';
const UNITS = 'deg|cm|em|ex|in|mm|pc|pt|px|s|%';
const NUMBER = '-?\\.?\\d{1,3}\\.?\\d{0,3}';
// NB: literal spaces, not \s — see header note.
const NUMBER_WITH_UNIT = `${g(NUMBER)} *${g(UNITS)}? *,? *`;
const PAREN_NUMBER = `\\(\\s*${g(NUMBER_WITH_UNIT)}+\\s*\\)`;

const FUNCTION_NAME = 'scalex?y?|translatex?y?|skewx?y?|rotatex?y?|matrix';
const TRANSFORM_FUNCTION = `${g(FUNCTION_NAME)}${g(PAREN_NUMBER)}`;
const SHAPE_FUNCTION = `${g('rect')}${g(PAREN_NUMBER)}`;
const RGBA = `rgba?${g(PAREN_NUMBER)}`;
const HSLA = `hsla?${g(PAREN_NUMBER)}`;
const COLOR = `#[0-9a-f]{3,6}|${ALPHA}|${g(RGBA)}|${g(HSLA)}`;
const COLOR_STOP = `color-stop\\s*\\(${g(NUMBER_WITH_UNIT)}\\s*,?\\s*${g(COLOR)}\\s*\\)`;
const FILTER_NAME = 'blur|brightness|contrast|grayscale|hue-rotate|invert|opacity|saturate|sepia';
const FILTER_FUNCTION = `${g(FILTER_NAME)}${g(PAREN_NUMBER)}`;
const DROP_SHADOW_VALUE = `\\(\\s*${g(`${g(NUMBER_WITH_UNIT)}|${g(COLOR)}\\s*`)}+\\s*\\)`;
const DROP_SHADOW_FUNCTION = `${g('drop-shadow')}${g(DROP_SHADOW_VALUE)}`;

const CUSTOM_PROPERTY_NAME = '\\-\\-[0-9a-z\\-_]+';
const VAR_FUNCTION = `var${g(`\\(\\s*${g(CUSTOM_PROPERTY_NAME)}\\s*\\)`)}`;

const TLDS =
  'ac ad ae aero af ag ai al am an ao aq ar arpa as asia at au aw ax az ba bb bd be bf bg bh bi biz bj bm bn bo br bs bt bv bw by bz ca cat cc cd cf cg ch ci ck cl cm cn co com coop cr cu cv cx cy cz de dj dk dm do dz ec edu ee eg er es et eu fi fj fk fm fo fr ga gb gd ge gf gg gh gi gl gm gn gov gp gq gr gs gt gu gw gy hk hm hn hr ht hu id ie il im in info int io iq ir is it je jm jo jobs jp ke kg kh ki km kn kp kr kw ky kz la lb lc li lk lr ls lt lu lv ly ma mc md me mg mh mil mk ml mm mn mo mobi mp mq mr ms mt mu museum mv mw mx my mz na name nc ne net nf ng ni nl no np nr nu nz om org pa pe pf pg ph pk pl pm pn pr pro ps pt pw py qa re ro rs ru rw sa sb sc sd se sg sh si sj sk sl sm sn so sr st su sv sy sz tc td tel tf tg th tj tk tl tm tn to tp tr travel tt tv tw tz ua ug uk us uy uz va vc ve vg vi vn vu wf ws xn xxx ye yt za zm zw'.split(
    ' '
  );
const EXTS = ['jpg', 'jpeg', 'png', 'gif'];
const DOMAIN = `https?://\\w[\\w\\-\\.]+\\.${g(TLDS.join('|'))}`;
const DOMAIN_OR_IMAGES = `\\/images|${g(DOMAIN)}`;
const URI = `${g(DOMAIN_OR_IMAGES)}/[\\w\\-\\.\\/]*[\\w\\-]\\.${g(EXTS.join('|'))}`;
const URL_R = `${g(URI)}|"${g(URI)}"|'${g(URI)}'`;
const URL_FUNCTION = `url\\(\\s*${g(URL_R)}\\s*\\)`;

export const VALUE_REGEX_SRC = [
  TRANSFORM_FUNCTION,
  URL_FUNCTION,
  COLOR_STOP,
  COLOR,
  NUMBER_WITH_UNIT,
  ALPHA,
  SHAPE_FUNCTION,
  FILTER_FUNCTION,
  DROP_SHADOW_FUNCTION,
  VAR_FUNCTION,
]
  .map(g)
  .join('|');

const VALUE_FULL = new RegExp(`^${g(`${g(VALUE_REGEX_SRC)},?\\s*`)}+$`, 'i');
const VAR_FN = new RegExp(VAR_FUNCTION, 'i');
const URL_FN_FULL = new RegExp(`^${g(URL_FUNCTION)}$`);
const NUMBER_OR_RATIO = `${g(NUMBER)}${g(` *\\/ *${g(NUMBER)}`)}?`;

const stripValue = (v) => v.toLowerCase().replace(/!important/g, '').trim();

/** css_cleaner.rb: sanitize_css_value */
export function sanitizeCssValue(value, keywords) {
  const s = stripValue(value);
  if (VALUE_FULL.test(s)) return value;
  if (s.split(',').every((sub) => keywords.has(sub.trim()))) return value;
  return '';
}

/** css_cleaner.rb: sanitize_css_gradient */
function sanitizeCssGradient(value, keywords) {
  const m = value.match(/^([a-z\-]+)\((.*)\)/);
  if (m) {
    const [, fn, interior] = m;
    const cleaned = tokenizeAndSanitize(interior, keywords);
    if (/gradient/.test(fn) && cleaned.trim() !== '') return `${fn}(${cleaned})`;
  }
  return '';
}

const sanitizeToken = (t, kw) => (/gradient/.test(t) ? sanitizeCssGradient(t, kw) : sanitizeCssValue(t, kw));

/**
 * css_cleaner.rb: tokenize_and_sanitize_css_value.
 * StringScanner walk: scan_until(/\s+|,|\(/), then balance parens.
 */
function tokenizeAndSanitize(value, keywords) {
  let clean = '';
  let pos = 0;
  const rest = () => value.slice(pos);
  const scanUntil = (re) => {
    const m = rest().match(re);
    if (!m) return null;
    const out = rest().slice(0, m.index + m[0].length);
    pos += out.length;
    return out;
  };
  while (/\s+|,|\(/.test(rest())) {
    let inParen = 0;
    let token = scanUntil(/\s+|,|\(/);
    if (token === null) break;
    if (token.trim() === '' || token === ',') {
      clean += token;
      continue;
    }
    if (/\($/.test(token)) inParen = 1;
    while (inParen > 0) {
      const next = scanUntil(/\(|\)/);
      if (next === null) return '';
      token += next;
      if (/\($/.test(token)) inParen += 1;
      if (/\)$/.test(token)) inParen -= 1;
    }
    const sepMatch = token.match(/(\s|,)$/);
    const separator = sepMatch ? sepMatch[0] : '';
    token = token.trim().replace(/,$/, '');
    const ct = sanitizeToken(token, keywords);
    if (ct.trim() === '') return '';
    clean += ct + separator;
  }
  const tail = rest();
  if (tail && tail.trim() !== '') {
    const ct = sanitizeToken(tail, keywords);
    if (ct.trim() === '') return '';
    clean += ct;
  }
  return clean;
}

function sanitizeCssContent(value) {
  if (/^'[^']*'$/.test(value)) return value;
  if (/^"[^"]*"$/.test(value)) return value;
  if (URL_FN_FULL.test(value)) return value;
  if (value === 'none') return value;
  return '';
}

function sanitizeCssFont(value) {
  const s = stripValue(value);
  return s.split(',').every((f) => /^('?[a-z0-9\- ]+'?|"?[a-z0-9\- ]+"?)$/.test(f.trim())) ? value : '';
}

const URL_PROPS = ['background', 'background-image', 'border', 'border-image', 'list-style', 'list-style-image'];

/** css_cleaner.rb: sanitize_css_declaration_value. Returns '' if AO3 drops it. */
export function sanitizeDeclarationValue(property, rawValue, ctx) {
  const { properties, shorthands, keywords } = ctx;
  // css_parser's each_declaration yields `is_important` as a separate flag, so
  // the value clean_css_code passes in never contains `!important`.
  const value = rawValue.replace(/!important/gi, '').trim();
  const legalShorthand = new RegExp(shorthands.join('|')).test(property);
  const legalProperty =
    properties.has(property) || new RegExp(`-(?:moz|ms|o|webkit)-(?:${[...properties].join('|')})`).test(property);
  const custom = new RegExp(`^${g(CUSTOM_PROPERTY_NAME)}$`, 'i').test(property);

  let clean = '';
  if (property === 'font-family') clean = sanitizeCssFont(value) !== '' ? value : '';
  else if (property === 'aspect-ratio')
    clean = new RegExp(`^${g(`${g(ALPHA)}|${g('(?:auto +)?')}${g(NUMBER_OR_RATIO)}${g(' +auto')}?`)}$`, 'i').test(value)
      ? value
      : '';
  else if (property === 'content') clean = /\bvar\b/i.test(value) ? '' : sanitizeCssContent(value);
  else if (/\burl\b/i.test(value) && !URL_PROPS.includes(property)) clean = '';
  else if (legalShorthand || custom) clean = tokenizeAndSanitize(value, keywords);
  else if (legalProperty) clean = sanitizeCssValue(value, keywords);
  return clean.trim();
}

export function propertyAllowed(property, ctx) {
  const { properties, shorthands } = ctx;
  return (
    properties.has(property) ||
    new RegExp(`-(?:moz|ms|o|webkit)-(?:${[...properties].join('|')})`).test(property) ||
    new RegExp(shorthands.join('|')).test(property) ||
    new RegExp(`^${g(CUSTOM_PROPERTY_NAME)}$`, 'i').test(property)
  );
}
