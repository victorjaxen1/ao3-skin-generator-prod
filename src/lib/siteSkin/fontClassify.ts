/**
 * A website's `font-family` → one of ours.
 *
 * Phase C1 of the Magic Picker (`docs/MAGIC-PICKER-IMPLEMENTATION.md` §6d), and
 * the place Phase A's font bank pays for itself: with the original seven stacks
 * the honest answer to every source font was "Georgia" or "Arial", so there was
 * nothing worth classifying.
 *
 * **AO3 cannot load a font file.** Not one we host, not one from Google Fonts —
 * `@font-face` is refused at selector level, `src` is not an allowed property
 * and `url()` is permitted on backgrounds and borders only (§2a). So the answer
 * to "this site uses Poppins" is never Poppins. It is *"a geometric sans; the
 * closest AO3 allows is Futura"* — and saying that out loud is what turns a
 * limitation into competence rather than a broken promise.
 *
 * **This file knows nothing about the network or the DOM**, for the same reason
 * `palette.ts` does not: it takes a string and returns a string, so the whole
 * table below is unit-testable with no browser and no fetch in the room.
 *
 * ## The one rule that will bite you
 *
 * The value returned is a **literal member of `FONT_STACKS`**, never an index.
 * `validateTheme` accepts a font only if the string is found in that list, and
 * the list is append-only and grows — so an index is a moving target and a
 * near-miss string is silently dropped at the storage boundary, taking the
 * user's font with it on reload. `tests/font-classify.unit.spec.ts` asserts that
 * every target below is present *and* legal for the role it is offered for.
 */

import { FontGroup, FontRole, FONT_STACKS, fontStacksFor } from './theme';

/**
 * What kind of face it is, one level finer than `FontGroup`.
 *
 * `FontGroup` is the shelf a stack sits on in the picker; this is the judgement
 * that decides *which* stack on that shelf. "Sans" is not an answer — Futura and
 * Gill Sans are both sans and they are not substitutes for one another.
 */
export type FontCharacter =
  // sans
  | 'geometric'
  | 'humanist'
  | 'grotesque'
  | 'neo-grotesque'
  | 'ui'
  | 'rounded'
  | 'wide'
  // serif
  | 'old-style'
  | 'transitional'
  | 'screen-serif'
  | 'didone'
  | 'slab'
  // display
  | 'engraved'
  | 'poster'
  // script
  | 'casual-script'
  | 'handwriting'
  | 'formal-script'
  // mono
  | 'code'
  | 'typewriter';

interface CharacterTarget {
  group: FontGroup;
  /** Reads after "a" or "an", inside the sentence in `describeFontMatch`. */
  label: string;
  /** Both are literal `FONT_STACKS` values. */
  heading: string;
  /**
   * Display and script faces are heading-only (Phase A, enforced in
   * `validateTheme`), so every character needs a second answer for body text.
   * It is a genuine nearest-neighbour, not a shrug: a slab's body double is a
   * sturdy screen serif, a poster face's is a newsstand grotesque.
   */
  body: string;
}

// Only the stacks a *character* points at are named here. The rest of the bank
// is still reachable — `BANK_FACES` below matches a source naming one of them
// directly, which is a better answer than a nearest neighbour.
const GEORGIA = 'Georgia, serif';
const ARIAL = 'Arial, Helvetica, sans-serif';
const TREBUCHET = "'Trebuchet MS', Verdana, sans-serif";
const VERDANA = 'Verdana, Geneva, sans-serif';
const CAMBRIA = 'Cambria, Constantia, Georgia, serif';
const BASKERVILLE = "Baskerville, 'Baskerville Old Face', 'Hoefler Text', Georgia, serif";
const GARAMOND = "Garamond, 'Book Antiqua', Palatino, serif";
const DIDOT = "Didot, 'Bodoni MT', 'Times New Roman', serif";
const SEGOE = "'Segoe UI', Candara, Optima, sans-serif";
const GILL_SANS = "'Gill Sans', 'Gill Sans MT', Calibri, sans-serif";
const FUTURA = "Futura, 'Century Gothic', 'Avant Garde', sans-serif";
const FRANKLIN = "'Franklin Gothic Medium', 'Arial Narrow', Helvetica, sans-serif";
const ROCKWELL = "Rockwell, 'Bookman Old Style', Georgia, serif";
const COPPERPLATE =
  "Copperplate, 'Copperplate Gothic Light', 'Century Gothic', sans-serif";
