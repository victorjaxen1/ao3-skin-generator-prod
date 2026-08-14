# AO3 Skin Generator — Outstanding Work

**One ranked list.** The reasoning for each item lives in the doc named in the
last column; this file exists so nobody has to read four documents to find out
what to do next.

**Last reconciled: end of 8 Aug 2026, against `main` at `b5b5975`.** Everything
shipped up to `c30f97b` (iOS and Android work skins) is excluded, and everything
in this file that says "done" is **deployed to production** — that push happened
at the end of 8 Aug 2026 and closed the "nothing is released" caveat that ran
through these docs all day.

**The master-skin chain is done — built, shipped in the UI, and proven on the
archive.** Items 6, 7, 8 and 10 landed on 8 Aug 2026, and **18a closed the same
day**: the 67 KB skin was saved on real AO3, read back **537 of 537 rules and
2,019 of 2,019 declarations, in order, nothing dropped**, and a single work
carrying all four platforms renders correctly from it.

**Nothing left is on a critical path.** Both exports work, both are proven on the
archive, both are live. In order of what is worth doing next:

1. **5d** — decide whether iOS/Android round their corners everywhere or nowhere.
   The only *decision* on this list; everything else is mechanical.
2. **The EPUB text** (18) — two minutes when AO3 stops returning 525s.
3. **5c** — one anchor becomes a span.
4. **9** — dedupe, re-measured against 537 rules rather than 292.
5. **11–16b** — the optional features, none urgent. The scrollable chat window
   (11) is the highest-value one.

**Item 18 is mostly closed too.** A work with all four platforms was posted and
read with **Creator's Style off**: our markup survives, none of our CSS is
served, and it reads as prose. That found two real defects, both fixed — shared
settings leaking a colour into three platforms out of four, and a group chat
naming every speaker three times (WORK-SKIN §16a, §16b). Only the EPUB *text*
is unread; the structure is known (AO3 strips every `class`), and repeated
download attempts returned Cloudflare 525s.

**Item 8 did not land the way it was scoped**, and the correction is the useful
part: a *derived diff* of the two themes (64 rules, the "five rules" shape
KNOWLEDGE §18 promised) is **unsound**, because an override can tie on
specificity with a more specific base rule and beat it by source order. It did,
and it put a hairline back under a metric-less tweet. The variant is a whole
namespaced stylesheet now — sound by construction, and 32 KB. See MASTER §6b.

**Items 5, 2d, 5a and 5b closed 7–8 Aug 2026.** The export-dialog copy; the
site-skin export going comment-free once the instruction it carried had a better
home; Twitter's chrome dropping from five fetched images per tweet to one; and
colour separating from structure into four palette tables. 5a also turned up
bugs in the *image* export that no test here could see — see the next section,
and note the method that found them: **export a real PNG and diff it against a
baseline.**

**The method that made 5b safe is worth reusing** for any large mechanical edit
here: snapshot `buildCSS` *and* `buildHTML` across a wide variant matrix into
the scratchpad, refactor, and require the output byte-identical. Pinning the
HTML as well is what lets you claim the PNG is unchanged without exporting one.
Do not commit the guard. Full account in WORK-SKIN §10b.

---

## Live bugs — do these first

> **Update, 7 Aug 2026 — items 1, 2, 2a and 2b are done**, and a real AO3 save
> settled item 17. See "The flex question, settled" below; the short version is
> that AO3 wraps our children in `<p>`, which breaks flex and `> *` alike, and
> **the paragraph reset does not fix it**.
>
> **All four platforms are now converted and measured** (17b), against the real
> injection rule read off the archive (17c). The harness is
> `tests/ao3-injection.spec.ts`; run it with
> `npx playwright test --project=desktop tests/ao3-injection.spec.ts`.

