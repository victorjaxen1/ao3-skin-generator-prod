import { defaultProject, GroupParticipant, IOSLinkPreview, IOSMedia, IOSParticipantTone, IOSTapback, Message, SceneCast, SceneCharacter, SkinProject, SkinSettings, TwitterActivity, TwitterCharacter, TwitterPoll, TwitterQuotePost, TwitterTranslation, TwitterVideo, UniversalCharacter, WhatsAppLinkPreview, WhatsAppMedia, WhatsAppParticipantTone, WhatsAppReaction } from './schema';
import { validateCharacterLibrary } from './characterStorage';
import { migrateProjectIdentities, normalizeTwitterHandle } from './identity';
import {
  BANNER_HEIGHTS,
  CARD_RADII,
  FONT_SCALES,
  FONT_STACKS,
  HEADER_TEXT_COLORS,
  MOODS,
  SiteSkinTheme,
  TAG_STYLES,
  validateTheme,
} from './siteSkin/theme';
import { checkAo3ImageUrl } from './siteSkin/ao3Css';
import { DEFAULT_TEMPLATE, cloneTheme } from './siteSkin/templates';
import { getTwitterPollError, migrateTwitterProject, validateTwitterRelationships, validateTwitterVideo } from './twitter';
import { normalizeWhatsAppReactions, validateWhatsAppMedia, validateWhatsAppMessage, WHATSAPP_TONE_IDS } from './whatsapp';
import { IOS_AUDIO_MIME_TYPES, IOS_TONE_IDS, IOS_VIDEO_MIME_TYPES, normalizeIOSTapbacks, validateIOSMedia, validateIOSMessage } from './ios';

export const PROJECT_FILE_SCHEMA_VERSION = 7;
export const PROJECT_FILE_MAX_BYTES = 2 * 1024 * 1024;
export const APPLICATION_VERSION = '0.1.0';

type ImportCode = 'PROJECT_IMPORT_INVALID' | 'PROJECT_SCHEMA_UNSUPPORTED' | 'PROJECT_IMPORT_TOO_LARGE';

export class ProjectFileError extends Error {
  constructor(public code: ImportCode, message: string) {
    super(message);
    this.name = 'ProjectFileError';
  }
}

export interface SceneProjectFileV1 {
  format: 'ao3skingen-project';
  schemaVersion: 1;
  exportedAt: string;
  application: { name: 'AO3 SkinGen'; version: string };
  project: SkinProject;
  characterLibrary: UniversalCharacter[];
}

export interface SceneProjectFileV2 {
  format: 'ao3skingen-project';
  schemaVersion: 2;
  exportedAt: string;
  application: { name: 'AO3 SkinGen'; version: string };
  project: SkinProject;
  characterLibrary: UniversalCharacter[];
}

export interface SceneProjectFileV3 {
  format: 'ao3skingen-project';
  schemaVersion: 3;
  exportedAt: string;
  application: { name: 'AO3 SkinGen'; version: string };
  project: SkinProject;
  characterLibrary: UniversalCharacter[];
}

export interface SceneProjectFileV4 {
  format: 'ao3skingen-project';
  schemaVersion: 4;
  exportedAt: string;
  application: { name: 'AO3 SkinGen'; version: string };
  project: SkinProject;
  characterLibrary: UniversalCharacter[];
}

export interface SceneProjectFileV5 {
  format: 'ao3skingen-project';
  schemaVersion: 5;
  exportedAt: string;
  application: { name: 'AO3 SkinGen'; version: string };
  project: SkinProject;
  characterLibrary: UniversalCharacter[];
}

export interface SceneProjectFileV6 {
  format: 'ao3skingen-project';
  schemaVersion: 6;
  exportedAt: string;
  application: { name: 'AO3 SkinGen'; version: string };
  project: SkinProject;
  characterLibrary: UniversalCharacter[];
}

export interface SceneProjectFileV7 {
  format: 'ao3skingen-project';
  schemaVersion: 7;
  exportedAt: string;
  application: { name: 'AO3 SkinGen'; version: string };
  project: SkinProject;
  characterLibrary: UniversalCharacter[];
}

export type SceneProjectFile = SceneProjectFileV7;

export interface SiteThemeFileV1 {
  format: 'ao3skingen-site-theme';
  schemaVersion: 1;
  exportedAt: string;
  application: { name: 'AO3 SkinGen'; version: string };
  theme: SiteSkinTheme;
}

export interface ProjectFileSummary {
  template: SkinProject['template'];
  itemCount: number;
  itemLabel: 'messages' | 'results';
  characterCount: number;
  exportedAt: string;
  hasRemoteImages: boolean;
}

const TEMPLATE_IDS = new Set<SkinProject['template']>(['ios', 'android', 'twitter', 'google']);
const HEX = /^#[0-9a-fA-F]{6}$/;
const STATUS = new Set(['sending', 'sent', 'delivered', 'read']);
const SCENE_FONTS = new Set([
  'Arial, Helvetica, sans-serif',
  '-apple-system, BlinkMacSystemFont, sans-serif',
]);
const TOP_SCENE_KEYS = new Set(['format', 'schemaVersion', 'exportedAt', 'application', 'project', 'characterLibrary']);
const TOP_THEME_KEYS = new Set(['format', 'schemaVersion', 'exportedAt', 'application', 'theme']);

const STRING_SETTING_KEYS = new Set<keyof SkinSettings>([
  'senderColor', 'receiverColor', 'fontFamily', 'fictionLabelText', 'twitterDisplayName',
  'twitterHandle', 'twitterAvatarUrl', 'twitterTimestamp', 'twitterQuoteAvatar', 'twitterQuoteName',
  'twitterQuoteHandle', 'twitterQuoteText', 'twitterQuoteImage', 'googleQuery',
  'googleResultsCount', 'googleResultsTime', 'googleDidYouMean', 'chatYourName',
  'chatContactName', 'chatTypingName', 'iosContactName', 'iosGroupName',
  'iosStatusBarTime', 'iosInputPlaceholder', 'iosHeaderImageUrl', 'iosFooterImageUrl',
  'iosAvatarUrl', 'androidStatusText', 'androidHeaderImageUrl', 'androidFooterImageUrl',
  'androidAvatarUrl', 'androidContactName', 'androidGroupName',
  'androidGroupSubtitleText', 'androidWallpaperUrl',
]);
const URL_SETTING_KEYS = new Set<keyof SkinSettings>([
  'twitterAvatarUrl', 'twitterQuoteAvatar', 'twitterQuoteImage', 'iosHeaderImageUrl',
  'iosFooterImageUrl', 'iosAvatarUrl', 'androidHeaderImageUrl', 'androidFooterImageUrl',
  'androidAvatarUrl',
  'androidWallpaperUrl',
]);
const BOOLEAN_SETTING_KEYS = new Set<keyof SkinSettings>([
  'useDarkNeutral', 'fictionLabel', 'toolAttribution', 'watermark', 'twitterVerified',
  'twitterShowMetrics', 'twitterDarkMode', 'twitterThreadMode', 'twitterQuoteEnabled',
  'twitterQuoteVerified', 'googleShowStats', 'googleShowDidYouMean', 'chatShowTyping',
  'iosDarkMode', 'iosShowReadReceipt', 'iosAutoAlternate', 'iosGroupMode',
  'iosShowStatusBar', 'iosShowInputBar', 'androidShowStatus', 'androidCheckmarks',
  'androidDarkMode', 'androidAutoAlternate', 'androidGroupMode',
  'androidScrollable', 'iosScrollable',
]);
const NUMBER_SETTING_KEYS = new Set<keyof SkinSettings>([
  'bubbleOpacity', 'maxWidthPx', 'twitterLikes', 'twitterRetweets', 'twitterReplies',
  'androidViewportHeightEm', 'iosViewportHeightEm',
]);

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

