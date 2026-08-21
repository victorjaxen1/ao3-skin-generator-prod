# Work-Skin Workspace UX Hardening - Detailed Implementation Plan

**Status:** Implemented locally and regression-verified; inherited AO3 evidence only. One unrelated full-repo lint baseline remains.

**Plan date:** 21 August 2026

**Audience:** The developer implementing the work-skin workspace UX pass

**Product surface:** The shared iMessage, WhatsApp, X / Twitter, and Google workspace at `/`

> This is not a request to rebuild the four editors in the shape of the site-skin editor. It is a shared correctness, accessibility, and handoff pass around the existing work-skin workspace. The platform-specific authoring models, live preview arrangement, PNG renderer, and generated work-skin output are already mature and must remain intact.

---

## 1. Start here

Read these before changing code:

1. `docs/WORK-SKIN-IMPLEMENTATION.md`, especially:
   - section 6, the verification ladder;
   - section 9f, AO3 title and one-work-skin constraints;
   - section 10, the accumulated implementation traps;
   - sections 12-14, AO3 rewriting and raster-only failures;
   - section 17d, the four levels of browser evidence.
2. `docs/SITE-SKIN-EDITOR-UX-IMPLEMENTATION-PLAN.md` for the standard of UX behavior and verification, not as a layout template.
3. The current implementations of:
   - `src/pages/index.tsx`;
   - `src/components/WorkspaceHeader.tsx`;
   - `src/components/PlatformPicker.tsx`;
   - `src/components/ExportPanel.tsx`;
   - `src/components/ProjectBackupDialog.tsx`;
   - `src/components/BottomSheet.tsx`;
   - `src/components/ModalDialog.tsx`;
   - `src/lib/preflight.ts`;
   - `src/lib/storage.ts`;
   - `src/lib/activation.ts`.

### 1.1 The short product answer

The work-skin side needs the **same level of UX rigor** as the site-skin editor, but not the same interface.

Keep:

- the shared editor used by all four platforms;
- desktop side-by-side authoring and preview;
- mobile authoring with a collapsible preview;
- the current platform picker and examples catalog;
- separate Settings and People/Accounts surfaces;
- one Advanced disclosure inside settings;
- all compiler, schema, renderer, and work-skin generation behavior.

Change:

- unsafe or misleading project replacement behavior;
- modal focus, Escape, Tab, and focus-return behavior;
- invisible project history controls;
- save status that is conveyed mainly by tiny colored dots;
- the first-use export help block that takes too much phone height;
- the work-skin handoff dialog, where the primary copy action is currently several screens below a wall of checks;
- preflight wording and applicability so warnings are not described as blockers.

### 1.2 Priority order

| Priority | Outcome | Why it comes first |
| --- | --- | --- |
| P0 | Correct replacement protection | A settings-only or empty project can currently be replaced without an adequate warning. |
| P0 | Accessible modal behavior | Several dialogs allow focus into the editor behind them and do not close on Escape. |
| P1 | Visible Undo/Redo and save feedback | Touch users have no history controls and all users get weak persistence feedback. |
| P1 | Action-first work-skin handoff | The main accessible export is technically sound but unnecessarily difficult to complete. |
| P2 | Compact first-use export guidance | The current help is accurate but consumes too much of a phone workspace. |
| P2 | Responsive polish and full regression | The existing shell works; this pass locks it down across representative viewport sizes. |

### 1.3 Repository safety

The tree used for this audit already contains uncommitted site-skin work, including a shared `ModalDialog`. Do not reset, replace, or reformat unrelated files. Before implementation:

```powershell
git status --short
git diff -- src/pages/index.tsx src/components/ExportPanel.tsx
```

If the site-skin work has been moved to another branch before this plan is implemented, bring over the final shared `ModalDialog` behavior or recreate its documented contract. Do not silently fall back to visual-only `role="dialog"` wrappers.

---

## 2. Evidence from the current product

### 2.1 Audit method

The audit combined:

- source inspection of the shared page, platform picker, export panel, storage, history, preflight, and dialog implementations;
- the repository's documented system-Edge Playwright path against the local app;
- Pixel 7 and desktop screenshots for the picker and all four platforms;
- focused keyboard probes for the Settings sheet, backup dialog, and work-skin dialog;
- history probes before and after the 500 ms debounce and after branching;
- the existing unit, work-skin, mobile-preview, and workspace-scroll suites.

The in-app browser runtime was unavailable in this environment, so the UI audit used the repository's system Edge / Playwright setup. This is local application evidence, not a new real-AO3 readback.

### 2.2 What already works and must be preserved

- At phone sizes, the document remains locked while the internal editor and preview panes scroll.
- The header does not overlap at 360, 390, or 412 CSS pixels in the audited states.
- The collapsible mobile preview keeps the editor usable while preserving the type-and-see feedback loop.
- The desktop workspace keeps authoring and preview visible together.
- The fixed export bar publishes its measured height through `--export-bar-h`, and the main workspace reserves that height.
- The Settings `BottomSheet` enters focus, traps Tab, closes on Escape, locks body scroll, and restores focus.
- Project history currently behaves correctly across the debounce:
  - add: history length 2 becomes 3;
  - Undo: length remains 3 and index moves back;
  - Redo: index moves forward;
  - editing after Undo truncates the redo branch;
  - attempting Redo after branching is a no-op.
- Work-skin CSS and HTML copy actions remain enabled for content warnings; only an internal CSS/HTML contract failure blocks output.
- Existing work-skin unit coverage passed 58/58 in the audit.
- Existing mobile preview coverage passed 3 tests, with the intended desktop-only case skipped.

These are constraints, not areas to redesign.

### 2.3 Confirmed defects and friction

| Area | Current behavior | User consequence | Priority |
| --- | --- | --- | --- |
| Project replacement | `hasWorkInProgress` is `cameFromWorkspace && project.messages.length > 0`. | Empty Twitter projects, Google/settings-only work, account edits, and some returning work can be lost. Seeded messages can also trigger a false warning. | P0 |
| Backup dialog | Initial focus remains on the opener; Tab can reach the editor behind it; Escape does not close it. | Keyboard and assistive-technology users are not contained in the modal task. | P0 |
| Work-skin dialog | Initial focus remains outside; early Tabs reach controls behind the overlay; Escape does not close it. | The primary accessible export has an inaccessible modal shell. | P0 |
| Other overlay dialogs | Hosted upload, AO3 image code, delete confirmations, and reopened privacy choices use inconsistent raw overlays. | Behavior varies depending on which task is open. | P0 |
| History | Undo/Redo exist only as global keyboard shortcuts. | Touch users cannot use history and keyboard users cannot discover it. | P1 |
| Text editing | Project-level `Ctrl/Cmd+Z` runs even while typing in a text field. | Native text undo can unexpectedly replace the whole project state. | P0/P1 |
| Save state | Tiny header dots carry most of the status; there is no useful live status. `unsaved` is declared but never set. | Persistence is easy to miss, especially on mobile and for non-visual users. | P1 |
| Manual save | `Ctrl/Cmd+S` calls `persistProject` directly without updating visible success/failure state. | A refused manual save can look successful. | P1 |
| Export help | First-use expanded height was about 231 px versus about 86 px collapsed in the audited phone state. | Guidance removes roughly 145 px from an already constrained composer. | P2 |
| Work-skin handoff | The dialog was about 2,655 px tall internally; the first Copy CSS action began around 2,197 px down. | The main action is roughly three phone screens away. | P1 |
| Preflight | The dialog prints 21 rows, including platform checks that do not apply. Some content checks are labeled `block` although the copy gate intentionally ignores them. | The UI overstates risk and buries action under irrelevant passes. | P1 |

### 2.4 Current automated-test baseline

The audit found one browser-test/product wording drift:

- `tests/work-skin.spec.ts` expects the phrase `blocking content issue` for a missing WhatsApp media fallback.
- The current product intentionally treats that condition as a warning and leaves both copy actions enabled.

The plan resolves this in favor of the current safety model:

- only `ao3-css` and `html-contract` failures block copying;
- missing transcript, alt text, speaker identity, model consistency, host longevity, contrast, and similar author-correctable conditions are warnings;
- tests must assert the warning and enabled copy actions, not revive the misleading word `blocking`.

Do not change this taxonomy accidentally while moving markup.

### 2.5 Audit artifacts

Local screenshots from the audit are under `tmp/workskin-ux-audit/`:

- `mobile-picker.png`;
- `mobile-ios.png`;
- `mobile-android.png`;
- `mobile-twitter.png`;
- `mobile-google.png`;
- `mobile-settings.png`;
- `mobile-workskin.png`;
- `desktop-ios.png`;
- `desktop-google.png`.