| # | Task | Why it matters | Where |
| --- | --- | --- | --- |
| 1 | ✅ **done.** **Google's exported HTML is 9 lines with blank-line breaks.** Collapse `buildHTML`'s Google branch to a single line; add a test asserting no platform's HTML contains `\n` | AO3 injects `<br>` at every newline and wraps blank-line-separated chunks in `<p>`, so it is rewriting our markup inside `.search-result` **right now, in a shipped platform** | MASTER §4 |
| 2 | ✅ **done.** **`.visually-hidden` uses the wrong recipe.** Swap `left:-9999px` for `clip: rect(0,0,0,0)` (three identical lines in `generator.ts`) | The off-screen technique can cause horizontal overflow and is handled inconsistently by assistive tech. The clip recipe is the WCAG standard **and is proven to survive AO3** — it was read out of CSS the archive is serving. This is the mechanism all skin-off support rests on | KNOWLEDGE §1 |
| 2b | ✅ **done.** **Google has no skin-off support at all** — zero `.visually-hidden` spans, where Twitter, iOS and Android all have them | An oversight in our own 7 Aug work: Twitter was done first, then iOS and Android, and Google was never revisited. A download currently reads *"search query All Images Videos News Maps More About 2,145,330,903 results…"* — the engine chrome as prose, then results with no structure. Needs the §9a treatment: hidden labels on the result title/URL/description, and the tab bar marked as chrome | WORK-SKIN §9a |
| 2a | ✅ **done** (but see the update above — it is necessary, not sufficient). **No platform emits a paragraph reset.** Add `#workskin .chat p{margin:0;padding:0;}` to all four stylesheets | AO3 injects `<p>` **depending on how the user pastes**, which we cannot control. Without a reset those paragraphs inherit `.userstuff p` margins and push the layout apart. The canonical Twitter skin's first defence, and it works even when our HTML is perfect. **Higher value than item 1**, which only fixes the case we can see | KNOWLEDGE §17 |

All four shipped on 7 Aug 2026, along with two things found while doing them:
every Google image was unsized (512x512 and 936x336 sources behind 14-20px CSS
boxes, so a download rendered the search magnifier the width of the page), and
WhatsApp's four delivery ticks needed per-status widths because they have four
different aspect ratios behind one `height:14px;width:auto` rule.

**2a did not do what it was ranked for.** It was top of this list because it
might also fix the flex problem. It does not — see below.

## Proven on the archive: comments make AO3 drop rules

**7 Aug 2026, confirmed by three saves of the same skin.** This is the only
sanitizer behaviour we have caught silently discarding legal CSS, and it took
reading the stored CSS back to see it at all.

A saved iOS work skin came back with **eleven consecutive rules missing** — both
CSS bubble tails, both `.time` rules, `.time.image-time`, `.reaction`,
`.status-indicator`, `.attach`, `img.attach-img` and both `.row.typing` rules.
88 rules sent, 77 stored. Everything before and after survived. Reproduced on a
second save; **removing comments from the export brought all eleven back.**

What it is not: the lint passes in both modes, every numeric token satisfies
AO3's own grammar, and every double quote in the file sits inside a comment and
is paired.

**Unproven but strongly suggested by the boundaries:** the drop began
immediately after the only comment containing a CSS declaration — a note that
mentioned `content:""` — and ran to the next comment. A parser that partly reads
comment bodies as CSS would behave exactly this way. Cheap to test if it ever
matters; it does not, because the fix is to send no comments.

| # | Task | Why | Where |
| --- | --- | --- | --- |
| 2c | ✅ **done for work skins.** `stripExportComments` in `workSkin.ts` | AO3 deletes every comment on save, so they reach nobody — the `generator.ts` copy is untouched and the preview and PNG still carry them | this section |
| 2d | ✅ **done, 7–8 Aug 2026.** `compile()` now emits **no comments at all** — the three header comments and the `note` field on `Rule` are gone, and the two notes that were worth keeping are ordinary source comments. Pinned by *"the export carries no comments at all"* in `site-skin.unit.spec.ts`. The precondition was already met: `ExportSkinDialog`'s numbered steps have carried both *"Preferences → Skins → Create Site Skin"* and *"add on to archive skin"* since it shipped, and `site-skin.spec.ts` pins them there — so nothing was traded away. ~~**Site skins have the same exposure and it is unverified.** `compile.ts:342` emits a comment per annotated rule, plus three header comments~~ | Lower risk than the work skin — none of the five contains a `property: value` pair — but the class is identical and BACKLOG 20 has never been run. **One of them is load-bearing UI copy**: *"leave the skin type on add on to archive skin"* is only ever seen in the paste box, since AO3 deletes it on save. So this is not a blind strip: move that instruction into the export dialog (item 5) and drop the comments in the same change | MASTER, this section |

## Fixed by looking at the exports — 8 Aug 2026

Three bugs, none of which any test here could see, all found by exporting a PNG
and reading it at zoom. Two were reported by the author. Full account in
WORK-SKIN §14a–14b.

