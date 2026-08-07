import { test, expect, Page } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';
import { buildWorkSkin } from '../src/lib/workSkin';
import { defaultProject } from '../src/lib/schema';

/**
 * Does our layout survive AO3 wrapping our elements in paragraphs?
 *
 * This is the harness BACKLOG 17b asks for. It needs a browser because the
 * question is geometric — the CSS is legal either way and the lint cannot see
 * the problem. Runs offline via setContent; no dev server required:
 *
 *   npx playwright test --project=desktop tests/ao3-injection.spec.ts
 *
 * ## The mechanism
 *
 * AO3 injects `<p>` into work HTML. It does not strip `display:flex` — it
 * MOVES it. The injected paragraph becomes the flex item, and everything we
 * meant to lay out is a grandchild that flex no longer sees. `> *` fails the
 * same way: the paragraph matches the combinator, so the margin lands on the
 * wrapper instead of our element.
 *
 * The paragraph reset does not save either case. It stops an injected
 * paragraph adding SPACE; it cannot stop it being a BOX in between.
 *
 * Observed for real on Google, whose exported HTML used to be nine lines: the
 * tab bar stacked one tab per line and the mic/lens icons sat against the query
 * text instead of the right edge.
 *
 * ## What this measures
 *
 * Each platform is rendered twice inside AO3's own stylesheet and nesting —
 * once clean, once with every element child wrapped in a `<p>` — and the
 * geometry of the load-bearing elements is compared. A platform passes when
 * injection moves nothing.
 *
 * The injection model is deliberately the WORST case: every level, not just the
 * top. AO3 injects more at some paste paths than others and we cannot control
 * which, so the useful question is "what is the damage if it happens
 * everywhere", not "what is most likely".
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

/**
 * AO3's actual paragraph injection, copied from what the archive stored.
 *
 * NOT a guess. Two works posted on 7 Aug 2026 were fetched back and their
 * stored markup read (BACKLOG 17c). The rule is:
 *
 *   - inside a `<div>`, each CONTIGUOUS RUN of inline content — text, `<span>`,
 *     `<img>`, `<b>` — is wrapped in a single `<p>`
 *   - block children (`div`, `dl`) are left completely alone
 *   - the interior of `<dd>` / `<dt>` is not touched at all
 *
 * Evidence, from `works/75270521`:
 *
 *   <div class="tweet-header">
 *     <p><img class="avatar"></p>                          <- lone img wrapped
 *     <div class="head">...                                <- div untouched
 *   <div class="metrics">
 *     <p><span/><span/><span/></p>                         <- three spans, ONE p
 *
 * and from `works/90058976`:
 *
 *   <div class="row in single"><dl class="msg">            <- untouched, both
 *     <dd class="bubble in has-tail">text<span class="time">  <- dd interior safe
 *
 * The "one run, one paragraph" part is what does the damage: a flex row of
 * inline children collapses to a SINGLE flex item, so `space-between` has
 * nothing to distribute and `> *` puts the margin on the wrapper.
 *
 * Applied through the DOM rather than by rewriting HTML, so the parser cannot
 * silently correct anything and hide the restructuring we are measuring.
 */
