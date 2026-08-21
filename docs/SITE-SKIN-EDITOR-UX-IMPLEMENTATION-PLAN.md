# Site Skin Editor UX Rework - Implementation Plan

**Written:** 21 August 2026
**Scope:** `/site-skin` template gallery, editor shell, preview controls, dialogs,
and AO3 installation handoff
**Audience:** the developer implementing the work, including a developer who has
not worked in this codebase before
**Status:** implemented and verified locally on 21 August 2026. Sections 14 and
19 contain the completed acceptance record and maintainer handoff.

---

## 1. Start here

This is a **UX-shell rework**, not a site-skin compiler rewrite.

The product already has the hard part:

- sixteen launch templates;
- one `compile(theme)` result shared by preview and export;
- a strong AO3 compatibility model;
- contrast checks and one-click repairs;
- autosave, restore, and editable JSON backup;
- a picture/website palette extractor;
- 34 passing desktop journeys and extensive compiler tests;
- real-AO3 save/readback evidence documented in
  `SITE-SKIN-IMPLEMENTATION.md`.

Do not spend this sprint adding another visual control. The authoring shell is
now the limiting part of the product.

The implementation must deliver four outcomes, in this order:

1. **Nothing is unreachable or silently lost.** Fix mobile reachability, redo,
   template replacement, and dialog focus first.
2. **Experimentation feels safe.** Undo and redo are visible, reliable, and
   branch correctly. Replacing a saved theme is an explicit choice.
3. **The editor is understandable at a glance.** Mobile uses one pane at a time;
   desktop keeps the split view; controls use progressive disclosure.
4. **The product preview sells the theme.** The default mock is calm and
   realistic. The deliberately open AO3 components remain available in an
   explicit inspection mode so test coverage is not traded away.

The release is not complete when the controls render. It is complete only when
the journeys and measurements in section 14 pass and the screenshots in section
15 have been read by a person.

---

## 2. Evidence from the current product

This plan follows a source audit and a local Playwright pass against
`http://localhost:3001/site-skin` using the repository's installed Edge channel.

### 2.1 What passed

- `tests/site-skin.spec.ts`: **34/34 desktop journeys passed**, serially, in
  approximately 3.5 minutes.
- A focused unit run covering the site-skin compiler, palettes, and font
  classification: **326/326 passed**.
- The desktop page has no document-level horizontal overflow at 1440 x 1000.
- The preview iframe still receives the exact exported CSS string.

These results matter because they define what this rework must preserve. A green
compiler suite is not evidence that the editor journey is good; it is evidence
that the engine underneath it should be disturbed as little as possible.

### 2.2 Confirmed defects

| Severity | Defect | Measured evidence | Source cause |
| --- | --- | --- | --- |
| P0 | Most mobile controls are unreachable | At 412 x 915 the editor rail measured about 3,063px high inside a 915px document. The document itself did not scroll, and assigning `scrollTop` to the rail changed nothing | `site-skin.tsx` gives the mobile editor `flex-shrink-0 overflow-y-auto` without a bounded height, while an ancestor clips overflow |
| P0 | Redo stops working after an undo settles | Page pattern: None -> Ticking -> Gingham -> Undo produced Ticking. After the 500ms save/history cycle, Redo stayed on Ticking | the persistence effect always appends the current theme to the end and moves `historyIndex` there; it does not compare against `history[historyIndex]` or truncate a branch |
| P0 | Export dialog focus escapes behind the modal | Focus remained on the header's `Copy to AO3` button. The next ten Tab presses all visited editor controls outside the dialog | `ExportSkinDialog` has `role="dialog"` and `aria-modal`, but no focus entry, trap, restoration, or body scroll lock |
| P0 | Template selection replaces saved work without warning | A changed Moonlit Library theme was replaced with Paper & Ink without a dialog; reload offered `Keep editing "Paper & Ink"` | `handleSelectTemplate` resets theme and history immediately; autosave then replaces the only storage slot |
| P1 | The default preview reads as broken/busy | Browse shows the navigation menu and autocomplete suggestions open simultaneously over the page | `mockPage.ts` deliberately exposes test states in the only user-facing preview mode |
| P1 | Mobile header is not usable at compact widths | At 412px the theme name collapsed to `M`, `Copy to AO3` wrapped to three lines, and the header grew to 97px | all desktop header actions share one wrapping flex row |
| P1 | The control rail has excessive decision load | The editor exposes seven full groups at once and the page contained 53 buttons plus seven form controls in the audited state | `ThemeEditor` uses static `SectionDivider`s; the existing `AdvancedSection` is not used and is not sufficient for the desired controlled behavior |
| P1 | The gallery asks users to reject templates before seeing them | The large `None of these?` palette form appears before filters and all sixteen cards; templates begin far below the hero, especially on mobile | `TemplateGallery` renders the full inline `PaletteFromImage` before the filters and grid |
| P1 | First-choice analytics obscures the journey | The fixed consent panel covered a large part of the first gallery card and the mobile editor controls | the global fixed banner publishes its height, but the gallery does not reserve it and the current mobile editor is not actually scrollable |

### 2.3 Audit screenshots

Generated evidence lives in `tmp/site-skin-ux-audit/`:

- `desktop-gallery.png`
- `desktop-editor.png`
- `desktop-preview.png`
- `desktop-export.png`
- `mobile-gallery.png`
- `mobile-editor.png`
- `mobile-editor-bottom.png`
- `mobile-export.png`

`mobile-editor.png` and `mobile-editor-bottom.png` are byte-for-byte the same
size and visually identical. That is useful evidence: attempting to scroll the
rail did not reveal the bottom controls.

---

## 3. Product decision

### 3.1 Primary user

Design for a reader who:

- knows what AO3 looks like but does not know CSS;
- may be on a phone;
- wants to start with a mood or with a fandom image;
- wants visible results quickly;
- is reasonably afraid of losing a look they have tuned;
- needs help with the AO3 installation steps.

Power users still receive every current control. They are not the default
information architecture.

### 3.2 North-star journey

A first-time mobile user can:

1. choose a template;
2. see it immediately;
3. make three meaningful changes;
4. undo one and redo it;
5. install the skin on AO3;

in under two minutes, without losing work or encountering an unreachable
control.

### 3.3 Starting route decision

Templates remain the visual default. The Magic Picker remains a first-class
alternative, but it must become a compact action rather than a full form placed
before all templates.