| Bug | Where it lived |
| --- | --- |
| ✅ **The tweet name line was clipped in every PNG this app has ever exported.** `.head` is one line box tall and `overflow:hidden`; html2canvas draws text lower than the browser | `ExportPanel`, raster only — the stylesheet's `overflow:hidden` is the BFC that survives AO3's paragraph injection (§12d) and must stay |
| ✅ **Google's search query lost its descenders.** `.search-text` is `overflow:hidden` for its ellipsis, which clips vertically too | `ExportPanel`, `padding-bottom` so the ellipsis keeps working |
| ✅ **The "iOS Typing Indicators" example rendered a bubble saying `...`.** `isTyping` was in the schema and honoured by the editor; `buildHTML` ignored it, so the indicator — and the hidden *"is typing…"* line AO3 needs with the skin off — never shipped | `generator.ts`, `typingRowHTML` now shared with `chatShowTyping` |

**The method is the finding.** The lint, the injection harness and 169 green
unit tests all passed straight through these. Render it and look at it.

## Correctness and hygiene

| # | Task | Why | Where |
| --- | --- | --- | --- |
| 3 | ✅ **done.** **`stripCssComments()` in `ao3Css.ts`** — exported, documented with all four failures it prevents, and now the single copy of that regex in the codebase. Wired into `lintAo3Css` and the five test sites that each had their own. Five tests cover it, including the guard on the guard: **a real `@media` outside a comment is still caught**, so stripping cannot blind the lint |  Failing to strip comments before matching has produced **four** wrong answers: `lintAo3Css` refusing a stylesheet whose comment said `@media`, two tests reading values out of comments, and the namespacing prototype missing seven rules | MASTER §6a |
| 4 | ✅ **done — all four platforms.** 381 lengths converted, each against **its own rule's font-size context measured in a browser**, not guessed. Verified by geometry diff at a 16px base: google 0.02px, iOS 0.17px, android 0.28px worst-case on a default project — inside the 0.5px bar Twitter set. `getTextFormattingCSS` now takes the bubble size, because it is shared by iOS (15px) and Android (14px) and no single em is right for both. Only border widths, shadows and values ≤2px stay px |  AO3 forbids `@media` in skin CSS, so `em` is the only responsive lever. Method is in `buildTwitterCSS`'s header comment; assertion to copy is in `tests/work-skin.unit.spec.ts`. **Convert against each rule's own font-size context** or every card resizes; keep em values to three decimals | WORK-SKIN §10 |
| 5 | ✅ **done, 7–8 Aug 2026.** All three are in the work-skin modal: an amber note under step 1 carries the unique-title rule with a per-platform example (`yourname — WhatsApp`) and the one-skin-per-work merge instruction, and the footnote now says plainly that the icons load from our host, that AO3 keeps no copy, and that **"Copy for AO3" does not avoid this** — it uploads to ImgBB, which the old copy implied was the safe option. The image path's own modal says the same in one line. Pinned by *"the modal states the three things AO3 will not"* in `work-skin.spec.ts` | Three factual errors an author meets on their first paste. UI copy, not compiler work | WORK-SKIN §9f, KNOWLEDGE §7 |
| 5a | ✅ **done, 8 Aug 2026 — five to ONE, not two.** Both verified badges are `✔` in a CSS circle. The whole metric row became characters — `↩ ⇄ ♡` — which the author preferred to keeping our blue discs, and which looks more like the real site. Only the X logo is still fetched (a trademark we should not draw). Views and bookmarks stay images: opt-in extras, no character reads right. Pinned by *"a tweet fetches one chrome image, not five"*. **Two PNG bugs came out of this, both in WORK-SKIN §14a** — including a tweet name line that has been clipped in every PNG this app ever exported. ~~**Cut the chrome images from five per tweet to two.** Verified badge → CSS circle with `✔`; like icon → the character `❤`. Keep reply/retweet glyphs and the X logo as images~~ | A twenty-tweet thread is currently **100 requests to `media.publit.io`** inside somebody's published fic, forever. The WhatsApp author had exactly this break when Cloudinary cut them off, and every fic using their skin lost its images at once. gadaursan's skin needs **no chrome images at all** | KNOWLEDGE §11, §19 |
| 5b | ✅ **done, 8 Aug 2026.** **48 theme ternaries became four palette tables** — `TEXT_FORMATTING_COLOURS`, `iosColours(recvBg)`, `androidColours(senderBg, recvBg)`, `TWITTER_COLOURS` — each holding light and dark side by side, with the theme resolved once into `colour`. **No rule body mentions `isDark`**; `grep '\${isDark'` returns nothing. The settings-driven slots are palette *parameters* rather than entries kept outside the table, so **both variants stay reachable as data**, which is the whole precondition for item 8. Verified by snapshotting `buildCSS` *and* `buildHTML` for 96 variants — theme × three bubble palettes × `useDarkNeutral` × `iosMode`, optional chrome on — and requiring byte-identical output; pinning the HTML too is what proves the PNG is unchanged without exporting one. Google left alone (no dark mode). Recipe and what it did not anticipate: WORK-SKIN §10b. ~~**Separate structure from colour** in the four stylesheets~~ | Night mode in the canonical skin is **five rules**, because its base defines structure only. Ours bakes one theme, which is why settings-dependence is 24–32%. Worth doing on its own merits, and it makes item 8 cheap instead of a doubling | KNOWLEDGE §18 |
| 5d | **iOS and Android are rounded in the PNG and square everywhere else.** `renderChunk` sets `clone.style.borderRadius = '20px'` (plus `overflow:hidden`) on the export clone only — it is not in the stylesheet, so the preview and the real AO3 render both have square corners. Seen on a posted work, 8 Aug 2026. **Decide which is right and make all three agree**: either move the radius into `buildIOSCSS`/`buildAndroidCSS` (legal — `border-radius` is all over the stored CSS and `overflow` passes as a shorthand substring, and it would leave the PNG byte-identical) or drop it from the clone. Moving it in is the recommendation: a phone screen has rounded corners | This is precisely the "two renderings that can disagree" failure `SITE-SKIN-IMPLEMENTATION.md` §5 is about, and it does **not** qualify for the narrow exception WORK-SKIN §10 allows, because it compensates for nothing in html2canvas — it is a design choice that only one of the three paths got | WORK-SKIN §10 rule 5 |
| 5e | ✅ **done, 8 Aug 2026. Shared settings leaked into three platforms out of four.** `senderColor`, `receiverColor`, `bubbleOpacity`, `fontFamily` and `iosMode` are one set of fields for all four platforms, so a master skin built four blocks from whatever was chosen for the one the author had open — **unseen**, since those blocks style markup pasted chapters later. On a real posted work that meant **blue WhatsApp bubbles** and an **SMS-green iMessage**. `PLATFORM_LOOK` in `generator.ts` is the fix: the open platform keeps the author's settings (its CSS sits beside a preview built from them), the other three wear their own look. **The platform picker was a third opinion and the worst one** — WhatsApp was `#00A884` on `#1F2C34`, its *dark-theme* colours on a light card — and now reads the same table | One table, three call sites. Retires the old invariant "the master skin is the same whichever platform is open", which was true *because* every block took the open project's colours | WORK-SKIN §16a |
| 5f | ✅ **done, 8 Aug 2026. With the skin off, a group chat named every speaker three times** — the hidden `<dt>` label, the avatar monogram and the visible group name, one after another. The label is duplication the moment a row prints the name, so `msgHTML` omits it there; one-to-one chats and outgoing rows keep it. `tests/skin-off.spec.ts` renders with no CSS and reads `innerText`, which is the only way to see this | Found by looking at the posted work with `?style=disable`, which is also what every EPUB, MOBI and PDF is | WORK-SKIN §16b |
| 5c | **Replace `<a href="#" class="reply-handle">` with a `<span>`** — our only anchor | A link that goes nowhere: screen readers announce it as a link, and clicking scrolls the reader to the top of the page. Separately, AO3's parser has historically had trouble with `<a>` as a sibling of `<div>` and re-runs on every edit | KNOWLEDGE §22 |

