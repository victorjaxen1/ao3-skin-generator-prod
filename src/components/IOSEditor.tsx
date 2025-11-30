import React, { useState } from 'react';
import { SkinProject, Message } from '../lib/schema';
import { uploadImage, ImageUploadError } from '../lib/imgur';
import { useToast, ToastContainer } from './Toast';

interface Props { 
  project: SkinProject; 
  onChange: (p: SkinProject) => void; 
}

export const IOSEditor: React.FC<Props> = ({ project, onChange }) => {
  const [uploading, setUploading] = useState<string | null>(null);
  const { toasts, removeToast, success, error } = useToast();
  
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
  
  const isIMessage = project.settings.iosMode !== 'sms';
  
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      <div className="p-4 space-y-4">
        {/* SECTION 1: PHONE SETTINGS */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <span>📱</span>
              <span>{isIMessage ? 'iMessage' : 'SMS'} Settings</span>
            </h3>
          </div>

          <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 space-y-4">
            <label className="flex flex-col">
              <span className="text-xs font-medium text-gray-700 uppercase tracking-wide mb-2">Message Type</span>
              <select 
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
              <span className="text-xs font-medium text-gray-700 uppercase tracking-wide mb-2">Profile Picture</span>
              <div className="flex items-center gap-3">
                {project.settings.iosAvatarUrl && (
                  <div className="relative">
                    <img 
                      src={project.settings.iosAvatarUrl} 
                      alt="Profile" 
                      className="w-16 h-16 rounded-full object-cover border border-gray-300"
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
                <label className="cursor-pointer px-4 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-sm font-medium focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2">
                  {uploading === 'ios-avatar' ? '⏳ Uploading...' : project.settings.iosAvatarUrl ? '✓ Change Photo' : '📷 Upload Photo'}
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setUploading('ios-avatar');
                      try {
                        const url = await uploadImage(file);
                        updateSettings('iosAvatarUrl', url);
                        success('Contact photo uploaded successfully!');
                      } catch (err) {
                        if (err instanceof ImageUploadError) {
                          error(err.userMessage);
                        } else {
                          error('Failed to upload photo. Please try again.');
                        }
                      } finally {
                        setUploading(null);
                      }
                    }}
                    className="hidden" 
                    disabled={uploading === 'ios-avatar'} 
                  />
                </label>
              </div>
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
            </div>
          </div>
        </div>

        {/* SECTION 2: FAST MODE */}
        <details className="border border-purple-300 rounded-lg bg-purple-50">
          <summary className="cursor-pointer font-medium text-sm text-purple-900 hover:text-purple-950 p-4 flex items-center gap-2">
            <span>⚡</span>
            <span>Fast Mode - Create Multiple Messages at Once</span>
          </summary>
          <div className="space-y-3 p-4 pt-0">
            <div className="bg-purple-100 border border-purple-300 rounded p-3">
              <p className="text-xs text-purple-800 leading-relaxed mb-2">
                <strong>💡 How it works:</strong> Type your conversation - one message per line. Use these formats:
              </p>
              <div className="text-xs text-purple-700 space-y-1 font-mono">
                <p><code className="bg-purple-200 px-1 rounded">{'>'}</code> or <code className="bg-purple-200 px-1 rounded">Me:</code> → Outgoing (blue/green bubble)</p>
                <p><code className="bg-purple-200 px-1 rounded">{'<'}</code> or <code className="bg-purple-200 px-1 rounded">Them:</code> → Incoming (gray bubble)</p>
              </div>
            </div>

            <div className="space-y-2">
              <textarea 
                id="ios-fast-mode-input"
                className="w-full text-sm text-gray-900 bg-white p-3 rounded border border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none font-mono transition" 
                rows={8}
                placeholder="> Hey! What's up?&#10;< Not much, you?&#10;Me: Want to grab coffee?&#10;Them: Sure! Where?&#10;> That new place downtown&#10;< Perfect, see you at 3!"
              />
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-xs text-purple-700 mr-2">Quick emojis:</span>
                {['😂', '❤️', '🔥', '👍', '😭', '🙏', '💀', '✨', '💯'].map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      const input = document.getElementById('ios-fast-mode-input') as HTMLTextAreaElement;
                      if (input) {
                        const start = input.selectionStart;
                        const end = input.selectionEnd;
                        const text = input.value;
                        input.value = text.substring(0, start) + emoji + text.substring(end);
                        input.selectionStart = input.selectionEnd = start + emoji.length;
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

            <button 
              type="button" 
              onClick={() => {
                const fastInput = document.getElementById('ios-fast-mode-input') as HTMLTextAreaElement;
                const lines = fastInput?.value.split('\n').filter(line => line.trim());
                
                if (!lines || lines.length === 0) {
                  error('Please enter at least one message');
                  return;
                }
                
                const newMessages = lines.map(line => {
                  const trimmed = line.trim();
                  let outgoing = true;
                  let content = trimmed;
                  
                  if (trimmed.startsWith('→') || trimmed.startsWith('>')) {
                    outgoing = true;
                    content = trimmed.substring(1).trim();
                  } else if (trimmed.startsWith('←') || trimmed.startsWith('<')) {
                    outgoing = false;
                    content = trimmed.substring(1).trim();
                  } else if (trimmed.toLowerCase().startsWith('me:') || trimmed.toLowerCase().startsWith('you:')) {
                    outgoing = true;
                    content = trimmed.substring(trimmed.indexOf(':') + 1).trim();
                  } else if (trimmed.toLowerCase().startsWith('them:') || trimmed.toLowerCase().startsWith('contact:')) {
                    outgoing = false;
                    content = trimmed.substring(trimmed.indexOf(':') + 1).trim();
                  }
                  
                  return {
                    id: crypto.randomUUID(),
                    sender: outgoing ? 'You' : 'Contact',
                    content: content,
                    outgoing: outgoing,
                    timestamp: '',
                  };
                });
                
                update('messages', [...project.messages, ...newMessages]);
                if (fastInput) fastInput.value = '';
                alert(`✅ Added ${lines.length} message${lines.length > 1 ? 's' : ''} to conversation!`);
              }}
              className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded transition font-medium text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
            >
              ⚡ Add All Messages to Conversation
            </button>
          </div>
        </details>

        {/* SECTION 3: SINGLE MESSAGE COMPOSER */}
        <div className="border border-blue-300 rounded-lg p-4 bg-white space-y-4">
          <h4 className="text-xs font-medium text-gray-700 uppercase tracking-wide flex items-center gap-2">
            <span className="text-blue-600">✏️</span>
            <span>Compose Single Message</span>
          </h4>

          <label className="flex flex-col">
            <span className="text-xs font-medium text-gray-700 uppercase tracking-wide mb-2">Direction</span>
            <select
              id="ios-message-direction"
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
              <span>Message Image</span>
            </span>
            <div className="flex items-center gap-2">
              <input 
                id="ios-message-image-url"
                type="text"
                className="w-full text-sm text-gray-900 bg-white p-3 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition flex-1" 
                placeholder="Image URL or upload..."
              />
              <label className="cursor-pointer px-3 py-3 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition text-sm font-medium border border-gray-300 focus-within:ring-2 focus-within:ring-blue-500">
                {uploading === 'ios-new-msg-image' ? '⏳' : '📷'}
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploading('ios-new-msg-image');
                    try {
                      const url = await uploadImage(file);
                      const input = document.getElementById('ios-message-image-url') as HTMLInputElement;
                      if (input) input.value = url;
                      success('Image uploaded successfully!');
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
                  disabled={uploading === 'ios-new-msg-image'} 
                />
              </label>
            </div>
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
              const imageUrl = imageInput?.value.trim();
              
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

        {/* SECTION 4: MESSAGE TIMELINE */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
              <span>💬</span>
              <span>Conversation Timeline</span>
              <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs font-medium">
                {project.messages.length}
              </span>
            </h3>
            {project.messages.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (confirm('Delete all messages?')) {
                    update('messages', []);
                  }
                }}
                className="text-xs text-red-600 hover:text-red-700 font-medium px-3 py-1.5 rounded hover:bg-red-50 transition focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                🗑️ Clear All
              </button>
            )}
          </div>

          {project.messages.length === 0 ? (
            <div className="text-center py-12 bg-white border border-dashed border-gray-300 rounded-lg">
              <div className="text-5xl mb-3">📱</div>
              <div className="font-medium text-gray-400">No messages yet</div>
              <div className="text-xs text-gray-400 mt-1">Compose your first message above!</div>
            </div>
          ) : (
            <div className="space-y-3 max-h-[700px] overflow-y-auto bg-gray-50 border border-gray-300 rounded-lg p-3 sm:p-4">
              {project.messages.map((m, idx) => (
                <div 
                  key={m.id} 
                  className="border border-gray-300 rounded-lg bg-white hover:shadow-md transition-shadow p-4 space-y-4"
                >
                  {/* Header - Material Design */}
                  <div className="bg-white pb-3 border-b border-gray-200 flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm sm:text-base font-medium flex items-center gap-1.5 text-gray-900">
                          💬
                          <span>Message #{idx + 1}</span>
                        </span>
                        <span className={`text-[10px] sm:text-xs px-2 py-1 rounded font-medium flex items-center gap-1 ${
                          m.outgoing 
                            ? 'bg-blue-50 text-blue-700' 
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          <span>{m.outgoing ? '📤' : '📥'}</span>
                          <span className="hidden sm:inline">{m.outgoing ? 'Outgoing' : 'Incoming'}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                      {idx > 0 && (
                        <button 
                          type="button" 
                          onClick={() => {
                            const newMessages = [...project.messages];
                            [newMessages[idx], newMessages[idx - 1]] = [newMessages[idx - 1], newMessages[idx]];
                            update('messages', newMessages);
                          }}
                          className="text-gray-600 hover:text-gray-900 hover:bg-gray-100 text-sm px-2 py-1 rounded transition"
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
                          className="text-gray-600 hover:text-gray-900 hover:bg-gray-100 text-sm px-2 py-1 rounded transition"
                          title="Move down"
                        >
                          ↓
                        </button>
                      )}
                      <button 
                        type="button" 
                        onClick={() => {
                          if (confirm('Delete this message?')) {
                            deleteMsg(m.id);
                          }
                        }}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 text-lg leading-none px-2 py-1 rounded transition"
                        title="Delete"
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  {/* Message Content */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-700 uppercase tracking-wide">Content</label>
                      <textarea 
                        id={`ios-msg-content-${m.id}`}
                        className="w-full text-sm text-gray-900 bg-white p-3 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition" 
                        rows={Math.max(2, Math.ceil(m.content.length / 60))} 
                        value={m.content} 
                        onChange={e => updateMsg(m.id, {content: e.target.value})}
                        placeholder="Message text..."
                      />
                      <div className="flex items-center gap-1 flex-wrap">
                        {['😂', '❤️', '🔥', '👍', '😭', '🙏', '💀', '✨', '💯'].map(emoji => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => {
                              const textarea = document.getElementById(`ios-msg-content-${m.id}`) as HTMLTextAreaElement;
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

                    {/* Image */}
                    {m.attachments?.[0]?.url ? (
                      <div>
                        <label className="text-xs font-medium text-gray-700 uppercase tracking-wide mb-2 block">Image</label>
                        <div className="bg-gray-50 rounded p-3 border border-gray-300">
                          <div className="flex items-center gap-3">
                            <img 
                              src={m.attachments[0].url} 
                              alt="Message" 
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
                          {uploading === `ios-msg-img-${m.id}` ? '⏳ Uploading...' : '📷 Add Image'}
                          <input 
                            type="file" 
                            accept="image/*" 
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setUploading(`ios-msg-img-${m.id}`);
                              try {
                                const url = await uploadImage(file);
                                updateMsg(m.id, {attachments: [{type: 'image', url}]});
                                success('Image added to message!');
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
                            disabled={uploading === `ios-msg-img-${m.id}`} 
                          />
                        </label>
                      </div>
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-gray-200">
                    <input 
                      className="w-full text-sm text-gray-900 bg-white p-3 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" 
                      value={m.timestamp || ''} 
                      onChange={e => updateMsg(m.id, {timestamp: e.target.value})} 
                      placeholder="Time (e.g. 2:34 PM)"
                    />
                    <select
                      className="w-full text-sm text-gray-900 bg-white p-3 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                      value={m.reaction || ''}
                      onChange={e => updateMsg(m.id, {reaction: e.target.value || undefined})}
                    >
                      <option value="">No reaction</option>
                      <option value="❤️">❤️ Heart</option>
                      <option value="👍">👍 Thumbs Up</option>
                      <option value="👎">👎 Thumbs Down</option>
                      <option value="😂">😂 Laugh</option>
                      <option value="😮">😮 Surprise</option>
                      <option value="😢">😢 Sad</option>
                    </select>
                  </div>

                  {/* Direction Toggle */}
                  <button
                    type="button"
                    onClick={() => updateMsg(m.id, {outgoing: !m.outgoing})}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                      m.outgoing 
                        ? 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500' 
                        : 'bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500'
                    }`}
                  >
                    <span>{m.outgoing ? '📤' : '📥'}</span>
                    <span>Switch to {m.outgoing ? 'Incoming' : 'Outgoing'}</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
};
