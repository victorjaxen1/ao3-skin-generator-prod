# Character Input and Identity Editing — Implementation Plan

**Prepared:** 12 August 2026  
**Scope:** the conversation generator (`/`), not the separate site-skin builder  
**Audience:** developer implementing the change  
**Status:** code complete on 13 August 2026. Both releasable slices have shipped, the whole automated suite is green, and the documentation is updated. Only human-in-the-loop QA and one product decision remain — see §11.

## 1. Outcome

Make character identity feel like one coherent feature:

- a user can add, select, or edit a person from the place where that person is visible;
- name, handle, avatar, and verified state are saved together rather than updated by unrelated handlers;
- quick-start templates load real avatars and remain editable without detaching names from handles;
- the composer adds messages, while identity controls manage who is speaking;
- Google Search has no character, people, account, or avatar affordances;
- existing projects and backup files continue to render correctly.

The implementation should fix the identity model before adding more shortcuts. The current breakage is caused by duplicated identity state, so adding click handlers alone would make the same inconsistent data easier to reach.

## 2. Draft plan and refinement

### Initial plan

1. Make preview avatars and editor names clickable.
2. Change the composer plus button to open a new-character form.
3. Hide character controls on Google.
4. Repair the avatar paths in quick templates.
5. Add interaction tests.

### Refinements after reading the code

The code audit changes that plan in five important ways:

1. **Do not treat this as an avatar-path-only bug.** Every local avatar referenced by `src/lib/examples.ts` exists and returned HTTP 200 from the local app. The Twitter templates instead duplicate one identity in account settings, `twitterCharacterPresets`, and each message's custom fields. That duplication is the primary failure mechanism.
2. **Do not keep automatically merging the global library into every Twitter project.** `index.tsx` currently combines the two lists by character name. Names are not stable identifiers, and a saved library edit can silently alter the compose roster. A library character should be explicitly copied into the current scene.
3. **Pass a complete profile, never `(name, avatarUrl)`.** `CharacterLibrary`'s current “Set as tweeter” action drops `twitterHandle` and `verified`, which directly explains disappearing handles.
4. **Keep message options available.** Repurposing the plus button must not remove image-only messages or other pre-send details. Give identity and message options separate, clearly labelled controls.
5. **Use one People/Accounts sheet.** Do not make users choose between `CastPanel` and `CharacterLibrary`. The library and preset bank should become sources inside the same workflow, not a second drawer with different editing rules.

## 3. Current-state diagnosis

### 3.1 Identity is stored in too many places

| Identity | Current storage |
| --- | --- |
| iOS/Android self | `settings.chatYourName` |
| iOS/Android contact | platform contact-name and avatar settings |
| Group member | `iosGroupParticipants` / `androidGroupParticipants` |
| Twitter main account | four `settings.twitter*` fields |
| Twitter project account | `settings.twitterCharacterPresets` |
| Twitter post override | `Message.sender`, `twitterHandle`, `avatarUrl`, `verified`, `useCustomIdentity` |
| Reusable saved character | global `UniversalCharacter[]` in localStorage |

This is workable only if every operation updates the correct group atomically. The current UI does not.

### 3.2 Confirmed failure paths

- `CharacterLibrary` edits only a saved character's name. It cannot create a fully custom character or edit its avatar, handle, or verified state.
- `onSetAsContact(name, avatarUrl)` omits the Twitter handle and verified state.
- Quick Twitter templates set the same person as the main account, a project preset, and a custom identity on every post. Editing the main account therefore does not reliably change those posts.
- Twitter's compose roster merges project presets with every global library character and de-duplicates by `name`.
- The People panel displays project presets but cannot edit them.
- The header title edits only a name/query; the adjacent avatar and handle live elsewhere.
- Preview clicks can edit a message, but cannot resolve an identity target.
- Google deliberately routes the header's people icon to the global Character Library, even though a search page has no cast. This conflicts with the requested product model.

### 3.3 Avatar evidence

