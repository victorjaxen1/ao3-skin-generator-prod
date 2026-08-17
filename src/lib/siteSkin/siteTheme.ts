/**
 * A website's signals → the two themes the picker offers.
 *
 * Magic Picker Phase C3 (`docs/MAGIC-PICKER-IMPLEMENTATION.md` §6a). The merge
 * step, and it is deliberately thin: the colour maths is Phase B's, the font
 * judgement is C1's, and this file only decides *which* input wins and what to
 * say about it.
 *
 * **The stylesheet wins when it has a hue to offer; the card is what rescues a
 * page that does not** (§14). This is the reverse of the plan's §6a, and it was
 * measured rather than argued: over twenty real sites, quantizing the social
 * card returned a muddy neutral — `#838080` for Notion, `#7b8386` for Apple,
 * `#725964` for Goodreads — while the stylesheet returned the brand colour those
 * companies actually publish. The reason is structural. A card is a photograph
 * or a screenshot with a logo on it, so its *dominant* colours are the
 * photograph; a `--brand` custom property is a designer naming the answer.
 *
 * §6a's real case survives as the fallback, and it is the one it was written
 * for: a JavaScript-rendered page whose HTML is an empty `<div id="root">`
 * declares no colour at all, and there the card is the only signal there is.
 *
 * No I/O here either. Pixels arrive already sampled and the site style arrives
 * already parsed, so every judgement below is testable from two plain values.
 */

import { SiteSkinTheme } from './theme';
import {
  Polarity,
  Swatch,
  chromaOf,
  colorsFromSwatches,
  pickAccent,
  quantize,
  swatchesFromColors,
  themeFromPalette,
} from './palette';
import { SiteStyle, meaningfulColors, snapRadius } from './siteStyle';
import { classifyFont, describeFontMatch } from './fontClassify';

/** Which input the colours actually came from. Shown to the user, and honest. */
export type ColorSource = 'og-image' | 'stylesheet' | 'theme-color';

/**
 * A "what we did" line, tagged by what it is about.
 *
 * Tagged rather than plain, because the two entry points apply different halves
 * of the theme: the gallery adopts the whole thing, the editor takes the colours
 * and deliberately leaves the user's fonts alone (§5e). Explaining a font
 * substitution that is not going to happen is worse than saying nothing — so the
 * caller filters on `kind`, and does not have to match on the sentence.
 */
export interface SiteNote {
  kind: 'source' | 'polarity' | 'font';
  text: string;
}

export interface SiteExtraction {
  themes: Record<Polarity, SiteSkinTheme>;
  source: ColorSource;
  /** The site's own polarity, when it declared one. §6e. */
  sitePolarity: Polarity | null;
  /** The "what we did" lines, in the order they should be read. */
  notes: SiteNote[];
}

export const SITE_THEME_NAME = 'From that website';

/** `https://www.example.com/blog/x` → `example.com`. For a name, not a decision. */
export function siteLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'that site';
  }
}

/**
 * Below this, the colour the accent picker would choose is a grey.
 *
 * `chromaOf` is `(max − min) / 255`, so this is a low bar cleared by anything a
 * person would call a colour: Firefox blue `#0060df` reads 0.87, AO3's own
 * `#990000` reads 0.6, and a muted clay `#6b5b4a` still reads 0.13. The greys
 * the twenty-site probe caught cards producing — `#838080`, `#7b8386` — read
 * 0.01 and 0.04. There is a wide empty gap between the two populations, which
 * is why a single threshold can stand here without being fussy.
 */
const DECLARED_HUE = 0.12;

/**
 * Did this stylesheet name a colour, or only shades of paper and ink?
 *
 * Asked of the accent the mapping *would* pick rather than of the swatch list,
 * because that is the only colour the decision changes. A page of greys with one
 * red button passes; a page of greys does not.
 */
function declaresHue(swatches: readonly Swatch[]): boolean {
  return swatches.length > 0 && chromaOf(pickAccent(swatches)) >= DECLARED_HUE;
}

/**
 * Everything a page gave us → two themes and the sentences that explain them.
 *
 * `pixels` is the social card, already sampled; pass `null` when there was no
 * card or it could not be read. The fallback chain runs all the way down: a
 * page that yields nothing at all still returns two themes, because
 * `colorsFromSwatches` has a defined answer for an empty swatch list and a
 * neutral theme the user can edit beats an error they cannot.
 */
