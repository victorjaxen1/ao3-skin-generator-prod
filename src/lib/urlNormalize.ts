/**
 * URL Normalization for Image Sources
 *
 * Converts "share page" URLs from common hosting services into
 * direct CDN image URLs the browser can load as <img src>.
 *
 * Adapted from the WorldKonstruct image pipeline reference document.
 */

// ─── Core Normalization ──────────────────────────────────────────────────────

/**
 * Convert a user-pasted URL to a loadable direct image URL.
 * Call this synchronously before setting any img.src.
 */
export function normalizeImageUrl(raw: string): string {
  if (!raw || raw.trim() === '') return raw;
  let url = raw.trim();

  // Strip %20 from hostnames (copy-paste artifact from line-wrapped text)
  url = cleanHostEncoding(url);

  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const path = u.pathname;

    // ── Google Drive ─────────────────────────────────────────────────────────
    // /file/d/{ID}/...  or  /open?id={ID}  or  /uc?id={ID}  or  /thumbnail?id={ID}
    if (host === 'drive.google.com') {
      const fileMatch = path.match(/\/file\/d\/([^/]+)/);
      if (fileMatch) return `https://lh3.googleusercontent.com/d/${fileMatch[1]}`;

      const idParam = u.searchParams.get('id');
      if (idParam) return `https://lh3.googleusercontent.com/d/${idParam}`;
    }

    // Already a normalized Drive CDN URL — pass through
    if (host === 'lh3.googleusercontent.com') return url;

    // ── Dropbox ──────────────────────────────────────────────────────────────
    // ?dl=0 → ?raw=1  (enables browser-loadable direct download)
    if ((host === 'dropbox.com' || host === 'www.dropbox.com') && u.searchParams.get('dl') === '0') {
      u.searchParams.set('dl', '1');
      return u.toString();
    }
    if ((host === 'dl.dropboxusercontent.com')) return url;

    // ── Imgur ────────────────────────────────────────────────────────────────
    // Gallery share page imgur.com/{ID} → i.imgur.com/{ID}.jpg
    if (host === 'imgur.com' || host === 'www.imgur.com') {
      const idMatch = path.match(/^\/([a-zA-Z0-9]+)$/);
      const hasImageExt = /\.(jpg|jpeg|png|gif|webp|mp4)$/i.test(path);
      if (idMatch && !hasImageExt) {
        return `https://i.imgur.com/${idMatch[1]}.jpg`;
      }
    }
    // i.imgur.com — already direct
    if (host === 'i.imgur.com') return url;

    // ── ImgBB share page → direct image ─────────────────────────────────────
    // ibb.co/{ID} → i.ibb.co/{ID}/... can't resolve without the slug, pass through
    // i.ibb.co is already direct
    if (host === 'i.ibb.co') return url;

    // ── PostImg ──────────────────────────────────────────────────────────────
    if (host === 'i.postimg.cc') return url;

    // ── pCloud ───────────────────────────────────────────────────────────────
    // pCloud share pages with ?code= param
    if (host.includes('pcloud.link') || host.includes('pcloud.com')) {
      const code = url.match(/code=([A-Za-z0-9]+)/)?.[1];
      if (code && host !== 'api.pcloud.com') {
        return `https://api.pcloud.com/getpubthumb?code=${code}&size=1024x1024&crop=0&type=auto`;
      }
    }

    // ── Pinterest ────────────────────────────────────────────────────────────
    // i.pinimg.com is the direct CDN — pass through
    if (host === 'i.pinimg.com') return url;
    // pinterest.com/pin/* pages can't be resolved client-side — return as-is with warning

    // ── Wikimedia / Wikipedia ────────────────────────────────────────────────
    if (host === 'en.wikipedia.org' || host === 'wikipedia.org') {
      // Extract file name from /wiki/File:Example.jpg if possible
      const fileMatch = path.match(/\/wiki\/File:(.+)/);
      if (fileMatch) {
        const name = decodeURIComponent(fileMatch[1]).replace(/ /g, '_');
        // Best-effort: Wikimedia commons thumb URL pattern
        // upload.wikimedia.org has a predictable path, but MD5 prefix is opaque — pass through
        return url;
      }
    }

    // ── Discord CDN ──────────────────────────────────────────────────────────
    // cdn.discordapp.com attachments expire — pass through (warning is shown by getExpiringUrlWarning)
    if (host === 'cdn.discordapp.com' || host === 'media.discordapp.net') return url;

    // All other URLs — pass through unchanged
    return url;
  } catch {
    // Malformed URL — return as entered
    return url;
  }
}

