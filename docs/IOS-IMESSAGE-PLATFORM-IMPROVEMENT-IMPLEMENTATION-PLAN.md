# iOS / iMessage Platform Improvement — Implementation Plan

**Prepared:** 14 August 2026

**Status:** **Implemented and verified locally, 14 August 2026.** Every P0 and P1 item in this document is authorable, rendered, persisted, exported, accessible, and tested. **One gate is open and it needs a real AO3 account** — see "The one thing still open" below.

The plan below (§0–§19) is unchanged and remains the contract. This handoff records what landed, what it cost, and what to do next.

---

## Handoff — read this first

**If you read three things:** "The one thing still open" (it is the only item on a critical path), "The nine things worth knowing" (each cost real time), and "How to verify a change" (the exact commands).

### The one-line summary

iMessage went from a bubble mockup to the same class of authoring tool WhatsApp already was. Both P0 defects named in §2.2 are fixed and pinned by tests. Nothing on the critical path is code any more: what remains is one save on the real archive.

### The one thing still open

**Acceptance criterion 22 — save on real AO3 and read it back.** Everything up to the archive boundary is verified here; nothing in this repository can answer what the sanitizer actually stores. This is the highest-value twenty minutes left in the project: [WORK-SKIN-IMPLEMENTATION.md](./WORK-SKIN-IMPLEMENTATION.md) §8 calls reading the stored CSS back “the single most useful technique in this document”, and it has already settled three separate questions and found one bug nothing else could see.

Do exactly this:

1. Load the **Rich Group Scene** example (`/?template=ios-rich-group-scene`), open the work-skin modal, and copy the CSS — it defaults to **All four platforms**, which is what an author gets.
2. Save it on AO3 under Preferences → Skins → Create Work Skin, then **reopen that skin in AO3's editor and diff the stored CSS against what we emit**. AO3 keeps the *cleaned* stylesheet, so that box is a direct readout of what survived. Check the `ios-*` rules specifically: they are the new class contract.
3. Post the Work Text in a draft chapter and confirm three things a lint cannot: the **YouTube iframe plays**, the **`<audio>` element plays** (the example uses a known CORS-enabled MP3 on archive.org for exactly this reason), and a **direct `<video>` with a `<track>`** plays with captions.
4. Read the same work with **Hide Creator's Style** on. `tests/skin-off.spec.ts` predicts what you should see; if it disagrees, the test is wrong and is worth more than the render.
5. **Save the stored CSS into the repo root as `ao3 master workskin <date>.txt`.**
   `tests/ao3-readback.unit.spec.ts` picks up the newest file matching
   `ao3 master workskin*.txt` and diffs it rule by rule against what we emit.
   It currently **skips** — it prints
   `The newest AO3 readback predates master-skin v7` — because the readbacks in
   the repo are from v6. A skipping test is not a passing one, and this is the
   only thing standing between here and a closed release gate.

If the archive disagrees with us anywhere, **read the stored CSS before theorising**. Two mechanisms inferred from symptoms in this project's history were both wrong, and both were settled in minutes by reading the CSS back.

### Where the code is

Nine files carry the iOS feature. Nothing else needs reading to change it.

| File | What it owns |
| --- | --- |
| `src/lib/ios.ts` | **The model.** Speaker keys, run grouping, validation, Tapback normalization, labels, tones. React-free on purpose — five callers share it, and that is the point |
| `src/lib/generator.ts` | **The markup and the stylesheet.** `iosReplyHTML`, `iosImagesHTML`, `iosLinkPreviewHTML`, `iosMediaHTML`, `iosTapbacksHTML`, `iosEventHTML`, `iosMessageHTML`, `buildIOSHTML`, and `buildIOSCSS`/`iosColours`. **All CSS changes go here** — one stylesheet drives the preview, the PNG and both skins |
| `src/components/IOSMessageExtrasEditor.tsx` | **The authoring UI**, used by the composer *and* the timeline. One editor, one draft model |
| `src/components/ComposeBar.tsx` | The transient iOS draft (`iosDraftMessage` / `updateIOSDraft`) and the send gate |
| `src/components/MessageTimeline.tsx` | Editing committed messages, and `canMoveMessage` — the reply-order guard |
| `src/pages/index.tsx` | `moveKeepsRepliesValid`, reply-aware delete/duplicate, and the delete-confirmation dialog |
| `src/components/ExportPanel.tsx` | `renderChunk` — the **only** place allowed to differ from the shared stylesheet, and only to compensate for html2canvas |
| `src/lib/{schema,storage,projectFile,transcript,preflight,examples}.ts` | Schema v7: types, tolerant recovery, strict import, prose, blockers/warnings, and the rich example |
| `src/lib/workSkin.ts` | `MASTER_SKIN_VERSION`, and the `ios-frame-*` / `ios-scroll` entries in `CONTAINER_CLASSES` |

### The tests, and what only each one can tell you

| Suite | Answers |
| --- | --- |
| `tests/ios-model.unit.spec.ts` | The model in isolation: run boundaries, reply legality, one-primary-content, MIME and caption rules, Tapback normalization |
| `tests/ios-renderer.unit.spec.ts` | The markup contract and the static/`ao3-work` divergence, plus v7 round-trip and cross-platform isolation |
| `tests/ios-characterization.unit.spec.ts` | **A golden of the emitted HTML and CSS.** Refresh with `IOS_CAPTURE=1` and *read the git diff* — that diff is the review |
| `tests/ao3-injection.spec.ts` | Geometry under AO3's `<p>` injection. The lint cannot see any of this |
| `tests/skin-off.spec.ts` | What a download reads with no CSS at all, via `innerText` |
| `tests/ios-authoring.spec.ts` | That the feature is *reachable through the UI* — §0.2's rule that JSON-only is not implemented |
| `tests/ios-raster.spec.ts` | That Save PNG contains the whole conversation and no player chrome |
| `tests/ios-hosted-export.spec.ts` | That ImgBB gets the PNG and nothing else, and that a reply resolves across a chunk boundary |

### The nine things worth knowing before you touch anything

1. **Take the characterization golden before you refactor, not after.** It turned "did the extraction change anything?" into a diff, and it proved both P0 defects on the first run. `IOS_CAPTURE=1 npx playwright test --project=unit tests/ios-characterization.unit.spec.ts` rewrites it — never do that to make a red test green without reading the diff.
2. **`ios-tone-*` sets `color`. It is not a general-purpose tint.** Putting it on the reply blockquote to colour the quote bar turned the quoted *text* red — red on a blue outgoing bubble, unreadable, and visible only in the PNG. The bar has its own `ios-reply-*` classes. If you add a third thing that needs a participant's colour, give it a third class rather than reusing one of these.
3. **Literal whitespace between inline children is load-bearing** ([WORK-SKIN-IMPLEMENTATION.md](./WORK-SKIN-IMPLEMENTATION.md) §4a). The skin-off harness caught four welded readings in one run — `ALAlex`, `Replying to AlexThe side door…`, `Access logRecent entries.`, `0:08Transcript:`. With the skin on these spaces cost nothing, because the elements are block-level and whitespace is ignored between flex items. Add a new span to a card and add the space with it.
4. **Any new flex row needs `p{display:contents}`.** AO3 wraps bare inline children in one paragraph, which then becomes the *only* flex item. Turning on the phone frame in the injection harness caught this live in the new input bar: the placeholder grew 9px because `flex:1` stopped applying to the field. The status bar already had the fix; the input bar needed its own. Use descendant selectors for the margins too — a child combinator is intercepted by the injected paragraph.
5. **html2canvas is not the browser, and only a picture catches it.** Two shipped-quality defects here were invisible to the lint, the injection harness, and 362 unit tests. Export a PNG and look at it, at zoom, whenever you change iOS layout.
6. **The header compensation in `renderChunk` is two fixes, and the second is a measurement problem.** html2canvas mis-centres a two-line flex block *and* paints text low inside its own line box. Widening the band moved the border and left the text cut in exactly the same place, which is what made this take four rounds — the clipping tracks the *line box*, not the container. The fix top-aligns the block and gives the line boxes room. Do not "simplify" it back to a single nudge.
7. **Storage recovery must never guess a media discriminator.** A missing or unrecognised `kind`/`source` drops the whole block. Inferring "this URL looks like YouTube" produces a card the author never wrote, which is worse than an empty message — preflight reports the empty message in plain words.
8. **An empty poster is a signal, not a missing value.** Blank means "derive the YouTube thumbnail". Putting placeholder prose in that field suppresses the thumbnail and renders a broken image. Both the empty case and a malformed-poster case have unit *and* browser assertions, because §7.7 of this document predicted this exact regression and asked for both.
9. **iOS and WhatsApp fields stay separate, deliberately** (§0.1). They look alike and the platforms are not: Apple's are Tapbacks, WhatsApp's are reactions; the run rules and the chrome differ. A shared helper is one refactor away from a shared renderer. `tests/ios-renderer.unit.spec.ts` asserts neither platform's markup can contain the other's class prefix. Where a rule genuinely *is* shared — "a reply comes after its target" — it is parameterised over the pointer (`replyOrderIsValid`, `canMoveReplyAwareMessage`) rather than copied.

