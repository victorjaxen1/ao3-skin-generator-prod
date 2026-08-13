/**
 * An AO3-shaped page, in AO3's own markup, for the preview iframe.
 *
 * The IDs and class names here are not decorative. `compile()` produces one
 * string, and that same string is what styles this DOM — so if a control has
 * no visible effect here, it has no effect on AO3 either. The prototype drove
 * its preview from `--p-*` custom properties and built its export separately;
 * the two disagreed, and that is how it shipped a header whose navigation was
 * invisible (plan §4.4). There is no second rendering path in this file.
 *
 * Markup transcribed from otwarchive: layouts/_header, layouts/_footer,
 * users/_sidebar, works/_work_module, works/show, works/_preface,
 * chapters/_chapter.
 */

export type PreviewState = 'browse' | 'reading' | 'dashboard';

export const PREVIEW_STATES: readonly { id: PreviewState; label: string }[] = [
  { id: 'browse', label: 'Browse' },
  { id: 'reading', label: 'Reading' },
  { id: 'dashboard', label: 'Dashboard' },
];

/**
 * AO3's default skin, abridged.
 *
 * A user site skin loads with role "user", which means every rule below is
 * still present on the real page and our CSS is layered on top of it. Without
 * this the preview would be unstyled HTML — and every specificity defect in
 * plan §4 would stay invisible until a real user hit it. Transcribed from
 * public/stylesheets/site/2.0/*, keeping the rules our skin has to overcome
 * and dropping the icon sprites, forms and zone layouts we do not render.
 *
 * This is NEVER part of the export. It is AO3's stylesheet, not ours.
 */
