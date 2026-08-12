import React, { useState, useEffect, useMemo, useRef } from 'react';
import { SkinProject } from '../lib/schema';
import { buildCSS, buildHTML } from '../lib/generator';
import { buildMasterWorkSkin, buildWorkSkin, supportsWorkSkin } from '../lib/workSkin';
import { useToast, ToastContainer } from './Toast';
import { uploadToImgBB, ImageUploadError } from '../lib/imgbb';
import { inlineCrossOriginImages, FailedImage } from '../lib/imageProxy';
import { PLATFORM_ASSETS } from '../lib/platformAssets';
import { AO3_RULESET_STATUS } from '../lib/ao3Compatibility';
import { mapUploadErrorCode, openPrivacyChoices, trackAnalytics } from '../lib/analytics';
import { buildSceneTranscript, defaultSceneAlt } from '../lib/transcript';
import { buildWorkSkinPreflight } from '../lib/preflight';
import { hasProjectBackup } from '../lib/backupStatus';
import { downloadTextFile, safeFilenamePart } from '../lib/download';

interface Props {
  project: SkinProject;
  showCodeModal: boolean;
  setShowCodeModal: (show: boolean) => void;
  onBackupProject: (suffix?: string) => boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function waitForImages(root: HTMLElement): Promise<void> {
  const images = root.querySelectorAll('img');
  await Promise.all(
    Array.from(images).map(img => {
      if (img.complete) return Promise.resolve(true);
      return new Promise(resolve => {
        img.onload = () => resolve(true);
        img.onerror = () => resolve(true);
        setTimeout(() => resolve(true), 3000);
      });
    })
  );
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('canvas.toBlob() returned null'));
    }, 'image/png', 0.95);
  });
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function updateHostedImageAlt(code: string, sceneAlt: string, project: SkinProject): string {
  const total = code.match(/<img\b/gi)?.length || 1;
  let index = 0;
  return code.replace(/(<img\b[^>]*\balt=")[^"]*(")/gi, (_match, before: string, after: string) => {
    const base = sceneAlt.trim() || defaultSceneAlt(project);
    const alt = total > 1 ? `${base} Part ${++index} of ${total}.` : base;
    return `${before}${escapeHtmlAttribute(alt)}${after}`;
  });
}

/**
 * Apply independently controlled safety and neutral attribution labels.
 * Returns a new canvas; the original is unchanged.
 */
function applyImageLabels(
  canvas: HTMLCanvasElement,
  fictionLabel: string | null,
  includeToolAttribution: boolean
): HTMLCanvasElement {
  const labels = [
    fictionLabel?.trim() || null,
    includeToolAttribution ? 'Made with AO3 SkinGen' : null,
  ].filter((label): label is string => Boolean(label));
  if (labels.length === 0) return canvas;

  const watermarkHeight = 28;
  const out = document.createElement('canvas');
  out.width = canvas.width;
  out.height = canvas.height + watermarkHeight;

  const ctx = out.getContext('2d')!;
  ctx.drawImage(canvas, 0, 0);
  ctx.fillStyle = '#7c3aed';
  ctx.fillRect(0, canvas.height, out.width, watermarkHeight);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    labels.join(' · '),
    out.width / 2,
    canvas.height + watermarkHeight / 2
  );
  return out;
}

/**
 * An example skin title, per platform.
 *
 * AO3 skin titles are unique across the **entire archive**, not per account, so
 * an author who types "Twitter" gets a validation error from a name somebody
 * claimed years ago. AO3's own FAQ answers this by telling people to include
 * their username, and the dialog says so with a title they can nearly paste.
 */
const SKIN_TITLE_EXAMPLE: Record<SkinProject['template'], string> = {
  twitter: 'yourname — Twitter',
  google: 'yourname — Google',
  ios: 'yourname — iMessage',
  android: 'yourname — WhatsApp',
};

/** The same, for the skin that covers every platform at once. */
const MASTER_TITLE_EXAMPLE = 'yourname — chat skins';

/** What an author calls each platform, for the "covers all four" line. */
const PLATFORM_NAME: Record<SkinProject['template'], string> = {
  twitter: 'Twitter',
  google: 'Google',
  ios: 'iMessage',
  android: 'WhatsApp',
};

const HOSTED_SCENE_ACK = 'ao3skin_imgbb_scene_ack';

// ---------------------------------------------------------------------------
// Core render function — unified off-screen clone for ALL templates.
// Accepts a (possibly message-sliced) project copy; never touches the live DOM.
// ---------------------------------------------------------------------------

