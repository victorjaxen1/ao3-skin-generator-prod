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

### Female (6)
- Alex Rivers - Young woman with auburn hair
- Taylor Swift - Blonde celebrity style
- Jamie Chen - Asian woman, casual style
- Riley - Redhead with freckles
- Mom - Middle-aged woman
- Casey - Short dark hair

### Male (6)
- Jordan - Athletic young man
- Sam - Casual guy next door
- Marcus - Professional businessman
- Tyler - Hipster with beard
- Dad - Middle-aged man
- Jake - Teen boy

### Neutral/Androgynous (6)
- Quinn - Androgynous style
- Avery - Short pixie cut
- Morgan - Long wavy hair
- Skyler - Colorful hair
- River - Alternative style
- Phoenix - Artistic vibe

### Fantasy/Fictional (6)
- Elara - Elf princess
- Kira - Warrior woman
- Zephyr - Mysterious mage
- Luna - Moon witch
- Rex - Armored knight
- Nova - Sci-fi character

### Professional/Work (6)
- Dr. Chen - Doctor in lab coat
- Detective Ray - Noir detective
- Agent K - Secret agent
- Chef Mia - Chef in whites
- Prof. Harris - Academic professor
- Officer Park - Police officer

## TypeScript Interface

```typescript
export interface CharacterAvatar {
  id: string;                    // e.g., 'f1', 'm2', 'n3'
  name: string;                  // Display name
  url: string;                   // Full CDN URL
  category: 'female' | 'male' | 'neutral' | 'fantasy' | 'professional';
  description?: string;          // Short description
}
```

## Helper Functions

### `getAvatarById(id: string)`
Retrieve a specific character by ID.

```typescript
const char = getAvatarById('f1'); // Returns Alex Rivers
```

### `getAvatarsByCategory(category)`
Get all characters in a category.

```typescript
const females = getAvatarsByCategory('female'); // 6 characters
const fantasy = getAvatarsByCategory('fantasy'); // 6 characters
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

```
https://media.publit.io/file/avatars/{filename}.png
```

Example URLs:
- `https://media.publit.io/file/avatars/alex-rivers.png`
- `https://media.publit.io/file/avatars/taylor-swift.png`
- `https://media.publit.io/file/avatars/elara.png`

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
    id: 'f7',                              // Next available ID
    name: 'Sarah Lee', 
    url: avatarUrl('sarah-lee.png'),       // Filename only
    category: 'female',
    description: 'Business professional'
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

- `src/lib/characterBank.ts` - Main bank definition
- `src/lib/platformAssets.ts` - Platform icons/headers/footers
- `src/lib/examples.ts` - Example templates using CHARACTER_BANK
- `src/components/CharacterBank.tsx` - User-saved character management (different feature)

---

**Note**: `CharacterBank.tsx` component is for **user-saved custom characters** (localStorage), while `characterBank.ts` is the **pre-built library** of 30 avatars. They serve different purposes.
