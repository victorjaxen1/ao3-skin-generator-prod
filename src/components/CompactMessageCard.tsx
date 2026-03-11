import React from 'react';
import Image from 'next/image';
import { Message, GroupParticipant } from '../lib/schema';

interface CompactMessageCardProps {
  message: Message;
  index: number;
  totalMessages: number;
  isExpanded: boolean;
  isFocused: boolean;
  isSelected: boolean;
  onToggleExpand: () => void;
  onToggleSelect: (selected: boolean) => void;
  onUpdate: (updates: Partial<Message>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onImageUpload?: (file: File) => Promise<void>;
  uploading?: boolean;
  template: 'ios' | 'android';
  // Group chat props (WhatsApp)
  isGroupMode?: boolean;
  groupParticipants?: GroupParticipant[];
  // Render props for template-specific expanded content
  renderExpandedContent?: () => React.ReactNode;
}

export const CompactMessageCard: React.FC<CompactMessageCardProps> = ({
  message: m,
  index: idx,
  totalMessages,
  isExpanded,
  isFocused,
  isSelected,
  onToggleExpand,
  onToggleSelect,
  onUpdate,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onImageUpload,
  uploading = false,
  template,
  isGroupMode = false,
  groupParticipants = [],
  renderExpandedContent,
}) => {
  // Theme colors based on template
  const isIOS = template === 'ios';
  const themeAccent = isIOS ? 'blue' : 'green';

  // Truncate text for preview
  const previewText = m.content.length > 60 
    ? m.content.substring(0, 60) + '...' 
    : m.content || '(empty message)';

  // Check if message has extras (image, reaction, timestamp)
  const hasImage = m.attachments && m.attachments.length > 0;
  const hasReaction = !!m.reaction;
  const hasTimestamp = !!m.timestamp;

  // Find current participant for group mode
  const currentParticipant = isGroupMode && !m.outgoing && m.participantId
    ? groupParticipants.find(p => p.id === m.participantId)
    : null;

  return (
    <div 
      id={`message-card-${m.id}`}
      className={`border rounded-lg bg-white transition-all ${
        isFocused 
          ? `message-card-focused ring-2 ${isIOS ? 'ring-blue-500 border-blue-300' : 'ring-green-500 border-green-300'} ring-offset-2` 
          : 'border-gray-200 hover:border-gray-300'
      } ${isExpanded ? 'shadow-md' : 'hover:shadow-sm'}`}
    >
      {/* Compact Header - Always Visible */}
      <div 
        className={`flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 cursor-pointer select-none ${
          isExpanded ? `border-b border-gray-100 ${isIOS ? 'bg-blue-50/50' : 'bg-green-50/50'}` : 'hover:bg-gray-50/50'
        }`}
        onClick={(e) => {
          // Don't toggle if clicking on checkbox or buttons
          if ((e.target as HTMLElement).closest('button, input[type="checkbox"]')) return;
          onToggleExpand();
        }}
      >
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation();
            onToggleSelect(e.target.checked);
          }}
          className={`w-4 h-4 rounded border-gray-300 ${isIOS ? 'text-blue-600 focus:ring-blue-500' : 'text-green-600 focus:ring-green-500'} focus:ring-2`}
          title="Select for bulk actions"
        />

        {/* Direction Toggle Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onUpdate({ outgoing: !m.outgoing });
          }}
          className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
            m.outgoing 
              ? (isIOS ? 'bg-blue-100 text-blue-600 hover:bg-blue-200' : 'bg-green-100 text-green-600 hover:bg-green-200')
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
          title={`${m.outgoing ? 'Outgoing' : 'Incoming'} - Click to toggle`}
        >
          {m.outgoing ? '↗' : '↙'}
        </button>

        {/* Participant Avatar (Group Mode - Incoming) */}
        {isGroupMode && !m.outgoing && (
          <div className="flex-shrink-0" title={currentParticipant?.name || 'No participant assigned'}>
            {currentParticipant?.avatarUrl ? (
              <Image
                src={currentParticipant.avatarUrl}
                alt={currentParticipant.name}
                width={24}
                height={24}
                className="rounded-full object-cover border border-gray-200"
                unoptimized
              />
            ) : currentParticipant ? (
              <div 
                className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold border border-gray-200"
                style={{ backgroundColor: `${currentParticipant.color}20`, color: currentParticipant.color }}
              >
                {currentParticipant.name.substring(0, 2).toUpperCase()}
              </div>
            ) : (
              <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[9px] text-gray-400">
                ?
              </div>
            )}
          </div>
        )}

