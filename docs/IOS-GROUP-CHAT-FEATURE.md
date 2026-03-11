# iOS/iMessage Group Chat Feature

## Overview
Added full group chat support to iOS/iMessage template, matching the functionality already available in WhatsApp/Android template.

---

## Features Implemented

### 1. **Group Chat Toggle**
- ✅ Enable/disable group chat mode
- ✅ Auto-initializes participants array on first enable
- ✅ Shows sender names above incoming messages (like WhatsApp)

### 2. **Group Settings**
- ✅ Group Name field (e.g., "Family Chat", "Squad")
- ✅ Participant management system
- ✅ Color-coded sender names
- ✅ Optional participant avatars

### 3. **Participant Management**
- ✅ Add unlimited participants
- ✅ Each participant has:
  - Name (editable)
  - Color (customizable color picker)
  - Avatar URL (optional, with Cloudinary upload)
- ✅ Remove participants with confirmation
- ✅ Predefined color palette (8 colors that auto-assign)

### 4. **Message Assignment**
- ✅ Assign incoming messages to specific participants
- ✅ Participant selector dropdown in message cards
- ✅ Visual indicators (colored dot + avatar)
- ✅ Works with CompactMessageCard component

---

## Schema Changes

### Added Fields to `SkinSettings`
```typescript
iosGroupMode?: boolean;              // Enable group chat
iosGroupName?: string;               // Group name
iosGroupParticipants?: GroupParticipant[]; // Participants array
```

### Reuses Existing `GroupParticipant` Type
```typescript
interface GroupParticipant {
  id: string;
  name: string;
  color: string;
  avatarUrl?: string;
}
```

---

## UI Components

### IOSEditor.tsx
- Added group chat section after dark mode toggle
- Collapsible participant list
- Color picker for each participant
- Cloudinary avatar upload for each participant
- Add/Remove participant buttons
- Same UI pattern as Android/WhatsApp

### CompactMessageCard.tsx
- Already supported group participants
- Shows participant selector for incoming messages
- Displays participant avatar or colored initial
- Works for both iOS and Android

---

## Color Palette

Pre-defined 8 colors that auto-assign in sequence:
1. `#FF5733` - Red-Orange
2. `#3498DB` - Blue
3. `#9B59B6` - Purple
4. `#E67E22` - Orange
5. `#27AE60` - Green
6. `#E91E63` - Pink
7. `#F39C12` - Yellow
8. `#1ABC9C` - Teal

Colors cycle through as more participants are added.

---

## User Workflow

### Setting Up Group Chat

1. Check "👥 Enable Group Chat"
2. Enter group name (e.g., "Family Chat")
3. Click "+ Add Participant"
4. Customize each participant:
   - Edit name
   - Choose color
   - Upload avatar (optional)
5. Create messages in Fast Mode or Single Message Composer
6. Assign incoming messages to participants

### Assigning Messages

When group mode is enabled:
- **Outgoing messages**: Always from "You" (no participant needed)
- **Incoming messages**: Dropdown appears to select which participant sent it
- Visual indicator: Colored dot + avatar shows selected participant

---

## Files Modified

1. **src/lib/schema.ts**
   - Added `iosGroupMode`, `iosGroupName`, `iosGroupParticipants`

2. **src/components/IOSEditor.tsx**
   - Added `PARTICIPANT_COLORS` constant
   - Imported `GroupParticipant` type
   - Added group chat UI section
   - Passed `isGroupMode` and `groupParticipants` to CompactMessageCard

3. **src/components/CompactMessageCard.tsx**
   - No changes needed (already supported group mode)

---

## Comparison: iOS vs Android Group Chat

Both implementations are now feature-identical:

| Feature | iOS/iMessage | WhatsApp/Android |
|---------|-------------|------------------|
| Group toggle | ✅ | ✅ |
| Group name | ✅ | ✅ |
| Participant management | ✅ | ✅ |
| Color customization | ✅ | ✅ |
| Avatar upload | ✅ | ✅ |
| Cloudinary support | ✅ | ✅ |
| Message assignment | ✅ | ✅ |
| Visual indicators | ✅ | ✅ |

---

## Example Use Cases

### Family Chat
```
Group Name: "Family 💙"
Participants:
  - Mom (Pink, avatar uploaded)
  - Dad (Blue, avatar uploaded)
  - Sister (Purple, avatar uploaded)
```

### Friend Group
```
Group Name: "Squad Goals"
Participants:
  - Alex (Orange)
  - Sam (Green)
  - Jordan (Teal)
  - Casey (Yellow)
```

### Work Team
```
Group Name: "Project Delta"
Participants:
  - Manager (Red-Orange)
  - Dev Lead (Blue)
  - Designer (Purple)
```

---

## Benefits

✅ **Feature Parity**: iOS now matches Android/WhatsApp functionality
✅ **User Choice**: Writers can create group chats in either platform
✅ **Realistic**: Authentic group chat appearance for fics
✅ **Flexible**: Support 2-8+ participants with distinct colors
✅ **Professional**: Avatar support makes it look polished

---

## Future Enhancements

Potential improvements:
- [ ] Group photo (like actual iMessage groups have)
- [ ] "Someone is typing..." indicator with participant name
- [ ] Participant role tags (admin, member)
- [ ] Import/export participant list
- [ ] Bulk assign messages to participants
- [ ] Random participant assignment button

---

## Testing Checklist

- [x] Enable group mode
- [x] Add 3+ participants
- [x] Customize participant names
- [x] Change participant colors
- [x] Upload participant avatars via Cloudinary
- [x] Remove a participant
- [x] Create incoming messages
- [x] Assign messages to different participants
- [x] Verify participant names display in preview
- [x] Verify colors match in preview
- [x] Disable group mode (reverts to 1-on-1)

All tests passing! ✅
