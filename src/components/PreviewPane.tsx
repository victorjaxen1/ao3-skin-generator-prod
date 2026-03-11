import React, { useMemo, useEffect, useRef, memo, useCallback } from 'react';
import { SkinProject } from '../lib/schema';
import { buildHTML, buildCSS } from '../lib/generator';
import { LOCAL_ASSETS_MAP, getLocalFallback, getFilenameFromUrl } from '../lib/platformAssets';

interface Props { 
  project: SkinProject; 
  mobile: boolean; 
  dark: boolean;
  onMessageClick?: (messageId: string) => void;
  editModeEnabled?: boolean;
}

const PreviewPaneComponent: React.FC<Props> = ({ project, mobile, dark, onMessageClick, editModeEnabled = false }) => {
  const css = useMemo(()=> buildCSS(project), [project]);
  const html = useMemo(()=> buildHTML(project), [project]);
  const containerRef = useRef<HTMLDivElement>(null);
  const workskinRef = useRef<HTMLDivElement>(null);

  // Set up image fallback handler for CDN failures
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleImageError = (event: Event) => {
      const img = event.target as HTMLImageElement;
      if (!img || img.tagName !== 'IMG') return;
      
      const currentSrc = img.src;
      
      // Avoid infinite loop - don't retry if already using local fallback
      if (currentSrc.includes('/assets/')) return;
      
      // Extract filename and check if we have a local fallback
      const filename = getFilenameFromUrl(currentSrc);
      if (LOCAL_ASSETS_MAP[filename]) {
        img.src = getLocalFallback(filename);
      }
    };

    // Add error listener to catch all image load failures
    container.addEventListener('error', handleImageError, true);

    return () => {
      container.removeEventListener('error', handleImageError, true);
    };
  }, [html]);

  // Click-to-edit handler - finds the closest message element and extracts its ID
  const handlePreviewClick = useCallback((e: React.MouseEvent) => {
    if (!onMessageClick) return;
    
    // Find the closest element with data-message-id
    const target = e.target as HTMLElement;
    const messageEl = target.closest('[data-message-id]') as HTMLElement | null;
    
    if (messageEl) {
      const messageId = messageEl.getAttribute('data-message-id');
      if (messageId) {
        onMessageClick(messageId);
      }
    }
  }, [onMessageClick]);

  // Add hover styles for clickable messages when edit mode is enabled
  const editModeStyles = editModeEnabled ? `
    #workskin [data-message-id] {
      cursor: pointer;
      transition: outline 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
    }
    #workskin [data-message-id]:hover {
      outline: 2px solid rgba(59, 130, 246, 0.6);
      outline-offset: 2px;
      box-shadow: 0 0 12px rgba(59, 130, 246, 0.3);
    }
    #workskin .tweet[data-message-id]:hover,
    #workskin .row[data-message-id]:hover {
      background: rgba(59, 130, 246, 0.05);
      border-radius: 8px;
    }
  ` : '';
  
  return (
    <div className="h-full flex flex-col">
      {/* Preview Header - Minimal */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${project.messages.length > 0 ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></div>
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">
            {mobile ? '📱 Mobile' : '🖥️ Desktop'} Preview
          </span>
          {editModeEnabled && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
              ✏️ Click to edit
            </span>
          )}
        </div>
        {project.messages.length === 0 && (
          <span className="text-xs text-gray-400">Add messages to see preview</span>
        )}
      </div>
      
      {/* Preview Container - Device Frame Feel */}
      <div 
        ref={containerRef}
        className={`flex-1 rounded-2xl overflow-auto transition-all duration-300 ${
          dark 
            ? 'bg-gray-900 shadow-inner' 
            : 'bg-gradient-to-b from-gray-50 to-gray-100 shadow-inner'
        }`}
        style={{ minHeight: '500px', maxHeight: 'calc(100vh - 200px)' }}
      >
        {/* Phone Frame Effect for Mobile */}
        <div className={`${mobile ? 'p-4' : 'p-2'}`}>
          <style dangerouslySetInnerHTML={{__html: css + editModeStyles}} />
          <div 
            id="workskin" 
            ref={workskinRef}
            onClick={handlePreviewClick}
            className={`mx-auto transition-all duration-300 ${mobile ? 'rounded-xl overflow-hidden shadow-lg' : ''} ${editModeEnabled ? 'edit-mode-active' : ''}`}
            style={{
              width: mobile ? 375 : '100%', 
              maxWidth: '100%',
              paddingBottom: '60px',
              background: dark ? 'transparent' : 'white'
            }} 
            dangerouslySetInnerHTML={{__html: html}} 
          />
        </div>
        
        {/* Empty State */}
        {project.messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-5xl mb-4 opacity-50">💬</div>
            <p className="text-gray-400 text-sm font-medium">Your conversation will appear here</p>
            <p className="text-gray-300 text-xs mt-1">Start by adding messages in the Editor tab</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Memoize PreviewPane to prevent unnecessary re-renders
// Only re-render when project, mobile, dark, or editModeEnabled actually change
export const PreviewPane = memo(PreviewPaneComponent, (prevProps, nextProps) => {
  return (
    prevProps.mobile === nextProps.mobile &&
    prevProps.dark === nextProps.dark &&
    prevProps.editModeEnabled === nextProps.editModeEnabled &&
    prevProps.onMessageClick === nextProps.onMessageClick &&
    JSON.stringify(prevProps.project) === JSON.stringify(nextProps.project)
  );
});
