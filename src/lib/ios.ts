import {
  IOSLinkPreview,
  IOSMedia,
  IOSParticipantTone,
  IOSTapback,
  Message,
  SkinProject,
} from './schema';
import { normalizeYouTubeUrl } from './twitter';
import { resolveMessageIdentity } from './identity';

/**
 * The iOS model: speaker keys, run grouping, validation, and normalization.
 *
 * **React-free on purpose** (§0.2). This is the single truth the composer, the
 * timeline editor, strict project import, local-storage recovery, and preflight
 * all consult. Five callers agreeing is the whole point — the defect this
 * replaces was invalid rich content reaching persistence because the composer
 * and the importer each had their own idea of "valid".
 *
 * Structurally parallel to `whatsapp.ts` and deliberately not shared with it.
 * See §0.1: the fields look alike, the platforms do not, and a shared helper is
 * one refactor away from a shared renderer.
 */

export interface IOSToneDefinition {
  id: IOSParticipantTone;
  label: string;
  light: string;
  dark: string;
}

/**
 * A finite palette, because AO3 strips inline `style`.
 *
 * Group sender colour used to be a free hex value on `GroupParticipant.color`
 * emitted as `style="color: #b3261e"`. That renders in the app and in the PNG
 * and is *deleted* on the archive, so the published work disagreed with the
 * preview. A fixed list compiles to `ios-tone-*` classes the stylesheet can
 * carry instead.
 *
 * The values are Apple's system-colour family, which is where the names come
 * from; the dark variants are the lighter of each pair so they hold contrast on
 * a near-black bubble.
 */
export const IOS_PARTICIPANT_TONES: readonly IOSToneDefinition[] = [
  { id: 'red', label: 'Red', light: '#c8102e', dark: '#ff6961' },
  { id: 'orange', label: 'Orange', light: '#a2500a', dark: '#ffb340' },
  { id: 'yellow', label: 'Yellow', light: '#7a5d00', dark: '#ffd426' },
  { id: 'green', label: 'Green', light: '#1b6b2c', dark: '#54d669' },
  { id: 'mint', label: 'Mint', light: '#0c6b63', dark: '#66d4cf' },
  { id: 'teal', label: 'Teal', light: '#00637a', dark: '#5de6ff' },
  { id: 'cyan', label: 'Cyan', light: '#0a6b8f', dark: '#70d7ff' },
  { id: 'blue', label: 'Blue', light: '#0a58ca', dark: '#6cb6ff' },
  { id: 'indigo', label: 'Indigo', light: '#4b3fbb', dark: '#a1a0ff' },
  { id: 'purple', label: 'Purple', light: '#7a3fb5', dark: '#da8fff' },
  { id: 'pink', label: 'Pink', light: '#b01e57', dark: '#ff6482' },
  { id: 'brown', label: 'Brown', light: '#7a5c46', dark: '#b59b83' },
] as const;

export const IOS_TONE_IDS = new Set<IOSParticipantTone>(IOS_PARTICIPANT_TONES.map(tone => tone.id));

export const IOS_AUDIO_MIME_TYPES: ReadonlyArray<Extract<IOSMedia, { kind: 'audio' }>['mimeType']> =
  ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/mp4'];
export const IOS_VIDEO_MIME_TYPES: ReadonlyArray<Extract<IOSMedia, { kind: 'video'; source: 'direct' }>['mimeType']> =
  ['video/mp4', 'video/webm', 'video/ogg'];

const AUDIO_MIME = new Set<string>(IOS_AUDIO_MIME_TYPES);
const VIDEO_MIME = new Set<string>(IOS_VIDEO_MIME_TYPES);

function validHttps(value: string | undefined): boolean {
  if (!value || /[<>]/.test(value)) return false;
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}

/**
 * Images keep the looser address policy the rest of the app already uses.
 *
 * Media sources must be absolute HTTPS because they are handed to a native
 * player on the archive; an image address may legitimately be a local app asset
 * or one of the data URLs the upload flow already produces (§0.5).
 */
function validImageAddress(value: string | undefined): boolean {
  if (!value || /[<>]/.test(value)) return false;
  return !/^(?:javascript|vbscript|data:text\/html)/i.test(value.trim());
}

function graphemes(value: string): string[] {
  const Segmenter = (Intl as unknown as { Segmenter?: new (...args: unknown[]) => { segment: (text: string) => Iterable<{ segment: string }> } }).Segmenter;
  if (Segmenter) return [...new Segmenter(undefined, { granularity: 'grapheme' } as unknown).segment(value)].map(item => item.segment);
  return Array.from(value);
}

/** How many of the four mutually exclusive primary content blocks are populated. */
export function iosPrimaryContentCount(message: Message): number {
  return Number(!!message.attachments?.length)
    + Number(!!message.iosLinkPreview)
    + Number(!!message.iosMedia);
}

