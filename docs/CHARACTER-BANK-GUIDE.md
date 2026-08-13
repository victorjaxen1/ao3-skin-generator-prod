# Character Bank Guide

## Overview

The Character Bank provides 30 pre-configured character avatars organized by category, making it easy for users to quickly populate their social media mockups without hunting for images.

## File Structure

```
src/lib/characterBank.ts
```

This file contains:
- **CHARACTER_BANK**: Array of 30 character objects
- **CharacterAvatar**: TypeScript interface
- **Helper functions**: For retrieving characters

## Character Categories

These are generated from `CHARACTER_BANK` in `src/lib/characterBank.ts`. Preset **names describe the image, not a character** — the People/Accounts sheet asks for a real name before saving one.

### Modern / Contemporary (10)
- `m1` **Casual Young Man** — Age 18-25, everyday protagonist
- `m2` **Casual Young Woman** — Age 18-25, everyday protagonist
- `m3` **Business Man** — Professional in suit, corporate AUs
- `m4` **Business Woman** — Professional attire, boss dynamics
- `m5` **Teen Boy** — Age 15-17, high school AUs
- `m6` **Teen Girl** — Age 15-17, YA fiction
- `m7` **Soft Boy** — E-boy aesthetic, modern internet culture
- `m8` **Alternative Girl** — Goth/punk style, subculture rep
- `m9` **Athletic Jock** — Sports AUs, college settings
- `m10` **Hipster Guy** — Beard, glasses, coffee shop AUs

### Diversity (6)
- `d1` **Asian Man** — East Asian rep, K-pop AUs
- `d2` **Asian Woman** — East Asian rep, diverse casting
- `d3` **Black Man** — Black representation, diverse casting
- `d4` **Black Woman** — Black representation, diverse casting
- `d5` **Hijabi Woman** — Religious/cultural representation
- `d6` **Plus-Size Character** — Body diversity, size representation

### Neutral / Androgynous (4)
- `n1` **Androgynous Masc** — Masculine-presenting NB
- `n2` **Androgynous Femme** — Feminine-presenting NB
- `n3` **Quinn** — Gender-neutral style
- `n4` **River** — Alternative NB aesthetic

### Fantasy & Genre (6)
- `f1` **Elf Warrior** — Fantasy/D&D settings
- `f2` **Knight** — Medieval/historical combat
- `f3` **Mage** — Wizard/magic user
- `f4` **Vampire** — Supernatural romance, gothic
- `f5` **Royalty** — Regency, historical romance
- `f6` **Cyberpunk** — Sci-fi, futuristic settings

### Age-Varied (4)
- `a1` **Dad Figure** — Age 40s-50s, found family trope
- `a2` **Mom Figure** — Age 40s-50s, parental support
- `a3` **Silver Fox** — Distinguished older man, age gap romance
- `a4` **Mature Woman** — Elegant older woman, mentor figure

## TypeScript Interface

```typescript
export interface CharacterAvatar {
  id: string;                    // e.g., 'f1', 'm2', 'n3'
  name: string;                  // Display name
  url: string;                   // Full CDN URL
  category: 'modern' | 'diversity' | 'fantasy' | 'neutral' | 'age-varied';
  description?: string;          // Short description
}
```

## Helper Functions

### `getAvatarById(id: string)`
Retrieve a specific character by ID.

```typescript
const char = getAvatarById('f1'); // Returns the Elf Warrior preset
```

### `getAvatarsByCategory(category)`
Get all characters in a category.

```typescript
const modern = getAvatarsByCategory('modern');   // 10 presets
const fantasy = getAvatarsByCategory('fantasy'); // 6 presets
```

### `resolveAvatarUrl(avatarIdOrUrl: string)`
Smart resolver that:
- Returns custom URLs as-is if they start with `http` or `/`
- Looks up character bank IDs and returns their CDN URL
- Returns empty string if ID not found

