import { test, expect } from '@playwright/test';
import {
  collectSiteStyle,
  meaningfulColors,
  parseCssColor,
  readCssRules,
  readMeta,
  readStylesheetLinks,
  snapRadius,
} from '../src/lib/siteSkin/siteStyle';
import { fetchSiteStyle, fetchValidatedText } from '../src/lib/server/siteFetch';
import { classifyFont } from '../src/lib/siteSkin/fontClassify';
import {
  MAGIC_THEME_ID,
  colorsFromSwatches,
  swatchesFromColors,
  themeFromPalette,
  POLARITIES,
} from '../src/lib/siteSkin/palette';
import { themesFromSite, siteLabel } from '../src/lib/siteSkin/siteTheme';
import { EMPTY_SITE_STYLE } from '../src/lib/siteSkin/siteStyle';
import { analyticsPayload } from '../src/lib/analytics';
import { findReadabilityIssues } from '../src/lib/siteSkin/colors';
import { compile } from '../src/lib/siteSkin/compile';
import { lintAo3Css } from '../src/lib/siteSkin/ao3Css';
import { validateTheme } from '../src/lib/siteSkin/theme';
import { TEMPLATES, cloneTheme } from '../src/lib/siteSkin/templates';

/**
 * Phase C's contract, in two halves.
 *
 * The parsing half is ordinary: strings in, values out. The half that matters is
 * the network boundary — this is the first endpoint in the product that fetches
 * something other than an image from an address a stranger typed, and the tests
 * below are the ones that would notice if somebody "simplified" the manual
 * redirect loop into `redirect: 'follow'`.
 *
 * And at the bottom, the invariant §8 exists for: whatever a website turns out
 * to contain, the thing produced is a `SiteSkinTheme` that compiles to CSS the
 * lint passes and storage keeps.
 */

const publicDns = async () => [{ address: '93.184.216.34' }];

function textResponse(body: string, type = 'text/html', status = 200, headers: Record<string, string> = {}) {
  return new Response(body, { status, headers: { 'content-type': type, ...headers } });
}

/* ── Colour values ────────────────────────────────────────────────────────── */

test.describe('CSS colour values', () => {
  test('the forms a real stylesheet uses', () => {
    expect(parseCssColor('#fff')).toBe('#ffffff');
    expect(parseCssColor('#1A2B3C')).toBe('#1a2b3c');
    expect(parseCssColor('rgb(255, 0, 0)')).toBe('#ff0000');
    expect(parseCssColor('rgba(0, 0, 255, 0.9)')).toBe('#0000ff');
    expect(parseCssColor('rgb(0 128 0 / 100%)')).toBe('#008000');
    expect(parseCssColor('hsl(210, 100%, 50%)')).toBe('#0080ff');
    expect(parseCssColor('white')).toBe('#ffffff');
  });

  test('a mostly transparent colour is discarded, not flattened', () => {
    // The trap: `rgba(0,0,0,.06)` is a shadow tint. Read as opaque it makes
    // black the most popular colour on a white page, and the accent follows it.
    expect(parseCssColor('rgba(0, 0, 0, 0.06)')).toBeNull();
    expect(parseCssColor('#00000010')).toBeNull();
    expect(parseCssColor('transparent')).toBeNull();
    expect(parseCssColor('currentColor')).toBeNull();
  });

  test('nonsense is null rather than a guess', () => {
    expect(parseCssColor('var(--brand)')).toBeNull();
    expect(parseCssColor('linear-gradient(red, blue)')).toBeNull();
    expect(parseCssColor('')).toBeNull();
  });
});

/* ── CSS structure ────────────────────────────────────────────────────────── */

