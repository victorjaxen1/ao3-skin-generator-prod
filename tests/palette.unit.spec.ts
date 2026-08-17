import { test, expect } from '@playwright/test';
import {
  MAGIC_THEME_ID,
  colorsFromSwatches,
  imageCast,
  liftSurface,
  paletteFromPixels,
  pickAccent,
  quantize,
  readBannerBrightness,
  SURFACE_TARGET,
  themeFromPalette,
  withBanner,
  Polarity,
} from '../src/lib/siteSkin/palette';
import { contrastRatio, findReadabilityIssues, luminance } from '../src/lib/siteSkin/colors';
import { compile } from '../src/lib/siteSkin/compile';
import { lintAo3Css } from '../src/lib/siteSkin/ao3Css';
import { validateTheme } from '../src/lib/siteSkin/theme';
import { TEMPLATES, cloneTheme } from '../src/lib/siteSkin/templates';
import { analyticsPayload } from '../src/lib/analytics';

/**
 * The extractor's contract.
 *
 * The load-bearing test in this file is "no extracted theme can carry a
 * readability warning" — see the §5c block below. Everything above it exists to
 * make that one meaningful, and everything below it pins a trap that has already
 * been paid for somewhere in this repository.
 */

type Rgba = [number, number, number, number];

/** Synthetic pixels. Blocks of a colour, in RGBA order, exactly as a canvas gives them. */
function image(blocks: Array<{ rgba: Rgba; count: number }>): Uint8ClampedArray {
  const total = blocks.reduce((n, block) => n + block.count, 0);
  const data = new Uint8ClampedArray(total * 4);
  let i = 0;
  for (const block of blocks) {
    for (let n = 0; n < block.count; n++) {
      data[i++] = block.rgba[0];
      data[i++] = block.rgba[1];
      data[i++] = block.rgba[2];
      data[i++] = block.rgba[3];
    }
  }
  return data;
}

const flat = (rgba: Rgba, count = 400) => image([{ rgba, count }]);

/** Deterministic pseudo-random, so a failure is reproducible from its seed. */
function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function randomImage(seed: number): Uint8ClampedArray {
  const next = lcg(seed);
  // Five blocks rather than pure noise: real images have a few dominant
  // colours, and pure noise quantizes to a single grey that tests nothing.
  const blocks: Array<{ rgba: Rgba; count: number }> = [];
  for (let i = 0; i < 5; i++) {
    blocks.push({
      rgba: [
        Math.floor(next() * 256),
        Math.floor(next() * 256),
        Math.floor(next() * 256),
        255,
      ],
      count: 20 + Math.floor(next() * 400),
    });
  }
  return image(blocks);
}

const FIXTURES: Array<{ name: string; pixels: Uint8ClampedArray }> = [
  { name: 'pure white', pixels: flat([255, 255, 255, 255]) },
  { name: 'pure black', pixels: flat([0, 0, 0, 255]) },
  // The adversarial one: at this luminance neither white nor near-black clears
  // 4.5:1, so it is the input the §5c repair loop exists for.
  { name: 'mid grey wall', pixels: flat([128, 128, 128, 255]) },
  { name: 'mid brown wall', pixels: flat([120, 96, 74, 255]) },
  { name: 'saturated red wall', pixels: flat([200, 20, 30, 255]) },
  { name: 'fully transparent', pixels: flat([255, 255, 255, 0]) },
  {
    name: 'fan art with transparent margin',
    pixels: image([
      { rgba: [255, 255, 255, 0], count: 900 },
      { rgba: [46, 28, 74, 255], count: 200 },
      { rgba: [214, 96, 132, 255], count: 90 },
    ]),
  },
  {
    name: 'two-colour poster',
    pixels: image([
      { rgba: [12, 18, 40, 255], count: 700 },
      { rgba: [240, 196, 62, 255], count: 300 },
    ]),
  },
  {
    name: 'muddy photograph',
    pixels: image([
      { rgba: [86, 78, 66, 255], count: 400 },
      { rgba: [104, 92, 78, 255], count: 300 },
      { rgba: [70, 66, 58, 255], count: 250 },
      { rgba: [128, 110, 86, 255], count: 120 },
    ]),
  },
  {
    name: 'near-white page with one accent',
    pixels: image([
      { rgba: [250, 249, 246, 255], count: 900 },
      { rgba: [38, 38, 40, 255], count: 120 },
      { rgba: [12, 120, 220, 255], count: 60 },
    ]),
  },
];

for (let seed = 1; seed <= 200; seed++) {
  FIXTURES.push({ name: `pseudo-random #${seed}`, pixels: randomImage(seed) });
}