export const AO3_BASE_CSS = `
/* 01-core */
body {
  background: #fff;
  color: #2a2a2a;
  font: 100%/1.125 'Lucida Grande', 'Lucida Sans Unicode', Verdana, Helvetica, sans-serif;
  margin: 0;
  padding: 0;
}
.heading { font-family: Georgia, serif; }
a, a:link { color: #900; text-decoration: none; }
#header, #footer, #main, #dashboard { padding: 1em 3em; }
.landmark { font-size: 0; opacity: 0; }
li.blurb { border: 1px solid #ddd; padding: 1em; overflow: hidden; }
.blurb li, .actions > *, .stats > * { list-style: none; display: inline; padding-left: 0.25em; }
li.blurb:after { content: " "; display: block; height: 0; font-size: 0; clear: both; visibility: hidden; }

/* 08-actions — only the float. The button styling in that sheet is left out
   deliberately: it is a large cascade with nothing our skin overrides, and
   this one declaration is the reason AO3's nav bar sits BELOW the site title
   rather than beside it. */
ul.actions { float: right; }

/* 02-elements */
h1, h2, h3, h4, h5, h6, .heading { font-family: Georgia, serif; font-weight: 400; }
h1 { font-size: 2.5em; line-height: 1; margin: 0.5em 0; }
h2 { font-size: 2.143em; line-height: 1; margin: 0.429em 0; }
h3 { font-size: 1.714em; margin: 0.5em 0; }
h4 { font-size: 1.286em; margin: 0.5em 0; }
h5 { font-size: 1.143em; margin: 0.5em 0; }
h6 { font-size: 1em; margin: 0.5em 0; }
hr { border: 0; border-bottom: 3px double; }
blockquote, pre, address {
  font: 1em 'Lucida Grande', 'Lucida Sans Unicode', Verdana, Helvetica, sans-serif;
  margin: 0.643em;
}
ul, ol { margin: 0; padding: 0; }

/* 03-region-header */
#header { font-size: 0.875em; margin: 0 0 1em; padding: 0; position: relative; }
#header a, #header fieldset, #header p, #header li, #header h1 {
  background: transparent; font-size: 100%; border: none; padding: 0; margin: 0;
}
#header li { display: block; float: left; position: relative; }
#header a, #header a:visited { color: #111; }
#header .heading { float: left; padding: 0.375em; }
#header .heading a { color: #900; font-size: 1.714em; line-height: 1.75em; }
#header .primary {
  background: #900 url(/images/skins/textures/tiles/red-ao3.png);
  padding: 0; width: 100%;
  box-shadow: inset 0 -6px 10px rgba(0, 0, 0, 0.35), inset 0 -1px 0 rgba(0, 0, 0, 0.85);
}
#header .primary > li:first-of-type { margin-left: 2em; }
/* display:inline-block reaches these from 08-actions' .actions a rule. It is
   here rather than there because without it the absolutely-positioned dropdown
   takes its static position from the middle of an inline box and lands on top
   of the nav item that opened it. */
#header .primary a { padding: 0.429em 0.75em; color: #fff; display: inline-block; }
#header .primary .menu a { color: #111; padding: 0.75em 0.5em 0.5em; }
#header .dropdown .menu a { background: transparent; display: block; }
#header .menu {
  background: #ddd; padding: 0.25em 0; position: absolute; width: 20em; z-index: 55;
  background-image: linear-gradient(to bottom, rgba(221,221,221,0.98) 0%, rgba(204,204,204,0.98) 100%);
  box-shadow: 1px 1px 3px -1px #444;
}
/* A closed dropdown is hidden. Missing from this subset until 13 Aug 2026,
   which made the panel visible in every preview state — including Reading,
   where it sat on top of the work — and quietly falsified the "opens in Browse
   only" contract in the header() helper below. */
#header .dropdown .menu { display: none; }
#header .dropdown:hover .menu, #header .dropdown.open .menu { display: block; }
#header .open .menu, #header .menu li { display: block; float: none; }
#header .menu li { border-bottom: 1px solid #888; }
#header .search { float: right; color: #2a2a2a; margin-right: 0.25em; }

/* 04-region-dashboard */
#dashboard { width: 11.25em; float: left; padding: 0.5em; }
#dashboard li { padding: 0; }
#dashboard a, #dashboard span {
  color: #111; display: block; line-height: 2; padding: 0 0.5625em;
  border: none; background: transparent;
}
#dashboard ul { float: none; display: block; padding: 1.286em 0; text-align: right; border-top: 2px solid #ddd; }
#dashboard .current { background: #ccc; }
#dashboard.own { background: transparent; border-top: 15px solid #900; border-bottom: 15px solid #900; border-radius: 0.25em; }

/* 05-region-main */
#main { font-size: 0.875em; line-height: 1.286; margin: auto; padding: 0.5em 2.5em 3.5em; position: relative; }
#main.dashboard { padding-left: 2em; margin: 0.5em auto 1em 14em; }

/* 06-region-footer */
#footer {
  background: #900 url("/images/skins/textures/tiles/red-ao3.png");
  border-top: 2px solid; color: #fff; float: left; font-size: 0.75em;
  position: relative; padding: 0; width: 100%;
}
#footer ul { border: 0; clear: both; margin: 1.5em 0; padding: 1em 5%; float: left; text-align: left; width: 90%; }
#footer li { position: relative; display: block; }
#footer a, #footer button {
  background: transparent; border: 0; color: #fff; display: inline;
  text-decoration: underline; line-height: 1.5;
}
#footer .module { max-width: 20%; padding: 0 2%; }
#footer .heading { display: block; color: #fff; }

/* 10-types-groups */
a.tag { color: #111; line-height: 1.5; text-decoration: none; padding: 0; border-bottom: 1px dotted; }
.tags li { display: inline; padding-left: 0; padding-right: 0.25em; }

/* 10-types-groups — the work metadata table. Labels float left of their
   values, which is what makes a work page's tags read as a list of rows. */
dl.meta { border: 1px solid #ddd; padding: 0.75em; margin: 0 0 1em; }
dl.meta dt { float: left; clear: left; margin: 0 0.25em 0 0; font-weight: bold; }
dl.meta dd { margin: 0 0 0.25em; padding: 0 0 0 12em; }
dl.meta ul.commas li { display: inline; padding-right: 0.25em; }

/* 13-group-blurb */
li.blurb { display: block; position: relative; clear: left; padding: 0.429em 0.75em; overflow: visible; }
.blurb .header { margin-bottom: 0.375em; }
.blurb .heading { display: block; }
.blurb h4 a:link { color: #900; }
.blurb dl.stats { float: right; line-height: 1.5; }
.blurb dl.stats dt, .blurb dl.stats dd { display: inline; margin: 0; padding-left: 0.25em; }
.datetime { font-family: monospace; }

/* 14-group-preface */
div.preface { margin: 1.5em 3em; padding: 0.643em 0.643em 0; }
div.preface .module { margin: 0; padding: 0 0 0.643em; }
.preface h3 { background: transparent; border-bottom: 1px solid; }
.preface h2.title { display: block; border-bottom: 0; }
div.preface .title, div.preface .byline, div.preface .byline a { border: 0; text-align: center; }
.preface blockquote { border: 0; }

/* 21-userstuff */
.userstuff { word-wrap: break-word; line-height: 1.5; }
.userstuff p { margin: 1.286em auto; padding: 0; }
.userstuff hr { width: 33%; margin: 0.875em auto 1.2525em auto; border: 1px solid; }

/* 22-system-messages */
.notice {
  background: #d1e1ef; border: 1px solid #c2d2df; margin: 0.643em auto;
  padding: 0.25em 0.375em; border-radius: 0.25em;
}

/* ── Preview scaffolding — NOT transcribed from AO3 ──────────────────────
   AO3's regions are built almost entirely from floats, and the containment
   that gives them height comes from rules spread across sheets this subset
   does not carry. Rather than guess at that cascade, the preview establishes
   it directly. flow-root rather than overflow:hidden, so the open header
   dropdown can still hang over #main the way it does on the real page.

   Nothing here is a claim about AO3's own CSS, and none of it is a selector
   our compiler targets — it only ensures the regions we DO target have a box
   to paint. */
#outer.wrapper, #inner.wrapper, #header, #footer { display: flow-root; }
#footer ul { float: none; }

/* NOT on #header nav, deliberately. A flow-root box refuses to overlap a
   float, so containing the nav makes it sit BESIDE the site title in the
   leftover space. On the real page nav is an ordinary block, its 100%-wide
   right-floated ul cannot fit next to the title, and it drops below — which is
   the two-band header everyone recognises. #header's own flow-root still
   contains the float. */

/* AO3's logo is an <img> served from its own domain. Hotlinking it into a
   preview would be rude and would break offline, so the mock uses a styled
   stand-in at the same size and position that 03-region-header gives the real
   one (float: left, height 42px). It exists so the "hide the logo" toggle is
   something you can watch happen rather than take on trust. */
#header .logo {
  display: inline-block;
  width: 42px;
  height: 42px;
  margin-left: 0.4em;
  border-radius: 50%;
  background: #900;
  border: 2px solid rgba(255, 255, 255, 0.5);
  vertical-align: middle;
}
`.trim();

