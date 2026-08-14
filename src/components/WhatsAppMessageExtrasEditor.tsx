import React, { useEffect, useMemo, useState } from 'react';
import { Attachment, Message, SkinProject, WhatsAppMedia, WhatsAppReaction } from '../lib/schema';
import {
  normalizeWhatsAppReactions,
  validateWhatsAppMedia,
  validateWhatsAppMessage,
  whatsappMessageLabel,
} from '../lib/whatsapp';
import { normalizeYouTubeUrl } from '../lib/twitter';
import { ImageUrlInput } from './ImageUrlInput';

interface Props {
  message: Message;
  project: SkinProject;
  onChange: (updates: Partial<Message>) => void;
  index?: number;
  idPrefix?: string;
}

type ContentMode = 'none' | 'images' | 'link' | 'audio' | 'video';

type WhatsAppAudioMedia = Extract<WhatsAppMedia, { kind: 'audio' }>;
type WhatsAppDirectVideoMedia = Extract<WhatsAppMedia, { kind: 'video'; source: 'direct' }>;

const AUDIO_TYPES: WhatsAppAudioMedia['mimeType'][] = ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/mp4'];
const VIDEO_TYPES: WhatsAppDirectVideoMedia['mimeType'][] = ['video/mp4', 'video/webm', 'video/ogg'];
const REACTION_PRESETS = ['❤️', '👍', '😂', '😮', '😢', '🙏'];

function contentMode(message: Message): ContentMode {
  if (message.attachments?.length) return 'images';
  if (message.whatsappLinkPreview) return 'link';
  if (message.whatsappMedia?.kind === 'audio') return 'audio';
  if (message.whatsappMedia?.kind === 'video') return 'video';
  return 'none';
}

function blankMedia(kind: 'audio' | 'video'): WhatsAppMedia {
  return kind === 'audio'
    ? { kind: 'audio', url: '', mimeType: 'audio/mpeg' }
    : { kind: 'video', source: 'youtube', url: '' };
}

const FieldLabel: React.FC<React.PropsWithChildren> = ({ children }) => (
  <span className="mb-1 block text-[11px] font-medium text-stone-600">{children}</span>
);

