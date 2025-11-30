/**
 * Platform Asset URLs with Local Fallbacks
 * Primary: Publit.io CDN
 * Fallback: Local /assets/ folder
 */

const PRIMARY_CDN = 'https://media.publit.io/file/AO3-Skins-App/';
const LOCAL_FALLBACK = '/assets/';

/**
 * Creates an asset URL object with primary and fallback sources
 */
function createAssetUrl(filename: string): string {
  return `${PRIMARY_CDN}${filename}`;
}

/**
 * Get the local fallback URL for an asset
 */
export function getLocalFallback(filename: string): string {
  return `${LOCAL_FALLBACK}${filename}`;
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
    verifiedBadge: createAssetUrl('twitter-verifiedBadge.png'),
    logo: createAssetUrl('twitter-logo.png'),
    replyIcon: createAssetUrl('twitter-replyIcon.png'),
    retweetIcon: createAssetUrl('twitter-retweetIcon.png'),
    likeIcon: createAssetUrl('twitter-likeIcon.png'),
    viewsIcon: createAssetUrl('twitter-views.png'),
    bookmarkIcon: createAssetUrl('twitter-upload.png'),
  },
  instagram: {
    headerGradient: 'https://i.ibb.co/instagram-gradient.png',
    likeIcon: 'https://i.ibb.co/instagram-heart.png',
    commentIcon: 'https://i.ibb.co/instagram-comment.png',
    locationPin: createAssetUrl('instagram-locationPin.png'),
    verifiedBadge: 'https://i.ibb.co/instagram-verified.png',
  },
  whatsapp: {
    checkmarkSending: createAssetUrl('whatsapp-clockicon.png'),
    checkmarkSent: createAssetUrl('whatsapp-checkmarkSent.png'),
    checkmarkDelivered: createAssetUrl('whatsappcheckmarkDelivered.png'),
    checkmarkRead: createAssetUrl('whatsapp-checkmarkRead.png'),
    onlineIcon: 'https://i.ibb.co/whatsapp-online.png',
    headerImage: createAssetUrl('whatapp-header.png'),
    footerImage: createAssetUrl('whatsapp-footer.png'),
  },
  ios: {
    messageIcon: 'https://i.ibb.co/ios-messages-icon.png',
    bubbleTailBlue: 'https://i.ibb.co/ios-bubble-tail-blue.png',
    bubbleTailGreen: 'https://i.ibb.co/ios-bubble-tail-green.png',
    bubbleTailGrey: 'https://i.ibb.co/ios-bubble-tail-grey.png',
    deliveredIcon: 'https://i.ibb.co/ios-delivered.png',
    headerImage: createAssetUrl('imessage-header.png'),
    footerImage: createAssetUrl('imessage-footer.jpg'),
  },
  discord: {
    logo: '/assets/discord-logo.png',
    hashtagIcon: 'https://i.ibb.co/discord-hashtag.png',
    onlineStatus: 'https://i.ibb.co/discord-online.png',
  },
  google: {
    logo: createAssetUrl('google-logo-long.png'),
    searchIcon: createAssetUrl('google-search-glass.png'),
    micIcon: createAssetUrl('google-mic-270775.png'),
    lensIcon: createAssetUrl('google-camera-lens.png'),
    clearIcon: createAssetUrl('google-clear-X.png'),
  },
  tinder: {
    verifiedBadge: createAssetUrl('tinder-verified.png'),
    rewindButton: createAssetUrl('tinder-rewind.png'),
    passButton: createAssetUrl('tinder-pass.png'),
    superLikeButton: createAssetUrl('tinder-superlike.png'),
    likeButton: createAssetUrl('tinder-like.png'),
    boostButton: createAssetUrl('tinder-boost.png'),
    distancePin: createAssetUrl('tinder-distance-pin.png'),
    infoButton: createAssetUrl('tinder-info.png'),
  }
};

/**
 * Map of available local fallback assets
 * These files exist in /public/assets/
 */
export const LOCAL_ASSETS: Record<string, boolean> = {
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
 * Handle image load error by falling back to local asset
 */
export function handleImageError(
  event: React.SyntheticEvent<HTMLImageElement>,
  fallbackFilename?: string
): void {
  const img = event.currentTarget;
  const currentSrc = img.src;
  
  // Avoid infinite loop - don't retry if already using local
  if (currentSrc.startsWith('/assets/') || currentSrc.includes('localhost')) {
    return;
  }
  
  const filename = fallbackFilename || getFilenameFromUrl(currentSrc);
  
  if (LOCAL_ASSETS[filename]) {
    img.src = getLocalFallback(filename);
  }
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
