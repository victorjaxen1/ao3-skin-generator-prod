# Google Platform Improvement — Detailed Implementation Plan

**Prepared:** 22 August 2026

**Status:** Approved implementation plan; not implemented

**Scope:** the AO3 SkinGen Google platform (`template: 'google'`), including the authoring workspace, live preview, examples, local persistence, project backup/import, PNG export, hosted AO3 image export, editable AO3 Work Text, transcript, preflight, the single-platform work skin, and the master work skin

**Research boundary:** proceed without a user-research phase. This plan is based on the current application, its existing UI and test contracts, and the repository's proven AO3/export constraints. Interviews, surveys, analytics analysis, and usability-study recruitment are not prerequisites for implementation or release.

---

## Handoff — read this first

### The one-line outcome

Turn Google from one flat, lightly branded results list into three focused fiction-writing tools:

1. **Search results** for investigation, exposition, worldbuilding, and unreliable evidence.
2. **Autocomplete** for intent, private thoughts, hesitation, and reveal.
3. **Search history** for chronology, escalation, secrets, and character discovery.

This is not a general Google clone. It is a static scene authoring tool that selects the few search conventions that carry narrative information.

### Release-one capability boundary

Release one includes:

- explicit **Results**, **Autocomplete**, and **History** scene modes;
- active **All** or **News** search surface in Results mode;
- standard web results with modern source metadata;
- news results;
- related searches;
- related questions;
- chronological history entries and date dividers;
- optional “viewed result” detail on a history entry;
- CSS/HTML-drawn Google chrome with no tool-owned image requests;
- honest skin-off, transcript, project-file, local-storage, PNG, hosted-image, and Work Skin support;
- examples that actually demonstrate different narrative jobs.

Do not add maps panels, knowledge panels, shopping, ads, AI Overviews, live search, or every current SERP widget in this release.

### The architectural rule

Create one canonical Google block model, one canonical validator, and one Google extras editor used by both the transient composer draft and committed timeline items. Do not add another collection of independent `googleUrl`, `googleDesc`, and type-specific React states.

### The asset rule

The default Google preview, PNG, and Work Skin must have **zero tool-owned image dependencies**. The wordmark, magnifier, clear control, microphone, Lens/camera outline, active-tab icon, history icon, and default result favicon are ordinary HTML elements styled with CSS.

Author-supplied result thumbnails remain optional external images. They are content, not chrome, and must use the existing attachment description/decorative contract.

### The mode-switch rule

The shared `project.messages` array can represent one Google scene mode at a time. Switching modes while incompatible items exist must use a native confirmation, clear those items in the same project update, and tell the author the action can be undone.

Use copy in this shape:

> Changing to Search history removes 4 search-result items. You can undo this change. Continue?

Do not silently hide old result cards in a backup, and do not reinterpret a result title as a search-history query.

### The browser rule

There are two separate browser workflows:

- Committed Playwright tests use the system Edge browser by default, or Chrome when `UX_CHANNEL=chrome`. They do not require a ChatGPT browser extension.
- Interactive inspection and authenticated AO3 save/read-back use a connected in-app browser or Chrome session. That connection does require the ChatGPT Browser/Computer Use integration.

At the time this plan was prepared, Chrome was running and the ChatGPT browser extension was installed and enabled, but its native-host registration was missing. Do **not** install a different IDE extension. Reinstall the Browser/Computer Use integration from the ChatGPT plugin UI via **Settings → Computer use**, restart Chrome and the IDE session, then connect a fresh browser session.

### Existing defects this work must close

- “Search History” is currently a single search-results page, not history.
- “Research Montage” and “News Articles” have the same data shape and almost the same output as every other Google example.
- News is a hard-coded inactive tab; All is always active.
- The query, suggestions, spelling correction, result title, URL, and description are split across three authoring surfaces.
- Result metadata is too thin to create convincing modern search/news scenes.
- The modern wordmark and every search control depend on local PNGs that Work Skin export rewrites to Publitio.
- `lensIcon` currently points to the magnifier asset, not a Lens icon.
- Autocomplete bolding is applied before sanitization; the server/Work Skin path can escape the generated markup instead of preserving it.
- Google counts are labelled as “messages” in shared workspace UI.
- Fixed hosted-image chunking repeats a search page and resets semantic result numbering without Google-specific context.
- Hiding or replacing the composer for Autocomplete can reintroduce the large unused workspace band previously seen only in Google examples unless the flex layout is tested.

---

## 0. Implementation contract

### 0.1 Keep the internal platform ID

Keep `template: 'google'`, the `google` container class, deep links, analytics template ID, and current platform picker ID. Renaming the internal template to `search` would touch routing, analytics, persistence, examples, CSS namespaces, and exports without improving the authoring experience.

The user-facing picker may describe it as **Google Search scenes**, but existing links such as `?platform=google` and example IDs must remain valid.

### 0.2 One mode, one valid item family

The allowed item kinds are mode-specific:

| Mode | Allowed committed items |
| --- | --- |
| `results` | `web-result`, `news-result`, `related-searches`, `related-questions` |
| `autocomplete` | none; suggestions live in `settings.googleSuggestions` |
| `history` | `history-query`, `history-date` |

`validateGoogleProject` must reject an incompatible item family. The UI must prevent that invalid state by confirming and clearing before the mode changes.

### 0.3 One committed model, one transient draft

Follow the solved iOS/WhatsApp pattern:

- a committed item is a normal `Message` with a `googleBlock` discriminator;
- the composer holds one `Partial<Message>` Google draft plus a ref that always matches it;
- `GoogleBlockExtrasEditor` edits both the composer draft and an existing timeline item;
- `validateGoogleMessage` controls the Add button, strict import, local recovery, timeline errors, and preflight;
- changing block kind clears incompatible fields in one update and confirms first when meaningful data would be lost.

Do not maintain separate validation rules in the composer and project importer.

### 0.4 Story content belongs in the workspace

Move these controls out of Settings:

- scene mode;
- query;
- active surface;
- autocomplete suggestions;
- “Did you mean” toggle and correction text.

Keep these in Settings because they are appearance/flavour rather than the scene's core information:

- engine look (`google`, `google-old`, `naver`);
- show result statistics;
- automatic result count/time overrides;
- generic width, fiction label, attribution, and export settings.

The query must have one authoring control. Remove the second editable query in `WorkspaceHeader`.

### 0.5 Static fiction, not interaction

The output resembles a captured state. Tabs, results, questions, history rows, and icons are not live controls. Do not emit JavaScript, fetch search results, scrape pasted addresses, or make external result links interactive by default.

Displayed result addresses are prose. Fictional domains and incomplete display paths are allowed. Only an optional thumbnail uses a network address.

### 0.6 Existing engine variants are compatibility looks

- Modern Google is the target for all new examples and capabilities.
- Older Google and Naver remain readable for existing projects.
- History always uses the modern Google history treatment; disable the engine selector in History mode and explain why.
- Rich blocks may use the shared result structure under legacy looks. Do not build a separate Naver product in this project.
- Do not remove legacy variants in the same release; that would turn an improvement into a compatibility break.

