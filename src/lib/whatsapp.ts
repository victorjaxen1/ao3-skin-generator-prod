import {
  Message,
  SkinProject,
  WhatsAppLinkPreview,
  WhatsAppMedia,
  WhatsAppParticipantTone,
  WhatsAppReaction,
} from './schema';
import { normalizeYouTubeUrl } from './twitter';
import { resolveMessageIdentity } from './identity';

export interface WhatsAppToneDefinition {
  id: WhatsAppParticipantTone;
  label: string;
  light: string;
  dark: string;
}

export const WHATSAPP_PARTICIPANT_TONES: readonly WhatsAppToneDefinition[] = [
  { id: 'green', label: 'Green', light: '#137333', dark: '#53bdeb' },
  { id: 'teal', label: 'Teal', light: '#00796b', dark: '#00a884' },
  { id: 'lime', label: 'Lime', light: '#4f6f00', dark: '#b6e36b' },
  { id: 'yellow', label: 'Yellow', light: '#7a5d00', dark: '#f5c451' },
  { id: 'orange', label: 'Orange', light: '#a34600', dark: '#ff9f43' },
  { id: 'red', label: 'Red', light: '#b3261e', dark: '#ff6b6b' },
  { id: 'pink', label: 'Pink', light: '#a3195b', dark: '#ff8fc7' },
  { id: 'magenta', label: 'Magenta', light: '#8e1a8e', dark: '#e879f9' },
  { id: 'purple', label: 'Purple', light: '#6f42c1', dark: '#c4a7ff' },
  { id: 'violet', label: 'Violet', light: '#5b3fb4', dark: '#a78bfa' },
  { id: 'blue', label: 'Blue', light: '#1769aa', dark: '#6cb6ff' },
  { id: 'cyan', label: 'Cyan', light: '#006b78', dark: '#56d4dd' },
] as const;

export const WHATSAPP_TONE_IDS = new Set<WhatsAppParticipantTone>(
  WHATSAPP_PARTICIPANT_TONES.map(tone => tone.id)
);

const AUDIO_MIME = new Set<Extract<WhatsAppMedia, { kind: 'audio' }>['mimeType']>(['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/mp4']);
const VIDEO_MIME = new Set<Extract<WhatsAppMedia, { kind: 'video'; source: 'direct' }>['mimeType']>(['video/mp4', 'video/webm', 'video/ogg']);

function validHttps(value: string | undefined): boolean {
  if (!value || /[<>]/.test(value)) return false;
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}

function validImageAddress(value: string | undefined): boolean {
  if (!value || /[<>]/.test(value)) return false;
  return !/^(?:javascript|vbscript|data:text\/html)/i.test(value.trim());
}

function graphemes(value: string): string[] {
  const Segmenter = (Intl as unknown as { Segmenter?: new (...args: unknown[]) => { segment: (text: string) => Iterable<{ segment: string }> } }).Segmenter;
  if (Segmenter) return [...new Segmenter(undefined, { granularity: 'grapheme' } as unknown).segment(value)].map(item => item.segment);
  return Array.from(value);
}

export function resolveWhatsAppSpeakerKey(project: SkinProject, message: Message): string {
  if (message.whatsappEvent) return `event:${message.id}`;
  if (message.isTyping) return `typing:${message.id}`;
  if (message.characterId) return `character:${message.characterId}`;
  if (message.participantId) return `participant:${message.participantId}`;
  const identity = resolveMessageIdentity(project, message);
  return `${message.outgoing ? 'out' : 'in'}:${identity.name.trim().toLocaleLowerCase() || message.sender.trim().toLocaleLowerCase()}`;
}

export function isSameWhatsAppRun(project: SkinProject, previous: Message | undefined, current: Message | undefined): boolean {
  if (!previous || !current || previous.whatsappEvent || current.whatsappEvent || previous.isTyping || current.isTyping) return false;
  if (current.whatsappStartNewRun) return false;
  if (previous.outgoing !== current.outgoing) return false;
  return resolveWhatsAppSpeakerKey(project, previous) === resolveWhatsAppSpeakerKey(project, current);
}

export function validateWhatsAppReply(project: SkinProject, message: Message, index: number): string[] {
  const reply = message.whatsappReply;
  if (!reply) return [];
  const targetIndex = project.messages.findIndex(candidate => candidate.id === reply.messageId);
  if (reply.messageId === message.id) return ['A message cannot reply to itself.'];
  if (targetIndex < 0) return ['The replied-to message no longer exists.'];
  if (targetIndex >= index) return ['A reply must point to an earlier message.'];
  if (project.messages[targetIndex].whatsappEvent) return ['A reply cannot point to a date divider or system event.'];
  return [];
}