They are diagnostic artifacts, not permanent golden snapshots. Do not commit `tmp/` unless the repository owner explicitly asks for it.

---

## 3. Product decision

### 3.1 One shared workspace pass, not four redesigns

iMessage, WhatsApp, X / Twitter, and Google share the surrounding workspace and differ inside their platform-specific authoring and preview components. The audited defects are almost entirely in that shared shell:

```text
Platform picker
      |
      v
Shared workspace shell
  +-- header and project actions
  +-- authoring pane
  |     +-- platform-specific editor controls
  +-- preview pane
  |     +-- platform-specific renderer
  +-- export bar
        +-- PNG
        +-- hosted image code
        +-- work-skin CSS + chapter HTML
```

Therefore:

- implement shared replacement, history, save, modal, and export behavior once;
- preserve platform-specific editors and renderers;
- test all four platforms through the shared behavior;
- add platform-specific exceptions only where the data model genuinely differs.

### 3.2 Primary user

The primary user is an AO3 author who understands the scene they want to write but may not understand AO3's split work-skin workflow. They may be working on a phone, may rely on touch, and may not know that:

- the CSS is saved in AO3 Preferences;
- the scene HTML is pasted in the chapter's HTML editor;
- the work must then select the saved work skin;
- a work can use only one work skin;
- skin titles are globally unique;
- hosted icons and media remain external dependencies;
- readers and downloads may see the skin-off fallback.

The UI should make the next action clear without turning every visit into a tutorial.

### 3.3 North-star journey

1. Choose a platform or example.
2. Compose while seeing immediate preview feedback.
3. Recover from mistakes with visible Undo/Redo.
4. Know whether the current project is saved in this browser.
5. Choose image output or selectable-text work-skin output.
6. For a work skin, copy CSS first and HTML second without searching through a long audit report.
7. Review warnings and fallback rendering without those secondary checks blocking the main workflow.
8. Return later without replacing recoverable work by accident.

### 3.4 Responsive layout decision

Do not apply the site-skin editor's single-pane Preview/Customize navigation to this product.

Desktop at `lg` and above:

```text
+-------------------------------------------------------------+
| Shared header                                               |
+-----------------------------------+-------------------------+
| Saved / Undo / Redo               | Preview header          |
+-----------------------------------+-------------------------+
| Scrollable authoring timeline     | Scrollable live preview |
|                                   |                         |
+-----------------------------------+-------------------------+
| Composer                          |                         |
+-------------------------------------------------------------+
| Fixed export bar, measured and reserved                     |
+-------------------------------------------------------------+
```

Mobile and tablet below `lg`:

```text
+-----------------------------------+
| Shared header                     |
+-----------------------------------+
| Saved / Undo / Redo               |
+-----------------------------------+
| Scrollable authoring timeline     |
+-----------------------------------+
| Expand/collapse Preview           |
| Optional bounded live preview     |
+-----------------------------------+
| Composer                          |
+-----------------------------------+
| Fixed export bar, measured        |
+-----------------------------------+
```

The document remains locked in workspace mode. Scrolling belongs to the timeline, preview, sheet, or modal that owns it.

---

## 4. Scope and non-goals

### 4.1 In scope

- one shared visible save/history bar;
- project-level Undo/Redo buttons and keyboard-safe history callbacks;
- truthful manual and automatic save feedback;
- exact project replacement protection for platform and example choices;
- correct resume behavior for any stored project, including one with zero messages;
- migration of top-level overlay dialogs to the shared accessible modal shell;
- action-first work-skin CSS/HTML handoff;
- concise, applicable preflight presentation;
- clipboard-denied manual-copy fallback behavior;
- compact first-use export guidance;
- dynamic viewport-height hardening;
- desktop, mobile, keyboard, state, and output-parity tests;
- evidence recorded at the correct level from `WORK-SKIN-IMPLEMENTATION.md`.

### 4.2 Explicitly out of scope

- changes to `src/lib/generator.ts`;
- changes to `src/lib/workSkin.ts` or emitted CSS/HTML;
- changes to `src/lib/schema.ts`, stored project schema, or project-file schema;
- changes to platform templates, examples, or `PLATFORM_LOOK`;
- new work-skin platforms or platform features;
- a multi-project manager or account system;
- automatic AO3 posting, saving, or authenticated navigation;
- redesigning the composer, message cards, People/Accounts, or Settings;
- replacing the proven mobile collapsible preview with pane navigation;
- globally migrating every native `window.confirm` in platform sub-editors;
- changing the PNG renderer or hosted-image pipeline;
- deploying the change;
- claiming a new real-AO3 pass without a signed-in AO3 save/readback.

### 4.3 Native confirms intentionally left for later

This pass migrates the platform/example replacement prompt because it is central to navigation and needs richer, specific copy. Native confirms inside `CharacterLibrary`, `CastPanel`, and platform extras may remain. Browser-native confirms already contain keyboard focus; replacing all of them expands scope without addressing the audited top-level failures.

Record those remaining confirms as backlog. Do not mix a global confirmation-system rewrite into this work.

---

## 5. Target experience

### 5.1 Platform picker and returning work

When a stored project exists, open it directly even if it contains zero messages. The current mount condition checks `returning && initial.messages.length > 0`; change it to use the existence of stored project data, not message count.

When the user presses Back from the workspace:

- the picker appears;
- a prominent `Keep editing my project` action returns without changing state;
- choosing a platform or example either proceeds immediately or opens a replacement dialog according to the baseline rules in section 6;
- canceling the dialog leaves project state, history, storage, and focus unchanged;
- confirming replaces the project once, closes the picker, and resets history to the new project.

Replacement dialog copy:

- heading: `Replace your current project?`;
- body: `Starting {choice label} replaces the one project stored in this browser. Choose Keep editing current project if you want to download a backup first.`;
- safe action: `Keep editing current project`;
- destructive action: `Replace with {choice label}`.

`{choice label}` must be a human label such as `a blank WhatsApp chat` or `the Rich Group Scene example`, never a raw template id.

The safe action receives `data-autofocus`.

### 5.2 Workspace header

Keep the current header layout and action density. Do not place Undo/Redo into it; at 360 px it already carries Back, title/identity, backup, People/Accounts where applicable, and Settings.

Remove save-status dots from `WorkspaceHeader` after the new status bar ships. A colored dot is not sufficient feedback, and duplicated state in two regions creates contradictory announcements.

The existing save-failure banner remains below the header because it contains the full recovery message.

### 5.3 New workspace status bar

Add `src/components/WorkspaceStatusBar.tsx` inside the left authoring column, immediately above the timeline scroller.

Suggested API:

```ts
interface WorkspaceStatusBarProps {
  saveStatus: 'saved' | 'saving' | 'failed';
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}
```

Visual behavior:

- compact 36-40 px row;
- neutral background and a bottom border;
- left: text status;
- right: visible `Undo` and `Redo` buttons;
- disabled controls remain visible and have a clear disabled state;
- labels do not disappear on phones.

Status wording:

- `saving`: `Saving…`;
- `saved`: `Saved in this browser`;
- `failed`: `Not saved`.

Accessibility behavior:

- put only the status text in a polite live region;
- use `aria-atomic="true"` so the complete phrase is announced;
- do not announce every unrelated re-render;
- buttons have accessible names `Undo project change` and `Redo project change`;
- optional shortcut hints may appear in `title`, but the visible names remain short.

### 5.4 Undo and Redo

Use the existing 50-entry project history and 500 ms coalescing. The audit showed the branch algorithm works; this phase exposes it and prevents shortcut collisions.

Create shared `undoProject()` and `redoProject()` callbacks. Both buttons and keyboard shortcuts call those callbacks. Do not duplicate history mutation in click and key handlers.

Rules:

1. Undo is enabled only when `historyIndex > 0`.
2. Redo is enabled only when `historyIndex < history.length - 1`.
3. Undo changes `historyIndex` first and sets `project` to that exact snapshot.
4. Redo does the corresponding forward move.
5. The persistence/history effect must recognize an Undo/Redo snapshot as already present and must not append it again.
6. Editing after Undo truncates every redo entry before pushing the new state.
7. The 50-entry cap remains.
8. Opening/closing sheets, dialogs, help, and preview does not enter project history.
9. Platform/example selection and backup restore reset history to one entry.

Keyboard rules:

- `Ctrl/Cmd+Z` invokes project Undo only when focus is not in a text-editing target;
- `Ctrl/Cmd+Shift+Z` invokes project Redo under the same condition;
- an input, textarea, contenteditable element, or ARIA textbox keeps native text undo/redo;
- do not use a time flag to suppress history after Undo/Redo.