function invalid(message: string): never {
  throw new ProjectFileError('PROJECT_IMPORT_INVALID', message);
}

function string(value: unknown, label: string, max: number, required = false): string {
  if (typeof value !== 'string') {
    if (required) invalid(`${label} must be text.`);
    return '';
  }
  const result = value.trim().slice(0, max);
  if (required && !result) invalid(`${label} cannot be empty.`);
  return result;
}

function id(value: unknown, label: string): string {
  const result = string(value, label, 100, true);
  if (!/^[a-z0-9._:-]+$/i.test(result)) invalid(`${label} contains unsupported characters.`);
  return result;
}

function boolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function finite(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback;
}

function safeUrl(value: unknown, label: string): string {
  const raw = string(value, label, 2048);
  if (!raw) return '';
  if (/^data:image\/(?:png|jpeg|webp|gif);base64,/i.test(raw)) return raw;
  if (raw.startsWith('/assets/')) return raw;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return raw;
  } catch { /* handled below */ }
  invalid(`${label} contains an unsupported image address.`);
}

function validateAttachment(value: unknown, index: number) {
  const raw = object(value, `Attachment ${index + 1}`);
  if (raw.type !== 'image') invalid(`Attachment ${index + 1} has an unsupported type.`);
  return {
    type: 'image' as const,
    url: safeUrl(raw.url, `Attachment ${index + 1} URL`),
    ...(typeof raw.alt === 'string' ? { alt: raw.alt.slice(0, 500) } : {}),
    ...(typeof raw.decorative === 'boolean' ? { decorative: raw.decorative } : {}),
  };
}

function httpsUrl(value: unknown, label: string, required = false): string {
  const raw = string(value, label, 2048, required);
  if (!raw) return '';
  if (/[<>]/.test(raw)) invalid(`${label} cannot contain embed markup.`);
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === 'https:') return raw;
  } catch { /* handled below */ }
  invalid(`${label} must be an absolute HTTPS address.`);
}

/**
 * A YouTube poster is an optional override, never the source of the player.
 * Discard an unfinished override so project backups and automatic thumbnails
 * keep working while the author edits that field.
 */
function optionalYouTubePoster(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || /[<>]/.test(value)) return '';
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'https:' ? value.trim().slice(0, 2048) : '';
  } catch {
    return '';
  }
}

function validateTwitterQuote(value: unknown, label: string): TwitterQuotePost {
  const raw = object(value, label);
  const attachments = raw.attachments === undefined
    ? undefined
    : Array.isArray(raw.attachments)
      ? raw.attachments.slice(0, 4).map(validateAttachment)
      : invalid(`${label} attachments must be a list.`);
  return {
    ...(typeof raw.characterId === 'string' ? { characterId: id(raw.characterId, `${label} character ID`) } : {}),
    ...(typeof raw.name === 'string' ? { name: string(raw.name, `${label} name`, 200) } : {}),
    ...(typeof raw.handle === 'string' ? { handle: normalizeTwitterHandle(string(raw.handle, `${label} handle`, 100)) } : {}),
    ...(typeof raw.avatarUrl === 'string' && raw.avatarUrl ? { avatarUrl: safeUrl(raw.avatarUrl, `${label} avatar`) } : {}),
    ...(typeof raw.verified === 'boolean' ? { verified: raw.verified } : {}),
    text: string(raw.text, `${label} text`, 2_000),
    ...(typeof raw.timestamp === 'string' ? { timestamp: string(raw.timestamp, `${label} timestamp`, 200) } : {}),
    ...(attachments ? { attachments } : {}),
  };
}

function validateTwitterVideoModel(value: unknown, label: string): TwitterVideo {
  const raw = object(value, label);
  if (raw.source !== 'youtube' && raw.source !== 'direct') invalid(`${label} source must be youtube or direct.`);
  const posterUrl = raw.source === 'youtube'
    ? optionalYouTubePoster(raw.posterUrl)
    : typeof raw.posterUrl === 'string' && raw.posterUrl
      ? httpsUrl(raw.posterUrl, `${label} poster`)
      : '';
  const result: TwitterVideo = {
    source: raw.source,
    url: httpsUrl(raw.url, `${label} URL`, true),
    title: string(raw.title, `${label} title`, 200),
    ...(posterUrl ? { posterUrl } : {}),
    ...(typeof raw.duration === 'string' ? { duration: string(raw.duration, `${label} duration`, 30) } : {}),
    ...(typeof raw.description === 'string' ? { description: string(raw.description, `${label} description`, 2_000) } : {}),
    ...(typeof raw.mimeType === 'string' ? { mimeType: string(raw.mimeType, `${label} MIME type`, 100) } : {}),
    ...(typeof raw.captionTrackUrl === 'string' && raw.captionTrackUrl ? { captionTrackUrl: httpsUrl(raw.captionTrackUrl, `${label} caption track`) } : {}),
    ...(typeof raw.captionLanguage === 'string' ? { captionLanguage: string(raw.captionLanguage, `${label} caption language`, 40) } : {}),
    ...(typeof raw.captionLabel === 'string' ? { captionLabel: string(raw.captionLabel, `${label} caption label`, 100) } : {}),
  };
  const issue = validateTwitterVideo(result)[0];
  if (issue) invalid(`${label}: ${issue}`);
  return result;
}

