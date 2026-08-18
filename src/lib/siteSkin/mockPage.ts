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

/* 08-actions. The float is the reason AO3's nav bar sits BELOW the site title
   rather than beside it.

   The button cascade below used to be left out of this subset, with a comment
   saying it was "a large cascade with nothing our skin overrides". That stopped
   being true the moment the chrome rules landed, and it is the exact shape of
   mistake invariant 4 exists to prevent: without these rules the preview shows
   our buttons on a blank page and every specificity question answers itself
   wrongly. The gradient is the part that matters — a background-color alone
   leaves it sitting on top, which is what makes the control look dead. */
ul.actions { float: right; }
.actions a, .actions a:link, .action, .action:link,
.actions button, .actions input, input[type="submit"], button, .actions label {
  background: #eee;
  background-image: linear-gradient(#fff 2%, #ddd 95%, #bbb 100%);
  border: 1px solid #bbb;
  border-radius: 0.25em;
  color: #444;
  cursor: pointer;
  display: inline-block;
  font-size: 0.875em;
  padding: 0.25em 0.5em;
  text-decoration: none;
}
/* AO3's own exemptions, and the reason our chrome rules are scoped to #main.
   Both are ID-scoped at (1,0,1) and beat ".actions a" at (0,1,1) — but they
   are NOT !important, so a shouted bare ".actions a" from us would defeat them
   and put a button chip behind every header and footer link. */
#footer a, #footer button { background: none; border: 0; border-radius: 0; }
#header .primary a { background: none; border: 0; border-radius: 0; }

/* 08-actions — pagination */
ol.pagination { clear: both; text-align: center; padding: 0.5em 0; }
ol.pagination li { display: inline; padding: 0 0.15em; }
.current { background: #ccc; color: #111; border: 1px solid #bbb; padding: 0.25em 0.5em; border-radius: 0.25em; }

/* 07-forms */
input, textarea, select {
  background: #fff;
  border: 1px solid #bbb;
  box-shadow: inset 0 1px 2px #ccc;
  color: #2a2a2a;
  font-family: inherit;
  font-size: 0.875em;
  padding: 0.25em;
}
/* The cream flash on focus, which is at its worst on a black theme. */
input:focus, textarea:focus, select:focus { background: #f3efec; }
/* AO3 paints EVERY fieldset #ddd, with a cream border and an inset grey bevel,
   and the panel nested inside it #fff. Transcribed from
   public/stylesheets/site/2.0/07-interactions.css.

   What this file used to carry — "border: 1px solid #ccc", no background at all
   — was a reconstruction rather than a transcription, and it is exactly the trap
   §21b names. The consequence was not cosmetic: the comment form under every
   work is a fieldset, so the largest interactive block on the archive was
   painted grey for every reader on a dark theme, and our preview showed it
   correctly themed. It was invisible here until a screenshot of the real page
   arrived (§25). */
fieldset, form dl, fieldset dl dl, fieldset fieldset fieldset, fieldset fieldset dl dl, dd.hideme, form blockquote.userstuff {
  display: block; background: #ddd; border: 2px solid #f3efec;
  margin: 0.643em; padding: 0.643em; box-shadow: inset 1px 0 5px #999;
}
fieldset dl, fieldset.actions, fieldset dl fieldset dl { background: transparent; border: none; clear: right; box-shadow: none; }
fieldset fieldset, fieldset dl dl, form blockquote.userstuff { background: #fff; clear: right; }
fieldset legend { background: #eee; color: #444; padding: 0.15em 0.5em; border: 1px solid #ccc; }
.filters dt { background: #eee; color: #444; padding: 0.15em 0.5em; }

/* 15-group-comments */
li.comment, div.comment { border: 1px solid #ccc; margin: 0 0 0.5em; padding: 0; list-style: none; }
.comment h4.byline { background: #ddd; border-bottom: 1px solid #ccc; margin: 0; padding: 0.25em 0.5em; font-size: 1em; }
.comment .userstuff { padding: 0.5em; margin: 0; }
.thread .even { background: #eee; }
.thread li { list-style: none; }

/* 06-region-header / autocomplete. AO3 renders the dropdown next to the field
   it serves; it is rendered OPEN here for the same reason the header dropdown
   is — a rule that cannot be seen ships unverified (§10). */
.autocomplete { position: relative; display: inline-block; }
.autocomplete .dropdown ul { background: #fff; border: 1px solid #bbb; margin: 0; padding: 0; position: absolute; z-index: 40; width: 16em; }
.autocomplete .dropdown ul li { background: #fff; color: #2a2a2a; display: block; padding: 0.25em 0.5em; list-style: none; }
.autocomplete .dropdown ul li.selected { background: #ddd; }

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

/* 09-roles-states — the comma between tags, which AO3 puts in CSS rather than
   in the markup. Missing from this subset until the tag separator control
   landed, and its absence was the same failure as every other one on this
   page: the preview showed tags separated by nothing, the archive showed them
   separated by commas, and a control whose whole job is to replace that comma
   had nothing to replace.

   All three rules, in AO3's order — the last-child pair is the load-bearing
   half (§26c.1). AO3 suppresses the separator after the final tag, so a
   control that overrides ".commas li:after" without noticing leaves a bullet
   dangling at the end of every list. */
.commas li:after { content: ", "; }
.commas li { display: inline; }
.commas li:last-child:after, .commas li:only-child:after { content: none; }

/* 10-types-groups */
a.tag { color: #111; line-height: 1.5; text-decoration: none; padding: 0; border-bottom: 1px dotted; }
.tags li { display: inline; padding-left: 0; padding-right: 0.25em; }

/* 10-types-groups, continued — the four hard-coded light colours §22 found,
   in AO3's own file order (99, 126-146, 184, 265-271). Every one of them was
   missing from this subset until 17 Aug 2026, which is why the preview showed
   three finished-looking states while four of the nine pages a real skin author
   screenshots were still AO3 grey. A region absent from this file is not "not
   yet styled" — it is invisible, and invisible looks exactly like finished. */
.wrapper:has(> table, > .meta) { box-shadow: 1px 1px 5px #aaa; }
dl.index { margin: 0.643em 0; border: none; box-shadow: none; }
dl.index dt { width: auto; float: none; border: none; }
dl.index dd {
  width: auto; float: none; clear: right;
  margin: 0 0.25em 0.643em 2.5em; padding: 0.375em 0.15em 0.15em;
  overflow: visible; background: #ededed;
}
/* The pale chip behind every relationship tag in every listing — §22c. Our
   "colour tags by type" control sets the tag's text colour and left this
   alone, so thirteen templates rendered tinted text on a light pill. */
li.relationships a { background: #eee; }
.statistics .index li { padding: 0.643em 0.375em; }
.statistics .index li:nth-of-type(even) { background: #eee; }

/* 11-group-listbox — the construct all four uncovered page types failed
   through. AO3 paints the outer box #ddd and the inner panel #fff, so a reader
   on a dark theme met a light-grey box holding a white one on Profile,
   Collections, Own works and the filter sidebar. Transcribed verbatim from
   public/stylesheets/site/2.0/11-group-listbox.css. */
.listbox, fieldset fieldset.listbox {
  clear: right;
  background: #ddd;
  border: 2px solid #ccc;
  padding: 0;
  margin: 0.643em auto;
  overflow: hidden;
  box-shadow: 0 0 0 1px #fff;
}
.listbox .heading { display: inline-block; }
.listbox li.blurb, .listbox .landmark.heading, .listbox .tags .listbox, .listbox .lots li, .listbox .all li { display: block; }
.listbox > .heading, .listbox .heading a:visited { margin: 0; color: #2a2a2a; padding: 0.25em; }
.listbox .index {
  width: auto; padding: 0.643em; margin: 0; float: none; clear: right;
  background: #fff;
  box-shadow: inset 1px 1px 3px #bbb;
}
.listbox li.blurb { box-shadow: none; }

/* 12-group-meta — the work metadata table, on EVERY work page. Labels float
   left of their values, which is what makes a work page's tags read as a list
   of rows. The border was transcribed as "#ddd" until 17 Aug 2026; AO3 says
   "#ccc", and the mock had been quietly one shade kinder than the real page. */
dl.meta { border: 1px solid #ccc; padding: 0.75em; margin: 0 0 1em; }
dl.meta dt { float: left; clear: left; margin: 0 0.25em 0 0; font-weight: bold; }
dl.meta dd { margin: 0 0 0.25em; padding: 0 0 0 12em; }
dl.meta ul.commas li { display: inline; padding-right: 0.25em; }
/* The stats row at the foot of every work's metadata table. A second context
   for dl.stats, and the one that carries "Published:" and a date - which is
   why the stat-icon control hides seven named labels rather than every dt it
   can reach. Transcribed from 12-group-meta.css. */
.meta .stats dl { float: left; margin-top: 0; }
.meta .stats dl, .meta .stats dl dt, .meta .stats dl dd { padding-inline-start: 0; }
.meta .stats dl dt, .meta .stats dl dd {
  margin-block: 0 auto; margin-inline: 0 0.375em; padding-inline-end: 0.25em;
  width: auto; min-width: 0; clear: none; float: left;
}
.meta .stats dl dd { padding-inline-end: 0.75em; }

/* 13-group-blurb */
li.blurb { display: block; position: relative; clear: left; padding: 0.429em 0.75em; overflow: visible; }
.blurb .heading { display: block; }

/* 13-group-blurb — the required-tags icon block, and every rule the "required
   tags as words" control has to undo. AO3 lays the four icons out as a 2x2 grid
   of 25px boxes pinned to the left of the blurb, reserves 65px of the header
   for them, and hides the words that are already in the markup by shrinking
   them to nothing and painting them transparent. The words are the accessible
   content; the sprite is a picture of them.

   **The order of the next two blocks is load-bearing.** ".blurb .header ul"
   and ".blurb ul.required-tags" are both (0,2,1), so the later one wins — and
   the later one is "margin: 0", which is what keeps the icon block at the left
   edge of the blurb instead of indenting it into the title it is making room
   for. Transcribed in AO3's order for that reason; swapping them puts the
   icons on top of the heading, which is exactly what a first pass at this
   subset did. */
.blurb .header { min-height: 55px; margin-bottom: 0.375em; }
.blurb .header .heading, .blurb .header ul {
  display: block; background: transparent; margin: 0.375em 5.25em 0 65px;
}

.blurb ul.required-tags { position: absolute; top: 0; width: 60px; margin: 0; }
.blurb ul.required-tags li,
.blurb ul.required-tags li a,
.blurb ul.required-tags li span {
  display: block; width: 25px; height: 25px;
  margin-top: 0; margin-bottom: 0; padding-left: 0;
}
.blurb ul.required-tags li { margin-bottom: 3px; }
.blurb ul.required-tags li + li + li,
.blurb ul.required-tags li + li + li + li { position: absolute; left: 28px; }
.blurb ul.required-tags li + li + li { top: 0; }
.blurb ul.required-tags li + li + li + li { top: 28px; }
.blurb span.text { height: 0; width: 0; font-size: 0.001em; color: transparent; }
/* AO3's icons come from one sprite sheet on its own domain. Hotlinking it
   would be rude and would break offline, so — exactly like the logo below —
   this is a stand-in at the same size and in the same layer. It has to be a
   background-IMAGE, because "background-image: none" is what the control
   emits to remove it; a stand-in painted with background-color would survive
   the rule and sit behind the words. */
.blurb ul.required-tags li span {
  background-repeat: no-repeat;
  background-image: linear-gradient(135deg, #900 0%, #900 50%, #c66 50%, #c66 100%);
  border-radius: 2px;
}
.blurb h4 a:link { color: #900; }
.blurb dl.stats { float: right; line-height: 1.5; }
.blurb dl.stats dt, .blurb dl.stats dd { display: inline; margin: 0; padding-left: 0.25em; }
.datetime { font-family: monospace; }

/* 13-group-blurb, PICTURE modification. AO3's own comment: "use this along
   with 'index' and 'blurb' for indices where we have icon pictures, eg
   collections, users, skins, instead of the 4-icon list". The icon is 55px and
   absolutely positioned, and the 65px gutter on .blurb .header .heading is what
   makes room for it - which is why the "required tags as words" control must
   not clear that gutter on a blurb that has no required tags. Added 18 Aug
   2026, after an unscoped version of that control hid the first 65px of every
   title on the real Skins page. */
.picture .header { border-bottom: 1px solid #ccc; }
.picture .icon img, .index .picture .icon {
  position: absolute; top: 0; height: 55px; width: 55px;
  background-repeat: no-repeat; background-color: #ddd; border-radius: 3px;
}

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

/**
 * The four required tags, in `tags_helper.rb#get_symbols_for`'s own markup.
 *
 * Two details here are load-bearing and neither is obvious. The `li`s carry
 * **no class** — which is why AO3 positions them with `li+li+li` and why our
 * rules target the inner spans instead. And the real words are already present,
 * in `span.text`, hidden by CSS rather than absent: the control that shows them
 * is un-hiding content, not generating it, and this markup is where that claim
 * is either true or false.
 */
type MockRequired = { rating: [string, string]; warnings: [string, string]; category: [string, string]; status: [string, string] };

const DEFAULT_REQUIRED: MockRequired = {
  rating: ['rating-general-audience', 'General Audiences'],
  warnings: ['warning-no', 'No Archive Warnings Apply'],
  category: ['category-gen', 'Gen'],
  status: ['complete-yes', 'Complete Work'],
};

function requiredTags(r: MockRequired): string {
  const item = ([className, text]: [string, string], group: string) => `
      <li><a class="help symbol question" href="#"><span class="${className} ${group}" title="${text}"><span class="text">${text}</span></span></a></li>`;
  return `
    <ul class="required-tags">${item(r.rating, 'rating')}${item(r.warnings, 'warnings')}${item(
    r.category,
    'category'
  )}${item(r.status, 'iswip')}
    </ul>`;
}

/**
 * The rest of AO3's stat row.
 *
 * Present because the stat-icon control replaces seven labels and the mock used
 * to render two of them. Five rules with nowhere to land look exactly like five
 * rules that work — §22d, one control further on.
 *
 * `bookmarks` is a link on the real page and a bare number everywhere else,
 * which is why it is marked up as one here: an `::before` on the `dd` has to
 * land outside the anchor, not inside it.
 */
type MockStats = { comments: string; kudos: string; bookmarks: string; hits: string };

const DEFAULT_STATS: MockStats = {
  comments: '48',
  kudos: '1,204',
  bookmarks: '96',
  hits: '18,733',
};

function blurb(
  id: string,
  title: string,
  author: string,
  tags: MockTag[],
  summary: string,
  words: string,
  chapters: string,
  required: MockRequired = DEFAULT_REQUIRED,
  stats: MockStats = DEFAULT_STATS
): string {
  return `
  <li id="work_${id}" class="work blurb group" role="article">
    <div class="header module">${requiredTags(required)}
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
      <dt class="language">Language:</dt><dd class="language">English</dd>
      <dt class="words">Words:</dt><dd class="words">${words}</dd>
      <dt class="chapters">Chapters:</dt><dd class="chapters">${chapters}</dd>
      <dt class="comments">Comments:</dt><dd class="comments">${stats.comments}</dd>
      <dt class="kudos">Kudos:</dt><dd class="kudos">${stats.kudos}</dd>
      <dt class="bookmarks">Bookmarks:</dt><dd class="bookmarks"><a href="#">${stats.bookmarks}</a></dd>
      <dt class="hits">Hits:</dt><dd class="hits">${stats.hits}</dd>
    </dl>
  </li>`;
}

/**
 * The controls §18a repaints, in AO3's own markup.
 *
 * Every one of these is here because a rule that cannot be watched ships
 * unverified (§10, invariant 4). The autocomplete dropdown is rendered **open**
 * for the same reason the header's is: a closed panel proves nothing about the
 * rule that paints it, and `.selected` is a state a static mock can only show
 * by asserting it.
 */
const BROWSE_CONTROLS = `
<ul class="actions" role="menu">
  <li><a href="#">Post</a></li>
  <li><a href="#">Sort &amp; Filter</a></li>
</ul>
<form class="filters simple" action="#">
  <fieldset>
    <legend>Search within results</legend>
    <div class="autocomplete">
      <label for="tag_search">Tag</label>
      <input id="tag_search" type="text" value="slow bu" autocomplete="off">
      <div class="dropdown">
        <ul>
          <li class="selected">Slow Burn</li>
          <li>Slow Build</li>
          <li>Slow Romance</li>
        </ul>
      </div>
    </div>
    <p class="submit actions"><input type="submit" value="Search"></p>
  </fieldset>
</form>`;

/** AO3 puts `.actions` on the pagination list too, so the page links are buttons. */
const BROWSE_PAGINATION = `
<ol class="pagination actions" role="navigation">
  <li class="previous"><a href="#">← Previous</a></li>
  <li><a href="#">1</a></li>
  <li class="current">2</li>
  <li><a href="#">3</a></li>
  <li class="next"><a href="#">Next →</a></li>
</ol>`;

const BROWSE = `
<h2 class="heading">Works in Original Work</h2>
<div class="notice" role="status">
  <p>Your filters have been applied. 5 works found.</p>
</div>
${BROWSE_CONTROLS}
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
  '1/1',
  // Deliberately not the defaults. Four identical icon blocks would make the
  // words look like boilerplate and would hide three of the four type colours.
  {
    rating: ['rating-mature', 'Mature'],
    warnings: ['warning-yes', 'Graphic Depictions Of Violence'],
    category: ['category-multi', 'M/M, F/M'],
    status: ['complete-yes', 'Complete Work'],
  }
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
  '12/15',
  // A work in progress — the status icon nobody can tell from the others at a
  // glance, which is most of the argument for the control.
  {
    rating: ['rating-teen', 'Teen And Up Audiences'],
    warnings: ['warning-choosenotto', 'Creator Chose Not To Use Archive Warnings'],
    category: ['category-femslash', 'F/F'],
    status: ['complete-no', 'Work in Progress'],
  }
)}
${blurb(
  '4',
  'The Lamplighter’s Apprentice',
  'saltandcopper',
  // No warnings and no relationships, so this is where a run STARTS with
  // characters — one of the four ways a group can be first, and one no other
  // blurb on this page shows. A reader with hide_warnings? set sees every
  // listing look like this, which is why the label rules cannot be adjacency
  // rules alone.
  [
    { type: 'characters', label: 'Wren' },
    { type: 'characters', label: 'The Lamplighter' },
    { type: 'freeforms', label: 'Worldbuilding' },
  ],
  'Wren is nine, the lamps are older than the city, and somebody has to climb.',
  '8,410',
  '3/3',
  {
    rating: ['rating-general-audience', 'General Audiences'],
    warnings: ['warning-no', 'No Archive Warnings Apply'],
    category: ['category-gen', 'Gen'],
    status: ['complete-yes', 'Complete Work'],
  }
)}
${blurb(
  '5',
  'Salt Harbour, Six Winters',
  'quietharbour',
  // Warnings straight to additional tags, skipping both middle groups. The
  // adjacency rules are six because a group may follow any group before it,
  // not only the one immediately before it — and this is the pair that would
  // have gone unnoticed.
  [
    { type: 'warnings', label: 'Major Character Death' },
    { type: 'freeforms', label: 'Grief/Mourning' },
  ],
  'The harbour freezes every year. Every year he waits for it to thaw.',
  '2,006',
  '1/1',
  {
    rating: ['rating-mature', 'Mature'],
    warnings: ['warning-yes', 'Major Character Death'],
    category: ['category-none', 'No category'],
    status: ['complete-yes', 'Complete Work'],
  }
)}
</ol>
${BROWSE_PAGINATION}`;

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
 *
 * **The `div.wrapper` around it is not scaffolding.** otwcode's meta pattern
 * states the rule outright — "meta is always wrapped in `<div class='wrapper'>`"
 * — and `works/_meta.html.erb` opens with exactly that. It matters because
 * 10-types-groups hangs `box-shadow: 1px 1px 5px #aaa` off
 * `.wrapper:has(> table, > .meta)`, so every work page carries a grey halo
 * around its metadata. The mock had no wrapper until 17 Aug 2026 and the halo
 * was therefore invisible here while being on every work page on the archive.
 */
const WORK_META = `
  <div class="wrapper">
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
    <dt class="stats">Stats:</dt>
    <dd class="stats">
      <dl class="stats">
        <dt class="published">Published:</dt><dd class="published">2026-08-06</dd>
        <dt class="words">Words:</dt><dd class="words">12,842</dd>
        <dt class="chapters">Chapters:</dt><dd class="chapters">4/4</dd>
        <dt class="comments">Comments:</dt><dd class="comments">48</dd>
        <dt class="kudos">Kudos:</dt><dd class="kudos">1,204</dd>
        <dt class="bookmarks">Bookmarks:</dt><dd class="bookmarks"><a href="#">96</a></dd>
        <dt class="hits">Hits:</dt><dd class="hits">18,733</dd>
      </dl>
    </dd>
  </dl>
  </div>`;

/**
 * A comment thread, and its position is the point.
 *
 * `#feedback` is a **sibling** of `#work-skin`, not a child — which is why the
 * chrome rules that paint a byline or an alternating row can carry `!important`
 * without the §14b problem. An author's work skin is scoped by AO3 to
 * `#workskin` and cannot reach a comment, so there is no author here to trample.
 * Nesting this inside the work would quietly make that false.
 *
 * `.even` sits on the second `li.comment` because AO3 alternates them there, and
 * `.thread .even` (0,2,0) is what beats our own `li.comment` (0,1,1).
 */
const FEEDBACK = `
  <div id="feedback" class="feedback">
    <div class="comments module">
      <h3 class="heading">Comments (2)</h3>
      <ol class="thread">
        <li id="comment_1" class="comment group">
          <h4 class="byline heading"><a href="#">quietharbour</a> on Chapter 1
            <span class="posted datetime">Wed 12 Aug 2026 09:14PM</span></h4>
          <blockquote class="userstuff">
            <p>The map redrawing itself around him is doing so much work in this chapter.</p>
          </blockquote>
        </li>
        <li id="comment_2" class="comment group even">
          <h4 class="byline heading"><a href="#">greenglassmoth</a> on Chapter 1
            <span class="posted datetime">Thu 13 Aug 2026 07:02AM</span></h4>
          <blockquote class="userstuff">
            <p>Tuesdays were for inventory and the slow accumulation of small regrets — I am unwell.</p>
          </blockquote>
        </li>
      </ol>
      <form class="comment new" action="#">
        <fieldset>
          <legend>Leave a comment</legend>
          <p>
            <label for="comment_body" class="landmark">Comment</label>
            <textarea id="comment_body" rows="3" cols="60">Every Tuesday I think about this fic.</textarea>
          </p>
          <p class="submit actions"><input type="submit" value="Comment"></p>
        </fieldset>
      </form>
    </div>
  </div>`;

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
            <!-- A SHORT opening paragraph, deliberately, and it is load-bearing.
                 The drop cap floats about three body lines tall, so a first
                 paragraph shorter than that lets the float overhang into the
                 paragraph below and indent it. Every version of this mock before
                 17 Aug 2026 opened with three full lines, which contains the
                 float by accident — so the defect was invisible here and showed
                 up immediately on a real work (P1/P2). Keep this to one line. -->
            <p>The map began lying on a Tuesday.</p>
            <p>Mara felt that was typical of it. Tuesdays were for inventory and for the slow
            accumulation of small regrets, and now, apparently, for cartographic insurrection.</p>
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
  ${FEEDBACK}
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

/**
 * A profile's listbox sections, in `users/_contents.html.erb`'s own markup.
 *
 * `<div class="… listbox group"><h3 class="heading">…</h3><ol class="index group">`
 * is exactly what AO3 wraps Fandoms, Recent works, Recent series and Recent
 * bookmarks in — and it is the construct §22 found we had never styled. Four of
 * the nine page types a real skin author screenshots fail through it: Profile,
 * Collections, Own works, and the filter sidebar.
 *
 * The nesting is the whole point. `.listbox` is an outer box AO3 paints #ddd,
 * `.listbox .index` is an inner panel it paints #fff, and getting the polarity
 * of that pair wrong is invisible in a diff and obvious on a page.
 */
const DASHBOARD_LISTBOXES = `
<div class="fandom listbox group" id="user-fandoms">
  <h3 class="heading">Fandoms</h3>
  <ol class="index group">
    <li><a href="#">Original Work</a> (4)</li>
    <li><a href="#">No Fandom</a> (1)</li>
  </ol>
</div>
<div class="work listbox group" id="user-works">
  <h3 class="heading">Recent works</h3>
  <ul class="index group">
${blurb(
  '6',
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
${blurb(
  '7',
  'Tide Tables',
  'inkandstarlight',
  // Additional tags and nothing else — the last of the four ways a run can
  // start, and the only blurb in the mock that shows it. Common in practice: a
  // work with no named characters, or a reader with hide_freeform? off and
  // hide_warnings? on.
  [
    { type: 'freeforms', label: 'Poetry' },
    { type: 'freeforms', label: 'Sea Imagery' },
  ],
  'Twelve tides, twelve poems, one harbour.',
  '900',
  '1/1'
)}
  </ul>
</div>
<div class="skins listbox group" id="user-skins">
  <h3 class="heading">Site skins</h3>
  <ul class="index group">
    <!-- A PICTURE blurb: an icon in the gutter instead of the four required-tag
         symbols. This is what a Skins, Collections, Users or Tags listing is
         made of, and it is the shape that caught the unscoped gutter reset on
         18 Aug 2026 — the whole first 65px of every title, hidden behind the
         icon, on a page the mock had never rendered. -->
    <li class="skins picture blurb group" role="article">
      <div class="header module">
        <span class="icon"><img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" alt="" width="55" height="55"></span>
        <h4 class="heading"><a href="#">Moonlit Library ao3skingen</a> by <a rel="author" href="#">inkandstarlight</a></h4>
      </div>
      <blockquote class="userstuff summary"><p>(No Description Provided)</p></blockquote>
    </li>
  </ul>
</div>`;

/**
 * `dl.index` and the statistics page's zebra rows — the other two shadings §22
 * found, and the reason `commentAlt` is not only a comment colour.
 *
 * `dl.index` is AO3's short-form alternative to a full blurb: subscriptions,
 * related works, assignments. The diagram in otwcode's index pattern doc is
 * dt → link, dd → actions, which is what this is. `.statistics .index` is
 * `stats/index.html.erb`'s per-fandom listing, wrapped in a listbox of its own
 * on the real page — the second `li` carries the even-row shading.
 */
const DASHBOARD_INDEXES = `
<h3 class="heading">Subscriptions</h3>
<dl class="subscription index group">
  <dt><a href="#">The Cartographer's Impossible Map</a></dt>
  <dd><ul class="actions"><li><a href="#">Unsubscribe</a></li></ul></dd>
  <dt><a href="#">A Study in Lamplight</a></dt>
  <dd><ul class="actions"><li><a href="#">Unsubscribe</a></li></ul></dd>
</dl>
<h3 class="heading">Statistics</h3>
<ul class="statistics index group">
  <li class="fandom listbox group">
    <h5 class="heading">Original Work</h5>
    <ul class="index group">
      <li>Subscriptions: 41</li>
      <li>Hits: 12,908</li>
      <li>Kudos: 631</li>
      <li>Bookmarks: 88</li>
    </ul>
  </li>
</ul>`;

const DASHBOARD_MAIN = `
<h2 class="heading">inkandstarlight</h2>
<div class="userstuff module">
  <p>Writing mostly about maps, messengers, and the long way round.</p>
</div>
${DASHBOARD_LISTBOXES}
${DASHBOARD_INDEXES}`;

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