Add a small helper such as `isTextEditingTarget(event.target)` and unit-test its intended selectors if it is extracted.

### 5.5 Save behavior

Remove the unused `unsaved` member from the status union unless the implementation introduces a real, testable moment when it is shown. The current product transitions directly to `saving` on a project change.

Create one `saveProjectNow(candidate)` function that:

1. calls `persistProject(candidate)`;
2. sets `saved` and clears `saveError` on success;
3. sets `failed` and the returned user-safe message on failure;
4. returns the `PersistResult` to callers that need it.

Both the 500 ms autosave and `Ctrl/Cmd+S` must use this result-handling path. Manual save must never fail silently.

Do not merge the history engine and storage engine into a new state framework in this pass. Their shared debounce is established behavior and must be protected by tests.

### 5.6 Workspace height and scrolling

Use dynamic viewport height without removing the existing fallback:

```tsx
className="flex h-screen h-[100dvh] flex-col ..."
```

Keep the workspace `html` overflow lock. Do not move it to `body`; `BottomSheet` already owns `body.style.overflow` while open.

Keep:

- `min-h-0` on flex descendants that own scrollers;
- the internal timeline scroller;
- the internal preview scroller;
- the mobile preview height bound;
- padding derived from both `--export-bar-h` and `--analytics-consent-h`.

Acceptance is no document-level scroll, not the absence of all scrollbars.

### 5.7 Compact first-use export guidance

Keep the current explanation and privacy facts, but do not auto-open the full multi-paragraph help block.

First visit when `ao3skin_help_dismissed !== '1'`:

- show one compact in-flow prompt: `Not sure which export to use? Compare the options.`;
- clicking it expands the existing detailed guidance in flow;
- the expanded guidance has an explicit `Got it` or Close action;
- closing stores `ao3skin_help_dismissed = '1'` and collapses it;
- the `?` control remains available for reopening.

Returning dismissed visit:

- show only the ordinary export row and `?` control;
- do not auto-expand either the compact prompt or full help.

The compact prompt must mention or lead directly to the distinction among:

- Save PNG;
- AO3 image code;
- Work skin / selectable text.

Keep the help block in normal flow. Floating it would cover the composer and evade `--export-bar-h` measurement.

Export-row label behavior:

- use the short visible label `Work skin` at 390 px and wider;
- icon-only is acceptable at 360 px if all actions otherwise fit without horizontal scrolling;
- retain the accessible name `Open accessible work skin export` at every width.

Re-measure the bar on every help-state and responsive-label change. The main workspace must continue reserving the measured height.

### 5.8 Accessible modal shell

Use the shared `ModalDialog` for top-level overlays in this product. Its minimum behavior is:

- `role="dialog"` and `aria-modal="true"`;
- an accessible label or `aria-labelledby`;
- focus enters the dialog after it opens;
- `[data-autofocus]` wins, otherwise the first available focusable element;
- Tab and Shift+Tab wrap within visible enabled controls;
- Escape closes the active modal once;
- focus returns to the opener if it still exists;
- body scrolling is restored to its previous value;
- only a direct backdrop pointer press closes the dialog;
- content clicks never close it;
- an empty-focus dialog focuses its panel.

Migrate:

- platform/example replacement;
- `ProjectBackupDialog`;
- X / Twitter reply-aware delete confirmation;
- WhatsApp reply-aware delete confirmation;
- iMessage reply-aware delete confirmation;
- hosted-image upload consent;
- AO3 image-code dialog;
- work-skin dialog;
- reopened analytics privacy choices.

Do not migrate `SettingsSheet` or Cast/People sheets; `BottomSheet` already provides the correct sheet interaction.

Delete the page-level `Escape && showCodeModal` listener after the AO3 code dialog uses `ModalDialog`. Exactly one component owns Escape for each open modal.

Initial-focus decisions:

| Dialog | Initial focus |
| --- | --- |
| Replacement | `Keep editing current project` |
| Delete confirmation | `Cancel` |
| Hosted upload consent | Image-description textarea if it needs input; otherwise Cancel |
| AO3 image code | `Copy code` |
| Work skin | `Copy work skin CSS` when output is valid; Close when an internal blocker disables copying |
| Project backup | `Download project backup` |
| Privacy choices | `Don't allow` |

Use `data-autofocus`, not JSX `autoFocus`, so the shared shell remains the single focus-entry mechanism.

### 5.9 Work-skin handoff dialog

The dialog should answer one question immediately: **what do I copy, and where does it go?** Checks and previews are supporting information.

Use this order:

1. **Header**
   - title: `Copy your work skin to AO3`;
   - subtitle: `Copy the CSS once, then copy this scene's HTML into your chapter.`
2. **Compatibility state**
   - if an internal blocker exists, show the red generator-error panel;
   - otherwise show one compact success line using `AO3_RULESET_STATUS`;
   - show at most the first three active content warnings, followed by `N more warnings` linked to the checks disclosure.
3. **Skin scope**
   - default: `All four platforms`;
   - alternative: `Just {current platform}`;
   - concise explanation that a work can use only one work skin.
4. **Step 1: create or update the AO3 work skin**
   - instruction path: `Preferences → Skins → Create Work Skin`;
   - concise title uniqueness advice with the existing title example;
   - concise existing-skin merge warning;
   - primary button: `Copy work skin CSS`;
   - CSS manual-copy disclosure below the button.
5. **Optional credit**
   - place immediately before Step 2 because it changes chapter HTML, not CSS;
   - keep the existing no-link/no-commercial-message explanation.
6. **Step 2: add this scene to the chapter**
   - instruction: switch the chapter editor to HTML, paste, then choose the saved work skin;
   - primary button: `Copy scene HTML`;
   - HTML manual-copy disclosure below the button.
7. **Preview**
   - keep `Styled` and `Without work skin / downloads` modes;
   - keep transcript preview and download;
   - position all of this after both copy actions.
8. **Checks and warnings disclosure**
   - collapsed by default;
   - summary example: `Checks and warnings · 18 passed · 2 warnings`;
   - list active blockers first, warnings second, passed checks last;
   - do not show checks for the wrong platform.
9. **Recovery and dependency information**
   - `Back up editable project` action;
   - remote icon/media-host warning;
   - these remain visible or reachable but do not precede the copy workflow.

On a 390 x 844 viewport with no blockers, the `Copy work skin CSS` button must be visible in the dialog's initial viewport without requiring a swipe. The dialog scroller starts at zero.

Inside `ModalDialog`, use a flex column constrained to `max-h-[90dvh]`: the header is `flex-none`, and the content area is `min-h-0 overflow-y-auto overscroll-contain`. The page behind it never becomes the modal scroller.

### 5.10 Manual-copy fallback

Do not remove the CSS or HTML textareas. Hide them behind controlled disclosures when clipboard copy is available.

State should be independent per part:

```ts
type CopyState = 'idle' | 'copied' | 'failed';

interface WorkSkinCopyState {
  css: CopyState;
  html: CopyState;
}
```

On successful copy:

- set that part to `copied`;
- announce `Work skin CSS copied` or `Scene HTML copied` in a polite live region;
- preserve the current analytics event;
- allow the success label to reset visually after a short timeout without losing handoff bookkeeping.

Keep one timeout ref per part and clear it before starting a replacement timeout and when the dialog unmounts. A timer from an older click must not reset a newer copy state.

On clipboard failure:

- set that part to `failed`;
- open the matching manual-copy disclosure;
- focus and select the read-only textarea;
- show a local error message next to that textarea;
- retain the existing failure analytics event;
- do not close the modal.

Avoid a single `copiedPart` value; copying HTML should not erase the fact that CSS was copied.

### 5.11 Work-skin modal reset rules

Every call to `openWorkSkin()` starts a predictable handoff:

- `skinScope = 'all'`;
- `workSkinPreview = 'styled'`;
- `includeWorkSkinCredit = false`;
- both copy states are `idle`;
- both manual-copy disclosures are closed;
- clipboard errors are cleared;
- the checks disclosure is closed;
- `workSkinPartsCopiedRef` is cleared;
- `workSkinHandoffTrackedRef` is false;
- the dialog scroller starts at zero.

Changing scope resets CSS copy state and the completed-handoff bookkeeping. Changing optional credit resets HTML copy state and the completed-handoff bookkeeping. It is acceptable to reset both copy states for either change if that produces a simpler, consistently tested rule.

Do not compute the all-platform master skin on every editor keystroke. Preserve the existing optimization: build it only while the dialog is open and `skinScope === 'all'`.

