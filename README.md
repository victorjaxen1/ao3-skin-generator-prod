# AO3 Work Skin Generator

Generate highlightable, accessible chat scenes and social media mockups for Archive of Our Own. Built with Next.js + TypeScript.

**[Try it live](https://ao3skingen.netlify.app/)** | **[Support on Ko-fi](https://ko-fi.com/ao3skingen)**

---

## Features

- **iOS iMessage** - Authentic chat bubbles with message grouping, read receipts, and image support
- **Android/WhatsApp** - WhatsApp-style chat with status indicators and checkmarks
- **Twitter/X** - Tweet threads with engagement metrics, verified badges, and quote tweets
- **Google Search** - Search results with autocomplete suggestions

### Why This Tool?

- **Highlightable text** - Unlike screenshots, readers can select and copy text
- **AO3-safe CSS** - All styles scoped under `#workskin`, no scripts
- **Accessible** - Semantic HTML for screen readers
- **Fast workflow** - Live preview, one-click export, local autosave

## Quick Start

`ash
npm install
npm run dev
# Visit http://localhost:3000
`

## How to Use on AO3

1. Create your scene in the generator
2. Click **Export** → Copy CSS
3. Create a Work Skin on AO3, paste CSS
4. Copy HTML → Paste into your chapter

## Environment Setup

Create a `.env.local` file for image uploads:

`env
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=your_preset
`

## Tech Stack

- **Next.js 16** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **DOMPurify** - XSS protection
- **Cloudinary** - Image hosting

## Project Structure

`
src/
  components/   # React UI (editors, preview, export)
  lib/          # Core logic (generator, schema, sanitization)
  pages/        # Next.js pages
  styles/       # Global CSS
public/         # Static assets
`

## Security

- Content sanitized with DOMPurify (only `br`, `b`, `strong` allowed)
- No inline event handlers in output
- CSP headers configured
- URL sanitization prevents XSS

## Contributing

1. Fork and branch (`feat/feature-name` style)
2. Keep CSS scoped under `#workskin`
3. No disallowed AO3 tags or scripts
4. Submit PR with screenshots

## License

MIT

---

Made with ❤️ for the fanfiction community
