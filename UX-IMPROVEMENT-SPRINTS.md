# UX/UI Improvement Implementation Plan

**Project**: AO3 Skin Generator - User Experience Overhaul  
**Timeline**: 5 weeks (7 sprints)  
**Strategy**: High-impact, iterative improvements with immediate user value

---

## 🎯 **SPRINT 1: Critical Safety & Onboarding** (Week 1 - Days 1-3)

**Goal**: Prevent data loss and eliminate first-time user confusion

### **Issues Addressed**
- ❌ Users lose all messages when switching templates (no warning)
- ❌ New users don't know what to do (blank canvas syndrome)
- ❌ Mobile users lose scroll position when switching tabs
- ❌ No visual feedback during operations

### **Deliverables**

#### **1.1 Template Switch Confirmation**
**Files**: `src/components/EditorForm.tsx`

```typescript
// Add before template change
const handleTemplateChange = async (newTemplate: string) => {
  if (project.messages.length > 0) {
    const confirmed = await confirm(
      'Switch Template?',
      `You have ${project.messages.length} messages. Switching templates will clear them. Continue?`
    );
    if (!confirmed) return;
  }
  update('template', newTemplate);
};
```

**Acceptance Criteria**:
- ✅ Confirmation modal shows when messages exist
- ✅ Modal displays message count
- ✅ User can cancel template switch
- ✅ No confirmation if project is empty

---

#### **1.2 Welcome Modal for First-Time Users**
**Files**: 
- `src/components/WelcomeModal.tsx` (NEW)
- `src/pages/index.tsx` (integrate modal)

**Features**:
- Visual template gallery (4 cards: iOS, Android, Twitter, Google)
- 3 popular example templates with thumbnails
- "Skip to blank editor" option
- Stores `hasSeenWelcome` in localStorage

**Design Specs**:
```
┌─────────────────────────────────────┐
│  ✨ Welcome to AO3 Skin Generator!  │
│                                     │
│  Choose how to start:               │
│                                     │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐      │
│  │📱  │ │💚  │ │🐦  │ │🔍  │      │
│  │iOS │ │And.│ │Twit│ │Goog│      │
│  └────┘ └────┘ └────┘ └────┘      │
│                                     │
│  Or load an example:                │
│  • Twitter Thread (Popular!)        │
│  • iMessage Conversation            │
│  • WhatsApp Chat                    │
│                                     │
│  [Start Blank] [Don't Show Again]   │
└─────────────────────────────────────┘
```

**Acceptance Criteria**:
- ✅ Shows on first visit only
- ✅ Template selection loads blank project with that template
- ✅ Example selection loads pre-filled project
- ✅ Dismissible with "Don't show again" checkbox
- ✅ Responsive (mobile-friendly)

---

#### **1.3 Mobile Tab Improvements**
**Files**: `src/pages/index.tsx`

**Changes**:
1. **Sticky Tab Bar**: Tabs stay visible when scrolling
2. **Scroll Memory**: Preserve scroll position when switching tabs
3. **Bidirectional Quick Switch**: Add "✏️ Back to Editor" button on preview tab

```typescript
// Add state for scroll positions
const [editScrollPos, setEditScrollPos] = useState(0);
const [previewScrollPos, setPreviewScrollPos] = useState(0);

// Save scroll position before tab switch
const handleTabSwitch = (newTab: 'edit' | 'preview') => {
  const currentScroll = window.scrollY;
  if (activeView === 'edit') setEditScrollPos(currentScroll);
  if (activeView === 'preview') setPreviewScrollPos(currentScroll);
  setActiveView(newTab);
};

// Restore scroll position after tab switch
useEffect(() => {
  if (activeView === 'edit' && editScrollPos > 0) {
    window.scrollTo(0, editScrollPos);
  }
  if (activeView === 'preview' && previewScrollPos > 0) {
    window.scrollTo(0, previewScrollPos);
  }
}, [activeView]);
```

