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
    verifiedBadge: '/assets/twitter-verifiedBadge.png',
    logo: '/assets/twitter-logo.png',
    replyIcon: '/assets/twitter-replyIcon.png',
    retweetIcon: '/assets/twitter-retweetIcon.png',
    likeIcon: '/assets/twitter-likeIcon.png',
    viewsIcon: '/assets/twitter-views.png',
    bookmarkIcon: '/assets/twitter-upload.png',
    // Dark mode gray variants — fall back to light versions if no local grey copy
    replyIconGrey: '/assets/twitter-replyIcon.png',
    retweetIconGrey: '/assets/twitter-retweetIcon.png',
    likeIconGrey: '/assets/twitter-likeIcon.png',
    logoGrey: '/assets/twitter-logo.png',
  },
  instagram: {
    headerGradient: '/assets/instagram-logo.png',
    likeIcon: '/assets/instagram-logo.png',
    commentIcon: '/assets/instagram-logo.png',
    locationPin: '/assets/instagram-logo.png',
    verifiedBadge: '/assets/instagram-logo.png',
  },
  whatsapp: {
    checkmarkSending: '/assets/whatsapp-clockicon.png',
    checkmarkSent: '/assets/whatsapp-checkmarkSent.png',
    checkmarkDelivered: '/assets/whatsappcheckmarkDelivered.png',
    checkmarkRead: '/assets/whatsapp-checkmarkRead.png',
    onlineIcon: '/assets/whatsapp-logo.png',
    headerImage: '/assets/whatapp-header.png',
    footerImage: '/assets/whatsapp-footer.png',
  },
  ios: {
    messageIcon: '/assets/imessage-logo.png',
    bubbleTailBlue: '/assets/imessage-logo.png',
    bubbleTailGreen: '/assets/imessage-logo.png',
    bubbleTailGrey: '/assets/imessage-logo.png',
    deliveredIcon: '/assets/imessage-logo.png',
    headerImage: '/assets/imessage-header.png',
    footerImage: '/assets/imessage-footer.jpg',
  },
  discord: {
    logo: '/assets/discord-logo.png',
    hashtagIcon: '/assets/discord-logo.png',
    onlineStatus: '/assets/discord-logo.png',
  },
  google: {
    logo: '/assets/google-logo-long.png',
    searchIcon: '/assets/google-search-glass.png',
    micIcon: '/assets/google-mic-270775.png',
    lensIcon: '/assets/google-search-glass.png',
    clearIcon: '/assets/google-clear-X.png',
  },
  tinder: {
    verifiedBadge: '/assets/tinder-logo.png',
    rewindButton: '/assets/tinder-logo.png',
    passButton: '/assets/tinder-logo.png',
    superLikeButton: '/assets/tinder-logo.png',
    likeButton: '/assets/tinder-logo.png',
    boostButton: '/assets/tinder-logo.png',
    distancePin: '/assets/tinder-logo.png',
    infoButton: '/assets/tinder-logo.png',
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