### 0.7 Completion means every output path

A capability is incomplete if it exists only in the preview or only in JSON. Every in-scope item must work through:

- compose;
- edit, duplicate, reorder, and delete;
- undo/redo;
- local autosave/recovery;
- strict backup round-trip;
- live preview;
- 1x and 2x PNG;
- hosted AO3 image chunks;
- Work Skin HTML/CSS;
- master Work Skin;
- no-skin reading order;
- transcript and default image alt;
- preflight;
- desktop and mobile authoring.

---

## 1. Product outcome and narrative jobs

Google is useful where messaging and social platforms are not. It shows what a character seeks, what information the world offers, and how evidence is framed before anyone speaks.

| Narrative job | Best mode/block | Why it earns its place |
| --- | --- | --- |
| Reveal a private concern | Autocomplete | The incomplete query and suggestions expose intent without dialogue. |
| Show an investigation | Results with web/news blocks | Sources, dates, snippets, and ordering create an evidence trail. |
| Show escalation over time | History | Multiple searches and dates show progression without repeating full SERPs. |
| Establish public events | News surface/news result | Source, recency, headline, and thumbnail make worldbuilding compact. |
| Introduce uncertainty | Related questions | Questions imply gaps, rumours, or competing explanations. |
| Foreshadow later action | Related searches | The surrounding query space suggests what a character may do next. |
| Convey unreliable information | Mixed sources | Site identity and snippets let credible and dubious sources sit together. |

Do not judge the platform by feature count against iMessage, WhatsApp, or Twitter. Its advantage is information structure, not interpersonal reaction mechanics.

---

## 2. Current-state audit

### 2.1 What already works and must be preserved

- One query and a flat ordered result list are editable.
- Result count and timing are deterministic from the query unless overridden.
- Suggestions and “Did you mean” exist as stored settings.
- Modern Google, older Google, and Naver branding variants exist.
- Google has a dedicated authoring test and a real Save PNG test.
- Preview, PNG, hosted image, and Work Skin share `buildHTML`/`buildCSS`.
- Generated Google CSS is `#workskin` scoped and em-sized.
- Google survives the measured AO3 paragraph-injection harness.
- Generated HTML is one line, preventing AO3 from inserting internal `<br>` and `<p>` elements from source newlines.
- Hidden prose identifies the query, tabs, and result boundaries with the skin off.
- The raster clone contains a narrow html2canvas-only query-descender fix.
- Google examples no longer leave the historical blank band above the export bar.

### 2.2 Confirmed product and UX gaps

| Gap | User impact | Priority |
| --- | --- | --- |
| Flat results are the only real scene model | Search history, montage, and autocomplete cannot express their narrative jobs honestly. | P0 |
| Query editable in header and editor card | Duplicate control and unclear information hierarchy. | P0 |
| Suggestions and correction live in Settings | Story content is separated from the scene it changes. | P0 |
| All tab always active | A News example visibly contradicts its content. | P0 |
| Every result is title/URL/description | Sources, dates, breadcrumbs, news identity, and related context are missing. | P1 |
| Modern chrome is image-based | Every default Work Skin depends on Publitio for non-story UI. | P0 |
| Lens icon is a magnifier | Visible fidelity defect and unnecessary asset duplication. | P1 |
| Suggestion emphasis is fragile | Preview and Work Skin can disagree about bold completion text. | P1 |
| Shared UI calls Google items messages | The editor exposes the data model instead of the author's mental model. | P1 |
| Generic 15-item hosted chunks | Long search/history exports can lose chronological/result context. | P1 |
| No Google-specific validator | Import, storage, composer, and preflight cannot enforce the same scene rules. | P0 |

### 2.3 Assets currently owned by the tool

`PLATFORM_ASSETS.google` currently references:

- `/assets/google-logo-long.png`;
- `/assets/google-search-glass.png`;
- `/assets/google-mic-270775.png`;
- `/assets/google-clear-X.png`;
- the magnifier again for `lensIcon`.

A normal modern scene emits the wordmark plus five search/tab images before any suggestion icons. `workSkin.ts` rewrites those local paths to `https://media.publit.io/file/AO3-Skins-App/...`.

The release-one target is zero tool-owned Google `<img>` elements. A configured result thumbnail is the only permitted Google image and its source must come from the author's `attachments` data.

---

## 3. Target authoring experience

### 3.1 Workspace header

For Google, the header becomes a static scene summary rather than another editor:

- primary label: `Search results`, `Autocomplete`, or `Search history`;
- count label: `3 items`, `6 suggestions`, or `5 searches`;
- no inline query input;
- backup and Settings actions remain.

Other platforms retain their existing editable identity behavior.

Add an optional item-label prop to `WorkspaceHeader`; do not rename shared props across the entire app unless the change is mechanical and covered.

### 3.2 `GoogleSceneEditor`

Render this card above the timeline in the scrollable editor column.

Top row:

- three native buttons: **Results**, **Autocomplete**, **History**;
- each uses `aria-pressed` and a visible selected state;
- switching follows the destructive mode-switch contract in §0.2;
- the entire state change occurs in one `setProject` call so one Undo restores it.

Results controls:

- labelled `Search query` input;
- surface selector with **All** and **News** only;
- compact “Search correction” disclosure containing the Did-you-mean toggle and correction field;
- the correction field appears only when enabled;
- helper text explains that result count/time are automatic and can be overridden in Settings.

Autocomplete controls:

- labelled `Partial search query` input;
- labelled multiline suggestions editor, one suggestion per line;
- live count and maximum of 20 persisted suggestions;
- no markup syntax in helper text;
- the renderer automatically bolds the completion suffix when the suggestion begins with the query, case-insensitively;
- no timeline and no bottom composer.

History controls:

- short explanation: “Add searches in chronological order. This is Google search history, not browser visit history.”;
- no global query field;
- timeline and composer remain visible.

### 3.3 Results composer

The default draft is:

```ts
{
  id: 'google-compose-draft',
  sender: '',
  content: '',
  outgoing: false,
  googleBlock: { kind: 'web-result' }
}
```

The compact row provides:

- primary text field with a kind-specific placeholder;
- details button labelled `Result options`;
- Add button labelled by type, such as `Add web result`.

The details tray uses `GoogleBlockExtrasEditor` and begins with the block-kind selector:

- Web result;
- News article;
- Related searches;
- Related questions.

Web result fields:

- title in the primary field, required;
- displayed address, optional;
- site name, optional and derived from address when blank;
- breadcrumb/path, optional;
- published/date text, optional;
- snippet, optional;
- one optional thumbnail with description/decorative control.

News result fields:

- headline in the primary field, required;
- displayed address, optional;
- source, optional and derived from address when blank;
- published/recency text, optional;
- snippet, optional;
- one optional thumbnail with description/decorative control.

Related-search and related-question fields:

- hide/disable the generic primary field and say `Edit the list in Result options`;
- one item per line;
- require at least one nonblank item;
- cap at eight items per block;
- the visible heading is fixed: `Related searches` or `People also ask`.

