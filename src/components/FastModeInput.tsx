import React, { useState, useEffect, useCallback, useRef } from 'react';
import { UniversalCharacter } from '../lib/schema';

interface Message {
  id: string;
  sender: string;
  content: string;
  outgoing: boolean;
  timestamp?: string;
  status?: 'sent' | 'delivered' | 'read';
}

interface FastModeInputProps {
  inputId: string;
  platform: 'ios' | 'android';
  onAddMessages: (messages: Message[]) => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
  defaultContactName?: string;
  universalCharacters?: UniversalCharacter[];
}

export default function FastModeInput({
  inputId,
  platform,
  onAddMessages,
  onSuccess,
  onError,
  defaultContactName = 'Contact',
  universalCharacters = []
}: FastModeInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [previewMessages, setPreviewMessages] = useState<Message[]>([]);
  const [showPreview, setShowPreview] = useState(true);
  const [showSyntaxHighlight, setShowSyntaxHighlight] = useState(true);
  
  // Auto-suggest state
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionQuery, setSuggestionQuery] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const platformName = platform === 'ios' ? 'iMessage' : 'WhatsApp';
  const borderColor = platform === 'ios' ? 'purple-300' : 'purple-400';
  const bgColor = platform === 'ios' ? 'purple-50' : 'purple-50';
  const textColor = platform === 'ios' ? 'purple-900' : 'purple-800';
  const hoverTextColor = platform === 'ios' ? 'purple-950' : 'purple-900';
  const ringColor = platform === 'ios' ? 'purple-500' : 'purple-500';
  const buttonBgColor = platform === 'ios' ? 'purple-600' : 'purple-600';
  const buttonHoverBgColor = platform === 'ios' ? 'purple-700' : 'purple-700';
  
  const outgoingText = platform === 'ios' ? 'Outgoing (blue/green bubble)' : 'Outgoing (green bubble)';
  const incomingText = platform === 'ios' ? 'Incoming (gray bubble)' : 'Incoming (white bubble)';
  
  const placeholder = platform === 'ios'
    ? "> Hey! What's up? :smile:\n< Not much, you?\n@Alice [5m] Want to grab coffee?\n> That new place downtown :fire:\n< [10:30 AM] Perfect, see you there! :heart:"
    : "> Hey! What's up? :smile:\n< Not much, you?\n@Bob [2h] Want to hang out?\n> Around 6pm?\n< [6:00 PM] Perfect! :thumbsup:";

  // Emoji shortcode mapping
  const emojiMap: Record<string, string> = {
    ':smile:': '😊', ':heart:': '❤️', ':fire:': '🔥', ':thumbsup:': '👍',
    ':cry:': '😭', ':laugh:': '😂', ':pray:': '🙏', ':skull:': '💀',
    ':sparkles:': '✨', ':100:': '💯', ':eyes:': '👀', ':ok:': '👌',
    ':clap:': '👏', ':tada:': '🎉', ':rocket:': '🚀', ':star:': '⭐',
    ':wave:': '👋', ':love:': '💕', ':thinking:': '🤔', ':cool:': '😎'
  };

  // Parse input and update preview with debounce
  const parseMessages = useCallback((text: string): Message[] => {
    const lines = text.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) return [];
    
    return lines.map(line => {
      const trimmed = line.trim();
      let outgoing = true;
      let content = trimmed;
      let customTimestamp: string | undefined;
      let sender = outgoing ? 'You' : defaultContactName;
      
      // Parse direction markers
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
      
      // Parse character shortcuts (@name)
      const charMatch = content.match(/^@(\w+)\s+(.+)/);
      if (charMatch) {
        sender = charMatch[1];
        content = charMatch[2];
        outgoing = false; // Character messages are typically incoming
      }
      
      // Parse timestamps [5m], [10:30 AM], [2h]
      const timeMatch = content.match(/\[([^\]]+)\](.+)/);
      if (timeMatch) {
        const timeStr = timeMatch[1].trim();
        content = timeMatch[2].trim();
        
        // Handle relative time (5m, 2h, 30s)
        if (/^\d+[smh]$/.test(timeStr)) {
          const value = parseInt(timeStr);
          const unit = timeStr.slice(-1);
          const now = new Date();
          
          if (unit === 'm') now.setMinutes(now.getMinutes() - value);
          else if (unit === 'h') now.setHours(now.getHours() - value);
          else if (unit === 's') now.setSeconds(now.getSeconds() - value);
          
          customTimestamp = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        } else {
          // Use provided time directly
          customTimestamp = timeStr;
        }
      }
      
      // Replace emoji shortcodes with actual emojis
      let processedContent = content;
      Object.keys(emojiMap).forEach(shortcode => {
        processedContent = processedContent.replace(new RegExp(shortcode, 'g'), emojiMap[shortcode]);
      });
      
      const message: Message = {
        id: crypto.randomUUID(),
        sender: sender,
        content: processedContent,
        outgoing: outgoing,
        timestamp: customTimestamp || (platform === 'android' ? new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''),
      };

      if (platform === 'android') {
        message.status = 'read';
      }

      return message;
    });
  }, [platform, defaultContactName, emojiMap]);

  // Debounced preview update
  useEffect(() => {
    const timer = setTimeout(() => {
      const messages = parseMessages(inputValue);
      setPreviewMessages(messages);
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [inputValue, parseMessages]);

  // Detect @ character and show suggestions
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;
    
    setInputValue(value);
    setCursorPosition(cursorPos);
    
    // Check if user is typing @ character
    const textBeforeCursor = value.substring(0, cursorPos);
    const match = textBeforeCursor.match(/@(\w*)$/);
    
    if (match && universalCharacters.length > 0) {
      setSuggestionQuery(match[1].toLowerCase());
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
      setSuggestionQuery('');
    }
  };

  // Filter characters based on query
  const filteredSuggestions = universalCharacters.filter(char =>
    char.name.toLowerCase().includes(suggestionQuery)
  ).slice(0, 5);

  // Insert character name
  const insertCharacter = (char: UniversalCharacter) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const textBeforeCursor = inputValue.substring(0, cursorPosition);
    const textAfterCursor = inputValue.substring(cursorPosition);
    
    // Find the @ symbol position
    const atIndex = textBeforeCursor.lastIndexOf('@');
    if (atIndex === -1) return;
    
    // Replace @query with @CharacterName
    const newValue = 
      inputValue.substring(0, atIndex) +
      `@${char.name} ` +
      textAfterCursor;
    
    setInputValue(newValue);
    setShowSuggestions(false);
    
    // Set cursor after inserted name
    setTimeout(() => {
      const newCursorPos = atIndex + char.name.length + 2; // +2 for @ and space
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      textarea.focus();
    }, 0);
  };

  // Generate syntax-highlighted version of input
  const getSyntaxHighlightedText = (text: string): string => {
    if (!text) return '';
    
    return text.split('\n').map(line => {
      let highlighted = line;
      
      // Highlight direction markers (>, <, Me:, Them:)
      highlighted = highlighted.replace(/^(>|→)/g, '<span style="color: #10b981; font-weight: bold;">$1</span>');
      highlighted = highlighted.replace(/^(<|←)/g, '<span style="color: #3b82f6; font-weight: bold;">$1</span>');
      highlighted = highlighted.replace(/^(Me:|You:)/gi, '<span style="color: #10b981; font-weight: bold;">$1</span>');
      highlighted = highlighted.replace(/^(Them:|Contact:)/gi, '<span style="color: #3b82f6; font-weight: bold;">$1</span>');
      
      // Highlight character names (@name)
      highlighted = highlighted.replace(/@(\w+)/g, '<span style="color: #a855f7; font-weight: bold;">@$1</span>');
      
      // Highlight timestamps ([5m], [10:30 AM])
      highlighted = highlighted.replace(/\[([^\]]+)\]/g, '<span style="color: #f59e0b; font-weight: 600;">[$1]</span>');
      
      // Highlight emoji shortcodes (:smile:)
      highlighted = highlighted.replace(/:(\w+):/g, '<span style="color: #ec4899; font-style: italic;">:$1:</span>');
      
      return highlighted;
    }).join('\n');
  };

  const handleParse = () => {
    if (!inputValue.trim()) {
      onError('Please enter at least one message');
      return;
    }
    
    const messages = parseMessages(inputValue);
    
    if (messages.length === 0) {
      onError('Please enter at least one message');
      return;
    }
    
    onAddMessages(messages);
    setInputValue('');
    setPreviewMessages([]);
    onSuccess(`Added ${messages.length} message${messages.length > 1 ? 's' : ''} to conversation!`);
  };

  const handleEmojiClick = (emoji: string) => {
    const input = document.getElementById(inputId) as HTMLTextAreaElement;
    if (input) {
      const start = input.selectionStart;
      const end = input.selectionEnd;
      const text = input.value;
      const newValue = text.substring(0, start) + emoji + text.substring(end);
      setInputValue(newValue);
      input.value = newValue;
      input.selectionStart = input.selectionEnd = start + emoji.length;
      input.focus();
    }
  };

  const borderStyle = platform === 'ios' ? 'border' : 'border-2';
  const summaryStyle = platform === 'ios' ? 'font-medium' : 'font-bold';
  const textareaStyle = platform === 'ios'
    ? 'w-full text-sm text-gray-900 bg-white p-3 rounded border border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none font-mono transition'
    : 'border-2 border-purple-300 px-4 py-3 rounded-xl w-full focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none font-mono text-sm shadow-inner';
  const buttonStyle = platform === 'ios'
    ? 'w-full px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition font-medium text-sm'
    : 'w-full px-5 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition font-bold text-sm shadow-sm hover:shadow-md';
  const emojiButtonHover = platform === 'ios' ? 'hover:bg-gray-100' : 'hover:bg-purple-100';
  const containerStyle = platform === 'ios' ? 'rounded-lg' : 'rounded-xl shadow-sm';

  return (
    <details className={`${borderStyle} border-${borderColor} ${containerStyle} bg-${bgColor}`} open>
      <summary className={`cursor-pointer ${summaryStyle} text-sm text-${textColor} hover:text-${hoverTextColor} p-4 flex items-center gap-2`}>
        <span>⚡</span>
        <span>Fast Mode - Create Multiple Messages at Once</span>
        {previewMessages.length > 0 && (
          <span className="ml-auto bg-green-500 text-white px-2 py-0.5 rounded-full text-xs font-bold">
            {previewMessages.length} ready
          </span>
        )}
      </summary>
      <div className="space-y-3 p-4 pt-0">
        <div className="bg-purple-100 border border-purple-300 rounded-lg p-3">
          <p className="text-xs text-purple-800 leading-relaxed mb-2">
            <strong>💡 Enhanced Syntax:</strong> Type your conversation with powerful shortcuts!
          </p>
          <div className="text-xs text-purple-700 space-y-1 font-mono">
            <p><code className="bg-purple-200 px-1 rounded">{'>'}</code> or <code className="bg-purple-200 px-1 rounded">Me:</code> → {outgoingText}</p>
            <p><code className="bg-purple-200 px-1 rounded">{'<'}</code> or <code className="bg-purple-200 px-1 rounded">Them:</code> → {incomingText}</p>
            <p><code className="bg-purple-200 px-1 rounded">@Alice Hello!</code> → Message from character "Alice"</p>
            <p><code className="bg-purple-200 px-1 rounded">[5m] Hey</code> → 5 minutes ago | <code className="bg-purple-200 px-1 rounded">[10:30 AM]</code> → Custom time</p>
            <p><code className="bg-purple-200 px-1 rounded">:smile: :heart: :fire:</code> → 😊 ❤️ 🔥 (auto-convert emoji codes)</p>
          </div>
        </div>

        {/* Advanced Syntax Reference */}
        <details className="bg-blue-50 border border-blue-300 rounded-lg">
          <summary className="cursor-pointer text-xs font-bold text-blue-800 p-3 hover:bg-blue-100 transition">
            📖 Full Syntax Reference (Click to expand)
          </summary>
          <div className="p-3 pt-0 space-y-3 text-xs">
            {/* Emoji Shortcuts */}
            <div>
              <h4 className="font-bold text-blue-900 mb-1">✨ Emoji Shortcuts</h4>
              <div className="grid grid-cols-2 gap-1 text-blue-700 font-mono">
                <span><code className="bg-blue-200 px-1 rounded">:smile:</code> → 😊</span>
                <span><code className="bg-blue-200 px-1 rounded">:heart:</code> → ❤️</span>
                <span><code className="bg-blue-200 px-1 rounded">:fire:</code> → 🔥</span>
                <span><code className="bg-blue-200 px-1 rounded">:thumbsup:</code> → 👍</span>
                <span><code className="bg-blue-200 px-1 rounded">:cry:</code> → 😭</span>
                <span><code className="bg-blue-200 px-1 rounded">:laugh:</code> → 😂</span>
                <span><code className="bg-blue-200 px-1 rounded">:pray:</code> → 🙏</span>
                <span><code className="bg-blue-200 px-1 rounded">:sparkles:</code> → ✨</span>
                <span><code className="bg-blue-200 px-1 rounded">:100:</code> → 💯</span>
                <span><code className="bg-blue-200 px-1 rounded">:rocket:</code> → 🚀</span>
              </div>
            </div>

            {/* Timestamp Examples */}
            <div>
              <h4 className="font-bold text-blue-900 mb-1">⏰ Timestamp Formats</h4>
              <div className="space-y-1 text-blue-700 font-mono">
                <p><code className="bg-blue-200 px-1 rounded">[5m] Message</code> → 5 minutes ago</p>
                <p><code className="bg-blue-200 px-1 rounded">[2h] Message</code> → 2 hours ago</p>
                <p><code className="bg-blue-200 px-1 rounded">[30s] Message</code> → 30 seconds ago</p>
                <p><code className="bg-blue-200 px-1 rounded">[10:30 AM] Message</code> → Custom time</p>
                <p><code className="bg-blue-200 px-1 rounded">[Yesterday] Message</code> → Custom label</p>
              </div>
            </div>

            {/* Character Examples */}
            <div>
              <h4 className="font-bold text-blue-900 mb-1">🎭 Character Names</h4>
              <div className="space-y-1 text-blue-700 font-mono">
                <p><code className="bg-blue-200 px-1 rounded">@Alice Hey there!</code> → From "Alice"</p>
                <p><code className="bg-blue-200 px-1 rounded">@Bob123 What's up?</code> → From "Bob123"</p>
                <p className="text-xs text-blue-600 mt-2">💡 Character names can be alphanumeric</p>
              </div>
            </div>

            {/* Complete Example */}
            <div>
              <h4 className="font-bold text-blue-900 mb-1">📝 Complete Example</h4>
              <div className="bg-blue-100 p-2 rounded font-mono text-blue-800 space-y-1 text-xs">
                <p>&gt; Hey everyone! :wave:</p>
                <p>@Alice [5m] Hi! :smile:</p>
                <p>@Bob [2m] What's up? :fire:</p>
                <p>&gt; [10:30 AM] Want to hang out?</p>
                <p>@Alice Sure! :heart:</p>
              </div>
            </div>
          </div>
        </details>

        {/* Split View: Input + Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left: Input Area */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-purple-800">Input</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowSyntaxHighlight(!showSyntaxHighlight)}
                  className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                >
                  {showSyntaxHighlight ? '🎨 Hide Colors' : '🎨 Show Colors'}
                </button>
                <span className="text-xs text-gray-500">{inputValue.split('\n').filter(l => l.trim()).length} lines</span>
              </div>
            </div>
            
            {/* Syntax Highlighting Container */}
            <div className="relative">
              {/* Highlighted text overlay (only visible when enabled) */}
              {showSyntaxHighlight && inputValue && (
                <div
                  className="absolute inset-0 pointer-events-none overflow-auto font-mono text-sm p-3 whitespace-pre-wrap break-words"
                  style={{
                    lineHeight: '1.5',
                    overflowWrap: 'break-word',
                    wordBreak: 'break-word',
                    zIndex: 1
                  }}
                  dangerouslySetInnerHTML={{
                    __html: getSyntaxHighlightedText(inputValue)
                  }}
                />
              )}
              
              {/* Actual textarea (transparent text when highlighting enabled) */}
              <textarea 
                ref={textareaRef}
                id={inputId}
                value={inputValue}
                onChange={handleInputChange}
                className={`${textareaStyle} relative ${showSyntaxHighlight && inputValue ? 'text-transparent caret-gray-900' : ''}`}
                style={showSyntaxHighlight && inputValue ? {
                  caretColor: '#111827',
                  background: 'transparent'
                } : {}}
                rows={10}
                placeholder={placeholder}
              />
              
              {/* Character suggestions dropdown */}
              {showSuggestions && filteredSuggestions.length > 0 && (
                <div className="absolute bottom-full left-0 mb-1 w-full max-w-xs bg-white border-2 border-purple-400 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                  <div className="p-2 bg-purple-50 border-b border-purple-200 text-xs font-semibold text-purple-900">
                    💡 Select Character
                  </div>
                  {filteredSuggestions.map((char) => (
                    <button
                      key={char.id}
                      type="button"
                      onClick={() => insertCharacter(char)}
                      className="w-full px-3 py-2 hover:bg-purple-50 transition text-left flex items-center gap-2 border-b border-gray-100 last:border-0"
                    >
                      {char.avatarUrl ? (
                        <img 
                          src={char.avatarUrl} 
                          alt={char.name}
                          className="w-8 h-8 rounded-full object-cover border-2 border-purple-400"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-purple-200 flex items-center justify-center text-purple-700 font-bold text-xs">
                          {char.name.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-gray-900 truncate">
                          {char.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          Click to insert @{char.name}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-xs text-purple-700 mr-2">Quick emojis:</span>
              {['😂', '❤️', '🔥', '👍', '😭', '🙏', '💀', '✨', '💯'].map(emoji => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleEmojiClick(emoji)}
                  className={`text-lg ${emojiButtonHover} px-2 py-1 rounded transition`}
                  title={`Add ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Right: Live Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-purple-800">Live Preview</label>
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className="text-xs text-purple-600 hover:text-purple-800 font-medium"
              >
                {showPreview ? '👁️ Hide' : '👁️ Show'}
              </button>
            </div>
            
            {showPreview && (
              <div className="border-2 border-purple-300 rounded-lg bg-white p-4 min-h-[280px] max-h-[400px] overflow-y-auto">
                {previewMessages.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <div className="text-4xl mb-2">💬</div>
                    <p className="text-sm font-medium">Start typing to see preview</p>
                    <p className="text-xs mt-1">Messages appear here in real-time</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {previewMessages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`flex ${msg.outgoing ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
                            msg.outgoing
                              ? platform === 'ios'
                                ? 'bg-blue-500 text-white'
                                : 'bg-green-100 text-gray-900'
                              : 'bg-gray-200 text-gray-900'
                          }`}
                        >
                          {!msg.outgoing && (
                            <div className="text-xs font-semibold mb-1 opacity-70">
                              {msg.sender}
                            </div>
                          )}
                          <div className="whitespace-pre-wrap break-words">
                            {msg.content}
                          </div>
                          {msg.timestamp && (
                            <div className="text-xs opacity-60 mt-1">
                              {msg.timestamp}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <button 
          type="button" 
          onClick={handleParse}
          disabled={previewMessages.length === 0}
          className={`${buttonStyle} disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          ⚡ Add {previewMessages.length > 0 ? `${previewMessages.length} Message${previewMessages.length > 1 ? 's' : ''}` : 'Messages'} to Conversation
        </button>
      </div>
    </details>
  );
}