**Acceptance Criteria**:
- ✅ Tab bar sticks to top when scrolling (z-index: 50)
- ✅ Scroll position restored when switching tabs
- ✅ Preview tab shows "✏️ Back to Editor" floating button
- ✅ Edit tab shows "👁️ See Preview" floating button (already exists)

---

#### **1.4 Operation Feedback System**
**Files**: 
- `src/components/Toast.tsx` (enhance existing)
- All editor components (add success/error toasts)

**Enhancements**:
- ✅ Auto-dismiss after 3 seconds
- ✅ Action buttons (Undo, Retry)
- ✅ Progress indicators for uploads
- ✅ Color coding (green=success, red=error, blue=info, yellow=warning)

**Acceptance Criteria**:
- ✅ Toast shows for: message added, deleted, reordered
- ✅ Upload progress shows percentage
- ✅ Undo button works for last 5 actions
- ✅ Toast positions don't overlap (stack vertically)

---

### **Testing Checklist**
- [ ] Template switch with 0 messages → No confirmation
- [ ] Template switch with 5+ messages → Confirmation shows
- [ ] Cancel template switch → Messages preserved
- [ ] Confirm template switch → Messages cleared
- [ ] First visit → Welcome modal shows
- [ ] Second visit → Welcome modal skipped
- [ ] Mobile tab switch → Scroll position preserved
- [ ] Toast notifications work on all actions

**Estimated Time**: 3 days  
**Risk Level**: Low  
**User Impact**: ⭐⭐⭐⭐⭐ (Prevents data loss, reduces confusion)

---

## 🎭 **SPRINT 2: Character Bank Universalization** (Week 2 - Days 4-6)

**Goal**: Make Character Bank the star feature across ALL templates

### **Issues Addressed**
- ❌ Character Bank only works for Twitter
- ❌ No discoverability (hidden in Twitter settings)
- ❌ Users recreate same characters for iOS/Android
- ❌ No quick-apply functionality

### **Deliverables**

#### **2.1 Universal Character Data Model**
**Files**: `src/lib/characterBank.ts`, `src/lib/schema.ts`

**New Character Interface**:
```typescript
export interface UniversalCharacter {
  id: string;
  name: string;              // Display name
  avatarUrl?: string;        // Profile picture
  
  // Platform-specific handles
  twitterHandle?: string;    // @username
  phoneNumber?: string;      // For SMS/WhatsApp
  email?: string;            // For email templates
  
  // Metadata
  verified?: boolean;        // Verified badge (Twitter, Instagram)
  bio?: string;             // Short description
  category: CharacterAvatar['category'];
  
  // Usage tracking
  lastUsed?: string;        // ISO timestamp
  usageCount: number;       // Analytics
}
```

**Acceptance Criteria**:
- ✅ Single character works across iOS, Android, Twitter, Google
- ✅ Backward compatible with existing Twitter characters
- ✅ Migration script for existing character presets

---

#### **2.2 Global Character Library Component**
**Files**: 
- `src/components/CharacterLibrary.tsx` (NEW - refactor from TwitterEditor)
- `src/pages/index.tsx` (add to header)

**Features**:
- Global header button: "🎭 Characters (5)"
- Slide-out panel (right side)
- Horizontal scrollable character cards
- Quick actions: Edit, Delete, Duplicate
- Template-aware (shows relevant fields per template)

**Design Specs**:
```
┌───────────────────────────────────┐
│  🎭 Character Library (5)    [✕] │
├───────────────────────────────────┤
│                                   │
│  ┌─────┐ ┌─────┐ ┌─────┐        │
│  │ 👤  │ │ 👤  │ │ 👤  │  →     │
│  │Alex │ │Jamie│ │Sam  │        │
│  └─────┘ └─────┘ └─────┘        │
│                                   │
│  [+ Add Character]                │
│  [📂 Load from Bank]              │
│                                   │
│  Quick Apply:                     │
│  • Use for next message           │
│  • Set as iOS contact             │
│  • Set as Twitter main account    │
└───────────────────────────────────┘
```