/**
 * Who is speaking, as a key that distinguishes two *different* group members.
 *
 * The shipped renderer compared `outgoing` alone, so Alex and Bea merged into a
 * single visual run with one tail between them — the P0 defect in §2.2. A run
 * boundary is a question about the speaker, not about the direction.
 */
export function resolveIOSSpeakerKey(project: SkinProject, message: Message): string {
  if (message.iosEvent) return `event:${message.id}`;
  if (message.isTyping) return `typing:${message.id}`;
  if (message.characterId) return `character:${message.characterId}`;
  if (message.participantId) return `participant:${message.participantId}`;
  const identity = resolveMessageIdentity(project, message);
  return `${message.outgoing ? 'out' : 'in'}:${identity.name.trim().toLocaleLowerCase() || message.sender.trim().toLocaleLowerCase()}`;
}

export function isSameIOSRun(project: SkinProject, previous: Message | undefined, current: Message | undefined): boolean {
  if (!previous || !current) return false;
  if (previous.iosEvent || current.iosEvent || previous.isTyping || current.isTyping) return false;
  if (current.iosStartNewRun) return false;
  // A narrative time break is a deliberate gap in the fiction, so it ends the
  // run it sits above regardless of who is talking.
  if (current.showTimeBreak) return false;
  if (previous.outgoing !== current.outgoing) return false;
  return resolveIOSSpeakerKey(project, previous) === resolveIOSSpeakerKey(project, current);
}

export function validateIOSReply(project: SkinProject, message: Message, index: number): string[] {
  const reply = message.iosReply;
  if (!reply) return [];
  if (reply.messageId === message.id) return ['A message cannot reply to itself.'];
  const targetIndex = project.messages.findIndex(candidate => candidate.id === reply.messageId);
  if (targetIndex < 0) return ['The replied-to message no longer exists.'];
  if (targetIndex >= index) return ['A reply must point to an earlier message.'];
  if (project.messages[targetIndex].iosEvent) return ['A reply cannot point to a date divider or system event.'];
  return [];
}

export function validateIOSLinkPreview(preview: IOSLinkPreview | undefined): string[] {
  if (!preview) return [];
  const errors: string[] = [];
  if (!validHttps(preview.url)) errors.push('Link previews need an absolute HTTPS address.');
  if (!preview.title.trim()) errors.push('Link previews need a title.');
  if (preview.title.length > 200) errors.push('Link preview titles must be 200 characters or fewer.');
  if ((preview.siteName?.length || 0) > 100) errors.push('Site names must be 100 characters or fewer.');
  if ((preview.description?.length || 0) > 500) errors.push('Link descriptions must be 500 characters or fewer.');
  if (preview.image && !validImageAddress(preview.image.url)) errors.push('The link preview image address is invalid.');
  if (preview.image && !preview.image.decorative && !preview.image.alt?.trim()) errors.push('Describe the link preview image or mark it decorative.');
  return errors;
}

export function validateIOSMedia(media: IOSMedia | undefined): string[] {
  if (!media) return [];
  const errors: string[] = [];
  if (media.kind === 'audio') {
    // An absent address is a decorative voice note — the editor creates one
    // (`blankMedia('audio')`) and the generator draws a waveform card with no
    // player for it. A *malformed* address is still an error: the pinned rule
    // in ios-model.unit.spec.ts is that `http://` is refused, not that a file
    // must exist.
    if (media.url.trim() && !validHttps(media.url)) errors.push('Voice messages need an absolute HTTPS file address.');
    if (!AUDIO_MIME.has(media.mimeType)) errors.push('Choose a supported audio file type.');
    return errors;
  }
  if (media.source === 'youtube') {
    if (!normalizeYouTubeUrl(media.url)) errors.push('Use a supported HTTPS YouTube watch, share, Shorts, live, or embed address.');
    // A malformed optional poster must never be promoted into a blocking error
    // *or* be allowed to suppress the derived YouTube thumbnail (§0.5). The
    // renderer ignores it; validation stays quiet about a field the author left
    // half-typed.
    return errors;
  }
  if (!validHttps(media.url)) errors.push('Direct video needs an absolute HTTPS file address.');
  if (normalizeYouTubeUrl(media.url)) errors.push('Choose YouTube as the video source for YouTube addresses.');
  if (!VIDEO_MIME.has(media.mimeType)) errors.push('Choose a supported video file type.');
  if (media.posterUrl && !validHttps(media.posterUrl)) errors.push('The video poster needs an absolute HTTPS address.');
  if (media.captionTrackUrl && !validHttps(media.captionTrackUrl)) errors.push('The caption track needs an absolute HTTPS address.');
  const hasAnyCaption = !!(media.captionTrackUrl || media.captionLanguage?.trim() || media.captionLabel?.trim());
  const hasAllCaption = !!(media.captionTrackUrl && media.captionLanguage?.trim() && media.captionLabel?.trim());
  if (hasAnyCaption && !hasAllCaption) errors.push('Caption URL, language, and label must be provided together.');
  return errors;
}