### 5.12 Platform-specific expectations

Shared changes must not flatten meaningful differences:

| Platform | Authoring detail to preserve | Preflight detail to show only when applicable |
| --- | --- | --- |
| iMessage | participants, replies, events, Tapbacks, iOS media, scrollable phone frame | iOS model, iOS media fallback/poster/host/dependence, scroll-flattened warning |
| WhatsApp | participants, replies, events, reactions, WhatsApp media and frame assets | WhatsApp model, media fallback/poster/host, persistent frame/wallpaper host |
| X / Twitter | account identity, post/reply structure, quotes, polls, media and video | Twitter video fallback and attachment/host warnings |
| Google | query/results authoring and fixed presentation | common HTML/CSS, attachment, backup, fallback checks only |

Do not render reassuring iOS checks in a Google export or reassuring WhatsApp checks in an iMessage export. Their absence means “not applicable,” not “passed.”

---

## 6. State architecture

### 6.1 Domain state remains unchanged

Do not add UI flags to `SkinProject`. The persisted project remains:

- project id;
- template;
- settings;
- messages/results;
- scene cast.

History, modal state, help state, focus state, replacement baselines, and copy feedback remain page/component UI state.

### 6.2 Page-level state changes

Keep the existing project/history/settings state. Add or refine these page-level values:

```ts
type SaveStatus = 'saved' | 'saving' | 'failed';

const replacementBaselineRef = useRef<string | null>(null);
const protectUnchangedBaselineRef = useRef(false);
```

`cameFromWorkspace` remains the picker-entry flag, but it must no longer stand in for “there is data to protect.” Those are different questions. `PlatformPicker` owns only its pending choice while its replacement dialog is open; section 8.4 defines that local type and API.

### 6.3 Full project replacement snapshot

Add `src/lib/projectState.ts` with a small, pure stable serializer:

```ts
export function projectStateSnapshot(project: SkinProject): string;
```

Requirements:

- include the full JSON project state, including settings, zero-message state, messages, cast, and id;
- recursively sort object keys so semantically identical plain JSON objects compare equally;
- preserve array order because message/result order is authored data;
- omit `undefined` consistently with JSON serialization;
- do not mutate the project;
- do not include external character-library state because platform/example selection does not replace that library;
- unit-test nested object key ordering and array-order sensitivity.

Do not reuse `activationRef` or `ActivationBaseline`. Activation asks whether an author crossed an analytics threshold. Replacement protection asks whether any recoverable project state may be lost. The semantics must remain separate even if both use canonical serialization internally.

### 6.4 Replacement baseline rules

Set `replacementBaselineRef` only when a complete project enters the editor:

| Entry source | Baseline | Protect even when unchanged? |
| --- | --- | --- |
| Fresh default before a platform is chosen | snapshot of the seed | No |
| Blank platform choice | snapshot of the instantiated platform | No |
| Example/deep link | snapshot of the instantiated example | No |
| Project loaded from local storage | snapshot after migration | Yes |
| Project restored from backup | snapshot after parsing/migration | Yes |

Why the extra boolean exists:

- an untouched platform seed is replaceable without ceremony;
- a returning stored project is recoverable user data even if it currently equals its entry baseline;
- a restored backup is explicitly user-owned data and deserves the same protection;
- any edit to a fresh seed, including a settings/account/query-only edit, differs from its snapshot and becomes protected.

The decision function is:

```ts
const currentChanged =
  replacementBaselineRef.current !== projectStateSnapshot(project);

const shouldConfirmReplacement =
  cameFromWorkspace &&
  (protectUnchangedBaselineRef.current || currentChanged);
```

Compute this value in `index.tsx` on the picker render and pass it as `protectCurrentProject`. Pass `cameFromWorkspace` separately as `canReturnToProject`; do not make one boolean serve both purposes.

Do not use `messages.length`, `messageCount`, activation thresholds, save status, or history length as a proxy.

### 6.5 Replacement lifecycle

When choosing a platform or example:

1. `PlatformPicker` creates a local `PendingProjectChoice` with human copy.
2. If its `protectCurrentProject` prop is false, it applies the choice immediately.
3. Otherwise it opens the replacement modal and keeps the picker mounted.
4. Cancel clears only the picker's pending choice.
5. Confirm calls exactly one existing selection handler.
6. The selection handler instantiates/migrates the project, resets activation baseline, resets replacement baseline with `protect=false`, resets history to one entry, closes picker, and tracks the existing selection event once.

When restoring a backup:

1. keep the existing safety download of the current project;
2. parse and migrate the candidate through the current path;
3. replace project and character library;
4. reset history to one entry;
5. set the replacement snapshot to the restored project;
6. set `protectUnchangedBaselineRef.current = true`;
7. close the backup dialog and return to workspace.

Autosave, Undo, Redo, copying output, opening dialogs, and downloading a backup do not replace the baseline.

### 6.6 Initial route rule

On mount:

```ts
if (fromDeepLink || returning) {
  setShowPicker(false);
}
```

Do not require `initial.messages.length > 0`. A saved empty Twitter account setup, Google query, or settings-only project is still a project.

Set replacement protection during the same mount effect after all migrations:

```ts
replacementBaselineRef.current = projectStateSnapshot(initial);
protectUnchangedBaselineRef.current = returning;
```

For a deep link, `returning` is false and the baseline is unprotected until the user changes something.

### 6.7 Modal ownership

Each top-level modal has one boolean or one nullable pending value and one close callback. The close callback clears modal-local transient state where needed.

Never keep two top-level overlays open as part of one transition:

- hosted consent closes before AO3 image code opens;
- replacement closes before the new workspace is shown;
- backup closes after a successful restore;
- work-skin manual-copy disclosures remain inside the same modal, not nested modals.

The shared modal owns document key handling. Page-level keyboard logic may handle save/history only when no relevant text target owns the shortcut.

### 6.8 Export help persistence

Separate “new user should see a prompt” from “full help is expanded”:

```ts
const [showHelpPrompt, setShowHelpPrompt] = useState(false);
const [showHelp, setShowHelp] = useState(false);
```

Mount behavior:

- not dismissed: `showHelpPrompt=true`, `showHelp=false`;
- dismissed: both false.

Opening full help may leave the prompt visually replaced by the detail block. `Got it` closes both and persists dismissal. Pressing `?` opens full help regardless of dismissal without clearing the stored preference.

---

## 7. Correctness contracts

### 7.1 Generated-output parity

This is a workspace UX pass. For representative fixtures on all four platforms:

- `buildWorkSkin(project).css` remains byte-identical;
- `buildWorkSkin(project).html` remains byte-identical;
- `buildMasterWorkSkin(project).css` remains byte-identical;
- `buildMasterWorkSkin(project).html` remains byte-identical;
- PNG pixels should not change except for nondeterminism already documented by existing raster tests;
- hosted-image code content should not change.

If implementation appears to require generator output changes, stop and split that into a separately reviewed change with the full AO3 evidence ladder.

### 7.2 Preflight severity contract

Only these failures disable both work-skin copy buttons:

- `ao3-css`;
- `html-contract`.

These represent generated output that is unsafe to hand to the author.

All author-correctable content/model/identity/media/host/contrast/backup conditions remain warnings. Change `speaker-identity`, `whatsapp-model`, and `ios-model` from `block` to `warn`, and remove the phrase `blocking content issue` from their messages.

The UI derives:

```ts
const blockers = preflight.filter(item => item.status === 'fail' && item.severity === 'block');
const warnings = preflight.filter(item => item.status === 'fail' && item.severity === 'warn');
const passed = preflight.filter(item => item.status === 'pass');
const info = preflight.filter(item => item.severity === 'info');
const workSkinBlocked = blockers.length > 0;
```

Do not maintain a second id whitelist in `ExportPanel` after severity is corrected. The type should tell the truth.

### 7.3 Preflight applicability contract

`buildWorkSkinPreflight` returns common checks plus checks applicable to `project.template`:

- no `whatsapp-*` rows outside `android`;
- no `ios-*` rows outside `ios`;
- Twitter video fallback only for Twitter;
- speaker identity only for iMessage/WhatsApp where the fallback needs it;
- fixed-palette information may be omitted for Google instead of reported as a pass;
- shared attachment, host, backup, fallback, CSS, and HTML checks remain where applicable.

Tests must assert ids and semantics, not a fixed total row count.

### 7.4 AO3 truthfulness contract

Keep these facts in the handoff:

- CSS and HTML go to different AO3 locations;
- a work can select only one work skin;
- authors with an existing skin need to merge CSS;
- titles are unique across AO3 and should include the username;
- work-skin output is selectable text and can reflow;
- readers/downloads may see the no-skin fallback;
- AO3 does not preserve remote icons/media;
- this application does not install or post the skin automatically.

Shorten and reposition these facts; do not weaken or remove them.

### 7.5 Backup contract

- Backup download remains local and includes project plus character library.
- Restore remains replace-only.
- Restore shows a candidate summary before changing anything.
- Restore downloads the current state first.
- If the safety download fails, restore is aborted.
- Modal migration must not change project-file parsing or migration.

### 7.6 Fixed-bar measurement contract

`ExportPanel` continues to measure its actual rendered height and publish `--export-bar-h` whenever content height changes. Verification must cover:

- compact first-use prompt;
- expanded help;
- dismissed help;
- 360, 390, and 412 px widths;
- analytics consent open and closed;
- composer and last timeline item remaining reachable.

Do not hard-code a bottom padding from one screenshot.

---

## 8. Component-level implementation map

### 8.1 New `src/lib/projectState.ts`

Responsibilities:

- stable full-project serialization;
- no React, storage, analytics, or migration code;
- focused unit coverage.

Do not put replacement policy in this module; policy belongs to the page because it depends on entry source and picker navigation.

### 8.2 New `src/components/WorkspaceStatusBar.tsx`

Responsibilities:

- render save text and live region;
- render Undo/Redo buttons;
- no history mutation of its own;
- no storage access;
- compact, responsive presentation.

### 8.3 `src/pages/index.tsx`

Change:

- save-status type and shared save helper;
- shared Undo/Redo callbacks;
- text-target shortcut guard;
- mount route for all stored projects;
- replacement baseline refs;
- pending replacement choice state and modal;
- status bar placement;
- dynamic viewport height fallback;
- raw delete dialogs migrated to `ModalDialog`;
- backup replacement baseline reset;
- remove the AO3-code Escape owner after modal migration.

Preserve:

- platform-specific handlers;
- activation thresholds and analytics baseline;
- 500 ms debounce and 50-entry history;
- document overflow lock;
- mobile preview persistence and scroll-to-latest behavior;
- fixed-bar padding calculation.

### 8.4 `src/components/PlatformPicker.tsx`

Replace `window.confirm` and `hasWorkInProgress` with a truthful protection prop and a local pending-choice dialog.

Use this API shape:

```ts
type PlatformTemplate = SkinProject['template'];

interface Props {
  onSelectPlatform: (template: PlatformTemplate) => void;
  onLoadExample: (project: SkinProject) => void;
  canReturnToProject: boolean;
  protectCurrentProject: boolean;
  onCancel?: () => void;
}

type PendingProjectChoice =
  | {
      kind: 'platform';
      template: PlatformTemplate;
      label: string;
    }
  | {
      kind: 'example';
      project: SkinProject;
      label: string;
    };
```

`PlatformPicker` renders its `ModalDialog` in the same return tree as the picker, so the dialog remains mounted despite `index.tsx` returning early for picker mode. It uses `protectCurrentProject` only to decide immediate action versus pending dialog. It must not infer dirty state from message count and must not call `window.confirm`.

`canReturnToProject` controls the visible `Keep editing my project` action independently. Show it whenever the user entered the picker through Back, even when the current seed is untouched and replacement does not need confirmation.

Keep labels and analytics ids from the existing catalog. Build human replacement labels from the existing platform and example label maps rather than duplicating raw ids in the page.

### 8.5 `src/components/WorkspaceHeader.tsx`

Remove save-dot rendering and the `saveStatus` prop after the status bar is connected. Keep:

- contact/query/account field behavior;
- message/result count;
- Back, backup, identity/cast, and Settings actions;
- existing 360 px collision protections.

### 8.6 `src/components/ModalDialog.tsx`

Reuse the final shared component from the site-skin work. Only expand its API if an audited work-skin need cannot be expressed by children.

Likely no change is required. If a refactor is necessary, re-run both site-skin and work-skin modal tests. Do not break:

- closed `<details>` filtering in the focusable query;
- exact opener restoration;
- previous body-overflow restoration;
- direct-backdrop-only dismissal;
- panel fallback focus.

### 8.7 `src/components/ProjectBackupDialog.tsx`

Wrap with `ModalDialog` and use a labelled heading. Add a bounded internal scroller for short viewports.

On each new open, reset only transient presentation state that should not leak from a prior session:

- candidate and summary;
- parse/download errors;
- downloaded-success label if product decides it should be per-open.

Do not reset candidate while the same open dialog rerenders.

### 8.8 `src/components/ExportPanel.tsx`

This is the largest UI change. Refactor within the component before extracting new components unless a section becomes independently testable and materially clearer.

Change:

- compact first-use help state;
- work-skin action order;
- copy state per CSS/HTML part;
- controlled manual-copy disclosures;
- scope/credit reset rules;
- applicable preflight grouping;
- modal shell for hosted consent, AO3 code, and work skin;
- explicit button and live-region text;
- initial work-skin focus;
- short responsive Work skin label.

Preserve:

- PNG export path;
- upload consent and disclosure truthfulness;
- `sceneAlt` behavior;
- transcript generation/download;
- `skin` and `masterSkin` memoization strategy;
- current output and handoff analytics events;
- `--export-bar-h` measurement;
- toasts as supplementary feedback, not the only copy feedback.

If extraction is helpful, use focused children such as:

- `WorkSkinHandoffDialog.tsx`;
- `WorkSkinPreflightSummary.tsx`.

Do not extract generator orchestration into UI components or create a new global state layer.

### 8.9 `src/lib/preflight.ts`

Change severity and message truthfulness, and return only applicable platform rows. Keep each check pure and derived from project/html/violations/backup input.

Do not loosen:

- AO3 CSS linting;
- HTML contract checks;
- media fallback detection;
- host-expiry detection;
- contrast calculation;
- backup detection.

### 8.10 `src/components/AnalyticsConsent.tsx`

Use `ModalDialog` for the reopened privacy-choice overlay. Preserve:

- the fixed initial consent surface and its measured `--analytics-consent-h` behavior;
- analytics-off-by-default behavior;
- existing choices, copy, events, and policy link.

Only the reopened modal is in this migration. Do not make the initial consent prompt modal.

### 8.11 Tests

Add:

- `tests/project-state.unit.spec.ts`;
- `tests/workspace-ux.spec.ts`;
- `tests/workspace-mobile.spec.ts`.

Update narrowly:

- `tests/work-skin.spec.ts` for warning wording/hierarchy and copy behavior;
- `tests/project-backup.spec.ts` for focus/Escape/restore behavior;
- `tests/analytics-consent.spec.ts` for reopened privacy focus behavior;
- existing scroll tests if the status-bar boundary changes selectors.

Do not rewrite stable platform authoring suites into the new files.

### 8.12 Files that should not change

Unless a separately reviewed output defect is found, leave these untouched:

- `src/lib/generator.ts`;
- `src/lib/workSkin.ts`;
- `src/lib/schema.ts`;
- `src/lib/examples.ts`;
- `src/lib/projectFile.ts`;
- `src/lib/ios.ts`;
- `src/lib/whatsapp.ts`;
- `src/lib/twitter.ts`;
- platform preview/render components;
- raster export helpers.

If a formatter touches these files, revert only the formatter's unrelated edits without discarding user work.

---

## 9. Implementation phases

### Phase 0 - lock behavior and reproduce defects

1. Record `git status --short` and preserve unrelated changes.
2. Start the local app and set `UX_BASE_URL`.
3. Run the unit, work-skin, mobile-preview, and workspace-scroll baselines.
4. Add failing tests for:
   - backup modal focus trap/Escape/return;
   - work-skin modal focus trap/Escape/return;
   - settings-only replacement protection;
   - empty Twitter account replacement protection;
   - text-field native Undo;
   - visible history controls;
   - Copy CSS being below the initial mobile modal viewport;
   - irrelevant platform preflight rows.
5. Capture representative output strings or hashes for all four platform fixtures before UI edits.

Exit condition: the defects are reproducible and generator output is pinned.

### Phase 1 - modal correctness

1. Confirm the shared `ModalDialog` has the behavior in section 5.8.
2. Migrate backup dialog.
3. Migrate the three reply-aware delete dialogs.
4. Migrate hosted-upload consent.
5. Migrate AO3 image-code dialog.
6. Migrate work-skin dialog shell without reordering its content yet.
7. Migrate reopened privacy choices.
8. Remove duplicate/global Escape handling.
9. Test each dialog's opener, first focus, Tab loop, Shift+Tab loop, Escape, backdrop, and focus return.

