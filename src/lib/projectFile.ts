import { defaultProject, GroupParticipant, Message, SkinProject, SkinSettings, TwitterCharacter, UniversalCharacter } from './schema';
import { validateCharacterLibrary } from './characterStorage';
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

export const PROJECT_FILE_SCHEMA_VERSION = 1;
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
  'twitterHandle', 'twitterTimestamp', 'twitterQuoteAvatar', 'twitterQuoteName',
  'twitterQuoteHandle', 'twitterQuoteText', 'twitterQuoteImage', 'googleQuery',
  'googleResultsCount', 'googleResultsTime', 'googleDidYouMean', 'chatYourName',
  'chatContactName', 'chatTypingName', 'iosContactName', 'iosGroupName',
  'iosStatusBarTime', 'iosInputPlaceholder', 'iosHeaderImageUrl', 'iosFooterImageUrl',
  'iosAvatarUrl', 'androidStatusText', 'androidHeaderImageUrl', 'androidFooterImageUrl',
  'androidAvatarUrl', 'androidContactName', 'androidGroupName',
]);
const URL_SETTING_KEYS = new Set<keyof SkinSettings>([
  'twitterAvatarUrl', 'twitterQuoteAvatar', 'twitterQuoteImage', 'iosHeaderImageUrl',
  'iosFooterImageUrl', 'iosAvatarUrl', 'androidHeaderImageUrl', 'androidFooterImageUrl',
  'androidAvatarUrl',
]);
const BOOLEAN_SETTING_KEYS = new Set<keyof SkinSettings>([
  'useDarkNeutral', 'fictionLabel', 'toolAttribution', 'watermark', 'twitterVerified',
  'twitterShowMetrics', 'twitterDarkMode', 'twitterThreadMode', 'twitterQuoteEnabled',
  'twitterQuoteVerified', 'googleShowStats', 'googleShowDidYouMean', 'chatShowTyping',
  'iosDarkMode', 'iosShowReadReceipt', 'iosAutoAlternate', 'iosGroupMode',
  'iosShowStatusBar', 'iosShowInputBar', 'androidShowStatus', 'androidCheckmarks',
  'androidDarkMode', 'androidAutoAlternate', 'androidGroupMode',
]);
const NUMBER_SETTING_KEYS = new Set<keyof SkinSettings>([
  'bubbleOpacity', 'maxWidthPx', 'twitterLikes', 'twitterRetweets', 'twitterReplies',
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
    'timestamp', 'roleColor', 'participantId', 'reaction', 'twitterHandle', 'parentId',
    'timeBreakText', 'googleResultUrl', 'googleResultDescription',
  ];
  for (const key of optionalStrings) {
    const value = raw[key];
    if (typeof value === 'string') (result as unknown as Record<string, unknown>)[key] = value.slice(0, key === 'googleResultDescription' ? 2_000 : 500);
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
  if (attachments) result.attachments = attachments;
  if (replyToHandles) result.replyToHandles = replyToHandles;
  return result;
}

function validateParticipant(value: unknown, index: number): GroupParticipant {
  const raw = object(value, `Participant ${index + 1}`);
  const color = string(raw.color, `Participant ${index + 1} colour`, 7);
  return {
    id: id(raw.id, `Participant ${index + 1} ID`),
    name: string(raw.name, `Participant ${index + 1} name`, 200, true),
    color: HEX.test(color) ? color : '#777777',
    ...(safeUrl(raw.avatarUrl, `Participant ${index + 1} avatar`) ? { avatarUrl: safeUrl(raw.avatarUrl, `Participant ${index + 1} avatar`) } : {}),
    ...(string(raw.phoneNumber, `Participant ${index + 1} phone`, 100) ? { phoneNumber: string(raw.phoneNumber, `Participant ${index + 1} phone`, 100) } : {}),
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
  return {
    id: id(raw.id, 'Project ID'),
    template: raw.template as SkinProject['template'],
    settings: validateSettings(raw.settings),
    messages: raw.messages.map(validateMessage),
  };
}

function assertExactTopLevel(raw: Record<string, unknown>, allowed: Set<string>): void {
  const extra = Object.keys(raw).find(key => !allowed.has(key));
  if (extra) invalid(`Unknown top-level field: ${extra}.`);
}

function validateEnvelope(raw: Record<string, unknown>, expectedFormat: string): string {
  if (raw.format !== expectedFormat) invalid(`Expected a ${expectedFormat} file.`);
  if (!Number.isInteger(raw.schemaVersion)) invalid('schemaVersion must be an integer.');
  if ((raw.schemaVersion as number) > PROJECT_FILE_SCHEMA_VERSION) {
    throw new ProjectFileError('PROJECT_SCHEMA_UNSUPPORTED', `This file uses schema version ${raw.schemaVersion}; this app supports version ${PROJECT_FILE_SCHEMA_VERSION}.`);
  }
  if (raw.schemaVersion !== PROJECT_FILE_SCHEMA_VERSION) invalid(`Unsupported schema version ${String(raw.schemaVersion)}.`);
  const exportedAt = string(raw.exportedAt, 'Export date', 40, true);
  if (Number.isNaN(Date.parse(exportedAt))) invalid('The export date is invalid.');
  const application = object(raw.application, 'Application');
  if (application.name !== 'AO3 SkinGen') invalid('This file was not created by AO3 SkinGen.');
  string(application.version, 'Application version', 40, true);
  return new Date(exportedAt).toISOString();
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

export const PROJECT_FILE_MIGRATIONS: Readonly<Record<number, (value: unknown) => unknown>> = Object.freeze({});

export function createProjectFile(project: SkinProject, characterLibrary: UniversalCharacter[], now = new Date()): SceneProjectFileV1 {
  return {
    format: 'ao3skingen-project',
    schemaVersion: 1,
    exportedAt: now.toISOString(),
    application: { name: 'AO3 SkinGen', version: APPLICATION_VERSION },
    project: validateProject(project),
    characterLibrary: validateCharacterLibrary(characterLibrary),
  };
}

export function serializeProjectFile(project: SkinProject, characterLibrary: UniversalCharacter[], now = new Date()): string {
  return JSON.stringify(createProjectFile(project, characterLibrary, now), null, 2);
}

export function parseProjectFile(text: string): SceneProjectFileV1 {
  const raw = parseJson(text);
  assertExactTopLevel(raw, TOP_SCENE_KEYS);
  const exportedAt = validateEnvelope(raw, 'ao3skingen-project');
  return {
    format: 'ao3skingen-project',
    schemaVersion: 1,
    exportedAt,
    application: { name: 'AO3 SkinGen', version: string(object(raw.application, 'Application').version, 'Application version', 40, true) },
    project: validateProject(raw.project),
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
  }
  for (const participant of [...(project.settings.iosGroupParticipants || []), ...(project.settings.androidGroupParticipants || [])]) {
    if (participant.avatarUrl) urls.push(participant.avatarUrl);
  }
  return urls;
}

export function summarizeProjectFile(file: SceneProjectFileV1): ProjectFileSummary {
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
  const exportedAt = validateEnvelope(raw, 'ao3skingen-site-theme');
  return {
    format: 'ao3skingen-site-theme',
    schemaVersion: 1,
    exportedAt,
    application: { name: 'AO3 SkinGen', version: string(object(raw.application, 'Application').version, 'Application version', 40, true) },
    theme: validateSiteTheme(raw.theme),
  };
}
