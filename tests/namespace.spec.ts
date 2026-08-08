import { test, expect, Page } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';
import { buildWorkSkin, namespaceCss } from '../src/lib/workSkin';
import { defaultProject } from '../src/lib/schema';

/**
 * Does namespacing change what the reader sees?
 *
 *   npx playwright test --project=desktop tests/namespace.spec.ts
 *
 * This is the "PNG-unchanged check" MASTER §6a asks for, and it needs a browser
 * for a reason the unit tests cannot cover.
 *
 * ## The risk
 *
 * Namespacing rewrites `#workskin dd.bubble` to `#workskin .chat.ios dd.bubble`
 * and `#workskin .chat` to `#workskin .chat.ios`. Those are **not the same
 * increase**: a rule already rooted at the container gains one class, every
 * other rule gains two. So two rules that previously tied on specificity — and
 * were therefore decided by source order — can swap places afterwards.
 *
 * Nothing static can see that. The CSS is legal either way, every selector
 * still matches the same elements, and the lint is perfectly happy. The only
 * honest question is whether the pixels move, so this compares **computed
 * styles on every element**, which is how the `em` conversion was verified
 * (WORK-SKIN §9b) rather than by eye.
 *
 * ## Three comparisons, not one
 *
 * 1. **The class alone changes nothing.** `buildHTML` now emits
 *    `class="chat ios"` on every path including the PNG, so the first thing to
 *    establish is that no stylesheet anywhere — ours, or the archive's own —
 *    has a rule that matches a bare `.ios` / `.google` / `.twitter` /
 *    `.android`. This is the half that ships to authors immediately.
 * 2. **The rewrite alone changes nothing**, on the same markup.
 * 3. **Both hold under AO3's paragraph injection**, because the `display:
 *    contents` rules that make injection survivable are themselves namespaced,
 *    and a rule that stops matching there fails geometrically rather than
 *    loudly (see `ao3-injection.spec.ts`).
 */

const AO3_CORE = readFileSync(join(__dirname, 'fixtures', 'ao3-core.css'), 'utf-8');

/** The nesting a real chapter puts our markup inside — see WORK-SKIN §6. */
function ao3Page(html: string, css: string): string {
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
const INJECT = `
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
const WATCHED = [
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

type Snapshot = { path: string; rect: string; styles: string };

/**
 * Keyed by position in the DOM walk, not by selector — the two pages render
 * identical markup, so element *n* is the same element in both, and a mismatch
 * points at exactly which one moved.
 */
async function snapshot(page: Page, watched: string[]): Promise<Snapshot[]> {
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

function diff(a: Snapshot[], b: Snapshot[]): string[] {
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
function richProject(template: string) {
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

async function stubRemoteImages(page: Page) {
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

for (const template of ['ios', 'android', 'twitter', 'google'] as const) {
  test.describe(template, () => {
    test('the platform class on its own changes nothing', async ({ page }) => {
      await stubRemoteImages(page);
      const { html, css } = buildWorkSkin(richProject(template));

      // The same markup with the platform class taken back off the container.
      const without = html.replace(
        new RegExp(`(<div class="chat) ${template}\\b`),
        '$1'
      );
      expect(without, 'the container should have carried a platform class').not.toBe(html);

      await page.setContent(ao3Page(without, css), { waitUntil: 'load' });
      const before = await snapshot(page, WATCHED);

      await page.setContent(ao3Page(html, css), { waitUntil: 'load' });
      const after = await snapshot(page, WATCHED);

      const problems = diff(before, after);
      expect(problems, `adding .${template} moved something:\n${problems.join('\n')}`).toEqual([]);
    });

    test('namespacing the stylesheet changes nothing', async ({ page }) => {
      await stubRemoteImages(page);
      const { html, css } = buildWorkSkin(richProject(template));

      await page.setContent(ao3Page(html, css), { waitUntil: 'load' });
      const before = await snapshot(page, WATCHED);

      await page.setContent(ao3Page(html, namespaceCss(css, template)), {
        waitUntil: 'load',
      });
      const after = await snapshot(page, WATCHED);

      const problems = diff(before, after);
      expect(problems, `namespacing moved something:\n${problems.join('\n')}`).toEqual([]);
    });

    test('namespacing changes nothing under AO3 paragraph injection either', async ({ page }) => {
      await stubRemoteImages(page);
      const { html, css } = buildWorkSkin(richProject(template));

      await page.setContent(ao3Page(html, css), { waitUntil: 'load' });
      await page.evaluate(INJECT);
      const before = await snapshot(page, WATCHED);

      await page.setContent(ao3Page(html, namespaceCss(css, template)), {
        waitUntil: 'load',
      });
      await page.evaluate(INJECT);
      const after = await snapshot(page, WATCHED);

      const problems = diff(before, after);
      expect(problems, `namespacing moved something under injection:\n${problems.join('\n')}`)
        .toEqual([]);
    });
  });
}
