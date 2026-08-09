import { test, expect } from '@playwright/test';
import { buildCSS, buildHTML, PLATFORM_LOOK } from '../src/lib/generator';
import { defaultProject, SkinProject } from '../src/lib/schema';

/**
 * The reaction chip must never sit on the words.
 *
 * It is absolutely positioned, so the bubble only clears it if the bubble
 * RESERVES the space — with padding. A margin does not do this: it pushes the
 * neighbouring row away and leaves the chip lying on the bubble's own text,
 * which is not in flow with it.
 *
 * That distinction shipped wrong on 9 Aug 2026 and was invisible in the
 * browser, because the chip's edge landed within about a pixel of where the
 * text began. A pixel is not clearance: html2canvas draws text a few px lower
 * than the browser, so every exported PNG had the pill printed over the
 * message — a one-word bubble ("yes") lost its word outright — and a larger
 * reader font or AO3's paragraph injection would each have done the same on
 * the archive.
 *
 * These tests measure the real boxes rather than trusting the stylesheet to
 * read correctly, because reading it correctly is exactly what failed.
 */

const SCENARIOS: { label: string; template: 'ios' | 'android'; group: boolean }[] = [
  { label: 'iMessage 1-on-1', template: 'ios', group: false },
  { label: 'iMessage group', template: 'ios', group: true },
  { label: 'WhatsApp 1-on-1', template: 'android', group: false },
  { label: 'WhatsApp group', template: 'android', group: true },
];

function makeProject(template: 'ios' | 'android', group: boolean): SkinProject {
  const base = defaultProject();
  const participants = [{ id: 'p1', name: 'Knight', color: '#e8590c' }];
  return {
    ...base,
    template,
    settings: {
      ...base.settings,
      ...PLATFORM_LOOK[template],
      ...(template === 'ios'
        ? { iosGroupMode: group, iosGroupName: 'Group Chat', iosGroupParticipants: participants }
        : { androidGroupMode: group, androidGroupName: 'Group Chat', androidGroupParticipants: participants }),
    },
    messages: [
      // Long, wraps to two lines, outgoing.
      {
        id: 'm1',
        sender: 'You',
        content: "Where are you? I'm waiting at the cafe. See you soon.",
        outgoing: true,
        timestamp: '10:15',
        status: 'read',
        reaction: '🙏',
      },
      // Single line, incoming.
      { id: 'm2', sender: 'Alice', content: 'On my way — see you shortly!', outgoing: false, timestamp: '10:15', reaction: '❤️' },
      // The hard case: one short word, with a descender, in a group bubble.
      {
        id: 'm3',
        sender: 'Knight',
        content: 'yes',
        outgoing: false,
        ...(group ? { participantId: 'p1' } : {}),
        reaction: '🙏',
      },
      // The control the padding test compares against — same bubble, no chip.
      { id: 'm4', sender: 'Alice', content: 'ok', outgoing: false },
    ],
  };
}

