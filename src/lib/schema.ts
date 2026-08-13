import { PLATFORM_ASSETS } from './platformAssets';

export type Attachment = {
  type: 'image';
  url: string;
  alt?: string;
  /** Empty alt is intentional, rather than an unfinished description. */
  decorative?: boolean;
};

export interface TwitterCharacter {
  id: string;
  name: string;
  handle: string;
  avatarUrl?: string;
  verified?: boolean;
}

/**
 * Universal Character - Works across all templates
 * Replaces template-specific character systems
 */
export interface UniversalCharacter {
  id: string;
  name: string;                 // Display name (used in all templates)
  avatarUrl?: string;           // Profile picture URL
  
  // Platform-specific handles
  twitterHandle?: string;       // @username for Twitter
  phoneNumber?: string;         // For SMS/WhatsApp (optional)
  email?: string;              // For email templates (future)
  
  // Metadata
  verified?: boolean;           // Verified badge (Twitter)
  bio?: string;                // Short description
  category?: 'modern' | 'diversity' | 'fantasy' | 'neutral' | 'age-varied';
  
  // Usage tracking
  lastUsed?: string;           // ISO timestamp
  usageCount: number;          // Analytics (defaults to 0)
}

/**
 * WhatsApp Group Chat Participant
 * Represents individual members in group conversations
 */
export interface GroupParticipant {
  id: string;
  /** Stable reference into the project-scoped cast. */
  characterId?: string;
  name: string;                 // Participant display name
  avatarUrl?: string;           // Optional profile picture
  color: string;                // Hex color for name display (#FF5733)
  phoneNumber?: string;         // Optional phone number
}