function validateTwitterPollModel(value: unknown, label: string): TwitterPoll {
  const raw = object(value, label);
  if (raw.state !== 'open' && raw.state !== 'closed') invalid(`${label} state is invalid.`);
  if (!Array.isArray(raw.options) || raw.options.length < 2 || raw.options.length > 4) invalid(`${label} needs two to four options.`);
  const options = raw.options.map((entry, index) => {
    const option = object(entry, `${label} option ${index + 1}`);
    return {
      id: id(option.id, `${label} option ${index + 1} ID`),
      text: string(option.text, `${label} option ${index + 1} text`, 200, true),
      ...(typeof option.percent === 'number' && Number.isFinite(option.percent) ? { percent: finite(option.percent, 0, 0, 100) } : {}),
      ...(typeof option.votes === 'number' && Number.isFinite(option.votes) ? { votes: Math.floor(finite(option.votes, 0, 0, 1_000_000_000)) } : {}),
    };
  });
  if (new Set(options.map(option => option.id)).size !== options.length) invalid(`${label} option IDs must be unique.`);
  const result: TwitterPoll = {
    state: raw.state,
    options,
    ...(typeof raw.totalVotes === 'number' ? { totalVotes: Math.floor(finite(raw.totalVotes, 0, 0, 1_000_000_000)) } : {}),
    ...(typeof raw.timeRemaining === 'string' ? { timeRemaining: string(raw.timeRemaining, `${label} time remaining`, 100) } : {}),
    ...(typeof raw.finalLabel === 'string' ? { finalLabel: string(raw.finalLabel, `${label} final label`, 100) } : {}),
    ...(typeof raw.selectedOptionId === 'string' ? { selectedOptionId: id(raw.selectedOptionId, `${label} selected option`) } : {}),
  };
  if (result.selectedOptionId && !options.some(option => option.id === result.selectedOptionId)) invalid(`${label} selected option does not exist.`);
  const issue = getTwitterPollError(result);
  if (issue) invalid(`${label}: ${issue}`);
  return result;
}

function validateTwitterTranslationModel(value: unknown, label: string): TwitterTranslation {
  const raw = object(value, label);
  if (raw.visibleText !== 'original' && raw.visibleText !== 'translated') invalid(`${label} visible state is invalid.`);
  return {
    ...(typeof raw.languageLabel === 'string' ? { languageLabel: string(raw.languageLabel, `${label} language`, 100) } : {}),
    originalText: string(raw.originalText, `${label} original text`, 10_000, true),
    translatedText: string(raw.translatedText, `${label} translated text`, 10_000, true),
    visibleText: raw.visibleText,
  };
}

function validateTwitterActivityModel(value: unknown, label: string): TwitterActivity {
  const raw = object(value, label);
  if (raw.type !== 'liked' && raw.type !== 'reposted') invalid(`${label} type is invalid.`);
  if (!Array.isArray(raw.actorCharacterIds)) invalid(`${label} actors must be a list.`);
  return {
    type: raw.type,
    actorCharacterIds: raw.actorCharacterIds.slice(0, 20).map((entry, index) => id(entry, `${label} actor ${index + 1}`)),
    ...(typeof raw.additionalCount === 'number' ? { additionalCount: Math.floor(finite(raw.additionalCount, 0, 0, 9999)) } : {}),
  };
}

function validateWhatsAppLinkModel(value: unknown, label: string): WhatsAppLinkPreview {
  const raw = object(value, label);
  const image = raw.image === undefined ? undefined : validateAttachment(raw.image, 0);
  return {
    url: httpsUrl(raw.url, `${label} URL`, true),
    title: string(raw.title, `${label} title`, 200, true),
    ...(typeof raw.siteName === 'string' ? { siteName: string(raw.siteName, `${label} site name`, 100) } : {}),
    ...(typeof raw.description === 'string' ? { description: string(raw.description, `${label} description`, 500) } : {}),
    ...(image ? { image } : {}),
  };
}

function validateWhatsAppMediaModel(value: unknown, label: string): WhatsAppMedia {
  const raw = object(value, label);
  const url = httpsUrl(raw.url, `${label} URL`, true);
  if (raw.kind === 'audio') {
    if (!['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/mp4'].includes(String(raw.mimeType))) invalid(`${label} audio type is unsupported.`);
    return { kind: 'audio', url, mimeType: raw.mimeType as Extract<WhatsAppMedia, { kind: 'audio' }>['mimeType'], ...(typeof raw.duration === 'string' ? { duration: string(raw.duration, `${label} duration`, 30) } : {}), ...(typeof raw.transcript === 'string' ? { transcript: string(raw.transcript, `${label} transcript`, 10_000) } : {}) };
  }
  if (raw.kind !== 'video' || (raw.source !== 'youtube' && raw.source !== 'direct')) invalid(`${label} video source must be youtube or direct.`);
  const posterUrl = raw.source === 'youtube'
    ? optionalYouTubePoster(raw.posterUrl)
    : typeof raw.posterUrl === 'string' && raw.posterUrl
      ? httpsUrl(raw.posterUrl, `${label} poster`)
      : '';
  const common = {
    ...(posterUrl ? { posterUrl } : {}),
    ...(typeof raw.duration === 'string' ? { duration: string(raw.duration, `${label} duration`, 30) } : {}),
    ...(typeof raw.description === 'string' ? { description: string(raw.description, `${label} description`, 2_000) } : {}),
  };
  if (raw.source === 'youtube') {
    const result: WhatsAppMedia = { kind: 'video', source: 'youtube', url, ...common };
    const issue = validateWhatsAppMedia(result)[0];
    if (issue) invalid(`${label}: ${issue}`);
    return result;
  }
  if (!['video/mp4', 'video/webm', 'video/ogg'].includes(String(raw.mimeType))) invalid(`${label} video type is unsupported.`);
  const captionTrackUrl = typeof raw.captionTrackUrl === 'string' && raw.captionTrackUrl ? httpsUrl(raw.captionTrackUrl, `${label} caption track`) : '';
  const captionLanguage = typeof raw.captionLanguage === 'string' ? string(raw.captionLanguage, `${label} caption language`, 40) : '';
  const captionLabel = typeof raw.captionLabel === 'string' ? string(raw.captionLabel, `${label} caption label`, 100) : '';
  if (!!captionTrackUrl !== !!captionLanguage || !!captionTrackUrl !== !!captionLabel) invalid(`${label} caption URL, language, and label must be provided together.`);
  return {
    kind: 'video', source: 'direct', url, mimeType: raw.mimeType as 'video/mp4' | 'video/webm' | 'video/ogg',
    ...common,
    ...(captionTrackUrl ? { captionTrackUrl, captionLanguage, captionLabel } : {}),
  };
}

function validateWhatsAppReactionsModel(value: unknown, label: string): WhatsAppReaction[] {
  if (!Array.isArray(value)) invalid(`${label} must be a list.`);
  if (value.length > 3) invalid(`${label} can contain at most three entries.`);
  const reactions = value.map((candidate, index) => {
    const raw = object(candidate, `${label} ${index + 1}`);
    const emoji = string(raw.emoji, `${label} ${index + 1} emoji`, 20, true);
    const count = raw.count === undefined ? undefined : finite(raw.count, 1, 1, 9999);
    if (count !== undefined && !Number.isInteger(raw.count)) invalid(`${label} ${index + 1} count must be an integer.`);
    return { emoji, ...(count && count > 1 ? { count } : {}) };
  });
  const normalized = normalizeWhatsAppReactions(reactions);
  if (normalized.length !== reactions.length) invalid(`${label} must use distinct single-emoji entries.`);
  return normalized;
}

