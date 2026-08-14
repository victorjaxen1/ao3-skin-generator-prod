import React, { useState, useEffect, useRef } from 'react';
import { Message, SkinProject, SkinSettings } from '../lib/schema';
import { IdentityTarget, resolveMessageIdentity } from '../lib/identity';
import { MessageEmojiPicker, MessageEmojiTrigger } from './MessageEmojiPicker';
import { automaticDeliveryStatus, nextChatTimestamp } from '../lib/messageMetadata';
import { deriveTwitterReplyHandles, getTwitterDescendantIds, getTwitterSceneMode } from '../lib/twitter';
import TwitterPostExtrasEditor from './TwitterPostExtrasEditor';
import WhatsAppMessageExtrasEditor from './WhatsAppMessageExtrasEditor';
import IOSMessageExtrasEditor from './IOSMessageExtrasEditor';
import { whatsappMessageLabel } from '../lib/whatsapp';

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

/**
 * Would this move leave a reply sitting before the message it answers?
 *
 * Generalized over the reply pointer rather than duplicated per platform: iOS
 * and WhatsApp have separate reply fields by design (§0.1), but "a reply must
 * come after its target" is one rule, and two copies of it would drift.
 */
function canMoveReplyAwareMessage(
  messages: Message[],
  index: number,
  offset: -1 | 1,
  replyTargetId: (message: Message) => string | undefined
): boolean {
  const target = index + offset;
  if (target < 0 || target >= messages.length) return false;
  const next = [...messages];
  [next[index], next[target]] = [next[target], next[index]];
  const positions = new Map(next.map((message, position) => [message.id, position]));
  return next.every((message, position) => {
    const pointer = replyTargetId(message);
    return !pointer || (positions.get(pointer) ?? position) < position;
  });
}

