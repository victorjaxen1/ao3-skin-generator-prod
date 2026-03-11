import React, { useState, useEffect, useRef } from 'react';
import { Message } from '../lib/schema';
import { uploadToImgBB } from '../lib/imgbb';

interface Props {
  messages: Message[];
  template: 'ios' | 'android' | 'twitter' | 'google';
  focusedMessageId?: string | null;
  focusTrigger?: number;
  onUpdateMessage: (id: string, updates: Partial<Message>) => void;
  onDeleteMessage: (id: string) => void;
  onDuplicateMessage?: (message: Message) => void;
  onMoveUp?: (index: number) => void;
  onMoveDown?: (index: number) => void;
}

const MessageMenu: React.FC<{
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onClose: () => void;
}> = ({ onEdit, onDelete, onDuplicate, onMoveUp, onMoveDown, canMoveUp, canMoveDown, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="absolute right-0 top-8 z-20 bg-white rounded-xl shadow-lg border border-stone-200 py-1.5 min-w-[140px] animate-fade-in"
    >
      <button onClick={onEdit} className="w-full px-4 py-2 text-left text-sm text-stone-700 hover:bg-stone-50">
        Edit
      </button>
      {onDuplicate && (
        <button onClick={onDuplicate} className="w-full px-4 py-2 text-left text-sm text-stone-700 hover:bg-stone-50">
          Duplicate
        </button>
      )}
      {onMoveUp && canMoveUp && (
        <button onClick={onMoveUp} className="w-full px-4 py-2 text-left text-sm text-stone-700 hover:bg-stone-50">
          Move up
        </button>
      )}
      {onMoveDown && canMoveDown && (
        <button onClick={onMoveDown} className="w-full px-4 py-2 text-left text-sm text-stone-700 hover:bg-stone-50">
          Move down
        </button>
      )}
      <div className="border-t border-stone-100 my-1" />
      <button onClick={onDelete} className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50">
        Delete
      </button>
    </div>
  );
};

