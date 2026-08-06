import React, { useState, useRef, useEffect } from 'react';
import { Message, SkinSettings, GroupParticipant, TwitterCharacter } from '../lib/schema';
import { normalizeImageUrl } from '../lib/urlNormalize';
import { ImageUrlInput } from './ImageUrlInput';

interface Props {
  template: 'ios' | 'android' | 'twitter' | 'google';
  settings: SkinSettings;
  onAddMessage: (message: Message) => void;
  twitterCharacters?: TwitterCharacter[];
}

export const ComposeBar: React.FC<Props> = ({
  template,
  settings,
  onAddMessage,
  twitterCharacters,
}) => {
  const [content, setContent] = useState('');
  const [isOutgoing, setIsOutgoing] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [timestamp, setTimestamp] = useState('');
  const [reaction, setReaction] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [status, setStatus] = useState<'sent' | 'delivered' | 'read'>('sent');
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

  const groupParticipants: GroupParticipant[] =
    template === 'ios'
      ? settings.iosGroupParticipants || []
      : template === 'android'
      ? settings.androidGroupParticipants || []
      : [];

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
          sender: activeChar.name,
          useCustomIdentity: true,
          twitterHandle: activeChar.handle,
          verified: activeChar.verified,
          avatarUrl: activeChar.avatarUrl,
        }),
      };
      if (normalizedImage) {
        msg.attachments = [{ type: 'image', url: normalizedImage }];
      }
      onAddMessage(msg);
    } else {
      // iOS / Android
      if (!trimmedContent && !normalizedImage) return;
      const autoAlternate = template === 'ios'
        ? settings.iosAutoAlternate !== false
        : settings.androidAutoAlternate !== false;

      let senderName = isOutgoing ? 'You' : (
        template === 'ios'
          ? settings.iosContactName || settings.chatContactName || 'Them'
          : settings.androidContactName || settings.chatContactName || 'Them'
      );

      if (isGroupMode && participantId && !isOutgoing) {
        const participant = groupParticipants.find(p => p.id === participantId);
        if (participant) senderName = participant.name;
      }

      const msg: Message = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sender: senderName,
        content: trimmedContent,
        outgoing: isOutgoing,
        timestamp: timestamp || undefined,
        reaction: reaction || undefined,
        status: status,
        participantId: isGroupMode && !isOutgoing ? participantId || undefined : undefined,
      };

      if (normalizedImage) {
        msg.attachments = [{ type: 'image', url: normalizedImage }];
      }

      onAddMessage(msg);

      // Auto-alternate for next message
      if (autoAlternate) {
        setIsOutgoing(!isOutgoing);
      }
    }

    setContent('');
    setTimestamp('');
    setReaction('');
    setImageUrl('');
    setShowDetails(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
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
    ? 'Add link and description'
    : 'Add details (timestamp, image, etc.)';

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
                  placeholder="Time, e.g. 10:15"
                  aria-label="Timestamp"
                  className="flex-1 min-w-0 text-xs bg-white border border-stone-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
                <input
                  value={reaction}
                  onChange={(e) => setReaction(e.target.value)}
                  placeholder="❤️"
                  aria-label="Reaction emoji"
                  className="w-14 flex-shrink-0 text-xs bg-white border border-stone-200 rounded-lg px-2 py-2 text-center focus:ring-2 focus:ring-violet-500"
                />
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'sent' | 'delivered' | 'read')}
                  aria-label="Delivery status"
                  className="flex-shrink-0 text-xs bg-white border border-stone-200 rounded-lg px-2 py-2 focus:ring-2 focus:ring-violet-500"
                >
                  <option value="sent">Sent</option>
                  <option value="delivered">Delivered</option>
                  <option value="read">Read</option>
                </select>
              </div>
              <ImageUrlInput
                value={imageUrl}
                onChange={setImageUrl}
                ariaLabel="Image address for this message"
                placeholder="Paste an image address (optional)"
              />
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

      {/* Main compose row */}
      <div className="px-3 py-2 flex items-end gap-2">
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
            title={isOutgoing ? 'Sending as: You' : 'Sending as: Them'}
            aria-label={`Sending as ${isOutgoing ? 'You' : 'Them'} — tap to switch`}
          >
            {isOutgoing ? 'You' : 'Them'}
          </button>
        )}

        {/* Who is posting (Twitter). The account itself is the default; the
            other entries come from saved characters and template presets. */}
        {template === 'twitter' && twitterCharacters && twitterCharacters.length > 0 && (
          <select
            value={twitterCharId}
            onChange={(e) => setTwitterCharId(e.target.value)}
            aria-label="Posting as"
            title="Posting as"
            className="flex-shrink-0 text-xs bg-stone-100 border-0 rounded-full px-2.5 py-1.5 focus:ring-2 focus:ring-violet-500 max-w-[120px]"
          >
            <option value="">{settings.twitterDisplayName || 'Me'}</option>
            {twitterCharacters.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}

        {/* Group participant selector */}
        {isGroupMode && !isOutgoing && groupParticipants.length > 0 && (
          <select
            value={participantId}
            onChange={(e) => setParticipantId(e.target.value)}
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
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>

        {/* Text input */}
        <textarea
          ref={inputRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholders[template]}
          rows={1}
          className="flex-1 text-sm bg-stone-100 rounded-2xl px-4 py-2 border-0 resize-none focus:ring-2 focus:ring-violet-500 focus:bg-white transition-colors max-h-[120px]"
        />

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