Switching between web and news retains common metadata and the thumbnail. Switching to or from a related-list type confirms before clearing meaningful incompatible data.

### 3.4 History composer

The details tray offers two kinds:

- **Search entry**;
- **Date divider**.

Search entry:

- query in the primary field, required;
- optional time;
- `Auto` time action using the existing deterministic next-time helper where appropriate;
- optional `Show a viewed result` toggle;
- when enabled: viewed title and displayed address.

Date divider:

- date label in the primary field, required;
- no time or result metadata.

The Add button labels are `Add search` and `Add date divider`.

### 3.5 Existing-item timeline

Reuse the existing card, menu, focus, duplicate, reorder, and delete mechanics. Google-specific collapsed summaries should be:

| Kind | Summary |
| --- | --- |
| web result | derived site/address, then title |
| news result | `News · {source}` then headline |
| related searches | `Related searches · N items` |
| related questions | `People also ask · N questions` |
| history query | time, then query |
| history date | `Date · {label}` |

Expanded editing uses the same `GoogleBlockExtrasEditor` as the composer. Do not retain the old free-standing URL and Description fields after migration.

### 3.6 Empty states

| Mode | Empty state |
| --- | --- |
| Results | `Add the first result or related-search block below.` |
| Autocomplete, no suggestions | `Add suggestions above to create the autocomplete scene.` |
| History | `Add the first search or date divider below.` |

Autocomplete must not reserve the hidden composer's height. At 360 px and desktop widths, the editor/preview area must still reach the export bar with no large empty document band.

### 3.7 Settings after the move

Google Settings contains:

- Search engine look;
- Show results statistics;
- Results count override;
- Search time override;
- shared width, fiction label, attribution, and advanced controls.

When mode is History, disable `Search engine look` with helper text that history uses the modern Google treatment. When mode is Autocomplete, hide or disable result-statistics controls because they render nowhere.

Never show editable state that the selected mode ignores without explaining that it is inactive.

### 3.8 Responsive behavior

- At 360 px, mode buttons remain on one row with short labels.
- Two-column metadata fields collapse to one column.
- The details tray keeps its existing `max-h-[32vh]` scroll ceiling.
- A result thumbnail editor never pushes the Add button below the fixed export bar.
- The mobile preview count uses the mode-aware noun.
- Long queries and source paths truncate in styled chrome but remain complete in the transcript/skin-off output.
- Autocomplete's missing composer does not leave a spacer.

---

## 4. Canonical data model

Add these types to `src/lib/schema.ts`:

```ts
export type GoogleSceneMode = 'results' | 'autocomplete' | 'history';
export type GoogleSearchSurface = 'all' | 'news';

export type GoogleBlock =
  | {
      kind: 'web-result';
      displayUrl?: string;
      siteName?: string;
      breadcrumb?: string;
      published?: string;
      snippet?: string;
    }
  | {
      kind: 'news-result';
      displayUrl?: string;
      source?: string;
      published?: string;
      snippet?: string;
    }
  | {
      kind: 'related-searches';
      items: string[];
    }
  | {
      kind: 'related-questions';
      items: string[];
    }
  | {
      kind: 'history-query';
      viewedTitle?: string;
      viewedUrl?: string;
    }
  | {
      kind: 'history-date';
    };
```

Add to `Message`:

```ts
googleBlock?: GoogleBlock;

/** Legacy v1-v8 fields. Read only during migration; never write for new items. */
googleResultUrl?: string;
googleResultDescription?: string;
```

Add to `SkinSettings`:

```ts
googleSceneMode?: GoogleSceneMode;
googleSearchSurface?: GoogleSearchSurface;
```

Defaults:

```ts
googleSceneMode: 'results',
googleSearchSurface: 'all',
```

### 4.1 Meaning of shared `Message` fields

| Kind | `content` | `timestamp` | `attachments` |
| --- | --- | --- | --- |
| web result | title | unused | zero or one thumbnail |
| news result | headline | unused | zero or one thumbnail |
| related searches | empty | unused | forbidden |
| related questions | empty | unused | forbidden |
| history query | search query | optional time | forbidden |
| history date | date label | unused | forbidden |

For every canonical Google item:

- `sender` is `''`;
- `outgoing` is `false`;
- unrelated iOS, WhatsApp, Twitter, reply, reaction, delivery, and identity fields are absent.

### 4.2 Why `content` remains the primary text

Keeping title/headline/query/date in `Message.content` preserves:

- existing timeline and compose mechanics;
- generic undo/redo signatures;
- activation comparison;
- item focus by ID;
- backup item counting;
- duplication and ordering;
- a meaningful label when a future generic tool inspects the message.

Google-specific structure belongs in `googleBlock`; the shared field should not be replaced by an opaque nested scene object in this release.

### 4.3 Image rule

Use `attachments[0]` for the optional web/news thumbnail. Do not add `thumbnailUrl`, `thumbnailAlt`, and `thumbnailDecorative` to `GoogleBlock`.

This reuses the application's established image security, intrinsic-dimension, alt/decorative, proxy, transcript, and export behavior. `validateGoogleMessage` limits Google attachments to one and forbids them for every other kind.

---

## 5. Google model, normalization, and validation

Create `src/lib/google.ts`. It owns:

- type guards;
- default block creation;
- block labels;
- mode/item compatibility;
- legacy migration;
- storage sanitization helpers;
- site-name derivation;
- suggestion segmentation;
- validation;
- mode-aware item summary;
- hosted-image partition context.

Suggested exports:

```ts
getGoogleSceneMode(project): GoogleSceneMode
getGoogleSearchSurface(project): GoogleSearchSurface
blankGoogleBlock(kind): GoogleBlock
googleMessageLabel(message): string
googleSceneItemSummary(project): { count: number; noun: string }
deriveGoogleSiteLabel(displayUrl): string
googleSuggestionSegments(query, suggestion): { plain: string; strong: string }
validateGoogleMessage(project, message, index): string[]
validateGoogleProject(project): string[]
migrateGoogleProject(project): SkinProject
sanitizeStoredGoogleBlock(value): GoogleBlock | undefined
partitionGoogleSceneForExport(project, size): GoogleExportPartition[]
```

### 5.1 Validation rules

Common:

- a Google message must have a recognized `googleBlock`;
- the kind must be allowed by the current scene mode;
- `sender`/`outgoing` are normalized, not trusted;
- only web/news may have an attachment, and at most one;
- unrelated platform fields are removed during migration/recovery and rejected by canonical validation where practical.

Web/news:

- title/headline: required after trim, maximum 500 characters;
- displayed address: optional, maximum 2,048 characters, treated as text;
- site/source: optional, maximum 100 characters;
- breadcrumb: optional, maximum 300 characters;
- published/recency: optional, maximum 100 characters;
- snippet: optional, maximum 2,000 characters;
- thumbnail: existing safe image-address rules; nondecorative image needs alt text for a clean preflight.

Related lists:

- one to eight nonblank entries;
- each entry maximum 200 characters;
- `content`, timestamp, and attachments must be empty/absent.

History query:

