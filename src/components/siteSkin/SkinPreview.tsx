import React, { useEffect, useRef, useState } from 'react';
import {
  PreviewState,
  PREVIEW_STATES,
  SKIN_STYLE_ID,
  mockDocument,
} from '../../lib/siteSkin/mockPage';

interface Props {
  /** The compiled skin — the exact string the user will paste into AO3. */
  css: string;
  state: PreviewState;
  onStateChange: (state: PreviewState) => void;
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
export const SkinPreview: React.FC<Props> = ({ css, state, onStateChange }) => {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const cssRef = useRef(css);

  // The first document is rendered as a prop so there is something to show
  // before effects run. Afterwards the frame is driven imperatively, which
  // React leaves alone because this prop never changes.
  const [initialDoc] = useState(() => mockDocument(state, css));

  // A new preview state is a different page, so it is a genuine reload.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    frame.srcdoc = mockDocument(state, cssRef.current);
  }, [state]);

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
      frame.srcdoc = mockDocument(state, css);
    }
    // doc exists but has no style element yet: the frame is mid-load with this
    // css already baked into its srcdoc. Nothing to do.
  }, [css, state]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div
        className="flex items-center gap-1 px-3 py-2 border-b border-stone-200 bg-white flex-shrink-0"
        role="tablist"
        aria-label="Preview page"
      >
        {PREVIEW_STATES.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={state === id}
            onClick={() => onStateChange(id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              state === id
                ? 'bg-stone-800 text-white'
                : 'text-stone-500 hover:bg-stone-100'
            }`}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-stone-400 hidden sm:block">
          A mock page — AO3 is not loaded
        </span>
      </div>

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
