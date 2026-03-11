# CDN Migration Testing Checklist

> **Last Updated:** December 14, 2025
> **CDN Provider:** Publit.io
> **Base URL:** `https://media.publit.io/file/AO3-Skins-App/`

## Important Notes

### Known Filename Quirks
- WhatsApp header is named `whatapp-header.png` (missing 's' - this is intentional, it's the actual filename on CDN)
- Character bank avatars use `/avatars/` subfolder: `https://media.publit.io/file/AO3-Skins-App/avatars/`
- Example template avatars are in root folder (no `/avatars/` subfolder)

### URL Structure
- **Character Bank:** `https://media.publit.io/file/AO3-Skins-App/avatars/{filename}.png`
- **Platform Assets:** `https://media.publit.io/file/AO3-Skins-App/{platform}-{asset}.png`
- **Example Avatars:** `https://media.publit.io/file/AO3-Skins-App/{name}-avatar.png`

## Pre-Deployment Tests

### 1. Character Bank Verification

- [ ] Import `CHARACTER_BANK` from `characterBank.ts` works
- [ ] All 30 characters load correctly
- [ ] Categories display properly (Female, Male, Neutral, Fantasy, Professional)
- [ ] `getAvatarById()` returns correct character
- [ ] `getAvatarsByCategory()` filters correctly
- [ ] `resolveAvatarUrl()` handles both IDs and custom URLs

**Test Commands:**
```typescript
import { CHARACTER_BANK, getAvatarById, resolveAvatarUrl } from './src/lib/characterBank';

console.log(CHARACTER_BANK.length); // Should be 30
console.log(getAvatarById('f1')); // Should return Alex Rivers
console.log(resolveAvatarUrl('f1')); // Should return CDN URL
console.log(resolveAvatarUrl('https://example.com/custom.png')); // Should return custom URL
```

### 2. Platform Assets Verification

- [ ] `PLATFORM_ASSETS` import works from `platformAssets.ts`
- [ ] Twitter verified badge loads: `PLATFORM_ASSETS.twitter.verifiedBadge`
- [ ] WhatsApp header loads: `PLATFORM_ASSETS.whatsapp.headerImage`
- [ ] iOS header loads: `PLATFORM_ASSETS.ios.headerImage`
- [ ] iOS footer loads: `PLATFORM_ASSETS.ios.footerImage`
- [ ] Google logo loads: `PLATFORM_ASSETS.google.logo`

**Test in Browser Console:**
```javascript
// Open app in browser, check console
console.log(PLATFORM_ASSETS.ios.headerImage);
// Should show: https://media.publit.io/file/AO3-Skins-App/imessage-header.png
```

### 3. Examples.ts Templates

- [ ] Import statement has both `PLATFORM_ASSETS` and `CHARACTER_BANK`
- [ ] Twitter examples use `${AVATAR_CDN}/` template literals
- [ ] iOS examples use `PLATFORM_ASSETS.ios.headerImage`
- [ ] Android examples use `PLATFORM_ASSETS.whatsapp.headerImage`
- [ ] No `/assets/` paths remain (except in attachments)

**Grep Verification:**
```powershell
# Should find NO matches in examples.ts (except comments/attachments)
Select-String -Path "src\lib\examples.ts" -Pattern "'/assets/" | Where-Object { $_ -notmatch "sunset-scene" }
```

### 4. Schema Defaults

- [ ] `schema.ts` defaults use full CDN URLs
- [ ] iOS header: `https://media.publit.io/file/AO3-Skins-App/imessage-header.png`
- [ ] iOS footer: `https://media.publit.io/file/AO3-Skins-App/imessage-footer.jpg`
- [ ] Android header: `https://media.publit.io/file/AO3-Skins-App/whatapp-header.png` (note: typo is intentional - actual filename)
- [ ] Android footer: `https://media.publit.io/file/AO3-Skins-App/whatsapp-footer.png`

**Test:**
```typescript
import { createDefaultProject } from './src/lib/schema';
const project = createDefaultProject();
console.log(project.settings.iosHeaderImageUrl);
// Should show CDN URL, not /assets/
```

## Build & Runtime Tests

### 5. Development Build

```powershell
npm run dev
```

- [ ] Build completes without errors
- [ ] No TypeScript compilation errors
- [ ] No import/export errors
- [ ] Dev server starts on http://localhost:3000

### 6. Production Build

```powershell
npm run build
```

- [ ] Build succeeds
- [ ] No tree-shaking errors
- [ ] Bundle size reasonable (check `.next/static/`)
- [ ] All imports resolve correctly

### 7. Browser Testing

#### Twitter/X Template
- [ ] Load Twitter example
- [ ] Avatar images load from CDN
- [ ] Twitter icon displays
- [ ] No broken image links
- [ ] Custom URL input works

#### iOS iMessage Template
- [ ] Load iOS example
- [ ] Header image loads from CDN
- [ ] Footer image loads from CDN
- [ ] Avatar overlay works if added
- [ ] Dark mode works

#### Android WhatsApp Template
- [ ] Load Android example
- [ ] Header image loads from CDN
- [ ] Footer image loads from CDN
- [ ] Status icons display
- [ ] Dark mode works

### 8. Character Selector UI

- [ ] CHARACTER_BANK displays in grid
- [ ] Click character selects it
- [ ] Avatar URL populates in form
- [ ] Category filtering works
- [ ] Search functionality (if implemented)
- [ ] Custom URL input field works

### 9. Export Functionality

- [ ] Export CSS with CDN URLs
- [ ] Preview shows CDN images
- [ ] Copy to clipboard works
- [ ] Downloaded CSS file contains correct URLs
- [ ] No Base64 data URIs in output

### 10. Error Handling

- [ ] Invalid CDN URL shows fallback
- [ ] Network error handling graceful
- [ ] Missing avatar shows placeholder
- [ ] Console logs helpful errors

## CDN Upload Verification

### 11. Publit.io CDN Setup

**CDN Base URL:** `https://media.publit.io/file/AO3-Skins-App/`

**Character avatars are stored in:** `https://media.publit.io/file/AO3-Skins-App/avatars/`

Example avatar URLs:
```
https://media.publit.io/file/AO3-Skins-App/avatars/alex-rivers.png
https://media.publit.io/file/AO3-Skins-App/avatars/taylor-swift.png
https://media.publit.io/file/AO3-Skins-App/avatars/jamie-chen.png
https://media.publit.io/file/AO3-Skins-App/avatars/jordan.png
```

**Example template avatars are stored directly in:** `https://media.publit.io/file/AO3-Skins-App/`

Example URLs (note: filenames may have different capitalization):
```
https://media.publit.io/file/AO3-Skins-App/alex-avatar.png
https://media.publit.io/file/AO3-Skins-App/Taylor-Swift-avatar.png
https://media.publit.io/file/AO3-Skins-App/Jamie-Chen-avatar.png
https://media.publit.io/file/AO3-Skins-App/Riley-avatar.png
https://media.publit.io/file/AO3-Skins-App/jordan-avatar.png
https://media.publit.io/file/AO3-Skins-App/mom-avatar.png
https://media.publit.io/file/AO3-Skins-App/Casey-avatar.png
```

**Platform assets are stored directly in:** `https://media.publit.io/file/AO3-Skins-App/`
Example platform asset URLs:
```
https://media.publit.io/file/AO3-Skins-App/twitter-verifiedBadge.png
https://media.publit.io/file/AO3-Skins-App/twitter-logo.png
https://media.publit.io/file/AO3-Skins-App/twitter-replyIcon.png
https://media.publit.io/file/AO3-Skins-App/twitter-retweetIcon.png
https://media.publit.io/file/AO3-Skins-App/twitter-likeIcon.png
https://media.publit.io/file/AO3-Skins-App/twitter-views.png
https://media.publit.io/file/AO3-Skins-App/whatapp-header.png (note: typo is intentional - actual filename)
https://media.publit.io/file/AO3-Skins-App/whatsapp-footer.png
https://media.publit.io/file/AO3-Skins-App/imessage-header.png
https://media.publit.io/file/AO3-Skins-App/imessage-footer.jpg
https://media.publit.io/file/AO3-Skins-App/google-logo-long.png
https://media.publit.io/file/AO3-Skins-App/google-search-glass.png
```

### 12. CDN URL Testing

Test each URL directly in browser:

- [ ] `https://media.publit.io/file/AO3-Skins-App/avatars/alex-rivers.png` loads
- [ ] `https://media.publit.io/file/AO3-Skins-App/avatars/taylor-swift.png` loads
- [ ] `https://media.publit.io/file/AO3-Skins-App/imessage-header.png` loads
- [ ] `https://media.publit.io/file/AO3-Skins-App/whatapp-header.png` loads

**Quick Test Script:**
```powershell
# Test if CDN URLs return 200 OK
$urls = @(
    "https://media.publit.io/file/AO3-Skins-App/avatars/alex-rivers.png",
    "https://media.publit.io/file/AO3-Skins-App/imessage-header.png",
    "https://media.publit.io/file/AO3-Skins-App/whatapp-header.png"
)

foreach ($url in $urls) {
    try {
        $response = Invoke-WebRequest -Uri $url -Method Head
        Write-Host "✅ $url - Status: $($response.StatusCode)"
    } catch {
        Write-Host "❌ $url - ERROR: $_"
    }
}
```

## Performance Tests

### 13. Load Time Comparison

- [ ] Measure initial page load (should be faster without Base64)
- [ ] Check network tab for parallel CDN requests
- [ ] Verify browser caching works
- [ ] Test on slow 3G connection

### 14. Bundle Size

```powershell
# Check bundle size
npm run build
Get-ChildItem .next\static -Recurse | Measure-Object -Property Length -Sum
```

- [ ] Main bundle < 500KB
- [ ] No huge Base64 strings in bundles
- [ ] CSS output reasonable size

## Cross-Browser Testing

### 15. Browser Compatibility

- [ ] Chrome (latest) - Full functionality
- [ ] Firefox (latest) - Full functionality  
- [ ] Safari (Mac) - Full functionality
- [ ] Edge (latest) - Full functionality
- [ ] Mobile Safari (iOS) - Responsive, images load
- [ ] Chrome Mobile (Android) - Responsive, images load

## Regression Tests

### 16. Existing Features Still Work

- [ ] Save project to localStorage
- [ ] Load project from localStorage
- [ ] Message reordering (drag-drop)
- [ ] Dark mode toggle
- [ ] Export preview
- [ ] Copy CSS to clipboard
- [ ] Character bank (user-saved) still works
- [ ] Example templates load correctly

## Documentation Review

### 17. Documentation Updated

- [ ] `README.md` mentions CDN approach
- [ ] `CDN-MIGRATION-COMPLETE.md` exists
- [ ] `CHARACTER-BANK-GUIDE.md` exists
- [ ] API docs reflect new imports
- [ ] Inline comments accurate

## Final Checklist

- [ ] All 30 avatars uploaded to Publit.io
- [ ] All platform assets uploaded to Publit.io
- [ ] No TypeScript errors
- [ ] No runtime console errors
- [ ] All templates render correctly
- [ ] Custom URLs work
- [ ] Export generates correct CSS
- [ ] Performance improved vs Base64
- [ ] Documentation complete
- [ ] Git commit with clear message

## Sign-Off

**Tested By:** _________________  
**Date:** _________________  
**Build Version:** _________________  
**Status:** ☐ PASS / ☐ FAIL  

**Notes:**
_______________________________________
_______________________________________
_______________________________________

---

## If Tests Fail

### Rollback Procedure

1. Revert `examples.ts` changes
2. Revert `schema.ts` defaults
3. Re-enable Base64 approach (if needed)
4. Check git history: `git log --oneline`
5. Rollback: `git revert <commit-hash>`

### Common Issues

**Issue: CDN URLs return 404**
- Solution: Verify Publit.io upload paths match code
- Check: Filenames case-sensitive? Correct folder structure?

**Issue: Images don't load locally**
- Solution: Check CORS settings on Publit.io
- Verify: Browser network tab shows request details

**Issue: TypeScript import errors**
- Solution: Restart TS server: Ctrl+Shift+P → "TypeScript: Restart TS Server"
- Check: All exports/imports match

**Issue: Build fails**
- Solution: Clear `.next` folder: `rm -rf .next`
- Rebuild: `npm run build`
