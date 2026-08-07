import React, { useState, useEffect, useMemo, useRef } from 'react';
import { SkinProject } from '../lib/schema';
import { buildCSS, buildHTML } from '../lib/generator';
import { buildWorkSkin, supportsWorkSkin } from '../lib/workSkin';
import { getProStatus, getProFeatures, ProStatus } from '../lib/proFeatures';
import { ProUpgradeModal } from './ProUpgradeModal';
import { useToast, ToastContainer } from './Toast';
import { uploadToImgBB, ImageUploadError } from '../lib/imgbb';
import { inlineCrossOriginImages, FailedImage } from '../lib/imageProxy';

interface Props {
  project: SkinProject;
  showCodeModal: boolean;
  setShowCodeModal: (show: boolean) => void;
  onSuccess?: (action: 'image' | 'ao3code') => void;
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

/**
 * Apply a watermark strip to a canvas.
 * Returns a new canvas — the original is unchanged.
 * Pro users: returns the original canvas unmodified.
 */
function applyWatermark(canvas: HTMLCanvasElement, skipWatermark: boolean): HTMLCanvasElement {
  if (skipWatermark) return canvas;

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
    '★ Made with ao3skingen.wordfokus.com — Free Social Media AU Generator',
    out.width / 2,
    canvas.height + watermarkHeight / 2
  );
  return out;
}

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
    clone.querySelectorAll('.tweet .metric-count').forEach(el => {
      (el as HTMLElement).style.cssText +=
        ';font-size:14px;line-height:20px;position:relative;top:-6px';
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
  skipWatermark: boolean,
  onImageWarning?: (failed: FailedImage[]) => void
): Promise<void> {
  const canvas = await renderChunk(project, scale, onImageWarning);
  const watermarked = applyWatermark(canvas, skipWatermark);
  const blob = await canvasToBlob(watermarked);
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
  skipWatermark: boolean,
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

  const watermarked = canvases.map(c => applyWatermark(c, skipWatermark));
  const blobs = await Promise.all(watermarked.map(canvasToBlob));

  // Upload sequentially to avoid hitting rate limits
  const urls: string[] = [];
  for (let i = 0; i < blobs.length; i++) {
    onProgress('Uploading', i, blobs.length);
    const url = await uploadToImgBB(blobs[i]);
    urls.push(url);
    onProgress('Uploading', i + 1, blobs.length);
  }

  const isMultiple = urls.length > 1;
  const imgTags = urls.map((url, i) => {
    const alt = isMultiple
      ? `[Conversation screenshot, part ${i + 1} of ${urls.length}]`
      : '[Conversation screenshot]';
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
  onSuccess,
}) => {
  const barRef = useRef<HTMLDivElement>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showProModal, setShowProModal] = useState(false);
  const [proStatus, setProStatus] = useState<ProStatus>({ isPro: false });
  const [exportScale, setExportScale] = useState(2);
  const [isExporting, setIsExporting] = useState(false);
  const [progressLabel, setProgressLabel] = useState('');
  const [ao3Code, setAo3Code] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);
  const [showWorkSkin, setShowWorkSkin] = useState(false);
  const [copiedPart, setCopiedPart] = useState<'css' | 'html' | null>(null);
  const { toasts, removeToast, success, error: showError } = useToast();

  // The third export. Cheap to compute — no rendering, no upload — so it is
  // derived rather than triggered, and the button can open instantly.
  const workSkin = useMemo(
    () => (supportsWorkSkin(project.template) ? buildWorkSkin(project) : null),
    [project]
  );

  useEffect(() => {
    setProStatus(getProStatus());
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

  const skipWatermark = getProFeatures().watermarkFree;

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
    setIsExporting(true);
    setProgressLabel('Rendering...');
    try {
      await exportAsImage(project, exportScale, skipWatermark, warnAboutImages);
      success('Downloaded!');
      onSuccess?.('image');
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'export_image', {
          event_category: 'Export',
          event_label: project.template,
          scale: exportScale,
          is_pro: proStatus.isPro,
        });
      }
    } catch (err) {
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
    setIsExporting(true);
    setProgressLabel('Starting...');
    try {
      const code = await exportAsAO3(
        project,
        exportScale,
        skipWatermark,
        (stage, current, total) => {
          setProgressLabel(total <= 1 ? `${stage}...` : `${stage} ${current}/${total}`);
        },
        warnAboutImages
      );
      setAo3Code(code);
      setShowCodeModal(true);
      onSuccess?.('ao3code');
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'export_ao3_code', {
          event_category: 'Export',
          event_label: project.template,
          scale: exportScale,
          is_pro: proStatus.isPro,
        });
      }
    } catch (err) {
      if (err instanceof ImageUploadError) {
        showError(`Upload failed: ${err.userMessage}`);
      } else {
        showError(
          err instanceof Error ? err.message : 'Export failed. Please try again.'
        );
      }
    } finally {
      setIsExporting(false);
      setProgressLabel('');
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(ao3Code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
    success('Copied! Paste into your AO3 chapter HTML editor.');
  };

  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* Sticky bottom bar                                                   */}
      {/* ------------------------------------------------------------------ */}
      <div
        ref={barRef}
        className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] z-50"
      >
        <div className="max-w-4xl mx-auto px-4 py-3">

          {/* Quality + help row */}
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-stone-400 font-medium uppercase tracking-wide mr-1">Quality</span>
              {[1, 2, 4].map(s => (
                <button
                  key={s}
                  onClick={() => setExportScale(s)}
                  disabled={s === 4 && !proStatus.isPro}
                  title={s === 4 && !proStatus.isPro ? 'Upgrade for 4× quality' : `${s}× resolution`}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                    exportScale === s
                      ? 'bg-violet-600 text-white'
                      : s === 4 && !proStatus.isPro
                      ? 'bg-stone-100 text-stone-300 cursor-not-allowed'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {s}×{s === 4 && !proStatus.isPro ? ' ✦' : ''}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              {!proStatus.isPro && (
                <button
                  onClick={() => setShowProModal(true)}
                  className="text-[11px] text-violet-600 font-semibold hover:underline hidden sm:block"
                >
                  Upgrade
                </button>
              )}
              <button
                onClick={toggleHelp}
                aria-expanded={showHelp}
                className={`text-[11px] px-2.5 py-1 rounded-lg font-medium transition-all ${
                  showHelp
                    ? 'bg-stone-800 text-white'
                    : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                }`}
              >
                How to use
              </button>
            </div>
          </div>

          {/* Two main action buttons */}
          <div className="flex gap-2.5">
            <button
              onClick={handleDownloadImage}
              disabled={isExporting}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-all ${
                isExporting
                  ? 'bg-stone-100 text-stone-300 cursor-not-allowed'
                  : 'bg-stone-800 text-white hover:bg-stone-900 shadow-sm hover:shadow'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <span>Save Image</span>
            </button>

            <button
              onClick={handleGetAO3Code}
              disabled={isExporting}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-all ${
                isExporting
                  ? 'bg-violet-300 text-white cursor-not-allowed'
                  : 'bg-violet-600 text-white hover:bg-violet-700 shadow-sm hover:shadow'
              }`}
            >
              {isExporting ? (
                <>
                  <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                  <span className="truncate">{progressLabel || 'Working…'}</span>
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                  <span>Copy for AO3</span>
                </>
              )}
            </button>
          </div>

          {/* Third option, shown only where the CSS actually passes AO3's
              rules. It is a secondary row rather than a third primary button:
              the image is the reliable default, and this trades that for
              selectable text and a layout that reflows on a phone. */}
          {workSkin && (
            <button
              onClick={() => setShowWorkSkin(true)}
              className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium text-stone-600 bg-stone-50 border border-stone-200 hover:bg-stone-100 hover:border-stone-300 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
              <span>Or use a work skin — real text, not an image</span>
            </button>
          )}

          {/* Help panel */}
          {showHelp && (
            <div className="mt-3 pt-3 border-t border-stone-100">
              <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 space-y-1.5 text-xs text-stone-600">
                <p><strong className="text-stone-800">Save Image</strong> — downloads a PNG to your device. Share on Tumblr, Twitter, etc.</p>
                <p><strong className="text-stone-800">Copy for AO3</strong> — renders and uploads your conversation automatically, then gives you an <code className="bg-stone-200 px-1 rounded">&lt;img&gt;</code> tag ready to paste into AO3's HTML editor. <strong className="text-stone-800">No work skin needed.</strong></p>
              </div>
            </div>
          )}
        </div>
      </div>

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
            <div className="p-5">
              <textarea
                readOnly
                value={ao3Code}
                rows={Math.max(3, Math.min(10, ao3Code.split('\n').length + 1))}
                className="w-full font-mono text-xs bg-gray-950 text-green-400 border border-gray-700 rounded-lg p-3 resize-none focus:outline-none"
                onClick={e => (e.target as HTMLTextAreaElement).select()}
              />
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
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Work skin modal — two paste targets, not one                        */}
      {/* ------------------------------------------------------------------ */}
      {showWorkSkin && workSkin && (
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
              {workSkin.violations.length > 0 ? (
                <div role="alert" className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                  <p className="text-sm font-semibold text-red-900">AO3 would refuse this skin</p>
                  <p className="text-xs text-red-800 mt-1 leading-relaxed">
                    AO3 rejects a whole skin when it meets CSS it doesn&apos;t allow. This is a
                    bug in the generator, not something you did — please report it, and use
                    &ldquo;Copy for AO3&rdquo; in the meantime.
                  </p>
                  <ul className="mt-2 space-y-1">
                    {workSkin.violations.slice(0, 4).map((v, i) => (
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
                    <p className="text-sm font-semibold text-green-900">AO3-safe check passed</p>
                    <p className="text-xs text-green-800 mt-0.5">
                      Your readers get selectable text that reflows on a phone, instead of a
                      picture they have to zoom into.
                    </p>
                  </div>
                </div>
              )}

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
                <textarea
                  readOnly
                  value={workSkin.css}
                  rows={6}
                  aria-label="Work skin CSS"
                  className="w-full font-mono text-[11px] bg-gray-950 text-green-400 border border-gray-700 rounded-lg p-3 resize-none focus:outline-none"
                  onClick={e => (e.target as HTMLTextAreaElement).select()}
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(workSkin.css);
                    setCopiedPart('css');
                    setTimeout(() => setCopiedPart(null), 2000);
                  }}
                  disabled={workSkin.violations.length > 0}
                  className={`w-full mt-2 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                    workSkin.violations.length > 0
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
                  paste this where the tweets should appear. Then set{' '}
                  <strong className="text-stone-700">Select Work Skin</strong> to the skin you made
                  in step 1 — without that, this is unstyled text.
                </p>
                <textarea
                  readOnly
                  value={workSkin.html}
                  rows={5}
                  aria-label="Work skin HTML"
                  className="w-full font-mono text-[11px] bg-gray-950 text-blue-300 border border-gray-700 rounded-lg p-3 resize-none focus:outline-none"
                  onClick={e => (e.target as HTMLTextAreaElement).select()}
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(workSkin.html);
                    setCopiedPart('html');
                    setTimeout(() => setCopiedPart(null), 2000);
                  }}
                  disabled={workSkin.violations.length > 0}
                  className={`w-full mt-2 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                    workSkin.violations.length > 0
                      ? 'bg-stone-100 text-stone-400 cursor-not-allowed'
                      : copiedPart === 'html'
                      ? 'bg-green-500 text-white'
                      : 'bg-violet-600 text-white hover:bg-violet-700'
                  }`}
                >
                  {copiedPart === 'html' ? '✓ Copied' : 'Copy the HTML'}
                </button>
              </div>

              <p className="text-[11px] text-stone-400 mt-5 leading-relaxed">
                The icons stay hosted by us. If you would rather nothing outside AO3 loads inside
                your fic, use &ldquo;Copy for AO3&rdquo; instead — that uploads one flat picture.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Pro modal                                                           */}
      {/* ------------------------------------------------------------------ */}
      <ProUpgradeModal
        isOpen={showProModal}
        onClose={() => setShowProModal(false)}
        onStatusChange={status => setProStatus(status)}
      />

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </>
  );
};
