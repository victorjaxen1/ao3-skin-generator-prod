import React, { useState, useEffect } from 'react';
import { SkinProject, Message, TwitterCharacter, UniversalCharacter } from '../lib/schema';
import { useToast, ToastContainer } from './Toast';
import { 
  loadCachedCharacters, 
  saveCachedCharacters, 
  addCharacterToCache,
  removeCharacterFromCache,
  updateCharacterInCache,
  getCacheStats 
} from '../lib/characterCache';
import { getExampleNames, loadExample } from '../lib/examples';
import { TwitterEditor } from './TwitterEditor';
import { IOSEditor } from './IOSEditor';
import { AndroidEditor } from './AndroidEditor';
import { ConfirmModal } from './ConfirmModal';

// Security limits to prevent abuse
const MAX_MESSAGES = 100;
const MAX_CONTENT_LENGTH = 10000;
const MAX_CHARACTERS = 50;

interface Props { 
  project: SkinProject; 
  onChange: (p: SkinProject) => void; 
  universalCharacters?: UniversalCharacter[];
  focusedMessageId?: string | null;
  focusTrigger?: number;
}

export const EditorForm: React.FC<Props> = ({ project, onChange, universalCharacters = [], focusedMessageId, focusTrigger }) => {
  const { toasts, removeToast, success, error, warning } = useToast();
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  const [whatsappTab, setWhatsappTab] = useState<'phone' | 'messages'>('phone');
  const [whatsappOutgoing, setWhatsappOutgoing] = useState(true);
  const [iosTab, setIosTab] = useState<'phone' | 'messages'>('phone');
  const [iosOutgoing, setIosOutgoing] = useState(true);
  const [twitterTab, setTwitterTab] = useState<'profile' | 'tweets'>('profile');
  const [newTweetImageUrl, setNewTweetImageUrl] = useState('');
  const [openSection, setOpenSection] = useState<string>('');
  
  // Message composer state
  const [newContent, setNewContent] = useState('');
  const [newTimestamp, setNewTimestamp] = useState('');
  const [newReaction, setNewReaction] = useState('');
  
  // Google template: collapsible settings + compose mode
  const [googleSettingsOpen, setGoogleSettingsOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ao3skin_google_settings_open');
      return saved ? saved === 'true' : false; // Default: collapsed
    }
    return false;
  });
  
  const [googleComposeMode, setGoogleComposeMode] = useState<'fast' | 'detailed'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ao3skin_google_compose_mode');
      return (saved as 'fast' | 'detailed') || 'fast'; // Default: Fast Mode
    }
    return 'fast';
  });
  
  // Save Google settings state to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ao3skin_google_settings_open', String(googleSettingsOpen));
    }
  }, [googleSettingsOpen]);
  
  // Save Google compose mode to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ao3skin_google_compose_mode', googleComposeMode);
    }
  }, [googleComposeMode]);
  const [newImageUrl, setNewImageUrl] = useState('');
  
  function update<K extends keyof SkinProject>(key: K, value: SkinProject[K]) {
    // Auto-adjust colors when switching templates
    if (key === 'template') {
      const newSettings = { ...project.settings };
      if (value === 'android') {
        newSettings.senderColor = '#dcf8c6'; // WhatsApp green
        newSettings.receiverColor = '#ffffff';
        newSettings.androidWhatsAppMode = true; // Default to WhatsApp mode
      } else if (value === 'note') {
        newSettings.senderColor = '#4a5568'; // Gray for system messages
      } else if (value === 'twitter') {
        newSettings.senderColor = '#1DA1F2'; // Twitter blue
        newSettings.receiverColor = '#f5f8fa';
        // Auto-generate handle from first message sender if not set
        if (!newSettings.twitterHandle && project.messages.length > 0) {
          const firstSender = project.messages[0].sender;
          newSettings.twitterHandle = firstSender.toLowerCase().replace(/\s+/g, '');
        }
        // Default timestamp format if not set
        if (!newSettings.twitterTimestamp) {
          newSettings.twitterTimestamp = '';
        }
      } else if (value === 'google') {
        newSettings.senderColor = '#4285F4'; // Google blue
        // Auto-populate query from first message if available
        if (!newSettings.googleQuery && project.messages.length > 0) {
          newSettings.googleQuery = project.messages[0].content;
        }
        // Default placeholder if nothing set
        if (!newSettings.googleQuery) {
          newSettings.googleQuery = '';
        }
      } else if (value === 'instagram') {
        newSettings.senderColor = '#E1306C'; // Instagram magenta
        newSettings.receiverColor = '#FDFDFD';
        // Auto-populate username from first message if not set
        if (!newSettings.instagramUsername && project.messages.length > 0) {
          newSettings.instagramUsername = project.messages[0].sender.toLowerCase().replace(/\s+/g, '');
        }
        // Auto-populate caption from first message content if not set
        if (!newSettings.instagramCaption && project.messages.length > 0) {
          newSettings.instagramCaption = project.messages[0].content;
        }
        // Set sensible defaults
        if (!newSettings.instagramTimestamp) {
          newSettings.instagramTimestamp = '2 hours ago';
        }
      } else if (value === 'ios') {
        newSettings.senderColor = '#1d9bf0'; // iOS blue
        newSettings.receiverColor = '#ececec';
      }
      else if (value === 'discord') {
        newSettings.discordChannelName = project.settings.discordChannelName || 'general';
        newSettings.discordShowHeader = project.settings.discordShowHeader !== false;
        newSettings.discordDarkMode = project.settings.discordDarkMode !== false;
      }
      onChange({ ...project, [key]: value, settings: newSettings });
      return;
    }
    onChange({ ...project, [key]: value });
  }
  function updateSettings<K extends keyof SkinProject['settings']>(key: K, value: SkinProject['settings'][K]) {
    update('settings', { ...project.settings, [key]: value });
  }
  function updateMsg(id: string, patch: Partial<Message>) {
    const messages = project.messages.map(m => m.id === id ? { ...m, ...patch } : m);
    update('messages', messages);
  }
  
  function updateCharacter(charId: string, patch: Partial<TwitterCharacter>) {
    const presets = project.settings.twitterCharacterPresets || [];
    const oldChar = presets.find(c => c.id === charId);
    const updatedPresets = presets.map(c => c.id === charId ? { ...c, ...patch } : c);
    
    // Update cache
    updateCharacterInCache(charId, patch);
    
    // Update all tweets that use this character
    const updatedMessages = oldChar ? project.messages.map(msg => {
      // Check if this tweet uses this character (by matching sender name)
      if (msg.useCustomIdentity && msg.sender === oldChar.name) {
        return {
          ...msg,
          sender: patch.name !== undefined ? patch.name : msg.sender,
          twitterHandle: patch.handle !== undefined ? patch.handle : msg.twitterHandle,
          avatarUrl: patch.avatarUrl !== undefined ? patch.avatarUrl : msg.avatarUrl,
          verified: patch.verified !== undefined ? patch.verified : msg.verified,
        };
      }
      return msg;
    }) : project.messages;
    
    // Single atomic update
    onChange({
      ...project,
      settings: {
        ...project.settings,
        twitterCharacterPresets: updatedPresets
      },
      messages: updatedMessages
    });
  }
  
  function deleteCharacter(charId: string) {
    const presets = project.settings.twitterCharacterPresets || [];
    removeCharacterFromCache(charId);
    updateSettings('twitterCharacterPresets', presets.filter(c => c.id !== charId));
  }
  
  // Load cached characters on mount
  useEffect(() => {
    if (project.template === 'twitter') {
      const cached = loadCachedCharacters();
      if (cached.length > 0 && (!project.settings.twitterCharacterPresets || project.settings.twitterCharacterPresets.length === 0)) {
        updateSettings('twitterCharacterPresets', cached);
      }
    }
  }, [project.template]);
  
  // Save characters to cache whenever they change
  useEffect(() => {
    if (project.template === 'twitter' && project.settings.twitterCharacterPresets) {
      saveCachedCharacters(project.settings.twitterCharacterPresets);
    }
  }, [project.settings.twitterCharacterPresets]);
  function deleteMsg(id: string) {
    update('messages', project.messages.filter(m => m.id !== id));
  }
  function addMessage() {
    // Security: Limit max messages to prevent DoS
    if (project.messages.length >= MAX_MESSAGES) {
      error(`Maximum ${MAX_MESSAGES} messages allowed`);
      return;
    }
    const newMsg: Message = {
      id: crypto.randomUUID(), sender: 'New', content: 'Message', outgoing: false
    };
    update('messages', [...project.messages, newMsg]);
  }
  function addMsg(data: Partial<Message>) {
    // Security: Limit max messages to prevent DoS
    if (project.messages.length >= MAX_MESSAGES) {
      error(`Maximum ${MAX_MESSAGES} messages allowed`);
      return;
    }
    // Security: Truncate content if too long
    const content = (data.content || '').slice(0, MAX_CONTENT_LENGTH);
    const newMsg: Message = {
      id: crypto.randomUUID(),
      sender: (data.sender || 'User').slice(0, 200),
      content,
      outgoing: data.outgoing ?? false,
      timestamp: data.timestamp?.slice(0, 50),
      reaction: data.reaction?.slice(0, 10),
      status: data.status,
      attachments: data.attachments,
    };
    update('messages', [...project.messages, newMsg]);
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Quick Start Templates - Always Visible Carousel */}
      {getExampleNames(project.template).length > 0 && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">⚡</span>
              <h3 className="font-bold text-base text-gray-900">Quick Start Templates</h3>
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">
                {getExampleNames(project.template).length} available
              </span>
            </div>
            <span className="text-xs text-gray-500 hidden sm:block">Choose a template to get started →</span>
          </div>
          
          {/* Horizontal Scrolling Carousel */}
          <div className="overflow-x-auto -mx-2 px-2 pb-2 scrollbar-thin scrollbar-thumb-purple-300 scrollbar-track-transparent">
            <div className="flex gap-3 min-w-max">
              {getExampleNames(project.template).map((example) => (
                <button
                  key={example.id}
                  type="button"
                  onClick={() => {
                    const exampleProject = loadExample(example.id);
                    if (exampleProject) {
                      setConfirmModal({
                        isOpen: true,
                        title: 'Load Template',
                        message: `Load "${example.name}"? This replaces your current work.`,
                        onConfirm: () => {
                          onChange(exampleProject);
                          setConfirmModal(prev => ({ ...prev, isOpen: false }));
                        },
                      });
                    }
                  }}
                  className="flex-shrink-0 w-64 sm:w-72 p-4 bg-white border-2 border-purple-200 rounded-xl hover:border-purple-400 hover:shadow-lg transition-all group/item text-left"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-xl">📋</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm text-gray-900 group-hover/item:text-purple-700 transition-colors mb-1">
                        {example.name}
                      </div>
                      <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                        {example.description}
                      </p>
                      <div className="mt-2 flex items-center gap-1 text-xs text-purple-600 font-medium opacity-0 group-hover/item:opacity-100 transition-opacity">
                        <span>Load template</span>
                        <span>→</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
          
          {/* Mobile scroll hint */}
          <div className="mt-2 text-center sm:hidden">
            <span className="text-xs text-purple-600">← Swipe to see more →</span>
          </div>
        </div>
      )}

      {/* iOS iMessage Editor */}
      {project.template === 'ios' && (
        <IOSEditor project={project} onChange={onChange} universalCharacters={universalCharacters} focusedMessageId={focusedMessageId} focusTrigger={focusTrigger} />
      )}
      
      {/* Android-specific options - handled by AndroidEditor component */}
      
      {project.template === 'android' && (
        <AndroidEditor project={project} onChange={onChange} universalCharacters={universalCharacters} focusedMessageId={focusedMessageId} focusTrigger={focusTrigger} />
      )}
      
      {project.template === 'twitter' && (
        <TwitterEditor project={project} onChange={onChange} focusedMessageId={focusedMessageId} focusTrigger={focusTrigger} />
      )}

      {project.template === 'google' && (
        <div className="space-y-4">
          {/* COLLAPSIBLE SETTINGS */}
          <div className="border-2 border-green-200 rounded-xl p-4 bg-white shadow-sm">
            <button
              type="button"
              onClick={() => setGoogleSettingsOpen(!googleSettingsOpen)}
              className="w-full flex items-center justify-between text-left group"
            >
              <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <span>⚙️</span>
                <span>Google Search Settings</span>
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 group-hover:text-gray-700 transition">
                  {googleSettingsOpen ? 'Click to hide' : 'Click to customize'}
                </span>
                <span className={`text-gray-400 transition-transform ${googleSettingsOpen ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </div>
            </button>

            {googleSettingsOpen && (
              <div className="mt-4 space-y-4 pt-4 border-t border-green-200 animate-fadeIn">
          <h3 className="text-xs font-medium text-gray-900 uppercase tracking-wide sr-only">🔍 Google Search Creator</h3>
          
          {/* Max Width */}
          <label className="flex flex-col">
            <span className="text-xs font-medium text-gray-700 uppercase tracking-wide mb-2">Max Width</span>
            <input 
              type="number" 
              min={280} 
              max={600} 
              value={project.settings.maxWidthPx} 
              onChange={e => updateSettings('maxWidthPx', parseInt(e.target.value))} 
              className="w-full text-sm text-gray-900 bg-white p-3 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
            <span className="text-xs text-gray-600 mt-1">Search results width in pixels (280-600px)</span>
          </label>

          {/* Main Search Query */}
          <label className="flex flex-col">
            <span className="text-xs font-medium text-gray-700 uppercase tracking-wide mb-2">Search Query</span>
            <input 
              className="w-full text-sm text-gray-900 bg-white p-3 rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" 
              value={project.settings.googleQuery||''} 
              onChange={e=>updateSettings('googleQuery', e.target.value)} 
              placeholder="who is the current green lantern" 
            />
            <span className="text-xs text-gray-600 mt-1">This is what appears in the search bar</span>
          </label>

          {/* Engine Variant */}
          <label className="flex flex-col">
            <span className="text-xs font-medium text-gray-700 uppercase tracking-wide mb-2">Search Engine Style</span>
            <select 
              className="w-full text-sm text-gray-900 bg-white p-3 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" 
              value={project.settings.googleEngineVariant||'google'} 
              onChange={e=>updateSettings('googleEngineVariant', e.target.value as any)}
            >
              <option value="google">Google (Modern)</option>
              <option value="google-old">Google (Classic Serif)</option>
              <option value="naver">Naver (Korean)</option>
            </select>
          </label>

          {/* Autocomplete Suggestions */}
          <details className="space-y-3 pt-3 border-t border-gray-200">
            <summary className="cursor-pointer text-xs font-medium text-gray-700 uppercase tracking-wide hover:text-gray-900">✨ Autocomplete Suggestions</summary>
            <label className="flex flex-col pl-3">
              <textarea 
                rows={4} 
                className="w-full text-sm text-gray-900 bg-white p-3 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-mono transition" 
                value={(project.settings.googleSuggestions||[]).join('\n')} 
                onChange={e=>updateSettings('googleSuggestions', e.target.value.split('\n'))} 
                placeholder="who is the current green lantern&#10;who is the current queen of genovia&#10;who is the current doctor who"
              />
              <span className="text-xs text-gray-600 mt-1">
                💡 One per line. Use *asterisks* to <b>bold</b> matching: "who is the *current* green lantern"
              </span>
            </label>
            
            {/* Visual preview of suggestions */}
            {project.settings.googleSuggestions && project.settings.googleSuggestions.length > 0 && (
              <div className="bg-white border border-gray-200 rounded p-2 text-xs pl-3 mt-2">
                <div className="text-gray-500 mb-1 font-medium text-[10px]">Preview:</div>
                {project.settings.googleSuggestions.slice(0, 3).map((sug, i) => (
                  <div key={i} className="py-1 px-2 hover:bg-gray-50 rounded text-xs">
                    {sug.replace(/\*/g, '')}
                  </div>
                ))}
                {project.settings.googleSuggestions.length > 3 && (
                  <div className="text-gray-400 text-[10px] mt-1 px-2">+ {project.settings.googleSuggestions.length - 3} more</div>
                )}
              </div>
            )}
          </details>

          {/* Result Statistics Section */}
          <div className="border-t border-gray-200 pt-4 space-y-3">
            <label className="flex items-center gap-2 text-sm text-gray-900">
              <input 
                type="checkbox" 
                checked={project.settings.googleShowStats||false} 
                onChange={e=>updateSettings('googleShowStats', e.target.checked)} 
                className="w-4 h-4 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
              />
              <span className="font-medium">Show result statistics</span>
            </label>
            
            {project.settings.googleShowStats && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-6">
                <label className="flex flex-col">
                  <span className="text-xs font-medium text-gray-700 uppercase tracking-wide mb-2">Results Count</span>
                  <input 
                    className="w-full text-sm text-gray-900 bg-white p-3 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" 
                    value={project.settings.googleResultsCount||''} 
                    onChange={e=>updateSettings('googleResultsCount', e.target.value)} 
                    placeholder="About 24,040,000,000 results" 
                  />
                </label>
                <label className="flex flex-col">
                  <span className="text-xs font-medium text-gray-700 uppercase tracking-wide mb-2">Search Time</span>
                  <input 
                    className="w-full text-sm text-gray-900 bg-white p-3 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" 
                    value={project.settings.googleResultsTime||''} 
                    onChange={e=>updateSettings('googleResultsTime', e.target.value)} 
                    placeholder="0.56 seconds" 
                  />
                </label>
              </div>
            )}
          </div>

          {/* Did You Mean Section */}
          <div className="border-t border-gray-200 pt-4 space-y-3">
            <label className="flex items-center gap-2 text-sm text-gray-900">
              <input 
                type="checkbox" 
                checked={project.settings.googleShowDidYouMean||false} 
                onChange={e=>updateSettings('googleShowDidYouMean', e.target.checked)} 
                className="w-4 h-4 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
              />
              <span className="font-medium">Show "Did you mean" correction</span>
            </label>
            
            {project.settings.googleShowDidYouMean && (
              <label className="flex flex-col pl-6">
                <span className="text-xs font-medium text-gray-700 uppercase tracking-wide mb-2">Suggested Correction</span>
                <input 
                  className="w-full text-sm text-gray-900 bg-white p-3 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" 
                  value={project.settings.googleDidYouMean||''} 
                  onChange={e=>updateSettings('googleDidYouMean', e.target.value)} 
                  placeholder="Captain Jack Sparrow" 
                />
                <span className="text-xs text-gray-600 mt-1">
                  If user searches "Captian Jack Sparow", suggest "Captain Jack Sparrow"
                </span>
              </label>
            )}
          </div>

          {/* Settings */}
          <div className="border-t border-gray-200 pt-3">
            <label className="flex items-center gap-2 text-xs mb-3">
              <input 
                type="checkbox" 
                checked={project.settings.watermark} 
                onChange={e=>updateSettings('watermark', e.target.checked)} 
              />
              <span>Show watermark</span>
            </label>
          </div>
              </div>
            )}
          </div>

          {/* UNIFIED COMPOSE SECTION */}
          <div className="space-y-4 border-2 border-blue-200 rounded-xl p-4 bg-white shadow-sm">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <span>🔗</span>
                <span>Add Search Results</span>
              </h4>
              
              {/* Mode Toggle */}
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <button
                  type="button"
                  onClick={() => setGoogleComposeMode('fast')}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-all ${
                    googleComposeMode === 'fast'
                      ? 'bg-white shadow text-blue-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title="Quick result creation"
                >
                  ⚡ Fast Mode
                </button>
                <button
                  type="button"
                  onClick={() => setGoogleComposeMode('detailed')}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-all ${
                    googleComposeMode === 'detailed'
                      ? 'bg-white shadow text-blue-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title="Full form with all options"
                >
                  📝 Detailed
                </button>
              </div>
            </div>

            {/* Fast Mode - Simple Result */}
            {googleComposeMode === 'fast' && (
              <div className="space-y-3 animate-fadeIn">
                <input 
                  id="google-fast-title"
                  className="w-full text-sm text-gray-900 bg-white p-3 rounded-lg border-2 border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition" 
                  placeholder="Result title (e.g., Captain Jack Sparrow - Wikipedia)"
                />
                <input 
                  id="google-fast-url"
                  className="w-full text-sm text-gray-900 bg-white p-3 rounded-lg border-2 border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition font-mono" 
                  placeholder="URL (e.g., https://en.wikipedia.org › wiki › Jack_Sparrow)"
                />
                <button
                  type="button"
                  onClick={() => {
                    const titleInput = document.getElementById('google-fast-title') as HTMLInputElement;
                    const urlInput = document.getElementById('google-fast-url') as HTMLInputElement;
                    
                    const title = titleInput?.value.trim();
                    const url = urlInput?.value.trim();
                    
                    if (!title || !url) {
                      error('Please enter both title and URL');
                      return;
                    }
                    
                    const newResult = {
                      id: crypto.randomUUID(),
                      sender: '',
                      content: title,
                      outgoing: false,
                      googleResultUrl: url,
                      googleResultDescription: '',
                    };
                    
                    update('messages', [...project.messages, newResult]);
                    
                    if (titleInput) titleInput.value = '';
                    if (urlInput) urlInput.value = '';
                    success('Result added!');
                  }}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
                >
                  🔍 Add Result
                </button>
              </div>
            )}

            {/* Detailed Mode - Full Result Composer */}
            {googleComposeMode === 'detailed' && (
              <div className="space-y-4 animate-fadeIn">
          {/* Search Results Section - Content moved here */}
          <div className="space-y-4">

            {/* Add Result Composer */}
            <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 space-y-4">
              <label className="flex flex-col">
                <span className="text-xs font-medium text-gray-700 uppercase tracking-wide mb-2">Result Title</span>
                <input 
                  id="google-result-title"
                  className="w-full text-sm text-gray-900 bg-white p-3 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" 
                  placeholder="Captain Jack Sparrow - Wikipedia"
                />
                <span className="text-xs text-gray-600 mt-1">Appears as blue link</span>
              </label>

              <label className="flex flex-col">
                <span className="text-xs font-medium text-gray-700 uppercase tracking-wide mb-2">URL</span>
                <input 
                  id="google-result-url"
                  className="w-full text-sm text-gray-900 bg-white p-3 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition font-mono" 
                  placeholder="https://en.wikipedia.org › wiki › Jack_Sparrow"
                />
                <span className="text-xs text-gray-600 mt-1">Appears in green</span>
              </label>

              <label className="flex flex-col">
                <span className="text-xs font-medium text-gray-700 uppercase tracking-wide mb-2">Description / Snippet</span>
                <textarea 
                  id="google-result-description"
                  className="w-full text-sm text-gray-900 bg-white p-3 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition" 
                  rows={3}
                  placeholder="Captain Jack Sparrow is a fictional character and the main protagonist of the Pirates of the Caribbean film series..."
                />
              </label>

              <button
                type="button"
                onClick={() => {
                  const titleInput = document.getElementById('google-result-title') as HTMLInputElement;
                  const urlInput = document.getElementById('google-result-url') as HTMLInputElement;
                  const descInput = document.getElementById('google-result-description') as HTMLTextAreaElement;
                  
                  const title = titleInput?.value.trim();
                  const url = urlInput?.value.trim();
                  const description = descInput?.value.trim();
                  
                  if (!title || !url) {
                    error('Please enter at least a title and URL');
                    return;
                  }
                  
                  const newResult = {
                    id: crypto.randomUUID(),
                    sender: '',
                    content: title,
                    outgoing: false,
                    googleResultUrl: url,
                    googleResultDescription: description,
                  };
                  
                  update('messages', [...project.messages, newResult]);
                  
                  // Clear inputs
                  if (titleInput) titleInput.value = '';
                  if (urlInput) urlInput.value = '';
                  if (descInput) descInput.value = '';
                }}
                className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded transition font-medium text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                ➕ Add Search Result
              </button>
            </div>

            {/* Results List */}
            <div className="space-y-3">
              {project.messages.length === 0 ? (
                <div className="text-center py-12 bg-white border border-dashed border-gray-300 rounded-lg">
                  <div className="text-4xl mb-2">🔍</div>
                  <div className="font-medium text-gray-400 text-sm">No results yet</div>
                  <div className="text-xs text-gray-400 mt-1">Add your first search result above</div>
                </div>
              ) : (
                project.messages.map((result, idx) => (
                  <div 
                    key={result.id} 
                    className="border border-gray-300 rounded-lg bg-white hover:shadow-md transition-shadow p-4 space-y-4"
                  >
                    <div className="flex items-start justify-between pb-3 border-b border-gray-200">
                      <span className="text-sm font-medium text-gray-900">🔍 Result #{idx + 1}</span>
                      <button 
                        type="button" 
                        onClick={() => {
                          setConfirmModal({
                            isOpen: true,
                            title: 'Delete Result',
                            message: 'Are you sure you want to delete this result?',
                            onConfirm: () => {
                              deleteMsg(result.id);
                              setConfirmModal(prev => ({ ...prev, isOpen: false }));
                            },
                          });
                        }}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 text-lg leading-none px-2 py-1 rounded transition"
                        title="Delete result"
                      >
                        ×
                      </button>
                    </div>

                    <label className="flex flex-col">
                      <span className="text-xs font-medium text-gray-700 uppercase tracking-wide mb-2">Title</span>
                      <input 
                        className="w-full text-sm text-gray-900 bg-white p-3 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" 
                        value={result.content} 
                        onChange={e => updateMsg(result.id, {content: e.target.value})}
                        placeholder="Result title"
                      />
                    </label>

                    <label className="flex flex-col">
                      <span className="text-xs font-medium text-gray-700 uppercase tracking-wide mb-2">URL</span>
                      <input 
                        className="w-full text-sm text-gray-900 bg-white p-3 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition font-mono" 
                        value={result.googleResultUrl || ''} 
                        onChange={e => updateMsg(result.id, {googleResultUrl: e.target.value})}
                        placeholder="https://example.com"
                      />
                    </label>

                    <label className="flex flex-col">
                      <span className="text-xs font-medium text-gray-700 uppercase tracking-wide mb-2">Description</span>
                      <textarea 
                        className="w-full text-sm text-gray-900 bg-white p-3 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition" 
                        rows={2}
                        value={result.googleResultDescription || ''} 
                        onChange={e => updateMsg(result.id, {googleResultDescription: e.target.value})}
                        placeholder="Optional description..."
                      />
                    </label>
                  </div>
                ))
              )}
            </div>
          </div>

          <p className="text-xs text-gray-600 bg-blue-50 p-3 rounded border border-blue-200">
            💡 Tip: Most fics only need 1-3 search results. Keep it simple!</p>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Messages section - not used for Google and Twitter (they have dedicated UIs) */}
      {project.template !== 'google' && project.template !== 'android' && project.template !== 'ios' && project.template !== 'twitter' && (
        <div className="border border-gray-200 rounded-lg p-4 space-y-4 bg-white">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-indigo-900">💬 Discord Chat Creator</h3>
            <label className="flex items-center gap-2 text-xs px-3 py-1 rounded-full" style={{
              background: project.settings.discordDarkMode !== false ? '#2B2D31' : '#FFFFFF',
              color: project.settings.discordDarkMode !== false ? '#DBDEE1' : '#2E3338',
              border: '1px solid ' + (project.settings.discordDarkMode !== false ? '#1f2124' : '#e3e5e8')
            }}>
              <input 
                type="checkbox" 
                checked={project.settings.discordDarkMode!==false} 
                onChange={e=>updateSettings('discordDarkMode', e.target.checked)} 
              />
              <span className="font-medium">{project.settings.discordDarkMode !== false ? '🌙 Dark' : '☀️ Light'} Mode</span>
            </label>
          </div>
          
          {/* Server & Channel Context */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col text-xs">
                <span className="font-medium mb-1 text-gray-700">Server Name (optional)</span>
                <input 
                  className="border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-indigo-400" 
                  value={project.settings.discordServerName||''} 
                  onChange={e=>updateSettings('discordServerName', e.target.value)} 
                  placeholder="My Cool Server" 
                />
              </label>
              <label className="flex flex-col text-xs">
                <span className="font-medium mb-1 text-gray-700">Channel Name</span>
                <input 
                  className="border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-indigo-400" 
                  value={project.settings.discordChannelName||''} 
                  onChange={e=>updateSettings('discordChannelName', e.target.value)} 
                  placeholder="general" 
                />
              </label>
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input 
                type="checkbox" 
                checked={project.settings.discordShowHeader!==false} 
                onChange={e=>updateSettings('discordShowHeader', e.target.checked)} 
              />
              <span>Show channel header</span>
            </label>
          </div>

          {/* Role Color Presets - Collapsible */}
          <details className="border-t border-gray-200 pt-3">
            <summary className="cursor-pointer text-xs font-medium text-gray-600 hover:text-gray-800 mb-2">🎨 Role Color Presets (optional)</summary>
            <p className="text-[10px] text-gray-600 mb-2 pl-3">Quick-assign these colors when adding messages below</p>
            <div className="space-y-1 pl-3">
              {(project.settings.discordRolePresets || []).map((preset, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs">
                  <input 
                    type="color" 
                    value={preset.color} 
                    onChange={e => {
                      const newPresets = [...(project.settings.discordRolePresets || [])];
                      newPresets[idx].color = e.target.value;
                      updateSettings('discordRolePresets', newPresets);
                    }}
                    className="w-8 h-8 rounded cursor-pointer"
                  />
                  <input 
                    className="border border-gray-300 px-2 py-1 rounded flex-1 text-xs" 
                    value={preset.name} 
                    onChange={e => {
                      const newPresets = [...(project.settings.discordRolePresets || [])];
                      newPresets[idx].name = e.target.value;
                      updateSettings('discordRolePresets', newPresets);
                    }}
                    placeholder="Role name"
                  />
                  <button 
                    type="button"
                    onClick={() => {
                      const newPresets = (project.settings.discordRolePresets || []).filter((_, i) => i !== idx);
                      updateSettings('discordRolePresets', newPresets);
                    }}
                    className="text-red-500 hover:text-red-700 px-2 text-base"
                    title="Remove preset"
                  >×</button>
                </div>
              ))}
              <button 
                type="button"
                onClick={() => {
                  const newPresets = [...(project.settings.discordRolePresets || []), { name: 'New Role', color: '#99AAB5' }];
                  updateSettings('discordRolePresets', newPresets);
                }}
                className="text-xs px-3 py-1 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 mt-2"
              >+ Add Role Preset</button>
            </div>
          </details>

          {/* Settings */}
          <div className="border-t border-gray-200 pt-3 grid grid-cols-2 gap-3">
            <label className="flex flex-col text-xs">
              <span className="font-medium mb-1 text-gray-700">Max Width</span>
              <input 
                type="number" 
                min={280} 
                max={800} 
                className="border border-gray-300 px-2 py-1 rounded" 
                value={project.settings.maxWidthPx} 
                onChange={e=>updateSettings('maxWidthPx', parseInt(e.target.value))} 
              />
            </label>
            <label className="flex items-center gap-2 text-xs pt-5">
              <input 
                type="checkbox" 
                checked={project.settings.watermark} 
                onChange={e=>updateSettings('watermark', e.target.checked)} 
              />
              <span>Watermark</span>
            </label>
          </div>

          <p className="text-[10px] text-gray-600 italic bg-white/50 p-2 rounded">
            💡 Tip: Each message below can use role colors. Click a preset color or use custom. Avatars work best at 40×40px.
          </p>
        </div>
      )}
      
      {/* Messages section - hide for templates using tabbed interface (iOS, Android) and single-post templates (Google, Twitter) */}
      {project.template !== 'google' && project.template !== 'android' && project.template !== 'ios' && project.template !== 'twitter' && (
        <div>
          <h3 className="font-medium text-sm mb-2">Messages</h3>
          <div className="space-y-2">
            {project.messages.map(m => (
              <div key={m.id} className="border p-2 rounded text-sm space-y-1 bg-gray-50">
                {/* Full chat message interface */}
                <>
                    <div className="flex gap-2">
                      <input className="border px-1 flex-1" value={m.sender} onChange={e=>updateMsg(m.id,{sender:e.target.value})} placeholder="Sender name" />
                      <label className="flex items-center gap-1"><input type="checkbox" checked={m.outgoing} onChange={e=>updateMsg(m.id,{outgoing:e.target.checked})} /> Outgoing</label>
                    </div>
                    <textarea className="border w-full px-1" rows={2} value={m.content} onChange={e=>updateMsg(m.id,{content:e.target.value})} placeholder="Message text" />
                    
                    {/* Twitter thread parent selection */}
                    {project.template === 'twitter' && project.settings.twitterThreadMode && (
                      <div className="bg-blue-50 border border-blue-200 rounded p-2">
                        <label className="text-xs text-gray-700 flex items-center gap-2">
                          <span className="font-medium">🧵 Reply to:</span>
                          <select 
                            className="border px-2 py-1 rounded text-xs flex-1" 
                            value={m.parentId||''} 
                            onChange={e=>updateMsg(m.id,{parentId:e.target.value||undefined})}
                          >
                            <option value="">None (Main tweet)</option>
                            {project.messages
                              .filter(msg => msg.id !== m.id) // Can't reply to itself
                              .filter(msg => {
                                // Prevent circular references: can only reply to messages added before this one
                                const currentIdx = project.messages.findIndex(x => x.id === m.id);
                                const msgIdx = project.messages.findIndex(x => x.id === msg.id);
                                return msgIdx < currentIdx;
                              })
                              .map((msg, idx) => (
                                <option key={msg.id} value={msg.id}>
                                  Tweet {idx + 1}: {msg.content.slice(0, 40)}{msg.content.length > 40 ? '...' : ''}
                                </option>
                              ))
                            }
                          </select>
                        </label>
                        {m.parentId && (
                          <p className="text-[10px] text-gray-500 mt-1">↳ This tweet will appear as a reply with connecting lines</p>
                        )}
                      </div>
                    )}
                    
                    {/* Chat enhancements for iOS/Android */}
                    {(project.template === 'ios' || project.template === 'android') && (
                      <div className="flex gap-2 items-center text-xs bg-gray-100 p-2 rounded">
                        <label className="flex items-center gap-1">
                          <span className="text-gray-600">Status:</span>
                          <select 
                            className="border px-1 py-0.5 rounded text-xs" 
                            value={m.status||'sent'} 
                            onChange={e=>updateMsg(m.id,{status:e.target.value as any})}
                          >
                            <option value="sending">Sending...</option>
                            <option value="sent">Sent</option>
                            <option value="delivered">Delivered</option>
                            <option value="read">Read</option>
                          </select>
                        </label>
                        <label className="flex items-center gap-1">
                          <span className="text-gray-600">Reaction:</span>
                          <input 
                            className="border px-2 py-0.5 rounded text-xs w-16" 
                            value={m.reaction||''} 
                            onChange={e=>updateMsg(m.id,{reaction:e.target.value})} 
                            placeholder="❤️ 👍"
                            maxLength={2}
                          />
                        </label>
                      </div>
                    )}
                    
                    <div className="flex gap-2 items-center">
                      <input className="border px-1 w-24" placeholder="time" value={m.timestamp||''} onChange={e=>updateMsg(m.id,{timestamp:e.target.value})} />
                      <input 
                        className="border px-2 py-1 text-xs flex-1" 
                        placeholder="Paste avatar URL" 
                        value={m.avatarUrl||''} 
                        onChange={e => updateMsg(m.id, {avatarUrl: e.target.value})}
                      />
                      {m.avatarUrl && <span className="text-xs text-green-600">✓</span>}
                      <button type="button" onClick={() => deleteMsg(m.id)} className="text-xs px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 ml-auto" title="Delete message">×</button>
                    </div>
                  </>
              </div>
            ))}
          </div>
          <button type="button" onClick={addMessage} className="mt-2 text-xs px-2 py-1 bg-blue-600 text-white rounded">Add Message</button>
        </div>
      )}
      
      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText="Load Template"
        cancelText="Cancel"
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />
      
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
};