The gallery should communicate two routes:

- **Choose a look** - browse the sixteen templates.
- **Match a picture or website** - open the existing picker in a dialog.

Do not use the current phrase `None of these?` before the user has seen any of
the sixteen.

---

## 4. Scope and non-goals

### 4.1 In scope

- responsive editor shell;
- mobile Preview/Customize pane switch;
- responsive header actions;
- visible and correct undo/redo;
- template replacement confirmation;
- controlled editor accordions and per-section reset;
- calm preview mode plus explicit component-inspection mode;
- compact gallery entry to the Magic Picker;
- accessible site-skin dialogs;
- clearer save status;
- installation-oriented export dialog;
- consent clearance within the gallery/editor;
- desktop, tablet, mobile, keyboard, and focus tests.

### 4.2 Explicitly out of scope

- adding templates;
- adding theme controls;
- adding fandom/trademark-named palettes;
- changing `SiteSkinTheme` schema version;
- changing emitted CSS;
- changing `compile.ts`, `ao3Css.ts`, or `ao3Properties.ts`;
- changing colour extraction or website fetching;
- raw CSS editing;
- webfonts;
- multiple saved-theme/project management;
- account integration or automatic AO3 form submission;
- deployment;
- claiming a new AO3 save/readback gate has run.

If implementation appears to require one of these, stop and re-check the design.
This plan is intentionally shaped so none is necessary.

---

## 5. Target experience

### 5.1 Gallery - desktop

Order from top to bottom:

1. Back to all tools.
2. Product title and one-sentence promise.
3. Returning-theme card, only when a saved theme exists.
4. A compact row:
   - left: `Choose a template`;
   - right: secondary button `Match a picture or website`.
5. Mood filters.
6. Template grid.
7. Site-skin explanation and More Tools.

The first template row should be visible in an ordinary 900px-high desktop
viewport before scrolling when analytics consent has already been answered.

Replace the promise:

> Pick a look, personalize it, then install it on AO3. No CSS. About three
> minutes.

Do not say `no account`. The app itself requires no sign-in, but installing a
site skin happens inside an AO3 account. `No sign-in here` is acceptable if a
sign-in claim is still desired.

### 5.2 Gallery - mobile

- Keep the hero compact: no more than two short copy lines under the heading.
- Render the `Match a picture or website` action as a full-width secondary
  button, not the expanded form.
- Keep mood chips horizontally wrappable.
- At 412 x 915, at least one complete template card must be visible in the first
  viewport when analytics consent has already been answered.
- The analytics panel must not permanently cover a template; the page must
  reserve enough bottom scroll clearance for its measured height.

### 5.3 Editor - desktop

Keep the familiar split view:

```text
+-------------------------------------------------------------------------+
| Templates | Theme | AO3 ready | Saved | Undo Redo | Privacy | Install  |
+------------------------+------------------------------------------------+
| Customize, 340px       | Browse | Reading | Dashboard | Inspect toggle |
|                        +------------------------------------------------+
| Accordion sections     |                                                |
|                        |                 live preview                   |
| independently scroll   |                                                |
+------------------------+------------------------------------------------+
```

The preview remains the largest surface. The editor rail remains 340px unless a
real screenshot shows a control label being clipped.

### 5.4 Editor - mobile and tablet below `lg`

Do not stack a fixed preview above a full-height editor. Use one pane at a time:

```text
+------------------------------------------------+
| Back | Theme name | AO3 ready | Privacy | Install|
+------------------------------------------------+
| [ Preview ] [ Customize ]          Undo  Redo   |
+------------------------------------------------+
|                                                |
| one independently scrollable pane              |
|                                                |
+------------------------------------------------+
```

Rules:

- A new template opens on **Preview** so the choice is rewarded immediately.
- Selecting **Customize** gives the control rail the entire remaining height.
- The last pane may be remembered for a returning session, but selecting a new
  template must always return to Preview.
- Use `100dvh` for the app shell, with an `h-screen` fallback if needed. Mobile
  browser chrome must not make the bottom action unreachable.
- The active pane is in the DOM; the inactive pane may be hidden with
  `hidden lg:flex`. Do not move it off-screen with a large negative coordinate.
- Both panes require `min-h-0` and their own `overflow-y-auto` boundary.
- The full document must not scroll while the editor is open; the active pane
  scrolls.

### 5.5 Responsive header

Desktop visible labels:

- `Templates`
- full theme name;
- `Checks passed` plus reviewed date;
- `Saved` / `Saving...` / `Could not save`;
- Undo and Redo;
- `Privacy`;
- `Install on AO3`.

Mobile behavior:

- back action becomes icon-only with `aria-label="Templates"`;
- theme name uses `min-w-0 flex-1 truncate`, but must not be reduced to a single
  character at 360px;
- compatibility status becomes a compact check chip with a full accessible
  label containing the reviewed date;
- Privacy becomes an icon-only button with `aria-label="Privacy choices"`;
- primary action reads `Install`, stays on one line, and uses
  `whitespace-nowrap`;
- Undo/Redo live in the pane-switch row, not the crowded first row.

The header must remain one row and no action may overlap at 360, 390, or 412px.

### 5.6 Progressive editor sections

Replace passive `SectionDivider`s with a site-skin-specific controlled
`EditorSection` component.

Sections and the exact theme object they own:

| Section | Object key | Current controls |
| --- | --- | --- |
| Colours | `colors` | four swatches, Magic Picker, readability repairs |
| Type | `typography` | heading/body fonts, size, heading style, font caveat |
| Shape | `shape` | card corners, tag shape, tag colours |
| Header | `header` | gradient, banner URL, conditional banner controls, logo |
| Depth | `surface` | texture, elevation, glow, frame |
| Reading | `reading` | required tag words, group names, separator, stat icons |
| Details | `details` | ornament, divider, drop cap, scrollbar |

`Colours` starts open. All other sections start closed. Multiple sections may
be open at the same time; do not build a single-open accordion that closes the
previous section unexpectedly.

Each section header must contain:

- a real heading (`h2` or `h3` according to the page outline);
- a button with `aria-expanded` and `aria-controls`;
- the section name;
- one short current-state summary;
- a `Changed` dot when the section differs from its reset baseline;
- a chevron that is decorative (`aria-hidden`).

Suggested summaries:

| Section | Summary example |
| --- | --- |
| Colours | `Dark page - violet accent` or four small accessible swatches |
| Type | `Georgia - Default size` |
| Shape | `Soft corners - Pill tags` |
| Header | `Vertical fade - No banner` |
| Depth | `No pattern - Flat cards` |
| Reading | `AO3 defaults` or `2 options on` |
| Details | `No ornament - Divider off` |

Do not put raw implementation values such as `10px` or `smallCaps` in summaries.
Use the labels from the existing option arrays.

Inside an expanded section, show a quiet `Reset section` button only when that
section differs from its baseline. Its accessible name must include the
section, for example `Reset Header section`.

### 5.7 Reset baseline

Reset behavior must be deterministic:

1. For a catalog template, the reset baseline is a fresh clone of the matching
   template returned by `findTemplate(theme.meta.id)`.
2. For a generated Magic Picker theme or an imported theme without a matching
   catalog id, the reset baseline is the complete theme as it entered the
   editor in this session.
3. Selecting a new template replaces the baseline.
4. Restoring a backup replaces the baseline.
5. Applying a palette inside the editor does **not** replace the baseline; it is
   an edit and must remain undoable.

Keep this full theme in a dedicated `resetBaselineRef`. Do not reuse
`activationRef`: activation intentionally stores a canonical string and answers
a different product question.

Reset only the section's object key, through the same `updateTheme` path as any
other edit, so it becomes one undoable history entry.

### 5.8 Preview modes

Add a UI-only preview mode:

```ts
type PreviewMode = 'showcase' | 'inspect';
```

**Showcase is the default.** It should look like a plausible AO3 page:

- header navigation closed;
- autocomplete suggestions closed;
- no debug/coverage label inside the AO3 mock;
- ordinary page content remains visible;
- Browse, Reading, and Dashboard page tabs remain available.

**Inspect components** is explicit:

- header dropdown open;
- autocomplete open;
- all mock regions needed by compiler/browser tests visible;
- a small notice outside the iframe: `Showing open menus and form states`.

Implementation contract:

- Extend `mockDocument` with an options argument; do not fork it into a second
  document generator.
- Continue embedding the exact `css` argument in both modes.
- Keep all test fixtures that enforce invariant 4. Move their visibility behind
  `inspect`; do not delete them.
- Changing preview mode may reload the iframe because it changes the page DOM.
- Changing theme CSS must continue patching the existing style element without
  reloading the iframe or losing scroll position.

### 5.9 Installation dialog

The header action should be labelled **Install on AO3**, because clicking it
opens the installation flow; it does not currently copy anything.

Dialog order:

1. Heading: `Install your site skin`.
2. Compatibility success or blocking error.
3. Primary action: `Copy site skin CSS`.
4. After success, an `aria-live="polite"` message: `Copied. Keep this tab open
   while you paste it into AO3.`
5. The four numbered AO3 steps.
6. Optional `Open AO3` action only after its target has been verified in an
   authenticated and unauthenticated browser. If no stable direct create-skin
   URL exists, link to AO3 and retain the exact Preferences path in the steps.
7. `Show CSS for manual copying` disclosure containing the textarea. Open it
   automatically only when clipboard copy fails.
8. Conditional banner-hosting warning.
9. Collapsed `Editable theme backup` section.
10. Unofficial/OTW disclaimer.

Do not remove manual copying. Clipboard denial is an ordinary browser state and
the textarea is the fallback.

Do not automatically open AO3 after copy. Opening another site must remain an
explicit user action.

---

## 6. State architecture

### 6.1 Domain state that remains unchanged

Keep:

```ts
theme: SiteSkinTheme
previewState: 'browse' | 'reading' | 'dashboard'
```

Do not add pane, accordion, modal, or preview-inspection fields to
`SiteSkinTheme`. Those would enter backups, storage validation, every template,
and potentially analytics for no product reason.

### 6.2 New page-level UI state

Add to `SiteSkinPage`:

```ts
type MobilePane = 'preview' | 'customize';
type PreviewMode = 'showcase' | 'inspect';
type EditorSectionId =
  | 'colors'
  | 'typography'
  | 'shape'
  | 'header'
  | 'surface'
  | 'reading'
  | 'details';

const [mobilePane, setMobilePane] = useState<MobilePane>('preview');
const [previewMode, setPreviewMode] = useState<PreviewMode>('showcase');
const [openSections, setOpenSections] = useState<Set<EditorSectionId>>(
  () => new Set(['colors'])
);
const [pendingTemplate, setPendingTemplate] =
  useState<SiteSkinTheme | null>(null);
```

Also add:

```ts
const resetBaselineRef = useRef<SiteSkinTheme | null>(null);
```

Do not mutate a `Set` held in state. Always construct a new `Set` in the setter.

### 6.3 Optional UI preference persistence

Only `mobilePane` may be persisted, under a separate key such as:

```text
ao3SiteSkinUiPrefs
```

If implemented, validate the stored value by exact membership. A malformed
preference must fall back to `preview`. Do not persist `openSections`, modal
state, pending templates, or preview inspection mode. Inspection should always
start off.

This preference is optional for the first release. Correct reachability is not.

### 6.4 Save state

Keep the 500ms debounce and visible failure message. Render all three ordinary
states:

- `Saving...`
- `Saved`
- `Could not save`

The visible text can be compact, but the status container must use
`aria-live="polite"`. Do not announce `Saved` on every keystroke at assertive
priority.

---

## 7. Correct history behavior

The conversation editor already contains the correct algorithm in
`src/pages/index.tsx` around its persistence effect. Copy the behavior, not the
site-skin editor's current implementation.

### 7.1 Required commit algorithm

After the 500ms debounce:

1. Persist the current theme.
2. Compare the current theme with `history[historyIndex]`, not with the final
   entry in the array.
3. If they are equal, do not append. This is what prevents Undo/Redo from being
   recorded as new edits.
4. If different, discard every redo entry with
   `history.slice(0, historyIndex + 1)`.
5. Append the current theme.
6. Enforce the 50-entry limit.
7. Set the index to the actual final entry.

Equivalent pseudocode:

```ts
const current = history[historyIndex];
if (!current || serialize(current) !== serialize(theme)) {
  const next = history.slice(0, historyIndex + 1);
  next.push(theme);
  if (next.length > MAX_HISTORY) next.shift();
  setHistory(next);
  setHistoryIndex(next.length - 1);
}
```