const POLARITIES: Polarity[] = ['light', 'dark'];

// ── The quantizer ─────────────────────────────────────────────────────────

test.describe('quantize', () => {
  /**
   * The alpha floor, and it is load-bearing rather than tidiness. Fan art PNGs
   * carry transparent margins; a canvas reports those as transparent white or
   * transparent black depending on the encoder, so without the floor they
   * quantize as one enormous neutral cluster and every theme comes out cream.
   */
  test('near-transparent pixels are not colours', () => {
    const swatches = quantize(
      image([
        { rgba: [255, 255, 255, 0], count: 900 },
        { rgba: [46, 28, 74, 255], count: 100 },
      ])
    );
    expect(swatches).toHaveLength(1);
    expect(swatches[0].weight).toBeCloseTo(1, 5);
    expect(swatches[0].hex).toBe('#2e1c4a');
  });

  test('a fully transparent image yields nothing rather than white', () => {
    expect(quantize(flat([255, 255, 255, 0]))).toEqual([]);
  });

  test('near-identical colours merge into one swatch', () => {
    // Three bins a human reads as one navy. Without the merge pass the
    // "dominant" colour is an arbitrary third of it and every weight is small
    // enough to fail the deliberateness floor.
    const swatches = quantize(
      image([
        { rgba: [16, 23, 37, 255], count: 200 },
        { rgba: [20, 28, 42, 255], count: 200 },
        { rgba: [24, 34, 56, 255], count: 200 },
      ])
    );
    expect(swatches).toHaveLength(1);
    expect(swatches[0].weight).toBeCloseTo(1, 5);
  });

  test('distinct colours stay distinct, most populous first', () => {
    const swatches = quantize(
      image([
        { rgba: [240, 196, 62, 255], count: 300 },
        { rgba: [12, 18, 40, 255], count: 700 },
      ])
    );
    expect(swatches).toHaveLength(2);
    expect(swatches[0].weight).toBeGreaterThan(swatches[1].weight);
    expect(swatches[0].lightness).toBeLessThan(swatches[1].lightness);
  });

  test('chroma separates a colour from a grey', () => {
    const [grey] = quantize(flat([128, 128, 128, 255]));
    const [red] = quantize(flat([200, 20, 30, 255]));
    expect(grey.chroma).toBe(0);
    expect(red.chroma).toBeGreaterThan(0.5);
  });
});

// ── The mapping ───────────────────────────────────────────────────────────