function validateIOSLinkModel(value: unknown, label: string): IOSLinkPreview {
  const raw = object(value, label);
  const image = raw.image === undefined ? undefined : validateAttachment(raw.image, 0);
  return {
    url: httpsUrl(raw.url, `${label} URL`, true),
    title: string(raw.title, `${label} title`, 200, true),
    ...(typeof raw.siteName === 'string' ? { siteName: string(raw.siteName, `${label} site name`, 100) } : {}),
    ...(typeof raw.description === 'string' ? { description: string(raw.description, `${label} description`, 500) } : {}),
    ...(image ? { image } : {}),
  };
}

/**
 * Strict iOS media, validated by its own discriminators.
 *
 * `kind` then `source` decide the shape; a file that disagrees with itself is
 * rejected rather than coerced. Two details are load-bearing and both have a
 * test: a video `title` is genuinely optional and must survive as absent rather
 * than becoming an empty string, and an empty or whitespace-only YouTube poster
 * must normalize *away* so the renderer falls back to the derived thumbnail
 * (§0.5).
 */
function validateIOSMediaModel(value: unknown, label: string): IOSMedia {
  const raw = object(value, label);
  const url = httpsUrl(raw.url, `${label} URL`, true);
  if (raw.kind === 'audio') {
    if (!IOS_AUDIO_MIME_TYPES.includes(String(raw.mimeType) as 'audio/mpeg')) invalid(`${label} audio type is unsupported.`);
    return {
      kind: 'audio', url, mimeType: raw.mimeType as Extract<IOSMedia, { kind: 'audio' }>['mimeType'],
      ...(typeof raw.duration === 'string' ? { duration: string(raw.duration, `${label} duration`, 30) } : {}),
      ...(typeof raw.transcript === 'string' ? { transcript: string(raw.transcript, `${label} transcript`, 10_000) } : {}),
    };
  }
  if (raw.kind !== 'video' || (raw.source !== 'youtube' && raw.source !== 'direct')) invalid(`${label} video source must be youtube or direct.`);
  const posterUrl = raw.source === 'youtube'
    ? optionalYouTubePoster(raw.posterUrl)
    : typeof raw.posterUrl === 'string' && raw.posterUrl.trim()
      ? httpsUrl(raw.posterUrl, `${label} poster`)
      : '';
  const common = {
    ...(posterUrl ? { posterUrl } : {}),
    ...(typeof raw.title === 'string' && raw.title.trim() ? { title: string(raw.title, `${label} title`, 200) } : {}),
    ...(typeof raw.duration === 'string' ? { duration: string(raw.duration, `${label} duration`, 30) } : {}),
    ...(typeof raw.description === 'string' ? { description: string(raw.description, `${label} description`, 2_000) } : {}),
  };
  if (raw.source === 'youtube') {
    const result: IOSMedia = { kind: 'video', source: 'youtube', url, ...common };
    const issue = validateIOSMedia(result)[0];
    if (issue) invalid(`${label}: ${issue}`);
    return result;
  }
  if (!IOS_VIDEO_MIME_TYPES.includes(String(raw.mimeType) as 'video/mp4')) invalid(`${label} video type is unsupported.`);
  const captionTrackUrl = typeof raw.captionTrackUrl === 'string' && raw.captionTrackUrl ? httpsUrl(raw.captionTrackUrl, `${label} caption track`) : '';
  const captionLanguage = typeof raw.captionLanguage === 'string' ? string(raw.captionLanguage, `${label} caption language`, 40) : '';
  const captionLabel = typeof raw.captionLabel === 'string' ? string(raw.captionLabel, `${label} caption label`, 100) : '';
  if (!!captionTrackUrl !== !!captionLanguage || !!captionTrackUrl !== !!captionLabel) invalid(`${label} caption URL, language, and label must be provided together.`);
  return {
    kind: 'video', source: 'direct', url, mimeType: raw.mimeType as 'video/mp4' | 'video/webm' | 'video/ogg',
    ...common,
    ...(captionTrackUrl ? { captionTrackUrl, captionLanguage, captionLabel } : {}),
  };
}

function validateIOSTapbacksModel(value: unknown, label: string): IOSTapback[] {
  if (!Array.isArray(value)) invalid(`${label} must be a list.`);
  if (value.length > 3) invalid(`${label} can contain at most three entries.`);
  const tapbacks = value.map((candidate, index) => {
    const raw = object(candidate, `${label} ${index + 1}`);
    const emoji = string(raw.emoji, `${label} ${index + 1} emoji`, 20, true);
    const count = raw.count === undefined ? undefined : finite(raw.count, 1, 1, 9999);
    if (count !== undefined && !Number.isInteger(raw.count)) invalid(`${label} ${index + 1} count must be an integer.`);
    return { emoji, ...(count && count > 1 ? { count } : {}) };
  });
  const normalized = normalizeIOSTapbacks(tapbacks);
  if (normalized.length !== tapbacks.length) invalid(`${label} must use distinct single-emoji entries.`);
  return normalized;
}

