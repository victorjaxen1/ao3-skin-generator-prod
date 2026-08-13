# Twitter Platform Improvement — Implementation Plan

**Prepared:** 13 August 2026

**Scope:** the conversation generator's X / Twitter platform, including the editor, live preview, PNG export, AO3 image-code export, and AO3 work-skin export

**Status:** Proposed; no implementation work has started

**Primary reference:** [Twitter Mobile Workskin Documentation by LittleMissGhostette](https://archiveofourown.org/works/76859551/chapters/201171641)

## 1. Outcome

Turn the current Twitter mockup from a collection of individual tweet cards into a coherent fiction-authoring tool for:

- a single expanded post;
- a chronological timeline containing posts from multiple characters;
- a connected thread with roots, replies, and reply context;
- quote posts, media grids, polls, translations, account labels, and activity context;
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

## 5. Target authoring experience

### 5.1 Top-level Twitter settings

The primary settings surface should contain only scene-wide presentation:

- Scene mode: Single post / Timeline / Thread.
- Theme: Light / Dim / Dark.
- Show metrics.
- Default timestamp format or automatic timestamp behavior.
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
- Do not add custom properties, `var()`, bare `gap`, or `@media` to work-skin CSS.
- Keep layout dimensions in em except intentional hairlines and shadows.
- Prefer float/inline-block where real AO3 injection has already shown Twitter flex layouts to be fragile.
- All remote image sources are absolute HTTPS URLs.
- Every image has intrinsic width/height and meaningful alt text, or explicitly empty alt text when decorative.
- Chronological reading order in the DOM must match the visual order.
- Skin-off text must say who posted, who replied to whom, what an activity means, poll options/results, and which text is a translation.
- Do not use color alone for verified state, poll winners, activity type, or selected options.
- Decorative chrome should not be announced by screen readers.

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

Export QA must cover browser color emoji, verified badges, nested quotes, media grids, poll bars, connectors, and all three themes. Any html2canvas-only adjustment belongs in the export clone and must have a visual regression test explaining why it exists.

## 12. Implementation phases

### Phase 0 — Foundation and real thread authoring

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

1. Add scene mode, theme, post layout, and reply-handle modes.
2. Add normalization and relationship validation helpers.
3. Replace Thread mode with the three-mode selector.
4. Add reply/parent controls to ComposeBar and MessageTimeline.
5. Derive reply handles and layouts while preserving manual override.
6. Fix timestamp precedence so per-post values are not overwritten by one global string.
7. Update the Character Thread example so every relationship can be recreated through the UI.
8. Preserve preview click-to-edit and identity click behavior.

Acceptance:

- A blank Twitter scene can be changed to Thread mode and authored into a three-post chain involving at least two accounts.
- The main editing section can change any post's parent, replying-to handles, timestamp mode, and layout.
- Account changes propagate to old posts and automatic reply handles.
- Orphans render with a warning; cycles and self-parenting cannot be created or imported.
- Timeline and Single post modes render without thread connectors.
- Preview, Save PNG, hosted AO3 image code, and work-skin HTML all include every post exactly once.

### Phase 1 — Per-post quotes, media grids, and export partitioning

**Goal:** make the most common rich-post structures usable and prevent long threads breaking at export boundaries.

Tasks:

1. Add per-message quote data and editor.
2. Migrate global quote settings to one post.
3. Add the 1–4 image editor and renderer for posts and quotes.
4. Add crop intent with AO3-safe classes.
5. Replace fixed Twitter export chunks with relationship-aware partitions.
6. Add templates for a quote post, a four-image post, and a thread longer than one export chunk.

Acceptance:

- Two posts can contain different quotes.
- Adding a second image immediately changes both the preview and main editing section to a two-image layout.
- All attachment alt text survives project export/import and work-skin generation.
- A reply does not vanish when a long thread is partitioned for hosted export.
- PNG spacing and media borders match Preview at 1× and 2×.

### Phase 2 — Narrative details and dim theme

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

**Goal:** validate the complete workflow against real browsers and AO3.

Tasks:

1. Run mobile authoring tests at 360px and desktop tests at the workspace breakpoint.
2. Test keyboard access, focus return, accessible names, and screen-reader text.
3. Render a visual fixture matrix for every post variant and theme.
4. Save generated HTML/CSS to an AO3 draft, read it back, and compare structure and geometry.
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
- reject cycles, self-parenting, malformed counts, unsafe URLs, and oversized text;
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
- Poll totals and rounding are valid.
- Thread-aware export partitions contain every original message once.

### 14.2 UI tests

- Create a reply from the bottom composer.
- Change its parent in the main editing section.
- Create replies from different character accounts.
- Change an account avatar/handle and observe old posts and derived reply context update.
- Add/reorder/remove four images and edit alt text.
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
| Media | 0, 1 wide, 1 tall, 2, 3, 4 images |
| Extra | open poll, closed poll, original text, translated text |
| Theme | light, dim, dark |
| Output | preview, 1× PNG, 2× PNG, hosted chunks, work skin, skin off |

Do not attempt the full Cartesian product. Use a small set of fixtures that covers every pairwise interaction, plus explicit regressions for thread connectors, quote nesting, and export boundaries.

## 15. Release slices and risk

Ship in independently reversible slices:

1. **Thread authoring and normalization.** Highest user value; no rich cards yet.
2. **Per-post quotes and multi-image media.** Migrates the most misleading global control.
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

Mitigate these through normalization, progressive disclosure, explicit migrations, AO3 readback fixtures, and visual export tests—not by maintaining separate preview and export renderers.

## 16. Deliberate non-goals

- Fetching, importing, or publishing real Twitter/X content.
- Authentication, live metrics, clickable navigation, or interactive feeds.
- Exact reproduction of every current Twitter/X control.
- Ads, promoted posts, trends, direct messages, bookmarks pages, views pages, or Grok.
- Arbitrarily deep visual indentation; deep reply chains should remain readable within the fixed-width card.
- Copying the reference work skin's CSS, markup, or assets.
- Redesigning the shared character library, iMessage, WhatsApp, or Google platforms.

## 17. Definition of done

The Twitter improvement is complete when:

- a user can author a multi-account thread entirely through the UI;
- every post can independently be a post/reply, compact/expanded, quoted, media-bearing, polled, translated, labelled, or activity-contextual where applicable;
- automatic timestamps and reply context are sensible and editable;
- account edits update every old post and live-reference quote/activity occurrence;
- all messages render exactly once even with malformed legacy relationships;
- Preview, PNG, hosted AO3 images, and editable work-skin code agree materially;
- light, dim, and dark themes pass AO3 lint, injection, skin-off, mobile, and visual-export tests;
- existing projects migrate without losing text, identity, media, timestamps, metrics, or relationships;
- the implementation and project-file documentation describe the same schema.
