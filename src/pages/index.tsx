import React, { useEffect, useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { defaultProject, SkinProject, UniversalCharacter, Message } from '../lib/schema';
import { loadStoredProject, persistProject, hasStoredProject } from '../lib/storage';
import { PLATFORM_LOOK } from '../lib/generator';
import { TEMPLATE_EXAMPLES } from '../lib/examples';
import { CharacterLibrary } from '../components/CharacterLibrary';
import { PlatformPicker } from '../components/PlatformPicker';
import { WorkspaceHeader } from '../components/WorkspaceHeader';
import { SettingsSheet } from '../components/SettingsSheet';
import { CastPanel } from '../components/CastPanel';
import { ComposeBar } from '../components/ComposeBar';
import { MessageTimeline } from '../components/MessageTimeline';

// Lazy load heavy components
const ExportPanel = dynamic(() => import('../components/ExportPanel').then(mod => ({ default: mod.ExportPanel })), {
  ssr: false,
});
const PreviewPane = dynamic(() => import('../components/PreviewPane').then(mod => ({ default: mod.PreviewPane })), {
  ssr: false,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getDarkMode(project: SkinProject): boolean {
  switch (project.template) {
    case 'ios': return !!project.settings.iosDarkMode;
    case 'android': return !!project.settings.androidDarkMode;
    case 'twitter': return !!project.settings.twitterDarkMode;
    default: return false;
  }
}

export default function HomePage() {
  const router = useRouter();

  // ── Core state ──────────────────────────────────────────────────────────
  const [project, setProject] = useState<SkinProject>(defaultProject());
  const [isLoaded, setIsLoaded] = useState(false);
  const [showPicker, setShowPicker] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'unsaved' | 'saving' | 'failed'>('saved');
  const [saveError, setSaveError] = useState('');
  const [showCharacters, setShowCharacters] = useState(false);
  const [showCast, setShowCast] = useState(false);
  const [showMobilePreview, setShowMobilePreview] = useState(true);
  // True when the picker was reached from the workspace, i.e. there is work
  // a selection would discard. On a first visit there is nothing to lose.
  const [cameFromWorkspace, setCameFromWorkspace] = useState(false);

  // Characters
  const [universalCharacters, setUniversalCharacters] = useState<UniversalCharacter[]>([]);

  // Focus / click-to-edit
  const [focusedMessageId, setFocusedMessageId] = useState<string | null>(null);
  const [focusTrigger, setFocusTrigger] = useState(0);

  // Undo / redo
  const [history, setHistory] = useState<SkinProject[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const maxHistory = 50;

  // Derived
  const dark = getDarkMode(project);

  // ── Mount: load characters ──────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('ao3skin_universal_characters');
    if (stored) {
      try { setUniversalCharacters(JSON.parse(stored)); } catch { /* ignore */ }
    }
    // Remember whether the mobile preview was collapsed.
    if (localStorage.getItem('ao3skin_mobile_preview') === 'collapsed') {
      setShowMobilePreview(false);
    }
  }, []);

  // Keep the newest message in view as it's added, or the preview stops being
  // a feedback loop — you type and your message lands below the fold.
  const mobilePreviewRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = mobilePreviewRef.current;
    if (!root || !showMobilePreview) return;
    // PreviewPane scrolls in its own inner container, so find whichever
    // element actually overflows rather than assuming it's the wrapper.
    const scroller =
      [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))].find(
        el => el.scrollHeight > el.clientHeight + 1
      ) ?? root;
    scroller.scrollTop = scroller.scrollHeight;
  }, [project.messages.length, showMobilePreview]);

  const toggleMobilePreview = useCallback(() => {
    setShowMobilePreview(prev => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('ao3skin_mobile_preview', next ? 'expanded' : 'collapsed');
      }
      return next;
    });
  }, []);

  // ── Mount: load project from storage or URL ─────────────────────────────
  useEffect(() => {
    if (!router.isReady) return;

    let initial: SkinProject = defaultProject();
    let fromTemplate = false;
    let returning = false;

    // Check URL for template param
    let templateId = router.query.template as string;
    if (!templateId && typeof window !== 'undefined') {
      templateId = new URLSearchParams(window.location.search).get('template') || '';
    }

    if (templateId) {
      const all = Object.values(TEMPLATE_EXAMPLES).flat();
      const found = all.find(ex => ex.id === templateId);
      if (found) { initial = found; fromTemplate = true; }
    } else {
      returning = hasStoredProject();
      initial = loadStoredProject(defaultProject);
    }

    setProject(initial);
    setHistory([initial]);
    setHistoryIndex(0);
    setIsLoaded(true);

    // Skip the picker only for a template link or genuinely saved work.
    // defaultProject() ships with seed messages, so a length check alone would
    // hide the picker from every first-time visitor.
    if (fromTemplate || (returning && initial.messages.length > 0)) {
      setShowPicker(false);
    }

    if (router.query.view === 'export') setShowCodeModal(true);
  }, [router.isReady, router.query]);

  // ── Persist + history ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoaded) return;
    setSaveStatus('saving');
    const timer = setTimeout(() => {
      const result = persistProject(project);
      setSaveStatus(result.ok ? 'saved' : 'failed');
      setSaveError(result.ok ? '' : result.message || '');
      if (historyIndex === -1 || JSON.stringify(project) !== JSON.stringify(history[historyIndex])) {
        const next = history.slice(0, historyIndex + 1);
        next.push(project);
        if (next.length > maxHistory) next.shift();
        else setHistoryIndex(historyIndex + 1);
        setHistory(next);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [project, isLoaded]);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        persistProject(project);
      }
      if (e.key === 'Escape' && showCodeModal) setShowCodeModal(false);
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z' && historyIndex > 0) {
        e.preventDefault();
        setHistoryIndex(historyIndex - 1);
        setProject(history[historyIndex - 1]);
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z' && historyIndex < history.length - 1) {
        e.preventDefault();
        setHistoryIndex(historyIndex + 1);
        setProject(history[historyIndex + 1]);
      }
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [project, showCodeModal, history, historyIndex]);

  // ── Handlers ────────────────────────────────────────────────────────────
  const handleSelectPlatform = useCallback((template: 'ios' | 'android' | 'twitter' | 'google') => {
    // Each platform opens wearing its own look, from the one table that holds
    // those values — `PLATFORM_LOOK` in generator.ts, which the master skin uses
    // for the same purpose.
    //
    // This switch used to be a third opinion on the subject, and a wrong one:
    // WhatsApp was `#00A884` on `#1F2C34`, its **dark-theme** colours, applied
    // to a light card — so picking WhatsApp gave a teal bubble on white while
    // the WhatsApp examples used `#dcf8c6` green. One table, one answer.
    const p = defaultProject();
    p.template = template;
    Object.assign(p.settings, PLATFORM_LOOK[template]);
    setProject(p);
    setHistory([p]);
    setHistoryIndex(0);
    setShowPicker(false);
    setCameFromWorkspace(false);
  }, []);

  const handleLoadExample = useCallback((example: SkinProject) => {
    setProject(example);
    setHistory([example]);
    setHistoryIndex(0);
    setShowPicker(false);
    setCameFromWorkspace(false);
  }, []);

  const handleMessageClick = useCallback((messageId: string) => {
    setFocusedMessageId(null);
    requestAnimationFrame(() => {
      setFocusedMessageId(messageId);
      setFocusTrigger(prev => prev + 1);
    });
    setTimeout(() => setFocusedMessageId(null), 3500);
  }, []);

  const MAX_MESSAGES = 100;

  const handleAddMessage = useCallback((msg: Message) => {
    setProject(prev => {
      if (prev.messages.length >= MAX_MESSAGES) return prev;
      return { ...prev, messages: [...prev.messages, msg] };
    });
  }, []);

  const handleUpdateMessage = useCallback((id: string, updates: Partial<Message>) => {
    setProject(prev => ({
      ...prev,
      messages: prev.messages.map(m => m.id === id ? { ...m, ...updates } : m),
    }));
  }, []);

  const handleDeleteMessage = useCallback((id: string) => {
    setProject(prev => ({
      ...prev,
      messages: prev.messages.filter(m => m.id !== id),
    }));
  }, []);

  const handleDuplicateMessage = useCallback((msg: Message) => {
    setProject(prev => {
      const idx = prev.messages.findIndex(m => m.id === msg.id);
      const clone = { ...msg, id: crypto.randomUUID() };
      const msgs = [...prev.messages];
      msgs.splice(idx + 1, 0, clone);
      return { ...prev, messages: msgs };
    });
  }, []);

  const handleMoveUp = useCallback((index: number) => {
    if (index <= 0) return;
    setProject(prev => {
      const msgs = [...prev.messages];
      [msgs[index - 1], msgs[index]] = [msgs[index], msgs[index - 1]];
      return { ...prev, messages: msgs };
    });
  }, []);

  const handleMoveDown = useCallback((index: number) => {
    setProject(prev => {
      if (index >= prev.messages.length - 1) return prev;
      const msgs = [...prev.messages];
      [msgs[index], msgs[index + 1]] = [msgs[index + 1], msgs[index]];
      return { ...prev, messages: msgs };
    });
  }, []);

  const handleUpdateSettings = useCallback(<K extends keyof typeof project.settings>(key: K, value: typeof project.settings[K]) => {
    setProject(prev => ({ ...prev, settings: { ...prev.settings, [key]: value } }));
  }, []);

  // ── Character handlers ──────────────────────────────────────────────────
  const saveChars = (chars: UniversalCharacter[]) => {
    if (typeof window !== 'undefined') localStorage.setItem('ao3skin_universal_characters', JSON.stringify(chars));
  };
  const handleAddCharacter = (c: UniversalCharacter) => {
    const u = [...universalCharacters, c]; setUniversalCharacters(u); saveChars(u);
  };
  const handleUpdateCharacter = (id: string, updates: Partial<UniversalCharacter>) => {
    const u = universalCharacters.map(c => c.id === id ? { ...c, ...updates } : c);
    setUniversalCharacters(u); saveChars(u);
  };
  const handleDeleteCharacter = (id: string) => {
    const u = universalCharacters.filter(c => c.id !== id);
    setUniversalCharacters(u); saveChars(u);
  };

  /**
   * Renaming the other person rewrites the messages they have already sent.
   *
   * Their name is stamped onto each incoming message at send time (ComposeBar),
   * and it is what a reader sees with the skin off or in a downloaded ebook.
   * Changing the setting alone would leave every existing bubble labelled with
   * the old name — the header would say Steve and the work would still read
   * "Bucky: …".
   *
   * Only *untouched* messages are rewritten. Anything explicitly assigned to a
   * group participant belongs to that participant, and anything already bearing
   * a different name was deliberately set to it.
   */
  const handleRenameContact = useCallback((name: string) => {
    setProject(prev => {
      const key = prev.template === 'ios' ? 'iosContactName' : 'androidContactName';
      const previous =
        (prev.settings as any)[key] || prev.settings.chatContactName || 'Them';
      return {
        ...prev,
        settings: { ...prev.settings, [key]: name },
        messages: prev.messages.map(m =>
          !m.outgoing && !m.participantId && (!m.sender || m.sender === previous)
            ? { ...m, sender: name }
            : m
        ),
      };
    });
  }, []);

  const handleAddParticipant = useCallback((name: string, avatarUrl: string) => {
    setProject(prev => {
      const field =
        prev.template === 'ios' ? 'iosGroupParticipants' : 'androidGroupParticipants';
      const existing = prev.settings[field] || [];
      const colors = ['#FF5733', '#33A1FF', '#33FF57', '#FF33A1', '#FFC733', '#8B33FF'];
      return {
        ...prev,
        settings: {
          ...prev.settings,
          [field]: [
            ...existing,
            {
              id: `p-${Date.now()}`,
              name,
              color: colors[existing.length % colors.length],
              ...(avatarUrl ? { avatarUrl } : {}),
            },
          ],
        },
      };
    });
  }, []);

  const handleSetAsContact = useCallback((name: string, avatarUrl: string) => {
    // In group mode the contact name is rendered nowhere and the avatar field is
    // THE GROUP'S photo, not a person's (generator.ts, the iOS/Android header
    // blocks). Writing them here would set a name nothing shows and replace the
    // group picture with one member's face — so a group chat adds a participant
    // instead, which is what "use this character" means there.
    const isGroup =
      (project.template === 'ios' && project.settings.iosGroupMode) ||
      (project.template === 'android' && project.settings.androidGroupMode);
    if (isGroup && (project.template === 'ios' || project.template === 'android')) {
      handleAddParticipant(name, avatarUrl);
      return;
    }

    switch (project.template) {
      case 'ios':
        handleRenameContact(name);
        handleUpdateSettings('iosAvatarUrl', avatarUrl);
        break;
      case 'android':
        handleRenameContact(name);
        handleUpdateSettings('androidAvatarUrl', avatarUrl);
        break;
      case 'twitter':
        handleUpdateSettings('twitterDisplayName', name);
        handleUpdateSettings('twitterAvatarUrl', avatarUrl);
        break;
      case 'google':
        handleUpdateSettings('googleQuery', name);
        break;
    }
  }, [
    project.template,
    project.settings.iosGroupMode,
    project.settings.androidGroupMode,
    handleUpdateSettings,
    handleRenameContact,
    handleAddParticipant,
  ]);

  // The compose bar's "posting as" list. Template presets were previously the
  // only source, so the feature existed only if you happened to load one of
  // three starter templates — the Character Library writes somewhere else
  // entirely. Both feed it now.
  const twitterCharacters = React.useMemo(() => {
    const presets = project.settings.twitterCharacterPresets || [];
    const fromLibrary = universalCharacters
      .filter(c => !presets.some(p => p.name === c.name))
      .map(c => ({
        id: c.id,
        name: c.name,
        handle: (c.twitterHandle || c.name.toLowerCase().replace(/\s+/g, '')).replace(/^@/, ''),
        avatarUrl: c.avatarUrl,
        verified: c.verified,
      }));
    return [...presets, ...fromLibrary];
  }, [project.settings.twitterCharacterPresets, universalCharacters]);

  // ── Render ───────────────────────────────────────────────────────────────
  // Derive the contact name from the correct per-template settings field
  // The header title edits one field per template — the one that names the
  // thing on screen. Twitter uses the display name rather than the handle:
  // the handle is still in Settings, and a tweet leads with the name.
  //
  // In group mode the header renders the GROUP's name, not the contact's — so
  // this used to edit a field nothing on screen was showing. Turn group chat on
  // and the title control silently stopped matching the preview.
  const isGroupChat =
    (project.template === 'ios' && !!project.settings.iosGroupMode) ||
    (project.template === 'android' && !!project.settings.androidGroupMode);

  const contactNameKey =
    project.template === 'ios'
      ? (project.settings.iosGroupMode ? 'iosGroupName' : 'iosContactName')
      : project.template === 'android'
      ? (project.settings.androidGroupMode ? 'androidGroupName' : 'androidContactName')
      : project.template === 'twitter' ? 'twitterDisplayName'
      : 'googleQuery';
  const displayContactName = (project.settings as any)[contactNameKey] || '';

  // The header can't see settings, so the label that describes what the title
  // is currently editing has to be computed here.
  const headerFieldLabel = isGroupChat
    ? 'Group name'
    : project.template === 'ios' || project.template === 'android'
    ? 'Contact name'
    : project.template === 'twitter' ? 'Display name'
    : 'Search query';
  const headerFieldPlaceholder = isGroupChat
    ? (project.template === 'ios' ? 'Family Chat' : 'Work Team')
    : undefined;

  // Hold the first paint until storage has been read, so returning visitors
  // don't see the picker flash past before it's dismissed.
  if (!isLoaded) {
    return <div className="min-h-screen bg-stone-50" aria-busy="true" />;
  }

  if (showPicker) {
    return (
      <PlatformPicker
        onSelectPlatform={handleSelectPlatform}
        onLoadExample={handleLoadExample}
        hasWorkInProgress={cameFromWorkspace && project.messages.length > 0}
        onCancel={() => { setCameFromWorkspace(false); setShowPicker(false); }}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen bg-stone-50 font-sans">
      {/* ─── Header ─────────────────────────────────────────────────── */}
      <WorkspaceHeader
        contactName={displayContactName}
        onContactNameChange={(name) =>
          // Only the 1-on-1 chat case rewrites existing messages. A group name
          // labels nobody, and Twitter/Google are plain settings writes.
          (project.template === 'ios' || project.template === 'android') && !isGroupChat
            ? handleRenameContact(name)
            : handleUpdateSettings(contactNameKey as any, name)
        }
        onBack={() => { setCameFromWorkspace(true); setShowPicker(true); }}
        onSettingsOpen={() => setShowSettings(true)}
        onCharactersOpen={() => setShowCharacters(true)}
        onCastOpen={() => setShowCast(true)}
        template={project.template}
        saveStatus={saveStatus}
        messageCount={project.messages.length}
        fieldLabel={headerFieldLabel}
        fieldPlaceholder={headerFieldPlaceholder}
      />

      {/* A refused save means this work disappears on reload, so it is worth
          interrupting for rather than logging to a console nobody opens. */}
      {saveStatus === 'failed' && saveError && (
        <div role="alert" className="bg-amber-50 border-b border-amber-200 px-4 py-2">
          <p className="text-xs text-amber-900 max-w-screen-xl mx-auto">{saveError}</p>
        </div>
      )}

      {/* ─── Main content ───────────────────────────────────────────── */}
      {/* Bottom padding reserves room for the fixed export bar, which would
          otherwise cover the compose input. ExportPanel publishes its own
          measured height as --export-bar-h. */}
      <div
        className="flex-1 flex overflow-hidden"
        style={{ paddingBottom: 'var(--export-bar-h, 0px)' }}
      >
        {/* Left / mobile-full: compose area */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto px-3 py-2 sm:px-4 sm:py-3 pb-4">
            <MessageTimeline
              messages={project.messages}
              template={project.template}
              settings={project.settings}
              focusedMessageId={focusedMessageId}
              focusTrigger={focusTrigger}
              onUpdateMessage={handleUpdateMessage}
              onDeleteMessage={handleDeleteMessage}
              onDuplicateMessage={handleDuplicateMessage}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
            />
          </div>

          {/* ─── Mobile live preview (desktop uses the column on the right) ── */}
          <div className="md:hidden flex flex-col flex-shrink-0 border-t border-stone-200 bg-white">
            <button
              type="button"
              onClick={toggleMobilePreview}
              aria-expanded={showMobilePreview}
              aria-controls="mobile-preview-body"
              className="flex items-center justify-between px-4 py-2 text-left"
            >
              <span className="text-xs font-medium text-stone-500 uppercase tracking-wide">
                Preview
              </span>
              <span className="flex items-center gap-2">
                {project.messages.length > 0 && (
                  <span className="text-xs text-violet-600 font-medium">
                    {project.messages.length} messages
                  </span>
                )}
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`text-stone-400 transition-transform ${showMobilePreview ? '' : 'rotate-180'}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </span>
            </button>

            {showMobilePreview && (
              <div
                id="mobile-preview-body"
                ref={mobilePreviewRef}
                className="h-[38vh] min-h-[160px] overflow-y-auto border-t border-stone-100"
              >
                <PreviewPane
                  project={project}
                  mobile={true}
                  dark={dark}
                  onMessageClick={handleMessageClick}
                  editModeEnabled={true}
                />
              </div>
            )}
          </div>

          {/* Compose bar */}
          <ComposeBar
            template={project.template}
            settings={project.settings}
            onAddMessage={handleAddMessage}
            twitterCharacters={twitterCharacters}
          />
        </div>

        {/* Right: preview (desktop only, ≥768px) */}
        <div className="hidden md:flex flex-col w-[420px] border-l border-stone-200 bg-white">
          <div className="flex items-center justify-between px-4 py-2 border-b border-stone-100">
            <span className="text-xs font-medium text-stone-500 uppercase tracking-wide">Preview</span>
            {project.messages.length > 0 && (
              <span className="text-xs text-violet-600 font-medium">
                {project.messages.length} messages
              </span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <PreviewPane
              project={project}
              mobile={true}
              dark={dark}
              onMessageClick={handleMessageClick}
              editModeEnabled={true}
            />
          </div>
        </div>
      </div>

      {/* ─── Hidden preview for mobile export capture ───────────────────
          Only needed when the visible mobile preview is collapsed — export
          measures #workskin, and rendering both would duplicate the work. */}
      {!showMobilePreview && (
        <div className="md:hidden fixed -left-[9999px] top-0" aria-hidden="true">
          <PreviewPane
            project={project}
            mobile={true}
            dark={dark}
          />
        </div>
      )}

      {/* ─── Character Library ────────────────────────────────────── */}
      <CharacterLibrary
        isOpen={showCharacters}
        onClose={() => setShowCharacters(false)}
        characters={universalCharacters}
        currentTemplate={project.template}
        onAddCharacter={handleAddCharacter}
        onUpdateCharacter={handleUpdateCharacter}
        onDeleteCharacter={handleDeleteCharacter}
        onSetAsContact={handleSetAsContact}
      />

      {/* ─── People / Cast panel ────────────────────────────────────── */}
      {/* Google never opens this — its header button still goes to the
          Character Library, which is the only place that feature is reachable
          from and is genuinely useful there. */}
      <CastPanel
        isOpen={showCast}
        onClose={() => setShowCast(false)}
        template={project.template}
        settings={project.settings}
        onUpdateSettings={handleUpdateSettings}
        onRenameContact={handleRenameContact}
        universalCharacters={universalCharacters}
        onOpenCharacterLibrary={() => { setShowCast(false); setShowCharacters(true); }}
      />

      {/* ─── Settings sheet ─────────────────────────────────────────── */}
      <SettingsSheet
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        template={project.template}
        settings={project.settings}
        onUpdateSettings={handleUpdateSettings}
      />

      {/* ─── Export bar (sticky bottom) ─────────────────────────────── */}
      <ExportPanel
        project={project}
        showCodeModal={showCodeModal}
        setShowCodeModal={setShowCodeModal}
      />

    </div>
  );
}
