/**
 * Platform Asset URLs - Hybrid CDN + Local Fallback Strategy
 * 
 * APPROACH:
 * - Primary: Publit.io CDN for stable platform icons (Twitter, WhatsApp, Google, etc.)
 * - Fallback: Local /assets/ folder as backup if CDN fails
 * - Avatars: See characterBank.ts for 30 curated options + custom URL support
 */

const PUBLIT_CDN = 'https://media.publit.io/file/AO3-Skins-App';
const LOCAL_ASSETS = '/assets/';

/**
 * Creates a Publit.io CDN URL
 */
function cdnUrl(filename: string): string {
  return `${PUBLIT_CDN}/${filename}`;
}

/**
 * Get local asset URL (fallback)
 */
export function getLocalFallback(filename: string): string {
  return `${LOCAL_ASSETS}${filename}`;
}

/**
 * Extract filename from a full URL (for use in onError handlers)
 */
export function getFilenameFromUrl(url: string): string {
  const parts = url.split('/');
  return parts[parts.length - 1];
}

export const PLATFORM_ASSETS = {
  twitter: {
    verifiedBadge: 'https://media.publit.io/file/AO3-Skins-App/twitter-verifiedBadge.png',
    logo: 'https://media.publit.io/file/AO3-Skins-App/twitter-logo.png',
    replyIcon: 'https://media.publit.io/file/AO3-Skins-App/twitter-replyIcon.png',
    retweetIcon: 'https://media.publit.io/file/AO3-Skins-App/twitter-retweetIcon.png',
    likeIcon: 'https://media.publit.io/file/AO3-Skins-App/twitter-likeIcon.png',
    viewsIcon: 'https://media.publit.io/file/AO3-Skins-App/twitter-views.png',
    bookmarkIcon: 'https://media.publit.io/file/AO3-Skins-App/twitter-upload.png',
    // Dark mode gray variants
    replyIconGrey: 'https://media.publit.io/file/AO3-Skins-App/twitter-reply.png',
    retweetIconGrey: 'https://media.publit.io/file/AO3-Skins-App/twitter-retweet-grey.png',
    likeIconGrey: 'https://media.publit.io/file/AO3-Skins-App/twitter-like-grey.png',
    logoGrey: 'https://media.publit.io/file/AO3-Skins-App/twitter-x-icon-grey.png',
  },
  instagram: {
    headerGradient: 'https://media.publit.io/file/AO3-Skins-App/instagram-logo.png',
    likeIcon: 'https://media.publit.io/file/AO3-Skins-App/instagram-logo.png',
    commentIcon: 'https://media.publit.io/file/AO3-Skins-App/instagram-logo.png',
    locationPin: 'https://media.publit.io/file/AO3-Skins-App/instagram-locationPin.png',
    verifiedBadge: 'https://media.publit.io/file/AO3-Skins-App/instagram-logo.png',
  },
  whatsapp: {
    checkmarkSending: 'https://media.publit.io/file/AO3-Skins-App/whatsapp-clockicon.png',
    checkmarkSent: 'https://media.publit.io/file/AO3-Skins-App/whatsapp-checkmarkSent.png',
    checkmarkDelivered: 'https://media.publit.io/file/AO3-Skins-App/whatsappcheckmarkDelivered.png',
    checkmarkRead: 'https://media.publit.io/file/AO3-Skins-App/whatsapp-checkmarkRead.png',
    onlineIcon: 'https://media.publit.io/file/AO3-Skins-App/whatsapp-logo.png',
    headerImage: 'https://media.publit.io/file/AO3-Skins-App/whatapp-header.png',
    footerImage: 'https://media.publit.io/file/AO3-Skins-App/whatsapp-footer.png',
  },
  ios: {
    messageIcon: 'https://media.publit.io/file/AO3-Skins-App/imessage-logo.png',
    bubbleTailBlue: 'https://media.publit.io/file/AO3-Skins-App/imessage-logo.png',
    bubbleTailGreen: 'https://media.publit.io/file/AO3-Skins-App/imessage-logo.png',
    bubbleTailGrey: 'https://media.publit.io/file/AO3-Skins-App/imessage-logo.png',
    deliveredIcon: 'https://media.publit.io/file/AO3-Skins-App/imessage-logo.png',
    headerImage: 'https://media.publit.io/file/AO3-Skins-App/imessage-header.png',
    footerImage: 'https://media.publit.io/file/AO3-Skins-App/imessage-footer.jpg',
  },
  discord: {
    logo: 'https://media.publit.io/file/AO3-Skins-App/discord-logo.png',
    hashtagIcon: 'https://media.publit.io/file/AO3-Skins-App/discord-logo.png',
    onlineStatus: 'https://media.publit.io/file/AO3-Skins-App/discord-logo.png',
  },
  google: {
    logo: 'https://media.publit.io/file/AO3-Skins-App/google-logo-long.png',
    searchIcon: 'https://media.publit.io/file/AO3-Skins-App/google-search-glass.png',
    micIcon: 'https://media.publit.io/file/AO3-Skins-App/google-mic-270775.png',
    lensIcon: 'https://media.publit.io/file/AO3-Skins-App/google-search-glass.png',
    clearIcon: 'https://media.publit.io/file/AO3-Skins-App/google-clear-X.png',
  },
  tinder: {
    verifiedBadge: 'https://media.publit.io/file/AO3-Skins-App/tinder-logo.png',
    rewindButton: 'https://media.publit.io/file/AO3-Skins-App/tinder-logo.png',
    passButton: 'https://media.publit.io/file/AO3-Skins-App/tinder-logo.png',
    superLikeButton: 'https://media.publit.io/file/AO3-Skins-App/tinder-logo.png',
    likeButton: 'https://media.publit.io/file/AO3-Skins-App/tinder-logo.png',
    boostButton: 'https://media.publit.io/file/AO3-Skins-App/tinder-logo.png',
    distancePin: 'https://media.publit.io/file/AO3-Skins-App/tinder-logo.png',
    infoButton: 'https://media.publit.io/file/AO3-Skins-App/tinder-logo.png',
  }
};