- query required, maximum 500 characters;
- optional time maximum 50 characters;
- viewed title and viewed URL are both optional, but if either is provided require both;
- each viewed field maximum 500/2,048 characters.

History date:

- label required, maximum 100 characters;
- timestamp, attachments, and viewed metadata forbidden.

Scene:

- Results requires a nonblank query to export cleanly;
- Autocomplete requires a nonblank query and at least one nonblank suggestion to export cleanly;
- History requires at least one `history-query`; date dividers alone are not a complete scene;
- result statistics and Did-you-mean content are ignored outside Results mode;
- surface is presentation state and does not forbid a news block on All or a related block on News.

### 5.2 URL policy

Displayed result/history addresses are not links and must be escaped with `sanitizeText`, not `sanitizeUrl`. This deliberately permits fictional addresses such as `daily-planet.test/archive`.

Thumbnail addresses use the existing attachment URL policy. No renderer or editor may fetch a result page to infer its metadata.

### 5.3 Suggestion emphasis

Delete the current `applyBoldMarkup` path for Google suggestions.

For each suggestion:

1. trim and sanitize it as plain text;
2. compare it with the query case-insensitively;
3. when it begins with the query, render the matching prefix normally and the remaining completion inside `<strong>`;
4. otherwise render the whole suggestion normally;
5. never interpret author-entered HTML or markdown.

Unit-test the Node/Work Skin path and browser preview path with the same input so the current sanitization-order disagreement cannot return.

---

## 6. Renderer contract

### 6.1 Extract before expanding

Extract the current Google branch from `buildHTML` into named functions before adding block types:

```ts
buildGoogleHTML(project, renderMode, context)
googleSearchBarHTML(...)
googleTabsHTML(...)
googleBlockHTML(message, project, index, context)
googleHistoryHTML(...)
```

Keep the functions in `generator.ts` for release one unless extraction into a separate renderer makes imports demonstrably cleaner. The model and renderer must remain distinct: `google.ts` normalizes and validates; the renderer emits escaped HTML.

Take a characterization fixture of a current modern Google results example before extraction. Refactoring alone must not change that fixture except where the planned asset/semantic work explicitly changes it.

### 6.2 Root classes

Emit:

```text
chat google google-mode-results google-surface-all
chat google google-mode-results google-surface-news
chat google google-mode-autocomplete
chat google google-mode-history
```

Keep existing `chat` and `google` classes so master-skin namespacing and `CONTAINER_CLASSES` remain correct.

### 6.3 CSS wordmark and icons

Use real nested elements, not pseudo-elements:

- wordmark: text spans for colored letters;
- magnifier: circular border span plus handle span;
- clear: two crossing stroke spans;
- microphone: capsule, stem, and base spans;
- Lens: rounded camera outline and inner circle spans;
- default favicon: neutral circle containing the first safe site/source character;
- history row: reuse the CSS magnifier structure.

Requirements:

- icon wrappers use `aria-hidden="true"`;
- empty nested spans produce no skin-off noise if AO3 removes `aria-hidden`;
- no `::before` or `::after`, because html2canvas does not reliably paint them;
- no inline styles, inline SVG, icon font, data URI, canvas, or remote image;
- no `flex` dependency in Google Work Skin layout;
- no direct-child selector where AO3 can inject a `<p>` between elements;
- use descendant selectors, inline-block, absolute positioning, floats, and `p{display:contents}` only where the existing harness proves them safe;
- every CSS value remains AO3-lint legal and em-sized to at most three decimals.

### 6.4 Results markup

Each result stays on one generated HTML line and includes semantic hidden labels.

Web result order:

1. result boundary/source label;
2. source/site name;
3. displayed path/breadcrumb;
4. title;
5. published metadata;
6. snippet;
7. optional thumbnail with alt text.

News result order:

1. news-result boundary;
2. source;
3. headline;
4. published/recency;
5. snippet;
6. displayed address;
7. optional thumbnail.

Use positioned thumbnail geometry so the image can appear at the right while remaining after the text in skin-off reading order. Add `has-thumbnail` only when a valid attachment exists.

Do not invent `https://example.com` or “Untitled Result” in exported work. Empty fields belong to editor/validation states, not published output.

### 6.5 Related blocks

Related searches render a bordered group with a fixed heading and one CSS magnifier per entry. Related questions render a fixed heading and one row per question with a CSS chevron/expand mark made from real spans.

The marks are static decoration. Hidden prose must introduce the lists so no-skin output reads:

```text
Related searches:
first item
second item
```

and:

```text
People also ask:
first question
second question
```

### 6.6 Autocomplete markup

Autocomplete renders only:

- modern/legacy wordmark as allowed by §0.6;
- search bar;
- suggestions box;
- fiction label/optional attribution outside the platform content as already handled.

It does not render tabs, statistics, Did-you-mean, or `project.messages`.

### 6.7 History markup

History renders:

- CSS wordmark;
- heading `Search history`;
- chronological date dividers;
- query rows with optional time;
- optional nested viewed-result detail.

No global search-results bar, result tabs, result count, or Did-you-mean row appears. Hidden prose explicitly labels dates, searches, and viewed results.

### 6.8 Active surface

Results mode still displays the familiar tab row, but only All and News can be selected in release one. The selected tab receives `active`; All must not remain active in a News scene.

Images, Videos, Maps, and More may remain visible inactive chrome. Do not make them author-selectable until their scene structures exist.

### 6.9 Statistics and correction

- Statistics appear only in Results mode.
- Automatic count/time remains deterministic from the query.
- Overrides remain optional.
- Did-you-mean appears only in Results mode when enabled and nonblank.
- The correction is author text, not a live link.

### 6.10 Preserve one-line HTML

All platform HTML returned from `buildHTML` and `buildWorkSkin` must contain no newline. Source code may use helper functions and concatenation, but the returned string is one line. Keep the existing all-platform regression test.

---

## 7. CSS, AO3, and asset-removal contract

### 7.1 AO3 constraints

Every new Google rule must:

- begin under `#workskin`;
- pass `lintAo3Css(css, 'work')` with zero violations;
- survive the repository's real AO3 core stylesheet and measured paragraph injection;
- avoid grid, gap, object-fit, CSS variables, calc, animation, keyframes, pointer-events, and unsupported selectors/properties;
- use no inline style because AO3 strips it;
- keep literal whitespace between inline semantic children where skin-off prose needs it;
- avoid a backtick anywhere inside `generator.ts` CSS comments because the stylesheet is a template literal.

### 7.2 Asset deletion sequence

After the renderer no longer references `PLATFORM_ASSETS.google`:

1. run `rg` for every Google asset filename and every `PLATFORM_ASSETS.google` access;
2. remove the `google` mapping from `src/lib/platformAssets.ts`;
3. remove the unused `google` group from `src/lib/base64Assets.ts` only after proving there is no consumer;
4. delete the four Google chrome files under `public/assets` only after the filename search is empty outside documentation/history;
5. do not change `workSkin.ts`'s generic asset absolutizer; other platforms still use it;
6. add negative tests for `/assets/google-`, `media.publit.io/file/AO3-Skins-App/google-`, and tool-owned Google `<img>` tags.