Exit condition: no top-level raw overlay in scope leaks focus or leaves an Escape owner behind.

### Phase 2 - replacement protection

1. Add and unit-test `projectStateSnapshot`.
2. Establish replacement baseline and protection source on mount.
3. Open every stored project directly, including zero-message state.
4. Replace picker `window.confirm` with `protectCurrentProject` and the picker's local pending-choice dialog.
5. Add the replacement `ModalDialog` with human labels and safe initial focus.
6. Reset baseline/protection/history on confirmed platform/example selection.
7. Mark backup-restored state protected even when unchanged.
8. Test cancel and confirm paths against React state and local storage.

Exit condition: every recoverable full-project state is protected and untouched seeds do not produce unnecessary prompts.

### Phase 3 - history and save visibility

1. Add shared Undo/Redo callbacks.
2. Add the text-editing-target guard.
3. Add `WorkspaceStatusBar` above the timeline.
4. Move status text/live behavior out of `WorkspaceHeader`.
5. Remove unused `unsaved` state.
6. Route manual and automatic saves through one result-handling function.
7. Keep the detailed failed-save banner.
8. Run history tests on both sides of the 500 ms debounce and after branching.

Exit condition: touch and keyboard users can recover project changes, native text Undo remains native, and storage failure is visible.

### Phase 4 - compact export discovery

1. Separate first-use prompt from expanded help.
2. Default first-time users to the compact prompt.
3. Persist dismissal only from the explicit completion/close action.
4. Keep `?` reopening behavior.
5. Apply responsive `Work skin` labeling.
6. Re-measure and test the fixed export bar after each state change.

Exit condition: guidance remains discoverable without consuming a large portion of the phone composer by default.

### Phase 5 - action-first work-skin handoff

1. Correct preflight severity and applicability in `src/lib/preflight.ts`.
2. Derive blocker/warning/pass/info groups from severity/status.
3. Add independent CSS/HTML copy state and manual-copy disclosure state.
4. Reset modal-local state in `openWorkSkin()`.
5. Reorder the modal exactly as section 5.9.
6. Put Copy CSS in the initial phone viewport.
7. Put Copy HTML before previews and complete audit detail.
8. Add local live regions and clipboard-failure focus behavior.
9. Preserve the title, one-skin, fallback, and host warnings.
10. Preserve master-skin lazy computation and analytics bookkeeping.

Exit condition: a new author can complete the two-copy AO3 handoff from the top of the dialog, while experienced authors can reach manual output and full checks.

### Phase 6 - responsive and regression pass

1. Add `100dvh` with `h-screen` fallback.
2. Run desktop and mobile workspace tests.
3. Capture the screenshot matrix in section 11.
4. Inspect all four platform previews and authoring controls.
5. Save and inspect one real PNG per platform.
6. Run output parity, namespace, master-skin, skin-off, injection, and platform authoring suites.
7. Run typecheck, lint, CSS audit, and production build.

Exit condition: the shell is stable at representative sizes and no compiler/export behavior changed.

---

## 10. Test architecture

### 10.1 Unit: project replacement snapshots

`tests/project-state.unit.spec.ts` covers:

- identical nested objects with different key insertion order compare equal;
- message array reorder compares different;
- settings-only edit compares different;
- cast/account-only edit compares different;
- empty project with query change compares different;
- function does not mutate input;
- undefined values are treated consistently.

Policy remains in browser tests because source-of-entry refs live in the page.

### 10.2 Desktop/keyboard: `tests/workspace-ux.spec.ts`

Use the desktop project and local `UX_BASE_URL`. Cover:

#### History

- Undo disabled and Redo disabled on a fresh entry;
- one project change enables Undo after debounce;
- Undo restores prior project and enables Redo;
- Redo restores the changed project;
- Undo then edit removes the redo branch;
- rapid typing inside one 500 ms interval coalesces as current behavior specifies;
- changes separated by the debounce create distinct entries;
- clicking visible controls and using keyboard shortcuts produce the same project states;
- `Ctrl/Cmd+Z` in a text field uses native field Undo and does not move the project history index;
- modal/sheet/help/preview toggles do not create history entries.

#### Save state

- a change exposes `Saving…` then `Saved in this browser`;
- both are observable from the live region;
- a stubbed storage refusal exposes `Not saved` and the detailed alert;
- `Ctrl/Cmd+S` uses the same error path;
- later successful save clears the prior error.

#### Replacement

- untouched fresh platform seed replaces without a dialog;
- editing one setting causes a dialog;
- editing only Twitter account data in a zero-post project causes a dialog;
- editing only Google query causes a dialog;
- returning stored project is opened even with zero messages;
- returning stored project is protected even unchanged;
- restored backup is protected even unchanged;
- Cancel preserves the exact project, history, storage, picker, and focus;
- Confirm applies the named choice once and resets history/baseline;
- after confirmed replacement, returning to picker without edits does not immediately prompt;
- example buttons use human labels in the prompt.

#### Modal behavior

For every migrated dialog:

- opener is focused before click;
- expected `data-autofocus` target receives focus;
- repeatedly pressing Tab never leaves the dialog;
- Shift+Tab wraps backward;
- Escape closes one dialog;
- opener receives focus after close;
- content click does not close;
- direct backdrop click closes where allowed;
- body overflow is restored to its previous value.

Use a shared test helper to enumerate visible focusable elements. Do not copy eight slightly different focus-loop tests.

#### Work-skin handoff

- Copy CSS precedes previews and detailed passed checks in DOM and visual order;
- Copy HTML precedes previews and detailed passed checks;
- only the current platform's preflight ids appear;
- content warning leaves both copy actions enabled;
- internal CSS or HTML blocker disables both actions;
- successful CSS and HTML copy have independent visible/live states;
- copying both sends `handoff_completed` only once;
- scope reset invalidates current CSS completion bookkeeping;
- credit reset invalidates current HTML completion bookkeeping;
- clipboard rejection opens, focuses, and selects the correct manual textarea;
- opening the dialog a second time restores documented defaults;
- fallback preview and transcript remain reachable;
- backup action still changes the backup preflight state.

### 10.3 Mobile: `tests/workspace-mobile.spec.ts`

Run explicit viewports rather than relying only on the Pixel 7 preset:

- 360 x 740;
- 390 x 844;
- 412 x 915.

Cover:

- no header-action overlap;
- no horizontal document overflow;
- document scroll remains locked;
- timeline and preview own their scrolling;
- status and both history buttons remain visible;
- composer can receive focus and is not covered by the export bar;
- last timeline control remains reachable;
- preview expands/collapses and persists across reload;
- compact first-use prompt is in flow and measured;
- expanded help is in flow and measured;
- analytics consent plus export bar reserves their combined height;
- no export-row horizontal scroll;
- Work skin has a visible label at 390/412 and an accessible name at 360;
- work-skin dialog traps focus and closes on Escape;
- Copy work skin CSS is visible in the initial 390 x 844 dialog viewport;
- both manual-copy textareas remain reachable;
- backup dialog content scrolls internally on short phones.

Geometry assertions should allow one pixel of browser rounding. Assert relationships, not hard-coded audit heights.

### 10.4 Existing suites that remain authoritative

Do not replace these with generic workspace tests:

- `tests/ios-authoring.spec.ts`;
- `tests/whatsapp-authoring.spec.ts`;
- `tests/twitter-authoring.spec.ts`;
- Google behavior covered by existing landing/deep-link/work-skin flows;
- `tests/work-skin.unit.spec.ts`;
- `tests/work-skin.spec.ts`;
- `tests/master-skin.spec.ts`;
- `tests/namespace.spec.ts`;
- `tests/skin-off.spec.ts`;
- `tests/ao3-injection.spec.ts`;
- `tests/workspace-scroll.spec.ts`;
- `tests/mobile-preview.spec.ts`;
- the platform raster suites.

### 10.5 Test isolation

Every browser test begins with intentional local state:

- clear or seed `ao3SkinProject`;
- clear or set `ao3skin_help_dismissed`;
- clear or set analytics consent through the existing helper/path;
- clear backup markers when the test asserts preflight backup state;
- avoid depending on test order;
- use a new page/context when testing first-visit initialization.

Do not globally dismiss first-use UI in a shared `beforeEach` and then claim it is tested.

### 10.6 Output parity gate

Before and after the UX refactor, compare representative output for:

- iMessage two-person and rich group/media scenes;
- WhatsApp chat and structured media scene;
- Twitter thread/media scene;
- Google results scene;
- master skin CSS;
- skin-off HTML/read order.