/**
 * `openDropdown` is what makes the header's dropdown rules previewable at all
 * — plan §10 says a rule that cannot be seen does not ship. But an open
 * dropdown is `position: absolute` on the real page too, so it hangs over
 * whatever is below it. Leaving it open in every state would permanently
 * obscure a slice of the preview, so it opens in Browse only: seen once,
 * verified once, out of the way everywhere else.
 */
function header(openDropdown: boolean): string {
  return `
<div id="header" class="region" role="banner">
  <h1 class="heading">
    <a href="#"><span>Archive of Our Own</span><span class="logo" role="img" aria-label="AO3 logo"></span></a>
  </h1>
  <nav aria-label="Site">
    <ul class="primary navigation actions">
      <li class="dropdown"><a href="#">Fandoms</a></li>
      <li class="dropdown${openDropdown ? ' open' : ''}">
        <a href="#">Browse</a>
        <ul class="menu dropdown-menu">
          <li><a href="#">Works</a></li>
          <li><a href="#">Bookmarks</a></li>
          <li><a href="#">Tags</a></li>
        </ul>
      </li>
      <li class="dropdown"><a href="#">Search</a></li>
      <li class="dropdown"><a href="#">About</a></li>
    </ul>
  </nav>
</div>`;
}

const FOOTER = `
<div id="footer" class="region" role="contentinfo">
  <ul class="navigation actions">
    <li class="module group">
      <h4 class="heading">About the Archive</h4>
      <ul class="menu"><li><a href="#">Site Map</a></li><li><a href="#">Diversity Statement</a></li></ul>
    </li>
    <li class="module group">
      <h4 class="heading">Contact Us</h4>
      <ul class="menu"><li><a href="#">Policy Questions</a></li><li><a href="#">Technical Support</a></li></ul>
    </li>
  </ul>
</div>`;