async function renderChunk(
  project: SkinProject,
  scale: number,
  onImageWarning?: (failed: FailedImage[]) => void
): Promise<HTMLCanvasElement> {
  if (typeof window === 'undefined') throw new Error('Cannot render on server side');

  const html2canvas = (await import('html2canvas')).default;

  const css = buildCSS(project);
  const html = buildHTML(project);

  const templateDefaults: Record<SkinProject['template'], number> = {
    ios: 375,
    android: 400,
    twitter: 600,
    google: 600,
  };

  // Measure the live preview width as the best proxy for desired render width.
  const previewRoot = document.getElementById('workskin') as HTMLElement | null;
  const liveChat = previewRoot?.querySelector('.chat') as HTMLElement | null;
  const measured = liveChat
    ? Math.round(liveChat.getBoundingClientRect().width || liveChat.offsetWidth)
    : previewRoot
    ? Math.round(previewRoot.getBoundingClientRect().width || previewRoot.offsetWidth)
    : 0;

  const previewWidth =
    measured > 0 ? measured : (project.settings.maxWidthPx ?? templateDefaults[project.template]);

  // Build off-screen mount
  const mount = document.createElement('div');
  mount.style.position = 'absolute';
  mount.style.left = '-9999px';
  mount.style.top = '0';
  mount.style.boxSizing = 'border-box';

  const styleTag = document.createElement('style');
  styleTag.textContent = css;
  mount.appendChild(styleTag);

  const captureArea = document.createElement('div');
  captureArea.style.background = '#ffffff';
  captureArea.style.boxSizing = 'border-box';
  captureArea.style.display = 'flex';
  captureArea.style.justifyContent = 'center';

  let outerPadding = '24px';
  let extraWidth = 48;
  if (project.template === 'twitter') {
    if (project.settings.twitterThreadMode) {
      outerPadding = '20px';
      extraWidth = 64;
    } else {
      outerPadding = '16px';
      extraWidth = 32;
    }
  }
  captureArea.style.padding = outerPadding;
  captureArea.style.minWidth = `${previewWidth + extraWidth}px`;

  const clone = document.createElement('div');
  clone.id = 'workskin';
  clone.setAttribute('data-export-clone', 'true');
  clone.innerHTML = html;
  clone.style.margin = '0 auto';
  clone.style.paddingBottom = '0';
  clone.style.width = `${previewWidth}px`;
  clone.style.maxWidth = `${previewWidth}px`;
  clone.style.minWidth = `${previewWidth}px`;
  clone.style.boxSizing = 'border-box';
  clone.style.height = 'auto';
  clone.style.maxHeight = 'none';
  clone.style.overflow = 'visible';

  const templateBg: Record<SkinProject['template'], string> = {
    ios: '#ffffff',
    android: '#ece5dd',
    twitter: '#ffffff',
    google: '#ffffff',
  };
  clone.style.background = templateBg[project.template];

  if (project.template === 'ios' || project.template === 'android') {
    clone.style.borderRadius = '20px';
    clone.style.overflow = 'hidden';
  }

  if (project.template === 'twitter') {
    if (project.settings.twitterThreadMode) {
      clone.style.padding = '0 40px 0 20px';
      clone.style.width = `${previewWidth + 60}px`;
      clone.style.maxWidth = `${previewWidth + 60}px`;
      clone.style.minWidth = `${previewWidth + 60}px`;
    } else {
      clone.style.padding = '0 8px';
      clone.style.width = `${previewWidth + 16}px`;
      clone.style.maxWidth = `${previewWidth + 16}px`;
      clone.style.minWidth = `${previewWidth + 16}px`;
    }
    clone.style.margin = '0 auto';
  }

  const chatContainer = clone.querySelector('.chat') as HTMLElement | null;
  if (chatContainer) {
    chatContainer.style.height = 'auto';
    chatContainer.style.maxHeight = 'none';
    chatContainer.style.overflow = 'visible';
  }

  captureArea.appendChild(clone);
  mount.appendChild(captureArea);
  document.body.appendChild(mount);

  // Twitter html2canvas layout fixes
  if (project.template === 'twitter') {
    // The verified badges are drawn in CSS now — a character centred in a blue
    // circle — so that a published fic stops fetching them (BACKLOG 5a). The
    // metric icons went further and became plain characters, which need
    // nothing here: html2canvas rasterises ordinary inline text correctly, and
    // it is only the centred-in-a-box case that it cannot do.
    //
    // The PNG puts the badge image back, and only the PNG. html2canvas measures
    // boxes with the real layout engine but draws text itself, and it lands a
    // glyph well below a small circle: the tick rasterised as white-on-white
    // outside a plain blue disc, and the heart came out clipped at the bottom
    // edge. Line-height centring and padding centring both failed the same
    // way, so this is not a value to tune.
    //
    // Nothing is lost by swapping. The reason to drop a chrome image is that a
    // reader fetches it from our CDN every time they open the chapter, forever
    // — a PNG is rendered once, on the author's own machine, from assets the
    // app already ships. This is the same trade `useCssBubbleTails` makes in
    // workSkin.ts, in the other direction: SVG for the raster, CSS for AO3.
    const drawnGlyphs: [selector: string, src: string, size: number][] = [
      ['.tweet .verified-badge', PLATFORM_ASSETS.twitter.verifiedBadge, 18],
      ['.tweet .quote-verified-badge', PLATFORM_ASSETS.twitter.verifiedBadge, 16],
    ];
    for (const [selector, src, size] of drawnGlyphs) {
      clone.querySelectorAll(selector).forEach(el => {
        const img = document.createElement('img');
        img.src = src;
        img.alt = '';
        img.className = el.className;
        // Inline, so it beats the drawn-badge rules the class still carries —
        // otherwise the image sits on a blue disc inflated by its padding.
        // Only what an image must not inherit is overridden: display and
        // vertical-align are left to the class, which is what the old <img>
        // used, so the raster lands on the same pixels.
        img.style.cssText =
          `width:${size}px;height:${size}px;background:none;padding:0;line-height:normal`;
        el.replaceWith(img);
      });
    }

    clone.querySelectorAll('.tweet').forEach(el => {
      (el as HTMLElement).style.cssText += ';position:relative;box-sizing:border-box;width:100%;max-width:100%';
    });
    clone.querySelectorAll('.tweet img.avatar').forEach(el => {
      (el as HTMLElement).style.cssText +=
        ';width:40px;height:40px;min-width:40px;min-height:40px;max-width:40px;max-height:40px;border-radius:50%;object-fit:cover;flex-shrink:0;aspect-ratio:1/1';
    });
    clone.querySelectorAll('.tweet .name-line').forEach(el => {
      (el as HTMLElement).style.cssText += ';display:flex;align-items:center;gap:4px;flex-wrap:nowrap';
    });
    // THE NAME LINE WAS BEING CUT IN HALF IN EVERY PNG THIS APP HAS EXPORTED.
    // `.head` is only 20px tall — one line box — and html2canvas draws text a
    // few pixels lower than the browser does, so `overflow:hidden` sliced the
    // bottom off "Taylor Swift", the handle and "Follow" alike. It looked like
    // a font problem and it was a clipping problem.
    //
    // Only the raster needs this. `.head{overflow:hidden}` is load-bearing in
    // the stylesheet — it is the block formatting context that sits beside the
    // avatar float, which is precisely why the float layout survives AO3's
    // paragraph injection (WORK-SKIN §12d) — so it must not be touched there.
    // In the clone it is redundant anyway: `.name-line` is forced to
    // `display:flex` above, and a flex container is already a BFC, so the head
    // still sits beside the float without it. The outer
    // `.tweet-header{overflow:hidden}` still contains the float; removing THAT
    // one lets the avatar overlap the body text, which is what the first
    // attempt at this did.
    clone.querySelectorAll('.tweet .head').forEach(el => {
      (el as HTMLElement).style.cssText += ';overflow:visible';
    });
    clone
      .querySelectorAll('.tweet .name,.tweet .handle,.tweet .follow-dot,.tweet .follow-btn')
      .forEach(el => {
        (el as HTMLElement).style.cssText += ';line-height:20px;white-space:nowrap;flex-shrink:0';
      });
    clone.querySelectorAll('.tweet .verified-container').forEach(el => {
      (el as HTMLElement).style.cssText +=
        ';display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;position:relative;top:7px';
    });
    clone.querySelectorAll('.tweet .verified-badge').forEach(el => {
      (el as HTMLElement).style.cssText += ';width:18px;height:18px;display:block';
    });
    clone.querySelectorAll('.tweet .twitter-logo').forEach(el => {
      (el as HTMLElement).style.cssText +=
        ';width:20px;height:20px;display:block;flex-shrink:0;position:relative;top:7px';
    });
    clone.querySelectorAll('.tweet .metrics').forEach(el => {
      (el as HTMLElement).style.cssText += ';display:flex;align-items:center;gap:12px';
    });
    clone.querySelectorAll('.tweet .metric').forEach(el => {
      (el as HTMLElement).style.cssText += ';display:inline-flex;align-items:center;gap:6px';
    });
    clone.querySelectorAll('.tweet .metric-icon').forEach(el => {
      (el as HTMLElement).style.cssText += ';width:20px;height:20px;display:block;flex-shrink:0';
    });
    // The glyph icons take the same lift as the counts beside them. That -6px
    // is an html2canvas nudge with no equivalent in the stylesheet, so a text
    // icon that does not get it lands 6px below its own number — which is
    // exactly how the first glyph raster came out.
    clone.querySelectorAll('.tweet .glyph-icon').forEach(el => {
      (el as HTMLElement).style.cssText += ';position:relative;top:-6px';
    });
    clone.querySelectorAll('.tweet .metric-count').forEach(el => {
      (el as HTMLElement).style.cssText +=
        ';font-size:14px;line-height:20px;position:relative;top:-6px';
    });
  }

  // Google html2canvas layout fixes
  if (project.template === 'google') {
    // The same bug as the tweet name line, in the one place Google clips: the
    // search query lost the bottom of its descenders in every PNG. `.search-text`
    // is `overflow:hidden` so `text-overflow:ellipsis` can truncate a long
    // query, and overflow clips in BOTH directions — so html2canvas drawing
    // text a few pixels low means the glyph bottoms fall outside the box.
    //
    // Padding rather than `overflow:visible`, because the ellipsis has to keep
    // working: a long query would otherwise run out of the rounded bar in the
    // raster instead of truncating. Overflow clips at the padding edge, so
    // 5px of padding-bottom gives the descenders room without changing what is
    // shown. The stylesheet is untouched — the browser and AO3 never had this
    // problem.
    clone.querySelectorAll('.search-text').forEach(el => {
      (el as HTMLElement).style.cssText += ';padding-bottom:5px';
    });
  }

  // Android html2canvas layout fixes
  if (project.template === 'android') {
    clone.querySelectorAll('.android-header-avatar').forEach(el => {
      (el as HTMLElement).style.cssText +=
        ';position:absolute;left:60px;top:50%;transform:translateY(-50%);margin:0;width:40px;height:40px;min-width:40px;min-height:40px;max-width:40px;max-height:40px;border-radius:50%;object-fit:cover';
    });
    clone.querySelectorAll('.android-header-avatar-placeholder').forEach(el => {
      (el as HTMLElement).style.cssText +=
        ';position:absolute;left:60px;top:50%;transform:translateY(-50%);margin:0;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:600;padding-bottom:11px';
    });
    // The name now always sits inside a wrapper alongside a subtitle ("online"
    // or the participant count), so the wrapper is what needs positioning —
    // pinning the name itself would stack it on top of the subtitle.
    clone.querySelectorAll('.android-header-name-wrapper').forEach(el => {
      (el as HTMLElement).style.cssText +=
        ';position:absolute;left:110px;top:50%;transform:translateY(-50%);margin:0;display:flex;flex-direction:column;justify-content:center;line-height:1.2';
    });
    clone.querySelectorAll('.android-header-name-wrapper .android-header-name').forEach(el => {
      (el as HTMLElement).style.cssText += ';position:static;margin:0;line-height:1.3';
    });
    clone.querySelectorAll('dd.bubble.out,dd.bubble.in').forEach(el => {
      (el as HTMLElement).style.cssText +=
        ';border-radius:8px;padding:7px 10px;display:inline-block;max-width:280px;box-shadow:0 1px 2px rgba(0,0,0,0.1)';
    });
    // NOTE: that `padding` shorthand is an INLINE style, so it beats anything
    // `buildAndroidCSS` says about a bubble's padding. It briefly mattered: an
    // earlier reaction chip reserved space INSIDE the bubble with padding, and
    // this line silently deleted the reserve in the export only. The chip now
    // sits entirely below the bubble and needs nothing from the bubble's own
    // box, so there is nothing to re-assert — but if you ever add padding to a
    // bubble in the stylesheet, it will not survive this line.
    clone.querySelectorAll('.row.out').forEach(el => {
      (el as HTMLElement).style.cssText += ';display:flex;justify-content:flex-end';
    });
    clone.querySelectorAll('.row.in').forEach(el => {
      (el as HTMLElement).style.cssText += ';display:flex;justify-content:flex-start';
    });
  }

  // Swap remote images for same-origin data URIs before rasterising. Without
  // this, html2canvas requests them with crossOrigin='anonymous' and any host
  // that doesn't send CORS headers drops out of the PNG silently.
  const unconvertible = await inlineCrossOriginImages(clone);
  if (unconvertible.length > 0) onImageWarning?.(unconvertible);

  await waitForImages(clone);

  const captureWidth = captureArea.scrollWidth;
  const captureHeight = captureArea.scrollHeight;

  const canvas = await (html2canvas as any)(captureArea, {
    background: '#ffffff',
    scale,
    logging: false,
    // useCORS makes html2canvas set crossOrigin='anonymous' on every image, so
    // a host without CORS headers fails to load rather than tainting. That
    // makes allowTaint inert here — omitted rather than left as a misleading
    // no-op. Cross-origin images are proxied to data: URIs before this runs.
    useCORS: true,
    width: captureWidth,
    height: captureHeight,
    windowWidth: captureWidth,
    windowHeight: captureHeight,
    foreignObjectRendering: false,
    imageTimeout: 5000,
  });

  document.body.removeChild(mount);

  // Add white padding
  const padding = 24 * scale;
  const padded = document.createElement('canvas');
  padded.width = canvas.width + padding * 2;
  padded.height = canvas.height + padding * 2;
  const pCtx = padded.getContext('2d')!;
  pCtx.fillStyle = '#ffffff';
  pCtx.fillRect(0, 0, padded.width, padded.height);
  pCtx.drawImage(canvas, padding, padding);

  return padded;
}

