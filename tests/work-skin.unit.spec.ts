import { test, expect } from '@playwright/test';
import { buildWorkSkin, supportsWorkSkin } from '../src/lib/workSkin';
import { defaultProject } from '../src/lib/schema';
import { buildCSS, buildHTML } from '../src/lib/generator';
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
    // The spacing gap used to provide is now margins. Matched as a shape
    // rather than a literal, so converting the stylesheet's units doesn't look
    // like the gap regression this test exists to catch.
    expect(css).toMatch(/margin-right:\s*[\d.]+em/);
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

  /**
   * The skin is absent far more often than "a reader pressed Hide Creator's
   * Style". AO3's own FAQ states it twice: "downloaded works don't retain their
   * work skin", and readers can disable custom work skins in Preferences. Every
   * EPUB, MOBI and PDF is a skin-off rendering.
   *
   * So the export has to read as prose without any CSS, which is what the
   * community's `.hide` pattern buys. We use an off-screen span rather than
   * `display: none` so the connective text also reaches screen readers.
   */
  test('reads as prose, not as a pile of nouns, when no CSS applies', () => {
    const p = twitter();
    p.messages = [{
      id: '1', sender: 'Alex Rivers', content: 'the moth is back', outgoing: true,
      timestamp: '2:15 PM', twitterHandle: 'alexrivers',
      twitterLikes: 847, twitterRetweets: 89, twitterReplies: 156,
      useCustomIdentity: true,
    } as (typeof p.messages)[number]];

    const { html, css } = buildWorkSkin(p);

    // The mechanism: hidden while styled, plain text when not.
    expect(css).toMatch(/\.visually-hidden\{[^}]*position:absolute/);

    // Strip every tag, exactly as a download would once the CSS is gone.
    const asRead = html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

    // The "· Follow" between them is chrome we still render in both states —
    // it cannot move into a CSS pseudo-element without vanishing from the PNG.
    // Noted as a rough edge; the sentence still reads.
    expect(asRead).toContain('Alex Rivers (@alexrivers) · Follow tweeted: the moth is back');
    // Counts carry their nouns, instead of reading "156 89 847".
    expect(asRead).toMatch(/156 replies/);
    expect(asRead).toMatch(/89 retweets/);
    expect(asRead).toMatch(/847 likes/);
    // The X logo is chrome; it must not announce itself mid-sentence.
    expect(html).not.toContain('alt="X"');
  });

  /**
   * AO3 forbids @media in skin CSS — media is a field on the skin record — so
   * em is the only lever that makes a fixed-width card fit a phone, and it is
   * what AO3's FAQ recommends for accessibility. Pinned as a shape so the
   * stylesheet cannot quietly drift back to px.
   */
  test('is sized in em, so it scales with the reader rather than overhanging', () => {
    const css = buildCSS(twitter());

    expect(css).toContain('#workskin .chat{width:34.375em');

    // Comments off first — this stylesheet's own comment explains the 16px
    // base it was converted against, and scanning raw text would read that as
    // a stray px value. (The same oversight was live in lintAo3Css, which
    // searched for @media before stripping comments.)
    const declarations = css.replace(/\/\*[\s\S]*?\*\//g, '');

    // Only hairline borders and the off-screen offset may stay in px.
    const strayPx = (declarations.match(/[:\s](-?[\d.]+)px/g) ?? [])
      .map(m => parseFloat(m.slice(1)))
      .filter(v => Math.abs(v) > 2);
    expect(strayPx, `px values that should be em: ${strayPx.join(', ')}`).toEqual([-9999]);

    // AO3's number grammar is -?\.?\d{1,3}\.?\d{0,3}: a fourth decimal is read
    // as a separate token and our tokenising lint rejects the declaration.
    expect(declarations, 'em values must have at most 3 decimal places').not.toMatch(/[\d.]+\.\d{4,}em/);
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
  /**
   * All four platforms now pass. iOS and Android were cleaned up on 7 Aug 2026;
   * the assertion that they *fail* used to live here, with a note saying that
   * if it ever broke because a platform became clean, the platform was ready
   * and should be added to SUPPORTED rather than having the assertion deleted.
   * That is what happened, and this is that edit.
   */
  test('every offered platform lints clean, in both modes', () => {
    for (const template of ['twitter', 'google', 'ios', 'android'] as const) {
      expect(supportsWorkSkin(template), template).toBe(true);

      // The linted CSS must be what we actually hand the user: Android's
      // header and footer are only legal after absolutizeCssAssets rewrites
      // their /assets/ urls, so linting buildCSS alone would miss it.
      const p = defaultProject();
      p.template = template;
      const { css, violations } = buildWorkSkin(p);

      expect(violations, template).toEqual([]);
      expect(lintAo3Css(css, 'site'), template).toEqual([]);
    }
  });

  test('nothing is offered that the lint has not seen', () => {
    // Guards the other direction: a platform added to SUPPORTED without its
    // CSS being checked would ship a skin AO3 refuses outright.
    for (const template of ['ios', 'android', 'twitter', 'google'] as const) {
      const p = defaultProject();
      p.template = template;
      expect(lintAo3Css(buildWorkSkin(p).css, 'work').length, template).toBe(0);
    }
  });

  test('no platform emits animation, @keyframes, gap, object-fit or calc()', () => {
    // The five things that kept iOS and Android out. Named individually so a
    // regression says which one came back, rather than "12 violations".
    for (const template of ['ios', 'android', 'twitter', 'google'] as const) {
      const p = defaultProject();
      p.template = template;
      const css = buildCSS(p).replace(/\/\*[\s\S]*?\*\//g, '');

      expect(css, `${template}: animation`).not.toMatch(/[;{]\s*animation(-[a-z]+)?\s*:/);
      expect(css, `${template}: @keyframes`).not.toMatch(/@keyframes/);
      expect(css, `${template}: gap`).not.toMatch(/[;{]\s*gap\s*:/);
      expect(css, `${template}: object-fit`).not.toMatch(/[;{]\s*object-fit\s*:/);
      expect(css, `${template}: pointer-events`).not.toMatch(/[;{]\s*pointer-events\s*:/);
      expect(css, `${template}: calc()`).not.toMatch(/calc\(/);
    }
  });

  test('a messaging conversation is attributed when no CSS applies', () => {
    // A bubble carries its speaker in colour and alignment alone, so with the
    // skin off the whole conversation was unattributed lines with the time
    // welded on: "hey10:23 / you free tonight?10:24". Nobody can follow that in
    // a downloaded EPUB.
    for (const template of ['ios', 'android'] as const) {
      const p = defaultProject();
      p.template = template;
      p.messages = [
        { id: '1', sender: 'Sam', content: 'hey', outgoing: false, timestamp: '10:23' },
        { id: '2', sender: 'You', content: 'you free tonight?', outgoing: true, timestamp: '10:24' },
      ] as typeof p.messages;
      p.settings.chatShowTyping = true;
      p.settings.chatTypingName = 'Sam';

      const asRead = buildWorkSkin(p).html
        .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

      expect(asRead, template).toContain('Sam: hey 10:23');
      expect(asRead, template).toContain('You: you free tonight? 10:24');
      // The dots are CSS shapes — without this line the indicator is invisible.
      expect(asRead, template).toContain('Sam is typing…');
    }
  });

  test('iOS bubble tails survive AO3 stripping every svg', () => {
    // html2canvas cannot rasterise ::after, so the PNG needs a real <svg>.
    // AO3 deletes <svg> together with its contents. The export therefore drops
    // the SVGs and switches on the CSS tails instead.
    const p = defaultProject();
    p.template = 'ios';

    expect(buildHTML(p), 'the image path keeps its SVG tails').toContain('<svg');

    const { html, css } = buildWorkSkin(p);
    expect(html, 'the work skin carries no svg for AO3 to strip').not.toContain('<svg');
    expect(html).toContain('class="chat css-tails"');
    expect(css).toMatch(/\.css-tails dd\.bubble\.out\.has-tail::after/);
    expect(css).toMatch(/\.css-tails dd\.bubble\.in\.has-tail::after/);
  });
});