/**
 * A tag in a listing, carrying the type class AO3 puts on the `li`.
 *
 * The class is what makes "colour tags by type" previewable at all: the
 * compiler targets `li.warnings a.tag` and friends, and a mock whose every tag
 * was a freeform would show three quarters of the control doing nothing.
 */
type MockTag = { type: 'warnings' | 'relationships' | 'characters' | 'freeforms'; label: string };

function blurb(
  id: string,
  title: string,
  author: string,
  tags: MockTag[],
  summary: string,
  words: string,
  chapters: string
): string {
  return `
  <li id="work_${id}" class="work blurb group" role="article">
    <div class="header module">
      <h4 class="heading">
        <a href="#">${title}</a> by <a rel="author" href="#">${author}</a>
      </h4>
      <h5 class="fandoms heading">
        <span class="landmark">Fandoms:</span> <a class="tag" href="#">Original Work</a>
      </h5>
      <p class="datetime">06 Aug 2026</p>
    </div>
    <ul class="tags commas">
      ${tags
        .map(t => `<li class="${t.type}"><a class="tag" href="#">${t.label}</a></li>`)
        .join('\n      ')}
    </ul>
    <blockquote class="userstuff summary"><p>${summary}</p></blockquote>
    <dl class="stats">
      <dt class="words">Words:</dt><dd class="words">${words}</dd>
      <dt class="chapters">Chapters:</dt><dd class="chapters">${chapters}</dd>
    </dl>
  </li>`;
}

const BROWSE = `
<h2 class="heading">Works in Original Work</h2>
<div class="notice" role="status">
  <p>Your filters have been applied. 3 works found.</p>
</div>
<ol class="work index group">
${blurb(
  '1',
  "The Cartographer's Impossible Map",
  'inkandstarlight',
  [
    { type: 'warnings', label: 'No Archive Warnings Apply' },
    { type: 'relationships', label: 'Mara/The Messenger' },
    { type: 'characters', label: 'Mara' },
    { type: 'freeforms', label: 'Slow Burn' },
    { type: 'freeforms', label: 'Mutual Pining' },
  ],
  'Mara discovers a map that redraws itself whenever someone tells a lie. It is, she thinks, a deeply inconvenient thing to own — particularly once the palace messenger arrives with a letter she cannot bring herself to read aloud, and particularly once the map starts redrawing itself around him.',
  '12,842',
  '4/4'
)}
${blurb(
  '2',
  'Nine Letters, Unsent',
  'quietharbour',
  [
    { type: 'warnings', label: 'Graphic Depictions Of Violence' },
    { type: 'characters', label: 'Original Characters' },
    { type: 'freeforms', label: 'Epistolary' },
    { type: 'freeforms', label: 'Angst' },
  ],
  'He wrote them all. He sent none.',
  '3,104',
  '1/1'
)}
${blurb(
  '3',
  'A Study in Lamplight',
  'greenglassmoth',
  [
    { type: 'relationships', label: 'Ash & Wren' },
    { type: 'characters', label: 'Wren' },
    { type: 'freeforms', label: 'Found Family' },
    { type: 'freeforms', label: 'Hurt/Comfort' },
  ],
  'Three months of quiet evenings, one shared apartment, and the slow discovery that home is a verb.',
  '47,219',
  '12/15'
)}
</ol>`;

/**
 * **An author's work skin, sitting in the middle of the chapter.**
 *
 * Not decoration, and not transcribed from AO3 — this is the thing our own
 * details rules were vandalising. A work skin is nested markup pasted into
 * chapter text: divs inside divs, each holding a `<p>`. Every one of those divs
 * is a *parent*, and `:first-of-type` matches once per parent, so a descendant
 * drop-cap selector put a floated 4em capital on every bubble, caption and
 * footer line in the work. It shipped, and a real AO3 page showed it (plan §14).
 *
 * It stays in the mock permanently. The Reading state is the only place our
 * rules can reach into somebody else's design, so the preview has to contain
 * somebody else's design — otherwise the next selector that over-reaches looks
 * perfect right up until a reader turns the skin on over a real fic.
 *
 * The shape is deliberately our own conversation generator's: it is the work
 * skin most likely to be underneath one of our site skins.
 */