The following template assets are present under `public/assets` and returned `200 image/png` locally: Alex Rivers, Taylor Swift, Jamie Chen, Jordan, Riley, Mom, and Casey. Keep the path check in automated coverage, but fix template instantiation and identity resolution first.

## 4. Final interaction model

### 4.1 One vocabulary

- iOS/Android panel title: **People**
- Twitter panel title: **Accounts**
- Primary creation CTA: **Add person** or **Add account**
- Reusable source tab: **Library**
- Built-in image source: **Avatar presets**
- Google: none of these terms or controls appear

### 4.2 Entry points

| Surface | iOS / Android | Twitter | Google |
| --- | --- | --- | --- |
| Header identity name/avatar | Open People focused on contact/group | Open Accounts focused on main account | Keep inline search-query editing |
| Header people icon | Open People overview | Open Accounts overview | Hidden and absent from tab order |
| Composer identity chip | Switch speaker; tap active identity to edit | Switch posting account; tap active account to edit | Not rendered |
| Composer person-plus button | Open **Add person** | Open **Add account** | Not rendered |
| Timeline sender name | Open that person's editor | Open that account's editor | Remains result metadata, not a person |
| Preview identity name/avatar | Open the matching identity editor | Open the matching account editor | No identity click behaviour |
| Preview message body | Keep current click-to-edit-message behaviour | Keep current click-to-edit-post behaviour | Keep current result editing behaviour |

Identity click handling must take precedence only when the click lands on an avatar, name, or handle. Clicking the rest of a message continues to open the message editor.

### 4.3 People/Accounts sheet

Merge the responsibilities of `CastPanel` and `CharacterLibrary` into one controlled sheet with these states:

```ts
type IdentityPanelMode =
  | { kind: 'overview' }
  | { kind: 'create'; suggestedRole?: 'self' | 'contact' | 'participant' | 'account' }
  | { kind: 'edit'; target: IdentityTarget }
  | { kind: 'library' }
  | { kind: 'avatar-presets'; returnTo: 'create' | 'edit' };
```

The create/edit form contains:

- Name — required.
- Avatar — optional URL/upload plus avatar presets.
- Twitter handle — Twitter only; store without a leading `@`, display with one.
- Verified — Twitter only.
- Group name colour — scene participant only.
- **Add to this scene** / **Save changes** as the primary action.
- **Also save to my library** as an explicit option when creating. Scene edits must not silently rewrite the global library.

Selecting an avatar preset should prefill the avatar and focus the Name field. Do not immediately create a saved character called “Casual Young Man” or “Mage”; those are image descriptions, not likely character names.

### 4.4 Composer controls

For iOS, Android, and Twitter:

- repurpose the current generic plus affordance as a clearly labelled person-plus action;
- give it an accessible name of `Add person` or `Add account` rather than relying on the icon;
- retain a separate **Message options** control using an ellipsis, sliders, or paperclip icon;
- preserve attachment-only iOS/Android messages and all current pre-send fields;
- after send, the expanded timeline card remains the primary place for detailed editing.

For Google:

- render no identity chip or person-plus action;
- keep link and description fields under a Google-specific `Add result details` control with a link/details icon, not a people or avatar icon.

At 360px width, the identity chip may collapse to avatar/initials plus a short name, but its accessible name must still say who is active and that it can be changed.

### 4.5 Removal and existing messages

Never let deleting a person corrupt posts already assigned to them.

- If an identity is unused, remove it immediately.
- If it is referenced, show the count and require one of:
  - reassign existing messages to another identity; or
  - remove it from the composer while retaining it as an archived scene identity.
- Do not silently change old messages to the main account.

The simplest implementation is an `archived` flag: archived identities no longer appear in the new-message selector but continue to resolve old messages and remain editable from those messages.

## 5. Data model and migration

### 5.1 Project-scoped identities are canonical

Add an optional project cast that is independent of the global library:

```ts
interface SceneCharacter {
  id: string;
  name: string;
  avatarUrl?: string;
  twitterHandle?: string;
  verified?: boolean;
  sourceLibraryId?: string;
  archived?: boolean;
}

interface SceneCast {
  characters: SceneCharacter[];
  selfId?: string;
  contactId?: string;
  twitterPrimaryId?: string;
}

interface SkinProject {
  // existing fields
  cast?: SceneCast;
}
```

Extend references rather than matching identities by text:

```ts
interface Message {
  // existing fields retained for legacy fallback
  characterId?: string;
}

interface GroupParticipant {
  // existing id/name/avatar/color retained during migration
  characterId?: string;
}
```

The global `UniversalCharacter` library remains a reusable template collection. Copying a library entry into a scene creates a new `SceneCharacter.id` and records `sourceLibraryId`; it does not create a live cross-project reference.

### 5.2 Resolution order

Put identity selection in `src/lib/identity.ts`, not scattered component conditionals:

1. Resolve `characterId` from `project.cast.characters`.
2. Resolve the bound scene self/contact/Twitter-primary identity.
3. Fall back to current settings, participant fields, and per-message Twitter fields for legacy projects.
4. Fall back to safe labels such as `You`, `Them`, or `User` only after all stored values are empty.

Expose pure helpers such as:

```ts
resolveMessageIdentity(project, message): ResolvedIdentity
resolveIdentityTarget(project, target): ResolvedIdentity
addSceneCharacter(project, draft, role): SkinProject
updateSceneCharacter(project, id, updates): SkinProject
archiveOrReassignCharacter(project, id, replacementId?): SkinProject
normalizeTwitterHandle(value): string
```

Every form save should produce one `setProject` update so undo/redo sees one coherent change.

### 5.3 Legacy migration

Add `migrateProjectIdentities(project)` and run it at all entry points:

- local storage load in `src/lib/storage.ts`;
- project backup import in `src/lib/projectFile.ts`;
- quick-template instantiation;
- optionally immediately before generation as a defensive read-only normalization.

Migration rules:

- synthesize scene self/contact records from chat settings;
- synthesize group scene characters and attach `characterId` to participants;
- synthesize the Twitter primary record from the four main settings fields;
- convert `twitterCharacterPresets` to scene characters using their IDs where safe;
- convert legacy `useCustomIdentity` messages by matching the complete normalized identity, not name alone;
- retain legacy fields as fallback during this release;
- do not rewrite the global library.

Bump `PROJECT_FILE_SCHEMA_VERSION` to 2, add a v1-to-v2 import migration, and keep v1 fixtures. Local autosave currently has no schema envelope, so its migration must be shape-based and idempotent.

### 5.4 Template instantiation

Create `instantiateTemplate(example)` that:

- deep-clones the module constant;
- assigns a fresh project ID;
- runs identity migration/normalization;
- validates every local avatar path;
- returns a project with no shared object references to `TEMPLATE_EXAMPLES`.

For the three current Twitter quick templates, the posts are all by the main account. They should reference `twitterPrimaryId` (or have no `characterId`, meaning primary) rather than duplicating a one-item preset and setting `useCustomIdentity` on every message. Future multi-account templates should seed distinct scene characters and reference them by ID.

## 6. Implementation phases

### Phase 0 — Characterize current behaviour

Add failing tests before changing the model:

1. Loading each avatar-bearing quick template produces an image with `naturalWidth > 0`.
2. Editing the main Twitter name, handle, avatar, and verified state updates existing main-account posts.
3. Applying a library character to Twitter preserves all four fields.
4. Two characters with the same name but different IDs remain distinct.
5. Google exposes no People, Characters, Accounts, Add person, Add account, or avatar controls.

### Phase 1 — Identity domain and migrations

Files:

- `src/lib/schema.ts`
- new `src/lib/identity.ts`
- `src/lib/storage.ts`
- `src/lib/projectFile.ts`
- `src/lib/examples.ts`
- `src/pages/index.tsx`

Tasks:

- add the scene cast types and resolvers;
- add idempotent migrations and the backup schema bump;
- replace sequential partial field updates with one complete identity transaction;
- stop name-based de-duplication;
- stop automatically adding every global library entry to the Twitter compose roster;
- instantiate cloned, normalized templates;
- keep legacy reads until a later cleanup release.