### Traps that already cost time here

- **Never put a backtick in `generator.ts`'s CSS**, including inside a comment. The stylesheets are template literals and the build fails with a parse error pointing at the comment. This cost a build during this work, exactly as the older doc warns.
- **`ios-video-player` contains `ios-video-play` as a substring.** An assertion that static output has no play glyph must match the closing quote, or it fails against correct AO3 output. That was a wrong test, not wrong code — check which one is wrong before editing the source.
- **The page renders the scene twice** (desktop preview and mobile preview), so `page.locator('#workskin')` matches two elements. Use `.first()`.
- **Playwright clears `test-results/` at the start of a run**, so copy an exported PNG somewhere else before a second run if you want to compare them.
- **The old `.group-sender-row` wrapper is gone.** It existed only to carry inline flex styles AO3 strips, so it was doing nothing on the archive. Selectors in older tests that reach for it will match nothing and pass vacuously — `ao3-injection.spec.ts` guards against exactly that with a "the test would be vacuous" assertion. Copy that guard when you add a selector-driven test.

### What changed that was not new iOS code

Worth knowing, because a reviewer will ask:

- **`src/components/ReactionPicker.tsx` was deleted.** It was iOS-only and the extras editor replaced it.
- **The composer's `imageUrl` / `imageAlt` / `imageDecorative` / `reaction` state is gone.** It was a second draft model competing with the editor, and whichever wrote last won.
- **`iosHeaderImageUrl` and `iosFooterImageUrl` now default to empty.** They pointed at remote chrome strips, so every published work made permanent requests to a third-party host for decoration the CSS can draw — and AO3 keeps no copy, so the host going down would take the header out of every chapter already posted. They remain as advanced overrides.
- **One work-skin test was rewritten rather than repaired.** `keeps Android's asset urls absolute` asserted a publit.io URL was *present*, which passed only because iOS defaulted its header to a remote strip. No platform emits a relative asset URL any more, so the surviving guarantee is the negative one, now asserted for all four platforms.
- **The legacy single `reaction` string is still rendered** where an existing project carries one, and the transcript still reads it. §0.7 forbids *migrating* it into `iosTapbacks`; it does not require deleting what an author already has.

### How to verify a change

```bash
npm run typecheck
npx playwright test --project=unit                      # 362 tests, ~20s, no browser
npm run build
```

Then the browser suites, which answer what the lint cannot. They point at the deployed site by default, so for local work:

```bash
npx next dev -p 3000
UX_BASE_URL=http://localhost:3000 npx playwright test --project=desktop \
  tests/namespace.spec.ts tests/master-skin.spec.ts tests/skin-off.spec.ts \
  tests/ao3-injection.spec.ts tests/ios-authoring.spec.ts tests/ios-hosted-export.spec.ts
```

The raster suite is slow and CPU-heavy under software rendering; run it when you have touched layout or the export path:

```bash
UX_BASE_URL=http://localhost:3000 npx playwright test --project=desktop tests/ios-raster.spec.ts
```

**Then export a PNG and look at it.** Nothing above can see a rasteriser bug.

**One known flake.** `namespace.spec.ts › twitter › the theme class on its own changes nothing either` failed once in a full-matrix run and passed in isolation and in two other full runs. It is a Twitter test untouched by this work, and it matches the cold-render ghost [WORK-SKIN-IMPLEMENTATION.md](./WORK-SKIN-IMPLEMENTATION.md) §10 documents (item 10, and the `stableDiff` guard that exists for it) — a render one run in three reporting a phantom shift. It was **not** root-caused here. If you see it, re-run before investigating; if it becomes frequent, that ghost is worth chasing properly.

### What was deliberately not built

Everything in §17 stands. Two calls worth restating because they look like omissions:

- **No "fetch link preview" button.** Scraping the pasted URL would make a surprise network request, fail on CORS more often than not, and tell a third-party site what the author is writing about. Link cards are typed by hand.
- **No individual Tapback reactors.** Apple attaches Tapbacks to a message and stacks repeats; we model counts. Naming fictional reactors adds real authoring complexity and does not improve the scene at this stage (§3.8).

### If you are picking this up to extend it

The natural next items, none urgent:

1. **Close criterion 22** (above). Everything else is optional until this is done.
2. **Group subtitle parity.** WhatsApp offers member names / count / custom / hidden; iOS always shows member names when a group has participants. The setting exists on one platform and not the other, which is a UI gap rather than a defect.
3. **iOS dark-mode PNG.** The theme is covered by the master skin's variant block and by the characterization golden, but no exported *picture* of a dark iOS scene has been read at zoom. Cheap, and item 5 above says why it matters.
4. **The `docs/BACKLOG.md` ranked list** still governs cross-platform work. Add anything from here to it rather than starting a second list — this section used to be one in the older doc and drifted out of date within a day.

---

**Scope:** the conversation generator's iOS / iMessage platform (`template: 'ios'`), including authoring, live preview, project files, local persistence, PNG export, AO3 hosted-image export, editable AO3 Work Text, the single-platform work skin, and the master work skin

**Primary internal reference:** [WhatsApp Platform Improvement — Implementation Plan](./WHATSAPP-PLATFORM-IMPROVEMENT-IMPLEMENTATION-PLAN.md)

**Required repository reading:** [Work Skin Implementation](./WORK-SKIN-IMPLEMENTATION.md), [AO3 Work Skin Knowledge](./AO3-WORK-SKIN-KNOWLEDGE.md), [Project File Schema](./PROJECT-FILE-SCHEMA.md), and [Master Work Skin Implementation](./MASTER-WORK-SKIN-IMPLEMENTATION.md)

**Product references:** Apple's current Messages documentation confirms inline replies in one-to-one and group conversations, Tapbacks attached to specific messages, playable audio messages with transcripts, manually shared links, and automatic grouping of multiple photos/videos. See [Send and reply to messages](https://support.apple.com/en-euro/guide/iphone/iph82fb73ba3/ios), [React with Tapbacks](https://support.apple.com/en-gb/guide/iphone/iph018d3c336/26/ios/26), [Send and receive audio messages](https://support.apple.com/en-kw/guide/iphone/iph2e42d3117/ios), and [Share content in Messages](https://support.apple.com/guide/iphone/share-photos-links-and-more-iphb66cfeaad/ios).

## 0. Implementation contract after the application audit

This section is normative. If a later section appears ambiguous, follow these decisions.