const INJECT = `
  (function (root) {
    const INLINE = new Set(['SPAN','IMG','B','I','EM','STRONG','A','S','DEL','CODE','SMALL','SUP','SUB','BR','ABBR','Q','U']);
    const isInline = (n) =>
      (n.nodeType === 3 && n.textContent.trim() !== '') ||
      (n.nodeType === 1 && INLINE.has(n.tagName));

    const walk = (el) => {
      for (const kid of Array.from(el.children)) walk(kid);
      // AO3 only paragraph-wraps inside div containers.
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

type Box = { sel: string; i: number; x: number; y: number; w: number; h: number };

async function measure(page: Page, selectors: string[]): Promise<Box[]> {
  return page.evaluate((sels) => {
    const out: Box[] = [];
    for (const sel of sels) {
      document.querySelectorAll(sel).forEach((el, i) => {
        const r = (el as HTMLElement).getBoundingClientRect();
        out.push({
          sel,
          i,
          x: Math.round(r.x),
          y: Math.round(r.y),
          w: Math.round(r.width),
          h: Math.round(r.height),
        });
      });
    }
    return out;
  }, selectors);
}

async function geometryUnderInjection(page: Page, template: string, selectors: string[]) {
  const p = defaultProject();
  p.template = template as typeof p.template;
  // Optional chrome is off by default, and every one of these is a flex row of
  // inline children — exactly the shape injection breaks. Turned on so the
  // harness measures them instead of silently skipping them.
  p.settings.iosShowStatusBar = true;
  p.settings.iosShowInputBar = true;
  p.settings.twitterQuoteEnabled = true;
  p.settings.twitterQuoteName = 'Some Body';
  p.settings.twitterQuoteHandle = 'somebody';
  p.settings.twitterQuoteText = 'the quoted post';

  // Enough content that alignment and grouping are actually exercised.
  if (template === 'ios' || template === 'android') {
    p.messages = [
      { id: '1', sender: 'Sam', content: 'hey', outgoing: false, timestamp: '10:23' },
      { id: '2', sender: 'You', content: 'you free tonight?', outgoing: true, timestamp: '10:24' },
      { id: '3', sender: 'You', content: 'or tomorrow', outgoing: true, timestamp: '10:25' },
    ] as typeof p.messages;
    p.settings.chatShowTyping = true;
    p.settings.chatTypingName = 'Sam';
  }

  const { html, css } = buildWorkSkin(p);

  // Block remote images. Two reasons, and the second is the important one:
  // the CDN makes this slow and flaky offline, but an image that finished
  // loading BETWEEN the two measurements would shift the geometry on its own
  // and be reported as injection damage. Every img we emit carries width and
  // height attributes — there is a unit test for it — so layout is fully
  // determined without the bytes.
  await page.route('**/*', (route) =>
    route.request().resourceType() === 'document' ? route.continue() : route.abort()
  );

  await page.setContent(ao3Page(html, css), { waitUntil: 'domcontentloaded' });
  const before = await measure(page, selectors);

  await page.evaluate(INJECT);
  const after = await measure(page, selectors);

  return { before, after };
}

/** Elements whose position carries meaning the reader would notice. */
const LOAD_BEARING: Record<string, string[]> = {
  ios: [
    '#workskin .row.out dl.msg',
    '#workskin .row.in dl.msg',
    '#workskin dd.bubble.out',
    '#workskin dd.bubble.in',
    '#workskin .ios-status-bar',
    '#workskin .ios-status-bar .time',
    '#workskin .ios-status-bar .status-icons',
    '#workskin .ios-input-bar',
    '#workskin .ios-input-bar .input-placeholder',
    '#workskin .typing-bubble',
    '#workskin .typing-bubble .dot',
  ],
  android: [
    '#workskin .row.out dl.msg',
    '#workskin .row.in dl.msg',
    '#workskin dd.bubble.out',
    '#workskin dd.bubble.in',
    '#workskin .typing-bubble',
    '#workskin .typing-bubble .dot',
  ],
  twitter: [
    '#workskin .tweet img.avatar',
    // The children, not just the line: `> *` damage lands on the wrapper, so
    // the container keeps its box while the parts inside lose their spacing.
    '#workskin .tweet .name',
    '#workskin .tweet .handle',
    '#workskin .tweet .follow-btn',
    '#workskin .tweet .twitter-logo',
    '#workskin .tweet .body',
    // The metrics row spreads with space-between. Injection collapses it to one
    // flex item unless display:contents rescues it — a real save bunched all
    // three counts to the left.
    '#workskin .tweet .metrics',
    '#workskin .tweet .metric',
    '#workskin .tweet .quote-head',
    '#workskin .tweet .quote-name',
    '#workskin .tweet .quote-handle',
  ],
  google: [
    '#workskin .search-tabs',
    '#workskin .search-tabs .tab',
    '#workskin .search-icons-right',
    '#workskin .search-text',
  ],
};

/**
 * The typing indicator kept its exact size while being made injection-proof.
 *
 * Moving it off flex was necessary — an inline `<span>` ignores width/height,
 * so once AO3 stopped the dots being flex items they measured 0x0 and the
 * indicator disappeared. But inline-block boxes sit on a text baseline, and the
 * line box that creates made the bubble 43px tall instead of 28. `line-height:0`
 * on the bubble is what holds the original geometry, and this pins it: the
 * stylesheet also drives the PNG, so a change here is a change to every image
 * anyone exports.
 */
test('the typing indicator is unchanged in the image export', async ({ page }) => {
  await page.route('**/*', (route) =>
    route.request().resourceType() === 'document' ? route.continue() : route.abort()
  );

  for (const template of ['ios', 'android'] as const) {
    const p = defaultProject();
    p.template = template;
    p.settings.chatShowTyping = true;
    p.settings.chatTypingName = 'Sam';

    const { html, css } = buildWorkSkin(p);
    await page.setContent(ao3Page(html, css), { waitUntil: 'domcontentloaded' });

    const size = await page.evaluate(() => {
      const box = (s: string) => {
        const r = document.querySelector(s)!.getBoundingClientRect();
        return `${Math.round(r.width)}x${Math.round(r.height)}`;
      };
      return { bubble: box('.typing-bubble'), dot: box('.typing-bubble .dot') };
    });

    expect(size.dot, `${template}: dots must keep a real size`).toBe('8x8');
    expect(size.bubble, `${template}: bubble must not grow a text line box`).toBe('60x28');
  }
});

for (const template of ['google', 'twitter', 'ios', 'android'] as const) {
  test(`${template}: an injected paragraph moves nothing`, async ({ page }) => {
    const { before, after } = await geometryUnderInjection(page, template, LOAD_BEARING[template]);

    expect(after.length, 'injection changed how many elements exist').toBe(before.length);

    const moved = before
      .map((b, i) => ({ b, a: after[i] }))
      .filter(({ b, a }) => b.x !== a.x || b.y !== a.y || b.w !== a.w || b.h !== a.h)
      .map(({ b, a }) =>
        `${b.sel}[${b.i}]  ${b.x},${b.y} ${b.w}x${b.h}  ->  ${a.x},${a.y} ${a.w}x${a.h}`
      );

    expect(moved, `${moved.length} element(s) moved:\n${moved.join('\n')}`).toEqual([]);
  });
}