```typescript
resolveAvatarUrl('f1');                    // → CDN URL for Alex Rivers
resolveAvatarUrl('https://i.imgur.com/abc.png'); // → https://i.imgur.com/abc.png
resolveAvatarUrl('/custom/avatar.png');    // → /custom/avatar.png
```

## Usage in Components

### Importing

```typescript
import { CHARACTER_BANK, getAvatarById, resolveAvatarUrl } from '../lib/characterBank';
```

### Display Character Grid

```tsx
<div className="grid grid-cols-6 gap-2">
  {CHARACTER_BANK.map(char => (
    <button key={char.id} onClick={() => selectCharacter(char)}>
      <img src={char.url} alt={char.name} />
      <span>{char.name}</span>
    </button>
  ))}
</div>
```

### Category Tabs

```tsx
{AVATAR_CATEGORIES.map(cat => (
  <button 
    key={cat.id}
    onClick={() => setCategory(cat.id)}
  >
    {cat.emoji} {cat.label}
  </button>
))}
```

### Character Selector with Custom URL Support

```tsx
function CharacterSelector({ onSelect }) {
  const [customUrl, setCustomUrl] = useState('');
  
  return (
    <>
      {/* Pre-built characters */}
      <div className="character-grid">
        {CHARACTER_BANK.map(char => (
          <CharacterCard 
            key={char.id} 
            character={char}
            onSelect={onSelect}
          />
        ))}
      </div>
      
      {/* Custom URL input */}
      <div>
        <input 
          type="url"
          value={customUrl}
          onChange={(e) => setCustomUrl(e.target.value)}
          placeholder="Or paste custom avatar URL..."
        />
        <button onClick={() => onSelect({ url: customUrl })}>
          Use Custom
        </button>
      </div>
    </>
  );
}
```

## CDN URLs

All avatars are hosted on Publit.io:

```text
https://media.publit.io/file/AO3-Skins-App/avatars/{filename}.png
```

Example URLs:
- `https://media.publit.io/file/AO3-Skins-App/avatars/casual-young-man.png`
- `https://media.publit.io/file/AO3-Skins-App/avatars/elf-warrior.png`

Quick-template avatars are separate: those are local files under `/assets`, and
`tests/identity.unit.spec.ts` asserts every one of them exists on disk.

## Adding New Characters

To add new characters to the bank:

1. **Upload Image to Publit.io**
   - Upload to `/avatars/` folder
   - Use kebab-case naming: `character-name.png`
   - Recommended size: 400x400px minimum

2. **Add to CHARACTER_BANK Array**

```typescript
export const CHARACTER_BANK: CharacterAvatar[] = [
  // ... existing characters
  { 
    id: 'm11',                             // Next available ID in the category
    name: 'Business Woman In Scrubs',      // Describes the IMAGE, not a character
    url: avatarUrl('business-woman-scrubs.png'), // Filename only
    category: 'modern',
    description: 'Medical AUs'
  },
];
```

3. **Update Documentation**
   - Add to this guide
   - Update count in main README if category sizes change

## Best Practices

### For Developers

1. **Always use `resolveAvatarUrl()`** when handling user input
   - Supports both character IDs and custom URLs
   - Provides consistent behavior

2. **Validate custom URLs** before saving
   - Check URL format
   - Test image loads successfully
   - Provide fallback if CDN fails

3. **Cache CHARACTER_BANK** in components
   - It's a static array, no need to reload
   - Use `useMemo` if filtering

### For Users

1. **Browse by category** for faster selection
2. **Use custom URLs** for personal branding
3. **Test avatars** in preview before exporting

## Fallback Strategy

If Publit.io CDN is unavailable:

1. **Browser cache** will serve previously loaded avatars
2. **Local fallback** can be implemented by downloading all 30 avatars to `/public/avatars/`
3. **Custom URLs** always work independently

Update the `avatarUrl()` helper to switch between CDN and local:

```typescript
function avatarUrl(filename: string): string {
  const USE_LOCAL = false; // Set to true for local fallback
  return USE_LOCAL 
    ? `/avatars/${filename}`
    : `${PUBLIT_CDN}/avatars/${filename}`;
}
```