### 0.1 Keep iOS data isolated from WhatsApp data

`Message`, `Attachment`, `GroupParticipant`, and several chat settings are shared types, but the rich content is platform-specific.

- Add `iosReply`, `iosLinkPreview`, `iosMedia`, `iosTapbacks`, `iosEvent`, and `iosStartNewRun`.
- Do not make the iOS renderer read `whatsappReply`, `whatsappLinkPreview`, `whatsappMedia`, `whatsappReactions`, `whatsappEvent`, or `whatsappStartNewRun`.
- Do not make the WhatsApp renderer read the new `ios*` fields.
- Continue using the shared `attachments` array for images because it already has the correct image, alt-text, persistence, and export semantics.
- Reuse pure helpers such as `normalizeYouTubeUrl`, `ImageUrlInput`, URL validation patterns, and render-mode handling. Do not reuse WhatsApp markup, CSS classes, or persisted fields.
- Keep the internal template ID `ios`. Renaming it would touch routing, examples, storage, analytics, CSS namespaces, and tests without improving the author experience.

### 0.2 One canonical validator and one extras editor

Create `src/lib/ios.ts` and `src/components/IOSMessageExtrasEditor.tsx`.

- `validateIOSMessage(project, message, index)` is the single truth used by the composer, timeline, project import, storage recovery, and preflight.
- The composer owns one transient `Message`-shaped iOS draft, just as the WhatsApp composer does.
- The same extras editor edits both the transient draft and committed timeline messages.
- Switching primary content type clears contradictory fields in the same update. If populated data would be lost, require confirmation.
- A feature is not complete if it is only representable in JSON or only rendered by an example.

### 0.3 Preserve the proven two-mode media boundary

`buildHTML(project, renderMode, context)` already distinguishes:

- `static` — live scene preview, Save PNG, and ImgBB hosted-image export;
- `ao3-work` — editable AO3 Work Text generated by the work-skin flow.

For iOS rich media:

- `static` must render a non-playing poster/waveform card and an ordinary source link;
- `ao3-work` may emit the narrowly generated YouTube iframe or native `<audio>` / `<video>` elements that AO3 preserves;
- neither mode downloads, proxies, stores, transcodes, or rehosts audio/video bytes;
- ImgBB receives only the finished raster scene, never the media file;
- external media remains dependent on its original HTTPS host;
- native players use `crossorigin="anonymous"`, so the host must permit cross-origin playback.

### 0.4 Replies depend on full-scene context

Replies store a stable message ID, not copied prose. They may point only to an earlier non-event message.

- A hosted PNG chunk must resolve a reply against the original scene, not only the messages inside that chunk.
- Deleting a referenced message requires a dedicated confirmation and clears every `iosReply` pointing to it in the same state update.
- Moving a message is disabled if the move would place a reply before its target.
- Duplicating creates a new message ID. Its reply may remain only when the target is still earlier than the duplicate.
- A reply preview is derived at render time, so edits and character renames update it automatically.

### 0.5 URL and optional-field rules are field-specific

- Link destinations, media sources, video posters, and caption tracks must be absolute HTTPS URLs.
- Image attachments keep the existing image-address policy because local app assets and already-supported image data URLs are valid in other image flows.
- YouTube is the default video source.
- The poster field starts as the empty string and normalizes to `undefined` when blank or whitespace-only.
- A valid YouTube URL with no explicit poster uses its automatic YouTube thumbnail in static output.
- A malformed optional poster must be ignored or rejected; it must never suppress the automatic YouTube thumbnail.
- Optional title, duration, transcript, description, caption language, and caption label fields must remain genuinely optional unless the rules below explicitly require the complete caption-track trio.
- Strict project import rejects malformed structured content. Local-storage recovery drops the whole invalid structured block instead of leaving a blank but apparently valid card.

### 0.6 Preserve current iOS fixes

Do not regress the existing iOS work while refactoring:

- SVG tails remain for html2canvas; AO3 Work Text removes them and enables `.css-tails` pseudo-element tails.
- Tapback chips remain inside `dd.bubble`, on the top corner away from the tail.
- reaction spacing remains real padding/margin, not a visual offset that overlaps text in PNG.
- light-mode secondary text and typing dots remain readable.
- AO3 paragraph-injection resilience remains covered.
- hidden speaker labels remain the skin-off and EPUB fallback.
- group identity resolves from `characterId` first, with old participant/name fallbacks only where already required.
- the master work skin remains namespaced under `.chat.ios` and does not leak WhatsApp or Twitter rules.

### 0.7 No legacy-user feature migration project

The owner is currently the only user. Do not spend time inventing migrations for abandoned rich-iOS drafts.

- Bump the strict scene-project schema from v6 to v7.
- Update defaults, examples, fixtures, storage sanitization, strict import validation, URL collection, and schema documentation together.
- Do not add a migration from the shared single `reaction` string to `iosTapbacks`; the new iOS editor uses `iosTapbacks` canonically.
- Because `parseProjectFile` currently indexes `PROJECT_FILE_MIGRATIONS` for every older accepted envelope, add an explicit v6→v7 normalization entry or change that dispatch to reject v6 cleanly. Never leave `PROJECT_FILE_MIGRATIONS[6]` undefined. If the normalization entry is kept, it may add missing settings defaults only; it must not guess rich iOS content or copy `reaction` into `iosTapbacks`.
- Existing unrelated migrations may remain. Removing them is outside scope.
- It is acceptable for an old iOS backup containing incompatible rich fields to reset or be rejected.

### 0.8 Definition of complete

“100% implemented” means all P0 and P1 work in this document is authorable, rendered, persisted, exported, accessible, and tested. It includes:

- desktop and 360 px authoring;
- live static preview;
- Save PNG and hosted ImgBB image output;
- editable AO3 Work Text with playable supported media;
- single-platform and all-platform work skins;
- project download/import round-trip;
- local-storage recovery;
- transcript and preflight;
- skin-off and AO3 paragraph-injection behavior;
- a fresh AO3 save/read-back as the final external gate.

## 1. Outcome

Upgrade iMessage from a basic bubble mockup into a coherent fiction-authoring tool for:

- believable one-to-one and group conversations;
- correct message runs by resolved speaker;
- inline replies to earlier scene messages;
- one-to-four images in one message;
- manually authored link previews;
- playable voice messages in AO3 Work Text;
- YouTube and direct-file video in AO3 Work Text;
- honest static media cards in previews, PNGs, and ImgBB output;
- one or more Tapback types with optional counts;
- date dividers, narrative time breaks, and system events;
- iMessage blue and SMS/RCS green presentation;
- light and dark modes;
- bubbles-only, header, and phone-frame presentation;
- useful reading when Creator's Style is disabled or a download drops the skin.

This remains a static fiction generator. It must not connect to Messages or iCloud, send real messages, fetch a user's contacts, scrape link metadata, autoplay media, or imply that ImgBB preserves interactive media.

## 2. Current-state audit

### 2.1 What already works

| Capability | Current implementation |
| --- | --- |
| One-to-one messages | Incoming/outgoing bubbles, timestamps, and automatic sender alternation exist. |
| Blue/green modes | `iosMode: 'imessage' | 'sms'` changes the outgoing bubble color. |
| Themes | Light and dark palettes exist, including master-skin variants. |
| Header identity | Contact/group name, avatar/initials, and optional status bar render. |
| Group chat | Participant assignment, canonical character binding, sender labels, and avatar/initial fallback exist. |
| Delivery states | Sending, sent, delivered, and read are modeled; the last outgoing run can display a status. |
| Tapback | One shared `reaction` emoji can render as a correctly positioned chip. |
| Images | One image can be authored with alt text or a decorative flag. |
| Typing | Per-message and scene-level static typing indicators have skin-off fallback text. |
| Time break | `showTimeBreak` and `timeBreakText` can insert a narrative divider. |
| Text formatting | Existing safe formatting and emoji-only sizing work inside bubbles. |
| Export | Preview, PNG, hosted image code, Work Text, single-platform CSS, and master CSS share the generator. |
| AO3 resilience | CSS tails, em sizing, namespace checks, paragraph-injection tests, and skin-off labels already exist. |

