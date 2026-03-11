import React, { useState, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { SkinProject, Message, TwitterCharacter } from '../lib/schema';
import { useToast, ToastContainer } from './Toast';
import { useConfirm } from './ConfirmModal';
import { AvatarSelector } from './AvatarSelector';
import { 
  addCharacterToCache,
  removeCharacterFromCache,
  updateCharacterInCache 
} from '../lib/characterCache';
import { useProjectEditor } from '../hooks/useProjectEditor';

interface Props { 
  project: SkinProject; 
  onChange: (p: SkinProject) => void;
  focusedMessageId?: string | null;
  focusTrigger?: number;
}

export const TwitterEditor: React.FC<Props> = ({ project, onChange, focusedMessageId, focusTrigger }) => {
  // Use shared project editor hook
  const { update, updateSettings, updateMsg, deleteMsg } = useProjectEditor(project, onChange);
  
  const [newTweetImageUrl, setNewTweetImageUrl] = useState('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const { toasts, removeToast, success, error, warning } = useToast();
  const { confirm, ConfirmModal } = useConfirm();
  
  // Settings panel collapse state
  const [settingsOpen, setSettingsOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ao3skin_twitter_settings_open');
      return saved ? saved === 'true' : false;
    }
    return false;
  });
  
  // Compose mode toggle state - Twitter defaults to detailed for character management
  const [composeMode, setComposeMode] = useState<'fast' | 'detailed'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ao3skin_twitter_compose_mode');
      return (saved as 'fast' | 'detailed') || 'detailed';
    }
    return 'detailed';
  });
  
  // Save states to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ao3skin_twitter_settings_open', String(settingsOpen));
      localStorage.setItem('ao3skin_twitter_compose_mode', composeMode);
    }
  }, [settingsOpen, composeMode]);
  
  // New character form state
  const [newCharName, setNewCharName] = useState('');
  const [newCharHandle, setNewCharHandle] = useState('');
  const [newCharAvatar, setNewCharAvatar] = useState('');
  const [newCharVerified, setNewCharVerified] = useState(false);
  const [showAddCharForm, setShowAddCharForm] = useState(false);
  
  // Inline dialog states for Shift Times and Randomize Metrics
  const [showShiftTimesDialog, setShowShiftTimesDialog] = useState(false);
  const [shiftMinutesInput, setShiftMinutesInput] = useState('5');
  const [showRandomizeDialog, setShowRandomizeDialog] = useState(false);
  const [baseFollowersInput, setBaseFollowersInput] = useState('10000');

  // Scroll to focused message when focusedMessageId changes
  useEffect(() => {
    if (focusedMessageId) {
      setTimeout(() => {
        const element = document.getElementById(`message-card-${focusedMessageId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('message-card-focused');
          setTimeout(() => {
            element.classList.remove('message-card-focused');
          }, 3000);
        }
      }, 100);
    }
  }, [focusedMessageId, focusTrigger]);

  // Drag and drop handlers for tweet reordering - Memoized for performance
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
    // Add a slight delay for visual feedback
    setTimeout(() => {
      const element = e.target as HTMLElement;
      element.style.opacity = '0.5';
    }, 0);
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    const element = e.target as HTMLElement;
    element.style.opacity = '1';
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedIndex !== null && index !== draggedIndex) {
      setDragOverIndex(index);
    }
  }, [draggedIndex]);

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) return;
    
    const newMessages = [...project.messages];
    const [draggedItem] = newMessages.splice(draggedIndex, 1);
    newMessages.splice(dropIndex, 0, draggedItem);
    update('messages', newMessages);
    
    setDraggedIndex(null);
    setDragOverIndex(null);
    success('Tweet reordered');
  }, [draggedIndex, project.messages, update, success]);
  
  const updateCharacter = useCallback((charId: string, patch: Partial<TwitterCharacter>) => {
    const presets = project.settings.twitterCharacterPresets || [];
    const oldChar = presets.find(c => c.id === charId);
    const updatedPresets = presets.map(c => c.id === charId ? { ...c, ...patch } : c);
    
    updateCharacterInCache(charId, patch);
    
    const updatedMessages = oldChar ? project.messages.map(msg => {
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
    
    onChange({
      ...project,
      settings: { ...project.settings, twitterCharacterPresets: updatedPresets },
      messages: updatedMessages
    });
  }, [project, onChange]);
  
  const deleteCharacter = useCallback((charId: string) => {
    const presets = project.settings.twitterCharacterPresets || [];
    removeCharacterFromCache(charId);
    updateSettings('twitterCharacterPresets', presets.filter(c => c.id !== charId));
  }, [project.settings.twitterCharacterPresets, updateSettings]);
  
  const characters = project.settings.twitterCharacterPresets || [];
  
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      <div className="p-4 space-y-4">
        {/* SECTION 1: PROJECT CHARACTERS (Collapsible) */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors group"
          >
            <div className="flex items-center gap-2">
              <span>⚙️</span>
              <h3 className="text-sm font-bold text-gray-800">Twitter Characters & Settings</h3>
              <span className="bg-purple-200 text-purple-800 px-2 py-0.5 rounded-full text-xs font-bold">
                {characters.length}
              </span>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                {settingsOpen ? 'Click to hide' : 'Click to customize'}
              </span>
            </div>
            <span className={`text-gray-500 transition-transform duration-200 ${settingsOpen ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </button>

          {settingsOpen && (
          <div className="space-y-3 animate-fadeIn">
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddCharForm(!showAddCharForm)}
              className="px-3 py-1.5 bg-green-500 text-white rounded-full hover:bg-green-600 transition font-medium text-xs flex items-center gap-1 shadow-sm"
            >
              <span>{showAddCharForm ? '✕' : '+'}</span>
              <span>{showAddCharForm ? 'Cancel' : 'New Character'}</span>
            </button>
          </div>

          {/* Info Banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
            <p className="flex items-center gap-2">
              <span>💡</span>
              <span><strong>Tip:</strong> Use the <strong>🎭 Characters</strong> button in the header to access your global character library across all templates!</span>
            </p>
          </div>

          {/* Horizontal Scrollable Character Cards */}
          <div className="bg-white border-2 border-purple-300 rounded-xl p-3 shadow-sm">
            {characters.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                <div className="text-4xl mb-2">👥</div>
                <div className="font-medium">No characters yet</div>
                <div className="text-xs mt-1">Add one below to get started!</div>
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-purple-300 scrollbar-track-purple-100">
                {characters.map((char) => (
                  <div 
                    key={char.id} 
                    className="flex-shrink-0 w-52 border-2 border-gray-200 rounded-xl p-3 bg-white hover:border-blue-400 hover:shadow-md transition group"
                  >
                    <div className="flex items-start gap-2 mb-2">
                      {char.avatarUrl ? (
                        <Image 
                          src={char.avatarUrl} 
                          alt={char.name} 
                          width={48}
                          height={48}
                          className="rounded-full object-cover border-2 border-purple-400 flex-shrink-0"
                          unoptimized={char.avatarUrl.startsWith('data:')}
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-purple-200 flex items-center justify-center text-purple-700 font-bold text-sm flex-shrink-0">
                          {char.name.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm text-gray-800 truncate flex items-center gap-1">
                          <span>{char.name}</span>
                          {char.verified && <span className="text-blue-500 text-xs">✓</span>}
                        </div>
                        <div className="text-xs text-gray-500 truncate">{char.handle}</div>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          if (await confirm('Delete Character', `Delete ${char.name}? Tweets using this character will keep their data.`)) {
                            deleteCharacter(char.id);
                          }
                        }}
                        className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition text-lg leading-none flex-shrink-0"
                        title="Delete character"
                      >
                        ×
                      </button>
                    </div>
                    
                    {/* Quick Edit - Inline in card */}
                    <details className="text-xs mt-2">
                      <summary className="cursor-pointer text-purple-600 hover:text-purple-800 font-medium py-1">✏️ Quick Edit</summary>
                      <div className="space-y-2 mt-2 pt-2 border-t border-purple-200">
                        <input 
                          className="border border-gray-200 px-2 py-1 rounded w-full text-xs focus:ring-2 focus:ring-purple-400" 
                          value={char.name}
                          onChange={(e) => updateCharacter(char.id, { name: e.target.value })}
                          placeholder="Display Name"
                        />
                        <input 
                          className="border border-gray-200 px-2 py-1 rounded w-full text-xs focus:ring-2 focus:ring-purple-400" 
                          value={char.handle}
                          onChange={(e) => updateCharacter(char.id, { handle: e.target.value })}
                          placeholder="@handle"
                        />
                        <AvatarSelector
                          value={char.avatarUrl || ''}
                          onChange={(url) => updateCharacter(char.id, { avatarUrl: url })}
                          placeholder="Avatar URL"
                        />
                        <label className="flex items-center gap-1.5">
                          <input 
                            type="checkbox" 
                            className="w-3 h-3 rounded" 
                            checked={char.verified || false}
                            onChange={(e) => updateCharacter(char.id, { verified: e.target.checked })}
                          />
                          <span className="text-gray-700">✓ Verified</span>
                        </label>
                      </div>
                    </details>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Character Form (React-controlled) */}
          {showAddCharForm && (
            <div className="border-2 border-green-400 rounded-xl bg-green-50 p-4 space-y-3">
              <h4 className="font-bold text-sm text-green-800 flex items-center gap-2">
                <span>➕</span>
                <span>Add New Character</span>
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <input 
                  className="border-2 border-gray-300 px-3 py-2 rounded-lg text-sm col-span-2 focus:ring-2 focus:ring-green-500 focus:border-green-500" 
                  placeholder="Display Name (required)"
                  value={newCharName}
                  onChange={(e) => setNewCharName(e.target.value)}
                />
                <input 
                  className="border-2 border-gray-300 px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500" 
                  placeholder="@handle (optional)"
                  value={newCharHandle}
                  onChange={(e) => setNewCharHandle(e.target.value)}
                />
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Avatar</label>
                  <AvatarSelector
                    value={newCharAvatar}
                    onChange={(url) => setNewCharAvatar(url)}
                    placeholder="Paste URL or browse presets"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 rounded"
                  checked={newCharVerified}
                  onChange={(e) => setNewCharVerified(e.target.checked)}
                />
                <span className="text-gray-700">✓ Verified account</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  if (!newCharName.trim()) {
                    warning('Please enter a character name');
                    return;
                  }
                  
                  const handle = newCharHandle.trim() || `@${newCharName.toLowerCase().replace(/\s+/g, '')}`;
                  
                  const newChar: TwitterCharacter = {
                    id: crypto.randomUUID(),
                    name: newCharName.trim(),
                    handle,
                    avatarUrl: newCharAvatar || undefined,
                    verified: newCharVerified,
                  };
                  
                  addCharacterToCache(newChar);
                  const existing = project.settings.twitterCharacterPresets || [];
                  updateSettings('twitterCharacterPresets', [...existing, newChar]);
                  
                  // Clear form and hide
                  setNewCharName('');
                  setNewCharHandle('');
                  setNewCharAvatar('');
                  setNewCharVerified(false);
                  setShowAddCharForm(false);
                  success(`Added ${newChar.name}!`);
                }}
                className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition"
              >
                ✨ Add Character
              </button>
            </div>
          )}
          </div>
          )}
        </div>

        {/* UNIFIED COMPOSE SECTION */}
        <div className="space-y-4 border-2 border-blue-200 rounded-xl p-4 bg-white shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <span>✏️</span>
              <span>Compose Tweets</span>
            </h3>
            
            {/* Mode Toggle */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setComposeMode('fast')}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-all ${
                  composeMode === 'fast'
                    ? 'bg-white shadow text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title="Quick tweet creation"
              >
                ⚡ Fast Mode
              </button>
              <button
                type="button"
                onClick={() => setComposeMode('detailed')}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-all ${
                  composeMode === 'detailed'
                    ? 'bg-white shadow text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title="Full form with all options"
              >
                📝 Detailed
              </button>
            </div>
          </div>

          {/* Fast Mode - Simple Tweet */}
          {composeMode === 'fast' && (
            <div className="space-y-3 animate-fadeIn">
              <textarea
                id="twitter-fast-tweet-content"
                placeholder="What's happening?"
                className="w-full border-2 border-gray-300 rounded-lg p-3 text-sm resize-none focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
              <button
                type="button"
                onClick={() => {
                  const textarea = document.getElementById('twitter-fast-tweet-content') as HTMLTextAreaElement;
                  const content = textarea?.value.trim();
                  if (!content) {
                    error('Please enter tweet content');
                    return;
                  }
                  
                  const firstChar = characters[0];
                  if (!firstChar) {
                    error('Please add at least one character first');
                    return;
                  }
                  
                  const newMsg: Message = {
                    id: crypto.randomUUID(),
                    sender: firstChar.name,
                    twitterHandle: firstChar.handle,
                    avatarUrl: firstChar.avatarUrl,
                    verified: firstChar.verified,
                    content,
                    timestamp: new Date().toISOString(),
                    outgoing: false
                  };
                  
                  update('messages', [...project.messages, newMsg]);
                  if (textarea) textarea.value = '';
                  success('Tweet added!');
                }}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
              >
                🐦 Tweet
              </button>
            </div>
          )}

          {/* Detailed Mode - Full Tweet Composer */}
          {composeMode === 'detailed' && (
            <div className="space-y-3 animate-fadeIn">
          {/* SECTION 2: TWEET COMPOSER - Content moved here */}
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2 sr-only">
            <span>✏️</span>
            <span>Compose Tweet</span>
          </h3>

          {/* Quick Settings Bar */}
          <div className="bg-white border-2 border-blue-200 rounded-xl p-3 shadow-sm">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <label className="flex flex-col">
                <span className="font-medium text-gray-700 mb-1">Max Width (px)</span>
                <input 
                  type="number" 
                  min={280} 
                  max={600} 
                  value={project.settings.maxWidthPx} 
                  onChange={e => updateSettings('maxWidthPx', parseInt(e.target.value))} 
                  className="border-2 border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </label>
              <label className="flex items-center gap-2 cursor-pointer bg-gray-100 px-3 py-2 rounded-lg hover:bg-gray-200 transition">
                <input 
                  type="checkbox" 
                  checked={project.settings.twitterDarkMode || false}
                  onChange={e => updateSettings('twitterDarkMode', e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <span className="font-medium text-gray-700">🌙 Dark Mode</span>
              </label>
              <div className="flex flex-col justify-end">
                <button
                  type="button"
                  onClick={async () => {
                    if (await confirm('Clear All Tweets', 'Are you sure you want to delete all tweets? This cannot be undone.')) {
                      update('messages', []);
                      success('All tweets cleared');
                    }
                  }}
                  className="px-3 py-2 bg-red-50 text-red-600 border-2 border-red-200 rounded-lg hover:bg-red-100 transition font-medium text-xs"
                  disabled={project.messages.length === 0}
                >
                  🗑️ Clear All Tweets
                </button>
              </div>
            </div>
          </div>

          {/* Smart Metrics Auto-Fill */}
          {project.messages.length > 0 && (
            <div className="bg-purple-50 border-2 border-purple-300 rounded-xl p-4">
              <h4 className="font-bold text-sm text-purple-800 mb-3 flex items-center gap-2">
                <span>📊</span>
                <span>Smart Metrics - Auto-Fill All Tweets</span>
              </h4>
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    const updatedMessages = project.messages.map(msg => ({
                      ...msg,
                      twitterLikes: Math.floor(Math.random() * 900000) + 100000,
                      twitterRetweets: Math.floor(Math.random() * 90000) + 10000,
                      twitterReplies: Math.floor(Math.random() * 9000) + 1000,
                      twitterBookmarks: Math.floor(Math.random() * 9000) + 1000,
                      twitterViews: Math.floor(Math.random() * 9000000) + 1000000,
                    }));
                    update('messages', updatedMessages);
                  }}
                  className="px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-lg transition font-bold text-sm shadow-sm hover:shadow-md"
                >
                  🔥 Viral (100K-1M)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const updatedMessages = project.messages.map(msg => ({
                      ...msg,
                      twitterLikes: Math.floor(Math.random() * 9000) + 1000,
                      twitterRetweets: Math.floor(Math.random() * 900) + 100,
                      twitterReplies: Math.floor(Math.random() * 90) + 10,
                      twitterBookmarks: Math.floor(Math.random() * 90) + 10,
                      twitterViews: Math.floor(Math.random() * 90000) + 10000,
                    }));
                    update('messages', updatedMessages);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-bold text-sm shadow-sm hover:shadow-md"
                >
                  📈 Popular (1K-10K)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const updatedMessages = project.messages.map(msg => ({
                      ...msg,
                      twitterLikes: Math.floor(Math.random() * 90) + 10,
                      twitterRetweets: Math.floor(Math.random() * 9) + 1,
                      twitterReplies: Math.floor(Math.random() * 5),
                      twitterBookmarks: Math.floor(Math.random() * 5),
                      twitterViews: Math.floor(Math.random() * 900) + 100,
                    }));
                    update('messages', updatedMessages);
                  }}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition font-bold text-sm shadow-sm hover:shadow-md"
                >
                  🤫 Quiet (10-100)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const updatedMessages = project.messages.map(msg => ({
                      ...msg,
                      twitterLikes: undefined,
                      twitterRetweets: undefined,
                      twitterReplies: undefined,
                      twitterBookmarks: undefined,
                      twitterViews: undefined,
                    }));
                    update('messages', updatedMessages);
                  }}
                  className="px-4 py-2 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-bold text-sm shadow-sm"
                >
                  🧹 Clear All
                </button>
              </div>
              <p className="text-xs text-purple-700 mt-3">
                💡 <strong>Tip:</strong> These apply random values to all tweets instantly. You can still edit individual metrics below!
              </p>
            </div>
          )}

          {/* Fast Thread Mode */}
          <details className="border-2 border-purple-400 rounded-xl bg-purple-50 shadow-sm">
            <summary className="cursor-pointer font-bold text-sm text-purple-800 hover:text-purple-900 p-4 flex items-center gap-2">
              <span>⚡</span>
              <span>Fast Thread Mode - Create Multiple Tweets at Once</span>
            </summary>
            <div className="space-y-3 p-4 pt-0">
              <div className="bg-purple-100 border border-purple-300 rounded-lg p-3">
                <p className="text-xs text-purple-800 leading-relaxed">
                  <strong>💡 How it works:</strong> Paste or type multiple tweets - one per line.<br/>
                  Use <code className="bg-purple-200 px-1 rounded font-mono">CharacterName: tweet text</code> to auto-assign characters from your library!
                </p>
              </div>
              <div className="space-y-2">
                <div className="relative">
                  <textarea 
                    id="twitter-bulk-input"
                    className={`border-2 px-4 py-3 rounded-xl w-full focus:ring-2 focus:ring-purple-500 resize-none font-sans text-sm shadow-inner ${
                      (document.getElementById('twitter-bulk-input') as HTMLTextAreaElement)?.value.length > 280
                        ? 'border-red-400 focus:border-red-500'
                        : (document.getElementById('twitter-bulk-input') as HTMLTextAreaElement)?.value.length > 260
                        ? 'border-yellow-400 focus:border-yellow-500'
                        : 'border-purple-300 focus:border-purple-500'
                    }`}
                    rows={8}
                    placeholder="Alice: Just finished the most amazing book!&#10;Bob: Oh really? What was it?&#10;Alice: The Name of the Wind by Patrick Rothfuss&#10;Bob: I've heard great things about that one!"
                    onChange={(e) => {
                      const charCount = e.target.value.length;
                      const counterEl = document.getElementById('twitter-bulk-counter');
                      if (counterEl) {
                        counterEl.textContent = `${charCount}/280`;
                        counterEl.className = `absolute bottom-2 right-2 text-xs font-semibold px-2 py-1 rounded ${
                          charCount > 280
                            ? 'bg-red-100 text-red-700'
                            : charCount > 260
                            ? 'bg-yellow-100 text-yellow-700'
                            : charCount > 200
                            ? 'bg-gray-100 text-gray-600'
                            : 'bg-purple-100 text-purple-600'
                        }`;
                      }
                      e.target.className = `border-2 px-4 py-3 rounded-xl w-full focus:ring-2 focus:ring-purple-500 resize-none font-sans text-sm shadow-inner ${
                        charCount > 280
                          ? 'border-red-400 focus:border-red-500'
                          : charCount > 260
                          ? 'border-yellow-400 focus:border-yellow-500'
                          : 'border-purple-300 focus:border-purple-500'
                      }`;
                    }}
                  />
                  <span id="twitter-bulk-counter" className="absolute bottom-2 right-2 text-xs font-semibold px-2 py-1 rounded bg-purple-100 text-purple-600">
                    0/280
                  </span>
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-xs text-purple-700 mr-2">Quick emojis:</span>
                  {['😂', '❤️', '🔥', '👍', '😭', '🙏', '💀', '✨', '💯'].map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        const input = document.getElementById('twitter-bulk-input') as HTMLTextAreaElement;
                        if (input) {
                          const start = input.selectionStart;
                          const end = input.selectionEnd;
                          const text = input.value;
                          input.value = text.substring(0, start) + emoji + text.substring(end);
                          input.selectionStart = input.selectionEnd = start + emoji.length;
                          input.focus();
                        }
                      }}
                      className="text-lg hover:bg-purple-100 px-2 py-1 rounded transition"
                      title={`Add ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const bulkInput = document.getElementById('twitter-bulk-input') as HTMLTextAreaElement;
                  const lines = bulkInput?.value.split('\n').filter(line => line.trim());
                  
                  if (!lines || lines.length === 0) {
                    warning('Please enter at least one tweet');
                    return;
                  }
                  
                  const defaultTimestamp = new Date().toLocaleString('en-US', { 
                    hour: 'numeric', 
                    minute: '2-digit', 
                    hour12: true
                  }) + ' · ' + new Date().toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  });
                  
                  const characterPresets = project.settings.twitterCharacterPresets || [];
                  const newCharactersToSave: TwitterCharacter[] = [];
                  
                  const newMessages = lines.map(line => {
                    const trimmed = line.trim();
                    const colonIndex = trimmed.indexOf(':');
                    
                    if (colonIndex > 0 && colonIndex < 50) {
                      const potentialName = trimmed.substring(0, colonIndex).trim();
                      const content = trimmed.substring(colonIndex + 1).trim();
                      
                      const matchedChar = characterPresets.find(char => 
                        char.name.toLowerCase() === potentialName.toLowerCase()
                      );
                      
                      if (matchedChar) {
                        return {
                          id: crypto.randomUUID(),
                          sender: matchedChar.name,
                          content: content,
                          outgoing: true,
                          timestamp: defaultTimestamp,
                          useCustomIdentity: true,
                          avatarUrl: matchedChar.avatarUrl,
                          twitterHandle: matchedChar.handle,
                          verified: matchedChar.verified,
                        };
                      } else if (content) {
                        const handle = `@${potentialName.toLowerCase().replace(/\s+/g, '')}`;
                        const alreadyAdding = newCharactersToSave.find(c => c.name.toLowerCase() === potentialName.toLowerCase());
                        
                        if (!alreadyAdding) {
                          newCharactersToSave.push({
                            id: crypto.randomUUID(),
                            name: potentialName,
                            handle: handle,
                          });
                        }
                        
                        return {
                          id: crypto.randomUUID(),
                          sender: potentialName,
                          content: content,
                          outgoing: true,
                          timestamp: defaultTimestamp,
                          useCustomIdentity: true,
                          twitterHandle: handle,
                        };
                      }
                    }
                    
                    return {
                      id: crypto.randomUUID(),
                      sender: project.settings.twitterDisplayName || 'User',
                      content: trimmed,
                      outgoing: true,
                      timestamp: defaultTimestamp,
                    };
                  });
                  
                  const currentPresets = project.settings.twitterCharacterPresets || [];
                  const updatedPresets = newCharactersToSave.length > 0 
                    ? [...currentPresets, ...newCharactersToSave]
                    : currentPresets;
                  
                  onChange({
                    ...project,
                    settings: {
                      ...project.settings,
                      twitterCharacterPresets: updatedPresets
                    },
                    messages: [...project.messages, ...newMessages]
                  });
                  
                  if (bulkInput) bulkInput.value = '';
                  
                  const successMsg = `Added ${lines.length} tweet${lines.length > 1 ? 's' : ''} to thread!` +
                    (newCharactersToSave.length > 0 ? ` ${newCharactersToSave.length} new character${newCharactersToSave.length > 1 ? 's' : ''} added to library!` : '');
                  success(successMsg);
                }}
                className="w-full px-5 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition font-bold text-sm shadow-sm hover:shadow-md"
              >
                ⚡ Add All Tweets to Thread
              </button>
            </div>
          </details>

          {/* Single Tweet Composer */}
          <div className="border-2 border-blue-400 rounded-xl p-4 bg-white space-y-3 shadow-sm">
            <h4 className="font-bold text-sm text-gray-700 flex items-center gap-2">
              <span className="text-blue-600">✏️</span>
              <span>Compose Single Tweet</span>
            </h4>
            
            <label className="flex flex-col text-xs">
              <span className="text-gray-700 mb-1.5 font-medium">Character (Optional)</span>
              <select
                id="twitter-character-select"
                className="border-2 border-gray-300 px-3 py-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="">🙋 Use Main Profile ({project.settings.twitterDisplayName || 'User'})</option>
                {characters.map(char => (
                  <option key={char.id} value={char.id}>
                    {char.verified ? '✓ ' : ''}
                    {char.name} ({char.handle})
                  </option>
                ))}
              </select>
            </label>
            
            <div className="space-y-2">
              <textarea 
                id="twitter-tweet-input"
                className="border-2 border-gray-300 px-4 py-3 rounded-xl w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none font-sans text-sm" 
                rows={4}
                placeholder="What's happening?"
              />
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-xs text-gray-500 mr-2">Quick emojis:</span>
                {['😂', '❤️', '🔥', '👍', '😭', '🙏', '💀', '✨', '💯'].map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      const input = document.getElementById('twitter-tweet-input') as HTMLTextAreaElement;
                      if (input) {
                        input.value += emoji;
                        input.focus();
                      }
                    }}
                    className="text-lg hover:bg-gray-100 px-2 py-1 rounded transition"
                    title={`Add ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col text-xs col-span-2">
                <span className="text-gray-600 mb-1.5 font-medium">Timestamp (optional)</span>
                <input 
                  id="twitter-timestamp-input"
                  type="text"
                  className="border-2 border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm" 
                  placeholder="3:09 PM · Nov 25, 2025"
                />
              </label>

              <label className="flex flex-col text-xs col-span-2">
                <span className="text-gray-600 mb-1.5 font-medium flex items-center gap-1">
                  <span>📷</span>
                  <span>Tweet Image (optional)</span>
                </span>
                <div className="flex items-center gap-2">
                  {newTweetImageUrl && (
                    <Image 
                      src={newTweetImageUrl} 
                      alt="Tweet" 
                      width={64}
                      height={64}
                      className="rounded-lg object-cover border-2 border-gray-300"
                      unoptimized={newTweetImageUrl.startsWith('data:')}
                    />
                  )}
                  <input 
                    className="border-2 border-gray-300 px-3 py-2 rounded-lg text-sm flex-1 focus:ring-2 focus:ring-blue-500"
                    value={newTweetImageUrl}
                    onChange={(e) => setNewTweetImageUrl(e.target.value)}
                    placeholder="Paste image URL or upload"
                    title="Upload images free at imgur.com or imgbb.com"
                  />

                  {newTweetImageUrl && (
                    <button
                      type="button"
                      onClick={() => setNewTweetImageUrl('')}
                      className="text-red-500 hover:text-red-700 text-xs px-2 py-1 font-medium"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </label>
            </div>

            <details className="text-xs">
              <summary className="cursor-pointer text-gray-600 hover:text-gray-800 font-medium py-1">📊 Engagement Metrics (Optional)</summary>
              <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-gray-200">
                <label className="flex flex-col">
                  <span className="text-gray-600 mb-1">❤️ Likes</span>
                  <input 
                    id="twitter-likes-input"
                    type="number" 
                    className="border border-gray-300 px-2 py-1.5 rounded text-sm" 
                    placeholder="0"
                    min="0"
                  />
                </label>
                <label className="flex flex-col">
                  <span className="text-gray-600 mb-1">🔄 Retweets</span>
                  <input 
                    id="twitter-retweets-input"
                    type="number" 
                    className="border border-gray-300 px-2 py-1.5 rounded text-sm" 
                    placeholder="0"
                    min="0"
                  />
                </label>
                <label className="flex flex-col">
                  <span className="text-gray-600 mb-1">💬 Replies</span>
                  <input 
                    id="twitter-replies-input"
                    type="number" 
                    className="border border-gray-300 px-2 py-1.5 rounded text-sm" 
                    placeholder="0"
                    min="0"
                  />
                </label>
                <label className="flex flex-col">
                  <span className="text-gray-600 mb-1">🔖 Bookmarks</span>
                  <input 
                    id="twitter-bookmarks-input"
                    type="number" 
                    className="border border-gray-300 px-2 py-1.5 rounded text-sm" 
                    placeholder="0"
                    min="0"
                  />
                </label>
                <label className="flex flex-col">
                  <span className="text-gray-600 mb-1">👁️ Views</span>
                  <input 
                    id="twitter-views-input"
                    type="number" 
                    className="border border-gray-300 px-2 py-1.5 rounded text-sm" 
                    placeholder="0"
                    min="0"
                  />
                </label>
              </div>
            </details>

            <button
              type="button"
              onClick={() => {
                const characterSelect = document.getElementById('twitter-character-select') as HTMLSelectElement;
                const tweetInput = document.getElementById('twitter-tweet-input') as HTMLTextAreaElement;
                const timestampInput = document.getElementById('twitter-timestamp-input') as HTMLInputElement;
                const likesInput = document.getElementById('twitter-likes-input') as HTMLInputElement;
                const retweetsInput = document.getElementById('twitter-retweets-input') as HTMLInputElement;
                const repliesInput = document.getElementById('twitter-replies-input') as HTMLInputElement;
                const bookmarksInput = document.getElementById('twitter-bookmarks-input') as HTMLInputElement;
                const viewsInput = document.getElementById('twitter-views-input') as HTMLInputElement;
                
                const content = tweetInput?.value.trim();
                if (!content) {
                  error('Please enter tweet text');
                  return;
                }
                
                const defaultTimestamp = new Date().toLocaleString('en-US', { 
                  hour: 'numeric', 
                  minute: '2-digit', 
                  hour12: true
                }) + ' · ' + new Date().toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                });
                
                const selectedCharId = characterSelect?.value;
                const selectedChar = selectedCharId ? characters.find(c => c.id === selectedCharId) : null;
                
                const newMsg: Message = {
                  id: crypto.randomUUID(),
                  sender: selectedChar ? selectedChar.name : (project.settings.twitterDisplayName || 'User'),
                  content: content,
                  outgoing: true,
                  timestamp: timestampInput?.value || defaultTimestamp,
                  attachments: newTweetImageUrl ? [{type: 'image', url: newTweetImageUrl}] : undefined,
                  twitterLikes: likesInput?.value === '' ? 0 : (parseInt(likesInput?.value) || 0),
                  twitterRetweets: retweetsInput?.value === '' ? 0 : (parseInt(retweetsInput?.value) || 0),
                  twitterReplies: repliesInput?.value === '' ? 0 : (parseInt(repliesInput?.value) || 0),
                  twitterBookmarks: bookmarksInput?.value === '' ? 0 : (parseInt(bookmarksInput?.value) || 0),
                  twitterViews: viewsInput?.value === '' ? 0 : (parseInt(viewsInput?.value) || 0),
                  useCustomIdentity: selectedChar ? true : false,
                  twitterHandle: selectedChar ? selectedChar.handle : undefined,
                  avatarUrl: selectedChar ? selectedChar.avatarUrl : undefined,
                  verified: selectedChar ? selectedChar.verified : undefined,
                };
                
                update('messages', [...project.messages, newMsg]);
                
                // Clear inputs
                if (characterSelect) characterSelect.value = '';
                if (tweetInput) tweetInput.value = '';
                if (timestampInput) timestampInput.value = '';
                if (likesInput) likesInput.value = '';
                if (retweetsInput) retweetsInput.value = '';
                if (repliesInput) repliesInput.value = '';
                if (bookmarksInput) bookmarksInput.value = '';
                if (viewsInput) viewsInput.value = '';
                setNewTweetImageUrl('');
              }}
              className="w-full px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-bold text-sm shadow-sm hover:shadow-md"
            >
              Tweet
            </button>
          </div>
            </div>
          )}
        </div>

        {/* SECTION 3: VISUAL THREAD TIMELINE */}
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <span>🧵</span>
              <span>Thread Timeline</span>
              <span className="bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full text-xs font-bold">
                {project.messages.length} tweet{project.messages.length !== 1 ? 's' : ''}
              </span>
            </h3>
            
            {/* Bulk Actions Toolbar */}
            {project.messages.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                {/* Bulk Timestamp Shift */}
                <div className="relative flex items-center gap-1 bg-gray-100 rounded-lg px-2 py-1">
                  <span className="text-xs text-gray-600">⏱️</span>
                  <button
                    type="button"
                    onClick={() => setShowShiftTimesDialog(true)}
                    className="text-xs text-gray-700 hover:text-blue-600 hover:bg-gray-200 px-1.5 py-0.5 rounded transition"
                    title="Shift all timestamps"
                  >
                    Shift Times
                  </button>
                  
                  {/* Shift Times Inline Dialog */}
                  {showShiftTimesDialog && (
                    <>
                      {/* Backdrop to close on outside click */}
                      <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setShowShiftTimesDialog(false)}
                      />
                      <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-3 z-50 min-w-[220px]">
                        <div className="text-xs font-medium text-gray-700 mb-2">Shift all timestamps by minutes</div>
                        <div className="text-xs text-gray-500 mb-2">(negative = earlier)</div>
                        <input
                          type="number"
                          value={shiftMinutesInput}
                          onChange={(e) => setShiftMinutesInput(e.target.value)}
                          className="w-full text-sm border border-gray-300 rounded px-2 py-1 mb-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                          placeholder="5"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const minutes = parseInt(shiftMinutesInput);
                              if (isNaN(minutes)) {
                                error('Please enter a valid number');
                                return;
                              }
                              
                              const updatedMessages = project.messages.map((msg) => {
                                if (!msg.timestamp) return msg;
                                const timeMatch = msg.timestamp.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
                                if (!timeMatch) return msg;
                                
                                let hours = parseInt(timeMatch[1]);
                                const mins = parseInt(timeMatch[2]);
                                const isPM = timeMatch[3]?.toUpperCase() === 'PM';
                                const isAM = timeMatch[3]?.toUpperCase() === 'AM';
                                
                                if (isPM && hours !== 12) hours += 12;
                                if (isAM && hours === 12) hours = 0;
                                
                                const date = new Date();
                                date.setHours(hours, mins + minutes);
                                
                                const newTime = date.toLocaleTimeString('en-US', { 
                                  hour: 'numeric', 
                                  minute: '2-digit', 
                                  hour12: !!(isAM || isPM || timeMatch[3])
                                });
                                
                                return { ...msg, timestamp: newTime };
                              });
                              update('messages', updatedMessages);
                              setShowShiftTimesDialog(false);
                              success(`Shifted all timestamps by ${minutes} minutes`);
                            }}
                            className="flex-1 text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 transition"
                          >
                            Apply
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowShiftTimesDialog(false)}
                            className="text-xs text-gray-600 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-100 transition"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                
                {/* Randomize Metrics */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowRandomizeDialog(true)}
                    className="text-xs bg-purple-100 text-purple-700 hover:bg-purple-200 px-2 py-1 rounded-lg transition flex items-center gap-1"
                    title="Generate realistic metrics"
                  >
                    🎲 Randomize Metrics
                  </button>
                  
                  {/* Randomize Metrics Inline Dialog */}
                  {showRandomizeDialog && (
                    <>
                      {/* Backdrop to close on outside click */}
                      <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setShowRandomizeDialog(false)}
                      />
                      <div className="absolute top-full right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-3 z-50 min-w-[240px]">
                        <div className="text-xs font-medium text-gray-700 mb-2">Base follower count</div>
                        <div className="text-xs text-gray-500 mb-2">Used to calculate realistic engagement</div>
                        <input
                          type="number"
                          value={baseFollowersInput}
                          onChange={(e) => setBaseFollowersInput(e.target.value)}
                          className="w-full text-sm border border-gray-300 rounded px-2 py-1 mb-2 focus:outline-none focus:ring-2 focus:ring-purple-400"
                          placeholder="10000"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const baseFollowers = parseInt(baseFollowersInput);
                              if (isNaN(baseFollowers) || baseFollowers < 0) {
                                error('Please enter a valid follower count');
                                return;
                              }
                              
                              const updatedMessages = project.messages.map((msg, idx) => {
                                const positionMultiplier = 1 - (idx * 0.05);
                                const variance = () => 0.5 + Math.random();
                                const baseEngagement = baseFollowers * 0.02 * positionMultiplier * variance();
                                
                                return {
                                  ...msg,
                                  twitterViews: Math.floor(baseEngagement * (10 + Math.random() * 20)),
                                  twitterLikes: Math.floor(baseEngagement * variance()),
                                  twitterRetweets: Math.floor(baseEngagement * 0.15 * variance()),
                                  twitterReplies: Math.floor(baseEngagement * 0.08 * variance()),
                                  twitterBookmarks: Math.floor(baseEngagement * 0.05 * variance()),
                                };
                              });
                              update('messages', updatedMessages);
                              setShowRandomizeDialog(false);
                              success('Randomized metrics for all tweets');
                            }}
                            className="flex-1 text-xs bg-purple-600 text-white px-2 py-1 rounded hover:bg-purple-700 transition"
                          >
                            Generate
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowRandomizeDialog(false)}
                            className="text-xs text-gray-600 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-100 transition"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {project.messages.length === 0 ? (
            <div className="text-center py-12 bg-white border-2 border-dashed border-gray-300 rounded-xl">
              <div className="text-5xl mb-3">🐦</div>
              <div className="font-medium text-gray-600">No tweets yet</div>
              <div className="text-sm text-gray-500 mt-2 max-w-xs mx-auto">
                <p className="mb-2">👆 Use the form above to compose tweets</p>
                <p className="text-xs text-gray-400">💡 Tips: Add characters first, then write your thread. You can add images, replies, and engagement metrics!</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3 max-h-[700px] overflow-y-auto bg-gray-50 border border-gray-300 rounded-lg p-3 sm:p-4">
              <p className="text-xs text-gray-500 text-center mb-2">💡 Drag tweets to reorder them</p>
              {project.messages.map((m, idx) => {
                const char = characters.find(c => m.useCustomIdentity && c.name === m.sender);
                const isReply = !!m.parentId;
                const isFocused = focusedMessageId === m.id;
                
                return (
                  <div 
                    key={m.id} 
                    id={`message-card-${m.id}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, idx)}
                    className={`group border border-gray-300 rounded-lg bg-white hover:shadow-md transition-all cursor-grab active:cursor-grabbing ${
                      isReply ? 'ml-4 sm:ml-8 border-l-4 border-l-blue-500' : ''
                    } ${dragOverIndex === idx ? 'border-2 border-blue-500 border-dashed scale-[1.02]' : ''} ${draggedIndex === idx ? 'opacity-50' : ''} ${isFocused ? 'message-card-focused ring-2 ring-blue-500 ring-offset-2' : ''}`}
                  >
                    {/* Tweet Header - Material Design */}
                    <div className="bg-white px-3 sm:px-4 py-3 border-b border-gray-200 flex items-center justify-between rounded-t-lg">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Drag handle */}
                        <span className="text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing mr-1" title="Drag to reorder">
                          ⋮⋮
                        </span>
                        <span className="text-sm sm:text-base font-medium flex items-center gap-1.5 text-gray-900">
                          𝕏
                          <span>Tweet #{idx + 1}</span>
                        </span>
                        {m.useCustomIdentity && char && (
                          <div className="flex items-center gap-1.5 bg-gray-100 px-2 py-1 rounded">
                            {char.avatarUrl ? (
                              <Image
                                src={char.avatarUrl}
                                alt={char.name}
                                width={16}
                                height={16}
                                className="rounded-full object-cover"
                                unoptimized={char.avatarUrl.startsWith('data:')}
                              />
                            ) : (
                              <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center text-white text-[10px] font-medium">
                                {char.name.substring(0, 1)}
                              </div>
                            )}
                            <span className="text-[10px] sm:text-xs text-gray-700 font-medium flex items-center gap-1">
                              <span className="hidden sm:inline">{char.name}</span>
                              <span className="sm:hidden">{char.name.split(' ')[0]}</span>
                              {char.verified && <span className="text-blue-500 text-xs">✓</span>}
                            </span>
                          </div>
                        )}
                        {isReply && (
                          <span className="text-[10px] sm:text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded font-medium">
                            💬 <span className="hidden sm:inline">Reply</span>
                          </span>
                        )}
                        {/* Character count preview */}
                        <span className={`text-[10px] px-2 py-1 rounded font-medium ml-auto sm:ml-0 ${
                          m.content.length > 280 ? 'bg-red-50 text-red-700' :
                          m.content.length > 260 ? 'bg-orange-50 text-orange-700' :
                          m.content.length > 200 ? 'bg-gray-100 text-gray-600' :
                          'bg-gray-50 text-gray-500'
                        }`}>
                          {m.content.length}/280
                        </span>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex items-center gap-0.5 sm:gap-1">
                        <button 
                          type="button" 
                          onClick={() => {
                            // Create a quick reply tweet after this one
                            const parentHandle = m.useCustomIdentity && m.twitterHandle 
                              ? m.twitterHandle 
                              : project.settings.twitterHandle || 'user';
                            const replyMsg: Message = {
                              id: crypto.randomUUID(),
                              sender: project.settings.twitterDisplayName || 'User',
                              content: '',
                              outgoing: true,
                              timestamp: m.timestamp || new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
                              parentId: m.id,
                              replyToHandles: [parentHandle],
                              twitterLikes: 0,
                              twitterRetweets: 0,
                              twitterReplies: 0,
                              twitterBookmarks: 0,
                              twitterViews: 0,
                            };
                            const newMessages = [...project.messages];
                            newMessages.splice(idx + 1, 0, replyMsg);
                            update('messages', newMessages);
                          }}
                          className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 text-xs sm:text-sm px-1.5 sm:px-2 py-1 rounded transition"
                          title="Quick reply to this tweet"
                        >
                          ↩ Reply
                        </button>
                        {idx > 0 && (
                          <button 
                            type="button" 
                            onClick={() => {
                              const newMessages = [...project.messages];
                              [newMessages[idx], newMessages[idx - 1]] = [newMessages[idx - 1], newMessages[idx]];
                              update('messages', newMessages);
                            }}
                            className="text-gray-400 hover:text-gray-700 hover:bg-white text-sm sm:text-base px-1.5 sm:px-2 py-1 rounded transition"
                            title="Move up"
                          >
                            ↑
                          </button>
                        )}
                        {idx < project.messages.length - 1 && (
                          <button 
                            type="button" 
                            onClick={() => {
                              const newMessages = [...project.messages];
                              [newMessages[idx], newMessages[idx + 1]] = [newMessages[idx + 1], newMessages[idx]];
                              update('messages', newMessages);
                            }}
                            className="text-gray-400 hover:text-gray-700 hover:bg-white text-sm sm:text-base px-1.5 sm:px-2 py-1 rounded transition"
                            title="Move down"
                          >
                            ↓
                          </button>
                        )}
                        <button 
                          type="button" 
                          onClick={async () => {
                            if (await confirm('Delete Tweet', 'Are you sure you want to delete this tweet?')) {
                              deleteMsg(m.id);
                            }
                          }}
                          className="text-red-500 hover:text-red-700 hover:bg-white font-bold text-base sm:text-lg leading-none px-1.5 sm:px-2 py-1 rounded transition"
                          title="Delete tweet"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                    
                    {/* Tweet Content - Directly Editable */}
                    <div className="p-4 space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-gray-700 uppercase tracking-wide">Content</label>
                        <div className="relative">
                          <textarea 
                            id={`tweet-content-${m.id}`}
                            className={`w-full text-sm text-gray-900 bg-white p-3 rounded border focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition ${
                              m.content.length > 280 ? 'border-red-500 bg-red-50' : 
                              m.content.length > 260 ? 'border-orange-500 bg-orange-50' : 
                              'border-gray-300'
                            }`}
                            rows={Math.max(3, Math.ceil(m.content.length / 60))} 
                            value={m.content} 
                            onChange={e => updateMsg(m.id, {content: e.target.value})}
                            placeholder="What's happening?"
                          />
                        </div>
                        <div className="flex items-center gap-1 flex-wrap">
                          {['😂', '❤️', '🔥', '👍', '😭', '🙏', '💀', '✨', '💯'].map(emoji => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => {
                                const textarea = document.getElementById(`tweet-content-${m.id}`) as HTMLTextAreaElement;
                                if (textarea) {
                                  const newContent = m.content + emoji;
                                  updateMsg(m.id, {content: newContent});
                                  textarea.focus();
                                }
                              }}
                              className="text-base hover:bg-gray-100 px-2 py-1 rounded transition"
                              title={`Add ${emoji}`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Avatar Selector - Quick Swap */}
                      {m.useCustomIdentity && char && (
                        <div>
                          <label className="text-xs font-medium text-gray-700 uppercase tracking-wide mb-2 block">
                            Character Avatar
                          </label>
                          <AvatarSelector
                            value={char.avatarUrl || ''}
                            onChange={(url) => {
                              // Update the character in the library
                              updateCharacter(char.id, { avatarUrl: url });
                              // Also update any messages using this character
                              const updatedMessages = project.messages.map(msg => 
                                msg.useCustomIdentity && msg.sender === char.name 
                                  ? { ...msg, avatarUrl: url }
                                  : msg
                              );
                              update('messages', updatedMessages);
                            }}
                            placeholder="Select or paste avatar URL"
                          />
                        </div>
                      )}

                      {/* Tweet Image */}
                      {m.attachments?.[0]?.url ? (
                        <div>
                          <label className="text-xs font-medium text-gray-700 uppercase tracking-wide mb-2 block">Image</label>
                          <div className="bg-gray-50 rounded p-3 border border-gray-300">
                            <div className="flex items-center gap-3">
                              <Image 
                                src={m.attachments[0].url} 
                                alt="Tweet image" 
                                width={128}
                                height={128}
                                className="rounded object-cover border border-gray-300"
                                unoptimized={m.attachments[0].url.startsWith('data:')}
                              />
                              <button
                                type="button"
                                onClick={() => updateMsg(m.id, {attachments: undefined})}
                                className="text-xs sm:text-sm text-red-600 hover:text-red-700 font-medium px-3 py-1.5 rounded hover:bg-red-50 transition"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <label className="text-xs font-medium text-gray-700 uppercase tracking-wide mb-2 block">Image</label>
                          <div className="flex items-center gap-2">
                            <input 
                              className="flex-1 border border-gray-300 px-3 py-2 rounded text-sm focus:ring-2 focus:ring-blue-500"
                              placeholder="Paste image URL (press Enter to add)"
                              title="Upload images free at imgur.com or imgbb.com"
                              onBlur={(e) => {
                                const url = e.target.value.trim();
                                if (url) {
                                  updateMsg(m.id, {attachments: [{type: 'image', url}]});
                                  e.target.value = '';
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const url = (e.target as HTMLInputElement).value.trim();
                                  if (url) {
                                    updateMsg(m.id, {attachments: [{type: 'image', url}]});
                                    (e.target as HTMLInputElement).value = '';
                                  }
                                }
                              }}
                            />

                          </div>
                        </div>
                      )}

                      {/* Engagement Metrics - Clean Grid Layout */}
                      <div>
                        <label className="text-xs font-medium text-gray-700 uppercase tracking-wide mb-2 block">Engagement</label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          <label className="flex flex-col gap-1.5">
                            <span className="text-xs text-gray-600 font-medium flex items-center gap-1">
                              ❤️ <span className="hidden sm:inline">Likes</span>
                            </span>
                            <input 
                              type="number" 
                              className="border border-gray-300 px-3 py-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                              value={m.twitterLikes || ''} 
                              onChange={e => updateMsg(m.id, {twitterLikes: e.target.value === '' ? 0 : parseInt(e.target.value) || 0})} 
                              placeholder="0"
                            />
                          </label>
                          <label className="flex flex-col gap-1.5">
                            <span className="text-xs text-gray-600 font-medium flex items-center gap-1">
                              🔄 <span className="hidden sm:inline">Retweets</span>
                            </span>
                            <input 
                              type="number" 
                              className="border border-gray-300 px-3 py-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                              value={m.twitterRetweets || ''} 
                              onChange={e => updateMsg(m.id, {twitterRetweets: e.target.value === '' ? 0 : parseInt(e.target.value) || 0})} 
                              placeholder="0"
                            />
                          </label>
                          <label className="flex flex-col gap-1.5">
                            <span className="text-xs text-gray-600 font-medium flex items-center gap-1">
                              💬 <span className="hidden sm:inline">Replies</span>
                            </span>
                            <input 
                              type="number" 
                              className="border border-gray-300 px-3 py-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                              value={m.twitterReplies || ''} 
                              onChange={e => updateMsg(m.id, {twitterReplies: e.target.value === '' ? 0 : parseInt(e.target.value) || 0})} 
                              placeholder="0"
                            />
                          </label>
                          <label className="flex flex-col gap-1.5">
                            <span className="text-xs text-gray-600 font-medium flex items-center gap-1">
                              🔖 <span className="hidden sm:inline">Bookmarks</span>
                            </span>
                            <input 
                              type="number" 
                              className="border border-gray-300 px-3 py-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                              value={m.twitterBookmarks || ''} 
                              onChange={e => updateMsg(m.id, {twitterBookmarks: e.target.value === '' ? 0 : parseInt(e.target.value) || 0})} 
                              placeholder="0"
                            />
                          </label>
                          <label className="flex flex-col gap-1.5">
                            <span className="text-xs text-gray-600 font-medium flex items-center gap-1">
                              👁️ <span className="hidden sm:inline">Views</span>
                            </span>
                            <input 
                              type="number" 
                              className="border border-gray-300 px-3 py-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                              value={m.twitterViews || ''} 
                              onChange={e => updateMsg(m.id, {twitterViews: e.target.value === '' ? 0 : parseInt(e.target.value) || 0})} 
                              placeholder="0"
                            />
                          </label>
                        </div>
                      </div>

                      {/* Advanced Options - Collapsible */}
                      <details className="border-t border-gray-200 pt-4">
                        <summary className="cursor-pointer text-gray-700 hover:text-gray-900 font-medium text-sm flex items-center gap-2">
                          <span>⚙️</span>
                          <span>Advanced Options</span>
                        </summary>
                        <div className="space-y-3 mt-4">
                          <label className="flex flex-col gap-1.5">
                            <span className="text-xs font-medium text-gray-700 uppercase tracking-wide">Custom Timestamp</span>
                            <input 
                              className="border border-gray-300 px-3 py-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                              value={m.timestamp || ''} 
                              onChange={e => updateMsg(m.id, {timestamp: e.target.value})} 
                              placeholder="e.g., 3:09 PM · Nov 25, 2025"
                            />
                          </label>
                          
                          {/* Reply Threading */}
                          <label className="flex items-center gap-2 text-sm cursor-pointer p-3 hover:bg-gray-50 rounded transition border border-gray-200">
                            <input 
                              type="checkbox" 
                              checked={!!m.parentId}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  const previousTweet = idx > 0 ? project.messages[idx - 1] : null;
                                  if (previousTweet) {
                                    const parentHandle = previousTweet.useCustomIdentity && previousTweet.twitterHandle 
                                      ? previousTweet.twitterHandle.replace(/^@/, '')
                                      : (project.settings.twitterHandle || '').replace(/^@/, '');
                                    updateMsg(m.id, { 
                                      parentId: previousTweet.id,
                                      replyToHandles: [parentHandle]
                                    });
                                  }
                                } else {
                                  updateMsg(m.id, { parentId: undefined, replyToHandles: undefined });
                                }
                              }}
                              className="w-4 h-4 rounded"
                            />
                            <span className="text-gray-700">Make this a reply to previous tweet</span>
                          </label>
                        </div>
                      </details>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <ConfirmModal />
    </div>
  );
}; 