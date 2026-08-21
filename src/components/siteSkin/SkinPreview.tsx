import React, { useEffect, useRef, useState } from 'react';
import {
  PreviewState,
  PREVIEW_STATES,
  SKIN_STYLE_ID,
  mockDocument,
} from '../../lib/siteSkin/mockPage';
import { PreviewMode } from './uiTypes';

interface Props {
  /** The compiled skin — the exact string the user will paste into AO3. */
  css: string;
  state: PreviewState;
  mode: PreviewMode;
  onStateChange: (state: PreviewState) => void;
  onModeChange: (mode: PreviewMode) => void;
}

/**
 * The compiled skin, rendered over an AO3-shaped mock page.
 *
 * **It has to be an iframe.** Site skin CSS targets `body`, `#header` and
 * `#main`. The conversation generator's `PreviewPane` can inject a `<style>`
 * tag straight into this page only because all of its rules are
 * `#workskin`-scoped; doing that here would restyle the application around it.
 *
 * `sandbox="allow-same-origin"` rather than `sandbox=""`. Scripts stay blocked
 * either way — that is the isolation that matters, and the document contains
 * none. What same-origin buys is `contentDocument`, so a colour drag patches
 * one style element's text instead of reloading the frame. With `sandbox=""`
 * every input event rebuilds the document: the preview flickers, and the
 * reading pane jumps back to the top mid-scroll. If the document turns out to
 * be unreachable anyway, the effect below falls back to rewriting `srcdoc`.
 */
export const SkinPreview: React.FC<Props> = ({ css, state, mode, onStateChange, onModeChange }) => {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const cssRef = useRef(css);

  // The first document is rendered as a prop so there is something to show
  // before effects run. Afterwards the frame is driven imperatively, which
  // React leaves alone because this prop never changes.
  const [initialDoc] = useState(() => mockDocument(state, css, { inspect: mode === 'inspect' }));

  // A new preview state is a different page, so it is a genuine reload.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    frame.srcdoc = mockDocument(state, cssRef.current, { inspect: mode === 'inspect' });
  }, [mode, state]);

  // A new theme is the same page with a different stylesheet.
  useEffect(() => {
    cssRef.current = css;
    const frame = frameRef.current;
    if (!frame) return;

    const doc = frame.contentDocument;
    const style = doc?.getElementById(SKIN_STYLE_ID);

    if (style) {
      style.textContent = css;
    } else if (doc === null) {
      // No same-origin access after all. Correct, just less smooth.
      frame.srcdoc = mockDocument(state, css, { inspect: mode === 'inspect' });
    }
    // doc exists but has no style element yet: the frame is mid-load with this
    // css already baked into its srcdoc. Nothing to do.
  }, [css, mode, state]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex flex-shrink-0 flex-wrap items-center gap-2 border-b border-stone-200 bg-white px-3 py-2">
        <div className="flex items-center gap-1 overflow-x-auto" role="tablist" aria-label="Preview page">
          {PREVIEW_STATES.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={state === id}
              onClick={() => onStateChange(id)}
              className={`whitespace-nowrap px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                state === id
                  ? 'bg-stone-800 text-white'
                  : 'text-stone-500 hover:bg-stone-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-pressed={mode === 'inspect'}
          onClick={() => onModeChange(mode === 'inspect' ? 'showcase' : 'inspect')}
          className={`ml-auto whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-medium ${
            mode === 'inspect'
              ? 'border-violet-300 bg-violet-50 text-violet-800'
              : 'border-stone-200 text-stone-600 hover:bg-stone-100'
          }`}
        >
          Inspect components
        </button>
        <span className="hidden text-[11px] text-stone-400 xl:block">
          A mock page — AO3 is not loaded
        </span>
      </div>

      {mode === 'inspect' && (
        <p role="status" className="flex-shrink-0 border-b border-violet-100 bg-violet-50 px-3 py-1.5 text-[11px] text-violet-800">
          Showing open menus and form states
        </p>
      )}

      <iframe
        ref={frameRef}
        title="Site skin preview"
        srcDoc={initialDoc}
        sandbox="allow-same-origin"
        className="flex-1 w-full border-0 bg-white min-h-0"
      />
    </div>
  );
};

export default SkinPreview;
