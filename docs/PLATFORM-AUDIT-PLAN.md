# Platform Workflow Audit & Rework — Implementation Plan

**Audience:** the developer implementing this. Assume no prior knowledge of the codebase.
**Goal:** walk each of the four platform workflows (iMessage, WhatsApp, X/Twitter, Google) end to end and make each one work correctly, read clearly, and stop asking the user for decisions that don't matter.
**Scope change from the product owner:** Cloudinary is being removed. Image input becomes "paste any image address" (Google Images, Imgur, DeviantArt, etc.).

Every claim below was verified against the code at commit `b49396a`. File references are `path:line`.

---

## 0. Before you touch anything

### 0.1 Environment setup — do this first or you will chase a ghost

Local image upload **fails silently** today. `.env.local` currently contains Cloudinary keys and **no** `NEXT_PUBLIC_IMGBB_API_KEY`. Production has one (it is inlined into the public JS bundle at build time — it is a publishable key, not a secret).

```bash
# .env.local — add this line. Get the value from the Netlify dashboard:
# Site settings → Environment variables → NEXT_PUBLIC_IMGBB_API_KEY
NEXT_PUBLIC_IMGBB_API_KEY=<value from Netlify>
```

Without it, `uploadToImgBB()` throws `ImageUploadError('Image upload is not configured…')` — and the two call sites throw that message away (see §1.1). You will see a spinner, then nothing, and conclude the upload code is broken. It isn't.

### 0.2 Running and testing

```bash
npm install
npm run dev                       # http://localhost:3000

# The audit test suite (already exists, 46 tests):
npx playwright test                                    # against production
UX_BASE_URL=http://localhost:3000 npx playwright test  # against your local server
npx playwright show-report                             # screenshots + traces
```

Tests live in [`tests/`](../tests/). Read [`tests/README.md`](../tests/README.md) first — it explains what these tests can and cannot tell you. Short version: they catch mechanical breakage, not whether a human understands the UI.

**Known trap:** `persistProject` is debounced 500ms ([`src/pages/index.tsx`](../src/pages/index.tsx)). Any test that reloads the page must `await page.waitForTimeout(1200)` first, or the project is lost and you land on the picker instead of the workspace. Two existing tests already do this — copy the pattern.

### 0.3 The four templates

`template` is one of exactly four values: `'ios' | 'android' | 'twitter' | 'google'` ([`src/lib/schema.ts:216`](../src/lib/schema.ts)).

| UI name | `template` value | Notes |
|---|---|---|
| iMessage | `ios` | |
| WhatsApp | `android` | The value is `android`, the product is WhatsApp. Do not rename it — it is persisted in users' `localStorage`. |
| X / Twitter | `twitter` | |
| Google | `google` | Search results page, not a chat |

---

## 1. Cross-cutting defects — fix these before the per-platform work

These affect all four workflows. Doing them first means the per-platform audit isn't drowned in repeat findings.

### 1.1 Upload failures are silent — HIGH

`ImageUploadError` carries a `userMessage` field written specifically to be shown to the user ([`src/lib/imgbb.ts:9-18`](../src/lib/imgbb.ts)). Two of the three call sites discard it:

```ts
// src/components/ComposeBar.tsx:41-43
} catch {
  // Upload failed – user can paste URL manually
}

// src/components/MessageTimeline.tsx:91-93
} catch {
  // Upload failed – user can paste a URL manually
}
```

Why this is worse than it looks: `uploadWithRetry` retries twice with 5s then 10s backoff, and each attempt has a 30s timeout ([`src/lib/imgbb.ts:20-21, 59`](../src/lib/imgbb.ts)). A dead network means **up to ~105 seconds of spinner followed by nothing at all**.

[`src/components/ExportPanel.tsx:503-506`](../src/components/ExportPanel.tsx) already does it correctly — copy that pattern:

```ts
if (err instanceof ImageUploadError) {
  showError(`Upload failed: ${err.userMessage}`);
}
```