// ---------------------------------------------------------------------------
// Split project into 15-message chunks and render each.
// ---------------------------------------------------------------------------

const CHUNK_SIZE = 15;

async function renderAllChunks(
  project: SkinProject,
  scale: number,
  onProgress?: (rendered: number, total: number) => void,
  onImageWarning?: (failed: FailedImage[]) => void
): Promise<HTMLCanvasElement[]> {
  const messages = project.messages;

  if (messages.length === 0) {
    return [await renderChunk(project, scale, onImageWarning)];
  }

  const chunks: (typeof messages)[] = [];
  for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
    chunks.push(messages.slice(i, i + CHUNK_SIZE));
  }

  const canvases: HTMLCanvasElement[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunkProject: SkinProject = { ...project, messages: chunks[i] };
    const canvas = await renderChunk(chunkProject, scale, onImageWarning);
    canvases.push(canvas);
    onProgress?.(i + 1, chunks.length);
  }
  return canvases;
}

// ---------------------------------------------------------------------------
// Direct PNG download (full conversation, no splitting, no upload).
// ---------------------------------------------------------------------------

async function exportAsImage(
  project: SkinProject,
  scale: number,
  onImageWarning?: (failed: FailedImage[]) => void
): Promise<void> {
  const canvas = await renderChunk(project, scale, onImageWarning);
  const labelled = applyImageLabels(
    canvas,
    project.settings.fictionLabel === false
      ? null
      : project.settings.fictionLabelText || 'Fictional scene',
    project.settings.toolAttribution === true
  );
  const blob = await canvasToBlob(labelled);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ao3-skin-${project.template}-${Date.now()}.png`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// AO3 code export: render chunks → upload all to ImgBB → return <img> tags.
// ---------------------------------------------------------------------------

async function exportAsAO3(
  project: SkinProject,
  scale: number,
  sceneAlt: string,
  onProgress: (stage: string, current: number, total: number) => void,
  onImageWarning?: (failed: FailedImage[]) => void
): Promise<string> {
  const totalChunks = Math.max(1, Math.ceil((project.messages.length || 1) / CHUNK_SIZE));

  onProgress('Rendering', 0, totalChunks);

  const canvases = await renderAllChunks(
    project,
    scale,
    (rendered) => onProgress('Rendering', rendered, totalChunks),
    onImageWarning
  );

  const labelled = canvases.map(canvas =>
    applyImageLabels(
      canvas,
      project.settings.fictionLabel === false
        ? null
        : project.settings.fictionLabelText || 'Fictional scene',
      project.settings.toolAttribution === true
    )
  );
  const blobs = await Promise.all(labelled.map(canvasToBlob));

  // Upload sequentially to avoid hitting rate limits
  const urls: string[] = [];
  for (let i = 0; i < blobs.length; i++) {
    onProgress('Uploading', i, blobs.length);
    const url = await uploadToImgBB(blobs[i], 'rendered-scene');
    urls.push(url);
    onProgress('Uploading', i + 1, blobs.length);
  }

  const isMultiple = urls.length > 1;
  const imgTags = urls.map((url, i) => {
    const baseAlt = sceneAlt.trim() || defaultSceneAlt(project);
    const alt = escapeHtmlAttribute(isMultiple
      ? `${baseAlt} Part ${i + 1} of ${urls.length}.`
      : baseAlt);
    return `<img src="${url}" alt="${alt}" style="max-width:100%;display:block;margin:0 auto 8px;" />`;
  });

  return imgTags.join('\n');
}

// ---------------------------------------------------------------------------
// React component
// ---------------------------------------------------------------------------

export const ExportPanel: React.FC<Props> = ({
  project,
  showCodeModal,
  setShowCodeModal,
  onBackupProject,
}) => {
  const barRef = useRef<HTMLDivElement>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [exportScale, setExportScale] = useState(2);
  const [isExporting, setIsExporting] = useState(false);
  const [progressLabel, setProgressLabel] = useState('');
  const [ao3Code, setAo3Code] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);
  const [showHostedConsent, setShowHostedConsent] = useState(false);
  const [showWorkSkin, setShowWorkSkin] = useState(false);
  const [workSkinPreview, setWorkSkinPreview] = useState<'styled' | 'fallback'>('styled');
  const [sceneAlt, setSceneAlt] = useState(() => defaultSceneAlt(project));
  const [sceneAltEdited, setSceneAltEdited] = useState(false);
  const [backupRevision, setBackupRevision] = useState(0);
  const [includeWorkSkinCredit, setIncludeWorkSkinCredit] = useState(false);
  const [copiedPart, setCopiedPart] = useState<'css' | 'html' | null>(null);
  const workSkinPartsCopiedRef = useRef(new Set<'css' | 'html'>());
  const workSkinHandoffTrackedRef = useRef(false);
  /**
   * The quality switch is a popover rather than a row.
   *
   * It is the control least used per session and it cost a full row of a fixed
   * bar that sits over the composer on every viewport. Unlike the help panel it
   * must **never** open by itself, which is what lets it float
   * (`absolute bottom-full`) instead of taking height — see the comment on the
   * help panel below for why that one has to stay in flow.
   */
  const [showQuality, setShowQuality] = useState(false);
  /**
   * Which skin the author is taking. A work can use **only one skin**, so this
   * is a real choice rather than a preference: "just this platform" is the
   * smallest thing that works for a fic that stays on one app, and "all four"
   * is what an author needs the moment chapter 4 is a different one.
   *
   * Defaults to the platform they are looking at — the smaller paste, and the
   * behaviour this modal had before the choice existed.
   */
  const [skinScope, setSkinScope] = useState<'platform' | 'all'>('platform');
  const { toasts, removeToast, success, error: showError } = useToast();
  const transcript = useMemo(() => buildSceneTranscript(project), [project]);

  useEffect(() => {
    if (!sceneAltEdited) setSceneAlt(defaultSceneAlt(project));
  }, [project, sceneAltEdited]);

  // The third export. Cheap to compute — no rendering, no upload — so it is
  // derived rather than triggered, and the button can open instantly.
  const workSkin = useMemo(
    () =>
      supportsWorkSkin(project.template)
        ? buildWorkSkin(project, { includeCredit: includeWorkSkinCredit })
        : null,
    [project, includeWorkSkinCredit]
  );

  // The master skin is eleven stylesheet builds rather than one, and `project`
  // changes on every keystroke in the editor — so unlike `workSkin` it is built
  // only while the modal is actually showing it. Same shape, one platform's
  // markup, four platforms' CSS in both themes.
  const masterSkin = useMemo(
    () =>
      showWorkSkin && skinScope === 'all' && supportsWorkSkin(project.template)
        ? buildMasterWorkSkin(project, { includeCredit: includeWorkSkinCredit })
        : null,
    [project, showWorkSkin, skinScope, includeWorkSkinCredit]
  );

  // The HTML is identical either way — the choice is about the stylesheet, and
  // `tests/master-skin.spec.ts` pins that the markup does not move.
  const skin = masterSkin ?? workSkin;
  const preflight = useMemo(
    () => skin ? buildWorkSkinPreflight(project, skin.html, skin.violations, hasProjectBackup(project)) : [],
    [project, skin, backupRevision]
  );
  const workSkinBlocked = preflight.some(item => item.severity === 'block' && item.status === 'fail');

  useEffect(() => {
    // Getting output into an AO3 work is the genuinely confusing part of this
    // domain, so show the guidance to newcomers instead of hiding it behind a
    // click. Once someone dismisses it, respect that.
    try {
      if (localStorage.getItem('ao3skin_help_dismissed') !== '1') setShowHelp(true);
    } catch { /* ignore */ }
  }, []);

  const toggleHelp = () => {
    setShowHelp(prev => {
      const next = !prev;
      try {
        if (!next) localStorage.setItem('ao3skin_help_dismissed', '1');
      } catch { /* ignore */ }
      return next;
    });
  };

  // A popover that outlives its trigger is worse than no popover. The trigger's
  // own wrapper stops mousedown propagating, so clicking inside the menu — or on
  // the button that opened it — does not count as "outside".
  useEffect(() => {
    if (!showQuality) return;
    const close = () => setShowQuality(false);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowQuality(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [showQuality]);

  // Publish this bar's height so the layout can reserve space for it.
  // The bar is fixed-position, so without this it sits on top of the compose
  // input. Height is measured rather than hard-coded because the help panel
  // expands it.
  useEffect(() => {
    const el = barRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const publish = () => {
      document.documentElement.style.setProperty(
        '--export-bar-h',
        `${Math.ceil(el.getBoundingClientRect().height)}px`
      );
    };
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty('--export-bar-h');
    };
  }, []);

  // An image the proxy can't fetch is missing from the PNG. That used to
  // happen silently — the preview looked right and the export had a hole.
  const warnAboutImages = (failed: FailedImage[]) => {
    const count = failed.length;
    const subject = count === 1 ? "One image couldn't be included" : `${count} images couldn't be included`;
    // The server's reason is more use than a guess: "too many at once" and
    // "that host blocks downloads" call for completely different responses.
    const reason = failed[0]?.reason || '';
    const advice = /too many/i.test(reason)
      ? reason
      : `${reason} Try saving the image and using the upload button instead.`;
    showError(`${subject} — ${advice}`);
  };

  // --- Download Image ---
  const handleDownloadImage = async () => {
    if (isExporting) return;
    trackAnalytics({ name: 'export_started', outputType: 'png', templateId: project.template });
    setIsExporting(true);
    setProgressLabel('Rendering...');
    try {
      await exportAsImage(project, exportScale, warnAboutImages);
      success('PNG download started.');
      trackAnalytics({ name: 'export_ready', outputType: 'png', templateId: project.template });
    } catch (err) {
      trackAnalytics({ name: 'export_failed', outputType: 'png', errorCode: 'EXPORT_RENDER_FAILED' });
      showError(
        err instanceof Error ? err.message : 'Failed to export image. Please try again.'
      );
    } finally {
      setIsExporting(false);
      setProgressLabel('');
    }
  };

  // --- Get AO3 Code ---
  const handleGetAO3Code = async () => {
    if (isExporting) return;
    trackAnalytics({ name: 'export_started', outputType: 'hosted_image', templateId: project.template });
    setIsExporting(true);
    setProgressLabel('Starting...');
    try {
      const code = await exportAsAO3(
        project,
        exportScale,
        sceneAlt,
        (stage, current, total) => {
          setProgressLabel(total <= 1 ? `${stage}...` : `${stage} ${current}/${total}`);
        },
        warnAboutImages
      );
      setAo3Code(code);
      setShowCodeModal(true);
      trackAnalytics({ name: 'export_ready', outputType: 'hosted_image', templateId: project.template });
    } catch (err) {
      if (err instanceof ImageUploadError) {
        trackAnalytics({ name: 'export_failed', outputType: 'hosted_image', errorCode: mapUploadErrorCode(err.code) });
        showError(`Upload failed: ${err.userMessage}`);
      } else {
        trackAnalytics({ name: 'export_failed', outputType: 'hosted_image', errorCode: 'EXPORT_RENDER_FAILED' });
        showError(
          err instanceof Error ? err.message : 'Export failed. Please try again.'
        );
      }
    } finally {
      setIsExporting(false);
      setProgressLabel('');
    }
  };

  const beginHostedSceneUpload = () => {
    let acknowledged = false;
    try { acknowledged = localStorage.getItem(HOSTED_SCENE_ACK) === '1'; } catch { /* ignore */ }
    if (acknowledged) void handleGetAO3Code();
    else setShowHostedConsent(true);
  };

  const confirmHostedSceneUpload = () => {
    try { localStorage.setItem(HOSTED_SCENE_ACK, '1'); } catch { /* ignore */ }
    setShowHostedConsent(false);
    void handleGetAO3Code();
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(ao3Code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
      success('Copied! Paste into your AO3 chapter HTML editor.');
      trackAnalytics({ name: 'output_copied', outputType: 'hosted_image', part: 'embed' });
      trackAnalytics({ name: 'handoff_completed', outputType: 'hosted_image', templateId: project.template });
    } catch {
      trackAnalytics({ name: 'export_failed', outputType: 'hosted_image', errorCode: 'CLIPBOARD_DENIED' });
      showError('Your browser blocked the clipboard. Select the code and copy it manually.');
    }
  };

  const openWorkSkin = () => {
    workSkinPartsCopiedRef.current.clear();
    workSkinHandoffTrackedRef.current = false;
    trackAnalytics({ name: 'export_started', outputType: 'work_skin', templateId: project.template });
    trackAnalytics({ name: 'export_ready', outputType: 'work_skin', templateId: project.template });
    setShowWorkSkin(true);
  };

  const backupProject = () => {
    const ok = onBackupProject();
    if (ok) {
      setBackupRevision(value => value + 1);
      success('Project backup download started.');
    } else {
      showError('Your browser could not start the project backup download.');
    }
  };

  const downloadTranscript = () => {
    const ok = downloadTextFile(
      transcript,
      `ao3skingen-${safeFilenamePart(project.template)}-transcript.txt`,
      'text/plain;charset=utf-8'
    );
    if (ok) success('Transcript download started.');
    else showError('Your browser could not start the transcript download.');
  };

  const copyWorkSkinPart = async (part: 'css' | 'html') => {
    if (!skin) return;
    try {
      await navigator.clipboard.writeText(skin[part]);
      setCopiedPart(part);
      setTimeout(() => setCopiedPart(null), 2000);
      trackAnalytics({ name: 'output_copied', outputType: 'work_skin', part });
      workSkinPartsCopiedRef.current.add(part);
      if (workSkinPartsCopiedRef.current.size === 2 && !workSkinHandoffTrackedRef.current) {
        workSkinHandoffTrackedRef.current = true;
        trackAnalytics({ name: 'handoff_completed', outputType: 'work_skin', templateId: project.template });
      }
    } catch {
      trackAnalytics({ name: 'export_failed', outputType: 'work_skin', errorCode: 'CLIPBOARD_DENIED' });
      showError('Your browser blocked the clipboard. Select this part and copy it manually.');
    }
  };

  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* Sticky bottom bar                                                   */}
      {/* ------------------------------------------------------------------ */}
      <div
        ref={barRef}
        // The safe-area padding below keeps the row off the iOS home
        // indicator. It is inside the measured element on purpose:
        // --export-bar-h has to include it, or the layout reserves less space
        // than the bar actually occupies.
        //
        // Do not abbreviate that class name in a comment. Tailwind's scanner is
        // a regex over raw file text, not a parser — it reads comments, and an
        // elided `pb-[env(…)]` written with dots generates a literal
        // `padding-bottom: env(...)` rule that fails the CSS build.
        className="fixed left-0 right-0 bg-white border-t border-stone-200 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] z-50 pb-[env(safe-area-inset-bottom)]"
        style={{ bottom: 'var(--analytics-consent-h, 0px)' }}
      >
        <div className="max-w-4xl mx-auto px-3 py-2">
          {/* One row. Everything that isn't a primary action is behind a
              popover, so the bar's height doesn't depend on how many options
              exist. This used to be four stacked rows — ~148px of fixed bar
              over the composer, for controls used once at the end of a session. */}
          <div className="flex items-center gap-2">

            {/* Quality — a chip, not a row. */}
            <div className="relative flex-shrink-0" onMouseDown={e => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setShowQuality(v => !v)}
                aria-haspopup="menu"
                aria-expanded={showQuality}
                aria-label={`Export quality, currently ${exportScale}×`}
                title="Export quality"
                className="px-2.5 py-2 rounded-lg text-xs font-semibold bg-stone-100 text-stone-600 hover:bg-stone-200 transition-colors"
              >
                {exportScale}×
              </button>

              {showQuality && (
                // bottom-full: floats above the bar rather than adding to it.
                // It must never be in flow — that is what made the old layout
                // 148px tall.
                <div
                  role="menu"
                  className="absolute bottom-full left-0 mb-2 w-44 bg-white rounded-xl shadow-lg border border-stone-200 p-2 z-10"
                >
                  <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide px-1 pb-1.5">Quality</p>
                  {[1, 2].map(s => {
                    return (
                      <button
                        key={s}
                        type="button"
                        role="menuitemradio"
                        aria-checked={exportScale === s}
                        onClick={() => { setExportScale(s); setShowQuality(false); }}
                        title={`${s}× resolution`}
                        className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          exportScale === s
                            ? 'bg-violet-600 text-white'
                            : 'text-stone-600 hover:bg-stone-100'
                        }`}
                      >
                        <span>{s}× resolution</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              onClick={handleDownloadImage}
              disabled={isExporting}
              aria-label="Save PNG"
              className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg font-semibold text-[13px] transition-all ${
                isExporting
                  ? 'bg-stone-100 text-stone-300 cursor-not-allowed'
                  : 'bg-stone-800 text-white hover:bg-stone-900'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <span className="truncate">Save PNG</span>
            </button>

            <button
              onClick={beginHostedSceneUpload}
              disabled={isExporting}
              aria-label="Get AO3 image code"
              className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg font-semibold text-[13px] transition-all ${
                isExporting
                  ? 'bg-violet-300 text-white cursor-not-allowed'
                  : 'bg-violet-600 text-white hover:bg-violet-700'
              }`}
            >
              {isExporting ? (
                <>
                  <svg className="animate-spin flex-shrink-0" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                  {/* truncate is load-bearing, not decoration: a Twitter thread
                      chunks into more parts than a chat does, so this reads
                      "Uploading 4/7" while the row must not reflow. */}
                  <span className="truncate">{progressLabel || 'Working…'}</span>
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                  <span className="truncate">Get AO3 image code</span>
                </>
              )}
            </button>

            {/* Two words and a tooltip, not a sentence. Conditional on
                `workSkin` being non-null — a *build* result, not a platform
                check. All four platforms support work skins, so this is never
                hidden by template and the row never reflows between them. */}
            {workSkin && (
              <button
                onClick={openWorkSkin}
                // Set unconditionally, so the accessible name does not vary
                // with viewport the way the visible text does.
                aria-label="Accessible work skin"
                title="Use a work skin instead — real selectable text that reflows on a phone, rather than an image"
                className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[13px] font-medium text-stone-600 bg-stone-50 border border-stone-200 hover:bg-stone-100 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                <span className="hidden sm:inline">Accessible work skin</span>
              </button>
            )}

            <button
              type="button"
              onClick={openPrivacyChoices}
              aria-label="Privacy choices"
              title="Privacy choices"
              data-testid="privacy-control"
              className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-stone-100 text-stone-500 hover:bg-stone-200 hover:text-stone-700 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
              </svg>
            </button>

            <button
              onClick={toggleHelp}
              aria-expanded={showHelp}
              aria-label="How to use"
              title="How to use"
              className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold transition-colors ${
                showHelp ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
              }`}
            >
              ?
            </button>
          </div>

          <p className="mt-1.5 text-center text-[10px] leading-snug text-stone-400">
            Hosted AO3 image code uploads the finished scene, including visible text, to ImgBB.
          </p>

          {/* Still in flow, and still open by default for a newcomer.
              Deliberate: getting output into an AO3 work is the genuinely
              confusing part of this domain, and polish.spec.ts asserts a
              first-time visitor sees this guidance without clicking. So a
              newcomer still lands on a tall bar — the complaint this phase
              answers is the *returning* author who dismissed it once and kept
              paying 148px for it. They now get ~52px forever. */}
          {showHelp && (
            <div className="mt-2 bg-stone-50 border border-stone-200 rounded-lg p-2.5 space-y-1 text-[11px] text-stone-600 leading-relaxed">
              <p><strong className="text-stone-800">Save PNG</strong> — renders locally and downloads a PNG. Nothing is uploaded.</p>
              <p><strong className="text-stone-800">Get AO3 image code</strong> — uploads the finished scene to ImgBB, then gives you an <code className="bg-stone-200 px-1 rounded">&lt;img&gt;</code> tag. Visible story text is included in that upload.</p>
              {workSkin && <p><strong className="text-stone-800">Accessible work skin</strong> — real selectable text with a readable skin-off fallback. Two pastes, one on your AO3 preferences page.</p>}
            </div>
          )}
        </div>
      </div>

      {showHostedConsent && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-60 p-4" role="dialog" aria-modal="true" aria-label="Confirm hosted image upload" onClick={() => setShowHostedConsent(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl" onClick={event => event.stopPropagation()}>
            <h3 className="text-base font-semibold text-stone-900">Upload the finished scene?</h3>
            <p className="mt-2 text-sm leading-relaxed text-stone-600">
              To create AO3 image code, the finished scene image — including its visible text — will be uploaded to ImgBB. AO3 links to that hosted file and does not keep its own copy. Save a local PNG as a backup.
            </p>
            <label htmlFor="hosted-scene-alt-before-upload" className="mt-4 block text-xs font-semibold text-stone-800">Short image description</label>
            <textarea
              id="hosted-scene-alt-before-upload"
              value={sceneAlt}
              maxLength={500}
              rows={2}
              onChange={event => { setSceneAlt(event.target.value); setSceneAltEdited(true); }}
              className="mt-2 w-full resize-none rounded-lg border border-stone-200 px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500"
            />
            <div className="mt-4 flex flex-col gap-2 sm:flex-row-reverse">
              <button type="button" onClick={confirmHostedSceneUpload} className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700">
                Upload and get AO3 code
              </button>
              <button type="button" onClick={() => setShowHostedConsent(false)} className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* AO3 Code modal                                                      */}
      {/* ------------------------------------------------------------------ */}
      {showCodeModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4"
          onClick={() => setShowCodeModal(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-2xl w-full flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-stone-900 text-white px-5 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Your AO3 code</h3>
                <p className="text-xs text-stone-400 mt-0.5">
                  Paste into your chapter's HTML editor on AO3
                </p>
              </div>
              <button
                onClick={() => setShowCodeModal(false)}
                className="text-white hover:text-stone-300 text-2xl font-bold leading-none ml-4"
              >
                ×
              </button>
            </div>

            {/* Code area */}
            <div className="p-5 space-y-4 overflow-y-auto">
              <textarea
                readOnly
                value={ao3Code}
                rows={Math.max(3, Math.min(10, ao3Code.split('\n').length + 1))}
                className="w-full font-mono text-xs bg-gray-950 text-green-400 border border-gray-700 rounded-lg p-3 resize-none focus:outline-none"
                onClick={e => (e.target as HTMLTextAreaElement).select()}
              />
              <div>
                <label htmlFor="hosted-scene-alt" className="text-xs font-semibold text-stone-800">Short image description</label>
                <p className="mt-0.5 text-[11px] leading-relaxed text-stone-500">
                  Written locally. For multiple image parts, the part number is added automatically.
                </p>
                <textarea
                  id="hosted-scene-alt"
                  value={sceneAlt}
                  maxLength={500}
                  rows={2}
                  onChange={event => {
                    const next = event.target.value;
                    setSceneAlt(next);
                    setSceneAltEdited(true);
                    setAo3Code(current => updateHostedImageAlt(current, next, project));
                  }}
                  className="mt-2 w-full resize-none rounded-lg border border-stone-200 px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500"
                />
                <p className="mt-1 text-[11px] text-green-700">
                  Changes update the code above immediately; the image itself is not uploaded again.
                </p>
              </div>

              <details className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                <summary className="cursor-pointer text-xs font-semibold text-stone-800">Full selectable transcript</summary>
                <textarea readOnly value={transcript} rows={8} aria-label="Scene transcript" className="mt-3 w-full resize-y rounded-lg border border-stone-200 bg-white p-3 font-mono text-xs" onClick={event => event.currentTarget.select()} />
                <button type="button" onClick={downloadTranscript} className="mt-2 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100">
                  Download transcript (.txt)
                </button>
              </details>
            </div>

            {/* Actions */}
            <div className="px-5 pb-5 flex flex-col gap-3">
              <button
                onClick={handleCopyCode}
                className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
                  copiedCode
                    ? 'bg-green-500 text-white'
                    : 'bg-violet-600 text-white hover:bg-violet-700'
                }`}
              >
                {copiedCode ? '✓ Copied!' : 'Copy code'}
              </button>

              {/* How-to accordion */}
              <button
                onClick={() => setShowHowTo(!showHowTo)}
                className="text-xs text-stone-400 hover:text-stone-600 flex items-center gap-1 justify-center"
              >
                <span>{showHowTo ? '▲' : '▼'}</span>
                <span>How to paste this into AO3</span>
              </button>
              {showHowTo && (
                <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs text-stone-600 space-y-1.5">
                  <p>1. Open your chapter editor and click <strong className="text-stone-800">HTML mode</strong> (the &lt;&gt; button).</p>
                  <p>2. Place your cursor where you want the conversation to appear.</p>
                  <p>3. Paste the code. <strong className="text-stone-800">No work skin setup needed.</strong></p>
                  <p>4. Preview your chapter, then post!</p>
                </div>
              )}

              {/* The tag above points at ImgBB, not at AO3 — AO3 never copies
                  an image, it links to one. A free host that hits a quota or
                  loses an account takes the picture out of a fic that has been
                  posted for months, silently (KNOWLEDGE §7). Saying so costs a
                  line; finding out costs a chapter. */}
              <p className="text-[11px] text-stone-400 text-center leading-relaxed">
                The picture is hosted by ImgBB, not AO3. If it ever stops serving the file, your
                chapter loses the image — use <strong className="text-stone-500">Save PNG</strong>{' '}
                to keep a copy you can re-upload.
              </p>
              <button type="button" onClick={backupProject} className="w-full rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50">
                Back up editable project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Work skin modal — two paste targets, not one                        */}
      {/* ------------------------------------------------------------------ */}
      {showWorkSkin && skin && (
        <div
          className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4"
          onClick={() => setShowWorkSkin(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Work skin"
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-stone-900 text-white px-5 py-4 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-sm font-semibold">Your work skin</h3>
                <p className="text-xs text-stone-400 mt-0.5">
                  Two pieces, two different places on AO3
                </p>
              </div>
              <button
                onClick={() => setShowWorkSkin(false)}
                aria-label="Close"
                className="text-white hover:text-stone-300 text-2xl font-bold leading-none ml-4"
              >
                ×
              </button>
            </div>

            <div className="p-5 overflow-y-auto">
              <section className="mb-4 rounded-xl border border-stone-200 p-3" aria-label="Publishing preflight">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-stone-900">Publishing preflight</p>
                    <p className="mt-0.5 text-[11px] text-stone-500">Blocks are generator/identity failures. Warnings are guidance, not claims that AO3 will reject the work.</p>
                  </div>
                  <button type="button" onClick={backupProject} className="flex-shrink-0 rounded-lg border border-stone-200 px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50">
                    Back up project
                  </button>
                </div>
                <ul className="mt-3 space-y-1.5">
                  {preflight.map(item => (
                    <li key={item.id} className={`flex items-start gap-2 text-xs ${item.status === 'pass' ? 'text-green-800' : item.severity === 'block' ? 'text-red-800' : 'text-amber-800'}`}>
                      <span aria-hidden="true">{item.status === 'pass' ? '✓' : item.severity === 'block' ? '✕' : '!'}</span>
                      <span><strong className="uppercase text-[10px]">{item.severity}</strong> · {item.message}</span>
                    </li>
                  ))}
                </ul>
              </section>

              {skin.violations.length > 0 ? (
                <div role="alert" className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                  <p className="text-sm font-semibold text-red-900">AO3 would refuse this skin</p>
                  <p className="text-xs text-red-800 mt-1 leading-relaxed">
                    AO3 rejects a whole skin when it meets CSS it doesn&apos;t allow. This is a
                    bug in the generator, not something you did — please report it, and use
                    &ldquo;Get AO3 image code&rdquo; in the meantime.
                  </p>
                  <ul className="mt-2 space-y-1">
                    {skin.violations.slice(0, 4).map((v, i) => (
                      <li key={i} className="text-[11px] font-mono text-red-700">
                        {v.subject}: {v.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4 flex items-start gap-2">
                  <span className="text-green-600 font-bold">✓</span>
                  <div>
                    <p className="text-sm font-semibold text-green-900">{AO3_RULESET_STATUS}</p>
                    <p className="text-xs text-green-800 mt-0.5">
                      Your readers get selectable text that reflows on a phone, instead of a
                      picture they have to zoom into.
                    </p>
                  </div>
                </div>
              )}

              <label className="mb-5 flex items-start gap-2 rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs text-stone-600">
                <input
                  type="checkbox"
                  checked={includeWorkSkinCredit}
                  onChange={e => setIncludeWorkSkinCredit(e.target.checked)}
                  className="mt-0.5 accent-violet-600"
                />
                <span>
                  <strong className="text-stone-800">Add optional tool credit</strong>
                  <span className="block mt-0.5">Adds plain “Made with AO3 SkinGen” text to the chapter HTML. No link or commercial message.</span>
                </span>
              </label>

              <section className="mb-5 rounded-xl border border-stone-200 p-3">
                <div role="tablist" aria-label="Work skin preview" className="flex rounded-lg bg-stone-100 p-1">
                  <button type="button" role="tab" aria-selected={workSkinPreview === 'styled'} onClick={() => setWorkSkinPreview('styled')} className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold ${workSkinPreview === 'styled' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>
                    Styled
                  </button>
                  <button type="button" role="tab" aria-selected={workSkinPreview === 'fallback'} onClick={() => { setWorkSkinPreview('fallback'); trackAnalytics({ name: 'fallback_preview_opened', templateId: project.template }); }} className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold ${workSkinPreview === 'fallback' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>
                    Without work skin / downloads
                  </button>
                </div>
                {workSkinPreview === 'styled' ? (
                  <div className="mt-3 max-h-72 overflow-auto rounded-lg border border-stone-200 bg-white p-3">
                    <style dangerouslySetInnerHTML={{ __html: skin.css }} />
                    <div id="workskin" dangerouslySetInnerHTML={{ __html: skin.html }} />
                  </div>
                ) : (
                  <div className="mt-3 space-y-3">
                    <p className="text-xs leading-relaxed text-stone-600">
                      This is the reading order and text your export is designed to preserve when a reader hides the work skin or downloads the work. AO3 conversion can still change presentation.
                    </p>
                    <div className="max-h-56 overflow-auto rounded-lg border border-stone-200 bg-white p-3" dangerouslySetInnerHTML={{ __html: skin.html }} />
                    <textarea readOnly value={transcript} rows={8} aria-label="Scene transcript" className="w-full resize-y rounded-lg border border-stone-200 bg-white p-3 font-mono text-xs" onClick={event => event.currentTarget.select()} />
                    <button type="button" onClick={downloadTranscript} className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100">
                      Download transcript (.txt)
                    </button>
                  </div>
                )}
              </section>

              {/* Step 1 — CSS */}
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-5 h-5 rounded-full bg-stone-800 text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">1</span>
                  <p className="text-sm font-semibold text-stone-900">The style</p>
                </div>
                <p className="text-xs text-stone-500 mb-2 ml-7 leading-relaxed">
                  On AO3: <strong className="text-stone-700">Preferences → Skins → Create Work Skin</strong>.
                  Paste this into the CSS box, give it a title, and submit. You only do this once —
                  the same skin can be attached to every fic you post.
                </p>

                {/* The choice a work skin forces, because AO3 allows a work
                    exactly one. An author whose chapter 4 is a different app
                    cannot simply save a second skin — they would have to merge
                    two stylesheets by hand, or lose the first. So the wider
                    skin has to be offered here, at the moment they are about to
                    save one, rather than discovered later.

                    Defaults to this platform: it is the smaller paste and the
                    behaviour this modal had before the choice existed. */}
                <div className="ml-7 mb-2.5">
                  <div
                    role="radiogroup"
                    aria-label="What the skin covers"
                    className="flex rounded-lg border border-stone-200 p-0.5 bg-stone-50"
                  >
                    {([
                      ['platform', `Just ${PLATFORM_NAME[project.template]}`],
                      ['all', 'All four platforms'],
                    ] as const).map(([value, label]) => (
                      <button
                        key={value}
                        role="radio"
                        aria-checked={skinScope === value}
                        onClick={() => setSkinScope(value)}
                        className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                          skinScope === value
                            ? 'bg-white text-stone-900 shadow-sm'
                            : 'text-stone-500 hover:text-stone-700'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-stone-500 mt-1.5 leading-relaxed">
                    {skinScope === 'all' ? (
                      <>
                        Covers Twitter, Google, iMessage and WhatsApp, in light and dark.
                        A fic can only have <strong>one</strong> work skin, so this is the one
                        to take if a later chapter might use a different app — you save it once
                        and never come back. It is longer, because it holds every style.
                      </>
                    ) : (
                      <>
                        Only the {PLATFORM_NAME[project.template]} style — the shortest thing
                        that works. If a later chapter uses a different app you will need the
                        other option, since a fic can only have one work skin.
                      </>
                    )}
                  </p>
                </div>

                {/* The two things AO3 will not tell an author until it has
                    already cost them something: a title collision is a
                    validation error at submit, and a second work skin on a fic
                    that already has one is silent — AO3 applies whichever is
                    selected and the other simply never runs. Both come from
                    AO3's own work-skin FAQ. */}
                <div className="ml-7 mb-2 bg-amber-50 border border-amber-200 rounded-lg p-2.5 space-y-2 text-[11px] text-amber-900 leading-relaxed">
                  <p>
                    <strong>Put your username in the title.</strong> Titles have to be
                    unique across the whole of AO3, not just your account, so a plain
                    name was claimed years ago and AO3 rejects it when you submit.
                    Something like{' '}
                    <code className="bg-amber-100 px-1 rounded">
                      {skinScope === 'all'
                        ? MASTER_TITLE_EXAMPLE
                        : SKIN_TITLE_EXAMPLE[project.template]}
                    </code>{' '}
                    works.
                  </p>
                  <p>
                    <strong>Already using a work skin on this fic?</strong> A work can
                    only have one. Add this CSS to the end of that skin instead of
                    making a second one — if you create a new skin, the fic loses
                    whatever the old one was doing.
                  </p>
                </div>
                <textarea
                  readOnly
                  value={skin.css}
                  rows={6}
                  aria-label="Work skin CSS"
                  className="w-full font-mono text-[11px] bg-gray-950 text-green-400 border border-gray-700 rounded-lg p-3 resize-none focus:outline-none"
                  onClick={e => (e.target as HTMLTextAreaElement).select()}
                />
                <button
                  onClick={() => void copyWorkSkinPart('css')}
                  disabled={workSkinBlocked}
                  className={`w-full mt-2 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                    workSkinBlocked
                      ? 'bg-stone-100 text-stone-400 cursor-not-allowed'
                      : copiedPart === 'css'
                      ? 'bg-green-500 text-white'
                      : 'bg-stone-800 text-white hover:bg-stone-900'
                  }`}
                >
                  {copiedPart === 'css' ? '✓ Copied' : 'Copy the CSS'}
                </button>
              </div>

              {/* Step 2 — HTML */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-5 h-5 rounded-full bg-stone-800 text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">2</span>
                  <p className="text-sm font-semibold text-stone-900">The conversation</p>
                </div>
                <p className="text-xs text-stone-500 mb-2 ml-7 leading-relaxed">
                  In your chapter editor, switch to <strong className="text-stone-700">HTML mode</strong> and
                  paste this where the conversation should appear. Then set{' '}
                  <strong className="text-stone-700">Select Work Skin</strong> to the skin you made
                  in step 1 — without that, this is unstyled text.
                </p>
                {skinScope === 'all' && (
                  // Worth saying once: the markup is identical under either
                  // choice, so the wider skin costs nothing here. Every block
                  // names its own platform and theme, and the saved skin
                  // recognises it.
                  <p className="text-[11px] text-stone-500 mb-2 ml-7 leading-relaxed">
                    For the next conversation — any platform, light or dark — come back and
                    copy this part again. The skin from step 1 already knows what to do with it.
                  </p>
                )}
                <textarea
                  readOnly
                  value={skin.html}
                  rows={5}
                  aria-label="Work skin HTML"
                  className="w-full font-mono text-[11px] bg-gray-950 text-blue-300 border border-gray-700 rounded-lg p-3 resize-none focus:outline-none"
                  onClick={e => (e.target as HTMLTextAreaElement).select()}
                />
                <button
                  onClick={() => void copyWorkSkinPart('html')}
                  disabled={workSkinBlocked}
                  className={`w-full mt-2 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                    workSkinBlocked
                      ? 'bg-stone-100 text-stone-400 cursor-not-allowed'
                      : copiedPart === 'html'
                      ? 'bg-green-500 text-white'
                      : 'bg-violet-600 text-white hover:bg-violet-700'
                  }`}
                >
                  {copiedPart === 'html' ? '✓ Copied' : 'Copy the HTML'}
                </button>
              </div>

              {/* The third thing an author is never told, and the one that
                  breaks a fic that has been up for a year. AO3 never copies an
                  image — it links to wherever it lives. A skin author on
                  Cloudinary went over the free tier and every image in every
                  fic using their skin died at once (KNOWLEDGE §7). This does
                  not pretend "Get AO3 image code" avoids it: that path uploads to
                  ImgBB, which is one file rather than many, and still not AO3. */}
              <p className="text-[11px] text-stone-400 mt-5 leading-relaxed">
                <strong className="text-stone-500">About the icons.</strong> They load from our
                image host each time somebody reads your fic — AO3 never keeps its own copy. If a
                host ever stops serving a file, it disappears from every chapter you have already
                posted, with no warning. It has happened to popular skins before.
                &ldquo;Get AO3 image code&rdquo; is one picture instead of many, but it is hosted off
                AO3 too, so keep the PNG somewhere you can re-upload it from.
              </p>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </>
  );
};