export const MessageTimeline: React.FC<Props> = ({
  messages,
  template,
  focusedMessageId,
  focusTrigger,
  onUpdateMessage,
  onDeleteMessage,
  onDuplicateMessage,
  onMoveUp,
  onMoveDown,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleImageFileForMessage = async (msgId: string, file: File) => {
    setUploadingId(msgId);
    try {
      const url = await uploadToImgBB(file);
      onUpdateMessage(msgId, { attachments: [{ type: 'image', url }] });
    } catch {
      // Upload failed – user can paste a URL manually
    } finally {
      setUploadingId(null);
    }
  };

  // Scroll to focused message
  useEffect(() => {
    if (focusedMessageId) {
      const el = document.getElementById(`timeline-msg-${focusedMessageId}`);
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('message-card-focused');
          setTimeout(() => el.classList.remove('message-card-focused'), 3000);
        }, 100);
      }
      setExpandedId(focusedMessageId);
    }
  }, [focusedMessageId, focusTrigger]);

  // Empty state
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="text-center">
          <span className="text-4xl block mb-3">💬</span>
          <p className="text-sm text-stone-500">
            Add your first message below
          </p>
          <p className="text-xs text-stone-400 mt-1">↓</p>
        </div>
      </div>
    );
  }

  const getSenderLabel = (msg: Message) => {
    if (template === 'twitter') return msg.twitterHandle ? `@${msg.twitterHandle}` : msg.sender;
    if (template === 'google') return msg.googleResultUrl || msg.content;
    return msg.outgoing ? 'You' : msg.sender;
  };

  const getSenderColor = (msg: Message) => {
    if (template === 'twitter') return 'text-stone-500';
    if (template === 'google') return 'text-green-700';
    return msg.outgoing ? 'text-violet-600' : 'text-stone-500';
  };

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
      {messages.map((msg, index) => {
        const isExpanded = expandedId === msg.id;
        const isMenuOpen = menuOpenId === msg.id;

        return (
          <div
            key={msg.id}
            id={`timeline-msg-${msg.id}`}
            className={`relative rounded-xl border transition-all ${
              isExpanded
                ? 'border-violet-200 bg-violet-50/30 shadow-sm'
                : 'border-transparent hover:bg-stone-50'
            }`}
          >
            {/* Compact row */}
            <div
              className="flex items-center gap-2 px-3 py-2.5 cursor-pointer select-none"
              onClick={() => setExpandedId(isExpanded ? null : msg.id)}
            >
              {/* Direction indicator */}
              {(template === 'ios' || template === 'android') && (
                <span
                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    msg.outgoing ? 'bg-violet-500' : 'bg-stone-300'
                  }`}
                />
              )}

              {/* Sender */}
              <span className={`text-[11px] font-medium flex-shrink-0 ${getSenderColor(msg)}`}>
                {getSenderLabel(msg)}
              </span>

              {/* Content preview */}
              <span className="text-sm text-stone-700 truncate flex-1">
                {msg.isTyping ? '...' : msg.content}
              </span>

              {/* Timestamp */}
              {msg.timestamp && (
                <span className="text-[10px] text-stone-400 flex-shrink-0">{msg.timestamp}</span>
              )}

              {/* Menu trigger */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpenId(isMenuOpen ? null : msg.id);
                }}
                className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-stone-400 hover:text-stone-600 hover:bg-stone-200 transition-colors"
              >
                ⋯
              </button>

              {/* Context menu */}
              {isMenuOpen && (
                <MessageMenu
                  onEdit={() => { setExpandedId(msg.id); setMenuOpenId(null); }}
                  onDelete={() => { onDeleteMessage(msg.id); setMenuOpenId(null); }}
                  onDuplicate={onDuplicateMessage ? () => { onDuplicateMessage(msg); setMenuOpenId(null); } : undefined}
                  onMoveUp={onMoveUp ? () => { onMoveUp(index); setMenuOpenId(null); } : undefined}
                  onMoveDown={onMoveDown ? () => { onMoveDown(index); setMenuOpenId(null); } : undefined}
                  canMoveUp={index > 0}
                  canMoveDown={index < messages.length - 1}
                  onClose={() => setMenuOpenId(null)}
                />
              )}
            </div>

            {/* Expanded edit panel */}
            {isExpanded && (
              <div className="px-3 pb-3 space-y-2 animate-fade-in">
                <textarea
                  value={msg.content}
                  onChange={(e) => onUpdateMessage(msg.id, { content: e.target.value })}
                  className="w-full text-sm bg-white border border-stone-200 rounded-lg px-3 py-2 resize-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  rows={2}
                />
                <div className="grid grid-cols-2 gap-2">
                  {(template === 'ios' || template === 'android') && (
                    <>
                      <input
                        value={msg.timestamp || ''}
                        onChange={(e) => onUpdateMessage(msg.id, { timestamp: e.target.value })}
                        placeholder="Timestamp"
                        className="text-xs bg-white border border-stone-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-violet-500"
                      />
                      <input
                        value={msg.reaction || ''}
                        onChange={(e) => onUpdateMessage(msg.id, { reaction: e.target.value })}
                        placeholder="Reaction"
                        className="text-xs bg-white border border-stone-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-violet-500"
                      />
                      <select
                        value={msg.outgoing ? 'outgoing' : 'incoming'}
                        onChange={(e) => onUpdateMessage(msg.id, {
                          outgoing: e.target.value === 'outgoing',
                          sender: e.target.value === 'outgoing' ? 'You' : msg.sender,
                        })}
                        className="text-xs bg-white border border-stone-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-violet-500"
                      >
                        <option value="outgoing">You (outgoing)</option>
                        <option value="incoming">Them (incoming)</option>
                      </select>
                      <select
                        value={msg.status || 'sent'}
                        onChange={(e) => onUpdateMessage(msg.id, { status: e.target.value as Message['status'] })}
                        className="text-xs bg-white border border-stone-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-violet-500"
                      >
                        <option value="sent">Sent</option>
                        <option value="delivered">Delivered</option>
                        <option value="read">Read</option>
                      </select>
                    </>
                  )}

                  {template === 'twitter' && (
                    <>
                      <input
                        value={msg.timestamp || ''}
                        onChange={(e) => onUpdateMessage(msg.id, { timestamp: e.target.value })}
                        placeholder="Timestamp"
                        className="text-xs bg-white border border-stone-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-violet-500"
                      />
                      <input
                        value={msg.twitterHandle || ''}
                        onChange={(e) => onUpdateMessage(msg.id, { twitterHandle: e.target.value })}
                        placeholder="@handle"
                        className="text-xs bg-white border border-stone-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-violet-500"
                      />
                      <input
                        type="number"
                        value={msg.twitterLikes ?? 0}
                        onChange={(e) => onUpdateMessage(msg.id, { twitterLikes: parseInt(e.target.value) || 0 })}
                        placeholder="Likes"
                        className="text-xs bg-white border border-stone-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-violet-500"
                      />
                      <input
                        type="number"
                        value={msg.twitterRetweets ?? 0}
                        onChange={(e) => onUpdateMessage(msg.id, { twitterRetweets: parseInt(e.target.value) || 0 })}
                        placeholder="Retweets"
                        className="text-xs bg-white border border-stone-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-violet-500"
                      />
                    </>
                  )}

                  {template === 'google' && (
                    <>
                      <input
                        value={msg.googleResultUrl || ''}
                        onChange={(e) => onUpdateMessage(msg.id, { googleResultUrl: e.target.value })}
                        placeholder="URL"
                        className="col-span-2 text-xs bg-white border border-stone-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-violet-500"
                      />
                      <textarea
                        value={msg.googleResultDescription || ''}
                        onChange={(e) => onUpdateMessage(msg.id, { googleResultDescription: e.target.value })}
                        placeholder="Description"
                        rows={2}
                        className="col-span-2 text-xs bg-white border border-stone-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-violet-500 resize-none"
                      />
                    </>
                  )}
                </div>

                {/* Image attachment — iOS / Android / Twitter */}
                {template !== 'google' && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <input
                        value={msg.attachments?.[0]?.url || ''}
                        onChange={(e) => onUpdateMessage(msg.id, {
                          attachments: e.target.value ? [{ type: 'image', url: e.target.value }] : [],
                        })}
                        placeholder="Image URL (optional)"
                        className="flex-1 text-xs bg-white border border-stone-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-violet-500"
                      />
                      {/* File upload button */}
                      <label
                        title="Upload image"
                        className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-stone-200 cursor-pointer transition-colors ${
                          uploadingId === msg.id
                            ? 'bg-violet-100 text-violet-500 cursor-not-allowed'
                            : 'bg-stone-50 text-stone-500 hover:bg-violet-50 hover:text-violet-600 hover:border-violet-300'
                        }`}
                      >
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={uploadingId === msg.id}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleImageFileForMessage(msg.id, file);
                            e.target.value = '';
                          }}
                        />
                        {uploadingId === msg.id ? (
                          <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                        )}
                      </label>
                      {/* Remove button */}
                      {msg.attachments?.[0]?.url && (
                        <button
                          onClick={() => onUpdateMessage(msg.id, { attachments: [] })}
                          title="Remove image"
                          className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-stone-200 bg-stone-50 text-stone-400 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      )}
                    </div>
                    {/* Thumbnail preview */}
                    {msg.attachments?.[0]?.url && (
                      <img
                        src={msg.attachments[0].url}
                        alt="Attachment preview"
                        className="max-h-28 w-auto rounded-lg border border-stone-200 object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default MessageTimeline;