test.describe('pickAccent', () => {
  test('prefers the saturated minority over the dominant neutral', () => {
    const swatches = quantize(
      image([
        { rgba: [246, 245, 242, 255], count: 800 },
        { rgba: [40, 40, 42, 255], count: 150 },
        { rgba: [12, 120, 220, 255], count: 50 },
      ])
    );
    expect(pickAccent(swatches)).toBe('#0c78dc');
  });

  test('ignores a speck too small to be a decision', () => {
    // Half a percent of the image: a JPEG artefact or one stray pixel, not a
    // colour anybody chose. The 2% floor is what keeps it out.
    const swatches = quantize(
      image([
        { rgba: [90, 60, 140, 255], count: 995 },
        { rgba: [0, 255, 0, 255], count: 5 },
      ])
    );
    expect(pickAccent(swatches)).toBe('#5a3c8c');
  });

  test('a monochrome image gets a monochrome accent rather than an invention', () => {
    expect(pickAccent(quantize(flat([128, 128, 128, 255])))).toBe('#808080');
  });

  test('survives an empty swatch list', () => {
    expect(pickAccent([])).toMatch(/^#[0-9a-f]{6}$/);
    expect(imageCast([])).toMatch(/^#[0-9a-f]{6}$/);
  });
});

test.describe('liftSurface', () => {
  test('a card always separates from its page', () => {
    for (const background of ['#ffffff', '#000000', '#101725', '#f4efe5', '#808080', '#39312c']) {
      const surface = liftSurface(background);
      expect(contrastRatio(surface, background), background).toBeGreaterThanOrEqual(1.1);
    }
  });

  /**
   * §5f.2, pinned. The first draft derived the surface from the *text* colour,
   * which inverts it on light themes — light text is dark, so "background mixed
   * toward text" is a darker card. Every shipped template has a surface lighter
   * than its background, in both polarities, because a card is raised.
   */
  test('the card is lighter than the page, in both polarities — as all sixteen templates are', () => {
    for (const template of TEMPLATES) {
      expect(
        luminance(template.colors.surface),
        `${template.meta.name} is the catalog evidence for this rule`
      ).toBeGreaterThan(luminance(template.colors.background));
    }
    for (const fixture of FIXTURES) {
      for (const polarity of POLARITIES) {
        const colors = colorsFromSwatches(quantize(fixture.pixels), polarity);
        const where = `${fixture.name} / ${polarity}`;

        // The exception is a ceiling, not a bug, and it is stated exactly
        // rather than as a magic threshold: once the page is light enough that
        // even *pure white* cannot clear the separation target, no lighter card
        // exists. Those separate downward instead, and must still separate.
        if (contrastRatio('#ffffff', colors.background) >= SURFACE_TARGET) {
          expect(luminance(colors.surface), where).toBeGreaterThan(luminance(colors.background));
        } else {
          expect(luminance(colors.surface), where).toBeLessThan(luminance(colors.background));
        }
        expect(contrastRatio(colors.surface, colors.background), where).toBeGreaterThanOrEqual(1.1);
      }
    }
  });

  test('a page already at the pole separates the other way rather than vanishing', () => {
    expect(luminance(liftSurface('#ffffff'))).toBeLessThan(luminance('#ffffff'));

    // The end-to-end version: a pure white image still produces a visible card.
    const white = colorsFromSwatches(quantize(flat([255, 255, 255, 255])), 'light');
    expect(white.background).toBe('#ffffff');
    expect(luminance(white.surface)).toBeLessThan(luminance(white.background));
    expect(contrastRatio(white.surface, white.background)).toBeGreaterThanOrEqual(1.1);
  });
});

// ── The floor, which is the whole point ───────────────────────────────────

test.describe('the contrast floor (§5c)', () => {
  /**
   * **The required test.** An extraction path that can produce a warning the
   * templates cannot is a path that makes the product worse for the users most
   * likely to use it. 210 fixtures × 2 polarities.
   */
  test('no extracted theme can carry a readability warning', () => {
    for (const fixture of FIXTURES) {
      for (const polarity of POLARITIES) {
        const colors = colorsFromSwatches(quantize(fixture.pixels), polarity);
        expect(
          findReadabilityIssues(colors),
          `${fixture.name} / ${polarity} → ${JSON.stringify(colors)}`
        ).toEqual([]);
      }
    }
  });

  test('every emitted colour is a literal 6-digit lowercase hex', () => {
    // AO3 has no color-mix(), so anything derived must already be resolved by
    // the time the compiler sees it — and validateTheme drops anything else.
    for (const fixture of FIXTURES) {
      for (const polarity of POLARITIES) {
        const colors = colorsFromSwatches(quantize(fixture.pixels), polarity);
        for (const value of Object.values(colors)) {
          expect(value, `${fixture.name} / ${polarity}`).toMatch(/^#[0-9a-f]{6}$/);
        }
      }
    }
  });

  test('the two polarities really are two', () => {
    for (const fixture of FIXTURES) {
      const { light, dark } = paletteFromPixels(fixture.pixels);
      expect(
        luminance(light.colors.background),
        fixture.name
      ).toBeGreaterThan(luminance(dark.colors.background));
    }
  });
});

// ── The invariant in §8: the output is a theme and nothing else ───────────

test.describe('an extracted theme is an ordinary theme', () => {
  test('every extraction compiles to CSS AO3 accepts', () => {
    for (const fixture of FIXTURES) {
      const { light, dark } = paletteFromPixels(fixture.pixels);
      for (const theme of [light, dark]) {
        expect(lintAo3Css(compile(theme)), fixture.name).toEqual([]);
      }
    }
  });

  test('and one with a banner does too', () => {
    const { light } = paletteFromPixels(FIXTURES[0].pixels);
    const banner = withBanner(light, 'https://i.imgur.com/example.png', {
      textColor: 'dark',
      textShadow: true,
      meanLuminance: 0.6,
      spread: 0.3,
    });
    expect(lintAo3Css(compile(banner))).toEqual([]);
    expect(compile(banner)).toContain('https://i.imgur.com/example.png');
  });

  test('it survives the storage boundary unchanged', () => {
    const fallback = cloneTheme(TEMPLATES[0]);
    for (const polarity of POLARITIES) {
      const theme = paletteFromPixels(FIXTURES[7].pixels)[polarity];
      const round = validateTheme(JSON.parse(JSON.stringify(theme)), fallback);
      expect(round, polarity).toEqual(theme);
    }
  });

  test('its mood follows its polarity, so it never claims what it contradicts', () => {
    const { light, dark } = paletteFromPixels(FIXTURES[7].pixels);
    expect(light.meta.category).toBe('light');
    expect(light.meta.moods).toEqual(['light']);
    expect(dark.meta.category).toBe('dark');
    expect(dark.meta.moods).toEqual(['dark']);
  });
});

// ── The traps ─────────────────────────────────────────────────────────────

test.describe('the id, and the boundary that would have eaten it', () => {
  test('every extraction carries the same id, so activation does not fragment', () => {
    const first = paletteFromPixels(FIXTURES[1].pixels).light;
    const second = paletteFromPixels(FIXTURES[7].pixels).dark;
    expect(first.meta.id).toBe(MAGIC_THEME_ID);
    expect(second.meta.id).toBe(MAGIC_THEME_ID);
  });

  /**
   * §5f.4, and it is the correction most likely to come back.
   *
   * `analyticsPayload` rejects the **whole event** on an id outside its
   * allowlist. Without `from-image` in `TEMPLATE_IDS`, a theme built from a
   * picture records no template_selected, no project_activated and no export
   * funnel at all — silently, in production, exactly as five examples did for
   * two days (see the comment on that list).
   *
   * The catalog drift test in `analytics.unit.spec.ts` cannot catch this: it
   * iterates `SITE_SKIN_TEMPLATES`, and a generated theme is deliberately not a
   * template. So the guard lives here, beside the id it protects.
   */
  test('the generated id survives the analytics boundary', () => {
    const funnel = [
      { name: 'template_selected', templateId: MAGIC_THEME_ID },
      { name: 'project_activated', templateId: MAGIC_THEME_ID },
      { name: 'export_started', outputType: 'site_skin', templateId: MAGIC_THEME_ID },
      { name: 'export_ready', outputType: 'site_skin', templateId: MAGIC_THEME_ID },
      { name: 'handoff_completed', outputType: 'site_skin', templateId: MAGIC_THEME_ID },
    ] as const;
    for (const event of funnel) {
      expect(
        analyticsPayload(event as never),
        `${event.name} would record nothing — add ${MAGIC_THEME_ID} to TEMPLATE_IDS`
      ).not.toBeNull();
    }
  });

  test('palette_applied is accepted, and carries nothing about the picture', () => {
    const payload = analyticsPayload({
      name: 'palette_applied',
      source: 'image',
      polarity: 'dark',
      placement: 'gallery',
    });
    expect(payload).toEqual({ source: 'image', polarity: 'dark', placement: 'gallery' });
    expect(
      analyticsPayload({ name: 'palette_applied', source: 'ftp', polarity: 'dark', placement: 'gallery' } as never)
    ).toBeNull();
  });
});

// ── The banner reading ────────────────────────────────────────────────────

test.describe('readBannerBrightness', () => {
  test('a dark picture asks for light text, and a light one for dark', () => {
    expect(readBannerBrightness(flat([10, 12, 20, 255])).textColor).toBe('light');
    expect(readBannerBrightness(flat([245, 240, 232, 255])).textColor).toBe('dark');
  });

  test('a flat image needs no glow; a busy one does', () => {
    expect(readBannerBrightness(flat([120, 120, 120, 255])).textShadow).toBe(false);
    expect(
      readBannerBrightness(
        image([
          { rgba: [255, 255, 255, 255], count: 200 },
          { rgba: [0, 0, 0, 255], count: 200 },
        ])
      ).textShadow
    ).toBe(true);
  });

  test('transparent margins do not drag the measurement toward white', () => {
    const withMargin = readBannerBrightness(
      image([
        { rgba: [255, 255, 255, 0], count: 900 },
        { rgba: [10, 12, 20, 255], count: 100 },
      ])
    );
    expect(withMargin.textColor).toBe('light');
    expect(withMargin.meanLuminance).toBeLessThan(0.02);
  });

  test('withBanner sets the header up for a picture rather than for a colour', () => {
    const base = themeFromPalette(
      colorsFromSwatches(quantize(flat([20, 30, 60, 255])), 'dark'),
      'dark'
    );
    expect(base.header.bannerUrl).toBe('');
    const banner = withBanner(base, 'https://i.imgur.com/x.png', {
      textColor: 'light',
      textShadow: true,
      meanLuminance: 0.05,
      spread: 0.4,
    });
    expect(banner.header).toMatchObject({
      bannerUrl: 'https://i.imgur.com/x.png',
      hideLogo: true,
      textColor: 'light',
      textShadow: true,
    });
    // The picture is the only thing that changed.
    expect(banner.colors).toEqual(base.colors);
  });
});