**Acceptance Criteria**:
- ✅ Accessible from all template editors
- ✅ Persists across template switches
- ✅ Syncs with localStorage
- ✅ Mobile-responsive (bottom sheet on mobile)

---

#### **2.3 Quick-Apply Character Functionality**
**Files**: All editor components

**Features**:
- Click character in library → Apply to current message being composed
- Dropdown in message composer: "Select Character: [Alex Rivers ▼]"
- Auto-fill: name, avatar, handle based on template

**iOS Template**:
```
Contact Name: [Alex Rivers ▼]  ← Dropdown from character library
Avatar: [Auto-filled]
```

**Android Template**:
```
Contact Name: [Alex Rivers ▼]
Profile Picture: [Auto-filled]
```

**Twitter Template**:
```
Account: [Alex Rivers (@alexrivers) ▼]
Verified: [Auto-filled]
```

**Acceptance Criteria**:
- ✅ Dropdown shows all characters + "Add New"
- ✅ Selecting character auto-fills all relevant fields
- ✅ Works in Fast Mode (auto-complete character names)
- ✅ Recently used characters show at top

---

#### **2.4 Character Bank Presets (30 → 50)**
**Files**: `src/lib/characterBank.ts`

**Add 20 More Characters**:
- **Professional**: Lawyer, Doctor, Teacher, Engineer, Artist (5)
- **Family**: Grandma, Grandpa, Uncle, Aunt, Cousin (5)
- **Romance**: Couple archetypes (Enemies-to-lovers, Best friends, etc.) (5)
- **Genre**: Vampire, Werewolf, Alien, Robot, Time Traveler (5)

**Acceptance Criteria**:
- ✅ 50 total curated characters
- ✅ All have high-quality avatars
- ✅ Categorized for easy browsing
- ✅ Searchable by name/category

---

### **Testing Checklist**
- [ ] Create character in Twitter → Use in iOS → Works
- [ ] Character library accessible from all templates
- [ ] Quick-apply fills all fields correctly
- [ ] Character persists after template switch
- [ ] Mobile character panel usable
- [ ] Search/filter characters works

**Estimated Time**: 3 days  
**Risk Level**: Medium (refactoring across multiple components)  
**User Impact**: ⭐⭐⭐⭐⭐ (Saves 10+ minutes per fic)

---

## ⚡ **SPRINT 3: Fast Mode & Bulk Operations** (Week 2-3 - Days 7-10)

**Goal**: Make Fast Mode discoverable and powerful

### **Issues Addressed**
- ❌ Fast Mode syntax not obvious (`> message` / `< message`)
- ❌ No preview before bulk adding
- ❌ Error messages unclear
- ❌ No undo for bulk operations

### **Deliverables**

#### **3.1 Fast Mode Live Preview Panel**
**Files**: `src/components/FastModeInput.tsx`

**Split View Interface**:
```
┌────────────────────────────────────────────┐
│  ⚡ Fast Mode                              │
├──────────────────┬─────────────────────────┤
│  Input (Left)    │  Preview (Right)        │
│                  │                         │
│  > Hey there!    │  ┌──────────────┐      │
│  < Hi! How are   │  │ Hey there!   │ →    │
│    you?          │  └──────────────┘      │
│  > I'm good!     │                         │
│                  │  ┌──────────────┐      │
│  💡 Syntax:      │  │ Hi! How are  │ ←    │
│  > = Outgoing    │  │ you?         │      │
│  < = Incoming    │  └──────────────┘      │
│                  │                         │
│  [Add 3 msgs]    │  ┌──────────────┐      │
│                  │  │ I'm good!    │ →    │
│                  │  └──────────────┘      │
└──────────────────┴─────────────────────────┘
```

**Features**:
- Real-time preview (updates as you type)
- Syntax highlighting (`>` green, `<` blue)
- Character counter per message
- Error highlighting (invalid syntax shows red underline)

**Acceptance Criteria**:
- ✅ Preview updates with 300ms debounce
- ✅ Shows exactly what will be added
- ✅ Character count shows per message
- ✅ Invalid syntax highlighted in real-time
- ✅ Responsive (stacks vertically on mobile)