## The master skin

Ordered; each depends on the one above. Items 1–3 above should land first.

**Code-complete, 8 Aug 2026.** 6, 7, 8 and 10 are done; only 9 (dedupe) remains,
and it is an optimisation rather than a gap. **The chain now ends at item 18a**,
which no amount of code can close: somebody has to save the thing on AO3.

| # | Task | Where |
| --- | --- | --- |
| 6 | ✅ **done, 8 Aug 2026.** `namespaceCss(css, platform)` and `CONTAINER_CLASSES` in `workSkin.ts`; `buildHTML` emits `class="chat <platform>"` on every path. The PNG-unchanged check is `tests/namespace.spec.ts` — every computed style on every element, diffed three ways (class alone, rewrite alone, both under paragraph injection). **It caught two real bugs**: `.tweets` is a class on the container beside `.chat`, so prefixing made every `.tweet` rule match nothing; and namespacing must run *after* `absolutizeCssAssets` or Android's `url('/assets/…')` gets the whole skin refused. Both in MASTER §6a-i, along with why a blocked image made the harness flaky | MASTER §6a |
| 7 | ✅ **done, 8 Aug 2026.** `buildMasterWorkSkin(project)` — a version rule (`#workskin .ao3skingen-v1::after{content:'1';}`, because AO3 deletes comments) then four namespaced blocks, 34,567 bytes over 293 rules. `tests/master-skin.spec.ts` diffs every computed style on every element against each platform's own single-platform skin, clean and under paragraph injection: **nothing moves**. The unit gate adds byte-identical containment — every master block *is* `namespaceCss(buildWorkSkin(p).css, t)`, so the two exports cannot become two generators — plus the stylesheet being the same whichever platform is open, which matters because the author saves it once. The render harness is now shared: `tests/_ao3-render.ts`, used by `namespace.spec.ts` too. **Not exposed to anyone yet — that is item 10** | MASTER §6c, §6d, §7 |
| 8 | ✅ **done, 8 Aug 2026.** Both themes in one skin. `buildHTML` emits `theme-light` / `theme-dark` on the container, `namespaceCss` takes an optional theme, and each themed platform carries a variant block for the theme the author did *not* pick (Google has none). Pinned by four browser cases per platform: the skin is always built from the **opposite** theme to the block under test, so the variant is the only thing that can be styling it. **The planned derivation — diff the palettes, emit ~20 colour rules — was built, measured and rejected**: an override tied on specificity with a more specific base rule and beat it by source order, restoring a border the base sheet removed. A whole namespaced stylesheet is sound by construction; the argument is in `themeVariantCss` | MASTER §6b, §6d, KNOWLEDGE §18 |
| 9 | ⬅ **START HERE.** Dedupe the byte-identical shared rules. **Worth more since 8**: the skin is 67 KB now, and the variant blocks duplicate every structural rule a second time — the shared-rule count needs re-measuring against 537 rules, not 293. Do **not** hand-merge into the single-platform export as well; two code paths that can disagree is the failure MASTER §6d names | MASTER §7 |
| 10 | ✅ **done, 8 Aug 2026; default reversed 14 Aug 2026.** The work-skin modal carries the choice: **Just \<platform\>** against **All four platforms** (the default). The wider option swaps the CSS box for `buildMasterWorkSkin`'s output, changes the title example to `yourname — chat skins`, and tells the author to return only for each conversation's HTML. The master skin is built lazily — eleven stylesheet builds, and `project` changes on every keystroke — only while the modal is open. Copy buttons remain usable for content-model preflight errors; only internal CSS/HTML contract failures disable them. Pinned by *"the author can take one skin for everything, or just this platform"* and *"content preflight errors never disable the CSS or HTML copy actions"* in `work-skin.spec.ts` | MASTER §7 |