### 2.2 Confirmed gaps and defects

**All closed.** The "Fixed by" column is what to read if you need to know where a
behaviour now lives, or to confirm a regression is a regression.

| Gap | User impact | Priority | Fixed by |
| --- | --- | --- | --- |
| Runs compare only incoming/outgoing direction | Two different group speakers can visually merge into one run. | P0 | ✅ `resolveIOSSpeakerKey` / `isSameIOSRun`; pinned in `ios-model` and `ios-renderer` |
| Group colors use inline `style` | AO3 strips them, so group identity can differ from the app preview. | P0 | ✅ finite `iosTone` palette → `ios-tone-*` classes; `ios-renderer` asserts no `style=` is emitted |
| iOS HTML is embedded in the large shared `msgHTML` path | New content risks duplicating or breaking existing image, timestamp, tail, and reaction behavior. | P0 | ✅ extracted to `iosMessageHTML` / `buildIOSHTML`, with a characterization golden taken first |
| No iOS-specific validator | Invalid or contradictory rich content can reach persistence/export. | P0 | ✅ `validateIOSMessage`, shared by all five callers |
| No structured reply | Authors cannot show an inline response to an earlier message. | P1 | ✅ `iosReply` + `iosReplyHTML`, resolved against the full scene |
| Only `attachments[0]` is editable and rendered | Project files allow four images but iMessage silently drops three. | P1 | ✅ one-to-four collages; `skin-off` proves all four descriptions survive |
| No link preview | URLs can only appear as plain message text. | P1 | ✅ `iosLinkPreview`, authored by hand — nothing is fetched |
| No audio message | A core narrative message type cannot be authored or played on AO3. | P1 | ✅ static waveform card / native `<audio>` in Work Text |
| No iOS video model | The proven YouTube/direct media path is unavailable. | P1 | ✅ YouTube default plus direct file with typed source and caption trio |
| One `reaction` string is the whole Tapback model | A stack or count cannot be expressed. | P1 | ✅ `iosTapbacks`; the legacy string is still *rendered* but never migrated (§0.7) |
| No explicit system/date event model | Events must masquerade as ordinary bubbles or time breaks. | P1 | ✅ `iosEvent`, rendered outside `dl.msg` and splitting runs |
| No iOS frame mode | Status/header/footer toggles can create inconsistent partial chrome. | P2 | ✅ `iosFrameMode` decides real markup; the chrome toggles now live inside the frame that has room for them |
| Default header/footer depend on remote strip images | Published works make avoidable permanent asset requests. | P2 | ✅ both default to empty; the chrome is generated HTML and CSS |
| Old iOS group document names removed components | A developer following it would edit the wrong architecture. | Documentation defect | ✅ `IOS-GROUP-CHAT-FEATURE.md` is now a pointer here, naming the two defects it used to specify |
| No dedicated iOS model/authoring/media/raster suite | Broad tests cannot prove the new feature is usable end to end. | P0 | ✅ six iOS suites, plus iOS cases added to `skin-off` and `ao3-injection` |

## 3. Product decisions

### 3.1 Target recognizable Messages behavior, not a specific phone screenshot

The app should feel like modern Apple Messages without chasing every annual pixel change.

Include narrative signals: blue/green delivery, bubble runs, inline reply context, Tapbacks, image groupings, link cards, voice messages, video, group identity, timestamps, delivery status, and restrained phone chrome.

Do not include live calls, FaceTime, Apple Cash, iMessage apps, stickers placed freely on the canvas, message effects, animated backgrounds, Genmoji generation, encryption claims, typing animation, audio progress state, unsend/edit history, location tracking, or real contact integration.

### 3.2 One primary content type per message

A message may have ordinary text plus at most one of:

1. images;
2. a link preview;
3. audio;
4. video.

It may also have a reply and Tapbacks. An event is exclusive and contains no sender, bubble, timestamp, status, reply, Tapback, attachment, link, or media data.

This rule prevents hidden content. Switching types in the editor clears the other primary blocks only after confirmation when they contain data.

### 3.3 Replies reference the scene

`iosReply.messageId` points to an earlier message in the same scene. The UI lists only valid earlier non-event candidates and labels them with resolved speaker, a short excerpt or content label, and timestamp.

The static rendering should adapt the inline-reply idea into a compact quoted context block inside the new bubble. Do not attempt to recreate the live app's blurred focus mode or interactivity.

### 3.4 Multi-image layout favors readable fiction

Apple groups multiple images into collages or stacks. For static AO3 fiction, hiding three images behind an unopenable stack would discard story information. Use:

- one image — full-width rounded image;
- two images — equal two-column collage;
- three images — one large image beside a two-image stack;
- four images — two-by-two collage.

All images remain real `<img>` elements with individual alt text. The unstyled fallback therefore exposes all image descriptions, not only the top image.

### 3.5 Link previews are manual and private

The author enters URL, title, optional site name, description, and image. Do not fetch Open Graph data from the pasted URL. This avoids surprise network calls, CORS failures, inaccurate previews, and leaking author activity to third-party sites.

The entire card is a real link in all outputs. Skin-off output must retain title, description, and URL.

### 3.6 Audio is a voice-message model

An iOS audio message stores a direct HTTPS media URL, MIME type, optional duration, and optional transcript.

- Static output shows a play glyph, an AO3-safe waveform treatment, duration, transcript, and source link without instantiating a player.
- Work Text emits `<audio controls="controls" crossorigin="anonymous" preload="metadata">` with a typed `<source>` and fallback source link.
- The editor player loads only after an explicit **Load media preview** action.
- A transcript is strongly recommended and preflight warns when it is absent.
- The built-in example must use a known CORS-enabled HTTPS MP3, not the W3 `.oga` sample that stalls under AO3's anonymous-CORS playback.

### 3.7 Video follows the solved YouTube/direct contract

The video source selector defaults to **YouTube**.

For YouTube:

- accept supported HTTPS watch, share, Shorts, live, and embed URLs through `normalizeYouTubeUrl`;
- store the author's source URL;
- generate the privacy-enhanced embed URL for Work Text;
- derive the static `i.ytimg.com` thumbnail when `posterUrl` is empty;
- let an explicit valid HTTPS poster override the derived thumbnail.

For direct video:

- require an HTTPS file URL and one of `video/mp4`, `video/webm`, or `video/ogg`;
- allow an optional HTTPS poster;
- allow captions only when URL, language, and label are all present;
- emit native video only in `ao3-work` mode.

All video modes may carry optional duration and description. The app never uploads or preserves the source video file.

### 3.8 Tapbacks are a small structured list

Use `iosTapbacks`, not the shared `reaction` string.

- maximum three distinct emoji types per message;
- one grapheme per Tapback;
- optional count from 1–9999;
- merge duplicate emoji and cap the list deterministically;
- render a compact top-corner stack away from the bubble tail;
- include accessible text such as `Tapbacks: ❤️ 2, 👍 1`.

Apple documents Tapbacks as attached to a specific message and stacks multiple reactions. We model counts rather than individual fictional reactor identities because the latter adds substantial authoring complexity without improving the scene at this stage.

### 3.9 Explicit events coexist with narrative time breaks

Keep `showTimeBreak` / `timeBreakText` for prose-like breaks such as “Five minutes later.” Add `iosEvent` for:

- `date` — “Today”, “Yesterday”, “Friday 9:41 PM”;
- `system` — “Alex named the conversation Road Trip”.