function validateMessage(value: unknown, index: number): Message {
  const raw = object(value, `Message ${index + 1}`);
  const messageId = id(raw.id, `Message ${index + 1} ID`);
  if (typeof raw.outgoing !== 'boolean') invalid(`Message ${index + 1} needs a direction.`);
  const attachments = raw.attachments === undefined
    ? undefined
    : Array.isArray(raw.attachments)
    ? raw.attachments.slice(0, 4).map(validateAttachment)
    : invalid(`Message ${index + 1} attachments must be a list.`);
  const replyToHandles = raw.replyToHandles === undefined
    ? undefined
    : Array.isArray(raw.replyToHandles)
    ? raw.replyToHandles.slice(0, 20).map((entry, i) => string(entry, `Reply handle ${i + 1}`, 100, true))
    : invalid(`Message ${index + 1} reply handles must be a list.`);

  const result: Message = {
    id: messageId,
    sender: string(raw.sender, `Message ${index + 1} sender`, 200),
    content: typeof raw.content === 'string' ? raw.content.slice(0, 10_000) : '',
    outgoing: raw.outgoing,
  };
  const optionalStrings: Array<keyof Message> = [
    'timestamp', 'roleColor', 'participantId', 'characterId', 'reaction', 'twitterHandle', 'parentId',
    'timeBreakText', 'googleResultUrl', 'googleResultDescription', 'twitterAccountLabel',
  ];
  for (const key of optionalStrings) {
    const value = raw[key];
    if (typeof value === 'string') {
      const max = key === 'googleResultDescription' ? 2_000 : key === 'twitterAccountLabel' ? 50 : 500;
      (result as unknown as Record<string, unknown>)[key] = value.slice(0, max);
    }
  }
  const optionalBooleans: Array<keyof Message> = ['useCustomIdentity', 'verified', 'expandedView', 'showTimeBreak', 'isTyping'];
  for (const key of optionalBooleans) if (typeof raw[key] === 'boolean') (result as unknown as Record<string, unknown>)[key] = raw[key];
  const optionalNumbers: Array<keyof Message> = ['twitterLikes', 'twitterRetweets', 'twitterReplies', 'twitterViews', 'twitterBookmarks'];
  for (const key of optionalNumbers) {
    const value = raw[key];
    if (typeof value === 'number' && Number.isFinite(value)) (result as unknown as Record<string, unknown>)[key] = Math.max(0, Math.floor(value));
  }
  if (typeof raw.avatarUrl === 'string') result.avatarUrl = safeUrl(raw.avatarUrl, `Message ${index + 1} avatar`);
  if (typeof raw.status === 'string' && STATUS.has(raw.status)) result.status = raw.status as Message['status'];
  if (raw.statusMode === 'auto' || raw.statusMode === 'manual') result.statusMode = raw.statusMode;
  if (attachments) result.attachments = attachments;
  if (replyToHandles) result.replyToHandles = replyToHandles;
  if (raw.twitterLayout === 'auto' || raw.twitterLayout === 'expanded' || raw.twitterLayout === 'compact') result.twitterLayout = raw.twitterLayout;
  if (raw.twitterReplyHandlesMode === 'auto' || raw.twitterReplyHandlesMode === 'manual') result.twitterReplyHandlesMode = raw.twitterReplyHandlesMode;
  if (raw.twitterMediaCrop === 'auto' || raw.twitterMediaCrop === 'fill-width' || raw.twitterMediaCrop === 'fill-height') result.twitterMediaCrop = raw.twitterMediaCrop;
  if (raw.twitterQuote !== undefined) result.twitterQuote = validateTwitterQuote(raw.twitterQuote, `Message ${index + 1} quote`);
  if (raw.twitterVideo !== undefined) result.twitterVideo = validateTwitterVideoModel(raw.twitterVideo, `Message ${index + 1} video`);
  if (raw.twitterPoll !== undefined) result.twitterPoll = validateTwitterPollModel(raw.twitterPoll, `Message ${index + 1} poll`);
  if (raw.twitterTranslation !== undefined) result.twitterTranslation = validateTwitterTranslationModel(raw.twitterTranslation, `Message ${index + 1} translation`);
  if (raw.twitterActivity !== undefined) result.twitterActivity = validateTwitterActivityModel(raw.twitterActivity, `Message ${index + 1} activity`);
  if (raw.whatsappReply !== undefined) {
    const reply = object(raw.whatsappReply, `Message ${index + 1} WhatsApp reply`);
    result.whatsappReply = { messageId: id(reply.messageId, `Message ${index + 1} WhatsApp reply ID`) };
  }
  if (raw.whatsappLinkPreview !== undefined) result.whatsappLinkPreview = validateWhatsAppLinkModel(raw.whatsappLinkPreview, `Message ${index + 1} WhatsApp link`);
  if (raw.whatsappMedia !== undefined) result.whatsappMedia = validateWhatsAppMediaModel(raw.whatsappMedia, `Message ${index + 1} WhatsApp media`);
  if (raw.whatsappReactions !== undefined) result.whatsappReactions = validateWhatsAppReactionsModel(raw.whatsappReactions, `Message ${index + 1} WhatsApp reactions`);
  if (raw.whatsappEvent !== undefined) {
    const event = object(raw.whatsappEvent, `Message ${index + 1} WhatsApp event`);
    if (event.kind !== 'date' && event.kind !== 'system') invalid(`Message ${index + 1} WhatsApp event kind is invalid.`);
    result.whatsappEvent = { kind: event.kind, text: string(event.text, `Message ${index + 1} WhatsApp event text`, 300, true) };
  }
  if (typeof raw.whatsappStartNewRun === 'boolean') result.whatsappStartNewRun = raw.whatsappStartNewRun;
  if (raw.iosReply !== undefined) {
    const reply = object(raw.iosReply, `Message ${index + 1} iOS reply`);
    result.iosReply = { messageId: id(reply.messageId, `Message ${index + 1} iOS reply ID`) };
  }
  if (raw.iosLinkPreview !== undefined) result.iosLinkPreview = validateIOSLinkModel(raw.iosLinkPreview, `Message ${index + 1} iOS link`);
  if (raw.iosMedia !== undefined) result.iosMedia = validateIOSMediaModel(raw.iosMedia, `Message ${index + 1} iOS media`);
  if (raw.iosTapbacks !== undefined) result.iosTapbacks = validateIOSTapbacksModel(raw.iosTapbacks, `Message ${index + 1} iOS Tapbacks`);
  if (raw.iosEvent !== undefined) {
    const event = object(raw.iosEvent, `Message ${index + 1} iOS event`);
    if (event.kind !== 'date' && event.kind !== 'system') invalid(`Message ${index + 1} iOS event kind is invalid.`);
    result.iosEvent = { kind: event.kind, text: string(event.text, `Message ${index + 1} iOS event text`, 300, true) };
  }
  if (typeof raw.iosStartNewRun === 'boolean') result.iosStartNewRun = raw.iosStartNewRun;
  if (result.twitterVideo && result.attachments?.length) invalid(`Message ${index + 1} cannot contain both a video and an image grid.`);
  return result;
}

function validateParticipant(value: unknown, index: number): GroupParticipant {
  const raw = object(value, `Participant ${index + 1}`);
  const color = string(raw.color, `Participant ${index + 1} colour`, 7);
  return {
    id: id(raw.id, `Participant ${index + 1} ID`),
    ...(typeof raw.characterId === 'string' ? { characterId: id(raw.characterId, `Participant ${index + 1} character ID`) } : {}),
    name: string(raw.name, `Participant ${index + 1} name`, 200, true),
    color: HEX.test(color) ? color : '#777777',
    ...(typeof raw.whatsappTone === 'string' && WHATSAPP_TONE_IDS.has(raw.whatsappTone as WhatsAppParticipantTone) ? { whatsappTone: raw.whatsappTone as WhatsAppParticipantTone } : {}),
    ...(typeof raw.iosTone === 'string' && IOS_TONE_IDS.has(raw.iosTone as IOSParticipantTone) ? { iosTone: raw.iosTone as IOSParticipantTone } : {}),
    ...(safeUrl(raw.avatarUrl, `Participant ${index + 1} avatar`) ? { avatarUrl: safeUrl(raw.avatarUrl, `Participant ${index + 1} avatar`) } : {}),
    ...(string(raw.phoneNumber, `Participant ${index + 1} phone`, 100) ? { phoneNumber: string(raw.phoneNumber, `Participant ${index + 1} phone`, 100) } : {}),
  };
}

