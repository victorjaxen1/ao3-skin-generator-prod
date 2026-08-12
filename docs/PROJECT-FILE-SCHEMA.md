# AO3 SkinGen local backup files

AO3 SkinGen backups are JSON files created and restored entirely in the browser. They are not uploaded and do not require an account.

## Scene project — schema version 1

Top-level fields are exact: `format`, `schemaVersion`, `exportedAt`, `application`, `project`, and `characterLibrary`.

```json
{
  "format": "ao3skingen-project",
  "schemaVersion": 1,
  "exportedAt": "2026-08-12T00:00:00.000Z",
  "application": { "name": "AO3 SkinGen", "version": "0.1.0" },
  "project": { "id": "scene-id", "template": "ios", "settings": {}, "messages": [] },
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
- Scene import is replace-only and previews the platform, message/result count, character count, export date, and remote-image presence.
- Before replacement, AO3 SkinGen downloads the currently open project or theme as a safety backup.
- Remote image references remain URLs. The JSON file does not contain copies of hosted images.