// ─── Expiring URL Detection ──────────────────────────────────────────────────

const EXPIRING_PATTERNS: { pattern: RegExp; message: string }[] = [
  {
    pattern: /cdn\.discordapp\.com\/attachments\//i,
    message: '⚠️ Discord attachment URLs expire in 24 hours. Right-click the image → "Copy image address" and re-host on imgbb.com for a permanent link.',
  },
  {
    pattern: /media\.discordapp\.net\//i,
    message: '⚠️ Discord media URLs expire quickly. Re-host the image on imgbb.com for a permanent link.',
  },
  {
    pattern: /oaidalleapiprodscus\.blob\.core\.windows\.net/i,
    message: '⚠️ DALL-E image URLs expire in ~2 hours. Save the image and upload it to imgbb.com first.',
  },
  {
    pattern: /wixmp\.com.*token=/i,
    message: '⚠️ This DeviantArt/Wix URL contains a temporary access token and may expire. Consider re-hosting on imgbb.com.',
  },
  {
    pattern: /[?&]token=[A-Za-z0-9._-]{10,}/i,
    message: '⚠️ This URL contains a token and may expire. If it stops loading, re-host the image on imgbb.com.',
  },
];

/**
 * Returns a warning string if the URL is known to expire, otherwise null.
 */
export function getExpiringUrlWarning(url: string): string | null {
  if (!url) return null;
  for (const { pattern, message } of EXPIRING_PATTERNS) {
    if (pattern.test(url)) return message;
  }
  return null;
}

// ─── URL Validity Check ──────────────────────────────────────────────────────

const IMAGE_EXTENSIONS = /\.(jpe?g|png|gif|webp|svg|bmp|avif|ico)($|\?|\/)/i;

const KNOWN_IMAGE_DOMAINS = [
  'i.imgur.com',
  'i.ibb.co',
  'i.postimg.cc',
  'cdn.midjourney.com',
  'i.pinimg.com',
  'live.staticflickr.com',
  'lh3.googleusercontent.com',
  'images.unsplash.com',
  'upload.wikimedia.org',
  'api.pcloud.com',
  'dl.dropboxusercontent.com',
  'cdn.discordapp.com',
  'media.discordapp.net',
];

const KNOWN_IMAGE_DOMAIN_PATTERNS = [
  /^cdna?\.artstation\.com$/,
  /^.*\.wikia\.nocookie\.net$/,
  /^encrypted-tbn\d*\.gstatic\.com$/,
  /^.*\.staticflickr\.com$/,
  /^.*\.deviantart\.net$/,
  /^.*\.tumblr\.com$/,
  /^media[0-9]*\.giphy\.com$/,
];

/**
 * Returns true if the URL looks like it points directly to an image.
 * Used to validate user-pasted URLs before saving.
 */
export function isImageUrl(url: string): boolean {
  if (!url) return false;

  // data: URI
  if (url.startsWith('data:image/')) return true;

  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const path = u.pathname.toLowerCase();

    // Check extension (handles Wikia's /file.jpg/revision/latest/... pattern)
    if (IMAGE_EXTENSIONS.test(path)) return true;

    // Check known direct-image domains
    if (KNOWN_IMAGE_DOMAINS.includes(host)) return true;

    // Check pattern-matched domains
    if (KNOWN_IMAGE_DOMAIN_PATTERNS.some(p => p.test(host))) return true;

    return false;
  } catch {
    return false;
  }
}

// ─── Helpful URL description for hints ──────────────────────────────────────

/**
 * Returns true if the normalize function changed the URL (i.e., it was a share page, not a direct image).
 */
export function wasNormalized(original: string, normalized: string): boolean {
  return original.trim() !== normalized && normalized !== original.trim();
}

// ─── Internal Helpers ────────────────────────────────────────────────────────

function cleanHostEncoding(url: string): string {
  try {
    const u = new URL(url);
    const cleaned = u.hostname.replace(/%20/gi, '').replace(/\s+/g, '');
    if (cleaned !== u.hostname) {
      u.hostname = cleaned;
      return u.toString();
    }
  } catch {
    // not a valid URL yet, return as-is
  }
  return url;
}
