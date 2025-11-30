import React, { useState, useEffect } from 'react';
import { SkinProject, Message, TwitterCharacter } from '../lib/schema';
import { uploadImage, ImageUploadError } from '../lib/imgur';
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

interface Props { project: SkinProject; onChange: (p: SkinProject) => void; }

export const EditorForm: React.FC<Props> = ({ project, onChange }) => {
  const [uploading, setUploading] = useState<string | null>(null);
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
  
  async function handleAvatarUpload(msgId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(msgId);
    try {
      const url = await uploadImage(file);
      updateMsg(msgId, { avatarUrl: url });
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
  }

  async function handleInstagramImageUpload(type: 'avatar' | 'image', e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const uploadId = project.template === 'android' ? 'whatsapp-avatar' : `instagram-${type}`;
    setUploading(uploadId);
    try {
      const url = await uploadImage(file);
      if (type === 'avatar') {
        updateSettings('instagramAvatarUrl', url);
        success('Profile photo uploaded successfully!');
      } else {
        updateSettings('instagramImageUrl', url);
        success('Image uploaded successfully!');
      }
    } catch (err) {
      if (err instanceof ImageUploadError) {
        error(err.userMessage);
      } else {
        error('Failed to upload image. Please try again.');
      }
    } finally {
      setUploading(null);
    }
  }

  async function handleIOSImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading('ios-avatar');
    try {
      const url = await uploadImage(file);
      updateSettings('iosAvatarUrl', url);
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
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Template Selector Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 shadow-sm">
        <h2 className="text-gray-900 text-base sm:text-lg font-bold mb-3 sm:mb-4 flex items-center gap-2">
          <span>✨</span>
          <span>Choose Your Template Style</span>
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
          {/* iOS Template */}
          <button
            type="button"
            onClick={() => update('template', 'ios')}
            className={`flex flex-col items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-xl transition-all border-2 ${
              project.template === 'ios'
                ? 'bg-blue-50 border-blue-500 shadow-md'
                : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
            }`}
          >
            <div className={`text-3xl sm:text-5xl ${project.template === 'ios' ? '' : 'opacity-80'}`}>📱</div>
            <div className="text-center">
              <div className={`font-bold text-xs sm:text-sm ${project.template === 'ios' ? 'text-blue-600' : 'text-gray-700'}`}>
                iOS iMessage
              </div>
              <div className={`text-xs ${project.template === 'ios' ? 'text-gray-600' : 'text-gray-500'}`}>
                Blue bubbles
              </div>
            </div>
          </button>

          {/* WhatsApp Template */}
          <button
            type="button"
            onClick={() => update('template', 'android')}
            className={`flex flex-col items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-xl transition-all border-2 ${
              project.template === 'android'
                ? 'bg-green-50 border-green-500 shadow-md'
                : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
            }`}
          >
            <div className={`text-3xl sm:text-5xl ${project.template === 'android' ? '' : 'opacity-80'}`}>💬</div>
            <div className="text-center">
              <div className={`font-bold text-xs sm:text-sm ${project.template === 'android' ? 'text-green-600' : 'text-gray-700'}`}>
                WhatsApp
              </div>
              <div className={`text-xs ${project.template === 'android' ? 'text-gray-600' : 'text-gray-500'}`}>
                Green bubbles
              </div>
            </div>
          </button>

          {/* Twitter Template */}
          <button
            type="button"
            onClick={() => update('template', 'twitter')}
            className={`flex flex-col items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-xl transition-all border-2 ${
              project.template === 'twitter'
                ? 'bg-blue-50 border-blue-500 shadow-md'
                : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
            }`}
          >
            <div className={`text-3xl sm:text-5xl ${project.template === 'twitter' ? '' : 'opacity-80'}`}>𝕏</div>
            <div className="text-center">
              <div className={`font-bold text-xs sm:text-sm ${project.template === 'twitter' ? 'text-blue-500' : 'text-gray-700'}`}>
                Twitter/X
              </div>
              <div className={`text-xs ${project.template === 'twitter' ? 'text-gray-600' : 'text-gray-500'}`}>
                Tweet posts
              </div>
            </div>
          </button>

          {/* Google Template */}
          <button
            type="button"
            onClick={() => update('template', 'google')}
            className={`flex flex-col items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-xl transition-all border-2 ${
              project.template === 'google'
                ? 'bg-blue-50 border-blue-500 shadow-md'
                : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
            }`}
          >
            <div className={`text-3xl sm:text-5xl ${project.template === 'google' ? '' : 'opacity-80'}`}>🔍</div>
            <div className="text-center">
              <div className={`font-bold text-xs sm:text-sm ${project.template === 'google' ? 'text-blue-600' : 'text-gray-700'}`}>
                Google Search
              </div>
              <div className={`text-xs ${project.template === 'google' ? 'text-gray-600' : 'text-gray-500'}`}>
                Search results
              </div>
            </div>
          </button>
        </div>
        
        {/* Example Gallery - Prominent Quick Win Section */}
        {getExampleNames(project.template).length > 0 && (
          <div className="mt-4 bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-purple-300 rounded-lg p-4 shadow-sm">
            {/* Prominent Header */}
            <div className="flex items-start gap-3 mb-4">
              <div className="text-3xl">⚡</div>
              <div className="flex-1">
                <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-1">
                  Quick Start: Load a Pre-Made Example
                </h3>
                <p className="text-sm text-gray-700">
                  <strong>Save time!</strong> Start with a ready-made conversation, then customize it for your story.
                </p>
              </div>
            </div>

            {/* Example Cards - Always Visible */}
            <div className="grid grid-cols-1 gap-3">
              {getExampleNames(project.template).map((example) => (
                <button
                  key={example.id}
                  type="button"
                  onClick={() => {
                    const exampleProject = loadExample(example.id);
                    if (exampleProject) {
                      setConfirmModal({
                        isOpen: true,
                        title: 'Load Example Template',
                        message: `Load "${example.name}"? This will replace your current work.`,
                        onConfirm: () => {
                          onChange(exampleProject);
                          setConfirmModal(prev => ({ ...prev, isOpen: false }));
                        },
                      });
                    }
                  }}
                  className="text-left p-4 bg-white border-2 border-purple-200 rounded-lg hover:border-purple-500 hover:shadow-md transition-all group"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">📋</span>
                    <span className="font-bold text-sm sm:text-base text-gray-900 group-hover:text-purple-700">
                      {example.name}
                    </span>
                    <span className="ml-auto text-xs font-medium text-purple-600 group-hover:text-purple-700">
                      Click to load →
                    </span>
                  </div>
                  <div className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                    {example.description}
                  </div>
                </button>
              ))}
            </div>

            {/* Pro Tip */}
            <div className="mt-4 bg-purple-100 border border-purple-300 rounded p-3 flex items-start gap-2">
              <span className="text-base">💡</span>
              <p className="text-xs sm:text-sm text-purple-900">
                <strong>Pro tip:</strong> Examples include realistic messages, profile pictures, and timestamps. Just edit the text to match your fic!
              </p>
            </div>
          </div>
        )}
      </div>
      {/* iOS iMessage Editor */}
      {project.template === 'ios' && (
        <IOSEditor project={project} onChange={onChange} />
      )}
      
      {/* Old iOS section - TO BE REMOVED */}
      {false && project.template === 'ios' && (
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
          {/* Tab Navigation */}
          <div className="flex border-b bg-white">
            <button
              type="button"
              onClick={() => setIosTab('phone')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                iosTab === 'phone'
                  ? 'bg-blue-500 text-white border-b-2 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              📱 Phone Settings
            </button>
            <button
              type="button"
              onClick={() => setIosTab('messages')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                iosTab === 'messages'
                  ? 'bg-blue-500 text-white border-b-2 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              💬 Messages
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-4 space-y-4">
            {iosTab === 'phone' ? (
              /* PHONE SETTINGS TAB */
              <div className="space-y-4">
                <div className="bg-blue-100 border border-blue-300 rounded-lg p-3">
                  <p className="text-xs text-blue-800">
                    <span className="font-semibold">{project.settings.iosMode === 'sms' ? '💬 SMS Style' : '💬 iMessage Style'}</span><br/>
                    <span className="text-[10px]">Set up your contact profile for authentic {project.settings.iosMode === 'sms' ? 'SMS' : 'iMessage'} conversations</span>
                  </p>
                </div>

                <label className="flex flex-col text-sm">
                  <span className="font-medium mb-2 text-gray-700">Message Type</span>
                  <select 
                    value={project.settings.iosMode || 'imessage'} 
                    onChange={e => updateSettings('iosMode', e.target.value as 'imessage' | 'sms')} 
                    className="border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 text-base"
                  >
                    <option value="imessage">💙 iMessage (Blue bubbles)</option>
                    <option value="sms">💚 SMS/Text (Green bubbles)</option>
                  </select>
                  <span className="text-[10px] text-gray-500 mt-1">Choose between iMessage or SMS style</span>
                </label>

                <label className="flex flex-col text-sm">
                  <span className="font-medium mb-2 text-gray-700">Max Width</span>
                  <input 
                    type="number" 
                    min={280} 
                    max={600} 
                    value={project.settings.maxWidthPx} 
                    onChange={e => updateSettings('maxWidthPx', parseInt(e.target.value))} 
                    className="border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-[10px] text-gray-500 mt-1">Conversation width in pixels (280-600px)</span>
                </label>

                <label className="flex flex-col text-sm">
                  <span className="font-medium mb-2 text-gray-700">Display Name</span>
                  <input 
                    className="border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                    value={project.settings.iosContactName || ''} 
                    onChange={e => updateSettings('iosContactName', e.target.value)} 
                    placeholder="John Doe" 
                  />
                  <span className="text-[10px] text-gray-500 mt-1">Shows in conversation header</span>
                </label>

                <label className="flex flex-col text-sm">
                  <span className="font-medium mb-2 text-gray-700">Profile Picture</span>
                  <div className="flex items-center gap-3">
                    {project.settings.iosAvatarUrl && (
                      <div className="relative">
                        <img 
                          src={project.settings.iosAvatarUrl} 
                          alt="Profile" 
                          className="w-16 h-16 rounded-full object-cover border-2 border-blue-500"
                        />
                        <button
                          type="button"
                          onClick={() => updateSettings('iosAvatarUrl', '')}
                          className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs hover:bg-red-600 transition flex items-center justify-center"
                          title="Remove photo"
                        >
                          ×
                        </button>
                      </div>
                    )}
                    <label className="cursor-pointer px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-sm font-medium">
                      {uploading === 'ios-avatar' ? 'Uploading...' : project.settings.iosAvatarUrl ? 'Change Photo' : 'Upload Photo'}
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => handleIOSImageUpload(e)} 
                        className="hidden" 
                        disabled={uploading === 'ios-avatar'} 
                      />
                    </label>
                  </div>
                  <span className="text-[10px] text-gray-500 mt-1">Recommended: Square image, 200x200px or larger</span>
                </label>

                <div className="border-t border-gray-200 pt-4 space-y-3">
                  <h4 className="font-medium text-sm text-gray-700">Display Options</h4>
                  
                  <label className="flex items-start gap-3 text-sm">
                    <input 
                      type="checkbox" 
                      checked={project.settings.iosShowHeader || false} 
                      onChange={e => updateSettings('iosShowHeader', e.target.checked)} 
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <span className="font-medium">Show "To: [Contact]" Header</span>
                      <p className="text-[10px] text-gray-600">Display "To: [Name]" at the top of conversation</p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 text-sm">
                    <input 
                      type="checkbox" 
                      checked={project.settings.iosShowReadReceipt || false} 
                      onChange={e => updateSettings('iosShowReadReceipt', e.target.checked)} 
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <span className="font-medium">Show "Read" Status</span>
                      <p className="text-[10px] text-gray-600">Display "Read" under the last outgoing message (like real iMessage)</p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 text-sm">
                    <input 
                      type="checkbox" 
                      checked={project.settings.chatShowTyping || false} 
                      onChange={e => updateSettings('chatShowTyping', e.target.checked)} 
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <span className="font-medium">Show Typing Indicator</span>
                      <p className="text-[10px] text-gray-600">Animated "..." bubble at bottom of conversation</p>
                      {project.settings.chatShowTyping && (
                        <input 
                          className="border border-gray-300 px-3 py-2 rounded-lg w-full mt-2 text-sm" 
                          value={project.settings.chatTypingName || ''} 
                          onChange={e => updateSettings('chatTypingName', e.target.value)} 
                          placeholder="typing..."
                        />
                      )}
                    </div>
                  </label>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
                  <p className="text-[10px] text-blue-700">
                    💡 <strong>Next step:</strong> Switch to the <strong>Messages</strong> tab to start building your conversation!
                  </p>
                </div>
              </div>
            ) : (
              /* MESSAGES TAB */
              <div className="space-y-4">
                {/* Quick Guide Card */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">💬</div>
                    <div className="flex-1">
                      <h3 className="font-bold text-sm text-blue-900 mb-1">Build Your {project.settings.iosMode === 'sms' ? 'SMS' : 'iMessage'} Conversation</h3>
                      <p className="text-xs text-blue-700 leading-relaxed">
                        Create realistic text message exchanges for your fic! Toggle between incoming and outgoing messages, add timestamps, reactions, and even images.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Fast Mode Composer */}
                <div className="bg-white border-2 border-blue-300 rounded-xl shadow-md overflow-hidden">
                  <div className="bg-blue-600 px-4 py-3">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>⚡</span>
                      <span>Fast Mode - Create Multiple Messages</span>
                    </h4>
                  </div>
                  
                  <div className="p-4 space-y-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-xs text-blue-800 leading-relaxed">
                        <span className="font-bold">💡 How it works:</span> Type your conversation below - one message per line. Use any of these formats:
                      </p>
                      <div className="text-xs text-blue-700 mt-2 space-y-1">
                        <p><code className="bg-blue-200 px-1 rounded">{'>'}</code> or <code className="bg-blue-200 px-1 rounded">Me:</code> for outgoing (blue bubbles)</p>
                        <p><code className="bg-blue-200 px-1 rounded">{'<'}</code> or <code className="bg-blue-200 px-1 rounded">Them:</code> for incoming (gray bubbles)</p>
                      </div>
                      <p className="text-xs text-blue-700 mt-2">
                        <span className="font-semibold">Example:</span><br/>
                        <code className="text-[11px] bg-white px-2 py-1 rounded block mt-1 font-mono">{'> Hey! Are you coming?'}<br/>{'< Yeah! What time?'}<br/>{'Me: 8pm. Don\'t be late! 🎉'}</code>
                      </p>
                    </div>

                    <textarea 
                      id="ios-fast-mode-input"
                      className="border-2 border-gray-300 w-full px-4 py-3 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 resize-none transition font-mono" 
                      rows={10} 
                      placeholder="> Hey! What's up?&#10;< Not much, you?&#10;Me: Want to grab coffee later?&#10;Them: Sure! Where?&#10;> That new place downtown&#10;< Perfect, see you at 3!"
                    />

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
                          
                          // Check for direction markers (support multiple formats)
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
                        success(`Added ${lines.length} message${lines.length > 1 ? 's' : ''} to conversation!`);
                      }}
                      className="w-full px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition font-bold text-sm shadow-sm hover:shadow-md flex items-center justify-center gap-2"
                    >
                      <span>⚡</span>
                      <span>Add All Messages to Conversation</span>
                    </button>
                  </div>
                </div>

                {/* Message List - Redesigned */}
                <div className="bg-white border-2 border-blue-300 rounded-xl shadow-md overflow-hidden">
                  <div className="bg-blue-600 px-4 py-3 flex items-center justify-between">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>💬</span>
                      <span>Your Conversation</span>
                      <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">{project.messages.length}</span>
                    </h4>
                    {project.messages.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm('🗑️ Delete all messages from your conversation?')) {
                            update('messages', []);
                          }
                        }}
                        className="text-xs text-white hover:text-red-200 font-semibold bg-white/10 hover:bg-white/20 px-3 py-1 rounded-full transition"
                      >
                        🗑️ Clear All
                      </button>
                    )}
                  </div>
                  
                  <div className="p-4">
                    {project.messages.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="text-5xl mb-3">📱</div>
                        <p className="text-gray-400 text-sm font-medium">Your conversation is empty</p>
                        <p className="text-gray-400 text-xs mt-1">Add your first message above to get started!</p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                        {project.messages.map((m, idx) => (
                          <div 
                            key={m.id} 
                            className={`border-2 rounded-xl p-4 space-y-3 transition-all hover:shadow-md ${
                              m.outgoing 
                                ? 'bg-blue-50 border-blue-300' 
                                : 'bg-gray-50 border-gray-300'
                            }`}
                          >
                            {/* Header */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                  m.outgoing 
                                    ? 'bg-blue-500 text-white' 
                                    : 'bg-gray-500 text-white'
                                }`}>
                                  #{idx + 1}
                                </span>
                                <span className={`flex items-center gap-1 text-xs font-semibold ${
                                  m.outgoing ? 'text-blue-700' : 'text-gray-700'
                                }`}>
                                  <span>{m.outgoing ? '📤' : '📥'}</span>
                                  <span>{m.outgoing ? 'Outgoing' : 'Incoming'}</span>
                                </span>
                              </div>
                              <button 
                                type="button" 
                                onClick={() => deleteMsg(m.id)} 
                                className="text-red-500 hover:text-red-700 hover:bg-red-100 rounded-full w-7 h-7 flex items-center justify-center transition font-bold"
                                title="Delete message"
                              >
                                ✕
                              </button>
                            </div>
                            
                            {/* Content */}
                            {m.attachments?.[0]?.url ? (
                              <div className="relative group">
                                <img 
                                  src={m.attachments[0].url} 
                                  alt="Message" 
                                  className="max-h-40 rounded-lg border-2 border-gray-300 shadow-sm mx-auto" 
                                />
                                <button
                                  type="button"
                                  onClick={() => updateMsg(m.id, {attachments: undefined})}
                                  className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-semibold hover:bg-red-600 transition shadow-md opacity-0 group-hover:opacity-100"
                                >
                                  ✕ Remove
                                </button>
                              </div>
                            ) : (
                              <textarea 
                                className="bg-white border-2 border-gray-200 rounded-lg p-3 shadow-sm w-full text-sm text-gray-800 leading-relaxed resize-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400 transition hover:border-gray-300" 
                                rows={3}
                                value={m.content} 
                                onChange={e => updateMsg(m.id, {content: e.target.value})}
                                placeholder="Type message content..."
                              />
                            )}

                            {/* Metadata */}
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[10px] font-semibold text-gray-500 mb-1">⏰ TIME</label>
                                <input 
                                  className="border border-gray-300 px-2 py-1.5 rounded-lg w-full text-xs focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition" 
                                  value={m.timestamp || ''} 
                                  onChange={e => updateMsg(m.id, {timestamp: e.target.value})} 
                                  placeholder="2:34 PM"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-semibold text-gray-500 mb-1">💝 REACTION</label>
                                <select
                                  className="border border-gray-300 px-2 py-1.5 rounded-lg w-full text-xs focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition"
                                  value={m.reaction || ''}
                                  onChange={e => updateMsg(m.id, {reaction: e.target.value || undefined})}
                                  aria-label="Message reaction"
                                >
                                  <option value="">None</option>
                                  <option value="❤️">❤️</option>
                                  <option value="👍">👍</option>
                                  <option value="👎">👎</option>
                                  <option value="😂">😂</option>
                                  <option value="😮">😮</option>
                                  <option value="😢">😢</option>
                                  <option value="❗">❗</option>
                                  <option value="❓">❓</option>
                                </select>
                              </div>
                            </div>

                            {/* Direction Toggle */}
                            <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                              <span className="text-xs font-semibold text-gray-600">Switch Direction:</span>
                              <button
                                type="button"
                                onClick={() => updateMsg(m.id, {outgoing: !m.outgoing})}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                                  m.outgoing 
                                    ? 'bg-blue-500 text-white hover:bg-blue-600' 
                                    : 'bg-gray-400 text-white hover:bg-gray-500'
                                }`}
                              >
                                <span>{m.outgoing ? '📤' : '📥'}</span>
                                <span>{m.outgoing ? 'Outgoing' : 'Incoming'}</span>
                                <span>→</span>
                                <span>{m.outgoing ? '📥' : '📤'}</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Android-specific options - handled by AndroidEditor component */}
      
      {project.template === 'android' && (
        <AndroidEditor project={project} onChange={onChange} />
      )}
      
      {project.template === 'twitter' && (
        <TwitterEditor project={project} onChange={onChange} />
      )}

      {project.template === 'google' && (
        <div className="border border-gray-200 rounded-lg p-4 space-y-4 bg-white">
          <h3 className="text-xs font-medium text-gray-900 uppercase tracking-wide">🔍 Google Search Creator</h3>
          
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

          {/* Search Results Section */}
          <div className="border-t border-gray-200 pt-4 space-y-4">
            <h4 className="text-xs font-medium text-gray-900 uppercase tracking-wide flex items-center gap-2">
              <span>🔗</span>
              <span>Search Results</span>
            </h4>

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
                          if (confirm('Delete this result?')) {
                            deleteMsg(result.id);
                          }
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
                      <label className="text-xs cursor-pointer px-2 py-1 bg-gray-200 rounded hover:bg-gray-300">
                        {uploading === m.id ? 'Uploading...' : 'Avatar'}
                        <input type="file" accept="image/*" onChange={(e) => handleAvatarUpload(m.id, e)} className="hidden" disabled={uploading === m.id} />
                      </label>
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