test.describe('reading rules', () => {
  test('a media query costs nothing — the inner rule is found, the wrapper is not', () => {
    const rules = readCssRules('@media (min-width: 40em) { .a { color: red } } .b { color: blue }');
    expect(rules.map(r => r.selector)).toEqual(['.a', '.b']);
  });

  test('a nested at-rule keeps the rules around it straight', () => {
    const rules = readCssRules('.a{color:red}@media screen{.b{color:blue}}.c{color:green}');
    expect(rules.map(r => r.selector)).toEqual(['.a', '.b', '.c']);
    expect(rules[2].declarations).toContain('green');
  });

  test('a megabyte with no braces in it returns instantly', () => {
    // Not a style question — a denial of service. The regex version of this
    // function backtracked quadratically here and took over two minutes on a
    // fifth of this input, on a body fetched from an address a stranger typed.
    const started = Date.now();
    expect(readCssRules('a'.repeat(1_000_000))).toEqual([]);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  test('unbalanced braces terminate rather than loop', () => {
    expect(readCssRules('.a{color:red')).toEqual([]);
    expect(readCssRules('}}}.a{color:red}').map(r => r.selector)).toEqual(['.a']);
    expect(readCssRules('{'.repeat(5000))).toEqual([]);
  });

  test('comments are removed before anything else', () => {
    expect(readCssRules('/* .fake { color: red } */ .real { color: blue }').map(r => r.selector))
      .toEqual(['.real']);
  });
});

test.describe('what a page yields', () => {
  const html = `
    <html><head>
      <title>Example &amp; Co</title>
      <meta name="theme-color" content="#2b5797">
      <meta property="og:image" content="/social/card.png">
      <link rel="preload" href="/x.css">
      <link rel="stylesheet" href="/style.css">
      <link rel="stylesheet" href="https://cdn.example.com/theme.css">
      <style>
        :root { --brand: #7b2d8e; }
        body { background: #f7f4ef; color: #221f1c; font-family: "Source Serif Pro", Georgia, serif }
        h1, h2 { font-family: Poppins, sans-serif }
        .card { border-radius: 12px; background-color: #ffffff }
        .btn { border-radius: 12px }
      </style>
    </head><body></body></html>`;

  const style = collectSiteStyle(html);

  test('the meta tags that survive client-side rendering', () => {
    expect(style.themeColor).toBe('#2b5797');
    expect(style.ogImage).toBe('/social/card.png');
    expect(style.title).toBe('Example & Co');
  });

  test('only rel=stylesheet links, resolved absolute', () => {
    expect(readStylesheetLinks(html, 'https://example.com/page')).toEqual([
      'https://example.com/style.css',
      'https://cdn.example.com/theme.css',
    ]);
  });

  test('the page background outranks a design token', () => {
    const background = style.colors.find(c => c.hex === '#f7f4ef')!;
    const token = style.colors.find(c => c.hex === '#7b2d8e')!;
    expect(background.weight).toBeGreaterThan(token.weight);
  });

  test('the site\'s own polarity is read, not guessed — §6e', () => {
    expect(style.polarity).toBe('light');
    expect(collectSiteStyle('<style>body{background:#111318}</style>').polarity).toBe('dark');
  });

  test('heading and body fonts come off the selectors that mean them', () => {
    expect(classifyFont(style.headingFont!, 'heading')!.character).toBe('geometric');
    expect(classifyFont(style.bodyFont!, 'body')!.character).toBe('transitional');
  });

  test('the radius is the commonest one on a card, snapped to what AO3 offers', () => {
    expect(style.radius).toBe(12);
    expect(snapRadius(style.radius)).toBe('10px');
    expect(snapRadius(0)).toBe('0px');
    expect(snapRadius(40)).toBe('18px');
    expect(snapRadius(null)).toBeNull();
  });

  test('an empty React shell still yields its meta tags — the expected case, not a failure', () => {
    const spa = collectSiteStyle(
      '<html><head><meta name="theme-color" content="#0f766e"><meta property="og:image" content="https://x.test/c.png"></head><body><div id="root"></div></body></html>'
    );
    expect(spa.colors.map(c => c.hex)).toEqual(['#0f766e']);
    expect(spa.ogImage).toBe('https://x.test/c.png');
    expect(spa.headingFont).toBeNull();
  });

  test('twitter:image stands in when there is no og:image', () => {
    expect(readMeta('<meta name="twitter:image" content="https://x.test/t.png">').ogImage)
      .toBe('https://x.test/t.png');
  });

  test('near-white and near-black are dropped only when something else survives', () => {
    const mono = [{ hex: '#ffffff', weight: 5 }, { hex: '#000000', weight: 3 }];
    expect(meaningfulColors(mono)).toHaveLength(2);
    expect(meaningfulColors([...mono, { hex: '#7b2d8e', weight: 2 }, { hex: '#2b5797', weight: 1 }]))
      .toHaveLength(2);
  });
});

/* ── The network boundary — §6b ───────────────────────────────────────────── */

test.describe('the fetcher refuses what it must', () => {
  test('a redirect to link-local is caught, because each hop is re-validated', async () => {
    const fetchImpl = (async (input: any) => {
      const url = String(input);
      if (url.includes('example.com')) {
        return new Response(null, { status: 302, headers: { location: 'https://169.254.169.254/latest/meta-data/' } });
      }
      return textResponse('<html>secrets</html>');
    }) as unknown as typeof fetch;

    await expect(
      fetchValidatedText('https://example.com/', {
        kind: 'html',
        maxBytes: 1000,
        fetchImpl,
        resolver: async hostname => [{ address: hostname === 'example.com' ? '93.184.216.34' : '169.254.169.254' }],
      })
    ).rejects.toMatchObject({ code: 'PRIVATE_ADDRESS' });
  });

  test('http:// is refused before any request is made', async () => {
    let called = false;
    const fetchImpl = (async () => { called = true; return textResponse('<html></html>'); }) as unknown as typeof fetch;
    await expect(
      fetchValidatedText('http://example.com/', { kind: 'html', maxBytes: 1000, fetchImpl, resolver: publicDns })
    ).rejects.toMatchObject({ code: 'HTTPS_REQUIRED' });
    expect(called).toBe(false);
  });

  test('a page that is not a page is refused by content-type', async () => {
    const fetchImpl = (async () => textResponse('MZ binary', 'application/octet-stream')) as unknown as typeof fetch;
    await expect(
      fetchValidatedText('https://example.com/', { kind: 'html', maxBytes: 1000, fetchImpl, resolver: publicDns })
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_TYPE' });
  });

  test('a stylesheet must be text/css — an HTML error page is not one', async () => {
    const fetchImpl = (async () => textResponse('<html>404</html>', 'text/html')) as unknown as typeof fetch;
    await expect(
      fetchValidatedText('https://cdn.example.com/a.css', { kind: 'css', maxBytes: 1000, fetchImpl, resolver: publicDns })
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_TYPE' });
  });

  test('an oversized page is cut off rather than read', async () => {
    const fetchImpl = (async () =>
      textResponse('x'.repeat(5000), 'text/html', 200, { 'content-length': '5000' })) as unknown as typeof fetch;
    await expect(
      fetchValidatedText('https://example.com/', { kind: 'html', maxBytes: 1000, fetchImpl, resolver: publicDns })
    ).rejects.toMatchObject({ code: 'TOO_LARGE' });
  });

  test('a redirect chain terminates', async () => {
    const fetchImpl = (async () =>
      new Response(null, { status: 302, headers: { location: 'https://example.com/next' } })) as unknown as typeof fetch;
    await expect(
      fetchValidatedText('https://example.com/', {
        kind: 'html', maxBytes: 1000, maxRedirects: 2, fetchImpl, resolver: publicDns,
      })
    ).rejects.toMatchObject({ code: 'TOO_MANY_REDIRECTS' });
  });
});

test.describe('fetchSiteStyle', () => {
  const page = `<html><head>
      <meta property="og:image" content="/card.png">
      <link rel="stylesheet" href="/a.css">
      <link rel="stylesheet" href="/dead.css">
    </head><body></body></html>`;

  const serve = (async (input: any) => {
    const url = String(input);
    if (url.endsWith('/a.css')) return textResponse('body{background:#101014;color:#eee}', 'text/css');
    if (url.endsWith('/dead.css')) return textResponse('nope', 'text/plain', 404);
    return textResponse(page);
  }) as unknown as typeof fetch;

  test('an unreadable stylesheet is a smaller result, not a failure', async () => {
    const result = await fetchSiteStyle('https://example.com/', { fetchImpl: serve, resolver: publicDns });
    expect(result.stylesheetsRead).toBe(1);
    expect(result.style.polarity).toBe('dark');
  });

  test('og:image comes back absolute — it is what Phase B is handed', async () => {
    const result = await fetchSiteStyle('https://example.com/', { fetchImpl: serve, resolver: publicDns });
    expect(result.style.ogImage).toBe('https://example.com/card.png');
  });
});

/* ── §8: the output is a theme, and nothing else changes ──────────────────── */

test.describe('a website becomes a theme that the rest of the product already handles', () => {
  const sites: Array<[string, Array<{ hex: string; weight: number }>]> = [
    ['a near-white blog', [{ hex: '#ffffff', weight: 8 }, { hex: '#1a1a1a', weight: 3 }, { hex: '#c2410c', weight: 1 }]],
    ['a dark product page', [{ hex: '#0b1120', weight: 9 }, { hex: '#38bdf8', weight: 2 }, { hex: '#e2e8f0', weight: 3 }]],
    ['a mid-tone brand', [{ hex: '#6b7280', weight: 6 }, { hex: '#9ca3af', weight: 4 }, { hex: '#4b5563', weight: 3 }]],
    ['one colour only', [{ hex: '#2b5797', weight: 1 }]],
    ['a muddy photograph card', [{ hex: '#6b5b4a', weight: 5 }, { hex: '#7a6a55', weight: 4 }, { hex: '#5d4f42', weight: 3 }]],
  ];

  for (const [name, colors] of sites) {
    for (const polarity of POLARITIES) {
      test(`${name}, ${polarity}`, () => {
        const swatches = swatchesFromColors(colors);
        const theme = themeFromPalette(colorsFromSwatches(swatches, polarity), polarity);
        expect(findReadabilityIssues(theme.colors)).toEqual([]);
        expect(lintAo3Css(compile(theme))).toEqual([]);
      });
    }
  }

  test('an empty extraction yields no swatches rather than a black theme', () => {
    expect(swatchesFromColors([])).toEqual([]);
    expect(swatchesFromColors([{ hex: '#ffffff', weight: 0 }])).toEqual([]);
  });

  test('weights are shares, so the deliberateness floor still means 2%', () => {
    const swatches = swatchesFromColors([{ hex: '#ffffff', weight: 30 }, { hex: '#c2410c', weight: 10 }]);
    expect(swatches.reduce((sum, s) => sum + s.weight, 0)).toBeCloseTo(1, 10);
    expect(swatches[0].weight).toBeCloseTo(0.75, 10);
  });

  test('the social card outranks the stylesheet — §6a', () => {
    // A green card against a page whose CSS is entirely grey. If the card wins,
    // the accent is green; if the CSS wins, there is no hue to find at all.
    const card = new Uint8ClampedArray(400 * 4);
    for (let i = 0; i < 400; i++) {
      card[i * 4] = 24; card[i * 4 + 1] = 160; card[i * 4 + 2] = 90; card[i * 4 + 3] = 255;
    }
    const style = {
      ...EMPTY_SITE_STYLE,
      colors: [{ hex: '#f5f5f5', weight: 5 }, { hex: '#333333', weight: 3 }],
    };
    const withCard = themesFromSite(style, card, 'https://example.com/');
    const withoutCard = themesFromSite(style, null, 'https://example.com/');
    expect(withCard.source).toBe('og-image');
    expect(withoutCard.source).toBe('stylesheet');
    expect(withCard.themes.light.colors.accent).not.toBe(withoutCard.themes.light.colors.accent);
  });

  test('a page that gave us nothing still yields two editable themes', () => {
    const extraction = themesFromSite(EMPTY_SITE_STYLE, null, 'https://example.com/');
    for (const polarity of POLARITIES) {
      expect(findReadabilityIssues(extraction.themes[polarity].colors)).toEqual([]);
      expect(lintAo3Css(compile(extraction.themes[polarity]))).toEqual([]);
    }
  });

  test('the fonts and the radius reach both polarities', () => {
    const style = collectSiteStyle(
      '<style>body{background:#fff;font-family:Inter,sans-serif}h1{font-family:Poppins,sans-serif}.card{border-radius:5px}</style>'
    );
    const extraction = themesFromSite(style, null, 'https://example.com/');
    for (const polarity of POLARITIES) {
      const theme = extraction.themes[polarity];
      expect(theme.typography.headingFont).toContain('Futura');
      expect(theme.typography.bodyFont).toContain('Arial');
      expect(theme.shape.cardRadius).toBe('4px');
    }
  });

  test('a site that sets only a body font still dresses the heading', () => {
    const style = { ...EMPTY_SITE_STYLE, bodyFont: 'Impact, sans-serif' };
    const theme = themesFromSite(style, null, 'https://example.com/').themes.light;
    // Impact is heading-only in the bank, so the two roles must differ here —
    // and neither may be a stack storage would refuse.
    expect(theme.typography.headingFont).toContain('Impact');
    expect(theme.typography.bodyFont).not.toContain('Impact');
    const stored = validateTheme(JSON.parse(JSON.stringify(theme)), cloneTheme(TEMPLATES[0]));
    expect(stored.typography.headingFont).toBe(theme.typography.headingFont);
    expect(stored.typography.bodyFont).toBe(theme.typography.bodyFont);
  });

  test('what we tell the user names the source, the polarity and the font limit', () => {
    const style = collectSiteStyle(
      '<style>body{background:#ffffff;font-family:Inter,sans-serif}h1{font-family:"Playfair Display",serif}</style>'
    );
    const built = themesFromSite(style, null, 'https://www.example.com/blog').notes;
    const notes = built.map(note => note.text).join(' ');
    expect(built.filter(note => note.kind === 'font').length).toBeGreaterThan(0);
    expect(notes).toContain('stylesheet');
    expect(notes).toContain('example.com is a light site');
    expect(notes).toContain('Playfair Display');
    expect(notes).toContain('Didot');
    expect(notes).toContain('AO3 cannot load a font file');
    expect(notes.toLowerCase()).not.toContain('match');
  });

  test('siteLabel is a name, not a decision', () => {
    expect(siteLabel('https://www.example.com/a/b?c=d')).toBe('example.com');
    expect(siteLabel('not a url')).toBe('that site');
  });

  test('the site theme keeps the one id analytics knows — §5f.4', () => {
    const extraction = themesFromSite(EMPTY_SITE_STYLE, null, 'https://example.com/');
    for (const polarity of POLARITIES) {
      expect(extraction.themes[polarity].meta.id).toBe(MAGIC_THEME_ID);
      expect(analyticsPayload({
        name: 'template_selected',
        templateId: extraction.themes[polarity].meta.id,
      })).not.toBeNull();
    }
  });

  test('the fonts and radius a site supplies survive the storage boundary', () => {
    const base = cloneTheme(TEMPLATES[0]);
    const style = collectSiteStyle(
      '<style>body{font-family:Inter,sans-serif}h1{font-family:"Playfair Display",serif}.card{border-radius:18px}</style>'
    );
    const theme = {
      ...base,
      typography: {
        ...base.typography,
        headingFont: classifyFont(style.headingFont!, 'heading')!.stack,
        bodyFont: classifyFont(style.bodyFont!, 'body')!.stack,
      },
      shape: { ...base.shape, cardRadius: snapRadius(style.radius)! },
    };
    const stored = validateTheme(JSON.parse(JSON.stringify(theme)), base);
    expect(stored.typography.headingFont).toBe(theme.typography.headingFont);
    expect(stored.typography.bodyFont).toBe(theme.typography.bodyFont);
    expect(stored.shape.cardRadius).toBe('18px');
    expect(lintAo3Css(compile(stored))).toEqual([]);
  });
});