---

#### **3.2 Enhanced Syntax Support**
**Files**: `src/components/FastModeInput.tsx`

**New Syntax Features**:
```
Basic:
> Outgoing message
< Incoming message

Advanced:
>@ Alex Rivera | Hey there!     ← Custom sender name
< 12:30 PM | Hi!                ← Add timestamp
>! Important message!           ← Add reaction/emphasis
--- 5 minutes later ---         ← Time break separator

Character Auto-Complete:
>@ A[TAB]                       ← Auto-completes to saved character
```

**Acceptance Criteria**:
- ✅ Parser supports all syntax variants
- ✅ Auto-complete works for character names
- ✅ Error messages show correct syntax
- ✅ Documentation tooltip available (? icon)

---

#### **3.3 Bulk Operation Undo**
**Files**: `src/pages/index.tsx`, `src/components/FastModeInput.tsx`

**Features**:
- After bulk add, show toast: "Added 12 messages · [Undo] [Clear All]"
- Undo button removes last bulk operation
- Clear All removes all messages added in current session
- History tracks bulk operations separately

**Implementation**:
```typescript
interface BulkOperation {
  id: string;
  type: 'fast-mode-add' | 'template-load' | 'character-load';
  messageIds: string[];
  timestamp: string;
}

const undoBulkOperation = (operationId: string) => {
  const operation = bulkHistory.find(op => op.id === operationId);
  if (!operation) return;
  
  const newMessages = project.messages.filter(
    msg => !operation.messageIds.includes(msg.id)
  );
  update('messages', newMessages);
  success('Undid bulk add');
};
```

**Acceptance Criteria**:
- ✅ Toast shows after bulk add
- ✅ Undo removes exact messages added
- ✅ Clear All asks for confirmation
- ✅ Works with Ctrl+Z global undo

---

#### **3.4 Template-Specific Fast Mode**
**Files**: All editor components

**Twitter Fast Mode**:
```
Support threading:
> Main tweet
>> Reply to main tweet
>>> Nested reply

@alexrivers > Custom sender tweet
```

**iOS Fast Mode**:
```
Support reactions and time breaks:
> Hey!
< Hi there! ❤️              ← Auto-adds reaction
--- 5 minutes later ---
> What's up?
```

**Acceptance Criteria**:
- ✅ Twitter mode supports threading syntax
- ✅ iOS mode supports reactions and time breaks
- ✅ Android mode supports status indicators
- ✅ Template-specific help shown

---

### **Testing Checklist**
- [ ] Fast Mode preview updates in real-time
- [ ] Syntax highlighting works
- [ ] Character auto-complete functional
- [ ] Undo bulk operation works
- [ ] Template-specific syntax parsed correctly
- [ ] Error messages helpful and accurate

**Estimated Time**: 4 days  
**Risk Level**: Medium (complex parsing logic)  
**User Impact**: ⭐⭐⭐⭐ (Speeds up message creation by 5x)

---

## 💾 **SPRINT 4: Export UX Overhaul** (Week 3 - Days 11-13)

**Goal**: Make export options clear and beneficial

### **Deliverables**

#### **4.1 Tabbed Export Interface**
**Files**: `src/components/ExportPanel.tsx`

**New Design**:
```
┌──────────────────────────────────────────┐
│  [🖼️ Image] [💻 Code] [☁️ Cloudinary]   │
├──────────────────────────────────────────┤
│  Tab 1: Image Export                     │
│  • Download as PNG (high quality)        │
│  • Stitch mode for long conversations    │
│  • Custom scale (1x, 2x, 3x)             │
│                                          │
│  [📷 Download Image]                     │
└──────────────────────────────────────────┘
```

**Acceptance Criteria**:
- ✅ 3 tabs: Image, Code, Cloudinary
- ✅ Each tab shows relevant options only
- ✅ Active tab highlighted
- ✅ Mobile-friendly (tabs scroll horizontally if needed)