const AUTHOR_WORK_SKIN = `
            <div class="chat ios">
              <div class="bubble in"><p>Where are you? I&apos;m waiting at the cafe.</p></div>
              <div class="bubble out"><p>On my way — see you shortly!</p></div>
              <div class="bubble in"><p>Who are you guys?</p></div>
              <hr class="rule" />
              <div class="caption"><p>Two hours earlier</p></div>
            </div>
            <blockquote class="note"><p>Found tucked inside the map case.</p></blockquote>`;

/**
 * The author's work-skin CSS, and **it loads after ours**.
 *
 * That order is the whole point, and getting it wrong here would hide the exact
 * bug this block exists to expose. On AO3 the site skin is a stylesheet in
 * `<head>`; a work skin is rendered *in the body* by `works/show.html.erb`
 * (`<div id="work-skin"><%= render "works/work_skin" %></div>`). So an author's
 * rule is both later in the document and `#workskin`-prefixed — it beats
 * anything of ours at equal specificity, **unless we write `!important`**.
 *
 * Which is why the preview has to load it here rather than alongside AO3's
 * defaults: with this third stylesheet in the right place, "does our skin
 * trample the author's work?" is a question you can answer by looking.
 *
 * Never part of the export, exactly like AO3_BASE_CSS.
 */
export const AUTHOR_WORK_SKIN_CSS = `
#workskin .chat { margin: 1.5em 0; }
#workskin .chat .bubble {
  max-width: 70%; margin: 0.4em 0; padding: 0.5em 0.75em; border-radius: 1.1em;
  background: #e9e9eb; color: #111;
}
#workskin .chat .bubble.out { margin-left: auto; background: #1c8cf8; color: #fff; }
#workskin .chat .bubble p { margin: 0; }
#workskin .chat .caption { text-align: center; font-size: 0.85em; opacity: 0.7; }
#workskin .chat .caption p { margin: 0.5em 0; }
#workskin .chat hr.rule { border: 0; border-top: 1px solid #ccc; width: 40%; margin: 1em auto; }

/* A deliberately opinionated blockquote. If the reader's body font appears here
   instead of this one, our skin is overriding the author — which is what the
   Reading preview is for. */
#workskin blockquote.note {
  font-family: 'Courier New', Courier, monospace;
  background: #fffbe6; color: #4a3c10; border-inline-start: 2px solid #d8c37a;
  padding: 0.75em;
}`.trim();

/**
 * A work's metadata table (works/_meta). The type class sits on the `dd` here,
 * not on the `li` as it does in a listing — which is why the tag-colour rules
 * need two selectors per type, and why both places are in the mock.
 */
const WORK_META = `
  <dl class="work meta group">
    <dt class="rating tags">Rating:</dt>
    <dd class="rating tags"><ul class="commas"><li><a class="tag" href="#">Teen And Up Audiences</a></li></ul></dd>
    <dt class="warning tags">Archive Warnings:</dt>
    <dd class="warning tags"><ul class="commas"><li><a class="tag" href="#">No Archive Warnings Apply</a></li></ul></dd>
    <dt class="relationship tags">Relationships:</dt>
    <dd class="relationship tags"><ul class="commas"><li><a class="tag" href="#">Mara/The Messenger</a></li></ul></dd>
    <dt class="character tags">Characters:</dt>
    <dd class="character tags"><ul class="commas"><li><a class="tag" href="#">Mara</a></li><li><a class="tag" href="#">The Messenger</a></li></ul></dd>
    <dt class="freeform tags">Additional Tags:</dt>
    <dd class="freeform tags"><ul class="commas"><li><a class="tag" href="#">Slow Burn</a></li><li><a class="tag" href="#">Mutual Pining</a></li></ul></dd>
  </dl>`;