/**
 * Map of available local assets
 * These files exist in /public/assets/
 */
export const LOCAL_ASSETS_MAP: Record<string, boolean> = {
  // Twitter
  'twitter-verifiedBadge.png': true,
  'twitter-logo.png': true,
  'twitter-replyIcon.png': true,
  'twitter-retweetIcon.png': true,
  'twitter-likeIcon.png': true,
  'twitter-views.png': true,
  'twitter-upload.png': true,
  // WhatsApp
  'whatsapp-clockicon.png': true,
  'whatsapp-checkmarkSent.png': true,
  'whatsappcheckmarkDelivered.png': true,
  'whatsapp-checkmarkRead.png': true,
  'whatsapp-logo.png': true,
  'whatapp-header.png': true,
  'whatsapp-footer.png': true,
  // iOS/iMessage
  'imessage-logo.png': true,
  'imessage-header.png': true,
  'imessage-footer.jpg': true,
  // Other platforms
  'discord-logo.png': true,
  'google-logo-long.png': true,
  'google-search-glass.png': true,
  'google-mic-270775.png': true,
  'google-clear-X.png': true,
  'instagram-logo.png': true,
  'tinder-logo.png': true,
  'email-logo.png': true,
};

/**
 * Handle image load error - now just logs since we use local assets
 */
export function handleImageError(
  event: React.SyntheticEvent<HTMLImageElement>,
  fallbackFilename?: string
): void {
  const img = event.currentTarget;
  console.warn(`Image failed to load: ${img.src}`);
  // Since we're using local assets, no external fallback needed
}

/**
 * Placeholder/fallback text if images fail completely
 */
export const FALLBACK_TEXT = {
  twitter: {
    verified: '✓',
    bird: '🐦',
    reply: '↩',
    retweet: '🔁',
    like: '❤',
  },
  instagram: {
    like: '❤',
    comment: '💬',
    location: '📍',
    verified: '✓',
  },
  whatsapp: {
    checkSent: '✓',
    checkDelivered: '✓✓',
    checkRead: '✓✓',
  },
  ios: {
    delivered: 'Delivered',
  },
  discord: {
    hashtag: '#',
  },
};
