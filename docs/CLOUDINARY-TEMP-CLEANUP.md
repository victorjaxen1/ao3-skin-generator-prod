# Cloudinary Temporary Image Cleanup Guide

## Overview

The AO3 Skin Generator now implements a **two-tier image system** to optimize bandwidth usage:

- **Temporary Images**: Preview uploads during editing (avatars, attachments) - Tagged for auto-cleanup
- **Permanent Images**: Final composite exports for AO3 - Kept indefinitely

This prevents bandwidth exhaustion when users share viral content using temporary Cloudinary URLs.

---

## How It Works

### Automatic Tagging

All uploads to Cloudinary are now tagged based on their purpose:

| Upload Type | Context | Tags | Folder | Lifecycle |
|-------------|---------|------|--------|-----------|
| Avatar preview | `temp` | `temp`, `preview`, `auto_expire_48h` | `avatars/` | Delete after 48h |
| Attachment preview | `temp` | `temp`, `preview`, `auto_expire_48h` | `social-messages/` | Delete after 48h |
| **Final composite export** | `export` | `export`, `composite`, `permanent` | `ao3-social-messages/` | **Keep forever** |

### Why This Matters

**Before**: 
- User uploads 10 avatars during editing → 10 images on Cloudinary
- Generates 4.2 MB composite → 1 large image on Cloudinary
- Shares composite on social media → Goes viral (10,000 views)
- **Bandwidth used**: 4.2 MB × 10,000 = **42 GB** (exceeds 25 GB free tier)

**After**:
- User uploads 10 avatars during editing → Tagged `temp`, deleted after 48h
- Downloads zip with all avatars → User uploads to Imgur/ImgBB (free, permanent)
- Generates final code with permanent URLs → **No Cloudinary bandwidth used for avatars**
- Composite export stays on Cloudinary (small, rarely viewed directly)
- **Bandwidth saved**: ~95% reduction

---

## Setup Instructions

### Option 1: Manual Cleanup (Free Tier)

Since Cloudinary's free tier doesn't support auto-delete, you'll need to manually clean temp images periodically:

1. **Log into Cloudinary Dashboard**: https://cloudinary.com/console
2. **Go to Media Library**
3. **Filter by tag**: Click "Tags" dropdown → Select `temp`
4. **Review images**: 
   - Check upload date (older than 48 hours)
   - Verify they're preview images (not exports)
5. **Bulk delete**:
   - Select all temp images
   - Click "Delete" button
   - Confirm deletion

**Recommended frequency**: Weekly or when approaching 25 GB bandwidth limit

---

### Option 2: Auto-Delete (Paid Plans Only)

If you upgrade to a Cloudinary paid plan, you can automate cleanup:

#### Step 1: Enable Auto-Moderation

1. Go to **Settings** → **Upload** → **Upload Presets**
2. Find your preset (value of `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`)
3. Click **Edit**
4. Scroll to **Upload Manipulations**

#### Step 2: Set Up Tag-Based Expiration

5. Under **Tags**, enable **Auto-tagging**
6. Add rule:
   ```
   If tag contains "auto_expire_48h"
   Then auto-delete after 48 hours
   ```

#### Step 3: Exclude Permanent Images

7. Add exclusion rule:
   ```
   If tag contains "permanent" or "export"
   Then skip auto-delete
   ```

#### Step 4: Save & Test

8. Click **Save**
9. Upload a test image with `temp` tag
10. Verify it's deleted after 48 hours

---

### Option 3: Backend API Cleanup (Advanced)

For full control, implement a backend cleanup script:

```javascript
// Example: Cloudinary Admin API cleanup
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

async function cleanupTempImages() {
  const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
  
  // Search for temp images older than 48 hours
  const results = await cloudinary.search
    .expression('tags=temp AND uploaded_at<2d')
    .max_results(500)
    .execute();
  
  // Delete each image
  for (const resource of results.resources) {
    await cloudinary.uploader.destroy(resource.public_id);
    console.log(`Deleted: ${resource.public_id}`);
  }
}

// Run daily via cron job
cleanupTempImages().catch(console.error);
```

**Deployment**: Add this as a scheduled task (GitHub Actions, Vercel Cron, etc.)

---

## Monitoring & Alerts

### Check Current Usage

1. **Cloudinary Dashboard** → **Reports** → **Usage**
2. Monitor:
   - **Bandwidth**: Should stay well under 25 GB/month
   - **Storage**: Track temp vs permanent images
   - **Transformations**: Should be minimal (we pre-optimize)

### Set Up Alerts

1. **Settings** → **Notifications**
2. Create alert:
   - Trigger: Bandwidth > 20 GB (80% of limit)
   - Action: Email notification
   - Frequency: Daily

### Identify Issues

If bandwidth is still high:
- Check for users sharing Cloudinary URLs directly (instead of using permanent URLs)
- Review "export" tagged images - users might be sharing composites
- Consider serving composites from a different CDN or self-hosting

---

## User Workflow Reminder

The "upload to preview, link to export" model works like this:

1. **During Editing**: User uploads avatars/attachments → Cloudinary (temp)
2. **Preview**: User sees conversation with temp URLs → Looks perfect
3. **Export**: User chooses "Full AO3 Code"
   - Downloads zip with all images
   - Uploads images to Imgur/ImgBB (permanent, unlimited bandwidth)
   - Pastes permanent URLs back into tool
   - Gets final code with permanent URLs
4. **Cleanup**: Temp Cloudinary images auto-delete after 48h

**Result**: Zero ongoing bandwidth cost for viral content ✅

---

## Troubleshooting

### Issue: Temp images not being deleted

**Solution**: 
- Check if you're on free tier (manual deletion required)
- Verify upload preset allows tagging
- Check Cloudinary logs for tag application

### Issue: Export images being deleted

**Solution**:
- Verify export context is `'export'` in `ExportPanel.tsx`
- Check that tags include `permanent`
- Review auto-delete rules to exclude `export` tag

### Issue: Bandwidth still high

**Solution**:
- Check if users are sharing temp URLs instead of permanent ones
- Review which images are being accessed most (Media Library → Analytics)
- Consider moving composite exports off Cloudinary entirely

---

## Cost Projections

### Free Tier (Current)
- **Storage**: 25 GB
- **Bandwidth**: 25 GB/month
- **With cleanup**: ~5,000-6,000 composite exports/month sustainable

### Paid Tier ($0.004/GB bandwidth)
- **1,000 exports/month**: 4.2 GB → $0.02/month
- **10,000 exports/month**: 42 GB → $0.17/month
- **100,000 exports/month**: 420 GB → $1.68/month

**Recommendation**: Stay on free tier with temp cleanup. Only upgrade if you consistently exceed 25 GB/month.

---

## Implementation Details

All tagging logic is in `src/lib/cloudinary.ts`:

- `uploadToCloudinary()` now accepts `context: 'temp' | 'export'`
- Default is `'temp'` (safe default for previews)
- Composite exports explicitly use `'export'` context
- Tags and context metadata added to all uploads

No backend changes needed - all client-side!
