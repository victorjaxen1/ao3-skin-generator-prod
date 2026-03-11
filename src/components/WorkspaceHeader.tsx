import React, { useState, useRef, useEffect } from 'react';

interface Props {
  contactName: string;
  onContactNameChange: (name: string) => void;
  onBack: () => void;
  onSettingsOpen: () => void;
  onCharactersOpen: () => void;
  template: 'ios' | 'android' | 'twitter' | 'google';
  saveStatus: 'saved' | 'unsaved' | 'saving';
  messageCount: number;
}

export const WorkspaceHeader: React.FC<Props> = ({
  contactName,
  onContactNameChange,
  onBack,
  onSettingsOpen,
  onCharactersOpen,
  template,
  saveStatus,
  messageCount,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(contactName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditValue(contactName);
  }, [contactName]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    setIsEditing(false);
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== contactName) {
      onContactNameChange(trimmed);
    } else {
      setEditValue(contactName);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setEditValue(contactName);
      setIsEditing(false);
    }
  };

  const templateLabels: Record<string, string> = {
    ios: 'iMessage',
    android: 'WhatsApp',
    twitter: 'Twitter / X',
    google: 'Google Search',
  };

  const displayName = contactName || templateLabels[template] || 'Untitled';

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-stone-200">
      <div className="flex items-center h-12 px-3 max-w-screen-xl mx-auto">
        {/* Back button */}
        <button
          onClick={onBack}
          className="flex items-center justify-center w-8 h-8 rounded-full text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors"
          title="Back to platforms"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        {/* Center: Editable title */}
        <div className="flex-1 flex items-center justify-center min-w-0 px-2">
          {isEditing ? (
            <input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              className="text-sm font-semibold text-center text-stone-900 bg-stone-100 rounded-lg px-3 py-1 w-full max-w-[200px] border-0 outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="Contact name..."
            />
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1.5 text-sm font-semibold text-stone-900 hover:text-violet-700 transition-colors truncate max-w-[200px]"
              title="Tap to rename"
            >
              <span className="truncate">{displayName}</span>
              {saveStatus === 'unsaved' && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
              )}
              {saveStatus === 'saving' && (
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse flex-shrink-0" />
              )}
            </button>
          )}
          {messageCount > 0 && !isEditing && (
            <span className="ml-2 text-[10px] font-medium text-stone-400 flex-shrink-0">
              {messageCount} msg{messageCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Right: Settings + Characters */}
        <div className="flex items-center gap-1">
          <button
            onClick={onCharactersOpen}
            className="flex items-center justify-center w-8 h-8 rounded-full text-stone-500 hover:text-violet-700 hover:bg-violet-50 transition-colors"
            title="Characters"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </button>
          <button
            onClick={onSettingsOpen}
            className="flex items-center justify-center w-8 h-8 rounded-full text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors"
            title="Settings"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
};

export default WorkspaceHeader;
