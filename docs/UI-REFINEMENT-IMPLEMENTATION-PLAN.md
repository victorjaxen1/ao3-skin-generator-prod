# Workspace UI Refinement — Implementation Plan

**Scope:** the five issues raised against the main authoring UI (`src/pages/index.tsx`
and everything it mounts). Written to be implemented by someone who has not worked
in this codebase before.

**Status: built, 8 Aug 2026.** §3 and Phases A–D are implemented and green. §0.5
lists the nine corrections found by reading the code and the test harness, and the
body below is patched to match — read it first, because **C1 and C2 mean most of the
acceptance criteria as originally written could not fail.**

One thing is outstanding and it is not code: the reaction-chip CSS has **not been
saved on real AO3 and diffed back**. See C4 and `docs/BACKLOG.md` item 21.

Measured after the fact, at 390×844: the export bar is **53px** with the help panel
dismissed and identical on all four platforms, against ~148px before. A newcomer
still lands on 180px, which is the point — `polish.spec.ts` asserts they see the AO3
guidance without clicking, and that is deliberate.

**Ground rule:** every file/line reference was read against `main` at `6247b0b`. If a
line number has drifted, trust the surrounding code quotation, not the number.

**Second ground rule, and the reason this document is as long as it is:** there are
four platforms and eleven variants between them, and *almost every control in this
app means something different depending on which one is active*. Four of the five
issues here look like single changes and are not. §2 is the matrix; read it before
you write anything. Every phase below carries a **Platform carve-outs** section, and
those are not optional polish — they are the difference between the change working
and the change silently breaking WhatsApp group chats.

---

## 0.5 Corrections to the first draft — read before anything else

Nine things the first draft got wrong or left out, found by reading the code and the
test harness rather than the source files alone. **C1 and C2 invalidate most of the
acceptance criteria as written** — fix your mental model of "green" before you start.

### C1 — every Playwright command in this plan tests **production**, not your change

[playwright.config.ts](../playwright.config.ts) sets

```ts
baseURL: process.env.UX_BASE_URL || 'https://ao3skingen.netlify.app',
```

There is no `webServer` block. `npx playwright test tests/occlusion.spec.ts` opens the
**live deployed site**, which does not have your work in it, and reports green. Every
"must stay green" box below is worthless run that way — worse than worthless, because
it reads as confirmation.

The only correct invocation, from [tests/README.md](../tests/README.md):

```bash
npm run build && npm run start          # in one terminal
UX_BASE_URL=http://localhost:3000 npx playwright test --workers=1
```

`--workers=1` is not optional; at the default two the heavier specs time out from
contention and you will spend an afternoon on a phantom failure. Unit specs are the
exception — `npx playwright test --project=unit` needs no browser and no server, so
`work-skin.unit.spec.ts` and `ao3-css.unit.spec.ts` are the fast loop.

**Wherever this document says "run X", it means the `UX_BASE_URL` form.**

### C2 — `occlusion.spec.ts` cannot fail, and most of the other specs can't either

[tests/occlusion.spec.ts](../tests/occlusion.spec.ts) is one `test()` whose body is
`console.log` and nothing else. No `expect`. It passes whatever the bar does to the
composer. Per [tests/README.md](../tests/README.md) only four specs are assertions —
`image-proxy`, `cors-export`, `upload-errors`, `settings-render` — and the rest,
including `polish`, `friction` and `occlusion`, are **instrumentation** that reports
measurements.

So "run `occlusion.spec.ts`, composer clickable at five heights" means: run it and
**read the `[h=…]` lines** for `clickable=NO — blocked`. Green tells you the file
executed.

`polish.spec.ts` is the partial exception — its two DISCLOSURE tests at the end *do*
assert, on `aria-expanded` and on the guidance being visible. Those are real, and
they are the ones §4 tells you not to break.

### C3 — fixing Bug A is what *activates* D4

