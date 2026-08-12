# AO3 SkinGen repository-grounded growth and publishing plan

## Developer handoff

- **Owner:** Project owner
- **Audience:** A developer who is new to this codebase
- **Revised:** August 12, 2026
- **Repository baseline:** `main` at `b3c4545`
- **Status:** Active implementation handoff; Releases 0–3 are substantially
  shipped and Release 4 has not started
- **Application today:** `https://app.ao3skingen.wordfokus.com/`
- **Public landing page:** `https://ao3skingen.wordfokus.com/`
- **Additional crawlable product/guide hub:** `https://www.wordfokus.com/ao3skingen/`

This revision replaces the earlier outside-in plan. The earlier strategy was
directionally sound, but it described some shipped features as missing, did not
account for the app's current component and storage boundaries, and would have
asked a developer to add more choices and prompts to an already dense export
experience.

The implementation order in this document is deliberate. Do not start with the
WorldKonstruct card, a ZIP generator, a project library, more templates, or an
email form. First make the current product honest, secure, recoverable, and
measurable. Then add the workflow bridge.

### Implementation progress — August 12, 2026

**Core engineering program: 72% complete.** This is a planning estimate, not a
product metric. It is the equal-weight average of the five numbered releases:

| Release | Completion | Evidence shipped | Remaining work |
| --- | ---: | --- | --- |
| Release 0 — trust and baseline | **86%** | Pro and fake activation removed; generic donation/success path removed; fiction label and neutral attribution separated; README, Terms, validation copy, scripts, and pinned AO3 ruleset updated | Choose/add a source license or explicitly keep the repository unlicensed; correct the stale watermark language in `public/content-policy.html`; finish a cross-domain public-copy audit |
| Release 1 — secure images | **95%** | Server-only `/api/image-upload`; explicit file and rendered-scene consent; byte/type/magic-byte limits; provider timeout; origin checks; hardened DNS/redirect/streaming proxy; narrowed CSP; security tests; production PNG/JPEG/WebP uploads verified | Replace warm-instance rate/daily counters with a durable shared budget store if traffic or abuse warrants it; periodically verify the old browser-exposed credential cannot be found in live bundles |
| Release 2 — identity, domains, analytics | **79%** | Shared product config; SSR metadata; PWA/deep-link fixes; branded app domain; Netlify fallback redirect; server-only upload environment; typed content-free analytics with explicit opt-in and changeable privacy choices | Recheck WordPress sitemap/Search Console state; add/verify the branded app link on the WordPress hub; operationalize the weekly dashboard instead of merely defining events; finish the remaining public-link audit |
| Release 3 — backup and publishing handoff | **100%** | Strict versioned scene and site-theme files; safe replace with automatic backup; validated character storage; fallback preview; deterministic transcript; attachment/scene alt; composed preflight; coordinated output-specific AO3 handoffs | Maintain migration fixtures when schema v2 is introduced; do not add a ZIP unless evidence shows demand |
| Release 4 — cast portability | **0%** | Analytics event types were reserved, but no cast interchange or commercial bridge was shipped | Obtain the WorldKonstruct repository, destination, import/export contract, and shared-fixture agreement before implementing any bridge |

Calculation: `(86 + 95 + 79 + 100 + 0) / 5 = 72`.

Sections 12–15 contain ongoing compatibility, accessibility, measurement, and
distribution work. They are not counted as a finite sixth release. Track their
individual deliverables, but do not change the 72% figure without rescoring all
five releases against repository and production evidence.

### Shipped commit trail

- `f20d0bd` — secure image handling and trust baseline
- `7dc4178` — branded application domain, metadata, PWA, and deep links
- `4701bb7` and `695a37e` — explicit content-safe analytics consent and copy
- `5d6478a` — versioned project/theme backups and improved publishing handoff
- `b3c4545` — moved privacy choices into real layouts so the control cannot
  cover the composer; added desktop/mobile collision coverage

The tracked implementation is clean at this baseline. The working directory
still contains owner-created, untracked documents, screenshots, article drafts,
and image-reference material. Preserve them. This document was one of those
files before this handoff and is now intentionally part of the implementation
record.

### Current production architecture

The owner-approved split differs from the original recommendation later in this
document:

```text
ao3skingen.wordfokus.com       public SwipePages landing page
app.ao3skingen.wordfokus.com   interactive Netlify application
www.wordfokus.com/ao3skingen/  additional WordPress product/guide hub
```

Treat `https://app.ao3skingen.wordfokus.com` as `PRODUCT.appUrl` and
`https://ao3skingen.wordfokus.com` as `PRODUCT.hubUrl`. Do not collapse the
landing page and app onto one host unless the owner deliberately reverses this
decision. The old `ao3skingen.netlify.app` address redirects to the branded app
and is not the public application identity.

Live domain verification on August 12, 2026:

- the branded app returned 200 and canonically identified
  `https://app.ao3skingen.wordfokus.com/`;
- the SwipePages landing returned 200, self-canonicalized, and contained the
  branded application URL;
- the WordPress hub returned 200 and self-canonicalized, but its returned HTML
  did not contain the exact branded application URL; and
- `https://ao3skingen.netlify.app/` returned a permanent redirect to the
  branded application URL.

### Implementation learnings

1. **A public environment variable is not a protected credential.** The old
   `NEXT_PUBLIC_IMGBB_API_KEY` was absent from Git history but present in the
   browser bundle by design. The correct boundary is the same-origin server
   route with `IMGBB_API_KEY`. Never print `.env.local` values while debugging.
2. **Use one canonical renderer per output.** Backup, transcript, fallback, and
   preflight work succeeded because they wrap existing `buildHTML`, `buildCSS`,
   `buildWorkSkin`, `buildMasterWorkSkin`, and site-skin `compile(theme)` output.
   Do not introduce a second “Publishing Kit” renderer.
3. **Strict imports and tolerant local recovery are different trust
   boundaries.** Project files use explicit keys, limits, enums, URLs, format,
   and version checks. The localStorage recovery loader may retain backward-
   compatibility behavior, but arbitrary imported JSON must never enter React
   state through it.
4. **A backup is meaningful only when its freshness changes with the project.**
   Backup status is based on a project fingerprint, so editing after download
   correctly returns the preflight to “backup recommended.”
5. **Alt edits do not require another hosted upload.** Once ImgBB returns the
   image URL, changing the short scene description regenerates the local AO3
   embed code. The image bytes and URL stay unchanged.
6. **Fixed controls must participate in layout.** The floating Privacy pill was
   placed above the measured export bar and therefore landed on the composer.
   Privacy choices now open through an application event from controls located
   in the export bar, landing footer, and site-skin header. Preserve the
   desktop/mobile collision test whenever fixed UI changes.
7. **Production image handling is healthy across the supported formats tested.**
   Fresh PNG, JPEG, and WebP files uploaded through the live API, returned valid
   public image responses, rendered through the live UI, and appeared in a PNG
   export. A report of blank image bubbles was not reproduced and was most
   consistent with stale local/browser state. Recheck with a fresh file and a
   hard refresh before changing the upload pipeline.
8. **Service workers and CDN propagation can make a correct deployment look
   half-updated.** Netlify took several minutes to serve `b3c4545`, and one probe
   briefly saw an HTML document that referenced an unavailable old script.
   Verify the deployed bundle and then run the relevant test against the public
   URL. If a browser alone shows old UI, use a hard refresh before diagnosing a
   source regression.
9. **Browser tests default to production.** `playwright.config.ts` uses the live
   app unless `UX_BASE_URL` is set. For local checks, start the app and explicitly
   set `UX_BASE_URL=http://127.0.0.1:3000`. Use `--workers=1` for stateful UI
   sequences and deployment verification.
10. **Public copy is a separate deployment surface.** Repository HTML, the
    SwipePages landing page, WordPress, privacy/Terms pages, and the application
    can drift independently. A code deploy does not prove all public claims are
    aligned.

### Clean handoff for the next developer

Start from `main` at or after `b3c4545`. Do not reset or clean the workspace;
the untracked screenshots, reference exports, article drafts, implementation
blueprints, and image-handling examples belong to the owner.

Environment and boundaries:

- `IMGBB_API_KEY` is server-only and configured in Netlify; never add the
  `NEXT_PUBLIC_` prefix.
- `NEXT_PUBLIC_GA_MEASUREMENT_ID` is intentionally public, but analytics must
  remain disabled until explicit consent.
- Editable fiction, identities, image addresses, generated code, raw errors,
  and imported-file contents must never enter analytics.
- The app stores one scene project, one separate site theme, and a validated
  character library locally. There is no cloud account or project library.
- Project file schema v1 is documented in `docs/PROJECT-FILE-SCHEMA.md`.

Verification commands on Windows PowerShell:

```powershell
npm run typecheck
npm run build
npm run test:unit
# In a separate terminal after the build:
npm run start -- -p 3000
# Back in the test terminal:
$env:UX_BASE_URL='http://127.0.0.1:3000'
npx playwright test tests/project-backup.spec.ts tests/analytics-consent.spec.ts --project=desktop --project=mobile --workers=1
```