If literal byte snapshots are too large, compare SHA-256 hashes in a temporary audit script or assert against existing pinned fixtures. Do not commit a second generator implementation just to create a comparison.

---

## 11. Visual QA

### 11.1 Screenshot matrix

Capture after implementation:

| Viewport | Required states |
| --- | --- |
| 1440 x 1000 | iMessage workspace, Google workspace, work-skin dialog, backup dialog |
| 1024 x 768 | WhatsApp workspace, Twitter workspace, expanded export help |
| 768 x 1024 | one workspace at the `lg` boundary, settings sheet, replacement dialog |
| 412 x 915 | each platform workspace, compact help, work-skin dialog |
| 390 x 844 | work-skin initial viewport, fallback preview, manual CSS fallback |
| 360 x 740 | picker, most crowded header, export bar with compact prompt, backup dialog |

Use representative rich fixtures where platform-specific settings and previews are visible. Shared dialogs need not be repeated four times unless their content changes by platform; the work-skin dialog must be spot-checked for all four because preflight applicability and scope labels do change.

### 11.2 Inspect by eye

- header title truncates before controls overlap;
- status bar does not look like a second global header;
- Undo/Redo targets are large enough for touch;
- save text does not cause horizontal layout jumps;
- mobile composer stays visible when the keyboard would normally resize the viewport;
- preview collapse button remains easy to find;
- export prompt does not dominate the workspace;
- work-skin Copy CSS reads as the first primary action;
- destructive replacement/delete actions are visually subordinate to the safe default until the user deliberately chooses them;
- warnings are visible without looking like generator failure;
- collapsed details summaries describe what they contain;
- focus rings are not clipped by modal overflow;
- the no-skin preview remains understandable without CSS.

### 11.3 PNG inspection

Save one 2x PNG for each platform and open the actual files. Confirm:

- no crop or unexpected padding change;
- platform chrome remains intact;
- avatars, icons, and bubble tails remain present;
- long content is not clipped;
- the workspace shell change did not alter preview width in a way that changes export geometry;
- known renderer limitations are unchanged, not silently reclassified as fixed.

This is evidence level 3 from `WORK-SKIN-IMPLEMENTATION.md`: real rendered files inspected. It is not real AO3 evidence.

---

## 12. Analytics

Preserve existing events and their payload boundaries:

- `template_selected` once after actual selection;
- `export_started` and `export_ready` when work-skin handoff opens;
- `output_copied` for CSS and HTML separately;
- `handoff_completed` once after both current parts are copied;
- `export_failed` with `CLIPBOARD_DENIED` on clipboard rejection;
- `fallback_preview_opened` when the fallback is deliberately opened;
- backup import/download events already present;
- consent remains off until allowed.

Do not send:

- project id;
- message content;
- character names;
- query text;
- URLs;
- replacement snapshot;
- save-state churn;
- every Undo/Redo click unless separately approved as a product question.

When scope or credit changes generated text, reset handoff completion bookkeeping so stale copied parts cannot produce a false completion. Do not fire `template_selected` when a replacement dialog merely opens or is canceled.

---

## 13. Acceptance criteria

### 13.1 P0 correctness and accessibility

- [x] A changed settings-only project is protected before platform/example replacement.
- [x] A changed zero-post Twitter project is protected.
- [x] A changed zero-result Google project is protected.
- [x] Any stored project opens directly, regardless of message count.
- [x] Returning and backup-restored projects are protected even unchanged.
- [x] Untouched fresh/deep-link/template seeds do not show an unnecessary replacement prompt.
- [x] Canceling replacement changes no project, history, or storage state.
- [x] Every in-scope modal enters focus, traps Tab, closes on Escape, and restores focus.
- [x] Exactly one component owns Escape for an open modal.
- [x] Project Undo does not hijack native text-field Undo.
- [x] Save failure is visible for both autosave and `Ctrl/Cmd+S`.

### 13.2 UX acceptance

- [x] Visible Undo and Redo are available on desktop and phone.
- [x] Save state is expressed in text and a polite live region.
- [x] Workspace header remains collision-free at 360, 390, and 412 px.
- [x] Mobile retains authoring plus collapsible preview.
- [x] First-use export guidance starts compact.
- [x] Expanded guidance remains available and accurate.
- [x] Fixed export height is measured and reserved in every help/consent state.
- [x] Work skin is discoverable from the export row.
- [x] Copy work skin CSS is visible in the initial 390 x 844 modal viewport.
- [x] Copy scene HTML appears before preview and complete check details.
- [x] Clipboard failure exposes and focuses the matching manual fallback.
- [x] Only current-platform preflight checks are presented.
- [x] Content warnings do not disable copy.
- [x] Internal CSS/HTML contract failures do disable copy.
- [x] The title, one-skin, skin-off, and remote-host facts remain present.

### 13.3 Regression acceptance

- [x] Work-skin CSS and HTML are byte-identical for pinned fixtures.
- [x] Master-skin output is unchanged.
- [x] CSS lint reports zero blocked rules for shipped outputs.
- [x] Namespace tests pass.
- [x] Skin-off reading order passes.
- [x] Paragraph-injection tests pass.
- [x] All four platform authoring suites pass.
- [x] Mobile preview and workspace-scroll suites pass.
- [x] Backup round-trip and safety-download behavior pass.
- [x] Analytics consent and event tests pass.
- [x] One real 2x PNG per platform has been inspected.
- [ ] Typecheck, lint, and production build pass.

### 13.4 Evidence language

- [x] Local Playwright simulation is described as local/browser evidence.
- [x] Real PNG inspection is described as rendered-file evidence.
- [x] No one writes “AO3 passed” unless the updated CSS was saved to a signed-in AO3 account, attached to work text, and read back from AO3.
- [x] If output remains identical, the previous AO3 evidence may be cited as inherited output evidence, with the parity proof recorded.

---

## 14. Verification commands

### 14.1 Start the local app

In one PowerShell terminal:

```powershell
npm run dev -- -p 3001
```

In the test terminal:

```powershell
$env:UX_BASE_URL = 'http://localhost:3001'
$env:UX_CHANNEL = 'msedge'
```

Use `chrome` only if Edge is unavailable and document the substitution.

### 14.2 Fast gates

```powershell
npm run typecheck
npm run lint
npm run audit:ao3-css
npx playwright test --project=unit
```

### 14.3 Focused UX suites

```powershell
npx playwright test --project=desktop tests/workspace-ux.spec.ts tests/project-backup.spec.ts tests/analytics-consent.spec.ts --workers=1
npx playwright test --project=mobile tests/workspace-mobile.spec.ts tests/mobile-preview.spec.ts --workers=1
```

Use one worker for these stateful local-storage/focus investigations even if the full configuration permits parallel work.

### 14.4 Work-skin correctness suites

```powershell
npx playwright test --project=desktop tests/work-skin.spec.ts tests/master-skin.spec.ts tests/namespace.spec.ts tests/skin-off.spec.ts tests/ao3-injection.spec.ts --workers=1
npx playwright test --project=desktop tests/ios-authoring.spec.ts tests/whatsapp-authoring.spec.ts tests/twitter-authoring.spec.ts tests/workspace-scroll.spec.ts --workers=1
```

### 14.5 Raster/hosted smoke

```powershell
npx playwright test --project=desktop tests/ios-raster.spec.ts tests/whatsapp-raster.spec.ts tests/twitter-raster.spec.ts --workers=1
npx playwright test --project=desktop tests/ios-hosted-export.spec.ts tests/whatsapp-hosted-export.spec.ts tests/twitter-hosted-export.spec.ts --workers=1
```

Network-dependent hosted tests may fail for external reasons. Record the exact failing boundary; do not reinterpret a host outage as proof about local output.

### 14.6 Production gate

```powershell
npm run build
```

Finally review scope:

```powershell
git status --short
git diff --stat
git diff -- src/lib/generator.ts src/lib/workSkin.ts src/lib/schema.ts
```

The last diff should be empty unless the work has been explicitly re-scoped.

---

## 15. Commit boundaries

Keep commits independently reviewable:

1. `test: reproduce workskin workspace ux gaps`
   - failing focus, replacement, shortcut, mobile, and output-parity tests.
2. `fix: move workspace overlays to accessible modal shell`
   - modal migrations and duplicate Escape removal only.
3. `fix: protect full project state before replacement`
   - stable snapshot helper, picker intent, replacement dialog, route behavior.
4. `feat: expose project history and save status`
   - status bar, callbacks, native text Undo guard, save helper.
5. `refactor: make export guidance compact by default`
   - prompt/help state and fixed-bar geometry tests.