export function validateWhatsAppLinkPreview(preview: WhatsAppLinkPreview | undefined): string[] {
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

export function validateWhatsAppMedia(media: WhatsAppMedia | undefined): string[] {
  if (!media) return [];
  const errors: string[] = [];
  if (media.kind === 'audio') {
    if (!validHttps(media.url)) errors.push('Audio needs an absolute HTTPS file address.');
    if (!AUDIO_MIME.has(media.mimeType)) errors.push('Choose a supported audio file type.');
  } else {
    if (media.source === 'youtube') {
      if (!normalizeYouTubeUrl(media.url)) errors.push('Use a supported HTTPS YouTube watch, share, Shorts, live, or embed address.');
    } else {
      if (media.posterUrl && !validHttps(media.posterUrl)) errors.push('The video poster needs an absolute HTTPS address.');
      if (!validHttps(media.url)) errors.push('Direct video needs an absolute HTTPS file address.');
      if (normalizeYouTubeUrl(media.url)) errors.push('Choose YouTube as the video source for YouTube addresses.');
      if (!VIDEO_MIME.has(media.mimeType)) errors.push('Choose a supported video file type.');
      if (media.captionTrackUrl && !validHttps(media.captionTrackUrl)) errors.push('The caption track needs an absolute HTTPS address.');
      const hasAnyCaption = !!(media.captionTrackUrl || media.captionLanguage || media.captionLabel);
      const hasAllCaption = !!(media.captionTrackUrl && media.captionLanguage?.trim() && media.captionLabel?.trim());
      if (hasAnyCaption && !hasAllCaption) errors.push('Caption URL, language, and label must be provided together.');
    }
  }
  return errors;
}

export function normalizeWhatsAppReactions(reactions: WhatsAppReaction[] | undefined): WhatsAppReaction[] {
  const merged = new Map<string, number>();
  for (const reaction of reactions || []) {
    const emoji = typeof reaction?.emoji === 'string' ? reaction.emoji.trim() : '';
    if (!emoji || graphemes(emoji).length !== 1) continue;
    const count = Number.isInteger(reaction.count) ? Math.max(1, Math.min(9999, reaction.count || 1)) : 1;
    merged.set(emoji, Math.min(9999, (merged.get(emoji) || 0) + count));
  }
  return [...merged].slice(0, 3).map(([emoji, count]) => ({ emoji, ...(count > 1 ? { count } : {}) }));
}

export function validateWhatsAppMessage(project: SkinProject, message: Message, index: number): string[] {
  const errors: string[] = [];
  if (message.whatsappEvent) {
    if (!message.whatsappEvent.text.trim()) errors.push('Date dividers and system events need text.');
    const hasMessageData = !!(message.outgoing || message.sender.trim() || message.timestamp || message.participantId || message.characterId || message.avatarUrl || message.content.trim() || message.attachments?.length || message.whatsappReply || message.whatsappLinkPreview || message.whatsappMedia || message.whatsappReactions?.length || message.reaction || message.status);
    if (hasMessageData) errors.push('An event cannot also contain message content.');
    return errors;
  }
  errors.push(...validateWhatsAppReply(project, message, index));
  errors.push(...validateWhatsAppLinkPreview(message.whatsappLinkPreview));
  errors.push(...validateWhatsAppMedia(message.whatsappMedia));
  const primary = Number(!!message.attachments?.length) + Number(!!message.whatsappLinkPreview) + Number(!!message.whatsappMedia);
  if (primary > 1) errors.push('Choose images, a link preview, or audio/video—not more than one.');
  if ((message.attachments?.length || 0) > 4) errors.push('WhatsApp messages can contain at most four images.');
  for (const attachment of message.attachments || []) {
    if (!validImageAddress(attachment.url)) errors.push('Each WhatsApp image needs a valid image address.');
    if (!attachment.decorative && !attachment.alt?.trim()) errors.push('Describe each WhatsApp image or mark it decorative.');
  }
  if (!message.content.trim() && primary === 0 && !message.isTyping) errors.push('Add message text or a content card.');
  const reactions = message.whatsappReactions || [];
  if (reactions.length > 3) errors.push('A message can contain at most three reaction types.');
  for (const reaction of reactions) {
    if (graphemes(reaction.emoji.trim()).length !== 1) errors.push('Each reaction must be one emoji.');
    if (reaction.count !== undefined && (!Number.isInteger(reaction.count) || reaction.count < 1 || reaction.count > 9999)) errors.push('Reaction counts must be between 1 and 9999.');
  }
  if (project.settings.androidGroupMode && !message.outgoing) {
    const participants = project.settings.androidGroupParticipants || [];
    const exists = participants.some(participant => participant.id === message.participantId || participant.characterId === message.characterId);
    if (!exists) errors.push('Choose a valid group participant for this incoming message.');
  }
  return [...new Set(errors)];
}

export function whatsappMessageLabel(message: Message): string {
  if (message.whatsappEvent) return message.whatsappEvent.kind === 'date' ? 'Date divider' : 'System event';
  if (message.content.trim()) return message.content.replace(/\s+/g, ' ').slice(0, 60);
  if (message.attachments?.length) return message.attachments.length === 1 ? 'Photo' : `${message.attachments.length} photos`;
  if (message.whatsappMedia?.kind === 'audio') return 'Voice message';
  if (message.whatsappMedia?.kind === 'video') return 'Video';
  if (message.whatsappLinkPreview) return message.whatsappLinkPreview.title || 'Link preview';
  return 'Message';
}

export function whatsappToneForMessage(project: SkinProject, message: Message): WhatsAppParticipantTone {
  const participants = project.settings.androidGroupParticipants || [];
  return participants.find(participant => participant.characterId && participant.characterId === message.characterId)?.whatsappTone
    || participants.find(participant => participant.id === message.participantId)?.whatsappTone
    || 'teal';
}
