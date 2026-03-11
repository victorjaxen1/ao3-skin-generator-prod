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
      transition: outline 0.15s ease, box-shadow 0.15s ease;
    }
    #workskin [data-message-id]:hover {
      outline: 2px solid rgba(124, 58, 237, 0.5);
      outline-offset: 2px;
      box-shadow: 0 0 10px rgba(124, 58, 237, 0.2);
    }
    #workskin .tweet[data-message-id]:hover,
    #workskin .row[data-message-id]:hover {
      background: rgba(124, 58, 237, 0.04);
      border-radius: 8px;
    }
  ` : '';
  
  return (
    <div className="h-full flex flex-col">
      {/* Preview container */}
      <div
        ref={containerRef}
        className={`flex-1 overflow-auto ${
          dark ? 'bg-stone-900' : 'bg-stone-50'
        }`}
      >
        <div className="p-3">
          <style dangerouslySetInnerHTML={{__html: css + editModeStyles}} />
          <div
            id="workskin"
            ref={workskinRef}
            onClick={handlePreviewClick}
            className={`mx-auto ${editModeEnabled ? 'edit-mode-active' : ''}`}
            style={{
              width: 375,
              maxWidth: '100%',
              paddingBottom: '60px',
              background: dark ? 'transparent' : 'white',
            }}
            dangerouslySetInnerHTML={{__html: html}}
          />
        </div>

        {project.messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-2xl bg-stone-200 flex items-center justify-center mb-3 text-2xl">💬</div>
            <p className="text-stone-500 text-sm font-medium">Nothing here yet</p>
            <p className="text-stone-400 text-xs mt-1">Add messages on the left to see a preview</p>
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
