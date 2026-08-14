import { test, expect } from '@playwright/test';
import {
  buildMasterWorkSkin,
  buildWorkSkin,
  CONTAINER_CLASSES,
  MASTER_SKIN_VERSION,
  MASTER_TEMPLATES,
  namespaceCss,
  supportsWorkSkin,
} from '../src/lib/workSkin';
import { defaultProject } from '../src/lib/schema';
import { buildCSS, buildHTML, withPlatformLook } from '../src/lib/generator';
import { lintAo3Css, isAo3Safe, stripCssComments } from '../src/lib/siteSkin/ao3Css';

/**
 * The work-skin export exists only if AO3 would actually accept it. AO3
 * refuses a whole skin over one bad property, so "mostly legal" is the same as
 * broken — these tests are the gate, not a smoke check.
 */

function twitter() {
  const p = defaultProject();
  p.template = 'twitter';
  p.settings.twitterSceneMode = 'timeline';
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
  /**
   * All four platforms are em-sized. AO3 forbids `@media` in skin CSS — media
   * is a field on the skin record — so `em` is the only lever that makes a
   * fixed card fit a phone, and it is what AO3's FAQ recommends.
   *
   * Every value was converted against **its own rule's font-size context**,
   * measured in a browser rather than guessed. At a 16px base the result is
   * within 0.3px of the px version it replaced on a default project, so the
   * image export is unaffected; on AO3, where `.userstuff` computes to roughly
   * 15px, the card scales to the reader instead of overhanging.
   */
  test('every platform is sized in em, so it scales with the reader', () => {
    for (const template of ['twitter', 'google', 'ios', 'android'] as const) {
      const p = defaultProject();
      p.template = template;

      // Comments off first — these stylesheets explain the 16px base they were
      // converted against, and scanning raw text reads that as a stray px.
      // (The same oversight was once live in lintAo3Css.)
      const declarations = stripCssComments(buildCSS(p));

      // Two things may stay in px, and nothing else.
      //
      // 1. Border WIDTHS and shadows, by property — a 1px rule should stay 1px
      //    at any text size, and a shadow is not a layout dimension. Border
      //    RADII are shapes, so those do convert.
      // 2. Anything 2px or under, by value — hairline connectors and the 1px
      //    box of the .visually-hidden clip recipe.
      const stray = (declarations.match(/[^;{]*?:[^;}]*?-?[\d.]+px[^;}]*/g) ?? []).filter((d) => {
        const prop = d.split(':')[0].trim().split(/[\s{]/).pop() ?? '';
        if (/^(border(-(top|right|bottom|left))?|[a-z-]*shadow)$/.test(prop)) return false;
        const values = (d.match(/-?[\d.]+px/g) ?? []).map(parseFloat);
        return values.some((v) => Math.abs(v) > 2);
      });
      expect(stray, `${template}: these lengths should be em, not px:\n${stray.join('\n')}`)
        .toEqual([]);

      // AO3's number grammar is -?\.?\d{1,3}\.?\d{0,3}: a fourth decimal is
      // read as a separate token, so 0.9375em parses as 0.937 then 5em and the
      // declaration is thrown away.
      expect(declarations, `${template}: em values must have at most 3 decimals`)
        .not.toMatch(/[\d.]+\.\d{4,}em/);
    }

    // Twitter's card width is the one absolute size worth pinning by value.
    expect(buildCSS(twitter())).toContain('#workskin .chat{width:34.375em');
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

  /**
   * A tweet used to fetch five chrome images. A twenty-tweet thread was a
   * hundred requests to `media.publit.io` from inside somebody's published fic,
   * forever — and that is a failure with a body count: a WhatsApp skin author
   * outgrew a free Cloudinary tier and every image in every fic using their
   * skin broke at once, with readers told to relink (KNOWLEDGE §7, §19).
   *
   * Four of the five went. Both verified badges are a character in a CSS
   * circle; the metric row is `↩ ⇄ ♡`, which is closer to the real site than
   * the blue discs it replaced. Only the X logo is still fetched, and it stays
   * an image because it is a trademark we should not be drawing ourselves.
   *
   * Views and bookmarks are still images. They are opt-in extras rather than
   * part of the standard tweet, and neither has a character that reads right.
   *
   * This is a *blast radius* test. It fails if anyone adds a chrome image back.
   */
  test('a tweet fetches one chrome image, not five', () => {
    const p = twitter();
    p.settings.twitterVerified = true;
    p.settings.twitterShowMetrics = true;
    p.settings.twitterQuoteEnabled = true;
    p.settings.twitterQuoteVerified = true;
    p.messages = [{
      id: '1', sender: 'Alex Rivers', content: 'the moth is back', outgoing: true,
      timestamp: '2:15 PM', twitterLikes: 847, twitterRetweets: 89, twitterReplies: 156,
    } as (typeof p.messages)[number]];

    const { html } = buildWorkSkin(p);

    const KEPT = ['twitter-logo.png'];
    const fetched = new Set([...html.matchAll(/twitter-[A-Za-z]+\.png/g)].map(m => m[0]));
    for (const file of fetched) expect(KEPT, `${file} is chrome we dropped`).toContain(file);

    // Both badges are drawn, and this is a verified tweet with a verified
    // quote and metrics, so every replaced icon is on the page.
    expect(html).toContain('class="verified-badge"');
    expect(html).toContain('class="quote-verified-badge"');
    expect(html).toContain('<span class="glyph-icon">↩︎</span>');
    expect(html).toContain('<span class="glyph-icon">⇄</span>');
    expect(html).toContain('<span class="glyph-icon">♡</span>');
  });

  test('rich Twitter cards remain AO3-safe and use only structured media players', () => {
    const p = twitter();
    p.settings.twitterTheme = 'dim';
    p.messages[0].attachments = [1, 2, 3, 4].map(number => ({
      type: 'image',
      url: `https://example.com/${number}.png`,
      alt: `Clue ${number}`,
    }));
    p.messages[0].twitterQuote = { name: 'Witness', handle: 'witness', text: 'I saw everything.' };
    p.messages[0].twitterPoll = { state: 'closed', options: [{ id: 'yes', text: 'Believe them', percent: 55 }, { id: 'no', text: 'Doubt them', percent: 45 }] };
    p.messages[0].twitterTranslation = { languageLabel: 'French', originalText: 'Bonjour', translatedText: 'Hello', visibleText: 'translated' };
    const rich = buildWorkSkin(p);
    expect(rich.violations).toEqual([]);
    expect(rich.html).toContain('media-count-4');
    expect(rich.html).toContain('Original text: Bonjour');
    expect(rich.html).not.toMatch(/<(button|iframe|video|source|track|svg)\b/i);

    p.messages[0].attachments = [];
    p.messages[0].twitterVideo = { source: 'youtube', url: 'https://youtu.be/bN8449nalT8', title: 'Clip', description: 'A complete fallback.' };
    const video = buildWorkSkin(p);
    expect(video.violations).toEqual([]);
    expect(video.html).toContain('A complete fallback.');
    expect(video.html).toContain('<iframe');
    expect(video.html).toContain('src="https://www.youtube-nocookie.com/embed/bN8449nalT8"');
    expect(video.html).not.toMatch(/<(video|source|track)\b/i);

    p.messages[0].twitterVideo = {
      source: 'direct', url: 'https://example.com/clip.mp4', mimeType: 'video/mp4', title: 'Direct clip',
      posterUrl: 'https://example.com/poster.png', description: 'A direct fallback.',
      captionTrackUrl: 'https://example.com/en.vtt', captionLanguage: 'en', captionLabel: 'English',
    };
    const direct = buildWorkSkin(p);
    expect(direct.html).toContain('<video');
    expect(direct.html).toContain('<source src="https://example.com/clip.mp4" type="video/mp4">');
    expect(direct.html).toContain('<track src="https://example.com/en.vtt"');
    expect(direct.html).not.toContain('<iframe');
    expect(buildHTML(p)).not.toMatch(/<(iframe|video|source|track)\b/i);
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
      const css = stripCssComments(buildCSS(p));

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
   * `isTyping` is a per-message flag. It has been in the schema from the start
   * and the editor has always honoured it; `buildHTML` never did.
   *
   * So the shipped "iOS Typing Indicators" example — the one whose entire
   * purpose is to demonstrate the indicator — exported a bubble containing the
   * literal text "...", in the PNG and on AO3 alike, and lost the hidden
   * "Riley is typing…" line that is the whole skin-off story for an element
   * drawn entirely in CSS shapes. Found by exporting the example and looking
   * at the picture, which is the only thing that could have found it.
   */
  test('a message flagged as typing renders the indicator, not three dots of text', () => {
    for (const template of ['ios', 'android'] as const) {
      const p = defaultProject();
      p.template = template;
      p.messages = [
        { id: '1', sender: 'Riley', content: '...', outgoing: false, timestamp: '', isTyping: true },
      ] as typeof p.messages;

      const { html } = buildWorkSkin(p);

      expect(html, template).toContain('class="row typing"');
      expect(html, template)
        .toContain('<span class="dot"></span><span class="dot"></span><span class="dot"></span>');
      // Not a bubble whose text happens to be three dots.
      expect(html, template).not.toContain('>...<');

      const asRead = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      expect(asRead, template).toContain('Riley is typing…');
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

    // Matched as a shape, not as literal lengths — this test is about
    // specificity and source order, and pinning the margins here meant the em
    // conversion broke it for no reason.
    for (const sel of ['p.search-stats', 'p.search-dym']) {
      expect(css, sel).toMatch(
        new RegExp(`#workskin ${sel.replace('.', '\\.')}\\{margin:[^;}]*[1-9][^;}]*;`)
      );
      expect(css.indexOf(`#workskin ${sel}`), sel).toBeGreaterThan(
        css.indexOf('#workskin .chat p{')
      );
    }
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
    const css = stripCssComments(buildWorkSkin(p).css);

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
      const css = stripCssComments(buildWorkSkin(p).css);

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
  test('tool credit is absent by default and can be added as neutral plain text', () => {
    for (const template of ['ios', 'android', 'twitter', 'google'] as const) {
      const p = defaultProject();
      p.template = template;
      const defaultExport = buildWorkSkin(p);
      const creditedExport = buildWorkSkin(p, { includeCredit: true });

      expect(defaultExport.html, template).not.toContain('class="wm"');
      expect(creditedExport.html, template).toContain('<div class="wm">Made with AO3 SkinGen</div>');
      expect(creditedExport.html, template).not.toContain('wordfokus.com');

      // Exactly once per exported block — an author pasting several blocks into
      // one chapter should not accumulate a column of credits.
      expect(creditedExport.html.match(/class="wm"/g)?.length, template).toBe(1);

      // Not a link: a bare string is a credit, an outbound anchor is promotion.
      expect(creditedExport.html, template).not.toMatch(/<a\b/);

      // No solicitation inside somebody's published fic. The donate ask belongs
      // in our own UI, and the CSS comment that carries it is deleted by AO3
      // anyway.
      expect(creditedExport.html.toLowerCase(), template).not.toContain('donate');

      // Visible and deletable. Hidden promotional text would surface in the
      // reader's EPUB and screen reader without the author ever seeing it.
      expect(creditedExport.html, template).not.toMatch(/visually-hidden[^>]*>[^<]*AO3 SkinGen/i);
      expect(creditedExport.css, template).toMatch(/#workskin (\.tweets )?\.wm\{/);
    }
  });

  test('the credit is smaller than the image export footnote', () => {
    // Unit-agnostic on purpose. Platforms are being converted from px to em one
    // at a time, and the thing being asserted is a SIZE, not a spelling — an
    // earlier version pinned "9px" for three platforms and "0.563em" for
    // Twitter, and broke the moment Google was converted.
    for (const template of ['ios', 'android', 'google', 'twitter'] as const) {
      const p = defaultProject();
      p.template = template;
      const css = buildWorkSkin(p).css;

      const m = css.match(/\.wm\{[^}]*font-size:([\d.]+)(em|px)/);
      expect(m, `${template}: the credit rule must set a font-size`).not.toBeNull();

      const px = m![2] === 'em' ? parseFloat(m![1]) * 16 : parseFloat(m![1]);
      // 14px bold is the PNG watermark in ExportPanel; the in-fic credit is
      // deliberately quieter than that.
      expect(px, `${template}: credit ${m![1]}${m![2]} is not quieter than the PNG footnote`)
        .toBeLessThan(14);
      expect(px, `${template}: credit should be ~9px`).toBeCloseTo(9, 1);
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
    // The class is appended to whatever the container already carries — it used
    // to be spliced into the literal string `class="chat"`, which stopped
    // existing when buildHTML began emitting the platform class, and would have
    // failed silently: SVGs gone, tails never switched on.
    // Appended to whatever the container carries, which is now three classes
    // and was one when this was written — the literal match is the bug, not the
    // string. Asserted as "last on the container" so it keeps working the next
    // time something joins that list.
    expect(html).toMatch(/<div class="chat ios(?: [\w-]+)* css-tails">/);
    expect(css).toMatch(/\.css-tails dd\.bubble\.out\.has-tail::after/);
    expect(css).toMatch(/\.css-tails dd\.bubble\.in\.has-tail::after/);
  });
});

/**
 * Namespacing — MASTER §6a, the first half of the master skin.
 *
 * These pin the transform's shape. What they cannot see is whether the
 * namespaced sheet still *renders* the same, because adding classes raises
 * specificity unevenly and rules that tied can swap: that is measured in a
 * browser by `tests/namespace.spec.ts`.
 */
test.describe('namespacing a platform stylesheet', () => {
  test('roots a plain selector under the platform container', () => {
    expect(namespaceCss('#workskin dd.bubble{color:red;}', 'ios'))
      .toBe('#workskin .chat.ios dd.bubble{color:red;}');
  });

  test('tightens the container rule instead of nesting a second .chat', () => {
    // #workskin .chat.ios .chat would match nothing at all.
    expect(namespaceCss('#workskin .chat{width:100%;}', 'twitter'))
      .toBe('#workskin .chat.twitter{width:100%;}');
  });

  test('keeps extra classes on the container attached to it', () => {
    expect(namespaceCss('#workskin .chat.css-tails dd.bubble::after{content:\'\';}', 'ios'))
      .toBe('#workskin .chat.css-tails.ios dd.bubble::after{content:\'\';}');
  });

  test('a container class that is not .chat still roots the selector', () => {
    // `.tweets` sits on the container beside `.chat`, so making it a descendant
    // asks for `.tweets` inside itself. Caught by the render diff, not by any
    // of the assertions above: every `.tweet` rule stopped matching and the
    // card lost its background, border, padding and rounding in one go.
    expect(namespaceCss('#workskin .tweets .tweet{padding:1em;}', 'twitter'))
      .toBe('#workskin .tweets.twitter .tweet{padding:1em;}');
  });

  test('the container-class list matches the markup actually emitted', () => {
    // CONTAINER_CLASSES is hand-maintained and fails silently when it falls
    // behind, so it is checked against buildHTML rather than trusted.
    for (const template of ['ios', 'android', 'twitter', 'google'] as const) {
      const p = defaultProject();
      p.template = template;
      const classes = buildWorkSkin(p).html.match(/<div class="([^"]*)"/)![1].split(/\s+/);
      for (const cls of classes) {
        if (cls === template) continue; // the platform class itself
        expect(CONTAINER_CLASSES, `${template}: the container carries .${cls}, which namespaceCss does not know about`)
          .toContain(cls);
      }
    }
  });

  test('.chat-messages is not .chat', () => {
    // The trap this transform is most likely to be "simplified" back into: a
    // bare startsWith('.chat') yields `.chat.ios-messages`, a class that exists
    // nowhere, and the rule stops matching with nothing to show for it.
    expect(namespaceCss('#workskin .chat-messages{padding:0;}', 'android'))
      .toBe('#workskin .chat.android .chat-messages{padding:0;}');
    expect(namespaceCss('#workskin .chat-header .contact-name{font-weight:600;}', 'ios'))
      .toBe('#workskin .chat.ios .chat-header .contact-name{font-weight:600;}');
  });

  test('rewrites every arm of a grouped selector', () => {
    expect(namespaceCss('#workskin dd.bubble strong,#workskin dd.bubble b{font-weight:700;}', 'ios'))
      .toBe('#workskin .chat.ios dd.bubble strong,#workskin .chat.ios dd.bubble b{font-weight:700;}');
  });

  test('strips comments first, so a selector capture cannot swallow one', () => {
    // The prototype lost seven rules to exactly this. Capturing backwards from
    // `{` takes the preceding comment with it, and the resulting selector
    // matches nothing.
    const out = namespaceCss('/* a note */\n#workskin .row{display:flex;}', 'android');
    expect(out).not.toContain('note');
    expect(out.trim()).toBe('#workskin .chat.android .row{display:flex;}');
  });

  test('refuses a selector it cannot scope rather than passing it through', () => {
    // An un-scoped rule in a master skin applies to all four platforms — the
    // exact failure namespacing exists to prevent, and silent if we let it by.
    expect(() => namespaceCss('body{margin:0;}', 'ios')).toThrow(/not scoped/);
  });

  test('scopes every rule of every real stylesheet, and stays legal', () => {
    for (const template of ['ios', 'android', 'twitter', 'google'] as const) {
      const p = defaultProject();
      p.template = template;
      // The EXPORT's CSS, not buildCSS's. Namespacing goes last, after
      // absolutizeCssAssets — Android's header and footer reach buildCSS as
      // `url('/assets/…')`, which AO3 refuses outright, so a master skin built
      // from the raw stylesheet would be rejected in full. Ordering, not a
      // detail: this test caught it by being written the wrong way round.
      const namespaced = namespaceCss(buildWorkSkin(p).css, template);

      const selectors = [...namespaced.matchAll(/([^{}]+)\{[^{}]*\}/g)]
        .flatMap((m) => m[1].split(',').map((s) => s.trim()))
        .filter(Boolean);
      expect(selectors.length, `${template}: found no rules`).toBeGreaterThan(40);
      for (const sel of selectors) {
        // The platform class must sit in the FIRST compound — anywhere later
        // and the rule can reach outside its own block. Its position within
        // that compound does not matter (`.chat.css-tails.ios` is the same
        // selector as `.chat.ios.css-tails`), so this asserts the containment
        // rather than a spelling.
        const first = /^#workskin\s+([^\s>+~]+)/.exec(sel);
        expect(first, `${template}: ${sel} is not rooted at #workskin`).not.toBeNull();
        expect(first![1].split('.').slice(1), `${template}: ${sel} escaped its platform`)
          .toContain(template);
      }

      // Namespacing must not cost the skin its legality — AO3 refuses the whole
      // thing over one bad selector just as it does over one bad property.
      expect(lintAo3Css(namespaced, 'work'), `${template}: namespaced CSS is illegal`).toEqual([]);
    }
  });

  test('the container carries the class the namespaced CSS aims at', () => {
    for (const template of ['ios', 'android', 'twitter', 'google'] as const) {
      const p = defaultProject();
      p.template = template;
      expect(buildHTML(p), `${template}: container is missing its platform class`)
        .toMatch(new RegExp(`<div class="chat ${template}[ "]`));
    }
  });
});

/**
 * The master skin — MASTER §6c, WORK-SKIN §10c, BACKLOG 7.
 *
 * One skin an author saves **once**, covering all four platforms, because a
 * work can use only one skin (§9f) and a fic with a tweet in chapter 1 and an
 * iMessage in chapter 4 otherwise has to choose.
 *
 * These assert the assembly. What they cannot see is whether four stylesheets
 * sharing one cascade still *render* like four separate ones — a rule that
 * escapes its block matches silently and looks exactly like a rule nobody
 * wrote. That is `tests/master-skin.spec.ts`, in a browser.
 */
test.describe('the master work skin', () => {
  function master(template: 'ios' | 'android' | 'twitter' | 'google' = 'twitter') {
    const p = defaultProject();
    p.template = template;
    return buildMasterWorkSkin(p);
  }

  test('is legal, in both lint modes', () => {
    // AO3 refuses the entire skin over one bad property, and a master skin
    // stakes all four platforms on that single verdict rather than one.
    for (const template of MASTER_TEMPLATES) {
      const { css, violations } = master(template);
      expect(violations, template).toEqual([]);
      expect(lintAo3Css(css, 'site'), template).toEqual([]);
    }
  });

  /**
   * This used to assert the whole stylesheet was identical whichever platform
   * was open — the author saves it once, so a sheet that varied under them was
   * worth ruling out.
   *
   * **That property was wrong, and a posted work proved it.** Holding it meant
   * every block took the open project's shared bubble colours, so a Twitter
   * project put blue bubbles in the WhatsApp block and SMS green in the
   * iMessage one (WORK-SKIN §16). A stylesheet that never changes is worth
   * nothing if three quarters of it is the wrong colour.
   *
   * What survives is the useful half: **a platform the author is not looking at
   * is identical no matter which of the other three they have open.** Only the
   * open platform's own block tracks their settings, which it must, because the
   * modal shows its CSS beside a preview built from them.
   */
  test('a block is stable across every platform the author might have open', () => {
    for (const subject of MASTER_TEMPLATES) {
      const others = MASTER_TEMPLATES.filter((t) => t !== subject);
      const blocks = others.map((open) => {
        const css = master(open).css;
        const rules = css.split('\n').filter((line) => line.includes(`.${subject}`));
        expect(rules.length, `${subject}: no rules while ${open} was open`).toBeGreaterThan(10);
        return rules.join('\n');
      });
      for (const block of blocks) {
        expect(block, `${subject} changes depending on which other platform is open`)
          .toBe(blocks[0]);
      }
    }
  });

  test('carries all four platforms, each scoped to its own container', () => {
    const { css } = master();

    const selectors = [...css.matchAll(/([^{}]+)\{[^{}]*\}/g)]
      .flatMap((m) => m[1].split(',').map((s) => s.trim()))
      .filter(Boolean);
    expect(selectors.length, 'found no rules').toBeGreaterThan(200);

    const seen = new Set<string>();
    for (const sel of selectors) {
      // The version stamp is deliberately platform-less: it describes the skin,
      // not one block of it, and matches no element we emit.
      if (sel.includes('ao3skingen-v')) continue;

      const first = /^#workskin\s+([^\s>+~]+)/.exec(sel);
      expect(first, `${sel} is not rooted at #workskin`).not.toBeNull();
      const classes = first![1].split('.').slice(1);
      const platform = MASTER_TEMPLATES.find((t) => classes.includes(t));
      // An unscoped rule here would apply to all four platforms at once, which
      // is precisely what namespacing exists to prevent.
      expect(platform, `${sel} belongs to no platform`).toBeDefined();
      seen.add(platform!);
    }
    expect([...seen].sort()).toEqual([...MASTER_TEMPLATES].sort());
  });

  test('each block is that platform\'s own export, namespaced — not a second code path', () => {
    // The single-platform export and the master skin must not be two
    // generators that can disagree. Byte-identical containment is the strongest
    // form of that available without a browser: every rule in the master skin
    // for a given platform is exactly what `buildWorkSkin` emits for it, run
    // through the same `namespaceCss` the render diff already vouches for.
    const { css } = master();
    for (const template of MASTER_TEMPLATES) {
      // The block for the platform the author has open keeps their settings;
      // the other three wear their own platform's look, so that is what to
      // compare against. Without `withPlatformLook` here this test passed
      // happily while the WhatsApp block carried iOS blue — which is what
      // reached a posted work.
      const open = defaultProject();
      open.template = 'twitter'; // what `master()` builds from
      const source = template === 'twitter'
        ? { ...open, template }
        : withPlatformLook(open, template);
      const block = namespaceCss(buildWorkSkin(source).css, template);

      expect(css, `${template}: the master block is not this platform's own export`)
        .toContain(block);
    }
  });

  /**
   * The leak that reached a posted work — WORK-SKIN §16.
   *
   * Bubble colours, opacity, the body font and `iosMode` are *shared* settings.
   * A master skin builds four blocks from one project, so three of them used to
   * get whatever was chosen for the fourth — **unseen**, because those blocks
   * style markup the author pastes chapters later. On the archive that meant
   * blue WhatsApp bubbles and an SMS-green iMessage, from a project carrying
   * `#007AFF` and `iosMode: 'sms'`.
   */
  test('a platform the author is not looking at keeps its own colours', () => {
    const p = defaultProject();
    p.template = 'twitter';
    p.settings.senderColor = '#007AFF'; // the iOS example's blue
    p.settings.bubbleOpacity = 1;
    p.settings.iosMode = 'sms';         // green, and nothing to do with WhatsApp
    p.settings.fontFamily = '-apple-system, BlinkMacSystemFont, sans-serif';

    const { css } = buildMasterWorkSkin(p);
    const body = (sel: string) => {
      const i = css.indexOf(sel + '{');
      expect(i, `missing rule: ${sel}`).toBeGreaterThan(-1);
      return css.slice(i + sel.length + 1, css.indexOf('}', i));
    };

    // WhatsApp is green, whatever the shared bubble colour says.
    expect(body('#workskin .chat.android dd.bubble.out')).toContain('rgba(220, 248, 198, 1)');
    // iMessage is blue: `iosMode` belongs to the iOS template, and this author
    // is on Twitter, so their SMS toggle must not reach this block.
    expect(body('#workskin .chat.ios dd.bubble.out')).toContain('rgba(0, 122, 255, 1)');
    // And WhatsApp keeps its own font rather than an iOS stack.
    expect(body('#workskin .chat.android')).toContain('Arial, Helvetica, sans-serif');
  });

  test('but the platform the author IS looking at keeps their settings', () => {
    // The other half, and the one that stops the modal showing CSS that
    // disagrees with the preview beside it. An author on iOS who has chosen SMS
    // must get SMS green in the skin they save.
    const p = defaultProject();
    p.template = 'ios';
    p.settings.iosMode = 'sms';

    const { css } = buildMasterWorkSkin(p);
    const i = css.indexOf('#workskin .chat.ios dd.bubble.out{');
    expect(css.slice(i, css.indexOf('}', i))).toContain('rgba(52, 199, 89, 1)');
  });

  test('stamps its version as a rule, because AO3 deletes comments', () => {
    // `/* Generated with … */` has never once reached the archive: AO3 rebuilds
    // the sheet from rule sets, so nothing outside a rule survives. A real rule
    // set does, which is how the app can tell a stale saved skin from a current
    // one when an author pastes their CSS back in.
    const { css } = master();
    expect(css).toContain(
      `#workskin .ao3skingen-v${MASTER_SKIN_VERSION}::after{content:'${MASTER_SKIN_VERSION}';}`
    );
    // Single-quoted, like every other content value we emit — that is the form
    // we have read back out of AO3's editor intact.
    expect(css).not.toMatch(/content:\s*"/);
  });

  test('carries no comments at all', () => {
    // The one construct proven to make AO3 silently drop rules — eleven
    // consecutive ones, on a skin that saved without error (§13). A master skin
    // has four times the surface for it.
    const { css } = master();
    expect(css).not.toContain('/*');
    expect(css).toBe(stripCssComments(css));
  });

  test('master skin keeps optional credit off by default and adds it once', () => {
    // The credit lives in the HTML and there is one block of HTML, so this
    // holds by construction — asserted because a later "merge the four blocks"
    // change is exactly the kind that would break it.
    for (const template of MASTER_TEMPLATES) {
      const p = defaultProject();
      p.template = template;
      const { html } = buildMasterWorkSkin(p);
      const credited = buildMasterWorkSkin(p, { includeCredit: true }).html;

      expect(html, template).not.toContain('class="wm"');
      expect(credited.match(/class="wm"/g)?.length, template).toBe(1);
      // And it is the same markup the single-platform export hands over: the
      // master skin changes the stylesheet, not what goes in the chapter.
      expect(html, template).toBe(buildWorkSkin(p).html);
      expect(credited, template).toBe(buildWorkSkin(p, { includeCredit: true }).html);
    }
  });

  /**
   * BACKLOG 8 — both themes in one skin.
   *
   * Work skins ban custom properties and `var()`, so the community idiom for
   * two palettes in one skin is to enumerate them as classes; three published
   * skins do exactly that (KNOWLEDGE §3, §12, §18). The base block stays as the
   * author's settings compiled it, and the theme they did *not* pick is carried
   * as a second, one-class-more-specific copy.
   *
   * It was a *diff* of the two builds first — 64 rules instead of 244 — and
   * that was wrong: an override tied on specificity with a more specific base
   * rule and, coming later, beat it. `themeVariantCss` has the worked example.
   * The whole-block form is sound by construction, which is worth more than the
   * 26 KB it costs.
   */
  test('carries the opposite theme as a variant block, for each themed platform', () => {
    const p = defaultProject();
    p.template = 'twitter';
    p.settings.twitterTheme = 'light';
    p.settings.iosDarkMode = false;
    p.settings.androidDarkMode = true; // the other direction, in the same skin
    const { css } = buildMasterWorkSkin(p);

    expect(css, 'twitter: no dark override').toMatch(/#workskin [^{]*\.twitter\.theme-dark/);
    expect(css, 'twitter: no dim override').toMatch(/#workskin [^{]*\.twitter\.theme-dim/);
    expect(css, 'ios: no dark override').toMatch(/#workskin [^{]*\.ios\.theme-dark/);
    // Android is already dark, so it is the LIGHT variant that has to be
    // carried — the derivation is symmetric, not "add a dark mode".
    expect(css, 'android: no light override').toMatch(/#workskin [^{]*\.android\.theme-light/);
    expect(css, 'android: dark is the base, so it needs no override')
      .not.toMatch(/\.android\.theme-dark/);
    // Google has no theme at all, so it gets no variant and no class.
    expect(css, 'google has no theme to vary').not.toMatch(/\.google\.theme-/);
  });

  test('each variant block is that platform\'s other-theme export, namespaced', () => {
    // The same containment the base blocks carry, and for the same reason: the
    // variant must be the platform's own stylesheet compiled with the other
    // theme, not a transformation of the base that could disagree with it.
    //
    // This is also what makes the cascade argument hold. Every rule in the
    // variant is its base twin plus exactly one class, in the same order — so
    // the variant's winner for any property beats its own twin, beats every
    // other variant rule exactly as its twin did, and therefore beats every
    // base rule too. A *diff* of the two builds has no such guarantee, which is
    // how the first version of this shipped a border the base sheet removed.
    const p = defaultProject();
    p.template = 'twitter';
    const { css } = buildMasterWorkSkin(p);

    for (const template of ['twitter', 'ios', 'android'] as const) {
      const other = defaultProject();
      other.template = template;
      other.settings.twitterTheme = 'dark';
      other.settings.twitterDarkMode = true;
      other.settings.iosDarkMode = true;
      other.settings.androidDarkMode = true;

      const block = namespaceCss(buildWorkSkin(other).css, template, 'dark');
      expect(css, `${template}: the dark variant is not this platform's own export`)
        .toContain(block);

      if (template === 'twitter') {
        const dim = defaultProject();
        dim.template = 'twitter';
        dim.settings.twitterTheme = 'dim';
        expect(css, 'twitter: the dim variant is not its own export')
          .toContain(namespaceCss(buildWorkSkin(dim).css, 'twitter', 'dim'));
      }
    }
  });

  test('no rule in the skin is empty, which AO3 reports as an error', () => {
    // The trap that made the typing animation's two `animation-delay` rules
    // undeletable (§9e): AO3 refuses a skin over an empty rule set, and a
    // master skin stakes all four platforms on that one verdict.
    const p = defaultProject();
    p.template = 'twitter';
    for (const [rule, body] of buildMasterWorkSkin(p).css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      expect(body.trim(), `empty rule: ${rule}`).not.toBe('');
    }
  });

  test('every container class the CSS aims at is one buildHTML emits', () => {
    // The three-way contract in WORK-SKIN §10, point 7: `buildHTML` writes the
    // class string, `useCssBubbleTails` appends to it, `namespaceCss` splices
    // into it. Change one and the other two are wrong, silently. The theme
    // class is the newest member of that list.
    for (const template of MASTER_TEMPLATES) {
      const p = defaultProject();
      p.template = template;
      const classes = buildWorkSkin(p).html.match(/<div class="([^"]*)"/)![1].split(/\s+/);

      expect(classes, template).toContain('chat');
      if (template === 'google') {
        expect(classes.some((c) => c.startsWith('theme-')), 'google has no theme').toBe(false);
      } else {
        expect(classes, `${template} is missing its theme class`).toContain('theme-light');
      }
      for (const cls of classes) {
        if (cls === template) continue;
        expect(CONTAINER_CLASSES, `${template}: .${cls} is not in CONTAINER_CLASSES`)
          .toContain(cls);
      }
    }
  });

  test('a dark project emits the dark class, and the skin still lints', () => {
    for (const template of ['twitter', 'ios', 'android'] as const) {
      const p = defaultProject();
      p.template = template;
      p.settings.twitterTheme = 'dark';
      p.settings.twitterDarkMode = true;
      p.settings.iosDarkMode = true;
      p.settings.androidDarkMode = true;

      const { html, violations } = buildMasterWorkSkin(p);
      expect(html, template).toMatch(new RegExp(`<div class="chat ${template} theme-dark[ "]`));
      expect(violations, template).toEqual([]);
    }
  });

  test('no platform ships a relative asset url, which AO3 refuses outright', () => {
    // Namespacing runs last, after absolutizeCssAssets, because a relative
    // `url('/assets/…')` is rewritten against AO3's own domain and 404s — and
    // in a master skin one refused declaration loses all four platforms at once.
    //
    // This used to assert a publit.io url was *present*, which passed only
    // because iOS defaulted its header to a remote chrome strip. That default
    // is gone (the CSS draws the header itself), and every remaining image url
    // is author-supplied and https-gated at the point it enters the sheet. So
    // the surviving guarantee is the negative one, asserted for all four.
    for (const template of MASTER_TEMPLATES) {
      expect(master(template).css, template).not.toContain("url('/assets/");
      expect(master(template).css, template).not.toContain('url(/assets/');
    }
  });
});
