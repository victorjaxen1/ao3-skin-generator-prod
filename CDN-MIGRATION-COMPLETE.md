# CDN Strategy — Current Status

## ⚠️ Status Update — March 11, 2026

The original Publit.io CDN strategy documented below was **reversed**. All platform icons
and example avatars now load from `/public/assets/` (local files bundled with the app).

### Why We Moved Back to Local Assets

1. **The files already existed locally.** Everything in `public/assets/` was present and committed. The Publit.io CDN was a layer on top of files that were already being served locally — adding latency and an external dependency for no benefit.

2. **The CDN paths were inconsistent.** Code referenced `media.publit.io/file/AO3-Skins-App/filename.png` but the files were actually at different paths on the CDN, causing silent 404s that only appeared as broken images in production (not caught locally).

3. **`sunset-scene.png` never existed on the CDN**, causing the `twitter-media-image` demo template to always show a broken image. Replaced with `placehold.co`.

4. **Dark-mode grey icon variants** (twitter-reply.png, twitter-retweet-grey.png, etc.) didn't exist at all — they were referenced but never uploaded. Resolved by falling back to the light versions until proper grey variants are created.

### Current Asset Strategy

| Asset type | Source | Notes |
|-----------|--------|-------|
| Platform icons (Twitter, WA, iMessage, etc.) | `/assets/*.png` | Local, always available, no CDN needed |
| Example avatars (Jamie Chen, Alex Rivers, etc.) | `/assets/*.png` | Local |
| Character bank avatars (30 presets) | `media.publit.io/file/AO3-Skins-App/avatars/` | Still CDN — these were actually uploaded there |
| User-pasted images | Direct URL, `img-src https:` | Never proxied; user supplies the host |
| ImgBB exports | `i.ibb.co` | Uploaded at export time only |

### Files Changed (March 11, 2026)

- `src/lib/platformAssets.ts` — all 20+ icon URLs changed from publit.io to `/assets/`
- `src/lib/examples.ts` — `AVATAR_CDN` constant changed from publit.io to `/assets`; `sunset-scene.png` replaced with placehold.co

---

## Original Documentation (2024 — Historical Reference)

> The content below describes the intended Publit.io CDN architecture as it was designed.
> It is preserved for reference but does not reflect the current implementation.

### Overview (Historical)
Successfully migrated from Base64 embedding to Publit.io CDN-hosted approach for both platform assets and character avatars.

## What Changed

### 1. **Platform Assets (platformAssets.ts)**
- ✅ Already configured with Publit.io CDN URLs
- ✅ PLATFORM_ASSETS object with Twitter, WhatsApp, iOS, Google, Discord, Tinder, Instagram assets
- ✅ `cdnUrl()` helper function for constructing CDN paths
- ✅ Local `/assets/` fallback strategy documented

### 2. **Character Bank (characterBank.ts)**
- ✅ 30 curated character avatars organized by category:
  - Female (6): Alex Rivers, Taylor Swift, Jamie Chen, Riley, Mom, Casey
  - Male (6): Jordan, Sam, Marcus, Tyler, Dad, Jake
  - Neutral (6): Quinn, Avery, Morgan, Skyler, River, Phoenix
  - Fantasy (6): Elara, Kira, Zephyr, Luna, Rex, Nova
  - Professional (6): Dr. Chen, Detective Ray, Agent K, Chef Mia, Prof. Harris, Officer Park
- ✅ Helper functions: `getAvatarById()`, `getAvatarsByCategory()`, `resolveAvatarUrl()`
- ✅ Supports custom URLs (users can paste any HTTP/HTTPS URL)

### 3. **Template Examples (examples.ts)**
- ✅ All avatar references updated to use `${AVATAR_CDN}/filename.png` template literals
- ✅ All platform headers/footers updated to use `PLATFORM_ASSETS.platform.asset` constants
- ✅ Imports CHARACTER_BANK from characterBank.ts
- ✅ 782 lines reviewed and updated

