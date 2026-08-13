# Twitter Platform Improvement — Implementation Plan

**Prepared:** 13 August 2026

**Scope:** the conversation generator's X / Twitter platform, including the editor, live preview, PNG export, AO3 image-code export, and AO3 work-skin export

**Status:** Engineering implementation complete; local release gates pass. A fresh authenticated AO3 save/read-back remains an external release-validation step, not an unfinished code path.

**Primary reference:** [Twitter Mobile Workskin Documentation by LittleMissGhostette](https://archiveofourown.org/works/76859551/chapters/201171641)

**Playable-media references:** the supplied [AO3 Social Media AU Work Skins example](https://archiveofourown.org/collections/ao3_socmed_work_skin/works/47803507), the supplied [YouTube clip](https://www.youtube.com/watch?v=bN8449nalT8), and AO3's official [Posting and Editing FAQ](https://archiveofourown.org/faq/posting-and-editing?language_id=en)

**Implementation result (13 August 2026):** all authoring, schema, migration, rendering, accessibility, PNG, hosted-image, and work-skin work described below is implemented. AO3's dedicated media pipeline is separate from its ordinary Work Text element allowlist: Work Skin HTML now emits an allowlisted YouTube iframe or native direct-file video, while Preview, Save PNG, and ImgBB hosted-scene export deliberately keep the linked poster card. The app never downloads, proxies, or rehosts video files.

### Shipped implementation map

| Area | Source of truth |
| --- | --- |
| Schema and defaults | `src/lib/schema.ts` |
| Migration, relationship normalization, video/poll validation, export partitioning | `src/lib/twitter.ts` |
| Strict backup schema v4 | `src/lib/projectFile.ts` and `docs/PROJECT-FILE-SCHEMA.md` |
| Shared Preview/PNG/work-skin renderer | `src/lib/generator.ts` |
| Rich post authoring | `src/components/TwitterPostExtrasEditor.tsx`, used by both `ComposeBar.tsx` and `MessageTimeline.tsx` |
| Relationship-safe hosted export and html2canvas compatibility fixes | `src/components/ExportPanel.tsx` |
| Three-theme and playable-media master skin | `src/lib/workSkin.ts`, master version 4 |
| Accessible fallback and warnings | `src/lib/transcript.ts` and `src/lib/preflight.ts` |
| Regression evidence | `tests/twitter-model.unit.spec.ts`, `twitter-authoring.spec.ts`, `twitter-raster.spec.ts`, `twitter-hosted-export.spec.ts`, plus the AO3 injection/namespace/master-skin/skin-off suites |

### Final local verification (13 August 2026)

- TypeScript and optimized Next.js production build: pass.
- AO3 CSS allowlist audit: 182 properties and 20 shorthands match the pinned upstream revision; no drift.
- Unit suite: 304 passed; one user-supplied v2 AO3 readback fixture skipped because it cannot validate the new v4 master skin. This includes focused migration and AO3 structured-media regressions.
- Twitter authoring: all seven flows pass on desktop and mobile, including thread editing, four-image reorder/removal, rich narrative cards, consent-gated video, delete/reparent, and 360 px containment.
- AO3 injection, namespace, skin-off, and master-skin computed-geometry suites: pass, including Dim. Structured-media tests separately pin the provider/native player markup because external players are not instantiated in geometry fixtures.
- Real Save PNG at 1× and 2×: pass; downloaded rasters were visually inspected for rich-card overlap and grid geometry.
- Hosted-image export: an 18-post thread produces two uploads with every authored post present exactly once and explicit part context.
- Broad desktop regression: 75 passed. The remaining failures are existing non-Twitter cases: a site-skin backup timeout and an outdated WhatsApp participant-count expectation.

## 1. Outcome

Turn the current Twitter mockup from a collection of individual tweet cards into a coherent fiction-authoring tool for:

- a single expanded post;
- a chronological timeline containing posts from multiple characters;
- a connected thread with roots, replies, and reply context;
- quote posts, media grids, polls, translations, account labels, and activity context;
- playable video posts in editable AO3 HTML, with honest poster-card fallbacks in static exports;
- reliable PNG and AO3 output in light, dim, and dark themes.

The first release must solve authoring, not merely add more renderer options. A user should be able to create a reply and choose what it replies to without editing a project file or starting from an example template.

## 2. What the reference contributes

The reference is a 91-page mobile Twitter work-skin guide with light, dim, and dark variants. Its strongest ideas are structural:

- separate visual treatments for a main/expanded post and compact timeline entries;
- explicit “Replying to” context;
- connected reply sequences and “show replies/show thread” narrative affordances;
- quote posts nested inside posts and replies;
- purpose-built 1-, 2-, 3-, and 4-image layouts;
- activity headers such as “liked” and “retweeted”;
- verified badges and account labels;
- unfinished and finished polls;
- original/translated text states;
- readable output when Creator's Style is disabled.

We should adapt those product ideas, not copy the reference's CSS, markup, wording, or image assets. AO3 SkinGen already has its own renderer, identity model, accessibility rules, export fixes, and namespace contract. The implementation should remain an original Twitter-inspired mockup and acknowledge the reference in developer documentation.

The reference intentionally omits some modern Twitter/X controls. AO3 SkinGen should likewise prioritize fiction-relevant information over reproducing every piece of live-site chrome. Bookmarks and views can remain optional metrics; there is no need to add live navigation, authentication, Grok, ads, or network-backed behavior.

The supplied **Twitter Work Skin Template** is also a useful published-media reference. Its observed read-back contains three native video players and two native audio players backed by direct external files. That observation conflicts with this repository's previously verified Work Text allowlist, which excludes the relevant media elements. Phase 1 must reproduce the result in a new draft and reopen the stored HTML before treating it as a supported capability. We should copy the test method, not its markup or externally hosted assets.

## 3. Current-state audit

### 3.1 What already works

| Capability | Current implementation |
| --- | --- |
| Multiple posting accounts | Messages can reference stable scene characters through `characterId`; edits to an account update old posts at render time. |
| Per-post identity fallback | Legacy `sender`, `avatarUrl`, `twitterHandle`, `verified`, and `useCustomIdentity` fields still render. |
| Thread relationships | `Message.parentId` is read and the generator recursively renders replies. |
| Reply context | `replyToHandles` renders a “Replying to” line. |
| Expanded post | `expandedView` produces a larger post treatment. |
| Engagement | Replies, reposts, likes, views, and bookmarks exist as optional per-message counts. |
| Quote post | A quoted post can render, but it is global project state. |
| Media | One image attachment renders with alternative text support. |
| Themes | Light and dark modes exist. |
| AO3 resilience | Twitter CSS is namespaced, em-sized, linted for AO3, and tested against AO3 paragraph injection and skin-off reading. |
| Export | Preview, PNG, hosted AO3 image code, and editable work-skin code share the generator. |

### 3.2 Confirmed gaps

| Gap | User impact | Priority |
| --- | --- | --- |
| No component writes `parentId`, `replyToHandles`, or `expandedView` | “Thread mode” only works for prebuilt/imported data; users cannot author a thread. | P0 |
| `twitterThreadMode` conflates scene type with connector styling | A timeline, single post, and thread are not presented as distinct authoring choices. | P0 |
| Global `twitterTimestamp` overrides every post timestamp | Posts can unintentionally display the same full timestamp. | P0 |
| Quote settings live at project level | Enabling a quote adds the same quoted post to every message. | P1 |
| Only `attachments[0]` is editable and rendered | 2–4 image posts cannot be created even though project-file validation already accepts four attachments. | P1 |
| No crop/layout intent | AO3-compatible media cannot distinguish a wide image from a tall one without brittle styling. | P1 |
| No video media model | A Twitter video post cannot be authored, and playable AO3 HTML needs different output from a PNG. | P1 |
| No polls, translation, activity headers, or account labels | Common fiction-oriented Twitter story beats require manual workarounds. | P2 |
| Only a dark-mode boolean exists | There is no dim theme, and a boolean cannot represent three themes cleanly. | P2 |
| Thread traversal has no validation | An orphaned parent, self-parent, or cycle can hide a post or recurse indefinitely. | P0 |
| Export chunks are fixed at 15 messages | Hosted image-code export can split a thread in the middle and lose parent context/connectors in the next image. | P1 |
| No dedicated Twitter authoring tests | Existing tests prove generated markup survives AO3, but not that a user can build the state from the UI. | P0 |

## 4. Product decisions

These decisions should be treated as part of the implementation contract.

### 4.1 Three scene modes

Replace the ambiguous Thread mode toggle with a visible scene-mode selector:

1. **Single post** — one expanded focal post. Additional messages are allowed but the UI should recommend Timeline instead.
2. **Timeline** — independent compact posts in authored order.
3. **Thread** — root posts and connected replies, with parent selection available while composing and editing.

Keep `twitterThreadMode` as a legacy input during migration, but stop using it as the canonical setting.

### 4.2 Multiple characters are first-class

A Twitter scene may contain any number of character accounts. Every new post and reply must have an explicit posting-account choice through the existing Accounts workflow. A thread is not limited to one author: a character may reply to another character, and a quote may use either a scene account or a frozen external-account snapshot.

Identity continues to resolve from stable scene character IDs. Do not copy the current display name, handle, avatar, or verification state onto every new post. That would reintroduce the bug where edits fail to update old posts.

### 4.3 Smart defaults remain editable

- New posts receive the next automatic timestamp from the shared message-metadata helper.
- A reply defaults its parent to the most recent visible post.
- “Replying to” handles derive from the selected parent and participants in the reply chain.
- The first post in Single post mode defaults to expanded; timeline entries default to compact.
- Metrics default to hidden when all values are zero.
- All derived values have an **Automatic** option and can be manually overridden.
- Returning a field to Automatic recomputes it from current scene state; it does not preserve stale derived text.

### 4.4 Static fiction output, not a live app clone

The exported work contains no JavaScript. Controls such as “Show replies” or “Translate post” are narrative display elements unless the app can express the state with AO3-safe HTML/CSS. Phase 1 should render the selected state directly. Do not depend on `:has()`, scripts, remote APIs, or live Twitter data.

### 4.5 Playable HTML, honest static fallback

Playable Work Text is a gated research item, not an implementation assumption. The repository's verified sanitizer contract in `docs/WORK-SKIN-IMPLEMENTATION.md` says `video`, `iframe`, `source`, and `track` are not in the Work Text allowlist, while the supplied posted-work readback appears to contain native players. Those claims must be reconciled on a current AO3 draft before Phase 1 promises playback.

Treat video as one structured media object with two deliberate render variants:

- **interactive HTML, only after the gate passes:** a narrowly generated AO3-surviving player;
- **static raster:** poster image, play symbol, duration/title, and source text in Save PNG and hosted AO3 image-code output.

The guaranteed fallback for every output is a linked poster card with title/description text. The app preview should show the poster first and load a third-party player only after explicit user action. Never autoplay, imply that a PNG is playable, or accept arbitrary iframe HTML.

## 5. Target authoring experience

### 5.1 Top-level Twitter settings

The primary settings surface should contain only scene-wide presentation:

- Scene mode: Single post / Timeline / Thread.
- Theme: Light / Dim / Dark.
- Show metrics.
- No project-wide timestamp text field. New posts use the persisted automatic default; each post editor can override or reset it.
- Optional “fictional scene” and attribution controls already shared by all platforms.

Remove the project-wide Quote tweet accordion once per-post quotes have migrated. Quote content belongs to the post editor.

### 5.2 Composer

In Twitter mode, the compose row should expose:

- Posting as: existing account selector.
- Relationship: **New post** or **Reply to…** when the scene is Timeline/Thread.
- Parent context chip when replying, such as `Replying to @casey`.
- Main text field and emoji picker.
- Message options for timestamp, media, quote, poll, translation, and metrics.

Recommended behavior:

- In Thread mode, after a post is sent, keep the new post as the default parent so the user can build a linear chain quickly.
- Let the user change the parent before sending; show account name, handle, text excerpt, and timestamp in the picker.
- In Timeline mode, replies are allowed but connectors are suppressed unless the user changes the scene to Thread.
- In Single post mode, hide the parent control.
- Never silently switch the posting account when the parent changes.

### 5.3 Main editing section

The expanded post editor should be divided into small, named groups rather than one grid of unlabeled fields:

**Post**

- Text.
- Posting account.
- Timestamp: Automatic or custom.
- Layout: Automatic / Expanded / Compact.

**Relationship**

- New post or Reply.
- Parent post selector.
- Replying-to line: Automatic or custom handles.
- A clear warning if the selected parent no longer exists.

**Media and embedded content**

- 1–4 images, each with URL, alt text/decorative choice, reorder, and remove.
- Or one video with a YouTube URL or direct HTTPS media URL, poster, title, duration, description, and optional captions.
- Media crop intent: Automatic / Fill width / Fill height.
- Quote post editor.
- Poll editor.
- Translation editor.

**Engagement and context**

- Replies, reposts, likes, views, bookmarks.
- Activity header.
- Account label.

Only show fields relevant to enabled features. The default editor for a plain post should remain compact.

### 5.4 Timeline affordances

- Indent and connect actual parent/child relationships, not every post after the first.
- Display the selected parent above or beside the relationship controls in the main editor.
- When deleting a parent with replies, require either reparenting its replies or promoting them to top-level posts.
- Dragging/reordering a post changes chronology but not its parent.
- A cycle or self-parent must be impossible to select in the UI and rejected by project-file validation.

## 6. Data model

Prefer additive fields and normalization over a large one-time rewrite.

```ts
export type TwitterSceneMode = 'single' | 'timeline' | 'thread';
export type TwitterTheme = 'light' | 'dim' | 'dark';
export type TwitterPostLayout = 'auto' | 'expanded' | 'compact';
export type TwitterMediaCrop = 'auto' | 'fill-width' | 'fill-height';

export interface TwitterQuotePost {
  characterId?: string;        // live scene identity when selected
  name?: string;               // snapshot fallback/external account
  handle?: string;
  avatarUrl?: string;
  verified?: boolean;
  text: string;
  timestamp?: string;
  attachments?: Attachment[];  // maximum four
}

export interface TwitterVideo {
  source: 'youtube' | 'direct';
  url: string;                  // canonical watch/direct-media URL, never raw HTML
  posterUrl?: string;
  title: string;
  duration?: string;
  description?: string;
  mimeType?: string;            // required for direct media
  captionTrackUrl?: string;
  captionLanguage?: string;
  captionLabel?: string;
}

export interface TwitterPollOption {
  id: string;
  text: string;
  percent?: number;
  votes?: number;
}

export interface TwitterPoll {
  options: TwitterPollOption[]; // two to four
  state: 'open' | 'closed';
  totalVotes?: number;
  timeRemaining?: string;
  finalLabel?: string;
  selectedOptionId?: string;
}

export interface TwitterTranslation {
  languageLabel?: string;
  originalText: string;
  translatedText: string;
  visibleText: 'original' | 'translated';
}

export interface TwitterActivity {
  type: 'liked' | 'reposted';
  actorCharacterIds: string[];
  additionalCount?: number;
}
```

Add to `SkinSettings`:

```ts
twitterSceneMode?: TwitterSceneMode;
twitterTheme?: TwitterTheme;
```

Add to `Message`:

```ts
twitterLayout?: TwitterPostLayout;
twitterReplyHandlesMode?: 'auto' | 'manual';
twitterMediaCrop?: TwitterMediaCrop;
twitterVideo?: TwitterVideo;
twitterQuote?: TwitterQuotePost;
twitterPoll?: TwitterPoll;
twitterTranslation?: TwitterTranslation;
twitterActivity?: TwitterActivity;
twitterAccountLabel?: string;
```

Keep these current fields during the compatibility window:

- `parentId` remains the relationship key. It is already generic enough and avoids a destructive rename.
- `replyToHandles` remains the manual value.
- `expandedView` remains a legacy fallback for `twitterLayout`.
- flat per-post metric fields remain unchanged.
- `twitterDarkMode`, `twitterThreadMode`, and project-wide quote fields remain readable but are no longer written after migration.

Do not add a second Twitter-only character collection. Use `SceneCast.characters` and `characterId` for post, quote, and activity identities.

## 7. Normalization and rendering architecture

### 7.1 Build a view model before producing HTML

Move relationship and derived-value logic out of the string templates. Add `src/lib/twitter.ts` with pure helpers such as:

```ts
normalizeTwitterScene(project): NormalizedTwitterScene
validateTwitterRelationships(messages): TwitterRelationshipIssue[]
deriveReplyHandles(project, message): string[]
resolveTwitterLayout(settings, message, index): 'expanded' | 'compact'
buildTwitterForest(messages): TwitterPostNode[]
getTwitterDescendantIds(messages, parentId): Set<string>
```

`NormalizedTwitterScene` should include ordered roots, ordered children, resolved identities, derived handles, layout, theme, timestamp, and feature cards. Both preview and all export paths then consume the same normalized result through `buildHTML`.

### 7.2 Relationship rules

- Preserve authored order among roots and among siblings.
- Render every message exactly once.
- Treat a missing parent as a top-level post with an editor warning; never silently omit it.
- Reject self-parent and cycles on import.
- Defensively break cycles in rendering so malformed legacy state cannot recurse forever.
- Derive reply handles from the direct parent's resolved identity first; add other participants only when explicitly represented by the chain or manually selected.
- Escape and normalize handles without a leading `@` in stored data.

### 7.3 Post variants

Use one shared post renderer with explicit variants:

- `expanded`: larger body, full timestamp/stat treatment, focal post.
- `compact`: inline identity, compact timestamp, timeline/reply treatment.
- `quote`: nested, non-interactive summary.
- `activity`: compact post preceded by a liked/reposted attribution line.

Avoid maintaining separate unrelated HTML templates for each combination. Feature blocks should compose around one resolved post model.

## 8. AO3 and accessibility contract

Every phase must satisfy these constraints before it can ship:

- CSS remains rooted under `#workskin` and compatible with platform namespacing.
- No JavaScript is required in published work HTML.
- Use AO3-accepted elements; do not emit `button`, `svg`, or unsupported form controls.
- Do not emit iframe/native-media markup until a current posted-work readback proves the exact elements and attributes survive. If that gate passes, construct minimal markup from structured fields rather than preserving pasted HTML.
- Do not add custom properties, `var()`, bare `gap`, or `@media` to work-skin CSS.
- Keep layout dimensions in em except intentional hairlines and shadows.
- Prefer float/inline-block where real AO3 injection has already shown Twitter flex layouts to be fragile.
- All remote image sources are absolute HTTPS URLs.
- All media sources are absolute HTTP(S) URLs; any gated YouTube embed uses the privacy-enhanced HTTPS host, while direct media must pass a CORS preflight.
- Every image has intrinsic width/height and meaningful alt text, or explicitly empty alt text when decorative.
- Chronological reading order in the DOM must match the visual order.
- Skin-off text must say who posted, who replied to whom, what an activity means, poll options/results, and which text is a translation.
- Do not use color alone for verified state, poll winners, activity type, or selected options.
- Decorative chrome should not be announced by screen readers.
- Any gated iframe has a useful title; every video card has a nearby source link and description or transcript, plus caption-track support where the output supports it.
- Do not promise that media which survives Work Text will also survive summaries, notes, Preview, Creator's Style off, or downloaded works. Test each output explicitly.

If new container theme classes are emitted, update `CONTAINER_CLASSES` in `src/lib/workSkin.ts`. If exported class contracts change, bump `MASTER_SKIN_VERSION` and update the master-skin compatibility tests and documentation.

## 9. Media behavior

### 9.1 Image layouts

Support at most four images per post and quote post:

| Count | Layout |
| --- | --- |
| 1 | One full-width rounded media card. |
| 2 | Two equal columns. |
| 3 | One large image beside two stacked images. |
| 4 | Two-by-two grid. |

AO3's available CSS cannot reproduce every live-site crop reliably. Store crop intent and emit explicit layout classes. The preview and PNG can use a more exact crop implementation only if the AO3 work-skin result remains predictably close. Document unavoidable differences instead of hiding them.

### 9.2 Authoring

Replace the single image field in both ComposeBar and MessageTimeline with a reusable `TwitterMediaEditor`:

- add up to four image addresses;
- reorder without recreating attachments;
- edit each alt description/decorative flag;
- choose crop intent;
- show the target grid before saving.

Do not alter the attachment editor used by iMessage or WhatsApp.

### 9.3 Video posts

The first release supports one video per post, mutually exclusive with the 1–4 image grid. A video may be:

- a YouTube watch, short, share, or embed URL, normalized to a canonical video ID and a generated `youtube-nocookie.com/embed/…` URL; or
- a direct HTTPS video file with an explicit MIME type, optional poster, and optional caption track.

The editor accepts structured fields, never provider iframe code. It validates the host, URL scheme, title, duration label, direct-media MIME type, and caption metadata. An invalid or unsupported source remains editable but cannot be exported as a player.

For privacy and predictable authoring, the live editor/preview initially renders the same poster card as PNG. A clearly labelled **Load video preview** action may instantiate the player; changing or closing the post removes that player. No external request is needed merely to open a saved project.

### 9.4 Media output contract

| Output | Video result |
| --- | --- |
| Editable AO3 work-skin HTML | Linked poster card by default; minimal player markup only if the current AO3 readback gate passes. |
| App preview before consent | Static poster card; no third-party player request. |
| App preview after consent | Playable preview when the source permits embedding/CORS. |
| Save PNG / hosted AO3 image code | Static poster, play symbol, title/duration, and optional visible source domain. |
| Skin off / blocked media / download | Adjacent title, description or transcript, and ordinary HTTPS source link remain understandable. |

The HTML and raster renderers must consume the same normalized `TwitterVideo`; only the final media presentation differs. Acceptance requires a posted/read-back draft rather than Preview alone. If AO3 strips the player elements or attributes, editable Work Text ships the linked poster fallback and the interactive variant remains disabled.

## 10. Feature-specific behavior

### 10.1 Quote posts

- Quotes are per message.
- Choosing a scene account creates a live identity reference so later account edits update old quotes.
- Choosing “External account” stores a snapshot.
- Quote text, timestamp, and 0–4 images are editable independently.
- A quote does not become part of the thread relationship tree.

Legacy project-wide quote fields migrate to the first eligible Twitter post only. Never apply a migrated quote to every post.

### 10.2 Polls

- Two options minimum, four maximum.
- Open polls show time remaining and vote count when supplied.
- Closed polls show percentages and a final label.
- Percentages must total 100 after rounding when entered as counts; manual percentages should show an inline validation error if their total is invalid.
- The exported text must remain understandable without bar colors.

### 10.3 Translation

- Store original and translated text plus the state that is visible.
- Phase 2 renders either the original or translated state and a static context label.
- A future enhancement may use AO3-safe disclosure markup after real AO3 readback testing; it is not required for initial delivery.

### 10.4 Activity headers and account labels

- Activity type is liked or reposted.
- Actors should reference scene characters so identity edits propagate.
- Render a bounded list such as “Casey and 2 others liked” rather than every actor.
- Account labels are short text such as “Parody account” and have a conservative length limit.
- Activity does not change post ownership or thread parentage.

## 11. PNG and hosted-image export

The direct Save PNG path renders the full scene and must visually match Preview. The hosted AO3 image-code path currently slices every 15 messages; Twitter needs relationship-aware chunking.

Add `partitionTwitterSceneForExport` with these rules:

- Prefer boundaries between top-level thread trees.
- Keep a root and its immediate reply chain together when the canvas size permits.
- If a long thread must split, repeat a compact context header or root summary at the start of the next chunk and mark it as continuation content for accessibility.
- Never pass a reply-only message subset to `buildHTML` and let it disappear because its parent is outside the chunk.
- Base progress totals on the resulting partitions, not `Math.ceil(messageCount / 15)`.
- Keep the existing fixed chunk behavior for iMessage, WhatsApp, and Google.

Export QA must cover browser color emoji, verified badges, nested quotes, media grids, video poster cards, poll bars, connectors, and all three themes. A player is never instantiated inside an export clone. Any html2canvas-only adjustment belongs in the export clone and must have a visual regression test explaining why it exists.

## 12. Implementation phases

### 12.0 Execution contract after repository audit

The phase list below is a dependency order, not a menu of independent renderer features. The current app has one `SkinProject` state object, one `buildHTML` path shared by Preview and export, a project-scoped cast, and a strict backup-file validator. Implementation must preserve those ownership boundaries:

| Concern | Owner | Rule |
| --- | --- | --- |
| Compatibility and derived Twitter state | `src/lib/twitter.ts` | Pure helpers; components and string templates must not invent separate fallback rules. |
| Persisted author intent | `SkinSettings` and `Message` | Store relationships and explicit overrides; do not store copied account identity. |
| Preview and all output markup | `buildHTML` | Consume the same normalized scene. Export code may partition or rasterize it, but must not reinterpret relationships. |
| Strict backup import | `src/lib/projectFile.ts` | Reject duplicate IDs, missing parents, self-parenting, and cycles with actionable errors. |
| Defensive local/legacy rendering | `normalizeTwitterScene` | Promote invalid relationships to authored-order roots and report issues so every post still renders once. |
| Editor prevention | Compose and timeline editors | Exclude the post itself and all descendants from parent choices. |

Phase 0 is split into reviewable vertical slices:

1. **0A — Relationship foundation:** additive types, migration, validation, normalization, renderer traversal, timestamp precedence, and unit tests.
2. **0B — Authoring:** scene-mode selector, composer relationship row, parent/account/layout/reply-context editing, deletion promotion, and mobile UI tests.
3. **0C — Output hardening:** thread-aware PNG geometry, hosted-export partitioning prerequisites, AO3 injection/skin-off regressions, and documentation.

Implementation checkpoint (13 August 2026):

| Slice | State | Included in the starting implementation |
| --- | --- | --- |
| 0A | Complete | Canonical scene mode, layout/reply modes, idempotent migration, schema v3 backup validation, defensive forest normalization, automatic live reply handles, per-post timestamp precedence, and focused unit coverage. |
| 0B | Complete for the first usable flow | Truly blank Twitter start, scene-mode selector, composer New post/Reply controls, sticky parent in Thread mode, posting-account/layout/parent/reply-handle editing, cycle-safe parent options, confirmed parent deletion with reply promotion, and desktop/mobile browser tests. |
| 0C | Complete | Preview/work-skin/AO3 browser harnesses pass. Real Save PNG is covered at 1× and 2×, including the no-avatar name line and rich-card spacing fixes. Relationship-aware hosted export is exercised with an 18-post thread. Fresh authenticated AO3 read-back remains a release operation. |

Additional decisions discovered during the repository audit:

- `twitterTheme` was introduced with Dim in Phase 2. `twitterDarkMode` remains readable only as a legacy migration input; canonical rendering uses `twitterTheme`, and the v4 master skin carries all three Twitter palettes plus playable-media sizing.
- Automatic post timestamps are calculated when the author creates or resets a post and are then persisted. They must not be recalculated from the wall clock during rendering, because reopening or exporting a story must be deterministic.
- `twitterTimestamp` is a read-only compatibility fallback for old projects. New UI writes per-post `timestamp`; a per-post value always wins.
- Changing scene mode never deletes or rewrites `parentId`. Timeline suppresses connectors but retains reply context, so switching back to Thread is lossless. Single post suppresses relationship controls and auto-expands only its first post.
- Reordering changes chronology only. Deleting a parent requires explicit confirmation and promotes its direct replies unless a later reparenting UI is chosen.
- Phase 0 does not rename `twitterRetweets` or the visible “Retweets” copy. Terminology changes must be handled as a separate compatibility/content decision.

### Phase 0 — Foundation and real thread authoring

**State: complete.**

**Goal:** a user can create, edit, reorder, and export a valid multi-character thread.

Files likely involved:

- `src/lib/schema.ts`
- `src/lib/twitter.ts` (new)
- `src/lib/projectFile.ts`
- `src/lib/storage.ts`
- `src/lib/generator.ts`
- `src/components/ComposeBar.tsx`
- `src/components/MessageTimeline.tsx`
- `src/components/SettingsSheet.tsx`
- `src/lib/examples.ts`
- `tests/twitter-model.unit.spec.ts` (new)
- `tests/twitter-authoring.spec.ts` (new)
- existing work-skin, injection, identity, backup, and preview specs

Tasks:

1. Add scene mode, post layout, and reply-handle modes, followed by the canonical theme migration with Phase 2.
2. Add normalization and relationship validation helpers.
3. Replace Thread mode with the three-mode selector.
4. Add reply/parent controls to ComposeBar and MessageTimeline.
5. Derive reply handles and layouts while preserving manual override.
6. Fix timestamp precedence so per-post values are not overwritten by one global string.
7. Update the Character Thread example so every relationship can be recreated through the UI.
8. Preserve preview click-to-edit and identity click behavior.

Acceptance:

- A blank Twitter scene can be changed to Thread mode and authored into a three-post chain involving at least two accounts.
- The main editing section can change any post's parent, replying-to handles, timestamp value/reset, and layout.
- Account changes propagate to old posts and automatic reply handles.
- Orphans render with a warning; cycles and self-parenting cannot be created or imported.
- Timeline and Single post modes render without thread connectors.
- Preview, Save PNG, hosted AO3 image code, and work-skin HTML all include every post exactly once.

### Phase 1 — Per-post quotes, rich media, and export partitioning

**State: complete.** The AO3 player gate resolved to the static linked-poster branch; unsupported player elements are never emitted.

**Goal:** make the most common rich-post structures usable and prevent long threads breaking at export boundaries.

Tasks:

1. Add per-message quote data and editor.
2. Migrate global quote settings to one post.
3. Add the 1–4 image editor and renderer for posts and quotes.
4. Add crop intent with AO3-safe classes.
5. Add structured one-video authoring, URL normalization, and player/static render variants.
6. Add privacy-gated video preview, direct-media CORS feedback, captions, and textual fallback.
7. Replace fixed Twitter export chunks with relationship-aware partitions.
8. Add templates for a quote post, a four-image post, a rights-safe video post, and a thread longer than one export chunk.

Acceptance:

- Two posts can contain different quotes.
- Adding a second image immediately changes both the preview and main editing section to a two-image layout.
- All attachment alt text survives project export/import and work-skin generation.
- A supported YouTube URL always produces a linked poster card; it produces a privacy-enhanced player in editable Work Text only if the AO3 readback gate passes.
- A direct video always retains its source/description fallback; player output requires compatible HTTPS, MIME, CORS, and a successful AO3 readback gate.
- Arbitrary iframe hosts and raw embed HTML are rejected, and opening a project does not automatically contact the player host.
- A reply does not vanish when a long thread is partitioned for hosted export.
- PNG spacing and media borders match Preview at 1× and 2×.

### Phase 2 — Narrative details and dim theme

**State: complete.**

**Goal:** cover the reference's high-value fiction patterns without recreating the entire live product.

Tasks:

1. Add open and closed polls.
2. Add static translation states.
3. Add liked/reposted activity headers.
4. Add account labels.
5. Add Dim as a third theme and migrate the dark boolean.
6. Update theme namespacing, master-skin version, templates, and documentation.

Acceptance:

- Polls remain understandable in skin-off HTML and pass percentage validation.
- Translation output identifies both language/state and translated content.
- Activity actors update when their scene identities change.
- Light, Dim, and Dark pass color/contrast review and AO3 CSS linting.
- No new feature depends on external chrome images.

### Phase 3 — Polish and release hardening

**State: engineering complete.** Local browser, raster, AO3 injection, lint, skin-off, migration, and build gates are automated. Saving to a real AO3 account is intentionally left as an authenticated release check because it changes external state and requires account authorization.

**Goal:** validate the complete workflow against real browsers and AO3.

Tasks:

1. Run mobile authoring tests at 360px and desktop tests at the workspace breakpoint.
2. Test keyboard access, focus return, accessible names, and screen-reader text.
3. Render a visual fixture matrix for every post variant and theme.
4. Release operation: save generated HTML/CSS to an authenticated AO3 draft, read it back, and compare structure and geometry. Do not block or weaken the safe static fallback while this external check is unavailable.
5. Test Creator's Style off and a downloaded-work approximation.
6. Update user-facing help and the project-file schema documentation.
7. Retire legacy Twitter controls only after migration fixtures are green.

Acceptance:

- The core Twitter flow can be completed without opening Advanced settings.
- No editor control is clipped or occluded at 360px.
- AO3 readback introduces no material overlap, reordering, lost labels, or broken image grid.
- Old saved projects and all three existing Twitter templates still load and render.

## 13. Migration and backward compatibility

### 13.1 In-memory migration

Normalize legacy projects without immediately rewriting stored data:

| Legacy state | Normalized state |
| --- | --- |
| `twitterThreadMode: true` | `twitterSceneMode: 'thread'` |
| `twitterThreadMode: false` with one post | `twitterSceneMode: 'single'` |
| `twitterThreadMode: false` with multiple posts | `twitterSceneMode: 'timeline'` |
| `twitterDarkMode: true` | `twitterTheme: 'dark'` |
| `twitterDarkMode: false` | `twitterTheme: 'light'` |
| `expandedView: true` | `twitterLayout: 'expanded'` |
| Existing `replyToHandles` | manual reply-handle mode |
| Project-wide quote enabled | per-post quote on the first post |
| Existing first attachment | one-image media layout |

If both new and legacy fields exist, the new field wins.

### 13.2 Project files

The project-file validator must:

- validate all new enums and nested structures;
- cap posts at the existing project limit, attachments at four, poll options at four, and activity actors at a reasonable bound;
- validate that parent and identity references exist;
- reject cycles, self-parenting, malformed counts, unsafe URLs, raw embed HTML, unsupported player hosts, and oversized text;
- validate video source type, title, MIME type, poster/caption URLs, and mutual exclusivity with the image grid;
- ignore unknown nested future fields only in accordance with the existing schema policy;
- include fixtures for the current schema version and whichever new version this work introduces.

Update `docs/PROJECT-FILE-SCHEMA.md` in the same phase as the schema change. Do not leave the documented version behind the implementation.

## 14. Test matrix

### 14.1 Unit tests

- Relationship forest preserves authored root/sibling order.
- Missing parents are promoted with a warning.
- Cycles and self-parenting are detected.
- Automatic reply handles update after identity changes.
- Manual reply handles remain unchanged.
- Scene mode/theme/quote migrations are deterministic and idempotent.
- 1–4 media layouts select the correct variant.
- YouTube watch/share/short/embed URLs normalize to the same ID and privacy-enhanced embed URL.
- Arbitrary iframe hosts, raw HTML, non-HTTP(S) sources, and invalid direct-video MIME types fail validation.
- The same video model produces consent-gated editor preview data and a deterministic static poster variant; AO3/export markup contains no player elements.
- Poll totals and rounding are valid.
- Thread-aware export partitions contain every original message once.

### 14.2 UI tests

- Create a reply from the bottom composer.
- Change its parent in the main editing section.
- Create replies from different character accounts.
- Change an account avatar/handle and observe old posts and derived reply context update.
- Add/reorder/remove four images and edit alt text.
- Add a YouTube video, load its preview explicitly, edit its poster/fallback text, and switch back to an image grid.
- Add a direct video and receive actionable CORS/MIME/caption validation feedback.
- Add two distinct per-post quotes.
- Build an open poll, close it, and validate results.
- Switch light/dim/dark without losing data.
- Delete a parent and choose promote/reparent behavior.

### 14.3 Renderer/export matrix

Minimum visual fixtures:

| Dimension | Cases |
| --- | --- |
| Scene | single, timeline, linear thread, branched replies, orphan fallback |
| Layout | compact, expanded, reply, quote, activity |
| Identity | primary, second character, verified, labelled, no avatar |
| Media | 0, 1 wide, 1 tall, 2, 3, 4 images, YouTube video, direct video with captions, missing/blocked poster |
| Extra | open poll, closed poll, original text, translated text |
| Theme | light, dim, dark |
| Output | preview, 1× PNG, 2× PNG, hosted chunks, work skin, skin off |

Do not attempt the full Cartesian product. Use a small set of fixtures that covers every pairwise interaction, plus explicit regressions for thread connectors, quote nesting, and export boundaries.

### 14.4 Browser and raster verification protocol

Follow the proven workflow in `docs/WORK-SKIN-IMPLEMENTATION.md`; legal CSS is necessary but not visual proof.

1. Run the unit suite first for schema, normalization, AO3 lint, element/attribute, and skin-off word checks.
2. Run local browser projects with `UX_BASE_URL=http://localhost:3000`; do not accidentally test the deployed default URL while reviewing local changes.
3. Run `ao3-injection`, `namespace`, `master-skin`, and `skin-off` together. Geometry comparisons must use `stableDiff`, including its render-against-itself stability check.
4. Fulfill image requests with a deterministic 1×1 raster in geometry tests. Do not abort them; a broken-image placeholder changes layout timing and produces false diffs.
5. Read skin-off output with rendered `innerText`, not `textContent` or tag stripping, when judging line breaks and reading order.
6. Exercise the real **Save PNG** action and inspect the downloaded image. A preview screenshot does not cover `renderChunk` or html2canvas-only fixes.
7. Compare a baseline and changed PNG at 1× and 2×, then inspect enlarged difference crops. Cover a long name, a thread reply, an expanded post, metrics, and media—not only the default fixture.
8. Before release, save the CSS and HTML to an AO3 draft, reopen both editors, inspect the stored/cleaned content, render with Creator's Style on and off, and re-open the posted work for edit. Record the date and result in the plan.

Export-clone mutations remain a narrow compatibility layer for demonstrated html2canvas differences. Design changes belong in the shared generator so Preview, PNG, and Work Text do not drift.

## 15. Release slices and risk

Ship in independently reversible slices:

1. **Thread authoring and normalization.** Highest user value; no rich cards yet.
2. **Per-post quotes, multi-image media, and one-video posts.** Migrates the most misleading global control and adds the HTML/static media split.
3. **Thread-aware export.** May ship with slice 2 if needed to keep multi-image/long-thread export safe.
4. **Polls, translations, activity, labels.** Additive narrative components.
5. **Dim theme and final AO3 verification.** Touches shared namespace/version contracts and should not be mixed with the first relationship rewrite.

Primary risks:

- AO3 paragraph injection changing grid/header geometry;
- html2canvas disagreeing with browser layout for emoji, badges, and crop behavior;
- legacy parent references hiding messages;
- a large editor becoming overwhelming on mobile;
- class changes invalidating previously saved master work skins;
- hosted-image chunking separating context from replies.
- third-party player removal, direct-host CORS failures, and AO3 Preview disagreeing with the posted work;
- embeds making network requests or losing their accessible fallback.

Mitigate these through normalization, progressive disclosure, explicit migrations, AO3 readback fixtures, and visual export tests—not by maintaining separate preview and export renderers.

## 16. Deliberate non-goals

- Fetching, importing, or publishing real Twitter/X content.
- Uploading, downloading, transcoding, proxying, or permanently hosting video.
- Arbitrary iframe providers, pasted embed HTML, autoplay, or playback inside PNG/hosted-image exports.
- Authentication, live metrics, clickable navigation, or interactive feeds.
- Exact reproduction of every current Twitter/X control.
- Ads, promoted posts, trends, direct messages, bookmarks pages, views pages, or Grok.
- Arbitrarily deep visual indentation; deep reply chains should remain readable within the fixed-width card.
- Copying the reference work skin's CSS, markup, or assets.
- Redesigning the shared character library, iMessage, WhatsApp, or Google platforms.

## 17. Definition of done

The Twitter improvement is complete when:

- a user can author a multi-account thread entirely through the UI;
- every post can independently be a post/reply, compact/expanded, quoted, image- or video-bearing, polled, translated, labelled, or activity-contextual where applicable;
- automatic timestamps and reply context are sensible and editable;
- account edits update every old post and live-reference quote/activity occurrence;
- all messages render exactly once even with malformed legacy relationships;
- Preview, PNG, hosted AO3 images, and editable work-skin code agree materially, with documented interactive-player versus static-poster behavior;
- video output has privacy-gated preview, description/transcript and source fallbacks, no autoplay, and no unsupported player markup; a future player may ship only after a fresh AO3 readback proves the exact markup survives;
- light, dim, and dark themes pass AO3 lint, injection, skin-off, mobile, and visual-export tests;
- existing projects migrate without losing text, identity, media, timestamps, metrics, or relationships;
- the implementation and project-file documentation describe the same schema.
