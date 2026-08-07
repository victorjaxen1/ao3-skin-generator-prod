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
 * Twitter and Google do.
 *
 * iOS and Android do not yet, with 12 violations each: `animation` and
 * `animation-delay` for the typing indicator (plus the `@keyframes` block),
 * `gap`, `object-fit`, `pointer-events`, and a `calc()` in `max-width`.
 * Two of those rules consist of nothing but `animation-delay`, so stripping
 * the property would leave empty rule sets — which AO3 reports as an error
 * rather than ignoring. See docs/WORK-SKIN-IMPLEMENTATION.md for the plan.
 */

export type WorkSkinTemplate = 'twitter' | 'google';

const SUPPORTED: readonly string[] = ['twitter', 'google'];

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

export function buildWorkSkin(project: SkinProject): WorkSkinExport {
  const css = buildCSS(project);
  const html = absolutizeAssets(stripEditorAttributes(buildHTML(project)));

  return {
    css,
    html,
    violations: lintAo3Css(css, 'work'),
  };
}
