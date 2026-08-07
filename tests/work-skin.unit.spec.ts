import { test, expect } from '@playwright/test';
import { buildWorkSkin, supportsWorkSkin } from '../src/lib/workSkin';
import { defaultProject } from '../src/lib/schema';
import { buildCSS } from '../src/lib/generator';
import { lintAo3Css, isAo3Safe } from '../src/lib/siteSkin/ao3Css';

/**
 * The work-skin export exists only if AO3 would actually accept it. AO3
 * refuses a whole skin over one bad property, so "mostly legal" is the same as
 * broken — these tests are the gate, not a smoke check.
 */

function twitter() {
  const p = defaultProject();
  p.template = 'twitter';
  return p;
}

test.describe('the Twitter work skin', () => {
  test('compiles to CSS AO3 accepts, with nothing left over', () => {
    expect(lintAo3Css(buildWorkSkin(twitter()).css, 'work')).toEqual([]);
  });

  test('passes the site rules too, so the two modes cannot drift apart', () => {
    expect(lintAo3Css(buildWorkSkin(twitter()).css, 'site')).toEqual([]);
  });

  test('emits no `gap`, which AO3 rejects while allowing column-gap', () => {
    // The substring quirk: `column-gap` contains "column" and passes, bare
    // `gap` matches no shorthand at all. This was the only thing standing
    // between the Twitter stylesheet and being a legal work skin.
    const css = buildCSS(twitter());
    expect(css).not.toMatch(/[;{]\s*gap\s*:/);
    expect(css).toContain('margin-right:12px');
  });

  test('uses no element AO3 strips from work HTML', () => {
    const { html } = buildWorkSkin(twitter());
    // `button` and `svg` are both absent from AO3's allowed element list, and
    // svg is removed together with its contents.
    expect(html).not.toContain('<button');
    expect(html).not.toContain('<svg');
    // The follow control survives as a span carrying the same class.
    expect(html).toContain('class="follow-btn"');
  });

  test('drops the editor-only attribute the sanitizer would strip anyway', () => {
    expect(buildWorkSkin(twitter()).html).not.toContain('data-message-id');
  });

  test('survives a reader hiding Creator\'s Style', () => {
    // AO3 lets any reader switch the work skin off, at which point none of our
    // CSS applies and only the HTML is left. Community skins handle this by
    // carrying intrinsic sizes as attributes and using semantic emphasis —
    // otherwise an unstyled tweet is a full-size avatar above a run-on line.
    const { html } = buildWorkSkin(twitter());

    // Every image states its own size, so nothing renders at natural size.
    for (const tag of html.match(/<img[^>]*>/g) ?? []) {
      expect(tag, tag).toMatch(/\bwidth="\d+"/);
      expect(tag, tag).toMatch(/\bheight="\d+"/);
    }

    // The poster's name is emphasised by the markup, not only by a class.
    expect(html).toContain('<b class="name">');

    // And the name does not run into the handle when nothing is styling them.
    expect(html).not.toMatch(/<\/b><span class="handle">/);
  });

  test('an unconfigured tweet emits no empty metrics band', () => {
    // `.metrics` carries padding and a bottom border, so rendering it with no
    // counts drew two rules around an empty space — visible both in the image
    // export and on AO3.
    const { html } = buildWorkSkin(twitter());
    expect(html).not.toContain('<div class="metrics"></div>');
    expect(html).toContain('no-metrics');
  });

  test('every image source is absolute https, not a site-relative path', () => {
    // AO3 rewrites a relative img src against its OWN domain, so
    // /assets/twitter-logo.png becomes archiveofourown.org/assets/... and
    // 404s — a broken-image box in somebody's published fic.
    const { html } = buildWorkSkin(twitter());
    const sources = [...html.matchAll(/<img[^>]+src="([^"]*)"/g)].map(m => m[1]);
    expect(sources.length).toBeGreaterThan(0);
    for (const src of sources) {
      expect(src, src).toMatch(/^https:\/\//);
    }
  });
});

test.describe('work-skin-only rules, from WorkSkin#clean_css', () => {
  // All three are legal in a SITE skin, which is exactly why they need their
  // own mode rather than being folded into the shared checks.
  test('custom properties are refused', () => {
    const css = '#workskin .x { --brand: #fff; color: #fff; }';
    expect(isAo3Safe(css, 'site')).toBe(true);
    expect(lintAo3Css(css, 'work').some(v => v.kind === 'work_skin_custom_property')).toBe(true);
  });

  test('var() is refused anywhere, not just inside content', () => {
    const css = '#workskin .x { color: var(--brand); }';
    expect(isAo3Safe(css, 'site')).toBe(true);
    expect(lintAo3Css(css, 'work').some(v => v.kind === 'work_skin_var')).toBe(true);
  });

  test('position: fixed is refused', () => {
    const css = '#workskin .x { position: fixed; color: #fff; }';
    expect(isAo3Safe(css, 'site')).toBe(true);
    expect(lintAo3Css(css, 'work').some(v => v.kind === 'work_skin_position_fixed')).toBe(true);
  });

  test('position: absolute is still fine', () => {
    expect(isAo3Safe('#workskin .x { position: absolute; }', 'work')).toBe(true);
  });
});

test.describe('which platforms are offered', () => {
  test('only the ones whose CSS actually passes', () => {
    for (const template of ['twitter', 'google']) {
      expect(supportsWorkSkin(template), template).toBe(true);
      const p = defaultProject();
      p.template = template as 'twitter' | 'google';
      expect(lintAo3Css(buildCSS(p), 'work'), template).toEqual([]);
    }
    for (const template of ['ios', 'android']) {
      expect(supportsWorkSkin(template), template).toBe(false);
    }
  });

  test('the unsupported ones are unsupported for a reason we can point at', () => {
    // If this starts failing because a platform became clean, that platform is
    // ready to ship — add it to SUPPORTED rather than deleting the assertion.
    for (const template of ['ios', 'android'] as const) {
      const p = defaultProject();
      p.template = template;
      expect(lintAo3Css(buildCSS(p), 'work').length, template).toBeGreaterThan(0);
    }
  });
});