Use the existing JSON comparison unless profiling demonstrates a problem. A
theme is small, and replacing it with clever partial comparisons would add more
risk than value.

### 7.2 Undo/Redo controls

Add visible buttons:

- Undo disabled when `historyIndex <= 0`.
- Redo disabled when `historyIndex >= history.length - 1`.
- Disabled styling must be visually clear and use the native `disabled`
  attribute.
- Accessible names: `Undo last change` and `Redo last change`.
- Desktop tooltips may mention `Ctrl/Cmd+Z` and `Ctrl/Cmd+Shift+Z`.

Keyboard behavior:

- Undo: `Ctrl+Z` and `Cmd+Z`.
- Redo: `Ctrl+Shift+Z`, `Cmd+Shift+Z`, and `Ctrl+Y`.
- Compare `e.key.toLowerCase()` so keyboard case does not create a platform bug.
- Do not intercept undo while focus is in the banner URL input if the browser is
  undoing uncommitted text. The page-level shortcut should run only when the
  active element is not an editable text control, or after the field has
  committed. Native input undo takes priority.

### 7.3 Required history tests

1. None -> Ticking -> Gingham -> wait 700ms -> Undo -> wait 700ms -> Redo ends
   on Gingham.
2. None -> Ticking -> Gingham -> Undo -> Dots makes Redo disabled and never
   returns to Gingham.
3. Reset Header section is one history entry.
4. Applying a Magic Picker palette inside the editor is one history entry.
5. Selecting a new template resets history to exactly one entry after explicit
   confirmation.
6. Restoring a backup resets history to exactly one entry.

---

## 8. Protecting the current theme

### 8.1 When confirmation is required

Selecting a gallery template requires confirmation when either is true:

- a stored theme already exists; or
- the gallery was reached from the editor in the current session.

It does not require confirmation on a first visit before anything has been
saved.

This deliberately favors safety. The product currently has one storage slot,
so replacing even an unmodified saved template removes the user's only return
point.

### 8.2 Interaction

`TemplateGallery` must not call `handleSelectTemplate` directly. It calls
`requestTemplate(template)`.

`requestTemplate` either:

- applies immediately on a clean first visit; or
- assigns `pendingTemplate` and opens the confirmation dialog.

Dialog copy:

> **Start over with Paper & Ink?**
> This replaces the theme currently saved in this browser. Your AO3 skin is not
> affected until you paste and use new CSS there.

Actions:

- secondary: `Keep current theme`;
- destructive: `Start with Paper & Ink`.

Do not label the destructive action simply `Continue`.

On confirmation:

1. clone the pending template;
2. replace theme;
3. replace both reset and activation baselines;
4. reset history to one entry;
5. set mobile pane to Preview;
6. close gallery and dialog;
7. clear `pendingTemplate`;
8. fire the existing `template_selected` event once.

Cancel clears `pendingTemplate` and returns focus to the card that was clicked.
The shared dialog shell handles focus restoration.

### 8.3 Resume remains prominent

Keep `Keep editing "Theme name"` above template replacement actions. It is the
only no-risk action for a returning user and should remain visually primary.

---

## 9. Accessible dialog shell

Create `src/components/ModalDialog.tsx` and use it for:

- `ExportSkinDialog`;
- `PaletteFromImageDialog`;
- template replacement confirmation.

Do not refactor unrelated dialogs in this change. `BottomSheet.tsx` is the
behavioral reference, not an instruction to widen scope.

### 9.1 Minimum API

```ts
interface ModalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  ariaLabel?: string;
  labelledBy?: string;
  maxWidthClass?: string;
  children: React.ReactNode;
}
```

Require exactly one of `ariaLabel` or `labelledBy` in usage, even if TypeScript
does not encode the union.

### 9.2 Required behavior

Mirror the proven behavior in `BottomSheet.tsx`:

- remember `document.activeElement` when opening;
- focus `[data-autofocus]`, otherwise the first enabled focusable element,
  otherwise the panel itself;
- include `a[href]` in the focusable selector;
- trap Tab and Shift+Tab inside the panel;
- close on Escape;
- restore focus to the opener on close;
- lock body scrolling while open and restore the previous inline overflow value;
- close on backdrop click;
- never close when clicking inside the panel;
- render `role="dialog"`, `aria-modal="true"`, and `tabIndex={-1}`;
- use a z-index above the first-choice analytics banner.

Remove the page-level Escape branches for export and palette once the shared
dialog owns Escape. Two independent close listeners are a future nested-dialog
bug.

### 9.3 Required dialog tests

For export and palette dialogs:

1. opening moves focus inside;
2. ten forward Tabs and ten reverse Tabs never leave;
3. Escape closes;
4. focus returns to the opener;
5. backdrop closes;
6. panel click does not close;
7. body scroll is restored after close.

Run at desktop and mobile widths.

---

## 10. Component-level implementation map

### 10.1 `src/pages/site-skin.tsx`

Owns:

- new page-level UI state from section 6;
- corrected history algorithm;
- reset baseline;
- template replacement request/confirmation;
- visible Undo/Redo handlers and capability booleans;
- responsive pane visibility;
- save status passed to the header;
- preview mode passed to `SkinPreview`;
- dialog composition.

Extract the header rather than making this already-large page harder to read.

### 10.2 New `src/components/siteSkin/SiteSkinToolbar.tsx`

Props should be data and callbacks, not the whole theme:

```ts
interface Props {
  themeName: string;
  violations: number;
  reviewedOn: string;
  saveStatus: 'saved' | 'saving' | 'failed';
  canUndo: boolean;
  canRedo: boolean;
  mobilePane: MobilePane;
  onShowTemplates: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onOpenPrivacy: () => void;
  onInstall: () => void;
  onMobilePaneChange: (pane: MobilePane) => void;
}
```

If `MobilePane` is defined in the page, move the type to a small UI types file
to avoid importing a page into a component.

### 10.3 New `src/components/siteSkin/EditorSection.tsx`

Controlled component. It must not own a private `open` state because the page
needs to open Colours when a readability issue appears and tests need a stable
contract.

Props:

```ts
interface Props {
  id: EditorSectionId;
  title: string;
  summary: React.ReactNode;
  open: boolean;
  modified: boolean;
  onToggle: () => void;
  onReset: () => void;
  children: React.ReactNode;
}
```