Exit criterion: generator output for unchanged legacy fixtures is byte-equivalent except where the quick-template identity bug is intentionally corrected.

### Phase 2 — Unify the People/Accounts UI

Files:

- replace or substantially refactor `src/components/CastPanel.tsx`
- fold in `src/components/CharacterLibrary.tsx`
- reuse `AvatarSelector.tsx` and `ImageUrlInput.tsx`
- `src/pages/index.tsx`
- `src/components/BottomSheet.tsx` if focus restoration needs support

Tasks:

- implement overview/create/edit/library/preset modes;
- allow full-profile create and edit;
- make library-to-scene copy semantics explicit;
- preserve group-mode differences: group identity is not a participant identity;
- add focus management, Escape behaviour, unsaved-change handling, and return focus to the opener;
- add referenced-identity archive/reassign protection.

Do not mount a full avatar-preset grid inside every participant row. Keep one preset browser state in the sheet to avoid clipping and excessive DOM.

### Phase 3 — Wire intuitive entry points

Files:

- `src/components/WorkspaceHeader.tsx`
- `src/components/ComposeBar.tsx`
- `src/components/MessageTimeline.tsx`
- `src/components/PreviewPane.tsx`
- `src/pages/index.tsx`

Tasks:

- make non-Google header identity clicks open the focused panel;
- keep Google's query title inline-editable;
- add the composer person-plus action and separate message-options action;
- make timeline sender labels buttons without stealing row/body clicks;
- add preview event delegation for existing identity CSS classes;
- resolve the clicked preview target from the message ID and project data;
- add hover/focus cues only to interactive identity elements;
- keep message click-to-edit behaviour unchanged elsewhere.

Preview identity clicking is a convenience, not the only accessible route. Generated work-skin HTML should not gain editor-only buttons or required `data-*` attributes.

### Phase 4 — Generator and export resolution

Files:

- `src/lib/generator.ts`
- `src/lib/transcript.ts`
- `src/lib/workSkin.ts` only if its projection bypasses `buildHTML`
- export-related tests

Tasks:

- resolve names, handles, avatars, and verified state through the identity helper;
- use scene IDs for Twitter posts and group participants;
- retain legacy message fields as fallback;
- ensure PNG, preview, AO3 HTML, work-skin output, and plain transcript agree;
- do not change platform CSS unless needed for the new click affordance in the editor wrapper.

### Phase 5 — Google exclusions and cleanup

Files:

- `src/components/WorkspaceHeader.tsx`
- `src/components/ComposeBar.tsx`
- `src/pages/index.tsx`
- relevant tests and documentation

Tasks:

- remove the current Google route to `CharacterLibrary`;
- do not render the people icon or identity chip for Google;
- keep Google result link/description editing under result-specific language;
- remove obsolete character props and comments once no route uses them;
- update `docs/CHARACTER-BANK-GUIDE.md` after the new workflow ships.

## 7. File-level change summary

| File | Required change |
| --- | --- |
| `src/pages/index.tsx` | Own one identity-panel state; call atomic identity helpers; clone templates; remove global/project name merge; route no identity UI for Google. |
| `src/lib/schema.ts` | Add scene cast and stable message/participant references; retain legacy fields temporarily. |
| `src/lib/identity.ts` | Central resolution, migration, normalization, add/edit/archive/reassign operations. |
| `src/lib/examples.ts` | Normalize quick templates so main-account posts follow the main account and local avatars are canonical. |
| `src/lib/storage.ts` | Migrate old autosaves without dropping avatar or handle fields. |
| `src/lib/projectFile.ts` | Schema v2, v1 migration, round-trip scene identities. |
| `src/components/CastPanel.tsx` | Become the unified People/Accounts workflow or be replaced by `IdentityPanel.tsx`. |
| `src/components/CharacterLibrary.tsx` | Fold into the unified panel; remove the partial `(name, avatarUrl)` apply API. |
| `src/components/WorkspaceHeader.tsx` | Open focused identity editor for non-Google; hide people control on Google. |
| `src/components/ComposeBar.tsx` | Separate Add person/account from Message options; use stable IDs in selectors. |
| `src/components/MessageTimeline.tsx` | Clickable sender labels and stable identity reassignment. |
| `src/components/PreviewPane.tsx` | Identity-first click delegation with message-edit fallback. |
| `src/lib/generator.ts` | Resolve identities by stable scene ID with legacy fallback. |