Do not delete shared assets or the entire base64 module as part of this feature.

### 7.3 Required asset assertions

- default modern Google HTML contains zero `<img>` elements;
- autocomplete with ten suggestions still contains zero `<img>` elements;
- history contains zero `<img>` elements;
- a web/news result with one author thumbnail contains exactly one `<img>` and its source is the author value;
- Work Skin output contains no Publitio URL for a default Google scene;
- master Work Skin contains no relative Google asset URL;
- PNG visually includes the drawn controls at 1x and 2x.

---

## 8. Persistence, migration, and project files

### 8.1 Schema version

Bump `PROJECT_FILE_SCHEMA_VERSION` from 8 to 9 and update the exported envelope type/name consistently.

Add migration entry `8` and ensure every accepted older version maps through the current normalizers. Do not leave a valid older version without a migration function.

### 8.2 Legacy Google migration

`migrateGoogleProject` is deterministic, idempotent, and only acts when `template === 'google'`.

For each v1-v8 Google message with no `googleBlock`:

```ts
googleBlock: {
  kind: 'web-result',
  displayUrl: message.googleResultUrl || undefined,
  snippet: message.googleResultDescription || undefined,
}
```

Then:

- preserve `id` and `content`;
- set `sender: ''` and `outgoing: false`;
- preserve a valid single attachment only if one already exists;
- remove legacy Google fields from the canonical returned message;
- remove unrelated platform-specific fields;
- default missing `googleSceneMode` to `results`;
- default missing `googleSearchSurface` to `all`;
- preserve query, suggestions, stats, correction, and engine look.

Never infer news from title text, URL domain, or the active News surface. Legacy results migrate to web results only.

### 8.3 Strict project import

Update together:

- setting key allowlists;
- message validation;
- Google block discriminator parsing;
- field length limits;
- v1-v8 migration map;
- v9 create/serialize/parse types;
- remote-image summary;
- item summary labels.

Unknown Google kinds must fail import with a specific invalid-project error. Malformed optional blocks must not be silently reinterpreted.

### 8.4 Local storage recovery

Local storage has no envelope schema version, so update `storage.ts` explicitly:

- sanitize `googleBlock` by discriminator;
- sanitize `googleSceneMode` and `googleSearchSurface`;
- run `migrateGoogleProject` after generic recovery;
- drop an invalid block rather than guessing its kind;
- if a related/date item becomes invalid after sanitization, keep a recoverable empty item only when the editor can show a clear validation error; otherwise drop it and warn in the console;
- ensure non-Google projects do not retain `googleBlock` data through the current `{...m}` spread.

### 8.5 Backup summary

Extend `ProjectFileSummary.itemLabel` and `ProjectBackupDialog` so imported Google scenes read correctly:

- Results: count committed blocks, label `Results/items` as chosen by final UI copy;
- Autocomplete: count nonblank suggestions, label `Suggestions`;
- History: count `history-query` entries, label `Searches`.

Do not show `0 results` for an Autocomplete scene that has eight suggestions.

### 8.6 Deep links and examples

Preserve all existing example IDs. Add only the new Autocomplete example ID to analytics/deep-link allowlists. Old shared links must still instantiate after the schema migration.

---

## 9. Transcript, alt text, activation, and preflight

### 9.1 Transcript

Use a mode-specific platform heading.

Results order:

```text
Google search results
Search: ...
Surface: All/News
Did you mean: ...
Results: About ... (... seconds)

Result 1 — Web
Title
Source: ...
Address: ...
Published: ...
Snippet
[Image: ...]
```

Autocomplete order:

```text
Google autocomplete
Partial search: ...
Suggested searches:
- ...
- ...
```

History order:

```text
Google search history

Date: Today
10:42 PM — how to ...
Viewed: title — address
```

Related blocks receive explicit list headings. Transcript output must never depend on stripping generated HTML.

### 9.2 Default scene alt

Update `defaultSceneAlt`/count language:

- `Fictional Google search results with 4 items.`
- `Fictional Google autocomplete scene with 6 suggestions.`
- `Fictional Google search history with 5 searches.`

Hosted multi-part output continues appending `Part N of M`.

### 9.3 Activation

Replace `ActivationBaseline.googleQuery` with a canonical Google scene signature containing:

- mode;
- query;
- suggestions;
- surface;
- Did-you-mean state/correction;
- message signatures remain in the existing map.

Activation rules:

- Results: nonblank query, at least one valid result/related block, and a change from the seed baseline;
- Autocomplete: nonblank query, at least one nonblank suggestion, and a scene-signature change from baseline;
- History: at least one valid history query and an authored message change;
- merely loading any example never activates the project.

### 9.4 Preflight

Add a Google-only `google-content` check using `validateGoogleProject`.

Blocking failures:

- invalid/missing block discriminator;
- item kind incompatible with mode;
- incomplete viewed-result pair;
- empty related block;
- scene missing its required query/suggestion/history entry.

Warnings:

- web/news result has neither displayed address nor site/source;
- nondecorative thumbnail has no alt (the existing attachment-alt check may own the final message);
- more than ten autocomplete suggestions may make a tall static scene;
- history starts with no date divider only as a gentle warning, never a block.

Do not add a user-facing “Publitio pass” row. Asset independence is an implementation invariant and automated-test responsibility, not author work.

---

## 10. Export behavior

### 10.1 Live preview

The live preview consumes the same HTML/CSS as every export. Do not introduce a React-only Google mockup.

### 10.2 Save PNG

- Save PNG renders the full scene without chunking.
- Keep the current `.search-text` descender padding only if the new search-text box still needs it; prove with a real downloaded PNG before retaining or deleting it.
- The new real-element CSS icons must be visually inspected at 1x and 2x.
- No browser-native control, broken image placeholder, or external chrome request may appear.

### 10.3 Hosted AO3 image export

Add Google-aware partitioning rather than blindly slicing every 15 messages:

- Autocomplete always renders one part.
- Results may split at 15 blocks, but semantic `Result N` labels use the index in `context.sourceMessages`, not a per-chunk reset.
- History should prefer a boundary before a date divider.
- If a history part would begin with a query, prepend a synthetic, export-only copy of the most recent date divider labelled `(continued)`; never mutate the project.
- The visible Google header may repeat on each image part; that is useful context.

The hosted request remains a rendered PNG only. It must never upload author thumbnail source files or include their addresses as multipart fields.

### 10.4 Work Skin

- Work Skin uses real selectable text and CSS-drawn chrome.
- Default Google Work Skin has no external resource dependency.
- An author thumbnail continues loading from its current host and must be described honestly in help/preflight.
- Single-platform and master-skin CSS style identical HTML.
- “Without work skin / downloads” preview reads coherently for all three modes.

### 10.5 Real AO3 read-back

After local output is stable, use a connected, signed-in browser to:

1. create/update a test Work Skin;
2. paste the generated CSS and save;
3. reopen the skin editor and compare stored CSS;
4. paste each mode's Work Text into a draft;
5. view with Creator's Style on and off;
6. download or inspect skin-off reading order;
7. record exact drift or zero drift.