Events split message runs. They render as centered plain text with a useful skin-off sentence and never as speech bubbles.

### 3.10 Three frame modes

Add `iosFrameMode`:

1. `bubbles` — full message list without device header/input chrome;
2. `header` — Messages header plus full list; recommended default;
3. `phone` — optional status bar, header, message viewport, and input bar.

Add optional `iosScrollable` and `iosViewportHeightEm` for live/Work Text phone framing. Raster export must remove clipping and capture the entire conversation.

Existing `iosHeaderImageUrl` and `iosFooterImageUrl` become advanced overrides. CSS/text must provide the default header and input bar so a normal work does not depend on those remote strip assets.

## 4. Canonical data model

Add these types to `src/lib/schema.ts`. Keep them structurally separate from the WhatsApp types even where the fields match.

```ts
export type IOSParticipantTone =
  | 'red' | 'orange' | 'yellow' | 'green'
  | 'mint' | 'teal' | 'cyan' | 'blue'
  | 'indigo' | 'purple' | 'pink' | 'brown';

export interface IOSReply {
  messageId: string;
}

export interface IOSLinkPreview {
  url: string;
  title: string;
  siteName?: string;
  description?: string;
  image?: Attachment;
}

export type IOSMedia =
  | {
      kind: 'audio';
      url: string;
      mimeType: 'audio/mpeg' | 'audio/ogg' | 'audio/wav' | 'audio/mp4';
      duration?: string;
      transcript?: string;
    }
  | {
      kind: 'video';
      source: 'youtube';
      url: string;
      posterUrl?: string;
      title?: string;
      duration?: string;
      description?: string;
    }
  | {
      kind: 'video';
      source: 'direct';
      url: string;
      mimeType: 'video/mp4' | 'video/webm' | 'video/ogg';
      posterUrl?: string;
      title?: string;
      duration?: string;
      description?: string;
      captionTrackUrl?: string;
      captionLanguage?: string;
      captionLabel?: string;
    };

export interface IOSTapback {
  emoji: string;
  count?: number;
}

export interface IOSEvent {
  kind: 'date' | 'system';
  text: string;
}
```

Add to `GroupParticipant`:

```ts
iosTone?: IOSParticipantTone;
```

Add to `Message`:

```ts
iosReply?: IOSReply;
iosLinkPreview?: IOSLinkPreview;
iosMedia?: IOSMedia;
iosTapbacks?: IOSTapback[];
iosEvent?: IOSEvent;
iosStartNewRun?: boolean;
```

Add to `SkinSettings`:

```ts
iosFrameMode?: 'bubbles' | 'header' | 'phone';
iosScrollable?: boolean;
iosViewportHeightEm?: number;
```

Defaults:

```ts
iosFrameMode: 'header',
iosScrollable: false,
iosViewportHeightEm: 34,
```

Do not default `posterUrl` to placeholder prose. A newly selected video must be:

```ts
{
  kind: 'video',
  source: 'youtube',
  url: '',
  posterUrl: undefined,
}
```

## 5. iOS model and validation

Create `src/lib/ios.ts` with no React imports.

Required exports:

```ts
resolveIOSSpeakerKey(project, message): string
isSameIOSRun(project, previous, current): boolean
validateIOSReply(project, message, index): string[]
validateIOSLinkPreview(preview): string[]
validateIOSMedia(media): string[]
normalizeIOSTapbacks(tapbacks): IOSTapback[]
validateIOSMessage(project, message, index): string[]
iosMessageLabel(message): string
iosToneForMessage(project, message): IOSParticipantTone
```

Validation rules:

- reply target exists, is earlier, is not self, and is not an event;
- link URL is absolute HTTPS and title is 1–200 characters;
- site name is at most 100 characters and description at most 500;
- link image follows existing image-address rules and needs alt text unless decorative;
- audio source is absolute HTTPS and MIME is supported;
- YouTube source normalizes successfully;
- direct video URL is HTTPS, is not a YouTube page, and uses a supported video MIME;
- poster and caption URLs are HTTPS when present;
- caption URL, language, and label are either all present or all absent;
- no more than one primary content type is populated;
- zero to four image attachments are allowed;
- every non-decorative image has useful alt text;
- empty non-event messages are invalid unless they are typing indicators;
- an event contains non-empty text and no message-only data;
- incoming group messages resolve to a valid participant;
- at most three Tapback types; each is one grapheme; each count is 1–9999;
- blank optional strings normalize away instead of becoming required-field errors.

Run grouping must compare resolved speaker keys, not `outgoing` alone. A run ends when:

- direction changes;
- resolved `characterId` / participant / speaker changes;
- an event or typing row intervenes;
- `showTimeBreak` is present;
- `iosStartNewRun` is true;
- the primary content type requires its own visual grouping boundary.

## 6. Target authoring experience

### 6.1 Composer

When **Message options** opens for iOS, show this order:

1. timestamp and outgoing delivery state;
2. message / date / system segmented control;
3. reply selector;
4. content selector: None, Images, Link, Audio, Video;
5. fields for the chosen content type;
6. Tapbacks;
7. “Start a new bubble run” advanced toggle.

The message textarea remains the primary control. The send button is enabled when the shared validator accepts the exact draft that will be committed.

Do not keep the current independent `imageUrl`, `imageAlt`, `reaction`, and iOS send rules after the new editor lands. That would create two competing draft models.

### 6.2 Reply selector

- Default: **No reply**.
- Candidates: earlier, non-event messages only.
- Label: resolved speaker + excerpt/content label + timestamp.
- If an existing reply becomes invalid, show “Original message unavailable” in the timeline and block export in preflight.
- Selecting a reply must not copy the target text into storage.

### 6.3 Image editor

- Allow one to four images.
- Each row has address, upload button through `ImageUrlInput`, alt text, decorative toggle, move up/down, and remove.
- “Add image” disappears at four.
- Image order in the editor is image order in every output.
- Removing the last image switches primary content back to None.

### 6.4 Link editor

Fields: HTTPS URL, title, optional site name, optional description, optional preview image, and that image's alt/decorative controls.

Do not add a “fetch preview” button in this release.

### 6.5 Audio editor

Fields: direct HTTPS file URL, MIME selector, optional duration, and transcript.

- Explain that MP3 is the safest cross-browser choice.
- Explain that the original host must allow anonymous cross-origin playback.
- **Load media preview** is explicit and disabled while validation errors exist.
- Changing URL or MIME tears down the loaded preview and requires another click.
- A failed preview shows a host/CORS/MIME warning but preserves the source-link fallback.

### 6.6 Video editor

Fields:

- source selector, default YouTube;
- source URL;
- title optional;
- poster image address, initially empty;
- duration optional;
- description optional;
- direct-only MIME and caption fields.

The help copy must say:

> The scene preview, PNG, and ImgBB export use a static thumbnail card. AO3 Work Text embeds YouTube with its privacy-enhanced player or streams a direct file from its current host. This app never downloads, uploads, or preserves the video file.

Changing source, URL, MIME, poster, or captions resets the explicit preview. Whitespace in the poster field counts as empty.

### 6.7 Tapback editor

- Presets for common Tapbacks plus a custom emoji field;
- optional count;
- add/remove up to three types;
- normalization merges duplicate emoji;
- compact preview in the collapsed timeline card.

### 6.8 Existing-message editor

`MessageTimeline.tsx` must render `IOSMessageExtrasEditor` for every expanded iOS message, exactly as it renders `WhatsAppMessageExtrasEditor` for WhatsApp.

Remove the old iOS-only single-image controls and shared `ReactionPicker` from that path after feature parity is reached. Keeping both would allow one editor to erase the other's state.

### 6.9 Responsive behavior

At 360 px:

- the extras tray stays capped and scrollable;
- content tabs remain reachable without horizontal page overflow;
- media source and MIME controls stack when necessary;
- all image alt fields and remove controls remain visible;
- the main send button remains on screen;
- error text wraps within the editor;
- the preview column never controls editor width.

## 7. Renderer contract

### 7.1 Refactor before adding rich blocks

Extract the current iOS path from `msgHTML` / `buildHTML` into explicit helpers in `src/lib/generator.ts`:

```ts
iosReplyHTML(message, project, sourceMessages)
iosImagesHTML(message)
iosLinkPreviewHTML(message)
iosMediaHTML(message, renderMode)
iosTapbacksHTML(message)
iosEventHTML(message)
iosMessageHTML(message, project, options)
buildIOSHTML(project, renderMode, context)
```

Do not rewrite Twitter, Google, or the working WhatsApp renderer during this extraction. Keep a characterization test for current plain iOS messages, typing, single images, tails, statuses, groups, and Tapbacks before changing the branch.

### 7.2 Message markup

Use semantic, skin-off-readable structure:

```html
<div class="row out last" data-message-id="…">
  <dl class="msg">
    <dt class="visually-hidden">You: </dt>
    <dd class="bubble out has-tail has-reply has-media">
      <!-- optional visible group sender -->
      <!-- optional reply context -->
      <!-- optional text -->
      <!-- one primary content block -->
      <!-- timestamp -->
      <!-- raster-only SVG tail -->
      <!-- Tapback stack -->
    </dd>
    <!-- optional delivery status -->
  </dl>
</div>
```

New iOS feature classes must be `ios-*` (`ios-reply`, `ios-images`, `ios-link-preview`, `ios-audio-card`, `ios-video-card`, `ios-tapbacks`, `ios-event`) even inside `.chat.ios`. This makes master-skin debugging and cross-platform collision tests straightforward.

### 7.3 Reply rendering

- Resolve against `options.sourceMessages || options.allMessages`.
- Show resolved speaker and a maximum 180-character normalized excerpt.
- For non-text targets, label Photo, Photos, Link, Voice message, Video, or Typing indicator.
- Render a small thumbnail only when the target's first image or video poster is already a valid safe image URL.
- Do not embed the target's player or full image grid inside the reply.
- Missing targets render an explicit fallback and fail preflight.

### 7.4 Multi-image rendering

- Emit every attachment once.
- Add count classes `ios-images-1` through `ios-images-4`.
- Use width/height attributes where they materially protect AO3 layout.
- Do not rely on `object-fit`; AO3 does not allow it.
- Use border-radius and overflow rules already proven by the iOS skin.
- Timestamp overlays may sit on the final image only if contrast remains sufficient in both themes; otherwise keep the timestamp below the collage.

### 7.5 Link rendering

The whole card is an `<a>` with a visible title. Include optional image, site name, and description. Also preserve a readable URL line so the destination remains understandable with the skin off.

### 7.6 Audio rendering

Static:

```html
<div class="ios-audio-card">
  <a class="ios-media-source" href="…">…static voice-message presentation…</a>
  <span class="ios-audio-duration">0:08</span>
  <span class="ios-audio-transcript">Transcript: …</span>
</div>
```

AO3 Work Text:

```html
<div class="ios-audio-card ios-audio-player">
  <audio controls="controls" crossorigin="anonymous" preload="metadata">
    <source src="…" type="audio/mpeg">
    Your browser cannot play this audio. <a href="…">Open the audio source.</a>
  </audio>
  <!-- duration/transcript/source fallback -->
</div>
```

Never make the native control transparent or position it over a fake waveform.

### 7.7 Video rendering

Static output is a linked poster card with play glyph, optional duration/title/description, and source link. It contains no iframe and no `<video>`.

AO3 Work Text emits:

- a normalized `youtube-nocookie.com/embed/...` iframe for valid YouTube;
- native `<video controls crossorigin="anonymous" preload="metadata" playsinline>` with typed `<source>` and optional `<track>` for valid direct media;
- the same visible source fallback in both cases.

A YouTube video with empty poster must visibly use the derived thumbnail. This exact regression requires a unit assertion and browser assertion.

### 7.8 Events, statuses, and grouping

- Events sit outside `dl.msg` and split runs.
- Time breaks remain before their owning message.
- Delivery status appears only on outgoing messages and only at the end of a run.
- A rich-content message remains one indivisible scene item for chunking and capture.
- Tapbacks are inside the bubble and away from the tail for both directions.

### 7.9 Header and frame

`buildIOSHTML` decides actual markup from `iosFrameMode`:

- bubbles — message container only;
- header — header plus messages;
- phone — status bar when enabled, header, messages, and input bar.

The default header/input bar uses generated HTML and CSS. Optional header/footer images decorate or replace the generated chrome only when explicitly set.

## 8. CSS and AO3 constraints

Every new rule must:

- begin under `#workskin`;
- survive `lintAo3Css` with zero violations;
- use em/rem-compatible sizing, avoiding fragile fixed phone screenshots;
- avoid custom properties, `var()`, `calc()`, animation, grid, gap, object-fit, pointer-events, and unsupported pseudo-selectors;
- tolerate AO3 wrapping inline children in `<p>`;
- avoid required inline `style` because AO3 strips it;
- include light and dark values explicitly;
- remain correctly namespaced in the master skin;
- preserve useful document order with CSS disabled.

Use flex plus child margins for image collages. Use a finite `ios-tone-*` class palette for group sender color; do not emit author colors inline.

The master skin version must bump from 6 to 7 when the new class contract lands. Update the version marker test and verify all four platform blocks still lint and remain isolated.

## 9. Export, network, and privacy contract

### 9.1 Live preview

The main preview always calls `buildHTML(project, 'static')`. It must never load an audio player, video file, or YouTube iframe. Only the explicit editor preview can contact a media host after the author clicks **Load media preview**.

### 9.2 Save PNG

- Render all rich content as static cards.
- Capture every message, even when phone-frame scrolling is enabled.
- Flatten height, max-height, and overflow on the export clone.
- Keep SVG bubble tails in the raster path.
- Preserve deterministic output for self-diff tests.

### 9.3 Hosted AO3 image code

- Upload only the captured PNG to ImgBB.
- Never send link preview destinations, audio files, video files, caption files, or YouTube files to ImgBB.
- Pass the full scene as `sourceMessages` when rendering chunks so replies resolve across chunk boundaries.
- Do not split a message's reply/content/media/Tapback block across images.

### 9.4 Editable AO3 Work Text

- Call `buildHTML(project, 'ao3-work')` through `buildWorkSkin`.
- Use generated media markup only; never accept pasted raw iframe/audio/video HTML.
- Keep source links and transcript/description fallbacks beside playable elements.
- Apply the existing SVG-tail removal and `.css-tails` switch.
- Verify single-platform CSS and the default all-platform CSS popup both style the exact same HTML.

### 9.5 External host truth

The app can validate syntax and test a browser preview; it cannot guarantee that an external host will remain online or allow AO3 playback. Help and warning copy must say this plainly.

## 10. Persistence and project files

Update all of these together:

- `src/lib/schema.ts` — canonical types and defaults;
- `src/lib/storage.ts` — tolerant recovery/sanitization;
- `src/lib/projectFile.ts` — strict v7 validation and serialization;
- `src/lib/examples.ts` — iOS rich-content example;
- `src/lib/preflight.ts` — export blockers/warnings;
- `src/lib/transcript.ts` — readable structured content;
- `docs/PROJECT-FILE-SCHEMA.md` — v7 contract.

Strict import must:

- validate discriminated media by `kind` and `source`;
- preserve truly optional video titles as optional;
- normalize empty optional poster strings away;
- cap images at four and Tapbacks at three;
- reject contradictory primary content;
- reject invalid reply order and missing targets;
- reject event/message mixtures;
- collect every new link, media, poster, caption, and preview-image URL for project URL review.