---

#### **4.2 Export Benefits Visualization**
**Files**: `src/components/ExportPanel.tsx`

**Cloudinary Tab Benefits**:
```
☁️ Cloudinary Upload
───────────────────
✅ 95% less code (5 lines vs 200+ lines)
✅ Perfect layout guaranteed
✅ No CSS debugging needed
⚡ One-click upload & copy

[Setup Cloudinary] [Generate Code]
```

**Code Tab Warning**:
```
💻 Traditional Code Export
──────────────────────────
⚠️ Complex CSS (may break on AO3)
⚠️ Layout issues possible
💡 Tip: Use Cloudinary mode for guaranteed results

[Copy CSS] [Copy HTML]
```

**Acceptance Criteria**:
- ✅ Benefits shown with icons
- ✅ Warning badges on Code tab
- ✅ Clear comparison messaging
- ✅ "Learn more" links to documentation

---

#### **4.3 Cloudinary Setup Wizard**
**Files**: 
- `src/components/CloudinarySetupWizard.tsx` (NEW)
- `src/components/ExportPanel.tsx`

**Step-by-Step Guide**:
```
Step 1: Create Cloudinary Account
  [Open Cloudinary →]
  
Step 2: Get Your Credentials
  Cloud Name: [_________]
  Upload Preset: [_________]
  
Step 3: Save to .env.local
  [Auto-generate file] [Copy template]
  
Step 4: Restart dev server
  Run: npm run dev
  
[Test Upload] [Skip for now]
```

**Acceptance Criteria**:
- ✅ Wizard accessible from Cloudinary tab
- ✅ Credentials validated before save
- ✅ Test upload button works
- ✅ Error messages helpful

---

### **Testing Checklist**
- [ ] All three export tabs functional
- [ ] Benefits clearly communicated
- [ ] Cloudinary wizard completes successfully
- [ ] Test upload works
- [ ] Mobile export panel usable

**Estimated Time**: 3 days  
**Risk Level**: Low  
**User Impact**: ⭐⭐⭐⭐ (Clarifies export options)

---

## ✏️ **SPRINT 5: Editing Experience Polish** (Week 4 - Days 14-17)

**Goal**: Make message editing feel native and intuitive

### **Deliverables**

#### **5.1 Inline Editing Improvements**
**Files**: All editor components

**Features**:
- Double-click message → Enter edit mode
- Press Enter → Save
- Press Esc → Cancel
- Auto-focus first field when card expands
- Tab navigation between fields

**Acceptance Criteria**:
- ✅ Double-click activates edit mode
- ✅ Keyboard shortcuts work
- ✅ Tab order logical
- ✅ No accidental card collapse

---

#### **5.2 Hover Actions (Desktop)**
**Files**: All editor components

**Implementation**:
```tsx
<MessageCard onHover={() => setShowActions(true)}>
  {showActions && (
    <ActionBar>
      <button>✏️ Edit</button>
      <button>📋 Duplicate</button>
      <button>🗑️ Delete</button>
    </ActionBar>
  )}
</MessageCard>
```

**Acceptance Criteria**:
- ✅ Actions appear on hover (desktop only)
- ✅ Touch-friendly for mobile (long-press)
- ✅ Actions positioned consistently
- ✅ Delete confirms before removing

---

#### **5.3 Drag Handles for All Templates**
**Files**: `src/components/IOSEditor.tsx`, `src/components/AndroidEditor.tsx`

**Current**: Only Twitter supports drag-and-drop  
**Goal**: Universal reordering

**Implementation**:
```tsx
<VirtualMessageList>
  {(idx) => (
    <DraggableCard
      id={message.id}
      index={idx}
      onReorder={handleReorder}
    >
      <DragHandle>⋮⋮</DragHandle>
      {/* Message content */}
    </DraggableCard>
  )}
</VirtualMessageList>
```

**Acceptance Criteria**:
- ✅ iOS messages draggable
- ✅ Android messages draggable
- ✅ Visual indicator (drag handle icon)
- ✅ Works with virtual scrolling