## Features we don't have

Ranked by value, none urgent. All legal; sources in `AO3-WORK-SKIN-KNOWLEDGE.md`.

| # | Task | Note |
| --- | --- | --- |
| 11 | **Scrollable chat window** — `overflow-y:auto; height:470px` on the container | The highest-value item here. A 50-message exchange currently consumes the whole page. Proven legal (`overflow` is a shorthand substring) |
| 12 | Emoji-only sizing — one emoji large, 2–4 medium, 5+ normal | Mirrors what iMessage and WhatsApp actually do |
| 13 | Reaction counts and mixed emoji (`😭🤦💗3`) | We render a single reaction only |
| 14 | Link previews inside a bubble | |
| 15 | System rows — "Today", "Person A removed Person B" | We have time breaks, not events |
| 15a | **Twitter polls** — active (outlined options, "N hours left") and finished (filled bars at vote share, winner tinted, "1,234 votes · Final results") | The one feature the competing Tweet Builder has and we don't. Needs the `.p1`–`.p100` enumeration technique for bar widths, since inline `style` is stripped |
| 16 | Negative margins against `.userstuff` paragraph spacing | Not needed yet; every community skin ends up needing them |
| 16a | **New platforms.** Each is proven achievable inside AO3's constraints, with a published structural reference: YouTube, Reddit, Tumblr, Snapchat, Spotify, Polaroid, browser window | KNOWLEDGE §25. Not copyable — one author's fic-specific CSS — but it settles feasibility and shows the anatomy. Rule counts there indicate the design effort each represents |
| 16b | **`<details>` + `:has()` for JS-free interactivity** — e.g. a "show more replies" control on a long thread | KNOWLEDGE §24. Proven at scale: 175 `details`, 213 `[open]`, 111 `:has()` in one served skin. `::-webkit-details-marker` hides the triangle. No use for it today; the moment we want a control, this is the only mechanism |