const READING = `
<div class="work">
  ${WORK_META}
  <div id="work-skin" class="wrapper">
    <div id="workskin">
      <div class="preface group">
        <h2 class="title heading">The Cartographer's Impossible Map</h2>
        <h3 class="byline heading"><a rel="author" href="#">inkandstarlight</a></h3>
        <div class="summary module">
          <h3 class="heading">Summary:</h3>
          <blockquote class="userstuff">
            <p>Mara discovers a map that redraws itself whenever someone tells a lie.</p>
          </blockquote>
        </div>
      </div>
      <div id="chapters" role="article">
        <div class="chapter" id="chapter-1">
          <div class="chapter preface group"><h3 class="title">Chapter 1: The Tuesday Problem</h3></div>
          <div class="userstuff module" role="article">
            <h3 class="landmark heading">Chapter Text</h3>
            <p>The map began lying on a Tuesday, which Mara felt was typical of it. Tuesdays were
            for inventory and for the slow accumulation of small regrets, and now, apparently,
            for cartographic insurrection.</p>
            <p>She had bought it for two coins from a man who would not meet her eyes.</p>
            <hr />
            <p>By noon the palace messenger had arrived, and the map, with what Mara could only
            describe as enthusiasm, redrew the entire eastern road.</p>
${AUTHOR_WORK_SKIN}
            <p>She read it twice, then folded it into her sleeve.</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>`;

const DASHBOARD_SIDEBAR = `
<div id="dashboard" class="region own" role="navigation">
  <h4 class="landmark heading">Your account</h4>
  <ul class="navigation actions">
    <li><span class="current">Profile</span></li>
    <li><a href="#">Works</a></li>
    <li><a href="#">Series</a></li>
    <li><a href="#">Bookmarks</a></li>
    <li><a href="#">Collections</a></li>
  </ul>
</div>`;

const DASHBOARD_MAIN = `
<h2 class="heading">inkandstarlight</h2>
<div class="userstuff module">
  <p>Writing mostly about maps, messengers, and the long way round.</p>
</div>
<ol class="work index group">
${blurb(
  '4',
  'Nine Letters, Unsent',
  'inkandstarlight',
  [
    { type: 'relationships', label: 'Mara/The Messenger' },
    { type: 'freeforms', label: 'Epistolary' },
  ],
  'He wrote them all. He sent none.',
  '3,104',
  '1/1'
)}
</ol>`;

/** The `#main` content and any sibling regions, per preview state. */
function stateMarkup(state: PreviewState): string {
  if (state === 'reading') {
    return `<div id="main" class="works-show region" role="main">${READING}</div>`;
  }
  if (state === 'dashboard') {
    return `${DASHBOARD_SIDEBAR}<div id="main" class="dashboard region" role="main">${DASHBOARD_MAIN}</div>`;
  }
  return `<div id="main" class="works-index region" role="main">${BROWSE}</div>`;
}

/** The body content only — used when patching an already-loaded iframe. */
export function mockBody(state: PreviewState): string {
  return `
<div id="outer" class="wrapper">
  ${header(state === 'browse')}
  <div id="inner" class="wrapper">
    ${stateMarkup(state)}
  </div>
  ${FOOTER}
</div>`.trim();
}

/** ID of the style element the editor patches in place as controls move. */
export const SKIN_STYLE_ID = 'compiled-site-skin';

/**
 * A complete document for `<iframe srcdoc>`.
 *
 * **Three stylesheets, in AO3's own order**, and the order is not cosmetic — it
 * is what makes the preview honest about which rules actually win:
 *
 *  1. AO3's defaults, in `<head>`
 *  2. our compiled skin, also in `<head>` (a site skin is a stylesheet there)
 *  3. the author's work skin, which AO3 renders **in the body**
 *
 * Only the middle one is ours, and only the middle one is exported.
 */
export function mockDocument(state: PreviewState, skinCss: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Site skin preview</title>
<style id="ao3-base">${AO3_BASE_CSS}</style>
<style id="${SKIN_STYLE_ID}">${skinCss}</style>
<style id="author-work-skin" data-loads-after="the site skin, as AO3 renders it in the body">${AUTHOR_WORK_SKIN_CSS}</style>
</head>
<body class="logged-in">
${mockBody(state)}
</body>
</html>`;
}