function validateSceneCharacter(value: unknown, index: number): SceneCharacter {
  const raw = object(value, `Scene character ${index + 1}`);
  const avatarUrl = safeUrl(raw.avatarUrl, `Scene character ${index + 1} avatar`);
  const twitterHandle = normalizeTwitterHandle(string(raw.twitterHandle, `Scene character ${index + 1} handle`, 100));
  return {
    id: id(raw.id, `Scene character ${index + 1} ID`),
    name: string(raw.name, `Scene character ${index + 1} name`, 200, true),
    ...(avatarUrl ? { avatarUrl } : {}),
    ...(twitterHandle ? { twitterHandle } : {}),
    ...(typeof raw.verified === 'boolean' ? { verified: raw.verified } : {}),
    ...(typeof raw.sourceLibraryId === 'string'
      ? { sourceLibraryId: string(raw.sourceLibraryId, `Scene character ${index + 1} library ID`, 100, true) }
      : {}),
    ...(typeof raw.archived === 'boolean' ? { archived: raw.archived } : {}),
  };
}

function validateCast(value: unknown): SceneCast | undefined {
  if (value === undefined) return undefined;
  const raw = object(value, 'Project cast');
  if (!Array.isArray(raw.characters)) invalid('Project cast characters must be a list.');
  const characters = raw.characters.slice(0, 100).map(validateSceneCharacter);
  const ids = new Set(characters.map(character => character.id));
  if (ids.size !== characters.length) invalid('Project cast character IDs must be unique.');
  const binding = (key: 'selfId' | 'contactId' | 'twitterPrimaryId') => {
    if (raw[key] === undefined) return undefined;
    const value = id(raw[key], `Project cast ${key}`);
    if (!ids.has(value)) invalid(`Project cast ${key} does not reference a character.`);
    return value;
  };
  const selfId = binding('selfId');
  const contactId = binding('contactId');
  const twitterPrimaryId = binding('twitterPrimaryId');
  return {
    characters,
    ...(selfId ? { selfId } : {}),
    ...(contactId ? { contactId } : {}),
    ...(twitterPrimaryId ? { twitterPrimaryId } : {}),
  };
}

function validateTwitterCharacter(value: unknown, index: number): TwitterCharacter {
  const raw = object(value, `Twitter character ${index + 1}`);
  return {
    id: id(raw.id, `Twitter character ${index + 1} ID`),
    name: string(raw.name, `Twitter character ${index + 1} name`, 200, true),
    handle: string(raw.handle, `Twitter character ${index + 1} handle`, 100, true),
    ...(safeUrl(raw.avatarUrl, `Twitter character ${index + 1} avatar`) ? { avatarUrl: safeUrl(raw.avatarUrl, `Twitter character ${index + 1} avatar`) } : {}),
    ...(typeof raw.verified === 'boolean' ? { verified: raw.verified } : {}),
  };
}

function validateSettings(value: unknown): SkinSettings {
  const raw = object(value, 'Project settings');
  const defaults = defaultProject().settings;
  const result: SkinSettings = { ...defaults };

  for (const key of STRING_SETTING_KEYS) {
    const value = raw[key];
    if (typeof value !== 'string') continue;
    (result as unknown as Record<string, unknown>)[key] = URL_SETTING_KEYS.has(key)
      ? safeUrl(value, `Setting ${String(key)}`)
      : value.slice(0, key === 'twitterQuoteText' ? 2_000 : 500);
  }
  const senderColor = typeof raw.senderColor === 'string' ? raw.senderColor.trim() : '';
  const receiverColor = typeof raw.receiverColor === 'string' ? raw.receiverColor.trim() : '';
  result.senderColor = HEX.test(senderColor) ? senderColor : defaults.senderColor;
  result.receiverColor = HEX.test(receiverColor) ? receiverColor : defaults.receiverColor;
  result.fontFamily = SCENE_FONTS.has(raw.fontFamily as string)
    ? raw.fontFamily as string
    : defaults.fontFamily;
  for (const key of BOOLEAN_SETTING_KEYS) {
    (result as unknown as Record<string, unknown>)[key] = boolean(raw[key], Boolean(defaults[key]));
  }
  for (const key of NUMBER_SETTING_KEYS) {
    const min = key === 'bubbleOpacity' ? 0 : key === 'maxWidthPx' ? 240 : 0;
    const max = key === 'bubbleOpacity' ? 1 : key === 'maxWidthPx' ? 1_200 : 1_000_000_000;
    (result as unknown as Record<string, unknown>)[key] = finite(raw[key], Number(defaults[key] ?? 0), min, max);
  }
  if (raw.iosMode === 'imessage' || raw.iosMode === 'sms') result.iosMode = raw.iosMode;
  if (raw.googleEngineVariant === 'google' || raw.googleEngineVariant === 'google-old' || raw.googleEngineVariant === 'naver') result.googleEngineVariant = raw.googleEngineVariant;
  if (raw.twitterSceneMode === 'single' || raw.twitterSceneMode === 'timeline' || raw.twitterSceneMode === 'thread') result.twitterSceneMode = raw.twitterSceneMode;
  if (raw.twitterTheme === 'light' || raw.twitterTheme === 'dim' || raw.twitterTheme === 'dark') {
    result.twitterTheme = raw.twitterTheme;
  } else {
    // Keep the field absent until migration. Otherwise the default light value
    // masks the legacy twitterDarkMode flag in v1-v3 backups.
    delete result.twitterTheme;
  }
  if (raw.androidFrameMode === 'bubbles' || raw.androidFrameMode === 'header' || raw.androidFrameMode === 'phone') result.androidFrameMode = raw.androidFrameMode;
  if (raw.iosFrameMode === 'bubbles' || raw.iosFrameMode === 'header' || raw.iosFrameMode === 'phone') result.iosFrameMode = raw.iosFrameMode;
  if (raw.androidGroupSubtitleMode === 'members' || raw.androidGroupSubtitleMode === 'count' || raw.androidGroupSubtitleMode === 'custom' || raw.androidGroupSubtitleMode === 'hidden') result.androidGroupSubtitleMode = raw.androidGroupSubtitleMode;
  if (Array.isArray(raw.googleSuggestions)) result.googleSuggestions = raw.googleSuggestions.slice(0, 20).map((item, i) => string(item, `Suggestion ${i + 1}`, 200, true));
  if (Array.isArray(raw.iosGroupParticipants)) result.iosGroupParticipants = raw.iosGroupParticipants.slice(0, 50).map(validateParticipant);
  if (Array.isArray(raw.androidGroupParticipants)) result.androidGroupParticipants = raw.androidGroupParticipants.slice(0, 50).map(validateParticipant);
  if (Array.isArray(raw.twitterCharacterPresets)) result.twitterCharacterPresets = raw.twitterCharacterPresets.slice(0, 50).map(validateTwitterCharacter);
  return result;
}