for (const { label, template, group } of SCENARIOS) {
  test(`reaction chip never overlaps message text — ${label}`, async ({ page }) => {
    const project = makeProject(template, group);
    await page.setContent(
      `<!doctype html><html><head><meta charset="utf-8"><style>${buildCSS(project)}</style></head>
       <body style="margin:0"><div id="workskin">${buildHTML(project)}</div></body></html>`
    );

    const findings = await page.evaluate(() => {
      const results: { id: string; overlapPx: number; text: string }[] = [];

      document.querySelectorAll('dd.bubble.has-reaction').forEach((bubble, i) => {
        const chip = bubble.querySelector('.reaction') as HTMLElement | null;
        if (!chip) return;
        const c = chip.getBoundingClientRect();

        // Every text node in the bubble except the chip's own emoji.
        const walker = document.createTreeWalker(bubble, NodeFilter.SHOW_TEXT);
        let worst = -Infinity;
        let worstText = '';
        let node: Node | null;
        while ((node = walker.nextNode())) {
          if (chip.contains(node)) continue;
          const value = (node.textContent || '').trim();
          if (!value) continue;
          const range = document.createRange();
          range.selectNodeContents(node);
          for (const r of Array.from(range.getClientRects())) {
            if (r.width === 0 || r.height === 0) continue;
            // Only text the chip shares a column with can collide with it.
            const overlapX = Math.min(c.right, r.right) - Math.max(c.left, r.left);
            if (overlapX <= 0) continue;
            // Positive = overlapping. Negative = that many px of clear air,
            // which is what we actually require: shipping with ~1px of gap is
            // what put the pill on top of the words in every PNG.
            const overlapY = Math.min(c.bottom, r.bottom) - Math.max(c.top, r.top);
            if (overlapY > worst) {
              worst = overlapY;
              worstText = value;
            }
          }
        }

        results.push({
          id: (bubble.closest('[data-message-id]') as HTMLElement)?.dataset.messageId || `bubble-${i}`,
          overlapPx: worst === -Infinity ? 0 : Math.round(worst * 10) / 10,
          text: worstText,
        });
      });

      return results;
    });

    // Printed so the clearance can be tuned from numbers. Too little and the
    // pill lands on the words; too much and the bubble reads as hollow, with
    // the chip lost in a corner — which is how over-correcting this looked.
    for (const f of findings) {
      console.log(
        `  [MEASURE] ${label} ${f.id}: ${f.overlapPx > 0 ? `OVERLAP ${f.overlapPx}px` : `${-f.overlapPx}px clear`} of "${f.text}"`
      );
    }

    expect(findings.length, 'expected three reacted bubbles to be measured').toBe(3);
    for (const f of findings) {
      // -2 means two clear pixels between chip and text. Zero is not enough:
      // the shipped bug measured about -1 here and still printed the pill over
      // the message, because html2canvas draws text lower than the browser.
      expect(
        f.overlapPx,
        `chip is ${f.overlapPx > 0 ? `overlapping "${f.text}" by ${f.overlapPx}px` : `only ${-f.overlapPx}px clear of "${f.text}"`} in ${f.id} (${label})`
      ).toBeLessThanOrEqual(-2);
    }
  });

  test(`reaction chip never lands on a neighbouring message — ${label}`, async ({ page }) => {
    const project = makeProject(template, group);
    await page.setContent(
      `<!doctype html><html><head><meta charset="utf-8"><style>${buildCSS(project)}</style></head>
       <body style="margin:0"><div id="workskin">${buildHTML(project)}</div></body></html>`
    );

    // The other half of the problem. The chip hangs outside its own bubble, so
    // whatever space it needs has to come from somewhere — and the row above or
    // below is what it eats if nothing reserves it. This is deliberately not an
    // assertion about *which* CSS property does the reserving: WhatsApp puts
    // the pill fully below the bubble and reserves with margin, iMessage sits
    // it on the bubble's corner and reserves with padding. Both are correct;
    // what is never correct is the chip covering someone else's message.
    const collisions = await page.evaluate(() => {
      const out: { chipOf: string; hits: string; overlapPx: number }[] = [];
      const bubbles = Array.from(document.querySelectorAll('dd.bubble'));

      document.querySelectorAll('dd.bubble.has-reaction').forEach((owner) => {
        const chip = owner.querySelector('.reaction') as HTMLElement | null;
        if (!chip) return;
        const c = chip.getBoundingClientRect();

        for (const other of bubbles) {
          if (other === owner) continue;
          const o = other.getBoundingClientRect();
          const overlapX = Math.min(c.right, o.right) - Math.max(c.left, o.left);
          const overlapY = Math.min(c.bottom, o.bottom) - Math.max(c.top, o.top);
          if (overlapX > 0 && overlapY > 0) {
            out.push({
              chipOf: (owner.closest('[data-message-id]') as HTMLElement)?.dataset.messageId || '?',
              hits: (other.closest('[data-message-id]') as HTMLElement)?.dataset.messageId || '?',
              overlapPx: Math.round(Math.min(overlapX, overlapY) * 10) / 10,
            });
          }
        }
      });
      return out;
    });

    expect(
      collisions,
      `chip(s) overlapping another message: ${JSON.stringify(collisions)}`
    ).toEqual([]);
  });
}
