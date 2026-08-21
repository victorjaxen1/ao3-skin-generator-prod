import React, { useEffect, useMemo, useState } from 'react';
import { IOSMedia, IOSTapback, Message, SkinProject } from '../lib/schema';
import {
  IOS_AUDIO_MIME_TYPES,
  IOS_VIDEO_MIME_TYPES,
  iosMessageLabel,
  normalizeIOSTapbacks,
  validateIOSMedia,
  validateIOSMessage,
} from '../lib/ios';
import { normalizeYouTubeUrl } from '../lib/twitter';
import { resolveMessageIdentity } from '../lib/identity';
import { ImageUrlInput } from './ImageUrlInput';
import MultiImageEditor from './MultiImageEditor';

/**
 * One editor for every iOS message, wherever it is being edited.
 *
 * The composer's transient draft and a committed timeline message go through
 * this same component (§0.2). Two editors for one model is how the old iOS path
 * ended up with the composer's `imageUrl`/`reaction` draft state and the
 * timeline's ReactionPicker able to erase each other's work.
 *
 * Validation is `validateIOSMessage` and nothing else — the same function
 * strict import, storage recovery, and preflight call, so the send button
 * cannot accept something the exporter will later refuse.
 */

interface Props {
  message: Message;
  project: SkinProject;
  onChange: (updates: Partial<Message>) => void;
  index?: number;
  idPrefix?: string;
}

type ContentMode = 'none' | 'images' | 'link' | 'audio' | 'video';

type IOSAudioMedia = Extract<IOSMedia, { kind: 'audio' }>;
type IOSDirectVideoMedia = Extract<IOSMedia, { kind: 'video'; source: 'direct' }>;

const TAPBACK_PRESETS = ['❤️', '👍', '👎', '😂', '‼️', '❓'];

function contentMode(message: Message): ContentMode {
  if (message.attachments?.length) return 'images';
  if (message.iosLinkPreview) return 'link';
  if (message.iosMedia?.kind === 'audio') return 'audio';
  if (message.iosMedia?.kind === 'video') return 'video';
  return 'none';
}

/**
 * A newly chosen video is YouTube with a blank poster.
 *
 * Not a placeholder string: the renderer treats an empty poster as "derive the
 * YouTube thumbnail", and prose in that field would suppress the thumbnail and
 * render a broken image instead (§4).
 */
function blankMedia(kind: 'audio' | 'video'): IOSMedia {
  return kind === 'audio'
    ? { kind: 'audio', url: '', mimeType: 'audio/mpeg' }
    : { kind: 'video', source: 'youtube', url: '', posterUrl: undefined };
}

const FieldLabel: React.FC<React.PropsWithChildren> = ({ children }) => (
  <span className="mb-1 block text-[11px] font-medium text-stone-600">{children}</span>
);

