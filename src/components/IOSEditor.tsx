import React, { useState, useCallback, useEffect, useRef } from 'react';
import Image from 'next/image';
import { SkinProject, Message, UniversalCharacter, GroupParticipant } from '../lib/schema';
import { useToast, ToastContainer } from './Toast';
import { useConfirm } from './ConfirmModal';

import { useProjectEditor } from '../hooks/useProjectEditor';
import FastModeInput from './FastModeInput';
import { CompactMessageCard } from './CompactMessageCard';
import { normalizeImageUrl } from '../lib/urlNormalize';

// Predefined color palette for participants
const PARTICIPANT_COLORS = [
  '#FF5733', // Red-Orange
  '#3498DB', // Blue
  '#9B59B6', // Purple
  '#E67E22', // Orange
  '#27AE60', // Green
  '#E91E63', // Pink
  '#F39C12', // Yellow
  '#1ABC9C', // Teal
];

interface Props { 
  project: SkinProject; 
  onChange: (p: SkinProject) => void;
  universalCharacters?: UniversalCharacter[];
  focusedMessageId?: string | null;
  focusTrigger?: number;
}

export const IOSEditor: React.FC<Props> = ({ project, onChange, universalCharacters = [], focusedMessageId, focusTrigger }) => {
  // Use shared project editor hook
  const { update, updateSettings, updateMsg, deleteMsg, addMessages } = useProjectEditor(project, onChange);
  
  const { toasts, removeToast, success, error } = useToast();
  const { confirm, ConfirmModal } = useConfirm();
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const messageListRef = useRef<HTMLDivElement>(null);
  
  // Settings panel collapse state
  const [settingsOpen, setSettingsOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ao3skin_ios_settings_open');
      return saved ? saved === 'true' : false; // Default: collapsed
    }
    return false;
  });
  
  // Compose mode toggle state
  const [composeMode, setComposeMode] = useState<'fast' | 'detailed'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ao3skin_ios_compose_mode');
      return (saved as 'fast' | 'detailed') || 'fast'; // Default: Fast Mode
    }
    return 'fast';
  });
  
  // Save settings panel state to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ao3skin_ios_settings_open', String(settingsOpen));
    }
  }, [settingsOpen]);
  
  // Save compose mode to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ao3skin_ios_compose_mode', composeMode);
    }
  }, [composeMode]);
  
  // Compact card state - track which messages are expanded
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  
  // Character library modal for participants
  const [showCharacterLibrary, setShowCharacterLibrary] = useState(false);
  
  const isIMessage = project.settings.iosMode !== 'sms';

  // Auto-expand focused message when clicking from preview
  useEffect(() => {
    if (focusedMessageId) {
      setExpandedMessages(prev => new Set(prev).add(focusedMessageId));
    }
  }, [focusedMessageId, focusTrigger]);

  // Scroll to focused message when focusedMessageId or focusTrigger changes
  useEffect(() => {
    if (focusedMessageId) {
      // Small delay to allow React to render the expanded card
      setTimeout(() => {
        const element = document.getElementById(`message-card-${focusedMessageId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Add highlight class
          element.classList.add('message-card-focused');
          // Remove after animation
          setTimeout(() => {
            element.classList.remove('message-card-focused');
          }, 3000);
        }
      }, 100);
    }
  }, [focusedMessageId, focusTrigger]);
  
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      <div className="p-4 space-y-4">
        {/* SECTION 1: PHONE SETTINGS (Collapsible) */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors group"
          >
            <div className="flex items-center gap-2">
              <span>⚙️</span>
              <h3 className="text-sm font-bold text-gray-800">{isIMessage ? 'iMessage' : 'SMS'} Settings</h3>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                {settingsOpen ? 'Click to hide' : 'Click to customize'}
              </span>
            </div>
            <span className={`text-gray-500 transition-transform duration-200 ${settingsOpen ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </button>

          {settingsOpen && (
            <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 space-y-4 animate-fadeIn">{/* animate-fadeIn - add to globals.css if needed */}
            <label className="flex flex-col">
              <span className="text-xs font-medium text-gray-700 uppercase tracking-wide mb-2">Message Type</span>
              <select 
                aria-label="Message type - iMessage or SMS"
                value={project.settings.iosMode || 'imessage'} 
                onChange={e => updateSettings('iosMode', e.target.value as 'imessage' | 'sms')} 
                className="w-full text-sm text-gray-900 bg-white p-3 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              >
                <option value="imessage">💙 iMessage (Blue bubbles)</option>
                <option value="sms">💚 SMS/Text (Green bubbles)</option>
              </select>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex flex-col">
                <span className="text-xs font-medium text-gray-700 uppercase tracking-wide mb-2">Max Width (px)</span>
                <input 
                  type="number" 
                  min={280} 
                  max={600} 
                  value={project.settings.maxWidthPx} 
                  onChange={e => updateSettings('maxWidthPx', parseInt(e.target.value))} 
                  className="w-full text-sm text-gray-900 bg-white p-3 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </label>

              <label className="flex flex-col">
                <span className="text-xs font-medium text-gray-700 uppercase tracking-wide mb-2">Contact Name</span>
                <input 
                  className="w-full text-sm text-gray-900 bg-white p-3 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" 
                  value={project.settings.iosContactName || ''} 
                  onChange={e => updateSettings('iosContactName', e.target.value)} 
                  placeholder="John Doe" 
                />
              </label>
            </div>

            <label className="flex flex-col">
              <span className="text-xs font-medium text-gray-700 uppercase tracking-wide mb-2">Profile Picture URL</span>
              <div className="flex items-center gap-3">
                {project.settings.iosAvatarUrl && (
                  <div className="relative">
                    <Image 
                      src={project.settings.iosAvatarUrl} 
                      alt="Profile" 
                      width={64}
                      height={64}
                      className="rounded-full object-cover border border-gray-300"
                      unoptimized
                    />
                    <button
                      type="button"
                      onClick={() => updateSettings('iosAvatarUrl', '')}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-white rounded-full text-xs hover:bg-red-700 transition flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-red-500"
                      title="Remove photo"
                    >
                      ×
                    </button>
                  </div>
                )}
                <input 
                  className="flex-1 text-sm text-gray-900 bg-white p-3 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  value={project.settings.iosAvatarUrl || ''}
                  onChange={e => updateSettings('iosAvatarUrl', e.target.value)}
                  placeholder="Paste image URL"
                />

              </div>
              <p className="text-xs text-gray-500 mt-1">💡 Paste from <a href="https://imgbb.com" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">imgbb.com</a> or any direct image URL</p>
            </label>

            <div className="border-t border-gray-200 pt-4 space-y-3">
              <h4 className="text-xs font-medium text-gray-700 uppercase tracking-wide mb-2">Display Options</h4>
              
              <label className="flex items-center gap-2 text-sm text-gray-900">
                <input 
                  type="checkbox" 
                  checked={project.settings.iosShowHeader || false} 
                  onChange={e => updateSettings('iosShowHeader', e.target.checked)} 
                  className="w-4 h-4 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
                />
                <span>Show "To: [Contact]" header</span>
              </label>

              <label className="flex items-center gap-2 text-sm text-gray-900">
                <input 
                  type="checkbox" 
                  checked={project.settings.iosShowReadReceipt || false} 
                  onChange={e => updateSettings('iosShowReadReceipt', e.target.checked)} 
                  className="w-4 h-4 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
                />
                <span>Show "Read" status on last message</span>
              </label>

              <label className="flex items-center gap-2 text-sm text-gray-900">
                <input 
                  type="checkbox" 
                  checked={project.settings.chatShowTyping || false} 
                  onChange={e => updateSettings('chatShowTyping', e.target.checked)} 
                  className="w-4 h-4 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
                />
                <span>Show typing indicator "..."</span>
              </label>

              {project.settings.chatShowTyping && (
                <input 
                  className="w-full text-sm text-gray-900 bg-white p-3 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition ml-6" 
                  value={project.settings.chatTypingName || ''} 
                  onChange={e => updateSettings('chatTypingName', e.target.value)} 
                  placeholder="typing..."
                />
              )}

              <label className="flex items-center gap-2 text-sm text-gray-900">
                <input 
                  type="checkbox" 
                  checked={project.settings.iosDarkMode || false} 
                  onChange={e => updateSettings('iosDarkMode', e.target.checked)} 
                  className="w-4 h-4 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
                />
                <span>🌙 Dark mode</span>
              </label>
              
              <label className="flex items-center gap-2 text-sm text-gray-900 pt-2 border-t border-gray-200 mt-3">
                <input 
                  type="checkbox" 
                  checked={project.settings.iosGroupMode || false} 
                  onChange={e => {
                    updateSettings('iosGroupMode', e.target.checked);
                    // Initialize participants array if enabling for first time
                    if (e.target.checked && !project.settings.iosGroupParticipants) {
                      updateSettings('iosGroupParticipants', []);
                    }
                  }}
                  className="w-4 h-4 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
                />
                <span className="font-medium">👥 Enable Group Chat</span>
              </label>
              
              {project.settings.iosGroupMode && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                  <label className="flex flex-col text-sm">
                    <span className="font-medium mb-2 text-gray-700">Group Name</span>
                    <input 
                      className="border-2 border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500" 
                      value={project.settings.iosGroupName || ''} 
                      onChange={e => updateSettings('iosGroupName', e.target.value)} 
                      placeholder="e.g., Family Chat, Squad" 
                    />
                  </label>
                  
                  <div className="text-xs text-gray-600 bg-white p-2 rounded border border-blue-200">
                    💡 <strong>Group Mode:</strong> Shows sender names above incoming messages. Add participants below to assign messages.
                  </div>
                  
                  {/* Participants List */}
                  <div className="border-t border-blue-300 pt-3 mt-3">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-bold text-gray-800">
                        👥 Participants ({(project.settings.iosGroupParticipants || []).length})
                      </h4>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const participants = project.settings.iosGroupParticipants || [];
                            const colorIndex = participants.length % PARTICIPANT_COLORS.length;
                            const newParticipant: GroupParticipant = {
                              id: crypto.randomUUID(),
                              name: `Person ${participants.length + 1}`,
                              color: PARTICIPANT_COLORS[colorIndex],
                            };
                            updateSettings('iosGroupParticipants', [...participants, newParticipant]);
                            success('Participant added!');
                          }}
                          className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition font-medium"
                        >
                          + Add Participant
                        </button>
                        {universalCharacters.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setShowCharacterLibrary(true)}
                            className="text-xs bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-3 py-1.5 rounded-lg hover:from-blue-600 hover:to-cyan-600 transition font-medium shadow-sm"
                          >
                            📚 Add from Library [{universalCharacters.length}]
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {(!project.settings.iosGroupParticipants || project.settings.iosGroupParticipants.length === 0) ? (
                      <div className="text-center py-6 bg-white border-2 border-dashed border-gray-300 rounded-lg">
                        <div className="text-3xl mb-2">👥</div>
                        <div className="text-sm text-gray-600">No participants yet</div>
                        <div className="text-xs text-gray-500 mt-1">Add at least 2 members for group chat</div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {project.settings.iosGroupParticipants.map((participant, idx) => (
                          <div key={participant.id} className="bg-white border-2 border-gray-300 rounded-lg p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {participant.avatarUrl && (
                                  <Image 
                                    src={participant.avatarUrl} 
                                    alt={participant.name} 
                                    width={32}
                                    height={32}
                                    className="rounded-full object-cover"
                                    unoptimized
                                  />
                                )}
                                <div 
                                  className="w-3 h-3 rounded-full" 
                                  style={{ backgroundColor: participant.color }}
                                  title="Participant color"
                                />
                                <span className="font-medium text-sm">{participant.name}</span>
                              </div>
                              <button
                                type="button"
                                onClick={async () => {
                                  if (await confirm('Delete Participant', `Remove "${participant.name}" from group?`)) {
                                    const updated = project.settings.iosGroupParticipants!.filter(p => p.id !== participant.id);
                                    updateSettings('iosGroupParticipants', updated);
                                    success('Participant removed');
                                  }
                                }}
                                className="text-red-600 hover:text-red-700 text-xs px-2 py-1 hover:bg-red-50 rounded"
                              >
                                Remove
                              </button>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2">
                              <input 
                                className="border border-gray-300 px-2 py-1 rounded text-xs focus:ring-1 focus:ring-blue-500" 
                                value={participant.name} 
                                onChange={e => {
                                  const updated = project.settings.iosGroupParticipants!.map(p =>
                                    p.id === participant.id ? { ...p, name: e.target.value } : p
                                  );
                                  updateSettings('iosGroupParticipants', updated);
                                }}
                                placeholder="Name" 
                              />
                              <input 
                                type="color"
                                className="border border-gray-300 rounded h-8 w-full cursor-pointer" 
                                value={participant.color} 
                                onChange={e => {
                                  const updated = project.settings.iosGroupParticipants!.map(p =>
                                    p.id === participant.id ? { ...p, color: e.target.value } : p
                                  );
                                  updateSettings('iosGroupParticipants', updated);
                                }}
                                title="Name color"
                              />
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <input 
                                className="flex-1 border border-gray-300 px-2 py-1 rounded text-xs focus:ring-1 focus:ring-blue-500" 
                                value={participant.avatarUrl || ''} 
                                onChange={e => {
                                  const updated = project.settings.iosGroupParticipants!.map(p =>
                                    p.id === participant.id ? { ...p, avatarUrl: e.target.value } : p
                                  );
                                  updateSettings('iosGroupParticipants', updated);
                                }}
                                placeholder="Avatar URL (optional)" 
                              />

                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            </div>
          )}
        </div>

        {/* UNIFIED COMPOSE SECTION */}
        <div className="border border-blue-300 rounded-lg p-4 bg-white space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <span>✏️</span>
              <span>Compose Messages</span>
            </h4>
            
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
                title="Quick message creation with compact cards"
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
                title="Full form with all message options"
              >
                📝 Detailed
              </button>
            </div>
          </div>

          {/* Fast Mode */}
          {composeMode === 'fast' && (
            <div className="animate-fadeIn">
              <FastModeInput
                inputId="ios-fast-mode-input"
                platform="ios"
                onAddMessages={(messages) => update('messages', [...project.messages, ...messages])}
                onSuccess={success}
                onError={error}
                defaultContactName="Contact"
                universalCharacters={universalCharacters}
              />
            </div>
          )}

          {/* Detailed Mode */}
          {composeMode === 'detailed' && (
            <div className="space-y-4 animate-fadeIn">{/* Single message composer content */}

          <label className="flex flex-col">
            <span className="text-xs font-medium text-gray-700 uppercase tracking-wide mb-2">Direction</span>
            <select
              id="ios-message-direction"
              aria-label="Message direction - outgoing or incoming"
              className="w-full text-sm text-gray-900 bg-white p-3 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            >
              <option value="outgoing">📤 Outgoing ({isIMessage ? 'Blue' : 'Green'} bubble)</option>
              <option value="incoming">📥 Incoming (Gray bubble)</option>
            </select>
          </label>

          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-700 uppercase tracking-wide">Content</label>
            <textarea 
              id="ios-message-input"
              className="w-full text-sm text-gray-900 bg-white p-3 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition" 
              rows={3}
              placeholder="Type your message..."
            />
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-xs text-gray-500 mr-2">Quick emojis:</span>
              {['😂', '❤️', '🔥', '👍', '😭', '🙏', '💀', '✨', '💯'].map(emoji => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    const input = document.getElementById('ios-message-input') as HTMLTextAreaElement;
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex flex-col">
              <span className="text-xs font-medium text-gray-700 uppercase tracking-wide mb-2">⏰ Timestamp</span>
              <input 
                id="ios-message-timestamp"
                type="text"
                className="w-full text-sm text-gray-900 bg-white p-3 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" 
                placeholder="2:34 PM"
              />
            </label>

            <label className="flex flex-col">
              <span className="text-xs font-medium text-gray-700 uppercase tracking-wide mb-2">💝 Reaction</span>
              <select
                id="ios-message-reaction"
                aria-label="Message reaction emoji"
                className="w-full text-sm text-gray-900 bg-white p-3 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              >
                <option value="">None</option>
                <option value="❤️">❤️ Heart</option>
                <option value="👍">👍 Thumbs Up</option>
                <option value="👎">👎 Thumbs Down</option>
                <option value="😂">😂 Laugh</option>
                <option value="😮">😮 Surprise</option>
                <option value="😢">😢 Sad</option>
                <option value="❗">❗ Exclamation</option>
                <option value="❓">❓ Question</option>
              </select>
            </label>
          </div>

          <label className="flex flex-col">
            <span className="text-xs font-medium text-gray-700 uppercase tracking-wide mb-2 flex items-center gap-1">
              <span>📷</span>
              <span>Message Image URL</span>
            </span>
            <div className="flex items-center gap-2">
              <input 
                id="ios-message-image-url"
                type="text"
                className="flex-1 text-sm text-gray-900 bg-white p-3 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" 
                placeholder="Paste image URL from Imgur, ImgBB, Google Drive, etc."
                title="Paste any image address — share-page URLs are auto-converted"
              />

            </div>
            <p className="text-xs text-gray-500 mt-1">💡 Paste from <a href="https://imgbb.com" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">ImgBB</a>, <a href="https://imgur.com" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Imgur</a>, Google Drive, Dropbox, and more — share-page URLs converted automatically</p>
          </label>

          <button
            type="button"
            onClick={() => {
              const directionSelect = document.getElementById('ios-message-direction') as HTMLSelectElement;
              const messageInput = document.getElementById('ios-message-input') as HTMLTextAreaElement;
              const timestampInput = document.getElementById('ios-message-timestamp') as HTMLInputElement;
              const reactionSelect = document.getElementById('ios-message-reaction') as HTMLSelectElement;
              const imageInput = document.getElementById('ios-message-image-url') as HTMLInputElement;
              
              const content = messageInput?.value.trim();
              const imageUrl = normalizeImageUrl(imageInput?.value.trim() || '');
              
              if (!content && !imageUrl) {
                error('Please enter message text or add an image');
                return;
              }
              
              const outgoing = directionSelect?.value === 'outgoing';
              
              const newMsg: Message = {
                id: crypto.randomUUID(),
                sender: outgoing ? 'You' : 'Contact',
                content: content,
                outgoing: outgoing,
                timestamp: timestampInput?.value || '',
                reaction: reactionSelect?.value || undefined,
                attachments: imageUrl ? [{type: 'image', url: imageUrl}] : undefined,
              };
              
              update('messages', [...project.messages, newMsg]);
              
              // Clear inputs
              if (messageInput) messageInput.value = '';
              if (timestampInput) timestampInput.value = '';
              if (reactionSelect) reactionSelect.value = '';
              if (imageInput) imageInput.value = '';
            }}
            className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded transition font-medium text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            💬 Add Message
          </button>
            </div>
          )}
        </div>

        {/* SECTION 4: MESSAGE TIMELINE */}
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
              <span>💬</span>
              <span>Conversation Timeline</span>
              <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs font-medium">
                {project.messages.length}
              </span>
            </h3>
            <div className="flex items-center gap-2">
              {project.messages.length > 0 && (
                <>
                  {/* Expand/Collapse All */}
                  <div className="flex items-center border border-gray-200 rounded overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandedMessages(new Set(project.messages.map(m => m.id)))}
                      className={`text-[10px] px-2 py-1 transition ${expandedMessages.size === project.messages.length ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}
                      title="Expand all messages"
                    >
                      ▼ All
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpandedMessages(new Set())}
                      className={`text-[10px] px-2 py-1 transition ${expandedMessages.size === 0 ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}
                      title="Collapse all messages"
                    >
                      ▲ All
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      // Generate smart timestamps (1-5 min gaps)
                      const startTime = new Date();
                      startTime.setHours(10, 0, 0, 0); // Start at 10:00 AM
                      
                      const updatedMessages = project.messages.map((msg, idx) => {
                        const minGap = 1 + Math.random() * 4; // 1-5 minutes
                        startTime.setMinutes(startTime.getMinutes() + minGap);
                        const timestamp = startTime.toLocaleTimeString('en-US', { 
                          hour: 'numeric', 
                          minute: '2-digit' 
                        });
                        return { ...msg, timestamp };
                      });
                      
                      update('messages', updatedMessages);
                      success('Timestamps generated!');
                    }}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium px-3 py-1.5 rounded hover:bg-blue-50 transition"
                    title="Auto-generate realistic timestamps"
                  >
                    🕐 Auto-Time
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (await confirm('Clear All Messages', 'Are you sure you want to delete all messages? This cannot be undone.')) {
                        update('messages', []);
                        setSelectedMessages(new Set());
                        success('All messages cleared');
                      }
                    }}
                    className="text-xs text-red-600 hover:text-red-700 font-medium px-3 py-1.5 rounded hover:bg-red-50 transition focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    🗑️ Clear All
                  </button>
                </>
              )}
            </div>
          </div>
          
          {/* Bulk Operations Toolbar */}
          {selectedMessages.size > 0 && (
            <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-3 flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-blue-900">
                {selectedMessages.size} selected
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const updatedMessages = project.messages.map(msg =>
                      selectedMessages.has(msg.id) ? { ...msg, outgoing: !msg.outgoing } : msg
                    );
                    update('messages', updatedMessages);
                    success(`Flipped ${selectedMessages.size} messages`);
                  }}
                  className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 transition font-medium"
                >
                  🔄 Flip Direction
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (await confirm('Delete Selected', `Delete ${selectedMessages.size} messages?`)) {
                      const updatedMessages = project.messages.filter(msg => !selectedMessages.has(msg.id));
                      update('messages', updatedMessages);
                      setSelectedMessages(new Set());
                      success('Messages deleted');
                    }
                  }}
                  className="text-xs bg-red-600 text-white px-3 py-1.5 rounded hover:bg-red-700 transition font-medium"
                >
                  🗑️ Delete
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedMessages(new Set())}
                  className="text-xs text-gray-600 hover:text-gray-800 px-2 py-1.5"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {project.messages.length === 0 ? (
            <div className="text-center py-12 bg-white border border-dashed border-gray-300 rounded-lg">
              <div className="text-5xl mb-3">📱</div>
              <div className="font-medium text-gray-600">No messages yet</div>
              <div className="text-sm text-gray-500 mt-2 max-w-xs mx-auto">
                <p className="mb-2">👆 Use the form above to add messages</p>
                <p className="text-xs text-gray-400">💡 Tips: Toggle between incoming/outgoing messages. Add reactions, timestamps, and images!</p>
              </div>
            </div>
          ) : (
            <div 
              id="ios-messages-container"
              className="space-y-2 max-h-[700px] overflow-y-auto bg-gray-50 border border-gray-200 rounded-lg p-2 sm:p-3"
            >
              {project.messages.map((m, idx) => {
                const isFocused = focusedMessageId === m.id;
                const isExpanded = expandedMessages.has(m.id);
                
                return (
                  <CompactMessageCard
                    key={m.id}
                    message={m}
                    index={idx}
                    totalMessages={project.messages.length}
                    isExpanded={isExpanded}
                    isFocused={isFocused}
                    isSelected={selectedMessages.has(m.id)}
                    isGroupMode={project.settings.iosGroupMode || false}
                    groupParticipants={project.settings.iosGroupParticipants || []}
                    onToggleExpand={() => {
                      setExpandedMessages(prev => {
                        const next = new Set(prev);
                        if (next.has(m.id)) {
                          next.delete(m.id);
                        } else {
                          next.add(m.id);
                        }
                        return next;
                      });
                    }}
                    onToggleSelect={(selected) => {
                      setSelectedMessages(prev => {
                        const next = new Set(prev);
                        if (selected) {
                          next.add(m.id);
                        } else {
                          next.delete(m.id);
                        }
                        return next;
                      });
                    }}
                    onUpdate={(updates) => updateMsg(m.id, updates)}
                    onDelete={async () => {
                      if (await confirm('Delete Message', 'Are you sure you want to delete this message?')) {
                        deleteMsg(m.id);
                      }
                    }}
                    onDuplicate={() => {
                      const duplicated: Message = { ...m, id: crypto.randomUUID() };
                      const newMessages = [...project.messages];
                      newMessages.splice(idx + 1, 0, duplicated);
                      update('messages', newMessages);
                      success('Message duplicated');
                    }}
                    onMoveUp={() => {
                      if (idx > 0) {
                        const newMessages = [...project.messages];
                        [newMessages[idx], newMessages[idx - 1]] = [newMessages[idx - 1], newMessages[idx]];
                        update('messages', newMessages);
                      }
                    }}
                    onMoveDown={() => {
                      if (idx < project.messages.length - 1) {
                        const newMessages = [...project.messages];
                        [newMessages[idx], newMessages[idx + 1]] = [newMessages[idx + 1], newMessages[idx]];
                        update('messages', newMessages);
                      }
                    }}

                    template="ios"
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <ConfirmModal />
      
      {/* Character Library Modal */}
      {showCharacterLibrary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowCharacterLibrary(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-blue-500 to-cyan-500 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-white text-xl font-bold">📚 Character Library</h3>
                <p className="text-blue-50 text-sm mt-0.5">Click a character to add them to participants</p>
              </div>
              <button 
                onClick={() => setShowCharacterLibrary(false)}
                className="text-white hover:bg-white/20 rounded-lg p-2 transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
              {universalCharacters.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📚</div>
                  <p className="text-gray-600 font-medium">No characters saved yet</p>
                  <p className="text-gray-500 text-sm mt-2">Use the Character Bank tab to save reusable characters</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {universalCharacters.map(char => {
                    const participants = project.settings.iosGroupParticipants || [];
                    const alreadyAdded = participants.some(p => 
                      p.name.toLowerCase() === char.name.toLowerCase() || 
                      p.avatarUrl === char.avatarUrl
                    );
                    
                    return (
                      <button
                        key={char.id}
                        onClick={() => {
                          if (alreadyAdded) {
                            error('Character already added!');
                            return;
                          }
                          
                          const colorIndex = participants.length % PARTICIPANT_COLORS.length;
                          const newParticipant: GroupParticipant = {
                            id: crypto.randomUUID(),
                            name: char.name,
                            color: PARTICIPANT_COLORS[colorIndex],
                            avatarUrl: char.avatarUrl,
                          };
                          
                          updateSettings('iosGroupParticipants', [...participants, newParticipant]);
                          success(`${char.name} added to participants!`);
                          setShowCharacterLibrary(false);
                        }}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${
                          alreadyAdded 
                            ? 'border-gray-300 bg-gray-100 opacity-60 cursor-not-allowed' 
                            : 'border-gray-200 hover:border-blue-500 hover:shadow-lg hover:scale-105'
                        }`}
                        disabled={alreadyAdded}
                      >
                        <div className="flex flex-col items-center gap-2">
                          {char.avatarUrl ? (
                            <img 
                              src={char.avatarUrl} 
                              alt={char.name}
                              className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center text-white text-2xl font-bold">
                              {char.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="text-center w-full">
                            <div className="font-semibold text-gray-900 truncate">{char.name}</div>
                            {alreadyAdded && (
                              <div className="text-xs text-gray-600 mt-1">Already added</div>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