**Fix:** `ComposeBar` and `MessageTimeline` have no toast system. Either lift `useToast` from [`src/components/Toast.tsx`](../src/components/Toast.tsx) into `index.tsx` and pass a callback down, or render a local inline error under the image field. Inline is simpler and arguably better here — the error belongs next to the field that caused it.

**Acceptance:** kill your network, attempt an upload, and see a human-readable error within ~35s. Add a test that stubs `uploadToImgBB` to reject and asserts the message appears.

### 1.2 Google's send button is a dead click — MEDIUM

The send button is enabled for `google` even when the input is empty:

```ts
// src/components/ComposeBar.tsx — send button
disabled={!content.trim() && template !== 'google'}
```

But the handler bails immediately:

```ts
// src/components/ComposeBar.tsx:71-73
if (template === 'google') {
  if (!trimmedContent) return;
```

So on the Google workflow the button looks active, and clicking it does nothing with no explanation.

**Fix:** make the disabled condition `!content.trim()` for all templates. Verify no other template depended on the exception (none does — `ios`/`android` also require content or an image, `twitter` requires content).

### 1.3 Non-CORS images vanish from exports — MEDIUM (not a crash)

[`src/components/ExportPanel.tsx:262-267`](../src/components/ExportPanel.tsx) sets `useCORS: true, allowTaint: true`.

**This was tested, not reasoned about.** See [`tests/cors-export.spec.ts`](../tests/cors-export.spec.ts), run against production with an image from `www.w3.org` (serves 200, sends no `Access-Control-Allow-Origin`):

```
Save Image result: DOWNLOAD          ← export SUCCEEDED
canvas tainted (SecurityError): false
console: blocked by CORS policy: No 'Access-Control-Allow-Origin' header
```

And the underlying mechanism, measured directly in the browser:

```
crossOrigin='anonymous'  (what useCORS:true does) → image FAILED to load, canvas CLEAN
no crossOrigin           (useCORS:false)          → loaded, canvas TAINTED (SecurityError)
```

So: because `useCORS: true` is set, html2canvas assigns `img.crossOrigin = 'anonymous'` to every cross-origin image ([`node_modules/html2canvas/dist/html2canvas.js:5735, 5762`](../node_modules/html2canvas/dist/html2canvas.js)). A host without CORS headers therefore **fails to load** rather than tainting. `allowTaint: true` is effectively **inert** in this configuration — it only matters when `useCORS` is false.

**The actual failure mode is a preview/export mismatch, not a crash:**

| | Preview | Export |
|---|---|---|
| App's own `<img>` (no `crossOrigin`) | ✅ image displays | — |
| html2canvas (`crossOrigin='anonymous'`) | — | ❌ image silently missing |

The user pastes a URL, sees the image perfectly, exports, and gets a **hole where the image was, with no warning.** Bad, but recoverable — and nothing like the hard failure I first described.

**Action:** remove `allowTaint: true` for clarity (it does nothing here), and treat the missing-image problem as the real target — §4.3.

### 1.4 Dead settings — the user is being asked questions that do nothing

These are rendered as controls in [`src/components/SettingsSheet.tsx`](../src/components/SettingsSheet.tsx) but **never read by the renderer** ([`src/lib/generator.ts`](../src/lib/generator.ts)) or by any other code:

| Setting | Control label | Where shown | Verdict |
|---|---|---|---|
| `iosShowDelivered` | "Delivered indicator" | iMessage → Display | **Dead.** Remove control, or implement in generator. |
| `iosGroupName` | "Group name" | iMessage → Group chat | **Dead.** Group name never renders. |
| `androidShowReadReceipt` | "Read receipt" | WhatsApp → Display | **Dead.** |
| `androidWhatsAppMode` | "WhatsApp style" | WhatsApp → Appearance | **Dead.** Also nonsensical — the platform *is* WhatsApp. |

