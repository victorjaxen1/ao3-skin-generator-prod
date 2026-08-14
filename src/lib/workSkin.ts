import { SkinProject } from './schema';
import {
  buildCSS,
  buildHTML,
  platformTheme,
  SkinTheme,
  withPlatformLook,
  withPlatformTheme,
} from './generator';
import { lintAo3Css, stripCssComments, Violation } from './siteSkin/ao3Css';

/**
 * The third export: a real AO3 work skin.
 *
 * The other two hand back a picture. This hands back the CSS and HTML that
 * produce the conversation live on the page — selectable text, working links,
 * and something that reflows on a phone instead of forcing a pinch-zoom.
 *
 * It reuses `buildCSS`/`buildHTML` rather than growing a second renderer. That
 * is the whole reason this was cheap: those functions already existed to drive
 * the preview and the screenshot capture, and their output was already
 * `#workskin`-scoped. What was missing was not a generator — it was proof that
 * what they emit is legal, which `lintAo3Css` now provides.
 *
 * ## Why only some platforms
 *
 * AO3 refuses an entire skin over a single property it does not allow, so a
 * platform ships here only once its CSS passes the lint with zero violations.
 * All four now do.
 *
 * iOS and Android carried 12 violations each until 7 Aug 2026 — `animation`
 * and `animation-delay` for the typing indicator (plus `@keyframes`), `gap`,
 * `object-fit`, `pointer-events`, `calc()` in `max-width`, and for Android two
 * relative `url()` backgrounds. What each became is recorded in
 * docs/WORK-SKIN-IMPLEMENTATION.md §9e; the one worth remembering is that two
 * of those rules consisted of nothing *but* `animation-delay`, so deleting the
 * property would have left empty rule sets, which AO3 reports as an error
 * rather than ignoring.
 */

export type WorkSkinTemplate = 'twitter' | 'google' | 'ios' | 'android';

const SUPPORTED: readonly string[] = ['twitter', 'google', 'ios', 'android'];

export function supportsWorkSkin(template: string): boolean {
  return SUPPORTED.includes(template);
}

export interface WorkSkinExport {
  /** Paste into Preferences → Skins → Create Work Skin. */
  css: string;
  /** Paste into the chapter, in HTML mode. */
  html: string;
  /** Non-empty means AO3 would refuse it. Blocks the copy buttons. */
  violations: Violation[];
}

export interface WorkSkinOptions {
  /** Neutral plain-text credit. Off by default so AO3-bound output is opt-in. */
  includeCredit?: boolean;
}

/**
 * AO3's HTML sanitizer drops attributes it does not recognise, silently — no
 * error, unlike the CSS path. `data-message-id` is one of those: it exists so
 * the in-app preview can map a click back to a message, and it means nothing
 * on AO3.
 *
 * Removing it is cosmetic rather than a correctness fix. It is worth doing
 * anyway, because the user is about to paste this into their own chapter and
 * read it back later, and a wall of dead attributes makes their source harder
 * to work with than it needs to be.
 */
function stripEditorAttributes(html: string): string {
  return html.replace(/\s+data-message-id="[^"]*"/g, '');
}

/**
 * Platform icons ship as site-relative paths (`/assets/twitter-logo.png`),
 * which is right for our own pages and fatal on AO3.
 *
 * AO3's `RELATIVE_IMAGE_PATH_TRANSFORMER` rewrites a relative `img src`
 * against `ArchiveConfig.APP_URL` — so `/assets/twitter-logo.png` silently
 * becomes `archiveofourown.org/assets/twitter-logo.png`, which 404s. Every
 * icon in the tweet would be a broken-image box, in somebody's published fic.
 *
 * Absolute CDN addresses instead. `platformAssets.ts` already names Publit the
 * primary and the local folder the fallback; this is the one context where the
 * fallback cannot be used at all.
 */
const PUBLIT_CDN = 'https://media.publit.io/file/AO3-Skins-App';

function absolutizeAssets(html: string): string {
  return html.replace(/src="\/assets\/([^"]+)"/g, `src="${PUBLIT_CDN}/$1"`);
}

