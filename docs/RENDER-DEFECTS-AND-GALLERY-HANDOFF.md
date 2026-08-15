# Render defects and the examples-gallery handoff

**Written:** August 15, 2026
**Baseline:** `main` at `4c0c4e0` (deployed and verified live)
**Audience:** the next developer
**Companion:** `ao3skingen-growth-benefit-implementation-doc.md` §11.6 and Learnings 11–21

Six issues were reported against the live app after the August 15 deploy. This
document root-causes all six, separates the ones that are regressions from the
ones that are not, and specifies each fix precisely enough to implement without
re-deriving the analysis. It ends with the capture playbook, which is what makes
this class of defect findable at all — and which the examples-gallery work will
need on day one.

---

## 0. Summary — read this table first

| # | Symptom | Root cause | Introduced by | Status |
| --- | --- | --- | --- | --- |
| 1 | Hero card clipped at the bottom of the SwipePages landing | `max-height` crop cut a bubble in half | **This session** (`731ec4d`) | **Fixed**, needs re-paste |
| 2 | Twitter logo missing on some examples and every new project | Expanded tweet template omits the logo `<img>` | `06519ef` (Twitter overhaul, 13 Aug) | Open — §2 |
| 3 | iMessage header background image gone, setting empty | Deliberate: defaults emptied for permanence | `c733066` (14 Aug), **by design** | **Not a bug** — §3 |
| 4 | WhatsApp PNG has text cut off at the bottom | Two separate export clipping defects | Pre-existing, never fixed for WhatsApp | Open — §4 |
| 5 | Landing hero renders as alt text, no image | `hero-scene-video.png` was never deployed — 404 | **This session** (`e5777e9`, undeployed) | Open — §8, one push |
| 6 | WhatsApp group messages show no participant avatars | Avatar sizing lives entirely in inline `style`, which AO3 strips; sender row is gated on `participantId` | Pre-existing | Open — §9 |

**The renderers were not touched this session.** `git diff c733066..4c0c4e0 -- src/lib/generator.ts src/lib/twitter.ts src/lib/ios.ts src/lib/whatsapp.ts src/lib/workSkin.ts` is empty. Only `ExportPanel.tsx` changed near the raster path, by +28 lines, and what it added is described in §4.3. Establish this before blaming the deploy — it was the first thing checked here, and it redirected the investigation away from three wrong suspects.

---

## 1. Hero card clipped on the landing page — fixed

**Symptom.** The hero image on `ao3skingen.wordfokus.com` ends mid-bubble, through the "Replying to Mara" card. It reads as a broken image rather than a crop.

**Cause.** `docs/landing-swipepages-2026-08.html` styles the hero as:

```css
.hero-image img { max-height: 620px; object-fit: cover; object-position: top; }
```

The source is `hero-scene-crop.png`, 750×1400, which at the hero's 600px column renders ~1120px tall. The cap removes the bottom 500px with a hard edge, and the edge happened to land inside a bubble.

**Fix, applied.** Keep the cap — the shot is phone-shaped and would otherwise own the whole fold — and add a bottom fade so the cut is legibly deliberate:

```css
-webkit-mask-image: linear-gradient(to bottom, #000 78%, transparent 100%);
mask-image: linear-gradient(to bottom, #000 78%, transparent 100%);
```

A fade also implies the conversation continues, which is true and is the impression the hero wants.

**Action required:** this file is pasted into SwipePages by hand. The fix is in the repository; **it is not live until someone re-pastes the page.** Nothing else on the landing page changed.

**Rejected alternatives**, so they are not re-litigated:

- *Re-crop the source shorter.* Ties the design to a pixel height that changes whenever the example content changes.
- *Let it render full height.* 1120px of hero pushes the tool cards below the fold on every laptop.

---

## 2. Twitter logo missing — open

**Symptom.** The X logo shows on Character Thread, Four-Image Grid, Video Poster and Long Thread, and is missing on Verified Account, Media Tweet and Quote Post — **and on every Twitter project created from scratch.**

**Root cause.** There are two tweet templates in [`src/lib/generator.ts`](src/lib/generator.ts), and only one carries the logo:

- **line 1194**, the compact/timeline template, ends its name line with
  `<img src="${xLogo}" alt="" class="twitter-logo" width="20" height="20" />`
