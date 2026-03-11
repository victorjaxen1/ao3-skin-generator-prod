import React, { useState, useEffect } from 'react';
import { SkinProject } from '../lib/schema';
import { buildCSS, buildHTML } from '../lib/generator';
import { getProStatus, getProFeatures, ProStatus } from '../lib/proFeatures';
import { ProUpgradeModal } from './ProUpgradeModal';
import { useToast, ToastContainer } from './Toast';
import { uploadToImgBB, ImageUploadError } from '../lib/imgbb';

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
  ctx.fillStyle = '#1e40af';
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

async function renderChunk(project: SkinProject, scale: number): Promise<HTMLCanvasElement> {
  if (typeof window === 'undefined') throw new Error('Cannot render on server side');

  const html2canvas = (await import('html2canvas')).default;

  const css = buildCSS(project);
  const html = buildHTML(project, true);

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
    clone.querySelectorAll('.android-header-name').forEach(el => {
      (el as HTMLElement).style.cssText +=
        ';position:absolute;left:110px;top:50%;transform:translateY(-50%) translateY(-6px);margin:0;display:flex;align-items:center;line-height:1.2';
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

  await waitForImages(clone);

  const captureWidth = captureArea.scrollWidth;
  const captureHeight = captureArea.scrollHeight;

  const canvas = await (html2canvas as any)(captureArea, {
    background: '#ffffff',
    scale,
    logging: false,
    useCORS: true,
    allowTaint: true,
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
  onProgress?: (rendered: number, total: number) => void
): Promise<HTMLCanvasElement[]> {
  const messages = project.messages;

  if (messages.length === 0) {
    return [await renderChunk(project, scale)];
  }

  const chunks: (typeof messages)[] = [];
  for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
    chunks.push(messages.slice(i, i + CHUNK_SIZE));
  }

  const canvases: HTMLCanvasElement[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunkProject: SkinProject = { ...project, messages: chunks[i] };
    const canvas = await renderChunk(chunkProject, scale);
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
  skipWatermark: boolean
): Promise<void> {
  const canvas = await renderChunk(project, scale);
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
  onProgress: (stage: string, current: number, total: number) => void
): Promise<string> {
  const totalChunks = Math.max(1, Math.ceil((project.messages.length || 1) / CHUNK_SIZE));

  onProgress('Rendering', 0, totalChunks);

  const canvases = await renderAllChunks(project, scale, (rendered) => {
    onProgress('Rendering', rendered, totalChunks);
  });

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
  const [showHelp, setShowHelp] = useState(false);
  const [showProModal, setShowProModal] = useState(false);
  const [proStatus, setProStatus] = useState<ProStatus>({ isPro: false });
  const [exportScale, setExportScale] = useState(2);
  const [isExporting, setIsExporting] = useState(false);
  const [progressLabel, setProgressLabel] = useState('');
  const [ao3Code, setAo3Code] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);
  const { toasts, removeToast, success, error: showError } = useToast();

  useEffect(() => {
    setProStatus(getProStatus());
  }, []);

  const skipWatermark = getProFeatures().watermarkFree;

  // --- Download Image ---
  const handleDownloadImage = async () => {
    if (isExporting) return;
    setIsExporting(true);
    setProgressLabel('Rendering...');
    try {
      await exportAsImage(project, exportScale, skipWatermark);
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
        }
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
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-2xl z-50">
        <div className="max-w-7xl mx-auto px-4 py-3">

          {/* Scale + help row */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-medium">Quality:</span>
              {[1, 2, 4].map(s => (
                <button
                  key={s}
                  onClick={() => setExportScale(s)}
                  disabled={s === 4 && !proStatus.isPro}
                  title={s === 4 && !proStatus.isPro ? 'Pro only' : `${s}× quality`}
                  className={`px-2.5 py-1 text-xs font-semibold rounded transition-all ${
                    exportScale === s
                      ? 'bg-blue-600 text-white'
                      : s === 4 && !proStatus.isPro
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {s}×{s === 4 ? ' ✨' : ''}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              {!proStatus.isPro && (
                <button
                  onClick={() => setShowProModal(true)}
                  className="text-xs text-purple-600 font-semibold hover:underline hidden sm:block"
                >
                  ✨ Go Pro
                </button>
              )}
              <button
                onClick={() => setShowHelp(!showHelp)}
                className={`text-xs px-2.5 py-1 rounded font-semibold transition-all ${
                  showHelp
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                ❓ Help
              </button>
            </div>
          </div>

          {/* Two main action buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleDownloadImage}
              disabled={isExporting}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm shadow transition-all ${
                isExporting
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-800 text-white hover:bg-gray-900 hover:shadow-lg'
              }`}
            >
              <span className="text-base">📥</span>
              <span>Download Image</span>
            </button>

            <button
              onClick={handleGetAO3Code}
              disabled={isExporting}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm shadow transition-all ${
                isExporting
                  ? 'bg-blue-300 text-white cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg'
              }`}
            >
              {isExporting ? (
                <>
                  <span className="animate-spin text-base">⏳</span>
                  <span className="truncate">{progressLabel || 'Working...'}</span>
                </>
              ) : (
                <>
                  <span className="text-base">📝</span>
                  <span>Get AO3 Code</span>
                </>
              )}
            </button>
          </div>

          {/* Help panel */}
          {showHelp && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="font-bold text-sm text-blue-900 mb-1.5">How to use:</p>
                <ol className="list-decimal ml-4 space-y-1 text-xs text-blue-800">
                  <li>
                    <strong>Download Image</strong> — saves a PNG of your conversation to your
                    device. Great for sharing on Tumblr, Twitter, etc.
                  </li>
                  <li>
                    <strong>Get AO3 Code</strong> — renders your conversation as an image,
                    uploads it automatically, and gives you a ready-to-paste snippet for your
                    AO3 chapter.{' '}
                    <strong>No work skin needed</strong> — just paste into the HTML editor.
                  </li>
                </ol>
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
            <div className="bg-gray-900 text-white px-5 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">📝 Your AO3 Code</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Paste this into your chapter's HTML editor on AO3
                </p>
              </div>
              <button
                onClick={() => setShowCodeModal(false)}
                className="text-white hover:text-gray-300 text-2xl font-bold leading-none ml-4"
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
                className={`w-full py-3 rounded-xl font-bold text-base transition-all ${
                  copiedCode
                    ? 'bg-green-500 text-white'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700'
                }`}
              >
                {copiedCode ? '✓ Copied!' : '📋 Copy Code'}
              </button>

              {/* How-to accordion */}
              <button
                onClick={() => setShowHowTo(!showHowTo)}
                className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 justify-center"
              >
                <span>{showHowTo ? '▲' : '▼'}</span>
                <span>How to paste this into AO3</span>
              </button>
              {showHowTo && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-700 space-y-1.5">
                  <p>
                    1. In AO3, open your chapter editor and click{' '}
                    <strong>HTML mode</strong> (the &lt;&gt; button).
                  </p>
                  <p>2. Place your cursor where you want the conversation to appear.</p>
                  <p>
                    3. Paste the code above. <strong>No work skin setup needed.</strong>
                  </p>
                  <p>4. Preview your chapter, then post!</p>
                </div>
              )}
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
