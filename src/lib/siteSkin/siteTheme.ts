/**
 * A website's signals → the two themes the picker offers.
 *
 * Magic Picker Phase C3 (`docs/MAGIC-PICKER-IMPLEMENTATION.md` §6a). The merge
 * step, and it is deliberately thin: the colour maths is Phase B's, the font
 * judgement is C1's, and this file only decides *which* input wins and what to
 * say about it.
 *
 * **`og:image` is the primary signal, not a secondary one** (§6a). A site's
 * social card is a deliberate, designed summary of its look, and it is usually a
 * better answer than its CSS — which is mostly greys, and on a JavaScript-
 * rendered site is mostly absent. When there is no card, the declared colours
 * are the fallback rather than the plan.
 *
 * No I/O here either. Pixels arrive already sampled and the site style arrives
 * already parsed, so every judgement below is testable from two plain values.
 */

import { SiteSkinTheme } from './theme';
import {
  Polarity,
  colorsFromSwatches,
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
  const fromImage = pixels ? quantize(pixels) : [];
  const fromCss = swatchesFromColors(meaningfulColors(style.colors));
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
  'og-image': "These colours come from that site's own social image — the picture it shows when somebody shares a link.",
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