---

#### **5.4 Better Error Messages**
**Files**: All editor components, `src/lib/imgur.ts`, `src/lib/cloudinary.ts`

**Before**:
- ❌ "Failed to upload"
- ❌ "Invalid format"
- ❌ "Error"

**After**:
- ✅ "Image too large (5.2MB). Max size is 5MB. Try compressing at tinypng.com"
- ✅ "URL blocked by CORS. Upload to imgur.com or imgbb.com instead"
- ✅ "Cloudinary credentials missing. Click here to set up"

**Acceptance Criteria**:
- ✅ All error messages include solution
- ✅ Links to external tools when relevant
- ✅ Actionable buttons (Retry, Help, Learn More)

---

### **Testing Checklist**
- [ ] Inline editing works smoothly
- [ ] Hover actions appear correctly
- [ ] Drag-and-drop works on all templates
- [ ] Error messages helpful and actionable

**Estimated Time**: 4 days  
**Risk Level**: Medium  
**User Impact**: ⭐⭐⭐⭐ (Makes editing feel professional)

---

## 🔄 **SPRINT 6: Real-time Preview & Performance** (Week 4 - Days 18-20)

**Goal**: Make preview feel magical and instant

### **Deliverables**

#### **6.1 Debounced Live Preview**
**Files**: `src/pages/index.tsx`, `src/components/PreviewPane.tsx`

**Implementation**:
```typescript
const [draftProject, setDraftProject] = useState(project);
const [previewProject, setPreviewProject] = useState(project);

// Debounce preview updates
useEffect(() => {
  const timer = setTimeout(() => {
    setPreviewProject(draftProject);
  }, 300);
  return () => clearTimeout(timer);
}, [draftProject]);
```

**Acceptance Criteria**:
- ✅ Preview updates 300ms after last keystroke
- ✅ No lag while typing
- ✅ Works on split and tabbed views
- ✅ Preserves scroll position in preview

---

#### **6.2 Auto-scroll to New Message**
**Files**: `src/components/PreviewPane.tsx`

**Features**:
- When message added → Preview scrolls to bottom
- Smooth scroll animation
- Option to disable (toggle in settings)

**Acceptance Criteria**:
- ✅ Auto-scroll on message add
- ✅ Smooth animation (CSS scroll-behavior)
- ✅ Toggle works
- ✅ Doesn't interrupt manual scrolling

---

#### **6.3 Stale Preview Indicator**
**Files**: `src/components/PreviewPane.tsx`

**Implementation**:
```tsx
{isStale && (
  <div className="stale-banner">
    ⚠️ Preview is outdated
    <button onClick={refreshPreview}>Refresh Now</button>
  </div>
)}
```

**Acceptance Criteria**:
- ✅ Shows when preview out of sync
- ✅ Refresh button updates immediately
- ✅ Auto-hides after refresh
- ✅ Doesn't block preview view

---

### **Testing Checklist**
- [ ] Preview updates smoothly while typing
- [ ] Auto-scroll works on message add
- [ ] Stale indicator appears correctly
- [ ] No performance degradation

**Estimated Time**: 3 days  
**Risk Level**: Low  
**User Impact**: ⭐⭐⭐⭐ (Makes tool feel responsive)

---

## 📱 **SPRINT 7: Mobile Gestures & Accessibility** (Week 5 - Days 21-25)

**Goal**: Make app accessible and mobile-native

### **Deliverables**

#### **7.1 Mobile Undo/Redo Gestures**
**Files**: `src/pages/index.tsx`

**Implementation**:
```typescript
const handleTouchGesture = (e: TouchEvent) => {
  const touches = e.touches;
  if (touches.length === 2) {
    const deltaX = touches[1].clientX - touches[0].clientX;
    if (deltaX < -100) undo(); // Swipe left
    if (deltaX > 100) redo();  // Swipe right
  }
};
```

**Acceptance Criteria**:
- ✅ Two-finger swipe left = undo
- ✅ Two-finger swipe right = redo
- ✅ Visual feedback during gesture
- ✅ Works on iOS and Android browsers