export const WhatsAppMessageExtrasEditor: React.FC<Props> = ({
  message,
  project,
  onChange,
  index = project.messages.length,
  idPrefix = message.id,
}) => {
  const [mediaPreviewLoaded, setMediaPreviewLoaded] = useState(false);
  const [mediaPreviewError, setMediaPreviewError] = useState('');
  const mode = contentMode(message);
  const media = message.whatsappMedia;
  const mediaKey = JSON.stringify(media || null);
  const eventMode = message.whatsappEvent?.kind || 'message';
  const replyCandidates = project.messages.slice(0, index).filter(candidate => !candidate.whatsappEvent && candidate.id !== message.id);
  const errors = useMemo(() => validateWhatsAppMessage(project, message, index), [index, message, project]);
  const mediaIssues = validateWhatsAppMedia(media);

  // Loading media is a per-source consent decision. Editing the URL, MIME type,
  // poster, or captions must tear down the old player instead of silently
  // contacting the newly entered host with the previous consent.
  useEffect(() => {
    setMediaPreviewLoaded(false);
    setMediaPreviewError('');
  }, [mediaKey]);

  const switchEventMode = (next: 'message' | 'date' | 'system') => {
    if (next === eventMode) return;
    if (next === 'message') {
      onChange({ whatsappEvent: undefined });
      return;
    }
    const hasContent = !!(message.content.trim() || message.attachments?.length || message.whatsappLinkPreview || message.whatsappMedia || message.whatsappReply || message.whatsappReactions?.length);
    if (hasContent && typeof window !== 'undefined' && !window.confirm('Changing this to an event removes its message content. Continue?')) return;
    onChange({
      whatsappEvent: { kind: next, text: '' }, content: '', attachments: undefined,
      whatsappLinkPreview: undefined, whatsappMedia: undefined, whatsappReply: undefined,
      whatsappReactions: undefined, reaction: undefined, status: undefined, statusMode: undefined,
    });
  };

  const switchContent = (next: ContentMode) => {
    if (next === mode) return;
    if (mode !== 'none' && typeof window !== 'undefined' && !window.confirm('Changing the content type removes the current content card. Continue?')) return;
    setMediaPreviewLoaded(false);
    setMediaPreviewError('');
    onChange({
      attachments: next === 'images' ? [{ type: 'image', url: '', alt: '' }] : undefined,
      whatsappLinkPreview: next === 'link' ? { url: '', title: '' } : undefined,
      whatsappMedia: next === 'audio' || next === 'video' ? blankMedia(next) : undefined,
    });
  };

  const updateAttachment = (attachmentIndex: number, updates: Partial<Attachment>) => {
    onChange({ attachments: (message.attachments || []).map((attachment, i) => i === attachmentIndex ? { ...attachment, ...updates } : attachment) });
  };

  const updateReaction = (reactionIndex: number, updates: Partial<WhatsAppReaction>) => {
    const next = (message.whatsappReactions || []).map((reaction, i) => i === reactionIndex ? { ...reaction, ...updates } : reaction);
    onChange({ whatsappReactions: next });
  };

  if (eventMode !== 'message') {
    return (
      <div className="space-y-3 rounded-xl border border-stone-200 bg-white p-3">
        <div className="flex rounded-lg bg-stone-100 p-0.5">
          {(['message', 'date', 'system'] as const).map(value => (
            <button key={value} type="button" onClick={() => switchEventMode(value)} className={`flex-1 rounded-md px-2 py-1.5 text-xs ${eventMode === value ? 'bg-white font-medium text-violet-700 shadow-sm' : 'text-stone-600'}`}>
              {value === 'message' ? 'Message' : value === 'date' ? 'Date divider' : 'System event'}
            </button>
          ))}
        </div>
        <label className="block">
          <FieldLabel>{eventMode === 'date' ? 'Divider text' : 'Event text'}</FieldLabel>
          <input value={message.whatsappEvent?.text || ''} onChange={event => onChange({ whatsappEvent: { kind: eventMode, text: event.target.value } })} maxLength={300} placeholder={eventMode === 'date' ? 'Today' : 'Alex added Sam'} className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" />
        </label>
        {errors.map(error => <p key={error} role="alert" className="text-xs text-red-700">{error}</p>)}
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-stone-200 bg-white p-3">
      <div className="flex rounded-lg bg-stone-100 p-0.5">
        {(['message', 'date', 'system'] as const).map(value => (
          <button key={value} type="button" onClick={() => switchEventMode(value)} className={`flex-1 rounded-md px-2 py-1.5 text-xs ${eventMode === value ? 'bg-white font-medium text-violet-700 shadow-sm' : 'text-stone-600'}`}>
            {value === 'message' ? 'Message' : value === 'date' ? 'Date' : 'System'}
          </button>
        ))}
      </div>

      <section className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-stone-400">Reply</h4>
        <select value={message.whatsappReply?.messageId || ''} onChange={event => onChange({ whatsappReply: event.target.value ? { messageId: event.target.value } : undefined })} aria-label="Reply to earlier message" className="w-full rounded-lg border border-stone-200 bg-white px-2 py-2 text-xs">
          <option value="">No reply</option>
          {replyCandidates.map(candidate => (
            <option key={candidate.id} value={candidate.id}>{whatsappMessageLabel(candidate)}{candidate.timestamp ? ` — ${candidate.timestamp}` : ''}</option>
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
            {(message.attachments || []).map((attachment, attachmentIndex) => (
              <div key={`${idPrefix}-image-${attachmentIndex}`} className="space-y-2 rounded-lg border border-stone-200 p-2">
                <div className="flex items-center justify-between"><span className="text-xs font-medium">Image {attachmentIndex + 1}</span><button type="button" onClick={() => onChange({ attachments: message.attachments?.filter((_, i) => i !== attachmentIndex) })} className="text-xs text-red-600">Remove</button></div>
                <ImageUrlInput value={attachment.url} onChange={url => updateAttachment(attachmentIndex, { url })} ariaLabel={`Image ${attachmentIndex + 1} address`} placeholder="Paste an image address" />
                <input value={attachment.alt || ''} onChange={event => updateAttachment(attachmentIndex, { alt: event.target.value })} disabled={attachment.decorative} maxLength={500} aria-label={`Image ${attachmentIndex + 1} description`} placeholder="Describe the image" className="w-full rounded-lg border border-stone-200 px-2 py-1.5 text-xs disabled:bg-stone-100" />
                <label className="flex items-center gap-2 text-xs text-stone-600"><input type="checkbox" checked={attachment.decorative === true} onChange={event => updateAttachment(attachmentIndex, { decorative: event.target.checked, ...(event.target.checked ? { alt: '' } : {}) })} /> Decorative</label>
                <div className="flex gap-2">
                  <button type="button" disabled={attachmentIndex === 0} onClick={() => { const next = [...(message.attachments || [])]; [next[attachmentIndex - 1], next[attachmentIndex]] = [next[attachmentIndex], next[attachmentIndex - 1]]; onChange({ attachments: next }); }} className="text-xs text-violet-700 disabled:text-stone-300">Move up</button>
                  <button type="button" disabled={attachmentIndex === (message.attachments?.length || 0) - 1} onClick={() => { const next = [...(message.attachments || [])]; [next[attachmentIndex + 1], next[attachmentIndex]] = [next[attachmentIndex], next[attachmentIndex + 1]]; onChange({ attachments: next }); }} className="text-xs text-violet-700 disabled:text-stone-300">Move down</button>
                </div>
              </div>
            ))}
            {(message.attachments?.length || 0) < 4 && <button type="button" onClick={() => onChange({ attachments: [...(message.attachments || []), { type: 'image', url: '', alt: '' }] })} className="w-full rounded-lg border border-dashed border-violet-300 px-3 py-2 text-xs font-medium text-violet-700">Add image</button>}
          </div>
        )}

        {mode === 'link' && message.whatsappLinkPreview && (
          <div className="space-y-2">
            <input value={message.whatsappLinkPreview.url} onChange={event => onChange({ whatsappLinkPreview: { ...message.whatsappLinkPreview!, url: event.target.value } })} placeholder="https://example.com/story" aria-label="Link address" className="w-full rounded-lg border border-stone-200 px-3 py-2 text-xs" />
            <input value={message.whatsappLinkPreview.title} onChange={event => onChange({ whatsappLinkPreview: { ...message.whatsappLinkPreview!, title: event.target.value } })} placeholder="Link title" aria-label="Link title" maxLength={200} className="w-full rounded-lg border border-stone-200 px-3 py-2 text-xs" />
            <div className="grid grid-cols-2 gap-2">
              <input value={message.whatsappLinkPreview.siteName || ''} onChange={event => onChange({ whatsappLinkPreview: { ...message.whatsappLinkPreview!, siteName: event.target.value } })} placeholder="Site name" aria-label="Link site name" maxLength={100} className="rounded-lg border border-stone-200 px-3 py-2 text-xs" />
              <input value={message.whatsappLinkPreview.description || ''} onChange={event => onChange({ whatsappLinkPreview: { ...message.whatsappLinkPreview!, description: event.target.value } })} placeholder="Description" aria-label="Link description" maxLength={500} className="rounded-lg border border-stone-200 px-3 py-2 text-xs" />
            </div>
            <ImageUrlInput value={message.whatsappLinkPreview.image?.url || ''} onChange={url => onChange({ whatsappLinkPreview: { ...message.whatsappLinkPreview!, image: url ? { type: 'image', url, alt: message.whatsappLinkPreview?.image?.alt || '', decorative: message.whatsappLinkPreview?.image?.decorative } : undefined } })} ariaLabel="Link preview image address" placeholder="Preview image address (optional)" />
            {message.whatsappLinkPreview.image && <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <input value={message.whatsappLinkPreview.image.alt || ''} disabled={message.whatsappLinkPreview.image.decorative} onChange={event => onChange({ whatsappLinkPreview: { ...message.whatsappLinkPreview!, image: { ...message.whatsappLinkPreview!.image!, alt: event.target.value } } })} placeholder="Describe the preview image" aria-label="Link preview image description" maxLength={500} className="w-full rounded-lg border border-stone-200 px-3 py-2 text-xs disabled:bg-stone-100" />
              <label className="flex items-center gap-2 text-xs text-stone-600"><input type="checkbox" checked={message.whatsappLinkPreview.image.decorative === true} onChange={event => onChange({ whatsappLinkPreview: { ...message.whatsappLinkPreview!, image: { ...message.whatsappLinkPreview!.image!, decorative: event.target.checked, ...(event.target.checked ? { alt: '' } : {}) } } })} /> Decorative</label>
            </div>}
          </div>
        )}

        {(mode === 'audio' || mode === 'video') && media && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              {media.kind === 'audio' ? (
                <select value={media.mimeType} onChange={event => onChange({ whatsappMedia: { ...media, mimeType: event.target.value as WhatsAppAudioMedia['mimeType'] } })} aria-label="Media file type" className="rounded-lg border border-stone-200 px-2 py-2 text-xs">
                  {AUDIO_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                </select>
              ) : (
                <select value={media.source} onChange={event => {
                  const common = { duration: media.duration, description: media.description };
                  onChange({ whatsappMedia: event.target.value === 'youtube'
                    ? { kind: 'video', source: 'youtube', url: '', ...common }
                    : { kind: 'video', source: 'direct', url: '', mimeType: 'video/mp4', ...common } });
                }} aria-label="Video source" className="rounded-lg border border-stone-200 px-2 py-2 text-xs">
                  <option value="youtube">YouTube</option>
                  <option value="direct">Direct video file</option>
                </select>
              )}
              <input value={media.duration || ''} onChange={event => onChange({ whatsappMedia: { ...media, duration: event.target.value } as WhatsAppMedia })} placeholder="Duration, e.g. 0:12" aria-label="Media duration" className="rounded-lg border border-stone-200 px-3 py-2 text-xs" />
            </div>
            <input value={media.url} onChange={event => onChange({ whatsappMedia: { ...media, url: event.target.value } as WhatsAppMedia })} placeholder={media.kind === 'video' && media.source === 'youtube' ? 'YouTube watch, share, Shorts, live, or embed URL' : 'Direct HTTPS media file'} aria-label="Media address" className="w-full rounded-lg border border-stone-200 px-3 py-2 text-xs" />
            {media.kind === 'video' && media.source === 'direct' && (
              <select value={media.mimeType} onChange={event => onChange({ whatsappMedia: { ...media, mimeType: event.target.value as WhatsAppDirectVideoMedia['mimeType'] } })} aria-label="Media file type" className="w-full rounded-lg border border-stone-200 px-2 py-2 text-xs">
                {VIDEO_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
              </select>
            )}
            {media.kind === 'audio' ? (
              <>
                <textarea value={media.transcript || ''} onChange={event => onChange({ whatsappMedia: { ...media, transcript: event.target.value } })} placeholder="Transcript (recommended)" aria-label="Voice message transcript" rows={2} className="w-full rounded-lg border border-stone-200 px-3 py-2 text-xs" />
                <p className="text-[11px] leading-relaxed text-stone-500">For AO3 playback, use a direct HTTPS audio file whose host permits anonymous cross-origin requests. MP3 is the safest default; a webpage or share link is not an audio file.</p>
              </>
            ) : (
              <>
                <ImageUrlInput value={media.posterUrl || ''} onChange={posterUrl => onChange({ whatsappMedia: { ...media, posterUrl } })} ariaLabel="Video poster address" placeholder="Poster image address (recommended)" />
                <textarea value={media.description || ''} onChange={event => onChange({ whatsappMedia: { ...media, description: event.target.value } })} placeholder="Video description" aria-label="Video description" rows={2} className="w-full rounded-lg border border-stone-200 px-3 py-2 text-xs" />
                {media.source === 'direct' && <>
                  <input value={media.captionTrackUrl || ''} onChange={event => onChange({ whatsappMedia: { ...media, captionTrackUrl: event.target.value } })} placeholder="Caption track HTTPS URL" aria-label="Caption track address" className="w-full rounded-lg border border-stone-200 px-3 py-2 text-xs" />
                  <div className="grid grid-cols-2 gap-2"><input value={media.captionLanguage || ''} onChange={event => onChange({ whatsappMedia: { ...media, captionLanguage: event.target.value } })} placeholder="Language, e.g. en" aria-label="Caption language" className="rounded-lg border border-stone-200 px-3 py-2 text-xs" /><input value={media.captionLabel || ''} onChange={event => onChange({ whatsappMedia: { ...media, captionLabel: event.target.value } })} placeholder="Label, e.g. English" aria-label="Caption label" className="rounded-lg border border-stone-200 px-3 py-2 text-xs" /></div>
                </>}
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
              <iframe key={mediaKey} src={normalizeYouTubeUrl(media.url)?.embedUrl} title="WhatsApp YouTube video preview" width="560" height="315" allowFullScreen className="w-full rounded-lg border-0 bg-black" />
            ) : (
              <video key={mediaKey} controls preload="metadata" poster={media.posterUrl} onError={() => setMediaPreviewError('The host blocked this preview or returned media that does not match the selected file type. Confirm HTTPS, CORS access, and the MIME type. The source-link fallback will still export.')} className="w-full rounded-lg">
                <source src={media.url} type={media.mimeType} />
                {media.captionTrackUrl && <track kind="captions" src={media.captionTrackUrl} srcLang={media.captionLanguage} label={media.captionLabel} default />}
                Your browser cannot play this video.
              </video>
            )}
            {mediaPreviewError && <p role="alert" className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">{mediaPreviewError}</p>}
            <p className="text-[11px] text-stone-500">The scene preview, PNG, and ImgBB export use a static thumbnail card. AO3 Work Text embeds YouTube with its privacy-enhanced player or streams a direct file from its current host. This app never downloads, uploads, or preserves the video file.</p>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between"><h4 className="text-xs font-semibold uppercase tracking-wide text-stone-400">Reactions</h4>{(message.whatsappReactions?.length || 0) < 3 && <button type="button" onClick={() => onChange({ whatsappReactions: [...(message.whatsappReactions || []), { emoji: '❤️' }] })} className="text-xs font-medium text-violet-700">Add reaction</button>}</div>
        {(message.whatsappReactions || []).map((reaction, reactionIndex) => (
          <div key={`${idPrefix}-reaction-${reactionIndex}`} className="flex items-center gap-2">
            <input value={reaction.emoji} onChange={event => updateReaction(reactionIndex, { emoji: event.target.value })} aria-label={`Reaction ${reactionIndex + 1} emoji`} className="w-16 rounded-lg border border-stone-200 px-2 py-1.5 text-center text-sm" />
            <input type="number" min={1} max={9999} value={reaction.count || 1} onChange={event => updateReaction(reactionIndex, { count: Math.max(1, Math.min(9999, Number(event.target.value) || 1)) })} aria-label={`Reaction ${reactionIndex + 1} count`} className="w-20 rounded-lg border border-stone-200 px-2 py-1.5 text-xs" />
            <button type="button" onClick={() => onChange({ whatsappReactions: message.whatsappReactions?.filter((_, i) => i !== reactionIndex) })} className="text-xs text-red-600">Remove</button>
          </div>
        ))}
        <div className="flex flex-wrap gap-1">{REACTION_PRESETS.map(emoji => <button key={emoji} type="button" onClick={() => onChange({ whatsappReactions: normalizeWhatsAppReactions([...(message.whatsappReactions || []), { emoji }]) })} className="rounded-full bg-stone-100 px-2 py-1 text-sm">{emoji}</button>)}</div>
      </section>

      <label className="flex items-center gap-2 text-xs text-stone-600"><input type="checkbox" checked={message.whatsappStartNewRun === true} onChange={event => onChange({ whatsappStartNewRun: event.target.checked || undefined })} /> Start a new visual message run</label>
      {errors.map(error => <p key={error} role="alert" className="text-xs text-red-700">{error}</p>)}
    </div>
  );
};

export default WhatsAppMessageExtrasEditor;
