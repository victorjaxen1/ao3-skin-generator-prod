import { SkinProject } from './schema';

const KEY = 'ao3SkinProject';

// Security limits to prevent DoS and memory issues
const MAX_STORAGE_SIZE = 500000; // 500KB max for stored project
const MAX_MESSAGES = 100; // Max messages per project
const MAX_CONTENT_LENGTH = 10000; // Max characters per message
const MAX_URL_LENGTH = 2048; // Standard URL length limit

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

/**
 * Validate and sanitize a message object from storage
 */
function sanitizeMessage(msg: unknown): { id: string; sender: string; content: string; outgoing: boolean; [key: string]: unknown } | null {
  if (!msg || typeof msg !== 'object') return null;
  const m = msg as Record<string, unknown>;
  
  // Required fields validation
  if (typeof m.id !== 'string' || !m.id) return null;
  if (typeof m.outgoing !== 'boolean') return null;
  
  return {
    ...m,
    id: sanitizeString(m.id, 100),
    sender: sanitizeString(m.sender, 200),
    content: sanitizeString(m.content, MAX_CONTENT_LENGTH),
    outgoing: m.outgoing,
    timestamp: typeof m.timestamp === 'string' ? sanitizeString(m.timestamp, 50) : undefined,
    avatarUrl: sanitizeStoredUrl(m.avatarUrl),
    reaction: typeof m.reaction === 'string' ? sanitizeString(m.reaction, 10) : undefined,
  };
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
    
    // Merge with defaults to ensure new fields are present (like header/footer URLs)
    const defaults = fallback();
    
    // Sanitize URL fields in settings
    const sanitizedSettings = {
      ...defaults.settings,
      ...parsed.settings,
      // Ensure header/footer image URLs exist and are sanitized
      iosHeaderImageUrl: sanitizeStoredUrl(parsed.settings.iosHeaderImageUrl) || defaults.settings.iosHeaderImageUrl,
      iosFooterImageUrl: sanitizeStoredUrl(parsed.settings.iosFooterImageUrl) || defaults.settings.iosFooterImageUrl,
      androidHeaderImageUrl: sanitizeStoredUrl(parsed.settings.androidHeaderImageUrl) || defaults.settings.androidHeaderImageUrl,
      androidFooterImageUrl: sanitizeStoredUrl(parsed.settings.androidFooterImageUrl) || defaults.settings.androidFooterImageUrl,
      iosAvatarUrl: sanitizeStoredUrl(parsed.settings.iosAvatarUrl),
      androidAvatarUrl: sanitizeStoredUrl(parsed.settings.androidAvatarUrl),
      instagramAvatarUrl: sanitizeStoredUrl(parsed.settings.instagramAvatarUrl),
      twitterAvatarUrl: sanitizeStoredUrl(parsed.settings.twitterAvatarUrl),
      twitterQuoteAvatar: sanitizeStoredUrl(parsed.settings.twitterQuoteAvatar),
      twitterQuoteImage: sanitizeStoredUrl(parsed.settings.twitterQuoteImage),
      instagramImageUrl: sanitizeStoredUrl(parsed.settings.instagramImageUrl),
    };
    
    return {
      ...parsed,
      settings: sanitizedSettings,
      messages: sanitizedMessages,
    } as T;
  } catch (e) { 
    console.warn('Failed to load stored project:', e);
    return fallback(); 
  }
}

export function persistProject(project: SkinProject) {
  try { 
    const json = JSON.stringify(project);
    // Don't persist if too large
    if (json.length > MAX_STORAGE_SIZE) {
      console.warn('Project too large to persist');
      return;
    }
    localStorage.setItem(KEY, json); 
  } catch { /* ignore */ }
}
