import { IOSParticipantTone, SkinProject, WhatsAppParticipantTone } from './schema';
import { migrateProjectIdentities } from './identity';
import { migrateTwitterProject, normalizeYouTubeUrl } from './twitter';
import { normalizeWhatsAppReactions, WHATSAPP_TONE_IDS } from './whatsapp';
import { IOS_AUDIO_MIME_TYPES, IOS_TONE_IDS, IOS_VIDEO_MIME_TYPES, normalizeIOSTapbacks } from './ios';

const KEY = 'ao3SkinProject';

// Security limits to prevent DoS and memory issues
const MAX_STORAGE_SIZE = 500000; // 500KB max for stored project
const MAX_MESSAGES = 100; // Max messages per project
const MAX_CONTENT_LENGTH = 10000; // Max characters per message
const MAX_URL_LENGTH = 2048; // Standard URL length limit
const MESSAGE_STATUSES = new Set(['sending', 'sent', 'delivered', 'read']);
const LEGACY_W3_AUDIO_SAMPLE = 'https://media.w3.org/2010/07/bunny/04-Death_Becomes_Fur.oga';
const CORS_AUDIO_SAMPLE = 'https://archive.org/download/testmp3testfile/mpthreetest.mp3';

/**
 * Sanitize a string field with length limit
 */
function sanitizeString(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value.slice(0, maxLength);
}

/**
 * Sanitize URL field - basic validation and length limit
 */
function sanitizeStoredUrl(value: unknown): string {
  if (typeof value !== 'string') return '';
  const url = value.slice(0, MAX_URL_LENGTH).trim();
  // Block dangerous protocols
  if (/^(javascript|vbscript|data:text\/html)/i.test(url)) return '';
  return url;
}

function sanitizeStoredHttpsUrl(value: unknown): string {
  const url = sanitizeStoredUrl(value);
  if (!url) return '';
  try {
    return new URL(url).protocol === 'https:' ? url : '';
  } catch {
    return '';
  }
}

/**
 * Validate and sanitize a message object from storage
 */