These are presented below as independent (§3 blocking, §5's B4 optional). They are
not. `#workskin dd.bubble .reaction` is a descendant selector and the iOS branch
emits the span **outside** the bubble, so **that rule has never matched anything on
iOS**. It is dead code today.

The moment §3's Bug A moves the span inside the bubble, the rule applies for the
first time — and it is `bottom:-0.625em;right:0.5em` with a hardcoded
`rgba(44,44,46,0.95)` background. So iOS reactions go from *unstyled floating emoji*
to *a dark chip that lands on the outgoing bubble's tail and is dark in light mode*.

That is still a large net improvement and Bug A should absolutely ship. But decide
about B4 **knowingly**, not as a tidy-up you might skip. See C4.

### C4 — B4 was deferred, then built on request. Both platforms changed, and the AO3 save is still owed

**Superseded 8 Aug 2026.** B4 was initially deferred on §11 grounds. It was then
built at the author's explicit request, after the chip was seen mispositioned in the
running app — so the scope grew beyond what §5 B4 described:

| | Before | After |
|---|---|---|
| **iOS position** | `bottom:-0.625em;right:0.5em` — both directions, landing on the outgoing tail *and* on the "Read" receipt | `top:-0.75em`, with `.out{left:-0.5em}` / `.in{right:-0.5em}`. The tail is at the bottom, so pinning to the opposite **top** corner clears it by construction rather than by tuned offsets |
| **iOS colour** | hardcoded `rgba(44,44,46,0.95)` — a dark chip on a white page in light mode | three palette entries per theme in `iosColours()`, alongside the 22 already there |
| **Android** | §5 said "do not touch". Its *side* was right — WhatsApp attaches the pill lower-left for both directions — but it had **no pill at all**: transparent, borderless, unpadded, so a bare emoji hung loose in the gap between two messages | a real pill: surface background, hairline border, radius, padding, shadow. Two palette entries per theme in `androidColours()` |
| **Both** | the chip is out of flow, so nothing reserved the space it hangs into and it sat on the neighbouring message | a `has-reaction` class on the bubble, and `margin-top` (iOS) / `margin-bottom` (Android) — **and that margin was wrong; see C4a** |

`has-reaction` is a **markup** change, and it is there to avoid `:has()` — the only
other way to select "a bubble that contains a reaction", and not something to bet an
AO3 skin on.

### C4a — the margin above was not clearance, and every PNG showed it

**Found 9 Aug 2026, by an author exporting one image.** The very first PNG taken
after C4 shipped had the pill **printed on top of the message**; a one-word bubble
(`yes`) lost its word entirely.

The mistake is worth stating precisely, because it reads as correct:

> A **margin** on `.has-reaction` moves the *neighbouring row* away. The chip is not
> lying on the neighbouring row — it is lying on **this bubble's own text**, which is
> not in flow with it. Only **padding** reserves space *inside* the bubble, which is
> where the chip actually is.

It survived review because the browser hid it. Measured, the chip's edge landed
**~1px** from the text on Android and **overlapping by 3.5px** on iOS — and a pixel
is not a margin. html2canvas draws text a few px lower than the browser does, so the
raster collided every time. A larger reader font or AO3's paragraph injection would
each have done the same on the archive; this was an AO3 bug that happened to surface
in the PNG first.

**The first fix was also wrong, and it took a photograph of the real app to see it.**
Reserving the space *inside* the bubble does stop the collision, but it is not what
WhatsApp does, and it looks it: a group bubble with no timestamp became a hollow box
with a chip lost in its corner. Two attempts were made by reasoning from the
stylesheet. What settled it was the author sending a screenshot of a real WhatsApp
thread — **get the reference before designing the rule, not after.**

What the real app actually does, and we did not:

1. **The pill sits entirely BELOW the bubble**, in the gap between rows. It does not
   straddle the edge and it is not inside the bubble.
2. **The bubble's own layout is therefore completely unchanged by a reaction** — no
   reserved strip, no extra padding, no taller bubble, and the time and ticks stay
   exactly where they were. The whole "reserve space inside" idea was misconceived.
3. **It sits on the sender's own side** — bottom-right for outgoing, bottom-left for
   incoming. The old code comment asserted WhatsApp "attaches the pill to the bubble's
   lower-left corner regardless of who sent it". It does not, and three outgoing
   messages in the screenshot show it on the right.

Because the pill is wholly outside the bubble, it *cannot* land on the text — the
entire class of bug disappears rather than being tuned around. What it can still land
on is the neighbouring row, and a margin is the right tool for that, since the thing
being pushed away really is the next row.

| | Final |
|---|---|
| Android chip | `bottom:-1.6em`, `.out{right:0.75em}` / `.in{left:0.75em}` |
| Android reserve | `margin-bottom:2em`. No padding, no tick/timestamp lifts — all deleted |
| iOS chip | `top:-0.75em`, `.out{left:-0.5em}` / `.in{right:-0.5em}` — unchanged; iMessage really does sit the tapback on the bubble's corner |
| iOS reserve | `padding-top:0.95em; margin-top:1.2em` |

iOS keeps a small inside reserve because its tapback genuinely overlaps the bubble.
`margin-top` was `0.5em` and the chip overlapped the *previous* message by 1.3px —
found by measurement, not by eye, after the WhatsApp rewrite.

**A note on `ExportPanel`.** It blanket-forces `padding:7px 10px` **inline** on every
Android bubble for html2canvas. An inline style beats any stylesheet rule, so while
the reserve was padding it silently deleted it in the export only — which is why one
round of fixes appeared to work on iOS and not on Android. Nothing needs re-asserting
now, but a comment records the trap: **any bubble padding you add in
`buildAndroidCSS` will not survive that line.**

`tests/reaction-layout.spec.ts` pins both failure modes across four platform/group
combinations, measuring real boxes:

- the chip against every text rect **in its own bubble** — requires ≥2px of clear air,
  not merely "no overlap", since the shipped bug measured about −1px and still printed
  over the words;
- the chip against **every other bubble** — no overlap at all.

It deliberately asserts nothing about *which* CSS property does the reserving, because
the two platforms correctly use different ones. It was verified to fail against the
broken CSS before being kept (all 8 cases, `chip is overlapping "yes" by 1.5px`), and
it is what caught the iOS regression above.

**What is verified, and what is not.** The full unit suite (197) passes, which
includes `lintAo3Css` over every platform in both themes and the master skin;
`namespace`, `master-skin`, `ao3-injection` and `skin-off` all pass; and each of the
six variants was rendered and read by eye. **None of that is the check §11 asks
for.** `.reaction` was one of the eleven rules that vanished from a real saved skin
on 7 Aug 2026 and the cause is still unknown, so this is not closed until somebody
**saves the skin on real AO3, reads the stored CSS back, and diffs it rule by rule** —
paying particular attention to `.reaction`, the two new `margin` rules, and the
`dd.bubble.out .reaction` / `dd.bubble.in .reaction` pair. `docs/BACKLOG.md` item 21
now tracks that save, not the work.

Encouraging but not sufficient: item 18a saved 537 rules and got 537 back with
comments already stripped, which is good evidence the 7 Aug loss was comment-related
and is fixed. It was also the *master* build path, and this rule feeds
`buildIOSCSS`/`buildAndroidCSS` for eleven stylesheet builds inside
`buildMasterWorkSkin` — so a silent breakage here is eleven silent breakages.

### C5 — do **not** put a full `AvatarSelector` on every participant row

§6.6's code does exactly that. `AvatarSelector` renders its preset browser as
`absolute top-full … max-h-96` ([AvatarSelector.tsx:59](../src/components/AvatarSelector.tsx#L59)),
and `BottomSheet`'s content area is `overflow-y-auto`
([BottomSheet.tsx:74](../src/components/BottomSheet.tsx#L74)). An absolutely
positioned child of a scroll container is **clipped by it**. One of these near the
top of Settings degrades acceptably; six of them stacked down a participant list, each
opening a 384px panel inside a `max-h-[70vh]` sheet, does not.

Use the plainer control on the row and keep exactly one presets entry point for the
section — which is what the "Browse avatar presets →" link at the end of §6.6 already
is:

```tsx
<ImageUrlInput
  value={p.avatarUrl || ''}
  onChange={(url) => updateParticipant(field, p.id, { avatarUrl: url })}
  previewShape="circle"
  ariaLabel={`Photo for ${p.name}`}
  placeholder="Photo (optional) — a monogram is used without one"
/>
```

`AvatarSelector` is still right for the **one** contact/group/Twitter card per panel,
where there is a single instance near the top. This is a rule about instance count in
a scroll container, not about the component.

### C6 — the timeline stamps `'You'` too, and §6.7 misses it

§6.7 fixes `ComposeBar`. But
[MessageTimeline.tsx:241](../src/components/MessageTimeline.tsx#L241) also hardcodes
it, on the direction `<select>`:

```ts
sender: e.target.value === 'outgoing' ? 'You' : msg.sender,
```

and `getSenderLabel` ([MessageTimeline.tsx:132](../src/components/MessageTimeline.tsx#L132))
renders `msg.outgoing ? 'You' : msg.sender` in the editor list.

Once §6.3 resolves the outgoing speaker at render time the stamped value stops
mattering for output — but the **editor still says "You" on every row** after the
author has named themselves, which is the exact complaint Issue 2 opens with. Both
need the same `youLabel`. Phase C, `MessageTimeline`.

### C7 — "Set as contact" is broken in group mode, same root cause as D1

`handleSetAsContact` ([index.tsx:299-317](../src/pages/index.tsx#L299-L317)) maps iOS
to `iosContactName` + `iosAvatarUrl` unconditionally. Per §2.2, in group mode
`iosContactName` is rendered nowhere and `iosAvatarUrl` is **the group's photo**. So
picking a character in the Character Library while group chat is on writes a name
nothing shows and replaces the group's picture with that character's face.

This is D1 in a second location and the first draft missed it. Fix it in Phase C
alongside D1: in group mode, "Set as contact" should add a **participant** rather than
overwrite the group's identity.

### C8 — no test selects on anything Phase A moves

Confirmed by grepping `tests/` for `Upgrade`, `Quality`, `resolution`, `1×`/`2×`/`4×`,
`Reaction`, and `Characters`: **zero hits**. The quality switch, the Upgrade link and
the reaction input have no test coverage at all, so Phase A and Phase B may reshape
them freely. The names in §9 are the constraint; these are not among them.

### C9 — `settings-render.spec.ts` is the one suite that genuinely guards Phase D

Its header comment is the reason: every control it covers "used to be a lie — the
setting existed, the toggle rendered, and the generator never read it". It is an
**assertion** spec (C2), it is what catches a setting going unreachable, and Phase D
is precisely a mass relocation of settings. Run it after every Phase C/D commit, with
C1's invocation.

---

## 0. Read this first — how the workspace is wired

You only need five files in your head.

| File | What it owns |
|---|---|
| [src/pages/index.tsx](../src/pages/index.tsx) | All workspace state. `project`, undo history, persistence, every handler. Every panel is a controlled child of this. |
| [src/lib/schema.ts](../src/lib/schema.ts) | `SkinProject` = `{ template, settings, messages }`. `SkinSettings` is one flat bag with per-platform prefixes (`iosX`, `androidX`, `twitterX`, `googleX`) plus a few shared `chatX` fields. |
| [src/lib/generator.ts](../src/lib/generator.ts) | `buildHTML(project)` + `buildCSS(project)`. The single source of the preview, the PNG, **and** the AO3 work skin. Changing markup here changes all three at once. |
| [src/components/SettingsSheet.tsx](../src/components/SettingsSheet.tsx) | The gear panel. Built from the row primitives in [SettingsRows.tsx](../src/components/SettingsRows.tsx). |
| [src/components/ExportPanel.tsx](../src/components/ExportPanel.tsx) | The fixed bottom bar + the export modals. |

Four conventions you must not break:

1. **`--export-bar-h`.** `ExportPanel` measures its own bar with a `ResizeObserver`
   and publishes the height onto `document.documentElement`
   ([ExportPanel.tsx:608-624](../src/components/ExportPanel.tsx#L608-L624)).
   `index.tsx` reserves that much bottom padding
   ([index.tsx:391-394](../src/pages/index.tsx#L391-L394)). Without it the fixed bar
   covers the compose input. `tests/occlusion.spec.ts` exists to catch that.
2. **Accessible names are the test API.** Playwright selects on
   `getByRole('button', { name: … })`. §9 lists every name that is load-bearing.
3. **Identity resolves at render time, not send time.** A deliberate fix for Twitter
   ([generator.ts:443-464](../src/lib/generator.ts#L443-L464)): renaming yourself
   updates tweets you already wrote. Any new identity field follows that precedent.
4. **`msgHTML` is one function with four exits.** Shared setup runs at the top
   (lines 258-441), then Twitter returns at ~594, Google at ~599, iOS at ~663,
   Android at ~706, with a generic fallback at 711 that nothing currently reaches.
   **Anything you add to the shared section runs for all four platforms** whether it
   makes sense there or not. This is where blanket changes go wrong.

---

## 1. The five issues, restated against the actual code

### Issue 1 — the export bar is too tall and over-narrated

`ExportPanel` renders **four stacked rows** inside a `fixed` bar
([ExportPanel.tsx:721-834](../src/components/ExportPanel.tsx#L721-L834)):

```text
py-3  ┌────────────────────────────────────────────────────┐
      │ QUALITY [1×][2×][4×]          Upgrade   How to use │  row A
      │ [    ⬇ Save Image    ] [   </> Copy for AO3     ]  │  row B, py-3
      │ [ ✎ Or use a work skin — real text, not an image ] │  row C
      │ ┌ help panel: two paragraphs ─────────────────────┐│  row D (open by
py-3  └────────────────────────────────────────────────────┘   default for newcomers)
```

**~148px collapsed, ~260px with help open**, on every viewport, for controls used
once at the end of a session. Row C's label is a sentence; row A spends a whole row
on a resolution switch most authors never touch.

### Issue 2 — no clear way to change who is in the conversation

| What | Where it lives today |
|---|---|
| Their name | The **header title**, click-to-edit ([WorkspaceHeader.tsx:112-131](../src/components/WorkspaceHeader.tsx#L112-L131)) |
| Their photo | Settings → scroll to "Contact" ([SettingsSheet.tsx:138-149](../src/components/SettingsSheet.tsx#L138-L149)) |
| Your @handle, verified, your photo (Twitter) | Settings → "Profile" ([SettingsSheet.tsx:311-333](../src/components/SettingsSheet.tsx#L311-L333)) |
| Group participants | Settings → "Group chat" — **name + colour only** |
| Saved characters | A fourth panel (`CharacterLibrary`, right drawer) |
| **Your own name** | **Nowhere.** Hardcoded `'You'` at [ComposeBar.tsx:107](../src/components/ComposeBar.tsx#L107) |

The settings panel apologises for the split three times — *"Their name is the title
at the top of the screen — tap it to change"*. That sentence is a bug report.

Your own name is not cosmetic: it is the hidden speaker label
`<dt class="visually-hidden">You: </dt>`
([generator.ts:362-364](../src/lib/generator.ts#L362-L364)) — exactly what a reader
sees with **Hide Creator's Style** on and in a downloaded EPUB. An author writing in
first person as "Rhys" ships "You:" to those readers with no way to change it.

### Issue 3 — reactions are a bare text box

[ComposeBar.tsx:201-207](../src/components/ComposeBar.tsx#L201-L207) is a 56px
`<input placeholder="❤️">`; [MessageTimeline.tsx:231-236](../src/components/MessageTimeline.tsx#L231-L236)
repeats it. **Two rendering bugs mean the feature mostly does not work at all** — see
§3. Fix those first or you will be testing a picker that produces nothing visible.

### Issue 4 — group participants have no avatar in the UI

The **generator already fully supports it**
([generator.ts:311-332](../src/lib/generator.ts#L311-L332)): a participant with an
`avatarUrl` renders a 20px round avatar beside a colour-coded name; without one, a
coloured monogram. `GroupParticipant.avatarUrl` is in the schema
([schema.ts:41-47](../src/lib/schema.ts#L41-L47)) and
`docs/IOS-GROUP-CHAT-FEATURE.md` documents it as shipped.

The current editor ([SettingsSheet.tsx:175-196](../src/components/SettingsSheet.tsx#L175-L196),
and the duplicated Android block at 279-300) exposes colour, name, delete. The
avatar field was dropped in a UI rewrite. **This is a regression with a live,
tested rendering path** (`tests/ao3-injection.spec.ts:390`, `tests/skin-off.spec.ts:46`)
— restoring it is one `<AvatarSelector>` per row and zero generator work.

### Issue 5 — the settings panel is doing two unrelated jobs

Look-and-feel (dark mode, message type, read receipts, checkmarks) sits alongside
who-is-in-the-conversation (contact photo, group mode, group name, the participant
editor, Twitter handle/verified/avatar). Once Issue 2 gives identity a home, half
the panel leaves and the rest fits on one screen.

---

## 2. The platform matrix — read before writing anything

### 2.1 What exists per platform

| | iOS / iMessage | Android / WhatsApp | Twitter / X | Google |
|---|---|---|---|---|
| **Variants** | iMessage vs SMS (`iosMode`), light/dark, 1-on-1 vs group, status bar, input bar, header/footer images | light/dark, 1-on-1 vs group, checkmarks, online status | light/dark, thread mode, quote tweet, metrics on/off, per-tweet identity | `google` / `google-old` / `naver`, suggestions, did-you-mean, stats |
| **"You" has a name** | Yes — hidden label only | Yes — hidden label only | Yes — `twitterDisplayName`, visible | No such concept |
| **"You" has an avatar** | **No** — iMessage never draws your own | **No** — same | **Yes** — `twitterAvatarUrl` | No |
| **"They" have a name** | `iosContactName` | `androidContactName` | n/a — other accounts are a roster | n/a |
| **"They" have an avatar** | `iosAvatarUrl` — **header only**, not on bubbles | `androidAvatarUrl` — **header only** | per-account avatars on every tweet | n/a |
| **Group mode** | `iosGroupMode` | `androidGroupMode` | n/a | n/a |
| **Per-message reaction** | Yes — chip, bottom-right | Yes — bare emoji, bottom-left | **No** (gated out) | **No** |
| **Work skin** | Yes | Yes | Yes | Yes |

`supportsWorkSkin` returns true for all four ([workSkin.ts:43-47](../src/lib/workSkin.ts#L43-L47)),
so the Work skin button is always present and the export bar's button count never
changes. That is one thing you do *not* have to make conditional.

### 2.2 What changes when group mode turns on

This is the single biggest trap in the codebase and it is where my first draft of
this plan was wrong.

From [generator.ts:889-899](../src/lib/generator.ts#L889-L899) (iOS) and
[generator.ts:906-928](../src/lib/generator.ts#L906-L928) (Android):

```ts
const contactName = s.iosGroupMode
  ? (s.iosGroupName || 'Group Chat')
  : (s.iosContactName || s.chatContactName || '');
const avatarUrl = s.iosAvatarUrl || '';
```

So with group mode **on**:

- The header renders **`iosGroupName` / `androidGroupName`**. `iosContactName` is
  no longer shown anywhere. It still names unassigned incoming messages via
  ComposeBar, so it is not dead — but it is invisible.
- **`iosAvatarUrl` / `androidAvatarUrl` becomes the *group's* photo**, not a
  person's. The same field, a different meaning, with no label change anywhere.
- Android's header subtitle switches from `androidStatusText` to
  `"N participants"` ([generator.ts:917-919](../src/lib/generator.ts#L917-L919)) —
  so the **"Online status" setting and its text field become inert**.
- iOS's group header shows **no subtitle at all**. Android shows the count. This
  asymmetry is real and pre-existing.

### 2.3 Platform-specific defects found while writing this

Six, all confirmed by reading the source. Each is small; each would be made worse
by a blanket change.

| # | Platform | Defect |
|---|---|---|
| **D1** | iOS + Android | **The header title edits a dead field in group mode.** `WorkspaceHeader` always writes `contactNameKey` = `iosContactName`/`androidContactName` ([index.tsx:342-346](../src/pages/index.tsx#L342-L346)), but the header renders the *group* name when group mode is on. Turn on group chat and the title control stops matching the preview. |
| **D2** | Android | **Contact-name precedence is inverted relative to everything else.** The generator reads `s.chatContactName \|\| s.androidContactName` ([generator.ts:908](../src/lib/generator.ts#L908)); iOS reads `iosContactName \|\| chatContactName`, and ComposeBar reads `androidContactName \|\| chatContactName` ([ComposeBar.tsx:110](../src/components/ComposeBar.tsx#L110)). On a legacy project carrying both, the WhatsApp header and its own messages disagree about who you are talking to. |
| **D3** | Android | **"Online status" is inert in group mode** (§2.2) but still renders as a live toggle plus a text field. |
| **D4** | iOS | **The reaction chip is positioned for one side only.** `#workskin dd.bubble .reaction{bottom:-0.625em;right:0.5em}` ([generator.ts:1264](../src/lib/generator.ts#L1264)) puts it bottom-right for *both* directions, and an outgoing bubble's tail is also bottom-right (`right:-0.4em`, [generator.ts:1255](../src/lib/generator.ts#L1255)). The chip lands on the tail. Its colour is also hardcoded `rgba(44,44,46,0.95)` — a dark chip, in light mode too. **Android does not have this problem**: its reaction is bottom-left and transparent, which is right for both sides. |
| **D5** | Twitter | **"Thread mode" has no way to make a thread.** `parentId`, `replyToHandles` and `expandedView` are read by the generator ([generator.ts:466, 559-573, 578](../src/lib/generator.ts#L466)) but **no component writes them** — verified by grepping `src/components` and `src/pages`. The toggle draws connecting lines for projects loaded from a template and does nothing for anything you author. |
| **D6** | Google | **Google would lose the character library.** `CharacterLibrary` is reachable only from the header's Characters button. Phase C replaces that button with a People button — and Google has no cast, so hiding it strands the feature. `handleSetAsContact` maps Google to `googleQuery` ([index.tsx:313-315](../src/pages/index.tsx#L313-L315)), which is a legitimate use (searching for a character's name). |

D1, D2 and D3 are fixed inside Phase C/D at essentially no extra cost, because
those phases are already rewriting the code that contains them. D4 is Phase B. D5
and D6 are handled by scoping decisions, not code.

---

## 3. Two generator bugs to fix before touching the reaction UI

Both are one-line moves. Both are **iOS-only and Android-only respectively** — do
not "unify" them, they are different bugs in different branches.

### Bug A — iMessage reactions are never styled

[generator.ts:651](../src/lib/generator.ts#L651) builds the span;
[generator.ts:663](../src/lib/generator.ts#L663) emits it as a **sibling** of the
bubble:

```ts
const reaction = msg.reaction ? `<span class="reaction">${msg.reaction}</span>` : '';
…
return `…<dl class="msg">${hiddenSpeaker}${bubble}${reaction}${statusIndicator}</dl></div>`;
//                                        ^^^^^^^^^ outside <dd class="bubble">
```

The only rule for it is a **descendant** selector,
`#workskin dd.bubble .reaction` ([generator.ts:1264](../src/lib/generator.ts#L1264)).
It cannot match. The emoji renders as unstyled inline text after the bubble — in
the preview, the PNG and on AO3.

**Fix** — `dd.bubble` is already `position:relative`
([generator.ts:1231](../src/lib/generator.ts#L1231)) and `.image-bubble` is
explicitly `overflow:visible` ([generator.ts:1232](../src/lib/generator.ts#L1232)),
so a chip hanging over the edge works as designed:

```diff
   const bubbleClass = hasImage ? `bubble …` : `bubble …`;
-  const bubble = `<dd class="${bubbleClass}">${bubbleContent}${tailSvg}</dd>`;
+  const reaction = msg.reaction ? `<span class="reaction">${msg.reaction}</span>` : '';
+  // Inside the bubble, not beside it: the only rule that styles this is
+  // `#workskin dd.bubble .reaction`, a descendant selector.
+  const bubble = `<dd class="${bubbleClass}">${bubbleContent}${tailSvg}${reaction}</dd>`;
…
-  const reaction = msg.reaction ? `<span class="reaction">${msg.reaction}</span>` : '';
-  return `…<dl class="msg">${hiddenSpeaker}${bubble}${reaction}${statusIndicator}</dl></div>`;
+  return `…<dl class="msg">${hiddenSpeaker}${bubble}${statusIndicator}</dl></div>`;
```

### Bug B — WhatsApp drops the reaction on any message with an image

The shared builder at [generator.ts:428-431](../src/lib/generator.ts#L428-L431)
appends it correctly, but the Android branch **rebuilds the bubble from scratch**
for image messages ([generator.ts:675-699](../src/lib/generator.ts#L675-L699)) and
never re-adds it. The `bubble` variable that held it is discarded.

```diff
       // Add checkmarks
       bubbleContent += checkmarkHTML;
+      // The text branch gets this from the shared builder above; the image
+      // branch rebuilds the bubble and used to lose it.
+      if (msg.reaction) bubbleContent += `<span class="reaction">${msg.reaction}</span>`;
```

### Verification

Both change `buildHTML` **only for messages carrying a `reaction`**. The default
project has none, so no snapshot moves. Run

```bash
npx playwright test --project=unit                    # work-skin.unit, ao3-css.unit
UX_BASE_URL=http://localhost:3000 npx playwright test tests/skin-off.spec.ts --workers=1
```

— these exercise `buildHTML` most broadly and must stay green. Note the two different
invocations, and see **C1**: the second one against the default baseURL would be
testing the deployed site. Add the structural test in §5's acceptance criteria.

**Before you do this, read C3.** Bug A's fix is the first time
`#workskin dd.bubble .reaction` matches anything on iOS, so it also switches on a
chip that is mispositioned and mis-coloured (D4). That is a knowing trade, not an
oversight.

---

## 4. Phase A — a 52px export bar

**Files:** `src/components/ExportPanel.tsx` only.
**Depends on:** nothing. Do this first.

### Target

One row. Everything that is not a primary action moves into a popover anchored
*above* the bar, so the bar's height is constant.

```text
┌──────────────────────────────────────────────────────────────────┐
│ [2× ▾]  [ ⬇ Save Image ]  [ </> Copy for AO3 ]  [✎ Work skin] [?] │  ~52px
└──────────────────────────────────────────────────────────────────┘
```

- **`[2× ▾]`** — one chip. Opens a popover holding 1× / 2× / 4× **and** the Upgrade
  link. Both cost a whole row today.
- **Save Image / Copy for AO3** — behaviour unchanged, `py-3` → `py-2`,
  `text-sm` → `text-[13px]`, both stay `flex-1`.
- **Work skin** — the sentence becomes two words plus a `title` carrying the
  explanation. Below `sm` the visible text hides; `aria-label="Work skin"` is set
  **unconditionally** so the accessible name never varies with viewport.
- **`[?]`** — the How-to-use toggle as an icon.

### The one thing you must not simplify away

`tests/polish.spec.ts:131-162` asserts a first-time visitor **sees the AO3 paste
guidance without clicking**, that `How to use` reports `aria-expanded="true"`, and
that dismissal survives a reload. That is deliberate — getting output into an AO3
work is the genuinely confusing part of this domain.

So: **keep the help panel in normal flow**, keep the `ao3skin_help_dismissed` key,
keep the accessible name and `aria-expanded`. A newcomer still lands on a tall bar;
that is the point. A returning author who dismissed it once gets 52px forever,
which is the actual complaint. The quality popover is different — never auto-open,
so it can float (`absolute bottom-full`) and never covers the composer.

### Platform carve-outs

**There are none, and that is worth stating explicitly.** All four platforms
support the work skin, so the button count is fixed at four and the layout never
reflows between platforms. Two consequences to respect:

- **Do not** make the Work skin button conditional on template as a "tidy-up". It
  is conditional on `workSkin` being non-null, which is a *build* result, not a
  platform check — `buildWorkSkin` can in principle return violations.
- The progress label is longer on multi-chunk exports (`Uploading 4/7`), and
  Google/Twitter render wider so they chunk differently. `truncate` on the label
  span is load-bearing, not decoration. Test with a 40-message Twitter thread.

### Code

Replace `<div className="max-w-4xl mx-auto px-4 py-3">…</div>`
([ExportPanel.tsx:725-834](../src/components/ExportPanel.tsx#L725-L834)) with:

```tsx
<div className="max-w-4xl mx-auto px-3 py-2">
  {/* One row. Everything that isn't a primary action is behind a popover, so
      the bar's height doesn't depend on how many options exist. */}
  <div className="flex items-center gap-2">

    {/* Quality — a chip, not a row. */}
    <div className="relative flex-shrink-0" onMouseDown={e => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setShowQuality(v => !v)}
        aria-haspopup="menu"
        aria-expanded={showQuality}
        aria-label={`Export quality, currently ${exportScale}×`}
        title="Export quality"
        className="px-2.5 py-2 rounded-lg text-xs font-semibold bg-stone-100 text-stone-600 hover:bg-stone-200 transition-colors"
      >
        {exportScale}×
      </button>

      {showQuality && (
        // bottom-full: floats above the bar. It must never be in flow — that is
        // what made the old layout 148px tall.
        <div role="menu" className="absolute bottom-full left-0 mb-2 w-44 bg-white rounded-xl shadow-lg border border-stone-200 p-2 z-10">
          <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide px-1 pb-1.5">Quality</p>
          {[1, 2, 4].map(s => (
            <button
              key={s}
              role="menuitemradio"
              aria-checked={exportScale === s}
              onClick={() => { setExportScale(s); setShowQuality(false); }}
              disabled={s === 4 && !proStatus.isPro}
              className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                exportScale === s ? 'bg-violet-600 text-white'
                : s === 4 && !proStatus.isPro ? 'text-stone-300 cursor-not-allowed'
                : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <span>{s}× resolution</span>
              {s === 4 && !proStatus.isPro && <span>✦</span>}
            </button>
          ))}
          {!proStatus.isPro && (
            <button
              onClick={() => { setShowQuality(false); setShowProModal(true); }}
              className="w-full mt-1 pt-1.5 border-t border-stone-100 text-[11px] font-semibold text-violet-600 hover:underline"
            >
              Upgrade for 4×
            </button>
          )}
        </div>
      )}
    </div>

    <button
      onClick={handleDownloadImage}
      disabled={isExporting}
      aria-label="Save Image"
      className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg font-semibold text-[13px] transition-all ${
        isExporting ? 'bg-stone-100 text-stone-300 cursor-not-allowed'
                    : 'bg-stone-800 text-white hover:bg-stone-900'
      }`}
    >
      {/* download icon, 15px — reuse the existing svg */}
      <span className="truncate">Save Image</span>
    </button>

    <button
      onClick={handleGetAO3Code}
      disabled={isExporting}
      aria-label="Copy for AO3"
      className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg font-semibold text-[13px] transition-all ${
        isExporting ? 'bg-violet-300 text-white cursor-not-allowed'
                    : 'bg-violet-600 text-white hover:bg-violet-700'
      }`}
    >
      {isExporting
        ? <><SpinnerSvg /><span className="truncate">{progressLabel || 'Working…'}</span></>
        : <><CodeSvg /><span className="truncate">Copy for AO3</span></>}
    </button>

    {/* Two words and a tooltip, not a sentence. */}
    {workSkin && (
      <button
        onClick={() => setShowWorkSkin(true)}
        aria-label="Work skin"
        title="Use a work skin instead — real selectable text that reflows on a phone, rather than an image"
        className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[13px] font-medium text-stone-600 bg-stone-50 border border-stone-200 hover:bg-stone-100 transition-colors"
      >
        {/* pencil icon, 14px */}
        <span className="hidden sm:inline">Work skin</span>
      </button>
    )}

    <button
      onClick={toggleHelp}
      aria-expanded={showHelp}
      aria-label="How to use"
      title="How to use"
      className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold transition-colors ${
        showHelp ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
      }`}
    >
      ?
    </button>
  </div>

  {/* Still in flow, still open by default for newcomers. */}
  {showHelp && (
    <div className="mt-2 bg-stone-50 border border-stone-200 rounded-lg p-2.5 space-y-1 text-[11px] text-stone-600 leading-relaxed">
      <p><strong className="text-stone-800">Save Image</strong> — downloads a PNG. Share it anywhere.</p>
      <p><strong className="text-stone-800">Copy for AO3</strong> — uploads it and gives you an <code className="bg-stone-200 px-1 rounded">&lt;img&gt;</code> tag to paste into AO3&apos;s HTML editor. No work skin needed.</p>
      {workSkin && <p><strong className="text-stone-800">Work skin</strong> — real text instead of a picture. Two pastes, one on your AO3 preferences page.</p>}
    </div>
  )}
</div>
```

Supporting state, beside the other `useState` calls:

```tsx
const [showQuality, setShowQuality] = useState(false);

// A popover that outlives its trigger is worse than no popover.
useEffect(() => {
  if (!showQuality) return;
  const close = () => setShowQuality(false);
  document.addEventListener('mousedown', close);
  return () => document.removeEventListener('mousedown', close);
}, [showQuality]);
```

And safe-area padding on the fixed wrapper — it currently sits under the iOS home
indicator:

```diff
- className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] z-50"
+ className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] z-50 pb-[env(safe-area-inset-bottom)]"
```

### Acceptance criteria

- [ ] Help dismissed → bar measures **≤ 60px** at 1280×800 **and** 390×844. Read
      `getComputedStyle(document.documentElement).getPropertyValue('--export-bar-h')`.
- [ ] Verified on **all four platforms** — the bar must not reflow between them.
- [ ] `--export-bar-h` still updates when help opens/closes (do not remove the
      `ResizeObserver`).
- [ ] `occlusion.spec.ts` run against a **local build** (C1) and its `[h=…]` output
      **read by eye** for `clickable=NO — blocked` at all five heights. Per C2 this
      spec has no assertions and passes unconditionally; a green tick here means
      nothing on its own.
- [ ] `tests/polish.spec.ts tests/friction.spec.ts tests/work-skin.spec.ts` green
      **with no edits to those files**. If you had to edit them, you changed an
      accessible name you should not have. `polish.spec.ts`'s two DISCLOSURE tests
      are the real assertions in that set (C2) — they are what pin the help panel.
- [ ] A 40-message Twitter export shows `Uploading 3/3` without breaking the row.

---

## 5. Phase B — a reaction picker

**Files:** new `src/components/ReactionPicker.tsx`; edits to `ComposeBar.tsx`,
`MessageTimeline.tsx`, and optionally `generator.ts` (B4).
**Depends on:** §3.

### Platform carve-outs — this is the important part

Reactions exist on **two of four platforms only**. Twitter and Google have no
`reaction` rendering path at all — the shared builder gates on
`(template === 'ios' || template === 'android')`
([generator.ts:429](../src/lib/generator.ts#L429)) and both return before reaching
it anyway. So:

1. **The picker must be typed to `'ios' | 'android'`, not to the four-template
   union.** Make the compiler enforce it rather than relying on a call-site guard:

   ```ts
   interface Props { template: 'ios' | 'android'; … }
   ```

   Both call sites already sit inside `template === 'ios' || template === 'android'`
   branches, so TypeScript narrows correctly and no cast is needed. If you find
   yourself writing `as 'ios' | 'android'`, you have put the picker in the wrong
   place.

2. **The emoji sets are per platform, not shared.** This codebase does not have
   one generic answer for a per-platform question — see the comment at
   [index.tsx:192-203](../src/pages/index.tsx#L192-L203) about `PLATFORM_LOOK`
   being the one table with the one answer. An iMessage screenshot with a 🙏
   tapback is wrong in a way readers notice, and a WhatsApp one with ‼️ is too.

   ```ts
   // The six iMessage Tapbacks, in Apple's order.
   const IOS_REACTIONS     = ['❤️', '👍', '👎', '😂', '‼️', '❓'];
   // WhatsApp's six default reactions, in WhatsApp's order.
   const ANDROID_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
   ```

3. **iOS SMS mode is a judgement call — take the permissive one.** With
   `iosMode: 'sms'` the thread is green and notionally not iMessage, and classic
   SMS had no tapbacks. Do **not** hide the picker: RCS has them, the CSS renders
   identically, and a fic author choosing green bubbles has not asked us to police
   their reactions. Leave one line in the code saying that was decided rather than
   overlooked.

4. **DEFERRED (D4): split the iOS chip by direction, and give it a palette entry.**
   **Not being built — see C4.** §11's condition (save on real AO3, read the stored
   CSS back, diff rule by rule) cannot be met in this environment, and `.reaction`
   is one of the eleven rules that has already gone missing from a saved skin once.
   It is logged in `docs/BACKLOG.md`. The rest of this item is kept as the spec for
   whoever picks it up.

   Android needs neither. Only do this if you are prepared to re-save the skin on
   real AO3 afterwards — §11 explains why. `iosColours()`
   ([generator.ts:1122-1174](../src/lib/generator.ts#L1122-L1174)) is already a
   light/dark table with 22 entries, so this is structured work, not a hack:

   ```diff
     light: {
       …
   +   reactionChipBg: '#e9e9eb',
   +   reactionChipColor: '#000',
   +   reactionChipBorder: 'rgba(0,0,0,0.06)',
     },
     dark: {
       …
   +   reactionChipBg: 'rgba(44,44,46,0.95)',
   +   reactionChipColor: '#fff',
   +   reactionChipBorder: 'rgba(255,255,255,0.1)',
     },
   ```

   and replace the single rule with two, so the chip stops landing on the outgoing
   bubble's tail:

   ```diff
   -#workskin dd.bubble .reaction{position:absolute;bottom:-0.625em;right:0.5em;background:rgba(44,44,46,0.95);…}
   +#workskin dd.bubble .reaction{position:absolute;top:-0.75em;background:${colour.reactionChipBg};color:${colour.reactionChipColor};border:1.5px solid ${colour.reactionChipBorder};border-radius:0.875em;padding:0.188em 0.5em;font-size:1.067em;box-shadow:0 2px 8px rgba(0,0,0,0.15);}
   +#workskin dd.bubble.out .reaction{left:-0.5em;}
   +#workskin dd.bubble.in  .reaction{right:-0.5em;}
   ```

   The bubble tail is bottom-left for `.in` and bottom-right for `.out`, so
   pinning the chip to the *top* corner on the opposite side clears it in both
   directions and matches where iMessage actually draws a tapback. **Check this
   against a real screenshot before committing** — I am confident about the
   collision, less so about Apple's exact offsets.

5. **Do not touch the Android rule.** `bottom:-0.444em;left:0.444em;background:transparent`
   ([generator.ts:1441](../src/lib/generator.ts#L1441)) is correct for both
   directions in WhatsApp, which puts the reaction at the bubble's lower-left
   regardless of who sent it. It looks like the same bug as iOS and is not.

### The component

```tsx
// src/components/ReactionPicker.tsx
import React, { useState } from 'react';

/**
 * Per platform, not shared. iMessage Tapbacks and WhatsApp reactions are
 * different sets in different orders, and using one list for both puts a 🙏 on
 * an iPhone — the same class of mistake PLATFORM_LOOK exists to prevent.
 */
const SETS: Record<'ios' | 'android', string[]> = {
  ios:     ['❤️', '👍', '👎', '😂', '‼️', '❓'],
  android: ['👍', '❤️', '😂', '😮', '😢', '🙏'],
};

interface Props {
  /** Narrowed deliberately: Twitter and Google have no reaction rendering path. */
  template: 'ios' | 'android';
  value: string;                 // '' = no reaction
  onChange: (v: string) => void;
  /** Distinguishes many pickers on one screen — the timeline renders one per row. */
  idPrefix?: string;
}

export const ReactionPicker: React.FC<Props> = ({ template, value, onChange, idPrefix = '' }) => {
  const set = SETS[template];
  // Reopen the custom field for a project that already carries an off-set emoji,
  // or editing one would silently look like it had no reaction.
  const [showCustom, setShowCustom] = useState(() => Boolean(value) && !set.includes(value));

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1">
        <span className="text-[10px] font-medium text-stone-400 uppercase tracking-wide mr-0.5">React</span>
        {set.map(emoji => {
          const active = value === emoji;
          return (
            <button
              key={emoji}
              type="button"
              aria-pressed={active}
              aria-label={`React with ${emoji}`}
              title={active ? 'Tap again to remove' : `React with ${emoji}`}
              // Tapping the active chip clears it. There is no other way to
              // remove a reaction, and a delete button for six chips is one
              // control too many.
              onClick={() => onChange(active ? '' : emoji)}
              className={`w-7 h-7 flex items-center justify-center rounded-full text-sm leading-none transition-all ${
                active ? 'bg-violet-100 ring-2 ring-violet-500'
                       : 'bg-white border border-stone-200 hover:bg-stone-100'
              }`}
            >
              {emoji}
            </button>
          );
        })}
        <button
          type="button"
          aria-expanded={showCustom}
          aria-label="Use a different emoji"
          title="Use a different emoji"
          onClick={() => setShowCustom(v => !v)}
          className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold transition-colors ${
            showCustom ? 'bg-violet-100 text-violet-700'
                       : 'bg-white border border-stone-200 text-stone-400 hover:bg-stone-100'
          }`}
        >
          +
        </button>
      </div>

      {showCustom && (
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Any emoji"
          aria-label="Reaction emoji"
          id={idPrefix ? `${idPrefix}-reaction` : undefined}
          className="w-24 text-xs bg-white border border-stone-200 rounded-lg px-2 py-1.5 text-center focus:ring-2 focus:ring-violet-500"
        />
      )}
    </div>
  );
};
```

### Wiring

**ComposeBar** — the detail tray is already split by template
([ComposeBar.tsx:188-262](../src/components/ComposeBar.tsx#L188-L262)); the picker
goes only in the iOS/Android branch. Replace the 56px input at lines 201-207:

```diff
   <div className="flex gap-2">
     <input … aria-label="Timestamp" … />
-    <input value={reaction} … aria-label="Reaction emoji" … />
     <select … aria-label="Delivery status" …>…</select>
   </div>
+  <ReactionPicker template={template} value={reaction} onChange={setReaction} />
   <ImageUrlInput … />
```

`reaction` state and the `setReaction('')` reset in `handleSend`
([ComposeBar.tsx:143](../src/components/ComposeBar.tsx#L143)) are unchanged. Note
that `handleSend`'s iOS/Android branch is the only one that reads `reaction` at all
([ComposeBar.tsx:124](../src/components/ComposeBar.tsx#L124)) — the Twitter and
Google branches never did, so nothing there needs guarding.

**MessageTimeline** — replace `placeholder="Reaction"`
([MessageTimeline.tsx:231-236](../src/components/MessageTimeline.tsx#L231-L236)),
which lives inside the `template === 'ios' || template === 'android'` fragment.
Removing one cell from the `grid grid-cols-2` leaves three cells laid out 2+1 —
reorder so the odd one out is the status select. Then, after the grid closes:

```tsx
{(template === 'ios' || template === 'android') && (
  <ReactionPicker
    template={template}
    value={msg.reaction || ''}
    onChange={(v) => onUpdateMessage(msg.id, { reaction: v })}
    idPrefix={msg.id}
  />
)}
```

**While you are in MessageTimeline — one Twitter-specific tidy.** The expanded
editor renders four metric inputs per tweet
([MessageTimeline.tsx:286-321](../src/components/MessageTimeline.tsx#L286-L321))
even when `twitterShowMetrics` is off, in which case none of them render anywhere.
Wrap them:

```tsx
{template === 'twitter' && settings.twitterShowMetrics !== false && (<>…the four number inputs…</>)}
```

Keep the timestamp and handle inputs outside that guard — they render regardless.

### Acceptance criteria

- [ ] Tapping ❤️ in the compose tray then sending produces a **styled chip** on the
      bubble in the preview — not loose text after it.
- [ ] Structural test passes (this is what proves Bug A, not mere presence):

      ```ts
      const html = await page.locator('#workskin').first().innerHTML();
      expect(html).toMatch(/<dd class="bubble[^"]*"[^>]*>(?:(?!<\/dd>).)*class="reaction"/s);
      ```

- [ ] Same message exported via **Save Image** shows the chip in the PNG.
- [ ] A **WhatsApp message with both an image and a reaction** shows the reaction.
      It does not today (Bug B).
- [ ] Tapping the active chip clears it.
- [ ] Verified in **all four combinations**: iOS light, iOS dark, WhatsApp light,
      WhatsApp dark. If you did B4, additionally check outgoing *and* incoming on
      iOS — that is the case the chip/tail collision lives in.
- [ ] The picker does not render for Twitter or Google, and `tsc` would reject it
      if you tried.
- [ ] iOS group mode: the sender row sits at the top of the bubble and the chip at
      a corner — confirm they do not overlap on a one-line message.

---

## 6. Phase C — the Cast panel

The substantial phase. It answers Issues 2 and 4 and makes Issue 5 possible.

**New:** `src/components/CastPanel.tsx`.
**Edits:** `index.tsx`, `WorkspaceHeader.tsx`, `schema.ts`, `generator.ts`,
`ComposeBar.tsx`. Removals from `SettingsSheet.tsx` are Phase D.

### The idea

One panel answering *"who is in this conversation, and what do they look like"*,
replacing the four-way split. Opened from the header.

**Reuse `BottomSheet` and the `SettingsRows` primitives.** `SettingsRows.tsx` exists
precisely so surfaces stop growing parallel control sets that drift
([SettingsRows.tsx:3-13](../src/components/SettingsRows.tsx#L3-L13)). Do not invent
new rows.

### 6.1 Platform carve-outs — the panel is four different panels

This is not one layout with conditionals sprinkled in. Build it as a switch on
`template` at the top level, with shared leaf components (`PersonCard`,
`ParticipantRow`) underneath. Anything else will collapse into a knot of
`template === 'ios' && !settings.iosGroupMode &&` conditions.

#### iOS / WhatsApp, 1-on-1

```text
┌ People ─────────────────────────────────────────┐
│  YOU                                            │
│  Name  [ Rhys                    ]              │
│  Your own photo isn't shown — iMessage never     │
│  draws it on your own messages.                  │
│                                                 │
│  THEM                                           │
│  Name  [ Steve                   ]              │
│  ◯ [ paste an image address ] [⬆] [🎭 Presets]  │
│  Shown in the header at the top of the chat.     │
│                                                 │
│  ───────────────────────────────────────────    │
│  Group chat                            [ off ]  │
└─────────────────────────────────────────────────┘
```

The "no photo for You" note is not filler — it is the answer to *"where do I set my
own avatar"*, which is the question that produced this issue. Saying **why** stops
the user hunting for a control that should not exist.

#### iOS / WhatsApp, group mode ON — a different panel, not an extra section

Per §2.2 the identity fields **change meaning**. The "Them" card must be *replaced*,
not supplemented:

```text
│  YOU                                            │
│  Name  [ Rhys                    ]              │
│                                                 │
│  THE GROUP                                      │
│  Group name [ Avengers Assemble  ]              │
│  ◯ [ group photo address ] [⬆] [🎭]             │
│     ↑ same iosAvatarUrl field, relabelled        │
│                                                 │
│  PEOPLE IN THE GROUP                  + Add     │
│  ┌───┐ [ Nat        ] [■]  ✕                    │
│  │ ◯ │ [ photo (optional) ] [⬆] [🎭]            │
│  └───┘                                          │
│  ┌───┐ [ Steve      ] [■]  ✕                    │
│  │ SR│ [ photo (optional) ] [⬆] [🎭]            │
│  └───┘                                          │
│  Add from your library:  ◯Nat ◯Sam ◯Bucky       │
│  Browse avatar presets →                         │
└─────────────────────────────────────────────────┘
```

Concretely, in the iOS/Android branch:

```tsx
const groupOn = template === 'ios' ? settings.iosGroupMode : settings.androidGroupMode;
const avatarKey = template === 'ios' ? 'iosAvatarUrl' : 'androidAvatarUrl';

{groupOn ? (
  <PersonCard
    title="The group"
    // Same field. In group mode the generator renders it as the group's photo
    // beside the group's name (generator.ts:889-899, 906-928), so calling it
    // "their photo" here would be a lie.
    note="Shown beside the group name in the header."
    avatarValue={settings[avatarKey]}
    onAvatarChange={v => onUpdateSettings(avatarKey, v)}
  >
    <TextRow label="Group name" value={groupName} onChange={setGroupName} />
  </PersonCard>
) : (
  <PersonCard title="Them" note="Shown in the header at the top of the chat." …>
    <TextRow label="Name" value={contactName} onChange={onRenameContact} />
  </PersonCard>
)}
```

#### Twitter — no "them", a roster instead

```text
│  YOU                                            │
│  ◯ Display name [ Nat Romanoff ]                │
│    Handle       [ @natromanoff ]                │
│    Verified                          [ on ]     │
│    [ image address ] [⬆] [🎭]                    │
│                                                 │
│  OTHER ACCOUNTS IN THIS THREAD        + Add     │
│  ◯ Steve Rogers  @cap        (this fic)   ✕     │
│  ◯ Tony Stark    @ironman    (library)          │
│  These fill the "posting as" list when you       │
│  write a post.                                   │
│  Browse avatar presets →                         │
```

**Two stores, one list, and only one of them is deletable here.** The roster in
`ComposeBar` is a merge of `settings.twitterCharacterPresets` (project-scoped) and
`universalCharacters` (global, in localStorage) performed at
[index.tsx:323-335](../src/pages/index.tsx#L323-L335). A delete control that does
not distinguish them would let a click inside one fic remove a character from every
project the author has ever made.

**Rule: the Cast panel may delete only project-scoped presets.** Library entries
render with a `(library)` tag and no ✕; removing one is `CharacterLibrary`'s job.
Label the source in the row so the asymmetry reads as intentional rather than as a
missing button.

`chatYourName` must **not** appear on Twitter — `twitterDisplayName` is the
equivalent and it is already the header title. Two fields for one name is the
problem this phase exists to remove.

**The quote tweet stays in Settings.** It is an identity (`twitterQuoteName`,
`twitterQuoteHandle`, `twitterQuoteAvatar`, `twitterQuoteVerified`) but it is
welded to a feature toggle and applies to *every* tweet in the project
([generator.ts:531-540](../src/lib/generator.ts#L531-L540) — the block is built
from `project.settings` inside `msgHTML`, so one quote appears under all of them).
Splitting its four identity fields into the Cast panel and leaving the toggle, text
and image in Settings would scatter one feature across two surfaces. Keep it whole;
Phase D collapses it into an accordion instead.

#### Google — keep the button, change what it opens

Google has no cast. But **hiding the header button strands `CharacterLibrary`**
(D6), which is legitimately useful there — `handleSetAsContact` maps Google to
`googleQuery` ([index.tsx:313-315](../src/pages/index.tsx#L313-L315)), i.e. "search
for this character's name".

So on Google the header button keeps today's behaviour and label:

```tsx
onClick={template === 'google' ? onCharactersOpen : onCastOpen}
aria-label={template === 'google' ? 'Open character library' : 'Open people'}
```

One button, two destinations, chosen by the only platform that has no people in it.

### 6.2 Schema change — one field, and it is not universal

```ts
  /**
   * What the author is called in their own conversation. iOS and Android only —
   * Twitter's equivalent is twitterDisplayName and Google has no such concept.
   *
   * iMessage and WhatsApp never render your own name on screen, so this looks
   * cosmetic and is not: it is the hidden speaker label a reader gets with Hide
   * Creator's Style on and in a downloaded EPUB (generator.ts §9a). An author
   * writing as Rhys was shipping "You:" to those readers with no way to change it.
   */
  chatYourName?: string;
```

Add `chatYourName: ''` to `defaultProject().settings`. **Do not default it to
`'You'`** — the empty string is what lets the generator keep `'You'` as its fallback
and keeps `tests/skin-off.spec.ts` green.

### 6.3 Generator change — retroactive, and fenced to two platforms

`hiddenSpeaker` is computed in the **shared** section at
[generator.ts:362-364](../src/lib/generator.ts#L362-L364), which by §0 rule 4 runs
for all four platforms. Today only the iOS and Android branches consume it (Twitter
returns at ~594, Google at ~599), so it happens to be safe — but that is an
accident of ordering, and the next template added before those branches would
inherit a name that means nothing to it. Fence it explicitly:

```ts
// iOS and Android only. Twitter's identity is resolved in its own branch below
// and Google has no speaker at all — but this is computed in the shared section,
// so the platform test belongs here rather than in the reader's head.
const isChat = template === 'ios' || template === 'android';

// Resolved at render time rather than stamped at send time, so renaming yourself
// in the People panel updates messages that already exist. Same reasoning as the
// Twitter identity block below.
const youName = isChat ? ((project.settings.chatYourName || '').trim() || 'You') : 'You';
const speaker = msg.outgoing ? youName : (msg.sender || 'Them');

const hiddenSpeaker = senderNameHTML
  ? ''
  : `<dt class="visually-hidden">${sanitizeText(speaker)}: </dt>`;
```

**Leave the incoming side stamped.** `tests/skin-off.spec.ts:86-92` asserts
`'Sam: hey 10:23'` from a message whose `sender` is `'Sam'` with no contact name in
settings; resolving incoming from settings would break it. Retroactive renaming of
*them* is handled by rewriting the messages instead — next section.

### 6.4 index.tsx — three handlers, and D1/D2 fixed on the way past

**Rename the contact, and rewrite what they already said:**

```tsx
/**
 * Renaming the other person rewrites the messages they have already sent.
 *
 * Their name is stamped onto each incoming message at send time (ComposeBar) and
 * it is what a reader sees with the skin off. Changing the setting alone would
 * leave every existing bubble labelled with the old name. Only untouched messages
 * are rewritten — anything explicitly assigned to a group participant is theirs.
 */
const handleRenameContact = useCallback((name: string) => {
  setProject(prev => {
    const key = prev.template === 'ios' ? 'iosContactName' : 'androidContactName';
    const previous = (prev.settings as any)[key] || prev.settings.chatContactName || 'Them';
    return {
      ...prev,
      settings: { ...prev.settings, [key]: name },
      messages: prev.messages.map(m =>
        !m.outgoing && !m.participantId && (!m.sender || m.sender === previous)
          ? { ...m, sender: name }
          : m
      ),
    };
  });
}, []);
```

**Fix D1 — the header title must follow group mode.** `contactNameKey`
([index.tsx:342-346](../src/pages/index.tsx#L342-L346)) currently ignores it:

```diff
- const contactNameKey = project.template === 'ios' ? 'iosContactName'
-   : project.template === 'android' ? 'androidContactName'
-   : project.template === 'twitter' ? 'twitterDisplayName'
-   : 'googleQuery';
+ // In group mode the header renders the GROUP's name (generator.ts:889, 907),
+ // so editing the contact name there changed a field nothing was showing.
+ const contactNameKey =
+   project.template === 'ios'
+     ? (project.settings.iosGroupMode ? 'iosGroupName' : 'iosContactName')
+   : project.template === 'android'
+     ? (project.settings.androidGroupMode ? 'androidGroupName' : 'androidContactName')
+   : project.template === 'twitter' ? 'twitterDisplayName'
+   : 'googleQuery';
```

and route only the non-group chat case through the rewrite:

```tsx
const isGroup = (project.template === 'ios' && project.settings.iosGroupMode)
             || (project.template === 'android' && project.settings.androidGroupMode);

<WorkspaceHeader
  contactName={displayContactName}
  onContactNameChange={(name) =>
    (project.template === 'ios' || project.template === 'android') && !isGroup
      ? handleRenameContact(name)
      : handleUpdateSettings(contactNameKey as any, name)}
```

`WorkspaceHeader`'s `fieldLabels`/`fieldPlaceholders` maps
([WorkspaceHeader.tsx:67-78](../src/components/WorkspaceHeader.tsx#L67-L78)) must
gain the group case too, or the aria-label says "Contact name" over a group name.
Pass an explicit `fieldLabel` prop from `index.tsx` rather than deriving it from
`template` inside the header — the header cannot see `settings`.

**Fix D2 — Android's inverted precedence.** One character, in the generator:

```diff
-      const contactName = isGroupMode
-        ? (s.androidGroupName || 'Group Chat')
-        : (s.chatContactName || s.androidContactName || '');
+      const contactName = isGroupMode
+        ? (s.androidGroupName || 'Group Chat')
+        // androidContactName first, matching iOS (line 890) and ComposeBar
+        // (ComposeBar.tsx:110). The old order made the WhatsApp header and its
+        // own messages disagree on legacy projects carrying both fields.
+        : (s.androidContactName || s.chatContactName || '');
```

**Panel state and mounting:**

```tsx
const [showCast, setShowCast] = useState(false);
```

```tsx
<CastPanel
  isOpen={showCast}
  onClose={() => setShowCast(false)}
  template={project.template}
  settings={project.settings}
  onUpdateSettings={handleUpdateSettings}
  onRenameContact={handleRenameContact}
  universalCharacters={universalCharacters}
  onOpenCharacterLibrary={() => { setShowCast(false); setShowCharacters(true); }}
/>
```

`CharacterLibrary` stays mounted and unchanged.

### 6.5 WorkspaceHeader

```diff
- <button onClick={onCharactersOpen} title="Characters" aria-label="Open character library" …>
+ <button
+   onClick={template === 'google' ? onCharactersOpen : onCastOpen}
+   title={template === 'google' ? 'Characters' : 'People in this conversation'}
+   aria-label={template === 'google' ? 'Open character library' : 'Open people'}
+   …>
    {/* keep the two-people icon */}
  </button>
```

Keep both props on the component. Do not delete `onCharactersOpen` — Google needs it.

### 6.6 The participant row — Issue 4

Move `addGroupParticipant` / `removeGroupParticipant` / `updateGroupParticipant`
([SettingsSheet.tsx:68-93](../src/components/SettingsSheet.tsx#L68-L93)) **verbatim**
into `CastPanel`; do not rewrite them. Extend `add` to take a seed so both entry
points share one path:

```ts
const addParticipant = (
  field: 'iosGroupParticipants' | 'androidGroupParticipants',
  seed?: Partial<GroupParticipant>
) => {
  const existing = settings[field] || [];
  const colors = ['#FF5733', '#33A1FF', '#33FF57', '#FF33A1', '#FFC733', '#8B33FF'];
  onUpdateSettings(field, [...existing, {
    id: `p-${Date.now()}`,
    name: `Person ${existing.length + 1}`,
    color: colors[existing.length % colors.length],
    ...seed,
  } as GroupParticipant]);
};
```

The row, with the field that has been missing:

```tsx
<div key={p.id} className="rounded-xl border border-stone-200 p-2.5 space-y-2">
  <div className="flex items-center gap-2">
    <input
      type="color"
      value={p.color}
      onChange={(e) => updateParticipant(field, p.id, { color: e.target.value })}
      aria-label={`Name colour for ${p.name}`}
      className="w-6 h-6 rounded cursor-pointer border-0 flex-shrink-0"
    />
    <input
      value={p.name}
      onChange={(e) => updateParticipant(field, p.id, { name: e.target.value })}
      aria-label="Participant name"
      placeholder="Name"
      className="flex-1 min-w-0 text-sm bg-stone-100 rounded-lg px-2.5 py-1.5 border-0 outline-none focus:ring-2 focus:ring-violet-500"
    />
    <button
      onClick={() => removeParticipant(field, p.id)}
      aria-label={`Remove ${p.name}`}
      className="flex-shrink-0 text-stone-400 hover:text-red-500 text-xs w-6 h-6"
    >✕</button>
  </div>
  {/* THE MISSING FIELD. The generator has rendered participant avatars since
      group chat shipped (generator.ts:318-322) — there has just been nowhere to
      set one. Without a URL it draws a coloured monogram from the initials.

      ImageUrlInput, not AvatarSelector — see C5. The preset browser is
      absolutely positioned and this list lives inside an overflow-y-auto sheet,
      so one per row would be six clipped 384px panels. The section's single
      "Browse avatar presets →" link below is the presets entry point. */}
  <ImageUrlInput
    value={p.avatarUrl || ''}
    onChange={(url) => updateParticipant(field, p.id, { avatarUrl: url })}
    previewShape="circle"
    ariaLabel={`Photo for ${p.name}`}
    placeholder="Photo (optional) — a monogram is used without one"
  />
</div>
```

Then the library strip beneath it, which is why `universalCharacters` is a prop:

```tsx
{universalCharacters.length > 0 && (
  <div className="pt-2">
    <p className="text-[11px] text-stone-500 mb-1.5">Add from your library</p>
    <div className="flex gap-2 overflow-x-auto pb-1">
      {universalCharacters.map(c => (
        <button
          key={c.id}
          onClick={() => addParticipant(field, { name: c.name, avatarUrl: c.avatarUrl })}
          title={`Add ${c.name}`}
          className="flex-shrink-0 flex flex-col items-center gap-1 w-14"
        >
          {/* 40px round avatar, or monogram */}
          <span className="text-[10px] text-stone-600 truncate w-full text-center">{c.name}</span>
        </button>
      ))}
    </div>
  </div>
)}
<button onClick={onOpenCharacterLibrary} className="text-xs font-medium text-violet-600 hover:underline">
  Browse avatar presets →
</button>
```

**Renaming a participant does not need message rewriting**, unlike the contact:
group messages carry `participantId` and the generator looks the name up live
([generator.ts:313-331](../src/lib/generator.ts#L313-L331)). Only messages that were
never assigned fall back to the stamped `msg.sender`, and those are the ones
`handleRenameContact` covers.

### 6.7 ComposeBar

Your own name comes from settings ([ComposeBar.tsx:107](../src/components/ComposeBar.tsx#L107)):

```diff
- let senderName = isOutgoing ? 'You' : (
+ let senderName = isOutgoing ? (settings.chatYourName?.trim() || 'You') : (
```

and the direction chip should show the real names — it is the one place the author
sees who they are posting as:

```diff
- {isOutgoing ? 'You' : 'Them'}
+ {isOutgoing ? youLabel : themLabel}
```

with, at the top of the component:

```tsx
// iOS/Android only — the chip does not render for Twitter or Google.
const youLabel = settings.chatYourName?.trim() || 'You';
const themLabel =
  (template === 'ios'
    ? settings.iosContactName || settings.chatContactName
    : settings.androidContactName || settings.chatContactName) || 'Them';
```

Keep the `aria-label` template `Sending as ${…} — tap to switch`, and add
`max-w-[80px] truncate` to the chip: a long name must not push the send button off
a 360px screen. `friction.spec.ts` locates the send button with
`button:right-of(textarea)`, which is unaffected either way.

### Acceptance criteria

- [ ] Everything about "who is in this conversation" is **one click** from the
      workspace on iOS, WhatsApp and Twitter.
- [ ] On **Google**, the header button still opens the character library and
      "Set as contact" still fills the search query.
- [ ] Setting a participant avatar shows a round 20px image beside that person's
      name in the preview; clearing it shows a monogram. Check on **both** iOS and
      WhatsApp — they use separate settings keys and separate CSS blocks.
- [ ] **Group mode on:** the Cast panel labels the avatar as the group's photo, the
      header title edits the *group* name, and the preview header matches. (D1)
- [ ] **Group mode off:** the header title edits the contact name, and renaming
      rewrites existing incoming messages. Verify via the Work skin modal — search
      the HTML for the new name followed by `: `.
- [ ] Setting your own name changes the compose chip, new messages, **and** the
      hidden speaker label on messages written *before* the rename.
- [ ] `chatYourName` has no effect on Twitter or Google output — diff `buildHTML`
      with it set and unset for both.
- [ ] Deleting a Twitter roster entry that came from the library is **not possible**
      from the Cast panel.
- [ ] A legacy project carrying both `chatContactName` and `androidContactName`
      shows the same name in the WhatsApp header and on its messages. (D2)
- [ ] `npx playwright test tests/skin-off.spec.ts tests/work-skin.unit.spec.ts
      tests/ao3-injection.spec.ts` — green, unedited.

---

## 7. Phase D — slim the settings panel

**Depends on:** Phase C. Do not start until identity has somewhere else to live.

The rule: **settings answers "how does it look", the People panel answers "who is
in it".** Mostly subtractive — but the per-platform carve-outs below are where the
work actually is.

### iOS — 9 rows → 4

| Row | Action |
|---|---|
| Message type (iMessage / SMS) | keep |
| Dark mode | keep |
| Auto-alternate senders | keep |
| Read receipt | keep |
| Contact photo + its explanatory paragraph | **→ Cast panel** |
| Group chat mode / Group name / Participants | **→ Cast panel** |
| Advanced (status bar, typing bar, header/footer bg, width, watermark) | keep |

Collapse the remaining `SectionDivider`s into one — with four rows, section headers
cost more than they organise.

### WhatsApp — 8 rows → 4, **and one new conditional**

Keep: Dark mode, Auto-alternate, Checkmarks, Online status (+ status text).
Move out: Profile picture, Group chat mode, Group name, Participants.

**Fix D3 while you are here.** In group mode the header subtitle is the participant
count and `androidStatusText` is never read
([generator.ts:917-919](../src/lib/generator.ts#L917-L919)), so the toggle and its
text field are live controls over dead settings:

```tsx
{/* Group chats show the member count here instead, so this pair has nothing
    to control (generator.ts:917). */}
{!settings.androidGroupMode && (
  <>
    <ToggleRow label="Online status" … />
    {settings.androidShowStatus !== false && <TextRow label="Status text" … />}
  </>
)}
```

This has an iOS counterpart that is **not** worth adding: the iOS group header
renders no subtitle at all, so there is nothing to hide. Do not "fix" the asymmetry
by adding a participant count to the iOS header — that changes `buildHTML` output
for every iOS group project and needs its own test update. Log it as a parity item.

### Twitter — 11 rows → 3 + two accordions

Keep in place: Dark mode, Show metrics, Timestamp.
**→ Cast panel:** Handle, Verified badge, Profile picture (and its paragraph).
**→ Advanced:** Thread mode. Per D5 it draws connecting lines but **no component
can create a reply** — `parentId` / `replyToHandles` / `expandedView` are written
only by loaded templates. Presenting it as a top-level feature promises something
the app cannot do. Move it down and say so:

```tsx
<ToggleRow
  label="Thread mode"
  sublabel="Connects tweets with lines. Replies currently come from example templates only."
  … />
```

**→ its own accordion:** the six quote-tweet fields, kept **whole** (§6.1):

```tsx
<AdvancedSection label="Quote tweet">
  <ToggleRow label="Enable quote tweet" … />
  {settings.twitterQuoteEnabled && (<>…the five existing rows…</>)}
</AdvancedSection>
```

`AdvancedSection` already takes a `label`
([SettingsRows.tsx:95-98](../src/components/SettingsRows.tsx#L95-L98)) and is
collapsed by default. `tests/settings-render.spec.ts:102-108` asserts **exactly one**
button named `Advanced` — a second collapsible named `Quote tweet` is fine; a second
one named `Advanced` is not.

### Google — leave it almost alone

Google is already the simplest panel and it is the one most at risk from a
simplification pass, because its rows are what distinguish its three engine
variants.

- **Do not** move Autocomplete suggestions or Did-you-mean into Advanced. The
  engine variant only swaps the logo and a CSS class
  ([generator.ts:964-983](../src/lib/generator.ts#L964-L983)); suggestions and the
  correction render for `google`, `google-old` **and** `naver` alike, and they are
  most of what makes a Google mock look real.
- **Do** delete the orphaned paragraph at
  [SettingsSheet.tsx:414-417](../src/components/SettingsSheet.tsx#L414-L417) ("What
  was searched for is the title at the top of the screen"). With no People panel on
  Google, move that hint to the header title's placeholder instead — the header
  already has `fieldPlaceholders.google`.
- Results count / search time stay in Advanced, blank-means-auto, unchanged.

### Test edits required

`tests/settings-render.spec.ts` reaches group controls through Settings in two
tests. Both repoint at the People panel; every assertion after that is about
generator output and is unchanged:

```diff
-   await page.getByRole('button', { name: 'Open settings' }).click();
+   await page.getByRole('button', { name: 'Open people' }).click();
    await page.getByRole('switch', { name: 'Group chat mode' }).click();
    await page.locator('[placeholder="Family Chat"]').fill('Avengers Assemble');
```

Same for the WhatsApp test at line 42, including its two `+ Add` clicks.

Add three new tests pinning this phase's intent:

```ts
test('settings holds no identity fields — those live with the people', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /blank iMessage/i }).click();
  await page.getByRole('button', { name: 'Open settings' }).click();
  await expect(page.getByText('Contact photo')).toHaveCount(0);
  await expect(page.getByRole('switch', { name: 'Group chat mode' })).toHaveCount(0);
});

test('WhatsApp hides the online status controls in group mode', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /blank WhatsApp/i }).click();
  await page.getByRole('button', { name: 'Open settings' }).click();
  await expect(page.getByRole('switch', { name: 'Online status' })).toBeVisible();
  await page.getByRole('button', { name: 'Open people' }).click();
  await page.getByRole('switch', { name: 'Group chat mode' }).click();
  await page.getByRole('button', { name: 'Open settings' }).click();
  await expect(page.getByRole('switch', { name: 'Online status' })).toHaveCount(0);
});

test('Google keeps its search-shaping rows out of Advanced', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /blank Google/i }).click();
  await page.getByRole('button', { name: 'Open settings' }).click();
  // Visible without expanding anything — these are what make a Google mock read
  // as real, for all three engine variants.
  await expect(page.getByText('Autocomplete suggestions')).toBeVisible();
});
```

### Acceptance criteria

- [ ] iOS settings fits on one phone screen without scrolling, help panel closed.
- [ ] **No setting became unreachable.** Diff `SkinSettings` key usage across
      `src/components` before and after; every key that had a control still has
      one, in Settings or the Cast panel. This codebase has shipped unreachable
      settings before — `tests/settings-render.spec.ts` exists because of it; read
      its header comment.
- [ ] All three engine variants still configurable from an unexpanded Google panel.
- [ ] `npx playwright test` — full suite green with only the edits above.

---

## 8. What this plan deliberately does not do

- **Does not add a reply/thread editor for Twitter (D5).** `parentId`,
  `replyToHandles` and `expandedView` deserve real UI, but that is a feature, not a
  refinement, and it would double Phase D. Moving Thread mode into Advanced with an
  honest sublabel is the correct interim.
- **Does not add a participant count to the iOS group header.** Real asymmetry with
  Android, but it changes `buildHTML` for every existing iOS group project.
- **Does not unify `twitterCharacterPresets` with `universalCharacters`.** One is
  project-scoped in settings, the other global in localStorage, and they are merged
  at read time ([index.tsx:323-335](../src/pages/index.tsx#L323-L335)). Unifying
  them is a migration with its own risk profile. The Cast panel labels the source
  instead.
- **Does not expose `chatShowTyping`, `chatTypingName`, `isTyping`, `showTimeBreak`
  or `timeBreakText`.** All are read by the generator and written by nothing —
  the same class as D5. Worth a BACKLOG entry, not worth bundling here.

---

## 9. Accessible names that are load-bearing

Do not change these without updating the spec that selects on them.

| Name | Role | Used by |
|---|---|---|
| `Save Image` | button | `cors-export.spec.ts:55`, `friction.spec.ts:56`, `work-skin.spec.ts:156` |
| `Copy for AO3` | button | `work-skin.spec.ts:157` |
| `How to use` | button + `aria-expanded` | `friction.spec.ts:159`, `polish.spec.ts:140,148,159` |
| `/work skin/i` | button | `work-skin.spec.ts:38,46,68,85,115` |
| `Copy the CSS`, `Copy the HTML` | button | `work-skin.spec.ts:53,54` |
| `Work skin CSS`, `Work skin HTML` | label | `work-skin.spec.ts:87,88,123,131,147` |
| `Work skin` | dialog | `work-skin.spec.ts:70,117` |
| `Just Twitter`, `All four platforms` | radio | `work-skin.spec.ts:118,119` |
| `Open settings` | button | `settings-render.spec.ts:18,32,45,105` |
| `Advanced` | button, **count must be 1** | `settings-render.spec.ts:107` |
| `Group chat mode`, `Phone status bar` | switch | `settings-render.spec.ts:20,33,46` |
| `+ Add` | button | `settings-render.spec.ts:48,49` |
| `Add a message…` | placeholder | `occlusion`, `friction`, `polish` |
| `Edit display name`, `Edit search query` | button | `settings-render.spec.ts:69,82` |

Introduced here: `Open people`, `Export quality, currently N×`, `React with <emoji>`,
`Use a different emoji`, `Participant name`, `Remove <name>`, `Name colour for <name>`.

---

## 10. Order of work

```text
0. C1    Get a local build under test first  ~15 min   or nothing below is verified
1. §3    Two generator reaction fixes        ~30 min   blocks B; read C3
2. §4    Phase A — export bar                ~3 h      independent, no platform work
3. §5    Phase B — reaction picker           ~3 h      needs §3; B4 built too, see C4
4. §6    Phase C — Cast panel                ~2–3 d    the substantial one; D1, D2, C6, C7
5. §7    Phase D — settings slim             ~5 h      needs C; fixes D3
```

**All of the above is done.** What is left is the AO3 save for the chip CSS (C4).

### How it was actually verified

Worth recording, because C1/C2 mean "the suite is green" is not by itself an answer:

- `npx playwright test --project=unit` — **197 pass**, no browser, no server. This is
  the AO3-legality gate: it runs `lintAo3Css` over every platform in both themes and
  over the master skin. Fast enough to run on every save.
- The browser suites against `UX_BASE_URL=http://localhost:3124` with `--workers=1`,
  **run in small batches**. A single full-suite run took 15.5 minutes and reported
  five failures; every one of them passed when re-run in a batch of its own. That is
  the contention `tests/README.md` warns about, not a regression — but you only find
  that out by re-running, so budget for it and do not chase the first red.
- **The chip positions were found by rendering them, not by reasoning.** Six variants
  — iOS and WhatsApp × light, dark, group — built with `buildCSS`/`buildHTML` into a
  throwaway spec and screenshotted. The first version of that harness put all six on
  one page, and since every platform stylesheet selects on `#workskin` the last one
  won and all six rendered with WhatsApp's CSS. **Put each case in its own iframe.**
- Numbers that were claimed above were measured with a throwaway spec reading
  `--export-bar-h` off `document.documentElement`, not estimated.

Neither throwaway spec is committed, matching the standing convention for
verification guards in `docs/BACKLOG.md`.

### Two traps that cost real time here

Both are the same shape — **a comment is not inert** — and both broke a build:

1. **Tailwind scans comments.** Writing `pb-[env(...)]` with an ellipsis in a JSX
   comment made Tailwind emit a literal `padding-bottom: env(...)` rule, and the CSS
   build failed with `Unexpected token Delim('.')` pointing at a file nobody had
   edited. Tailwind's scanner is a regex over raw file text, not a parser.
2. **Backticks inside a template literal.** A CSS comment inside `buildAndroidCSS`
   quoted three declarations in backticks and terminated the template string, for a
   `TS1005: ';' expected` a hundred lines further down.

Ship after each phase. A, B and C are each independently valuable and none leaves
the app half-migrated. **Phase A is the only one with no platform-specific work** —
budget accordingly for the others.

---

## 11. Standing risk: touching the stylesheet

Phase B4 and nothing else in this plan modifies `buildCSS`. Before you decide it is
free, read [workSkin.ts:197-224](../src/lib/workSkin.ts#L197-L224): on 7 Aug 2026 a
saved iOS skin came back from AO3 **missing eleven consecutive rules** — the CSS
bubble tails, both `.time` rules, `.reaction`, `.status-indicator`, `.attach` and
the typing row — while everything before and after survived. The cause is still not
known.

`.reaction` was one of the eleven. If you change it, the verification is not "it
looks right in the preview": it is **save the skin on real AO3, read the stored CSS
back, and diff it rule by rule.** The method that made the last large mechanical
edit safe is recorded in `docs/BACKLOG.md` — snapshot `buildCSS` *and* `buildHTML`
across a wide variant matrix into the scratchpad, refactor, require byte-identical
output for everything you did not intend to change. Do not commit the guard.

If you are not in a position to do that, ship B1–B3 and leave B4 as a BACKLOG item.
The picker is worth having either way; the chip colour is not worth a silently
broken skin.
