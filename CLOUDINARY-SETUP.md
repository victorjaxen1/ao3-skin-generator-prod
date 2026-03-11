# Cloudinary Setup Instructions

## What is the Cloudinary Feature?

The Cloudinary integration automatically uploads your generated social media message images to Cloudinary's image hosting service. This provides several benefits:

✅ **Perfect Layout**: The image that looks perfect in your downloads also looks perfect on AO3  
✅ **Simple Code**: Just a few lines of CSS and HTML instead of complex, lengthy code  
✅ **No Layout Issues**: Bypasses AO3's CSS limitations that cause spacing/positioning problems  
✅ **Reliable**: Images are hosted on Cloudinary's CDN, ensuring fast loading  

## Setup Steps

### 1. Create a Cloudinary Account

1. Go to [https://cloudinary.com/users/register/free](https://cloudinary.com/users/register/free)
2. Sign up for a **free account** (no credit card required)
3. Verify your email address

### 2. Get Your Cloud Name

1. Log into your Cloudinary dashboard at [https://cloudinary.com/console](https://cloudinary.com/console)
2. Find your **Cloud Name** in the top left of the dashboard
3. Copy this value - you'll need it in step 4

### 3. Create an Unsigned Upload Preset

**Important**: We use an unsigned preset so the app can upload directly from the browser without exposing API secrets.

1. In your Cloudinary dashboard, go to **Settings** (gear icon)
2. Click on the **Upload** tab
3. Scroll down to **Upload presets**
4. Click **Add upload preset**
5. Configure the preset:
   - **Preset name**: Choose a name like `ao3_social_messages`
   - **Signing Mode**: Select **Unsigned** (this is important!)
   - **Folder**: Enter `ao3-social-messages` (optional, helps organize your uploads)
   - **Access Mode**: Public (default)
   - Leave other settings as default
6. Click **Save**
7. Copy the **Preset name** you just created

### 4. Configure Environment Variables

1. In the root of this project, create a file named `.env.local`
2. Copy the contents from `.env.example`:
   ```bash
   cp .env.example .env.local
   ```
3. Open `.env.local` and fill in your values:
   ```env
   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name_here
   NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=ao3_social_messages
   ```
   Replace `your_cloud_name_here` with your actual cloud name from step 2

### 5. Restart the Development Server

If your dev server is running, restart it to load the new environment variables:

```bash
npm run dev
```

## How to Use

1. Create your social media message as usual
2. **Enable Cloudinary mode**: Check the "🚀 Use Cloudinary (Recommended - Perfect Layout)" checkbox at the bottom
3. Click **Generate Code** button (it will show a cloud icon ☁️)
4. The app will:
   - Generate a perfect PNG image
   - Automatically upload it to Cloudinary
   - Create simple CSS and HTML code
5. Copy the generated CSS and HTML codes
6. Paste into AO3 as usual (CSS in Work Skin, HTML in chapter)

## Simplified Code Example

Instead of 200+ lines of complex CSS, you get just this:

**CSS (Work Skin):**
```css
#workskin .social-message { 
  max-width: 650px; 
  margin: 20px auto; 
  display: block; 
  box-shadow: 0 2px 8px rgba(0,0,0,0.1); 
  border-radius: 8px; 
}
```

**HTML (Chapter Body):**
```html
<div class="social-message">
  <img src="https://res.cloudinary.com/YOUR_CLOUD/image/upload/v123456/ao3-social-messages/abc123.png" alt="Social media message">
</div>
```

## Security & Privacy Notes

- **Unsigned uploads**: Anyone with your preset name can upload to your Cloudinary account. However:
  - Free tier has 25GB storage and 25GB monthly bandwidth (plenty for personal use)
  - You can delete images from the Cloudinary dashboard anytime
  - You can disable the preset if needed
  - Only images are uploaded (no sensitive data)
  
- **Alternative (more secure)**: For production use, implement a backend API route that uses signed uploads. This requires server-side code.

## Troubleshooting

### "Failed to upload to Cloudinary"
- Check your cloud name and upload preset name are correct in `.env.local`
- Ensure the upload preset is set to **Unsigned** mode
- Check your Cloudinary account hasn't exceeded free tier limits

### Images not loading on AO3
- Verify the Cloudinary URL is accessible (open it in a browser)
- Check that your upload preset has **Access Mode** set to Public
- Ensure you copied the full URL including `https://`

### Environment variables not loading
- Make sure the file is named exactly `.env.local` (not `.env.txt` or similar)
- Restart your development server after creating/editing `.env.local`
- Check the file is in the project root directory (same level as `package.json`)

## Cost & Limits

Cloudinary's **free tier** includes:
- 25GB storage
- 25GB monthly bandwidth
- 25 monthly credits (more than enough for this use case)

For typical personal use (creating AO3 fics), you'll never hit these limits. Each image is only a few hundred KB.

## Questions?

If you run into issues, check:
1. Cloudinary dashboard for any error messages
2. Browser console for network errors
3. That your `.env.local` file has the correct variable names (must start with `NEXT_PUBLIC_`)
