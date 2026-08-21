import React from 'react';
import { EditorSectionId } from './uiTypes';

interface Props {
  id: EditorSectionId;
  title: string;
  summary: React.ReactNode;
  open: boolean;
  modified: boolean;
  onToggle: () => void;
  onReset: () => void;
  children: React.ReactNode;
}

export const EditorSection: React.FC<Props> = ({
  id,
  title,
  summary,
  open,
  modified,
  onToggle,
  onReset,
  children,
}) => {
  const panelId = `site-skin-section-${id}`;

  return (
    <section className="border-b border-stone-200">
      <div className="flex items-center gap-2 py-3">
        <h2 className="min-w-0 flex-1">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={onToggle}
            className="flex w-full min-w-0 items-center gap-2 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          >
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-sm font-semibold text-stone-900">
                {title}
                {modified && (
                  <span className="h-2 w-2 flex-shrink-0 rounded-full bg-violet-500" aria-label="Changed" />
                )}
              </span>
              <span className="mt-0.5 block truncate text-xs font-normal text-stone-500">
                {summary}
              </span>
            </span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className={`flex-shrink-0 text-stone-400 transition-transform ${open ? 'rotate-180' : ''}`}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        </h2>
        {modified && (
          <button
            type="button"
            aria-label={`Reset ${title} section`}
            onClick={onReset}
            className="flex-shrink-0 rounded-lg px-2 py-1 text-[11px] font-medium text-stone-500 hover:bg-stone-100 hover:text-stone-800"
          >
            Reset
          </button>
        )}
      </div>
      {open && (
        <div id={panelId} className="divide-y divide-stone-100 pb-2">
          {children}
        </div>
      )}
    </section>
  );
};

export default EditorSection;