## Blocked on a real AO3 save

**Nothing here can be resolved by reading source or writing tests.** This is the
release gate, and it has been open since the work-skin export shipped.

| # | Question | Why it matters |
| --- | --- | --- |
| 17 | ✅ **SETTLED, 7 Aug 2026 — see "The flex question, settled" below.** The hypothesis was right about the mechanism and wrong about the fix | |
| 17a | **Is our HTML idempotent under re-parsing?** Edit an author's note on a posted work and check the fic still renders | AO3 re-runs its HTML parser *on every edit* — new chapter, note change, tag edit — and the parser itself changes over time. A January 2023 change stopped `<a>` being a sibling of `<div>`; wrapping the structure in `<figure>` restored it. Markup that posts fine can break months later — KNOWLEDGE §22 |
| 18 | 🟡 **mostly done, 8 Aug 2026.** All four platforms saved as one master skin, a real chapter posted with all four in it, and read with Creator's Style **on** and **off**. Two defects found and fixed (5e, 5f); three more turned out to be the *measurement* rather than the export — `textContent` glues blocks together, `innerText` is the honest reading (WORK-SKIN §16c). **Outstanding: the EPUB text.** Its structure is known — AO3 strips every `class` attribute, so an EPUB is structure plus text — but repeated downloads returned Cloudflare 525s | The sanitizer is the only authority. Our lint is a model of it |
| 18a | ✅ **CLOSED, 8 Aug 2026 — saved, read back, and seen rendering.** **537 rules sent, 537 stored. 2,019 declarations sent, 2,019 stored. Zero selectors missing in either direction, zero properties dropped, zero rules reordered.** Every high-risk construct survives at an identical count: `display:contents` ×8, `clip:rect` ×7, `::after` ×7, `content:'…'` ×9, `transform` ×5, `filter` ×8, `box-shadow` ×10, `text-shadow` ×6, `float` ×2, `!important` ×36, `display:flex` ×52, quoted font names, absolute Publit URLs, `:nth-child` ×8, and **263 `.theme-dark` selectors** — the whole variant block. Comments: 0, as designed. **And a single work carrying all four platforms renders correctly**, styled by that one skin. So: no size cap at 67 KB, no editor mangling, no truncation | AO3 stores a pretty-printed copy — 80,409 bytes for the 66,983 we send — which is the form any future cap would presumably apply to. Item 9 is no longer needed for size; it is hygiene now — MASTER §6d, §8 |
| 19 | ✅ **DONE — all four platforms, 7 Aug 2026. Zero drift; full result in the update section below.** | AO3 stores the *cleaned* CSS, so the box is a direct readout of what survived. Anything missing is a rule our lint does not know — file it as a correction in SITE-SKIN §7 |
| 20 | Site skins: save all 16 templates; check the drop cap and divider on single- and multi-chapter works | The site-skin product's own open gate. **The checklist now exists — `docs/SITE-SKIN-AO3-CHECKLIST.md`, 13 Aug 2026** — sixteen rows plus nine named probes, and it asks for the readback diff item 19 taught us to do. Two probes are new: tag colours by type on a real listing *and* a real work page (two different AO3 markups), and `::-webkit-scrollbar` surviving the save (SITE-SKIN §13) |
| 21 | ✅ **CLOSED, 9 Aug 2026 — saved on AO3 and read back. 549 rules sent, 549 stored. 2,039 declarations sent, 2,039 stored. Zero selectors missing in either direction, zero declarations dropped.** All sixteen reaction rules survived whole — 4 rules x 2 platforms x 2 themes — keeping `position:absolute`, negative `top`/`bottom` offsets, `box-shadow` with `rgba()`, `z-index` and an `rgba` border. Every canary from the 7 Aug loss is present: bubble tails 8, `.time` 22, `.reaction` 12, `has-reaction` 4, `.status-indicator` 4, `.attach` 8, typing 32, `.check-icon` 4, `.group-sender` 20, `.message-image` 12. **The check is now `tests/ao3-readback.unit.spec.ts`** — drop the readback in as `ao3 master workskin*.txt` and it diffs selectors, per-rule declarations and canaries; with no such file it skips, since it needs a human to have talked to the archive. Verified non-vacuous by deleting one rule from a copy and watching it fail. Together with item 18a this is the second clean save since comments were stripped, which is now the best evidence the 7 Aug cause was comment-related. **Below is the account of the work, kept because the reasoning is the reusable part.** The reaction chips were rewritten on both chat platforms (UI-REFINEMENT §5 B4, D4, and C4 for the full account). **iOS:** was `bottom:-0.625em;right:0.5em` for *both* directions, landing on the outgoing bubble's tail and on the "Read" receipt, with a hardcoded `rgba(44,44,46,0.95)` — a dark chip on a white page in light mode. Now `top:-0.75em` with `.out{left:-0.5em}` / `.in{right:-0.5em}`, which clears the bottom tail by construction, plus three palette entries per theme in `iosColours()`. **Android:** the *side* was right (WhatsApp attaches lower-left for both directions) but it had no pill at all — transparent, borderless, unpadded — so a bare emoji hung loose between two messages. Now a real pill, two palette entries per theme in `androidColours()`. **Both:** a new `has-reaction` class on the bubble reserves the space the out-of-flow chip hangs into; it exists to avoid `:has()`. **Rewritten twice on 9 Aug 2026, and the second rewrite is the one to read.** First the pill was found printing on top of the words in every PNG — `has-reaction` reserved its space with `margin`, which reserves nothing here: a margin moves the *neighbouring row*, while the pill lies on *this* bubble's own text. That was fixed by reserving with `padding` instead. **That fix was also wrong**, and only a screenshot of a real WhatsApp thread showed why: WhatsApp puts the pill **entirely below the bubble**, leaves the bubble's layout **completely unchanged** (no strip, no extra padding, time and ticks untouched), and puts it on the **sender's own side** — right for outgoing, left for incoming. The old code comment claiming it is "lower-left regardless of who sent it" was simply false. Final: Android `bottom:-1.6em` with `.out{right:0.75em}`/`.in{left:0.75em}` and `margin-bottom:2em`, no padding and no tick/timestamp lifts; iOS keeps its corner tapback (`top:-0.75em`) with `padding-top:0.95em;margin-top:1.2em` — its `margin-top` was overlapping the *previous* message by 1.3px until measured. Since the pill is now wholly outside the Android bubble it cannot touch the text at all, so that bug class is gone rather than tuned around. `tests/reaction-layout.spec.ts` measures both failure modes (chip vs its own text, ≥2px clear; chip vs every other bubble, no overlap) and was verified to fail against the broken CSS. **What remains is only the verification:** save on real AO3, read the stored CSS back, diff rule by rule, checking `.reaction`, both `.out`/`.in` pairs and the two `has-reaction` rules. **Lesson worth keeping:** two of these three attempts were reasoned from the stylesheet and both were wrong — get a screenshot of the real app before designing a rule that imitates it | The rule was **dead code until 8 Aug 2026** — the iOS branch emitted the span outside the bubble, so the descendant selector never matched. Fixing that (UI-REFINEMENT §3 Bug A) switched the rule on and its two defects with it, which is how they were found: rendered in the app, seen wrong, then rendered across all six variants in a harness and read by eye. 197 unit tests pass, including `lintAo3Css` over every platform in both themes and the master skin, and `namespace`/`master-skin`/`ao3-injection`/`skin-off` are green — **none of which is the check this row is asking for.** `.reaction` was one of the eleven rules that vanished from the 7 Aug save, so §11 applies. Item 18a is good evidence the cause was comments and is fixed (537/537 stored), but that was the *master* path, and this rule feeds `buildIOSCSS`/`buildAndroidCSS` for eleven stylesheet builds inside `buildMasterWorkSkin` |

