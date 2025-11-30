export type Attachment = { type: 'image'; url: string; alt?: string };

export interface TwitterCharacter {
  id: string;
  name: string;
  handle: string;
  avatarUrl?: string;
  verified?: boolean;
}

export interface Message {
  id: string;
  sender: string;
  avatarUrl?: string;
  content: string; // raw user text (sanitized before emit)
  timestamp?: string;
  outgoing: boolean; // true = author perspective sender bubble
  attachments?: Attachment[];
  roleColor?: string; // Discord role/name color
  // Chat-specific enhancements
  status?: 'sending' | 'sent' | 'delivered' | 'read'; // message delivery status
  reaction?: string; // emoji reaction to this message
  useCustomIdentity?: boolean; // For Twitter: override main account identity
  // Twitter-specific per-tweet metrics
  twitterLikes?: number;
  twitterRetweets?: number;
  twitterReplies?: number;
  twitterViews?: number;
  twitterBookmarks?: number;
  twitterHandle?: string; // Custom @handle for this tweet (when useCustomIdentity is true)
  verified?: boolean; // Twitter verified badge for this tweet (when useCustomIdentity is true)
  // Twitter thread support
  parentId?: string; // ID of parent tweet for replies (undefined = main thread tweet)
  replyToHandles?: string[]; // Handles to show in "Replying to @user1 and @user2"
  expandedView?: boolean; // Show as expanded reply (larger text, no avatar/header, just name + replying-to + body)
  // iOS-specific: Time break before this message
  showTimeBreak?: boolean; // Show "5 minutes later" or timestamp before this message
  timeBreakText?: string; // Custom text like "5 minutes later", "Later that evening"
  // iOS/Chat typing indicator
  isTyping?: boolean; // Show typing indicator (replaces content with "...")
  // Google Search specific: search result properties
  googleResultUrl?: string; // The URL displayed in green
  googleResultDescription?: string; // The snippet/description below the title
}
export interface SkinSettings {
  bubbleOpacity: number; // 0..1
  senderColor: string; // hex
  receiverColor: string; // hex
  fontFamily: string;
  maxWidthPx: number;
  useDarkNeutral: boolean;
  watermark: boolean;
  // Twitter specific settings
  twitterDisplayName?: string; // e.g., "John Doe"
  twitterHandle?: string; // e.g., "@johndoe"
  twitterVerified?: boolean;
  twitterAvatarUrl?: string; // profile picture
  twitterLikes?: number; // DEPRECATED: use per-tweet metrics instead
  twitterRetweets?: number; // DEPRECATED: use per-tweet metrics instead
  twitterReplies?: number; // DEPRECATED: use per-tweet metrics instead
  twitterShowMetrics?: boolean;
  twitterTimestamp?: string; // full date/time line (e.g., "3:09 PM · 5 May 2014")
  twitterThreadMode?: boolean; // Enable thread view with connecting lines
  twitterCharacterPresets?: TwitterCharacter[]; // Saved character profiles for quick access
  // Quote Tweet (embedded) optional block
  twitterQuoteEnabled?: boolean;
  twitterQuoteAvatar?: string;
  twitterQuoteName?: string;
  twitterQuoteHandle?: string;
  twitterQuoteVerified?: boolean;
  twitterQuoteText?: string;
  twitterQuoteImage?: string;
  // Google specific settings
  googleQuery?: string; // the main search query
  googleSuggestions?: string[]; // autocomplete dropdown suggestions
  googleShowStats?: boolean; // toggle to show result statistics
  googleResultsCount?: string; // e.g. "About 24,040,000,000 results"
  googleResultsTime?: string; // e.g. "0.56 seconds"
  googleShowDidYouMean?: boolean; // toggle for correction
  googleDidYouMean?: string; // correction term (Captain Jack Sparrow)
  googleEngineVariant?: 'google' | 'google-old' | 'naver';
  // Note specific settings
  noteStyle?: 'system' | 'document' | 'letter' | 'simple'; // different note types
  noteAlignment?: 'center' | 'left' | 'right';
  // Email specific settings
  emailFrom?: string;
  emailTo?: string;
  emailSubject?: string;
  emailBody?: string;
  emailDate?: string;
  emailCC?: string;
  emailStyle?: 'gmail' | 'outlook' | 'apple'; // email client style
  emailThreadMode?: boolean; // show as email thread instead of single email
  // Tinder Profile Settings
  datingProfileName?: string;
  datingProfileAge?: string;
  datingProfileBio?: string;
  datingProfilePhoto?: string;
  datingProfileDistance?: string; // e.g., "2 kilometers away"
  datingProfileLocation?: string; // e.g., "Lives in Paris"
  datingProfileInterests?: string[]; // Passions tags
  datingProfileJob?: string; // e.g., "Software Engineer at Google"
  datingProfileEducation?: string; // e.g., "Harvard University"
  datingProfileHeight?: string; // e.g., "175 cm"
  datingProfileVerified?: boolean; // blue checkmark
  datingShowActionButtons?: boolean; // show like/pass/super like buttons
  datingLookingFor?: string; // e.g., "Long-term partner", "Something casual"
  // Sticky Note specific settings
  stickyNoteColor?: 'yellow' | 'pink' | 'blue' | 'green'; // post-it colors
  stickyNoteText?: string;
  stickyNoteHandwriting?: boolean; // use handwriting-style font
  // Instagram specific
  instagramUsername?: string; // direct username field (not override)
  instagramAvatarUrl?: string; // dedicated avatar for post
  instagramImageUrl?: string; // main post image
  instagramCaption?: string; // post caption text
  instagramLocation?: string; // location tag (e.g., "Paris, France")
  instagramShowLikes?: boolean; // toggle to show likes
  instagramLikes?: number;
  instagramShowComments?: boolean; // toggle to show comment count
  instagramCommentsCount?: number;
  instagramTimestamp?: string; // natural language: "2 hours ago", "May 5"
  // Discord specific
  discordChannelName?: string;
  discordServerName?: string; // new: server context
  discordShowHeader?: boolean;
  discordDarkMode?: boolean;
  discordRolePresets?: Array<{name: string; color: string}>; // new: save common roles
  // iOS/Android chat enhancements
  chatContactName?: string; // "Conversation with..." header (shown at top)
  chatShowTyping?: boolean; // show typing indicator
  chatTypingName?: string; // who is typing (not needed for 1-on-1)
  iosMode?: 'imessage' | 'sms'; // iOS message type (blue vs green)
  iosShowReadReceipt?: boolean; // Show "Read" under last message
  iosShowHeader?: boolean; // Show "To:" label toggle
  iosShowDelivered?: boolean; // Show "Delivered" indicator
  // iOS Authentic 1-on-1 System
  iosContactName?: string; // The other person's name (shown in header only)
  iosAutoAlternate?: boolean; // Auto-alternate between you and them
  // iOS UI Elements (optional)
  iosShowStatusBar?: boolean; // Show status bar at top (time, signal, battery)
  iosStatusBarTime?: string; // Status bar time (default: "9:41")
  iosShowInputBar?: boolean; // Show input bar at bottom
  iosInputPlaceholder?: string; // Input bar placeholder text (default: "iMessage")
  iosHeaderImageUrl?: string; // Header background image URL
  iosFooterImageUrl?: string; // Footer background image URL
  iosAvatarUrl?: string; // User's avatar image to overlay on header
  androidShowStatus?: boolean; // "Online" / "Last seen"
  androidStatusText?: string; // custom status text
  androidCheckmarks?: boolean; // show ✓✓ checkmarks
  androidWhatsAppMode?: boolean; // use authentic WhatsApp colors
  androidHeaderImageUrl?: string; // Header background image URL
  androidFooterImageUrl?: string; // Footer background image URL
  androidAvatarUrl?: string; // User's avatar image to overlay on header
  androidContactName?: string; // Contact name for header
  androidShowReadReceipt?: boolean; // Show read status
  androidAutoAlternate?: boolean; // Auto-alternate messages
}
export interface SkinProject {
  id: string;
  template: 'ios' | 'android' | 'twitter' | 'google';
  settings: SkinSettings;
  messages: Message[];
}