Storage recovery must not guess whether a URL is YouTube or a direct file. If `source` is missing or a structured block is malformed, drop that block and let preflight expose any resulting empty message.

## 11. Transcript and preflight

### 11.1 Transcript order

For an ordinary iOS message, emit:

1. speaker and timestamp;
2. reply relationship and target excerpt;
3. text;
4. image descriptions in order;
5. link title, description, and URL;
6. audio label, duration, transcript, and source;
7. video label, duration, description, source, and caption link;
8. Tapbacks;
9. delivery status.

Events emit their kind and text without a fictional speaker. Typing indicators emit “Name is typing…”

### 11.2 Blocking errors

Block export for:

- invalid or missing reply target;
- reply to self, future message, or event;
- more than one primary content type;
- invalid HTTPS link/media/poster/caption URL;
- invalid YouTube URL;
- unsupported MIME;
- partial caption-track metadata;
- missing link title;
- missing non-decorative image alt text;
- empty event;
- invalid group participant;
- empty ordinary message;
- invalid Tapback grapheme/count/list size.

### 11.3 Warnings

Warn, without blocking, for:

- audio without transcript;
- video without description and without a direct caption track;
- direct video without poster;
- expiring or fragile remote image URLs;
- external audio/video host dependence;
- scrollable frame being flattened in PNG/ImgBB output.

## 12. Exact implementation map

| File | Required change |
| --- | --- |
| `src/lib/schema.ts` | Add iOS structured types/fields, participant tone, frame settings, and defaults. |
| `src/lib/ios.ts` | New pure speaker/run, validation, normalization, labeling, and tone helpers. |
| `src/components/IOSMessageExtrasEditor.tsx` | New shared composer/timeline UI for reply, images, link, media, Tapbacks, events, and run boundary. |
| `src/components/ComposeBar.tsx` | Replace separate iOS reaction/image draft state with one validated iOS draft/ref. |
| `src/components/MessageTimeline.tsx` | Use the iOS extras editor; remove the old single-image and shared ReactionPicker iOS path. |
| `src/components/SettingsSheet.tsx` | Add frame and optional scrolling settings. |
| `src/pages/index.tsx` | Add iOS reply-aware delete, move, and duplicate handling; preferably generalize the proven order helper. |
| `src/lib/generator.ts` | Extract dedicated iOS renderer; add structured blocks and static/ao3-work divergence. |
| `src/lib/storage.ts` | Sanitize iOS fields and primary-content exclusivity without reading WhatsApp fields. |
| `src/lib/projectFile.ts` | Bump to v7; validate and round-trip all iOS fields; collect all URLs. |
| `src/lib/transcript.ts` | Add iOS structured fallback prose. |
| `src/lib/preflight.ts` | Add iOS blockers/warnings and media accessibility checks. |
| `src/lib/examples.ts` | Add one rich iOS group example exercising every new content type. |
| `src/lib/workSkin.ts` | Preserve CSS-tail transformation, namespace new selectors, and bump master skin to v7. |
| `src/components/ExportPanel.tsx` | Extend full-scene reply context and flatten iOS scroll clipping during raster capture. |
| `docs/PROJECT-FILE-SCHEMA.md` | Document schema v7 and no-guess media behavior. |
| `docs/IOS-GROUP-CHAT-FEATURE.md` | ✅ Replaced with a short pointer to this plan, naming the two behaviours it specified that were defects. |

## 13. Implementation sequence

> **All six phases are done.** Kept as written because the *order* was the right
> one and is the order to reuse for a fifth platform. Phase 0 in particular paid
> for itself on the first run — see the handoff's item 1.

### Phase 0 — Lock current behavior with characterization tests

1. Add current plain-text light/dark iMessage render fixtures.
2. Cover blue and green bubbles, status bar/header/footer, typing, group identity, one image, one Tapback, delivery status, and SVG/CSS tails.
3. Record AO3 paragraph-injection and skin-off output before refactoring.
4. Make no visual change in this phase.

### Phase 1 — Model, validation, and persistence

1. Add iOS types and `src/lib/ios.ts`.
2. Add defaults and participant tones.
3. Bump project schema to v7 and add the explicit v6 dispatch behavior described in section 0.7.
4. Update strict import, storage recovery, URL collection, transcript, and preflight.
5. Add round-trip and invalid-state tests.

### Phase 2 — Renderer extraction and run correctness

1. Extract `buildIOSHTML` and `iosMessageHTML` without changing characterized output.
2. Change runs to resolved-speaker grouping.
3. Replace inline group colors with finite AO3-safe tone classes.
4. Add explicit event rendering and forced run boundaries.

### Phase 3 — Author replies, links, images, and Tapbacks

1. Build `IOSMessageExtrasEditor` with one primary-content selector.
2. Integrate the composer draft and timeline editor.
3. Add reply deletion/move/duplicate integrity.
4. Render reply cards, link previews, all four image layouts, and Tapback stacks.
5. Verify 360 px usability before media fields make the editor taller.

### Phase 4 — Audio and video

1. Add audio authoring, explicit preview, static card, transcript, and Work Text player.
2. Add YouTube-default video authoring with empty poster and derived thumbnail.
3. Add direct video MIME/poster/caption path.
4. Assert static output has no player and `ao3-work` output has the correct player.
5. Verify that ImgBB receives only PNG data.

### Phase 5 — Frames and long conversations

1. Add actual bubbles/header/phone markup modes.
2. Replace required remote chrome strips with CSS/text defaults.
3. Add optional live/Work Text scrolling.
4. Flatten scroll clipping during raster export.
5. Test hosted-image chunk replies against full-scene context.

### Phase 6 — Master skin and release verification

1. Add every new selector to light/dark and master-skin coverage.
2. Bump the master skin marker to v7.
3. Verify the work-skin popup defaults to **All four platforms** and both CSS/HTML copy buttons remain enabled when their content exists.
4. Run lint, typecheck, unit, desktop, mobile, raster, hosted-export, paragraph-injection, skin-off, single-skin, and master-skin suites.
5. Save/read back a fresh AO3 draft and compare stored HTML/CSS and playable media.

## 14. Required automated tests

> **All written and passing.** The suite-by-suite map of which question each one
> answers is in the handoff, under "The tests, and what only each one can tell
> you". Two of the cases below found real defects rather than confirming
> expectations: the empty-poster assertion (§14.2) and the skin-off structured
> reading (§14.2).

### 14.1 Unit/model — `tests/ios-model.unit.spec.ts`

- speaker keys distinguish two incoming group participants;
- events, typing, time breaks, and forced boundaries split runs;
- replies reject self, missing, future, and event targets;
- one primary-content rule is enforced;
- one-to-four images validate with individual alt rules;
- link fields and limits validate;
- audio MIME/HTTPS validates;
- YouTube variants normalize;
- direct video MIME/HTTPS/caption trio validates;
- empty poster stays undefined;
- optional empty video title is accepted;
- Tapbacks merge, cap, and validate graphemes/counts;
- event exclusivity validates;
- group participant membership validates.

### 14.2 Renderer/AO3 — `tests/ios-renderer.unit.spec.ts`

- current plain iOS characterization remains stable;
- reply cards update when target content/identity changes;
- all four images emit once with correct alt text and count classes;
- link card remains a real link;
- static audio/video emit no `<audio>`, `<video>`, or `<iframe>`;
- Work Text audio emits typed native audio and fallback;
- Work Text YouTube emits privacy-enhanced iframe;
- Work Text direct video emits typed source and complete caption track;
- YouTube with empty poster derives a thumbnail;
- malformed optional poster cannot suppress the thumbnail;
- events sit outside bubbles;
- Tapbacks sit inside bubbles away from tails;
- skin-off output names the speaker and explains every structured block;
- new CSS passes AO3 lint and namespace tests;
- paragraph injection does not change load-bearing geometry.

