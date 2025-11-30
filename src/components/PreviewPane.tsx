import React, { useMemo, useEffect, useRef } from 'react';
import { SkinProject } from '../lib/schema';
import { buildHTML, buildCSS } from '../lib/generator';
import { LOCAL_ASSETS, getLocalFallback, getFilenameFromUrl } from '../lib/platformAssets';

interface Props { project: SkinProject; mobile: boolean; dark: boolean; }

export const PreviewPane: React.FC<Props> = ({ project, mobile, dark }) => {
  const css = useMemo(()=> buildCSS(project), [project]);
  const html = useMemo(()=> buildHTML(project), [project]);
  const containerRef = useRef<HTMLDivElement>(null);

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
      if (LOCAL_ASSETS[filename]) {
        img.src = getLocalFallback(filename);
      }
    };

    // Add error listener to catch all image load failures
    container.addEventListener('error', handleImageError, true);

    return () => {
      container.removeEventListener('error', handleImageError, true);
    };
  }, [html]);
  
  return (
    <div className="h-full flex flex-col">
      <h2 className="text-lg font-semibold mb-2">Preview</h2>
      <div className="text-xs mb-2 opacity-70">This simulates AO3 workskin rendering (#workskin scope).</div>
      <div 
        ref={containerRef}
        className="border rounded p-2 bg-white overflow-auto" 
        style={{background: dark? '#333':'#fafafa', minHeight: '700px', maxHeight: '90vh'}}
      >
        <style dangerouslySetInnerHTML={{__html: css}} />
        <div id="workskin" style={{width: mobile? 375: '100%', maxWidth: '100%', transition: 'width .2s', margin: '0 auto', paddingBottom: '100px'}} dangerouslySetInnerHTML={{__html: html}} />
      </div>
    </div>
  );
};