If no authenticated session is connected, mark this one external gate pending. A Playwright AO3 simulation is not a claimed real save/read-back.

---

## 11. Examples and product discovery

Preserve the three existing IDs and change their substance:

| Example ID | New purpose |
| --- | --- |
| `google-search-history` | Real History mode with at least two date dividers, several queries, and one viewed-result detail. |
| `google-research-montage` | Results/All with web results, one news result, related questions, and related searches forming an investigation. |
| `google-news-articles` | Results/News with multiple news blocks, recency/source metadata, and one optional thumbnail. |

Add:

| Example ID | Purpose |
| --- | --- |
| `google-autocomplete-reveal` | Autocomplete mode where a partial query and suggestions create a character reveal. |

Picker labels/descriptions must explain the writing use, not the component:

- Search History — `Show a character's searches changing over time.`
- Research Results — `Build an investigation from sources, snippets, and related questions.`
- News Results — `Stage public events through headlines, sources, and recency.`
- Autocomplete Reveal — `Expose intent through a partial query and suggestions.`

Do not add an example that merely changes the logo or result count.

---

## 12. Exact implementation map

| File | Required work |
| --- | --- |
| `src/lib/schema.ts` | Add Google mode/surface/block types, canonical field, defaults; retain legacy fields for migration only. |
| `src/lib/google.ts` | New canonical defaults, labels, site derivation, suggestion segmentation, validation, migration, storage helpers, summaries, partitioning. |
| `src/lib/generator.ts` | Extract Google renderer; add mode/block rendering; replace chrome images with real HTML/CSS; remove legacy suggestion formatting. |
| `src/components/GoogleSceneEditor.tsx` | New mode/query/surface/suggestions/correction workspace editor and destructive-switch confirmation. |
| `src/components/GoogleBlockExtrasEditor.tsx` | New shared composer/timeline block editor with type-specific fields and validation display. |
| `src/components/ComposeBar.tsx` | Replace `googleUrl/googleDesc` state with one Google draft; hide entirely for Autocomplete; use canonical validator. |
| `src/components/MessageTimeline.tsx` | Mode-specific Google summaries, empty states, expanded extras editor; remove legacy URL/Description inputs. |
| `src/components/WorkspaceHeader.tsx` | Static Google mode title, mode-aware item noun, no duplicate query editor. |
| `src/components/SettingsSheet.tsx` | Remove story controls; keep look/stats overrides; disable irrelevant controls by mode. |
| `src/components/ProjectBackupDialog.tsx` | Render mode-aware item label/count. |
| `src/components/PlatformPicker.tsx` | Update descriptions and add autocomplete example label. |
| `src/components/ExportPanel.tsx` | Google-aware hosted partitioning/context; review descender compensation; mode-aware alt/count text. |
| `src/pages/index.tsx` | Mount scene editor; coordinate mode switch as one state update; hide composer only for autocomplete; pass correct header/preview counts. |
| `src/lib/projectFile.ts` | Schema v9, Google block parser, settings keys, migration entry, summaries, remote thumbnail accounting. |
| `src/lib/storage.ts` | Sanitize/recover/migrate Google blocks/settings and strip cross-platform leakage. |
| `src/lib/activation.ts` | Mode-aware Google baseline and activation rules. |
| `src/lib/transcript.ts` | Mode/block transcript and mode-aware default alt/count. |
| `src/lib/preflight.ts` | Google validator check and applicable warnings. |
| `src/lib/examples.ts` | Convert three examples and add autocomplete example. |
| `src/lib/analytics.ts` | Allowlist the new example ID only; keep `google` template ID. |
| `src/lib/platformAssets.ts` | Remove Google mapping after zero consumers. |
| `src/lib/base64Assets.ts` | Remove only the unused Google group after search proof. |
| `src/lib/workSkin.ts` | Usually no logic change; retain generic absolutizers for other platforms and verify Google has nothing to rewrite. |
| `public/assets/google-*` | Delete only after zero-consumer proof. |

Avoid unrelated refactors in identity, other platform renderers, or the export modal.

---

## 13. Implementation sequence

### Phase 0 — Characterize and create failing tests

1. Capture current modern Google Results HTML/CSS fixture.
2. Add a v8 Google backup fixture using `googleResultUrl/Description`.
3. Pin current stats, Did-you-mean, skin-off labels, injection geometry, query raster compensation, and example workspace height.
4. Add failing model tests for the new modes and blocks.
5. Add failing asset tests requiring zero default Google images/Publitio URLs.
6. Make no product change until characterization is committed and reviewed.

Exit: current behavior is reproducible, and new-contract tests fail for the expected missing capability.

### Phase 1 — Model, validation, and migration

1. Add schema types/defaults.
2. Implement `google.ts` defaults, guards, validation, summaries, and migration.
3. Bump project schema to v9 and add every migration entry.
4. Update strict import and local storage.
5. Add round-trip, malformed-data, idempotence, cross-platform isolation, and v8 migration tests.

Exit: all model/project/storage unit tests pass; renderer still supports migrated web results.

### Phase 2 — Extract renderer and remove chrome assets

1. Extract `buildGoogleHTML` without changing output.
2. Replace wordmark and controls with real HTML/CSS.
3. Fix suggestion segmentation/sanitization.
4. Add root mode/surface classes.
5. Delete Google asset mappings/files only after search proof.
6. Run AO3 CSS lint, namespace, master-skin, skin-off, and injection tests before adding rich blocks.
7. Download and inspect a baseline 1x/2x PNG.

Exit: current Results scene is asset-independent and visually stable across preview, PNG, and Work Skin.

### Phase 3 — Scene modes and workspace UX

1. Add `GoogleSceneEditor`.
2. Remove header query editing and move suggestions/correction into the workspace.
3. Implement mode switching as one undoable project update with confirmation.
4. Hide timeline/composer for Autocomplete without reserving height.
5. Add History date/query authoring.
6. Update count nouns, empty states, mobile preview labels, and Settings visibility.
7. Extend desktop/mobile authoring tests and the Google blank-space regression.

Exit: all three scene modes can be authored, switched safely, undone, saved, and reloaded.

### Phase 4 — Results and news blocks

1. Add `GoogleBlockExtrasEditor` to composer and timeline.
2. Add web/news metadata and optional one-image thumbnail.
3. Add related-search and related-question list blocks.
4. Implement All/News active surface.
5. Add renderer and validation tests for every field and incompatible switch.

Exit: Results mode supports the release-one block set end to end.

### Phase 5 — Transcript, preflight, examples, and hosted partitioning

1. Add mode/block transcripts and alt/count copy.
2. Add Google preflight validation/warnings.
3. Rewrite three examples and add autocomplete example.
4. Add Google-aware hosted-image partitioning and continuation dates.
5. Update analytics/deep-link/example catalogs and backup summaries.

Exit: discovery and every export/accessibility path agree with the editor.

### Phase 6 — Release verification

