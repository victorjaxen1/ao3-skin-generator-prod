# Image & Avatar System — Technical Reference

**Purpose:** Complete breakdown of how WorldKonstruct loads, normalizes, proxies, and renders avatar and gallery images from arbitrary web URLs inside a Google Apps Script sidebar.  
**Audience:** Developers building social media mockup generators or similar tools that need to embed user-supplied web images in a sandboxed iframe environment.

---

## 1. Data Model

Every entry type (Characters, Locations, Objects, Factions, Worldbuilding, Events) stores two image-related fields alongside all other content:

| Field | Type | Description |
|-------|------|-------------|
| `avatarUrl` | `string` | Single URL for the primary thumbnail/avatar image |
| `imageLinks` | `JSON string` → `Array<{ url: string, caption: string }>` | An ordered gallery of up to 5 images with optional captions |

Both fields are stored as spreadsheet columns (`AvatarUrl`, `ImageLinks`) and round-trip as strings. `imageLinks` is serialized/deserialized with `JSON.stringify` / `JSON.parse` on every read and write.

---

## 2. The Core Problem: GAS iframe CSP

WorldKonstruct runs inside a **Google Apps Script sidebar iframe**. That iframe enforces a strict Content Security Policy:

```
img-src 'self' https://*.gstatic.com https://*.googleusercontent.com data:
```

This means `<img src="https://static.wikia.nocookie.net/...">` is **silently blocked**. Any image from a third-party CDN (Wikia, Fandom, Amazon, Discord, ArtStation, etc.) will fail to load unless it is either:

1. **Converted to a Google-hosted URL** (works for Google Drive, which maps to `lh3.googleusercontent.com`)
2. **Proxied and returned as a `data:` URI** (CSP-safe because `data:` is always allowed)

All image logic in the app flows from solving this constraint.

---

## 3. Pipeline Overview

```
User pastes URL
      │
      ▼
normalizeImageUrl()          ← client-side, synchronous
  • Google Drive share → lh3.googleusercontent.com/d/ID
  • Dropbox ?dl=0 → ?raw=1
  • Imgur gallery → i.imgur.com/ID.jpg
  • pCloud → api.pcloud.com/getpubthumb?code=...
  • All others → pass-through
      │
      ▼
Browser attempts to load <img src="normalizedUrl">
      │
  Success? ─────────────────────────────────► Rendered ✓
      │
  Failure (onerror)
      │
      ▼
proxyAndRetryImage()         ← client-side, async
  Step 1: Strip %20 from hostname (paste artifact fix)
          If hostname changed → retry natively (no server call)
  Step 2: google.script.run.proxyImageAsBase64(url)
              │
              ▼
          Supabase Edge Function: image-proxy
            • HTTPS-only validation
            • SSRF protection (blocks private IPs)
            • Fetch upstream image
            • Validate Content-Type: image/*
            • Enforce 8 MB size cap
            • Return { dataUri: "data:image/jpeg;base64,..." }
              │
              ▼
          img.src = base64DataUri   ← CSP-immune, always renders
      │
  Still fails?
      │
      ▼
Initials fallback (colored div with entry's initials)
```

---

## 4. `normalizeImageUrl()` — URL Conversion Rules

**File:** [Utils.js.html](Utils.js.html) · Line 14  
**Exported as:** `window.normalizeImageUrl`

This function is called synchronously on every image URL before it is placed in an `<img src>`. It handles the most common image-sharing services where the "share URL" is a webpage, not a direct image file.

```
Google Drive /file/d/{ID}/...           → https://lh3.googleusercontent.com/d/{ID}
Google Drive /open?id={ID}              → https://lh3.googleusercontent.com/d/{ID}
Google Drive /uc?...id={ID}             → https://lh3.googleusercontent.com/d/{ID}
Google Drive /thumbnail?...id={ID}      → https://lh3.googleusercontent.com/d/{ID}

Dropbox  ?dl=0                          → ?raw=1

Imgur gallery imgur.com/{ID}            → https://i.imgur.com/{ID}.jpg
  (only when URL has no image extension already)

pCloud share ...?code={CODE}            → https://api.pcloud.com/getpubthumb
                                            ?code={CODE}&size=1024x1024&crop=0&type=auto

All other URLs                          → passed through unchanged
```

