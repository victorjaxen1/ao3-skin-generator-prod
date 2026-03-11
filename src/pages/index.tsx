import React, { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { defaultProject, SkinProject, UniversalCharacter, Message } from '../lib/schema';
import { loadStoredProject, persistProject } from '../lib/storage';
import { TEMPLATE_EXAMPLES } from '../lib/examples';
import { CharacterLibrary } from '../components/CharacterLibrary';
import { recordExport, recordPromptShown } from '../lib/donationPrompt';
import { PlatformPicker } from '../components/PlatformPicker';
import { WorkspaceHeader } from '../components/WorkspaceHeader';
import { SettingsSheet } from '../components/SettingsSheet';
import { ComposeBar } from '../components/ComposeBar';
import { MessageTimeline } from '../components/MessageTimeline';

// Lazy load heavy components
const ExportPanel = dynamic(() => import('../components/ExportPanel').then(mod => ({ default: mod.ExportPanel })), {
  ssr: false,
});
const SuccessModal = dynamic(() => import('../components/SuccessModal').then(mod => ({ default: mod.SuccessModal })), {
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
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successAction, setSuccessAction] = useState<'image' | 'ao3code'>('image');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'unsaved' | 'saving'>('saved');

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
  }, []);

  // ── Mount: load project from storage or URL ─────────────────────────────
  useEffect(() => {
    if (!router.isReady) return;

    let initial: SkinProject = defaultProject();
    let fromTemplate = false;

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
      initial = loadStoredProject(defaultProject);
    }

    setProject(initial);
    setHistory([initial]);
    setHistoryIndex(0);
    setIsLoaded(true);

    // Skip the picker if we loaded real content
    if (fromTemplate || initial.messages.length > 0) {
      setShowPicker(false);
    }

    if (router.query.view === 'export') setShowCodeModal(true);
  }, [router.isReady, router.query]);

  // ── Persist + history ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoaded) return;
    setSaveStatus('saving');
    const timer = setTimeout(() => {
      persistProject(project);
      setSaveStatus('saved');
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
    const p = defaultProject();
    p.template = template;
    // Auto-set appropriate default colors per template
    switch (template) {
      case 'ios':
        p.settings.senderColor = '#007AFF';
        p.settings.receiverColor = '#E9E9EB';
        break;
      case 'android':
        p.settings.senderColor = '#00A884';
        p.settings.receiverColor = '#1F2C34';
        break;
      case 'twitter':
        p.settings.senderColor = '#1d9bf0';
        break;
    }
    setProject(p);
    setHistory([p]);
    setHistoryIndex(0);
    setShowPicker(false);
  }, []);

  const handleLoadExample = useCallback((example: SkinProject) => {
    setProject(example);
    setHistory([example]);
    setHistoryIndex(0);
    setShowPicker(false);
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

  const handleQuickApplyCharacter = useCallback((character: UniversalCharacter) => {
    switch (project.template) {
      case 'twitter': {
        const presets = project.settings.twitterCharacterPresets || [];
        const exists = presets.find(c => c.name === character.name && c.handle === character.twitterHandle);
        const newChar = !exists ? {
          id: crypto.randomUUID(),
          name: character.name,
          handle: character.twitterHandle || character.name.toLowerCase().replace(/\s+/g, ''),
          avatarUrl: character.avatarUrl || '',
          verified: character.verified || false,
        } : null;
        const tweet: Message = {
          id: crypto.randomUUID(), sender: character.name,
          twitterHandle: character.twitterHandle || character.name.toLowerCase().replace(/\s+/g, ''),
          avatarUrl: character.avatarUrl, verified: character.verified,
          outgoing: false, content: '', timestamp: new Date().toISOString(),
        };
        setProject(prev => ({
          ...prev,
          settings: { ...prev.settings, twitterCharacterPresets: newChar ? [...presets, newChar] : presets },
          messages: [...prev.messages, tweet],
        }));
        break;
      }
      case 'ios':
      case 'android': {
        const msg: Message = {
          id: crypto.randomUUID(), sender: character.name,
          avatarUrl: character.avatarUrl, content: '',
          timestamp: new Date().toISOString(), outgoing: false,
        };
        setProject(prev => ({ ...prev, messages: [...prev.messages, msg] }));
        break;
      }
    }
  }, [project.template, project.settings.twitterCharacterPresets]);

  // ── Render ───────────────────────────────────────────────────────────────
  // Derive the contact name from the correct per-template settings field
  const contactNameKey = project.template === 'ios' ? 'iosContactName'
    : project.template === 'android' ? 'androidContactName'
    : project.template === 'twitter' ? 'twitterHandle'
    : 'googleQuery';
  const displayContactName = (project.settings as any)[contactNameKey] || '';

  if (showPicker) {
    return (
      <PlatformPicker
        onSelectPlatform={handleSelectPlatform}
        onLoadExample={handleLoadExample}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen bg-stone-50 font-sans">
      {/* ─── Header ─────────────────────────────────────────────────── */}
      <WorkspaceHeader
        contactName={displayContactName}
        onContactNameChange={(name) => handleUpdateSettings(contactNameKey as any, name)}
        onBack={() => setShowPicker(true)}
        onSettingsOpen={() => setShowSettings(true)}
        onCharactersOpen={() => {/* CharacterLibrary is self-managing below */}}
        template={project.template}
        saveStatus={saveStatus}
        messageCount={project.messages.length}
      />

      {/* ─── Main content ───────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left / mobile-full: compose area */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto px-3 py-2 sm:px-4 sm:py-3">
            <MessageTimeline
              messages={project.messages}
              template={project.template}
              focusedMessageId={focusedMessageId}
              focusTrigger={focusTrigger}
              onUpdateMessage={handleUpdateMessage}
              onDeleteMessage={handleDeleteMessage}
              onDuplicateMessage={handleDuplicateMessage}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
            />
          </div>

          {/* Compose bar */}
          <ComposeBar
            template={project.template}
            settings={project.settings}
            onAddMessage={handleAddMessage}
            twitterCharacters={project.settings.twitterCharacterPresets}
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

      {/* ─── Hidden preview for mobile export capture ───────────────── */}
      <div className="md:hidden fixed -left-[9999px] top-0" aria-hidden="true">
        <PreviewPane
          project={project}
          mobile={true}
          dark={dark}
        />
      </div>

      {/* ─── Character Library (self-managing trigger + panel) ─────── */}
      <div className="fixed bottom-28 right-4 z-30 md:bottom-24">
        <CharacterLibrary
          characters={universalCharacters}
          currentTemplate={project.template}
          onAddCharacter={handleAddCharacter}
          onUpdateCharacter={handleUpdateCharacter}
          onDeleteCharacter={handleDeleteCharacter}
          onQuickApply={handleQuickApplyCharacter}
        />
      </div>

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
        onSuccess={(action) => {
          setSuccessAction(action);
          const shouldShow = recordExport();
          if (shouldShow) { recordPromptShown(); setShowSuccessModal(true); }
        }}
      />

      {/* ─── Success modal ──────────────────────────────────────────── */}
      <SuccessModal
        show={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        actionType={successAction}
      />

      {/* ─── Footer (minimal) ───────────────────────────────────────── */}
      <footer className="bg-stone-100 border-t border-stone-200 px-4 py-3 text-center text-[11px] text-stone-400">
        <span>For fictional storytelling only.</span>
        {' · '}
        <a href="/terms-of-service.html" className="underline hover:text-stone-600">Terms</a>
        {' · '}
        <a href="/privacy-policy.html" className="underline hover:text-stone-600">Privacy</a>
        {' · '}
        <a href="https://ko-fi.com/ao3skingen" target="_blank" rel="noopener noreferrer" className="underline hover:text-stone-600">Support</a>
      </footer>
    </div>
  );
}