- **line 1184**, the `expandedView` template, has **no logo element at all**

Which template a post gets is decided by `resolveTwitterLayout` in [`src/lib/twitter.ts:195`](src/lib/twitter.ts#L195):

```ts
if (requested !== 'auto') return requested;
return getTwitterSceneMode(project) === 'single' && index === 0 ? 'expanded' : 'compact';
```

So the split the owner observed is exactly the rule:

| Example | Layout | Logo |
| --- | --- | --- |
| Character Thread, Long Thread | thread → compact | ✅ |
| Four-Image Grid, Video Poster | `twitterSceneMode: 'timeline'` → compact | ✅ |
| Verified Account, Media Tweet | scene mode `single`, index 0 → **expanded** | ❌ |
| Quote Post | explicit `twitterLayout: 'expanded'` | ❌ |
| **A new blank project** | defaults to `single`, first post → **expanded** | ❌ |

The last row is the important one. **The default path for a first-time visitor building a tweet is the one missing the logo**, which is why this reads as "the logo is just gone".

**This is not a deploy regression.** `generator.ts` is byte-identical to `c733066`. It shipped broken in the 13 August Twitter overhaul and was not noticed because the four examples a developer reaches for first are all compact.

### Proposed fix

Add the same logo element to the expanded template. It is a one-line change at
`generator.ts:1184`, inserting into `.expanded-name` after `${verified}`:

```
<img src="${xLogo}" alt="" class="twitter-logo" width="20" height="20" />
```

`xLogo` is already in scope at line 1088 and already resolves the dark-mode variant, so nothing else is needed.

### Before implementing, settle one product question

On real X, the detail (expanded) view **does** show the logo top-right, but it sits in the top-right *corner of the card*, not inline after the display name. The compact template puts it at the end of the name line because that line is a single row. `.expanded-name` is its own block above the handle, so pasting the logo there will place it immediately after the name rather than at the right edge.

Two options, and this is a visual decision rather than a technical one:

1. **Inline after the name** — one line, matches the compact template's markup, but sits in the wrong place relative to real X.
2. **Absolutely positioned in the card corner** — correct to the real product, needs a `position:relative` on `.tweet.expanded` and a rule for `.tweet.expanded .twitter-logo`. **AO3 allows `position`**, so this is safe for the archive, but it must be added to the stylesheet in `generator.ts`, not as an inline `style` — see Learning 11, AO3 strips inline styles outright.

Recommend option 2, and verify against a real X detail page before committing to placement.

### Verification required

- Unit: extend `tests/twitter-model.unit.spec.ts` (or `work-skin.unit.spec.ts`) to assert **both** templates emit `class="twitter-logo"`. The absence of this assertion is why the defect shipped; add it before the fix so it fails first.
- Raster: `node scripts/capture-export-png.mjs http://127.0.0.1:PORT out.png "Verified Account — X"` and **look at the PNG**. Learning 15.
- Check both light and dark, since `xLogo` branches on `isDarkMode`.

---

## 3. iMessage header background image — working as designed, not a bug

**Symptom.** iMessage scenes have no header background image, and the setting shows empty.

**This is intentional and should not be reverted.** It is Learning 18 in the implementation doc, introduced in `c733066`:

> A default that points at a third-party host is a permanence bug in every work already published. The iOS header and footer defaults fetched remote chrome strips, so each published work made permanent requests to a host that AO3 keeps no copy of; that host going away would take the header out of every chapter already posted. They now default to empty, and remain as advanced overrides.

What actually changed:

- `defaultProject()` in `schema.ts` sets `iosHeaderImageUrl: ''` and `iosFooterImageUrl: ''`, with the reasoning in a comment above them.
- Every example in `examples.ts` sets `iosHeaderImageUrl: ''`.
- **The header is still drawn** — the avatar circle, contact name, participant list, back chevron and info icon are all generated in CSS. Only the remote *background strip* is gone. Confirm by looking at any iMessage export: the header is there.

**The setting is still present**, in [`SettingsSheet.tsx:344`](src/components/SettingsSheet.tsx#L344), gated on `settings.iosFrameMode !== 'bubbles'`. If the control is not visible, the project's frame mode is `bubbles`, which has no header to put an image behind. It shows empty because the default is now empty, not because it was removed.

**If the owner wants the image back**, the supported route is to paste a URL into that field per project. Do **not** restore a remote URL as a default — that re-introduces the permanence bug across every work published afterwards.

### 3.1 Is the grey correct? Yes.

Raised during review: *"isn't the iMessage header a kinda blue header? this is just grey."*

It is grey, and that is right. [`generator.ts:1763`](src/lib/generator.ts#L1763) falls back to a flat `colour.chromeBg` when no header image is set. Modern iOS Messages has a light grey, translucent navigation bar; the blue in iMessage is two other things, and the app already draws both — `chromeColor: '#007aff'` on the back chevron and info icon, and the outgoing bubble fill. Compare WhatsApp, which correctly uses `headerBgColor: '#075e54'`.

A remembered blue header bar is either iOS 6-era Messages, or the retired remote strip was a stylised design rather than a faithful one.

### 3.2 "Can we download a copy to AO3?" — No, and this is the important fact

**AO3 does not host images at all.** It stores no copy and only links to wherever a file already lives. The app's own public FAQ says so:

> AO3 never stores a copy of an image, it links to wherever it lives. If a host stops serving a file, it disappears from every chapter you've already posted, with no warning.

So there is no upload target on AO3's side, and no version of "attach the header image to the work" exists. Every image in a work skin is a permanent hotlink to a third-party server, refetched by every reader of every chapter indefinitely. That is the whole basis of Learning 18, and it is why this cannot be solved by moving the file somewhere better on AO3.

### 3.3 Decided: build a header tint, not a header image

**Owner decision, August 15, 2026.** The real complaint is that the header looks flat, and an image is the wrong instrument for it. A finite tint beats a background image on every axis that matters here:

| | Header image | Header tint |
| --- | --- | --- |
| External request per reader | one, forever | none |
| Breaks when a host dies | every chapter already posted | never |
| Survives skin-off and EPUB download | no | yes |
| AO3-safe | only while the host lives | yes |
| Bytes added to the work skin | zero, but a network dependency | a few CSS rules |

**Three parts, in this order:**

1. **Add `iosHeaderTone`** — a finite enum compiled to a class, exactly like the shipped `iosTone` and `whatsappTone`. Learning 11 is binding: a value that must survive AO3 is an enum compiled to a class, **never** a free hex emitted as an inline `style`, because AO3 strips inline styles outright and the app and the archive would then disagree.
2. **Keep the CSS-drawn header as the default.** The default tone must reproduce today's `chromeBg` exactly, so no existing project changes appearance.
3. **Optional, later:** route header *images* through the owner's own `/api/image-upload` rather than a pasted URL, so the file lands on hosting the owner controls and pays for. Still a third-party dependency and still a permanence risk — just a risk the owner owns rather than a stranger's. Do not build this until someone asks for it.

**Do not** restore a remote URL as a default under any of these.

#### Implementation notes

- **Scope it to iOS first.** WhatsApp's header is brand-teal and a tint control there mostly offers ways to make it wrong. The reported gap is iMessage.
- **Each tone must carry its own foreground.** The header renders `contactNameColor` text plus `chromeColor` icons. A dark tint with the light-mode `#000` name is unreadable, so a tone defines background *and* the text/icon colours that go with it, per theme. Do not let a user pick a background independently of its foreground.
- **This is a schema change**, so the standing rule applies: write the pure `v7 -> v8` migration and its fixtures **before** touching the importer, and add an explicit dispatch entry in `PROJECT_FILE_MIGRATIONS` even though the step adds no data to existing projects — `v6 -> v7` does exactly that and says why in `docs/PROJECT-FILE-SCHEMA.md`. A migration must never invent content: an old project gets the default tone, not a guess.
- **Master skin.** `MASTER_SKIN_VERSION` bumps, which re-opens the AO3 read-back gate — the v7 read-back is *already* outstanding and its test is skipping. Prefer closing that gate before adding v8, or the repository will owe two read-backs instead of one.

#### Tests to write

- every tone emits a class and **no** inline `style` on the header;
- the default tone's compiled CSS is byte-identical to today's `chromeBg` output, which is what proves existing projects are untouched;
- the master skin still lints clean and contains no empty rules;
- skin-off output is unchanged by tone — a tint is decoration, and Learning 12's rule stands that colour may reach inside a work while layout may not;
- a `v7` fixture migrates to `v8` with the default tone and no other field altered.

#### Also worth doing while in `SettingsSheet.tsx`

Add one line of help text under the header-image field saying the header draws itself and this is an optional override whose host must stay up. It converts a recurring support question into a self-answering UI, and it will read as the natural sibling of the new tint control.

---

## 4. WhatsApp PNG text cut off — open, two separate defects

Reproduced with `whatsapp-group-chat`. There are **two** unrelated clipping defects in one image, and neither is caused by this session's changes.

### 4a. The group header

"Squad Goals" loses its descenders and the subtitle "Alex, Jordan, Sam" is sliced horizontally by the header's bottom edge.

**Cause.** In `generator.ts`:

```
2128  .android-header-name-wrapper{min-width:0;flex:1;color:#fff;overflow:hidden;}
2129  .android-header-name{font-size:1em;font-weight:600;line-height:1.35;...}
2130  .android-header-subtitle{font-size:0.75em;line-height:1.2;...}
```

html2canvas paints text slightly below the line box Chromium measured, and the wrapper is `overflow:hidden`, so the overflow is cut rather than shown.

**This exact defect was already found and fixed for iMessage.** [`ExportPanel.tsx`](src/components/ExportPanel.tsx) around line 423 does, for `template === 'ios'` only:

```ts
header.style.overflow = 'visible';
header.style.alignItems = 'flex-start';
header.style.paddingBottom = '10px';
clone.querySelectorAll('.ios-header-name, .ios-header-subtitle').forEach(el => {
  (el as HTMLElement).style.cssText += ';line-height:2;overflow:visible';
});
```

with a comment recording that widening the band alone did not work because the glyphs are painted low *within their own line*. **WhatsApp has the same header structure and never received the same treatment.**

**Fix.** Add the mirrored block for `template === 'android'`, targeting `.wa-header` / `.android-header-name-wrapper`, `.android-header-name`, `.android-header-subtitle`. Export-only, in the clone — changing the stylesheet would move the preview and the archive, and neither of those is wrong.

### 4b. The reply quote card

Inside the green "Replying to Alex" card, the quoted line "Anyone free for coffee tomorrow?" is cut through the middle.

**Cause**, `generator.ts:2155`:

```css
#workskin .wa-reply span{font-size:0.9em;max-height:3.8em;overflow:hidden;}
```

A fixed `max-height` with `overflow:hidden` is a deliberate clamp — it stops a long quoted message from filling the bubble, and it is correct in the browser, where the clamp lands between lines. In html2canvas the text sits a few pixels lower, so the band cuts through the last line instead of after it.

**Fix.** In the clone only, relax the clamp for the raster: `max-height:none` (the quoted text in a scene is short) or add ~6px of headroom. `max-height:none` is preferred — it removes the interaction entirely rather than tuning a constant against a renderer quirk.

**Check the iOS equivalent while you are there.** `.ios-reply` should be inspected for the same `max-height` pattern; if it has one, it has the same latent bug and simply has not been hit yet by a quote long enough to reach the clamp.

### 4c. What this session actually changed, and why it is not the cause

`ExportPanel.tsx` gained one block, which offsets rich media in the clone:

```ts
clone.querySelectorAll([
  '.ios-images', '.ios-link-preview', '.ios-audio-card', '.ios-video-card',
  '.wa-images', '.wa-link-preview', '.wa-media',
].join(',')).forEach(el => {
  (el as HTMLElement).style.cssText += ';position:relative;top:8px;margin-bottom:8px';
});
```

It fixes a *different* real defect: a photo grid painting over the last line of the text above it, which sliced "This is what you are driving into." in the iOS example. It is the same remedy already applied to Twitter's media grid, quote and poll.

None of those seven selectors is a header or a reply card, so it cannot produce 4a or 4b. In the reproduction it is visibly working: every media block sits below its text, and each block's own trailing content — "Audio source", "Video source", the link URL — is fully inside its bubble.

**One honest gap in how it shipped, worth not repeating.** The WhatsApp half of that selector list was written by analogy with the iOS half and **only the iOS export was inspected before commit.** The raster suite passed, which proves nothing about visual clipping — that is the entire point of Learning 15. It happened to be correct. It could as easily not have been. When a fix names a second platform, export that platform too.

---

## 5. Suggested order

1. **§8 push, then §1 re-paste** — the hero is a 404, not a layout problem. Pushing `main` serves the asset; the markup in the repository already points at it.
2. **§4a + §4b** — one file, one platform, mirrors a fix that already exists a few lines above. Highest ratio of user-visible improvement to risk.
3. **§2** — needs the placement decision first, then a stylesheet rule and a test.
4. **§9 WhatsApp avatars** — confirmed broken on AO3 whatever the preview turns out to be, and it is the same inline-style-versus-enum lesson as Learning 11. Reproduce the preview branch first.
5. **§3** — no code beyond the optional help text.

Do not batch these into one commit. §2 changes generated markup that reaches AO3; §4 changes only the raster path. They have different blast radii and want different review.

---

## 6. The capture playbook

This is how every defect above was found and confirmed, and it is the part to reuse — including for the examples-gallery work in §7.

### Scripts in this repository

| Script | Purpose |
| --- | --- |
| [`scripts/capture-hero.mjs`](scripts/capture-hero.mjs) | Full scene, hero crop and 1200×630 social card, captured from the **DOM** |
| [`scripts/capture-export-png.mjs`](scripts/capture-export-png.mjs) | Downloads a real **Save PNG** export so a human can look at it |

### The loop

```powershell
npm run build
npm run start -- -p 3500            # a port nothing else is on
node scripts/capture-export-png.mjs http://127.0.0.1:3500 tmp/check.png "Group Chat — WhatsApp"
# then OPEN tmp/check.png AND LOOK AT IT, at zoom
```

The third argument matches the picker button by accessible name. Since the labelling fix in `4c0c4e0` these are friendly names — `"Group Chat — WhatsApp"`, `"Verified Account — X"` — not raw ids.

### The rules that made this work

1. **DOM capture and export capture answer different questions.** `capture-hero.mjs` reads the live DOM, so it shows what the browser paints. `capture-export-png.mjs` downloads the html2canvas raster. Running both and comparing is what proves a defect is export-only, which decides whether the fix belongs in the stylesheet or in the export clone. Every §4 diagnosis came from that comparison.
2. **Decline analytics in the capture.** A promotional or diagnostic screenshot must never imply consent was given. Both scripts click "Don't allow".
3. **The consent banner and the export bar are fixed elements.** They will land in a naive full-page screenshot. `capture-hero.mjs` sidesteps this by lifting `#workskin` and the stylesheet onto a bare page — an earlier attempt that expanded the preview's own scroll container produced a shot with the export bar painted across the middle of the conversation.
4. **`clip` is ignored on an element screenshot.** Crops must come from `page.screenshot({ clip })`.
5. **There are two `#workskin` nodes.** One is the off-screen capture target used by Save PNG; the visible one is the preview. Select on visibility, not order.
6. **A passing raster test is not a passing look.** `ios-raster` and `whatsapp-raster` were green throughout every defect in §4.

---

## 7. The examples gallery — brief for the next piece of work

**Page:** `public/examples-gallery.html`, 86KB, live on two hosts.

### What is already true

- It answers 200 at both `https://ao3skingen.wordfokus.com/examples-gallery` and `https://app.ao3skingen.wordfokus.com/examples-gallery.html`, with identical content.
- `4c0c4e0` added a canonical naming `ao3skingen.wordfokus.com`, and an in-app link under the picker's example row. Before that it was reachable only from three page footers and from nowhere inside the application.

### The question the owner raised, and the answer

*Should it be linked from the main app page or elsewhere?* **It now is** — a quiet text link under the example row on the platform picker, which is the one screen where a visitor is already choosing an example. It is a link and not a card, and it sits on a full-page entry screen with no composer to occlude, for the same reasons as the product shelf in §11.6 Tier 2.

**What is still missing is the return path.** The gallery links *into* the app, and the app now links *out* to the gallery, but the gallery's own cards should deep-link to the template they show. `?template=<id>` already works on both routes — `site-skin.tsx` handles it on mount, and `parseBlankPlatform` handles `?platform=` for the scene builder. A visitor who clicks a gallery card should land on that exact example, not on the picker.

### Why this page matters more than its traffic suggests

It is the only surface that can rank for "ao3 work skin examples" and its neighbours — queries with clear intent from people who do not yet know the tool exists. The landing page sells; this page demonstrates. §13.1 of the implementation doc lists ten guide topics that should each link to one relevant starter, and this gallery is the natural hub for them.

### Do this first, before any redesign

1. **Regenerate its imagery with the playbook in §6.** If the page carries screenshots, they predate the August platform rebuilds and show a product that no longer exists — the same gap §11.6 Tier 1 found on the landing page. `capture-hero.mjs` produces exactly the right assets, and they should be served from the app's own host.
2. **Fix the duplicate-host problem properly.** The canonical is a patch. Decide which host owns the page and 301 the other, the way `ao3skingen.netlify.app` already 301s to the branded app.
3. **Audit its copy against the real feature set.** Assume it describes a screenshot generator, because every other public surface did.
4. **Make every card deep-link** to its example via `?template=`/`?platform=`.
5. **Add its ids to the checks.** `tests/examples-catalog.unit.spec.ts` already asserts that every example in `examples.ts` has a picker label and survives the analytics boundary. If the gallery gains its own list of examples, that list belongs in the same test — the whole reason that test exists is that three separate lists must agree and two of them fail silently.

### Known trap

The gallery is a hand-maintained HTML file listing examples that live in `examples.ts`. That is a fourth place the example catalogue is duplicated. Either generate the gallery from `examples.ts` — there is precedent in `scripts/generate-ao3-css-article-table.mjs` and `scripts/generate-twitter-work-skin-article.mjs` — or extend `examples-catalog.unit.spec.ts` to parse the HTML and assert it matches. Do not add a fourth hand-maintained list and hope.

---

## 8. Landing hero shows alt text instead of an image — open, one push

**Symptom.** The SwipePages preview renders the hero's alt text as a paragraph in an empty box. The image does not load.

**Cause — not a design problem.** The hero points at
`https://app.ao3skingen.wordfokus.com/hero-scene-video.png`, and that URL **returns 404**.

```
hero-scene-video.png -> 404
hero-scene-crop.png  -> 200
```

The image was generated and committed in `e5777e9`. The **deployed** commit is `4c0c4e0`. `hero-scene-crop.png` and `hero-scene-social.png` were in that deploy and answer 200; `hero-scene-video.png` came after it and has never been served. The page markup was re-pasted before the asset existed.

Three iterations were spent on the hero's *framing* while the actual failure was a missing file. Recording that plainly, because the screenshot looked like a layout bug and was not one.

**Fix.** Push `main`. Netlify builds from it, `public/` is served statically, and the URL becomes live with no code change. Then re-paste the page **or** confirm the existing paste already points at `hero-scene-video.png` — the file in the repository does.

**Standing rule this earns:** the landing page is pasted by hand into a system that cannot see the repository, and it references assets served by a separate deploy. **Deploy the asset before pasting the markup**, or the page ships pointing at a 404. Verify with a plain `curl -o /dev/null -w "%{http_code}"` against every image URL the page names, before pasting.

---

## 9. WhatsApp group messages show no participant avatars — open

**Symptom.** In a WhatsApp group chat, each message shows its sender's name in the participant's colour, but **no avatar circle**. iMessage group chats in the same scene render their initials circles correctly, which is what makes the absence obvious.

### What is confirmed

**The whole avatar is sized, shaped and coloured by an inline `style` attribute.** [`generator.ts:882`](src/lib/generator.ts#L882) and [`:887`](src/lib/generator.ts#L887):

```ts
avatarHTML = `<img ... class="group-avatar" width="20" height="20"
  style="width:20px;height:20px;border-radius:50%;object-fit:cover;flex-shrink:0;display:block !important;" />`;
// ...or, with no avatar URL, the initials branch:
avatarHTML = `<div class="group-avatar-initials"
  style="width:20px;height:20px;border-radius:50%;display:flex !important;...
         background-color:${participantColor}20;color:${participantColor};">${initials}</div>`;
```

and the row that holds it is inline-styled too:

```ts
senderNameHTML = `<div class="group-sender-row"
  style="display:flex !important;align-items:center;gap:6px;...">${avatarHTML}...`;
```

**AO3 strips every inline `style`** — Learning 11, and the code comment directly above line 882 already says so about the `<img>`. So on the archive these avatars have *no* size, *no* border radius, *no* flex row and, for the initials branch, *no* background or text colour. **This is a confirmed defect on the published work regardless of what the preview does**, and it is the same class as the iOS group-colour bug that was already fixed by replacing a free hex with `iosTone`.

**The sender row is gated on `participantId`, not on the canonical identity.** Line 866:

```ts
const showSenderName = isGroupMode && !msg.outgoing && participantId;
```

Since `5e8d9bc` made `characterId` canonical, a message can carry a valid identity and still produce no sender row — and therefore no avatar — if its legacy `participantId` binding is missing or stale. `syncChatGroupParticipants` in `identity.ts` exists to keep those in step, so a scene where it has not run is a scene with silently missing avatars.

**Which branch this example takes.** The `whatsapp-group-chat` example carries `participantId` on its messages and an `androidGroupParticipants` roster, and its participants have no `avatarUrl` — so it renders the **initials `<div>`**, not the `<img>`. Any fix must be verified against the initials branch specifically, since that is the default for a scene built from the picker.

**Competing stylesheet rules.** iOS styles both classes at `generator.ts:1839` as `display:inline-block` at `1.333em`. The WhatsApp block at `:2042`–`:2043` re-declares them as `display:block !important` / `display:flex !important` at `2.5em`, while the inline style asserts `20px` and its own `display`. Three sources disagree about the size and the display mode of one element. Whatever the preview symptom turns out to be, this is the mess to clean up.

### What still needs establishing before coding

**Reproduce the preview symptom and identify which of the three it is.** The analysis above proves the AO3 case is broken; it does **not** yet prove why the *preview* shows nothing. Run the §6 loop against `"Group Chat — WhatsApp"`, then in devtools on the live preview:

1. Is `.group-sender-row` present in the DOM at all? If not, the `participantId` gate is the cause and the fix is at line 866.
2. Is it present but zero-height or `display:none`? Then a stylesheet rule is beating the inline one — check `dd.bubble` flow context, since a `display:flex` `<div>` inside an inline bubble is the obvious suspect.
3. Is it present and sized but invisible? Then it is colour: the initials branch builds `background-color:${participantColor}20` — an 8-digit hex — and paints the text `${participantColor}` at full opacity on it. Confirm `participant.color` is not resolving to something near-transparent or identical to the bubble.

Do this first. Do not write a fix against a guess about which of the three it is.

### The fix, once the branch is known

**Move the avatar out of inline styles and into the stylesheet**, which fixes the archive case and almost certainly the preview case at the same time:

1. **Delete the inline `style` from all three elements** — `.group-avatar`, `.group-avatar-initials`, `.group-sender-row` — keeping the `width`/`height` **attributes** on the `<img>`, which are on AO3's allowed-attribute list and are the only sizing that currently survives.
2. **Give WhatsApp one authoritative rule per class** in the android CSS block, and reconcile the 1.333em/2.5em/20px disagreement to a single value. The iOS rules at `:1839` are the working reference — they render correctly today.
3. **Replace the free participant hex with a finite tone**, exactly as iOS did. `whatsappTone` already exists on `GroupParticipant` and is already a finite `WhatsAppParticipantTone` enum compiled to a class. The avatar should use it rather than `participant.color`, which is a free hex that AO3 discards. **This is the same fix that Learning 11 records for iOS group colour** — the value reached the preview and the PNG and was silently dropped on the archive.
4. **Keep `participantId` working, but do not depend on it alone.** Prefer the resolved identity, falling back to the participant binding, so a correctly-identified message cannot lose its sender row.

### Verification

- Unit: assert the WhatsApp group markup contains **no `style=` attribute at all** — the strongest form, and it prevents regression by construction. A narrower assertion on `.group-avatar` alone would have missed `.group-sender-row`.
- Unit: assert an avatar class is emitted for a group message on both branches, with and without `avatarUrl`.
- Raster: export a real PNG and **look at it**, per Learning 15 — and export the iOS group scene too, because these classes are shared and the iOS side currently works.
- Skin-off: confirm the sender name still reads correctly with the skin disabled; the avatar is decoration, the name is not.
- **This one deserves a real AO3 save/read-back**, since the entire point is behaviour the archive controls. It is the same category of bug that only the archive could reveal in `5c47eda`.

### Note on ordering

This change touches generated markup that reaches AO3, so it wants its own commit and its own review — separate from §4, which only touches the raster path.