For production verification, replace `UX_BASE_URL` with
`https://app.ao3skingen.wordfokus.com`. The latest verified evidence is:

- TypeScript check: passed;
- optimized production build: passed;
- deterministic unit suite: **249 passed**;
- Release 3 backup/handoff browser suite: **6 passed** locally across desktop
  and mobile;
- broader Release 3 desktop regression run: **25 passed**;
- Privacy/composer collision test: **2 passed locally** and **2 passed against
  production**, desktop and mobile;
- live PNG/JPEG/WebP upload and rendered-image checks: passed.

The next work should proceed in this order:

1. **Close Release 0 honestly:** obtain the owner's license choice; add the
   license or retain explicit unlicensed wording; update
   `public/content-policy.html` so it describes the default fiction label and
   optional neutral attribution accurately; audit the live landing, privacy,
   Terms, content policy, README, and generated output together.
2. **Close Release 2 external work:** recheck WordPress sitemap/Search Console,
   add/verify the branded application link on the WordPress hub, finish the
   remaining public-link audit, and build the weekly content-free dashboard
   from the already typed events.
3. **Continue compatibility work:** add the Markdown compatibility ledger and
   dated AO3 Default/Reversi/Low Vision checks before expanding public
   compatibility claims.
4. **Do not start Release 4 speculatively:** request the WorldKonstruct
   repository, owned destination, import/export constraints, and a consumer-
   approved neutral fixture. Then implement `collectCastCandidates` as a pure
   function before any promotional card.

When adding schema v2, write pure `v1 -> v2` migrations and fixtures before
changing the importer. When changing the export bar, consent UI, composer, or
mobile preview, rerun occlusion/collision checks at both desktop and narrow
mobile widths. When changing AO3 CSS, record the exact upstream commit, run
`npm run audit:ao3-css`, and keep builds/tests independent of live GitHub.

### Audit scope and external evidence

This revision did not treat the workspace as the whole product. It also checked:

- the [public GitHub repository](https://github.com/victorjaxen1/ao3-skin-generator-prod)
  and every commit reachable from its `main` branch;
- the [production Netlify app](https://ao3skingen.netlify.app/) HTML and
  JavaScript bundles;
- the [WordPress hub](https://www.wordfokus.com/ao3skingen/),
  [allowed-CSS article](https://www.wordfokus.com/ao3-allowed-css-properties/),
  Rank Math page sitemap, and [legacy subdomain](https://ao3skingen.wordfokus.com/);
- the current [WordFokus Google Workspace Marketplace listing](https://workspace.google.com/marketplace/app/wordfokus_distractionfree_writing_for_do/297087799172);
- [ImgBB's current API documentation](https://api.imgbb.com/);
- the current [`otwcode/otwarchive` CSS configuration](https://github.com/otwcode/otwarchive/blob/cf1d7f997047eaca14370985dafd156a91696313/config/config.yml)
  on GitHub; and
- current OTW/AO3 policy guidance on commercial promotion.

External state can change after this date. Re-run the specific checks named in
the relevant release instead of copying these findings indefinitely.

## 1. Executive decision

AO3 SkinGen should become the **AO3 publishing utility for social-media scenes**,
not another generic fake-screenshot site.

Its defensible promise is:

> Build a social-media scene visually, then publish it as a PNG or as accessible
> real text with AO3-compatible CSS and a readable no-skin/download fallback.

The app already earns this position. It has four scene types, image export,
hosted AO3 image code, single-platform and all-platform work skins, meaningful
skin-off output, a site-skin maker, an AO3 CSS allowlist/linter, local auto-save,
characters, group participants, and extensive AO3 regression tests.

The next product work should therefore do five things:

1. remove trust contradictions and secure image handling;
2. measure actual completed handoffs instead of button clicks;
3. make backup, fallback text, and accessibility visible in the export flow;
4. consolidate the existing character concepts before adding cast portability;
5. offer WorldKonstruct only at a genuinely relevant cast-success moment.

WordFokus remains a secondary drafting companion. Neither paid products nor
Ko-fi belong in generated AO3 content.

## 2. Non-negotiable AO3 and product boundary

AO3 is a non-commercial archive. Treat every string that can travel into a work,
skin, image, transcript, README, or pasteable snippet as AO3-bound content.

Never insert any of the following into AO3-bound output:

- a paid-product recommendation;
- a Marketplace link;
- pricing or upgrade language;
- a Ko-fi or donation request;
- an affiliate or referral parameter;
- an email signup;
- a tracked URL; or
- hidden promotional text.

Relevant policy and product references:

- [AO3 Terms of Service](https://archiveofourown.org/tos)
- [AO3 Terms of Service FAQ](https://archiveofourown.org/tos_faq)
- [OTW commercial-promotion explainer](https://www.transformativeworks.org/tos-spotlight-commercial-promotion/)
- [AO3 skins and archive interface FAQ](https://archiveofourown.org/faq/skins-and-archive-interface)

### 2.1 Keep three concepts separate

1. **Fiction/safety label** — identifies a realistic-looking image as fictional.
   This is a safety feature.
2. **Free-tool attribution** — optional neutral credit for AO3 SkinGen. This is
   attribution, not a safety label.
3. **Commercial recommendation** — WorldKonstruct, WordFokus, Ko-fi, or any paid
   offer. This may appear only inside the standalone app or the owner's sites.

Do not use one control for all three. Removing optional tool attribution must not
remove a safety label, unlock a paid feature, lower export resolution, or alter
the user's scene.

### 2.2 Recommended attribution defaults

- For AO3-bound work-skin HTML: offer neutral credit as an unchecked option in
  the export dialog. Do not append it unconditionally.
- For PNGs: default a short fiction label on for realistic mockups and let the
  user edit or remove it after a clear warning. Offer tool attribution as a
  separate option.
- Keep commercial content out of both.
- The safest default is no linked credit. If the owner wants optional credit,
  use the plain tool name or create a dedicated, durable, commercial-neutral
  page such as `https://www.wordfokus.com/ao3skingen/made-with/`. That destination
  and every navigation element reachable from it must contain no paid-product,
  Marketplace, affiliate, or donation CTA.

This changes the current behavior. The work-skin generator currently appends
`made by wordfokus.com/ao3skingen` to every HTML export, while PNG attribution is
removed only by the unfinished Pro gate. The current `/ao3skingen/` hub contains
Ko-fi and commercial WordFokus links, so it is not an acceptable AO3-bound credit
destination under this plan. Remove the hardcoded URL before offering any new
credit option.

## 3. Repository truth at the original audit baseline

This section records `3990fba`, the baseline from which Releases 0–3 were
implemented. It explains why each requirement exists, but its “Current
implementation” column is historical. Use the progress table and clean handoff
above for the state at `b3c4545`.

| Area | Current implementation | Implication |
| --- | --- | --- |
| Framework | Next.js 16 Pages Router with React 18; routes are [`src/pages/index.tsx`](src/pages/index.tsx) and [`src/pages/site-skin.tsx`](src/pages/site-skin.tsx) | Use `next/head` per route. Do not introduce App Router conventions into this work. |
| Scene state | One `SkinProject` with `id`, `template`, flat `settings`, and `messages` in [`src/lib/schema.ts`](src/lib/schema.ts) | Project portability can wrap this type, but imports need a stricter validator than the current localStorage loader. |
| Scene persistence | One project at `localStorage['ao3SkinProject']`, debounced by 500 ms, capped at 500 KB | Backup/import is P2. An IndexedDB project library is not the first step. |
| Site-skin state | Separate `SiteSkinTheme` and `localStorage['ao3SiteSkinTheme']` | Keep site-skin project files separate from scene project files. |
| Character state | Global library at `ao3skin_universal_characters`, project Twitter presets, group participants, primary identities in settings, and per-message Twitter overrides | There is no single cast yet. Consolidate types and collection rules before building interchange. |
| Scene UX | Platform/template picker, header identity field, message timeline, compose bar, live preview, People/Cast sheet, Settings sheet, fixed export bar | Do not add growth CTAs to the editor canvas or fixed bar. They belong after completion. |
| Image output | `Save Image` downloads a PNG; `Copy for AO3` renders, uploads to ImgBB, then opens an embed-code modal | The second label is misleading: it uploads before anything is copied. Rename and disclose it. |
| Real-text output | [`src/lib/workSkin.ts`](src/lib/workSkin.ts) builds validated single-platform and all-platform work skins from the same generator HTML/CSS | Do not build a parallel work-skin generator for a Publishing Kit. Reuse `buildWorkSkin` and `buildMasterWorkSkin`. |
| Skin-off/download behavior | Speaker attribution and reading order are already implemented and tested in [`tests/skin-off.spec.ts`](tests/skin-off.spec.ts) and [`tests/work-skin.unit.spec.ts`](tests/work-skin.unit.spec.ts) | Expose this strength in the UI; do not describe it as wholly unbuilt. |
| Site-skin output | 16 templates, one compiler used by preview and export, contrast warnings, and blocking AO3 lint | Instrument and improve the handoff; do not replace the compiler or create a second output path. |
| AO3 validation | Shared allowlist/linter in [`src/lib/siteSkin/ao3Css.ts`](src/lib/siteSkin/ao3Css.ts) | Keep this as the only CSS gate. Add a dated ruleset/version label rather than claiming permanent safety. |
| Image upload | Browser sends files and finished PNGs directly to ImgBB using `NEXT_PUBLIC_IMGBB_API_KEY` | Move this to a server-only API route and rotate the exposed key. |
| Image proxy | A Next API route already handles export-time CORS failures and has HTTPS/origin/size/rate checks | Harden the existing route. Do not create a second proxy. |
| Analytics | GA loads in `_document`; two successful image paths call `gtag` directly | Add a typed helper, route events, failures, copy completions, and content-safe parameters. |
| Monetization | An unfinished local-only Pro gate locks 4× output and watermark removal; the success modal shows Ko-fi and WordFokus together | Remove the fake Pro surface now. Replace the modal instead of repairing its counter alone. |
| Metadata | Root has no route `<Head>`; site-skin metadata is returned only after client hydration; manifest and HTML theme colors disagree | Add SSR-visible route metadata and make PWA values share one config. |
| Regression coverage | Extensive Playwright/unit coverage for AO3 readback, work skins, site skins, mobile, occlusion, image proxy, and accessibility labels | Extend this suite. Do not trade it for a new test stack. |
| Public source | `victorjaxen1/ao3-skin-generator-prod` is public and its `main` exactly matches local `3990fba`; the README says MIT, but there is no tracked `LICENSE` file | Treat licensing as incomplete, not as a private-repository decision. Add the intended license file and make Terms agree. |
| Public documentation | The GitHub README describes deleted components and export paths, says “no tracking,” and calls the browser-inlined ImgBB key publishable | README cleanup is a P0 trust task, not optional housekeeping. |

### 3.1 Original online ImgBB-key finding

The actual key in local `.env.local` was compared without printing it.

- It has **zero matches** in all Git commits reachable from the public GitHub
  `main` branch.
- `.env.local` has never been tracked in reachable history.
- Only the blank `.env.example` is present in Git.
- The exact key **is present** in the live production JavaScript bundle at the
  audit date.

This is expected from `NEXT_PUBLIC_IMGBB_API_KEY`: Next.js inlines
`NEXT_PUBLIC_` values into browser JavaScript at build time. The Git repository
did not leak the value; the deployment architecture did. Do not waste time
rewriting Git history for this key. Move upload server-side first, deploy, verify
the browser bundles no longer contain the value, and then rotate the old key.

Reference: [Next.js browser environment-variable bundling](https://nextjs.org/docs/pages/guides/environment-variables#bundling-environment-variables-for-the-browser).

### 3.2 Original public-web findings

As checked on 2026-08-12:

- `https://www.wordfokus.com/ao3skingen/` and the allowed-CSS article return 200,
  are indexable, and self-canonicalize.
- Neither URL appears in `https://www.wordfokus.com/page-sitemap.xml`. Treat that
  as a specific WordPress/Rank Math configuration issue, not a generic SEO task.
- `https://ao3skingen.wordfokus.com/` is still live, indexable, and
  self-canonical. It duplicates the product surface and retains stale claims,
  including “Your Data Never Leaves Your Browser” and an unsupported user count.
- The Netlify app root and `/site-skin` return no useful route title, canonical,
  or robots metadata in the initial HTML. Client-only metadata is insufficient
  for this app's public entry routes.
- WordFokus has a live Google Workspace Marketplace product with a real install
  base and paid features. It is a commercial destination, not neutral tool help.
- No public indexed WorldKonstruct destination or interchange schema was found.
  Do not invent either in product copy; require the owner inputs in Section 6.

Recheck all six observations immediately before domain or content work. Search
indexes, sitemaps, redirects, and Marketplace listings are mutable external state.

### 3.3 Original AO3 compatibility snapshot

The current `otwcode/otwarchive` `master` allowlist was compared directly with
[`AO3_PROPERTIES`](src/lib/siteSkin/ao3Css.ts) on 2026-08-12:

- upstream `SUPPORTED_CSS_PROPERTIES`: 182 entries;
- local `AO3_PROPERTIES`: 181 entries;
- missing locally: `aspect-ratio`;
- extra locally: none;
- upstream and local shorthand lists: 20 entries and an exact match.

This is conservative drift: the app can reject a property AO3 currently permits.
It does not prove that existing generated exports are broken. Sync the missing
property through a reviewed change, record upstream commit
`cf1d7f997047eaca14370985dafd156a91696313`, and add a repeatable drift check.
Never download an allowlist dynamically at runtime or silently update it during
a production build.

### 3.4 Existing behavior that must be preserved

- The platform picker is the first-visit experience.
- Returning users skip the picker only when a real saved project exists.
- Replacing work from the picker asks for confirmation.
- Mobile has a collapsible live preview and still renders an off-screen capture
  target when collapsed.
- The fixed export bar publishes its measured height through `--export-bar-h` so
  it does not cover the composer.
- The work-skin export and preview derive from the existing generator functions.
- The master skin contains all four platforms and light/dark variants.
- AO3 export CSS has comments removed intentionally; do not restore them without
  a real AO3 save/readback test.
- The site-skin preview and copied CSS use the exact same `compile(theme)` result.
- Clipboard failure always leaves selectable text and a manual-copy instruction.
- A failed local save is visible to the user.

### 3.5 Incorrect or incomplete assumptions in the previous plan

- Work-skin generation, CSS validation, an all-platform master skin, meaningful
  no-skin output, and mobile preview are already built.
- “Successful publishing” cannot be observed. The app can measure an AO3-ready
  handoff, not whether the user actually published on AO3.
- A full ZIP Publishing Kit is not required to improve activation and would
  reintroduce archive/dependency complexity that this project intentionally
  removed.
- The cast is not simply `UniversalCharacter[]`; identities are distributed
  across five data sources.
- The existing image proxy is not absent, but it is also not fully SSRF-safe.
- Fixing the donation counter is insufficient. The current success modal fires
  before some actions are complete, makes unsupported time-saved claims, and
  presents two unrelated promotions together.
- A generic post-export WorldKonstruct card is less relevant than a cast-export
  success card.
- Site skins do not need an ebook preview. Ebook/no-skin fallback belongs to work
  content, not a personal AO3 interface theme.

## 4. Target experience

### 4.1 First visit

Keep the current picker structure. Change the positioning copy from:

> Fake screenshots for your fanfics

to:

> Social-media scenes for AO3 — export as an image or accessible real text.

Use a truthful privacy line near the footer:

> No account required. Editable text and settings stay in this browser. Hosted
> image features upload only when you choose them.

Do not put WorldKonstruct, WordFokus, Ko-fi, an email form, or a pricing card on
the picker. The first decision should remain “what do I want to make?”

### 4.2 Editing

Preserve the current editor hierarchy:

```text
workspace header
  -> message/result editor
  -> live preview
  -> compose action
  -> fixed export bar
```

The editor's job is rapid feedback. Growth elements, backup reminders, and
publishing explanations must not occlude the composer or compete with the live
preview.

Add one accessible overflow menu to the workspace header for project-level
actions:

- Back up project
- Import project
- Start a new project
- Privacy and data use

Do not add four more header icons. Implement a controlled `ProjectMenu` and test
it at mobile widths.

### 4.3 Export choices

Keep the current three-path model, but make every label state what happens:

| Current | Revised label | Behavior |
| --- | --- | --- |
| Save Image | Save PNG | Renders locally and triggers a file download. No network upload. |
| Copy for AO3 | Get AO3 image code | Shows the hosted-upload disclosure, uploads the rendered scene, then displays embed HTML. |
| Work skin | Accessible work skin | Opens CSS + HTML handoff with fallback preview and validation status. |

The quality chip may remain in the fixed bar after Pro is removed. Offer only
the resolutions that are reliable on low-memory mobile devices. Do not show a
locked choice for a product that cannot be purchased.

### 4.4 Completion moments

Delete the generic success modal. Each output already has its own natural place
to confirm completion.

- **Save PNG:** show a toast after the browser download is triggered. Offer
  transcript/alt-text actions from the image export disclosure or a small
  non-modal completion panel.
- **Hosted AO3 image:** render/upload first; call it ready only after upload
  succeeds. Mark the handoff complete only after the embed code is copied.
- **Work skin:** show a two-item checklist. Complete only after valid CSS and HTML
  have both been copied in the current modal session.
- **Site skin:** complete only after valid CSS is copied.
- **Project backup:** complete after the file download is triggered.
- **Cast exchange:** complete after the cast file download is triggered.

Never say “Code copied” when the user has only generated it. Never claim an
exact number of hours saved without defensible research.

### 4.5 Post-success next step

At most one next-step card may be visible after a completion event. Centralize
the decision in a pure function instead of scattering conditions through
components.

Priority:

1. finish the current AO3 handoff;
2. fix a validation/accessibility problem;
3. back up the project;
4. cast portability/WorldKonstruct, but only after cast export;
5. WordFokus, but only in a drafting context;
6. compatibility-alert signup;
7. Ko-fi.

Recommended implementation:

```ts
type NextStep =
  | 'finish_handoff'
  | 'fix_preflight'
  | 'backup_project'
  | 'worldkonstruct'
  | 'wordfokus'
  | 'compatibility_alerts'
  | 'kofi'
  | null;

function chooseNextStep(context: NextStepContext): NextStep;
```

Unit-test every priority collision. A card being eligible does not mean it must
be shown.

## 5. Measurement model

### 5.1 North-star metric

Use **weekly AO3-ready handoffs**, not “successful publishing kits.”

Count one handoff when one of these exact conditions occurs:

- `hosted_image`: hosted embed HTML was copied after a successful upload;
- `work_skin`: valid CSS and matching HTML were both copied in one export
  session;
- `site_skin`: valid site-skin CSS was copied.

Track local PNG downloads separately. They are useful outcomes but are not
necessarily AO3-ready publishing handoffs.

Do not claim that a handoff was published. The app has no AO3 integration and
should not add one.

### 5.2 Activation

Fire `project_activated` once per browser-local project when meaningful author
work first exists:

- chat: the user creates or materially edits two messages;
- Twitter: one tweet plus a non-placeholder identity;
- Google: a non-placeholder query plus one result;
- site skin: a template value is changed and previewed.

Do not count seeded example content until the user edits it. Do not use the
current `default-project` string as an analytics identity; every blank project
currently shares it. Generate a local project UUID with `crypto.randomUUID()`
and never send that UUID to analytics. The UUID exists only to deduplicate local
activation and migrations.

### 5.3 Typed content-free analytics

Create `src/lib/analytics.ts`. It is the only module
allowed to call `gtag`.

```ts
type OutputType = 'png' | 'hosted_image' | 'work_skin' | 'site_skin';

type AnalyticsEvent =
  | { name: 'tool_viewed'; tool: 'scene_builder' | 'site_skin' }
  | { name: 'template_selected'; templateId: string }
  | { name: 'project_activated'; templateId: string }
  | { name: 'export_started'; outputType: OutputType; templateId: string }
  | { name: 'export_ready'; outputType: OutputType; templateId: string }
  | { name: 'output_copied'; outputType: Exclude<OutputType, 'png'>; part: 'embed' | 'css' | 'html' }
  | { name: 'handoff_completed'; outputType: Exclude<OutputType, 'png'>; templateId: string }
  | { name: 'export_failed'; outputType: OutputType; errorCode: ExportErrorCode }
  | { name: 'fallback_preview_opened'; templateId: string }
  | { name: 'project_backup_exported'; schemaVersion: number }
  | { name: 'project_backup_imported'; schemaVersion: number }
  | { name: 'cast_exported'; characterCountBucket: CountBucket; includesAvatarUrls: boolean }
  | { name: 'cast_imported'; characterCountBucket: CountBucket }
  | { name: 'next_step_shown'; nextStep: Exclude<NextStep, null>; placement: string }
  | { name: 'product_cta_clicked'; product: 'worldkonstruct' | 'wordfokus'; placement: string }
  | { name: 'donation_clicked'; placement: string };
```

The helper must:

- return immediately during SSR, tests, opt-out, or missing GA configuration;
- allow only enumerated keys per event;
- reject or omit unknown values;
- never accept a raw `Error` object;
- never accept arbitrary strings for template, placement, or error code;
- never throw into the product flow; and
- be unit-tested with a fake `window.gtag`.

Never send:

- dialogue, search queries, character names, handles, or notes;
- project IDs or titles;
- CSS, HTML, transcripts, or alt text;
- pasted URLs, image URLs, filenames, or provider responses;
- raw exception messages; or
- complete referrer URLs with query strings.

### 5.4 Safe error codes

Use one shared error union:

```text
IMAGE_UPLOAD_TIMEOUT
IMAGE_UPLOAD_PROVIDER_ERROR
IMAGE_UPLOAD_RATE_LIMITED
IMAGE_TOO_LARGE
UNSUPPORTED_IMAGE_TYPE
REMOTE_IMAGE_BLOCKED
REMOTE_IMAGE_NOT_FOUND
REMOTE_IMAGE_TOO_LARGE
EXPORT_RENDER_FAILED
DOWNLOAD_TRIGGER_FAILED
CLIPBOARD_DENIED
CSS_VALIDATION_BLOCKED
PROJECT_IMPORT_INVALID
PROJECT_SCHEMA_UNSUPPORTED
PROJECT_IMPORT_TOO_LARGE
LOCAL_STORAGE_UNAVAILABLE
```

Map provider/network errors to these at the boundary. UI may show a safe fixed
explanation. Analytics receives only the code.

## 6. Decisions the owner must make

These are product or external-system decisions. A developer must not guess.

| Decision | Current owner/product decision | Status / blocks |
| --- | --- | --- |
| Canonical domains | SwipePages landing at `ao3skingen.wordfokus.com`; app at `app.ao3skingen.wordfokus.com`; WordPress remains an additional product/guide hub | **Decided and deployed.** App/landing/WordPress canonicals and the Netlify-to-app redirect were verified on August 12, 2026. The WordPress hub still needs the exact branded app link plus sitemap/Search Console verification. |
| Source license | The public README now states that no tracked license exists and does not claim MIT/open-source rights | **Open owner decision.** Add the intended license or keep the explicit unlicensed status; do not reintroduce MIT claims without a `LICENSE` file. |
| AO3SkinGen Pro | Keep the core publishing utility free; remove the unfinished local activation path | **Decided and complete.** The Pro components and local license helper are deleted. |
| Attribution | Separate default-on editable fiction label from optional neutral, unlinked tool credit | **Decided and complete in code.** Finish aligning stale public content-policy wording. |
| Hosted image provider | Keep ImgBB behind the same-origin server route | **Decided and deployed.** The owner rotated/configured the server key and production upload checks passed. Durable shared abuse/budget storage remains optional follow-up. |
| Analytics consent/opt-out | Analytics remains off until explicit opt-in; the visitor can reopen Privacy choices and deny later | **Implemented.** Qualified legal review remains an owner responsibility. |
| WorldKonstruct contract | No bridge until both products agree and test the neutral schema | **Undecided and blocks Release 4.** The receiving repository, destination, current product state, and import constraints are still required. |

Record these answers in this document or an ADR before the relevant PR.

At the audit date, WordFokus has a live Marketplace listing with free and paid
features, so it is unquestionably a commercial destination. No public indexed
WorldKonstruct product destination or interchange schema was found. The owner
must provide the WorldKonstruct repository, destination URL, current product
status, and import constraints before the developer treats that bridge as real.

## 7. Release 0 — trust and baseline cleanup

This is the first code release. Keep it small enough to review.

**Implementation status: 86% — substantially shipped.** The deleted Pro and
generic-success paths must stay deleted. Remaining closure work is owner license
choice, stale content-policy language, and a final audit of every public copy
surface. Commit evidence: `f20d0bd`.

### 7.1 Preserve the working tree

At the time of this revision, the repository contains owner changes and
untracked assets/docs. Do not reset, clean, or overwrite unrelated files.

Before each PR:

```text
git status --short
npm run build
npx playwright test --project=desktop tests/work-skin.unit.spec.ts tests/site-skin.unit.spec.ts
```

Add stable package scripts so the next developer does not have to know hidden
commands:

```json
{
  "scripts": {
    "test": "playwright test",
    "test:unit": "playwright test --project=desktop tests/*.unit.spec.ts",
    "test:smoke": "playwright test --project=desktop tests/landing.spec.ts tests/work-skin.spec.ts tests/site-skin.spec.ts",
    "typecheck": "tsc --noEmit"
  }
}
```

Adjust the unit glob for Windows if Playwright does not expand it consistently.

### 7.2 Remove the unfinished Pro path

Current problem:

- `src/lib/proFeatures.ts` treated a localStorage flag as
  a license;
- any key beginning with `AO3PRO-` can activate it in code;
- the purchase UI says purchases are “coming soon”;
- 4× export and watermark removal are still presented as locked features.

Required work:

1. Remove `ProUpgradeModal` from [`src/components/ExportPanel.tsx`](src/components/ExportPanel.tsx).
2. Remove the locked 4× row and any upgrade button.
3. Replace `skipWatermark`/`getProFeatures()` with explicit fiction-label and
   optional-attribution settings.
4. Delete `src/components/ProUpgradeModal.tsx` and `src/lib/proFeatures.ts` once
   no imports remain.
5. Remove Pro claims from Terms, privacy copy, metadata, and tests if present.
6. Leave reliable 1×/2× export available. Add 4× for everyone only if memory
   tests pass on mobile; otherwise omit it.
7. Remove the unconditional `wordfokus.com/ao3skingen` credit from generated
   work-skin HTML. Update the tests that currently require it. If optional plain
   tool-name credit is added, test both enabled and disabled output explicitly.

Acceptance:

- no non-purchasable upgrade is visible;
- no localStorage string can unlock a product;
- no required safety label is tied to payment;
- all existing PNG/work-skin regressions pass.

### 7.3 Replace the generic success modal

Remove `src/components/SuccessModal.tsx` and `src/lib/donationPrompt.ts` from the
export path.

Do not merely fix the off-by-one. Today `recordExport()` increments before
`shouldShowDonationModal()` checks its milestones, so the documented “third
export” fires on the second. More importantly, hosted code is called “copied”
before the user presses Copy, and the modal shows Ko-fi, WordFokus, and sharing
together.

Reintroduce a donation prompt later through the central next-step arbiter, based
on completed handoffs, with a seven-day cooldown and permanent dismissal.

### 7.4 Correct public copy

Update [`src/components/PlatformPicker.tsx`](src/components/PlatformPicker.tsx),
[`public/privacy-policy.html`](public/privacy-policy.html),
[`public/terms-of-service.html`](public/terms-of-service.html), and the owned web
pages.

Use this technical disclosure as the source of truth:

> Editable project text and settings are stored in your browser. Pasted image
> addresses are requested from their host for preview and may be sent to our
> image proxy when an export needs them. If you upload a file, that file is sent
> to our image-upload service and ImgBB. If you choose hosted AO3 image code, the
> finished rendered scene — including any visible story text — is uploaded to
> ImgBB. Content-free analytics may record which tool and export type were used,
> but not story text, names, handles, image addresses, or generated code.

Do not say “your data never leaves your browser.” Do not describe the finished
rendered scene as though it contains no creative content.

Resolve the current conflict between a public repository whose README says MIT
and Terms that forbid reverse engineering, code extraction, redistribution, and
derivative works. A README sentence is not a substitute for a license grant.

Preferred resolution:

1. add the standard MIT license text as a root `LICENSE` file with the correct
   copyright holder and year;
2. keep the open-source claim;
3. rewrite Terms so they do not take away permissions the MIT license grants;
4. distinguish the source-code license from trademarks, hosted service rules,
   third-party assets, and user output.

If the owner does not intend to grant an open-source license, remove “MIT” and
“open source” from the public README and app, and use:

> Free, browser-based, and no account required.

Also rewrite the public GitHub README from the current code. It describes deleted
Cloudinary/Imgur/ZIP modules, virtual scrolling and editor components that are no
longer present; says there is no tracking even though GA is configured; and
documents the public browser key as an intentional production setup. A new
developer must not implement stale README claims back into the app.

### 7.5 Make validation claims precise

Change permanent-sounding `AO3-safe` claims to dated compatibility language:

> Passes the bundled AO3 CSS checks · rules reviewed YYYY-MM-DD

On a blocked export:

> This generated CSS fails the bundled AO3 checks. That is a generator bug, not
> something you entered.

Keep the blocking behavior. Add the allowlist review date and generator version
to a single config, not scattered JSX.

### 7.6 Sync and pin the AO3 CSS ruleset

Update the canonical list in
[`src/lib/siteSkin/ao3Css.ts`](src/lib/siteSkin/ao3Css.ts) to include
`aspect-ratio`. In the same PR:

1. record the upstream `otwcode/otwarchive` commit and review date beside the
   vendored rules;
2. add a script or fixture-based test that compares the local property and
   shorthand sets with a deliberately refreshed upstream snapshot;
3. make drift output list missing and extra values, not just counts;
4. require human review before changing the vendored list; and
5. run the existing site-skin and AO3 readback tests.

The check may fetch upstream only when a developer explicitly invokes a sync or
audit command. Tests and production builds must remain deterministic and must
not depend on GitHub availability.

## 8. Release 1 — secure image handling

This release preceded growth instrumentation because the key was public at the
original baseline and hosted image export sends the whole rendered scene off-
device.

**Implementation status: 95% — shipped with documented serverless limits.**
The credential is server-only, uploads require explicit action/consent, the
proxy is hardened, CSP is narrowed, and production uploads have been exercised.
The per-IP and daily counters are intentionally warm-instance memory, so they
reset on cold starts. Add a shared durable limiter only when traffic, cost, or
abuse evidence justifies the dependency. Commit evidence: `f20d0bd`.

### 8.1 Server-side upload route

Add `src/pages/api/image-upload.ts`. Change
[`src/lib/imgbb.ts`](src/lib/imgbb.ts) into a same-origin client for that route.

Target flow:

```text
explicit user action
  -> first-use hosted-image disclosure
  -> POST image bytes to /api/image-upload
  -> validate origin, size, declared type, and magic bytes
  -> server posts to ImgBB using IMGBB_API_KEY
  -> return only the public display URL and a fixed provider result shape
```

Requirements:

- use server-only `IMGBB_API_KEY`; remove `NEXT_PUBLIC_IMGBB_API_KEY`;
- rotate the exposed production key after the new route deploys;
- disable the default body parser and enforce a streaming byte limit, or use a
  deliberately selected multipart parser with its own limit;
- allow only PNG, JPEG, WebP, and GIF if all four are actually supported;
- reject SVG regardless of declared MIME type;
- verify magic bytes, not filename or header alone;
- cap selected-file uploads and finished-render uploads separately;
- accept only same-site requests and known production origins;
- use a short provider timeout and bounded retry policy;
- implement a durable rate/budget limit where possible; document that the
  existing in-memory limit resets on serverless cold starts;
- add a daily kill switch or budget threshold;
- never return the provider's raw response or secret;
- never log image bytes, base64, filenames, URLs, or provider deletion tokens;
- return fixed error codes and safe user messages.

Update [`.env.example`](.env.example) and [`netlify.toml`](netlify.toml). Do not
print or commit `.env.local`.

### 8.2 Upload consent UX

[`src/components/ImageUrlInput.tsx`](src/components/ImageUrlInput.tsx) currently
uploads immediately after a file is selected. Change it so the first file stays
local until the user accepts:

> This file will be uploaded to ImgBB and will be publicly accessible to anyone
> with its link. Do not upload private material or images you do not have the
> right to use.

The hosted-scene action needs a more specific disclosure:

> To create AO3 image code, the finished scene image — including its visible
> text — will be uploaded to ImgBB. AO3 links to that hosted file and does not
> keep its own copy. Save a local PNG as a backup.

Remember acknowledgement locally, but keep a short disclosure beside every
hosted action. “Get AO3 image code” itself is the final explicit action; merely
opening the export UI must not upload.

### 8.3 Harden the existing image proxy

Extend [`src/pages/api/image-proxy.ts`](src/pages/api/image-proxy.ts). It already
checks method, origin, HTTPS, several literal private hosts, response MIME, byte
size, and a warm-instance rate limit. It still needs:

- DNS resolution before each request and rejection of private, loopback,
  link-local, multicast, reserved, and metadata-service IP ranges;
- explicit handling of IPv4-mapped IPv6;
- `redirect: 'manual'`, a maximum redirect count, and full validation of every
  redirect target and resolved address;
- rejection of arbitrary ports;
- connection/read timeout with `AbortController`;
- streaming response limits so a missing/false `Content-Length` cannot allocate
  an unbounded buffer;
- magic-byte validation and explicit SVG rejection;
- no raw network exception text returned to the browser;
- no user URL in logs or analytics.

The special Pinterest resolver currently follows redirects and fetches HTML
outside the main safe-fetch path. Either route it through the same validated
redirect/DNS helper or remove the special case until it can be safe. Do not leave
a privileged bypass.

### 8.4 Narrow CSP after upload migration

Once direct browser-to-ImgBB upload is gone, change `connect-src` in
[`next.config.js`](next.config.js) from all HTTPS origins to:

```text
'self' https://www.googletagmanager.com https://www.google-analytics.com
```

Keep broad `img-src https:` only because users may paste remote image addresses.
Broad image loading does not require broad scripts or connections.

Reconcile [`netlify.toml`](netlify.toml) with `next.config.js`; Next's response
headers are the effective source in the current Netlify deployment. Preserve
`frame-ancestors 'none'`, `object-src 'none'`, and `base-uri 'self'`.

### 8.5 Security tests

Extend [`tests/image-proxy.spec.ts`](tests/image-proxy.spec.ts) and add upload
route tests for:

- private IP reached through DNS;
- public URL redirecting to private IP;
- IPv6 and IPv4-mapped IPv6;
- too many redirects;
- missing `Content-Length` with an oversized stream;
- MIME/header mismatch;
- SVG sent as `image/png`;
- timeout;
- foreign origin;
- rate limit;
- provider errors sanitized;
- valid PNG/JPEG/WebP success.

## 9. Release 2 — metadata, domains, and content-safe analytics

**Implementation status: 79% — core code shipped; external closure remains.**
The deployed domain split is the one recorded at the top of this document, not
the original target shown in Section 9.4. Metadata, product config, PWA links,
typed analytics, explicit consent, and privacy-choice reopening are live.
WordPress sitemap/Search Console checks, the WordPress-to-app link, remaining
public-link audit, and an operational dashboard remain. Commit evidence:
`7dc4178`, `4701bb7`, `695a37e`, and `b3c4545`.

### 9.1 One runtime config

Replace the obsolete design-token contents of [`src/lib/brand.ts`](src/lib/brand.ts)
with, or add, a product config that owns:

```ts
export const PRODUCT = {
  name: 'AO3 SkinGen',
  appUrl: 'https://ao3skingen.wordfokus.com',
  hubUrl: 'https://www.wordfokus.com/ao3skingen/',
  madeWithUrl: 'https://www.wordfokus.com/ao3skingen/made-with/',
  supportEmail: 'support@wordfokus.com',
  themeColor: '#7c3aed',
  compatibilityReviewedAt: 'YYYY-MM-DD',
  appVersion: '0.1.0'
} as const;
```

Do not use this client module for secrets. Product URLs, version, PWA metadata,
export credit, and analytics placements should stop having separate hard-coded
opinions.

### 9.2 SSR-visible metadata

The root route currently returns only an `aria-busy` div on the server. The
site-skin route constructs `<Head>`, but returns before it while `isLoaded` is
false. Add route metadata before the hydration gate or include it in every
return branch.

For both application routes add:

- distinct title and description;
- canonical URL on the owned application domain;
- Open Graph/Twitter metadata;
- `robots=noindex,follow` under the recommended split;
- the same theme color and application name as the manifest;
- an SSR-visible product heading or useful loading shell where practical.

Recommended indexing split:

- WordPress hub and guides: `index,follow`;
- interactive app routes: `noindex,follow`;
- no URLs may contain creative content.

If the owner chooses to index app routes instead, render useful crawlable
content server-side. Do not index an empty client shell.

### 9.3 Fix PWA contract and deep links

[`public/manifest.json`](public/manifest.json) uses blue while `_document` uses
violet. Standardize name, short name, description, theme/background colors, and
icons.

The current manifest shortcuts use `?template=twitter` and `?template=ios`, but
the scene route resolves `template` only against example IDs such as
`twitter-character-thread`. Introduce an explicit blank-platform query:

```text
/?platform=twitter
/?platform=ios
```

Reserve `?template=` for catalog template IDs. Validate both through a shared
parser and add tests for valid, invalid, and stale links. Keep creative content
out of URLs.

### 9.4 Domain cutover

This work spans Netlify, DNS, the legacy marketing surface, and WordPress. It is
not a repo-only ticket.

Owner-approved target, deployed during Release 2:

```text
ao3skingen.wordfokus.com/                  public SwipePages landing page
app.ao3skingen.wordfokus.com/              interactive scene app
app.ao3skingen.wordfokus.com/site-skin     site-skin app
www.wordfokus.com/ao3skingen/              additional product/guide hub
www.wordfokus.com/ao3-guides/...           crawlable guides
```

Sequence:

1. Preserve the useful legacy examples and map every card to an existing
   example/template ID.
2. Keep the public landing on `ao3skingen.wordfokus.com` and attach
   `app.ao3skingen.wordfokus.com` to the Netlify app with verified TLS.
3. Replace public Netlify links with the branded application URL only after the
   custom app host works.
4. Keep the verified permanent redirect from the Netlify default hostname to
   the branded application URL unless the hosting architecture changes.
5. Keep the public landing and `www.wordfokus.com/ao3skingen/` useful and
   crawlable. Optional AO3 attribution remains unlinked plain text unless a
   commercial-neutral destination is deliberately maintained.
6. Update privacy, Terms, content policy, manifest, examples, docs, generated
   attribution, and analytics origins.
7. Verify canonical and robots headers with `curl` and Search Console.

The original legacy landing used claims such as “Your Data Never Leaves Your
Browser” and “Used by 1,200+ AO3 Writers.” The owner updated the SwipePages
surface during cutover. Re-audit the live page rather than assuming the checked-
in landing source and CDN copy remain synchronized.

### 9.5 WordPress and sitemap tasks

The Rank Math/sitemap findings are external and must be rechecked in WordPress;
they cannot be fixed from this repository. At the audit date, the product hub and
allowed-CSS reference were both published, indexable, and self-canonical, but
neither appeared in `page-sitemap.xml`. Confirm the pages are enabled for the
correct post type, included in a submitted sitemap, and fetchable in Search
Console. Do not change canonicals that are already correct merely to make a
generic SEO checklist look complete.

Add structured data only on crawlable pages with matching visible content:

- `SoftwareApplication` on the hub;
- `HowTo` on complete installation guides;
- `BreadcrumbList`;
- `Article` on real guides;
- `FAQPage` only when the visible page and current search rules justify it.

Never invent ratings, prices, or user counts.

### 9.6 Analytics implementation

After the trust/security copy is live:

1. add the typed helper from Section 5;
2. remove direct `window.gtag` calls from `ExportPanel`;
3. instrument starts, ready states, copies, completions, and fixed failures;
4. instrument site-skin CSS copy;
5. instrument project/cast file actions after those ship;
6. add route-change page views in the Pages Router if GA does not capture them;
7. implement the owner-approved opt-out/consent behavior without breaking the
   tool when analytics is unavailable.

Do not add product CTAs until their impressions and clicks can be measured
without content.

## 10. Release 3 — backup and an honest publishing handoff

This release adds the highest-value missing capability without changing the
proven renderers.

**Implementation status: 100% — shipped and verified.** Scene and theme
backups, strict import boundaries, automatic pre-replacement backup, character
storage cleanup, fallback preview, transcript, alt workflow, preflight, and the
coordinated publishing handoff are implemented without adding a parallel
renderer. Commit evidence: `5d6478a`.

### 10.1 Versioned project backup

Add `src/lib/projectFile.ts` with a pure serializer,
validator, and migration table.

Scene file:

```json
{
  "format": "ao3skingen-project",
  "schemaVersion": 1,
  "exportedAt": "2026-08-12T00:00:00.000Z",
  "application": {
    "name": "AO3 SkinGen",
    "version": "0.1.0"
  },
  "project": {
    "id": "local-project-id",
    "template": "ios",
    "settings": {},
    "messages": []
  },
  "characterLibrary": []
}
```

Site-skin file:

```json
{
  "format": "ao3skingen-site-theme",
  "schemaVersion": 1,
  "exportedAt": "2026-08-12T00:00:00.000Z",
  "theme": {}
}
```

Requirements:

- local file download and user-selected file input only;
- maximum 2 MB import before parsing;
- exact top-level format and integer schema version;
- explicit allowlists, length limits, enum validation, message-count limits, and
  URL sanitization;
- no `dangerouslySetInnerHTML` from imported values;
- unknown future fields ignored only inside known objects;
- unsupported future schema rejected with a useful message;
- preview summary before replacement: template, message/result count, character
  count, export date, and whether remote image references are present;
- explicit “Replace current project” confirmation;
- automatic backup of the current project before replacement if download can be
  triggered reliably;
- v1 import is replace-only. Do not implement a vague merge operation;
- migrations are pure `vN -> vN+1` functions with fixtures.

Do not call `loadStoredProject()` directly on arbitrary imported JSON. Its
current `...parsed.settings` merge is appropriate for trusted local persistence
recovery, not a strict file boundary.

### 10.2 Canonical local character type cleanup

Before including the library in backup:

- keep one `UniversalCharacter` definition in [`src/lib/schema.ts`](src/lib/schema.ts);
- remove the duplicate interface in [`src/lib/characterBank.ts`](src/lib/characterBank.ts);
- delete or migrate the unused `src/lib/characterCache.ts`;
- remove the unused `settings.universalCharacters` field after a backward-
  compatibility read;
- add a validated character-library storage helper instead of raw
  `JSON.parse(localStorage.getItem(...))` in `index.tsx`;
- cap character count, string lengths, and URL lengths;
- keep `usageCount` and `lastUsed` local-only.

This cleanup is a prerequisite for cast interchange.

### 10.3 Fallback preview

The fallback content exists; expose it.

In the accessible work-skin modal add two preview tabs:

- **Styled** — the existing generated work skin;
- **Without work skin / downloads** — the same exported HTML with generator CSS
  absent, plus a plain-text view built by a deterministic local function.

Do not call the second view an exact EPUB emulator. AO3 conversion can change.
Use copy such as:

> This is the reading order and text your export is designed to preserve when a
> reader hides the work skin or downloads the work.

Reuse the semantics tested in `skin-off.spec.ts`. Do not create a different
transcript algorithm that can drift from exported HTML.

### 10.4 Image alt text and transcript

Add a deterministic local `buildSceneTranscript(project)` and an editable
overall scene-alt field in the hosted-image export flow.

Requirements:

- never send project content to an AI or server to write alt text;
- produce speaker/result order from the same project data as the renderer;
- let the author edit the short alt text;
- offer the full transcript as selectable text and a `.txt` download;
- add per-attachment alt editing to the existing message editor because
  `Attachment.alt` exists but is not currently exposed consistently;
- warn on content images with empty alt; allow intentionally decorative images
  to be marked as such;
- escape alt attributes correctly in generated embed HTML;
- for multi-part hosted images, describe the whole scene and identify part
  order without duplicating a huge transcript into every `alt` attribute.

### 10.5 Preflight status

Do not invent one giant validator. Compose existing checks into a report:

```ts
interface PreflightItem {
  id: string;
  severity: 'block' | 'warn' | 'info';
  status: 'pass' | 'fail';
  message: string;
}
```

Work-skin blocks:

- shared AO3 CSS lint failure;
- generator HTML contract failure;
- missing speaker identity that makes fallback ambiguous.

Warnings:

- empty attachment alt;
- contrast below the chosen threshold;
- remote/expiring image host;
- very long unbroken content or mobile overflow risk;
- no project backup yet.

Site-skin keeps its existing CSS blocks and contrast warnings. Hosted image
keeps remote-host permanence and transcript warnings. A warning must not be
silently promoted to “AO3 rejected this.”

### 10.6 Publishing Kit scope

In this release, “Publishing Kit” means a coordinated handoff UI, not a ZIP.

- Work skin: CSS, HTML, fallback preview/text, preflight, backup action, exact
  AO3 steps.
- Hosted image: embed HTML, short alt text, transcript, local PNG reminder,
  hosting warning.
- Site skin: CSS, validation result, theme backup, exact AO3 steps.

Keep individual copy/download actions. Defer a ZIP archive until analytics or
user research shows that people want it. If a ZIP is later added, generate it
only from these canonical outputs; do not re-render or rebuild them.

No Publishing Kit artifact may contain commercial or donation content.

## 11. Release 4 — neutral cast portability and WorldKonstruct

This is the primary commercial bridge, but it starts with data cleanup and a
neutral useful file.

**Implementation status: 0% — intentionally not started.** Reserved analytics
event types do not count as a cast implementation. Do not write the schema UI,
redirect, or commercial card until the two-way acceptance gate has real input
from WorldKonstruct.

### 11.1 Define what “the cast” means in this app

Potential character sources today:

1. global `UniversalCharacter[]` library;
2. `twitterCharacterPresets` in the current project;
3. iOS/Android group participants;
4. the current contact/group/account identity in settings;
5. per-message custom Twitter identities.

Implement a pure `collectCastCandidates(project, library)` that returns source-
labelled candidates. Do not silently merge every matching display name; two
different characters can share a name.

Suggested matching order for import/export preview only:

1. same stable local ID;
2. same normalized platform handle;
3. same normalized name plus the same avatar URL;
4. otherwise treat as distinct and ask the user.

Before export, show the candidates with checkboxes and let the user correct
names/handles. “Save selected to my character library” should canonicalize scene
identities before interchange.

### 11.2 Neutral schema v1

Agree this contract with WorldKonstruct before writing promotional UI:

```json
{
  "format": "writer-cast-exchange",
  "schemaVersion": 1,
  "exportedAt": "2026-08-12T00:00:00.000Z",
  "source": {
    "application": "AO3 SkinGen",
    "version": "0.1.0"
  },
  "characters": [
    {
      "id": "stable-local-id",
      "name": "Alex Rivers",
      "aliases": ["Alex"],
      "handles": {
        "twitter": "alexrivers"
      },
      "avatarUrl": null,
      "notes": ""
    }
  ]
}
```

Rules:

- dialogue, messages, search results, metrics, and project title are never
  included;
- avatar URLs are excluded by default and require an explicit checkbox;
- local usage counts/timestamps are never included;
- handles are stored without a leading `@`;
- IDs are data identifiers, not analytics identifiers;
- unknown future fields are ignored safely;
- schema/version/size/type/string limits are validated;
- imports show conflicts and never overwrite silently;
- file download/import works without WorldKonstruct or an account;
- publish a short schema document in `docs/`.

JSON is the v1 interchange. Defer CSV until a real consumer asks for it; CSV
cannot round-trip aliases, nested handles, and optional metadata without another
contract.

### 11.3 Two-way acceptance gate

Do not show “See WorldKonstruct” merely because AO3 SkinGen can export JSON.
Release the bridge only when:

- AO3 SkinGen exports and reimports the schema without loss;
- WorldKonstruct imports the same fixture;
- WorldKonstruct exports a fixture AO3 SkinGen imports;
- duplicate/conflict behavior is documented in both products;
- both products share contract fixtures or a versioned schema package;
- the owned redirect destination exists.

### 11.4 Contextual WorldKonstruct card

Show this only after a cast export succeeds:

> **Keep this cast consistent across the whole fic**
>
> Your cast file works on its own. WorldKonstruct is a separate Google Docs
> story-bible tool by the same developer and can import this file.
>
> `[Open WorldKonstruct]`

The useful primary action is already complete: the user owns the cast file.
WorldKonstruct is optional. Use an owned route such as:

```text
/go/worldkonstruct?src=ao3skingen&placement=cast-export-success
```

The redirect may append stable UTM values and log source, placement, timestamp,
and destination. It must not receive the cast file, character count, names,
project ID, or a complete referrer query.

### 11.5 WordFokus and Ko-fi

Do not place WordFokus in the cast flow. Show it only after a drafting action
exists, for example “Start another scene” or a writing-workflow guide:

> **Drafting the chapters between the messages?**
>
> WordFokus is a separate Google Docs add-on for focused drafting sessions.

Ko-fi may return later after repeated completed handoffs, never in the same
completion panel as WorldKonstruct, WordFokus, an email signup, or a backup
warning.

## 12. Compatibility and accessibility program

**Program status: active and partially covered, not separately percentage-
scored.** The existing deterministic AO3, readback, skin-off, mobile, alt, and
layout suites are strong. A maintained compatibility ledger, representative
AO3 Default/Reversi/Low Vision record, broader RTL/enlarged-text fixtures, and
automated axe coverage remain.

### 12.1 Regression matrix

Extend the current suite rather than starting over. Required coverage:

- all four platforms, single and master skin;
- light/dark variants;
- AO3 paragraph injection/readback;
- work skin disabled;
- exported plain reading order;
- mobile/desktop and enlarged text;
- long names, messages, and unbroken URLs;
- non-Latin and right-to-left fixtures where supported;
- keyboard/focus behavior for every new menu/dialog;
- reduced motion;
- attachment alt and overall scene alt;
- prompt arbitration collisions;
- project and cast migration fixtures.

Add automated axe checks to the app UI where practical. Keep semantic assertions
for generated work content; an axe pass alone does not prove readable fallback
order.

### 12.2 AO3 themes

Test representative work output against AO3 Default, Reversi, and Low Vision
fixtures. Classify results as:

- pass;
- warning with known interaction;
- unsupported combination.

Do not promise compatibility forever. Every public compatibility claim needs a
generator version and test date.

### 12.3 Compatibility ledger

Start with a maintained Markdown ledger before building an observatory product:

```text
Date tested
Generator commit/version
AO3 behavior observed
Template/output
AO3 site skin
Browser/device class
Skins enabled/disabled
Pass/warn/fail
Known workaround
Fixture/test link
Retest date
```

Link it to the existing AO3 knowledge and work-skin implementation docs. Do not
collect user dialogue to build the ledger.

Later, an opt-in diagnostic report may send only rule IDs, generator version,
output type, broad environment class, and fixed errors. Show the exact payload
before sending.

### 12.4 Ruleset maintenance

Use the single vendored allowlist from Section 7.6 for both work-skin and
site-skin validation. On every scheduled compatibility review:

1. compare against a named upstream `otwcode/otwarchive` commit;
2. inspect every added, removed, or renamed property and shorthand;
3. update the review date only when the comparison actually ran;
4. run generated-output lint plus the AO3 save/readback fixtures; and
5. add the result to the compatibility ledger.

An upstream allowlist match is necessary but not sufficient: AO3 sanitization,
HTML transformation, browser behavior, and site skins can still affect output.

## 13. Search, distribution, and audience work

These tasks follow the application foundation. They are mostly owner/content
work, not reasons to expand the app editor.

**Program status: not scored as engineering completion.** Draft content and
WordPress-ready artifacts exist in the working tree, but publication, sitemap
inclusion, Search Console validation, community distribution, and any email
program are owner/operations work and require current external verification.

### 13.1 Content priorities

Build on [`docs/AO3-CONTENT-PLAN.md`](docs/AO3-CONTENT-PLAN.md) and existing
WordPress-ready articles. Prioritize problems the app demonstrably solves:

1. Work skin versus site skin
2. How to apply and merge AO3 work skins
3. Why AO3 rejected CSS
4. Screenshot versus accessible real text
5. What readers see with creator styles disabled
6. What happens in AO3 downloads
7. Why a hosted image disappeared
8. Accessible social-media AUs
9. Mobile testing for work skins
10. AO3 site-skin contrast and readability

Each guide must provide complete native value, link to official AO3 material,
and use one relevant starter template. Do not write thin pages for every keyword.

### 13.2 Safe starter links and style sharing

Deep links may contain only catalog IDs and non-sensitive style settings. Never
put dialogue, names, handles, image URLs, project IDs, or notes in a URL.

A later `.ao3style.json` may include template, colors, layout, and typography
while excluding creative content. Validate it with the same import boundary as
project files.

Defer public template submission until moderation, reporting, licensing, and
compatibility-versioning capacity exists.

### 13.3 Community distribution

Useful native topics:

- styled versus work-skin-disabled comparison;
- image versus real-text comparison;
- an AO3 CSS rejection and the fix;
- a compatibility update after an AO3 change;
- a complete free recipe/template;
- accessible alt/transcript guidance.

For Reddit, Tumblr, and creator partnerships, disclose ownership and follow each
community's promotion rules. Never ask authors to carry paid-product promotion
into AO3 notes or works.

### 13.4 Compatibility-alert email

Only after the compatibility ledger is maintained, offer a new optional list:

> **AO3 Skin Compatibility Alerts**
>
> At most one email per month when AO3 changes something that may affect
> generated skins, plus major SkinGen updates.

Requirements:

- double opt-in;
- no signup required for any tool or export;
- separate consent for general product marketing;
- source recorded as AO3 SkinGen;
- unsubscribe/export/delete process;
- no prechecked box;
- never shown with a commercial or donation prompt.

Do not import the old dark-mode-confused list.

## 14. Sequenced backlog

### P0 — trust and security

**Progress:** Mostly shipped. Items 1, 5, and 6 retain owner/external closure;
the durable shared limiter is a documented Release 1 follow-up. All other items
have repository implementations and tests.

1. Record owner decisions from Section 6.
2. Add typecheck/test scripts and capture a green baseline.
3. Remove unfinished Pro gating.
4. Replace the generic success modal.
5. Add the intended `LICENSE`, align Terms, and replace the stale public README.
6. Correct privacy and validation copy across every live domain.
7. Separate fiction label from optional tool attribution and remove the current
   hardcoded commercial credit destination.
8. Sync `aspect-ratio`, pin the reviewed AO3 ruleset source, and add a drift check.
9. Add server-side ImgBB upload and rotate the public key.
10. Harden the existing image proxy.
11. Narrow CSP.

Done when:

- no browser bundle contains the ImgBB key;
- upload disclosure precedes the first byte sent;
- no fake purchase/activation path remains;
- privacy copy matches every network path;
- one export action produces at most one completion/next-step surface;
- AO3-bound output contains no commercial request or link to a page with one;
- the local AO3 property/shorthand sets match the recorded upstream snapshot;
- existing work-skin/site-skin/readback tests pass.

### P1 — identity, metadata, and measurement

**Progress:** Core application work shipped. External sitemap/Search Console
verification, the exact branded app link on the WordPress hub, and an
operational weekly dashboard remain; finish the remaining public-link audit
against the deployed three-surface architecture.

1. Add one product config.
2. Add SSR-visible route metadata and chosen robots policy.
3. Fix PWA theme/name/shortcut consistency.
4. Cut over the owned app domain and update public links.
5. Recheck WordPress sitemap/canonical configuration.
6. Add typed analytics and fixed error mapping.
7. Define the weekly AO3-ready handoff dashboard.

Done when:

- both routes expose correct title/description/robots without hydration;
- manifest shortcuts open the intended blank platform;
- no creative content appears in analytics requests;
- every handoff definition is implemented exactly once;
- Netlify, custom domain, hub, privacy, examples, and redirects agree.

### P2 — recoverable and accessible handoff

**Progress:** Complete at `5d6478a`; maintain it through schema migrations and
regression tests.

1. Add versioned scene and site-theme backup/import.
2. Consolidate character types and validate library storage.
3. Add fallback/plain preview to work-skin export.
4. Add deterministic transcript and editable alt text.
5. Add composed preflight status.
6. Add output-specific completion states and backup reminder.

Done when:

- clearing localStorage is no longer the only-copy failure mode;
- a bad import cannot replace current work without preview and confirmation;
- a user can inspect the intended no-skin/download reading order;
- hosted image output has useful alt/transcript support;
- no parallel renderer was introduced.

### P3 — cast bridge

**Progress:** Not started and blocked by the WorldKonstruct contract. Reserved
analytics union members are not implementation progress.

1. Implement and test `collectCastCandidates`.
2. Agree the neutral schema with WorldKonstruct.
3. Add AO3 SkinGen export/import with conflict UI.
4. Pass shared fixtures in both products.
5. Add the cast-export-success WorldKonstruct card.
6. Add owned redirects and content-free attribution events.

Done when:

- the cast file is useful without buying anything;
- dialogue is impossible to include through the schema;
- avatar URLs are opt-in;
- both products round-trip the same fixtures;
- no character data enters redirects or analytics.

### P4 — compound learning and distribution

**Progress:** Owner drafts exist, but the maintained ledger, publishing,
distribution, alerts, and diagnostics program has not been operationalized.

1. Maintain and publish the compatibility ledger.
2. Connect priority guides to valid starter IDs.
3. Add style-only export/import if demanded.
4. Launch compatibility alerts.
5. Add opt-in payload-preview diagnostics only after the ledger process works.
6. Consider a local multi-project library only after backup/return-use data shows
   that one is needed.

## 15. Dashboard and decision rules

Weekly dashboard:

- unique scene-builder and site-skin visitors;
- activation rate by tool/template;
- PNG download-trigger rate;
- hosted-image ready/copy/failure rate;
- work-skin CSS copy, HTML copy, and completed-pair rate;
- site-skin valid-copy rate;
- top fixed error codes;
- fallback-preview usage;
- backup export/import rate;
- cast export/import rate;
- WorldKonstruct eligible impression and click rate;
- WordFokus eligible impression and click rate;
- seven- and thirty-day return rate using privacy-approved aggregation.

Interpret in this order:

1. Low hub-to-app rate: fix the promise and starter links.
2. App opens but low activation: simplify first content creation.
3. Activation but low export start: clarify PNG versus hosted image versus real
   text.
4. Starts but low ready rate: fix render/upload/validation failures.
5. Ready but low copy completion: fix modal instructions and clipboard fallback.
6. Completion but low return: improve backup and resume before building cloud
   accounts.
7. Cast card impressions but few clicks: improve the workflow benefit and
   interchange, not banner prominence.
8. Clicks but no WorldKonstruct activation: fix its landing/import experience
   before increasing promotion.
9. Community resistance: reduce branding and commercial adjacency; do not argue
   users into accepting a funnel.

## 16. Do not build next

Defer:

- AI dialogue or alt-text generation;
- automated real-profile imports or real-person lookup;
- AO3 login, scraping, posting, or browser extension;
- cloud projects/accounts;
- public sharing of dialogue-bearing projects;
- paid template packs;
- watermark-removal paywalls;
- a ZIP dependency before handoff demand is measured;
- CSV cast exchange before a real consumer defines it;
- a multi-project IndexedDB library before local backup ships;
- community submissions before moderation capacity;
- more platform clones before current publishing paths are reliable and
  measured.

## 17. Pull-request checklist

Every implementation PR must include:

- the user-visible problem being solved;
- before/after UI copy or screenshots for visual changes;
- files and canonical functions reused;
- analytics events added, with their exact allowed parameters;
- privacy/network behavior changed;
- migration/backward-compatibility behavior;
- unit and end-to-end tests added;
- confirmation that generated AO3 output contains no commercial CTA;
- for compatibility changes, the exact upstream AO3 commit and allowlist diff;
- `git status --short`, typecheck, build, and relevant test results.

Additional review rules:

- Never edit generator output in a component with string replacements when a
  canonical generator function should own it.
- Never add a second AO3 CSS allowlist.
- Never make preview and export use different site-skin CSS.
- Never parse project/cast imports directly into React state.
- Never send raw errors to analytics.
- Never use message count alone to decide first-visit/returning state; seeded
  defaults contain messages.
- Never reload immediately after edits in a test; auto-save is debounced 500 ms.
- Never add fixed UI without retesting composer occlusion and mobile safe areas.
- Never restore work-skin CSS comments without a real AO3 save/readback check.
- Never make tests or production builds fetch the live AO3 allowlist.

## 18. Final definition of done

The growth implementation is complete when:

- AO3 SkinGen has one coherent owned-domain identity and honest public copy;
- image-host credentials are server-side, rotated, rate-limited, and disclosed;
- remote-image proxying validates DNS, redirects, bytes, size, and timeouts;
- a writer can distinguish local PNG, hosted image code, accessible work skin,
  and site skin before acting;
- the app measures AO3-ready handoffs without claiming to observe publication;
- no analytics payload contains fiction or identity content;
- generated work remains readable with creator styles off and in the intended
  download reading order;
- projects and site themes can be backed up and restored locally;
- image output includes an alt/transcript workflow;
- character data has one validated local model;
- AO3 SkinGen and WorldKonstruct round-trip a neutral cast file before any bridge
  is promoted;
- one contextually relevant next step appears at most once after completion;
- no commercial or donation content travels into AO3-bound output;
- compatibility claims are versioned and dated;
- the vendored AO3 CSS ruleset has a recorded upstream commit and visible drift
  check;
- the existing AO3 regression suite remains green.

At `b3c4545`, the implementation is 72% complete by the release scoring defined
at the top of this document. Releases 0–3 delivered the trust cleanup, secure
image boundary, branded/consented measurement foundation, and recoverable
publishing handoff. The immediate engineering work is the small Release 0 and
Release 2 closure list plus the compatibility ledger—not a speculative cast
bridge. Release 4 begins only after WorldKonstruct can participate in the shared
contract and two-way fixture gate.