Do not reuse `SettingsRows.AdvancedSection`. It owns local state, has no summary,
modified state, reset action, or controlled open behavior. Changing it would
risk every other settings surface.

### 10.4 `src/components/siteSkin/ThemeEditor.tsx`

- Group the existing controls into seven `EditorSection`s.
- Do not change any control value, option order, help copy, or callback shape in
  the same commit.
- Accept open/modified/reset data from the page or from a small editor controller
  passed through props.
- Keep readability warnings inside Colours and automatically ensure Colours is
  open when an issue first appears.
- Keep conditional banner controls inside Header.
- Keep the font honesty copy; shortening it is a separate copy decision.

### 10.5 `src/components/siteSkin/SkinPreview.tsx`

- Accept `mode: PreviewMode` and `onModeChange`.
- Put the mode toggle beside Browse/Reading/Dashboard, outside the iframe.
- On compact widths, allow the preview toolbar itself to scroll horizontally or
  wrap into two tidy rows; do not clip Dashboard or Inspect.
- Retain the `A mock page - AO3 is not loaded` message.
- Update `srcdoc` when page state or preview mode changes.
- Continue patching only `SKIN_STYLE_ID` when CSS changes.

### 10.6 `src/lib/siteSkin/mockPage.ts`

- Change `mockDocument(state, css)` to
  `mockDocument(state, css, { inspect?: boolean } = {})`.
- Thread the flag into the header and Browse mock.
- Showcase: closed menu and no visible autocomplete suggestions.
- Inspect: current open menu and autocomplete behavior.
- Keep the inspected elements and AO3 selectors byte-for-byte where possible.
- Do not change AO3 base CSS merely to make the screenshot prettier. Visibility
  should be controlled by markup/classes/options, using rules faithfully
  transcribed from AO3 when CSS is necessary.

### 10.7 `src/components/siteSkin/TemplateGallery.tsx`

- Remove the full inline `PaletteFromImage` block.
- Add compact `Match a picture or website` trigger.
- Render the existing picker in `ModalDialog` using gallery placement.
- Change card callback from `onSelect` to `onRequestSelect` to make the safety
  boundary visible in the API.
- Keep whole-card buttons and mood filters.
- Keep resume above replacement actions.
- Add analytics only by reusing existing event paths; do not send URLs, colours,
  or image data.

### 10.8 `src/components/siteSkin/PaletteFromImage.tsx`

- Keep the extraction engine and `placement` analytics unchanged.
- Update `PaletteFromImageDialog` to use `ModalDialog`.
- Support a create-mode heading for gallery usage and the existing replace-four-
  colours heading for editor usage.
- Applying in the editor remains one undoable change and preserves fonts,
  shapes, reading, depth, and details.

### 10.9 `src/components/siteSkin/ExportSkinDialog.tsx`

- Migrate to `ModalDialog`.
- Reorder content according to section 5.9.
- Keep violation blocking behavior.
- Keep clipboard error analytics.
- Keep backup import safety behavior: download the current theme before replace;
  do not weaken it while moving the section.
- After backup restore, call the existing replacement callback so the page resets
  history and reset baseline together.

### 10.10 `src/components/AnalyticsConsent.tsx`

Make only contained changes:

- shorten the first-choice mobile copy without weakening the privacy claim;
- keep both explicit choices;
- keep analytics off until choice;
- keep the height CSS variable;
- add bottom clearance to the site-skin gallery and active editor pane using the
  published variable;
- do not silently grant or default consent;
- do not make the first-choice banner a modal that blocks all evaluation of the
  page.

Suggested compact copy:

> Help improve AO3 SkinGen with anonymous usage counts. No story text, names,
> images, links, or generated code. Analytics stays off unless you allow it.

The existing `analytics-consent.spec.ts` remains the policy gate.

### 10.11 Files that should not change

Unless a discovered regression proves otherwise, leave these untouched:

- `src/lib/siteSkin/theme.ts`
- `src/lib/siteSkin/templates.ts`
- `src/lib/siteSkin/compile.ts`
- `src/lib/siteSkin/colors.ts`
- `src/lib/siteSkin/ao3Css.ts`
- `src/lib/siteSkin/ao3Properties.ts`
- `src/lib/siteSkin/palette.ts`
- `src/lib/siteSkin/storage.ts`

If a diff includes generated CSS, stop. This UX rework should not alter one byte
of CSS for the same theme.

---

## 11. Implementation phases

### Phase 0 - lock current output and reproduce failures

Before changing UI:

1. Add a unit assertion that `compile(cloneTheme(template))` remains byte-stable
   for representative templates or capture hashes in the test if no byte-stable
   fixture already exists.
2. Add failing browser tests for:
   - mobile Details reachability;
   - settled Undo then Redo;
   - template replacement confirmation;
   - export focus containment.
3. Save before screenshots at 1440 x 1000, 768 x 1024, 412 x 915, and 360 x
   740.

Do not fix and test in the same unobserved step. Confirm each new test fails for
the reason it names.

### Phase 1 - P0 correctness and accessibility

Order:

1. Correct history commit and branch truncation.
2. Add visible Undo/Redo.
3. Build `ModalDialog` and migrate export/palette.
4. Add template replacement confirmation.
5. Replace mobile stacking with Preview/Customize panes.
6. Make editor pane genuinely scrollable and consent-aware.

Exit gate:

- all four reproduced failures pass;
- existing 34 site-skin journeys remain green;
- no generated CSS changes;
- mobile Details, including Themed scrollbar, is reachable and clickable.

### Phase 2 - information architecture

1. Extract responsive `SiteSkinToolbar`.
2. Add full save status.
3. Build controlled `EditorSection`.
4. Wrap all seven existing groups without changing control behavior.
5. Add modified summaries and reset baseline.

Exit gate:

- Colours open by default;
- all controls remain keyboard reachable;
- every reset is undoable;
- compact header passes all target widths;
- desktop preview/editor ratio is unchanged.

### Phase 3 - preview and gallery presentation

1. Add `PreviewMode`.
2. Make Showcase calm.
3. Preserve current coverage states in Inspect.
4. Replace gallery's inline picker with compact dialog trigger.
5. Tighten hero copy and first-viewport layout.
6. Add gallery/consent bottom clearance.

Exit gate:

- default preview contains no open overlay;
- Inspect exposes every region the existing browser tests need;
- one full template card appears in the mobile first viewport after consent;
- picture and website extraction still work from gallery and editor.

### Phase 4 - AO3 installation handoff

1. Rename header action to `Install on AO3`.
2. Reorder export content.
3. Add collapsed manual CSS and backup disclosures.
4. Add copied live status.
5. Investigate and verify a stable AO3 destination before adding `Open AO3`.

Exit gate:

- clipboard success and denial paths both work;
- blocked CSS still cannot be copied;
- all four AO3 instructions remain present;
- `add on to archive skin` remains explicit;
- backup download and guarded restore remain usable on mobile.

### Phase 5 - final regression and visual pass

Run section 15 in order. Do not combine this with new features.

---

## 12. Test architecture

### 12.1 Keep existing correctness journeys

`tests/site-skin.spec.ts` remains the compiler-to-control journey suite. Update
selectors only where the new accordion or action label requires it. Do not
replace compiled-CSS assertions with button-state assertions.

When a test needs a collapsed section:

```ts
await page.getByRole('button', { name: /Reading/ }).click();
```

Then keep the existing downstream CSS and geometry assertions.

### 12.2 Add `tests/site-skin-ux.spec.ts`

Desktop and keyboard behavior:

- default gallery puts templates before an expanded picker;
- returning theme resume;
- replacement confirmation/cancel/confirm;
- Undo/Redo including debounce and branch truncation;
- section open/close/summary/reset;
- save-state live region;
- showcase/inspect state;
- export and palette dialog focus behavior;
- installation dialog success and clipboard fallback.

### 12.3 Add `tests/site-skin-mobile.spec.ts`

Run only in the mobile project. Cover:

1. first template card visible in first viewport after pre-answering consent;
2. template opens on Preview;
3. Customize replaces Preview rather than stacking below it;
4. Details section and Themed scrollbar are reachable;
5. editor pane has `scrollHeight > clientHeight` and can reach its bottom;
6. document itself remains at viewport height and has no horizontal overflow;
7. pane switch and Undo/Redo remain visible;
8. header actions do not overlap at 360 and 412px;
9. export dialog scrolls internally and traps focus;
10. analytics consent does not make the final editor controls unreachable.

Use geometry, not only visibility. `toBeVisible()` can pass for an element that
is clipped outside the usable scroll container.

Required reachability assertion shape:

```ts
const pane = page.getByTestId('site-skin-customize-pane');
const details = page.getByRole('button', { name: /Details/ });
await details.scrollIntoViewIfNeeded();
await details.click();
await page.getByRole('switch', { name: 'Themed scrollbar' }).click();

const paneMetrics = await pane.evaluate(el => ({
  top: el.scrollTop,
  height: el.clientHeight,
  scrollHeight: el.scrollHeight,
}));
expect(paneMetrics.scrollHeight).toBeGreaterThan(paneMetrics.height);
expect(paneMetrics.top).toBeGreaterThan(0);
```

### 12.4 Consent setup

Most UX tests should pre-answer analytics so the feature under test is not
occluded:

```ts
await page.addInitScript(() => {
  localStorage.setItem('ao3skingen_analytics_consent', 'denied');
});
```

Dedicated consent tests must start with the key absent.

### 12.5 Focus helper

Add a small test helper that returns whether the active element is inside a
dialog. Do not expose production-only test APIs.

### 12.6 Output parity gate

For every catalog template, compile before and after this work from the same
commit boundary and compare the strings. The expected diff is empty.

If line order, declarations, selector order, or comments change, treat it as a
regression and find the accidental compiler path change.

---

## 13. Analytics

Reuse current events:

- `template_selected`
- `palette_applied`
- `project_activated`
- `export_started`
- `export_ready`
- `output_copied`
- `handoff_completed`
- `export_failed`

Do not add events for every accordion click. They are noisy and do not answer a
product question.

One optional useful event after launch:

```ts
{ name: 'site_skin_install_step', step: 'ao3_opened' }
```

Add it only if an explicit `Open AO3` action ships. Never include theme colours,
banner URLs, pasted website addresses, filenames, or CSS.

Do not change activation baselines while fixing reset baselines. They answer
different questions.

---

## 14. Acceptance criteria

### 14.1 P0 acceptance

- [x] At 360 x 740, 390 x 844, and 412 x 915 every section and every control is
  reachable.
- [x] Mobile Customize pane scrolls; the document does not.
- [x] Undo still works after waiting longer than the save debounce.
- [x] Redo works after that same wait.
- [x] A new edit after Undo removes the redo branch.
- [x] Undo/Redo buttons expose correct disabled states.
- [x] Replacing a saved theme requires named confirmation.
- [x] Canceling replacement preserves theme, history, and storage.
- [x] Export and palette dialogs contain focus and restore it on close.
- [x] Escape has exactly one owner per dialog.

### 14.2 UX acceptance

- [x] New mobile template opens to Preview.
- [x] Preview and Customize never compete for vertical space on mobile.
- [x] Mobile header is one row and primary action is one line.
- [x] Colours is the only editor section open by default.
- [x] Section summaries use user-facing labels.
- [x] Modified state and reset behavior match the baseline rules.
- [x] Reset is undoable.
- [x] Showcase preview has no open menu/autocomplete overlays.
- [x] Inspect preview exposes both.
- [x] Gallery Magic Picker is one compact action until invoked.
- [x] At least one full template card appears in the first mobile viewport after
  consent.
- [x] Save success, saving, and failure are visible and accessible.
- [x] Header action truthfully reads `Install on AO3`.
- [x] Clipboard failure opens/provides the manual CSS fallback.

### 14.3 Regression acceptance

- [x] All existing site-skin unit tests pass.
- [x] All existing site-skin browser journeys pass with `--workers=1`.
- [x] New desktop UX spec passes.
- [x] New mobile UX spec passes.
- [x] `npx tsc --noEmit -p tsconfig.json` passes.
- [x] `npm run build` passes.
- [x] Generated CSS is byte-identical for all sixteen templates.
- [x] Magic Picker picture and website routes still work.
- [x] Backup download, guarded restore, and banner validation still work.
- [x] No analytics or privacy test regresses.

Because emitted CSS does not change, this work does **not** reopen the AO3
sanitizer/readback gate. If emitted CSS changes, that statement becomes false.

---