## 8. Test plan

### Unit tests

Add `tests/identity.unit.spec.ts` covering:

- handle normalization with and without `@`;
- atomic application of name, avatar, handle, and verified;
- scene IDs, not names, distinguish characters;
- library copy does not mutate the global source;
- editing a scene copy does not alter another project;
- v1 settings/presets/messages migrate to stable references;
- migration is idempotent;
- archived identities continue to resolve referenced messages;
- malicious or oversized avatar values still pass through existing URL validation;
- quick-template local avatar URLs map to real files.

Extend:

- `tests/project-file.unit.spec.ts` for v1 import and v2 round-trip;
- `tests/character-storage.unit.spec.ts` for full-profile edits;
- `tests/work-skin.unit.spec.ts` and `tests/skin-off.spec.ts` for resolved identity output.

### Browser tests

Add `tests/identity-flows.spec.ts` with desktop and mobile coverage:

1. Blank iMessage: plus → Add person → name/avatar → contact header and preview update.
2. iMessage group: add two participants, switch sender, rename one, and verify old messages update by ID.
3. WhatsApp group: participant avatar remains attached after rename.
4. Blank Twitter: create account with handle/avatar/verified, post as it, edit it, and verify the existing post updates.
5. Twitter quick templates: each avatar loads; editing the main account updates every existing main-account post without losing the handle.
6. Same-name accounts remain separate in the selector and output.
7. Timeline sender and preview avatar open the same focused editor.
8. Clicking preview message text still opens the message editor.
9. Google blank and every Google quick template contain no identity controls.
10. Keyboard: tab to identity actions, open, save/cancel, Escape, and focus return.
11. 360×640: composer, identity chip, message options, and send button remain visible and clickable.
12. Attachment-only chat messages still work after the plus-button change.

Run browser tests against a local build, not the configured production default:

```powershell
npm run build
npm run start -- -p 3000
$env:UX_BASE_URL='http://localhost:3000'
npx playwright test --workers=1
```

Several existing UX specs are instrumentation rather than assertions. Read their measurement output and screenshots; a green process exit alone does not prove the layout is usable.

### Manual visual and usability QA

Required before release:

- iPhone-width and desktop checks for all four platforms;
- light/dark checks where supported;
- quick templates and blank projects;
- long names, empty handles, broken avatar URL, uploaded avatar, no avatar, and duplicate names;
- observe at least five AO3/fandom users attempt: add a person, change an avatar, post as a second account, edit a template account, and add a Google result without coaching.

The in-app browser was unavailable while this plan was prepared, so this visual QA is explicitly outstanding.

## 9. Acceptance criteria

- [x] A new non-Google character can be created with name and avatar in two actions from the composer: open, then save after filling the form.
- [x] Twitter creation and editing always carry display name, handle, avatar, and verified state together.
- [x] Existing posts follow edits to their stable scene identity.
- [x] Quick-template main-account posts follow edits to the main account.
- [x] Every quick-template local avatar loads successfully in preview and export.
- [x] Selecting an avatar preset asks for a real character name before saving.
- [x] The global library is never silently merged into a scene or changed by a scene edit.
- [x] Duplicate names do not merge identities.
- [x] Clicking an identity in the header, timeline, or preview opens the correct editor.
- [x] Clicking message content still edits the message.
- [x] The composer provides distinct, labelled actions for people and message options.
- [x] Attachment-only messages remain supported.
- [x] Google shows no character/account/avatar entry point in blank flows.
- [x] Old local projects and v1 backups render without lost names, handles, or avatars.
- [x] Preview, PNG, work-skin HTML, skin-off text, and transcript resolve the same identity.
- [x] Full local unit and browser suites pass. Responsive screenshot review by a human is still outstanding (see §11).

