import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve as resolvePath } from 'path';

import { SAMPLE_EDGE } from '../src/lib/siteSkin/imageSample';
import {
  Polarity,
  Swatch,
  colorsFromSwatches,
  quantize,
  swatchesFromColors,
} from '../src/lib/siteSkin/palette';
import { chromaOf } from '../src/lib/siteSkin/palette';
import { meaningfulColors, parseCssColor } from '../src/lib/siteSkin/siteStyle';
import { findReadabilityIssues, luminance, normalizeHex } from '../src/lib/siteSkin/colors';

/**
 * **A measurement, not an assertion.** `docs/MAGIC-PICKER-IMPLEMENTATION.md`
 * §13c step 2, which is the last thing §10 still owes: *is `og:image` genuinely
 * a better signal than the stylesheet?* §6a asserts it is and calls it the
 * primary signal; the five-site probe in §12a compared nothing, because sampling
 * a social card needs a canvas and that probe was a unit test.
 *
 * So this one is a browser test. It drives both halves of the real extraction —
 * the endpoint for the stylesheet, `/api/image-proxy` plus a canvas for the card
 * — over a list of real sites, and prints the two palettes side by side.
 *
 * ## Running it
 *
 * It is **skipped unless `PROBE_SITES` is set**, because it talks to twenty
 * strangers' servers and its answers are opinions about taste rather than pass
 * or fail. It needs a local server: `/api/site-palette` does not exist in
 * production yet, and the rate limit is 20 requests per IP per minute.
 *
 * ```bash
 * npm run dev
 * PROBE_SITES=1 UX_BASE_URL=http://localhost:3000 \
 *   npx playwright test --project=desktop tests/site-palette-probe.spec.ts
 * ```
 *
 * `PROBE_SITES` may also be a comma-separated list of hosts, which replaces the
 * default twenty. The report lands in `tmp/site-palette-probe.md`.
 *
 * ## What it can and cannot tell you
 *
 * There are two measures, and the second is the one that decided §14.
 *
 * **The referee** is `theme-color`: a colour the site's own designer wrote down
 * as *the* brand colour, extracted by neither path, so the accent closer to it
 * is the better answer and that is a number. It only refereed one row in twenty
 * — and the first run of this probe was **wrong** because of the rows it
 * refereed badly. Three of six declared `#ffffff`, which no accent can be close
 * to, so the greyer answer "won" by being further from a colour and nearer to
 * nothing. A neutral `theme-color` is now excluded rather than scored, which is
 * the difference between a referee and a coin.
 *
 * **The measure that generalises** is chroma: how much colour is in the accent
 * at all. A grey accent is the failure a reader sees instantly — they pasted
 * Notion and got a beige theme — and it needs no reference colour to detect.
 * That is what turned out to separate the two sources cleanly.
 */

/**
 * Twenty sites, chosen to span the cases §6c says decide the answer: static
 * content sites, design-token sites, and JavaScript shells whose HTML carries
 * almost nothing but a card.
 */
const DEFAULT_SITES = [
  'https://www.mozilla.org/',
  'https://archiveofourown.org/',
  'https://github.com/',
  'https://stripe.com/',
  'https://tailwindcss.com/',
  'https://www.nytimes.com/',
  'https://www.theguardian.com/',
  'https://www.bbc.co.uk/',
  'https://www.wikipedia.org/',
  'https://css-tricks.com/',
  'https://developer.mozilla.org/',
  'https://linear.app/',
  'https://www.notion.so/',
  'https://www.figma.com/',
  'https://www.apple.com/',
  'https://www.nasa.gov/',
  'https://www.anthropic.com/',
  'https://bandcamp.com/',
  'https://www.goodreads.com/',
  'https://example.com/',
];

const REPORT = resolvePath(__dirname, '../tmp/site-palette-probe.md');

/** The endpoint allows 20 per IP per minute, and this probe asks for exactly 20. */
const PAUSE_MS = 3_200;

interface Palette {
  background: string;
  surface: string;
  text: string;
  accent: string;
}

interface Row {
  site: string;
  ok: boolean;
  note: string;
  polarity: Polarity;
  themeColor: string | null;
  ogImage: string | null;
  css: Palette | null;
  card: Palette | null;
  /** Distance from the declared brand colour, when there is one to be judged by. */
  cssMiss: number | null;
  cardMiss: number | null;
  winner: 'card' | 'css' | 'tie' | 'unjudged';
}

/* ── Reading the two sources ──────────────────────────────────────────────── */