const IMPACT = "Impact, Haettenschweiler, 'Arial Black', sans-serif";
const SEGOE_SCRIPT = "'Segoe Script', 'Bradley Hand', 'Brush Script MT', cursive";
const SNELL = "'Snell Roundhand', 'Palace Script MT', 'Edwardian Script ITC', cursive";
const COMIC = "'Comic Sans MS', 'Chalkboard SE', 'Marker Felt', cursive";
const CONSOLAS = "Consolas, Menlo, Monaco, 'Lucida Console', monospace";
const TYPEWRITER = "'American Typewriter', 'Courier New', monospace";

/** The taste in this feature, and there is not much code under it. */
const CHARACTERS: Record<FontCharacter, CharacterTarget> = {
  geometric: { group: 'sans', label: 'geometric sans', heading: FUTURA, body: FUTURA },
  humanist: { group: 'sans', label: 'humanist sans', heading: GILL_SANS, body: GILL_SANS },
  grotesque: { group: 'sans', label: 'grotesque sans', heading: FRANKLIN, body: FRANKLIN },
  'neo-grotesque': {
    group: 'sans',
    label: 'neo-grotesque sans',
    heading: ARIAL,
    body: ARIAL,
  },
  ui: { group: 'sans', label: 'interface sans', heading: SEGOE, body: SEGOE },
  rounded: { group: 'sans', label: 'rounded sans', heading: TREBUCHET, body: TREBUCHET },
  wide: { group: 'sans', label: 'wide screen sans', heading: VERDANA, body: VERDANA },

  'old-style': { group: 'serif', label: 'old-style serif', heading: GARAMOND, body: GARAMOND },
  transitional: {
    group: 'serif',
    label: 'transitional serif',
    heading: BASKERVILLE,
    body: BASKERVILLE,
  },
  // Georgia rather than Cambria: a face built for pixels, and the one a
  // reader is most likely to actually have.
  'screen-serif': { group: 'serif', label: 'screen serif', heading: GEORGIA, body: GEORGIA },
  // Didot is heading-only in the bank: hairline strokes vanish at body sizes on
  // a low-DPI screen. Baskerville keeps the high-contrast feel and survives a
  // paragraph.
  didone: { group: 'serif', label: 'high-contrast serif', heading: DIDOT, body: BASKERVILLE },
  slab: { group: 'display', label: 'slab serif', heading: ROCKWELL, body: CAMBRIA },

  engraved: {
    group: 'display',
    label: 'engraved display face',
    heading: COPPERPLATE,
    body: BASKERVILLE,
  },
  poster: { group: 'display', label: 'heavy poster face', heading: IMPACT, body: FRANKLIN },

  'casual-script': {
    group: 'script',
    label: 'casual handwritten face',
    heading: COMIC,
    body: TREBUCHET,
  },
  handwriting: {
    group: 'script',
    label: 'handwritten face',
    heading: SEGOE_SCRIPT,
    body: TREBUCHET,
  },
  'formal-script': {
    group: 'script',
    label: 'formal script',
    heading: SNELL,
    body: BASKERVILLE,
  },

  code: { group: 'mono', label: 'monospace', heading: CONSOLAS, body: CONSOLAS },
  typewriter: { group: 'mono', label: 'typewriter face', heading: TYPEWRITER, body: TYPEWRITER },
};

/**
 * ~200 faces, keyed by lowercased family name.
 *
 * This table *is* the feature — it is taste, not logic, and it is the only part
 * of Phase C worth arguing about. Two rules for adding to it:
 *
 *  - **name the face as it appears in CSS**, lowercased, quotes and weight
 *    suffixes stripped (`sf pro display`, not `SF Pro Display 500`);
 *  - **classify by what it looks like, not by who made it.** Inter and Roboto
 *    are Helvetica's children whatever their vendors say, and a reader who liked
 *    an Inter site will recognise Arial and will not recognise Gill Sans.
 *
 * Unlisted faces are not a failure — the generic at the end of the stack catches
 * them (`fallbackFromGeneric`), which is why a site using one obscure licensed
 * face still gets a defensible answer.
 */