## 10. Recommended delivery order

Ship this in two releasable slices rather than one large UI rewrite:

1. **Integrity release:** Phases 0–1 and the template portion of Phase 4. Fix complete-profile updates, stable IDs, cloning, migration, and quick templates first. This directly addresses disappearing handles and broken template editing.
2. **Interaction release:** Phases 2–5. Merge the panels, add contextual click targets, repurpose the composer control, and remove Google identity affordances.

Do not ship the new click targets before the integrity release. Otherwise users will reach the inconsistent update paths more easily without the underlying identity bug being fixed.

## 11. Implementation progress and developer handoff

### Stopping point

Both slices are code complete. Stable scene identities drive editing and output, the unified People/Accounts sheet and every entry point are wired, the automated suites are green end to end, and the character documentation matches the shipped workflow. What is left cannot be finished by writing code: the observational usability study and the visual/dark-mode sweep in §8, plus one product decision (blank-Twitter primary account). No schema or UI redesign is needed.

### Completed implementation

- Added `SceneCharacter`, `SceneCast`, stable `Message.characterId`, and participant bindings in `src/lib/schema.ts`.
- Added `src/lib/identity.ts` with normalization, resolution, complete-profile add/update/copy operations, referenced-identity archive/reassign behavior, and idempotent legacy migration.
- Migrated autosaves on load and upgraded project backups to schema v2 while retaining v1 imports.
- Added cloned template instantiation. Twitter quick-template posts now follow the stable primary account instead of carrying detached custom identity fields.
- Routed preview HTML, AO3 output, work-skin/skin-off projection, and transcript identity reads through the shared resolver. PNG continues to render from the same preview HTML.
- Rebuilt `CastPanel` as one controlled People/Accounts sheet with overview, create, edit, Library, and Avatar presets states. Library entries are explicitly copied into a scene and scene edits do not mutate the saved source.
- Added full-profile library editing and removed the partial `(name, avatarUrl)` apply path.
- Added dialog focus restoration, initial focus, Escape behavior, a basic Tab trap, and unsaved-change confirmation.
- Wired header, composer, timeline sender, and preview identity entry points. Preview identity clicks take precedence only on names, handles, and avatars; message bodies retain click-to-edit.
- Split composer identity creation from Message options. Twitter always exposes a stable Posting as selector; chat keeps speaker switching. Google instead exposes Add result details and renders no identity controls.
- Added responsive flex sizing so the mobile composer remains clickable above the measured fixed export bar when the preview is expanded.

### Completed in the final pass (13 August 2026)

- Expanded `tests/identity-flows.spec.ts` from 4 scenarios to 20, run on both desktop and mobile: iMessage group members staying distinct through a rename, a WhatsApp participant keeping its avatar through a rename, same-name Twitter accounts staying separate, timeline sender and preview avatar opening the same editor, Escape closing the sheet and returning focus to its opener, all three Google quick templates having no identity controls, every avatar-bearing quick template reaching `naturalWidth > 0`, and PNG export for one chat and one Twitter template.
- Reconciled the pre-existing browser suite with the new vocabulary: `Add details` → `Message options`, the header's `Edit display name` → `Edit identity for …`, and the participant `+ Add` flow → the complete-profile Add person form.
- Fixed three accessibility/consistency gaps the wider suite exposed: the group member selector had no accessible name (now `Speaking as`); the group-mode toggle had become a bare checkbox instead of the app-wide `ToggleRow` (`role="switch"`) primitive; and the initials badge in the People sheet stuttered each row's name into its accessible name (now `aria-hidden`).
- Restored the platform-specific group-name placeholders (`Family Chat` / `Work Team`).
- Added the remaining unit cases from §8: two projects seeded from one library entry staying independent after an edit, hostile and oversized avatar values still going through the shared URL validation, and a saved library character round-tripping its whole profile rather than name and avatar alone.
- Rewrote `docs/CHARACTER-BANK-GUIDE.md`: the section documenting the removed `onSetAsContact(name, avatarUrl)` API is replaced by the scene-identity model, the sheet's five states, copy-not-link library semantics, and archive/reassign. Its preset roster and category union are now regenerated from `characterBank.ts` rather than describing a bank that no longer exists.