---

## The flex question, settled — 7 Aug 2026

**The first real AO3 save happened**, and the Google search rendered wrong: the
tab bar stacked one tab per line, and the mic and lens icons sat against the
query text instead of at the right edge of the bar.

**The mechanism, now reproduced rather than guessed.** AO3 wraps our children in
`<p>`. That does not remove `display:flex` — it *moves* it. The injected
paragraph becomes the flex item, so everything we meant to lay out is a
grandchild: `margin-left:auto` has nothing to push against, and the `.tab`
spans, being `display:flex` themselves, become blocks and stack. KNOWLEDGE §21
predicted exactly this.

**`> *` fails identically, and that is the part nobody predicted.** The child
combinator was our standard substitute for `gap` — the fix that got iOS, Android
and Twitter to zero violations. An injected `<p>` matches `> *` and takes the
margin meant for the element inside it. Every `> *` rule we own is as fragile as
the flex it replaced. *(Reproduced in the harness; not yet observed in the wild,
since the platform where it would show — Twitter's name line — renders fine on
the real archive.)*

**Twitter is fine, and that is evidence too.** The same session saved a Twitter
work skin and it rendered correctly: the float-based avatar/name split holds up
under whatever AO3 did to the markup. Float and inline-block survive; flex in a
structural role does not. That is the whole rule.

