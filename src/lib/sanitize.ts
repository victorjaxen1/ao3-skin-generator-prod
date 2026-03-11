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

/**
 * Apply WhatsApp/iMessage-style text formatting to message content.
 * Supports:
 * - *bold* → <strong>bold</strong>
 * - _italic_ → <em>italic</em>
 * - ~strikethrough~ → <s>strikethrough</s>
 * - ```code block``` → <pre><code>code block</code></pre>
 * - `inline code` → <code>inline code</code>
 * - > quote → <blockquote>quote</blockquote>
 * - * or - list item → <li>list item</li> (wrapped in <ul>)
 * - 1. numbered item → <li>numbered item</li> (wrapped in <ol>)
 * 
 * Note: This function should be called AFTER sanitizeText to preserve security.
 */
export function formatMessageText(input: string): string {
  if (!input) return '';
  
  // First sanitize the raw input to prevent XSS
  let text = input;
  
  // Handle newlines - we'll process them for lists/quotes
  const lines = text.split(/\r\n|\n/);
  const processedLines: string[] = [];
  let inBulletList = false;
  let inNumberedList = false;
  let inBlockquote = false;
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    
    // Check for block quote: > text
    const quoteMatch = line.match(/^>\s+(.*)$/);
    if (quoteMatch) {
      if (!inBlockquote) {
        if (inBulletList) { processedLines.push('</ul>'); inBulletList = false; }
        if (inNumberedList) { processedLines.push('</ol>'); inNumberedList = false; }
        processedLines.push('<blockquote>');
        inBlockquote = true;
      }
      processedLines.push(quoteMatch[1]);
      continue;
    } else if (inBlockquote) {
      processedLines.push('</blockquote>');
      inBlockquote = false;
    }
    
    // Check for bulleted list: * item or - item
    const bulletMatch = line.match(/^[\*\-]\s+(.*)$/);
    if (bulletMatch) {
      if (!inBulletList) {
        if (inNumberedList) { processedLines.push('</ol>'); inNumberedList = false; }
        processedLines.push('<ul>');
        inBulletList = true;
      }
      processedLines.push(`<li>${bulletMatch[1]}</li>`);
      continue;
    } else if (inBulletList && line.trim() !== '') {
      processedLines.push('</ul>');
      inBulletList = false;
    }
    
    // Check for numbered list: 1. item
    const numberedMatch = line.match(/^\d+\.\s+(.*)$/);
    if (numberedMatch) {
      if (!inNumberedList) {
        if (inBulletList) { processedLines.push('</ul>'); inBulletList = false; }
        processedLines.push('<ol>');
        inNumberedList = true;
      }
      processedLines.push(`<li>${numberedMatch[1]}</li>`);
      continue;
    } else if (inNumberedList && line.trim() !== '') {
      processedLines.push('</ol>');
      inNumberedList = false;
    }
    
    processedLines.push(line);
  }
  
  // Close any open lists/quotes
  if (inBulletList) processedLines.push('</ul>');
  if (inNumberedList) processedLines.push('</ol>');
  if (inBlockquote) processedLines.push('</blockquote>');
  
  text = processedLines.join('\n');
  
  // Handle code blocks first (``` ... ```) - before other formatting
  // Use a placeholder to prevent inner formatting
  const codeBlocks: string[] = [];
  text = text.replace(/```([\s\S]*?)```/g, (_, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push(`<pre><code>${fallbackEscape(code.trim())}</code></pre>`);
    return `%%CODEBLOCK${idx}%%`;
  });
  
  // Handle inline code (` ... `)
  const inlineCodes: string[] = [];
  text = text.replace(/`([^`]+)`/g, (_, code) => {
    const idx = inlineCodes.length;
    inlineCodes.push(`<code>${fallbackEscape(code)}</code>`);
    return `%%INLINECODE${idx}%%`;
  });
  
  // Now escape HTML for remaining text (preserving our tags)
  // We need to be careful here - escape only the parts that aren't our tags
  text = text.replace(/&/g, '&amp;')
             .replace(/</g, '&lt;')
             .replace(/>/g, '&gt;');
  
  // Restore our HTML tags
  text = text.replace(/&lt;(\/?(strong|em|s|pre|code|blockquote|ul|ol|li|br))&gt;/g, '<$1>');
  
  // Apply inline formatting (order matters - do these after escaping)
  // Bold: *text* (but not **)
  text = text.replace(/\*([^\*\n]+)\*/g, '<strong>$1</strong>');
  
  // Italic: _text_ (but not __)
  text = text.replace(/_([^_\n]+)_/g, '<em>$1</em>');
  
  // Strikethrough: ~text~
  text = text.replace(/~([^~\n]+)~/g, '<s>$1</s>');
  
  // Restore code blocks and inline code
  codeBlocks.forEach((block, idx) => {
    text = text.replace(`%%CODEBLOCK${idx}%%`, block);
  });
  inlineCodes.forEach((code, idx) => {
    text = text.replace(`%%INLINECODE${idx}%%`, code);
  });
  
  // Convert remaining newlines to <br/>
  text = text.replace(/\n/g, '<br/>');
  
  // Final sanitization with DOMPurify to ensure safety while allowing our formatting tags
  if (typeof window !== 'undefined') {
    text = DOMPurify.sanitize(text, {
      ALLOWED_TAGS: ['br', 'b', 'strong', 'em', 'i', 's', 'strike', 'del', 'code', 'pre', 'blockquote', 'ul', 'ol', 'li'],
      ALLOWED_ATTR: [],
      FORBID_TAGS: ['script', 'style', 'iframe', 'canvas'],
    });
  }
  
  return text;
}