---

#### **7.2 Comprehensive Keyboard Shortcuts**
**Files**: 
- `src/components/KeyboardShortcutsPanel.tsx` (NEW)
- `src/pages/index.tsx`

**New Shortcuts**:
```
Ctrl+K → Open Template Picker
Ctrl+B → Bold selected text
Ctrl+/ → Show Keyboard Shortcuts
Ctrl+E → Export/Download
Ctrl+N → New Message
Ctrl+D → Duplicate Message
Tab → Navigate between fields
Shift+Tab → Navigate backwards
```

**Shortcuts Panel**:
```
┌─────────────────────────────────┐
│  ⌨️ Keyboard Shortcuts          │
├─────────────────────────────────┤
│  Ctrl+S     Save project        │
│  Ctrl+Z     Undo                │
│  Ctrl+Y     Redo                │
│  Ctrl+K     Template Picker     │
│  Ctrl+/     Show this help      │
│  Esc        Close modal         │
└─────────────────────────────────┘
```

**Acceptance Criteria**:
- ✅ All shortcuts work
- ✅ Help panel accessible (Ctrl+/ or ? button)
- ✅ Platform-aware (Cmd vs Ctrl on Mac)
- ✅ Visual hints in UI (tooltip badges)

---

#### **7.3 ARIA Labels & Focus Management**
**Files**: All components

**Checklist**:
- ✅ All buttons have `aria-label`
- ✅ Form fields have proper `<label>` associations
- ✅ Modals trap focus
- ✅ Skip links for navigation
- ✅ Headings hierarchy correct (H1 → H2 → H3)
- ✅ Color contrast meets WCAG AA (4.5:1)

**Tools**:
- axe DevTools
- Lighthouse Accessibility Audit
- Screen reader testing (NVDA/JAWS)

**Acceptance Criteria**:
- ✅ Lighthouse score: 95+
- ✅ No axe violations
- ✅ Screen reader can navigate app
- ✅ Keyboard-only navigation works

---

### **Testing Checklist**
- [ ] Mobile gestures work on real devices
- [ ] All keyboard shortcuts functional
- [ ] Shortcuts panel complete and accurate
- [ ] Accessibility audit passes
- [ ] Screen reader navigation smooth

**Estimated Time**: 5 days  
**Risk Level**: Medium (cross-browser testing)  
**User Impact**: ⭐⭐⭐⭐⭐ (Makes app inclusive)

---

## 📊 **SUCCESS METRICS**

After all sprints complete, we should measure:

### **User Experience Metrics**
- ✅ First-time user completion rate: **Target 60%+** (up from ~20%)
- ✅ Average time to first export: **Target <5 minutes** (down from ~15 min)
- ✅ Mobile usage percentage: **Target 40%+** (currently ~15%)
- ✅ Template switch errors: **Target 0** (currently ~30/month)

### **Feature Adoption**
- ✅ Character Bank usage: **Target 70%+** (currently ~10% - Twitter only)
- ✅ Fast Mode usage: **Target 40%+** (currently ~5%)
- ✅ Cloudinary adoption: **Target 30%+** (currently ~5%)

### **Technical Metrics**
- ✅ Lighthouse Performance: **Target 90+**
- ✅ Lighthouse Accessibility: **Target 95+**
- ✅ Mobile load time: **Target <3s**
- ✅ Error rate: **Target <1%** (currently ~5%)

---

## 🚀 **DEPLOYMENT STRATEGY**

### **Sprint-by-Sprint Rollout**
1. ✅ **Sprint 1**: COMPLETE - Critical safety fixes deployed
2. ✅ **Sprint 2**: COMPLETE - Character library & export panel
3. ✅ **Sprint 3**: COMPLETE - Fast mode & messaging improvements
4. ✅ **Sprint 4**: COMPLETE - Export improvements & donation prompts
5. ✅ **Sprint 5**: COMPLETE - Collapsible settings & unified compose modes (Dec 17, 2025)
6. **Sprint 6-7**: Pending - Advanced editing features