(`iosAutoAlternate` and `androidAutoAlternate` appear in the same "unused by generator" search but are **not** dead — they drive compose behaviour in [`src/components/ComposeBar.tsx:108-110`](../src/components/ComposeBar.tsx). Leave them.)

**Decide per setting: implement it or delete it.** Do not leave a toggle that does nothing. My recommendation is in §6.

### 1.5 Rendered features with no UI to reach them

The generator renders these, but `SettingsSheet` exposes no control, so users can never turn them on:

- `twitterQuoteAvatar` — quote-tweet author avatar
- `twitterQuoteImage` — image inside the quoted tweet
- `twitterQuoteVerified` — verified badge on quoted author
- `googleSuggestions` — autocomplete dropdown under the search box

Work already paid for and invisible. Either add the controls (§3.3, §3.4) or delete the generator branches.

### 1.6 Schema carries six platforms that do not exist

[`src/lib/schema.ts:84-215`](../src/lib/schema.ts) defines settings for Instagram, Discord, Tinder/dating, email, notes, and sticky notes. `template` cannot be any of those. That is roughly 60 dead fields inflating every persisted project, every `localStorage` write, and the mental cost of reading `SkinSettings`.

**Fix (low risk, do it late):** delete the dead field groups. `loadStoredProject` merges stored settings over defaults, so removing fields is backward-compatible — old stored projects just carry ignored extras. Do this *after* the per-platform work so it doesn't muddy those diffs.

---

## 2. How to audit each workflow

For each platform, do the same six passes. Record findings in the per-platform table in §3 as you go.

1. **Cold start.** Clear `localStorage`, load `/`, pick the platform. Note anything confusing before you touch a control.
2. **Every control.** Click every button, toggle, and field in the header, compose bar, detail tray, settings sheet, and per-message menu. Confirm each one visibly changes the preview or does something explicable.
3. **Every field's copy.** Does the label say what it does? Would a fanfic writer with no technical background understand it? Placeholders should show a real example, not restate the label.
4. **The image path.** Paste a URL. Upload a file. Try a bad URL. Try a hotlink-blocked URL. Then **export** — this is where tainted-canvas bugs surface (§1.3).
5. **Both exports.** "Save Image" and "Copy for AO3" must both succeed and produce correct output.
6. **Mobile at 412×839.** The split preview landed recently ([`src/pages/index.tsx`](../src/pages/index.tsx)) — confirm each platform's compose fields still fit alongside it.

Use this table per platform. Copy it into your PR description.

| Control | Location | Works? | Preview updates? | Label clear? | Vital? | Action |
|---|---|---|---|---|---|---|

The **Vital?** column is the important one. Ask: *if this had a sensible fixed default, would anyone notice?* If no — delete the control and hard-code the default. Every removed decision is a win.

---

## 3. Per-platform findings and work

### 3.1 iMessage (`template: 'ios'`)

**Settings exposed** ([`src/components/SettingsSheet.tsx:186-322`](../src/components/SettingsSheet.tsx)): Message type (iMessage/SMS), Dark mode, Auto-alternate senders, Read receipt, Delivered indicator, Status bar, Status bar time, Input bar, Contact name, Avatar, Header image, Footer image, Group chat mode, Group name, Group participants.

**That is 15 decisions.** For "make a fake text screenshot" this is far too many up front.

Known issues:

- `iosShowDelivered` and `iosGroupName` are dead (§1.4).
- **Status bar time** is a nested text field revealed by the "Status bar" toggle, defaulting to `9:41`. Apple's own marketing time. Almost nobody needs to change it — demote or remove.
- **Contact name is double-bound.** The workspace header edits `iosContactName` ([`src/pages/index.tsx`](../src/pages/index.tsx), `contactNameKey`), and Settings has a second "Contact name" field for the same value. Two inputs for one value in two places is confusing. Keep the header (it is in context) and remove the settings duplicate, or clearly mark one as the source.
- **Header/footer background images** are an advanced feature sitting at the same visual level as "Contact name". Move under an "Advanced" disclosure.