function sanitizeMessage(msg: unknown): { id: string; sender: string; content: string; outgoing: boolean; [key: string]: unknown } | null {
  if (!msg || typeof msg !== 'object') return null;
  const m = msg as Record<string, unknown>;
  
  // Required fields validation
  if (typeof m.id !== 'string' || !m.id) return null;
  if (typeof m.outgoing !== 'boolean') return null;
  
  const result = {
    ...m,
    id: sanitizeString(m.id, 100),
    sender: sanitizeString(m.sender, 200),
    content: sanitizeString(m.content, MAX_CONTENT_LENGTH),
    outgoing: m.outgoing,
    timestamp: typeof m.timestamp === 'string' ? sanitizeString(m.timestamp, 50) : undefined,
    status: typeof m.status === 'string' && MESSAGE_STATUSES.has(m.status) ? m.status : undefined,
    statusMode: m.statusMode === 'auto' || m.statusMode === 'manual' ? m.statusMode : undefined,
    avatarUrl: sanitizeStoredUrl(m.avatarUrl),
    reaction: typeof m.reaction === 'string' ? sanitizeString(m.reaction, 10) : undefined,
    characterId: typeof m.characterId === 'string' ? sanitizeString(m.characterId, 100) : undefined,
    parentId: typeof m.parentId === 'string' ? sanitizeString(m.parentId, 100) : undefined,
    replyToHandles: Array.isArray(m.replyToHandles)
      ? m.replyToHandles.slice(0, 20).flatMap(value => typeof value === 'string' ? [sanitizeString(value, 100).replace(/^@+/, '')] : [])
      : undefined,
    twitterLayout: m.twitterLayout === 'expanded' || m.twitterLayout === 'compact' || m.twitterLayout === 'auto' ? m.twitterLayout : undefined,
    twitterReplyHandlesMode: m.twitterReplyHandlesMode === 'manual' || m.twitterReplyHandlesMode === 'auto' ? m.twitterReplyHandlesMode : undefined,
    twitterMediaCrop: m.twitterMediaCrop === 'auto' || m.twitterMediaCrop === 'fill-width' || m.twitterMediaCrop === 'fill-height' ? m.twitterMediaCrop : undefined,
    attachments: sanitizeStoredAttachments(m.attachments),
    twitterQuote: sanitizeStoredQuote(m.twitterQuote),
    twitterVideo: sanitizeStoredVideo(m.twitterVideo),
    twitterPoll: sanitizeStoredPoll(m.twitterPoll),
    twitterTranslation: sanitizeStoredTranslation(m.twitterTranslation),
    twitterActivity: sanitizeStoredActivity(m.twitterActivity),
    twitterAccountLabel: typeof m.twitterAccountLabel === 'string' ? sanitizeString(m.twitterAccountLabel, 50) : undefined,
    whatsappReply: sanitizeStoredWhatsAppReply(m.whatsappReply),
    whatsappLinkPreview: sanitizeStoredWhatsAppLink(m.whatsappLinkPreview),
    whatsappMedia: sanitizeStoredWhatsAppMedia(m.whatsappMedia),
    whatsappReactions: normalizeWhatsAppReactions(Array.isArray(m.whatsappReactions) ? m.whatsappReactions.flatMap(candidate => {
      if (!candidate || typeof candidate !== 'object') return [];
      const raw = candidate as Record<string, unknown>;
      return [{ emoji: sanitizeString(raw.emoji, 20), ...(typeof raw.count === 'number' ? { count: Math.floor(raw.count) } : {}) }];
    }) : undefined),
    whatsappEvent: sanitizeStoredWhatsAppEvent(m.whatsappEvent),
    whatsappStartNewRun: typeof m.whatsappStartNewRun === 'boolean' ? m.whatsappStartNewRun : undefined,
    iosReply: sanitizeStoredIOSReply(m.iosReply),
    iosLinkPreview: sanitizeStoredIOSLink(m.iosLinkPreview),
    iosMedia: sanitizeStoredIOSMedia(m.iosMedia),
    iosTapbacks: normalizeIOSTapbacks(Array.isArray(m.iosTapbacks) ? m.iosTapbacks.flatMap(candidate => {
      if (!candidate || typeof candidate !== 'object') return [];
      const raw = candidate as Record<string, unknown>;
      return [{ emoji: sanitizeString(raw.emoji, 20), ...(typeof raw.count === 'number' ? { count: Math.floor(raw.count) } : {}) }];
    }) : undefined),
    iosEvent: sanitizeStoredIOSEvent(m.iosEvent),
    iosStartNewRun: typeof m.iosStartNewRun === 'boolean' ? m.iosStartNewRun : undefined,
  };
  if (result.whatsappEvent) {
    Object.assign(result, {
      outgoing: false, sender: '', content: '', timestamp: undefined,
      status: undefined, avatarUrl: undefined, characterId: undefined,
      attachments: undefined, whatsappReply: undefined,
      whatsappLinkPreview: undefined, whatsappMedia: undefined,
      whatsappReactions: [],
    });
  } else if (result.attachments?.length) {
    Object.assign(result, { whatsappLinkPreview: undefined, whatsappMedia: undefined });
  } else if (result.whatsappLinkPreview) {
    Object.assign(result, { whatsappMedia: undefined });
  }
  // The same exclusivity pass for iOS, on iOS fields only. Reading the WhatsApp
  // block above to decide an iOS message's shape is exactly the cross-platform
  // coupling §0.1 forbids, so this is a second pass rather than a shared one.
  if (result.iosEvent) {
    Object.assign(result, {
      outgoing: false, sender: '', content: '', timestamp: undefined,
      status: undefined, avatarUrl: undefined, characterId: undefined,
      isTyping: undefined, attachments: undefined, iosReply: undefined,
      iosLinkPreview: undefined, iosMedia: undefined, iosTapbacks: [],
    });
  } else if (result.attachments?.length) {
    Object.assign(result, { iosLinkPreview: undefined, iosMedia: undefined });
  } else if (result.iosLinkPreview) {
    Object.assign(result, { iosMedia: undefined });
  }
  return result;
}