**Item 2a is not the fix.** Zeroing an injected paragraph's margins stops it
adding space; it cannot stop it being a box in between. The reset is still worth
having and stays. It is necessary and not sufficient.

**What survives**, and what Google now uses:

- **absolute positioning** — its containing block is the nearest *positioned*
  ancestor, and an injected `<p>` is not one
- **inline-block** — flows horizontally inside whatever block wraps it
- **float** — which is why §5a's blind Twitter rewrite was right all along
- **descendant selectors** (`.x img`) instead of child combinators (`.x > *`)

Reproduce it with the harness described in WORK-SKIN §6: wrap each container's
children in a `<p>` and render. Google's output is now byte-identical with and
without that injection.

| # | Remaining | Note |
| --- | --- | --- |
| 17b | ✅ **DONE, all four platforms, measured not assumed.** `tests/ao3-injection.spec.ts` renders each export inside AO3's own CSS twice — clean, and with the real injection rule applied — and diffs the geometry of the load-bearing elements. Optional chrome (status bar, input bar, quote tweet) is switched on so it is covered too, and expanded/threaded tweets and group chat each have their own case — **nothing is unmeasured**. Three genuine breakages found and fixed, listed in WORK-SKIN §12. The worst was invisible: **the typing indicator rendered 0x0 on AO3**, on both iOS and Android | Twitter's float rewrite is now confirmed *with a mechanism*, not just empirically: the stored HTML shows the avatar wrapped in a `<p>`, and `.head{overflow:hidden}` establishes a BFC beside the float, which is exactly why it survives where flex would not |
| 19 | ✅ **CLOSED, 7 Aug 2026, all four platforms.** The stored CSS was read back out of AO3's editor for Twitter, Google, iOS and Android and compared against what we emit. **Nothing was dropped, anywhere.** Every construct the lint permits and the sanitizer might not, survived: `transform`, `filter`, `transition`, `box-shadow`, `text-shadow`, `clip:rect(0,0,0,0)`, `overflow-wrap`, `word-break`, `letter-spacing`, `z-index`, `float`, `flex`/`flex-shrink`/`flex-direction`, `content:''`, `::before`/`::after`, `:nth-child(1)`, `:first-child`/`:last-child`, grouped comma selectors, `> *`, `!important`, quoted font names and absolute `url()`. Comments are deleted, as documented. **The lint is an accurate model of `css_cleaner.rb`, now confirmed against the archive rather than against source** | This also means a wrong render is *our* bug, not the sanitizer's — which is the assumption to start from in future |
| 17d | ✅ **The same readout refuted a theory in minutes** — a method note, not a finding; the result itself is item 19 above | Recorded because it cost an hour: an iOS work first rendered half-styled (inline timestamps, visible bold `<dt>` labels, unstyled `Read`) and a silent-truncation mechanism was inferred for it, complete with a plausible `content:""` culprit. **It was wrong** — the account simply had an older skin saved. Reading the stored CSS refuted it immediately. Check the saved skin is current before theorising |
| 17c | ✅ **DONE — the rule, read off the archive.** Both posted works were fetched back and their stored markup compared with what we emit. **Inside a `<div>`, each contiguous run of inline content (text, `<span>`, `<img>`, `<b>`) is wrapped in a single `<p>`. Block children (`div`, `dl`) are untouched. The interior of `<dd>`/`<dt>` is untouched.** The "one run, one paragraph" part is what does the damage: a flex row of inline children collapses to a SINGLE flex item | This is now encoded in the harness rather than described in prose, so it is testable. It also retires the guesswork in §5a and MASTER §5 — no `<br>` wrapping was observed at all |

## Document map

| Doc | What it is |
| --- | --- |
| `SITE-SKIN-IMPLEMENTATION.md` | The site-skin product. **§3 is the verified account of AO3's CSS sanitizer** and is assumed knowledge everywhere else. §7 records four corrections to `ao3Css.ts` |
| `WORK-SKIN-IMPLEMENTATION.md` | The per-platform work-skin export that ships today. §10 is the developer handoff |
| `MASTER-WORK-SKIN-IMPLEMENTATION.md` | The plan for one skin covering all four platforms, and what the beginner's guide got right and wrong |
| `AO3-WORK-SKIN-KNOWLEDGE.md` | Raw material: techniques and constraints from published skins, labelled by how strongly each is known |
