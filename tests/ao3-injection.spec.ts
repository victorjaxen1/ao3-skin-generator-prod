import { test, expect, Page } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';
import { buildWorkSkin } from '../src/lib/workSkin';
import { defaultProject } from '../src/lib/schema';

const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

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

async function geometryUnderInjection(
  page: Page,
  template: string,
  selectors: string[],
  customise?: (p: ReturnType<typeof defaultProject>) => void
) {
  const p = defaultProject();
  p.template = template as typeof p.template;
  // Optional chrome is off by default, and every one of these is a flex row of
  // inline children — exactly the shape injection breaks. Turned on so the
  // harness measures them instead of silently skipping them.
  // The phone frame is what has somewhere to put a status bar and an input bar.
  // Without it those two settings render nothing and the harness would quietly
  // stop measuring the very rows injection is most likely to break.
  p.settings.iosFrameMode = 'phone';
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

  customise?.(p);

  const { html, css } = buildWorkSkin(p);

  // Fulfil images rather than aborting them: Chromium's broken-image
  // placeholder can change geometry after layout and create a false diff.
  await page.route('**/*', (route) => {
    if (route.request().resourceType() === 'document') return route.continue();
    if (route.request().resourceType() === 'image') return route.fulfill({ contentType: 'image/png', body: PIXEL });
    return route.abort();
  });

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

    // A BARE 16px context, deliberately not ao3Page(). This test is about the
    // image export, and html2canvas renders the preview at the browser default
    // — not inside `.userstuff`, which computes to about 15px. Measuring in
    // AO3's context reported 57x26 and looked like a regression when it was
    // the em conversion doing exactly its job.
    await page.setContent(`<style>${css}</style><div id="workskin">${html}</div>`, {
      waitUntil: 'domcontentloaded',
    });

    const box = (s: string) =>
      page.evaluate((sel) => {
        const r = document.querySelector(sel)!.getBoundingClientRect();
        return `${Math.round(r.width)}x${Math.round(r.height)}`;
      }, s);

    expect(await box('.typing-bubble .dot'), `${template}: dots must keep a real size`)
      .toBe('8x8');
    expect(await box('.typing-bubble'), `${template}: bubble must not grow a text line box`)
      .toBe('60x28');

    // And the point of the em conversion: inside AO3's own stylesheet the same
    // bubble scales DOWN to the reader's text rather than overhanging it.
    await page.setContent(ao3Page(html, css), { waitUntil: 'domcontentloaded' });
    const inAo3 = await box('.typing-bubble');
    expect(inAo3, `${template}: should scale with .userstuff, not stay 60x28`)
      .not.toBe('60x28');
  }
});

/**
 * The two Twitter modes the per-platform tests above never reach.
 *
 * `.tweet.expanded` is a flex row whose first child is a bare `<img>`, and it
 * still uses a child combinator for its gap — so it has both failure shapes at
 * once. Thread mode adds `.tweet.reply`, whose connector lines are `::before` /
 * `::after` on a positioned ancestor and should be indifferent to injection.
 *
 * Both were fixed defensively during the 17b pass and neither was measured.
 */
test('the expanded view and threaded replies survive injection', async ({ page }) => {
  const { before, after } = await geometryUnderInjection(
    page,
    'twitter',
    [
      '#workskin .tweet.expanded',
      '#workskin .tweet.expanded .avatar',
      '#workskin .tweet.expanded .expanded-content',
      '#workskin .tweet.expanded .expanded-name .name',
      '#workskin .tweet.expanded .expanded-body',
      '#workskin .tweets .tweet.reply',
      '#workskin .tweet .name-line .handle',
    ],
    (p) => {
      p.settings.twitterThreadMode = true;
      p.messages = [
        { id: 'a', sender: 'Alex Rivers', content: 'the moth is back', outgoing: true,
          timestamp: '2:15 PM', twitterHandle: 'alexrivers', useCustomIdentity: true,
          twitterLikes: 847, twitterRetweets: 89, twitterReplies: 156 },
        { id: 'b', sender: 'Sam', content: 'it never left', outgoing: false, parentId: 'a',
          timestamp: '2:17 PM', twitterHandle: 'sam', useCustomIdentity: true,
          replyToHandles: ['alexrivers'] },
        { id: 'c', sender: 'Alex Rivers', content: 'do not say that', outgoing: true,
          timestamp: '2:20 PM', twitterHandle: 'alexrivers', useCustomIdentity: true,
          expandedView: true },
      ] as typeof p.messages;
    }
  );

  expect(after.length, 'injection changed how many elements exist').toBe(before.length);

  // Guard against the worst kind of green: this test would pass trivially if
  // the fixture stopped producing expanded or threaded tweets, since nothing
  // can move if nothing is there. Name them rather than counting.
  for (const required of ['#workskin .tweet.expanded', '#workskin .tweets .tweet.reply']) {
    expect(
      before.filter((b) => b.sel === required).length,
      `fixture rendered no ${required} — the test would be vacuous`
    ).toBeGreaterThan(0);
  }

  const moved = before
    .map((b, i) => ({ b, a: after[i] }))
    .filter(({ b, a }) => b.x !== a.x || b.y !== a.y || b.w !== a.w || b.h !== a.h)
    .map(({ b, a }) =>
      `${b.sel}[${b.i}]  ${b.x},${b.y} ${b.w}x${b.h}  ->  ${a.x},${a.y} ${a.w}x${a.h}`
    );

  expect(moved, `${moved.length} element(s) moved:\n${moved.join('\n')}`).toEqual([]);
});

