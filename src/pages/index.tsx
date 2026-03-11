import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { defaultProject, SkinProject, UniversalCharacter, Message } from '../lib/schema';
import { loadStoredProject, persistProject } from '../lib/storage';
import { TEMPLATE_EXAMPLES } from '../lib/examples';
import { AboutSection } from '../components/AboutSection';
import { CharacterLibrary } from '../components/CharacterLibrary';
import { recordExport, recordPromptShown } from '../lib/donationPrompt';

// Lazy load heavy components with loading states
const EditorForm = dynamic(() => import('../components/EditorForm').then(mod => ({ default: mod.EditorForm })), {
  ssr: false,
  loading: () => (
    <div className="h-64 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
        <p className="text-gray-500 text-sm">Loading editor...</p>
      </div>
    </div>
  )
});

const ExportPanel = dynamic(() => import('../components/ExportPanel').then(mod => ({ default: mod.ExportPanel })), {
  ssr: false,
  loading: () => (
    <div className="h-32 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-green-600 mb-2"></div>
        <p className="text-gray-500 text-sm">Loading export panel...</p>
      </div>
    </div>
  )
});

const SuccessModal = dynamic(() => import('../components/SuccessModal').then(mod => ({ default: mod.SuccessModal })), {
  ssr: false
});

// Disable SSR for PreviewPane to avoid CSS hydration issues
const PreviewPane = dynamic(() => import('../components/PreviewPane').then(mod => ({ default: mod.PreviewPane })), {
  ssr: false,
  loading: () => (
    <div className="h-64 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mb-2"></div>
        <p className="text-gray-500 text-sm">Loading preview...</p>
      </div>
    </div>
  )
});

// PWA Install Prompt - only loads in production
const PWAInstallPrompt = dynamic(() => import('../components/PWAInstallPrompt'), {
  ssr: false
});

// Welcome Modal - only loads client-side
const WelcomeModal = dynamic(() => import('../components/WelcomeModal').then(mod => ({ default: mod.WelcomeModal })), {
  ssr: false
});

