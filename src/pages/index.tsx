import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { defaultProject, SkinProject } from '../lib/schema';
import { loadStoredProject, persistProject } from '../lib/storage';
import { TEMPLATE_EXAMPLES } from '../lib/examples';
import { EditorForm } from '../components/EditorForm';
import { ExportPanel } from '../components/ExportPanel';
import { SuccessModal } from '../components/SuccessModal';
import { AboutSection } from '../components/AboutSection';

// Disable SSR for PreviewPane to avoid CSS hydration issues
const PreviewPane = dynamic(() => import('../components/PreviewPane').then(mod => ({ default: mod.PreviewPane })), {
  ssr: false,
  loading: () => <div className="h-full flex items-center justify-center text-gray-500">Loading preview...</div>
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
  const [successAction, setSuccessAction] = useState<'css' | 'html' | 'image'>('css');
  
  // Undo/Redo history
  const [history, setHistory] = useState<SkinProject[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const maxHistory = 50;

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

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header - Matching Landing Page */}
      <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Logo - Matching Landing Page */}
            <a href="https://ao3skingen.wordfokus.com" className="flex items-center gap-2 sm:gap-3 text-gray-900 hover:opacity-80 transition-opacity">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 sm:w-9 sm:h-9">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="12" y1="18" x2="12" y2="12"></line>
                <line x1="9" y1="15" x2="15" y2="15"></line>
              </svg>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">AO3</span>
                <span className="text-lg sm:text-xl md:text-2xl font-bold text-blue-600">Skin Generator</span>
              </div>
            </a>

            {/* Right side - Tools */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Ko-fi Support Button */}
              <a
                href="https://ko-fi.com/ao3skingen"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FF5E5B] hover:bg-[#e54542] text-white text-xs font-semibold rounded-full shadow-sm hover:shadow transition-all transform hover:scale-105"
                title="Support on Ko-fi"
              >
                <span>☕</span>
                <span className="hidden md:inline">Support</span>
              </a>
              
              {/* Auto-save indicator */}
              <span className={`hidden md:inline-flex text-xs px-2 py-1 rounded-full transition-all ${
                saveStatus === 'saving'
                  ? 'bg-yellow-50 text-yellow-700'
                  : saveStatus === 'saved'
                  ? 'bg-green-50 text-green-700'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {saveStatus === 'saving' ? '💾 Saving...' : saveStatus === 'saved' ? '✓ Saved' : 'Unsaved'}
              </span>
              
              {/* Undo/Redo buttons */}
              <div className="hidden sm:flex items-center gap-1">
                <button
                  onClick={() => {
                    if (historyIndex > 0) {
                      const prevIndex = historyIndex - 1;
                      setHistoryIndex(prevIndex);
                      setProject(history[prevIndex]);
                    }
                  }}
                  disabled={historyIndex <= 0}
                  className={`px-2 py-1 text-sm rounded border transition-all ${
                    historyIndex > 0
                      ? 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300 cursor-pointer shadow-sm hover:shadow'
                      : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                  }`}
                  title="Undo (Ctrl+Z)"
                >
                  ↶
                </button>
                <button
                  onClick={() => {
                    if (historyIndex < history.length - 1) {
                      const nextIndex = historyIndex + 1;
                      setHistoryIndex(nextIndex);
                      setProject(history[nextIndex]);
                    }
                  }}
                  disabled={historyIndex >= history.length - 1}
                  className={`px-2 py-1 text-sm rounded border transition ${
                    historyIndex < history.length - 1
                      ? 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300 cursor-pointer'
                      : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                  }`}
                  title="Redo (Ctrl+Shift+Z)"
                >
                  ↷
                </button>
              </div>
            </div>
          </div>
          
          {/* Secondary toolbar row */}
          <div className="flex items-center gap-2 sm:gap-3 mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Layout Toggle (Desktop) */}
              <button
                onClick={() => setLayout(layout === 'tabs' ? 'split' : 'tabs')}
                className="hidden lg:flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-all"
                title={layout === 'tabs' ? 'Switch to split view' : 'Switch to tabbed view'}
              >
                {layout === 'tabs' ? '⬌ Split View' : '📑 Tabs'}
              </button>
              
              {/* Preview Settings */}
              <div className="flex gap-2 text-xs">
                <label className="flex items-center gap-1 cursor-pointer text-gray-700">
                  <input type="checkbox" checked={mobile} onChange={e=>setMobile(e.target.checked)} className="cursor-pointer" /> 
                  📱
                </label>
                <label className="flex items-center gap-1 cursor-pointer text-gray-700">
                  <input type="checkbox" checked={dark} onChange={e=>setDark(e.target.checked)} className="cursor-pointer" /> 
                  🌙
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* About Section - collapsed on mobile */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 pt-3 sm:pt-6">
        <AboutSection />
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4 pb-32 sm:pb-36">
        {layout === 'split' ? (
          /* Split View (Desktop) */
          <div className="grid lg:grid-cols-2 gap-4 lg:gap-6">
            <div className="bg-white border rounded-xl shadow-sm p-3 sm:p-4">
              <EditorForm project={project} onChange={setProject} />
            </div>
            <div className="bg-white border rounded-xl shadow-sm p-3 sm:p-4 sticky top-16 sm:top-20 h-fit max-h-[calc(100vh-5rem)] sm:max-h-[calc(100vh-6rem)] overflow-auto">
              <PreviewPane project={project} mobile={mobile} dark={dark} />
            </div>
          </div>
        ) : (
          /* Tabbed View (Mobile-First) */
          <>
            {/* Tab Navigation */}
            <div className="bg-white border rounded-t-xl shadow-sm overflow-hidden mb-0">
              <div className="flex">
                <button
                  onClick={() => setActiveView('edit')}
                  className={`flex-1 px-4 py-2.5 sm:px-6 sm:py-3 font-heading font-semibold text-sm sm:text-base transition-all ${
                    activeView === 'edit'
                      ? 'bg-primary text-white shadow-material-md'
                      : 'bg-bg-light text-text-gray hover:bg-gray-100'
                  }`}
                >
                  ✏️ Edit
                </button>
                <button
                  onClick={() => setActiveView('preview')}
                  className={`flex-1 px-4 py-2.5 sm:px-6 sm:py-3 font-heading font-semibold text-sm sm:text-base transition-all ${
                    activeView === 'preview'
                      ? 'bg-primary text-white shadow-material-md'
                      : 'bg-bg-light text-text-gray hover:bg-gray-100'
                  }`}
                >
                  👁️ Preview
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="bg-white border border-t-0 rounded-b-xl shadow-sm p-3 sm:p-4 min-h-[50vh] sm:min-h-[60vh]">
              {activeView === 'edit' ? (
                <EditorForm project={project} onChange={setProject} />
              ) : (
                <PreviewPane project={project} mobile={mobile} dark={dark} />
              )}
            </div>

            {/* Floating Quick Preview Button (when editing) */}
            {activeView === 'edit' && (
              <button
                onClick={() => setActiveView('preview')}
                className="fixed bottom-[90px] right-4 sm:bottom-24 sm:right-6 bg-primary hover:bg-primary-dark text-white px-4 py-2.5 sm:px-5 sm:py-3 rounded-full shadow-material-lg hover:shadow-material-lg transition-all font-heading font-semibold text-sm sm:text-base z-[60] transform hover:scale-105"
                title="View your creation"
              >
                👁️ Quick Preview
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
          setShowSuccessModal(true);
        }}
      />
      
      {/* Success Modal */}
      <SuccessModal 
        show={showSuccessModal} 
        onClose={() => setShowSuccessModal(false)}
        actionType={successAction}
      />

      {/* Footer */}
      <footer className="mt-6 pb-32 sm:pb-36 bg-bg-light border-t border-border-light py-6 sm:py-8">
        <div className="max-w-4xl mx-auto px-4 space-y-6">
          {/* Main Message */}
          <div className="text-center">
            <p className="text-sm text-text-dark mb-1 font-heading">
              <strong>Made with ❤️ by a writer, for writers</strong>
            </p>
            <p className="text-xs text-text-gray">
              Because creating social media AUs shouldn't require a CS degree
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a 
              href="https://ko-fi.com/ao3skingen" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-material-sm font-heading font-semibold shadow-material-md hover:shadow-material-lg transition-all transform hover:scale-105"
            >
              <span className="text-lg">☕</span>
              Buy Me a Coffee
            </a>
            <a 
              href="https://workspace.google.com/marketplace/app/wordfokus_free_ui_dark_mode_focus_writer/297087799172?flow_type=2"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-secondary hover:bg-green-700 text-white rounded-material-sm font-heading font-semibold shadow-material-md hover:shadow-material-lg transition-all transform hover:scale-105"
            >
              <span className="text-lg">✍️</span>
              Try WordFokus
              <span className="text-xs bg-white bg-opacity-20 px-2 py-0.5 rounded-full">FREE</span>
            </a>
          </div>

          {/* Links */}
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-text-gray">
            <a href="https://github.com/victorjaxen1/ao3-skin-generator" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
              📦 GitHub
            </a>
            <span className="text-gray-400">•</span>
            <a href="https://github.com/victorjaxen1/ao3-skin-generator/issues" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
              🐛 Report Bug
            </a>
            <span className="text-gray-400">•</span>
            <a href="https://ao3skingen.wordfokus.com/privacy-policy" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
              🔒 Privacy Policy
            </a>
            <span className="text-gray-400">•</span>
            <span>Accessibility-first, media-query-free design for AO3</span>
          </div>

          {/* Credit */}
          <div className="text-center text-xs text-text-gray">
            © 2025 victorjaxen1 • Open Source • No tracking, no ads, no BS
          </div>
        </div>
      </footer>
    </main>
  );
}