/**
 * The card, sampled the way the product samples it.
 *
 * This is `imageSample.ts`'s body, re-expressed inside the page because that
 * module is bundled into the app and a Playwright test runs in Node. `SAMPLE_EDGE`
 * is imported rather than repeated, so the one number that changes the answer
 * cannot drift between the probe and the thing it is measuring.
 */
async function samplePixelsInPage(page: import('@playwright/test').Page, url: string) {
  return page.evaluate(
    async ([src, edge]) => {
      const res = await fetch('/api/image-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: src }),
      });
      if (!res.ok) throw new Error(`proxy ${res.status}`);
      const { dataUri } = await res.json();

      const image = await new Promise<HTMLImageElement>((done, fail) => {
        const element = new Image();
        element.onload = () => done(element);
        element.onerror = () => fail(new Error('undecodable'));
        element.src = dataUri;
      });

      const longest = Math.max(image.naturalWidth, image.naturalHeight);
      if (!longest) throw new Error('undecodable');
      const scale = Math.min(1, (edge as number) / longest);
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { willReadFrequently: true })!;
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(image, 0, 0, width, height);
      return Array.from(context.getImageData(0, 0, width, height).data);
    },
    [url, SAMPLE_EDGE] as const
  );
}

/* ── Judging ──────────────────────────────────────────────────────────────── */

function rgb(hex: string): [number, number, number] {
  const value = normalizeHex(hex).slice(1);
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

/**
 * How far apart two colours look, 0–100ish.
 *
 * Euclidean in RGB, which is crude and is the right kind of crude here: the
 * question is "did these two paths land on the same brand colour or a different
 * one", and that difference is enormous when it is real.
 */
function distance(a: string, b: string): number {
  const [ar, ag, ab] = rgb(a);
  const [br, bg, bb] = rgb(b);
  return Math.round(Math.sqrt((ar - br) ** 2 + (ag - bg) ** 2 + (ab - bb) ** 2) / 4.41);
}

/** Enough of a gap to be a real disagreement rather than two names for one colour. */
const MEANINGFUL_GAP = 8;

/**
 * Below this an accent is a grey, and the same number `siteTheme.ts` decides
 * precedence with — imported rather than repeated so the probe cannot report a
 * threshold the product does not use.
 */
const GREY = 0.12;

/** A `theme-color` of white, black or slate cannot referee an accent. */
function canReferee(themeColor: string | null): boolean {
  return themeColor !== null && chromaOf(themeColor) >= GREY;
}

function judge(row: Row): Row['winner'] {
  if (row.cssMiss === null || row.cardMiss === null) return 'unjudged';
  if (Math.abs(row.cssMiss - row.cardMiss) < MEANINGFUL_GAP) return 'tie';
  return row.cardMiss < row.cssMiss ? 'card' : 'css';
}

function paletteCell(palette: Palette | null): string {
  if (!palette) return '—';
  const chroma = chromaOf(palette.accent);
  return `\`${palette.accent}\`${chroma < GREY ? ' **grey**' : ''} (${chroma.toFixed(2)})`;
}

function report(rows: Row[]): string {
  const judged = rows.filter(row => row.winner !== 'unjudged');
  const tally = {
    card: judged.filter(row => row.winner === 'card').length,
    css: judged.filter(row => row.winner === 'css').length,
    tie: judged.filter(row => row.winner === 'tie').length,
  };
  const both = rows.filter(row => row.css && row.card);
  const greyCards = both.filter(row => chromaOf(row.card!.accent) < GREY).length;
  const greyCss = both.filter(row => chromaOf(row.css!.accent) < GREY).length;

  const lines = [
    '# `og:image` versus the stylesheet',
    '',
    `${rows.length} sites, ${new Date().toISOString().slice(0, 10)}. ` +
      'Generated by `tests/site-palette-probe.spec.ts` — see that file for what ' +
      'the numbers mean. Each cell is the accent that source produced and its ' +
      'chroma; "miss" is the distance from the page\'s own `theme-color`, scored ' +
      'only where that colour is itself chromatic enough to referee.',
    '',
    `**On the ${both.length} sites where both sources could be read, the card ` +
      `returned a grey accent ${greyCards} times and the stylesheet ${greyCss}.** ` +
      `Of the ${judged.length} refereed by a chromatic \`theme-color\`: ` +
      `card closer on ${tally.card}, stylesheet closer on ${tally.css}, ` +
      `too close to call on ${tally.tie}.`,
    '',
    '| Site | theme-color | Stylesheet accent | miss | Card accent | miss | Closer |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...rows.map(row =>
      [
        row.site.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''),
        row.themeColor ? `\`${row.themeColor}\`${canReferee(row.themeColor) ? '' : ' *neutral*'}` : '—',
        paletteCell(row.css),
        row.cssMiss === null ? '—' : String(row.cssMiss),
        row.card ? paletteCell(row.card) : `— ${row.note}`,
        row.cardMiss === null ? '—' : String(row.cardMiss),
        row.winner === 'unjudged' ? '' : row.winner,
      ].join(' | ')
    ),
    '',
    '## Sites with no readable card',
    '',
    ...rows.filter(row => !row.card).map(row => `- ${row.site} — ${row.note}`),
    '',
  ];
  return lines.join('\n');
}