export default function HomePage() {
  const router = useRouter();
  
  // Initialize with defaultProject to ensure server and client match on first render
  const [project, setProject] = useState<SkinProject>(defaultProject());
  const [mobile, setMobile] = useState(true);
  const [dark, setDark] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [activeView, setActiveView] = useState<'edit' | 'preview'>('edit');
  const [layout, setLayout] = useState<'tabs' | 'split'>('tabs'); // User can toggle layout preference
  const [saveStatus, setSaveStatus] = useState<'saved' | 'unsaved' | 'saving'>('saved');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successAction, setSuccessAction] = useState<'image' | 'ao3code'>('image');
  
  // Welcome modal state
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  
  // Character library state
  const [universalCharacters, setUniversalCharacters] = useState<UniversalCharacter[]>([]);
  
  // Click-to-edit navigation state
  const [focusedMessageId, setFocusedMessageId] = useState<string | null>(null);
  const [focusTrigger, setFocusTrigger] = useState(0); // Counter to force re-trigger even for same message
  const [editModeEnabled, setEditModeEnabled] = useState(true); // Enable by default for convenience
  
  // Scroll position memory for mobile tabs
  const [editScrollPos, setEditScrollPos] = useState(0);
  const [previewScrollPos, setPreviewScrollPos] = useState(0);
  
  // Undo/Redo history
  const [history, setHistory] = useState<SkinProject[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const maxHistory = 50;

  // Check if user has seen welcome modal
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hasSeenWelcome = localStorage.getItem('ao3skin_welcome_seen');
      if (!hasSeenWelcome && !router.query.template) {
        // Small delay to avoid flash
        setTimeout(() => setShowWelcomeModal(true), 500);
      }
      
      // Load universal characters from localStorage
      const storedChars = localStorage.getItem('ao3skin_universal_characters');
      if (storedChars) {
        try {
          const parsed = JSON.parse(storedChars);
          setUniversalCharacters(parsed);
        } catch (err) {
          console.error('Failed to parse stored characters:', err);
        }
      }
    }
  }, [router.query.template]);

  // Load from storage or URL template parameter
  useEffect(() => {
    // Wait for router to be ready
    if (!router.isReady) return;
    
    console.log('=== TEMPLATE LOADING DEBUG ===');
    console.log('Full URL:', typeof window !== 'undefined' ? window.location.href : 'SSR');
    console.log('Router ready:', router.isReady);
    console.log('Router query object:', JSON.stringify(router.query));
    
    let initialProject: SkinProject = defaultProject();
    let loadedFromTemplate = false;
    
    // Check for template ID in URL parameters - try both router.query and URLSearchParams
    let templateId = router.query.template as string;
    
    // Fallback: read directly from window.location if router.query is empty
    if (!templateId && typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      templateId = urlParams.get('template') || '';
      console.log('Fallback URLSearchParams template:', templateId);
    }
    
    console.log('Final Template ID:', templateId);
    
    if (templateId) {
      // Search for template in examples
      const allExamples = Object.values(TEMPLATE_EXAMPLES).flat();
      console.log('Searching through', allExamples.length, 'templates for ID:', templateId);
      const foundTemplate = allExamples.find(ex => ex.id === templateId);
      
      if (foundTemplate) {
        initialProject = foundTemplate;
        loadedFromTemplate = true;
        console.log('✅ SUCCESS: Loaded template:', templateId);
        console.log('Template data:', {
          id: foundTemplate.id,
          template: foundTemplate.template,
          messageCount: foundTemplate.messages?.length
        });
        
        // Track template load event in Google Analytics
        if (typeof window !== 'undefined' && (window as any).gtag) {
          (window as any).gtag('event', 'template_load', {
            event_category: 'Templates',
            event_label: templateId,
            template_type: foundTemplate.template,
            message_count: foundTemplate.messages?.length || 0
          });
        }
      } else {
        console.error('❌ ERROR: Template not found:', templateId);
        console.log('Available template IDs:', allExamples.map(ex => ex.id));
      }
    } else {
      console.log('No template parameter - loading from storage or using default');
      // Load from storage if no template specified
      initialProject = loadStoredProject(defaultProject);
    }
    
    console.log('Setting project with template type:', initialProject.template);
    console.log('=== END DEBUG ===\n');
    
    setProject(initialProject);
    setHistory([initialProject]);
    setHistoryIndex(0);
    setIsLoaded(true);
    
    // Check for view parameter (e.g., ?view=export to show code immediately)
    const viewParam = router.query.view as string;
    if (viewParam === 'export') {
      setShowCodeModal(true);
    }
    
    // Auto-detect desktop and switch to split view
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      setLayout('split');
    }
  }, [router.isReady, router.query]);

  // Persist changes, but only after we've loaded the initial state
  useEffect(() => { 
    if (isLoaded) {
      setSaveStatus('saving');
      const timer = setTimeout(() => {
        persistProject(project);
        setSaveStatus('saved');
        
        // Add to history (only if different from current history position)
        if (historyIndex === -1 || JSON.stringify(project) !== JSON.stringify(history[historyIndex])) {
          const newHistory = history.slice(0, historyIndex + 1);
          newHistory.push(project);
          if (newHistory.length > maxHistory) {
            newHistory.shift();
          } else {
            setHistoryIndex(historyIndex + 1);
          }
          setHistory(newHistory);
        }
      }, 500); // Debounce 500ms
      return () => clearTimeout(timer);
    }
  }, [project, isLoaded]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + S: Prevent default save, manually persist
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        persistProject(project);
        console.log('Project saved manually');
      }
      
      // Escape: Close modal
      if (e.key === 'Escape' && showCodeModal) {
        setShowCodeModal(false);
      }
      
      // Ctrl/Cmd + Enter: Switch to preview (simulates "submit/preview")
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && activeView === 'edit') {
        e.preventDefault();
        setActiveView('preview');
      }
      
      // Ctrl/Cmd + Z: Undo
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z' && historyIndex > 0) {
        e.preventDefault();
        const prevIndex = historyIndex - 1;
        setHistoryIndex(prevIndex);
        setProject(history[prevIndex]);
      }
      
      // Ctrl/Cmd + Shift + Z: Redo
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z' && historyIndex < history.length - 1) {
        e.preventDefault();
        const nextIndex = historyIndex + 1;
        setHistoryIndex(nextIndex);
        setProject(history[nextIndex]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [project, showCodeModal, activeView, history, historyIndex]);

  // Handle tab switching with scroll memory (mobile)
  const handleTabSwitch = (newView: 'edit' | 'preview') => {
    // Save current scroll position
    const currentScroll = window.scrollY;
    if (activeView === 'edit') {
      setEditScrollPos(currentScroll);
    } else if (activeView === 'preview') {
      setPreviewScrollPos(currentScroll);
    }
    
    // Switch view
    setActiveView(newView);
  };

  // Handle click-to-edit: click on preview message -> scroll to editor card
  const handleMessageClick = (messageId: string) => {
    // Switch to edit view if in tab mode
    if (layout === 'tabs' && activeView !== 'edit') {
      setActiveView('edit');
    }
    
    // Clear first to ensure state change is detected (for clicking same message twice)
    setFocusedMessageId(null);
    
    // Use requestAnimationFrame to ensure the null state is processed first
    requestAnimationFrame(() => {
      setFocusedMessageId(messageId);
      setFocusTrigger(prev => prev + 1); // Increment to force re-trigger
    });
    
    // Clear focus after animation completes (3 seconds)
    setTimeout(() => {
      setFocusedMessageId(null);
    }, 3500);
  };

  // Restore scroll position after tab switch
  useEffect(() => {
    if (!isLoaded) return;
    
    // Small delay to allow DOM to update
    setTimeout(() => {
      if (activeView === 'edit' && editScrollPos > 0) {
        window.scrollTo({ top: editScrollPos, behavior: 'smooth' });
      } else if (activeView === 'preview' && previewScrollPos > 0) {
        window.scrollTo({ top: previewScrollPos, behavior: 'smooth' });
      }
    }, 100);
  }, [activeView]);

  // Handle welcome modal template selection
  const handleWelcomeTemplateSelect = (template: 'ios' | 'android' | 'twitter' | 'google') => {
    const newProject = defaultProject();
    newProject.template = template;
    setProject(newProject);
    setHistory([newProject]);
    setHistoryIndex(0);
  };

  // Handle welcome modal example loading
  const handleWelcomeExampleLoad = (example: SkinProject) => {
    setProject(example);
    setHistory([example]);
    setHistoryIndex(0);
  };

  // Character library handlers
  const saveCharactersToStorage = (characters: UniversalCharacter[]) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ao3skin_universal_characters', JSON.stringify(characters));
    }
  };

  const handleAddCharacter = (character: UniversalCharacter) => {
    const updated = [...universalCharacters, character];
    setUniversalCharacters(updated);
    saveCharactersToStorage(updated);
  };

  const handleUpdateCharacter = (id: string, updates: Partial<UniversalCharacter>) => {
    const updated = universalCharacters.map(char =>
      char.id === id ? { ...char, ...updates } : char
    );
    setUniversalCharacters(updated);
    saveCharactersToStorage(updated);
  };

  const handleDeleteCharacter = (id: string) => {
    const updated = universalCharacters.filter(char => char.id !== id);
    setUniversalCharacters(updated);
    saveCharactersToStorage(updated);
  };

  // Handle project changes (including template switching)
  const handleProjectChange = (updatedProject: SkinProject) => {
    setProject(updatedProject);
  };

  const handleQuickApplyCharacter = (character: UniversalCharacter) => {
    // Template-specific character application
    switch (project.template) {
      case 'twitter':
        // Add to Twitter character presets if not already there
        const twitterPresets = project.settings.twitterCharacterPresets || [];
        const existingChar = twitterPresets.find(c => 
          c.name === character.name && c.handle === character.twitterHandle
        );
        
        const newTwitterChar = !existingChar ? {
          id: crypto.randomUUID(),
          name: character.name,
          handle: character.twitterHandle || character.name.toLowerCase().replace(/\s+/g, ''),
          avatarUrl: character.avatarUrl || '',
          verified: character.verified || false
        } : null;
        
        // Create new tweet from this character
        const newTweet: Message = {
          id: crypto.randomUUID(),
          sender: character.name,
          twitterHandle: character.twitterHandle || character.name.toLowerCase().replace(/\s+/g, ''),
          avatarUrl: character.avatarUrl,
          verified: character.verified,
          outgoing: false,
          content: '',
          timestamp: new Date().toISOString()
        };
        
        // Update both presets and messages in one call
        setProject({
          ...project,
          settings: {
            ...project.settings,
            twitterCharacterPresets: newTwitterChar 
              ? [...twitterPresets, newTwitterChar]
              : twitterPresets
          },
          messages: [...project.messages, newTweet]
        });
        break;
        
      case 'ios':
      case 'android':
        // Add new message with character as sender
        const newMessage: Message = {
          id: crypto.randomUUID(),
          sender: character.name,
          avatarUrl: character.avatarUrl,
          content: '',
          timestamp: new Date().toISOString(),
          outgoing: false
        };
        
        setProject({
          ...project,
          messages: [...project.messages, newMessage]
        });
        break;
        
      case 'google':
        // For Google template, characters are just stored for reference
        break;
    }
  };

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Welcome Modal */}
      <WelcomeModal
        show={showWelcomeModal}
        onClose={() => setShowWelcomeModal(false)}
        onSelectTemplate={handleWelcomeTemplateSelect}
        onLoadExample={handleWelcomeExampleLoad}
      />

      {/* Header - Clean Material Design */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <a href="https://ao3skingen.wordfokus.com" className="flex items-center gap-2 text-gray-900 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md">
                <span className="text-white text-lg sm:text-xl">✨</span>
              </div>
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-base sm:text-lg font-bold text-gray-900">AO3</span>
                  <span className="text-base sm:text-lg font-bold text-blue-600">SkinGen</span>
                </div>
                <span className="hidden sm:block text-[10px] text-gray-500 -mt-1">Social Media AU Generator</span>
              </div>
            </a>

            {/* Center: Platform Selector */}
            <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg p-1">
              <button
                onClick={() => handleProjectChange({ ...project, template: 'ios' })}
                className={`px-2.5 py-1.5 text-base rounded transition-all ${
                  project.template === 'ios'
                    ? 'bg-gradient-to-br from-blue-500 to-blue-600 shadow-md scale-105'
                    : 'hover:bg-gray-100'
                }`}
                title="iMessage"
              >
                📱
              </button>
              <button
                onClick={() => handleProjectChange({ ...project, template: 'android' })}
                className={`px-2.5 py-1.5 text-base rounded transition-all ${
                  project.template === 'android'
                    ? 'bg-gradient-to-br from-green-500 to-green-600 shadow-md scale-105'
                    : 'hover:bg-gray-100'
                }`}
                title="WhatsApp"
              >
                💬
              </button>
              <button
                onClick={() => handleProjectChange({ ...project, template: 'twitter' })}
                className={`px-2.5 py-1.5 text-base rounded transition-all font-bold ${
                  project.template === 'twitter'
                    ? 'bg-gradient-to-br from-gray-800 to-black text-white shadow-md scale-105'
                    : 'hover:bg-gray-100 text-gray-800'
                }`}
                title="Twitter/X"
              >
                𝕏
              </button>
              <button
                onClick={() => handleProjectChange({ ...project, template: 'google' })}
                className={`px-2.5 py-1.5 text-base rounded transition-all ${
                  project.template === 'google'
                    ? 'bg-gradient-to-br from-blue-500 via-red-500 to-yellow-500 shadow-md scale-105'
                    : 'hover:bg-gray-100'
                }`}
                title="Google Search"
              >
                🔍
              </button>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
              {/* Character Library */}
              <CharacterLibrary
                characters={universalCharacters}
                currentTemplate={project.template}
                onAddCharacter={handleAddCharacter}
                onUpdateCharacter={handleUpdateCharacter}
                onDeleteCharacter={handleDeleteCharacter}
                onQuickApply={handleQuickApplyCharacter}
              />
              
              {/* Auto-save - Subtle */}
              <span className={`hidden sm:inline-flex text-xs px-2 py-1 rounded-full transition-all ${
                saveStatus === 'saving'
                  ? 'text-yellow-600'
                  : saveStatus === 'saved'
                  ? 'text-green-600'
                  : 'text-gray-400'
              }`}>
                {saveStatus === 'saving' ? '●' : saveStatus === 'saved' ? '✓' : '○'}
              </span>
              
              {/* Undo/Redo - More compact */}
              <div className="hidden sm:flex items-center bg-gray-100 rounded-lg">
                <button
                  onClick={() => {
                    if (historyIndex > 0) {
                      const prevIndex = historyIndex - 1;
                      setHistoryIndex(prevIndex);
                      setProject(history[prevIndex]);
                    }
                  }}
                  disabled={historyIndex <= 0}
                  className={`px-2.5 py-1.5 text-sm rounded-l-lg transition-all ${
                    historyIndex > 0
                      ? 'text-gray-700 hover:bg-gray-200'
                      : 'text-gray-300 cursor-not-allowed'
                  }`}
                  title="Undo (Ctrl+Z)"
                >
                  ↶
                </button>
                <div className="w-px h-4 bg-gray-300"></div>
                <button
                  onClick={() => {
                    if (historyIndex < history.length - 1) {
                      const nextIndex = historyIndex + 1;
                      setHistoryIndex(nextIndex);
                      setProject(history[nextIndex]);
                    }
                  }}
                  disabled={historyIndex >= history.length - 1}
                  className={`px-2.5 py-1.5 text-sm rounded-r-lg transition-all ${
                    historyIndex < history.length - 1
                      ? 'text-gray-700 hover:bg-gray-200'
                      : 'text-gray-300 cursor-not-allowed'
                  }`}
                  title="Redo (Ctrl+Shift+Z)"
                >
                  ↷
                </button>
              </div>

              {/* Layout Toggle - Desktop */}
              <button
                onClick={() => setLayout(layout === 'tabs' ? 'split' : 'tabs')}
                className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-all"
                title={layout === 'tabs' ? 'Switch to split view' : 'Switch to tabbed view'}
              >
                {layout === 'tabs' ? '⬌' : '📑'}
              </button>
              
              {/* Ko-fi - Compact pill */}
              <a
                href="https://ko-fi.com/ao3skingen"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white text-xs font-semibold rounded-full shadow-sm hover:shadow transition-all"
              >
                ☕ <span className="hidden md:inline">Support</span>
              </a>
            </div>
          </div>
          
          {/* Mobile View Controls - Show only on mobile */}
          <div className="flex md:hidden items-center justify-center gap-2 mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center bg-gray-100 rounded-full p-1">
              <button
                onClick={() => setMobile(true)}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-all ${
                  mobile ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600'
                }`}
              >
                📱
              </button>
              <button
                onClick={() => setMobile(false)}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-all ${
                  !mobile ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600'
                }`}
              >
                🖥️
              </button>
              <button
                onClick={() => setDark(!dark)}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-all ${
                  dark ? 'bg-gray-800 text-white' : 'text-gray-600'
                }`}
              >
                {dark ? '🌙' : '☀️'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* About Section - Collapsible, below header */}
      <div className="max-w-7xl mx-auto px-4 pt-4">
        <AboutSection />
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4 pb-32 sm:pb-36">
        {layout === 'split' ? (
          /* Split View (Desktop) - Improved layout */
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="bg-gray-50 border-b border-gray-200 px-5 py-3 flex items-center gap-2">
                <span className="text-lg">✏️</span>
                <h2 className="font-semibold text-gray-800">Editor</h2>
              </div>
              <div className="p-5">
                <EditorForm project={project} onChange={setProject} universalCharacters={universalCharacters} focusedMessageId={focusedMessageId} focusTrigger={focusTrigger} />
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden sticky top-20 h-fit max-h-[calc(100vh-6rem)]">
              <div className="bg-gray-50 border-b border-gray-200 px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">👁️</span>
                  <h2 className="font-semibold text-gray-800">Live Preview</h2>
                  {project.messages.length > 0 && (
                    <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-medium">
                      {project.messages.length} messages
                    </span>
                  )}
                </div>
              </div>
              <div className="p-5 overflow-auto max-h-[calc(100vh-10rem)]">
                <PreviewPane 
                  project={project} 
                  mobile={mobile} 
                  dark={dark} 
                  onMessageClick={handleMessageClick}
                  editModeEnabled={editModeEnabled}
                />
              </div>
            </div>
          </div>
        ) : (
          /* Tabbed View (Mobile-First) */
          <>
            {/* Tab Navigation - Pill Style - NOW STICKY */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden mb-0 sticky top-[140px] sm:top-[100px] z-30">
              <div className="flex p-1.5 bg-gray-100 rounded-t-2xl">
                <button
                  onClick={() => handleTabSwitch('edit')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 font-semibold text-sm rounded-xl transition-all ${
                    activeView === 'edit'
                      ? 'bg-white text-gray-900 shadow-md'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <span className="text-base">✏️</span>
                  <span>Editor</span>
                </button>
                <button
                  onClick={() => handleTabSwitch('preview')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 font-semibold text-sm rounded-xl transition-all ${
                    activeView === 'preview'
                      ? 'bg-white text-gray-900 shadow-md'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <span className="text-base">👁️</span>
                  <span>Preview</span>
                  {project.messages.length > 0 && (
                    <span className="bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full font-medium">
                      {project.messages.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Content */}
              <div className="p-4 sm:p-5 min-h-[55vh] sm:min-h-[60vh]">
                {activeView === 'edit' ? (
                  <EditorForm project={project} onChange={setProject} universalCharacters={universalCharacters} focusedMessageId={focusedMessageId} focusTrigger={focusTrigger} />
                ) : (
                  <PreviewPane 
                    project={project} 
                    mobile={mobile} 
                    dark={dark} 
                    onMessageClick={handleMessageClick}
                    editModeEnabled={editModeEnabled}
                  />
                )}
              </div>
            </div>

            {/* Bidirectional Floating Switch Buttons */}
            {activeView === 'edit' && project.messages.length > 0 && (
              <button
                onClick={() => handleTabSwitch('preview')}
                className="lg:hidden fixed bottom-24 left-1/2 -translate-x-1/2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-full shadow-lg transition-all font-medium text-sm z-[55] flex items-center gap-2"
                title="View your creation"
              >
                <span>👁️</span>
                <span>See Preview</span>
              </button>
            )}
            
            {activeView === 'preview' && (
              <button
                onClick={() => handleTabSwitch('edit')}
                className="lg:hidden fixed bottom-24 left-1/2 -translate-x-1/2 bg-gray-800 hover:bg-gray-900 text-white px-5 py-2.5 rounded-full shadow-lg transition-all font-medium text-sm z-[55] flex items-center gap-2"
                title="Back to editor"
              >
                <span>✏️</span>
                <span>Edit Messages</span>
              </button>
            )}
          </>
        )}
      </div>
      
      {/* Sticky Bottom Export Bar */}
      <ExportPanel 
        project={project} 
        showCodeModal={showCodeModal} 
        setShowCodeModal={setShowCodeModal}
        onSuccess={(action) => {
          setSuccessAction(action);
          
          // Use smart donation prompt logic
          const shouldShow = recordExport();
          if (shouldShow) {
            recordPromptShown();
            setShowSuccessModal(true);
          }
        }}
      />
      
      {/* Success Modal */}
      <SuccessModal 
        show={showSuccessModal} 
        onClose={() => setShowSuccessModal(false)}
        actionType={successAction}
      />

      {/* Footer - Clean & Minimal */}
      <footer className="mt-8 pb-32 bg-gray-50 border-t border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
          
          {/* Value Prop Banner */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-2xl shadow-md">
                ✨
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 mb-1">Made by a writer, for writers</h3>
                <p className="text-sm text-gray-600">
                  No coding required. Mobile-tested. 100% free forever.
                </p>
              </div>
              <div className="flex gap-2">
                <a 
                  href="https://ko-fi.com/ao3skingen" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-xl font-semibold text-sm shadow-md hover:shadow-lg transition-all"
                >
                  ☕ Support
                </a>
              </div>
            </div>
          </div>

          {/* Quick Links Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <a href="https://github.com/victorjaxen1/ao3-skin-generator-prod" target="_blank" rel="noopener noreferrer" 
               className="p-4 bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all group">
              <span className="text-2xl block mb-1">📦</span>
              <span className="text-xs text-gray-600 group-hover:text-gray-900 font-medium">GitHub</span>
            </a>
            <a href="https://github.com/victorjaxen1/ao3-skin-generator-prod/issues" target="_blank" rel="noopener noreferrer"
               className="p-4 bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all group">
              <span className="text-2xl block mb-1">🐛</span>
              <span className="text-xs text-gray-600 group-hover:text-gray-900 font-medium">Report Bug</span>
            </a>
            <a href="/terms-of-service.html" target="_blank" rel="noopener noreferrer"
               className="p-4 bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all group">
              <span className="text-2xl block mb-1">📜</span>
              <span className="text-xs text-gray-600 group-hover:text-gray-900 font-medium">Terms</span>
            </a>
            <a href="/privacy-policy.html" target="_blank" rel="noopener noreferrer"
               className="p-4 bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all group">
              <span className="text-2xl block mb-1">🔒</span>
              <span className="text-xs text-gray-600 group-hover:text-gray-900 font-medium">Privacy</span>
            </a>
          </div>

          {/* Disclaimer */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
            <p className="text-xs text-amber-800">
              ⚠️ For <strong>fictional storytelling only</strong>. 
              Creating content to impersonate real people or spread disinformation is prohibited.
            </p>
          </div>

          {/* Copyright */}
          <div className="text-center text-xs text-gray-400">
            © 2025 victorjaxen1 • Open Source • No tracking, no ads
          </div>
        </div>
      </footer>

      {/* PWA Install Prompt */}
      <PWAInstallPrompt />
    </main>
  );
}