function validateProject(value: unknown): SkinProject {
  const raw = object(value, 'Project');
  if (!TEMPLATE_IDS.has(raw.template as SkinProject['template'])) invalid('This backup has an unknown platform.');
  if (!Array.isArray(raw.messages)) invalid('Project messages must be a list.');
  if (raw.messages.length > 100) invalid('This backup contains more than 100 messages.');
  const cast = validateCast(raw.cast);
  const messages = raw.messages.map(validateMessage);
  if (new Set(messages.map(message => message.id)).size !== messages.length) invalid('Project message IDs must be unique.');
  if (raw.template === 'twitter') {
    const castIds = new Set(cast?.characters.map(character => character.id) || []);
    const invalidIdentity = messages.find(message => message.characterId && !castIds.has(message.characterId));
    if (invalidIdentity) {
      invalid(`Twitter message ${invalidIdentity.id} references an account that is not in the scene cast.`);
    }
    for (const message of messages) {
      if (message.twitterQuote?.characterId && !castIds.has(message.twitterQuote.characterId)) {
        invalid(`Twitter quote in message ${message.id} references an account that is not in the scene cast.`);
      }
      const missingActor = message.twitterActivity?.actorCharacterIds.find(actorId => !castIds.has(actorId));
      if (missingActor) invalid(`Twitter activity in message ${message.id} references an account that is not in the scene cast.`);
    }
    const issue = validateTwitterRelationships(messages)[0];
    if (issue) {
      const detail = issue.parentId ? ` and parent ${issue.parentId}` : '';
      invalid(`Twitter relationship ${issue.code} for message ${issue.messageId}${detail}.`);
    }
  }
  if (raw.template === 'android') {
    const whatsappProject: SkinProject = {
      id: typeof raw.id === 'string' ? raw.id : 'project',
      template: 'android',
      settings: validateSettings(raw.settings),
      messages,
      ...(cast ? { cast } : {}),
    };
    messages.forEach((message, index) => {
      const issue = validateWhatsAppMessage(whatsappProject, message, index)[0];
      if (issue) invalid(`WhatsApp message ${index + 1}: ${issue}`);
    });
  }
  if (raw.template === 'ios') {
    // The same shared validator the composer and timeline use (§0.2), so an
    // imported scene cannot express anything the editor would have refused.
    const iosProject: SkinProject = {
      id: typeof raw.id === 'string' ? raw.id : 'project',
      template: 'ios',
      settings: validateSettings(raw.settings),
      messages,
      ...(cast ? { cast } : {}),
    };
    messages.forEach((message, index) => {
      const issue = validateIOSMessage(iosProject, message, index)[0];
      if (issue) invalid(`iMessage ${index + 1}: ${issue}`);
    });
  }
  return {
    id: id(raw.id, 'Project ID'),
    template: raw.template as SkinProject['template'],
    settings: validateSettings(raw.settings),
    messages,
    ...(cast ? { cast } : {}),
  };
}

function assertExactTopLevel(raw: Record<string, unknown>, allowed: Set<string>): void {
  const extra = Object.keys(raw).find(key => !allowed.has(key));
  if (extra) invalid(`Unknown top-level field: ${extra}.`);
}

function validateEnvelope(raw: Record<string, unknown>, expectedFormat: string, supportedVersion: number): { exportedAt: string; schemaVersion: number } {
  if (raw.format !== expectedFormat) invalid(`Expected a ${expectedFormat} file.`);
  if (!Number.isInteger(raw.schemaVersion)) invalid('schemaVersion must be an integer.');
  if ((raw.schemaVersion as number) > supportedVersion) {
    throw new ProjectFileError('PROJECT_SCHEMA_UNSUPPORTED', `This file uses schema version ${raw.schemaVersion}; this app supports version ${supportedVersion}.`);
  }
  if ((raw.schemaVersion as number) < 1) invalid(`Unsupported schema version ${String(raw.schemaVersion)}.`);
  const exportedAt = string(raw.exportedAt, 'Export date', 40, true);
  if (Number.isNaN(Date.parse(exportedAt))) invalid('The export date is invalid.');
  const application = object(raw.application, 'Application');
  if (application.name !== 'AO3 SkinGen') invalid('This file was not created by AO3 SkinGen.');
  string(application.version, 'Application version', 40, true);
  return { exportedAt: new Date(exportedAt).toISOString(), schemaVersion: raw.schemaVersion as number };
}

function byteLength(text: string): number {
  return typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(text).byteLength : text.length * 2;
}

function parseJson(text: string): Record<string, unknown> {
  if (byteLength(text) > PROJECT_FILE_MAX_BYTES) {
    throw new ProjectFileError('PROJECT_IMPORT_TOO_LARGE', 'That backup is larger than the 2 MB import limit.');
  }
  try {
    return object(JSON.parse(text), 'Backup');
  } catch (error) {
    if (error instanceof ProjectFileError) throw error;
    throw new ProjectFileError('PROJECT_IMPORT_INVALID', 'That file is not valid JSON.');
  }
}

export const PROJECT_FILE_MIGRATIONS: Readonly<Record<number, (value: SkinProject) => SkinProject>> = Object.freeze({
  1: (project) => migrateTwitterProject(migrateProjectIdentities(project)),
  2: (project) => migrateTwitterProject(migrateProjectIdentities(project)),
  3: (project) => migrateTwitterProject(migrateProjectIdentities(project)),
  4: (project) => migrateTwitterProject(migrateProjectIdentities(project)),
  5: (project) => migrateTwitterProject(migrateProjectIdentities(project)),
  /**
   * v6 → v7 added the structured iOS content model.
   *
   * This entry exists because `parseProjectFile` indexes this table for *every*
   * accepted older envelope — leaving `[6]` undefined would throw
   * `is not a function` on a file the version check had just accepted. It is
   * deliberately a no-op beyond the shared identity/Twitter normalization:
   * §0.7 forbids guessing rich iOS content, and in particular forbids copying
   * the old shared `reaction` string into `iosTapbacks`. The new editor owns
   * `iosTapbacks` canonically; a v6 file simply arrives without any.
   */
  6: (project) => migrateTwitterProject(migrateProjectIdentities(project)),
});

export function createProjectFile(project: SkinProject, characterLibrary: UniversalCharacter[], now = new Date()): SceneProjectFileV7 {
  return {
    format: 'ao3skingen-project',
    schemaVersion: 7,
    exportedAt: now.toISOString(),
    application: { name: 'AO3 SkinGen', version: APPLICATION_VERSION },
    project: validateProject(migrateTwitterProject(migrateProjectIdentities(project))),
    characterLibrary: validateCharacterLibrary(characterLibrary),
  };
}

export function serializeProjectFile(project: SkinProject, characterLibrary: UniversalCharacter[], now = new Date()): string {
  return JSON.stringify(createProjectFile(project, characterLibrary, now), null, 2);
}