## 15. Verification commands and visual QA

### 15.1 Start local app

Browser projects point at production by default. For local work:

```powershell
npm run dev
```

Warm `/site-skin` once before the browser suite; cold compilation can take long
enough to look like a test failure.

### 15.2 Automated checks

```powershell
npx playwright test --project=unit tests/site-skin.unit.spec.ts tests/palette.unit.spec.ts tests/font-classify.unit.spec.ts

$env:UX_BASE_URL='http://localhost:3000'
npx playwright test --project=desktop tests/site-skin.spec.ts tests/site-skin-ux.spec.ts --workers=1
npx playwright test --project=mobile tests/site-skin-mobile.spec.ts --workers=1

npx tsc --noEmit -p tsconfig.json
npm run build
```

If the dev server is on another port, change only `UX_BASE_URL`.

### 15.3 Screenshot matrix

Capture and inspect:

| Viewport | Gallery | Editor Preview | Editor Customize | Inspect | Export | Palette | Replace confirm |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1440 x 1000 | yes | yes | same split | yes | yes | yes | yes |
| 1024 x 768 | yes | yes | same split boundary | yes | yes | yes | yes |
| 768 x 1024 | yes | yes | yes | yes | yes | yes | yes |
| 412 x 915 | yes | yes | top and bottom | yes | yes | yes | yes |
| 360 x 740 | yes | yes | top and bottom | yes | yes | yes | yes |

For Customize, capture both the top and Details section after scrolling. They
must differ visibly.

### 15.4 What to inspect by eye

- first gallery card appears soon enough;
- theme cards still read as distinct;
- consent does not hide the only obvious next action;
- header text and actions do not collide;
- Preview/Customize selection is unmistakable;
- accordion summaries do not become a wall of secondary text;
- default preview looks like a believable AO3 page;
- Inspect looks deliberately diagnostic, not accidentally broken;
- compatibility status does not compete with Install;
- export primary action is obvious without reading CSS;
- focus ring is visible on every keyboard control;
- compact screens have no clipped final control.

Playwright geometry is good at confirming a defect and poor at judging visual
hierarchy. Read the pictures.

---

## 16. Commit boundaries

Use one commit per concern:

1. `test(site-skin): reproduce mobile history and dialog UX defects`
2. `fix(site-skin): make mobile panes reachable`
3. `fix(site-skin): repair undo redo history branching`
4. `fix(a11y): add modal focus containment for site skin dialogs`
5. `fix(site-skin): protect saved theme on template replacement`
6. `feat(site-skin): add responsive toolbar and editor sections`
7. `feat(site-skin): split showcase and component inspection previews`
8. `refactor(site-skin): make magic picker a compact gallery route`
9. `refactor(site-skin): streamline AO3 installation handoff`
10. `test(site-skin): add mobile and keyboard regression coverage`

Do not combine compiler changes with any of these commits.

---

## 17. Common wrong turns

### Do not fix mobile by making the whole document scroll

The editor is an app shell with a preview and fixed actions. The active pane is
the scroll boundary. A document-level scroll would make pane controls disappear
and reintroduce header/action reachability problems.

### Do not scale the desktop split view down on mobile

Two useful 400px-wide surfaces do not become useful at 200px each. Use one pane
at a time.

### Do not delete open mock components

They exist because invisible states shipped untested before. Put them behind
Inspect mode.

### Do not use `AdvancedSection` by changing it globally

It is shared and intentionally simple. The site editor needs controlled state,
summaries, modified status, and reset. Build a local component.

### Do not put UI state in `SiteSkinTheme`

That would force schema validation, template changes, backup changes, and
migrations for state that has no effect on a skin.

### Do not treat autosave as protection from replacement

There is one storage key. Autosaving the new template is exactly how the old one
is lost.

### Do not fix Redo with timing flags

The correct solution is to compare with the indexed history entry and truncate
the branch. Timeout guards will create another race around the 500ms debounce.

### Do not add `aria-modal` without behavior

The current dialog already proves that semantics alone do not contain focus.
Entry, trap, Escape, scroll lock, and restoration are all part of the component.

### Do not hide the CSS fallback

It may be collapsed after successful copy. It must open automatically when the
clipboard is denied.

### Do not claim the app installs the skin automatically

It prepares and copies CSS. The user still creates and enables the skin on AO3.

### Do not loosen compatibility checks for UX convenience

Blocked export is the correct behavior when the generated CSS would be refused.
The bug belongs to the generator, not the user.

---

## 18. Definition of done

This rework is done when:

1. every P0 acceptance item passes;
2. the mobile journey is usable at all target sizes;
3. the default preview is calm and Inspect retains full coverage;
4. saved work cannot be replaced silently;
5. Undo and Redo work before and after the save debounce;
6. site-skin dialogs are keyboard-contained;
7. all current site-skin capabilities remain available;
8. all sixteen templates emit byte-identical CSS;
9. automated gates pass;
10. the screenshot matrix has been opened and read;
11. no open issue is described as `known, deliberate` unless a product owner has
    explicitly accepted it after seeing the rendered result.

The desired result is not a prettier settings panel. It is a product that makes
experimentation feel safe, makes the result feel desirable, and gets a reader
from an idea to an installed AO3 skin without requiring them to understand the
machinery underneath.

---

## 19. As-built record and maintainer handoff

### 19.1 Completion summary

Implementation and local release verification completed on 21 August 2026.
Phases 1 through 5 are complete. The work remained a UX-shell rework: no theme
schema, catalog template, compiler, sanitizer, palette engine, or storage format
was changed.

Delivered behavior:

- correct, branch-aware Undo and Redo with visible controls and keyboard
  shortcuts;
- named confirmation before a catalog choice replaces current work;
- a shared accessible modal with focus entry, containment, Escape ownership,
  body scroll lock, backdrop dismissal, and focus restoration;
- one-pane mobile Preview/Customize navigation with independent pane scrolling;
- a responsive header that remains one row at 360, 390, and 412px;
- seven controlled editor sections with summaries, modified state, deterministic
  baselines, and undoable section resets;
- calm Showcase and explicit Inspect component states;
- a compact gallery route into the existing picture/website palette flow;
- an installation-oriented AO3 handoff with clipboard success feedback,
  automatic manual-copy fallback, and collapsed editable backup tools;
- protected backup restore and visible save state;
- consent-aware bottom clearance in the gallery and editor.

