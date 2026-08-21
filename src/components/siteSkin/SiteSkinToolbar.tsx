import React from 'react';
import { MobilePane } from './uiTypes';

interface Props {
  themeName: string;
  violations: number;
  reviewedOn: string;
  saveStatus: 'saved' | 'saving' | 'failed';
  canUndo: boolean;
  canRedo: boolean;
  mobilePane: MobilePane;
  onShowTemplates: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onOpenPrivacy: () => void;
  onInstall: () => void;
  onMobilePaneChange: (pane: MobilePane) => void;
}

const HistoryButtons: React.FC<Pick<Props, 'canUndo' | 'canRedo' | 'onUndo' | 'onRedo'>> = ({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}) => (
  <>
    <button
      type="button"
      onClick={onUndo}
      disabled={!canUndo}
      aria-label="Undo last change"
      title="Undo (Ctrl/Cmd+Z)"
      className="rounded-lg border border-stone-200 px-2.5 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-35"
    >
      Undo
    </button>
    <button
      type="button"
      onClick={onRedo}
      disabled={!canRedo}
      aria-label="Redo last change"
      title="Redo (Ctrl/Cmd+Shift+Z)"
      className="rounded-lg border border-stone-200 px-2.5 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-35"
    >
      Redo
    </button>
  </>
);

export const SiteSkinToolbar: React.FC<Props> = ({
  themeName,
  violations,
  reviewedOn,
  saveStatus,
  canUndo,
  canRedo,
  mobilePane,
  onShowTemplates,
  onUndo,
  onRedo,
  onOpenPrivacy,
  onInstall,
  onMobilePaneChange,
}) => (
  <>
    <header className="flex flex-shrink-0 items-center gap-2 border-b border-stone-200 bg-white px-2 py-2.5 sm:gap-3 sm:px-4">
      <button
        type="button"
        aria-label="Templates"
        onClick={onShowTemplates}
        className="flex items-center gap-1.5 text-sm font-medium text-stone-600 hover:text-stone-900"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        <span className="hidden sm:inline">Templates</span>
      </button>

      <span className="min-w-[4rem] flex-1 truncate text-sm font-semibold text-stone-900 sm:flex-none">
        {themeName}
      </span>

      <span
        role="status"
        aria-label={violations === 0 ? `Checks passed, reviewed ${reviewedOn}` : `${violations} compatibility checks blocked`}
        className={`flex-shrink-0 rounded-full border px-1.5 py-1 text-[11px] font-medium sm:px-2 ${
          violations === 0
            ? 'border-green-200 bg-green-50 text-green-800'
            : 'border-red-200 bg-red-50 text-red-800'
        }`}
      >
        <span aria-hidden="true" className="sm:hidden">{violations === 0 ? '✓' : violations}</span>
        <span className="hidden sm:inline">{violations === 0 ? `Checks passed · ${reviewedOn}` : `${violations} blocked`}</span>
      </span>

      <span className="flex flex-shrink-0 items-center gap-1.5 sm:ml-auto sm:gap-2">
        <span aria-live="polite" className={`sr-only text-[11px] sm:not-sr-only sm:inline ${saveStatus === 'failed' ? 'text-amber-700' : 'text-stone-400'}`}>
          {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'failed' ? 'Could not save' : 'Saved'}
        </span>
        <span className="hidden items-center gap-1 lg:flex">
          <HistoryButtons canUndo={canUndo} canRedo={canRedo} onUndo={onUndo} onRedo={onRedo} />
        </span>
        <button
          type="button"
          aria-label="Privacy choices"
          onClick={onOpenPrivacy}
          className="rounded-xl border border-stone-200 px-2.5 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100 sm:px-3"
        >
          <span aria-hidden="true" className="sm:hidden">⚙</span>
          <span className="hidden sm:inline">Privacy</span>
        </button>
        <button
          type="button"
          onClick={onInstall}
          className="whitespace-nowrap rounded-xl bg-violet-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-700 sm:px-4"
        >
          <span className="sm:hidden">Install</span>
          <span className="hidden sm:inline">Install on AO3</span>
        </button>
      </span>
    </header>

    <div className="flex flex-shrink-0 items-center gap-1 border-b border-stone-200 bg-white px-2 py-2 lg:hidden">
      <div className="grid flex-1 grid-cols-2 rounded-lg bg-stone-100 p-1" role="tablist" aria-label="Editor pane">
        {(['preview', 'customize'] as const).map(pane => (
          <button
            key={pane}
            type="button"
            role="tab"
            aria-selected={mobilePane === pane}
            onClick={() => onMobilePaneChange(pane)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize ${mobilePane === pane ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}
          >
            {pane}
          </button>
        ))}
      </div>
      <span className="contents">
        <HistoryButtons canUndo={canUndo} canRedo={canRedo} onUndo={onUndo} onRedo={onRedo} />
      </span>
    </div>
  </>
);

export default SiteSkinToolbar;