export function parseProjectFile(text: string): SceneProjectFileV7 {
  const raw = parseJson(text);
  assertExactTopLevel(raw, TOP_SCENE_KEYS);
  const envelope = validateEnvelope(raw, 'ao3skingen-project', PROJECT_FILE_SCHEMA_VERSION);
  const validatedProject = validateProject(raw.project);
  const project = envelope.schemaVersion < PROJECT_FILE_SCHEMA_VERSION
    ? PROJECT_FILE_MIGRATIONS[envelope.schemaVersion](validatedProject)
    : migrateTwitterProject(migrateProjectIdentities(validatedProject));
  return {
    format: 'ao3skingen-project',
    schemaVersion: 7,
    exportedAt: envelope.exportedAt,
    application: { name: 'AO3 SkinGen', version: string(object(raw.application, 'Application').version, 'Application version', 40, true) },
    project,
    characterLibrary: validateCharacterLibrary(raw.characterLibrary),
  };
}

function projectUrls(project: SkinProject): string[] {
  const settings = project.settings as unknown as Record<string, unknown>;
  const urls = [...URL_SETTING_KEYS]
    .map(key => settings[key])
    .filter((value): value is string => typeof value === 'string' && !!value);
  for (const message of project.messages) {
    if (message.avatarUrl) urls.push(message.avatarUrl);
    for (const attachment of message.attachments || []) if (attachment.url) urls.push(attachment.url);
    for (const attachment of message.twitterQuote?.attachments || []) if (attachment.url) urls.push(attachment.url);
    if (message.twitterQuote?.avatarUrl) urls.push(message.twitterQuote.avatarUrl);
    if (message.twitterVideo?.url) urls.push(message.twitterVideo.url);
    if (message.twitterVideo?.posterUrl) urls.push(message.twitterVideo.posterUrl);
    if (message.twitterVideo?.captionTrackUrl) urls.push(message.twitterVideo.captionTrackUrl);
    if (message.whatsappLinkPreview?.url) urls.push(message.whatsappLinkPreview.url);
    if (message.whatsappLinkPreview?.image?.url) urls.push(message.whatsappLinkPreview.image.url);
    if (message.whatsappMedia?.url) urls.push(message.whatsappMedia.url);
    if (message.whatsappMedia?.kind === 'video' && message.whatsappMedia.posterUrl) urls.push(message.whatsappMedia.posterUrl);
    if (message.whatsappMedia?.kind === 'video' && message.whatsappMedia.source === 'direct' && message.whatsappMedia.captionTrackUrl) urls.push(message.whatsappMedia.captionTrackUrl);
    if (message.iosLinkPreview?.url) urls.push(message.iosLinkPreview.url);
    if (message.iosLinkPreview?.image?.url) urls.push(message.iosLinkPreview.image.url);
    if (message.iosMedia?.url) urls.push(message.iosMedia.url);
    if (message.iosMedia?.kind === 'video' && message.iosMedia.posterUrl) urls.push(message.iosMedia.posterUrl);
    if (message.iosMedia?.kind === 'video' && message.iosMedia.source === 'direct' && message.iosMedia.captionTrackUrl) urls.push(message.iosMedia.captionTrackUrl);
  }
  for (const participant of [...(project.settings.iosGroupParticipants || []), ...(project.settings.androidGroupParticipants || [])]) {
    if (participant.avatarUrl) urls.push(participant.avatarUrl);
  }
  for (const character of project.cast?.characters || []) {
    if (character.avatarUrl) urls.push(character.avatarUrl);
  }
  return urls;
}

export function summarizeProjectFile(file: SceneProjectFile): ProjectFileSummary {
  return {
    template: file.project.template,
    itemCount: file.project.messages.length,
    itemLabel: file.project.template === 'google' ? 'results' : 'messages',
    characterCount: file.characterLibrary.length,
    exportedAt: file.exportedAt,
    hasRemoteImages: projectUrls(file.project).some(url => /^https?:\/\//i.test(url)),
  };
}

function validateSiteTheme(value: unknown): SiteSkinTheme {
  const raw = object(value, 'Site theme');
  if (raw.schemaVersion !== 1) invalid('The site theme schemaVersion must be 1.');
  const meta = object(raw.meta, 'Theme metadata');
  const colors = object(raw.colors, 'Theme colours');
  const typography = object(raw.typography, 'Theme typography');
  const shape = object(raw.shape, 'Theme shape');
  const header = object(raw.header, 'Theme header');
  const details = object(raw.details, 'Theme details');
  string(meta.id, 'Theme ID', 64, true);
  string(meta.name, 'Theme name', 80, true);
  if (!MOODS.includes(meta.category as never)) invalid('Theme category is invalid.');
  if (!Array.isArray(meta.moods) || !meta.moods.length || meta.moods.some(mood => !MOODS.includes(mood as never))) invalid('Theme moods are invalid.');
  for (const key of ['background', 'surface', 'text', 'accent']) {
    const value = colors[key];
    if (typeof value !== 'string' || !HEX.test(value)) invalid(`Theme colour ${key} is invalid.`);
  }
  if (!FONT_STACKS.some(item => item.value === typography.headingFont) || !FONT_STACKS.some(item => item.value === typography.bodyFont)) invalid('Theme font is invalid.');
  if (!FONT_SCALES.some(item => item.value === typography.baseFontScale)) invalid('Theme font size is invalid.');
  if (!CARD_RADII.some(item => item.value === shape.cardRadius) || !TAG_STYLES.some(item => item.value === shape.tagStyle)) invalid('Theme shape is invalid.');
  if (typeof header.bannerUrl !== 'string' || (header.bannerUrl && !checkAo3ImageUrl(header.bannerUrl).ok)) invalid('Theme banner address is invalid.');
  if (!BANNER_HEIGHTS.some(item => item.value === header.bannerHeight) || !HEADER_TEXT_COLORS.some(item => item.value === header.textColor)) invalid('Theme header option is invalid.');
  for (const value of [header.hideLogo, header.textShadow, details.divider, details.dropCap]) if (typeof value !== 'boolean') invalid('Theme toggle value is invalid.');
  return validateTheme(raw, cloneTheme(DEFAULT_TEMPLATE));
}

export function createSiteThemeFile(theme: SiteSkinTheme, now = new Date()): SiteThemeFileV1 {
  return {
    format: 'ao3skingen-site-theme',
    schemaVersion: 1,
    exportedAt: now.toISOString(),
    application: { name: 'AO3 SkinGen', version: APPLICATION_VERSION },
    theme: validateSiteTheme(theme),
  };
}

export function serializeSiteThemeFile(theme: SiteSkinTheme, now = new Date()): string {
  return JSON.stringify(createSiteThemeFile(theme, now), null, 2);
}

export function parseSiteThemeFile(text: string): SiteThemeFileV1 {
  const raw = parseJson(text);
  assertExactTopLevel(raw, TOP_THEME_KEYS);
  const { exportedAt } = validateEnvelope(raw, 'ao3skingen-site-theme', 1);
  return {
    format: 'ao3skingen-site-theme',
    schemaVersion: 1,
    exportedAt,
    application: { name: 'AO3 SkinGen', version: string(object(raw.application, 'Application').version, 'Application version', 40, true) },
    theme: validateSiteTheme(raw.theme),
  };
}