Work items:

1. Remove or implement `iosShowDelivered`, `iosGroupName`.
2. Collapse Status bar / Input bar / Header image / Footer image into an **Advanced** section, collapsed by default.
3. Resolve the contact-name duplication.
4. Verify group chat end to end: enable group mode, add 3 participants with colours, send as each, export. Confirm participant colours render.

### 3.2 WhatsApp (`template: 'android'`)

**Settings exposed** ([`src/components/SettingsSheet.tsx:323-460`](../src/components/SettingsSheet.tsx)): WhatsApp style, Dark mode, Auto-alternate, Sent bubble colour, Received bubble colour, Online status, Status text, Checkmarks, Read receipt, Contact name, Avatar, Header image, Footer image, Group chat mode, Group name, Group participants.

Known issues:

- `androidWhatsAppMode` ("WhatsApp style") is dead **and** incoherent — the user picked WhatsApp. Delete it.
- `androidShowReadReceipt` is dead. Note "Checkmarks" (`androidCheckmarks`) is *live* and does the visually similar job. Two controls, one of which is a lie.
- **Sent/Received bubble colour pickers** are the only platform exposing raw colour pickers. WhatsApp's colours are iconic; letting users pick arbitrary ones mostly produces wrong-looking output. Recommend removing both and hard-coding the authentic values already used in `handleSelectPlatform` ([`src/pages/index.tsx`](../src/pages/index.tsx): `#00A884` / `#1F2C34`). If kept, move to Advanced.
- Same contact-name double-binding as iMessage.

Work items:

1. Delete "WhatsApp style" and "Read receipt" controls (dead).
2. Decide on the colour pickers — recommend removing.
3. Collapse Header/Footer images into Advanced.
4. Verify group chat end to end as with iMessage.

### 3.3 X / Twitter (`template: 'twitter'`)

**Settings exposed** ([`src/components/SettingsSheet.tsx:461-546`](../src/components/SettingsSheet.tsx)): Display name, Handle, Verified badge, Avatar, Dark mode, Thread mode, Show metrics, Timestamp, Quote tweet enable + name/handle/text.

This workflow has the **worst structural problem of the four.**

**Identity is stamped onto each message at send time, not read at render time.** [`src/components/ComposeBar.tsx:88-97`](../src/components/ComposeBar.tsx):

```ts
sender: activeChar?.name || settings.twitterDisplayName || 'User',
twitterHandle: activeChar?.handle || settings.twitterHandle,
verified: activeChar?.verified ?? settings.twitterVerified,
avatarUrl: activeChar?.avatarUrl || settings.twitterAvatarUrl,
```

So: write five tweets, then change your display name in Settings → **the five existing tweets keep the old name.** The settings field appears to be a global identity but behaves as a default for future messages only. Users will read this as a bug, and they are right.

**Fix options — pick one and be consistent:**