        {/* Message Preview */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[10px] font-semibold text-gray-400">#{idx + 1}</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold tracking-wide ${
              m.outgoing 
                ? (isIOS ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700')
                : 'bg-gray-100 text-gray-600'
            }`}>
              {m.outgoing ? 'OUT' : (isGroupMode && currentParticipant ? currentParticipant.name : 'IN')}
            </span>
            {hasImage && <span className="text-[10px]" title="Has image">🖼️</span>}
            {hasReaction && <span className="text-[10px]" title={`Reaction: ${m.reaction}`}>{m.reaction}</span>}
            {hasTimestamp && (
              <span className="text-[10px] text-gray-400 hidden sm:inline">
                {m.timestamp}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-700 truncate leading-tight" title={m.content}>
            {previewText}
          </p>
        </div>

        {/* Compact Action Buttons */}
        <div className="flex items-center gap-0.5 flex-shrink-0 opacity-60 group-hover:opacity-100">
          {idx > 0 && (
            <button 
              type="button" 
              onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
              className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1 rounded transition text-xs"
              title="Move up"
            >
              ↑
            </button>
          )}
          {idx < totalMessages - 1 && (
            <button 
              type="button" 
              onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
              className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1 rounded transition text-xs"
              title="Move down"
            >
              ↓
            </button>
          )}
          <button 
            type="button" 
            onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
            className="text-gray-400 hover:text-blue-600 hover:bg-blue-50 p-1 rounded transition text-xs"
            title="Duplicate"
          >
            📋
          </button>
          <button 
            type="button" 
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-1 rounded transition text-xs"
            title="Delete"
          >
            ✕
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
            className={`p-1 rounded transition text-xs font-bold ${
              isExpanded 
                ? `${isIOS ? 'text-blue-600 bg-blue-100' : 'text-green-600 bg-green-100'}` 
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            }`}
            title={isExpanded ? 'Collapse' : 'Expand to edit'}
          >
            {isExpanded ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {/* Expanded Editor Content */}
      {isExpanded && (
        <div className="p-3 sm:p-4 space-y-4 animate-fadeIn">
          {renderExpandedContent ? (
            renderExpandedContent()
          ) : (
            // Default expanded content (fallback)
            <>
              {/* Participant Selector (Group Mode - Incoming Messages Only) */}
              {isGroupMode && !m.outgoing && groupParticipants.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-700 uppercase tracking-wide">Speaker / Participant</label>
                  <select
                    aria-label="Select message participant"
                    value={m.participantId || ''}
                    onChange={(e) => {
                      const participantId = e.target.value;
                      const participant = groupParticipants.find(p => p.id === participantId);
                      onUpdate({
                        participantId: participantId || undefined,
                        roleColor: participant?.color || undefined,
                        sender: participant?.name || 'Contact'
                      });
                    }}
                    className={`w-full text-sm text-gray-900 bg-white p-2.5 rounded border border-gray-300 focus:outline-none focus:ring-2 ${isIOS ? 'focus:ring-blue-500' : 'focus:ring-green-500'} focus:border-transparent transition`}
                  >
                    <option value="">-- Select Participant --</option>
                    {groupParticipants.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  {currentParticipant && (
                    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-200">
                      {currentParticipant.avatarUrl ? (
                        <Image 
                          src={currentParticipant.avatarUrl} 
                          alt={currentParticipant.name} 
                          width={24}
                          height={24}
                          className="rounded-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <div 
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold"
                          style={{ backgroundColor: `${currentParticipant.color}20`, color: currentParticipant.color }}
                        >
                          {currentParticipant.name.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      <span 
                        className="text-xs font-semibold" 
                        style={{ color: currentParticipant.color }}
                      >
                        {currentParticipant.name}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Content */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-700 uppercase tracking-wide">Content</label>
                <textarea 
                  id={`msg-content-${m.id}`}
                  className={`w-full text-sm text-gray-900 bg-white p-3 rounded border border-gray-300 focus:outline-none focus:ring-2 ${isIOS ? 'focus:ring-blue-500' : 'focus:ring-green-500'} focus:border-transparent resize-none transition`}
                  rows={Math.max(2, Math.ceil(m.content.length / 60))} 
                  value={m.content} 
                  onChange={e => onUpdate({ content: e.target.value })}
                  placeholder="Message text..."
                  autoFocus
                />
                <div className="text-[10px] text-gray-400">
                  💡 Formatting: <code className="bg-gray-100 px-1 rounded">*bold*</code> <code className="bg-gray-100 px-1 rounded">_italic_</code> <code className="bg-gray-100 px-1 rounded">~strike~</code> <code className="bg-gray-100 px-1 rounded">`code`</code>
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  {['😂', '❤️', '🔥', '👍', '😭', '🙏', '💀', '✨', '💯'].map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => onUpdate({ content: m.content + emoji })}
                      className="text-base hover:bg-gray-100 px-1.5 py-0.5 rounded transition"
                      title={`Add ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Image */}
              {hasImage ? (
                <div>
                  <label className="text-xs font-medium text-gray-700 uppercase tracking-wide mb-2 block">Image</label>
                  <div className="bg-gray-50 rounded p-3 border border-gray-200">
                    <div className="flex items-center gap-3">
                      <Image 
                        src={m.attachments![0].url} 
                        alt="Message" 
                        width={64}
                        height={64}
                        className="rounded object-cover border border-gray-300" 
                        unoptimized
                      />
                      <button
                        type="button"
                        onClick={() => onUpdate({ attachments: undefined })}
                        className="text-xs text-red-600 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 transition"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-xs font-medium text-gray-700 uppercase tracking-wide mb-2 block">Add Image</label>
                  <div className="flex items-center gap-2">
                    <input 
                      className={`flex-1 text-sm text-gray-900 bg-white p-2.5 rounded border border-gray-300 focus:outline-none focus:ring-2 ${isIOS ? 'focus:ring-blue-500' : 'focus:ring-green-500'} focus:border-transparent transition`}
                      placeholder="Paste image URL (Enter to add)"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const url = (e.target as HTMLInputElement).value.trim();
                          if (url) {
                            onUpdate({ attachments: [{ type: 'image', url }] });
                            (e.target as HTMLInputElement).value = '';
                          }
                        }
                      }}
                    />
                    {onImageUpload && (
                      <label className={`cursor-pointer flex items-center justify-center px-3 py-2.5 bg-white text-gray-600 rounded border border-gray-300 hover:bg-gray-50 transition text-sm ${uploading ? 'opacity-50' : ''}`}>
                        {uploading ? '⏳' : '📷'}
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file && onImageUpload) {
                              await onImageUpload(file);
                            }
                          }}
                          className="hidden" 
                          disabled={uploading} 
                        />
                      </label>
                    )}
                  </div>
                </div>
              )}

              {/* Metadata Row */}
              <div className="grid grid-cols-2 gap-2 pt-3 border-t border-gray-100">
                <input 
                  className={`w-full text-sm text-gray-900 bg-white p-2.5 rounded border border-gray-300 focus:outline-none focus:ring-2 ${isIOS ? 'focus:ring-blue-500' : 'focus:ring-green-500'} focus:border-transparent transition`}
                  value={m.timestamp || ''} 
                  onChange={e => onUpdate({ timestamp: e.target.value })} 
                  placeholder="Time (e.g. 2:34 PM)"
                />
                <select
                  aria-label="Message reaction"
                  className={`w-full text-sm text-gray-900 bg-white p-2.5 rounded border border-gray-300 focus:outline-none focus:ring-2 ${isIOS ? 'focus:ring-blue-500' : 'focus:ring-green-500'} focus:border-transparent transition`}
                  value={m.reaction || ''}
                  onChange={e => onUpdate({ reaction: e.target.value || undefined })}
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
                onClick={() => onUpdate({ outgoing: !m.outgoing })}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded text-sm font-medium transition-all text-white focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  m.outgoing 
                    ? (isIOS ? 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500' : 'bg-green-600 hover:bg-green-700 focus:ring-green-500')
                    : 'bg-gray-600 hover:bg-gray-700 focus:ring-gray-500'
                }`}
              >
                <span>{m.outgoing ? '📤' : '📥'}</span>
                <span>Switch to {m.outgoing ? 'Incoming' : 'Outgoing'}</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default CompactMessageCard;
