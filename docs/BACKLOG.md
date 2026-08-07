# AO3 Skin Generator — Outstanding Work

**One ranked list.** The reasoning for each item lives in the doc named in the
last column; this file exists so nobody has to read four documents to find out
what to do next.

**Last reconciled: 7 Aug 2026.** Everything shipped up to commit `c30f97b`
(iOS and Android work skins) is excluded.

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

## Correctness and hygiene

| # | Task | Why | Where |
| --- | --- | --- | --- |
| 3 | ✅ **done.** **`stripCssComments()` in `ao3Css.ts`** — exported, documented with all four failures it prevents, and now the single copy of that regex in the codebase. Wired into `lintAo3Css` and the five test sites that each had their own. Five tests cover it, including the guard on the guard: **a real `@media` outside a comment is still caught**, so stripping cannot blind the lint |  Failing to strip comments before matching has produced **four** wrong answers: `lintAo3Css` refusing a stylesheet whose comment said `@media`, two tests reading values out of comments, and the namespacing prototype missing seven rules | MASTER §6a |
| 4 | **`em` for iOS, Android and Google.** Twitter is converted; the others are still `px` | AO3 forbids `@media` in skin CSS, so `em` is the only responsive lever. Method is in `buildTwitterCSS`'s header comment; assertion to copy is in `tests/work-skin.unit.spec.ts`. **Convert against each rule's own font-size context** or every card resizes; keep em values to three decimals | WORK-SKIN §10 |
| 5 | **Export dialog copy.** A work can only use one skin (an author who already has one must *merge*); skin titles are unique across all of AO3; a quota-limited image host will break a published fic silently | Three factual errors an author meets on their first paste. UI copy, not compiler work | WORK-SKIN §9f, KNOWLEDGE §7 |
| 5a | **Cut the chrome images from five per tweet to two.** Verified badge → CSS circle with `✔`; like icon → the character `❤`. Keep reply/retweet glyphs and the X logo as images | A twenty-tweet thread is currently **100 requests to `media.publit.io`** inside somebody's published fic, forever. The WhatsApp author had exactly this break when Cloudinary cut them off, and every fic using their skin lost its images at once. gadaursan's skin needs **no chrome images at all** | KNOWLEDGE §11, §19 |
| 5b | **Separate structure from colour** in the four stylesheets, so `isDark ? x : y` collapses into a small override block rather than being evaluated throughout | Night mode in the canonical skin is **five rules**, because its base defines structure only. Ours bakes one theme, which is why settings-dependence is 24–32%. Worth doing on its own merits, and it makes item 8 cheap instead of a doubling | KNOWLEDGE §18 |
| 5c | **Replace `<a href="#" class="reply-handle">` with a `<span>`** — our only anchor | A link that goes nowhere: screen readers announce it as a link, and clicking scrolls the reader to the top of the page. Separately, AO3's parser has historically had trouble with `<a>` as a sibling of `<div>` and re-runs on every edit | KNOWLEDGE §22 |

## The master skin

Ordered; each depends on the one above. Items 1–3 above should land first.

| # | Task | Where |
| --- | --- | --- |
| 6 | `namespaceCss(css, platform)` + platform class on `.chat` in `buildHTML`, with a PNG-unchanged check | MASTER §6a |
| 7 | `buildMasterWorkSkin(project)` — shared block, four namespaced blocks, a version rule (a comment cannot carry it; AO3 deletes comments) | MASTER §6c, §7 |
| 8 | Light/dark variant classes per platform — cheap once 5b is done | MASTER §6b, KNOWLEDGE §18 |
| 9 | Dedupe the 38 byte-identical shared rules | MASTER §7 |
| 10 | Export UI: "one skin for everything" vs "just this platform" | MASTER §7 |

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
| 18 | Save all four platforms, post a real chapter, check with Creator's Style **on and off**, and download the EPUB | The sanitizer is the only authority. Our lint is a model of it |
| 19 | ✅ **DONE — all four platforms, 7 Aug 2026. Zero drift; full result in the update section below.** | AO3 stores the *cleaned* CSS, so the box is a direct readout of what survived. Anything missing is a rule our lint does not know — file it as a correction in SITE-SKIN §7 |
| 20 | Site skins: save all 16 templates; check the drop cap and divider on single- and multi-chapter works | The site-skin product's own open gate |

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
