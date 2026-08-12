# AO3 SkinGen

AO3 SkinGen is a browser-based publishing utility for fictional social-media scenes. Build iMessage, WhatsApp, X/Twitter, or Google-style scenes and export them as:

- a local PNG;
- hosted AO3 image code; or
- accessible real text plus an AO3 work skin.

It also includes a separate AO3 site-skin maker. AO3 SkinGen is unofficial and is not affiliated with the Organization for Transformative Works or Archive of Our Own.

## What is implemented

- Four scene types with live previews and mobile editing
- Local project autosave in `localStorage`
- PNG download with a separate fiction label and optional neutral tool credit
- Hosted image export through ImgBB
- Single-platform and all-platform AO3 work skins
- Readable skin-off and download-oriented markup
- Sixteen AO3 site-skin templates with shared preview/export compilation
- A vendored AO3 CSS allowlist and blocking validation
- Character presets, group participants, undo/redo, and image-proxy fallbacks
- Playwright coverage for generators, AO3 readback fixtures, accessibility, mobile layout, and export behavior

## Privacy and network behavior

No account is required. Editable project text and settings are stored in the browser.

Network access happens in these cases:

- Remote image addresses are requested from their hosts for preview and may pass through `/api/image-proxy` when an export needs a CORS-safe copy.
- Uploaded files are sent to ImgBB.
- “Get AO3 image code” uploads the finished rendered scene, including visible story text, to ImgBB.
- Google Analytics loads when `NEXT_PUBLIC_GA_MEASUREMENT_ID` is configured. Event parameters must never include story text, names, handles, image addresses, or generated output.

Uploads go through the same-origin `/api/image-upload` boundary. The ImgBB credential is server-only, uploaded bytes are size/type checked, and provider responses are reduced to a fixed public-URL result. The in-memory abuse and daily-budget counters reset on serverless cold starts; use a shared durable rate-limit store if traffic or abuse makes that necessary.

## Local development

Requirements: Node.js 20 or newer and npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Optional environment variables:

```text
IMGBB_API_KEY=
IMAGE_UPLOADS_ENABLED=true
NEXT_PUBLIC_GA_MEASUREMENT_ID=
```

Open `http://localhost:3000`.

## Verification

```bash
npm run typecheck
npm run build
npm run test:unit
npm run test:smoke
```

The deterministic test suite never downloads AO3’s live allowlist. To explicitly compare the vendored rules with the reviewed upstream commit:

```bash
npm run audit:ao3-css
```

To audit another ref, pass it after `--`, review every listed difference, and then deliberately update the vendored data and review metadata:

```bash
npm run audit:ao3-css -- master
```

## Code map

```text
src/pages/index.tsx                 Scene builder route
src/pages/site-skin.tsx             Site-skin route
src/components/ExportPanel.tsx      PNG, hosted-image, and work-skin handoffs
src/lib/generator.ts                 Canonical scene HTML/CSS generator
src/lib/workSkin.ts                  AO3 work-skin transformations and master skin
src/lib/siteSkin/compile.ts          Canonical site-skin preview/export compiler
src/lib/siteSkin/ao3Css.ts           AO3 CSS validation logic
src/lib/siteSkin/ao3Properties.ts    Vendored AO3 CSS ruleset
src/pages/api/image-proxy.ts         Export-time remote-image proxy
tests/                               Unit and browser regression coverage
```

## Source license status

The repository is publicly readable, but it currently has no tracked `LICENSE` file. The project owner must explicitly choose and add the intended source license before the repository describes itself as MIT or open source. Generated user output remains the user’s content under the published Terms.

## Security

Please report security issues privately to `hello@wordfokus.com`. Do not include private story content or credentials in a public issue.