export interface Message {
  id: string;
  /** Stable reference into the project-scoped cast. Legacy identity fields remain as fallback. */
  characterId?: string;
  sender: string;
  avatarUrl?: string;
  content: string; // raw user text (sanitized before emit)
  timestamp?: string;
  outgoing: boolean; // true = author perspective sender bubble
  attachments?: Attachment[];
  roleColor?: string; // Overrides the participant colour for this sender's name
  // WhatsApp Group Chat
  participantId?: string; // ID of GroupParticipant (for group messages)
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

/** A project-local identity. Library characters are copied here, never linked live. */
export interface SceneCharacter {
  id: string;
  name: string;
  avatarUrl?: string;
  twitterHandle?: string;
  verified?: boolean;
  sourceLibraryId?: string;
  archived?: boolean;
}

export interface SceneCast {
  characters: SceneCharacter[];
  selfId?: string;
  contactId?: string;
  twitterPrimaryId?: string;
}

export interface SkinSettings {
  bubbleOpacity: number; // 0..1
  senderColor: string; // hex
  receiverColor: string; // hex
  fontFamily: string;
  maxWidthPx: number;
  useDarkNeutral: boolean;
  /** Safety label rendered into PNG exports. Recommended for realistic scenes. */
  fictionLabel?: boolean;
  fictionLabelText?: string;
  /** Optional neutral AO3 SkinGen credit rendered into PNG exports. */
  toolAttribution?: boolean;
  /** Legacy project field. Kept readable during migration but no longer used. */
  watermark?: boolean;
  
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
  twitterDarkMode?: boolean; // Dark mode theme
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
  // iOS/Android chat enhancements
  /**
   * What the author is called in their own conversation. **iOS and Android
   * only** — Twitter's equivalent is `twitterDisplayName`, and Google has no
   * such concept.
   *
   * iMessage and WhatsApp never draw your own name on screen, which makes this
   * look cosmetic. It is not: it is the hidden speaker label
   * `<dt class="visually-hidden">You: </dt>` — exactly what a reader gets with
   * **Hide Creator's Style** on, and in a downloaded EPUB. An author writing in
   * first person as Rhys was shipping "You:" to those readers with no way to
   * change it.
   *
   * Left empty by default rather than defaulting to 'You', so the generator
   * keeps 'You' as its own fallback and skin-off output is unchanged for every
   * project that never sets this.
   */
  chatYourName?: string;
  chatContactName?: string; // "Conversation with..." header (shown at top)
  chatShowTyping?: boolean; // show typing indicator
  chatTypingName?: string; // who is typing (not needed for 1-on-1)
  iosDarkMode?: boolean; // iOS dark mode theme
  iosMode?: 'imessage' | 'sms'; // iOS message type (blue vs green)
  iosShowReadReceipt?: boolean; // Show "Read" under last message
  // iOS Authentic 1-on-1 System
  iosContactName?: string; // The other person's name (shown in header only)
  iosAutoAlternate?: boolean; // Auto-alternate between you and them
  // iOS Group Chat
  iosGroupMode?: boolean; // Enable group chat (shows sender names)
  iosGroupName?: string; // Group chat name (e.g., "Family Chat")
  iosGroupParticipants?: GroupParticipant[]; // Group members
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
  androidDarkMode?: boolean; // Android/WhatsApp dark mode theme
  androidHeaderImageUrl?: string; // Header background image URL
  androidFooterImageUrl?: string; // Footer background image URL
  androidAvatarUrl?: string; // User's avatar image to overlay on header
  androidContactName?: string; // Contact name for header
  androidAutoAlternate?: boolean; // Auto-alternate messages
  // WhatsApp Group Chat
  androidGroupMode?: boolean; // Enable group chat (shows sender names)
  androidGroupName?: string; // Group chat name (e.g., "Work Team")
  androidGroupParticipants?: GroupParticipant[]; // Group members
}
export interface SkinProject {
  id: string;
  template: 'ios' | 'android' | 'twitter' | 'google';
  settings: SkinSettings;
  messages: Message[];
  /** Canonical project-local identities. Optional while legacy projects migrate. */
  cast?: SceneCast;
}

function localProjectId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch { /* use the local fallback */ }
  return `project-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export const defaultProject = (): SkinProject => ({
  id: localProjectId(),
  template: 'ios',
  settings: {
    bubbleOpacity: 0.9,
    senderColor: '#1d9bf0',
    receiverColor: '#ececec',
    fontFamily: 'Arial, Helvetica, sans-serif',
    maxWidthPx: 400,
    useDarkNeutral: true,
    fictionLabel: true,
    fictionLabelText: 'Fictional scene',
    toolAttribution: false,
    twitterHandle: '',
    twitterVerified: false,
    twitterLikes: 0,
    twitterRetweets: 0,
    twitterReplies: 0,
    twitterShowMetrics: true,
    twitterTimestamp: '',
    twitterDarkMode: false,
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
    // Left empty so the generator derives plausible values from the query.
    googleResultsCount: '',
    googleResultsTime: '',
    googleShowDidYouMean: false,
    googleDidYouMean: '',
    googleEngineVariant: 'google',
    chatYourName: '',
    chatContactName: '',
    chatShowTyping: false,
    chatTypingName: '',
    iosDarkMode: false,
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
    androidDarkMode: false,
    androidHeaderImageUrl: PLATFORM_ASSETS.whatsapp.headerImage,
    androidFooterImageUrl: PLATFORM_ASSETS.whatsapp.footerImage,
    androidAvatarUrl: '',
    androidContactName: '',
    androidAutoAlternate: true,
    twitterDisplayName: '',
    twitterAvatarUrl: '',
  },
  messages: [
    {
      id: 'default-msg-1',
      sender: 'You',
      content: 'Where are you? I\'m waiting at the cafe. See you soon.',
      outgoing: true,
      timestamp: '10:15',
      status: 'read'
    },
    {
      id: 'default-msg-2',
      sender: 'Alice',
      content: 'On my way — see you shortly!',
      outgoing: false,
      timestamp: '10:15'
    }
  ],
});
