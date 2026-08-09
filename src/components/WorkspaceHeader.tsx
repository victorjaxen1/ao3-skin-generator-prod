import React, { useState, useRef, useEffect } from 'react';

interface Props {
  contactName: string;
  onContactNameChange: (name: string) => void;
  onBack: () => void;
  onSettingsOpen: () => void;
  /** Google only — see the button below. Do not delete it with the Cast panel. */
  onCharactersOpen: () => void;
  onCastOpen: () => void;
  template: 'ios' | 'android' | 'twitter' | 'google';
  saveStatus: 'saved' | 'unsaved' | 'saving' | 'failed';
  messageCount: number;
  /**
   * What this one field is currently editing, e.g. "Contact name" or "Group
   * name". Passed in rather than derived from `template` here, because on iOS
   * and Android it depends on group mode — and the header cannot see settings.
   */
  fieldLabel?: string;
  fieldPlaceholder?: string;
}

export const WorkspaceHeader: React.FC<Props> = ({
  contactName,
  onContactNameChange,
  onBack,
  onSettingsOpen,
  onCharactersOpen,
  onCastOpen,
  template,
  saveStatus,
  messageCount,
  fieldLabel: fieldLabelProp,
  fieldPlaceholder: fieldPlaceholderProp,
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
    twitter: 'X / Twitter',
    google: 'Google',
  };

  // This one field edits a different setting per platform. Calling it all
  // "contact name" made the Google case read as a person's name when it is
  // the search query, and the Twitter case as a name when it is the handle.
  const fieldLabels: Record<string, string> = {
    ios: 'Contact name',
    android: 'Contact name',
    twitter: 'Display name',
    google: 'Search query',
  };
  const fieldPlaceholders: Record<string, string> = {
    ios: 'Their name, e.g. Steve',
    android: 'Their name, e.g. Steve',
    twitter: 'Their name, e.g. Nat Romanoff',
    google: 'What was searched for',
  };

  // The caller wins where it has more context than we do — on iOS and Android
  // the title edits the GROUP's name when group mode is on, and calling that
  // "contact name" in the aria-label would be wrong.
  const fieldLabel = fieldLabelProp || fieldLabels[template] || 'Name';
  const fieldPlaceholder = fieldPlaceholderProp || fieldPlaceholders[template];
  const displayName = contactName || templateLabels[template] || 'Untitled';

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-stone-200">
      <div className="flex items-center h-12 px-3 max-w-screen-xl mx-auto">
        {/* Back button */}
        <button
          onClick={onBack}
          className="flex items-center justify-center w-8 h-8 rounded-full text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors"
          title="Back to platforms"
          aria-label="Back to platforms"
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
              placeholder={fieldPlaceholder}
              aria-label={fieldLabel}
            />
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1.5 text-sm font-semibold text-stone-900 hover:text-violet-700 transition-colors truncate max-w-[200px]"
              title={`Tap to edit ${fieldLabel.toLowerCase()}`}
              aria-label={`Edit ${fieldLabel.toLowerCase()}, currently ${displayName}`}
            >
              <span className="truncate">{displayName}</span>
              {saveStatus === 'unsaved' && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
              )}
              {saveStatus === 'saving' && (
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse flex-shrink-0" />
              )}
              {saveStatus === 'failed' && (
                <span
                  className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0"
                  title="Not saved"
                />
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
          {/* One button, two destinations, chosen by the only platform that has
              no people in it. Google has no cast — but the Character Library is
              legitimately useful there ("Set as contact" fills the search query
              with a character's name), so hiding the button would strand the
              feature rather than tidy it away. */}
          <button
            onClick={template === 'google' ? onCharactersOpen : onCastOpen}
            className="flex items-center justify-center w-8 h-8 rounded-full text-stone-500 hover:text-violet-700 hover:bg-violet-50 transition-colors"
            title={template === 'google' ? 'Characters' : 'People in this conversation'}
            aria-label={template === 'google' ? 'Open character library' : 'Open people'}
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
            aria-label="Open settings"
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
