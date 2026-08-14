# AO3 SkinGen local backup files

AO3 SkinGen backups are JSON files created and restored entirely in the browser. They are not uploaded and do not require an account.

## Scene project — schema version 7

Top-level fields are exact: `format`, `schemaVersion`, `exportedAt`, `application`, `project`, and `characterLibrary`.

```json
{
  "format": "ao3skingen-project",
  "schemaVersion": 7,
  "exportedAt": "2026-08-12T00:00:00.000Z",
  "application": { "name": "AO3 SkinGen", "version": "0.1.0" },
  "project": {
    "id": "scene-id",
    "template": "twitter",
    "settings": { "twitterSceneMode": "thread", "twitterTheme": "dim" },
    "messages": [
      { "id": "root", "sender": "", "content": "First post", "outgoing": true, "characterId": "alex", "twitterLayout": "auto", "twitterQuote": { "name": "External account", "handle": "external", "text": "Quoted text" } },
      { "id": "reply", "sender": "", "content": "A reply", "outgoing": true, "characterId": "casey", "parentId": "root", "twitterLayout": "auto", "twitterReplyHandlesMode": "auto", "twitterMediaCrop": "fill-width", "attachments": [{ "type": "image", "url": "https://example.com/image.png", "alt": "A described story image" }] }
    ]
  },
  "characterLibrary": []
}
```

Version 5 added canonical WhatsApp scene data. Version 6 makes WhatsApp video
sources explicit so a YouTube page can never be mislabeled as an MP4 file. The
structured fields are:

- `whatsappReply: { messageId }`, referencing an earlier ordinary message;
- `whatsappLinkPreview: { url, title, siteName?, description?, image? }`;
- `whatsappMedia`, a discriminated audio/video object: audio is a direct HTTPS
  file; video is either `{ source: "youtube", url }` or
  `{ source: "direct", url, mimeType }`;
- `whatsappReactions: [{ emoji, count? }]`, capped at three distinct emoji;
- `whatsappEvent: { kind: "date" | "system", text }`;
- `whatsappStartNewRun`, plus participant `whatsappTone` values;
- frame, subtitle, wallpaper, scroll, and viewport settings.

A message may have only one primary content kind: image grid, link preview, or audio/video. Events are exclusive with message content and delivery metadata. Link/media/poster/caption addresses must be absolute HTTPS URLs; ordinary images retain the existing safe-image policy.

Version 7 adds the equivalent structured model for iOS / iMessage. The fields
are deliberately **separate from the WhatsApp ones even where the shape
matches** — the two renderers must never read each other's data, because the
platforms agree on almost nothing except what a URL looks like:

- `iosReply: { messageId }`, referencing an earlier ordinary message;
- `iosLinkPreview: { url, title, siteName?, description?, image? }`;
- `iosMedia`, a discriminated audio/video object: audio is a direct HTTPS file;
  video is either `{ source: "youtube", url }` or
  `{ source: "direct", url, mimeType }`, both with an optional `title`;
- `iosTapbacks: [{ emoji, count? }]`, capped at three distinct emoji;
- `iosEvent: { kind: "date" | "system", text }`;
- `iosStartNewRun`, plus participant `iosTone` values;
- `iosFrameMode`, `iosScrollable`, and `iosViewportHeightEm` settings.

**No media discriminator is ever guessed.** A block whose `kind` or `source` is
missing or unrecognised is rejected on strict import and dropped whole on
local-storage recovery, rather than inferred from the URL. A YouTube watch page
and a direct media file need different AO3 elements, so a wrong guess produces a
card the author never wrote — worse than an empty message, which preflight
reports in plain words.

An empty or whitespace-only YouTube `posterUrl` normalizes **away** rather than
being stored, because an empty poster is what tells the renderer to derive the
YouTube thumbnail. A video `title` is genuinely optional and survives as absent
rather than becoming an empty string.

## Site theme — schema version 1

Top-level fields are exact: `format`, `schemaVersion`, `exportedAt`, `application`, and `theme`.

```json
{
  "format": "ao3skingen-site-theme",
  "schemaVersion": 1,
  "exportedAt": "2026-08-12T00:00:00.000Z",
  "application": { "name": "AO3 SkinGen", "version": "0.1.0" },
  "theme": {}
}
```

## Import rules

- Files are limited to 2 MB before JSON parsing.
- Future schema versions are rejected instead of guessed at.
- Unknown top-level fields are rejected; unknown fields inside known objects are ignored.
- Platforms, enums, counts, lengths, colours, fonts, and image URLs are validated.
- All message IDs must be unique. Twitter parent IDs must exist, and self-parenting or relationship cycles are rejected.
- Twitter quotes, activities, and posts may reference only identities in the project-scoped scene cast.
- Image grids and quote grids contain at most four images. A post cannot contain both an image grid and a video.
- Video data is structured rather than pasted embed HTML. YouTube hosts, absolute HTTPS URLs, direct-video MIME types, captions, titles, and poster URLs are validated.
- Polls contain two to four uniquely identified options; closed manual percentages must total 100.
- WhatsApp and iOS replies must each target an earlier ordinary message. Group messages must reference a configured participant, and event/content exclusivity is validated.
- Scene import is replace-only and previews the platform, message/result count, character count, export date, and remote-image presence.
- Before replacement, AO3 SkinGen downloads the currently open project or theme as a safety backup.
- Remote image references remain URLs. The JSON file does not contain copies of hosted images.

Scene schema versions 1–6 remain importable. They are migrated in memory to stable scene identities, per-post quotes, the canonical Twitter scene/layout/reply-context fields, and the light/dim/dark theme enum; new exports always use version 7. A version 5 WhatsApp video without an explicit `source` is rejected rather than guessed because a YouTube watch page and a direct media file require different AO3 elements.

The version 6 → 7 step adds no data. It cannot: there is nothing in a v6 file
from which rich iOS content could be reconstructed, and the retired single
`reaction` string is deliberately **not** copied into `iosTapbacks` — the editor
owns that field canonically, and a migration would silently invent a Tapback
stack the author never authored. A v6 file simply arrives without one. The
renderer still draws a legacy `reaction` where a message carries it, so nothing
already saved disappears.