### 4. **Schema Defaults (schema.ts)**
- ✅ Updated iOS header: `https://media.publit.io/file/platform/ios/imessage-header.png`
- ✅ Updated iOS footer: `https://media.publit.io/file/platform/ios/imessage-footer.jpg`
- ✅ Updated Android header: `https://media.publit.io/file/platform/android/whatsapp-header.png`
- ✅ Updated Android footer: `https://media.publit.io/file/platform/android/whatsapp-footer.png`

## CDN Structure

### Publit.io Base URL
```
https://media.publit.io/file
```

### Platform Assets
```
/platform/twitter/icon.png
/platform/whatsapp/icon.png
/platform/ios/imessage-header.png
/platform/ios/imessage-footer.jpg
/platform/android/whatsapp-header.png
/platform/android/whatsapp-footer.png
/platform/google/icon.png
/platform/discord/icon.png
/platform/tinder/icon.png
/platform/instagram/icon.png
```

### Character Avatars
```
/avatars/alex-rivers.png
/avatars/taylor-swift.png
/avatars/jamie-chen.png
... (30 total)
```

## Benefits

### Performance
- ✅ No Base64 bloat in CSS (saves ~40KB per avatar)
- ✅ Browser caching for repeated loads
- ✅ Parallel downloads vs sequential Base64 decode
- ✅ Faster initial page load

### Maintainability
- ✅ Single source of truth in characterBank.ts
- ✅ Easy to add/update avatars without code changes
- ✅ Clean separation: platform assets vs character avatars
- ✅ TypeScript interfaces for type safety

### User Experience
- ✅ 30 ready-to-use character presets
- ✅ Custom URL support for personal avatars
- ✅ Categorized browsing (Female, Male, Neutral, Fantasy, Professional)
- ✅ Descriptive labels for each character

## Testing Checklist

Before deploying, verify:

1. **Platform Assets Load**
   - [ ] Twitter/X icon displays correctly
   - [ ] WhatsApp header/footer images load
   - [ ] iMessage header/footer images load
   - [ ] Google Messages assets work

2. **Character Avatars Load**
   - [ ] Test loading example templates
   - [ ] Verify CHARACTER_BANK avatars display
   - [ ] Test custom URL input (paste external URL)
   - [ ] Check fallback behavior if CDN fails

3. **Examples Gallery**
   - [ ] All template examples render correctly
   - [ ] Avatar images load from CDN
   - [ ] Platform headers/footers display properly

4. **Cross-Browser**
   - [ ] Chrome/Edge
   - [ ] Firefox
   - [ ] Safari (Mac/iOS)

## Rollback Plan

If CDN issues occur:

1. All `/public/assets/` files still exist as fallback
2. Update `PUBLIT_CDN` constant to point to `/assets/` instead
3. Re-run build and deploy

## Next Steps

1. **Upload Assets to Publit.io**
   - Upload all 30 character avatars to `/avatars/` folder
   - Upload platform assets to `/platform/` subfolders
   - Verify CDN paths match code

2. **Update ENV Variables** (if needed)
   - Consider adding `NEXT_PUBLIC_CDN_URL` env var
   - Allows easy switching between CDN providers

3. **Monitor Performance**
   - Check Publit.io analytics for bandwidth usage
   - Monitor for any 404 errors
   - Track page load times vs previous Base64 approach

## Files Modified

- ✅ `src/lib/platformAssets.ts` - Removed duplicate CHARACTER_BANK, kept CDN infrastructure
- ✅ `src/lib/characterBank.ts` - Already complete with 30 avatars
- ✅ `src/lib/examples.ts` - Updated all asset references to CDN
- ✅ `src/lib/schema.ts` - Updated default iOS/Android asset URLs

## Migration Scripts Used

- `update-examples-final.js` - Batch updated asset paths
- `run-update.bat` - Workaround for terminal issues

---

**Migration Date**: 2024  
**Status**: ✅ COMPLETE  
**Approach**: Publit.io CDN + Character Bank + Custom URL Support