export const defaultProject = (): SkinProject => ({
  id: 'default-project',
  template: 'ios',
  settings: {
    bubbleOpacity: 0.9,
    senderColor: '#1d9bf0',
    receiverColor: '#ececec',
    fontFamily: 'Arial, Helvetica, sans-serif',
    maxWidthPx: 400,
    useDarkNeutral: true,
    watermark: true,
    twitterHandle: '',
    twitterVerified: false,
    twitterLikes: 0,
    twitterRetweets: 0,
    twitterReplies: 0,
    twitterShowMetrics: true,
    twitterTimestamp: '',
    twitterQuoteEnabled: false,
    twitterQuoteAvatar: '',
    twitterQuoteName: '',
    twitterQuoteHandle: '',
    twitterQuoteVerified: false,
    twitterQuoteText: '',
    twitterQuoteImage: '',
    googleQuery: '',
    googleSuggestions: [],
    googleShowStats: true,
    googleResultsCount: 'About 24,040,000,000 results',
    googleResultsTime: '0.56 seconds',
    googleShowDidYouMean: false,
    googleDidYouMean: '',
    googleEngineVariant: 'google',
    emailFrom: 'sender@example.com',
    emailTo: 'recipient@example.com',
    emailSubject: 'Re: Important Update',
    emailBody: 'Hi there,\n\nThank you for your message. I wanted to follow up on our previous conversation...\n\nBest regards,\nSender Name',
    emailDate: 'Nov 22, 2025, 3:14 PM',
    emailCC: '',
    emailStyle: 'gmail',
    emailThreadMode: false,
    datingProfileName: 'Alex',
    datingProfileAge: '28',
    datingProfileBio: 'Love coffee, hiking, and good books 📚☕🏔️',
    datingProfilePhoto: '',
    datingProfileDistance: '2 kilometers away',
    datingProfileLocation: '',
    datingProfileInterests: ['Music', 'Travel', 'Photography'],
    datingProfileJob: '',
    datingProfileEducation: '',
    datingProfileHeight: '',
    datingProfileVerified: false,
    datingShowActionButtons: true,
    datingLookingFor: '',
    stickyNoteColor: 'yellow',
    stickyNoteText: 'Don\'t forget!',
    stickyNoteHandwriting: true,
    instagramUsername: '',
    instagramAvatarUrl: '',
    instagramImageUrl: '',
    instagramCaption: '',
    instagramLocation: '',
    instagramShowLikes: false,
    instagramLikes: 0,
    instagramShowComments: false,
    instagramCommentsCount: 0,
    instagramTimestamp: '',
    discordChannelName: 'general',
    discordServerName: '',
    discordShowHeader: true,
    discordDarkMode: true,
    discordRolePresets: [
      { name: 'Admin', color: '#ED4245' },
      { name: 'Moderator', color: '#5865F2' },
      { name: 'Member', color: '#B9BBBE' }
    ],
    chatContactName: '',
    chatShowTyping: false,
    chatTypingName: '',
    iosMode: 'imessage',
    iosContactName: '',
    iosShowReadReceipt: true,
    iosAutoAlternate: true,
    iosShowStatusBar: false,
    iosStatusBarTime: '9:41',
    iosShowInputBar: false,
    iosInputPlaceholder: 'iMessage',
    iosHeaderImageUrl: 'https://media.publit.io/file/AO3-Skins-App/imessage-header.png',
    iosFooterImageUrl: 'https://media.publit.io/file/AO3-Skins-App/imessage-footer.jpg',
    iosAvatarUrl: '',
    androidShowStatus: true,
    androidStatusText: 'online',
    androidCheckmarks: true,
    androidWhatsAppMode: true,
    androidHeaderImageUrl: 'https://media.publit.io/file/AO3-Skins-App/whatapp-header.png',
    androidFooterImageUrl: 'https://media.publit.io/file/AO3-Skins-App/whatsapp-footer.png',
    androidAvatarUrl: '',
    androidContactName: '',
    androidShowReadReceipt: true,
    androidAutoAlternate: true,
    twitterDisplayName: '',
    twitterAvatarUrl: '',
  },
  messages: [
    {
      id: 'default-msg-1',
      sender: 'You',
      content: 'Where are you? i dont know but i know you are an idiot and i will mess you up if you dont keep quite',
      outgoing: true,
      timestamp: '10:15',
      status: 'read'
    },
    {
      id: 'default-msg-2',
      sender: 'Alice',
      content: 'On my way. lets see what you can actually do dickhead!!',
      outgoing: false,
      timestamp: '10:15'
    }
  ],
});
