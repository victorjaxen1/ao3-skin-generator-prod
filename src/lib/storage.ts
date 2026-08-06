import { SkinProject } from './schema';
import { PLATFORM_ASSETS } from './platformAssets';

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
    
    // Merge with defaults to ensure new fields are present (like header/footer URLs)
    const defaults = fallback();
    
    // Fix broken URLs from old versions - ALWAYS use CDN URL if it's not already correct
    const fixAndroidHeaderUrl = (url: string | undefined) => {
      // Always return correct CDN URL (whatapp-header.png - note the typo is intentional, that's the actual filename)
      if (url === PLATFORM_ASSETS.whatsapp.headerImage) return url;
      // Force correct URL for any other value (including broken URLs, undefined, etc.)
      return PLATFORM_ASSETS.whatsapp.headerImage;
    };
    
    const fixAndroidFooterUrl = (url: string | undefined) => {
      // Always return correct CDN URL unless the URL is already the correct one
      if (url === PLATFORM_ASSETS.whatsapp.footerImage) return url;
      // Force correct URL for any other value
      return PLATFORM_ASSETS.whatsapp.footerImage;
    };
    
    // Sanitize URL fields in settings
    const sanitizedSettings = {
      ...defaults.settings,
      ...parsed.settings,
      // Ensure header/footer image URLs exist and are sanitized, fixing old broken URLs
      iosHeaderImageUrl: sanitizeStoredUrl(parsed.settings.iosHeaderImageUrl) || defaults.settings.iosHeaderImageUrl,
      iosFooterImageUrl: sanitizeStoredUrl(parsed.settings.iosFooterImageUrl) || defaults.settings.iosFooterImageUrl,
      androidHeaderImageUrl: fixAndroidHeaderUrl(parsed.settings.androidHeaderImageUrl),
      androidFooterImageUrl: fixAndroidFooterUrl(parsed.settings.androidFooterImageUrl),
      iosAvatarUrl: sanitizeStoredUrl(parsed.settings.iosAvatarUrl),
      androidAvatarUrl: sanitizeStoredUrl(parsed.settings.androidAvatarUrl),
      twitterAvatarUrl: sanitizeStoredUrl(parsed.settings.twitterAvatarUrl),
      twitterQuoteAvatar: sanitizeStoredUrl(parsed.settings.twitterQuoteAvatar),
      twitterQuoteImage: sanitizeStoredUrl(parsed.settings.twitterQuoteImage),
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