export const IOSMessageExtrasEditor: React.FC<Props> = ({
  message,
  project,
  onChange,
  index = project.messages.length,
  idPrefix = message.id,
}) => {
  const [mediaPreviewLoaded, setMediaPreviewLoaded] = useState(false);
  const [mediaPreviewError, setMediaPreviewError] = useState('');
  const mode = contentMode(message);
  const media = message.iosMedia;
  const mediaKey = JSON.stringify(media || null);
  const eventMode = message.iosEvent?.kind || 'message';
  const errors = useMemo(() => validateIOSMessage(project, message, index), [index, message, project]);
  const mediaIssues = validateIOSMedia(media);

  // Only earlier, non-event messages can be replied to, and the list is built
  // from the same rule the validator enforces so the picker cannot offer a
  // choice that then fails validation.
  const replyCandidates = project.messages.slice(0, index).filter(candidate => !candidate.iosEvent && candidate.id !== message.id);

  // Loading media is a per-source consent decision. Editing the URL, MIME type,
  // poster, or captions tears the player down rather than silently contacting
  // the newly entered host on the strength of the previous click.
  useEffect(() => {
    setMediaPreviewLoaded(false);
    setMediaPreviewError('');
  }, [mediaKey]);

  const switchEventMode = (next: 'message' | 'date' | 'system') => {
    if (next === eventMode) return;
    if (next === 'message') {
      onChange({ iosEvent: undefined });
      return;
    }
    const hasContent = !!(message.content.trim() || message.attachments?.length || message.iosLinkPreview
      || message.iosMedia || message.iosReply || message.iosTapbacks?.length);
    if (hasContent && typeof window !== 'undefined' && !window.confirm('Changing this to an event removes its message content. Continue?')) return;
    // An event is exclusive: it carries no sender, bubble, timestamp, status,
    // reply, Tapback, attachment, link, or media. Clearing them in the same
    // update is what stops a half-converted message reaching storage.
    onChange({
      iosEvent: { kind: next, text: '' }, content: '', attachments: undefined, imageLayout: undefined,
      iosLinkPreview: undefined, iosMedia: undefined, iosReply: undefined,
      iosTapbacks: undefined, reaction: undefined, status: undefined, statusMode: undefined,
      isTyping: undefined, timestamp: undefined,
    });
  };

  const switchContent = (next: ContentMode) => {
    if (next === mode) return;
    if (mode !== 'none' && typeof window !== 'undefined' && !window.confirm('Changing the content type removes the current content card. Continue?')) return;
    setMediaPreviewLoaded(false);
    setMediaPreviewError('');
    onChange({
      attachments: next === 'images' ? [{ type: 'image', url: '', alt: '' }] : undefined,
      imageLayout: undefined,
      iosLinkPreview: next === 'link' ? { url: '', title: '' } : undefined,
      iosMedia: next === 'audio' || next === 'video' ? blankMedia(next) : undefined,
    });
  };

  const updateTapback = (tapbackIndex: number, updates: Partial<IOSTapback>) => {
    onChange({ iosTapbacks: (message.iosTapbacks || []).map((tapback, i) => i === tapbackIndex ? { ...tapback, ...updates } : tapback) });
  };

  const replyLabel = (candidate: Message) => {
    const speaker = resolveMessageIdentity(project, candidate).name;
    return `${speaker}: ${iosMessageLabel(candidate)}${candidate.timestamp ? ` — ${candidate.timestamp}` : ''}`;
  };

  const eventSwitcher = (
    <div className="flex rounded-lg bg-stone-100 p-0.5">
      {(['message', 'date', 'system'] as const).map(value => (
        <button key={value} type="button" onClick={() => switchEventMode(value)} className={`flex-1 rounded-md px-2 py-1.5 text-xs ${eventMode === value ? 'bg-white font-medium text-violet-700 shadow-sm' : 'text-stone-600'}`}>
          {value === 'message' ? 'Message' : value === 'date' ? 'Date' : 'System'}
        </button>
      ))}
    </div>
  );

  if (eventMode !== 'message') {
    return (
      <div className="space-y-3 rounded-xl border border-stone-200 bg-white p-3">
        {eventSwitcher}
        <label className="block">
          <FieldLabel>{eventMode === 'date' ? 'Divider text' : 'Event text'}</FieldLabel>
          <input
            value={message.iosEvent?.text || ''}
            onChange={event => onChange({ iosEvent: { kind: eventMode, text: event.target.value } })}
            maxLength={300}
            placeholder={eventMode === 'date' ? 'Today' : 'Alex named the conversation Road Trip'}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
          />
        </label>
        {errors.map(error => <p key={error} role="alert" className="text-xs text-red-700">{error}</p>)}
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-stone-200 bg-white p-3">
      {eventSwitcher}

      <section className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-stone-400">Reply</h4>
        <select
          value={message.iosReply?.messageId || ''}
          onChange={event => onChange({ iosReply: event.target.value ? { messageId: event.target.value } : undefined })}
          aria-label="Reply to earlier message"
          className="w-full rounded-lg border border-stone-200 bg-white px-2 py-2 text-xs"
        >
          <option value="">No reply</option>
          {replyCandidates.map(candidate => (
            <option key={candidate.id} value={candidate.id}>{replyLabel(candidate)}</option>
          ))}
        </select>
      </section>

      <section className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-stone-400">Content</h4>
        <div className="grid grid-cols-5 gap-1 rounded-lg bg-stone-100 p-1">
          {(['none', 'images', 'link', 'audio', 'video'] as ContentMode[]).map(value => (
            <button key={value} type="button" onClick={() => switchContent(value)} className={`rounded-md px-1 py-1.5 text-[11px] capitalize ${mode === value ? 'bg-white font-medium text-violet-700 shadow-sm' : 'text-stone-600'}`}>{value}</button>
          ))}
        </div>

        {mode === 'images' && (
          <div className="space-y-3">
            <p className="text-[11px] leading-relaxed text-stone-500">
              One to four images. Every one stays a real image with its own description, so a reader with the skin off still gets all four — a tap-to-open stack would throw three of them away.
            </p>
            <MultiImageEditor
              attachments={message.attachments || []}
              imageLayout={message.imageLayout}
              onChange={({ attachments, imageLayout }) => onChange({
                attachments: attachments.length ? attachments : undefined,
                imageLayout,
              })}
              label="Image"
              idPrefix={`${idPrefix}-ios-media`}
            />
          </div>
        )}

        {mode === 'link' && message.iosLinkPreview && (
          <div className="space-y-2">
            <input value={message.iosLinkPreview.url} onChange={event => onChange({ iosLinkPreview: { ...message.iosLinkPreview!, url: event.target.value } })} placeholder="https://example.com/story" aria-label="Link address" className="w-full rounded-lg border border-stone-200 px-3 py-2 text-xs" />
            <input value={message.iosLinkPreview.title} onChange={event => onChange({ iosLinkPreview: { ...message.iosLinkPreview!, title: event.target.value } })} placeholder="Link title" aria-label="Link title" maxLength={200} className="w-full rounded-lg border border-stone-200 px-3 py-2 text-xs" />
            <div className="grid gap-2 sm:grid-cols-2">
              <input value={message.iosLinkPreview.siteName || ''} onChange={event => onChange({ iosLinkPreview: { ...message.iosLinkPreview!, siteName: event.target.value } })} placeholder="Site name" aria-label="Link site name" maxLength={100} className="rounded-lg border border-stone-200 px-3 py-2 text-xs" />
              <input value={message.iosLinkPreview.description || ''} onChange={event => onChange({ iosLinkPreview: { ...message.iosLinkPreview!, description: event.target.value } })} placeholder="Description" aria-label="Link description" maxLength={500} className="rounded-lg border border-stone-200 px-3 py-2 text-xs" />
            </div>
            <ImageUrlInput
              value={message.iosLinkPreview.image?.url || ''}
              onChange={url => onChange({ iosLinkPreview: { ...message.iosLinkPreview!, image: url ? { type: 'image', url, alt: message.iosLinkPreview?.image?.alt || '', decorative: message.iosLinkPreview?.image?.decorative } : undefined } })}
              ariaLabel="Link preview image address"
              placeholder="Preview image address (optional)"
            />
            {message.iosLinkPreview.image && (
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <input value={message.iosLinkPreview.image.alt || ''} disabled={message.iosLinkPreview.image.decorative} onChange={event => onChange({ iosLinkPreview: { ...message.iosLinkPreview!, image: { ...message.iosLinkPreview!.image!, alt: event.target.value } } })} placeholder="Describe the preview image" aria-label="Link preview image description" maxLength={500} className="w-full rounded-lg border border-stone-200 px-3 py-2 text-xs disabled:bg-stone-100" />
                <label className="flex items-center gap-2 text-xs text-stone-600">
                  <input type="checkbox" checked={message.iosLinkPreview.image.decorative === true} onChange={event => onChange({ iosLinkPreview: { ...message.iosLinkPreview!, image: { ...message.iosLinkPreview!.image!, decorative: event.target.checked, ...(event.target.checked ? { alt: '' } : {}) } } })} /> Decorative
                </label>
              </div>
            )}
            {/* No "fetch preview" button, deliberately: scraping the pasted URL
                would make a surprise request, fail on CORS more often than not,
                and tell a third-party site what the author is writing about. */}
            <p className="text-[11px] leading-relaxed text-stone-500">Link cards are written by you, not fetched. This app never contacts the address you paste.</p>
          </div>
        )}

        {(mode === 'audio' || mode === 'video') && media && (
          <div className="space-y-2">
            <div className="grid gap-2 sm:grid-cols-2">
              {media.kind === 'audio' ? (
                <select value={media.mimeType} onChange={event => onChange({ iosMedia: { ...media, mimeType: event.target.value as IOSAudioMedia['mimeType'] } })} aria-label="Media file type" className="rounded-lg border border-stone-200 px-2 py-2 text-xs">
                  {IOS_AUDIO_MIME_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                </select>
              ) : (
                <select
                  value={media.source}
                  onChange={event => {
                    const common = { title: media.title, duration: media.duration, description: media.description };
                    onChange({ iosMedia: event.target.value === 'youtube'
                      ? { kind: 'video', source: 'youtube', url: '', posterUrl: undefined, ...common }
                      : { kind: 'video', source: 'direct', url: '', mimeType: 'video/mp4', posterUrl: undefined, ...common } });
                  }}
                  aria-label="Video source"
                  className="rounded-lg border border-stone-200 px-2 py-2 text-xs"
                >
                  <option value="youtube">YouTube</option>
                  <option value="direct">Direct video file</option>
                </select>
              )}
              <input value={media.duration || ''} onChange={event => onChange({ iosMedia: { ...media, duration: event.target.value } as IOSMedia })} placeholder="Duration, e.g. 0:12" aria-label="Media duration" className="rounded-lg border border-stone-200 px-3 py-2 text-xs" />
            </div>
            <input
              value={media.url}
              onChange={event => onChange({ iosMedia: { ...media, url: event.target.value } as IOSMedia })}
              placeholder={media.kind === 'video' && media.source === 'youtube' ? 'YouTube watch, share, Shorts, live, or embed URL' : 'Direct HTTPS media file'}
              aria-label="Media address"
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-xs"
            />
            {media.kind === 'video' && media.source === 'direct' && (
              <select value={media.mimeType} onChange={event => onChange({ iosMedia: { ...media, mimeType: event.target.value as IOSDirectVideoMedia['mimeType'] } })} aria-label="Media file type" className="w-full rounded-lg border border-stone-200 px-2 py-2 text-xs">
                {IOS_VIDEO_MIME_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
              </select>
            )}
            {media.kind === 'audio' ? (
              <>
                <textarea value={media.transcript || ''} onChange={event => onChange({ iosMedia: { ...media, transcript: event.target.value } })} placeholder="Transcript (recommended)" aria-label="Voice message transcript" rows={2} className="w-full rounded-lg border border-stone-200 px-3 py-2 text-xs" />
                <p className="text-[11px] leading-relaxed text-stone-500">
                  For AO3 playback, use a direct HTTPS audio file whose host permits anonymous cross-origin requests. MP3 is the safest cross-browser choice; a webpage or share link is not an audio file. This app can check the address and load a preview — it cannot promise the host stays online.
                </p>
              </>
            ) : (
              <>
                <input value={media.title || ''} onChange={event => onChange({ iosMedia: { ...media, title: event.target.value } as IOSMedia })} placeholder="Title (optional)" aria-label="Video title" maxLength={200} className="w-full rounded-lg border border-stone-200 px-3 py-2 text-xs" />
                <ImageUrlInput
                  value={media.posterUrl || ''}
                  onChange={posterUrl => onChange({ iosMedia: { ...media, posterUrl: posterUrl.trim() ? posterUrl : undefined } as IOSMedia })}
                  ariaLabel="Video poster address"
                  placeholder={media.source === 'youtube' ? 'Poster image address (optional — YouTube supplies one)' : 'Poster image address (recommended)'}
                />
                <textarea value={media.description || ''} onChange={event => onChange({ iosMedia: { ...media, description: event.target.value } as IOSMedia })} placeholder="Video description" aria-label="Video description" rows={2} className="w-full rounded-lg border border-stone-200 px-3 py-2 text-xs" />
                {media.source === 'direct' && (
                  <>
                    <input value={media.captionTrackUrl || ''} onChange={event => onChange({ iosMedia: { ...media, captionTrackUrl: event.target.value } })} placeholder="Caption track HTTPS URL" aria-label="Caption track address" className="w-full rounded-lg border border-stone-200 px-3 py-2 text-xs" />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input value={media.captionLanguage || ''} onChange={event => onChange({ iosMedia: { ...media, captionLanguage: event.target.value } })} placeholder="Language, e.g. en" aria-label="Caption language" className="rounded-lg border border-stone-200 px-3 py-2 text-xs" />
                      <input value={media.captionLabel || ''} onChange={event => onChange({ iosMedia: { ...media, captionLabel: event.target.value } })} placeholder="Label, e.g. English" aria-label="Caption label" className="rounded-lg border border-stone-200 px-3 py-2 text-xs" />
                    </div>
                  </>
                )}
              </>
            )}
            {!mediaPreviewLoaded ? (
              <button type="button" disabled={mediaIssues.length > 0} onClick={() => { setMediaPreviewError(''); setMediaPreviewLoaded(true); }} className="rounded-lg border border-violet-300 px-3 py-2 text-xs font-medium text-violet-700 disabled:border-stone-200 disabled:text-stone-300">Load media preview</button>
            ) : media.kind === 'audio' ? (
              <audio key={mediaKey} controls crossOrigin="anonymous" preload="metadata" onError={() => setMediaPreviewError('The host blocked this preview or returned media that does not match the selected file type. Confirm HTTPS, anonymous CORS access, and the MIME type. The source-link fallback will still export.')} className="w-full">
                <source src={media.url} type={media.mimeType} />
                Your browser cannot play this audio.
              </audio>
            ) : media.source === 'youtube' ? (
              <iframe key={mediaKey} src={normalizeYouTubeUrl(media.url)?.embedUrl} title="iMessage YouTube video preview" width="560" height="315" allowFullScreen className="w-full rounded-lg border-0 bg-black" />
            ) : (
              <video key={mediaKey} controls preload="metadata" poster={media.posterUrl} onError={() => setMediaPreviewError('The host blocked this preview or returned media that does not match the selected file type. Confirm HTTPS, CORS access, and the MIME type. The source-link fallback will still export.')} className="w-full rounded-lg">
                <source src={media.url} type={media.mimeType} />
                {media.captionTrackUrl && <track kind="captions" src={media.captionTrackUrl} srcLang={media.captionLanguage} label={media.captionLabel} default />}
                Your browser cannot play this video.
              </video>
            )}
            {mediaPreviewError && <p role="alert" className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">{mediaPreviewError}</p>}
            <p className="text-[11px] leading-relaxed text-stone-500">
              The scene preview, PNG, and ImgBB export use a static thumbnail card. AO3 Work Text embeds YouTube with its privacy-enhanced player or streams a direct file from its current host. This app never downloads, uploads, or preserves the video file.
            </p>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-stone-400">Tapbacks</h4>
          {(message.iosTapbacks?.length || 0) < 3 && (
            <button type="button" onClick={() => onChange({ iosTapbacks: [...(message.iosTapbacks || []), { emoji: '❤️' }] })} className="text-xs font-medium text-violet-700">Add Tapback</button>
          )}
        </div>
        {(message.iosTapbacks || []).map((tapback, tapbackIndex) => (
          <div key={`${idPrefix}-tapback-${tapbackIndex}`} className="flex items-center gap-2">
            <input value={tapback.emoji} onChange={event => updateTapback(tapbackIndex, { emoji: event.target.value })} aria-label={`Tapback ${tapbackIndex + 1} emoji`} className="w-16 rounded-lg border border-stone-200 px-2 py-1.5 text-center text-sm" />
            <input type="number" min={1} max={9999} value={tapback.count || 1} onChange={event => updateTapback(tapbackIndex, { count: Math.max(1, Math.min(9999, Number(event.target.value) || 1)) })} aria-label={`Tapback ${tapbackIndex + 1} count`} className="w-20 rounded-lg border border-stone-200 px-2 py-1.5 text-xs" />
            <button type="button" onClick={() => onChange({ iosTapbacks: message.iosTapbacks?.filter((_, i) => i !== tapbackIndex) })} className="text-xs text-red-600">Remove</button>
          </div>
        ))}
        <div className="flex flex-wrap gap-1">
          {TAPBACK_PRESETS.map(emoji => (
            <button key={emoji} type="button" onClick={() => onChange({ iosTapbacks: normalizeIOSTapbacks([...(message.iosTapbacks || []), { emoji }]) })} className="rounded-full bg-stone-100 px-2 py-1 text-sm">{emoji}</button>
          ))}
        </div>
      </section>

      <label className="flex items-center gap-2 text-xs text-stone-600">
        <input type="checkbox" checked={message.iosStartNewRun === true} onChange={event => onChange({ iosStartNewRun: event.target.checked || undefined })} /> Start a new bubble run
      </label>
      {errors.map(error => <p key={error} role="alert" className="text-xs text-red-700">{error}</p>)}
    </div>
  );
};

export default IOSMessageExtrasEditor;
