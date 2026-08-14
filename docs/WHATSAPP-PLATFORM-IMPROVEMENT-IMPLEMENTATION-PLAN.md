# WhatsApp Platform Improvement — Implementation Plan

**Prepared:** 13 August 2026

**Status:** Implemented and locally verified on 13 August 2026. Acceptance item 15 still requires a fresh authenticated AO3 save/read-back; no connected browser session was available for that external archive step.

**Scope:** the conversation generator's WhatsApp platform (`template: 'android'` internally), including authoring, live preview, project files, local persistence, PNG export, AO3 hosted-image export, editable AO3 Work Text, the single-platform work skin, and the master work skin

**Primary reference:** [Whatsapp Work Skin Template /Revamped by worlds_end_valentine](https://archiveofourown.org/works/46531021)

**Supporting product references:** [New Voice Message Features on WhatsApp](https://about.fb.com/news/2022/03/new-voice-message-features-on-whatsapp/), [Introducing New Ways to Chat on WhatsApp](https://about.fb.com/news/2025/01/introducing-fun-new-ways-to-chat-on-whatsapp/), and AO3's [Posting and Editing FAQ](https://archiveofourown.org/faq/posting-and-editing?language_id=en#embeds)

**Repository constraints:** read `docs/WORK-SKIN-IMPLEMENTATION.md`, `docs/AO3-WORK-SKIN-KNOWLEDGE.md`, and `docs/PROJECT-FILE-SCHEMA.md` before changing the renderer or export code.

## 0. Refinement after the application audit

This section is the implementation contract. It resolves details that were still
ambiguous in the first draft after tracing the current authoring, renderer,
persistence, work-skin, and raster paths.

### 0.1 Preserve shared-platform data deliberately

`Message`, `GroupParticipant`, and several chat settings are shared by iMessage
and WhatsApp. WhatsApp additions must therefore be additive and platform-scoped:

- keep `GroupParticipant.color` for iMessage and add `whatsappTone` for WhatsApp;
- keep the shared `reaction` field for iMessage and stop reading it only in the
  WhatsApp renderer/editor;
- do not make the iOS renderer understand WhatsApp reply, event, link, media, or
  reaction-list fields;
- add all WhatsApp defaults to `defaultProject()` and to every built-in example
  settings object through a shared default/normalization path, rather than
  maintaining another copied settings block.

### 0.2 One committed message model, one transient editor draft

`WhatsAppMessageExtrasEditor` is the only UI that edits WhatsApp reply, images,
link, audio/video, reactions, event data, and the forced run boundary. It accepts
a `Message`-shaped draft and emits atomic `Partial<Message>` updates.

- The composer owns a transient draft and commits it only when the exact shared
  validator says it is valid.
- The timeline uses the same editor. Content-type switches clear contradictory
  fields in the same update so an edit never silently hides authored content.
- Ordinary text, timestamp, direction, and delivery state remain in their compact
  existing controls; the shared extras editor owns everything else.
- Validation messages are shown beside the affected section. The export preflight
  remains the final blocking boundary for projects restored from storage or JSON.

### 0.3 Rendering has two explicit modes and one source-message context

Keep `buildHTML(project, renderMode)` as the public rendering boundary, but add an
optional source-message context used when hosted PNG output renders a chunk of a
larger scene. Reply cards resolve against that original scene, not only the 15
messages in the current raster chunk. This prevents a valid reply from becoming
“missing” merely because its target is in an earlier image.

- `static` is used by the main preview, Save PNG, and ImgBB output and must not
  instantiate `<audio>` or `<video>`.
- `ao3-work` is used only by the Work Text exporter and emits the narrowly
  generated native media elements plus ordinary source/fallback links.
- Chunk boundaries may split a reply from the original message it references,
  but may never split the reply card, media/link card, image grid, reaction pill,
  or event row from its owning scene item.

### 0.4 Message ordering must preserve reply validity

Deleting a referenced WhatsApp message uses a dedicated confirmation and removes
all `whatsappReply` references to it in the same state update. Moving an item is
disabled when the single-step move would place a reply before its target. A
duplicate receives a new ID but may retain a reply only when that target still
precedes the duplicate. Events always split visual runs.

### 0.5 URL rules are field-specific

- Link, audio/video source, poster, and caption URLs are absolute HTTPS only.
- Image attachments continue to use the existing image-address policy because
  local application assets and already-supported image data URLs are valid in
  other platform flows; exported remote image warnings still apply.
- No validation path may turn malformed structured media into an empty valid
  card. Strict project import rejects it; local-storage recovery drops the whole
  invalid structured block and leaves the project preflightable.

### 0.6 Frame and chrome behavior is complete, not decorative dead state

The three frame modes control actual markup. The default header/footer no longer
requires the shipped remote strip images: CSS and ordinary text elements provide
the baseline header and input-bar chrome, while advanced image fields are
optional author overrides. Local-storage loading must preserve an intentional
blank override instead of force-restoring the old CDN strips.

`androidScrollable` affects only the live/Work Text phone-frame message viewport.
The export clone explicitly removes height/max-height/overflow from both the
outer chat and `.chat-messages`, so Save PNG and ImgBB always contain the full
authored conversation.

### 0.7 Browser verification follows the proven export path

Use the browser as a measurement tool, following `WORK-SKIN-IMPLEMENTATION.md`:

1. run the model/unit gate first;
2. run the AO3 paragraph-injection, namespace, master-skin, and skin-off browser
   harnesses with deterministic image stubs and self-diff stability checks;
3. drive the real **Save Image** control and inspect the downloaded PNG—do not
   substitute a preview screenshot, because the raster clone has intentional
   html2canvas-only compensation;
4. test desktop and 360 px authoring for every WhatsApp content type and frame;
5. only after local output is stable, save/read back a current AO3 draft and
   compare stored CSS/HTML. Record any account/network limitation as external
   verification, never as a guessed product result.

### 0.8 Definition of “100%” for this implementation

All P0, P1, and the explicitly designed frame/subtitle/chrome P2 work in this
document are in scope. “Complete” requires authoring, rendering, persistence,
strict project round-trip, transcript, preflight, static/native export divergence,
single/master skin parity, and desktop/mobile browser coverage. A renderer-only
or JSON-only capability is incomplete.

## 1. Outcome

Turn the current WhatsApp mockup into a coherent fiction-authoring tool for:

- believable one-to-one and group conversations;
- message runs that group by the actual speaker, not only left/right alignment;
- replies to earlier messages;
- manually authored link previews;
- image messages and captions;
- playable voice/video messages in AO3 Work Text, with honest static fallbacks in PNG and hosted-image output;
- one or more emoji reactions with counts;
- date dividers and group/system events;
- light and dark presentation;
- bubbles-only, header, and full-chat framing;
- accessible reading when Creator's Style is disabled or an AO3 download drops the skin.

The result is a static fiction renderer, not a working WhatsApp client. It must not contact WhatsApp, inspect a real account, scrape link metadata, send messages, autoplay media, or imply that AO3/ImgBB preserves externally hosted audio and video.

The implementation is complete only when a user can author every P0/P1 feature from the UI. Renderer-only fields and example-only states do not count as shipped.

## 2. Product decision: no legacy-user migration work

The owner is currently the only user. Do not spend implementation time preserving old WhatsApp project shapes.

- New WhatsApp fields become the canonical schema immediately.
- Update built-in examples, defaults, test fixtures, local-storage sanitization, and project-file validation together.
- Do not add conversion code for old WhatsApp reply, reaction, group-color, media, or frame fields.
- It is acceptable for an old local WhatsApp project or backup to reset or be rejected after the schema change.
- Unrelated Twitter and identity migrations may remain; deleting them is outside this plan.
- Do not rename the internal `android` template ID merely because migration is out of scope. That rename would touch routing, analytics, deep links, CSS namespaces, examples, and tests without improving the author experience. The UI must continue to say **WhatsApp**.

The original WhatsApp work bumped the strict project-file shape to v5. Provider-aware video now bumps it to v6; `docs/PROJECT-FILE-SCHEMA.md` records the explicit no-guess policy for v5 video objects without a `source` discriminator.

## 3. What the reference proves and what it does not

### 3.1 Useful patterns demonstrated by the posted work

The current AO3 read-back of the reference contains all of these reader-facing patterns:

- light and dark wrappers in one work skin;
- one-to-one and group chat headers;
- first/continuation message bubble shapes;
- speaker colors in group chats;
- one-to-four emoji sizing;
- images and native video;
- two native audio players styled as voice messages;
- quoted/replied-to message blocks;
- link previews with optional images;
- single and multiple reaction displays with counts;
- date and system-information rows;
- bubbles-only, header, and fixed-height full-chat examples;
- hidden fallback prose for screen readers and skin-off reading.

The saved work currently contains one real `<video>`, two real `<audio>` elements, and two `<source>` elements after AO3 sanitization. That is direct evidence that AO3's field-specific media sanitizer is active in Work Text.

### 3.2 Patterns to adapt, not copy

Do not copy the reference's CSS, class names, hosted images, example text, or externally hosted media. Adapt its information architecture and test methods to AO3 SkinGen's existing renderer.

In particular, do not reproduce these brittle techniques:

- transparent native audio controls positioned over a waveform image;
- dozens of externally hosted chrome images;
- arbitrary inline `style` attributes, which AO3 strips;
- fixed pixel widths as the only mobile layout strategy;
- decorative timestamps or ticks with no coherent fallback text;
- a scroll viewport that clips a PNG capture;
- user-pasted raw HTML or media embed markup.

The app must generate its own structured markup from typed data.

### 3.3 Product fidelity boundary

Implement narrative value, not every control in the current live app.

Include:

- conversation identity;
- speaker, message, timestamp, and delivery state;
- replies, reactions, media, links, and group events;
- enough header/input chrome to establish the setting.

Do not include in this release:

- real encryption or privacy claims about fictional content;
- live calling, contact menus, search, payments, channels, communities, Status, stickers, disappearing timers, editing history, or network presence;
- animated typing dots, audio progress, or seek state;
- automatic Open Graph fetching;
- automatic waveform analysis;
- actual “view once” enforcement;
- JavaScript interactions inside AO3.

## 4. Current-state audit

### 4.1 What already works

| Capability | Current implementation |
| --- | --- |
| One-to-one chat | Incoming/outgoing bubbles, contact header, avatar, status line, timestamps, and checkmarks render. |
| Group chat | Scene cast and participant bindings exist; incoming group messages can select a participant. |
| Stable identity | Messages can reference `characterId`; character edits update old messages at render time. |
| Automatic metadata | New messages receive the next chat timestamp, and automatic outgoing delivery state can advance after a reply. |
| Message grouping | Consecutive bubbles are grouped into first/middle/last runs. |
| Basic media | One image can be added with alt text or a decorative flag. |
| Reactions | One emoji string can be attached to a message. |
| Emoji-only display | One-to-four emoji messages receive large WhatsApp-style presentation. |
| Typing | Per-message and scene-level typing indicators render with skin-off fallback text. |
| Date-like break | `showTimeBreak` and `timeBreakText` can insert a centered divider. |
| Themes | Light/dark appearance and master-skin variants exist. |
| Export | Preview, PNG, hosted AO3 image code, single work skin, and master work skin share the generator. |
| AO3 resilience | Output is namespaced, em-sized, linted, tested against paragraph injection, and readable with Creator's Style off. |

### 4.2 Confirmed gaps and defects

| Gap or defect | User impact | Priority |
| --- | --- | --- |
| Group runs compare only `outgoing` | Alice followed by Bob can be styled as one continuous speaker run. | P0 |
| Group sender colors are emitted in inline `style` | AO3 strips the color and initials styling, so exported group identity loses fidelity. | P0 |
| Group messages include avatar/initial rows that WhatsApp does not normally put inside every bubble | The result is visually noisy and duplicates names in skin-off output. | P0 |
| No structured reply model or editor | A user cannot quote an earlier WhatsApp message. | P1 |
| No link-preview model or editor | URLs can only appear as plain message text. | P1 |
| No voice-message model | A high-value WhatsApp story beat cannot be authored. | P1 |
| No WhatsApp video model | The app cannot use AO3's verified native-media path for a chat video. | P1 |
| One string represents all reactions | Multiple emoji types and counts cannot be expressed or validated. | P1 |
| A date break and a group event share no explicit semantic model | “Today” and “Alex removed Sam” require awkward message workarounds. | P1 |
| Only `attachments[0]` renders/edits | Project validation allows four, but WhatsApp silently ignores the rest. | P1 |
| Header group subtitle is only a participant count | It cannot show the familiar member-name summary or custom narrative status. | P2 |
| Header/footer presentation depends on remote strip images | Published works make avoidable permanent requests to the app's CDN. | P2 |
| No WhatsApp-specific preflight for reply/media/link validity | Broken narrative states reach export. | P0 |
| No dedicated WhatsApp authoring/model/raster suite | Existing broad tests cannot prove the new state is authorable and visually stable. | P0 |

## 5. Product decisions

### 5.1 Keep one platform, offer three frame modes

Do not create more platform-picker templates for every presentation variant. Add one WhatsApp frame setting:

1. **Bubbles only** — messages without phone header or input bar; best when embedded between prose paragraphs.
2. **Chat header** — header plus the full message list; recommended default.
3. **Phone frame** — header, message area, and decorative input bar.

Use a visible segmented/select control in WhatsApp settings. The internal field may be `androidFrameMode` to match the existing template prefix.

The frame is presentation only. Switching it must not alter messages, people, timestamps, or media.

### 5.2 Full conversation is the default; scrolling is optional

The reference proves that `overflow-y:auto` survives AO3, but fixed-height chat windows introduce real export and reading problems.

- Default to a full-height conversation in Preview and AO3.
- Offer **Fixed-height scroll window** only under Advanced settings and only in Phone frame mode.
- Do not apply fixed height during Save PNG or hosted-image capture. Those outputs must contain all messages or use the existing safe partitioning flow.
- In the no-skin transcript, scrolling does not exist; all content remains in reading order.
- Cap the authored viewport height to a safe range such as 20–60 em and provide a sensible default.

### 5.3 Group identity uses names and a fixed semantic color palette

Incoming group bubbles should display the speaker name as WhatsApp does. Do not put an avatar or initials inside each bubble.

Replace arbitrary exported inline colors with a fixed `WhatsAppParticipantTone` token. Recommended tokens:

```ts
export type WhatsAppParticipantTone =
  | 'green' | 'teal' | 'lime' | 'yellow'
  | 'orange' | 'red' | 'pink' | 'magenta'
  | 'purple' | 'violet' | 'blue' | 'cyan';
```

Define the actual light/dark color pairs once in `src/lib/whatsapp.ts`. Every tone must pass contrast review against the receiving bubble in both themes. Emit classes such as `wa-tone-green`; never emit a user color in `style="color:…"`.

The participant editor should show named color swatches, not an unrestricted color input, for WhatsApp. iOS may continue using its current color behavior if needed.

### 5.4 Message runs group by resolved speaker and content type

A message belongs to the same visual run only when all of the following are true:

- both items are ordinary messages, not system/date/typing rows;
- both resolve to the same `characterId`, or the same stable participant/contact fallback;
- both have the same direction;
- no date/system divider occurs between them;
- the latter message does not explicitly start a new run.

Do not compare only `outgoing`. In a group chat, Alice → Bob is always a speaker boundary even though both messages are incoming.

Replies, link previews, and media may remain inside a run, but their bubble must have enough top padding and width to contain the nested card. A system event or date divider always terminates the run on both sides.

### 5.5 Replies reference real scene messages

Phase 1 replies select an earlier ordinary message in the same scene.

- Store a stable `messageId`, not copied HTML.
- Derive the sender name and excerpt at render time so character renames update old reply cards.
- Limit the visible excerpt without truncating the accessible transcript.
- The reply card can coexist with text, images, voice, or video.
- The UI must not permit self-reference, a later target, a system event, or a missing target.
- Deleting a referenced message must show a confirmation offering **Cancel** or **Delete and remove reply previews**.

External/frozen reply snapshots are a P2 extension, not required for the first release.

### 5.6 Link previews are manual and privacy-preserving

The author supplies:

- destination URL;
- title;
- optional site/domain label;
- optional description;
- optional preview image with alt/decorative metadata.

Do not fetch the destination while typing and do not add a server-side metadata scraper in this phase. Automatic fetching leaks browsing information, creates SSRF/security work, and makes reproducibility depend on a third party.

The renderer must create a real HTTPS `<a>` around or adjacent to the preview. With the skin off, the result should read as a title followed by its URL—not as an unlabeled decorative card.

### 5.7 Media is structured; AO3 and raster outputs intentionally differ

WhatsApp audio uses direct HTTPS media files. Video supports either a structured
YouTube URL or a direct HTTPS media file. These are different sources because
AO3 must render YouTube as an approved iframe and a direct file as native
`<video><source>`.

Use one discriminated union:

```ts
export type WhatsAppMedia =
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
      duration?: string;
      description?: string;
    }
  | {
      kind: 'video';
      source: 'direct';
      url: string;
      mimeType: 'video/mp4' | 'video/webm' | 'video/ogg';
      posterUrl?: string;
      duration?: string;
      description?: string;
      captionTrackUrl?: string;
      captionLanguage?: string;
      captionLabel?: string;
    };
```

Render variants:

| Surface | Audio/video behavior |
| --- | --- |
| Main app preview | Static waveform/poster card. YouTube uses its public thumbnail URL; no video player or video bytes are loaded. |
| Message editor preview | Load the privacy-enhanced YouTube iframe or direct media only after **Load media preview**. Never autoplay. |
| Save PNG | Static waveform or poster card with duration/type and fallback text. |
| Hosted AO3 image code | Same static card; ImgBB receives only the rendered PNG. |
| AO3 Work Text | Approved YouTube iframe, or native `<audio>`/direct `<video><source><track>` with anonymous CORS. Keep controls visible and usable. |
| Skin off/download | Plain label, duration, description/transcript, and ordinary source URL. |

Never download, proxy, transform, cache, upload, or rehost the audio/video bytes. Do not upload media files to ImgBB; ImgBB is used only for final PNG scene images.

AO3 forces `crossorigin="anonymous"` on native media. A URL being direct and
HTTPS is therefore not sufficient: its response host must also allow anonymous
cross-origin requests. Prefer MP3 for audio interoperability and test the saved
AO3 page. The original W3 `.oga` example returned no
`Access-Control-Allow-Origin` header and stalled at `0:00` after AO3 read-back;
the example now uses a CORS-enabled Internet Archive MP3.

YouTube is the default video provider and its poster field starts empty. A
blank or unfinished optional poster override never replaces the derived YouTube
thumbnail, and changing providers clears the previous poster value.

Do not hide native audio controls under an invisible overlay. The waveform is visual framing; the actual controls must remain keyboard- and pointer-operable.

#### Reuse the proven Twitter direct-video boundary exactly

The Twitter implementation is the reference for previewing and AO3 playback.
Do not rediscover this split or collapse the three render modes:

1. The composer/editor stores only structured fields. It never accepts pasted
   `<video>`, `<source>`, `<track>`, iframe, or other embed markup.
2. **Load media preview** stays disabled until the supported YouTube URL or
   direct HTTPS URL/MIME type and any caption triplet validate. Before that
   click there is no iframe/audio/video player.
3. After consent, the editor emits a controlled, non-autoplaying media element
   with a typed `<source>`. Video captions use
   `<track kind="captions" srcLang label default>`. Playback failure shows the
   same actionable HTTPS/CORS/MIME warning used by Twitter and does not remove
   the exportable source-link fallback.
4. Main preview, Save PNG, and ImgBB output remain static. A video uses its
   poster, play symbol, duration, description, caption link, and source link;
   audio uses a deterministic waveform, duration, transcript, and source link.
5. Only `buildHTML(project, 'ao3-work')` may emit playable media. It generates a
   titled privacy-enhanced iframe for YouTube, or an `<audio>`/`<video>` with
   visible controls, `preload="metadata"`, a MIME-typed `<source>`, optional
   default captions, intrinsic dimensions, and ordinary fallback/source links.
   It never emits autoplay.
6. Unit tests must assert static/native divergence and exact source/track
   attributes. Browser tests must assert zero players before consent, a typed
   player after consent, and zero players in the scene preview after send.

The supplied AO3 read-back proved why the discriminator is required: Twitter's
YouTube iframe played, while WhatsApp's old `<source src="youtube.com/watch..."
type="video/mp4">` could survive sanitization but could never play. Validation
now rejects that mismatch.

### 5.8 Reactions are a small list, not arbitrary prose

Replace WhatsApp's use of the shared `reaction?: string` field with:

```ts
export interface WhatsAppReaction {
  emoji: string;
  count?: number; // omitted means 1
}
```

`whatsappReactions?: WhatsAppReaction[]` should allow one to three distinct emoji entries. Each emoji must be one grapheme cluster; count is 1–9999. Duplicate emoji entries are merged.

Display compactly inside one reaction pill. The transcript must include `Reactions: ❤️ ×2, 😂`.

Keep the current shared `reaction` field for iOS unless separately refactored. Do not make the WhatsApp change break iMessage tapbacks.

### 5.9 Date dividers and system events are explicit

Add a WhatsApp-only event object:

```ts
export interface WhatsAppEvent {
  kind: 'date' | 'system';
  text: string;
}
```

An event row is exclusive with sender, reply, media, attachments, link preview, delivery state, and reactions. The existing `Message` envelope can hold `whatsappEvent`, but the renderer and editor must treat it as a non-message row.

Examples of supported authored text:

- Date: `Today`, `Monday`, `12 August 2026`.
- System: `Alex added Sam`, `You changed the group description`, `Messages are end-to-end encrypted`.

Do not generate an encryption claim automatically. If an author wants that fictional chrome, they must explicitly add it as a system event.

### 5.10 One primary media type per message

An ordinary message may contain:

- optional reply context;
- text;
- zero to four image attachments **or** one `whatsappMedia` item;
- optional link preview only when there is no image/audio/video payload;
- optional reactions;
- timestamp and outgoing delivery state.

Reject contradictory combinations in UI, project-file validation, local-storage sanitization, and preflight. Do not silently drop the second content type.

## 6. Target authoring experience

### 6.1 WhatsApp settings

The primary settings sheet should expose only scene-wide presentation:

- Theme: Light / Dark.
- Frame: Bubbles only / Chat header / Phone frame.
- Auto-alternate senders.
- Checkmarks.
- For one-to-one chats: show status and status text.
- For group chats: subtitle mode—Member names / Participant count / Custom / Hidden.
- Optional custom group subtitle when Custom is selected.

Advanced settings:

- Header background image.
- Footer/input-bar background image.
- Chat wallpaper image.
- Fixed-height scroll window toggle and height, only in Phone frame.

Do not show controls that are ignored by the active mode. For example, hide footer settings in Bubbles only and hide one-to-one online status in group mode.

### 6.2 Composer

For ordinary messages, keep the default composer compact:

- Speaking as / direction selector.
- Main text field.
- Send button.
- Message options button.

The options tray should contain named sections:

**Metadata**

- Timestamp: Automatic or custom.
- Delivery status for outgoing messages: Automatic / Sending / Sent / Delivered / Read.

**Reply**

- No reply / Reply to earlier message.
- Target picker showing speaker, text/media label, and timestamp.

**Content**

- Text and emoji.
- Images (1–4) with alt/decorative controls and reorder/remove.
- Link preview.
- Voice message.
- Video message.

**Reaction**

- Default WhatsApp reaction choices plus custom emoji.
- Add count and up to three reaction entries.

Add a small composer mode control for **Message / Date divider / System event**. When Date or System is selected, replace irrelevant fields with one text input and an **Add divider/event** action.

The send button must use the same validity predicate as submission. It must never be enabled for data that `handleSend` silently refuses.

### 6.3 Existing-message editor

Create `src/components/WhatsAppMessageExtrasEditor.tsx`, parallel in purpose to `TwitterPostExtrasEditor.tsx`, and use it from both `ComposeBar.tsx` and `MessageTimeline.tsx`.

The component owns:

- reply target;
- image list;
- link preview;
- voice/video media;
- reactions;
- event kind/text where applicable;
- inline validation and mutually exclusive content switching.

Do not implement two different forms with two different defaults. A message created in the composer and the same message reopened in the timeline must expose the same model.

### 6.4 Group people editor

In WhatsApp group mode:

- Continue using the scene cast and stable `characterId` bindings.
- Replace the unrestricted color input with the fixed WhatsApp tone palette.
- Show the selected tone beside the participant name.
- Explain that the color styles the sender name, not the person's avatar.
- Do not render a participant avatar in every message bubble.
- Continue using the group avatar only in the header.

### 6.5 Error and empty states

- A missing reply target is a blocking message-level error with a direct **Remove reply** action.
- An audio/video URL with a bad scheme, unsupported MIME type, or incomplete caption metadata is a blocking error.
- A link preview with no valid HTTPS URL is a blocking error.
- Missing media transcript/description/captions is a warning, not a blocker.
- An image missing alt text or a decorative mark remains a warning.
- Empty events are blocked.
- Empty ordinary messages are allowed only when they contain a valid image/media/link payload.

## 7. Canonical data model

Add these types to `src/lib/schema.ts` or a platform model imported by it:

```ts
export type WhatsAppParticipantTone =
  | 'green' | 'teal' | 'lime' | 'yellow'
  | 'orange' | 'red' | 'pink' | 'magenta'
  | 'purple' | 'violet' | 'blue' | 'cyan';

export interface WhatsAppReply {
  messageId: string;
}

export interface WhatsAppLinkPreview {
  url: string;
  title: string;
  siteName?: string;
  description?: string;
  image?: Attachment;
}

export interface WhatsAppReaction {
  emoji: string;
  count?: number;
}

export interface WhatsAppEvent {
  kind: 'date' | 'system';
  text: string;
}
```

Extend `GroupParticipant` with `whatsappTone?: WhatsAppParticipantTone` and extend `Message` with:

```ts
whatsappReply?: WhatsAppReply;
whatsappLinkPreview?: WhatsAppLinkPreview;
whatsappMedia?: WhatsAppMedia;
whatsappReactions?: WhatsAppReaction[];
whatsappEvent?: WhatsAppEvent;
whatsappStartNewRun?: boolean;
```

Extend settings with:

```ts
androidFrameMode?: 'bubbles' | 'header' | 'phone';
androidGroupSubtitleMode?: 'members' | 'count' | 'custom' | 'hidden';
androidGroupSubtitleText?: string;
androidWallpaperUrl?: string;
androidScrollable?: boolean;
androidViewportHeightEm?: number;
```

Defaults:

- `androidFrameMode: 'header'`;
- `androidGroupSubtitleMode: 'members'`;
- `androidScrollable: false`;
- `androidViewportHeightEm: 30`;
- no reply, link, media, reaction list, event, or forced run boundary.

## 8. Platform model and validation

Create `src/lib/whatsapp.ts`. Do not scatter these rules across components and the renderer.

Required exports:

```ts
export const WHATSAPP_PARTICIPANT_TONES: ...;
export function resolveWhatsAppSpeakerKey(project, message): string;
export function isSameWhatsAppRun(project, previous, current): boolean;
export function validateWhatsAppReply(project, message, index): string[];
export function validateWhatsAppLinkPreview(preview): string[];
export function validateWhatsAppMedia(media): string[];
export function normalizeWhatsAppReactions(reactions): WhatsAppReaction[];
export function validateWhatsAppMessage(project, message, index): string[];
export function whatsappMessageLabel(message): string;
```

Validation requirements:

- All remote link/media/poster/caption URLs are absolute HTTPS.
- Reject `<`, `>`, raw iframe/audio/video markup, `javascript:`, `data:`, and unsupported protocols.
- Reply target exists, precedes the reply, is not an event, and is not the same message.
- Audio/video MIME type matches the allowed set.
- Caption URL requires language and label.
- Link title and URL are required; cap title/site/description lengths.
- At most four images, three reactions, and 100 total scene items.
- Reaction emoji is a single grapheme and count is an integer in range.
- Event rows contain only the event payload plus ID/order metadata.
- Media/link/images obey the exclusivity contract in section 5.10.
- Group messages reference a valid scene/group participant when incoming.

## 9. Renderer contract

### 9.1 Refactor before adding blocks

`msgHTML` is already too broad and currently builds overlapping shared and platform-specific chat markup. Extract WhatsApp-specific composition rather than adding more conditionals to the shared function.

Recommended structure:

```ts
function whatsappMessageHTML(message, project, context): string;
function whatsappReplyHTML(...): string;
function whatsappLinkPreviewHTML(...): string;
function whatsappMediaHTML(message, renderMode): string;
function whatsappReactionsHTML(...): string;
function whatsappEventHTML(...): string;
```

The generic renderer can still share text formatting, sanitization, image helpers, timestamp helpers, and identity resolution with iOS.

### 9.2 Bubble structure

Use AO3-allowed semantic elements only. A recommended ordinary-message skeleton is:

```html
<div class="row in first" data-message-id="…">
  <dl class="msg">
    <dt class="visually-hidden">Alex: </dt>
    <dd class="bubble in has-reply has-link">
      <b class="group-sender wa-tone-purple">Alex</b>
      <blockquote class="wa-reply">…</blockquote>
      <span class="message-text">…</span>
      <a class="wa-link-preview" href="https://…">…</a>
      <span class="time">10:14</span>
      <span class="wa-reactions">…</span>
    </dd>
  </dl>
</div>
```

`data-message-id` is editor-only and may be stripped from Work Text as today. Never depend on it for AO3 styling.

In a styled group chat, the visible `group-sender` is enough attribution. Avoid emitting a second hidden speaker label there if it produces duplicate skin-off speech. Measure the final skin-off text and screen-reader order rather than assuming.

### 9.3 Reply card

- Use `blockquote` or an allowed nested block, not a button.
- Apply a fixed accent border using the replied-to speaker's tone where available.
- Include sender name and a one-to-three-line visible excerpt.
- For image/audio/video targets, add a concise type label such as `Photo`, `Voice message`, or `Video`.
- Hidden/skin-off text must say `Replying to Alex: …`.
- The reply card is display-only; AO3 cannot navigate to or expand the original message.

### 9.4 Link preview

- Use a real `<a href>` so AO3 adds its normal `rel="nofollow"` behavior.
- Give an optional image explicit width/height attributes and alt/decorative treatment.
- Display title, description, and site name in that order.
- Preserve the full URL in skin-off/transcript output even if the styled card visually shortens it.
- Do not use remote favicons or request a domain logo.

### 9.5 Image layout

Support one to four attachments in the renderer and editor.

- One image: full card width.
- Two: two equal columns.
- Three: one large image plus two stacked images, or a stable three-cell layout that survives AO3 paragraph injection.
- Four: 2×2 grid.
- Avoid `gap`; use margins as in the Twitter grid.
- Avoid `object-fit`; accept letterboxing/cropping limitations or use fixed containers with overflow only after raster/AO3 testing.
- Every image keeps width/height attributes for skin-off/download safety.
- Text acts as the media caption and should sit above or below consistently.

### 9.6 Voice message static card

Build the waveform from ordinary spans and fixed height classes, not SVG and not a remote waveform image. For example, emit 24 bars using six reusable height classes selected from a deterministic seed based on the message ID.

The card includes:

- play symbol as decorative text/CSS;
- waveform bars;
- duration or `Voice message` label;
- timestamp and ticks in their normal positions;
- transcript indicator when a transcript exists.

In `ao3-work` mode, add a visible native `<audio controls>` inside the card. Do not set opacity to zero.

### 9.7 Video message

Static mode renders poster, play symbol, duration, description, and source link. AO3 mode emits a native `<video>` with `<source>` and optional `<track>` using the same narrowly generated pattern already proven for Twitter.

Do not reuse the Twitter card class names; the data validation and low-level media helpers may be shared, but the presentation is WhatsApp-specific.

### 9.8 Events

Date events use a compact centered pill. System events use a wider centered informational row. Neither receives a bubble tail, speaker, timestamp, delivery tick, or reaction.

Both must remain ordinary visible prose with Creator's Style off.

### 9.9 Header and frame

- Bubbles mode omits header and footer entirely.
- Header mode includes contact/group identity and the full conversation.
- Phone mode adds input-bar chrome.
- Group subtitle `members` lists participant names and truncates visually with CSS; full names remain in source order for skin-off reading.
- All icons are decorative. Prefer CSS/text shapes or a single maintained platform asset over multiple third-party images.
- Header avatar alt should not duplicate adjacent contact text. Use empty alt for a decorative avatar when the name is already visible.
- Wallpaper URL is optional and receives the same external-host warning as other persistent work-skin images.

## 10. CSS and AO3 constraints

All new CSS must:

- begin under `#workskin`;
- survive `lintAo3Css(css, 'work')`;
- work after AO3 injects `<p>` wrappers;
- use em/rem sizing for platform geometry;
- avoid custom properties, `var()`, `position:fixed`, `gap`, `calc()`, `object-fit`, unsupported selectors, and comments in exported CSS;
- avoid inline style as a functional dependency;
- avoid SVG because AO3 removes it with its contents;
- avoid `aria-*` because AO3 strips those attributes;
- keep light/dark rules namespaced to the WhatsApp container and compatible with the master skin.

Add a blocking HTML-contract check for `style=` in generated Work Text. The current group sender markup proves why this matters: locally valid inline styles can disappear silently on AO3.

Use explicit tone classes and enumerated theme rules. Do not attempt arbitrary per-project CSS variables.

## 11. Export and privacy contract

### 11.1 Save PNG

- Capture every authored message/event.
- Disable the fixed-height scroll viewport during capture.
- Verify 1× and 2× output.
- Ensure reply/link/media cards, reactions, timestamp, and ticks never overlap.
- Use static audio/video cards only.

### 11.2 Hosted AO3 image code

- Upload only PNG blobs produced by the scene renderer.
- Never send audio/video URLs or bytes to ImgBB.
- Preserve existing privacy choice copy.
- Chunk on safe message boundaries. Never split a reply card from its owning message or a reaction from its bubble.
- If a scene is partitioned, repeat enough frame context to make each image understandable without duplicating messages.

### 11.3 Work Skin

- `buildWorkSkin` calls `buildHTML(project, 'ao3-work')` as it does for Twitter.
- Native media uses direct external URLs and remains visibly controllable.
- Source links and transcript/description survive when playback fails.
- Bump `MASTER_SKIN_VERSION` after the WhatsApp CSS block changes.
- Re-run namespace and cross-platform computed-style tests so WhatsApp selectors cannot alter iOS, Twitter, or Google.

### 11.4 In-app network behavior

- Main preview does not instantiate audio/video or fetch link pages.
- An author must click to load a media preview.
- Poster/preview images behave like existing user-supplied images and may request their hosts.
- Explain that media is streamed from its current external host on AO3.
- Never describe external media as uploaded to or preserved by AO3.

## 12. Persistence and project files

Update all four boundaries in the same change:

1. `src/lib/schema.ts` — types and defaults.
2. `src/lib/storage.ts` — local sanitization, caps, URLs, mutually exclusive content.
3. `src/lib/projectFile.ts` — strict import/export validation and schema version.
4. `docs/PROJECT-FILE-SCHEMA.md` — human-readable contract and examples.

Project-file validation must reject malformed state rather than silently trimming away an authored block. Local storage may safely normalize duplicate reactions and cap arrays, but must not turn an invalid media URL into a blank, apparently valid media card.

Include WhatsApp media, link-preview images, posters, and caption URLs in remote-resource summaries and backup warnings.

No WhatsApp migration functions are required under the product decision in section 2.

## 13. Transcript and preflight

Extend `buildSceneTranscript` so WhatsApp output includes:

- date/system events on their own lines;
- `Alex replied to Sam: excerpt` before the new message;
- image labels and alt text;
- link title, description, and full URL;
- `[Voice message, 0:12]`, transcript, and source URL;
- `[Video, 0:42]`, description/captions, and source URL;
- reaction emoji and counts;
- delivery state only when useful, without repeating decorative ticks as noisy prose.

Extend `buildWorkSkinPreflight` with:

- invalid/missing reply targets — block;
- contradictory primary content — block;
- invalid link/media URLs or MIME types — block;
- incomplete caption metadata — block;
- missing audio transcript or video description/captions — warn;
- missing poster for video — warn;
- missing image/link-preview alt text — warn;
- expiring host warnings for all new remote resources — warn;
- inline `style` in Work Text — block;
- fixed-height phone frame with an image export — informational assurance that capture expands it.

## 14. Exact implementation map

| File | Required work |
| --- | --- |
| `src/lib/schema.ts` | Add WhatsApp types, message fields, participant tone, frame/subtitle/wallpaper/scroll settings, and defaults. |
| `src/lib/whatsapp.ts` | New source of truth for palette, run grouping, validation, normalization, labels, and reply lookup. |
| `src/lib/generator.ts` | Extract WhatsApp renderer; add reply/link/media/event/reaction/image-grid markup; correct group runs and remove inline styles/avatar rows. |
| `src/components/WhatsAppMessageExtrasEditor.tsx` | New shared authoring surface for composer and timeline. |
| `src/components/ComposeBar.tsx` | Add message/event modes; use shared extras model and validation; permit attachment-only valid messages. |
| `src/components/MessageTimeline.tsx` | Use shared extras editor; show event-specific controls; add reply-safe deletion. |
| `src/components/SettingsSheet.tsx` | Add frame, subtitle, wallpaper, and scroll controls with conditional visibility. |
| `src/components/CastPanel.tsx` | Use WhatsApp tone swatches; remove the arbitrary color picker for WhatsApp. |
| `src/pages/index.tsx` | Handle reply-safe delete/update and any event-aware movement/duplication rules. |
| `src/lib/storage.ts` | Sanitize all new fields and enforce caps/exclusivity. |
| `src/lib/projectFile.ts` | Strictly validate all new fields and bump schema if required. |
| `src/lib/transcript.ts` | Add complete WhatsApp fallback prose. |
| `src/lib/preflight.ts` | Add WhatsApp-specific block/warn checks and inline-style contract. |
| `src/lib/workSkin.ts` | Include new CSS, AO3 media mode, master-skin variant, and version bump. |
| `src/lib/examples.ts` | Replace/add examples that exercise one-to-one replies, group events, link preview, voice, video, reactions, and dark mode. |
| `src/components/ExportPanel.tsx` | Ensure scrolling expands for raster capture and hosted chunks keep composite messages intact. |
| `docs/PROJECT-FILE-SCHEMA.md` | Document canonical WhatsApp v6 provider-aware media and no-guess policy. |
| `docs/WORK-SKIN-IMPLEMENTATION.md` | Record AO3 read-back, media rendering, and master-skin version after verification. |

## 15. Implementation sequence

Follow this order. Later steps depend on invariants established earlier.

### Phase 0 — Fixtures and failing tests

1. Add `tests/whatsapp-model.unit.spec.ts` with expected validation and run-group behavior.
2. Add fixture projects for one-to-one light/dark and group light/dark.
3. Pin the current inline-style failure with a Work Text test.
4. Pin the Alice → Bob group-run failure.
5. Add a skin-off expected transcript containing reply, link, audio, event, and reactions.

Do not start by polishing CSS. First create failures that describe the data and reading order.

### Phase 1 — Model and persistence

1. Add types/defaults.
2. Implement `src/lib/whatsapp.ts` validators and run logic.
3. Update local storage.
4. Update strict project files and schema documentation.
5. Update examples/fixtures to the canonical shape.
6. Make model and round-trip tests pass.

### Phase 2 — Core correctness

1. Extract the WhatsApp render path.
2. Group runs by resolved speaker.
3. Remove inline `style` from Work Text.
4. Replace group bubble avatar rows with tone-class sender names.
5. Verify plain text, image, emoji-only, timestamps, ticks, and existing reactions remain stable.
6. Run AO3 paragraph-injection, skin-off, namespace, and raster regression tests before adding new blocks.

### Phase 3 — Replies, links, events, and reactions

1. Add renderer helpers and CSS for reply cards.
2. Add link-preview renderer.
3. Add explicit event rows.
4. Add reaction-list normalization and pill rendering.
5. Implement the shared extras editor.
6. Wire composer and existing-message editing.
7. Implement reply-safe deletion.
8. Add transcript/preflight coverage.

### Phase 4 — Images and media

1. Reuse/adapt the existing attachment-list editor for 1–4 WhatsApp images.
2. Add static image layouts.
3. Add voice-message static waveform card.
4. Add video poster card.
5. Add consent-gated editor playback.
6. Add AO3 native audio/video markup.
7. Add MIME, CORS-host copy, caption, transcript, and poster warnings.
8. Prove ImgBB receives PNG only.

### Phase 5 — Frame modes and long chats

1. Add frame selector and conditional header/footer output.
2. Add group subtitle modes.
3. Add optional wallpaper.
4. Add optional fixed-height scroll viewport.
5. Force expanded height in raster/hosted-image capture.
6. Test long chats and mobile containment.

### Phase 6 — Master skin and release verification

1. Bump master-skin version.
2. Run CSS lint and comment-free export checks.
3. Run all single/master theme equivalence tests.
4. Perform 1×/2× PNG visual QA.
5. Save a current draft on AO3 with reply, link, group event, audio, video, and reactions.
6. Reopen the stored Work Text and skin; compare accepted elements, attributes, rules, and declarations.
7. Test Creator's Style off.
8. Download HTML/EPUB and inspect fallback reading order.
9. Record observed facts and remaining external-host limitations in the implementation documentation.

## 16. Required automated tests

### 16.1 Unit/model

- Speaker-run grouping distinguishes two incoming group participants.
- A date/system event splits runs.
- Reply target must be earlier, present, ordinary, and not self.
- Invalid/contradictory content is rejected.
- Reaction normalization merges duplicates and caps counts/length.
- Link/media HTTPS and MIME validation.
- Project file round-trips every field.
- Local storage retains every field and strips unsupported input.
- Participant tone maps to stable light/dark classes.

### 16.2 Renderer/AO3

- Generated Work Text contains no `style=`.
- Generated CSS has no comments, `gap`, `var()`, custom properties, fixed positioning, SVG dependency, or unsupported declarations.
- Reply/link/media/event markup uses only AO3-supported elements/attributes.
- AO3 mode emits native audio/video; static mode emits neither.
- Captions use `<track>` only in AO3 mode.
- Skin-off output has correct speaker and narrative order without duplicate group names.
- AO3 paragraph injection does not change measured geometry materially.
- Single-platform and master-skin WhatsApp renders match in light/dark.
- WhatsApp selectors do not change iOS/Twitter/Google computed style.

### 16.3 Authoring E2E

- Create and edit a reply.
- Create a manual link preview with image alt text.
- Create voice and video messages, then remove/switch content type.
- Create multiple counted reactions.
- Add date and system events.
- Build a group conversation with two incoming participants and tone changes.
- Delete a replied-to message through the confirmation flow.
- Use every frame mode and conditional setting.
- Complete the same core flows at a 360 px viewport.

### 16.4 Raster and hosted export

- Light/dark one-to-one and group scenes at 1× and 2×.
- Reply card with long names and long excerpt.
- Link card with/without image.
- One-, two-, three-, and four-image messages.
- Voice waveform and video poster.
- Multiple reactions never overlap text, ticks, timestamp, or next row.
- Fixed-height preview expands to full content for PNG.
- Hosted upload body is PNG and never contains media bytes/URLs as uploaded files.

## 17. Manual visual matrix

Capture and inspect this minimum matrix:

| Scene | Theme | Width | Surfaces |
| --- | --- | --- | --- |
| One-to-one plain + replies | Light/Dark | 360/desktop | Preview, PNG, Work Skin |
| Group with Alice/Bob alternating | Light/Dark | 360/desktop | Preview, PNG, skin off |
| Link + 1–4 images | Light/Dark | 360 | Preview, PNG, injected AO3 fixture |
| Voice + video | Light/Dark | 360 | Static, AO3 media HTML, source fallback |
| Date/system + reactions | Light/Dark | 360 | Preview, PNG, transcript |
| 50-message phone frame | Light/Dark | 360/desktop | Scroll preview, expanded PNG, hosted chunks |

Inspect for:

- correct speaker-run tails;
- no participant color loss;
- no duplicate group speaker names;
- no reaction overlap;
- no text hidden under time/ticks;
- no clipped media controls;
- readable link/reply cards;
- full PNG height despite scroll mode;
- sensible reading with all CSS disabled.

## 18. Acceptance criteria

The WhatsApp improvement is complete when all of these are true:

1. A user can author every P0/P1 feature without editing JSON.
2. Alice followed by Bob in a group produces two speaker runs.
3. WhatsApp Work Text contains no functional inline styles.
4. Participant colors survive AO3 through fixed classes in both themes.
5. Replies are stable references with safe deletion behavior.
6. Link previews are manual, HTTPS-only, and remain real links with the skin off.
7. Audio/video are never fetched in the main preview without consent and are never uploaded/rehosted by the app.
8. AO3 mode emits playable native media; PNG/ImgBB mode remains static.
9. Media has source and accessible fallback text; missing transcript/description/captions warns.
10. Date and system events remain ordinary prose without the skin.
11. Up to four images and three counted reactions render and round-trip.
12. Fixed-height mode never clips PNG or hosted-image output.
13. Single-platform and master work skins pass the AO3 CSS audit and namespace tests.
14. Desktop/mobile authoring, unit, AO3 injection, skin-off, raster, and hosted-export suites pass.
15. A fresh AO3 save/read-back confirms the final HTML/CSS, Creator's Style-off behavior, and external-media limitations.

## 19. Explicit non-goals

Do not add these while implementing this plan:

- WhatsApp API integration or real account data;
- message sending, editing, deletion timers, view-once enforcement, calls, Status, channels, payments, communities, or live presence;
- automatic link scraping;
- user-supplied raw HTML/iframe/audio/video markup;
- audio recording, transcoding, waveform analysis, proxying, caching, or rehosting;
- image/audio/video storage on ImgBB beyond the final rendered PNG;
- a wholesale rename of internal `android` identifiers;
- legacy WhatsApp project migration;
- refactoring iOS unless a shared change is necessary and separately regression-tested.

## 20. Developer handoff checklist

Before declaring the work done, the implementer must be able to answer **yes** to each question:

- Did I implement authoring as well as rendering?
- Is every new field validated at UI, local-storage, project-file, renderer, and preflight boundaries?
- Can two incoming group speakers ever be merged accidentally?
- Does Work Text contain any inline style that AO3 will strip?
- Does every remote URL use a narrowly validated HTTPS field rather than raw markup?
- Does the app ever fetch or upload audio/video without an explicit, documented reason?
- Does ImgBB receive only PNG output?
- Is every media/link/reply/event understandable with Creator's Style off?
- Does the fixed-height option expand during raster capture?
- Did I test light/dark, one-to-one/group, desktop/mobile, single/master skin, and 1×/2× raster?
- Did I reopen the final AO3 draft rather than trusting Preview alone?
- Did I update the implementation and schema documentation with observed results?

If any answer is no, implementation is not 100% complete.

## 21. Implementation record — 13 August 2026

The local application work in this plan is complete. The implementation now
includes the v6 schema and strict project-file boundary; complete composer and
existing-message authoring; stable reply references and guarded deletion;
speaker-run grouping; group tones; frame and scroll modes; links; one-to-four
image layouts; reactions; date/system events; audio and direct video; transcript
and preflight coverage; local recovery; static preview/PNG/hosted export; native
AO3 media; the single and master work skins; and the rich group example.

The final local gate records:

- TypeScript and optimized Next production build pass.
- 323 unit tests pass and one account-dependent AO3 readback test is skipped.
- Desktop and mobile WhatsApp authoring pass, including explicit direct-video
  consent and zero players after sending.
- AO3 paragraph injection, Creator's Style-off reading, master-skin theme
  parity, and cross-platform namespacing pass.
- Real full-height 1× and 2× PNGs pass dimension and static-media checks.
- Hosted export sends one raw PNG body and no audio/video source URL.

During raster inspection, the legacy export clone's absolute Android header
coordinates were removed because they hid group identity, and nested rich
cards received capture-only separation to prevent overlap. The live renderer
remains the geometry owner. These lessons and Twitter's three-surface direct-
media contract are preserved in `WORK-SKIN-IMPLEMENTATION.md` §17a–17c.

Acceptance item 15 is deliberately not marked passed. It requires an
authenticated human AO3 session to save and reopen the final v6 HTML/CSS, then
inspect the page with Creator's Style disabled. Local simulation is evidence,
but it is not a substitute for that archive read-back.

### Post-implementation media repair

The final media audit tightened two details. AO3 mode now *replaces* the
decorative waveform/poster body with the native player rather than stacking
both representations. Static video without a supplied poster has a
deterministic local placeholder and still performs no media request. Changing
any direct-media field after loading the editor preview immediately unmounts
the player and requires explicit consent again. Both surfaces retain duration,
transcript/description, captions, and the ordinary source link.

WhatsApp audio and direct video use HTTPS media files; WhatsApp YouTube video
uses the same structured provider URL and approved privacy-enhanced iframe as
Twitter. Project files, local recovery, Work Text, and source links store only
URLs and metadata. ImgBB receives the finished PNG only—never audio/video bytes,
a media multipart upload, or a media source URL in the request body.
