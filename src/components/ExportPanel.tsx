import React, { useMemo, useState } from 'react';
import { SkinProject } from '../lib/schema';
import { buildCSS, buildHTML } from '../lib/generator';

interface Props { 
  project: SkinProject;
  showCodeModal: boolean;
  setShowCodeModal: (show: boolean) => void;
  onSuccess?: (action: 'css' | 'html' | 'image') => void;
}

function copy(text: string){ navigator.clipboard.writeText(text); }

async function exportAsImage(project: SkinProject) {
  try {
    // Dynamically import html2canvas only when needed (client-side only)
    if (typeof window === 'undefined') return;
    
    const html2canvas = (await import('html2canvas')).default;
    const css = buildCSS(project);
    const html = buildHTML(project, true);

    const waitForImages = async (root: HTMLElement) => {
      const images = root.querySelectorAll('img');
      await Promise.all(Array.from(images).map(img => {
        if (img.complete) return Promise.resolve(true);
        return new Promise(resolve => {
          img.onload = () => resolve(true);
          img.onerror = () => resolve(true);
          setTimeout(() => resolve(true), 3000);
        });
      }));
    };

    const finalizeDownload = (canvas: HTMLCanvasElement, cleanup: () => void) => {
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `ao3-skin-${project.template}-${Date.now()}.png`;
          a.click();
          URL.revokeObjectURL(url);
        }
        cleanup();
      }, 'image/png', 0.95);
    };

    const templateBackgrounds: Record<SkinProject['template'], string> = {
      ios: '#000000',
      android: '#ece5dd',
      twitter: '#ffffff',
      google: '#ffffff',
    };

    const previewRoot = document.getElementById('workskin') as HTMLElement | null;
    if (previewRoot) {
      // For iOS: Capture the actual visible preview directly (no cloning)
      // This preserves all CSS including ::after pseudo-elements rendered by the browser
      if (project.template === 'ios') {
        const previewChat = previewRoot.querySelector('.chat') as HTMLElement | null;
        const targetElement = previewChat || previewRoot;
        
        await waitForImages(previewRoot);
        
        // Capture the actual preview element directly
        const previewCanvas = await html2canvas(targetElement, {
          backgroundColor: null,
          scale: 2,
          logging: false,
          useCORS: true,
          allowTaint: true,
        });
        
        // Create a new canvas with white padding
        const padding = 24 * 2; // 24px padding at scale 2
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = previewCanvas.width + (padding * 2);
        finalCanvas.height = previewCanvas.height + (padding * 2);
        const ctx = finalCanvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
          ctx.drawImage(previewCanvas, padding, padding);
        }
        
        finalizeDownload(finalCanvas, () => {});
        return;
      }

      const previewChat = previewRoot.querySelector('.chat') as HTMLElement | null;
      const previewWidth = previewChat 
        ? Math.round(previewChat.getBoundingClientRect().width || previewChat.offsetWidth)
        : Math.round(previewRoot.getBoundingClientRect().width || previewRoot.offsetWidth);
      const computedBg = previewChat 
        ? window.getComputedStyle(previewChat).backgroundColor
        : window.getComputedStyle(previewRoot).backgroundColor;
      const chatBg = computedBg && computedBg !== 'rgba(0, 0, 0, 0)' && computedBg !== 'transparent'
        ? computedBg
        : templateBackgrounds[project.template];
      const mount = document.createElement('div');
      mount.style.position = 'absolute';
      mount.style.left = '-9999px';
      mount.style.top = '0';
      mount.style.padding = '0';
      mount.style.boxSizing = 'border-box';

      const styleTag = document.createElement('style');
      styleTag.textContent = css;
      mount.appendChild(styleTag);

      const captureArea = document.createElement('div');
      captureArea.style.background = '#ffffff';
      captureArea.style.padding = '24px';
      captureArea.style.boxSizing = 'border-box';
      captureArea.style.display = 'inline-block';

      const clone = document.createElement('div');
      clone.id = 'workskin';
      clone.setAttribute('data-export-clone', 'true');
      clone.innerHTML = previewRoot.innerHTML;
      clone.style.margin = '0 auto';
      clone.style.paddingBottom = '0';
      clone.style.width = `${previewWidth}px`;
      clone.style.maxWidth = `${previewWidth}px`;
      clone.style.minWidth = `${previewWidth}px`;
      clone.style.boxSizing = 'border-box';
      clone.style.background = chatBg;
      captureArea.appendChild(clone);
      mount.appendChild(captureArea);
      document.body.appendChild(mount);

      // Fix Twitter header alignment for html2canvas
      if (project.template === 'twitter') {
        clone.querySelectorAll('.tweet .head').forEach((head) => {
          const el = head as HTMLElement;
          el.style.display = 'flex';
          el.style.alignItems = 'flex-start';
          el.style.justifyContent = 'space-between';
          el.style.gap = '8px';
        });
        clone.querySelectorAll('.tweet .head-content').forEach((headContent) => {
          const el = headContent as HTMLElement;
          el.style.flex = '1';
          el.style.minWidth = '0';
          el.style.paddingRight = '36px';
        });
        clone.querySelectorAll('.tweet .name-line').forEach((nameLine) => {
          const el = nameLine as HTMLElement;
          el.style.display = 'flex';
          el.style.alignItems = 'center';
          el.style.gap = '4px';
          el.style.flexWrap = 'wrap';
          el.style.lineHeight = '20px';
        });
        clone.querySelectorAll('.tweet .verified-badge').forEach((badge) => {
          const el = badge as HTMLElement;
          el.style.width = '18px';
          el.style.height = '18px';
          el.style.flexShrink = '0';
          el.style.verticalAlign = 'middle';
          el.style.position = 'relative';
          el.style.top = '7px';
        });
        clone.querySelectorAll('.tweet .twitter-logo').forEach((logo) => {
          const el = logo as HTMLElement;
          el.style.width = '20px';
          el.style.height = '20px';
          el.style.flexShrink = '0';
          el.style.position = 'absolute';
          el.style.right = '16px';
          el.style.top = '19px';
        });
        clone.querySelectorAll('.tweet .handle').forEach((handle) => {
          const el = handle as HTMLElement;
          el.style.flexShrink = '0';
          el.style.whiteSpace = 'nowrap';
        });
        clone.querySelectorAll('.tweet .follow-btn').forEach((btn) => {
          const el = btn as HTMLElement;
          el.style.flexShrink = '0';
          el.style.whiteSpace = 'nowrap';
        });
        // Fix avatar distortion
        clone.querySelectorAll('.tweet img.avatar').forEach((avatar) => {
          const el = avatar as HTMLElement;
          el.style.width = '40px';
          el.style.height = '40px';
          el.style.minWidth = '40px';
          el.style.minHeight = '40px';
          el.style.maxWidth = '40px';
          el.style.maxHeight = '40px';
          el.style.borderRadius = '50%';
          el.style.objectFit = 'cover';
          el.style.aspectRatio = '1 / 1';
        });
      }

      // Fix Android header alignment for html2canvas
      if (project.template === 'android') {
        clone.querySelectorAll('.android-header-avatar, .android-header-avatar-placeholder').forEach((avatar) => {
          const el = avatar as HTMLElement;
          el.style.top = '50%';
          el.style.transform = 'translateY(-35%)';
          el.style.width = '40px';
          el.style.height = '40px';
          el.style.minWidth = '40px';
          el.style.minHeight = '40px';
          el.style.maxWidth = '40px';
          el.style.maxHeight = '40px';
          el.style.borderRadius = '50%';
          el.style.objectFit = 'cover';
        });
        clone.querySelectorAll('.android-header-name').forEach((name) => {
          const el = name as HTMLElement;
          el.style.top = '50%';
          el.style.transform = 'translateY(-40%)';
          el.style.lineHeight = '1.2';
        });
        // Fix Android message bubbles for html2canvas
        clone.querySelectorAll('dd.bubble.out').forEach((bubble) => {
          const el = bubble as HTMLElement;
          el.style.borderRadius = '8px';
          el.style.padding = '7px 10px';
          el.style.display = 'inline-block';
          el.style.maxWidth = '280px';
          el.style.boxShadow = '0 1px 2px rgba(0,0,0,0.1)';
        });
        clone.querySelectorAll('dd.bubble.in').forEach((bubble) => {
          const el = bubble as HTMLElement;
          el.style.borderRadius = '8px';
          el.style.padding = '7px 10px';
          el.style.display = 'inline-block';
          el.style.maxWidth = '280px';
          el.style.boxShadow = '0 1px 2px rgba(0,0,0,0.1)';
        });
        // Fix row alignment
        clone.querySelectorAll('.row.out').forEach((row) => {
          const el = row as HTMLElement;
          el.style.display = 'flex';
          el.style.justifyContent = 'flex-end';
        });
        clone.querySelectorAll('.row.in').forEach((row) => {
          const el = row as HTMLElement;
          el.style.display = 'flex';
          el.style.justifyContent = 'flex-start';
        });
      }

      await waitForImages(clone);

      const canvas = await html2canvas(captureArea, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        useCORS: true,
        allowTaint: true,
        width: captureArea.offsetWidth,
        height: captureArea.offsetHeight,
        windowWidth: captureArea.offsetWidth,
        windowHeight: captureArea.offsetHeight,
        foreignObjectRendering: false,
        imageTimeout: 5000,
      });

      finalizeDownload(canvas, () => {
        document.body.removeChild(mount);
      });
      return;
    }

    // Fallback: rebuild DOM off-screen if preview is unavailable
    const mount = document.createElement('div');
    mount.style.position = 'absolute';
    mount.style.left = '-9999px';
    mount.style.top = '0';
    mount.style.boxSizing = 'border-box';

    const style = document.createElement('style');
    style.textContent = css;
    mount.appendChild(style);

    const captureArea = document.createElement('div');
    captureArea.style.background = '#ffffff';
    captureArea.style.padding = '24px';
    captureArea.style.boxSizing = 'border-box';
    captureArea.style.display = 'inline-block';
    mount.appendChild(captureArea);

    const workskin = document.createElement('div');
    workskin.id = 'workskin';
    workskin.innerHTML = html;
    captureArea.appendChild(workskin);

    document.body.appendChild(mount);

    const templateCaps: Record<SkinProject['template'], number> = {
      ios: 375,
      android: 400,
      twitter: 600,
      google: 600,
    };
    const configuredWidth = project.settings?.maxWidthPx ?? templateCaps[project.template];
    const fallbackWidth = Math.min(configuredWidth, templateCaps[project.template]);
    const exportChat = workskin.querySelector('.chat') as HTMLElement | null;
    const targetWidth = exportChat ? exportChat.offsetWidth || fallbackWidth : fallbackWidth;
    if (exportChat && targetWidth) {
      exportChat.style.width = `${targetWidth}px`;
      exportChat.style.maxWidth = `${targetWidth}px`;
      exportChat.style.minWidth = `${targetWidth}px`;
    }

    await waitForImages(workskin);
    await new Promise(resolve => setTimeout(resolve, 150));

    const canvas = await html2canvas(captureArea, {
      backgroundColor: '#ffffff',
      scale: 2,
      logging: false,
      useCORS: true,
      allowTaint: true,
      width: captureArea.offsetWidth,
      height: captureArea.offsetHeight,
      windowWidth: captureArea.offsetWidth,
      windowHeight: captureArea.offsetHeight,
      foreignObjectRendering: false,
      imageTimeout: 5000,
    });

    finalizeDownload(canvas, () => {
      document.body.removeChild(mount);
    });
  } catch (error) {
    console.error('Export as image failed:', error);
    alert('Failed to export image. Make sure all images are loaded and try again.');
  }
}

