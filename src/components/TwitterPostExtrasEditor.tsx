import React, { useEffect, useMemo, useState } from 'react';
import { Message, SkinProject, TwitterPoll, TwitterQuotePost, TwitterVideo } from '../lib/schema';
import { getTwitterPollError, normalizeYouTubeUrl, validateTwitterVideo } from '../lib/twitter';
import ImageUrlInput from './ImageUrlInput';
import MultiImageEditor from './MultiImageEditor';

interface Props {
  message: Message;
  project: SkinProject;
  onChange: (updates: Partial<Message>) => void;
}

function localOptionId(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch { /* local fallback */ }
  return `poll-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const inputClass = 'w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs focus:ring-2 focus:ring-violet-500';
const selectClass = 'rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-xs focus:ring-2 focus:ring-violet-500';

function defaultQuote(): TwitterQuotePost {
  return { name: '', handle: '', text: '', attachments: [] };
}

function defaultPoll(): TwitterPoll {
  return {
    state: 'open',
    options: [
      { id: localOptionId(), text: '' },
      { id: localOptionId(), text: '' },
    ],
  };
}

export default function TwitterPostExtrasEditor({ message, project, onChange }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const [videoConsent, setVideoConsent] = useState(false);
  const [videoPreviewError, setVideoPreviewError] = useState('');
  const videoKey = JSON.stringify(message.twitterVideo || null);
  useEffect(() => {
    setVideoConsent(false);
    setVideoPreviewError('');
  }, [videoKey]);

  const videoIssues = useMemo(() => validateTwitterVideo(message.twitterVideo), [message.twitterVideo]);
  const pollError = getTwitterPollError(message.twitterPoll);
  const setVideo = (updates: Partial<TwitterVideo>) => onChange({
    twitterVideo: { source: 'youtube', url: '', title: '', ...message.twitterVideo, ...updates },
    attachments: [],
    imageLayout: undefined,
  });
  const setQuote = (updates: Partial<TwitterQuotePost>) => onChange({
    twitterQuote: { ...defaultQuote(), ...message.twitterQuote, ...updates },
  });
  const setPoll = (updates: Partial<TwitterPoll>) => onChange({
    twitterPoll: { ...defaultPoll(), ...message.twitterPoll, ...updates },
  });
  const sectionButton = (id: string, title: string, enabled: boolean) => (
    <button type="button" onClick={() => setOpen(open === id ? null : id)} aria-expanded={open === id} className="flex w-full items-center justify-between py-2 text-left text-xs font-semibold text-stone-700">
      <span>{title}{enabled ? ' · On' : ''}</span><span aria-hidden="true">{open === id ? '−' : '+'}</span>
    </button>
  );

  return (
    <div className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white px-3">
      <section>
        {sectionButton('media', 'Media', !!message.twitterVideo || !!message.attachments?.length)}
        {open === 'media' && (
          <div className="pb-3 space-y-3">
            <div className="flex gap-2">
              <button type="button" aria-pressed={!message.twitterVideo} onClick={() => onChange({ twitterVideo: undefined })} className={`rounded-lg px-3 py-1.5 text-xs ${!message.twitterVideo ? 'bg-violet-100 text-violet-700' : 'bg-stone-100 text-stone-600'}`}>Images</button>
              <button type="button" aria-pressed={!!message.twitterVideo} onClick={() => setVideo({})} className={`rounded-lg px-3 py-1.5 text-xs ${message.twitterVideo ? 'bg-violet-100 text-violet-700' : 'bg-stone-100 text-stone-600'}`}>Video</button>
            </div>
            {!message.twitterVideo ? (
              <>
                <MultiImageEditor
                  attachments={message.attachments || []}
                  imageLayout={message.imageLayout}
                  onChange={({ attachments, imageLayout }) => onChange({ attachments, imageLayout })}
                  label="Image"
                  idPrefix={`${message.id}-twitter-media`}
                />
                {!!message.attachments?.length && (
                  <label className="block text-xs text-stone-600">Image sizing
                    <select value={message.twitterMediaCrop || 'auto'} onChange={event => onChange({ twitterMediaCrop: event.target.value as Message['twitterMediaCrop'] })} className={`${selectClass} mt-1 block w-full`} aria-label="Image sizing">
                      <option value="auto">Automatic</option><option value="fill-width">Fill width</option><option value="fill-height">Fill height</option>
                    </select>
                  </label>
                )}
              </>
            ) : (
              <div className="space-y-2">
                <select value={message.twitterVideo.source} onChange={event => {
                  const source = event.target.value as TwitterVideo['source'];
                  const common = { title: message.twitterVideo!.title, duration: message.twitterVideo!.duration, description: message.twitterVideo!.description };
                  onChange({
                    twitterVideo: source === 'youtube'
                      ? { source: 'youtube', url: '', ...common }
                      : { source: 'direct', url: '', mimeType: 'video/mp4', ...common },
                    attachments: [],
                    imageLayout: undefined,
                  });
                }} className={`${selectClass} w-full`} aria-label="Video source type"><option value="youtube">YouTube</option><option value="direct">Direct HTTPS video</option></select>
                <input value={message.twitterVideo.url} onChange={event => setVideo({ url: event.target.value })} aria-label="Video address" placeholder={message.twitterVideo.source === 'youtube' ? 'https://youtu.be/…' : 'https://example.com/video.mp4'} className={inputClass} />
                <input value={message.twitterVideo.title} onChange={event => setVideo({ title: event.target.value })} aria-label="Video title" placeholder="Video title (optional)" maxLength={200} className={inputClass} />
                <ImageUrlInput value={message.twitterVideo.posterUrl || ''} onChange={posterUrl => setVideo({ posterUrl })} ariaLabel="Video poster address" placeholder="Poster image address (recommended)" />
                <div className="grid grid-cols-2 gap-2">
                  <input value={message.twitterVideo.duration || ''} onChange={event => setVideo({ duration: event.target.value })} aria-label="Video duration" placeholder="Duration, e.g. 1:24" className={inputClass} />
                  {message.twitterVideo.source === 'direct' && <select value={message.twitterVideo.mimeType || 'video/mp4'} onChange={event => setVideo({ mimeType: event.target.value })} aria-label="Video MIME type" className={selectClass}><option value="video/mp4">video/mp4</option><option value="video/webm">video/webm</option><option value="video/ogg">video/ogg</option></select>}
                </div>
                <textarea value={message.twitterVideo.description || ''} onChange={event => setVideo({ description: event.target.value })} aria-label="Video description or transcript" placeholder="Description or short transcript" rows={2} maxLength={2000} className={inputClass} />
                <input value={message.twitterVideo.captionTrackUrl || ''} onChange={event => setVideo({ captionTrackUrl: event.target.value })} aria-label="Caption track address" placeholder="HTTPS captions (.vtt), optional" className={inputClass} />
                {message.twitterVideo.captionTrackUrl && <div className="grid grid-cols-2 gap-2"><input value={message.twitterVideo.captionLanguage || ''} onChange={event => setVideo({ captionLanguage: event.target.value })} aria-label="Caption language" placeholder="Language code, e.g. en" className={inputClass} /><input value={message.twitterVideo.captionLabel || ''} onChange={event => setVideo({ captionLabel: event.target.value })} aria-label="Caption label" placeholder="English captions" className={inputClass} /></div>}
                {videoIssues.length > 0 && <div role="alert" className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">{videoIssues.join(' ')}</div>}
                {!videoConsent ? (
                  <button type="button" disabled={videoIssues.length > 0} onClick={() => { setVideoPreviewError(''); setVideoConsent(true); }} className="rounded-lg bg-stone-900 px-3 py-2 text-xs font-medium text-white disabled:bg-stone-300">Load video preview</button>
                ) : message.twitterVideo.source === 'youtube' && normalizeYouTubeUrl(message.twitterVideo.url) ? (
                  <iframe key={videoKey} title={`Video preview: ${message.twitterVideo.title.trim() || 'YouTube video'}`} src={normalizeYouTubeUrl(message.twitterVideo.url)!.embedUrl} className="aspect-video w-full rounded-lg border-0" allow="encrypted-media; picture-in-picture" />
                ) : (
                  <video key={videoKey} controls preload="metadata" poster={message.twitterVideo.posterUrl} onError={() => setVideoPreviewError('The host blocked this preview or returned media that does not match the selected MIME type. Confirm HTTPS, CORS access, and the file type. The linked fallback will still export.')} className="w-full rounded-lg"><source src={message.twitterVideo.url} type={message.twitterVideo.mimeType} />{message.twitterVideo.captionTrackUrl && <track kind="captions" src={message.twitterVideo.captionTrackUrl} srcLang={message.twitterVideo.captionLanguage} label={message.twitterVideo.captionLabel} default />}</video>
                )}
                {videoPreviewError && <p role="alert" className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">{videoPreviewError}</p>}
                <p className="text-[11px] text-stone-500">AO3 work-skin HTML embeds YouTube from its privacy-enhanced player or streams a direct file from its current host. PNG and ImgBB scene exports remain static poster cards; this app never downloads or rehosts video files.</p>
                <button type="button" onClick={() => onChange({ twitterVideo: undefined })} className="text-xs text-red-600">Remove video</button>
              </div>
            )}
          </div>
        )}
      </section>

      <section>
        {sectionButton('quote', 'Quote post', !!message.twitterQuote)}
        {open === 'quote' && <div className="pb-3 space-y-2">
          {!message.twitterQuote ? <button type="button" onClick={() => onChange({ twitterQuote: defaultQuote() })} className="rounded-lg bg-violet-100 px-3 py-2 text-xs font-medium text-violet-700">Add quote post</button> : <>
            <select value={message.twitterQuote.characterId || 'external'} onChange={event => setQuote(event.target.value === 'external' ? { characterId: undefined } : { characterId: event.target.value })} className={`${selectClass} w-full`} aria-label="Quoted account"><option value="external">External account snapshot</option>{project.cast?.characters.map(character => <option key={character.id} value={character.id}>{character.name}</option>)}</select>
            {!message.twitterQuote.characterId && <><input value={message.twitterQuote.name || ''} onChange={event => setQuote({ name: event.target.value })} aria-label="Quoted account name" placeholder="Quoted account name" className={inputClass} /><input value={message.twitterQuote.handle || ''} onChange={event => setQuote({ handle: event.target.value.replace(/^@+/, '') })} aria-label="Quoted account handle" placeholder="handle" className={inputClass} /><ImageUrlInput value={message.twitterQuote.avatarUrl || ''} onChange={avatarUrl => setQuote({ avatarUrl })} ariaLabel="Quoted account avatar" placeholder="Avatar address (optional)" /><label className="flex items-center gap-2 text-xs text-stone-600"><input type="checkbox" checked={!!message.twitterQuote.verified} onChange={event => setQuote({ verified: event.target.checked })} /> Verified account</label></>}
            <textarea value={message.twitterQuote.text} onChange={event => setQuote({ text: event.target.value })} aria-label="Quoted post text" placeholder="Quoted post text" rows={2} maxLength={2000} className={inputClass} />
            <input value={message.twitterQuote.timestamp || ''} onChange={event => setQuote({ timestamp: event.target.value })} aria-label="Quoted post timestamp" placeholder="Quoted timestamp (optional)" className={inputClass} />
            <MultiImageEditor
              attachments={message.twitterQuote.attachments || []}
              imageLayout={message.twitterQuote.imageLayout}
              onChange={({ attachments, imageLayout }) => setQuote({ attachments, imageLayout })}
              label="Quote image"
              idPrefix={`${message.id}-twitter-quote-media`}
            />
            <button type="button" onClick={() => onChange({ twitterQuote: undefined })} className="text-xs text-red-600">Remove quote post</button>
          </>}
        </div>}
      </section>

      <section>
        {sectionButton('poll', 'Poll', !!message.twitterPoll)}
        {open === 'poll' && <div className="pb-3 space-y-2">
          {!message.twitterPoll ? <button type="button" onClick={() => onChange({ twitterPoll: defaultPoll() })} className="rounded-lg bg-violet-100 px-3 py-2 text-xs font-medium text-violet-700">Add poll</button> : <>
            <select value={message.twitterPoll.state} onChange={event => setPoll({ state: event.target.value as TwitterPoll['state'] })} aria-label="Poll state" className={`${selectClass} w-full`}><option value="open">Open poll</option><option value="closed">Closed poll</option></select>
            {message.twitterPoll.options.map((option, index) => <div key={option.id} className="grid grid-cols-[1fr_90px_auto] gap-2"><input value={option.text} onChange={event => setPoll({ options: message.twitterPoll!.options.map(item => item.id === option.id ? { ...item, text: event.target.value } : item) })} aria-label={`Poll option ${index + 1}`} placeholder={`Option ${index + 1}`} className={inputClass} /><input type="number" min={0} max={message.twitterPoll!.state === 'closed' ? 100 : undefined} value={message.twitterPoll!.state === 'closed' ? option.percent ?? '' : option.votes ?? ''} onChange={event => setPoll({ options: message.twitterPoll!.options.map(item => item.id === option.id ? { ...item, ...(message.twitterPoll!.state === 'closed' ? { percent: Number(event.target.value), votes: undefined } : { votes: Number(event.target.value), percent: undefined }) } : item) })} aria-label={`${message.twitterPoll!.state === 'closed' ? 'Percentage' : 'Votes'} for option ${index + 1}`} className={inputClass} /><button type="button" disabled={message.twitterPoll!.options.length <= 2} onClick={() => setPoll({ options: message.twitterPoll!.options.filter(item => item.id !== option.id) })} aria-label={`Remove poll option ${index + 1}`} className="text-xs text-red-600 disabled:text-stone-300">×</button></div>)}
            {message.twitterPoll.options.length < 4 && <button type="button" onClick={() => setPoll({ options: [...message.twitterPoll!.options, { id: localOptionId(), text: '' }] })} className="text-xs text-violet-700">Add option</button>}
            {message.twitterPoll.state === 'open' ? <input value={message.twitterPoll.timeRemaining || ''} onChange={event => setPoll({ timeRemaining: event.target.value })} aria-label="Poll time remaining" placeholder="Time remaining, e.g. 1 day left" className={inputClass} /> : <input value={message.twitterPoll.finalLabel || ''} onChange={event => setPoll({ finalLabel: event.target.value })} aria-label="Poll final label" placeholder="Final results" className={inputClass} />}
            {pollError && <p role="alert" className="text-xs text-red-600">{pollError}</p>}
            <button type="button" onClick={() => onChange({ twitterPoll: undefined })} className="text-xs text-red-600">Remove poll</button>
          </>}
        </div>}
      </section>

      <section>
        {sectionButton('translation', 'Translation', !!message.twitterTranslation)}
        {open === 'translation' && <div className="pb-3 space-y-2">{!message.twitterTranslation ? <button type="button" onClick={() => onChange({ twitterTranslation: { languageLabel: '', originalText: message.content, translatedText: '', visibleText: 'translated' } })} className="rounded-lg bg-violet-100 px-3 py-2 text-xs font-medium text-violet-700">Add translation</button> : <><input value={message.twitterTranslation.languageLabel || ''} onChange={event => onChange({ twitterTranslation: { ...message.twitterTranslation!, languageLabel: event.target.value } })} aria-label="Original language" placeholder="Original language, e.g. Japanese" className={inputClass} /><textarea value={message.twitterTranslation.originalText} onChange={event => onChange({ twitterTranslation: { ...message.twitterTranslation!, originalText: event.target.value } })} aria-label="Original post text" rows={2} className={inputClass} /><textarea value={message.twitterTranslation.translatedText} onChange={event => onChange({ twitterTranslation: { ...message.twitterTranslation!, translatedText: event.target.value } })} aria-label="Translated post text" rows={2} className={inputClass} /><select value={message.twitterTranslation.visibleText} onChange={event => onChange({ twitterTranslation: { ...message.twitterTranslation!, visibleText: event.target.value as 'original' | 'translated' } })} aria-label="Visible translation state" className={`${selectClass} w-full`}><option value="original">Show original</option><option value="translated">Show translation</option></select><button type="button" onClick={() => onChange({ twitterTranslation: undefined })} className="text-xs text-red-600">Remove translation</button></>}</div>}
      </section>

      <section>
        {sectionButton('context', 'Activity and account label', !!message.twitterActivity || !!message.twitterAccountLabel)}
        {open === 'context' && <div className="pb-3 space-y-2"><input value={message.twitterAccountLabel || ''} onChange={event => onChange({ twitterAccountLabel: event.target.value.slice(0, 50) || undefined })} aria-label="Account label" placeholder="Account label, e.g. Parody account" maxLength={50} className={inputClass} /><select value={message.twitterActivity?.type || 'none'} onChange={event => onChange({ twitterActivity: event.target.value === 'none' ? undefined : { type: event.target.value as 'liked' | 'reposted', actorCharacterIds: message.twitterActivity?.actorCharacterIds || [] } })} aria-label="Activity type" className={`${selectClass} w-full`}><option value="none">No activity header</option><option value="liked">Liked by</option><option value="reposted">Reposted by</option></select>{message.twitterActivity && <><div className="space-y-1">{project.cast?.characters.map(character => <label key={character.id} className="flex items-center gap-2 text-xs text-stone-600"><input type="checkbox" checked={message.twitterActivity!.actorCharacterIds.includes(character.id)} onChange={event => onChange({ twitterActivity: { ...message.twitterActivity!, actorCharacterIds: event.target.checked ? [...message.twitterActivity!.actorCharacterIds, character.id].slice(0, 20) : message.twitterActivity!.actorCharacterIds.filter(id => id !== character.id) } })} />{character.name}</label>)}</div><input type="number" min={0} max={9999} value={message.twitterActivity.additionalCount || 0} onChange={event => onChange({ twitterActivity: { ...message.twitterActivity!, additionalCount: Math.max(0, Number(event.target.value)) } })} aria-label="Additional activity count" className={inputClass} /></>}</div>}
      </section>
    </div>
  );
}
