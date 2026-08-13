import React, { useState, useEffect, useRef } from 'react';
import { Message, SkinProject, SkinSettings } from '../lib/schema';
import { IdentityTarget, resolveMessageIdentity } from '../lib/identity';
import { ImageUrlInput } from './ImageUrlInput';
import { MessageEmojiPicker, MessageEmojiTrigger } from './MessageEmojiPicker';
import { ReactionPicker } from './ReactionPicker';
import { automaticDeliveryStatus } from '../lib/messageMetadata';

interface Props {
  messages: Message[];
  template: 'ios' | 'android' | 'twitter' | 'google';
  settings: SkinSettings;
  project: SkinProject;
  onIdentityClick?: (target: IdentityTarget) => void;
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
  settings,
  project,
  onIdentityClick,
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
  const [emojiOpenId, setEmojiOpenId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const messageInputRefs = useRef(new Map<string, HTMLTextAreaElement>());

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
    const emptyState = {
      ios: { icon: '💬', text: 'Add your first message below' },
      android: { icon: '💬', text: 'Add your first message below' },
      twitter: { icon: '🐦', text: 'Write your first post below' },
      google: { icon: '🔍', text: 'Add your first search result below' },
    }[template];

    return (
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="text-center">
          <span className="text-4xl block mb-3">{emptyState.icon}</span>
          <p className="text-sm text-stone-500">{emptyState.text}</p>
          <p className="text-xs text-stone-400 mt-1">↓</p>
        </div>
      </div>
    );
  }

  // What the author calls themselves. iMessage and WhatsApp never draw this on
  // screen, so the editor is one of only two places it is visible at all (the
  // other is the compose chip) — leaving it as a literal "You" here is half of
  // the "my own name lives nowhere" complaint.
  const youLabel = settings.chatYourName?.trim() || 'You';

  const getSenderLabel = (msg: Message) => {
    const identity = resolveMessageIdentity(project, msg);
    if (template === 'twitter') {
      return identity.twitterHandle ? `@${identity.twitterHandle}` : identity.name;
    }
    if (template === 'google') return msg.googleResultUrl || msg.content;
    return identity.name;
  };

  const identityTarget = (msg: Message): IdentityTarget | undefined => {
    if (template === 'google') return undefined;
    if (msg.characterId) return { kind: 'character', id: msg.characterId };
    if (template === 'twitter') return { kind: 'twitter-primary' };
    if (msg.outgoing) return { kind: 'self' };
    if (msg.participantId) return { kind: 'participant', id: msg.participantId };
    return { kind: 'contact' };
  };

  const getSenderColor = (msg: Message) => {
    if (template === 'twitter') return 'text-stone-500';
    if (template === 'google') return 'text-green-700';
    return msg.outgoing ? 'text-violet-600' : 'text-stone-500';
  };