test('Twitter media grids, per-post quotes, polls, and video fallbacks survive injection', async ({ page }) => {
  const { before, after } = await geometryUnderInjection(
    page,
    'twitter',
    ['.twitter-media-grid', '.quote', '.twitter-poll', '.twitter-video-card'],
    p => {
      p.settings.twitterQuoteEnabled = false;
      p.settings.twitterTheme = 'dim';
      p.messages = [
        {
          id: 'rich', sender: 'User', content: 'Rich post', outgoing: true,
          attachments: [1, 2, 3, 4].map(number => ({ type: 'image' as const, url: `https://example.com/${number}.png`, alt: `Image ${number}` })),
          twitterQuote: { name: 'Witness', handle: 'witness', text: 'Quoted evidence.' },
          twitterPoll: { state: 'closed', options: [{ id: 'yes', text: 'Yes', percent: 60 }, { id: 'no', text: 'No', percent: 40 }] },
        },
        {
          id: 'video', sender: 'User', content: 'Video post', outgoing: true,
          twitterVideo: { source: 'youtube', url: 'https://youtu.be/bN8449nalT8', posterUrl: 'https://example.com/poster.png', title: 'Clip', description: 'Fallback transcript.' },
        },
      ];
    }
  );
  expect(after).toEqual(before);
});

/**
 * Group chat, the last injection case, and the one the rule predicts is safe.
 *
 * iOS still uses `.group-sender-row`, a flex row containing an avatar and name.
 * WhatsApp v6 deliberately uses the simpler block `.group-sender`. Both live
 * inside a `<dd>`, and the stored markup shows AO3 wrapping nothing there.
 *
 * That prediction is worth testing rather than trusting: it is the only thing
 * standing between this row and the same collapse, and one avatar sits in a
 * `.group-avatar-initials` div, which is a different container again.
 */
test('group chat survives injection, as the dd rule predicts', async ({ page }) => {
  for (const template of ['ios', 'android'] as const) {
    // iOS lost its `.group-sender-row` wrapper when the renderer was extracted.
    // That div existed only to carry the inline flex styles AO3 strips from
    // every element, so it was doing nothing on the archive; the avatar and the
    // name are now inline-block siblings inside the bubble, which survives the
    // paragraph injection this test measures.
    const senderContainer = template === 'ios'
      ? '#workskin dd.bubble .ios-group-sender'
      : '#workskin dd.bubble .group-sender';
    const { before, after } = await geometryUnderInjection(
      page,
      template,
      [
        senderContainer,
        ...(template === 'ios' ? ['#workskin dd.bubble .group-avatar-initials'] : []),
        '#workskin dd.bubble.in',
      ],
      (p) => {
        const participants = [
          { id: 'p1', name: 'Sam Okafor', color: '#e0245e' },
          { id: 'p2', name: 'Riya Patel', color: '#1d9bf0' },
        ];
        if (template === 'ios') {
          p.settings.iosGroupMode = true;
          p.settings.iosGroupName = 'The Group';
          p.settings.iosGroupParticipants = participants;
        } else {
          p.settings.androidGroupMode = true;
          p.settings.androidGroupName = 'The Group';
          p.settings.androidGroupParticipants = participants;
        }
        p.messages = [
          { id: '1', sender: 'Sam Okafor', content: 'anyone up', outgoing: false,
            timestamp: '10:23', participantId: 'p1' },
          { id: '2', sender: 'Riya Patel', content: 'unfortunately', outgoing: false,
            timestamp: '10:24', participantId: 'p2' },
          { id: '3', sender: 'You', content: 'go to sleep', outgoing: true, timestamp: '10:25' },
        ] as typeof p.messages;
      }
    );

    expect(
      before.filter((b) => b.sel === senderContainer).length,
      `${template}: fixture rendered no sender identity — the test would be vacuous`
    ).toBeGreaterThan(0);

    const moved = before
      .map((b, i) => ({ b, a: after[i] }))
      .filter(({ b, a }) => b.x !== a.x || b.y !== a.y || b.w !== a.w || b.h !== a.h)
      .map(({ b, a }) =>
        `${b.sel}[${b.i}]  ${b.x},${b.y} ${b.w}x${b.h}  ->  ${a.x},${a.y} ${a.w}x${a.h}`
      );

    expect(moved, `${template}: ${moved.length} moved:\n${moved.join('\n')}`).toEqual([]);
  }
});