6. `refactor: put workskin copy actions first`
   - preflight taxonomy/applicability, copy fallback, hierarchy, modal reset.
7. `test: complete workskin workspace regression evidence`
   - screenshot notes, output parity, raster inspection record, final updates.

Do not mix generator cleanup, new platform features, or site-skin fixes into these commits.

---

## 16. Common wrong turns

### Do not copy the site-skin mobile pane model

Conversation authoring benefits from seeing the latest message land in preview. Keep the bounded collapsible preview.

### Do not use `messages.length` as dirty state

Twitter can contain valuable account/settings work with zero posts. Google can contain query/settings work with zero results. Seed templates can contain messages without user work.

### Do not use activation state as replacement protection

Activation deliberately ignores small changes until an analytics threshold is crossed. Replacement protection must care about every persisted project field.

### Do not assume autosave makes replacement safe

There is one local project slot. Autosave makes the replacement durable; it does not preserve the previous project.

### Do not put Undo/Redo into the crowded mobile header

Use the dedicated status row inside the authoring column.

### Do not hijack native text Undo

Global project history must yield when the event target is a text editor.

### Do not rewrite the working history algorithm without evidence

The debounce/branch probe passed. Add callbacks and coverage around it before considering deeper refactoring.

### Do not add `aria-modal` without modal behavior

A dark backdrop and ARIA attributes do not trap focus, implement Escape, or restore the opener. Use the shared shell.

### Do not let the page and modal both handle Escape

One key press must close one surface and return focus once.

### Do not show all 21 preflight rows at the top

Show active blockers/warnings near the action, summarize passed checks, and omit wrong-platform checks.

### Do not call content warnings blockers

Only invalid generated CSS/HTML disables copying under the accepted product policy.

### Do not hide the manual copy fallback permanently

Clipboard APIs fail in real browsers and permission contexts. The read-only text remains available and becomes prominent on failure.

### Do not reset copied analytics only visually

Scope/credit changes can make a previously copied part stale. Reset the ref-based handoff bookkeeping as well as button labels.

### Do not compute the master skin on every keystroke

Keep it lazy while the handoff modal is open and all-platform scope is selected.

### Do not float first-use help over the composer

It must remain in flow so `--export-bar-h` reports the actual obstruction.

### Do not hard-code export-bar height

The height changes with width, help, and consent. Preserve live measurement.

### Do not change emitted work-skin output for a shell problem

Moving, grouping, and explaining output should not alter the output itself.

### Do not claim a new AO3 verification level

Playwright sanitization is not an authenticated AO3 save/readback. Name the evidence actually collected.

---

## 17. Definition of done

This plan is complete only when all of the following are true:

1. The replacement decision is based on the complete project and entry source.
2. Stored zero-message projects resume safely.
3. Every in-scope top-level dialog satisfies the shared focus contract.
4. Native text Undo and project Undo coexist.
5. Undo/Redo are visible and usable by touch.
6. Save state is textual, live, and truthful for autosave and manual save.
7. First-use export guidance is compact by default.
8. Work-skin CSS and HTML copy actions lead the handoff.
9. Clipboard failure exposes a focused manual fallback.
10. Preflight shows applicable warnings without mislabeling them as blockers.
11. The workspace remains internally scrolling and usable at all required viewports.
12. Platform-specific authoring and previews are unchanged.
13. Work-skin and master-skin output parity is proved.
14. The full automated gate and production build pass.
15. Four real PNG files have been inspected.
16. The final handoff records exact commands, counts, screenshots, output hashes/parity evidence, known failures, and the highest AO3 evidence level actually reached.

---

## 18. As-built record template

Complete this section during implementation; do not mark the plan itself “implemented” without it.

### 18.1 Completion summary

- Implementation date: 21 August 2026
- Implementer: Codex
- Commits: none; changes remain in the shared working tree
- Scope deviations: added a Google 2x raster test, explicit iOS 2x coverage, and the previously missing Google authoring suite so all four platforms have dedicated authoring and rendered-file evidence. The in-app Browser runtime was unavailable, so local browser checks used the installed system Edge through Playwright.
- Output files changed: no emitted work-skin, master-skin, schema, example, or project-file generator source changed; UX shell, preflight presentation, and tests changed.
- Highest evidence level reached: local/system-Edge browser evidence plus inspected rendered-file evidence, with inherited AO3 output evidence justified by output parity. No new signed-in AO3 save/readback was performed.

### 18.2 Automated evidence

| Command | Result | Notes |
| --- | --- | --- |
| `npm run typecheck` | Pass | Final run completed with no TypeScript errors. |
| `npm run lint` | Known unrelated failure | Full-repo lint reaches one pre-existing error: unused `VAR_FN` at `scripts/ao3-sanitizer-oracle.mjs:66`, plus existing warnings. Scoped lint for the work-skin workspace files has zero errors and two existing hook warnings in `src/pages/index.tsx`. |
| `npm run audit:ao3-css` | Pass | 182 properties and 20 shorthands match the pinned upstream AO3 allowlist; no missing or extra entries. |
| unit suite | Pass | 692 passed, 1 skipped. |
| desktop UX suite | Pass | Workspace, backup, analytics-consent, replacement, modal-focus, native-Undo, history, compact-help, and clipboard-fallback cases pass in final focused runs. |
| mobile UX suite | Pass | 12 passed and 1 skipped in the existing mobile/scroll suites; the final 360/390/412 plus desktop evidence suite passed 5/5 in one run. |
| work-skin correctness suites | Pass | 61 passed across work-skin, master-skin, namespace, skin-off, and AO3-injection suites. |
| platform authoring suites | Pass | iOS, WhatsApp, and Twitter authoring cases pass; the new Google authoring suite passed 2/2. |
| raster/hosted smoke | Pass | 7 raster tests and 4 hosted-export tests passed. |
| `npm run build` | Pass | Next.js 16.1.6 production build completed successfully. |

### 18.3 Output parity

Record before/after hashes or exact fixture assertions for:

- iMessage CSS/HTML: exact fixture, namespace, skin-off, and injection assertions pass; generator source diff is empty.
- WhatsApp CSS/HTML: exact fixture, namespace, skin-off, and injection assertions pass; generator source diff is empty.
- Twitter CSS/HTML: exact fixture, namespace, skin-off, and injection assertions pass; generator source diff is empty.
- Google CSS/HTML: exact fixture, namespace, skin-off, injection, and raster assertions pass; generator source diff is empty.
- master CSS/HTML: master-skin assertions pass; `src/lib/workSkin.ts` and related output-source diff is empty.

### 18.4 Visual evidence

- screenshot directory: `tmp/workskin-workspace-ux-final/`
- four inspected PNG paths: `test-results/google-raster-real-Save-PNG-captures-a-Google-scene-at-2×-desktop/google-news-2x.png`; `test-results/ios-raster-rich-iOS-fixtur-18ed2-ially-doubled-2×-resolution-desktop/ios-rich-2x.png`; `test-results/twitter-raster-real-Save-P-858f1-media-geometry-at-1×-and-2×-desktop/twitter-rich-2x.png`; `test-results/whatsapp-raster-WhatsApp-2-da67d-on-and-still-fully-expanded-desktop/whatsapp-rich-2x.png`.
- viewport failures found and fixed: replacement modal focus, work-skin initial-action placement at 390 × 844, header/status collisions, and a test-only ambiguous desktop `Preview` locator.
- known visual limitations left unchanged: raster fixtures deliberately use tiny/stub remote images, which render as flat placeholder blocks; this is test data, not clipping.

### 18.5 AO3 evidence

- local simulation run: yes, against `http://localhost:3001` in system Edge through Playwright; this is local/browser evidence only.
- real PNG inspection run: yes, four platform 2x PNG files were opened and visually inspected; this is rendered-file evidence.
- signed-in AO3 save/readback run: no.
- if no new readback, inherited evidence and output-parity justification: prior AO3 evidence is inherited because generator/work-skin/schema/example/project-file sources have no diff and the pinned output, master-skin, namespace, skin-off, and injection suites pass. This is not a new claim that AO3 passed.

### 18.6 Remaining backlog

- native confirms intentionally not migrated: native confirms outside the plan's top-level dialog inventory remain unchanged.
- unrelated site-skin work preserved: yes; pre-existing site-skin source and test changes were not modified as part of this implementation.
- external/network failures: none in hosted-export smoke tests. The in-app Browser runtime reported no available browser; system Edge Playwright supplied the local evidence instead.
- follow-up product decisions: clear the unrelated full-repo lint baseline; optionally perform a new signed-in AO3 save/attach/readback if a higher evidence level is required.