function canMoveMessage(template: string, messages: Message[], index: number, offset: -1 | 1): boolean {
  if (template === 'android') return canMoveReplyAwareMessage(messages, index, offset, message => message.whatsappReply?.messageId);
  if (template === 'ios') return canMoveReplyAwareMessage(messages, index, offset, message => message.iosReply?.messageId);
  const target = index + offset;
  return target >= 0 && target < messages.length;
}

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
    if (template === 'android' && msg.whatsappEvent) return msg.whatsappEvent.kind === 'date' ? 'Date' : 'System';
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

  const twitterSceneMode = template === 'twitter' ? getTwitterSceneMode(project) : 'timeline';
  const twitterAccounts = project.cast?.characters || [];
  const groupParticipants = template === 'android'
    ? settings.androidGroupParticipants || []
    : settings.iosGroupParticipants || [];
  const groupMode = template === 'android' ? settings.androidGroupMode : settings.iosGroupMode;

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
        const twitterDescendants = template === 'twitter' ? getTwitterDescendantIds(messages, msg.id) : new Set<string>();
        const hasMissingParent = !!msg.parentId && !messages.some(candidate => candidate.id === msg.parentId);
        const canMoveUp = index > 0 && canMoveMessage(template, messages, index, -1);
        const canMoveDown = index < messages.length - 1 && canMoveMessage(template, messages, index, 1);

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
              {(template === 'ios' || template === 'android') && !msg.whatsappEvent && !msg.iosEvent && (
                <span
                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    msg.outgoing ? 'bg-violet-500' : 'bg-stone-300'
                  }`}
                />
              )}

              {/* Sender */}
              <button
                type="button"
                disabled={template === 'google' || !!msg.whatsappEvent || !!msg.iosEvent}
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
                {template === 'android' ? whatsappMessageLabel(msg) : msg.isTyping ? '...' : msg.content}
              </span>

              {/* Timestamp */}
                {msg.timestamp && !msg.whatsappEvent && (
                <span className="text-[10px] text-stone-400 flex-shrink-0">{msg.timestamp}</span>
              )}

              {/* Menu trigger */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpenId(isMenuOpen ? null : msg.id);
                }}
                aria-label={`Post options for ${msg.content.replace(/\s+/g, ' ').slice(0, 40) || 'untitled post'}`}
                aria-expanded={isMenuOpen}
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
                  canMoveUp={canMoveUp}
                  canMoveDown={canMoveDown}
                  onClose={() => setMenuOpenId(null)}
                />
              )}
            </div>

            {/* Expanded edit panel */}
            {isExpanded && (
              <div className="px-3 pb-3 space-y-2 animate-fade-in">
                {!msg.whatsappEvent && <div className="relative">
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
                </div>}
                {!msg.whatsappEvent && template !== 'google' && emojiOpenId === msg.id && (
                  <div className="rounded-lg border border-stone-200 bg-stone-50/70 p-2">
                    <MessageEmojiPicker
                      id={`timeline-${msg.id}-emoji-options`}
                      onInsert={emoji => insertMessageEmoji(msg, emoji)}
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {(template === 'ios' || template === 'android') && !msg.whatsappEvent && !msg.iosEvent && (
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
                        onChange={(e) => {
                          const outgoing = e.target.value === 'outgoing';
                          const participant = !outgoing && groupMode ? groupParticipants[0] : undefined;
                          onUpdateMessage(msg.id, {
                            outgoing,
                            sender: outgoing ? youLabel : participant?.name || msg.sender,
                            participantId: participant?.id,
                            characterId: outgoing ? project.cast?.selfId : participant?.characterId || project.cast?.contactId,
                            status: outgoing ? 'delivered' : undefined,
                            statusMode: outgoing ? 'auto' : undefined,
                          });
                        }}
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
                      <div className="flex min-w-0 rounded-lg border border-stone-200 bg-white">
                        <input
                          value={msg.timestamp || ''}
                          onChange={(e) => onUpdateMessage(msg.id, { timestamp: e.target.value })}
                          placeholder="Timestamp"
                          aria-label="Post timestamp"
                          className="min-w-0 flex-1 border-0 bg-transparent px-3 py-1.5 text-xs focus:ring-2 focus:ring-violet-500"
                        />
                        <button
                          type="button"
                          onClick={() => onUpdateMessage(msg.id, { timestamp: nextChatTimestamp(messages.slice(0, index)) })}
                          aria-label="Use automatic timestamp"
                          title="Use the next story time"
                          className="border-l border-stone-200 px-2 text-[10px] font-medium text-violet-700 hover:bg-violet-50"
                        >
                          Auto
                        </button>
                      </div>
                      <select
                        value={msg.characterId || project.cast?.twitterPrimaryId || ''}
                        onChange={event => onUpdateMessage(msg.id, {
                          characterId: event.target.value || undefined,
                          useCustomIdentity: false,
                          twitterHandle: undefined,
                          avatarUrl: undefined,
                          verified: undefined,
                        })}
                        aria-label="Posting account"
                        className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs focus:ring-2 focus:ring-violet-500"
                      >
                        {twitterAccounts.map(account => (
                          <option key={account.id} value={account.id}>{account.name}{account.archived ? ' (archived)' : ''}</option>
                        ))}
                      </select>
                      {groupMode && !msg.outgoing && groupParticipants.length > 0 && (
                        <select
                          value={msg.participantId || ''}
                          onChange={event => {
                            const participant = groupParticipants.find(candidate => candidate.id === event.target.value);
                            onUpdateMessage(msg.id, {
                              participantId: participant?.id,
                              characterId: participant?.characterId,
                              sender: participant?.name || msg.sender,
                            });
                          }}
                          aria-label="Speaking as"
                          className="text-xs bg-white border border-stone-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-violet-500"
                        >
                          <option value="">Select person</option>
                          {groupParticipants.map(participant => <option key={participant.id} value={participant.id}>{participant.name}</option>)}
                        </select>
                      )}
                      <select
                        value={msg.twitterLayout || (msg.expandedView ? 'expanded' : 'auto')}
                        onChange={event => onUpdateMessage(msg.id, {
                          twitterLayout: event.target.value as Message['twitterLayout'],
                          expandedView: undefined,
                        })}
                        aria-label="Post layout"
                        className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs focus:ring-2 focus:ring-violet-500"
                      >
                        <option value="auto">Automatic layout</option>
                        <option value="expanded">Expanded</option>
                        <option value="compact">Compact</option>
                      </select>
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

                {template === 'twitter' && twitterSceneMode !== 'single' && (
                  <div className="rounded-lg border border-stone-200 bg-white p-3 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-medium text-stone-700">Relationship</span>
                      <select
                        value={msg.parentId ? 'reply' : 'post'}
                        onChange={event => {
                          if (event.target.value !== 'reply') {
                            onUpdateMessage(msg.id, { parentId: undefined, replyToHandles: undefined, twitterReplyHandlesMode: undefined });
                            return;
                          }
                          const candidates = [...messages.slice(0, index).reverse(), ...messages.slice(index + 1)];
                          const parentId = candidates.find(candidate => candidate.id !== msg.id && !twitterDescendants.has(candidate.id))?.id;
                          onUpdateMessage(msg.id, { parentId, twitterReplyHandlesMode: parentId ? 'auto' : undefined });
                        }}
                        aria-label="Post relationship"
                        className="rounded-lg border border-stone-200 bg-stone-50 px-2 py-1 text-xs"
                      >
                        <option value="post">New post</option>
                        <option value="reply" disabled={messages.length < 2}>Reply</option>
                      </select>
                    </div>
                    {msg.parentId && (
                      <>
                        <select
                          value={hasMissingParent ? '' : msg.parentId}
                          onChange={event => onUpdateMessage(msg.id, {
                            parentId: event.target.value || undefined,
                            twitterReplyHandlesMode: 'auto',
                          })}
                          aria-label="Reply parent"
                          className="w-full rounded-lg border border-stone-200 bg-stone-50 px-2 py-1.5 text-xs"
                        >
                          {hasMissingParent && <option value="">Missing parent: {msg.parentId}</option>}
                          {messages.map(candidate => {
                            const identity = resolveMessageIdentity(project, candidate);
                            const invalid = candidate.id === msg.id || twitterDescendants.has(candidate.id);
                            return (
                              <option key={candidate.id} value={candidate.id} disabled={invalid}>
                                @{identity.twitterHandle || identity.name} — {candidate.content.replace(/\s+/g, ' ').slice(0, 45) || 'Post'}
                              </option>
                            );
                          })}
                        </select>
                        {hasMissingParent && (
                          <p role="alert" className="text-xs text-amber-700">The original parent no longer exists. Choose a new parent or make this a new post.</p>
                        )}
                        <div className="flex items-center gap-2">
                          <select
                            value={msg.twitterReplyHandlesMode || (msg.replyToHandles ? 'manual' : 'auto')}
                            onChange={event => onUpdateMessage(msg.id, {
                              twitterReplyHandlesMode: event.target.value as Message['twitterReplyHandlesMode'],
                              ...(event.target.value === 'auto' ? { replyToHandles: undefined } : {}),
                            })}
                            aria-label="Replying-to handles"
                            className="rounded-lg border border-stone-200 bg-stone-50 px-2 py-1.5 text-xs"
                          >
                            <option value="auto">Handles: Automatic</option>
                            <option value="manual">Handles: Manual</option>
                          </select>
                          {(msg.twitterReplyHandlesMode === 'manual' || (!msg.twitterReplyHandlesMode && msg.replyToHandles)) ? (
                            <input
                              value={(msg.replyToHandles || []).map(handle => `@${handle.replace(/^@+/, '')}`).join(', ')}
                              onChange={event => onUpdateMessage(msg.id, {
                                replyToHandles: event.target.value.split(',').map(handle => handle.trim().replace(/^@+/, '')).filter(Boolean),
                              })}
                              aria-label="Manual reply handles"
                              placeholder="@casey, @morgan"
                              className="min-w-0 flex-1 rounded-lg border border-stone-200 px-2 py-1.5 text-xs"
                            />
                          ) : (
                            <span className="min-w-0 flex-1 truncate text-xs text-stone-500">
                              {deriveTwitterReplyHandles(project, msg).map(handle => `@${handle}`).join(', ') || 'Select a valid parent'}
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {template === 'twitter' && (
                  <TwitterPostExtrasEditor
                    message={msg}
                    project={project}
                    onChange={updates => onUpdateMessage(msg.id, updates)}
                  />
                )}

                {template === 'android' && (
                  <WhatsAppMessageExtrasEditor
                    message={msg}
                    project={project}
                    index={index}
                    idPrefix={msg.id}
                    onChange={updates => onUpdateMessage(msg.id, updates)}
                  />
                )}

                {/* One editor, the same one the composer uses. The old path
                    here was a single-image field plus the shared ReactionPicker,
                    which between them could only express one image and one
                    emoji — and, worse, wrote to `attachments[0]` and `reaction`
                    directly, so either could overwrite what the other had set. */}
                {template === 'ios' && (
                  <IOSMessageExtrasEditor
                    message={msg}
                    project={project}
                    index={index}
                    idPrefix={msg.id}
                    onChange={updates => onUpdateMessage(msg.id, updates)}
                  />
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