const FACES: Record<string, FontCharacter> = {
  /* ── Geometric sans ───────────────────────────────────────────────────── */
  futura: 'geometric',
  'futura pt': 'geometric',
  'century gothic': 'geometric',
  'avant garde': 'geometric',
  'itc avant garde gothic': 'geometric',
  poppins: 'geometric',
  montserrat: 'geometric',
  jost: 'geometric',
  urbanist: 'geometric',
  outfit: 'geometric',
  'josefin sans': 'geometric',
  raleway: 'geometric',
  gilroy: 'geometric',
  'brandon grotesque': 'geometric',
  'sofia pro': 'geometric',
  circular: 'geometric',
  'circular std': 'geometric',
  'product sans': 'geometric',
  'google sans': 'geometric',
  'proxima nova': 'geometric',
  'museo sans': 'geometric',
  questrial: 'geometric',
  'dm sans': 'geometric',
  'league spartan': 'geometric',
  spartan: 'geometric',
  'kumbh sans': 'geometric',
  'red hat display': 'geometric',
  'plus jakarta sans': 'geometric',
  manrope: 'geometric',
  'space grotesk': 'geometric',
  'eurostile': 'geometric',
  'bank gothic': 'geometric',

  /* ── Humanist sans ────────────────────────────────────────────────────── */
  'gill sans': 'humanist',
  'gill sans mt': 'humanist',
  frutiger: 'humanist',
  myriad: 'humanist',
  'myriad pro': 'humanist',
  optima: 'humanist',
  'open sans': 'humanist',
  lato: 'humanist',
  'source sans pro': 'humanist',
  'source sans 3': 'humanist',
  'pt sans': 'humanist',
  'fira sans': 'humanist',
  'noto sans': 'humanist',
  calibri: 'humanist',
  candara: 'humanist',
  corbel: 'humanist',
  'tw cen mt': 'humanist',
  whitney: 'humanist',
  karla: 'humanist',
  cabin: 'humanist',
  asap: 'humanist',
  ubuntu: 'humanist',
  hind: 'humanist',
  mulish: 'humanist',
  muli: 'humanist',
  rubik: 'humanist',
  'droid sans': 'humanist',
  'trebuchet ms': 'humanist',
  trebuchet: 'humanist',
  'lucida sans': 'humanist',
  'lucida grande': 'humanist',
  'segoe ui': 'ui',
  'clear sans': 'humanist',
  'stone sans': 'humanist',

  /* ── Neo-grotesque sans ───────────────────────────────────────────────── */
  helvetica: 'neo-grotesque',
  'helvetica neue': 'neo-grotesque',
  'helvetica now': 'neo-grotesque',
  'neue haas grotesk': 'neo-grotesque',
  arial: 'neo-grotesque',
  'arial mt': 'neo-grotesque',
  'liberation sans': 'neo-grotesque',
  'nimbus sans': 'neo-grotesque',
  inter: 'neo-grotesque',
  'inter tight': 'neo-grotesque',
  roboto: 'neo-grotesque',
  univers: 'neo-grotesque',
  'akzidenz-grotesk': 'neo-grotesque',
  graphik: 'neo-grotesque',
  'gt america': 'neo-grotesque',
  'aktiv grotesk': 'neo-grotesque',
  'basis grotesque': 'neo-grotesque',
  'general sans': 'neo-grotesque',
  satoshi: 'neo-grotesque',
  geist: 'neo-grotesque',
  soehne: 'neo-grotesque',
  'söhne': 'neo-grotesque',
  'work sans': 'neo-grotesque',
  archivo: 'neo-grotesque',
  barlow: 'neo-grotesque',
  'ibm plex sans': 'neo-grotesque',
  "suisse int'l": 'neo-grotesque',
  'neue montreal': 'neo-grotesque',
  'schibsted grotesk': 'neo-grotesque',
  'instrument sans': 'neo-grotesque',

  /* ── Grotesque sans — older, narrower, more voice ─────────────────────── */
  'franklin gothic': 'grotesque',
  'franklin gothic medium': 'grotesque',
  'franklin gothic book': 'grotesque',
  'news gothic': 'grotesque',
  'trade gothic': 'grotesque',
  'benton sans': 'grotesque',
  knockout: 'grotesque',
  'arial narrow': 'grotesque',
  'archivo narrow': 'grotesque',
  'pt sans narrow': 'grotesque',
  'roboto condensed': 'grotesque',
  oswald: 'grotesque',
  'fjalla one': 'grotesque',
  'league gothic': 'grotesque',

  /* ── Interface / system sans ──────────────────────────────────────────── */
  // `system-ui`, `-apple-system` and `ui-sans-serif` are *not* here: they are
  // keywords, not faces, and matching them by name produces the sentence "this
  // site uses -Apple-System". They live in GENERICS, where the copy is right.
  'san francisco': 'ui',
  'sf pro': 'ui',
  'sf pro text': 'ui',
  'sf pro display': 'ui',
  'segoe ui variable': 'ui',
  tahoma: 'ui',
  cantarell: 'ui',
  'noto sans ui': 'ui',
  'apple system': 'ui',

  /* ── Rounded sans ─────────────────────────────────────────────────────── */
  nunito: 'rounded',
  'nunito sans': 'rounded',
  quicksand: 'rounded',
  comfortaa: 'rounded',
  'varela round': 'rounded',
  baloo: 'rounded',
  fredoka: 'rounded',
  'fredoka one': 'rounded',
  'sf pro rounded': 'rounded',
  'arial rounded mt bold': 'rounded',
  'vag rounded': 'rounded',
  'museo sans rounded': 'rounded',
  'm plus rounded 1c': 'rounded',
  'chalkboard': 'rounded',

  /* ── Wide screen sans ─────────────────────────────────────────────────── */
  verdana: 'wide',
  geneva: 'wide',
  'dejavu sans': 'wide',
  'lucida sans unicode': 'wide',
  'bitstream vera sans': 'wide',

  /* ── Old-style serif ──────────────────────────────────────────────────── */
  garamond: 'old-style',
  'eb garamond': 'old-style',
  'adobe garamond': 'old-style',
  'cormorant garamond': 'old-style',
  cormorant: 'old-style',
  sabon: 'old-style',
  'book antiqua': 'old-style',
  palatino: 'old-style',
  'palatino linotype': 'old-style',
  bembo: 'old-style',
  caslon: 'old-style',
  'adobe caslon': 'old-style',
  'libre caslon': 'old-style',
  jenson: 'old-style',
  minion: 'old-style',
  'minion pro': 'old-style',
  'crimson text': 'old-style',
  'crimson pro': 'old-style',
  'gentium book': 'old-style',
  'goudy old style': 'old-style',
  hoefler: 'old-style',
  'hoefler text': 'old-style',
  'iowan old style': 'old-style',
  spectral: 'old-style',
  'cardo': 'old-style',

  /* ── Transitional serif ───────────────────────────────────────────────── */
  baskerville: 'transitional',
  'baskerville old face': 'transitional',
  'libre baskerville': 'transitional',
  'times new roman': 'transitional',
  times: 'transitional',
  'liberation serif': 'transitional',
  'nimbus roman': 'transitional',
  'tinos': 'transitional',
  perpetua: 'transitional',
  'pt serif': 'transitional',
  'lora': 'transitional',
  'source serif pro': 'transitional',
  'source serif 4': 'transitional',
  'ibm plex serif': 'transitional',
  'noto serif': 'transitional',
  'freight text': 'transitional',
  'gt sectra': 'transitional',
  'newsreader': 'transitional',
  'literata': 'transitional',

  /* ── Screen serif — built for pixels, sturdier than a book face ───────── */
  georgia: 'screen-serif',
  cambria: 'screen-serif',
  constantia: 'screen-serif',
  charter: 'screen-serif',
  'bitstream charter': 'screen-serif',
  utopia: 'screen-serif',
  'droid serif': 'screen-serif',
  merriweather: 'screen-serif',
  'roboto serif': 'screen-serif',
  'zilla slab': 'slab',
  bookerly: 'screen-serif',

  /* ── Didone / high contrast ───────────────────────────────────────────── */
  didot: 'didone',
  bodoni: 'didone',
  'bodoni mt': 'didone',
  'playfair display': 'didone',
  playfair: 'didone',
  'abril fatface': 'didone',
  'prata': 'didone',
  'gt super': 'didone',
  'canela': 'didone',
  'ogg': 'didone',
  'walbaum': 'didone',

  /* ── Slab serif ───────────────────────────────────────────────────────── */
  rockwell: 'slab',
  'roboto slab': 'slab',
  'museo slab': 'slab',
  'bookman old style': 'slab',
  bookman: 'slab',
  clarendon: 'slab',
  'josefin slab': 'slab',
  'arvo': 'slab',
  'bitter': 'slab',
  'alfa slab one': 'slab',
  'courier prime': 'typewriter',

  /* ── Engraved / poster display ────────────────────────────────────────── */
  copperplate: 'engraved',
  'copperplate gothic light': 'engraved',
  trajan: 'engraved',
  'trajan pro': 'engraved',
  cinzel: 'engraved',
  'cinzel decorative': 'engraved',
  'cormorant sc': 'engraved',
  impact: 'poster',
  haettenschweiler: 'poster',
  'arial black': 'poster',
  'bebas neue': 'poster',
  anton: 'poster',
  'druk': 'poster',
  'archivo black': 'poster',
  'passion one': 'poster',
  'ultra': 'poster',

  /* ── Script ───────────────────────────────────────────────────────────── */
  'comic sans ms': 'casual-script',
  'comic sans': 'casual-script',
  'comic neue': 'casual-script',
  'chalkboard se': 'casual-script',
  'marker felt': 'casual-script',
  'patrick hand': 'casual-script',
  caveat: 'casual-script',
  'indie flower': 'casual-script',
  'permanent marker': 'casual-script',
  'segoe script': 'handwriting',
  'bradley hand': 'handwriting',
  'brush script mt': 'handwriting',
  'dancing script': 'handwriting',
  'shadows into light': 'handwriting',
  'kalam': 'handwriting',
  'satisfy': 'handwriting',
  'snell roundhand': 'formal-script',
  'palace script mt': 'formal-script',
  'edwardian script itc': 'formal-script',
  'great vibes': 'formal-script',
  'pinyon script': 'formal-script',
  'parisienne': 'formal-script',
  'tangerine': 'formal-script',
  'zapfino': 'formal-script',
  'apple chancery': 'formal-script',

  /* ── Monospace ────────────────────────────────────────────────────────── */
  consolas: 'code',
  menlo: 'code',
  monaco: 'code',
  'lucida console': 'code',
  'sf mono': 'code',
  'roboto mono': 'code',
  'jetbrains mono': 'code',
  'fira code': 'code',
  'fira mono': 'code',
  'source code pro': 'code',
  'ibm plex mono': 'code',
  'space mono': 'code',
  inconsolata: 'code',
  'dejavu sans mono': 'code',
  'liberation mono': 'code',
  'cascadia code': 'code',
  'cascadia mono': 'code',
  'courier new': 'typewriter',
  courier: 'typewriter',
  'american typewriter': 'typewriter',
  'special elite': 'typewriter',
  'nimbus mono': 'typewriter',
  'prestige elite': 'typewriter',
};