function sanitizeStoredIOSReply(value: unknown) {
  if (!value || typeof value !== 'object') return undefined;
  const messageId = sanitizeString((value as Record<string, unknown>).messageId, 100).trim();
  return messageId ? { messageId } : undefined;
}

function sanitizeStoredIOSLink(value: unknown) {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Record<string, unknown>;
  const url = sanitizeStoredHttpsUrl(raw.url);
  const title = sanitizeString(raw.title, 200);
  if (!url && !title) return undefined;
  const image = sanitizeStoredAttachments(raw.image ? [raw.image] : undefined)?.[0];
  return {
    url, title,
    ...(typeof raw.siteName === 'string' ? { siteName: sanitizeString(raw.siteName, 100) } : {}),
    ...(typeof raw.description === 'string' ? { description: sanitizeString(raw.description, 500) } : {}),
    ...(image ? { image } : {}),
  };
}

/**
 * Recovery never guesses what a media block was meant to be.
 *
 * A missing or unrecognised `kind`/`source` discriminator drops the whole block
 * rather than inventing one (§10). Guessing "this URL looks like YouTube"
 * produces a card the author never authored; dropping it produces an empty
 * message, which preflight then reports in plain words.
 */
function sanitizeStoredIOSMedia(value: unknown) {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Record<string, unknown>;
  const storedUrl = sanitizeStoredHttpsUrl(raw.url);
  const url = storedUrl === LEGACY_W3_AUDIO_SAMPLE ? CORS_AUDIO_SAMPLE : storedUrl;
  // An audio card without an address is a real state, not a broken one: the
  // editor creates it, the generator draws a waveform for it. Dropping the whole
  // media object here is how a voice note silently vanished on reload.
  if (!url && raw.kind !== 'audio') return undefined;
  const title = typeof raw.title === 'string' ? { title: sanitizeString(raw.title, 200) } : {};
  if (raw.kind === 'audio' && IOS_AUDIO_MIME_TYPES.includes(String(raw.mimeType) as 'audio/mpeg')) {
    const mimeType = storedUrl === LEGACY_W3_AUDIO_SAMPLE ? 'audio/mpeg' : raw.mimeType as 'audio/mpeg';
    return { kind: 'audio' as const, url, mimeType, ...(typeof raw.duration === 'string' ? { duration: sanitizeString(raw.duration, 30) } : {}), ...(typeof raw.transcript === 'string' ? { transcript: sanitizeString(raw.transcript, 10_000) } : {}) };
  }
  const poster = sanitizeStoredHttpsUrl(raw.posterUrl);
  const videoCommon = raw.kind === 'video'
    ? { ...(poster ? { posterUrl: poster } : {}), ...title, ...(typeof raw.duration === 'string' ? { duration: sanitizeString(raw.duration, 30) } : {}), ...(typeof raw.description === 'string' ? { description: sanitizeString(raw.description, 2_000) } : {}) }
    : {};
  if (raw.kind === 'video' && raw.source === 'youtube' && normalizeYouTubeUrl(url)) {
    return { kind: 'video' as const, source: 'youtube' as const, url, ...videoCommon };
  }
  if (raw.kind === 'video' && raw.source === 'direct' && IOS_VIDEO_MIME_TYPES.includes(String(raw.mimeType) as 'video/mp4')) {
    const captionTrackUrl = sanitizeStoredHttpsUrl(raw.captionTrackUrl);
    return { kind: 'video' as const, source: 'direct' as const, url, mimeType: raw.mimeType as 'video/mp4', ...videoCommon, ...(captionTrackUrl ? { captionTrackUrl } : {}), ...(typeof raw.captionLanguage === 'string' ? { captionLanguage: sanitizeString(raw.captionLanguage, 40) } : {}), ...(typeof raw.captionLabel === 'string' ? { captionLabel: sanitizeString(raw.captionLabel, 100) } : {}) };
  }
  return undefined;
}