### **Sprint 5 Completion Summary** (December 17, 2025)
#### Collapsible Settings & Compose Modes
- ✅ All 4 templates updated (iOS, Android, Twitter, Google)
- ✅ Settings panels collapse by default (cleaner UI)
- ✅ Fast/Detailed mode toggle with localStorage persistence
- ✅ Smooth animations and consistent styling
- ✅ Platform-optimized defaults (messaging=fast, Twitter=detailed)

#### Intelligent URL Caching
- ✅ Created `src/lib/urlCache.ts` - Cross-session URL persistence
- ✅ 90-day cache with usage tracking
- ✅ Auto-fill previously used URLs
- ✅ Deduplication system (same image used 5× = upload once)
- ✅ Enhanced URL collection modal with cache indicators

#### GIF Preservation
- ✅ Updated `src/lib/zipGenerator.ts` - Preserve GIF animations
- ✅ Robust format detection (URL + MIME type)
- ✅ JPEG/PNG also preserved as-is
- ✅ Only WebP/exotic formats converted to PNG

### **Feature Flags**
Use environment variables to enable/disable:
```
NEXT_PUBLIC_ENABLE_WELCOME_MODAL=true
NEXT_PUBLIC_ENABLE_UNIVERSAL_CHARACTERS=true
NEXT_PUBLIC_ENABLE_FAST_MODE_PREVIEW=true
NEXT_PUBLIC_ENABLE_MOBILE_GESTURES=true
NEXT_PUBLIC_ENABLE_URL_CACHE=true (default: true)
```

### **Rollback Plan**
- Keep Git tags for each sprint
- Feature flags allow instant rollback
- Database migrations are backwards-compatible

---

## 💬 **USER COMMUNICATION**

### **Changelog Updates**
After each sprint, update CHANGELOG.md with:
- What's new
- What's improved
- Breaking changes (if any)
- Migration guides

**Latest Update**: December 17, 2025 - Sprint 5 Complete
- Collapsible settings across all templates
- Fast Mode/Detailed Mode toggle system
- Intelligent URL caching (saves time on repeated exports)
- GIF animation preservation in ZIP downloads
- Image deduplication (upload once, use many times)

### **In-App Notifications**
Show toast on first visit after deployment:
```
✨ New: Smart URL caching! Reused images auto-fill from previous uploads.
🎯 Duplicate images detected? Upload once, use everywhere!
[Learn More] [Dismiss]
```

### **Documentation Updates**
- ✅ Updated README.md with Sprint 5 features
- ✅ Updated CHANGELOG.md with detailed implementation notes
- ✅ Architecture notes for URL cache and deduplication
- 🔄 Create video walkthrough (2-3 minutes) - PENDING

---

## 📝 **NOTES FOR IMPLEMENTATION**

### **Code Quality Standards**
- ✅ TypeScript strict mode
- ✅ ESLint with accessibility rules
- ✅ Prettier formatting
- ✅ Unit tests for critical functions
- ✅ E2E tests for user flows

### **Performance Budgets**
- Bundle size: **<500KB** (currently ~400KB)
- Time to Interactive: **<3s**
- First Contentful Paint: **<1.5s**

### **localStorage Architecture**
- `ao3skin_[platform]_settings_open` - Per-template settings panel state
- `ao3skin_[platform]_compose_mode` - Per-template compose mode (fast/detailed)
- `ao3_url_cache` - Global URL cache (cross-template, 90-day TTL)
- `ao3_url_collection_progress` - Temporary URL collection progress
- `ao3_donation_tracking` - Donation prompt frequency tracking

### **Browser Support**
- Chrome/Edge: Last 2 versions
- Firefox: Last 2 versions
- Safari: Last 2 versions
- Mobile Safari: iOS 14+
- Chrome Mobile: Android 10+

---

**Sprint 5 Complete!** 🎉  
Next: Sprint 6 - Advanced editing features (message reordering, bulk operations)