/**
 * The generic family at the end of a stack — the last honest signal.
 *
 * A site declaring `"Söhne Halbfett", sans-serif` tells us nothing we know by
 * name and one thing we do: it is a sans. Falling through to a neutral member of
 * the right shelf beats guessing a character we have no evidence for.
 */
const GENERICS: Record<string, FontCharacter> = {
  serif: 'screen-serif',
  'sans-serif': 'neo-grotesque',
  monospace: 'code',
  cursive: 'handwriting',
  fantasy: 'poster',
  'system-ui': 'ui',
  'ui-serif': 'screen-serif',
  'ui-sans-serif': 'ui',
  'ui-monospace': 'code',
  'ui-rounded': 'rounded',
  '-apple-system': 'ui',
  blinkmacsystemfont: 'ui',
};

export interface FontMatch {
  /** A literal `FONT_STACKS` value, legal for the role asked for. */
  stack: string;
  character: FontCharacter;
  group: FontGroup;
  /** The source family this was decided from, as written on the site. */
  matchedName: string | null;
  /** True when the source names a face our own stack already contains. */
  exact: boolean;
  /** Decided from the generic at the end of the stack rather than from a name. */
  fromGeneric: boolean;
}

/**
 * `"GT Sectra", Georgia, serif` → the family names, in order, lowercased.
 *
 * Deliberately forgiving about what arrives: this string came off somebody
 * else's stylesheet, so it may carry `var(--font-body)`, a CSS-wide keyword, or
 * an unquoted name with stray whitespace. Anything unrecognisable simply does
 * not match and the next name gets its turn.
 */