- **(a) Render-time lookup (recommended).** Stop copying identity onto messages. Have the generator read `settings.twitter*` unless the message sets `useCustomIdentity`. Changing your name updates every tweet. Requires a migration path for existing stored projects (fall back to the message's stamped value when settings are empty).
- **(b) Keep stamping, but propagate.** When a twitter identity setting changes, update all existing messages that still match the old value. Simpler, but surprising in its own way.

Other issues:

- **Per-tweet metrics are always initialised to 0** ([`src/components/ComposeBar.tsx:98-102`](../src/components/ComposeBar.tsx)) and editable only per-message in the timeline (Likes, Retweets — but **not** Views or Bookmarks, which exist in the schema). "Show metrics" is on by default, so a new tweet shows `0 0 0`, which looks broken. Either default to plausible numbers or hide zero metrics.
- **Quote tweet is half-built** (§1.5): avatar, image, and verified render but have no controls.
- **The multi-character tweet selector is only reachable by accident.** `twitterCharacterPresets` feeds a character dropdown in the compose bar, shown only when `length > 1` ([`src/pages/index.tsx:440`](../src/pages/index.tsx)). Verified: the **only** writer is [`src/lib/examples.ts`](../src/lib/examples.ts) (lines 64, 124, 182) — three of the starter templates. No UI creates or edits presets, and the Character Library ([`src/components/CharacterLibrary.tsx`](../src/components/CharacterLibrary.tsx)) writes to a *different* store (`ao3skin_universal_characters` in `localStorage`). So: load a Twitter template → you get a character switcher; start a blank Twitter post → the feature does not exist. Either wire the Character Library into `twitterCharacterPresets` or drop the presets and use universal characters everywhere.

Work items:

1. Decide (a) or (b) for identity. This is the single highest-value fix in the whole audit.
2. Fix zero-metrics display.
3. Add quote-tweet avatar/image/verified controls, or delete those generator branches.
4. Establish whether the twitter character preset path is reachable; wire or remove.

### 3.4 Google (`template: 'google'`)

**Settings exposed** ([`src/components/SettingsSheet.tsx:547-600`](../src/components/SettingsSheet.tsx)): Search query, Engine variant, Show stats bar, Results count, Results time, Did you mean, Correction.

Known issues:

- **The search query is double-bound to the workspace header contact name.** In [`src/pages/index.tsx`](../src/pages/index.tsx), `contactNameKey` maps `google → 'googleQuery'`. So the header field labelled like a contact name is actually the search query, and Settings has a second field for the same value. Confusing in both directions. Fix the header label per-template.
- **"Engine variant"** offers `google`, `google-old`, `naver`. All three are genuinely implemented — verified at [`src/lib/generator.ts:545-555`](../src/lib/generator.ts) (Naver gets its own green wordmark and font). Keep them. The only question is presentation: Naver is a Korean search engine and sits with equal weight to the default, so consider ordering or grouping rather than removal.
- **Results count / results time** are free-text fields ("About 24,040,000,000 results", "0.56 seconds"). These are pure flavour. Generate plausible defaults instead of asking.
- `googleSuggestions` renders but has no control (§1.5).
- Google's compose is genuinely different from the other three (title / URL / description per result), yet reuses the chat compose bar with a send arrow. The mental model is "add a search result", not "send a message". Consider relabelling for this template.
- **Google is the template hit by the dead send button** (§1.2).

Work items:

1. Fix the header field label/binding for Google.
2. Default the stats strings; move the fields to Advanced.
3. Reconsider how engine variants are presented (they all work — see above).
4. Add a suggestions control or remove the generator branch.
5. Relabel compose affordances for the "add a result" model.

---

## 4. Image system rework

**Product decision:** remove Cloudinary; support pasting any image address.

### 4.1 Cloudinary removal — smaller than it sounds

There is **no Cloudinary code in `src/`.** Verified: `grep -ril cloudinary src/` returns nothing. It survives only as:

- `.env.local` → `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`
- `.env.example`, `.env.local.example`, `.env.local.template` (check each)
- Docs: `CLOUDINARY-IMPLEMENTATION.md`, `CLOUDINARY-SETUP.md`, `CDN-MIGRATION-COMPLETE.md`

**Action:** delete those env vars and docs. Also remove the matching variables in the Netlify dashboard. No code changes.

### 4.2 You already have most of the "any URL" machinery

[`src/lib/urlNormalize.ts`](../src/lib/urlNormalize.ts) is well-built and **under-used**. It exports four functions; here is where each is actually used:

| Function | What it does | Used in |
|---|---|---|
| `normalizeImageUrl` | Converts share-page URLs to direct image URLs (Google Drive, Dropbox, Imgur, pCloud…) | `ComposeBar`, `AvatarSelector` |
| `getExpiringUrlWarning` | Warns about Discord/DALL-E/wixmp URLs that expire | `AvatarSelector` **only** |
| `wasNormalized` | Tells the user their URL was rewritten | `AvatarSelector` **only** |
| `isImageUrl` | Validates a URL looks like an image | **nowhere — completely unused** |

So the good UX exists in the avatar picker and nowhere else. `ComposeBar` and `MessageTimeline` get normalization but no validation, no expiry warning, no "we rewrote your URL" feedback.

**Action:** extract the `AvatarSelector` URL-input experience into a shared component (suggested: `src/components/ImageUrlInput.tsx`) and use it in all three places — avatar, compose detail tray, per-message edit. One consistent image-input experience.

### 4.3 The CORS problem — read this carefully

Pasting arbitrary image URLs works fine *in the preview* (the CSP already allows it: `img-src 'self' data: blob: https:` in [`netlify.toml`](../netlify.toml)). **Export is the problem.**

Measured CORS headers on common hosts (`curl -I`, run 2026-08-05):

| Host | Status | `Access-Control-Allow-Origin` | Export-safe? |
|---|---|---|---|
| `i.imgur.com` | 200 | `*` | ✅ |
| `upload.wikimedia.org` | 200 | `*` | ✅ |
| `images.unsplash.com` | 200 | `*` | ✅ |
| `lh3.googleusercontent.com` | 400\* | `*` | ✅ |
| `media.giphy.com` | 200 | `*` | ✅ |
| `*.media.tumblr.com` | 200 | `*` | ✅ |
| `static.wikia.nocookie.net` | 404\* | `*` | ✅ |
| `i.pinimg.com` | **403** | none | ❌ hotlink-blocked |
| `cdna.artstation.com` | **403** | none | ❌ hotlink-blocked |

\* non-200 because the test URL was synthetic; the CORS header is what matters.

So "any image address" is **mostly** true for CORS, but Pinterest and ArtStation actively block hotlinking, and DeviantArt's `wixmp` URLs carry expiring tokens (already detected by `getExpiringUrlWarning`).

**The fix already exists — reuse WorldKonstruct's.**

[`Example of Image Handling code/`](../Example%20of%20Image%20Handling%20code/) contains a working, production-proven solution: an image proxy that returns a **base64 `data:` URI** rather than a proxied stream. `urlNormalize.ts` in this repo was already adapted from that same reference.

Why a data URI is the right answer here: a `data:` URI is same-origin by definition. It cannot taint a canvas, it needs no CORS headers, and it defeats hotlink blocking (the fetch happens server-side). One mechanism solves loading, CORS, and hotlinking at once.

[`Example of Image Handling code/image-proxy/index.ts`](../Example%20of%20Image%20Handling%20code/image-proxy/index.ts) is a Supabase Edge Function; port it to a Netlify function. It already implements the controls you need — copy them, don't reinvent:

- HTTPS-only upstream
- SSRF protection (blocks `localhost`, `127.*`, `10.*`, `172.16-31.*`, `192.168.*`, `::1`, ULA IPv6, link-local `169.254.*`, and the GCP metadata host)
- `Content-Type: image/*` enforcement
- 8 MB size cap
- A browser-like `User-Agent` to avoid bot-blocking

#### ⚠️ One critical adaptation — do not port the trigger as-is

WorldKonstruct invoked the proxy from **`img.onerror`**. That was right for them: their constraint was a strict GAS iframe CSP (`img-src 'self' *.gstatic.com *.googleusercontent.com data:`), so blocked images *failed visibly* and `onerror` fired.

**This app's CSP is permissive** (`img-src 'self' data: blob: https:` in [`netlify.toml`](../netlify.toml)). Remote images load fine. `onerror` **never fires** — and yet the export still drops them (§1.3).

Porting the reactive pattern verbatim would therefore fix nothing. Different constraint, different trigger:

| | WorldKonstruct | This app |
|---|---|---|
| Constraint | CSP blocks display | Canvas needs CORS for export |
| Symptom | Image visibly fails | Image looks fine, vanishes on export |
| Trigger that works | `img.onerror` | **Export time** — proxy before rasterising |

**Where to hook it:** in `renderChunk()` ([`src/components/ExportPanel.tsx:78`](../src/components/ExportPanel.tsx)), after the off-screen clone is built and before `html2canvas` runs, walk the clone's `<img>` elements and replace any cross-origin `src` with a proxied data URI. Keep `onerror`-based recovery too if you like — it costs little and catches genuinely broken links — but it is not the fix.

#### Do NOT store data URIs in the project

Tempting shortcut: convert at paste time and store the data URI. **This will break saving.** [`src/lib/storage.ts:7`](../src/lib/storage.ts) caps stored projects at `MAX_STORAGE_SIZE = 500000` (500 KB), and `persistProject` silently refuses to save anything larger — a `console.warn` the user never sees ([`src/lib/storage.ts:130-133`](../src/lib/storage.ts)).

Base64 inflates by ~33%, so a single 400 KB photo becomes ~533 KB and blows the cap on its own. Users would lose their whole project with no message.

**Keep the remote URL in the project. Convert to a data URI only in the export pipeline, transiently.**

(Separately: that silent 500 KB failure is worth fixing regardless — a project with several image URLs and a long conversation could hit it. Surface an error when a save is refused.)

#### Optional extras from the reference worth taking

- **Pinterest resolution** (§5 of the reference): `pinterest.com/pin/*` pages aren't images. Resolve server-side via the `og:image` meta tag to get the direct `i.pinimg.com` URL. This plus the proxy makes Pinterest work despite its 403 hotlink block.
- **`%20` hostname cleanup**: already ported into [`src/lib/urlNormalize.ts`](../src/lib/urlNormalize.ts) as `cleanHostEncoding`.
- **Initials fallback**: WorldKonstruct renders coloured initials when everything fails. [`src/components/AvatarSelector.tsx`](../src/components/AvatarSelector.tsx) could use the same idea.

**Add a test regardless.** [`tests/cors-export.spec.ts`](../tests/cors-export.spec.ts) already covers the "export doesn't crash" half. Extend it to assert the image is actually *present* in the exported PNG once the proxy lands — that's the part that's broken today.

### 4.4 Keep imgbb — it is not replaceable by pasted URLs

Do not remove `uploadToImgBB` while removing Cloudinary. "Copy for AO3" **must** upload the rendered PNG somewhere to produce an `<img>` tag for the AO3 editor ([`src/components/ExportPanel.tsx:368`](../src/components/ExportPanel.tsx)). A user-pasted URL cannot serve that purpose — the image doesn't exist until they render it.

Two distinct paths, don't conflate them:

- **Content images** (a photo inside a message) → user pastes a URL. File upload optional.
- **Export upload** (the finished skin) → imgbb, always.

---

## 5. Suggested order of work

Each phase should be its own PR, green tests before merge.

| Phase | Work | Why this order |
|---|---|---|
| **1** | §1.1 upload errors, §1.2 dead Google button, drop the inert `allowTaint` | Small, safe, fixes user-visible breakage immediately |
| **2** | §4.1 Cloudinary removal, §4.2 shared `ImageUrlInput` | Clears the decks for image work; no behaviour risk |
| **3** | §1.4 dead settings, §6 options triage | Biggest intuitiveness win per line changed |
| **4** | §3.3 Twitter identity model | Highest-value single fix, but needs a migration path — do it with full attention |
| **5** | §3.1–3.4 remaining per-platform items | Now the noise is gone and findings are real |
| **6** | §4.3 image proxy (port from the WorldKonstruct reference) | Largest new surface; needs its own review |
| **7** | §1.6 schema cleanup | Pure housekeeping, do it last |

---

## 6. Options triage — recommended verdicts

The brief was: *make sure options are vital and not another decision the user has to make when they don't have to.* Here is my recommendation per control. Push back where you disagree — but decide deliberately, don't leave things because they exist.

**Delete outright (dead — they do nothing today):**
`iosShowDelivered`, `iosGroupName`, `androidShowReadReceipt`, `androidWhatsAppMode`

**Delete and hard-code a good default:**
`senderColor` / `receiverColor` on WhatsApp (authentic colours already exist in `handleSelectPlatform`) · `googleResultsCount` / `googleResultsTime` (generate plausible values) · `iosStatusBarTime` (keep `9:41`)

**Move to a collapsed "Advanced" section:**
`iosHeaderImageUrl`, `iosFooterImageUrl`, `androidHeaderImageUrl`, `androidFooterImageUrl`, `iosShowStatusBar`, `iosShowInputBar`, `maxWidthPx`

**Keep prominent — these are the reasons people use the tool:**
Contact name · Avatar · Dark mode · Group chat mode · Twitter display name / handle / verified · Google search query · Watermark (Pro)

**Resolve duplication (one value, two inputs):**
Contact name (header + settings) on iMessage and WhatsApp · Search query (header + settings) on Google

**Build or delete (rendered but unreachable):**
`twitterQuoteAvatar`, `twitterQuoteImage`, `twitterQuoteVerified`, `googleSuggestions`

---

## 7. Definition of done

- [ ] All four workflows completed cold-start → export, on desktop **and** at 412×839.
- [ ] Every remaining control visibly changes the preview. No control does nothing.
- [ ] Every label is comprehensible to a non-technical fanfic writer; placeholders show real examples.
- [ ] Image URL paste, file upload, bad URL, and hotlink-blocked URL each produce a clear outcome — never a silent failure.
- [ ] **Both exports succeed with a pasted cross-origin image present, and the image is actually visible in the output.** Export already survives (verified); the image being *present* is the part that needs fixing and guarding.
- [ ] `npx playwright test` green, with new tests covering upload error display and cross-origin export.
- [ ] No Cloudinary references remain in code, env files, docs, or the Netlify dashboard.
- [ ] Per-platform audit tables (§2) filled in and attached to the PR.

---

## Appendix: file map

| File | Role |
|---|---|
| [`src/pages/index.tsx`](../src/pages/index.tsx) | Page shell, state, persistence, undo/redo, layout, mobile preview |
| [`src/components/PlatformPicker.tsx`](../src/components/PlatformPicker.tsx) | First screen: platform cards + template chips |
| [`src/components/WorkspaceHeader.tsx`](../src/components/WorkspaceHeader.tsx) | Back, contact name, characters, settings |
| [`src/components/ComposeBar.tsx`](../src/components/ComposeBar.tsx) | Message input + detail tray. Per-template branching lives here |
| [`src/components/MessageTimeline.tsx`](../src/components/MessageTimeline.tsx) | Message list, per-message edit/duplicate/reorder/delete |
| [`src/components/SettingsSheet.tsx`](../src/components/SettingsSheet.tsx) | All per-platform settings |
| [`src/components/ExportPanel.tsx`](../src/components/ExportPanel.tsx) | Render, watermark, Save Image, Copy for AO3, help panel |
| [`src/components/PreviewPane.tsx`](../src/components/PreviewPane.tsx) | Renders generator HTML/CSS; click-to-edit |
| [`src/lib/generator.ts`](../src/lib/generator.ts) | `buildCSS` / `buildHTML` — the actual skin output |
| [`src/lib/schema.ts`](../src/lib/schema.ts) | `SkinProject`, `SkinSettings`, `Message`, `defaultProject()` |
| [`src/lib/storage.ts`](../src/lib/storage.ts) | localStorage load/persist, sanitisation, `hasStoredProject()` |
| [`src/lib/urlNormalize.ts`](../src/lib/urlNormalize.ts) | Image URL normalisation, expiry warnings, validation |
| [`src/lib/imgbb.ts`](../src/lib/imgbb.ts) | Upload client with retry/backoff |
| [`src/lib/proFeatures.ts`](../src/lib/proFeatures.ts) | Pro gating: watermark-free, 4× export |
| [`src/lib/examples.ts`](../src/lib/examples.ts) | The 13 starter templates |
