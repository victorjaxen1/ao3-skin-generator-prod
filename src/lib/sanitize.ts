// DOMPurify-based sanitizer. Falls back to basic escaping on server.
import DOMPurify from 'dompurify';

// On the server (SSR) DOMPurify may not have DOM; fallback to escape only.
function fallbackEscape(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Sanitize URLs to prevent XSS via javascript: and other dangerous protocols.
 * Only allows http:, https:, and data: (for inline images) protocols.
 * Returns empty string for invalid or dangerous URLs.
 */
export function sanitizeUrl(url: string | undefined): string {
  if (!url || typeof url !== 'string') return '';
  
  // Trim whitespace and normalize
  const trimmed = url.trim();
  if (!trimmed) return '';
  
  // Block javascript:, vbscript:, data:text/html, and other dangerous schemes
  const dangerousPatterns = [
    /^javascript:/i,
    /^vbscript:/i,
    /^data:text\/html/i,
    /^data:[^;]*;base64.*<script/i,
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(trimmed)) {
      console.warn('Blocked dangerous URL:', trimmed.slice(0, 50));
      return '';
    }
  }
  
  // For absolute URLs, validate protocol
  if (trimmed.includes(':')) {
    try {
      const parsed = new URL(trimmed);
      const allowedProtocols = ['http:', 'https:', 'data:'];
      if (!allowedProtocols.includes(parsed.protocol.toLowerCase())) {
        console.warn('Blocked URL with disallowed protocol:', parsed.protocol);
        return '';
      }
    } catch {
      // If URL parsing fails but contains a colon, it might be a malformed attack
      // Only allow if it looks like a relative path
      if (!trimmed.startsWith('/') && !trimmed.startsWith('./') && !trimmed.startsWith('../')) {
        return '';
      }
    }
  }
  
  // Escape HTML entities in the URL to prevent attribute breakout
  return trimmed
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function sanitizeText(input: string): string {
  const withBreaks = input.replace(/\r\n|\n/g, '<br/>');
  if (typeof window === 'undefined') {
    // Server-side render path
    return fallbackEscape(withBreaks);
  }
  return DOMPurify.sanitize(withBreaks, {
    ALLOWED_TAGS: ['br','b','strong'],
    ALLOWED_ATTR: [],
    FORBID_TAGS: ['script', 'style', 'iframe', 'canvas'],
  });
}
