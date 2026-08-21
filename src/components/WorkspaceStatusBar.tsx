import React from 'react';

interface WorkspaceStatusBarProps {
  saveStatus: 'saved' | 'saving' | 'failed';
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

const STATUS_TEXT: Record<WorkspaceStatusBarProps['saveStatus'], string> = {
  saving: 'Saving…',
  saved: 'Saved in this browser',
  failed: 'Not saved',
};

export const WorkspaceStatusBar: React.FC<WorkspaceStatusBarProps> = ({
  saveStatus,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}) => (
  <div className="flex h-9 flex-none items-center justify-between border-b border-stone-200 bg-stone-100 px-3 text-xs">
    <span aria-live="polite" aria-atomic="true" className={saveStatus === 'failed' ? 'font-medium text-red-700' : 'text-stone-500'}>
      {STATUS_TEXT[saveStatus]}
    </span>
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={onUndo}
        disabled={!canUndo}
        aria-label="Undo project change"
        title="Undo project change (Ctrl/Cmd+Z)"
        className="rounded-md px-2.5 py-1 font-medium text-stone-700 hover:bg-white disabled:cursor-not-allowed disabled:text-stone-400"
      >
        Undo
      </button>
      <button
        type="button"
        onClick={onRedo}
        disabled={!canRedo}
        aria-label="Redo project change"
        title="Redo project change (Ctrl/Cmd+Shift+Z)"
        className="rounded-md px-2.5 py-1 font-medium text-stone-700 hover:bg-white disabled:cursor-not-allowed disabled:text-stone-400"
      >
        Redo
      </button>
    </div>
  </div>
);

export default WorkspaceStatusBar;