/**
 * Merge duplicate emoji, cap counts, and cap the list at three types.
 *
 * Deterministic on purpose: this runs in storage recovery and in strict import
 * as well as in the editor, and those three must agree on what a Tapback stack
 * is or a round-trip silently reorders the author's reactions.
 */
export function normalizeIOSTapbacks(tapbacks: IOSTapback[] | undefined): IOSTapback[] {
  const merged = new Map<string, number>();
  for (const tapback of tapbacks || []) {
    const emoji = typeof tapback?.emoji === 'string' ? tapback.emoji.trim() : '';
    if (!emoji || graphemes(emoji).length !== 1) continue;
    const count = Number.isInteger(tapback.count) ? Math.max(1, Math.min(9999, tapback.count || 1)) : 1;
    merged.set(emoji, Math.min(9999, (merged.get(emoji) || 0) + count));
  }
  return [...merged].slice(0, 3).map(([emoji, count]) => ({ emoji, ...(count > 1 ? { count } : {}) }));
}

export function validateIOSMessage(project: SkinProject, message: Message, index: number): string[] {
  const errors: string[] = [];
  if (message.iosEvent) {
    if (!message.iosEvent.text.trim()) errors.push('Date dividers and system events need text.');
    const hasMessageData = !!(message.outgoing || message.sender.trim() || message.timestamp
      || message.participantId || message.characterId || message.avatarUrl || message.content.trim()
      || message.attachments?.length || message.iosReply || message.iosLinkPreview || message.iosMedia
      || message.iosTapbacks?.length || message.reaction || message.status || message.isTyping);
    if (hasMessageData) errors.push('An event cannot also contain message content.');
    return errors;
  }
  errors.push(...validateIOSReply(project, message, index));
  errors.push(...validateIOSLinkPreview(message.iosLinkPreview));
  errors.push(...validateIOSMedia(message.iosMedia));

  const primary = iosPrimaryContentCount(message);
  if (primary > 1) errors.push('Choose images, a link preview, or audio/video—not more than one.');
  if ((message.attachments?.length || 0) > 4) errors.push('An iMessage can contain at most four images.');
  for (const attachment of message.attachments || []) {
    if (!validImageAddress(attachment.url)) errors.push('Each iMessage image needs a valid image address.');
    if (!attachment.decorative && !attachment.alt?.trim()) errors.push('Describe each iMessage image or mark it decorative.');
  }
  if (!message.content.trim() && primary === 0 && !message.isTyping) errors.push('Add message text or a content card.');

  const tapbacks = message.iosTapbacks || [];
  if (tapbacks.length > 3) errors.push('A message can carry at most three Tapback types.');
  for (const tapback of tapbacks) {
    if (graphemes(tapback.emoji.trim()).length !== 1) errors.push('Each Tapback must be one emoji.');
    if (tapback.count !== undefined && (!Number.isInteger(tapback.count) || tapback.count < 1 || tapback.count > 9999)) {
      errors.push('Tapback counts must be between 1 and 9999.');
    }
  }

  if (project.settings.iosGroupMode && !message.outgoing && !message.isTyping) {
    const participants = project.settings.iosGroupParticipants || [];
    const exists = participants.some(participant =>
      (!!message.participantId && participant.id === message.participantId)
      || (!!message.characterId && participant.characterId === message.characterId));
    if (!exists) errors.push('Choose a valid group participant for this incoming message.');
  }
  return [...new Set(errors)];
}

/** A short human label for a message, used by the reply picker and reply cards. */
export function iosMessageLabel(message: Message): string {
  if (message.iosEvent) return message.iosEvent.kind === 'date' ? 'Date divider' : 'System event';
  if (message.isTyping) return 'Typing indicator';
  if (message.content.trim()) return message.content.replace(/\s+/g, ' ').slice(0, 60);
  if (message.attachments?.length) return message.attachments.length === 1 ? 'Photo' : 'Photos';
  if (message.iosMedia?.kind === 'audio') return 'Voice message';
  if (message.iosMedia?.kind === 'video') return 'Video';
  if (message.iosLinkPreview) return message.iosLinkPreview.title || 'Link';
  return 'Message';
}

export function iosToneForMessage(project: SkinProject, message: Message): IOSParticipantTone {
  const participants = project.settings.iosGroupParticipants || [];
  return participants.find(participant => participant.characterId && participant.characterId === message.characterId)?.iosTone
    || participants.find(participant => participant.id === message.participantId)?.iosTone
    || 'blue';
}
