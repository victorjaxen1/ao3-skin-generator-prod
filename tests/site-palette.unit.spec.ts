import { test, expect } from '@playwright/test';
import {
  collectSiteStyle,
  meaningfulColors,
  parseCssColor,
  readCssRules,
  readMeta,
  readStylesheetLinks,
  snapRadius,
  stockAccentFramework,
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

  // Reversed deliberately, and §14 is why: refusing a big page failed on
  // nytimes.com and linear.app, which are ordinary links to paste. Half a page
  // still carries the head, so the cap truncates.
  test('an oversized page is truncated to the cap, not refused', async () => {
    const fetchImpl = (async () =>
      textResponse('x'.repeat(5000), 'text/html', 200, { 'content-length': '5000' })) as unknown as typeof fetch;
    const result = await fetchValidatedText('https://example.com/', {
      kind: 'html',
      maxBytes: 1000,
      fetchImpl,
      resolver: publicDns,
    });
    expect(result.text.length).toBeLessThanOrEqual(1000);
    expect(result.text.length).toBeGreaterThan(0);
  });

  test('the head of a truncated page still yields its signals', async () => {
    const head = `<html><head><meta name="theme-color" content="#c2410c"></head><body>`;
    const fetchImpl = (async () =>
      textResponse(head + '<p>x</p>'.repeat(40_000), 'text/html')) as unknown as typeof fetch;
    const result = await fetchSiteStyle('https://example.com/', { fetchImpl, resolver: publicDns });
    expect(result.style.themeColor).toBe('#c2410c');
  });

  test('a body that trickles past the deadline is a timeout, not "unreachable"', async () => {
    const trickle = new ReadableStream<Uint8Array>({
      async pull(controller) {
        await new Promise(done => setTimeout(done, 60));
        controller.enqueue(new Uint8Array(8));
      },
    });
    const fetchImpl = (async () =>
      new Response(trickle, { status: 200, headers: { 'content-type': 'text/html' } })) as unknown as typeof fetch;

    await expect(
      fetchValidatedText('https://example.com/', {
        kind: 'html',
        maxBytes: 1024 * 1024,
        timeoutMs: 250,
        fetchImpl,
        resolver: publicDns,
      })
    ).rejects.toMatchObject({ code: 'TIMEOUT' });
  });

  // The cap is what a hostile host is held to, and truncating must not have
  // loosened it: a server that streams for ever still gives us one megabyte.
  test('an endless body is still capped', async () => {
    const endless = new ReadableStream<Uint8Array>({
      pull(controller) { controller.enqueue(new Uint8Array(64 * 1024)); },
    });
    const fetchImpl = (async () =>
      new Response(endless, { status: 200, headers: { 'content-type': 'text/html' } })) as unknown as typeof fetch;
    const result = await fetchValidatedText('https://example.com/', {
      kind: 'html',
      maxBytes: 1000,
      fetchImpl,
      resolver: publicDns,
    });
    expect(result.text.length).toBe(1000);
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

  // The whole extraction has to fit inside a serverless function's 10 seconds.
  // Per-hop timeouts alone did not bound it: a page plus three stylesheets was
  // 32 seconds in the worst case, and a function killed mid-sentence returns
  // something we never wrote. The sheets are what gets dropped.
  test('a slow page spends the budget and the stylesheets are skipped', async () => {
    const slow = (async (input: any) => {
      await new Promise(done => setTimeout(done, 300));
      const url = String(input);
      if (url.endsWith('.css')) return textResponse('body{background:#101014}', 'text/css');
      return textResponse(page);
    }) as unknown as typeof fetch;

    const result = await fetchSiteStyle('https://example.com/', {
      fetchImpl: slow,
      resolver: publicDns,
      budgetMs: 400,
    });

    expect(result.stylesheetsRead).toBe(0);
    // And the page's own signals still came back, which is the point of
    // sacrificing the sheets rather than failing.
    expect(result.style.ogImage).toBe('https://example.com/card.png');
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

  /**
   * §14 reversed §6a here, on twenty sites' evidence: a social card quantizes to
   * the average of a photograph, and Notion's card gave `#838080` where its
   * stylesheet gave `#e32d14`. So these two tests are a pair, and the pair is
   * the rule — neither source always wins, the *hue* decides.
   */
  const greenCard = () => {
    const card = new Uint8ClampedArray(400 * 4);
    for (let i = 0; i < 400; i++) {
      card[i * 4] = 24; card[i * 4 + 1] = 160; card[i * 4 + 2] = 90; card[i * 4 + 3] = 255;
    }
    return card;
  };

  test('a stylesheet that names a colour outranks the social card — §14', () => {
    const style = {
      ...EMPTY_SITE_STYLE,
      colors: [{ hex: '#f5f5f5', weight: 5 }, { hex: '#e32d14', weight: 3 }],
    };
    const withCard = themesFromSite(style, greenCard(), 'https://example.com/');
    const withoutCard = themesFromSite(style, null, 'https://example.com/');

    expect(withCard.source).toBe('stylesheet');
    // Identity, not membership — §12b. A green card must not have moved the red.
    expect(withCard.themes.light.colors.accent).toBe(withoutCard.themes.light.colors.accent);
    expect(withCard.themes.light.colors.accent).toMatch(/^#[a-f0-9]{6}$/);
  });

  test('a page of greys falls through to the card — §6a\'s real case', () => {
    // The JavaScript shell: an empty `<div id="root">` declares no hue, and the
    // card is then the only signal there is.
    const style = {
      ...EMPTY_SITE_STYLE,
      colors: [{ hex: '#f5f5f5', weight: 5 }, { hex: '#333333', weight: 3 }],
    };
    const withCard = themesFromSite(style, greenCard(), 'https://example.com/');
    const withoutCard = themesFromSite(style, null, 'https://example.com/');

    expect(withCard.source).toBe('og-image');
    expect(withoutCard.source).toBe('stylesheet');
    expect(withCard.themes.light.colors.accent).not.toBe(withoutCard.themes.light.colors.accent);
    // And it says why it went looking elsewhere, rather than claiming the card
    // was the better answer.
    expect(withCard.notes[0].text).toContain('declares almost no colour of its own');
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


/* ── The framework override ───────────────────────────────────────────────── */

/**
 * A stock framework stylesheet is a page telling us about its toolchain, not its
 * taste, and heyoliver.com is the case that made it concrete: a 2020 Bootstrap 4
 * bundle whose top twelve colours are the framework's entire swatch, over a page
 * that declares `#425cbb` for its browser chrome.
 *
 * The negative tests are the ones that matter. This override is the only place
 * in Phase C where a *declaration* beats a *measurement*, so each condition that
 * narrows it gets a test that would notice if it were dropped.
 */
test.describe('a stock framework stylesheet does not get to speak for the site', () => {
  /** Bootstrap 4's swatch, with the derived shades a real build also emits. */
  const bootstrap = [
    { hex: '#ffffff', weight: 80 },
    { hex: '#007bff', weight: 30 },
    { hex: '#6c757d', weight: 21 },
    { hex: '#28a745', weight: 20 },
    { hex: '#dc3545', weight: 20 },
    { hex: '#212529', weight: 19 },
    { hex: '#d39e00', weight: 8 },
    { hex: '#ffc107', weight: 11 },
  ];

  const site = (themeColor: string | null, colors = bootstrap) => ({
    ...EMPTY_SITE_STYLE,
    colors,
    themeColor,
    polarity: 'light' as const,
  });

  test('the table names the framework, and only on an exact match', () => {
    expect(stockAccentFramework('#007bff')).toBe('Bootstrap');
    expect(stockAccentFramework('#0D6EFD')).toBe('Bootstrap');
    expect(stockAccentFramework('#00d1b2')).toBe('Bulma');
    // A recompiled $primary is the site's own choice and must survive.
    expect(stockAccentFramework('#007bfe')).toBeNull();
    expect(stockAccentFramework('#425cbb')).toBeNull();
  });

  test("the page's declared colour becomes the accent, in both polarities", () => {
    const extraction = themesFromSite(site('#425cbb'), null, 'https://www.heyoliver.com/');
    expect(extraction.source).toBe('theme-color-accent');
    // Light needs no repair, so it is the declared colour exactly. Dark is
    // lightened by `fixAccent` against a dark page — that is the contrast floor
    // doing its job, and the hue has to survive it.
    expect(extraction.themes.light.colors.accent).toBe('#425cbb');
    expect(extraction.themes.dark.colors.accent).not.toBe('#007bff');
    for (const polarity of POLARITIES) {
      expect(findReadabilityIssues(extraction.themes[polarity].colors)).toEqual([]);
      expect(lintAo3Css(compile(extraction.themes[polarity]))).toEqual([]);
    }
  });

  /**
   * The reason the override replaces the accent instead of pruning the list:
   * `#d39e00` is `darken($warning, 10%)`, it is in no table of base defaults,
   * and it out-chromas `#425cbb`. A prune-based version returned gold here.
   */
  test('a derived framework shade cannot win the accent either', () => {
    expect(themesFromSite(site('#425cbb'), null, 'https://x.test/').themes.light.colors.accent)
      .toBe('#425cbb');
  });

  test('what we tell the user names the framework and says what was replaced', () => {
    const note = themesFromSite(site('#425cbb'), null, 'https://x.test/').notes[0];
    expect(note.kind).toBe('source');
    expect(note.text).toContain('Bootstrap');
    expect(note.text).toContain('accent');
    expect(note.text.toLowerCase()).not.toContain('match');
  });

  test('a page declaring no colour of its own keeps the stylesheet accent', () => {
    const extraction = themesFromSite(site(null), null, 'https://x.test/');
    expect(extraction.source).toBe('stylesheet');
    expect(extraction.themes.light.colors.accent).toBe('#007bff');
  });

  test('a near-grey theme-color is a page colour, not an accent', () => {
    // #1a1a2e is a brand navy: chroma 0.08, below the override bar on purpose.
    const extraction = themesFromSite(site('#1a1a2e'), null, 'https://x.test/');
    expect(extraction.source).toBe('stylesheet');
    expect(extraction.themes.light.colors.accent).toBe('#007bff');
  });

  test('a site whose brand really is the framework colour is left alone', () => {
    const extraction = themesFromSite(site('#007bff'), null, 'https://x.test/');
    expect(extraction.source).toBe('stylesheet');
    expect(extraction.themes.light.colors.accent).toBe('#007bff');
  });

  test('a hand-written stylesheet is never overruled', () => {
    const handmade = [
      { hex: '#ffffff', weight: 80 },
      { hex: '#c2410c', weight: 30 },
      { hex: '#1a1a1a', weight: 19 },
    ];
    const extraction = themesFromSite(site('#425cbb', handmade), null, 'https://x.test/');
    expect(extraction.source).toBe('stylesheet');
    expect(extraction.themes.light.colors.accent).toBe('#c2410c');
  });

  test('the declared accent is repaired, not trusted', () => {
    // Near-white on a light page: a declaration cannot buy its way past 4.5:1.
    const swatches = swatchesFromColors(bootstrap);
    const forced = colorsFromSwatches(swatches, 'light', '#fdfdf2');
    expect(forced.accent).not.toBe('#fdfdf2');
    expect(findReadabilityIssues(forced)).toEqual([]);
  });

  test('the override leaves the rest of the palette where the stylesheet put it', () => {
    const plain = themesFromSite(site(null), null, 'https://x.test/').themes.light.colors;
    const overridden = themesFromSite(site('#425cbb'), null, 'https://x.test/').themes.light.colors;
    expect(overridden.background).toBe(plain.background);
    expect(overridden.surface).toBe(plain.surface);
    expect(overridden.text).toBe(plain.text);
  });
});
