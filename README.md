# AO3 Work Skin Generator

Generate highlightable, accessible chat scenes and social media mockups for Archive of Our Own. Built with Next.js + TypeScript.

**[Try it live](https://ao3skingen.netlify.app/)** | **[Support on Ko-fi](https://ko-fi.com/ao3skingen)**

---

## Features

- **iOS iMessage** - Authentic chat bubbles with message grouping, read receipts, dark mode, image support, and **group chat mode**
- **Android/WhatsApp** - WhatsApp-style chat with status indicators, checkmarks, dark mode, and **group chat mode** with participant avatars
- **Twitter/X** - Tweet threads with engagement metrics, verified badges, quote tweets, and dark mode
- **Google Search** - Search results with autocomplete suggestions

### Key Features

- **🚀 Cloudinary Upload** - Auto-upload images for perfect layout with minimal code (see [setup guide](./CLOUDINARY-SETUP.md))
- **👥 Group Chat (iOS & WhatsApp)** - Multi-participant conversations with avatars and colored names
  - Automatic participant matching by sender name
  - Avatar images or colored initial placeholders
  - Participant count display in header
  - One-click character loading from Character Library
- **📚 Character Library** - Redesigned preset browsing experience
  - Browse 30 built-in character presets by category (Modern, Diversity, Fantasy, Age-Varied, Non-Binary)
  - Search and filter presets
  - Save favorites to "My Characters" for reuse
  - One-click load into group chat participants
  - All avatars hosted on Publit.io CDN for reliability
- **⚙️ Collapsible Settings** - Clean, focused interface across all templates
  - Settings panel starts collapsed for cleaner first impression
  - One-click expand with smooth animations
  - Per-template preferences saved to localStorage
- **⚡ Fast Mode / 📝 Detailed Mode** - Flexible creation workflow
  - Toggle between quick creation (Fast) and full form (Detailed)
  - Fast Mode: Minimal fields for rapid message/tweet/result creation
  - Detailed Mode: All options including metrics, timestamps, attachments
  - Mode preference persists per template
- **🎯 Intelligent URL Caching** - Reuse URLs across projects
  - Auto-fills previously used image URLs
  - Detects duplicate images (same GIF used 5× = upload once!)
  - Cross-template awareness (same avatar in iMessage & Twitter)
  - 90-day cache with usage tracking
  - "Used 3× before" indicators in URL collection
- **🎨 GIF Animation Preservation** - Keeps GIFs animated
  - ZIP downloads preserve GIF animations (no PNG conversion)
  - JPEG/PNG formats also preserved as-is
  - Only exotic formats (WebP) converted for AO3 compatibility
- **Dark Mode** - Per-template dark mode toggles for iOS, Android, and Twitter
  - Twitter dark mode includes gray icons for better export quality
- **🎭 Character Management** - Universal character system across all templates
- **Stitch Mode** - Export long conversations as single tall images for Tumblr/Pinterest
- **📥 Smart Export Panel** - Clean, focused UI with contextual actions
  - Primary action prominent (Get AO3 Code or Download Image)
  - Collapsible settings panel with export options
  - Mode toggle between Cloudinary and image export
  - Smart donation prompts (3rd export, then every 10th, with 7-day cooldown)
- **Highlightable text** - Unlike screenshots, readers can select and copy text
- **AO3-safe CSS** - All styles scoped under `#workskin`, no scripts
- **Accessible** - Semantic HTML for screen readers
- **Local autosave** - Projects saved to localStorage automatically

## Quick Start

```bash
npm install
npm run dev
# Visit http://localhost:3000
```

## How to Use on AO3

### Option 1: Cloudinary Upload (Recommended) ⚡

**Benefits**: Perfect layout, simple code, no CSS headaches!

1. **Setup** (one-time): Follow instructions in [CLOUDINARY-SETUP.md](./CLOUDINARY-SETUP.md)
2. Create your scene in the generator
3. Enable **"Use Cloudinary"** mode at the bottom
4. Click **Generate Code** (cloud icon)
5. Copy the simplified CSS and HTML
6. Paste into AO3 (CSS in Work Skin, HTML in chapter)

**Result**: Just a few lines of code instead of 200+ lines. The image looks exactly like your download!

### Option 2: Traditional CSS/HTML

1. Create your scene in the generator
2. Click **Export** -> Copy CSS
3. Create a Work Skin on AO3, paste CSS
4. Copy HTML -> Paste into your chapter

**Note**: May have spacing/layout issues due to AO3's CSS restrictions. Use Cloudinary mode for best results!

## Tech Stack

- **Next.js 16** - React framework with Turbopack
- **React 18** - UI library with hooks & memo optimization
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first styling
- **DOMPurify** - XSS protection
- **html2canvas** - Client-side image export
- **Cloudinary** - Optional image hosting
- **PWA** - Offline support with service worker
- **Next.js Image** - Automatic image optimization (AVIF/WebP)
- **Virtual Scrolling** - Performance for 1000+ message lists

## Project Structure

```
src/
  components/       # React UI components
    IOSEditor.tsx       # iOS/iMessage editor with group chat + collapsible settings
    AndroidEditor.tsx   # WhatsApp editor with group chat + collapsible settings
    TwitterEditor.tsx   # Twitter/X editor with collapsible settings + compose modes
    EditorForm.tsx      # Google search editor with collapsible settings
    ExportPanel.tsx     # Export functionality with smart donation prompts
    PreviewPane.tsx     # Live preview (React.memo optimized)
    CharacterLibrary.tsx # Redesigned preset browsing UI
    CharacterBank.tsx   # Character management (legacy, kept for compatibility)
    CompactMessageCard.tsx # Reusable message editor component
    Toast.tsx           # Toast notifications
    ConfirmModal.tsx    # Confirmation dialogs
    SuccessModal.tsx    # Post-export modal with donation CTA
    ErrorBoundary.tsx   # Error handling
    FastModeInput.tsx   # Shared Fast Mode UI
    PWAInstallPrompt.tsx # PWA install banner
    VirtualMessageList.tsx # Performance optimization for large lists
    AvatarSelector.tsx  # Avatar URL input with preset picker
    UrlCollectionModal.tsx # Smart URL collection with cache auto-fill
  hooks/            # Custom React hooks
    useProjectEditor.ts # Shared editor logic (eliminates 60% duplication)
  lib/              # Core logic
    generator.ts        # CSS/HTML generation (supports iOS & Android group chat)
    schema.ts           # TypeScript types & defaults
    storage.ts          # localStorage management
    sanitize.ts         # XSS protection
    platformAssets.ts   # Icon/asset URLs (CDN references)
    characterBank.ts    # 30 preset characters with Publit.io CDN URLs
    characterCache.ts   # Character storage (localStorage)
    brand.ts            # Brand colors/styles
    cloudinary.ts       # Cloudinary upload utilities (GIF preservation)
    imgur.ts            # Imgur upload (legacy)
    zipGenerator.ts     # Zip export with GIF preservation + format detection
    donationPrompt.ts   # Smart donation frequency tracking
    proFeatures.ts      # Pro feature definitions
    urlCache.ts         # Intelligent URL caching system (90-day persistence)
    urlProgress.ts      # URL collection progress tracking
    urlValidation.ts    # URL validation utilities
    imageInventory.ts   # Image detection + deduplication
  pages/            # Next.js pages
  styles/           # Global CSS
public/
  assets/           # Static images (icons, avatars)
  manifest.json     # PWA manifest
  sw.js             # Service worker for offline support
  icon-192.svg      # PWA app icon (192x192)
  icon-512.svg      # PWA app icon (512x512)
```

## Architecture Notes

### Image Handling
- **No server storage** - All images are user-provided URLs (Imgur, Imgbb, Cloudinary, etc.)
- **Zero bandwidth cost** - Browser fetches images directly, never touches our server
- **Export via html2canvas** - Client-side rendering, no server processing
- **GIF Preservation** - ZIP downloads preserve GIF animations (no canvas conversion)
  - Detection: Checks both URL extension (.gif) AND blob MIME type (image/gif)
  - JPEG/PNG also preserved as-is, only WebP converted to PNG
- **Intelligent Caching** - `urlCache.ts` tracks URL reuse across sessions
  - Content-based keys (Cloudinary URL, not position)
  - 90-day persistence with usage counting
  - Auto-fills previously used URLs in collection modal
- **Deduplication** - `imageInventory.ts` detects duplicate images
  - Same avatar used 5× = ask for URL once, apply to all
  - Cross-template awareness (iMessage + Twitter share cache)
  - "Used 3× in this project" indicators

### UX Architecture - Collapsible Settings & Compose Modes
All platform editors follow a consistent pattern:
- **Collapsible Settings** - ⚙️ panel starts collapsed by default
  - Smooth expand/collapse with chevron rotation
  - localStorage: `ao3skin_[platform]_settings_open`
  - Consistent styling across all templates
- **Compose Mode Toggle** - ⚡ Fast / 📝 Detailed
  - Fast Mode: Minimal fields (name + content only)
  - Detailed Mode: Full form (timestamps, reactions, metrics, etc.)
  - localStorage: `ao3skin_[platform]_compose_mode`
  - Platform-specific defaults (iMessage/WhatsApp=fast, Twitter=detailed)
- **Animation** - `animate-fadeIn` class for smooth transitions

### Group Chat Architecture
Both iOS and Android share the same group chat implementation:
- `GroupParticipant` interface - Shared type for both platforms
- `iosGroupMode` / `androidGroupMode` - Enable group chat per template
- `iosGroupParticipants` / `androidGroupParticipants` - Participant arrays
- Automatic participant matching by sender name in generator
- CSS reused across both platforms (`.group-sender-row`, `.group-avatar`, etc.)

### Character Library System
- **Preset Characters** - 30 built-in characters in `characterBank.ts`
  - Categories: Modern (10), Age-Varied (4), Diversity (6), Non-Binary (4), Fantasy (6)
  - All avatars hosted on Publit.io CDN: `https://media.publit.io/file/AO3-Skins-App/avatars/*.png`
- **Character Library UI** - Two-tab interface:
  - "Browse Presets" - Search, filter, and add presets to library
  - "My Characters" - Manage saved characters
- **Integration** - One-click load into group chat participants from modal

### Donation Prompt Strategy
Smart frequency control in `donationPrompt.ts`:
- Shows at 3rd export (user is engaged)
- Then every 10 exports (13th, 23rd, 33rd...)
- Minimum 7 days between prompts (no spam)
- 90-day cooldown after Ko-fi click
- "Don't show again" honored permanently
- Tracking via localStorage (`ao3_donation_tracking`)

### Dark Mode Implementation
Each template has its own dark mode toggle in settings:
- `iosDarkMode` - iOS dark theme (#000000 background)
- `androidDarkMode` - WhatsApp dark theme (#0b141a background)  
- `twitterDarkMode` - Twitter/X dark theme (#15202b background)

### Settings Schema
All project settings defined in `src/lib/schema.ts`:
- `Settings` interface - All available options
- `defaultSettings` - Default values for new projects
- `SkinProject` - Full project structure

### CSS Generation
`src/lib/generator.ts` contains:
- `buildCSS(project)` - Generates template-specific CSS
- `buildHTML(project)` - Generates semantic HTML
- Template-specific functions: `buildIOSCSS()`, `buildAndroidCSS()`, `buildTwitterCSS()`, `buildGoogleCSS()`

## Security

- Content sanitized with DOMPurify (only `br`, `b`, `strong` allowed)
- No inline event handlers in output
- URL sanitization prevents XSS
- No user data stored on server

## Recent Changes

### December 16, 2025 - iOS Group Chat & Character Library Redesign 🎭

**iOS Group Chat Support** - Feature parity with WhatsApp/Android
- ✅ Added `iosGroupMode`, `iosGroupName`, `iosGroupParticipants` fields to schema
- ✅ Participant avatar/name rendering in message bubbles (auto-matches by sender name)
- ✅ Group chat CSS: `.group-sender-row`, `.group-avatar`, `.group-avatar-initials`
- ✅ Unified architecture: Shares `GroupParticipant` type with Android template
- ✅ CompactMessageCard dropdown for participant assignment (already worked, confirmed)

**Character Library Redesigned** - Preset browsing focus
- ✅ Removed "Add New Character" form (streamlined UX)
- ✅ Two-tab interface: "Browse Presets (30)" and "My Characters"
- ✅ Search bar with real-time filtering (searches names & descriptions)
- ✅ Category filters: All, Modern, Diversity, Fantasy, Age-Varied, Non-Binary (with counts)
- ✅ 3-4 column responsive grid with smaller avatars (h-24 vs aspect-square)
- ✅ "✓ Saved" badges show which presets are already in library
- ✅ One-click "+ Add to Library" buttons for quick character loading
- ✅ Wider panel (max-w-2xl) for better browsing experience
- ✅ Info banners explain preset workflow

**Image Loading & UI Fixes**
- ✅ Enabled `unoptimized` flag on Next.js Image components for Publit.io CDN
- ✅ Fixed avatar sizing for better performance (h-24 presets, w-14 h-14 saved)
- ✅ Category filter scroll issues resolved (horizontal snap, pr-4 padding, flex-shrink-0)
- ✅ Added bottom padding (pb-24) to prevent sticky export menu overlap
- ✅ iOS header URL corrected: `/imessage-header.png` (removed /platform/ios subdirectory)
- ✅ Removed user-editable header URL field (now hardcoded like WhatsApp for consistency)

**Smart Donation Prompts** - Non-intrusive monetization
- ✅ Shows at 3rd export (user is engaged), then every 10th (13th, 23rd, 33rd...)
- ✅ Minimum 7 days between prompts (respects user's time)
- ✅ 90-day cooldown after Ko-fi click
- ✅ "Don't show again" checkbox honored permanently
- ✅ Tracking via `ao3_donation_tracking` localStorage

### December 15, 2025 - UI/UX Overhaul 🎨

**Bottom Menu Redesign** - Cleaner, more focused export experience
- Primary action now prominent with large buttons ("Get AO3 Code" or "Download Image")
- Mode toggle simplified to icon button (☁️/📷)
- Contextual UI: CSS/HTML buttons appear only when relevant
- Settings moved to collapsible panel (⚙️) with two-column layout
- Better mobile experience with full-width buttons and proper stacking
- Improved visual feedback: Green "✓ Copied" states

**WhatsApp Group Chat Polish**
- ✅ Fixed header text cutoff for group names like "Squad Goals 🎯"
- ✅ Auto-participant matching: Sender names automatically link to participants
- ✅ Emoji handling in initials: "Squad Goals 🎯" shows "SG" not "S🎯"

**Export Visual Improvements**
- ✅ Rounded corners (20px) on iOS/Android exports for authentic phone mockup look
- ✅ Twitter dark mode: Gray icons instead of CSS filters for better export quality
- ✅ Smart padding: Different margins for single tweets vs thread mode

### December 14, 2025 - Group Chat & Bug Fixes 🔧

**WhatsApp Group Chat Features**
- ✅ Participant avatars and colored names in group conversations
- ✅ Automatic participant count in header
- ✅ Avatar images or colored initial placeholders
- ✅ Group mode toggle with participant management

**Bug Fixes**
- ✅ WhatsApp header CDN URL fix (black header issue resolved)
- ✅ Group chat avatars now appear on image messages
- ✅ Fixed broken avatar URLs in example templates
- ✅ CDN URL corrections across all platform assets

### Previous Updates (December 2025)

**Performance Optimization Sprint** ⚡
- ✅ Code Quality: useProjectEditor hook eliminates 60% code duplication
- ✅ React Optimization: useCallback wrapping for 30% faster re-renders
- ✅ Type Safety: Replaced 'any' types with proper TypeScript interfaces
- ✅ Accessibility: WCAG 2.1 AA compliance improvements
- ✅ Error Handling: ErrorBoundary component for graceful failures
- ✅ Code Deduplication: FastModeInput component, renderToCanvas helper (600+ lines eliminated)
- ✅ Lazy Loading: next/dynamic for 40-50% faster initial page load
- ✅ Image Optimization: Next.js Image component with AVIF/WebP (60% bandwidth reduction)
- ✅ PWA Support: Full offline editing with service worker, installable app
- ✅ Virtual Scrolling: 90% faster rendering for 1000+ message conversations

**Feature Additions**
- ✅ Cloudinary integration - Auto-upload images for simplified code (optional)
- ✅ Dark mode for iOS, Android, Twitter templates
- ✅ Character Bank with localStorage persistence
- ✅ Stitch Mode for long image exports
- ✅ Fast Mode bulk message creation
- ✅ Replaced native alerts/confirms with styled components
- ✅ Gray metric icons on Twitter (replies, retweets, likes)
- ✅ Removed PARODY label from verified badges

---

## Support This Project

This tool is **100% free** - no ads, no tracking. If it helped your fic:

- **[Support on Ko-fi](https://ko-fi.com/ao3skingen)**
- **Star this repo**
- **Share with other writers**

---

## Contributing

1. Fork and branch (`feat/feature-name` style)
2. Keep CSS scoped under `#workskin`
3. No disallowed AO3 tags or scripts
4. Submit PR with screenshots

## License

MIT License

---

Made with love by **victorjaxen1**