### 14.3 Project/persistence

- v7 project download/import round-trips every iOS field;
- URL collection includes link destination/image, media, poster, and captions;
- strict import rejects malformed discriminators and contradictory content;
- storage recovery drops invalid structured blocks without inventing values;
- project download accepts an empty optional video title and poster;
- no iOS field mutates a WhatsApp scene and vice versa.

### 14.4 Authoring E2E — `tests/ios-authoring.spec.ts`

- compose and edit each content type;
- select an earlier reply and see it in preview;
- delete a reply target and clear dependents after confirmation;
- block an invalid move across a reply target;
- add, reorder, describe, decorate, and remove four images;
- create/edit a manual link card;
- preview playable audio only after explicit consent;
- default new video to YouTube with blank poster;
- change YouTube to direct and reveal MIME/caption controls;
- see derived thumbnail with blank poster;
- create multiple Tapbacks and an event;
- use all controls at 360 px without losing the send button;
- copy HTML and default all-platform CSS from the work-skin popup.

### 14.5 Raster and hosted export

- Save PNG includes reply, four images, link, audio card, video card, Tapbacks, and events;
- PNG contains no browser-native player chrome;
- long phone-frame export contains the full conversation;
- static self-diff is deterministic;
- hosted chunk reply resolves a target in an earlier chunk;
- ImgBB request contains the PNG only and never a media-source URL/file upload;
- capture failure does not erase the project or media source data.

## 15. Manual visual matrix

> **Walked for the light theme**, including a real **Save PNG** read at zoom,
> which is where the reply-card and header defects were found. The dark-theme
> *picture* is the one cell not yet read at zoom — it is covered by the
> characterization golden and the master-skin variant block, but see the
> handoff's "If you are picking this up to extend it", item 3.

Check each relevant cell in both the app preview and generated AO3 Work Text:

| Scenario | Light | Dark | 360 px | Desktop | Skin off |
| --- | --- | --- | --- | --- | --- |
| Blue one-to-one text runs | ✓ | ✓ | ✓ | ✓ | ✓ |
| Green SMS/RCS runs | ✓ | ✓ | ✓ | ✓ | ✓ |
| Group speaker changes | ✓ | ✓ | ✓ | ✓ | ✓ |
| Reply to text/image/audio/video/link | ✓ | ✓ | ✓ | ✓ | ✓ |
| One/two/three/four images | ✓ | ✓ | ✓ | ✓ | ✓ |
| Link with/without image | ✓ | ✓ | ✓ | ✓ | ✓ |
| Audio with/without transcript | ✓ | ✓ | ✓ | ✓ | ✓ |
| YouTube with empty/custom poster | ✓ | ✓ | ✓ | ✓ | ✓ |
| Direct video with captions | ✓ | ✓ | ✓ | ✓ | ✓ |
| One/three Tapback types | ✓ | ✓ | ✓ | ✓ | ✓ |
| Date/system event | ✓ | ✓ | ✓ | ✓ | ✓ |
| Bubbles/header/phone frame | ✓ | ✓ | ✓ | ✓ | ✓ |
| Long scrollable conversation | ✓ | ✓ | ✓ | ✓ | ✓ |

Also inspect a real downloaded PNG at 100% zoom. A browser screenshot of the preview is not a substitute for exercising **Save PNG**.

## 16. Acceptance criteria

**1–21 are evidenced by the test suites and by a PNG read at zoom. 22 is the one
open gate** and needs a real archive account; the exact procedure is in the
handoff under "The one thing still open".

Implementation is accepted only when all statements are true:

1. iOS rich fields are separate from WhatsApp rich fields.
2. One shared iOS validator governs composer, timeline, import, recovery, and preflight.
3. Run grouping distinguishes actual group speakers.
4. Group identity survives AO3 without required inline styles.
5. Replies reference only earlier valid messages and survive hosted chunking.
6. Deleting/moving/duplicating cannot silently corrupt replies.
7. Authors can create and edit one-to-four accessible images.
8. Authors can create a manual accessible link preview without network scraping.
9. Audio is static in preview/PNG/ImgBB and playable in AO3 Work Text when the host permits it.
10. Video defaults to YouTube, the poster starts empty, and empty poster derives the thumbnail.
11. Direct video supports typed source and an all-or-none caption track.
12. No audio/video file is downloaded, proxied, or uploaded to ImgBB.
13. Tapback stacks and counts are authorable and readable without CSS.
14. Date/system events are explicit and never render as bubbles.
15. Static output contains no native media players.
16. Work Text contains only generated, sanitized media elements and visible fallbacks.
17. Project schema v7 round-trips every new field and accepts empty optional title/poster values.
18. All three frame modes affect real markup and PNG captures never clip the conversation.
19. Single-platform and master skins pass AO3 lint, namespace, paragraph-injection, and skin-off tests.
20. The work-skin popup defaults to all-platform CSS and its copy buttons work.
21. Desktop and 360 px authoring tests pass.
22. A fresh AO3 save/read-back confirms CSS survival and playable YouTube/audio/direct-video behavior, or the release notes explicitly record that external verification as the only remaining gate.

## 17. Explicit non-goals

- connecting to a real Apple account, Messages database, contacts, or iCloud;
- sending or receiving real messages;
- uploading, proxying, transcoding, or permanently storing audio/video;
- automatic link metadata fetching;
- automatic waveform generation or media-duration probing;
- autoplay or scripted playback inside AO3;
- interactive reply threads, Tapback inspectors, photo stacks, or lightboxes inside AO3;
- message editing/unsend history;
- stickers, Memoji/Genmoji generation, message effects, polls, Apple Cash, locations, Check In, or FaceTime;
- pixel-perfect reproduction of one exact iOS release;
- migrating abandoned pre-v7 rich-iOS project shapes.

## 18. Developer handoff checklist

- [x] Read the four required repository documents at the top of this plan.
- [x] Add characterization tests before extracting the current iOS renderer.
- [x] Create `src/lib/ios.ts` and keep it React-free.
- [x] Create one `IOSMessageExtrasEditor` used by composer and timeline.
- [x] Add schema v7 types/defaults/import/storage/transcript/preflight together.
- [x] Make run grouping speaker-aware before styling rich content.
- [x] Remove required inline participant colors.
- [x] Implement replies and dependency-safe message actions.
- [x] Render all four images; never stop at `attachments[0]`.
- [x] Implement manual link cards.
- [x] Implement static/Work Text audio divergence.
- [x] Implement YouTube-default and direct video with an empty poster default.
- [x] Assert no media bytes reach ImgBB.
- [x] Implement structured Tapbacks and explicit events.
- [x] Implement real frame modes and unclipped raster export.
- [x] Update the rich iOS example and schema documentation.
- [x] Bump the master work-skin marker to v7.
- [x] Run automated and manual matrices, including actual Save PNG.
- [ ] Complete fresh AO3 save/read-back verification. **The one open item** — it needs a real archive account.
- [x] Mark this document implemented only after every acceptance criterion is evidenced. *(1–21 evidenced; 22 is the archive gate above.)*

## 19. Relationship to the older iOS group document

`docs/IOS-GROUP-CHAT-FEATURE.md` was historical and no longer described the current application architecture: `IOSEditor.tsx` and `CompactMessageCard.tsx` are not the active editing path, participant management lives in `CastPanel.tsx`, and message editing lives in `MessageTimeline.tsx`.

**Done.** That file is now a short pointer to this plan. It also names the two behaviours it used to specify that turned out to be defects — direction-only run grouping, and a free hex sender colour emitted as an inline `style` AO3 strips — so anyone who arrives there from an old link learns why not to rebuild them.