### 19.2 Final verification evidence

The final local run used `http://localhost:3001/site-skin` and the repository's
installed Edge channel. Browser projects point to production by default, so all
local browser commands set `UX_BASE_URL=http://localhost:3001`.

| Gate | Final result |
| --- | --- |
| Site-skin, palette, and font unit suite | 326/326 passed |
| Serial desktop site-skin + UX journeys | 43/43 passed |
| Mobile acceptance suite | 5/5 passed |
| Analytics, privacy, and site-theme backup journeys | 3/3 passed |
| TypeScript | passed |
| ESLint for every changed/new site-skin file | passed |
| Production build | passed with Next.js 16.1.6 |
| Protected compiler/theme source diff | empty |
| Visual QA | 40 states inspected across five viewports |
| Local health check | HTTP 200 on port 3001 |

The five visual-QA sizes were 1440 x 1000, 1024 x 768, 768 x 1024,
412 x 915, and 360 x 740. The permanent mobile suite additionally locks the
390 x 844 header geometry. Captured evidence is under:

```text
tmp/site-skin-final-qa/
```

The small black `N` visible at the lower-left corner of local screenshots is
the Next.js development indicator. It is not product UI and is absent from the
production build.

### 19.3 Key implementation files

New shared/editor-shell files:

- `src/components/ModalDialog.tsx`
- `src/components/siteSkin/EditorSection.tsx`
- `src/components/siteSkin/SiteSkinToolbar.tsx`
- `src/components/siteSkin/uiTypes.ts`
- `tests/site-skin-ux.spec.ts`
- `tests/site-skin-mobile.spec.ts`

Primary modified files:

- `src/pages/site-skin.tsx` owns page-level UI state, history, replacement,
  reset baselines, and responsive pane composition;
- `src/components/siteSkin/ThemeEditor.tsx` owns the seven section contents and
  summaries;
- `src/components/siteSkin/SkinPreview.tsx` owns Showcase/Inspect switching and
  iframe update behavior;
- `src/components/siteSkin/TemplateGallery.tsx` owns the compact gallery route;
- `src/components/siteSkin/PaletteFromImage.tsx` owns gallery/editor dialog copy;
- `src/components/siteSkin/ExportSkinDialog.tsx` owns the AO3 handoff;
- `src/lib/siteSkin/mockPage.ts` owns mock-state markup and AO3 base rules.

Protected files remained unchanged:

```text
src/lib/siteSkin/theme.ts
src/lib/siteSkin/templates.ts
src/lib/siteSkin/compile.ts
src/lib/siteSkin/colors.ts
src/lib/siteSkin/ao3Css.ts
src/lib/siteSkin/ao3Properties.ts
src/lib/siteSkin/palette.ts
src/lib/siteSkin/storage.ts
```

### 19.4 Important implementation learnings

#### Floated AO3 metadata must contain itself

The Reading preview initially allowed the `Stats:` row to paint into the next
work section. AO3's metadata rows are floats, and the mock transcription had
dropped `clear: right`, `position: relative`, and especially
`overflow: hidden` from `dl.meta`. Restoring AO3's real containment rule fixed
the preview without changing exported skin CSS. A browser geometry regression
now asserts:

```text
stats bottom <= metadata bottom <= work-skin top
```

When a preview looks wrong, compare the mock's base AO3 rule to the local AO3
stylesheet corpus before compensating in the compiler.

#### Controlled disclosures need a close-state lifecycle

The manual CSS `<details>` is controlled so clipboard failure can open it. Its
state originally reset only when the Install dialog opened. After one manual
copy, closing and reopening briefly preserved `open`; a test click then closed
the disclosure instead of opening it. Reset copied, error, and disclosure state
on every `isOpen` transition, including close.

#### Geometry catches reachability defects that visibility misses

`toBeVisible()` alone was insufficient for the mobile app shell. The permanent
tests measure pane scroll boundaries, document dimensions, header-child
overlap, dialog bounds, consent-panel clearance, and the first card's complete
viewport fit. Keep these assertions geometric.

#### Preview DOM and skin CSS have different update costs

Changing Browse/Reading/Dashboard or Showcase/Inspect may reload `srcdoc`
because the DOM changes. Ordinary theme edits must continue patching only the
iframe skin style element so scroll position and form state survive.

#### Test and build environment details are load-bearing

- `playwright.config.ts` defaults browser tests to the deployed site. Always set
  `UX_BASE_URL` for local work or a test can accurately report old production
  behavior.
- `next build` and `next dev` share `.next`. The verified build was run after
  stopping only the port-3001 dev process tree, then the hidden local server was
  restarted and warmed back to HTTP 200.
- The in-app browser connection was unavailable during final QA. The installed
  Edge Playwright channel produced the automated geometry results and the
  screenshot matrix.

### 19.5 AO3 destination decision

No `Open AO3` button shipped. On 21 August 2026 the likely official destination,
`https://archiveofourown.org/skins/new?skin_type=Site`, returned a signed-out
redirect to AO3 login with the editor path preserved in `return_to`. An
authenticated session was not available for the other half of the required
verification. Section 5.9 explicitly requires both states before adding the
action, so the correct completed behavior is the exact Preferences path in the
four installation steps and no speculative external button.

If this action is revisited, verify the destination while signed in and signed
out, retain explicit user initiation, and do not automatically open AO3 after
copying.

### 19.6 Repository state and next-developer checklist

This implementation was not committed or deployed. The shared worktree also
contains unrelated modified and untracked user files. Do not reset, clean, or
bulk-delete the worktree to isolate this feature.

Before changing this surface again:

1. Start or confirm the local server on port 3001.
2. Set `UX_BASE_URL=http://localhost:3001` for browser tests.
3. Run the unit, serial desktop, mobile, TypeScript, and build commands from
   section 15.
4. Confirm the eight protected files above still have an empty diff.
5. Re-open the screenshots when changing layout; do not rely only on passing
   visibility assertions.

Repository-wide `npm run lint` currently reports one existing error outside
this feature: unused `VAR_FN` in `scripts/ao3-sanitizer-oracle.mjs` line 66,
plus unrelated warnings. That file is unchanged by this implementation. Every
new or modified site-skin source and test file passes ESLint.

At handoff, the local development server responds with HTTP 200 at:

```text
http://localhost:3001/site-skin
```
