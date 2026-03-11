import React, { useState, useCallback, useEffect } from 'react';
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

export const AndroidEditor: React.FC<Props> = ({ project, onChange, universalCharacters = [], focusedMessageId, focusTrigger }) => {
  // Use shared project editor hook
  const { update, updateSettings, updateMsg, deleteMsg, addMessages } = useProjectEditor(project, onChange);
  
  const { toasts, removeToast, success, error } = useToast();
  const { confirm, ConfirmModal } = useConfirm();
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [showCharacterLibrary, setShowCharacterLibrary] = useState(false);
  
  // Settings panel collapse state
  const [settingsOpen, setSettingsOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ao3skin_android_settings_open');
      return saved ? saved === 'true' : false;
    }
    return false;
  });
  
  // Compose mode toggle state
  const [composeMode, setComposeMode] = useState<'fast' | 'detailed'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ao3skin_android_compose_mode');
      return (saved as 'fast' | 'detailed') || 'fast';
    }
    return 'fast';
  });
  
  // Save settings panel state to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ao3skin_android_settings_open', String(settingsOpen));
    }
  }, [settingsOpen]);
  
  // Save compose mode to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ao3skin_android_compose_mode', composeMode);
    }
  }, [composeMode]);
  
  // Compact card state - track which messages are expanded
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());

  // Auto-expand focused message when clicking from preview
  useEffect(() => {
    if (focusedMessageId) {
      setExpandedMessages(prev => new Set(prev).add(focusedMessageId));
    }
  }, [focusedMessageId, focusTrigger]);

  // Scroll to focused message when focusedMessageId changes
  useEffect(() => {
    if (focusedMessageId) {
      // Small delay to allow React to render the expanded card
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
              <h3 className="text-sm font-bold text-gray-800">WhatsApp Settings</h3>
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                {settingsOpen ? 'Click to hide' : 'Click to customize'}
              </span>
            </div>
            <span className={`text-gray-500 transition-transform duration-200 ${settingsOpen ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </button>

          {settingsOpen && (
          <div className="bg-white border-2 border-green-200 rounded-xl p-4 shadow-sm space-y-3 animate-fadeIn">
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col text-sm">
                <span className="font-medium mb-2 text-gray-700">Contact Name</span>
                <input 
                  className="border-2 border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-green-500" 
                  value={project.settings.chatContactName || ''} 
                  onChange={e => updateSettings('chatContactName', e.target.value)} 
                  placeholder="John Doe" 
                />
              </label>

              <label className="flex flex-col text-sm">
                <span className="font-medium mb-2 text-gray-700">Max Width (px)</span>
                <input 
                  type="number" 
                  min={280} 
                  max={600} 
                  value={project.settings.maxWidthPx} 
                  onChange={e => updateSettings('maxWidthPx', parseInt(e.target.value))} 
                  className="border-2 border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </label>
            </div>

            <label className="flex flex-col text-sm">
              <span className="font-medium mb-2 text-gray-700">Profile Picture URL</span>
              <div className="flex items-center gap-3">
                {project.settings.instagramAvatarUrl && (
                  <div className="relative">
                    <Image 
                      src={project.settings.instagramAvatarUrl} 
                      alt="Profile" 
                      width={64}
                      height={64}
                      className="rounded-full object-cover border-2 border-green-500"
                      unoptimized
                    />
                    <button
                      type="button"
                      onClick={() => updateSettings('instagramAvatarUrl', '')}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs hover:bg-red-600 transition flex items-center justify-center"
                      title="Remove photo"
                    >
                      ×
                    </button>
                  </div>
                )}
                <input 
                  className="flex-1 border-2 border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-green-500"
                  value={project.settings.instagramAvatarUrl || ''}
                  onChange={e => updateSettings('instagramAvatarUrl', e.target.value)}
                  placeholder="Paste image URL"
                />

              </div>
              <p className="text-xs text-gray-500 mt-1">💡 Paste from <a href="https://imgbb.com" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">imgbb.com</a> or any direct image URL</p>
            </label>

            <label className="flex items-center gap-2 text-sm text-gray-900 pt-2">
              <input 
                type="checkbox" 
                checked={project.settings.androidDarkMode || false} 
                onChange={e => updateSettings('androidDarkMode', e.target.checked)} 
                className="w-4 h-4 rounded border-gray-300 focus:ring-2 focus:ring-green-500"
              />
              <span>🌙 Dark mode</span>
            </label>
            
            <label className="flex items-center gap-2 text-sm text-gray-900 pt-2 border-t border-gray-200 mt-3 pt-3">
              <input 
                type="checkbox" 
                checked={project.settings.androidGroupMode || false} 
                onChange={e => {
                  updateSettings('androidGroupMode', e.target.checked);
                  // Initialize participants array if enabling for first time
                  if (e.target.checked && !project.settings.androidGroupParticipants) {
                    updateSettings('androidGroupParticipants', []);
                  }
                }}
                className="w-4 h-4 rounded border-gray-300 focus:ring-2 focus:ring-green-500"
              />
              <span className="font-medium">👥 Enable Group Chat</span>
            </label>
            
            {project.settings.androidGroupMode && (
              <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg space-y-3">
                <label className="flex flex-col text-sm">
                  <span className="font-medium mb-2 text-gray-700">Group Name</span>
                  <input 
                    className="border-2 border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-green-500" 
                    value={project.settings.androidGroupName || ''} 
                    onChange={e => updateSettings('androidGroupName', e.target.value)} 
                    placeholder="e.g., Work Team, Study Group" 
                  />
                </label>
                
                <div className="text-xs text-gray-600 bg-white p-2 rounded border border-green-200">
                  💡 <strong>Group Mode:</strong> Shows sender names above incoming messages. Add participants below to assign messages.
                </div>
                
                {/* Participants List */}
                <div className="border-t border-green-300 pt-3 mt-3">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold text-gray-800">
                      👥 Participants ({(project.settings.androidGroupParticipants || []).length})
                    </h4>
                    <button
                      type="button"
                      onClick={() => {
                        const participants = project.settings.androidGroupParticipants || [];
                        const colorIndex = participants.length % PARTICIPANT_COLORS.length;
                        const newParticipant: GroupParticipant = {
                          id: crypto.randomUUID(),
                          name: `Person ${participants.length + 1}`,
                          color: PARTICIPANT_COLORS[colorIndex],
                        };
                        updateSettings('androidGroupParticipants', [...participants, newParticipant]);
                        success('Participant added!');
                      }}
                      className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition font-medium"
                    >
                      + Add Participant
                    </button>
                  </div>
                  
                  {(!project.settings.androidGroupParticipants || project.settings.androidGroupParticipants.length === 0) ? (
                    <div className="text-center py-6 bg-white border-2 border-dashed border-gray-300 rounded-lg">
                      <div className="text-3xl mb-2">👥</div>
                      <div className="text-sm text-gray-600">No participants yet</div>
                      <div className="text-xs text-gray-500 mt-1">Add at least 2 members for group chat</div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {project.settings.androidGroupParticipants.map((participant, idx) => (
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
                                  const updated = project.settings.androidGroupParticipants!.filter(p => p.id !== participant.id);
                                  updateSettings('androidGroupParticipants', updated);
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
                              className="border border-gray-300 px-2 py-1 rounded text-xs focus:ring-1 focus:ring-green-500" 
                              value={participant.name} 
                              onChange={e => {
                                const updated = project.settings.androidGroupParticipants!.map(p =>
                                  p.id === participant.id ? { ...p, name: e.target.value } : p
                                );
                                updateSettings('androidGroupParticipants', updated);
                              }}
                              placeholder="Name" 
                            />
                            <input 
                              type="color"
                              className="border border-gray-300 rounded h-8 w-full cursor-pointer" 
                              value={participant.color} 
                              onChange={e => {
                                const updated = project.settings.androidGroupParticipants!.map(p =>
                                  p.id === participant.id ? { ...p, color: e.target.value } : p
                                );
                                updateSettings('androidGroupParticipants', updated);
                              }}
                              title="Name color"
                            />
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <input 
                              className="flex-1 border border-gray-300 px-2 py-1 rounded text-xs focus:ring-1 focus:ring-green-500" 
                              value={participant.avatarUrl || ''} 
                              onChange={e => {
                                const updated = project.settings.androidGroupParticipants!.map(p =>
                                  p.id === participant.id ? { ...p, avatarUrl: e.target.value } : p
                                );
                                updateSettings('androidGroupParticipants', updated);
                              }}
                              placeholder="Avatar URL (optional)" 
                            />

                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {universalCharacters && universalCharacters.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowCharacterLibrary(true)}
                      className="w-full mt-2 text-xs text-green-600 hover:text-green-700 py-2 border border-green-300 rounded-lg hover:bg-green-50 transition flex items-center justify-center gap-2"
                    >
                      <span>📚</span>
                      <span>Add from Character Library</span>
                      <span className="bg-green-600 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">
                        {universalCharacters.length}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
          )}
        </div>

        {/* UNIFIED COMPOSE SECTION */}
        <div className="border-2 border-green-400 rounded-xl p-4 bg-white space-y-4 shadow-sm">
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
                    ? 'bg-white shadow text-green-600'
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
                    ? 'bg-white shadow text-green-600'
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
                inputId="whatsapp-fast-mode-input"
                platform="android"
                onAddMessages={(messages) => update('messages', [...project.messages, ...messages])}
                onSuccess={success}
                onError={error}
                defaultContactName={project.settings.chatContactName || 'Contact'}
                universalCharacters={universalCharacters}
              />
            </div>
          )}

          {/* Detailed Mode */}
          {composeMode === 'detailed' && (
            <div className="space-y-3 animate-fadeIn">{/* Single message composer content */}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col text-sm">
              <span className="font-medium text-gray-700 mb-2">Direction</span>
              <select
                id="whatsapp-message-direction"
                aria-label="Message direction - outgoing or incoming"
                className="border-2 border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-green-500 text-sm"
              >
                <option value="outgoing">📤 Outgoing (Green bubble)</option>
                <option value="incoming">📥 Incoming (White bubble)</option>
              </select>
            </label>
            
            {project.settings.androidGroupMode && (project.settings.androidGroupParticipants || []).length > 0 && (
              <label className="flex flex-col text-sm">
                <span className="font-medium text-gray-700 mb-2">Sender (Group)</span>
                <select
                  id="whatsapp-message-participant"
                  aria-label="Select message sender"
                  className="border-2 border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-green-500 text-sm"
                >
                  <option value="">You</option>
                  {(project.settings.androidGroupParticipants || []).map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <div className="space-y-2">
            <textarea 
              id="whatsapp-message-input"
              className="border-2 border-gray-300 px-4 py-3 rounded-xl w-full focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none font-sans text-sm" 
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
                    const input = document.getElementById('whatsapp-message-input') as HTMLTextAreaElement;
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
            <label className="flex flex-col text-xs">
              <span className="text-gray-600 mb-1.5 font-medium">⏰ Time (optional)</span>
              <input 
                id="whatsapp-message-time"
                type="text"
                className="border-2 border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-green-500 text-sm" 
                placeholder="2:34 PM"
              />
            </label>

            <label className="flex flex-col text-xs">
              <span className="text-gray-600 mb-1.5 font-medium">✓ Status (optional)</span>
              <select
                id="whatsapp-message-status"
                aria-label="Message delivery status"
                className="border-2 border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-green-500 text-sm"
              >
                <option value="sending">Sending...</option>
                <option value="sent">Sent ✓</option>
                <option value="delivered">Delivered ✓✓</option>
                <option value="read">Read ✓✓ (blue)</option>
              </select>
            </label>
          </div>

          <label className="flex flex-col text-xs">
            <span className="text-gray-600 mb-1.5 font-medium flex items-center gap-1">
              <span>📷</span>
              <span>Message Image URL (optional)</span>
            </span>
            <div className="flex items-center gap-2">
              <input 
                id="whatsapp-message-image-url"
                type="text"
                className="flex-1 border-2 border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-green-500 text-sm" 
                placeholder="Paste image URL from Imgur, ImgBB, Google Drive, etc."
                title="Paste any image address — share-page URLs are auto-converted"
              />

            </div>
            <p className="text-xs text-gray-500 mt-1">💡 Paste from <a href="https://imgbb.com" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">ImgBB</a>, <a href="https://imgur.com" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Imgur</a>, Google Drive, Dropbox, and more — share-page URLs converted automatically</p>
          </label>

          <button
            type="button"
            onClick={() => {
              const directionSelect = document.getElementById('whatsapp-message-direction') as HTMLSelectElement;
              const participantSelect = document.getElementById('whatsapp-message-participant') as HTMLSelectElement | null;
              const messageInput = document.getElementById('whatsapp-message-input') as HTMLTextAreaElement;
              const timeInput = document.getElementById('whatsapp-message-time') as HTMLInputElement;
              const statusSelect = document.getElementById('whatsapp-message-status') as HTMLSelectElement;
              const imageInput = document.getElementById('whatsapp-message-image-url') as HTMLInputElement;
              
              const content = messageInput?.value.trim();
              const imageUrl = normalizeImageUrl(imageInput?.value.trim() || '');
              
              if (!content && !imageUrl) {
                error('Please enter message text or add an image');
                return;
              }
              
              const outgoing = directionSelect?.value === 'outgoing';
              const defaultTime = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
              
              // Group mode: Get participant info
              const participantId = participantSelect?.value || undefined;
              let senderName = outgoing ? 'You' : (project.settings.chatContactName || 'Contact');
              
              if (project.settings.androidGroupMode && participantId && !outgoing) {
                const participant = project.settings.androidGroupParticipants?.find(p => p.id === participantId);
                if (participant) {
                  senderName = participant.name;
                }
              }
              
              const newMsg: Message = {
                id: crypto.randomUUID(),
                sender: senderName,
                content: content,
                outgoing: outgoing,
                timestamp: timeInput?.value || defaultTime,
                status: (statusSelect?.value as any) || 'read',
                attachments: imageUrl ? [{type: 'image', url: imageUrl}] : undefined,
                participantId: participantId, // Store participant reference
                roleColor: participantId && !outgoing ? 
                  project.settings.androidGroupParticipants?.find(p => p.id === participantId)?.color : undefined,
              };
              
              update('messages', [...project.messages, newMsg]);
              
              // Clear inputs
              if (messageInput) messageInput.value = '';
              if (timeInput) timeInput.value = '';
              if (statusSelect) statusSelect.value = 'read';
              if (imageInput) imageInput.value = '';
              
              success('Message added!');
            }}
            className="w-full px-5 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition font-bold text-sm shadow-sm hover:shadow-md"
          >
            💬 Add Message
          </button>
            </div>
          )}
        </div>

        {/* SECTION 4: MESSAGE TIMELINE */}
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <span>💬</span>
              <span>Conversation Timeline</span>
              <span className="bg-green-200 text-green-800 px-2 py-0.5 rounded-full text-xs font-bold">
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
                      className={`text-[10px] px-2 py-1 transition ${expandedMessages.size === project.messages.length ? 'bg-green-100 text-green-700' : 'text-gray-500 hover:bg-gray-100'}`}
                      title="Expand all messages"
                    >
                      ▼ All
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpandedMessages(new Set())}
                      className={`text-[10px] px-2 py-1 transition ${expandedMessages.size === 0 ? 'bg-green-100 text-green-700' : 'text-gray-500 hover:bg-gray-100'}`}
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
                      startTime.setHours(14, 30, 0, 0); // Start at 2:30 PM
                      
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
                    className="text-xs text-green-600 hover:text-green-700 font-semibold px-3 py-1 rounded-full hover:bg-green-50 transition"
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
                    className="text-xs text-red-600 hover:text-red-700 font-semibold px-3 py-1 rounded-full hover:bg-red-50 transition"
                  >
                    🗑️ Clear All
                  </button>
                </>
              )}
            </div>
          </div>
          
          {/* Bulk Operations Toolbar */}
          {selectedMessages.size > 0 && (
            <div className="bg-green-50 border-2 border-green-300 rounded-xl p-3 flex items-center justify-between gap-3">
              <span className="text-sm font-bold text-green-900">
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
                  className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition font-medium"
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
                  className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 transition font-medium"
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
            <div className="text-center py-12 bg-white border-2 border-dashed border-gray-300 rounded-xl">
              <div className="text-5xl mb-3">💬</div>
              <div className="font-medium text-gray-600">No messages yet</div>
              <div className="text-sm text-gray-500 mt-2 max-w-xs mx-auto">
                <p className="mb-2">👆 Use the form above to add messages</p>
                <p className="text-xs text-gray-400">💡 Tips: Toggle between sent/received. Add timestamps, delivery status, and images!</p>
              </div>
            </div>
          ) : (
            <div 
              id="android-messages-container"
              className="space-y-1 max-h-[700px] overflow-y-auto bg-gray-50 border border-gray-300 rounded-lg p-2"
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
                      const duplicated: Message = {
                        ...m,
                        id: crypto.randomUUID(),
                      };
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

                    template="android"
                    isGroupMode={project.settings.androidGroupMode}
                    groupParticipants={project.settings.androidGroupParticipants || []}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
      
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <ConfirmModal />
      
      {/* Character Library Modal for Participants */}
      {showCharacterLibrary && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 z-50" 
            onClick={() => setShowCharacterLibrary(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
              {/* Header */}
              <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">📚</span>
                    <div>
                      <h3 className="font-bold text-lg">Add Character as Participant</h3>
                      <p className="text-xs text-purple-100">
                        Click any character to add them to the group chat
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowCharacterLibrary(false)}
                    className="text-white/80 hover:text-white text-2xl transition-colors"
                  >
                    ×
                  </button>
                </div>
              </div>

              {/* Character Grid */}
              <div className="flex-1 overflow-y-auto p-4">
                {universalCharacters.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <div className="text-5xl mb-3">🎭</div>
                    <p className="font-medium">No characters in library</p>
                    <p className="text-xs mt-1">Add characters from the header first!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {universalCharacters.map((character) => {
                      const alreadyAdded = (project.settings.androidGroupParticipants || []).some(
                        p => p.name === character.name
                      );
                      
                      return (
                        <button
                          key={character.id}
                          onClick={() => {
                            if (alreadyAdded) {
                              error(`${character.name} is already a participant`);
                              return;
                            }
                            
                            const participants = project.settings.androidGroupParticipants || [];
                            const colorIndex = participants.length % PARTICIPANT_COLORS.length;
                            const newParticipant: GroupParticipant = {
                              id: crypto.randomUUID(),
                              name: character.name,
                              avatarUrl: character.avatarUrl,
                              color: PARTICIPANT_COLORS[colorIndex],
                            };
                            updateSettings('androidGroupParticipants', [...participants, newParticipant]);
                            success(`Added ${character.name}!`);
                            setShowCharacterLibrary(false);
                          }}
                          disabled={alreadyAdded}
                          className={`text-left bg-white border-2 rounded-lg p-3 transition-all ${
                            alreadyAdded 
                              ? 'border-gray-200 opacity-50 cursor-not-allowed' 
                              : 'border-gray-200 hover:border-purple-400 hover:shadow-md'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {character.avatarUrl ? (
                              <Image
                                src={character.avatarUrl}
                                alt={character.name}
                                width={48}
                                height={48}
                                className="rounded-full object-cover border-2 border-purple-400 flex-shrink-0"
                                unoptimized
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-purple-200 flex items-center justify-center text-purple-700 font-bold text-sm flex-shrink-0">
                                {character.name.substring(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-sm text-gray-800 truncate">
                                {character.name}
                              </div>
                              {alreadyAdded && (
                                <div className="text-xs text-green-600 font-medium">
                                  ✓ Already added
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="bg-gray-50 border-t border-gray-200 p-4">
                <button
                  onClick={() => setShowCharacterLibrary(false)}
                  className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