export function themesFromSite(
  style: SiteStyle,
  pixels: ArrayLike<number> | null,
  pageUrl: string
): SiteExtraction {
  const fromCss = swatchesFromColors(meaningfulColors(style.colors));
  const fromImage = declaresHue(fromCss) || !pixels ? [] : quantize(pixels);
  const swatches = fromImage.length > 0 ? fromImage : fromCss;

  const source: ColorSource =
    fromImage.length > 0
      ? 'og-image'
      : style.colors.length === 1 && style.themeColor
        ? 'theme-color'
        : 'stylesheet';

  // A site that sets only a body font is telling us about its whole page, so it
  // answers for the heading too — in the heading *role*, which is what keeps a
  // display face legal where the bank says it is not.
  const headingMatch = classifyFont(style.headingFont || style.bodyFont || '', 'heading');
  const bodyMatch = classifyFont(style.bodyFont || style.headingFont || '', 'body');
  const radius = snapRadius(style.radius);

  // The name changes and **the id does not**: `MAGIC_THEME_ID` is the one value
  // `analytics.ts` allows for a generated theme, and an unknown id there does
  // not degrade the event — it rejects the whole thing (§5f.4). A website theme
  // and a picture theme therefore share an id and are told apart by
  // `palette_applied`'s `source`, which is what §10's open question needs.
  const dress = (theme: SiteSkinTheme): SiteSkinTheme => ({
    ...theme,
    meta: { ...theme.meta, name: SITE_THEME_NAME },
    typography: {
      ...theme.typography,
      headingFont: headingMatch ? headingMatch.stack : theme.typography.headingFont,
      bodyFont: bodyMatch ? bodyMatch.stack : theme.typography.bodyFont,
    },
    shape: { ...theme.shape, cardRadius: radius ?? theme.shape.cardRadius },
  });

  const themes = {
    light: dress(themeFromPalette(colorsFromSwatches(swatches, 'light'), 'light')),
    dark: dress(themeFromPalette(colorsFromSwatches(swatches, 'dark'), 'dark')),
  };

  return { themes, source, sitePolarity: style.polarity, notes: buildNotes(style, source, pageUrl) };
}

const SOURCE_NOTES: Record<ColorSource, string> = {
  // Only reachable when the stylesheet had no hue in it, so the sentence says
  // that: it explains why we went looking somewhere else, and it is the truth
  // about the page rather than a boast about the method.
  'og-image': "That page declares almost no colour of its own, so these come from its social image — the picture it shows when somebody shares a link.",
  stylesheet: 'These colours come from that site’s stylesheet.',
  'theme-color': 'That page renders itself in JavaScript, so the only colour it declares up front is its browser theme colour. Everything else here is built around it.',
};

/**
 * What we did, in sentences a reader can check.
 *
 * §6d step 4: naming the limitation is what turns a substitution into competence
 * rather than a failure. The font line is the one that earns its place — nobody
 * guesses that AO3 cannot load a font, so a silent swap reads as us getting it
 * wrong. The polarity line is C's own move (§6e): saying *which way round the
 * site is* turns two cards from a guess into a choice.
 */
function buildNotes(style: SiteStyle, source: ColorSource, pageUrl: string): SiteNote[] {
  const notes: SiteNote[] = [{ kind: 'source', text: SOURCE_NOTES[source] }];

  if (style.polarity) {
    notes.push({
      kind: 'polarity',
      text: `${siteLabel(pageUrl)} is a ${style.polarity} site. Here it is both ways — pick the one you would rather read.`,
    });
  }

  const heading = style.headingFont ? classifyFont(style.headingFont, 'heading') : null;
  const body = style.bodyFont ? classifyFont(style.bodyFont, 'body') : null;
  const fontNotes = [heading, body]
    .filter((match): match is NonNullable<typeof match> => match !== null)
    .map(describeFontMatch);

  let added = 0;
  for (const text of fontNotes) {
    if (notes.some(note => note.text === text)) continue;
    notes.push({ kind: 'font', text });
    added += 1;
  }

  if (added > 0) {
    // The reason, once, after the specifics. Without it the previous line reads
    // as a shrug; with it, it reads as a constraint we know the shape of.
    notes.push({
      kind: 'font',
      text: 'AO3 cannot load a font file, so a skin can only ask for faces a reader already has.',
    });
  }

  return notes;
}