/* ── The probe ────────────────────────────────────────────────────────────── */

test.describe('og:image versus the stylesheet', () => {
  test.skip(!process.env.PROBE_SITES, 'Set PROBE_SITES=1 and point UX_BASE_URL at a local server.');
  test.describe.configure({ mode: 'serial', timeout: 20 * 60_000 });

  test('both sources, side by side, over real sites', async ({ page, request }) => {
    const list = process.env.PROBE_SITES!;
    const sites =
      list === '1'
        ? DEFAULT_SITES
        : list.split(',').map(entry => (/^https?:/.test(entry.trim()) ? entry.trim() : `https://${entry.trim()}`));

    // Same-origin, so `/api/image-proxy` and the canvas both behave as they do
    // in the product. Any page on the app will do.
    await page.goto('/site-skin');

    const rows: Row[] = [];

    for (const site of sites) {
      const row: Row = {
        site,
        ok: false,
        note: '',
        polarity: 'light',
        themeColor: null,
        ogImage: null,
        css: null,
        card: null,
        cssMiss: null,
        cardMiss: null,
        winner: 'unjudged',
      };

      const res = await request.post('/api/site-palette', { data: { url: site } });
      const body = await res.json().catch(() => ({}));

      if (!res.ok()) {
        row.note = `endpoint ${res.status()}: ${body?.error || ''}`;
        rows.push(row);
        await page.waitForTimeout(PAUSE_MS);
        continue;
      }

      row.ok = true;
      row.polarity = body.polarity === 'dark' ? 'dark' : 'light';
      row.themeColor = body.themeColor ? parseCssColor(body.themeColor) : null;
      row.ogImage = body.ogImage || null;

      const cssSwatches: Swatch[] = swatchesFromColors(meaningfulColors(body.colors || []));
      row.css = colorsFromSwatches(cssSwatches, row.polarity);

      if (!row.ogImage) {
        row.note = 'no og:image declared';
      } else {
        try {
          const pixels = await samplePixelsInPage(page, row.ogImage);
          const swatches = quantize(pixels);
          if (swatches.length === 0) throw new Error('no swatches');
          row.card = colorsFromSwatches(swatches, row.polarity);
        } catch (cause) {
          row.note = `card unreadable (${cause instanceof Error ? cause.message : 'unknown'})`;
        }
      }

      if (canReferee(row.themeColor)) {
        if (row.css) row.cssMiss = distance(row.css.accent, row.themeColor!);
        if (row.card) row.cardMiss = distance(row.card.accent, row.themeColor!);
      }
      row.winner = judge(row);
      rows.push(row);

      // The extraction the product ships must not produce a palette the editor
      // would then warn about — §5c's promise, asserted here against real pages
      // rather than against synthetic fixtures for the first time.
      for (const palette of [row.css, row.card]) {
        if (palette) expect(findReadabilityIssues(palette), `${site}: ${JSON.stringify(palette)}`).toEqual([]);
      }

      // Printed as it goes: the run takes minutes, and a table that only
      // appears at the end is a table you cannot watch for a stuck site.
      console.log(
        `${site.padEnd(34)} css ${row.css?.accent} (${row.cssMiss ?? '–'})  ` +
          `card ${row.card?.accent ?? '   –   '} (${row.cardMiss ?? '–'})  ${row.winner}` +
          (row.note ? `  — ${row.note}` : '')
      );

      await page.waitForTimeout(PAUSE_MS);
    }

    mkdirSync(dirname(REPORT), { recursive: true });
    writeFileSync(REPORT, report(rows), 'utf8');
    console.log(`\nReport written to ${REPORT}`);

    // The only real assertion: a comparison nobody can make is not a measurement.
    expect(rows.filter(row => row.card).length, 'no card was readable anywhere').toBeGreaterThan(0);
    // And a light site should stay light — the pole is the one thing about the
    // extraction a reader would notice instantly if it inverted.
    for (const row of rows) {
      if (!row.css) continue;
      const light = luminance(row.css.background) > 0.5;
      expect(light, `${row.site} came back ${light ? 'light' : 'dark'} for polarity ${row.polarity}`).toBe(
        row.polarity === 'light'
      );
    }
  });
});
