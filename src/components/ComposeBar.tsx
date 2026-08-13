import React, { useState, useRef, useEffect } from 'react';
import { Message, SceneCast, SkinSettings, GroupParticipant, TwitterCharacter } from '../lib/schema';
import { normalizeImageUrl } from '../lib/urlNormalize';
import { ImageUrlInput } from './ImageUrlInput';
import { MessageEmojiPicker, MessageEmojiTrigger } from './MessageEmojiPicker';
import { ReactionPicker } from './ReactionPicker';
import { nextChatTimestamp, nextChatTimestampFromHistory } from '../lib/messageMetadata';

interface Props {
  template: 'ios' | 'android' | 'twitter' | 'google';
  settings: SkinSettings;
  messages: Message[];
  onAddMessage: (message: Message) => void;
  twitterCharacters?: TwitterCharacter[];
  cast?: SceneCast;
  onAddIdentity?: () => void;
  onEditActiveIdentity?: (target: { kind: 'self' | 'contact' | 'twitter-primary' | 'character'; id?: string }) => void;
}

export const ComposeBar: React.FC<Props> = ({
  template,
  settings,
  messages,
  onAddMessage,
  twitterCharacters,
  cast,
  onAddIdentity,
  onEditActiveIdentity,
}) => {
  const [content, setContent] = useState('');
  const [isOutgoing, setIsOutgoing] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [timestamp, setTimestamp] = useState('');
  const [reaction, setReaction] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageAlt, setImageAlt] = useState('');
  const [imageDecorative, setImageDecorative] = useState(false);
  const [status, setStatus] = useState<'auto' | 'sent' | 'delivered' | 'read'>('auto');
  const [participantId, setParticipantId] = useState('');
  // '' means "post as the account itself", i.e. follow the Twitter settings.
  const [twitterCharId, setTwitterCharId] = useState('');

  // Google-specific
  const [googleUrl, setGoogleUrl] = useState('');
  const [googleDesc, setGoogleDesc] = useState('');

  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
    }
  }, [content]);

  const isGroupMode = template === 'ios'
    ? settings.iosGroupMode
    : template === 'android'
    ? settings.androidGroupMode
    : false;

  const archivedIds = new Set((cast?.characters || []).filter(character => character.archived).map(character => character.id));
  const groupParticipants: GroupParticipant[] = (
    template === 'ios'
      ? settings.iosGroupParticipants || []
      : template === 'android'
      ? settings.androidGroupParticipants || []
      : []).filter(participant => !participant.characterId || !archivedIds.has(participant.characterId));

  useEffect(() => {
    if (twitterCharId && !(twitterCharacters || []).some(character => character.id === twitterCharId)) {
      setTwitterCharId('');
    }
  }, [twitterCharId, twitterCharacters]);

  // The two names the direction chip shows. iOS/Android only — the chip does
  // not render for Twitter or Google. This is the one place in the workspace
  // where the author sees who they are currently writing as, so a literal
  // "You"/"Them" here was the visible half of "your own name lives nowhere".
  const youLabel = settings.chatYourName?.trim() || 'You';
  const themLabel =
    (template === 'ios'
      ? settings.iosContactName || settings.chatContactName
      : settings.androidContactName || settings.chatContactName) || 'Them';
  const automaticTimestamp = nextChatTimestampFromHistory(messages);

  const handleSend = () => {
    const trimmedContent = content.trim();
    const normalizedImage = normalizeImageUrl(imageUrl.trim());

    if (template === 'google') {
      if (!trimmedContent) return;
      const msg: Message = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sender: '',
        content: trimmedContent,
        outgoing: false,
        googleResultUrl: googleUrl.trim(),
        googleResultDescription: googleDesc.trim(),
      };
      onAddMessage(msg);
      setContent('');
      setGoogleUrl('');
      setGoogleDesc('');
    } else if (template === 'twitter') {
      if (!trimmedContent) return;
      const chars = twitterCharacters || [];
      const activeChar = twitterCharId ? chars.find(c => c.id === twitterCharId) : undefined;
      // Only a character preset pins an identity to the tweet. Without one the
      // tweet is left unstamped so it follows the account settings, and
      // renaming yourself later updates tweets you have already written.
      const msg: Message = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sender: '',
        content: trimmedContent,
        outgoing: true,
        timestamp: timestamp || undefined,
        ...(activeChar && {
          characterId: activeChar.id,
          sender: activeChar.name,
          useCustomIdentity: true,
          twitterHandle: activeChar.handle,
          verified: activeChar.verified,
          avatarUrl: activeChar.avatarUrl,
        }),
      };
      if (normalizedImage) {
        msg.attachments = [{ type: 'image', url: normalizedImage, alt: imageDecorative ? '' : imageAlt.trim(), decorative: imageDecorative }];
      }
      onAddMessage(msg);
    } else {
      // iOS / Android
      if (!trimmedContent && !normalizedImage) return;
      const autoAlternate = template === 'ios'
        ? settings.iosAutoAlternate !== false
        : settings.androidAutoAlternate !== false;

      let senderName = isOutgoing ? youLabel : themLabel;

      if (isGroupMode && participantId && !isOutgoing) {
        const participant = groupParticipants.find(p => p.id === participantId);
        if (participant) senderName = participant.name;
      }

      const msg: Message = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sender: senderName,
        content: trimmedContent,
        outgoing: isOutgoing,
        timestamp: timestamp.trim() || nextChatTimestamp(messages),
        reaction: reaction || undefined,
        status: isOutgoing ? (status === 'auto' ? 'delivered' : status) : undefined,
        statusMode: isOutgoing ? (status === 'auto' ? 'auto' : 'manual') : undefined,
        participantId: isGroupMode && !isOutgoing ? participantId || undefined : undefined,
        characterId: isOutgoing
          ? cast?.selfId
          : isGroupMode
            ? groupParticipants.find(participant => participant.id === participantId)?.characterId
            : cast?.contactId,
      };

      if (normalizedImage) {
        msg.attachments = [{ type: 'image', url: normalizedImage, alt: imageDecorative ? '' : imageAlt.trim(), decorative: imageDecorative }];
      }

      onAddMessage(msg);

      // Auto-alternate for next message
      if (autoAlternate) {
        setIsOutgoing(!isOutgoing);
      }
    }

    setContent('');
    setTimestamp('');
    setStatus('auto');
    setReaction('');
    setImageUrl('');
    setImageAlt('');
    setImageDecorative(false);
    setShowDetails(false);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  const insertEmoji = (emoji: string) => {
    const input = inputRef.current;
    const start = input?.selectionStart ?? content.length;
    const end = input?.selectionEnd ?? start;
    setContent(previous => `${previous.slice(0, start)}${emoji}${previous.slice(end)}`);

    // Clicking a picker chip moves focus away from the textarea. Put it back
    // after React applies the controlled value so repeated emoji and continued
    // typing land exactly where the author expects.
    requestAnimationFrame(() => {
      const nextInput = inputRef.current;
      if (!nextInput) return;
      const caret = start + emoji.length;
      nextInput.focus();
      nextInput.setSelectionRange(caret, caret);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && showEmojiPicker) {
      e.preventDefault();
      setShowEmojiPicker(false);
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Mirror exactly what handleSend() will accept, so the button is never
  // enabled for a click that silently does nothing. iOS/Android allow an
  // image with no text; the other two require text.
  const canSend =
    template === 'ios' || template === 'android'
      ? Boolean(content.trim() || imageUrl.trim())
      : Boolean(content.trim());

  const placeholders: Record<string, string> = {
    ios: 'Add a message…',
    android: 'Add a message…',
    twitter: 'What\'s happening?',
    google: 'Title of the search result…',
  };

  // Google isn't a conversation — you are adding a result to a page, not
  // sending a message to anyone. A send arrow labelled "Send message" was
  // describing the wrong mental model.
  const isResultList = template === 'google';
  const sendLabel = isResultList ? 'Add result' : 'Send message';
  const detailsLabel = isResultList
    ? 'Add result details'
    : 'Message options';

  return (
    <div className="border-t border-stone-200 bg-white">
      {/* Detail Tray */}
      {showDetails && (
        // Capped and scrollable: warnings and previews can appear here, and
        // without a ceiling they push the send button behind the fixed export
        // bar on a phone.
        <div className="px-4 py-3 border-b border-stone-100 bg-stone-50/50 animate-fade-in space-y-3 max-h-[32vh] overflow-y-auto">
          {(template === 'ios' || template === 'android') && (
            <>
              {/* One row, not three. The tray sits above a fixed export bar
                  on a phone, and every extra row pushes the send button
                  underneath it. */}
              <div className="flex gap-2">
                <input
                  value={timestamp}
                  onChange={(e) => setTimestamp(e.target.value)}
                  placeholder={automaticTimestamp ? `Automatic: ${automaticTimestamp}` : 'Automatic: current time'}
                  aria-label="Timestamp"
                  className="flex-1 min-w-0 text-xs bg-white border border-stone-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
                {isOutgoing && (
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as 'auto' | 'sent' | 'delivered' | 'read')}
                    aria-label="Delivery status"
                    className="flex-shrink-0 text-xs bg-white border border-stone-200 rounded-lg px-2 py-2 focus:ring-2 focus:ring-violet-500"
                  >
                    <option value="auto">Automatic</option>
                    <option value="sent">Sent</option>
                    <option value="delivered">Delivered</option>
                    <option value="read">Read</option>
                  </select>
                )}
              </div>
              {/* iOS SMS mode still gets the picker. Classic SMS had no
                  tapbacks, but RCS does, the CSS renders identically, and a fic
                  author choosing green bubbles has not asked us to police their
                  reactions. Decided, not overlooked. */}
              <ReactionPicker template={template} value={reaction} onChange={setReaction} />
              <ImageUrlInput
                value={imageUrl}
                onChange={setImageUrl}
                ariaLabel="Image address for this message"
                placeholder="Paste an image address (optional)"
              />
              {imageUrl.trim() && (
                <div className="space-y-1.5">
                  <input
                    value={imageAlt}
                    onChange={event => setImageAlt(event.target.value)}
                    disabled={imageDecorative}
                    maxLength={500}
                    aria-label="Image description"
                    placeholder="Describe the image for readers"
                    className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs disabled:bg-stone-100 disabled:text-stone-400"
                  />
                  <label className="flex items-center gap-2 text-xs text-stone-600">
                    <input type="checkbox" checked={imageDecorative} onChange={event => setImageDecorative(event.target.checked)} className="accent-violet-600" />
                    Decorative image — use empty alt text
                  </label>
                </div>
              )}
            </>
          )}

          {template === 'twitter' && (
            <div className="space-y-2">
              <input
                value={timestamp}
                onChange={(e) => setTimestamp(e.target.value)}
                placeholder="Timestamp, e.g. 2:14 PM"
                aria-label="Timestamp"
                className="w-full text-xs bg-white border border-stone-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-violet-500"
              />
              <ImageUrlInput
                value={imageUrl}
                onChange={setImageUrl}
                ariaLabel="Image address for this post"
                placeholder="Paste an image address (optional)"
              />
              {imageUrl.trim() && (
                <div className="space-y-1.5">
                  <input
                    value={imageAlt}
                    onChange={event => setImageAlt(event.target.value)}
                    disabled={imageDecorative}
                    maxLength={500}
                    aria-label="Image description"
                    placeholder="Describe the image for readers"
                    className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs disabled:bg-stone-100 disabled:text-stone-400"
                  />
                  <label className="flex items-center gap-2 text-xs text-stone-600">
                    <input type="checkbox" checked={imageDecorative} onChange={event => setImageDecorative(event.target.checked)} className="accent-violet-600" />
                    Decorative image — use empty alt text
                  </label>
                </div>
              )}
            </div>
          )}

          {template === 'google' && (
            <>
              <input
                value={googleUrl}
                onChange={(e) => setGoogleUrl(e.target.value)}
                placeholder="URL (e.g., https://en.wikipedia.org/...)"
                className="w-full text-xs bg-white border border-stone-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-violet-500"
              />
              <textarea
                value={googleDesc}
                onChange={(e) => setGoogleDesc(e.target.value)}
                placeholder="Description snippet…"
                rows={2}
                className="w-full text-xs bg-white border border-stone-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-violet-500 resize-none"
              />
            </>
          )}
        </div>
      )}

      {template !== 'google' && showEmojiPicker && (
        <div className="border-b border-stone-100 bg-stone-50/70 px-3 py-2">
          <MessageEmojiPicker id="compose-message-emoji-options" onInsert={insertEmoji} />
        </div>
      )}

      {/* Main compose row */}
      <div className="px-3 py-2 flex items-end gap-2">
        {template !== 'google' && (
          <button
            type="button"
            onClick={onAddIdentity}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-500 transition-colors hover:bg-violet-100 hover:text-violet-700"
            title={template === 'twitter' ? 'Add account' : 'Add person'}
            aria-label={template === 'twitter' ? 'Add account' : 'Add person'}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><path d="M19 8v6M16 11h6" />
            </svg>
          </button>
        )}

        {/* Sender toggle (iOS/Android only) */}
        {(template === 'ios' || template === 'android') && (
          <button
            type="button"
            onClick={() => setIsOutgoing(!isOutgoing)}
            className={`flex-shrink-0 text-[10px] font-semibold px-2.5 py-1.5 rounded-full transition-colors ${
              isOutgoing
                ? 'bg-violet-100 text-violet-700'
                : 'bg-stone-100 text-stone-600'
            }`}
            title={`Sending as: ${isOutgoing ? youLabel : themLabel}`}
            aria-label={`Sending as ${isOutgoing ? youLabel : themLabel} — tap to switch`}
          >
            {/* Capped: a long name must not push the send button off a 360px
                screen. friction.spec.ts finds that button with
                `button:right-of(textarea)`, which is unaffected either way. */}
            <span className="block max-w-[80px] truncate">
              {isOutgoing ? youLabel : themLabel}
            </span>
          </button>
        )}

        {(template === 'ios' || template === 'android') && (
          <button
            type="button"
            onClick={() => onEditActiveIdentity?.({ kind: isOutgoing ? 'self' : 'contact' })}
            aria-label={`Edit ${isOutgoing ? youLabel : themLabel}`}
            title={`Edit ${isOutgoing ? youLabel : themLabel}`}
            className="-ml-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs text-stone-400 hover:bg-violet-50 hover:text-violet-700"
          >
            ✎
          </button>
        )}

        {/* Who is posting (Twitter). The account itself is the default; the
            other entries come from saved characters and template presets. */}
        {template === 'twitter' && (
          <div className="flex min-w-0 max-w-[135px] flex-shrink-0 items-center rounded-full bg-stone-100">
            <select
              value={twitterCharId}
              onChange={(e) => setTwitterCharId(e.target.value)}
              aria-label="Posting as"
              title="Posting as"
              className="min-w-0 flex-1 bg-transparent py-1.5 pl-2.5 text-xs focus:ring-2 focus:ring-violet-500"
            >
              <option value="">{settings.twitterDisplayName || 'Me'}</option>
              {(twitterCharacters || []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button type="button" onClick={() => onEditActiveIdentity?.(twitterCharId ? { kind: 'character', id: twitterCharId } : { kind: 'twitter-primary' })} aria-label={`Edit ${(twitterCharacters || []).find(character => character.id === twitterCharId)?.name || settings.twitterDisplayName || 'primary account'}`} className="px-1.5 text-stone-400 hover:text-violet-700">✎</button>
          </div>
        )}

        {/* Group participant selector */}
        {isGroupMode && !isOutgoing && groupParticipants.length > 0 && (
          <select
            value={participantId}
            onChange={(e) => setParticipantId(e.target.value)}
            aria-label="Speaking as"
            title="Speaking as"
            className="flex-shrink-0 text-xs bg-stone-100 border-0 rounded-full px-2.5 py-1.5 focus:ring-2 focus:ring-violet-500 max-w-[100px]"
          >
            <option value="">Select person</option>
            {groupParticipants.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}

        {/* Detail toggle */}
        <button
          type="button"
          onClick={() => setShowDetails(!showDetails)}
          className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
            showDetails ? 'bg-violet-100 text-violet-600' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
          }`}
          title={detailsLabel}
          aria-label={detailsLabel}
          aria-expanded={showDetails}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {template === 'google' ? <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /> : <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>}
          </svg>
        </button>

        {/* Text input. The emoji trigger lives inside this footprint so adding
            it cannot squeeze the textarea off narrow phone layouts. */}
        <div className="relative min-w-0 flex-1">
          <textarea
            ref={inputRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholders[template]}
            rows={1}
            className={`block w-full max-h-[120px] resize-none rounded-2xl border-0 bg-stone-100 py-2 pl-4 text-sm transition-colors focus:bg-white focus:ring-2 focus:ring-violet-500 ${template === 'google' ? 'pr-4' : 'pr-10'}`}
          />
          {template !== 'google' && (
            <MessageEmojiTrigger
              expanded={showEmojiPicker}
              controlsId="compose-message-emoji-options"
              onToggle={() => setShowEmojiPicker(open => !open)}
            />
          )}
        </div>

        {/* Send button */}
        <button
          type="button"
          onClick={handleSend}
          aria-label={sendLabel}
          title={sendLabel}
          disabled={!canSend}
          className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
            canSend
              ? 'bg-violet-600 text-white hover:bg-violet-700'
              : 'bg-stone-200 text-stone-400'
          }`}
        >
          {isResultList ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
};

export default ComposeBar;
