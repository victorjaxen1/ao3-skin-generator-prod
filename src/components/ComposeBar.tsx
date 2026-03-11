import React, { useState, useRef, useEffect } from 'react';
import { Message, SkinSettings, GroupParticipant, TwitterCharacter } from '../lib/schema';
import { normalizeImageUrl } from '../lib/urlNormalize';

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
  const [twitterCharIndex, setTwitterCharIndex] = useState(0);

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
      const activeChar = chars[twitterCharIndex] || chars[0];
      const msg: Message = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sender: activeChar?.name || settings.twitterDisplayName || 'User',
        content: trimmedContent,
        outgoing: true,
        timestamp: timestamp || undefined,
        twitterHandle: activeChar?.handle || settings.twitterHandle,
        verified: activeChar?.verified ?? settings.twitterVerified,
        avatarUrl: activeChar?.avatarUrl || settings.twitterAvatarUrl,
        twitterLikes: 0,
        twitterRetweets: 0,
        twitterReplies: 0,
        twitterViews: 0,
        twitterBookmarks: 0,
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

  const placeholders: Record<string, string> = {
    ios: 'Add a message…',
    android: 'Add a message…',
    twitter: 'What\'s happening?',
    google: 'Search result title…',
  };

  return (
    <div className="border-t border-stone-200 bg-white">
      {/* Detail Tray */}
      {showDetails && (
        <div className="px-4 py-3 border-b border-stone-100 bg-stone-50/50 animate-fade-in space-y-3">
          {(template === 'ios' || template === 'android') && (
            <>
              <div className="flex gap-2">
                <input
                  value={timestamp}
                  onChange={(e) => setTimestamp(e.target.value)}
                  placeholder="Timestamp (e.g., 10:15)"
                  className="flex-1 text-xs bg-white border border-stone-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'sent' | 'delivered' | 'read')}
                  className="text-xs bg-white border border-stone-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-violet-500"
                >
                  <option value="sent">Sent</option>
                  <option value="delivered">Delivered</option>
                  <option value="read">Read</option>
                </select>
              </div>
              <div className="flex gap-2">
                <input
                  value={reaction}
                  onChange={(e) => setReaction(e.target.value)}
                  placeholder="Reaction emoji"
                  className="w-24 text-xs bg-white border border-stone-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-violet-500"
                />
                <input
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="Image URL"
                  className="flex-1 text-xs bg-white border border-stone-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-violet-500"
                />
              </div>
            </>
          )}

          {template === 'twitter' && (
            <div className="flex gap-2">
              <input
                value={timestamp}
                onChange={(e) => setTimestamp(e.target.value)}
                placeholder="Timestamp"
                className="flex-1 text-xs bg-white border border-stone-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-violet-500"
              />
              <input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="Image URL"
                className="flex-1 text-xs bg-white border border-stone-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-violet-500"
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
          >
            {isOutgoing ? 'You' : 'Them'}
          </button>
        )}

        {/* Character selector (Twitter) */}
        {template === 'twitter' && twitterCharacters && twitterCharacters.length > 1 && (
          <select
            value={twitterCharIndex}
            onChange={(e) => setTwitterCharIndex(Number(e.target.value))}
            className="flex-shrink-0 text-xs bg-stone-100 border-0 rounded-full px-2.5 py-1.5 focus:ring-2 focus:ring-violet-500 max-w-[100px]"
          >
            {twitterCharacters.map((c, i) => (
              <option key={c.id} value={i}>{c.name}</option>
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
          title="Add details (timestamp, image, etc.)"
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
          disabled={!content.trim() && template !== 'google'}
          className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
            content.trim()
              ? 'bg-violet-600 text-white hover:bg-violet-700'
              : 'bg-stone-200 text-stone-400'
          }`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default ComposeBar;
