import { Page } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';
import { defaultProject } from '../src/lib/schema';

/**
 * The shared "does this change what the reader sees?" harness.
 *
 * Not a spec file — the leading underscore and the missing `.spec` keep it out
 * of Playwright's `testMatch`. It exists because two suites now ask the same
 * question of two different transforms:
 *
 * - `namespace.spec.ts` — does scoping a stylesheet to `.chat.<platform>` move
 *   anything? (MASTER §6a)
 * - `master-skin.spec.ts` — does a skin carrying all four platforms render each
 *   one the same as that platform's own skin? (MASTER §6c, WORK-SKIN §10c)
 *
 * Both are answered by rendering the export inside AO3's own stylesheet and
 * nesting and diffing **every computed style on every element**, which is how
 * the `em` conversion was verified (WORK-SKIN §9b) rather than by eye. Nothing
 * static can see either failure: the CSS is legal both ways, every selector
 * still parses, and the lint is perfectly happy.
 */

const AO3_CORE = readFileSync(join(__dirname, 'fixtures', 'ao3-core.css'), 'utf-8');

/** The nesting a real chapter puts our markup inside — see WORK-SKIN §6. */
export function ao3Page(html: string, css: string): string {
  return `<!doctype html><html><head><meta charset="utf-8">
<style>${AO3_CORE}</style>
<style>${css}</style>
</head><body>
<div id="outer" class="wrapper"><div id="inner" class="wrapper"><div id="main">
<div class="work"><div id="work-skin"><div id="workskin">
<div id="chapters"><div class="chapter"><div class="userstuff module">
${html}
</div></div></div></div></div></div></div></div></div>
</body></html>`;
}

/** AO3's measured paragraph injection — see `ao3-injection.spec.ts` §12a. */
export const INJECT = `
  (function (root) {
    const INLINE = new Set(['SPAN','IMG','B','I','EM','STRONG','A','S','DEL','CODE','SMALL','SUP','SUB','BR','ABBR','Q','U']);
    const isInline = (n) =>
      (n.nodeType === 3 && n.textContent.trim() !== '') ||
      (n.nodeType === 1 && INLINE.has(n.tagName));
    const walk = (el) => {
      for (const kid of Array.from(el.children)) walk(kid);
      if (el.tagName !== 'DIV' && el !== root) return;
      let run = [];
      const flush = () => {
        if (!run.length) return;
        const p = document.createElement('p');
        el.insertBefore(p, run[0]);
        run.forEach((n) => p.appendChild(n));
        run = [];
      };
      for (const node of Array.from(el.childNodes)) {
        if (isInline(node)) run.push(node);
        else if (node.nodeType === 3) { if (run.length) run.push(node); }
        else flush();
      }
      flush();
    };
    walk(root);
  })(document.querySelector('#workskin'));
`;

/**
 * Everything a reader could notice: box, colour, type, and the layout modes
 * this project has actually been bitten by (`display` for the typing dots,
 * `float`/`overflow` for the tweet header, `opacity` for the static indicator).
 */
export const WATCHED = [
  'display', 'position', 'float', 'overflow-x', 'overflow-y', 'visibility', 'opacity',
  'width', 'height', 'top', 'right', 'bottom', 'left', 'z-index',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'color', 'background-color', 'background-image',
  'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
  'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
  'border-top-left-radius', 'border-top-right-radius',
  'border-bottom-left-radius', 'border-bottom-right-radius',
  'font-size', 'font-weight', 'font-family', 'font-style', 'line-height',
  'text-align', 'text-decoration-line', 'text-overflow', 'text-shadow',
  'white-space', 'word-break', 'overflow-wrap', 'letter-spacing',
  'flex-direction', 'flex-grow', 'flex-shrink', 'flex-basis',
  'justify-content', 'align-items', 'flex-wrap',
  'box-shadow', 'transform', 'content', 'clip',
];

export type Snapshot = { path: string; rect: string; styles: string };

