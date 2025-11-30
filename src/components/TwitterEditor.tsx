import React, { useState } from 'react';
import { SkinProject, Message, TwitterCharacter } from '../lib/schema';
import { uploadImage, ImageUploadError } from '../lib/imgur';
import { useToast, ToastContainer } from './Toast';
import { 
  addCharacterToCache,
  removeCharacterFromCache,
  updateCharacterInCache 
} from '../lib/characterCache';

interface Props { 
  project: SkinProject; 
  onChange: (p: SkinProject) => void; 
}

export const TwitterEditor: React.FC<Props> = ({ project, onChange }) => {
  const [uploading, setUploading] = useState<string | null>(null);
  const [newTweetImageUrl, setNewTweetImageUrl] = useState('');
  const { toasts, removeToast, success, error, warning } = useToast();
  
  function update<K extends keyof SkinProject>(key: K, value: SkinProject[K]) {
    onChange({ ...project, [key]: value });
  }
  
  function updateSettings<K extends keyof SkinProject['settings']>(key: K, value: SkinProject['settings'][K]) {
    onChange({ ...project, settings: { ...project.settings, [key]: value } });
  }
  
  function updateMsg(id: string, patch: Partial<Message>) {
    const messages = project.messages.map(m => m.id === id ? { ...m, ...patch } : m);
    update('messages', messages);
  }
  
  function deleteMsg(id: string) {
    update('messages', project.messages.filter(m => m.id !== id));
  }
  
  function updateCharacter(charId: string, patch: Partial<TwitterCharacter>) {
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
  }
  
  function deleteCharacter(charId: string) {
    const presets = project.settings.twitterCharacterPresets || [];
    removeCharacterFromCache(charId);
    updateSettings('twitterCharacterPresets', presets.filter(c => c.id !== charId));
  }
  
  const characters = project.settings.twitterCharacterPresets || [];
  
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      <div className="p-4 space-y-4">
        {/* SECTION 1: CHARACTER LIBRARY - Horizontal Scrollable Cards */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <span>🎭</span>
              <span>Character Library</span>
              <span className="bg-purple-200 text-purple-800 px-2 py-0.5 rounded-full text-xs font-bold">
                {characters.length}
              </span>
            </h3>
            <button
              type="button"
              onClick={() => {
                const section = document.getElementById('twitter-add-char-form');
                if (section) {
                  section.classList.toggle('hidden');
                }
              }}
              className="px-3 py-1.5 bg-green-500 text-white rounded-full hover:bg-green-600 transition font-medium text-xs flex items-center gap-1 shadow-sm"
            >
              <span>+</span>
              <span>New Character</span>
            </button>
          </div>

          {/* Horizontal Scrollable Character Cards */}
          <div className="bg-white border-2 border-purple-300 rounded-xl p-3 shadow-sm">
            {characters.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                <div className="text-4xl mb-2">👥</div>
                <div className="font-medium">No characters yet</div>
                <div className="text-xs mt-1">Add one below or use Fast Thread Mode to auto-create!</div>
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
                        <img 
                          src={char.avatarUrl} 
                          alt={char.name} 
                          className="w-12 h-12 rounded-full object-cover border-2 border-purple-400 flex-shrink-0"
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
                        onClick={() => {
                          if (confirm(`Delete ${char.name}? Tweets using this character will keep their data.`)) {
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
                        <div className="flex gap-1">
                          <input 
                            className="border border-gray-200 px-2 py-1 rounded flex-1 text-xs focus:ring-2 focus:ring-purple-400" 
                            value={char.avatarUrl || ''}
                            onChange={(e) => updateCharacter(char.id, { avatarUrl: e.target.value })}
                            placeholder="Avatar URL"
                          />
                          <label className="cursor-pointer px-2 py-1 bg-gray-100 rounded hover:bg-gray-200 transition border border-gray-300 text-xs flex items-center">
                            {uploading === `char-avatar-${char.id}` ? '⏳' : '📷'}
                            <input 
                              type="file" 
                              accept="image/*" 
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                setUploading(`char-avatar-${char.id}`);
                                try {
                                  const url = await uploadImage(file);
                                  updateCharacter(char.id, { avatarUrl: url });
                                  success('Avatar uploaded successfully!');
                                } catch (err) {
                                  if (err instanceof ImageUploadError) {
                                    error(err.userMessage);
                                  } else {
                                    error('Failed to upload avatar. Please try again.');
                                  }
                                } finally {
                                  setUploading(null);
                                }
                              }}
                              className="hidden" 
                              disabled={uploading === `char-avatar-${char.id}`} 
                            />
                          </label>
                        </div>
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

          {/* Add Character Form (Collapsible) */}
          <div id="twitter-add-char-form" className="border-2 border-green-400 rounded-xl bg-green-50 p-4 space-y-3 hidden">
            <h4 className="font-bold text-sm text-green-800 flex items-center gap-2">
              <span>➕</span>
              <span>Add New Character</span>
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <input 
                id="twitter-new-char-name"
                className="border-2 border-gray-300 px-3 py-2 rounded-lg text-sm col-span-2 focus:ring-2 focus:ring-green-500 focus:border-green-500" 
                placeholder="Display Name (required)" 
              />
              <input 
                id="twitter-new-char-handle"
                className="border-2 border-gray-300 px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500" 
                placeholder="@handle (optional)" 
              />
              <div className="flex gap-2">
                <input 
                  id="twitter-new-char-avatar"
                  className="border-2 border-gray-300 px-3 py-2 rounded-lg text-sm flex-1 focus:ring-2 focus:ring-green-500 focus:border-green-500" 
                  placeholder="Avatar URL" 
                />
                <label className="cursor-pointer px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-medium border-2 border-gray-300 flex items-center">
                  {uploading === 'twitter-new-char-avatar' ? '⏳' : '📷'}
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setUploading('twitter-new-char-avatar');
                      try {
                        const url = await uploadImage(file);
                        const input = document.getElementById('twitter-new-char-avatar') as HTMLInputElement;
                        if (input) input.value = url;
                        success('Avatar uploaded successfully!');
                      } catch (err) {
                        if (err instanceof ImageUploadError) {
                          error(err.userMessage);
                        } else {
                          error('Failed to upload avatar. Please try again.');
                        }
                      } finally {
                        setUploading(null);
                      }
                    }}
                    className="hidden" 
                    disabled={uploading === 'twitter-new-char-avatar'} 
                  />
                </label>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input 
                id="twitter-new-char-verified"
                type="checkbox" 
                className="w-4 h-4 rounded" 
              />
              <span className="text-gray-700">✓ Verified account (blue checkmark)</span>
            </label>
            <button
              type="button"
              onClick={() => {
                const nameInput = document.getElementById('twitter-new-char-name') as HTMLInputElement;
                const handleInput = document.getElementById('twitter-new-char-handle') as HTMLInputElement;
                const avatarInput = document.getElementById('twitter-new-char-avatar') as HTMLInputElement;
                const verifiedInput = document.getElementById('twitter-new-char-verified') as HTMLInputElement;
                
                const name = nameInput?.value.trim();
                if (!name) {
                  warning('Please enter a character name');
                  return;
                }
                
                const handle = handleInput?.value.trim() || `@${name.toLowerCase().replace(/\s+/g, '')}`;
                const avatarUrl = avatarInput?.value.trim();
                const verified = verifiedInput?.checked || false;
                
                const newChar: TwitterCharacter = {
                  id: crypto.randomUUID(),
                  name,
                  handle,
                  avatarUrl: avatarUrl || undefined,
                  verified,
                };
                
                addCharacterToCache(newChar);
                const existing = project.settings.twitterCharacterPresets || [];
                updateSettings('twitterCharacterPresets', [...existing, newChar]);
                
                // Clear and hide
                if (nameInput) nameInput.value = '';
                if (handleInput) handleInput.value = '';
                if (avatarInput) avatarInput.value = '';
                if (verifiedInput) verifiedInput.checked = false;
                const section = document.getElementById('twitter-add-char-form');
                if (section) section.classList.add('hidden');
              }}
              className="w-full px-4 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition font-bold text-sm shadow-md hover:shadow-lg"
            >
              ➕ Add Character to Library
            </button>
          </div>
        </div>

        {/* SECTION 2: TWEET COMPOSER */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <span>✏️</span>
            <span>Compose Tweet</span>
          </h3>

          {/* Quick Settings Bar */}
          <div className="bg-white border-2 border-blue-200 rounded-xl p-3 shadow-sm">
            <div className="grid grid-cols-2 gap-3 text-xs">
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
              <div className="flex flex-col justify-end">
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Clear all tweets? This cannot be undone.')) {
                      update('messages', []);
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
                    <img 
                      src={newTweetImageUrl} 
                      alt="Tweet" 
                      className="w-16 h-16 rounded-lg object-cover border-2 border-gray-300"
                    />
                  )}
                  <label className="cursor-pointer px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-xs font-medium border-2 border-gray-300">
                    {uploading === 'twitter-tweet-image' ? 'Uploading...' : newTweetImageUrl ? '✓ Change Image' : '📷 Upload Image'}
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploading('twitter-tweet-image');
                        try {
                          const url = await uploadImage(file);
                          setNewTweetImageUrl(url);
                          success('Tweet image uploaded successfully!');
                        } catch (err) {
                          if (err instanceof ImageUploadError) {
                            error(err.userMessage);
                          } else {
                            error('Failed to upload image. Please try again.');
                          }
                        } finally {
                          setUploading(null);
                        }
                      }}
                      className="hidden" 
                      disabled={uploading === 'twitter-tweet-image'} 
                    />
                  </label>
                  {newTweetImageUrl && (
                    <button
                      type="button"
                      onClick={() => setNewTweetImageUrl('')}
                      className="text-red-500 hover:text-red-700 text-xs px-2 py-1 font-medium"
                    >
                      Remove
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

        {/* SECTION 3: VISUAL THREAD TIMELINE */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <span>🧵</span>
              <span>Thread Timeline</span>
              <span className="bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full text-xs font-bold">
                {project.messages.length} tweet{project.messages.length !== 1 ? 's' : ''}
              </span>
            </h3>
          </div>

          {project.messages.length === 0 ? (
            <div className="text-center py-12 bg-white border-2 border-dashed border-gray-300 rounded-xl">
              <div className="text-5xl mb-3">🐦</div>
              <div className="font-medium text-gray-400">No tweets yet</div>
              <div className="text-xs text-gray-400 mt-1">Compose your first tweet above!</div>
            </div>
          ) : (
            <div className="space-y-3 max-h-[700px] overflow-y-auto bg-gray-50 border border-gray-300 rounded-lg p-3 sm:p-4">
              {project.messages.map((m, idx) => {
                const char = characters.find(c => m.useCustomIdentity && c.name === m.sender);
                const isReply = !!m.parentId;
                
                return (
                  <div 
                    key={m.id} 
                    id={`tweet-card-${idx}`}
                    className={`group border border-gray-300 rounded-lg bg-white hover:shadow-md transition-shadow ${
                      isReply ? 'ml-4 sm:ml-8 border-l-4 border-l-blue-500' : ''
                    }`}
                  >
                    {/* Tweet Header - Material Design */}
                    <div className="bg-white px-3 sm:px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm sm:text-base font-medium flex items-center gap-1.5 text-gray-900">
                          𝕏
                          <span>Tweet #{idx + 1}</span>
                        </span>
                        {m.useCustomIdentity && char && (
                          <div className="flex items-center gap-1.5 bg-gray-100 px-2 py-1 rounded">
                            {char.avatarUrl ? (
                              <img src={char.avatarUrl} alt={char.name} className="w-4 h-4 rounded-full object-cover" />
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
                          onClick={() => {
                            if (confirm('Delete this tweet?')) {
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

                      {/* Tweet Image */}
                      {m.attachments?.[0]?.url ? (
                        <div>
                          <label className="text-xs font-medium text-gray-700 uppercase tracking-wide mb-2 block">Image</label>
                          <div className="bg-gray-50 rounded p-3 border border-gray-300">
                            <div className="flex items-center gap-3">
                              <img 
                                src={m.attachments[0].url} 
                                alt="Tweet image" 
                                className="w-24 h-24 sm:w-32 sm:h-32 rounded object-cover border border-gray-300"
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
                          <label className="cursor-pointer flex items-center justify-center gap-2 px-4 py-3 bg-white text-gray-700 rounded border border-gray-300 hover:bg-gray-50 transition text-sm font-medium">
                            {uploading === `tweet-img-${m.id}` ? '⏳ Uploading...' : '📷 Add Image'}
                            <input 
                              type="file" 
                              accept="image/*" 
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                setUploading(`tweet-img-${m.id}`);
                                try {
                                  const url = await uploadImage(file);
                                  updateMsg(m.id, {attachments: [{type: 'image', url}]});
                                  success('Image added to tweet!');
                                } catch (err) {
                                  if (err instanceof ImageUploadError) {
                                    error(err.userMessage);
                                  } else {
                                    error('Failed to upload image. Please try again.');
                                  }
                                } finally {
                                  setUploading(null);
                                }
                              }}
                              className="hidden" 
                              disabled={uploading === `tweet-img-${m.id}`} 
                            />
                          </label>
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
    </div>
  );
}; 