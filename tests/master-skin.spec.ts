import { test, expect } from '@playwright/test';
import { buildMasterWorkSkin, buildWorkSkin } from '../src/lib/workSkin';
import { richProject, stableDiff, stubRemoteImages } from './_ao3-render';

/**
 * Does one skin carrying all four platforms render each of them the way that
 * platform's own skin does?
 *
 *   npx playwright test --project=desktop tests/master-skin.spec.ts
 *
 * That is the whole contract of `buildMasterWorkSkin` (WORK-SKIN §10c), and it
 * is the same shape as the invariant that made the palette refactor safe: the
 * output must be indistinguishable from what it replaces, measured rather than
 * argued.
 *
 * ## Why a browser, when `namespace.spec.ts` already passed
 *
 * That suite proves one platform's namespaced sheet renders like its
 * un-namespaced self, **alone on the page**. This one adds the stylesheets that
 * were not there: rules for three platforms this markup is not, plus a theme
 * variant per platform, all in the same cascade. A selector that escapes its
 * block — or an `#workskin`-rooted rule that never got scoped — matches silently
 * and looks exactly like a rule somebody forgot to write.
 *
 * ## What is compared, and what is deliberately not
 *
 * Each platform is compared against **its own single-platform export built from
 * the same project**, which is what an author sees in the preview beside the
 * modal. The blocks for the *other* three platforms are built from those
 * platforms' own looks instead (`withPlatformLook`), because shared bubble
 * colours leaking across platforms is what put blue bubbles in a WhatsApp block
 * on a real posted work — WORK-SKIN §16. Those blocks are pinned by the unit
 * suite rather than here, since this markup cannot exercise them.
 */

/** The same rich project with every platform's theme flag forced. */
function themed(template: string, theme: 'light' | 'dim' | 'dark') {
  const p = richProject(template);
  const dark = theme === 'dark';
  p.settings.twitterTheme = theme;
  p.settings.twitterDarkMode = dark;
  p.settings.iosDarkMode = dark;
  p.settings.androidDarkMode = dark;
  return p;
}

for (const template of ['ios', 'android', 'twitter', 'google'] as const) {
  test.describe(template, () => {
    test('renders exactly as the single-platform skin does', async ({ page }) => {
      await stubRemoteImages(page);
      const project = richProject(template);
      const single = buildWorkSkin(project);
      const master = buildMasterWorkSkin(project);

      // The markup is the same either way — the master skin changes the
      // stylesheet, not what the author pastes into the chapter.
      expect(master.html, 'the master export changed the HTML').toBe(single.html);

      const problems = await stableDiff(
        page,
        { html: single.html, css: single.css },
        { html: master.html, css: master.css }
      );
      expect(problems, `the master skin renders ${template} differently:\n${problems.join('\n')}`)
        .toEqual([]);
    });

    test('and still does under AO3 paragraph injection', async ({ page }) => {
      await stubRemoteImages(page);
      const project = richProject(template);
      const single = buildWorkSkin(project);
      const master = buildMasterWorkSkin(project);

      const problems = await stableDiff(
        page,
        { html: single.html, css: single.css },
        { html: master.html, css: master.css },
        { injected: true }
      );
      expect(problems, `the master skin renders ${template} differently under injection:\n${problems.join('\n')}`)
        .toEqual([]);
    });

    // Google has no theme, so there is no second palette to carry.
    if (template === 'google') return;

    /**
     * BACKLOG 8 — both themes in one skin.
     *
     * The skin is always built from the **opposite** theme to the block being
     * rendered, so the base block is never the one under test: everything the
     * reader sees has to come from the variant block, and anything it fails to
     * carry shows up as a colour that did not change.
     *
     * This is the case that caught the first implementation. It emitted a
     * *diff* of the two builds — 64 rules of pure colour rather than a second
     * stylesheet — and one of those rules tied on specificity with a more
     * specific base rule and, coming later, beat it: a tweet with no metrics
     * kept a hairline the base sheet had removed. Nothing static could see it.
     *
     * Both directions, because the variant is symmetric — an author working in
     * dark mode needs the light one carried, not "a dark mode added".
     */
    for (const [base, block] of [['light', 'dark'], ['dark', 'light']] as const) {
      test(`a ${block} block renders from the variant when the skin was built ${base}`, async ({ page }) => {
        await stubRemoteImages(page);
        const { css: masterCss } = buildMasterWorkSkin(themed(template, base));
        const single = buildWorkSkin(themed(template, block));

        const problems = await stableDiff(
          page,
          { html: single.html, css: single.css },
          { html: single.html, css: masterCss }
        );
        expect(problems, `the ${base}-built master skin renders a ${block} ${template} differently:\n${problems.join('\n')}`)
          .toEqual([]);
      });

      test(`a ${block} block renders from the variant under injection too (${base}-built)`, async ({ page }) => {
        await stubRemoteImages(page);
        const { css: masterCss } = buildMasterWorkSkin(themed(template, base));
        const single = buildWorkSkin(themed(template, block));

        const problems = await stableDiff(
          page,
          { html: single.html, css: single.css },
          { html: single.html, css: masterCss },
          { injected: true }
        );
        expect(problems, `injected: the ${base}-built master skin renders a ${block} ${template} differently:\n${problems.join('\n')}`)
          .toEqual([]);
      });
    }

    if (template === 'twitter') {
      test('a dim block renders from the variant when the skin was built light', async ({ page }) => {
        await stubRemoteImages(page);
        const { css: masterCss } = buildMasterWorkSkin(themed(template, 'light'));
        const single = buildWorkSkin(themed(template, 'dim'));
        const problems = await stableDiff(
          page,
          { html: single.html, css: single.css },
          { html: single.html, css: masterCss },
          { injected: true }
        );
        expect(problems, `the master skin renders dim Twitter differently:\n${problems.join('\n')}`)
          .toEqual([]);
      });
    }
  });
}