## Performance Considerations

- **Lazy loading**: Only load avatars when category is opened
- **Thumbnails**: Consider serving smaller 100x100px thumbnails for grid view
- **Pagination**: If bank grows beyond 50 characters, implement pagination
- **Search**: Add name/description search for large banks
## Related Files

- `src/lib/characterBank.ts` — Preset avatar bank (the static image data on this page)
- `src/lib/identity.ts` — Scene identity model: resolution, migration, add/edit/archive
- `src/components/CastPanel.tsx` — The People/Accounts sheet (the whole identity UI)
- `src/lib/platformAssets.ts` — Platform icons/headers/footers
- `src/lib/examples.ts` — Quick templates, instantiated as isolated clones

---

## Where the preset bank fits in the identity workflow

The preset bank is **one image source inside the People/Accounts sheet**. It is not a
character list and it does not create characters on its own.

### Scene identities are the real model

Everyone who appears in a scene is a `SceneCharacter` stored on the project
(`project.cast`), addressed by a stable `id`:

```typescript
interface SceneCharacter {
  id: string;
  name: string;
  avatarUrl?: string;
  twitterHandle?: string;
  verified?: boolean;
  sourceLibraryId?: string;  // provenance only — NOT a live reference
  archived?: boolean;
}
```

Messages point at these by `Message.characterId`, so a rename or an avatar change
reaches every message that identity already speaks in. Names are never identity keys:
two characters may share a display name and stay separate.

### The one sheet, and its states

`CastPanel` is a single controlled sheet — titled **People** on iOS/Android and
**Accounts** on Twitter — with these modes:

| Mode | What it is |
| --- | --- |
| `overview` | Who is in this scene, plus **Add person**/**Add account** and **Library** |
| `create` | Complete-profile form (name, avatar, handle, verified, group colour) |
| `edit` | The same form for an existing identity, plus archive/reassign |
| `library` | Saved `UniversalCharacter[]`, each with an explicit **Add** (copy) action |
| `avatar-presets` | The `CHARACTER_BANK` grid on this page |

Google renders none of it. A search page has no cast, so it exposes only
**Add result details**.

### Choosing a preset avatar

Selecting a preset fills the **Avatar** field and returns to the form. It deliberately
does **not** create a character, because bank names such as “Casual Young Man” or
“Mage” describe the image, not a person. The author still names the character before
saving.

### Library ↔ scene is copy, never link

Adding a library entry to a scene creates a **new** `SceneCharacter` and records
`sourceLibraryId` for provenance only:

```typescript
copyLibraryCharacterToScene(project, source, role)
```

- editing the scene copy never writes back to the library;
- editing the library never reaches into a scene that copied from it;
- two projects seeded from the same library entry stay independent;
- the library is never silently merged into a scene's roster.

Creating a person offers **Also save to my library** as an explicit opt-in.

### Complete profiles, one transaction

The removed `onSetAsContact(name, avatarUrl)` API is gone. It carried only two of the
four Twitter fields, which is exactly why handles used to disappear. Every save now
passes a whole profile through one helper, so undo/redo sees one coherent change:

```typescript
addSceneCharacter(project, draft, role)
updateSceneCharacter(project, id, updates)
archiveOrReassignCharacter(project, id, replacementId?)
```

Legacy settings fields (`iosContactName`, `twitterHandle`, …) are kept in sync as a
fallback for older saved projects; they are no longer the source of truth.

### Removing someone who has already spoken

Deleting an identity must never corrupt existing messages:

- unreferenced → removed immediately;
- referenced → **Archive** (it leaves new-message selectors but still resolves and
  edits from old messages), or **Reassign** those messages to another identity first.

### Reaching the editor

Identity is editable from wherever a person is visible: the header title, the composer
identity chip and its ✎ button, the timeline sender label, and the name/handle/avatar
in the preview. Clicking a preview **message body** still opens the message editor —
identity wins only on a name, handle, or avatar.