/**
 * Load a page and snapshot it once the layout has stopped moving.
 *
 * `waitUntil: 'load'` is not the end of layout. Fonts resolve on their own
 * schedule — and this harness aborts font requests, so the fallback swap lands
 * whenever the failure does — and a style recalculation can still be pending
 * when `load` fires. Both change text metrics, and AO3's own stylesheet centres
 * several ancestors with `margin: auto`, so a few pixels of text width become a
 * few hundred pixels of margin on the element we are measuring.
 *
 * Left unhandled it looks exactly like a real regression: on 8 Aug 2026 two
 * renders of the *same* Google page disagreed by 56.92px of margin, in one run
 * out of three. That is the same class of mistake as aborting images instead of
 * stubbing them (see `stubRemoteImages`) — and the same lesson: **make the
 * harness deterministic before believing what it says.**
 *
 * `document.fonts.ready` covers the swap; two animation frames cover anything
 * still queued behind it.
 */
export async function render(page: Page, html: string, css: string): Promise<Snapshot[]> {
  await page.setContent(ao3Page(html, css), { waitUntil: 'load' });
  await settle(page);
  return snapshot(page);
}

/** The same, with AO3's paragraph injection applied before measuring. */
export async function renderInjected(page: Page, html: string, css: string): Promise<Snapshot[]> {
  await page.setContent(ao3Page(html, css), { waitUntil: 'load' });
  await page.evaluate(INJECT);
  await settle(page);
  return snapshot(page);
}

/**
 * Wait until the layout has actually stopped moving, then measure.
 *
 * `document.fonts.ready` plus two frames was not enough: the Google case still
 * disagreed with itself about once in three runs, by 56.92px of margin on
 * `#workskin` and 355px on our container — both `margin: auto` resolving, which
 * means an ancestor's width changed *after* the frames had passed.
 *
 * So this stops predicting when layout finishes and **observes** it instead: it
 * polls the geometry of every element under `#workskin` until two consecutive
 * frames agree, which is the same "diff a render against itself" move that
 * settled the blocked-image flake (WORK-SKIN §10). If it never settles, the
 * throw is the honest outcome — a page that will not hold still cannot be
 * compared against another one.
 */
async function settle(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;

    const measure = () =>
      Array.from(document.querySelectorAll('#workskin, #workskin *'))
        .map((el) => {
          const r = el.getBoundingClientRect();
          return `${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)},${Math.round(r.height)}`;
        })
        .join('|');

    const frame = () => new Promise((r) => requestAnimationFrame(r));

    let previous = measure();
    for (let i = 0; i < 60; i++) {
      await frame();
      const current = measure();
      if (current === previous) return;
      previous = current;
    }
    throw new Error('settle: layout never stopped changing');
  });
}

/**
 * Keyed by position in the DOM walk, not by selector — the two pages render
 * identical markup, so element *n* is the same element in both, and a mismatch
 * points at exactly which one moved.
 */
export async function snapshot(page: Page, watched: string[] = WATCHED): Promise<Snapshot[]> {
  return page.evaluate((props) => {
    const root = document.querySelector('#workskin')!;
    const out: { path: string; rect: string; styles: string }[] = [];
    const walk = (el: Element, path: string) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      out.push({
        path,
        rect: [r.x, r.y, r.width, r.height].map((n) => Math.round(n * 100) / 100).join(','),
        styles: props.map((p) => `${p}=${cs.getPropertyValue(p)}`).join('|'),
      });
      // Pseudo-elements carry the iOS bubble tails and are namespaced too.
      for (const pseudo of ['::before', '::after']) {
        const ps = getComputedStyle(el, pseudo);
        out.push({
          path: path + pseudo,
          rect: '',
          styles: props.map((p) => `${p}=${ps.getPropertyValue(p)}`).join('|'),
        });
      }
      Array.from(el.children).forEach((kid, i) => walk(kid, `${path}/${kid.tagName}[${i}]`));
    };
    walk(root, '#workskin');
    return out;
  }, watched);
}

/**
 * Compare two pages, but only believe the answer once the harness has proved it
 * can render the same page twice identically.
 *
 * WORK-SKIN §10 records the rule this automates: *before believing a two-render
 * diff, diff a render against itself.* It was written after a blocked image made
 * two identical Google renders differ by 6.69px and cost an hour. The same class
 * of ghost came back on 8 Aug 2026 — `#workskin` gaining 56.92px of `margin:
 * auto` in one run out of three, on a page that measures bit-identically when
 * rendered six times in a row, cold or warm.
 *
 * So each attempt renders A, B, then **A again**. If the two A's disagree the
 * harness was unstable and the verdict is thrown away; only a self-consistent
 * attempt is trusted. This cannot hide a real difference — a real one shows up
 * in the A-vs-B diff while A-vs-A stays clean — and it stops a cold render being
 * reported as a layout regression.
 */