export function parseFontStack(declaration: string): string[] {
  if (typeof declaration !== 'string') return [];
  return declaration
    .replace(/var\([^)]*\)/gi, ' ')
    .split(',')
    .map(part =>
      part
        .trim()
        .replace(/^['"]|['"]$/g, '')
        .replace(/\s+/g, ' ')
        .toLowerCase()
    )
    .filter(name => name.length > 0 && name.length <= 64)
    .filter(name => !CSS_WIDE.has(name));
}

const CSS_WIDE = new Set(['inherit', 'initial', 'unset', 'revert', 'revert-layer', 'default']);

/**
 * Faces our bank already names, mapped to the stack that names them.
 *
 * **A stack that *leads* with the face wins**, in two passes, and the second
 * pass is not the interesting one. Verdana appears second in the Trebuchet
 * stack and first in its own; taking the first stack that merely contains the
 * name answers "Verdana" with Trebuchet — a different face, offered as though
 * it were the one asked for.
 */
const BANK_FACES: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>();
  for (const stack of FONT_STACKS) {
    const lead = parseFontStack(stack.value)[0];
    if (lead && !GENERICS[lead] && !map.has(lead)) map.set(lead, stack.value);
  }
  for (const stack of FONT_STACKS) {
    for (const name of parseFontStack(stack.value)) {
      if (GENERICS[name]) continue;
      if (!map.has(name)) map.set(name, stack.value);
    }
  }
  return map;
})();