  const insertMessageEmoji = (msg: Message, emoji: string) => {
    const input = messageInputRefs.current.get(msg.id);
    const start = input?.selectionStart ?? msg.content.length;
    const end = input?.selectionEnd ?? start;
    onUpdateMessage(msg.id, {
      content: `${msg.content.slice(0, start)}${emoji}${msg.content.slice(end)}`,
    });

    requestAnimationFrame(() => {
      const nextInput = messageInputRefs.current.get(msg.id);
      if (!nextInput) return;
      const caret = start + emoji.length;
      nextInput.focus();
      nextInput.setSelectionRange(caret, caret);
    });
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
              onClick={() => {
                setExpandedId(isExpanded ? null : msg.id);
                if (isExpanded) setEmojiOpenId(null);
              }}
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
              <button
                type="button"
                disabled={template === 'google'}
                onClick={(event) => {
                  event.stopPropagation();
                  const target = identityTarget(msg);
                  if (target) onIdentityClick?.(target);
                }}
                className={`text-[11px] font-medium flex-shrink-0 ${getSenderColor(msg)} ${template === 'google' ? '' : 'hover:underline focus:underline'}`}
                aria-label={template === 'google' ? undefined : `Edit ${getSenderLabel(msg)}`}
              >
                {getSenderLabel(msg)}
              </button>

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
                <div className="relative">
                  <textarea
                    ref={element => {
                      if (element) messageInputRefs.current.set(msg.id, element);
                      else messageInputRefs.current.delete(msg.id);
                    }}
                    value={msg.content}
                    onChange={(e) => onUpdateMessage(msg.id, { content: e.target.value })}
                    onKeyDown={event => {
                      if (event.key === 'Escape' && emojiOpenId === msg.id) {
                        event.preventDefault();
                        setEmojiOpenId(null);
                      }
                    }}
                    className={`w-full resize-none rounded-lg border border-stone-200 bg-white py-2 pl-3 text-sm focus:border-transparent focus:ring-2 focus:ring-violet-500 ${template === 'google' ? 'pr-3' : 'pr-10'}`}
                    rows={2}
                  />
                  {template !== 'google' && (
                    <MessageEmojiTrigger
                      expanded={emojiOpenId === msg.id}
                      controlsId={`timeline-${msg.id}-emoji-options`}
                      onToggle={() => setEmojiOpenId(openId => openId === msg.id ? null : msg.id)}
                    />
                  )}
                </div>
                {template !== 'google' && emojiOpenId === msg.id && (
                  <div className="rounded-lg border border-stone-200 bg-stone-50/70 p-2">
                    <MessageEmojiPicker
                      id={`timeline-${msg.id}-emoji-options`}
                      onInsert={emoji => insertMessageEmoji(msg, emoji)}
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {(template === 'ios' || template === 'android') && (
                    <>
                      <input
                        value={msg.timestamp || ''}
                        onChange={(e) => onUpdateMessage(msg.id, { timestamp: e.target.value })}
                        placeholder="Timestamp"
                        className="text-xs bg-white border border-stone-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-violet-500"
                      />
                      {/* The reaction moved out of this grid and below it —
                          six chips do not fit a half-width cell. Three cells
                          now lay out 2+1, with the status select as the odd
                          one, which is the least surprising of the three to
                          sit alone. */}
                      <select
                        value={msg.outgoing ? 'outgoing' : 'incoming'}
                        onChange={(e) => onUpdateMessage(msg.id, {
                          outgoing: e.target.value === 'outgoing',
                          sender: e.target.value === 'outgoing' ? youLabel : msg.sender,
                          characterId: e.target.value === 'outgoing' ? project.cast?.selfId : project.cast?.contactId,
                          status: e.target.value === 'outgoing' ? 'delivered' : undefined,
                          statusMode: e.target.value === 'outgoing' ? 'auto' : undefined,
                        })}
                        className="text-xs bg-white border border-stone-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-violet-500"
                      >
                        <option value="outgoing">{youLabel} (outgoing)</option>
                        <option value="incoming">Them (incoming)</option>
                      </select>
                      {msg.outgoing && (
                        <select
                          value={msg.statusMode === 'auto' ? 'auto' : msg.status || 'sent'}
                          onChange={(e) => {
                            const value = e.target.value;
                            onUpdateMessage(msg.id, value === 'auto'
                              ? { status: automaticDeliveryStatus(messages, index), statusMode: 'auto' }
                              : { status: value as Message['status'], statusMode: 'manual' });
                          }}
                          aria-label="Delivery status"
                          className="text-xs bg-white border border-stone-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-violet-500"
                        >
                          <option value="auto">Automatic</option>
                          <option value="sent">Sent</option>
                          <option value="delivered">Delivered</option>
                          <option value="read">Read</option>
                        </select>
                      )}
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
                      <button
                        type="button"
                        onClick={() => {
                          const target = identityTarget(msg);
                          if (target) onIdentityClick?.(target);
                        }}
                        className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-left text-xs text-violet-700 hover:bg-violet-50"
                      >
                        Edit posting account
                      </button>
                      {/* Only when the metrics actually render. With "Show
                          metrics" off the generator emits none of these, so
                          four number inputs per tweet were editing values that
                          appear nowhere. */}
                      {settings.twitterShowMetrics !== false && (
                      <>
                      <input
                        type="number"
                        min={0}
                        value={msg.twitterLikes ?? 0}
                        onChange={(e) => onUpdateMessage(msg.id, { twitterLikes: parseInt(e.target.value) || 0 })}
                        placeholder="Likes"
                        aria-label="Likes"
                        className="text-xs bg-white border border-stone-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-violet-500"
                      />
                      <input
                        type="number"
                        min={0}
                        value={msg.twitterRetweets ?? 0}
                        onChange={(e) => onUpdateMessage(msg.id, { twitterRetweets: parseInt(e.target.value) || 0 })}
                        placeholder="Retweets"
                        aria-label="Retweets"
                        className="text-xs bg-white border border-stone-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-violet-500"
                      />
                      <input
                        type="number"
                        min={0}
                        value={msg.twitterReplies ?? 0}
                        onChange={(e) => onUpdateMessage(msg.id, { twitterReplies: parseInt(e.target.value) || 0 })}
                        placeholder="Replies"
                        aria-label="Replies"
                        className="text-xs bg-white border border-stone-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-violet-500"
                      />
                      <input
                        type="number"
                        min={0}
                        value={msg.twitterViews ?? 0}
                        onChange={(e) => onUpdateMessage(msg.id, { twitterViews: parseInt(e.target.value) || 0 })}
                        placeholder="Views"
                        aria-label="Views"
                        className="text-xs bg-white border border-stone-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-violet-500"
                      />
                      </>
                      )}
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

                {/* Outside the grid: six chips plus a custom field need the
                    full width. Narrowed to the two platforms with a reaction
                    rendering path — TypeScript enforces it rather than a
                    comment (see ReactionPicker's Props). */}
                {(template === 'ios' || template === 'android') && (
                  <ReactionPicker
                    template={template}
                    value={msg.reaction || ''}
                    onChange={(v) => onUpdateMessage(msg.id, { reaction: v })}
                    idPrefix={msg.id}
                  />
                )}

                {/* Image attachment — iOS / Android / Twitter */}
                {template !== 'google' && (
                  <ImageUrlInput
                    value={msg.attachments?.[0]?.url || ''}
                    onChange={(url) =>
                      onUpdateMessage(msg.id, {
                        attachments: url
                          ? [{
                              type: 'image',
                              url,
                              alt: msg.attachments?.[0]?.alt || '',
                              decorative: msg.attachments?.[0]?.decorative || false,
                            }]
                          : [],
                      })
                    }
                    ariaLabel="Image address for this message"
                    placeholder="Paste an image address (optional)"
                  />
                )}
                {template !== 'google' && msg.attachments?.[0]?.url && (
                  <div className="space-y-1.5">
                    <input
                      value={msg.attachments[0].alt || ''}
                      onChange={event => onUpdateMessage(msg.id, {
                        attachments: [{ ...msg.attachments![0], alt: event.target.value }],
                      })}
                      disabled={msg.attachments[0].decorative === true}
                      maxLength={500}
                      aria-label="Image description"
                      placeholder="Describe the image for readers"
                      className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs disabled:bg-stone-100 disabled:text-stone-400"
                    />
                    <label className="flex items-center gap-2 text-xs text-stone-600">
                      <input
                        type="checkbox"
                        checked={msg.attachments[0].decorative === true}
                        onChange={event => onUpdateMessage(msg.id, {
                          attachments: [{ ...msg.attachments![0], decorative: event.target.checked, ...(event.target.checked ? { alt: '' } : {}) }],
                        })}
                        className="accent-violet-600"
                      />
                      Decorative image — use empty alt text
                    </label>
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
