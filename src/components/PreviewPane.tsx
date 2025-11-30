import React, { useMemo } from 'react';
import { SkinProject } from '../lib/schema';
import { buildHTML, buildCSS } from '../lib/generator';

interface Props { project: SkinProject; mobile: boolean; dark: boolean; }

export const PreviewPane: React.FC<Props> = ({ project, mobile, dark }) => {
  const css = useMemo(()=> buildCSS(project), [project]);
  const html = useMemo(()=> buildHTML(project), [project]);
  
  return (
    <div className="h-full flex flex-col">
      <h2 className="text-lg font-semibold mb-2">Preview</h2>
      <div className="text-xs mb-2 opacity-70">This simulates AO3 workskin rendering (#workskin scope).</div>
      <div className="border rounded p-2 bg-white overflow-auto" style={{background: dark? '#333':'#fafafa', minHeight: '700px', maxHeight: '90vh'}}>
        <style dangerouslySetInnerHTML={{__html: css}} />
        <div id="workskin" style={{width: mobile? 375: '100%', maxWidth: '100%', transition: 'width .2s', margin: '0 auto', paddingBottom: '100px'}} dangerouslySetInnerHTML={{__html: html}} />
      </div>
    </div>
  );
};