1. Run typecheck, unit, build, desktop, mobile, raster, namespace, master-skin, injection, skin-off, and workspace layout gates.
2. Inspect real 1x and 2x PNGs for every mode.
3. Verify default Google generates no image/network request.
4. Verify one optional author thumbnail and its failure warning.
5. Run a real AO3 save/read-back when a signed-in browser is connected.
6. Review the final diff for unrelated platform changes.

Exit: all acceptance criteria in §17 are evidenced or the authenticated AO3-only gate is explicitly recorded as pending.

---

## 14. Required automated tests

### 14.1 New model suite — `tests/google-model.unit.spec.ts`

Cover:

- defaults resolve to Results/All;
- every block kind validates in its allowed mode;
- incompatible mode/kind fails;
- optional field length limits;
- one-thumbnail rule;
- related list normalization and limits;
- history viewed-title/address pairing;
- scene completeness by mode;
- plain-text fictional display addresses;
- site-label derivation;
- suggestion prefix/completion segmentation;
- mode-aware item summaries;
- legacy migration is deterministic/idempotent and strips legacy/cross-platform fields;
- Google partitioning continues result numbering and history dates.

### 14.2 New renderer suite — `tests/google-renderer.unit.spec.ts`

Cover:

- one-line HTML;
- root mode/surface classes;
- active All/News tab;
- result/news metadata order and escaping;
- related list headings/items;
- history date/query/viewed-result semantics;
- Autocomplete omits tabs/stats/messages;
- Results omits History chrome;
- History omits query bar/stats;
- no invented placeholder output;
- default output has no `<img>`, `/assets/google-`, Publitio, inline SVG/style, pseudo-element dependency, or unscoped CSS;
- one author thumbnail has size/alt and no extra images;
- suggestion emphasis is identical in Node output.

### 14.3 Project/persistence tests

Update/add:

- v9 round-trip for every kind;
- v8 flat result migration;
- v1-v7 migration still resolves;
- unknown kind rejected;
- malformed list/history metadata rejected;
- local recovery sanitizes and preserves valid blocks;
- local recovery drops invalid discriminators without guessing;
- non-Google project cannot retain `googleBlock`;
- remote-image summary counts only author thumbnails;
- backup summary uses suggestions/searches/items correctly.

### 14.4 Authoring E2E — `tests/google-authoring.spec.ts`

Cover desktop and 360 px:

- one query input only;
- create/edit/duplicate/move/delete web result;
- switch web/news and preserve common fields;
- add related searches/questions;
- select News and see News active;
- create history date/query/viewed result;
- create autocomplete query/suggestions with no composer;
- mode switch confirmation cancel/continue;
- Undo restores cleared items and mode;
- settings hide/disable irrelevant controls;
- header and mobile preview use correct nouns;
- no horizontal document overflow;
- no blank band above export bar in all modes.

Use `.locator('#workskin').first()` because the page renders desktop and mobile previews.

### 14.5 Shared AO3 browser suites

Extend:

- `tests/skin-off.spec.ts` for all three modes and every block;
- `tests/ao3-injection.spec.ts` with load-bearing result metadata, related rows, autocomplete icons, and history rows;
- `tests/namespace.spec.ts` for new mode/surface selectors;
- `tests/master-skin.spec.ts` for byte-identical namespaced Google CSS and no leakage;
- `tests/work-skin.unit.spec.ts` for zero Google chrome images/Publitio and legal CSS;
- `tests/work-skin.spec.ts` for styled/fallback export UI where needed.

Fulfil image requests with the deterministic 1x1 PNG in geometry tests. Do not abort them; broken-image placeholders change layout timing and previously made identical Google renders differ.

### 14.6 Raster/hosted export — `tests/google-raster.spec.ts`

Cover:

- real Save PNG at 1x and 2x for Results, Autocomplete, and History;
- dimensions are nonzero and long scenes are complete;
- drawn wordmark/magnifier/mic/Lens controls are visible;
- query descenders are not clipped;
- long titles/snippets/source paths are not cut horizontally;
- related rows and history viewed detail do not overlap;
- optional thumbnail is present when proxy succeeds and warning appears when it cannot be converted;
- hosted Results parts continue semantic numbering;
- hosted History parts begin with a real or continuation date;
- request body is PNG only and excludes thumbnail source URLs.

Automated pixel/dimension checks are necessary but insufficient. Inspect the downloaded pictures at 100% zoom.

### 14.7 Activation/examples/transcript/preflight

Update:

- `tests/activation.unit.spec.ts` for each mode and unchanged examples;
- `tests/examples-catalog.unit.spec.ts` for four distinct Google examples;
- `tests/transcript-preflight.unit.spec.ts` for exact mode transcripts, default alt, invalid scenes, and thumbnail warnings;
- analytics/deep-link unit tests for the new example ID.

---

## 15. Playwright and browser-session setup

### 15.1 Local Playwright setup on this repository

Playwright is already a development dependency. The config deliberately uses the system-installed Microsoft Edge because this network blocks downloading Playwright's bundled Chromium. Do not begin with `npx playwright install`.

Terminal 1:

```powershell
npm install
npx next dev -p 3000
```

Terminal 2:

```powershell
$env:UX_BASE_URL = 'http://localhost:3000'
$env:UX_CHANNEL = 'msedge'
npx playwright test --project=unit --workers=1
npx playwright test --project=desktop --workers=1 tests/google-authoring.spec.ts
npx playwright test --project=mobile --workers=1 tests/google-authoring.spec.ts
npx playwright test --project=desktop --workers=1 tests/google-raster.spec.ts
```

Use Chrome instead when needed:

```powershell
$env:UX_CHANNEL = 'chrome'
```

Clean environment variables after the session:

```powershell
Remove-Item Env:UX_BASE_URL -ErrorAction SilentlyContinue
Remove-Item Env:UX_CHANNEL -ErrorAction SilentlyContinue
```

Important:

- Unit tests need no server or browser.
- Browser projects target production when `UX_BASE_URL` is absent. Never claim a local change passed when the command actually exercised production.
- Use `--workers=1` for the heavier suites; parallel contention can look like product timeouts.
- Failure traces/screenshots are retained by config. Review with `npx playwright show-report`.
- Playwright clears `test-results` at a new run; copy a PNG elsewhere before running a comparison pass.
- A preview screenshot is not a Save PNG test. Drive the real export control and inspect the download.

### 15.2 Interactive in-app browser/Chrome session

No additional VS Code/Codex IDE extension is required.

For a connected Chrome session:

1. Open the ChatGPT/Codex application Settings.
2. Open **Computer use**.
3. Install or reinstall the Browser integration and its ChatGPT browser extension.
4. Restart Chrome and the IDE application.
5. Open Chrome using the profile where the extension is enabled.
6. Sign in to AO3 manually if an authenticated read-back is required.
7. Keep the relevant tab open.
8. Start the task with an explicit instruction such as `Use Chrome to inspect http://localhost:3000 and then verify the AO3 draft.`

Never store AO3 credentials in the repository, environment files, fixtures, shell history, or project backups.

The preparation-time diagnostic found:

- Chrome installed and running;
- ChatGPT browser extension installed and enabled in the Default profile;
- native-host manifest/registry registration missing.

The supported remedy is to reinstall the Browser integration from the ChatGPT plugin UI. Do not manually write the native-host registry key or run an internal manifest installer.

### 15.3 Evidence levels

Name the level actually completed:

1. **Unit/AO3 lint:** syntax, model, semantics; no geometry.
2. **Local Playwright browser harness:** real layout with simulated AO3 CSS/injection; no authenticated archive save.
3. **Downloaded PNG inspection:** html2canvas/export clone correctness.
4. **Real AO3 save/read-back:** authenticated archive sanitization and final rendering.

Levels 1–3 do not imply level 4.

---

## 16. Manual visual matrix

Inspect each applicable row in live desktop preview, 360 px preview, 1x PNG, 2x PNG, styled Work Skin preview, and no-skin preview:

| Scene | Desktop | 360 px | 1x | 2x | Work Skin | No skin |
| --- | --- | --- | --- | --- | --- | --- |
| Results/All, one plain web result |  |  |  |  |  |  |
| Results/All, long metadata/snippet |  |  |  |  |  |  |
| Web result with thumbnail |  |  |  |  |  |  |
| Results/News, multiple news blocks |  |  |  |  |  |  |
| Related searches |  |  |  |  |  |  |
| People also ask |  |  |  |  |  |  |
| Did-you-mean and automatic stats |  |  |  |  |  |  |
| Autocomplete, one suggestion |  |  |  |  |  |  |
| Autocomplete, ten suggestions |  |  |  |  |  |  |
| History with two dates |  |  |  |  |  |  |
| History viewed-result detail |  |  |  |  |  |  |
| Older Google compatibility |  |  |  |  |  |  |
| Naver compatibility |  |  |  |  |  |  |
| Long hosted Results/History chunks |  |  |  |  |  |  |

Also verify:

- wordmark proportions are recognizable without pretending to be pixel-perfect;
- mic and Lens are distinguishable;
- no result text collides with a thumbnail;
- result source/title/snippet hierarchy reads at a glance;
- active News is visibly active and All is not;
- history chronology reads top to bottom;
- suggestions align even after AO3 paragraph injection;
- fiction label remains outside content and does not overlap the final row;
- no large blank band appears when Autocomplete removes the composer.

---

## 17. Acceptance criteria

The release is complete when all applicable statements are true:

1. Results, Autocomplete, and History are explicit authoring modes.
2. Mode switches never silently reinterpret or hide incompatible committed items.
3. A cleared mode switch is one undoable project update.
4. Google has one query authoring control, not two.
5. Suggestions and spelling correction are authored beside the scene, not buried in Settings.
6. Results supports web, news, related-search, and related-question blocks.
7. History supports date dividers, timed queries, and optional viewed-result detail.
8. All/News selection changes the visible active tab.
9. Composer and timeline use the same Google block editor and validator.
10. Legacy flat results migrate to canonical web results without guessing news/history.
11. v1-v8 backups import and v9 backups round-trip.
12. Local recovery sanitizes Google data and does not leak it into other platforms.
13. Default Google preview/PNG/Work Skin contains no tool-owned image.
14. Default Google Work Skin contains no Google Publitio URL.
15. Optional author thumbnails use the shared attachment alt/decorative contract.
16. Suggestion emphasis agrees between preview and Work Skin.
17. All generated platform HTML remains one line.
18. All Google CSS remains scoped, em-sized, comment-free after export, and AO3-lint clean.
19. New layouts survive measured AO3 paragraph injection.
20. Single and master Work Skins render the same Google HTML identically.
21. Skin-off output and transcripts clearly identify every query, list, date, source, and viewed result.
22. Preflight blocks invalid mode/item combinations and incomplete required scene content.
23. Workspace header, preview badge, backup summary, transcript, and alt text use mode-appropriate nouns.
24. Autocomplete hides the composer without leaving unused workspace height.
25. Desktop and 360 px authoring have no horizontal page overflow.
26. Real Save PNG works at 1x and 2x for all three modes.
27. Drawn controls appear in PNG and do not rely on pseudo-elements.
28. Hosted Results numbering and History date context survive chunking.
29. The three existing example IDs remain valid and now demonstrate distinct capabilities.
30. The new Autocomplete example is allowlisted in picker, analytics, and deep links.
31. Other platforms' model, renderer, authoring, and export tests remain green.
32. A real AO3 save/read-back is completed, or explicitly recorded as the only external pending gate because no authenticated session was connected.

---

## 18. Explicit non-goals

Do not add in this release:

- live Google queries, scraping, metadata fetch, result import, or account integration;
- browser visit history, open tabs, downloads, or general Google Account activity;
- AI Overviews;
- ads, sponsored results, shopping, flights, hotels, finance, sports, weather, or calculators;
- knowledge panels, maps panels, local packs, video carousels, or full image-search grids;
- selectable Images, Videos, Maps, or More surfaces before their layouts exist;
- dark mode;
- interactive expand/collapse, tabs, links, search boxes, or history deletion inside AO3;
- exact reproduction of one current Google release or dynamic annual UI changes;
- Naver feature parity;
- removal of legacy engine variants;
- automatic favicons or remote site contact;
- author-account authentication;
- a user-research or analytics gate.

Candidate follow-up only after release evidence:

- a compact featured-answer block;
- an image strip using shared attachments;
- selectable Images surface;
- a knowledge panel for character/location dossiers;
- dark mode;
- import helpers that operate only on author-provided structured data, never background scraping.

---

## 19. Developer handoff checklist

- [ ] Read this document fully before editing.
- [ ] Read `docs/WORK-SKIN-IMPLEMENTATION.md` and the handoff/testing sections of the iOS and WhatsApp implementation plans.
- [ ] Confirm the working tree and preserve unrelated user changes.
- [ ] Take characterization fixtures before renderer refactoring.
- [ ] Implement `google.ts` and its tests before UI conditionals.
- [ ] Use one Google draft object and one extras editor.
- [ ] Bump project schema and add migration entry 8.
- [ ] Update local storage separately; project-file migration is not enough.
- [ ] Move story controls out of Settings and remove duplicate header query editing.
- [ ] Make mode switching explicit, destructive only after confirmation, and undoable.
- [ ] Replace every Google chrome image with real HTML/CSS.
- [ ] Prove zero asset consumers before deleting files/mappings.
- [ ] Preserve one-line HTML and skin-off whitespace.
- [ ] Run AO3 lint/injection/namespace/master/skin-off tests after each renderer slice.
- [ ] Use local `UX_BASE_URL`; do not accidentally test production.
- [ ] Run browser suites with one worker for reliable evidence.
- [ ] Drive the real Save PNG control and inspect downloads at 100%.
- [ ] Verify Autocomplete leaves no workspace gap.
- [ ] Reinstall the Browser/Computer Use integration if interactive Chrome remains disconnected; do not install a separate IDE extension.
- [ ] Perform authenticated AO3 read-back only in a connected browser and never persist credentials.
- [ ] Record exactly which evidence levels in §15.3 were completed.
