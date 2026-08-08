import { test, expect } from '@playwright/test';
import { buildWorkSkin } from '../src/lib/workSkin';
import { richProject } from './_ao3-render';

/**
 * What a reader gets when there is no CSS at all.
 *
 *   npx playwright test --project=desktop tests/skin-off.spec.ts
 *
 * This is not an edge case. AO3's FAQ says it twice — *"downloaded works don't
 * retain their work skin"* — so **every EPUB, MOBI and PDF is this rendering**,
 * plus anyone who uses Hide Creator's Style (`?style=disable`). Confirmed on a
 * real posted work: with the skin off our containers are still in the DOM and
 * none of our CSS is served, and an EPUB goes further — AO3's conversion strips
 * every `class` attribute, so structure and text are all that survive.
 *
 * ## Why this needs a browser when the unit suite already checks prose
 *
 * `work-skin.unit.spec.ts` strips tags from the HTML string. That glues adjacent
 * *block* elements together, so it reports run-ons no reader would ever see —
 * on 8 Aug 2026 it made Google's result title look like it ran into its
 * description, and a two-line tweet body look joined, and both were fine. Only a
 * browser knows where the line breaks are, so this reads `innerText`.
 *
 * Keep both: the unit test is the fast gate on the *words* being present, this
 * one is the gate on how they actually read.
 */

/** The rendering AO3 serves with the work skin off: our markup, no stylesheet. */
async function readAsPlainHtml(page: import('@playwright/test').Page, html: string) {
  await page.setContent(
    `<!doctype html><meta charset="utf-8"><body><div id="workskin">${html}</div></body>`,
    { waitUntil: 'load' }
  );
  return page.evaluate(() => (document.querySelector('#workskin') as HTMLElement).innerText);
}

function groupChat(template: 'ios' | 'android') {
  const p = richProject(template);
  p.settings.iosGroupMode = true;
  p.settings.androidGroupMode = true;
  const participants = [
    { id: 'p1', name: 'Alex', color: '#f00', avatarUrl: '' },
    { id: 'p2', name: 'Jordan', color: '#0f0', avatarUrl: '' },
  ];
  p.settings.iosGroupParticipants = participants as never;
  p.settings.androidGroupParticipants = participants as never;
  p.messages = [
    { id: '1', sender: 'Alex', content: 'Anyone free for coffee tomorrow?', outgoing: false, timestamp: '11:30 AM', participantId: 'p1' },
    { id: '2', sender: 'You', content: 'Count me in', outgoing: true, timestamp: '11:33 AM' },
  ] as typeof p.messages;
  return p;
}

for (const template of ['ios', 'android'] as const) {
  /**
   * The defect this pins, measured on a real posted work with Hide Creator's
   * Style on:
   *
   * ```text
   * Alex:                                      <- the hidden speaker label
   * AL                                         <- the avatar monogram
   * Alex                                       <- the visible group name
   * Anyone free for coffee tomorrow? 11:30 AM
   * ```
   *
   * Three names for one speaker. The label is redundant the moment a group row
   * renders the name as visible text, so `msgHTML` now leaves it out there.
   */
  test(`${template}: a group chat names each speaker once, not three times`, async ({ page }) => {
    const read = await readAsPlainHtml(page, buildWorkSkin(groupChat(template)).html);

    expect(read, 'the visible group name must survive').toContain('Alex');
    expect(read, 'the speaker label is doubling the visible name').not.toContain('Alex:');
    // The message still follows its speaker.
    expect(read.replace(/\s+/g, ' ')).toContain('Alex Anyone free for coffee tomorrow?');
    // Outgoing rows have no visible name, so they keep the label.
    expect(read).toContain('You:');
  });

  test(`${template}: a one-to-one chat still labels every speaker`, async ({ page }) => {
    // The other half. Without a visible name there is nothing to attribute a
    // bubble to, which is the whole reason the label exists (§9a).
    const p = richProject(template);
    p.messages = [
      { id: '1', sender: 'Sam', content: 'hey', outgoing: false, timestamp: '10:23' },
      { id: '2', sender: 'You', content: 'you free tonight?', outgoing: true, timestamp: '10:24' },
    ] as typeof p.messages;

    const read = (await readAsPlainHtml(page, buildWorkSkin(p).html)).replace(/\s+/g, ' ');
    expect(read).toContain('Sam: hey 10:23');
    expect(read).toContain('You: you free tonight? 10:24');
  });
}

test('a Google search reads as prose, with its results separated', async ({ page }) => {
  const p = richProject('google');
  p.settings.googleQuery = 'what happened to the lighthouse keeper';
  const read = await readAsPlainHtml(page, buildWorkSkin(p).html);

  expect(read).toContain('Searched for: what happened to the lighthouse keeper.');
  expect(read).toContain('Search tabs:');
  // Each result announces itself, and lands on its own line rather than running
  // into the one before it.
  expect(read).toMatch(/^Result 1, from /m);
  expect(read).toMatch(/^Result 2, from /m);
});

test('a tweet says who tweeted and what the counts mean', async ({ page }) => {
  const p = richProject('twitter');
  p.messages = [{
    id: '1', sender: 'Alex Rivers', content: 'the moth is back', outgoing: true,
    timestamp: '2:15 PM', twitterHandle: 'alexrivers',
    twitterLikes: 847, twitterRetweets: 89, twitterReplies: 156,
    useCustomIdentity: true,
  } as (typeof p.messages)[number]];

  const read = (await readAsPlainHtml(page, buildWorkSkin(p).html)).replace(/\s+/g, ' ');
  expect(read).toContain('Alex Rivers');
  expect(read).toContain('tweeted:');
  expect(read).toContain('the moth is back');
  expect(read).toMatch(/156 replies/);
  expect(read).toMatch(/89 retweets/);
  expect(read).toMatch(/847 likes/);
});