function sanitizeStoredIOSEvent(value: unknown) {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Record<string, unknown>;
  if (raw.kind !== 'date' && raw.kind !== 'system') return undefined;
  return { kind: raw.kind, text: sanitizeString(raw.text, 300) };
}

function sanitizeStoredWhatsAppReply(value: unknown) {
  if (!value || typeof value !== 'object') return undefined;
  const messageId = sanitizeString((value as Record<string, unknown>).messageId, 100).trim();
  return messageId ? { messageId } : undefined;
}

function sanitizeStoredWhatsAppLink(value: unknown) {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Record<string, unknown>;
  const url = sanitizeStoredHttpsUrl(raw.url);
  const title = sanitizeString(raw.title, 200);
  if (!url && !title) return undefined;
  const image = sanitizeStoredAttachments(raw.image ? [raw.image] : undefined)?.[0];
  return {
    url, title,
    ...(typeof raw.siteName === 'string' ? { siteName: sanitizeString(raw.siteName, 100) } : {}),
    ...(typeof raw.description === 'string' ? { description: sanitizeString(raw.description, 500) } : {}),
    ...(image ? { image } : {}),
  };
}

function sanitizeStoredWhatsAppMedia(value: unknown) {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Record<string, unknown>;
  const storedUrl = sanitizeStoredHttpsUrl(raw.url);
  const url = storedUrl === LEGACY_W3_AUDIO_SAMPLE ? CORS_AUDIO_SAMPLE : storedUrl;
  // An audio card without an address is a real state, not a broken one: the
  // editor creates it, the generator draws a waveform for it. Dropping the whole
  // media object here is how a voice note silently vanished on reload.
  if (!url && raw.kind !== 'audio') return undefined;
  if (raw.kind === 'audio' && ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/mp4'].includes(String(raw.mimeType))) {
    const mimeType = storedUrl === LEGACY_W3_AUDIO_SAMPLE ? 'audio/mpeg' : raw.mimeType as 'audio/mpeg';
    return { kind: 'audio' as const, url, mimeType, ...(typeof raw.duration === 'string' ? { duration: sanitizeString(raw.duration, 30) } : {}), ...(typeof raw.transcript === 'string' ? { transcript: sanitizeString(raw.transcript, 10_000) } : {}) };
  }
  const videoCommon = raw.kind === 'video' ? { ...(sanitizeStoredHttpsUrl(raw.posterUrl) ? { posterUrl: sanitizeStoredHttpsUrl(raw.posterUrl) } : {}), ...(typeof raw.duration === 'string' ? { duration: sanitizeString(raw.duration, 30) } : {}), ...(typeof raw.description === 'string' ? { description: sanitizeString(raw.description, 2_000) } : {}) } : {};
  if (raw.kind === 'video' && raw.source === 'youtube' && normalizeYouTubeUrl(url)) {
    return { kind: 'video' as const, source: 'youtube' as const, url, ...videoCommon };
  }
  if (raw.kind === 'video' && raw.source === 'direct' && ['video/mp4', 'video/webm', 'video/ogg'].includes(String(raw.mimeType))) {
    return { kind: 'video' as const, source: 'direct' as const, url, mimeType: raw.mimeType as 'video/mp4', ...videoCommon, ...(sanitizeStoredHttpsUrl(raw.captionTrackUrl) ? { captionTrackUrl: sanitizeStoredHttpsUrl(raw.captionTrackUrl) } : {}), ...(typeof raw.captionLanguage === 'string' ? { captionLanguage: sanitizeString(raw.captionLanguage, 40) } : {}), ...(typeof raw.captionLabel === 'string' ? { captionLabel: sanitizeString(raw.captionLabel, 100) } : {}) };
  }
  return undefined;
}

function sanitizeStoredWhatsAppEvent(value: unknown) {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Record<string, unknown>;
  if (raw.kind !== 'date' && raw.kind !== 'system') return undefined;
  return { kind: raw.kind, text: sanitizeString(raw.text, 300) };
}

