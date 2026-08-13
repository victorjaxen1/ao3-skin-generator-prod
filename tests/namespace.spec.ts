import { test, expect } from '@playwright/test';
import { buildWorkSkin, namespaceCss } from '../src/lib/workSkin';
import { richProject, stableDiff, stubRemoteImages } from './_ao3-render';

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
 * 1. **The class alone changes nothing.** `buildHTML` emits `class="chat ios
 *    theme-light"` on every path including the PNG, so the first thing to
 *    establish is that no stylesheet anywhere — ours, or the archive's own —
 *    has a rule that matches a bare `.ios` or `.theme-light`. This is the half
 *    that ships to authors immediately.
 * 2. **The rewrite alone changes nothing**, on the same markup.
 * 3. **Both hold under AO3's paragraph injection**, because the `display:
 *    contents` rules that make injection survivable are themselves namespaced,
 *    and a rule that stops matching there fails geometrically rather than
 *    loudly (see `ao3-injection.spec.ts`).
 *
 * Every comparison goes through `stableDiff`, which renders one side twice and
 * throws its verdict away unless those two agree — see `_ao3-render.ts` for the
 * ghost that made that necessary.
 */

for (const template of ['ios', 'android', 'twitter', 'google'] as const) {
  test.describe(template, () => {
    test('the platform class on its own changes nothing', async ({ page }) => {
      await stubRemoteImages(page);
      const { html, css } = buildWorkSkin(richProject(template));

      // The same markup with the platform class taken back off the container.
      const without = html.replace(new RegExp(`(<div class="chat) ${template}\\b`), '$1');
      expect(without, 'the container should have carried a platform class').not.toBe(html);

      const problems = await stableDiff(page, { html: without, css }, { html, css });
      expect(problems, `adding .${template} moved something:\n${problems.join('\n')}`).toEqual([]);
    });

    test('the theme class on its own changes nothing either', async ({ page }) => {
      // `buildHTML` emits a theme class beside the platform
      // class, on every path including the PNG. It is the hook the master
      // skin's variant block aims at (BACKLOG 8) and is inert without one —
      // but "inert" is a claim about every stylesheet on the page, ours and
      // AO3's, so it is measured rather than asserted. Google has no theme.
      await stubRemoteImages(page);
      const { html, css } = buildWorkSkin(richProject(template));

      const without = html.replace(/(<div class="chat [a-z]+) theme-(?:light|dim|dark)/, '$1');
      if (template === 'google') {
        expect(without, 'google should carry no theme class').toBe(html);
        return;
      }
      expect(without, 'the container should have carried a theme class').not.toBe(html);

      const problems = await stableDiff(page, { html: without, css }, { html, css });
      expect(problems, `adding the theme class moved something:\n${problems.join('\n')}`)
        .toEqual([]);
    });

    test('namespacing the stylesheet changes nothing', async ({ page }) => {
      await stubRemoteImages(page);
      const { html, css } = buildWorkSkin(richProject(template));

      const problems = await stableDiff(
        page,
        { html, css },
        { html, css: namespaceCss(css, template) }
      );
      expect(problems, `namespacing moved something:\n${problems.join('\n')}`).toEqual([]);
    });

    test('namespacing changes nothing under AO3 paragraph injection either', async ({ page }) => {
      await stubRemoteImages(page);
      const { html, css } = buildWorkSkin(richProject(template));

      const problems = await stableDiff(
        page,
        { html, css },
        { html, css: namespaceCss(css, template) },
        { injected: true }
      );
      expect(problems, `namespacing moved something under injection:\n${problems.join('\n')}`)
        .toEqual([]);
    });
  });
}
