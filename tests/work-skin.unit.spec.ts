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

    // Only hairline borders may stay in px. This used to allow -9999px as well,
    // for the old off-screen hidden-text recipe; the clip recipe that replaced
    // it has no offset to except.
    const strayPx = (declarations.match(/[:\s](-?[\d.]+)px/g) ?? [])
      .map(m => parseFloat(m.slice(1)))
      .filter(v => Math.abs(v) > 2);
    expect(strayPx, `px values that should be em: ${strayPx.join(', ')}`).toEqual([]);

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

  /**
   * AO3 injects `<br>` at every newline and wraps blank-line-separated chunks
   * in `<p>`, so a single line is never touched. Google's export was nine lines
   * with two blank-line breaks — the archive was rewriting the inside of
   * `.search-result` on every save, in a shipped platform.
   *
   * Asserted for every platform rather than just the one that broke: this is
   * cheap and it retires the whole class of bug.
   */
  test('no platform emits multi-line HTML for AO3 to reformat', () => {
    for (const template of ['ios', 'android', 'twitter', 'google'] as const) {
      const p = defaultProject();
      p.template = template;
      const { html } = buildWorkSkin(p);

      expect(html, `${template} must export one line`).not.toContain('\n');
    }
  });

  /**
   * The defence that does not depend on our markup being perfect. Injection is
   * partly a function of how the *user* pastes into AO3's editor, which the
   * generator cannot control — so an injected paragraph has to be harmless
   * rather than merely unlikely. Five independent community skins reset
   * paragraphs; the canonical Twitter skin names it as its main defence.
   */
  test('every platform neutralises the paragraphs AO3 injects', () => {
    for (const template of ['ios', 'android', 'twitter', 'google'] as const) {
      const p = defaultProject();
      p.template = template;

      expect(buildWorkSkin(p).css, template).toContain('#workskin .chat p{margin:0;padding:0;}');
    }
  });

  /**
   * Google's two <p> elements are the one place the reset could do harm: it is
   * (0,1,1,1) and would otherwise outrank a plain `.search-stats` selector and
   * flatten the real margins we want. Tagging those two with their element name
   * ties the specificity, and source order settles it.
   */
  test('the paragraph reset does not flatten Google\'s own paragraphs', () => {
    const p = defaultProject();
    p.template = 'google';
    const css = buildWorkSkin(p).css;

    expect(css).toContain('#workskin p.search-stats{margin:12px 0 0 12px;');
    expect(css).toContain('#workskin p.search-dym{margin:16px 0 0 12px;');
    expect(css.indexOf('#workskin p.search-stats')).toBeGreaterThan(
      css.indexOf('#workskin .chat p{'),
    );
  });

  /**
   * The hidden-text recipe every platform's skin-off support rests on. We used
   * `position:absolute;left:-9999px`, which works but can create horizontal
   * overflow and is handled inconsistently by assistive technology. The clip
   * pattern is the WCAG standard and — more to the point — was read out of CSS
   * AO3 is currently serving, so the archive demonstrably keeps all of it.
   */
  test('hidden text is clipped, not shoved off-screen', () => {
    for (const template of ['ios', 'android', 'twitter', 'google'] as const) {
      const p = defaultProject();
      p.template = template;
      const { css, violations } = buildWorkSkin(p);

      expect(css, template).toContain('clip:rect(0,0,0,0)');
      expect(css, `${template} still uses the old off-screen recipe`).not.toContain('-9999px');
      // clip is on AO3's property list and rect() reaches VALUE_REGEX through
      // its shape-function branch — but the lint is the authority, not us.
      expect(violations, template).toEqual([]);
    }
  });

  /**
   * Google was the one platform never revisited when skin-off support went in
   * on 7 Aug: zero hidden spans, where Twitter, iOS and Android all had them. A
   * download read "search query All Images Videos News Maps More About
   * 2,145,330,903 results…" — the engine chrome as prose, then results with no
   * structure and no boundaries between them.
   */
  test('a Google search reads as prose when no CSS applies', () => {
    const p = defaultProject();
    p.template = 'google';
    p.settings.googleQuery = 'what happened to the lighthouse keeper';
    p.settings.googleSuggestions = [];
    p.messages = [
      {
        id: '1', sender: '', content: 'The Keeper Vanished', outgoing: false,
        googleResultUrl: 'https://maritime-archive.org/flannan',
        googleResultDescription: 'Three men left the island and were never seen again.',
      },
    ] as unknown as typeof p.messages;

    const asRead = buildWorkSkin(p).html
      .replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

    expect(asRead).toContain('Searched for: what happened to the lighthouse keeper.');
    // The tab bar is chrome we cannot delete without also deleting it from the
    // PNG, so it is labelled rather than removed — the same compromise as
    // Twitter's "· Follow".
    expect(asRead).toContain('Search tabs: All Images Videos News Maps More.');
    // Each result says which result it is and where it came from, instead of
    // running into the one before it.
    expect(asRead).toContain(
      'Result 1, from https://maritime-archive.org/flannan: The Keeper Vanished',
    );
  });

  /**
   * §4a's first rule, which only Twitter was actually following.
   *
   * With the skin off there is no CSS to size an image, so it renders at its
   * natural size. Google's chrome ships as 512x512 and 936x336 sources behind
   * 14-20px CSS boxes, so a download rendered the search magnifier as a picture
   * the width of the page — six times over, before the reader reached a single
   * result. The attributes are presentational hints, so author CSS still wins
   * and the styled render is unaffected.
   */
  test('every image states its own size, on every platform', () => {
    // Reader-supplied pictures are the one exception, and an honest one: their
    // CSS is `width:100%`, we do not know what the author will upload, and a
    // photo filling the column with no skin is the right outcome anyway. Every
    // other image is chrome at a size we chose.
    const readerContent = /\b(message-image|tweet-image|quote-image|attach-img)\b/;

    for (const template of ['ios', 'android', 'twitter', 'google'] as const) {
      const p = defaultProject();
      p.template = template;

      // Turn on the paths that only emit images once configured — a default
      // project shows none of these, which is how the WhatsApp ticks and the
      // group avatars stayed unsized while the Twitter-only version of this
      // test passed.
      p.settings.googleSuggestions = ['a suggestion'];
      p.settings.iosAvatarUrl = 'https://example.com/a.png';
      p.settings.androidAvatarUrl = 'https://example.com/a.png';
      p.settings.androidCheckmarks = true;
      p.settings.iosGroupMode = true;
      p.settings.androidGroupMode = true;
      const participants = [
        { id: 'p1', name: 'Sam', color: '#ff0000', avatarUrl: 'https://example.com/s.png' },
      ];
      p.settings.iosGroupParticipants = participants as never;
      p.settings.androidGroupParticipants = participants as never;
      p.messages = [
        { id: '1', sender: 'Sam', content: 'hey', outgoing: false, participantId: 'p1' },
        { id: '2', sender: 'You', content: 'hi', outgoing: true, status: 'read' },
      ] as typeof p.messages;

      const tags = (buildWorkSkin(p).html.match(/<img[^>]*>/g) ?? [])
        .filter(tag => !readerContent.test(tag));

      expect(tags.length, `${template} emitted no images to check`).toBeGreaterThan(0);
      for (const tag of tags) {
        expect(tag, `${template}: ${tag}`).toMatch(/\bwidth="\d+"/);
        expect(tag, `${template}: ${tag}`).toMatch(/\bheight="\d+"/);
      }
    }
  });

  /**
   * The first failure observed on the real archive, and the first one whose
   * mechanism we understand.
   *
   * A Google search saved to AO3 came back with the tab bar stacked one tab per
   * line and the mic/lens icons against the query text instead of at the right
   * edge. AO3 wraps our children in `<p>`, which does not strip flex — it moves
   * it. The injected paragraph becomes the flex item and everything we meant to
   * lay out is a grandchild, so `margin-left:auto` has nothing to push against
   * and the `.tab` spans (themselves `display:flex`) become blocks.
   *
   * `> *` fails for the same reason and was our standard `gap` substitute: the
   * injected paragraph matches it and swallows the margin.
   *
   * Note the paragraph reset does NOT save this. It stops an injected paragraph
   * adding space; it cannot stop it being a box in between.
   */
  test('Google lays out in a way an injected paragraph cannot break', () => {
    const p = defaultProject();
    p.template = 'google';
    p.settings.googleSuggestions = ['a suggestion'];
    const css = buildWorkSkin(p).css.replace(/\/\*[\s\S]*?\*\//g, '');

    expect(css, 'flex needs a direct parent/child link AO3 will break')
      .not.toMatch(/display:\s*(inline-)?flex/);
    expect(css, 'the child combinator matches the injected <p>, not our element')
      .not.toContain('> *');
  });

  /**
   * One convention for `content`, not two.
   *
   * The single-quoted form is the one we have read back out of AO3's own editor
   * intact, so it is the one we emit everywhere. The double-quoted form is very
   * likely equally fine — this is consistency, not a known constraint.
   */
  test('no stylesheet double-quotes a content value', () => {
    for (const template of ['ios', 'android', 'twitter', 'google'] as const) {
      const p = defaultProject();
      p.template = template;
      const css = buildWorkSkin(p).css.replace(/\/\*[\s\S]*?\*\//g, '');

      expect(css, `${template}: content:"" truncates the skin on AO3`)
        .not.toMatch(/content:\s*"/);
    }
  });

  /**
   * The credit line, and the shape that keeps it a credit.
   *
   * AO3's ToS prohibits using a work to advertise or solicit, and the community
   * convention is that skin credit goes in the author's notes. An attribution
   * line is still fine — but its form is what decides that, so each constraint
   * below is asserted rather than trusted to survive future edits.
   *
   * It lives in the HTML because the CSS comment we thought was carrying it has
   * never reached the archive: AO3 deletes comments, confirmed by reading all
   * four saved skins back out of its own editor.
   */
  test('every platform carries a plain-text credit, and nothing more', () => {
    for (const template of ['ios', 'android', 'twitter', 'google'] as const) {
      const p = defaultProject();
      p.template = template;
      const { html, css } = buildWorkSkin(p);

      // The root domain, not the subdomain the tool is served from. This string
      // is frozen in the author's work the moment they paste it, so it has to
      // be the address we are surest still resolves years from now — and a
      // subdomain is the part most likely to move. See CREDIT in workSkin.ts.
      expect(html, template).toContain('<div class="wm">made by wordfokus.com/ao3skingen</div>');
      expect(html, template).not.toContain('ao3skingen.wordfokus.com');

      // Exactly once per exported block — an author pasting several blocks into
      // one chapter should not accumulate a column of credits.
      expect(html.match(/class="wm"/g)?.length, template).toBe(1);

      // Not a link: a bare string is a credit, an outbound anchor is promotion.
      expect(html, template).not.toMatch(/<a[^>]*wordfokus/);

      // No solicitation inside somebody's published fic. The donate ask belongs
      // in our own UI, and the CSS comment that carries it is deleted by AO3
      // anyway.
      expect(html, template).not.toContain('donate');

      // Visible and deletable. Hidden promotional text would surface in the
      // reader's EPUB and screen reader without the author ever seeing it.
      expect(html, template).not.toMatch(/visually-hidden[^>]*>[^<]*wordfokus/);
      expect(css, template).toMatch(/#workskin (\.tweets )?\.wm\{/);
    }
  });

  test('the credit is smaller than the image export footnote', () => {
    for (const template of ['ios', 'android', 'google'] as const) {
      const p = defaultProject();
      p.template = template;
      expect(buildWorkSkin(p).css, template).toMatch(/\.wm\{[^}]*font-size:9px/);
    }
    // Twitter is em-sized throughout; 0.563em is the same 9px at a 16px base.
    const t = twitter();
    expect(buildWorkSkin(t).css).toMatch(/\.wm\{[^}]*font-size:0\.563em/);
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
