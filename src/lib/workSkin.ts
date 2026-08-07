import { SkinProject } from './schema';
import { buildCSS, buildHTML } from './generator';
import { lintAo3Css, Violation } from './siteSkin/ao3Css';

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
function useCssBubbleTails(html: string): string {
  const withoutSvg = html.replace(/<svg\b[^>]*class="[^"]*bubble-tail[^"]*"[\s\S]*?<\/svg>/g, '');
  return withoutSvg === html ? html : withoutSvg.replace('<div class="chat"', '<div class="chat css-tails"');
}

export function buildWorkSkin(project: SkinProject): WorkSkinExport {
  const css = absolutizeCssAssets(buildCSS(project));
  const html = useCssBubbleTails(absolutizeAssets(stripEditorAttributes(buildHTML(project))));

  return {
    css,
    html,
    violations: lintAo3Css(css, 'work'),
  };
}