function sanitizeStoredParticipants(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  return value.slice(0, 50).flatMap(candidate => {
    if (!candidate || typeof candidate !== 'object') return [];
    const raw = candidate as Record<string, unknown>;
    const id = sanitizeString(raw.id, 100);
    const name = sanitizeString(raw.name, 200);
    if (!id || !name) return [];
    const tone = typeof raw.whatsappTone === 'string' && WHATSAPP_TONE_IDS.has(raw.whatsappTone as WhatsAppParticipantTone) ? raw.whatsappTone as WhatsAppParticipantTone : undefined;
    const iosTone = typeof raw.iosTone === 'string' && IOS_TONE_IDS.has(raw.iosTone as IOSParticipantTone) ? raw.iosTone as IOSParticipantTone : undefined;
    return [{ ...raw, id, name, color: /^#[0-9a-f]{6}$/i.test(String(raw.color)) ? String(raw.color) : '#777777', ...(tone ? { whatsappTone: tone } : {}), ...(iosTone ? { iosTone } : {}) }];
  });
}

function sanitizeStoredAttachments(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  return value.slice(0, 4).flatMap(candidate => {
    if (!candidate || typeof candidate !== 'object') return [];
    const raw = candidate as Record<string, unknown>;
    const url = sanitizeStoredUrl(raw.url);
    if (!url) return [];
    return [{
      type: 'image' as const,
      url,
      ...(typeof raw.alt === 'string' ? { alt: sanitizeString(raw.alt, 500) } : {}),
      ...(typeof raw.decorative === 'boolean' ? { decorative: raw.decorative } : {}),
    }];
  });
}

function sanitizeStoredQuote(value: unknown) {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Record<string, unknown>;
  return {
    ...(typeof raw.characterId === 'string' ? { characterId: sanitizeString(raw.characterId, 100) } : {}),
    ...(typeof raw.name === 'string' ? { name: sanitizeString(raw.name, 200) } : {}),
    ...(typeof raw.handle === 'string' ? { handle: sanitizeString(raw.handle, 100).replace(/^@+/, '') } : {}),
    ...(sanitizeStoredUrl(raw.avatarUrl) ? { avatarUrl: sanitizeStoredUrl(raw.avatarUrl) } : {}),
    ...(typeof raw.verified === 'boolean' ? { verified: raw.verified } : {}),
    text: sanitizeString(raw.text, 2_000),
    ...(typeof raw.timestamp === 'string' ? { timestamp: sanitizeString(raw.timestamp, 200) } : {}),
    ...(sanitizeStoredAttachments(raw.attachments) ? { attachments: sanitizeStoredAttachments(raw.attachments) } : {}),
  };
}

function sanitizeStoredVideo(value: unknown) {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Record<string, unknown>;
  if (raw.source !== 'youtube' && raw.source !== 'direct') return undefined;
  return {
    source: raw.source,
    url: sanitizeStoredUrl(raw.url),
    title: sanitizeString(raw.title, 200),
    ...(sanitizeStoredUrl(raw.posterUrl) ? { posterUrl: sanitizeStoredUrl(raw.posterUrl) } : {}),
    ...(typeof raw.duration === 'string' ? { duration: sanitizeString(raw.duration, 30) } : {}),
    ...(typeof raw.description === 'string' ? { description: sanitizeString(raw.description, 2_000) } : {}),
    ...(typeof raw.mimeType === 'string' ? { mimeType: sanitizeString(raw.mimeType, 100) } : {}),
    ...(sanitizeStoredUrl(raw.captionTrackUrl) ? { captionTrackUrl: sanitizeStoredUrl(raw.captionTrackUrl) } : {}),
    ...(typeof raw.captionLanguage === 'string' ? { captionLanguage: sanitizeString(raw.captionLanguage, 40) } : {}),
    ...(typeof raw.captionLabel === 'string' ? { captionLabel: sanitizeString(raw.captionLabel, 100) } : {}),
  };
}

function sanitizeStoredPoll(value: unknown) {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Record<string, unknown>;
  if ((raw.state !== 'open' && raw.state !== 'closed') || !Array.isArray(raw.options)) return undefined;
  const options = raw.options.slice(0, 4).flatMap(candidate => {
    if (!candidate || typeof candidate !== 'object') return [];
    const option = candidate as Record<string, unknown>;
    const optionId = sanitizeString(option.id, 100);
    if (!optionId) return [];
    return [{
      id: optionId,
      text: sanitizeString(option.text, 200),
      ...(typeof option.percent === 'number' && Number.isFinite(option.percent) ? { percent: Math.max(0, Math.min(100, option.percent)) } : {}),
      ...(typeof option.votes === 'number' && Number.isFinite(option.votes) ? { votes: Math.max(0, Math.floor(option.votes)) } : {}),
    }];
  });
  if (options.length < 2) return undefined;
  return {
    state: raw.state,
    options,
    ...(typeof raw.totalVotes === 'number' ? { totalVotes: Math.max(0, Math.floor(raw.totalVotes)) } : {}),
    ...(typeof raw.timeRemaining === 'string' ? { timeRemaining: sanitizeString(raw.timeRemaining, 100) } : {}),
    ...(typeof raw.finalLabel === 'string' ? { finalLabel: sanitizeString(raw.finalLabel, 100) } : {}),
    ...(typeof raw.selectedOptionId === 'string' ? { selectedOptionId: sanitizeString(raw.selectedOptionId, 100) } : {}),
  };
}

function sanitizeStoredTranslation(value: unknown) {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Record<string, unknown>;
  if (raw.visibleText !== 'original' && raw.visibleText !== 'translated') return undefined;
  return {
    ...(typeof raw.languageLabel === 'string' ? { languageLabel: sanitizeString(raw.languageLabel, 100) } : {}),
    originalText: sanitizeString(raw.originalText, MAX_CONTENT_LENGTH),
    translatedText: sanitizeString(raw.translatedText, MAX_CONTENT_LENGTH),
    visibleText: raw.visibleText,
  };
}

function sanitizeStoredActivity(value: unknown) {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Record<string, unknown>;
  if ((raw.type !== 'liked' && raw.type !== 'reposted') || !Array.isArray(raw.actorCharacterIds)) return undefined;
  return {
    type: raw.type,
    actorCharacterIds: raw.actorCharacterIds.slice(0, 20).flatMap(entry => typeof entry === 'string' ? [sanitizeString(entry, 100)] : []),
    ...(typeof raw.additionalCount === 'number' ? { additionalCount: Math.max(0, Math.min(9999, Math.floor(raw.additionalCount))) } : {}),
  };
}

function sanitizeStoredCast(value: unknown): SkinProject['cast'] {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Record<string, unknown>;
  if (!Array.isArray(raw.characters)) return undefined;
  const characters = raw.characters.slice(0, 100).flatMap(candidate => {
    if (!candidate || typeof candidate !== 'object') return [];
    const character = candidate as Record<string, unknown>;
    const id = sanitizeString(character.id, 100).trim();
    const name = sanitizeString(character.name, 200).trim();
    if (!id || !name) return [];
    const avatarUrl = sanitizeStoredUrl(character.avatarUrl);
    const twitterHandle = sanitizeString(character.twitterHandle, 100).trim().replace(/^@+/, '');
    return [{
      id,
      name,
      ...(avatarUrl ? { avatarUrl } : {}),
      ...(twitterHandle ? { twitterHandle } : {}),
      ...(typeof character.verified === 'boolean' ? { verified: character.verified } : {}),
      ...(typeof character.sourceLibraryId === 'string' ? { sourceLibraryId: sanitizeString(character.sourceLibraryId, 100) } : {}),
      ...(typeof character.archived === 'boolean' ? { archived: character.archived } : {}),
    }];
  });
  const ids = new Set(characters.map(character => character.id));
  const binding = (key: 'selfId' | 'contactId' | 'twitterPrimaryId') => {
    const value = sanitizeString(raw[key], 100);
    return value && ids.has(value) ? value : undefined;
  };
  return {
    characters,
    ...(binding('selfId') ? { selfId: binding('selfId') } : {}),
    ...(binding('contactId') ? { contactId: binding('contactId') } : {}),
    ...(binding('twitterPrimaryId') ? { twitterPrimaryId: binding('twitterPrimaryId') } : {}),
  };
}

/**
 * Whether a project was actually saved by a previous session.
 * Distinct from loadStoredProject(), which falls back to the seeded default —
 * callers can't tell a returning visitor from a first-time one by its result.
 */
export function hasStoredProject(): boolean {
  if (typeof window === 'undefined') return false;
  try { return !!localStorage.getItem(KEY); } catch { return false; }
}

export function loadStoredProject<T extends SkinProject>(fallback: () => T): T {
  if (typeof window === 'undefined') return fallback();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fallback();
    
    // Size limit check to prevent DoS
    if (raw.length > MAX_STORAGE_SIZE) {
      console.warn('Stored project exceeds size limit, using fallback');
      return fallback();
    }
    
    const parsed = JSON.parse(raw);
    
    // Basic shape validation
    if (!parsed || typeof parsed !== 'object') return fallback();
    if (!parsed.settings || typeof parsed.settings !== 'object') return fallback();
    if (!Array.isArray(parsed.messages)) return fallback();
    
    // Sanitize messages with limit
    const sanitizedMessages = parsed.messages
      .slice(0, MAX_MESSAGES)
      .map(sanitizeMessage)
      .filter((m): m is NonNullable<typeof m> => m !== null);
    const seenMessageIds = new Set<string>();
    const recoveredMessages = sanitizedMessages.flatMap(message => {
      if (seenMessageIds.has(message.id)) return [];
      const reply = message.whatsappReply as { messageId?: unknown } | undefined;
      if (reply && (typeof reply.messageId !== 'string' || !seenMessageIds.has(reply.messageId))) {
        message.whatsappReply = undefined;
      }
      // A reply may only point *backwards*, so "already seen" is the whole test.
      // A pointer at a message that was dropped, deduplicated, or comes later is
      // dangling, and a dangling reply renders as "Original message unavailable"
      // and blocks export — worse than no reply at all.
      const iosReply = message.iosReply as { messageId?: unknown } | undefined;
      if (iosReply && (typeof iosReply.messageId !== 'string' || !seenMessageIds.has(iosReply.messageId))) {
        message.iosReply = undefined;
      }
      seenMessageIds.add(message.id);
      return [message];
    });
    
    // Merge with defaults to ensure new fields are present (like header/footer URLs)
    const defaults = fallback();
    
    // Sanitize URL fields in settings
    const importedSettings = { ...parsed.settings };
    // Read old persisted projects without carrying the retired duplicate
    // character-library field into the live settings object.
    delete importedSettings.universalCharacters;
    const sanitizedSettings = {
      ...defaults.settings,
      ...importedSettings,
      // Ensure header/footer image URLs exist and are sanitized, fixing old broken URLs
      iosHeaderImageUrl: sanitizeStoredUrl(parsed.settings.iosHeaderImageUrl) || defaults.settings.iosHeaderImageUrl,
      iosFooterImageUrl: sanitizeStoredUrl(parsed.settings.iosFooterImageUrl) || defaults.settings.iosFooterImageUrl,
      androidHeaderImageUrl: sanitizeStoredUrl(parsed.settings.androidHeaderImageUrl),
      androidFooterImageUrl: sanitizeStoredUrl(parsed.settings.androidFooterImageUrl),
      iosAvatarUrl: sanitizeStoredUrl(parsed.settings.iosAvatarUrl),
      androidAvatarUrl: sanitizeStoredUrl(parsed.settings.androidAvatarUrl),
      twitterAvatarUrl: sanitizeStoredUrl(parsed.settings.twitterAvatarUrl),
      twitterQuoteAvatar: sanitizeStoredUrl(parsed.settings.twitterQuoteAvatar),
      twitterQuoteImage: sanitizeStoredUrl(parsed.settings.twitterQuoteImage),
      twitterSceneMode: parsed.settings.twitterSceneMode === 'single'
        || parsed.settings.twitterSceneMode === 'timeline'
        || parsed.settings.twitterSceneMode === 'thread'
        ? parsed.settings.twitterSceneMode
        : undefined,
      twitterTheme: parsed.settings.twitterTheme === 'light'
        || parsed.settings.twitterTheme === 'dim'
        || parsed.settings.twitterTheme === 'dark'
        ? parsed.settings.twitterTheme
        : undefined,
      androidFrameMode: ['bubbles', 'header', 'phone'].includes(parsed.settings.androidFrameMode) ? parsed.settings.androidFrameMode : defaults.settings.androidFrameMode,
      androidGroupSubtitleMode: ['members', 'count', 'custom', 'hidden'].includes(parsed.settings.androidGroupSubtitleMode) ? parsed.settings.androidGroupSubtitleMode : defaults.settings.androidGroupSubtitleMode,
      androidGroupSubtitleText: sanitizeString(parsed.settings.androidGroupSubtitleText, 200),
      androidWallpaperUrl: sanitizeStoredUrl(parsed.settings.androidWallpaperUrl),
      androidScrollable: parsed.settings.androidScrollable === true,
      androidViewportHeightEm: typeof parsed.settings.androidViewportHeightEm === 'number' ? Math.max(20, Math.min(60, Math.round(parsed.settings.androidViewportHeightEm))) : 30,
      iosFrameMode: ['bubbles', 'header', 'phone'].includes(parsed.settings.iosFrameMode) ? parsed.settings.iosFrameMode : defaults.settings.iosFrameMode,
      iosScrollable: parsed.settings.iosScrollable === true,
      iosViewportHeightEm: typeof parsed.settings.iosViewportHeightEm === 'number' ? Math.max(20, Math.min(60, Math.round(parsed.settings.iosViewportHeightEm))) : 34,
      iosGroupParticipants: sanitizeStoredParticipants(parsed.settings.iosGroupParticipants),
      androidGroupParticipants: sanitizeStoredParticipants(parsed.settings.androidGroupParticipants),
    };
    
    const sanitizedProject = {
      ...parsed,
      id:
        typeof parsed.id === 'string' && parsed.id && parsed.id !== 'default-project'
          ? sanitizeString(parsed.id, 100)
          : defaults.id,
      settings: sanitizedSettings,
      messages: recoveredMessages,
      cast: sanitizeStoredCast(parsed.cast),
    } as T;
    return migrateTwitterProject(migrateProjectIdentities(sanitizedProject)) as T;
  } catch (e) { 
    console.warn('Failed to load stored project:', e);
    return fallback(); 
  }
}

export interface PersistResult {
  ok: boolean;
  /** Present only when ok is false. Safe to show to the user as-is. */
  message?: string;
  reason?: 'too-large' | 'unavailable';
}

/**
 * Save the project to localStorage.
 *
 * Returns a result rather than failing quietly: a refused save means the work
 * is gone on the next reload, and a console warning nobody reads is not a way
 * to tell someone that.
 */
export function persistProject(project: SkinProject): PersistResult {
  let json: string;
  try {
    json = JSON.stringify(project);
  } catch {
    return { ok: false, reason: 'unavailable', message: "This project can't be saved." };
  }

  if (json.length > MAX_STORAGE_SIZE) {
    return {
      ok: false,
      reason: 'too-large',
      message:
        'This project is too large to save automatically. Export it now — shortening long messages or removing a few images will let saving resume.',
    };
  }

  try {
    localStorage.setItem(KEY, json);
    return { ok: true };
  } catch {
    // Quota exceeded, or storage blocked (private browsing, cookies off).
    return {
      ok: false,
      reason: 'unavailable',
      message:
        "Your browser wouldn't let this be saved, so it won't be here when you come back. Export before you close the tab.",
    };
  }
}