export const ExportPanel: React.FC<Props> = ({ project, showCodeModal, setShowCodeModal, onSuccess }) => {
  const css = useMemo(()=> buildCSS(project), [project]);
  const html = useMemo(()=> buildHTML(project), [project]);
  const [copiedCSS, setCopiedCSS] = useState(false);
  const [copiedHTML, setCopiedHTML] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const copyCSS = () => {
    copy(css);
    setCopiedCSS(true);
    setTimeout(() => setCopiedCSS(false), 2000);
    onSuccess?.('css');
    
    // Track CSS copy event in Google Analytics
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'copy_css', {
        event_category: 'Code Export',
        event_label: project.template,
        template_type: project.template
      });
    }
  };

  const copyHTML = () => {
    copy(html);
    setCopiedHTML(true);
    setTimeout(() => setCopiedHTML(false), 2000);
    onSuccess?.('html');
    
    // Track HTML copy event in Google Analytics
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'copy_html', {
        event_category: 'Code Export',
        event_label: project.template,
        template_type: project.template
      });
    }
  };

  const handleExportImage = async () => {
    await exportAsImage(project);
    onSuccess?.('image');
    
    // Track image export event in Google Analytics
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'export_image', {
        event_category: 'Code Export',
        event_label: project.template,
        template_type: project.template
      });
    }
  };

  return (
    <>
      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-blue-600 shadow-lg z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 sm:py-3">
          <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-700">🎨 Export Your Skin:</span>
            </div>
            
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full sm:w-auto justify-center">
              <button 
                onClick={handleExportImage}
                className="text-xs sm:text-sm bg-green-600 text-white px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg hover:bg-green-700 transition-colors font-medium shadow-sm"
              >
                📷 <span className="hidden sm:inline">Download </span>Image
              </button>
              
              <button 
                onClick={copyCSS}
                className={`text-xs sm:text-sm px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg font-medium shadow-sm transition-colors ${
                  copiedCSS 
                    ? 'bg-green-600 text-white' 
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {copiedCSS ? '✓ CSS' : '📋 CSS'}
              </button>
              
              <button 
                onClick={copyHTML}
                className={`text-xs sm:text-sm px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg font-medium shadow-sm transition-colors ${
                  copiedHTML 
                    ? 'bg-green-600 text-white' 
                    : 'bg-purple-600 text-white hover:bg-purple-700'
                }`}
              >
                {copiedHTML ? '✓ HTML' : '📋 HTML'}
              </button>
              
              <button 
                onClick={() => setShowCodeModal(true)}
                className="text-xs sm:text-sm bg-gray-700 text-white px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg hover:bg-gray-800 transition-colors font-medium shadow-sm"
              >
                👁️ <span className="hidden sm:inline">View </span>Code
              </button>
              
              <button 
                onClick={() => setShowHelp(!showHelp)}
                className={`text-xs sm:text-sm px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg transition-colors font-medium shadow-sm ${
                  showHelp 
                    ? 'bg-red-500 text-white hover:bg-red-600' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {showHelp ? '✕' : '❓'}<span className="hidden sm:inline">{showHelp ? ' Close Help' : ' Help'}</span>
              </button>
            </div>
          </div>
          
          {/* Inline Help */}
          {showHelp && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="text-xs text-gray-600 space-y-1">
                <p className="font-semibold text-gray-700 mb-2">📖 How to Use:</p>
                <ol className="list-decimal ml-4 space-y-1">
                  <li>Click <strong>Copy CSS</strong> → Go to AO3 Dashboard → Skins → Create Work Skin → Paste CSS</li>
                  <li>Save your skin, then open/edit your work</li>
                  <li>Click <strong>Copy HTML</strong> → Paste into chapter text editor (HTML mode)</li>
                  <li>Preview on desktop and phone; adjust bubble widths if needed</li>
                </ol>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Code Preview Modal */}
      {showCodeModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowCodeModal(false)}
        >
          <div 
            className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-gray-800 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">📝 Generated Code</h3>
              <button 
                onClick={() => setShowCodeModal(false)}
                className="text-white hover:text-gray-300 text-2xl font-bold leading-none"
              >
                ×
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="overflow-auto p-6 space-y-4 flex-1">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-gray-700">CSS (Work Skin)</h4>
                  <button 
                    onClick={copyCSS}
                    className={`text-xs px-3 py-1 rounded ${
                      copiedCSS 
                        ? 'bg-green-600 text-white' 
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {copiedCSS ? '✓ Copied!' : 'Copy CSS'}
                  </button>
                </div>
                <pre className="p-3 text-xs bg-gray-900 text-green-400 overflow-auto rounded border border-gray-700 max-h-64">
                  {css}
                </pre>
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-gray-700">HTML (Chapter Body)</h4>
                  <button 
                    onClick={copyHTML}
                    className={`text-xs px-3 py-1 rounded ${
                      copiedHTML 
                        ? 'bg-green-600 text-white' 
                        : 'bg-purple-600 text-white hover:bg-purple-700'
                    }`}
                  >
                    {copiedHTML ? '✓ Copied!' : 'Copy HTML'}
                  </button>
                </div>
                <pre className="p-3 text-xs bg-gray-900 text-blue-300 overflow-auto rounded border border-gray-700 max-h-64">
                  {html}
                </pre>
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="bg-gray-100 px-6 py-4 border-t border-gray-200">
              <p className="text-xs text-gray-600">
                💡 <strong>Tip:</strong> Copy CSS into AO3 Work Skin editor, then copy HTML into your chapter text (HTML mode)
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