function legalFor(stackValue: string, role: FontRole): boolean {
  return fontStacksFor(role).some(f => f.value === stackValue);
}

/**
 * A source `font-family` → the nearest thing AO3 can be asked for.
 *
 * Walks the source stack left to right and takes the first family it can say
 * something about, because that is the one the site actually wanted; the rest of
 * the stack is *their* fallback chain, not their taste. Returns `null` only when
 * nothing in the string is recognisable at all — in which case the caller should
 * leave the theme's font alone rather than invent one.
 */
export function classifyFont(declaration: string, role: FontRole): FontMatch | null {
  for (const name of parseFontStack(declaration)) {
    const character = FACES[name];
    if (!character) continue;

    // A source naming a face we ourselves list is the best possible outcome:
    // the reader's device may genuinely have it. Prefer that stack over the
    // character's nearest neighbour — but only where the role allows it, so a
    // site setting Impact on its body text still lands somewhere readable.
    const exactStack = BANK_FACES.get(name);
    if (exactStack && legalFor(exactStack, role)) {
      return {
        stack: exactStack,
        character,
        group: CHARACTERS[character].group,
        matchedName: name,
        exact: true,
        fromGeneric: false,
      };
    }

    return {
      stack: CHARACTERS[character][role],
      character,
      group: CHARACTERS[character].group,
      matchedName: name,
      exact: false,
      fromGeneric: false,
    };
  }

  for (const name of parseFontStack(declaration)) {
    const character = GENERICS[name];
    if (!character) continue;
    return {
      stack: CHARACTERS[character][role],
      character,
      group: CHARACTERS[character].group,
      matchedName: null,
      exact: false,
      fromGeneric: true,
    };
  }

  return null;
}

/** `'Futura — geometric'` → `'Futura'`. What the sentence below wants to say. */
export function stackDisplayName(stackValue: string): string {
  const stack = FONT_STACKS.find(f => f.value === stackValue);
  if (!stack) return stackValue.split(',')[0].replace(/['"]/g, '').trim();
  return stack.label.split('—')[0].trim();
}

/**
 * "an interface sans", "a geometric sans".
 *
 * One line, and it exists because the sentence it appears in is the whole point
 * of the feature (§6d step 4). "A interface sans" is the kind of thing that
 * makes a reader trust the rest of the answer less than they should.
 */
function withArticle(label: string): string {
  return `${/^[aeiou]/i.test(label) ? 'an' : 'a'} ${label}`;
}

/** Title Case, so a matched family reads as the name it is. */
function titleCase(name: string): string {
  return name.replace(/\b[a-z]/g, c => c.toUpperCase());
}

/**
 * The sentence that turns a limitation into competence — §6d step 4.
 *
 * *"This site uses a geometric sans. The closest AO3 allows is Futura."* Naming
 * what we did, and why it is not the same font, is the difference between a
 * result that reads as a substitution and one that reads as a failure. Never
 * claim the font was transferred: it cannot be, ever (§2a).
 */
export function describeFontMatch(match: FontMatch): string {
  const ours = stackDisplayName(match.stack);
  if (match.exact) {
    return `This site uses ${titleCase(match.matchedName!)} — AO3 allows it, so readers who have it will see it.`;
  }
  const kind = withArticle(CHARACTERS[match.character].label);
  if (match.fromGeneric) {
    return `This site only asks for ${kind}. The closest AO3 allows is ${ours}.`;
  }
  return `This site uses ${titleCase(match.matchedName!)}, ${kind}. The closest AO3 allows is ${ours}.`;
}

/** Exposed for the test that pins every target to the bank. */
export const CHARACTER_TARGETS = CHARACTERS;
export const KNOWN_FACES = FACES;