**Why `lh3.googleusercontent.com/d/{ID}` works:** Google Drive renders this URL directly from its CDN without requiring authentication for publicly-shared files. It is also on the GAS iframe's CSP allowlist.

---

## 5. `isImageUrl()` — Detecting Whether a URL Points to an Image

**File:** [Utils.js.html](Utils.js.html) · Line 102  

Used when a user pastes a link to decide whether to classify it as a gallery image (`imageLinks`) or a regular hyperlink (`links`). Five detection strategies are applied in order:

| Strategy | Description |
|----------|-------------|
| **0 — Base64** | `data:image/` prefix |
| **1 — Extension** | `.jpg .jpeg .png .gif .webp .svg .bmp` before `/?#` or mid-path (handles Wikia's `/file.jpg/revision/latest/...` pattern) |
| **2 — Known domains** | `i.imgur.com`, `i.ibb.co`, `i.postimg.cc`, `cdn.midjourney.com`, `cdn[a-d]?.artstation.com`, `i.pinimg.com`, `live.staticflickr.com`, Wikia CDN (`*.wikia.nocookie.net`), Wikimedia (`upload.wikimedia.org`) |
| **3 — Google Drive** | All four Drive URL patterns + normalized `lh3.googleusercontent.com/d/` form |
| **4 — pCloud** | `pcloud.link` / `pcloud.com` with `code=` param, or `api.pcloud.com/getpubthumb` |
| **5 — Google thumbnails** | `encrypted-tbn*.gstatic.com/images` |

---

## 6. `createAvatarElement()` — Avatar Rendering

**File:** [ViewManager.js.html](ViewManager.js.html) · Line 372  

Called for every entry in list views (small, 40×40 px) and in the detail panel (large, 120×120 px).

### URL Resolution Priority

```javascript
let avatarUrl = entry.avatarUrl;

// Fallback: no avatar but has gallery → use first gallery image as avatar
if (!avatarUrl && entry.imageLinks) {
  const parsed = JSON.parse(entry.imageLinks);   // imageLinks may be a string
  if (parsed.length > 0) avatarUrl = parsed[0].url;
}
```

### Element Construction

```javascript
const directUrl = normalizeImageUrl(avatarUrl);
const img = document.createElement('img');
img.src = directUrl;
img.loading = 'lazy';                   // defer off-screen images
img.onerror = function() {
  proxyAndRetryImage(this, (el) => {
    el.parentNode.replaceChild(createInitialsElement(entry, isLarge), el);
  });
};
```

For **large avatars with no gallery**, clicking the image opens a lightbox overlay (`showImagePreview()`).

---

## 7. `proxyAndRetryImage()` — Client-Side Error Recovery

**File:** [Utils.js.html](Utils.js.html) · Line 159  
**Exported as:** `window.proxyAndRetryImage`

Called from every `img.onerror` handler in the app. Two-stage recovery:

### Stage 1 — `%20` Hostname Cleanup (no server call)

URLs copy-pasted from line-wrapped sources (PDFs, emails) arrive with encoded spaces in the hostname, e.g.:

```
https://encrypted-tbn0.gstati%20c.com/images/...
```

The browser's `<img>` encodes this as `%20` in the `src` attribute but it produces an invalid hostname and always fails. The fix:

```javascript
const parsed = new URL(img.src);
const cleanHost = parsed.hostname.replace(/%20/gi, '').replace(/\s+/g, '');
if (cleanHost !== parsed.hostname) {
  parsed.hostname = cleanHost;
  img.src = parsed.href;   // retry − Google domains can now load natively
  return;
}
```

### Stage 2 — Server-Side Proxy

For genuinely blocked third-party CDNs, the function calls the GAS server function:

```javascript
google.script.run
  .withSuccessHandler((base64) => { img.src = base64; })
  .withFailureHandler(() => { onFailure(img); })
  .proxyImageAsBase64(img.src);
```

If the proxy also fails, `onFailure` is called — which in most cases swaps in the colored initials element.

---

## 8. `proxyImageAsBase64()` — Server-Side GAS Function

**File:** [Code.js](Code.js) · Line 1476  

This is a Google Apps Script server function (runs in the GAS V8 runtime, **not** in the browser).

```
Client (browser) ──google.script.run──► GAS Server
                                              │
                                              │ POST { url }
                                              ▼
                                    Supabase Edge Function
                                    supabase/functions/image-proxy
                                              │
                                              │ { dataUri: "data:image/jpeg;base64,..." }
                                              ▼
                                         GAS Server
                                              │
                                  return dataUri string
                                              │
                                              ▼
                                     Client: img.src = dataUri
```

### Server-Side Validations (before calling Edge Function)

| Check | Implementation |
|-------|---------------|
| HTTPS only | `!/^https:\/\//i.test(url)` |
| SSRF protection | `_isUrlSafeForProxy(url)` blocks private/metadata IPs |
| `%20` cleanup | `parsed.hostname.replace(/%20/gi, '')` — defense-in-depth |

---

## 9. Supabase Edge Function: `image-proxy`

**File:** [supabase/functions/image-proxy/index.ts](supabase/functions/image-proxy/index.ts)  
**Why it exists:** Google Workspace add-on review rejects a broad `"https://"` catch-all in `appsscript.json`'s `urlFetchWhitelist`. The Edge Function sits behind the already-whitelisted `supabase.co` domain, so GAS only needs three specific whitelist entries.

### Security Controls

| Control | Detail |
|---------|--------|
| **HTTPS-only** | Rejects any URL where `protocol !== 'https:'` |
| **SSRF protection** | Blocks `localhost`, `127.x`, `10.x`, `172.16–31.x`, `192.168.x`, `::1`, ULA IPv6, link-local `169.254.x`, `0.x.x.x`, GCP metadata server |
| **Image-only** | Rejects responses where `Content-Type` is not `image/*` |
| **Size cap** | Rejects responses larger than 8 MB |
| **User-Agent** | Sends `Mozilla/5.0 (compatible; WorldKonstruct/1.0 image-proxy)` to avoid bot-blocking |

### Response Shape

```json
{ "dataUri": "data:image/jpeg;base64,/9j/4AAQ..." }
```

---

## 10. `ImageCarousel` — Gallery Display in Detail View

**File:** [Feature_ImageGallery.js.html](Feature_ImageGallery.js.html)  

Renders a carousel inside the entry detail panel (narrow ~300 px sidebar). Each image passes through `normalizeImageUrl()` before being placed in `<img src>`, and uses the same inline `onerror="proxyAndRetryImage(...)"` pattern.

### Lightbox

`ImageCarousel.show(images, startIndex, entryId)` — static method that creates a full-screen overlay:

- Removes any existing lightbox first (prevents stacking)
- Instantiates a fresh `ImageCarousel` inside the overlay container
- Shows an **Edit** button (only if `entryId` provided) that opens the Quick Edit avatar panel

```javascript
// Prevent nested lightbox creation when carousel image is clicked inside a lightbox
if (!document.querySelector('.image-gallery-lightbox, .image-preview-overlay')) {
  showImagePreview(this.images[this.currentIndex].url);
}
```

---

## 11. Quick Edit Avatar Panel — User Input Flow

**File:** [Utils.js.html](Utils.js.html) · Line ~2220 (`renderAvatarField`)  

This is the panel users interact with to set or change an avatar URL.

### Input → Save Flow

```
User pastes URL in <input type="url">
         │
         ├─► INSTANT: normalizeImageUrl() → show preview immediately
         │
         └─► DEBOUNCED (1000 ms):
                  │
                  ├─ Validate URL format (new URL(urlString))
                  │
                  ├─ Check EXPIRING_URL_PATTERNS → show warning if match
                  │   • Discord CDN attachments
                  │   • DALL-E Azure blob (oaidalleapiprodscus.blob.core.windows.net)
                  │   • DeviantArt/WixMP with ?token=
                  │   • Discord media CDN
                  │
                  ├─ Pinterest pin auto-resolve:
                  │   pinterest.com/pin/* → server call resolvePinterestImage(url)
                  │   → replaces pin page URL with direct CDN image URL
                  │
                  └─► saveAvatar(finalUrl)
                         → SyncQueue (localStorage-durable)
                         → drained via server.runInBackground()
```

### Gallery Management

- Gallery thumbnails displayed in a grid (up to 5 images, `GALLERY_IMAGE_LIMIT = 5`)
- Each thumbnail uses `onerror="proxyAndRetryImage(this, ...)"` inline
- Click thumbnail → opens full lightbox via `ImageCarousel.show()`

---

## 12. Fallback: Initials Avatar

**File:** [ViewManager.js.html](ViewManager.js.html) — `createInitialsElement()`

When all image loading fails (or no URL is provided), a colored `<div>` is rendered with the entry's initials extracted from `entry.name` or `entry.title`:

- Two-word name → first letter of each word: `"John Doe"` → `"JD"`
- Single word → first two characters: `"Dragon"` → `"DR"`
- The div carries a CSS class based on `entry.type` (Characters, Locations, etc.) for type-specific color coding

---

## 13. Summary of Supported Image Sources

| Source | How It Works | Requires Proxy? |
|--------|-------------|----------------|
| **Google Drive** (public file) | Normalized to `lh3.googleusercontent.com/d/ID` — CSP allowlisted | No |
| **Dropbox** (shared link) | `?dl=0` → `?raw=1` for direct download | No |
| **Imgur** (gallery page) | Share URL converted to `i.imgur.com/ID.jpg` | No |
| **i.imgur.com** (direct) | Extension detected, used as-is | No |
| **imgBB** (`i.ibb.co`) | Extension/domain detected, used as-is | No |
| **PostImg** (`i.postimg.cc`) | Domain detected, used as-is | No |
| **pCloud** | `code=` extracted → `api.pcloud.com/getpubthumb` | No |
| **ArtStation CDN** | Domain detected, used as-is | No |
| **Pinterest pin** | Server resolves pin page → direct `pinimg.com` CDN URL | No (resolved first) |
| **i.pinimg.com** | Domain detected, used as-is | No |
| **Flickr static CDN** | Domain detected, used as-is | No |
| **Wikia / Fandom CDN** | `*.wikia.nocookie.net` — blocked by GAS CSP | **Yes** → Supabase proxy |
| **Wikimedia / Wikipedia** | `upload.wikimedia.org` — blocked by GAS CSP | **Yes** → Supabase proxy |
| **Amazon CDN** | `m.media-amazon.com`, etc. — blocked | **Yes** → Supabase proxy |
| **MidJourney CDN** | `cdn.midjourney.com` — blocked | **Yes** → Supabase proxy |
| **Google Image thumbnails** | `encrypted-tbn*.gstatic.com` — CSP allowlisted via `*.gstatic.com` | No |
| **Any other HTTPS URL** | Attempted directly; if blocked → proxy | Possibly |

---

## 14. Replicating This System

To implement equivalent behavior in your social media mockup generator:

### Step 1 — URL Normalization (client-side, synchronous)
Copy the `normalizeImageUrl()` function. Add new platform patterns as your supported sources grow. Run it on every URL before setting `img.src`.

### Step 2 — Error Recovery Chain (client-side, async)
Implement `proxyAndRetryImage()`. On `img.onerror`:
1. Strip `%20` from the hostname and retry.
2. If still failing, hit your server proxy.
3. If server also fails, show a placeholder (initials, broken image icon, etc.).

### Step 3 — Server Proxy
Deploy an endpoint (Supabase Edge Function, Cloudflare Worker, Express route, etc.) that:
- Accepts `POST { url }`
- Validates HTTPS-only
- Blocks SSRF target ranges
- Fetches the upstream image
- Validates `Content-Type: image/*`
- Returns `data:mime;base64,...`

`data:` URIs bypass all `img-src` CSP restrictions and work in any sandboxed iframe.

### Step 4 — Expiring URL Warnings
Detect platforms known to use expiring CDN tokens (Discord, DALL-E, DeviantArt with `?token=`) and warn users to re-host on a permanent service (Imgur, imgBB, Cloudinary, etc.).

### Step 5 — Pinterest Resolution (optional)
Pinterest pin pages (`pinterest.com/pin/*`) are HTML pages, not images. Resolve them server-side by fetching the page and extracting the `og:image` meta tag (or use Pinterest's oEmbed API) to get the direct `i.pinimg.com` CDN URL.