### Verification

Run against a local production build at `http://localhost:3000`, not the configured production default:

- `npm run typecheck`: passed.
- `npm run build`: passed.
- `npm run test:unit`: 262 passed.
- `npx playwright test --project=desktop`: 161 passed, 3 skipped, 0 failed.
- `npx playwright test --project=mobile`: 163 passed, 1 skipped, 0 failed.
- `npm run lint` is still not a usable gate: the repository uses ESLint 9 without an `eslint.config.*` file.

Two notes for whoever runs these next:

- The focused browser tests set `ao3skingen_analytics_consent=denied`; without that exact key, the consent banner changes the available mobile viewport and can obscure the result being tested.
- `next start` serves the build that existed when it started. After any source change, rebuild **and restart** the server, or the suite silently tests stale code.

### Decisions and behavior to preserve

- Scene identities are copies, not live references to the global library. `sourceLibraryId` records provenance only.
- Duplicate display names are valid. Never restore name-based merging or use a name as an identity key.
- Legacy settings and per-message identity fields remain as fallback for this release; do not remove them until migration has shipped and old files have been exercised in production.
- A referenced identity is archived or explicitly reassigned, never silently deleted. Archived identities disappear from new-message selectors but remain resolvable and editable from old messages.
- In a one-to-one chat, Add person updates/replaces the contact role; in a group it adds a participant. Twitter Add account creates a secondary account because migration always provides a primary account, even for an otherwise blank project.
- The group conversation title/photo is conversation metadata, not a participant identity, so clicking a group header opens the overview.
- Chat self avatars can be stored in the scene identity but are not currently rendered by the platform templates.
- The DOM can contain both visible and responsive-hidden preview instances. Scope preview assertions through the `preview()` helper in `tests/identity-flows.spec.ts`, which selects `#workskin:visible`; an unscoped `.first()` picks the hidden instance and an unscoped `.last()` picks the wrong one on mobile.
- Blank projects ship with seed messages, so anchor preview assertions to a message's own text via `[data-message-id]` rather than to list position.
- The composer auto-alternates the chat sender after each send, so a test posting twice as "them" must re-select the direction each time.
- Toggles use the shared `ToggleRow` (`role="switch"`) primitive from `SettingsRows.tsx`. Form fields (Verified, Also save to my library) stay plain checkboxes.

### Remaining work

Everything that can be verified by code is done. What is left needs a human:

1. **Observational usability study (§8).** Watch at least five AO3/fandom users attempt, without coaching: add a person, change an avatar, post as a second account, edit a template account, and add a Google result.
2. **Visual sweep.** Desktop and iPhone widths across all four platforms, light/dark where supported, long names, empty handles, broken avatar URL, uploaded avatar, and no avatar. The automated suite proves these resolve correctly; it does not prove they look right.
3. **The sheet at small heights.** Its state model and focus behavior are covered by tests, but the dense archive/reassign and library screens still want a human eye.
4. **One product decision.** Should a blank Twitter project present primary-account creation instead of synthesizing a default `User`? Migration always provides a primary account, so this is polish, not a correctness requirement, and it is the only open question in the plan.

Deliberately deferred to a later compatibility release: removing the legacy settings and per-message identity fields that migration still reads as a fallback. Do not remove them until old files have been exercised in production.

### Resume commands

```powershell
npm run typecheck
npm run test:unit
npm run build
npm run start -- -p 3000   # restart this after every rebuild
$env:UX_BASE_URL='http://localhost:3000'
npx playwright test --workers=1
```

Before editing, run `git status --short`. This workspace already contains unrelated user files and untracked artifacts; preserve them and limit changes to this feature's files.