export async function stableDiff(
  page: Page,
  a: { html: string; css: string },
  b: { html: string; css: string },
  opts: { injected?: boolean } = {}
): Promise<string[]> {
  const draw = opts.injected ? renderInjected : render;
  const unstable: string[] = [];

  for (let attempt = 0; attempt < 3; attempt++) {
    const first = await draw(page, a.html, a.css);
    const other = await draw(page, b.html, b.css);
    const again = await draw(page, a.html, a.css);

    const self = diff(first, again);
    if (self.length === 0) return diff(first, other);
    unstable.push(`attempt ${attempt}: ${self[0]}`);
  }

  throw new Error(
    'the harness never rendered the same page twice identically, so no verdict ' +
      `is trustworthy:\n${unstable.join('\n')}`
  );
}

export function diff(a: Snapshot[], b: Snapshot[]): string[] {
  const problems: string[] = [];
  if (a.length !== b.length) {
    return [`element count changed: ${a.length} -> ${b.length}`];
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i].rect !== b[i].rect) {
      problems.push(`${a[i].path}: box ${a[i].rect} -> ${b[i].rect}`);
    }
    if (a[i].styles !== b[i].styles) {
      const was = a[i].styles.split('|');
      const now = b[i].styles.split('|');
      const moved = was.filter((v, j) => v !== now[j]).map((v, j) => `${v} -> ${now[was.indexOf(v)]}`);
      problems.push(`${a[i].path}: ${moved.join(', ')}`);
    }
  }
  return problems;
}

/** A project with enough on it that the interesting rules actually apply. */
export function richProject(template: string) {
  const p = defaultProject();
  p.template = template as typeof p.template;
  // Optional chrome, all of it flex rows of inline children — the shapes that
  // have broken before, and skipped entirely if left at their defaults.
  p.settings.iosShowStatusBar = true;
  p.settings.iosShowInputBar = true;
  p.settings.twitterQuoteEnabled = true;
  p.settings.twitterQuoteName = 'Some Body';
  p.settings.twitterQuoteHandle = 'somebody';
  p.settings.twitterQuoteText = 'the quoted post';
  p.settings.twitterVerified = true;
  p.settings.twitterShowMetrics = true;

  if (template === 'ios' || template === 'android') {
    p.messages = [
      { id: '1', sender: 'Sam', content: 'hey', outgoing: false, timestamp: '10:23' },
      { id: '2', sender: 'You', content: 'you free **tonight**?', outgoing: true, timestamp: '10:24' },
      { id: '3', sender: 'You', content: 'or `tomorrow`', outgoing: true, timestamp: '10:25' },
      { id: '4', sender: 'Sam', content: '', outgoing: false, timestamp: '10:26', isTyping: true },
    ] as typeof p.messages;
    p.settings.chatShowTyping = true;
    p.settings.chatTypingName = 'Sam';
  }
  return p;
}

/** A 1x1 transparent PNG, served in place of every remote image. */
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

export async function stubRemoteImages(page: Page) {
  // Images are STUBBED, not aborted, and the difference matters.
  //
  // Aborting looked right — every img we emit carries width and height, so
  // layout is determined without the bytes — but a *failed* image is not the
  // same box as a loaded one: Chrome sizes the broken-image placeholder when
  // the failure lands, which is not at a fixed point relative to the load
  // event. That made this suite flaky on Google, whose logo is the only image
  // on the page: two identical renders differed by 6.69px, which reads exactly
  // like a real namespacing bug and cost an hour to prove was not one.
  //
  // A 1x1 pixel always loads, always scales to the declared width and height,
  // and never touches the network.
  await page.route('**/*', (route) => {
    const type = route.request().resourceType();
    if (type === 'document') return route.continue();
    if (type === 'image') return route.fulfill({ contentType: 'image/png', body: PIXEL });
    return route.abort();
  });
}