/**
 * The same problem, one layer down: Android's default header and footer are
 * `/assets/whatapp-header.png` in `platformAssets.ts`, and they reach the
 * stylesheet as `background: url('/assets/...')`.
 *
 * A relative address fails AO3 harder here than in the HTML. There is no
 * transformer to rewrite it — `URI_REGEX` simply does not match, so the
 * declaration is blanked and AO3 refuses the **entire skin**. This was two of
 * Android's twelve violations, and the only reason iOS did not have the same
 * pair is that its defaults were already absolute Publit URLs.
 *
 * Rewriting here rather than in `platformAssets.ts` keeps the local fallback
 * working for the preview and the PNG, which is the whole point of that file
 * naming two hosts.
 */
function absolutizeCssAssets(css: string): string {
  return css.replace(/url\((['"]?)\/assets\/([^'")]+)\1\)/g, `url($1${PUBLIT_CDN}/$2$1)`);
}

/**
 * Swap the iOS bubble tails from SVG to CSS.
 *
 * `buildHTML` emits an inline `<svg>` for each tail because html2canvas cannot
 * rasterise `::after`, so the PNG needs a real element. AO3 has the opposite
 * constraint: `<svg>` is in the sanitizer's `remove_contents` list alongside
 * `script` and `style`, so it and everything inside it are deleted — silently,
 * with the work saving normally. An author would find out when their published
 * fic had square bubbles.
 *
 * So the export drops the SVGs and marks the container, which turns on the
 * `::after` tails that `buildIOSCSS` carries for exactly this purpose. Doing it
 * here rather than in the shared builder keeps the preview and the image on the
 * SVG path, where they have to stay.
 */
function applyCssBubbleTails(html: string): string {
  const withoutSvg = html.replace(/<svg\b[^>]*class="[^"]*bubble-tail[^"]*"[\s\S]*?<\/svg>/g, '');
  if (withoutSvg === html) return html;
  // Appends to whatever the container already carries rather than matching the
  // exact string `class="chat"`, which stopped existing when `buildHTML` began
  // emitting the platform class. That version failed silently and in one
  // direction only: the SVGs still went, the `.css-tails` class never arrived,
  // and iOS shipped with no bubble tails at all.
  return withoutSvg.replace(/(<div class="chat\b[^"]*)"/, '$1 css-tails"');
}

/**
 * Optional AO3-bound attribution. It is deliberately plain, unlinked,
 * commercial-neutral, visible, and off by default. CSS comments cannot carry
 * this credit because AO3 removes them when saving a skin.
 */
const CREDIT = 'Made with AO3 SkinGen';

function appendCredit(html: string): string {
  const close = html.lastIndexOf('</div>');
  if (close === -1) return html;
  return `${html.slice(0, close)}<div class="wm">${CREDIT}</div>${html.slice(close)}`;
}

/**
 * Ship the work skin without comments.
 *
 * **AO3 deletes every comment on save**, so they reach nobody: not the reader,
 * not the author reopening the skin in AO3's editor. They exist for whoever
 * reads `generator.ts`, and that copy is untouched — the preview and the PNG
 * still carry them.
 *
 * They are also the least-tested thing we hand the archive, and on 7 Aug 2026 a
 * saved iOS skin came back missing **eleven consecutive rules** — the CSS bubble
 * tails, both `.time` rules, `.reaction`, `.status-indicator`, `.attach` and the
 * typing row — while every rule before and after survived. The block is
 * bracketed by comments, the same rules survived an earlier save, and our lint
 * calls the stylesheet clean, so what the parser objected to is *not* known.
 *
 * This does not diagnose that. It removes a whole class of interaction between
 * prose we control and a parser we do not, at zero cost on AO3 — and doubles as
 * the experiment: if the eleven rules come back, comments were involved.
 *
 * Do not "restore" the comments to the export without re-saving on real AO3 and
 * diffing the stored CSS rule by rule.
 */
function stripExportComments(css: string): string {
  return stripCssComments(css)
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .join('\n');
}

/**
 * Scope a platform's stylesheet to `.chat.<platform>`, so four of them can
 * share one skin without colliding.
 *
 * ```text
 * #workskin .chat            ->  #workskin .chat.ios
 * #workskin .chat.css-tails  ->  #workskin .chat.css-tails.ios
 * #workskin .tweets          ->  #workskin .tweets.twitter
 * #workskin dd.bubble        ->  #workskin .chat.ios dd.bubble
 * ```
 *
 * This is MASTER §6a, phase 2. It is not used by the single-platform export —
 * that ships un-namespaced, byte for byte as before — and exists for
 * `buildMasterWorkSkin` to call once per platform. The matching platform class
 * *is* already emitted by `buildHTML`, where it is inert until this runs.
 *
 * ## Why it is worth the trouble
 *
 * 290 rules across four stylesheets, 223 distinct selectors, 63 of them shared
 * by two or more platforms — and only 25 that actually conflict, 24 of which
 * are iOS versus Android both building on `dd.bubble`. Namespacing turns that
 * from a merge problem into a mechanical rewrite.
 *
 * ## The four things that make it non-trivial
 *
 * - **A selector already rooted at the container must be tightened, not
 *   nested.** `.chat` and `.tweets` are classes on the *same element*, so
 *   `#workskin .tweets .tweet` cannot become `#workskin .chat.twitter .tweets
 *   .tweet` — that asks for `.tweets` inside itself and matches nothing. Every
 *   `.tweet` rule silently lost its box, its background and its border, which
 *   is why `CONTAINER_CLASSES` exists and why a test cross-checks it against
 *   the markup `buildHTML` actually emits.
 * - **`.chat-header` and `.chat-messages` are not `.chat`.** A naive
 *   `startsWith('.chat')` produces `#workskin .chat.ios-messages`, a class that
 *   exists nowhere, and the rule silently stops matching. Hence the compound is
 *   parsed rather than string-matched. This is the bug this function is most
 *   likely to be "simplified" back into.
 * - **Comments must go first.** A selector capture that runs backwards from `{`
 *   swallows any preceding comment into the selector. That cost the prototype
 *   seven rules, and it is the fourth thing in this codebase to get it wrong —
 *   see `stripCssComments`, which exists for exactly this reason.
 * - **Specificity does not rise uniformly.** A rule already rooted at `.chat`
 *   gains one class; every other rule gains two. Rules that previously tied can
 *   therefore swap order, which no lint can see — so the guarantee this carries
 *   is a rendering one, measured in `tests/namespace.spec.ts` by diffing every
 *   computed style rather than reasoned about here.
 *
 * Throws rather than passing through a selector it cannot scope: an un-scoped
 * rule in a master skin would apply to all four platforms at once, which is
 * precisely the failure this exists to prevent, and silence is how it would
 * reach a published fic.
 */
export function namespaceCss(
  css: string,
  platform: WorkSkinTemplate,
  /**
   * Scope to one theme as well, for a derived override block: every selector
   * gains `.theme-dark` (or `.theme-light`) beside the platform class. Omit it
   * for the base block, which applies whichever theme the container carries.
   */
  theme?: SkinTheme
): string {
  return stripCssComments(css).replace(
    /([^{}]*)(\{[^{}]*\})/g,
    (_whole, selectorList: string, body: string) => {
      const lead = /^\s*/.exec(selectorList)![0];
      const list = selectorList.slice(lead.length);
      if (!list.trim()) return lead + body;
      const scoped = list
        .split(',')
        .map((one) => namespaceSelector(one.trim(), platform, theme))
        .join(',');
      return lead + scoped + body;
    }
  );
}

const ROOT = '#workskin';

/**
 * Every class `buildHTML` puts on the conversation container itself, plus the
 * one `useCssBubbleTails` adds on the export path.
 *
 * A selector whose first compound is made only of these targets the container,
 * so the platform class joins that compound instead of becoming an ancestor of
 * it. Miss one and its rules stop matching, silently — `.tweets` did exactly
 * that, and took every `.tweet` rule with it.
 *
 * Exported so `work-skin.unit.spec.ts` can check it against the markup that is
 * actually emitted, rather than trusting this list to be kept up to date.
 */
export const CONTAINER_CLASSES: readonly string[] = [
  'chat',
  'tweets',
  'css-tails',
  'theme-light',
  'theme-dim',
  'theme-dark',
  'wa-frame-bubbles',
  'wa-frame-header',
  'wa-frame-phone',
  'wa-scroll',
  'wa-wallpaper',
  'ios-frame-bubbles',
  'ios-frame-header',
  'ios-frame-phone',
  'ios-scroll',
];

function namespaceSelector(
  selector: string,
  platform: WorkSkinTemplate,
  theme?: SkinTheme
): string {
  if (!selector.startsWith(ROOT)) {
    throw new Error(`namespaceCss: selector is not scoped to ${ROOT}: ${selector}`);
  }
  // Both classes join the container's own compound, so a theme override is one
  // class more specific than the base rule it overrides and wins regardless of
  // source order. Nothing here depends on the blocks being emitted in any
  // particular sequence.
  const scope = `.${platform}${theme ? `.theme-${theme}` : ''}`;
  const rest = selector.slice(ROOT.length).trim();
  if (!rest) return `${ROOT} .chat${scope}`;

  const compound = /^[^\s>+~]+/.exec(rest)![0];
  if (isContainerCompound(compound)) {
    return `${ROOT} ${compound}${scope}${rest.slice(compound.length)}`;
  }
  return `${ROOT} .chat${scope} ${rest}`;
}

/** True only for a compound built purely of the container's own classes. */
function isContainerCompound(compound: string): boolean {
  const parts = compound.split('.');
  // A leading element, id or anything else means this is not the container —
  // and it keeps `.result-title:hover` out, since the pseudo-class travels with
  // the class name and will not be in the list.
  if (parts[0] !== '') return false;
  const classes = parts.slice(1);
  return classes.length > 0 && classes.every((c) => CONTAINER_CLASSES.includes(c));
}

/**
 * One platform's stylesheet, in the state AO3 has to accept it.
 *
 * **The order is the load-bearing part.** `absolutizeCssAssets` must run before
 * anything downstream reads the sheet: Android reaches `buildCSS` with
 * `url('/assets/…')`, which AO3 refuses outright, and one refused declaration
 * loses the whole skin — all four platforms at once, in the master case.
 */
function platformCss(project: SkinProject): string {
  return stripExportComments(absolutizeCssAssets(buildCSS(project)));
}

/** One platform's markup, with the four export-only rewrites applied. */
function platformHtml(project: SkinProject, options: WorkSkinOptions = {}): string {
  const html = applyCssBubbleTails(absolutizeAssets(stripEditorAttributes(buildHTML(project, 'ao3-work'))));
  return options.includeCredit ? appendCredit(html) : html;
}

export function buildWorkSkin(project: SkinProject, options: WorkSkinOptions = {}): WorkSkinExport {
  const css = platformCss(project);
  const html = platformHtml(project, options);

  return {
    css,
    html,
    violations: lintAo3Css(css, 'work'),
  };
}

/**
 * The platforms a master skin covers, in the order their blocks are emitted.
 *
 * Order is cosmetic rather than a cascade concern — every block is scoped to
 * its own platform class, so no rule in one can match an element in another —
 * but it is fixed so the output is reproducible and diffable between runs.
 */
export const MASTER_TEMPLATES: readonly WorkSkinTemplate[] = [
  'twitter',
  'google',
  'ios',
  'android',
];

/**
 * The version stamp the master skin carries, and the class contract it names.
 *
 * **Bump it whenever the classes `buildHTML` emits change**, because that is
 * the failure this exists to catch: the author saved the skin once, months ago,
 * and is now pasting freshly generated HTML that expects classes their stored
 * CSS does not carry. Nothing else tells them — AO3 shows no error, the work
 * saves, and the fic renders half-styled.
 *
 * It is a *rule* rather than a comment because **AO3 deletes every comment on
 * save** (§13), so `/* Generated with … *​/` has never once reached the
 * archive. A real rule set survives, which is Rosé Pine's trick; the class
 * matches no element we emit, and is not meant to.
 *
 * Single quotes on the `content` value: that is the form we have watched come
 * back out of AO3's editor intact, and the unit suite pins it.
 *
 * **2** because `buildHTML` began emitting `theme-light` / `theme-dark` on the
 * container. No v1 skin can exist anywhere — nothing in the UI has ever
 * produced one — so this bump is free; it is here because the rule is
 * mechanical, and reasoning about what is "really released" is how a version
 * stamp stops being trustworthy.
 *
 * **7** for the iOS class contract: `ios-reply`, `ios-images`,
 * `ios-link-preview`, `ios-audio-card`, `ios-video-card`, `ios-tapbacks`,
 * `ios-event`, `ios-tone-*`, and the `ios-frame-*` / `ios-scroll` container
 * classes. A reader carrying a v6 skin gets a v7 work's markup with none of
 * those rules — so the bump is what tells an author their saved skin is stale,
 * which is the failure mode §10's traps call "a half-styled render".
 */
export const MASTER_SKIN_VERSION = 7;

function versionRule(): string {
  return `#workskin .ao3skingen-v${MASTER_SKIN_VERSION}::after{content:'${MASTER_SKIN_VERSION}';}`;
}

/**
 * The block that lets one saved skin serve both themes.
 *
 * Work skins ban custom properties and `var()` outright, so the community
 * answer to two palettes in one skin is to **enumerate them as classes** — the
 * WhatsApp skin does it for light/dark, the Twitter skin for night mode, and a
 * third does it for sixteen quote colours (KNOWLEDGE §3, §12). A hand-writer
 * can afford a handful of variants; we generate, so it is a loop.
 *
 * What it buys, concretely: a work can use only one skin (§9f), so an author
 * with a light tweet in chapter 1 and a dark one in chapter 4 had to choose.
 * Now each block carries its own `theme-*` class and one saved skin serves both.
 *
 * ## Why this is the whole stylesheet and not a diff
 *
 * It was a diff first, and the diff was **wrong** — measured, not suspected.
 * KNOWLEDGE §18 records that the canonical skin's entire night mode is five
 * rules, and 5b put both palettes in a table so ours could be derived the same
 * way. Deriving it produced 64 rules of pure colour, and one of them broke a
 * render:
 *
 * ```text
 * base       #workskin .chat.twitter .tweet .time-line             1 id, 4 classes
 * base       #workskin .chat.twitter .tweet.no-metrics .time-line  1 id, 5 classes  border:none
 * override   #workskin .chat.twitter.theme-dark .tweet .time-line  1 id, 5 classes  border:1px …
 * ```
 *
 * The override **ties** with `.no-metrics` and comes later, so it reinstated a
 * border the base sheet had deliberately removed — a hairline under a tweet
 * with no metrics, in one theme only. That is the hazard MASTER §6a-i named
 * when the namespacer landed: *specificity does not rise uniformly*, so rules
 * that previously tied can swap. A hand-writer avoids it by knowing their own
 * cascade. A generator has no such knowledge, and no lint can see it.
 *
 * **A whole variant block is sound by construction, and the argument is short.**
 * Every rule in it is the corresponding base rule plus exactly one class, in the
 * same order, so for an element carrying the theme class: the variant's winner
 * for a property beats its own base twin (one class more); it beats every other
 * variant rule exactly as its twin did (all shifted equally); and it beats every
 * other base rule, because it already beat or tied its twin, which beat or tied
 * that rule. So the winner is the same rule the variant stylesheet alone would
 * pick, with the variant's value.
 *
 * The price is size — about 26 KB across the three themed platforms, taking the
 * master skin to roughly 61 KB against the 104 KB skin AO3 serves today. Item 9
 * (dedupe) is worth more now than it was, and this is the reason.
 *
 * **What it still does not buy: switching a posted block's theme by editing a
 * class.** Twitter's X logo is chosen in `buildHTML` — grey for dark, colour
 * for light — so a block that changes theme needs regenerating, not
 * re-classing. That is one image, and it is the honest limit of a CSS-only
 * variant.
 */
/**
 * The project one block of the master skin is built from.
 *
 * **The open platform keeps the author's settings; the other three wear their
 * own look.** Bubble colours, opacity, the body font and iOS's message mode are
 * shared fields, so building all four blocks from one project gives three of
 * them a colour chosen for the fourth — and the author never sees it, because
 * those blocks style markup they will paste chapters later.
 *
 * That is not hypothetical. A skin saved on 8 Aug 2026 from a project carrying
 * `#007AFF` and `iosMode: 'sms'` put **blue bubbles in the WhatsApp block** and
 * **SMS green in the iMessage block**, on a real posted work. Both were faithful
 * to the settings and wrong on the page.
 *
 * The exception matters as much as the rule: the block for the platform the
 * author is looking at must match their preview and their PNG exactly, so it is
 * built from the project untouched. See `withPlatformLook`.
 */
function blockProject(project: SkinProject, template: WorkSkinTemplate): SkinProject {
  return template === project.template
    ? { ...project, template }
    : withPlatformLook(project, template);
}

function themeVariantCss(project: SkinProject, template: WorkSkinTemplate): string[] {
  const scoped = blockProject(project, template);
  const theme = platformTheme(scoped);
  if (!theme) return []; // Google has no theme, so there is nothing to vary.

  const supported: SkinTheme[] = template === 'twitter'
    ? ['light', 'dim', 'dark']
    : ['light', 'dark'];
  return supported
    .filter(candidate => candidate !== theme)
    .map(candidate => namespaceCss(platformCss(withPlatformTheme(scoped, candidate)), template, candidate));
}

/**
 * One skin, saved once, covering all four platforms.
 *
 * A work can use **only one skin** (§9f), so an author with an iOS chat in
 * chapter 1 and a tweet in chapter 4 cannot save two of ours. This is the
 * export that serves them: every platform's stylesheet, each scoped to
 * `.chat.<platform>` so they cannot reach each other, plus the markup for the
 * platform they are currently looking at.
 *
 * It covers **both themes**, not just the one the author has selected: each
 * themed platform also carries a variant block for the theme they did not pick
 * — see `themeVariantCss` — so one saved skin serves a light tweet in chapter 1
 * and a dark one in chapter 4.
 *
 * ## Why this was assembly rather than invention
 *
 * `namespaceCss` scopes a stylesheet and is proven by computed-style diff not
 * to move a pixel (MASTER §6a); `buildHTML` already emits the matching platform
 * class on every path, including the PNG, so **no markup change was needed at
 * all**. This function is the composition of two things that already existed.
 *
 * ## What it is deliberately not doing
 *
 * - **Not merging the four blocks' shared rules.** Four paragraph resets, four
 *   `.visually-hidden` blocks and four `.wm` credits survive namespacing as
 *   distinct selectors, so they are redundant rather than conflicting —
 *   measured at 26 rules and 3.4 KB of 34.5 KB, about a tenth. That is
 *   BACKLOG 9, and hand-merging early would give the single-platform export and
 *   this one two code paths that can disagree, which is the failure
 *   `SITE-SKIN-IMPLEMENTATION.md` §5 is about.
 * - **Not cleaning up the iOS tail rules when serving Twitter.** `.css-tails`
 *   is added by the export rather than by `buildHTML`, and a master skin
 *   carries every platform's rules by definition. Namespaced, they match
 *   nothing outside iOS.
 * - **Not deciding which export the author gets.** That choice — "one skin for
 *   everything" against "just this platform" — is BACKLOG 10, and it is not
 *   optional, because the author has exactly one skin slot to spend.
 *
 * The invariant, measured in `tests/master-skin.spec.ts`: a master skin must
 * render each platform **identically to that platform's own single-platform
 * skin**, including under AO3's paragraph injection.
 */
export function buildMasterWorkSkin(
  project: SkinProject,
  options: WorkSkinOptions = {}
): WorkSkinExport {
  const blocks = MASTER_TEMPLATES.map((template) =>
    namespaceCss(platformCss(blockProject(project, template)), template)
  );

  // Every theme variant goes after every base block. Specificity already
  // decides this — a variant rule carries one class more than its base twin —
  // so the order is for whoever reads the skin, not for the cascade.
  const variants = MASTER_TEMPLATES
    .flatMap((template) => themeVariantCss(project, template));

  const css = [versionRule(), ...blocks, ...variants].join('\n');

  return {
    css,
    // The credit lives in the HTML, and there is one block of HTML, so there is
    // one credit — concatenating the four stylesheets cannot multiply it.
    html: platformHtml(project, options),
    violations: lintAo3Css(css, 'work'),
  };
}
