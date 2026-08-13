# AO3 SkinGen local backup files

AO3 SkinGen backups are JSON files created and restored entirely in the browser. They are not uploaded and do not require an account.

## Scene project — schema version 4

Top-level fields are exact: `format`, `schemaVersion`, `exportedAt`, `application`, `project`, and `characterLibrary`.

```json
{
  "format": "ao3skingen-project",
  "schemaVersion": 4,
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
- Twitter message IDs must be unique. Parent IDs must exist, and self-parenting or relationship cycles are rejected.
- Twitter quotes, activities, and posts may reference only identities in the project-scoped scene cast.
- Image grids and quote grids contain at most four images. A post cannot contain both an image grid and a video.
- Video data is structured rather than pasted embed HTML. YouTube hosts, absolute HTTPS URLs, direct-video MIME types, captions, titles, and poster URLs are validated.
- Polls contain two to four uniquely identified options; closed manual percentages must total 100.
- Scene import is replace-only and previews the platform, message/result count, character count, export date, and remote-image presence.
- Before replacement, AO3 SkinGen downloads the currently open project or theme as a safety backup.
- Remote image references remain URLs. The JSON file does not contain copies of hosted images.

Scene schema versions 1, 2, and 3 remain importable. They are migrated in memory to stable scene identities, per-post quotes, the canonical Twitter scene/layout/reply-context fields, and the light/dim/dark theme enum; new exports always use version 4.