/**
 * The iOS structured blocks, under the same paragraph injection.
 *
 * The lint can see none of this: reply quotes, image collages, link cards and
 * media cards are all legal CSS either way, and the failure is geometric. AO3
 * wraps bare inline children in `<p>`, which does not strip layout — it *moves*
 * it, so anything relying on a direct-child relationship silently stops
 * matching. That is exactly the shape of a four-image collage.
 */
test('iOS reply, image collage, link card, and media cards survive injection', async ({ page }) => {
  const selectors = [
    '#workskin blockquote.ios-reply',
    '#workskin .ios-images',
    '#workskin .ios-image',
    '#workskin a.ios-link-preview',
    '#workskin .ios-audio-card',
    '#workskin .ios-video-card',
    '#workskin .ios-tapbacks',
    '#workskin .ios-event',
    '#workskin dd.bubble.in',
    '#workskin dd.bubble.out',
  ];
  const { before, after } = await geometryUnderInjection(page, 'ios', selectors, (p) => {
    p.messages = [
      { id: 'date', sender: '', content: '', outgoing: false, iosEvent: { kind: 'date', text: 'Today' } },
      { id: 'a', sender: 'Sam', content: 'The side door is open.', outgoing: false, timestamp: '22:14' },
      { id: 'b', sender: 'You', content: 'Checking now.', outgoing: true, timestamp: '22:16', iosReply: { messageId: 'a' } },
      { id: 'photos', sender: 'You', content: 'Four views.', outgoing: true, timestamp: '22:17',
        attachments: [1, 2, 3, 4].map(i => ({ type: 'image' as const, url: `https://example.com/door-${i}.png`, alt: `Door view ${i}` })) },
      { id: 'link', sender: 'Sam', content: 'Log here.', outgoing: false, timestamp: '22:18',
        iosLinkPreview: { url: 'https://example.com/log', title: 'Access log', siteName: 'example.com', description: 'Recent entries.' } },
      { id: 'voice', sender: 'Sam', content: '', outgoing: false, timestamp: '22:19',
        iosMedia: { kind: 'audio', url: 'https://example.com/note.mp3', mimeType: 'audio/mpeg', duration: '0:08', transcript: 'The latch moved.' } },
      { id: 'video', sender: 'You', content: '', outgoing: true, timestamp: '22:20',
        iosTapbacks: [{ emoji: '😮', count: 2 }],
        iosMedia: { kind: 'video', source: 'direct', url: 'https://example.com/door.mp4', mimeType: 'video/mp4', posterUrl: 'https://example.com/p.png', duration: '0:12', description: 'The door swings in.' } },
    ] as typeof p.messages;
  });

  for (const selector of selectors) {
    expect(
      before.filter(b => b.sel === selector).length,
      `${selector} rendered nothing — the test would be vacuous`
    ).toBeGreaterThan(0);
  }

  expect(after.length, 'injection changed how many elements exist').toBe(before.length);

  const moved = before
    .map((b, i) => ({ b, a: after[i] }))
    .filter(({ b, a }) => b.x !== a.x || b.y !== a.y || b.w !== a.w || b.h !== a.h)
    .map(({ b, a }) => `${b.sel}[${b.i}]  ${b.x},${b.y} ${b.w}x${b.h}  ->  ${a.x},${a.y} ${a.w}x${a.h}`);

  expect(moved, `${moved.length} moved:\n${moved.join('\n')}`).toEqual([]);
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
