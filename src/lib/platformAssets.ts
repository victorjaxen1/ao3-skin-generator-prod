/**
 * Platform Asset URLs
 * Hosted on Cloudinary/imgbb for authentic platform icons and graphics
 * Replace these URLs with your own hosted assets
 */

export const PLATFORM_ASSETS = {
  twitter: {
    verifiedBadge: 'https://media.publit.io/file/AO3-Skins-App/twitter-verifiedBadge.png', // 16x16px blue checkmark
    logo: 'https://media.publit.io/file/AO3-Skins-App/twitter-logo.png', // 16x16px X/Twitter logo
    replyIcon: 'https://media.publit.io/file/AO3-Skins-App/twitter-replyIcon.png', // 14x14px reply arrow
    retweetIcon: 'https://media.publit.io/file/AO3-Skins-App/twitter-retweetIcon.png', // 14x14px retweet icon
    likeIcon: 'https://media.publit.io/file/AO3-Skins-App/twitter-likeIcon.png', // 14x14px heart
    viewsIcon: 'https://media.publit.io/file/AO3-Skins-App/twitter-views.png', // Views icon
    bookmarkIcon: 'https://media.publit.io/file/AO3-Skins-App/twitter-upload.png', // Bookmark icon
  },
  instagram: {
    headerGradient: 'https://i.ibb.co/instagram-gradient.png', // Purple-pink gradient (placeholder)
    likeIcon: 'https://i.ibb.co/instagram-heart.png', // Red heart (placeholder)
    commentIcon: 'https://i.ibb.co/instagram-comment.png', // Comment icon (placeholder)
    locationPin: 'https://media.publit.io/file/AO3-Skins-App/instagram-locationPin.png', // 12x12px location pin
    verifiedBadge: 'https://i.ibb.co/instagram-verified.png', // Blue checkmark (placeholder)
  },
  whatsapp: {
    checkmarkSending: 'https://media.publit.io/file/AO3-Skins-App/whatsapp-clockicon.png', // Clock icon for pending
    checkmarkSent: 'https://media.publit.io/file/AO3-Skins-App/whatsapp-checkmarkSent.png', // Grey single check
    checkmarkDelivered: 'https://media.publit.io/file/AO3-Skins-App/whatsappcheckmarkDelivered.png', // Grey double check
    checkmarkRead: 'https://media.publit.io/file/AO3-Skins-App/whatsapp-checkmarkRead.png', // Blue double check
    onlineIcon: 'https://i.ibb.co/whatsapp-online.png', // Green dot (placeholder)
    headerImage: 'https://media.publit.io/file/AO3-Skins-App/whatapp-header.png', // WhatsApp header background
    footerImage: 'https://media.publit.io/file/AO3-Skins-App/whatsapp-footer.png', // WhatsApp footer background
  },
  ios: {
    messageIcon: 'https://i.ibb.co/ios-messages-icon.png', // Messages app icon
    bubbleTailBlue: 'https://i.ibb.co/ios-bubble-tail-blue.png', // Blue tail (PNG with transparency)
    bubbleTailGreen: 'https://i.ibb.co/ios-bubble-tail-green.png', // Green tail
    bubbleTailGrey: 'https://i.ibb.co/ios-bubble-tail-grey.png', // Grey tail
    deliveredIcon: 'https://i.ibb.co/ios-delivered.png',
    headerImage: 'https://media.publit.io/file/AO3-Skins-App/imessage-header.png', // iMessage header background
    footerImage: 'https://media.publit.io/file/AO3-Skins-App/imessage-footer.jpg', // iMessage footer background
  },
  discord: {
    logo: 'https://i.ibb.co/discord-logo.png',
    hashtagIcon: 'https://i.ibb.co/discord-hashtag.png',
    onlineStatus: 'https://i.ibb.co/discord-online.png', // Green circle
  },
  google: {
    logo: 'https://media.publit.io/file/AO3-Skins-App/google-logo-long.png', // Google full color logo
    searchIcon: 'https://media.publit.io/file/AO3-Skins-App/google-search-glass.png', // Magnifying glass
    micIcon: 'https://media.publit.io/file/AO3-Skins-App/google-mic-270775.png', // Microphone (colorful)
    lensIcon: 'https://media.publit.io/file/AO3-Skins-App/google-camera-lens.png', // Google Lens camera
    clearIcon: 'https://media.publit.io/file/AO3-Skins-App/google-clear-X.png', // X to clear search
  },
  tinder: {
    verifiedBadge: 'https://media.publit.io/file/AO3-Skins-App/tinder-verified.png', // Blue checkmark badge
    rewindButton: 'https://media.publit.io/file/AO3-Skins-App/tinder-rewind.png', // Yellow rewind icon
    passButton: 'https://media.publit.io/file/AO3-Skins-App/tinder-pass.png', // Red X
    superLikeButton: 'https://media.publit.io/file/AO3-Skins-App/tinder-superlike.png', // Blue star
    likeButton: 'https://media.publit.io/file/AO3-Skins-App/tinder-like.png', // Green heart
    boostButton: 'https://media.publit.io/file/AO3-Skins-App/tinder-boost.png', // Purple lightning
    distancePin: 'https://media.publit.io/file/AO3-Skins-App/tinder-distance-pin.png', // Location pin icon
    infoButton: 'https://media.publit.io/file/AO3-Skins-App/tinder-info.png', // Info/details button
  }
};

/**
 * Placeholder/fallback assets if hosted images fail to load
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
