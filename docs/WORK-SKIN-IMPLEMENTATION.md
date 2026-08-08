# AO3 Work Skin Export — Implementation & Handoff

**For:** the developer debugging what shipped, or adding a fifth platform.
**Companion doc:** `SITE-SKIN-IMPLEMENTATION.md`. That covers the *other*
product (restyling AO3 itself). This one covers a third export on the
conversation generator. §3 of that document is the shared, verified account of
AO3's CSS sanitizer and is assumed knowledge here — this document only records
what is **different** for work skins.

**Written 6 Aug 2026** against otwarchive `master`; **substantially revised
7 Aug 2026**, when all four platforms were saved on the real archive for the
first time and the stored CSS was read back; **extended 8 Aug 2026** with the
export-dialog copy, the drawn chrome, and three bugs in the *image* export that
no test here could see.

> **If you are new to this file, read five things and skip the rest until you
> need it:** §2 (where it stands), §12 (AO3 injects `<p>`, which is what breaks
> layouts), §13 (comments make AO3 drop rules — the one bug the lint cannot
> see), §14a–14b (html2canvas is not the browser, and the only way to catch it
> is to look at a picture), and §10 (handoff: what to do next, the recipe for
> it in §10b, and the traps that have already cost time).
>
> Sections 5–9 are the historical record of how each platform got here. They are
> accurate and mostly no longer actionable.

---

## 1. What this is

The conversation generator had two exports. It now has three:

| Export | Produces | Goes | Who sees it |
| --- | --- | --- | --- |
| Save Image | A PNG on your device | anywhere | — |
| Copy for AO3 | Renders, uploads to ImgBB, returns one `<img>` tag | inside a chapter | everyone |
| **Work skin** | CSS **and** HTML | CSS → Preferences → Skins → Create Work Skin; HTML → the chapter | everyone |

The work skin is the only one that produces **live text** — selectable,
searchable, and reflowing on a phone instead of forcing a pinch-zoom. It is
also instant: no rendering, no upload.

It is a genuine addition, not a replacement. The image path remains the
reliable default, and it is the only option for platforms whose CSS AO3 will
not accept.

### Why this was cheap

`buildCSS()` and `buildHTML()` already existed to drive the preview and the
html2canvas capture, and their output was already `#workskin`-scoped. What was
missing was never a generator — it was **proof that what they emit is legal**,
which `lintAo3Css(css, 'work')` now provides.

---

## 2. Status

All four platforms ship, and **all four have now been saved on real AO3 and
read back rule by rule.** That changes this document's standing: most of what
follows is verified against the archive rather than against otwarchive source.

| Platform | Work skin | Saved on AO3 | Sized in `em` | Survives `<p>` injection |
| --- | --- | --- | --- | --- |
| **X / Twitter** | ✅ | ✅ verified | ✅ | ✅ measured |
| **Google** | ✅ | ✅ verified | ✅ | ✅ measured |
| **iOS** | ✅ | ✅ verified | ✅ | ✅ measured |
| **Android** | ✅ | ✅ verified | ✅ | ✅ measured |

`supportsWorkSkin(template)` gates the UI and `ExportPanel` reads it directly. A
platform is listed there **only** once its CSS lints clean in both modes: AO3
refuses an entire skin over one bad property, so "mostly legal" and "broken" are
the same outcome.

**What the real saves established** (7 Aug 2026, all four skins reopened in
AO3's editor and diffed against what we emit):

- **The lint is an accurate model of `css_cleaner.rb`.** Zero drift. Every
  construct it permits and the sanitizer might not, survived: `transform`,
  `filter`, `transition`, `box-shadow`, `text-shadow`, `clip:rect(0,0,0,0)`,
  `overflow-wrap`, `word-break`, `letter-spacing`, `z-index`, `float`, `flex`
  and friends, `content:''`, `::before`/`::after`, `:nth-child`, grouped
  selectors, `> *`, `!important`, quoted font names, absolute `url()`, and
  **`display:contents`**.
- **One exception, and it is a big one: comments make AO3 drop rules.** See §13.
  This is the only case we have found of the archive silently discarding legal
  CSS, and the lint cannot see it.

**What changed on 8 Aug 2026** — the export is now something an author can use
unaided, and the *image* export got three bug fixes it badly needed:

- **The export dialog says the three things AO3 does not** (§9f): titles are
  unique across the whole archive, a work can use only one skin, and the images
  are somebody else's server — "Copy for AO3" included.
- **Twitter fetches one chrome image instead of five** (§14). Both badges and
  the whole metric row are drawn.
- **Three PNG bugs, none of which any test here could see** (§14a–14b). One had
  been clipping the tweet name line in *every export this app has ever made*.
- **Site skins are comment-free too** (§13f), closing the §13 exposure for the
  other product.

**Release gate, still open:** the *HTML* half. Nothing has been checked with
Creator's Style off, downloaded as EPUB, or re-parsed by editing a posted work
(§10, "What is still unverified").

---

## 3. Work skins are not site skins

`WorkSkin#clean_css` layers extra refusals on top of everything in
`SITE-SKIN-IMPLEMENTATION.md` §3. All three of these are **legal in a site
skin**, which is exactly why they need their own lint mode rather than being
folded into the shared checks:

| Rule | Error |
| --- | --- |
| Custom properties (`--brand: …`) are banned | `work_skin_custom_properties` |
| `var()` is banned **anywhere**, not just inside `content` | `work_skin_var` |
| `position: fixed` is banned | `work_skin_banned_value_for_property` |

Plus: AO3 **prefixes every selector with `#workskin`** unless it already starts
with it. Our CSS already does, so nothing is rewritten — but do not remove that
prefix on the assumption AO3 adds it, because the two behave differently for
selectors like `body`.

Use `lintAo3Css(css, 'work')`. The default mode is `'site'`.

---

## 4. The HTML sanitizer — a different failure model

This is the part with no equivalent in the site-skin product, and the part
where the failure mode is easy to misread.

> **CSS errors are loud. HTML errors are silent.**
> A single disallowed CSS property makes AO3 refuse the whole skin with a
> visible error. A disallowed HTML element or attribute is simply *removed*,
> with no warning, and the work saves. So HTML problems do not show up as
> rejections — they show up as a fic that renders wrong.

From `Sanitize::Config::ARCHIVE` (`config/initializers/gem-plugin_config/sanitizer_config.rb`):

- **Allowed elements** are a fixed list: `a abbr acronym address b big
  blockquote br caption center cite code col colgroup details figcaption figure
  dd del dfn div dl dt em h1–h6 hr i img ins kbd li ol p pre q rp rt ruby s
  samp small span strike strong sub summary sup table tbody td tfoot th thead
  tr tt u ul var`.
  **Not** `button`, `section`, `article`, `header`, `footer`, `nav`, `time`,
  `input`, `video`.
- **`<svg>` is removed together with its contents** (it is in `remove_contents`
  alongside `script` and `style`).
- **Attributes**: `align title dir` on anything, plus `class` for fields that
  allow CSS (work text is one). `img` also gets `align alt border height src
  width`; `a` gets `href name`.
  **`style` is not on any list** — every inline `style="…"` is stripped.
- **`img src` must be http/https**, and a *relative* path is rewritten against
  `ArchiveConfig.APP_URL` by `RELATIVE_IMAGE_PATH_TRANSFORMER` — so
  `/assets/x.png` silently becomes `archiveofourown.org/assets/x.png` and 404s.
- `a` elements have `rel="nofollow"` added automatically.

### 4a. Readers can switch the skin off

> **Extended by §9a (7 Aug 2026).** This section understates the case: AO3's own
> FAQ says *"downloaded works don't retain their work skin"*, so every EPUB,
> MOBI and PDF is a skin-off rendering with no toggle involved. Twitter now also
> carries hidden connective prose. The three points below still hold.

**AO3 offers "Hide Creator's Style".** When a reader uses it, none of our CSS
applies and only the HTML is left. This is a design constraint, not an edge
case, and every established community work skin is built around it.

What that means in practice, and what we now do:

- **Every `<img>` carries `width` and `height` attributes**, so an avatar is
  40×40 rather than full size when nothing is styling it.
- **The poster's name is `<b class="name">`**, not a styled `<span>` — emphasis
  comes from the markup, not only from a class.
- **Literal whitespace between inline elements.** Flex and inline-block layouts
  do not need it; unstyled text does. Without it you get `You@you` and
  `45.8K⟲189.5K`. Whitespace-only text nodes are ignored between flex items, so
  adding spaces costs nothing with the skin on.

There is a test for each of these in `tests/work-skin.unit.spec.ts`.

---

## 5. What Twitter needed

Four things, all now fixed in the **shared** `buildCSS`/`buildHTML` rather than
post-processed at export. One stylesheet still feeds the preview, the PNG
capture and the work skin — see `SITE-SKIN-IMPLEMENTATION.md` §5 for why that
matters.

1. **`gap` → margins.** AO3 allows a property if it *contains* a shorthand name
   as a substring, so `column-gap` passes and bare `gap` does not. Four
   declarations. This alone made the stylesheet unusable as a work skin.
2. **`<button>` → `<span>`.** `button` is not an allowed element; the tag would
   be stripped and "Follow" left as bare unstyled text mid-line.
3. **Relative asset paths → absolute.** Six chrome icons shipped as
   `/assets/…`; `absolutizeAssets()` rewrites them to `media.publit.io`, which
   `platformAssets.ts` already names the primary host.
4. **No empty `.metrics`.** The container carries padding and a bottom border,
   so emitting it with no counts drew two rules around an empty space. A
   `no-metrics` class also drops the now-orphaned divider under the timestamp.
   *This bug affected the image export too.*

### 5a. Do not use flexbox

> **SETTLED, 7 Aug 2026.** A real AO3 save finally happened and the mechanism is
> now reproduced, not inferred. AO3 wraps our children in `<p>`, which does not
> strip flex — it *moves* it: the injected paragraph becomes the flex item and
> everything we meant to lay out is a grandchild. **`> *` breaks the same way**,
> which matters because it was our standard `gap` substitute. The paragraph
> reset does not fix either. Full account in `BACKLOG.md`, "The flex question,
> settled". The advice below was right; it now has a reason.

> **Partly explained, 7 Aug 2026.** "The cause is not understood" is no longer
> quite true. We now know the sanitizer *keeps* `display: flex` — it is present
> in a 71 KB skin AO3 is serving — so it was never being stripped. The working
> hypothesis is that AO3's `<p>` injection turns a flex container's children
> into paragraphs, which float and inline-block survive and flex does not. See
> §10's "The flex question", and `AO3-WORK-SKIN-KNOWLEDGE.md` §21. The
> conclusion below is unchanged; only the reasoning has improved.

The tweet header was rewritten from flex to `float: left` + `overflow: hidden`,
and the name line from flex to inline-block.

**This was empirical, and the cause was not understood at the time.** The flex version rendered
correctly in this app and in the AO3 simulation of §6, but wrong on the real
archive: the name line right-aligned and the X logo dropped to its own line.
Every established AO3 Twitter work skin — see §15 — uses float and none use
flex. That is accumulated community knowledge about what survives on the
archive, and it is worth more than a local render that says the flex version is
fine.

Flex is kept in exactly one place, `.metrics`, because its failure mode there is
graceful: the chips fall back to inline-block and bunch left, which still reads.
The header could not tolerate that. There is a comment in `generator.ts` saying
so and asking not to convert it back.

---

## 6. How to verify

### The lint gate (fast, no browser)

```bash
npx playwright test --project=unit
```

`tests/work-skin.unit.spec.ts` asserts every shipped platform lints clean in
*both* modes, uses no element AO3 strips, carries image dimensions, reads as
prose unstyled, is `em`-sized to at most three decimals, emits no newline, and
carries exactly one plain-text credit.

### The AO3 simulation (the useful one) — now a committed test

`tests/ao3-injection.spec.ts`. It builds the page a real chapter produces —

```text
#outer.wrapper > #inner.wrapper > #main > .work > #work-skin > #workskin
  > #chapters > .chapter > .userstuff.module > [our HTML]
```

— with `tests/fixtures/ao3-core.css` first (a concatenation of the archive's own
`01-core`, `02-elements`, `05-region-main`, `21-userstuff`, `08-actions`,
`10-types-groups`) and the exported CSS second, then renders **twice**: clean,
and with AO3's `<p>` injection applied through the DOM. It diffs the geometry of
the load-bearing elements.

```bash
npx playwright test --project=desktop tests/ao3-injection.spec.ts
```

It needs a browser because the CSS is legal either way — **the lint cannot see
any of this**. It was a throwaway debugging harness in an earlier version of
this document; promoting it is what turned §12 from a hypothesis into a
measurement.

### The manual gate — and the one technique that beats all of the above

Save on real AO3, then **reopen the skin in AO3's editor and read the stored
CSS**. AO3 keeps the *cleaned* stylesheet, so that box is a direct readout of
what the sanitizer accepted and what it silently threw away.

This is the highest-value two minutes in the project. It closed §8, confirmed
`display:contents`, proved the lint has zero drift, and found §13 — a bug no
test we own could have detected.

---

## 7. What iOS and Android needed — **done, 7 Aug 2026**

> Kept as written because the predictions were accurate and the reasoning is
> still the reasoning. **What each blocker actually became is in §9e**, and the
> one place reality differed from the plan is flagged there: the CSS bubble
> tails needed a new rule after all, not just a branch in `buildHTML`.

12 violations each. In rough order of effort:

| Blocker | Where | Suggested fix |
| --- | --- | --- |
| `animation`, `animation-delay`, `@keyframes` | typing indicator | **Drop the animation.** A static three-dot bubble is honest — the image export never animated either. Note two rules consist of *nothing but* `animation-delay`, so deleting the property leaves empty rule sets, which AO3 errors on. Delete the whole rules. |
| `gap` | group-sender rows | Margins, exactly as Twitter in §5.1 |
| `object-fit` | `.group-avatar` | Fixed dimensions; there is no legal equivalent |
| `pointer-events` | bubble tails (iOS) | Almost certainly deletable |
| `calc(100% - 170px)` in `max-width` | bubble widths | Plain percentages. `calc()` is genuinely absent from `VALUE_REGEX` |
| One relative `url()` in a `background` | Android | Absolute https, or drop it |

### The iOS bubble tails are already solved

`buildHTML` emits an inline `<svg>` for the bubble tail, and **AO3 removes
`<svg>` along with its contents**. But the SVG exists only because html2canvas
cannot rasterise `::after`; the app's own earlier versions drew the tails with
CSS `::after` on `.has-tail` / `.no-tail`, and those classes are still in the
markup.

So: keep the SVG for the image path, omit it for the work skin, and let the CSS
tails do the work. That is a branch in `buildHTML`, not new CSS.

### Suggested order

Android first — it has no SVG to deal with. Then iOS. Each is a day, not a
project, and the lint tells you the moment you are done.

---

## 8. Open question — **settled, 7 Aug 2026**

> This section used to say the float rewrite of §5a was unverified guesswork.
> It is now verified, and the mechanism is understood. Kept because the *method*
> it recommended is the one that cracked it.

**The float rewrite was right, and for a better reason than we had.** A Twitter
skin saved to the real archive renders the avatar floated left with the name
line beside it, body, image, timestamp and metrics all correct. §12 explains
why: AO3 wraps bare inline children in `<p>`, which does not strip `flex` — it
*moves* it, so the injected paragraph becomes the flex item and everything we
meant to lay out is a grandchild. Float and inline-block survive that; flex does
not.

The method this section recommended — *open the saved skin in AO3's own editor,
because AO3 stores the cleaned CSS* — is the single most useful technique in
this document. It has since settled three separate questions and found one bug
nothing else could see (§13). **Reach for it first.**

---

## 9. What the community tutorials changed (7 Aug 2026)

Two of the most-read AO3 work-skin tutorials were read in full, along with
AO3's official FAQs. All four platforms were brought to zero violations in the
same pass. §9a–9c are the findings, §9d–9e what shipped, §9f what did not.

### 9a. The skin is absent more often than §4a assumed — **fixed**

§4a framed skin-off as "a reader pressed Hide Creator's Style". AO3's FAQ states
a larger case twice: *"downloaded works don't retain their work skin, so make
sure your work still makes sense without it."* Every EPUB, MOBI and PDF is a
skin-off rendering, and no toggle is involved.

The community answer is `#workskin .hide { display: none }` plus hidden
connective prose in the markup, so the fic reads as a story rather than as a
transcript. Twitter now does this via the existing `.visually-hidden` class,
which was already defined in all three stylesheets and used in exactly one
place.

**We deliberately diverge on the hiding technique.** The tutorials use
`display: none`, which also hides the text from screen readers. We position it
off-screen instead: identical visually, but the connective prose reaches
assistive technology even while the skin is on.

Before and after, for one tweet with counts:

```text
before   Alex Rivers @alexrivers·Follow okay so I need to tell you all
         something 2:15 PM 156 89 847

after    Alex Rivers (@alexrivers) · Follow
          tweeted: okay so I need to tell you all something
         2:15 PM
          156 replies 89 retweets 847 likes
```

Known rough edge: `· Follow` is chrome that survives into the prose. It cannot
move into a `content:` pseudo-element (see 10c), and stripping it only on the
work-skin path would make the AO3 render disagree with the preview and the PNG.
Left visible on purpose.

### 9b. `em`, not `px`, is how a card fits a phone — **fixed**

AO3 forbids `@media` in skin CSS (media is a field on the skin record), so a
breakpoint is not available. starskin's skin is "scalable so it's also
accessible to mobile users" purely because it is sized in `em`, and AO3's FAQ
pushes the same thing: *"We highly encourage learning about and using em…
will make your layouts much more flexible and responsive to different browser
and font settings, and improve their accessibility to users with differing
needs."*

The Twitter stylesheet was 470 `px` values to 1 `em`. It is now `em` throughout,
each value converted against **its own rule's font-size context** — so at a 16px
base it renders identically and **the PNG export is unchanged**; on AO3, where
`.userstuff` computes to roughly 15px, the card scales to the reader instead of
overhanging. Verified numerically: 93 converted lengths, all within 0.5px of
their originals. Hairline borders and the off-screen offset stay in `px`.

One trap worth keeping: AO3's number grammar is `-?\.?\d{1,3}\.?\d{0,3}`, so
`0.9375em` is read as `0.937` + `5em`. AO3 accepts that; our tokenising lint
does not. **Keep em values to three decimal places.** Pinned by a test.

### 9c. `content:` pseudo-elements are blocked for us

The tutorials' most elegant trick puts timestamps and read receipts in the CSS
(`.ts1::before { content: 'Yesterday' }`) so they vanish when the skin is off.
The tedious part — a numbered class per distinct value — is free for a
generator, so this looked like a place where we beat hand-written skins.

**It does not work here.** html2canvas cannot rasterise `::before`/`::after` —
the same limitation that put an inline `<svg>` in the iOS bubble tails (§7) —
and this stylesheet also drives the PNG. Anything moved into a pseudo-element
disappears from the image export. Viable only for chrome we are content to lose
from the PNG, which timestamps are not.

### 9d. What was taken for iOS and Android

The first two were taken straight from the tutorials and are now shipped; see
§9e for how each landed.

- **The static typing indicator** — three spans at `opacity: .85 / .65 / .4`,
  no `animation`. ✅
- **CSS bubble tails** — `::after` with `border-right: 8px solid <bubble>` plus
  `border-bottom-right-radius: 16px 8px`. ✅
- **Negative margins against `.userstuff`.** ⬜ Every community skin fights AO3's
  paragraph spacing this way (`margin-bottom: -2.8em` is typical). We have not
  needed it yet; expect to on a real work page.

### 9e. iOS and Android, 12 violations each → 0

What §7 predicted, and what each actually became:

| Blocker | Resolution |
| --- | --- |
| `animation`, `animation-delay`, `@keyframes` | Replaced, not dropped. The three dots now sit at descending opacity — `.85 / .65 / .4` — which is the iOS tutorial's own answer and reads as mid-typing while standing still. The two `:nth-child` rules were **rewritten, not deleted**: a rule left empty is an AO3 error. |
| `gap` | Child margins plus a `:last-child` reset, exactly as Twitter in §5.1 |
| `object-fit` | Deleted. No legal equivalent, so a non-square avatar letterboxes inside its 20×20 box rather than cropping |
| `pointer-events` | Deleted from both iOS tail rules — purely defensive |
| `calc()` ×4 | **Two were redundant.** `.ios-header-name` used `calc(100% - 177px)` where 177 is exactly `left(112) + right(65)` — an absolutely positioned box constrained to the width it already had. Android's header name was the same shape. Both dropped outright. The two `dt.sender` rules became flat percentages (60% and 73%) |
| Android's relative `url()` ×2 | `absolutizeCssAssets()` in `workSkin.ts`, mirroring what `absolutizeAssets()` already did for HTML. iOS escaped this only because its defaults were already absolute Publit URLs |

**Where §7 was wrong.** It said the CSS bubble tails were "a branch in
`buildHTML`, not new CSS", on the grounds that older versions had drawn them
with `::after` and the classes were still in the markup. The classes were there;
the rules were not. `buildIOSCSS` now carries a `::after` pair scoped to
`.chat.css-tails`, a class only `buildWorkSkin` adds — otherwise a browser would
draw the SVG tail *and* the CSS tail on top of each other in the preview.

**iOS and Android also got §9a's treatment**, and needed it more than Twitter
did. A bubble carries its speaker entirely in colour and alignment, so with no
CSS the conversation was unattributed lines with the time welded on:

```text
before   hey10:23
         you free tonight?10:24
         Sam                      <- the typing indicator, contextless

after    Sam: hey 10:23
         You: you free tonight? 10:24
         Sam is typing…
```

The speaker is a `<dt class="visually-hidden">` rather than a span: the markup
is already a `<dl>`, so the term/definition pairing is the honest one, `dt` is
on AO3's allowed element list, and an unstyled browser indents the `dd` under it
for free.

### 9f. Two facts the export dialog did not say — **shipped, 7–8 Aug 2026**

- **A work can only use one skin.** An author who already has one must *merge*
  our CSS into it. The iOS tutorial leads with this. Our dialog said "create a
  work skin", which silently breaks those users.
- **Skin titles must be unique across all of AO3**, not per account. AO3
  recommends including your username.

Both now sit in an amber note under step 1 of the work-skin modal, which is
where the author is standing when each one bites: the title is rejected at
submit, and the second skin is worse than rejected — AO3 applies whichever is
selected and the fic silently loses what the old skin was doing.

The title advice is concrete rather than general. It shows an example built from
the current platform (`yourname — WhatsApp`), because "make it unique" does not
tell anyone what to type.

**A third fact went in with them, from KNOWLEDGE §7:** AO3 never keeps a copy of
an image, so a host that stops serving one takes it out of every chapter already
posted. The old footnote made this worse than saying nothing — it offered "Copy
for AO3" as the option where *"nothing outside AO3 loads inside your fic"*, and
that path uploads to ImgBB. One picture instead of many, and just as much
somebody else's server. Both dialogs now say so.

---

## 10. Handoff

Where this stands as of **7 Aug 2026**, and what to pick up.

### The state of things

All four platforms export a work skin AO3 accepts, **and all four have been
saved on the real archive and read back.** The CSS half of the release gate is
closed; the HTML half is not.

| | Status |
| --- | --- |
| Twitter, Google, iOS, Android | ✅ 0 violations, both lint modes |
| Reads as prose with no CSS | ✅ all four |
| Sized in `em` | ✅ all four |
| Survives AO3's `<p>` injection | ✅ all four, measured (§12) |
| Saved on real AO3, stored CSS diffed | ✅ all four, zero drift |
| Exported CSS is comment-free | ✅ both products (§13, §13f) |
| The dialog tells an author what AO3 will not | ✅ (§9f) |
| Chrome images per tweet | ✅ **one** — the X logo (§14) |
| The PNG renders what the browser renders | ✅ all four, exported and read at zoom (§14a–14b) |
| Creator's Style **off** / EPUB download | ❌ **never checked** |
| Re-parse after editing a posted work | ❌ **never checked** |

### The six things worth knowing before you touch anything

1. **Read the stored CSS.** AO3 keeps the *cleaned* CSS, so reopening a saved
   skin in AO3's editor is a direct readout of what the sanitizer kept and
   dropped. It has settled three questions and found one bug nothing else could
   see. It is the highest-value tool in this project and it takes two minutes.
2. **Comments make AO3 drop rules** (§13). The export is comment-free for this
   reason. Do not put them back.
3. **AO3 wraps bare inline children in `<p>`** (§12), which breaks `flex` and
   `> *` — not by stripping them, but by making the paragraph the child. Use
   float, inline-block, absolute positioning, descendant selectors, or
   `p{display:contents}`. The paragraph reset does *not* save you here.
4. **The lint is a good model but it is not the archive.** It was re-verified
   against `master` with zero drift, and it still could not see §13. When a
   render is wrong and the lint is clean, go and read the stored CSS.
5. **One stylesheet drives the preview, the PNG and the work skin.** Change CSS
   in `generator.ts`, never at the export boundary. `SITE-SKIN-IMPLEMENTATION.md`
   §5 explains what two renderings that can disagree cost the other product.
   The exception, and it is narrow: `renderChunk`'s html2canvas fix blocks
   compensate for the **rasteriser**, not for the design. Everything in them is
   there because html2canvas disagrees with the browser, and each one says so.
6. **Render it and look at it** (§14a–14b, added 8 Aug 2026). Three bugs in one
   session were invisible to the lint, to the injection harness and to 169
   passing unit tests, and two of them reached the author before they reached
   us. The unit suite proves the CSS is *legal*; only a picture proves it is
   *right*. Export a PNG, and diff it against one from before your change.

### The traps that have already cost time

- **A half-styled render usually means a stale saved skin**, not a sanitizer
  bug. This cost an hour: a plausible silent-truncation mechanism was inferred
  from symptoms and written up, and the account simply had an older skin saved.
  Check the saved skin is current *before* theorising.
- **Do not promote a hypothesis to a finding.** Both times a mechanism was
  inferred from symptoms this week it was wrong. Both times, reading the stored
  CSS settled it in minutes. §13d is deliberately left labelled unproven.
- **Strip comments before pattern-matching CSS.** Use `stripCssComments` from
  `ao3Css.ts`; it exists because forgetting produced four wrong answers, every
  one of them making us *stricter than AO3*.
- **`em` values must have at most three decimals.** AO3's number grammar is
  `-?\.?\d{1,3}\.?\d{0,3}`, so `0.9375em` parses as `0.937` then `5em` and the
  declaration is discarded.
- **Convert `px` against the rule's own font-size context**, not a global base —
  and measure that context in a browser rather than reasoning about the cascade.
  `tests/_ctx`-style harnesses are cheap; a third of rules matched no element on
  the first pass and would have been guesses.
- **Never put a backtick in `generator.ts`'s CSS.** The stylesheets are template
  literals, so a backtick inside a CSS comment ends the string and the build
  fails with a parse error pointing at the comment. Cost two builds on
  8 Aug 2026. Write `content:''`, not the same thing in backticks.
- **Do not reach for `git stash --keep-index` to split a commit.** It stashes
  everything and leaves the index, so the next `--amend` silently swallows the
  staged files. Stage by path and commit; the recovery is `reset --soft` plus
  `git checkout stash@{0} -- <paths>`, but do not need it.

### How to verify a change

```bash
npx playwright test --project=unit                              # ~15s, no browser
npx playwright test --project=desktop tests/ao3-injection.spec.ts # <p> injection
npm run build
```

The unit project asserts every platform lints clean in both modes, emits no
banned property, reads as prose unstyled, is `em`-sized to three decimals,
fetches no chrome image beyond the X logo, and carries exactly one plain-text
credit. The injection project needs a browser because that failure is geometric
and **the lint cannot see it**.

The browser projects point at the deployed site by default, so for local work:

```bash
npx next dev -p 3000
UX_BASE_URL=http://localhost:3000 npx playwright test --project=desktop tests/work-skin.spec.ts
```

**Then export a PNG and look at it** (§14a–14b). Nothing above can see a
rasteriser bug, and three shipped ones were found this way in a single session.
The loop that found them, worth rebuilding in the scratchpad rather than
committing:

1. Drive the real **Save Image** button with Playwright and catch the download —
   the export path has fixes the preview does not, so a preview screenshot
   proves nothing about the PNG.
2. `git stash` your change, export again, and keep that as the baseline.
3. Diff the two by loading both into a canvas and counting differing pixels,
   then crop the differing region at 6× to judge it. **A few dozen differing
   pixels on an edge is antialiasing; a horizontal slice through text is a
   clipping bug.**
4. Do it for the states no default fixture shows: group chat, threaded replies,
   typing, read receipts, long names that ellipsise.

Then the part no test can do: **save it on AO3 and read the CSS back.**

### 10a. Retrofit audit — closed

Measured on 7 Aug 2026 by compiling every platform and counting. Each row was a
thing built before we had read a single published work skin. **Seven of the
eight are now done**, which is most of what this document's earlier handoff was
about.

| Finding | Status |
| --- | --- |
| No paragraph reset anywhere | ✅ all four — but see §12, it is necessary and **not** sufficient |
| Google has no skin-off support | ✅ hidden labels on query, tabs, stats and each result |
| Wrong hidden-text recipe (`left:-9999px`) | ✅ `clip:rect(0,0,0,0)`, confirmed intact on the archive |
| `px` on three platforms | ✅ all four in `em`, 381 lengths, verified within 0.3px |
| Google's HTML is 9 lines | ✅ one line, with a test that no platform emits `
` |
| Colour is baked, not layered | ⬜ BACKLOG 5b — 24–32% of rules settings-dependent |
| Five CDN images per tweet | ✅ **one** — the X logo. §14 |
| One dead anchor `<a href="#">` | ⬜ BACKLOG 5c |

**What the audit cleared.** Not everything needed revisiting:

- The **PNG export** is unaffected by any of it. The `em` conversion was
  verified element-by-element at a 16px base, and the hidden spans are
  absolutely positioned so they add nothing to the styled layout.
- The **lint** is sound, and is now confirmed against the archive rather than
  against source (§2).

One correction to this audit's own conclusions: it said the **site-skin
product** was "essentially unaffected". That was right about `flex` and `@media`
and wrong about comments — see §13f.

### The constraints that are easy to forget

- **AO3 refuses the entire skin over one bad property.** "Mostly legal" and
  "broken" are identical outcomes. The lint is the gate, not a suggestion.
- **A half-styled render usually means a stale saved skin, not a sanitizer bug.**
  Learned the hard way on 7 Aug 2026. An iOS work rendered with inline
  timestamps, visible bold `<dt>` speaker labels and an unstyled `Read`, which
  looked exactly like AO3 having dropped every rule below a certain point — and
  a plausible mechanism was constructed for it. **It was wrong.** The author was
  testing against a skin saved in their AO3 account from an earlier export, so
  the new HTML was being styled by old CSS. Reading the stored CSS settled it in
  seconds. *Check that the saved skin is current before theorising about the
  sanitizer* — and note this is a permanent hazard of the product, because a
  work skin lives in the reader's account, not in our export.
- **html2canvas cannot rasterise `::before`/`::after`.** Anything you move into
  a pseudo-element vanishes from the PNG. This is why the iOS tails are an
  inline `<svg>`, and why §9c's otherwise-elegant `content:` trick is unusable.
- **html2canvas cannot centre a glyph inside a small box either** (found
  8 Aug 2026, §14a). Ordinary inline text rasterises perfectly; a character
  centred in an 18px circle is drawn *below* the circle. The verified tick came
  out as an empty blue disc — white on white, invisible, and the work skin was
  clean, so no test we own could see it. **Line-height centring and padding
  centring fail identically, so it is not a value to tune.** Either keep the
  glyph as plain inline text, or let the image path swap an image back in.
- **The skin is absent more often than you think.** Every download is a
  skin-off rendering (§9a). Test with the CSS thrown away, not just with it on.
- **AO3 rewrites your HTML, and re-runs the parser on every edit** — a new
  chapter, an author's-note tweak, a tag change. Markup that posted correctly
  can break months later without anyone touching it. Defend in CSS (the
  paragraph reset) rather than relying on our output being perfect, because
  injection also depends on how the *user* pastes.
- **Strip comments before you pattern-match CSS.** This has produced four wrong
  answers so far, including a lint that refused any stylesheet whose comment
  mentioned `@media`. `BACKLOG 3` extracts a shared helper.

### What to pick up next

**Ranked in `BACKLOG.md`** — one list, each item pointing back at the doc that
holds the reasoning. Do not maintain a second copy here; this section used to be
one and drifted out of date within a day.

The order that matters now that the live bugs are cleared:

1. ✅ **done, 7–8 Aug 2026 — BACKLOG 5 + 2d, the export dialog.** All three facts
   an author meets on their first paste are now said: a work can use **only one
   skin** (§9f), titles are unique **across all of AO3** (§9f), and the images
   are somebody else's server, "Copy for AO3" included (§9f). 2d rode along —
   the site skin's instruction was already in its dialog, so `compile()` now
   emits no comments (§13f). *This was the last thing standing between the
   current state and an author using this unaided.*
2. ✅ **done, 8 Aug 2026 — BACKLOG 5a, five chrome images down to one** (§14).
   Both badges and the whole metric row are drawn now; only the X logo is
   fetched. It also turned up two PNG bugs nothing we own could see, including
   a name line that has been sliced in half in every export this app has ever
   produced (§14a).
3. **BACKLOG 5b — separate structure from colour.** ⬅ **START HERE.** The
   recipe is below; it was scoped on 8 Aug 2026 but deliberately not started,
   because it is one large mechanical edit and half-doing it is worse than not
   starting.
4. **Then the master skin** (BACKLOG 6–10).

### 10b. The recipe for 5b, scoped but not started (8 Aug 2026)

**It is in better shape than the backlog implies.** Colour is *already* hoisted
into named consts at the top of each builder — `buildIOSCSS` lines ~879–896,
`buildAndroidCSS` ~1048–1065, `buildTwitterCSS` ~1153–1160. What is left:

1. **Hoist the strays.** Four inline `${isDark ? … : …}` remain in `buildIOSCSS`
   (`dt.sender`, `dd.status-indicator`, `.typing-bubble .dot`, `.typing-label`)
   and four in `getTextFormattingCSS`. After this, **no rule body mentions
   `isDark`** — grep is the check.
2. **Make each builder's block a palette with two variants**, rather than twenty
   ternaries: `TWITTER_COLOURS = { light: {…}, dark: {…} }` and one
   `const c = TWITTER_COLOURS[isDark ? 'dark' : 'light']`. This is the step that
   pays: with *both* palettes reachable, a dark override block is derivable
   instead of hand-written, which is what makes BACKLOG 8 five rules per
   platform rather than a doubled stylesheet (KNOWLEDGE §18).
3. **Watch the settings-driven slots.** A few entries are not theme colours at
   all — iOS `receiverBubbleBg`/`typingBubbleBg` and Android
   `senderBubbleBg`/`receiverBubbleBg` fall back to the user's own bubble colour
   in light mode and are overridden by fixed values in dark. They cannot live in
   a static table; take them as arguments and document why at the call site.
4. Google has no dark mode. Leave `buildGoogleCSS` alone.

**The invariant that makes this safe: the compiled CSS must come out
byte-identical**, for all four platforms in *both* modes, before and after. Snapshot
`buildCSS()` for the eight combinations into a scratchpad file first, refactor,
then compare. This is pure hygiene — if a single byte moves, you changed a colour
by accident. Do not commit the snapshot; it is a refactor guard, not a test the
repo wants to carry.

Only once that lands is BACKLOG 8 worth attempting.

### The flex question — **settled, 7 Aug 2026**

§5a rewrote the Twitter header from flex to float on purely empirical grounds
and admitted it could not say why. §12 is the answer, reproduced in a harness:

- **The sanitizer keeps `display:flex`.** The widely-repeated claim that AO3's
  validator strips it is wrong, and our lint is right to permit it. It is
  present in a 71 KB skin AO3 is serving, and in our own stored CSS.
- **AO3 wraps bare inline children in `<p>`.** The paragraph becomes the flex
  item and everything we meant to lay out is a grandchild. Float, inline-block
  and absolute positioning survive that; flex does not.
- **The paragraph reset does not fix it.** It was ranked top of the backlog
  partly because it might; it does not. Zeroing a paragraph's margins stops it
  adding space, not being a box in between.

So three practitioners who abandoned flex were right, for a reason none of them
wrote down. Flex is kept where its failure is graceful (`.metrics`) and where a
`p{display:contents}` rule neutralises the wrapper.

### What is still unverified

The CSS half of the release gate is **closed**: all four skins saved on a real
account, stored CSS read back and diffed, zero drift (§2), with §13 found and
fixed in the process.

The HTML half is untouched. None of this needs code — it needs somebody with an
AO3 account and twenty minutes:

- **Creator's Style off.** Every claim in §4a and §9a about the export reading
  as prose is verified by unit test against our own HTML, and never against a
  real render.
- **Download the EPUB.** AO3's FAQ says downloads do not retain work skins, so
  this is the skin-off path most readers actually hit.
- **Edit a posted work and check it still renders** (BACKLOG 17a). AO3 re-runs
  its HTML parser on every edit — a new chapter, an author's-note tweak, a tag
  change — and the parser itself changes over time. Markup that posted correctly
  can break months later with nobody touching it.
- **Post multi-chapter**, since the injection rule in §12a was read off a
  single-chapter work.
- **Site skins** (BACKLOG 20): all 16 templates, plus §13f.

### Deployment

Netlify, building from `main` on push (`netlify.toml`, `@netlify/plugin-nextjs`).
There is no separate deploy step and no staging environment: **a push to `main`
is a production release.** Run `npm run build` and the unit project before
pushing.

---

## 12. Paragraph injection: the rule, and what it broke (7 Aug 2026)

AO3 rewrites the HTML you paste. This section is the **measured** account of how,
replacing the guesswork in §5a and MASTER §5. It was obtained by posting two
works, fetching them back, and diffing the stored markup against what we emit.

### 12a. The rule

> **Inside a `<div>`, each contiguous run of inline content — text, `<span>`,
> `<img>`, `<b>` — is wrapped in a single `<p>`. Block children (`div`, `dl`)
> are left completely alone. The interior of `<dd>` and `<dt>` is untouched.**

No `<br>` wrapping was observed anywhere, which the older docs had assumed.

From `works/75270521`:

```html
<div class="tweet-header">
  <p><img class="avatar"></p>              <!-- lone img wrapped -->
  <div class="head">...                    <!-- div untouched -->
<div class="metrics">
  <p><span/><span/><span/></p>             <!-- three chips, ONE paragraph -->
```

**"One run, one paragraph" is what does the damage.** A flex row of inline
children does not become several flex items wrapped in paragraphs — it becomes
*one* flex item. So `justify-content` has nothing to distribute, and `> *`
matches the paragraph instead of the elements inside it.

The paragraph reset does not help with any of this. It stops an injected
paragraph adding **space**; it cannot stop it being a **box in between**.

### 12b. Two fixes, and which applies when

| Symptom | Fix | Why |
| --- | --- | --- |
| A flex row collapses to one item | `display:contents` on the injected `<p>` | Removes the wrapper from the layout tree, so our elements are flex items again. We never emit a `<p>` in these containers, so the rule matches nothing in the preview and **the PNG is unchanged** |
| `> *` margins land on the wrapper | Name the elements with descendant selectors | A child combinator selects on DOM structure, which `display:contents` does not change. Match the *same element set* the combinator did — element-type selectors are wider and will quietly restyle nested children |

Both were needed in `.quote-head`, which is a flex row *and* used `> *`.

### 12c. What was actually broken

| Platform | Broken | Consequence |
| --- | --- | --- |
| iOS, Android | **Typing indicator rendered 0x0** | A `.dot` is a `<span>`, and width/height do not apply to an inline box. It only ever worked because `display:flex` blockified the dots into flex items. Injection stopped them being flex items and **the indicator vanished silently** |
| iOS | Status bar collapsed | Grew 32px→50px, the time lost its `flex:1` (312px→25px), the battery jumped from the right edge to the left and wrapped to a second line — pushing every message row below it down 18px |
| Twitter | Name line jammed | `.name-line > *` put the gap on the wrapper, so a real save read `Jamie Chen @jamiechen·Follow` with nothing between the parts |
| Twitter | Metrics bunched left | The three counts became one flex item. §5a had accepted this as graceful degradation; `display:contents` fixes it properly and costs the PNG nothing |

**Confirmed safe**, and worth knowing so nobody "hardens" them: `.row > *`,
`dl.msg > *` and `.group-sender-row > *`. Their children are block elements or
live inside a `<dd>`, both of which AO3 leaves alone. The stored HTML proves it.

The typing fix is the one to be careful with. Moving the dots to `inline-block`
makes the size stick, but inline-block boxes sit on a text baseline, and the
line box that creates made the bubble 43px tall instead of 28. `line-height:0`
on the bubble restores it. There is a test pinning `60x28` with `8x8` dots,
because this stylesheet also drives every PNG anyone exports.

### 12d. Why the float rewrite was right

§5a rewrote the tweet header from flex to `float:left` + `overflow:hidden` on
empirical grounds, and admitted it could not explain why. Now it can:

AO3 wraps the avatar in a `<p>`. The float escapes that paragraph, and
`.head{overflow:hidden}` establishes a block formatting context, which sits
*beside* a float by definition. Flex had no such escape hatch. The community was
right, and for a reason nobody had written down.

### 12e. The harness

`tests/ao3-injection.spec.ts` renders each platform inside AO3's own stylesheet
and nesting, twice — clean, and with the rule in 12a applied through the DOM —
and diffs the geometry of the load-bearing elements. It needs a browser because
the CSS is legal either way; **the lint cannot see any of this**.

```bash
npx playwright test --project=desktop tests/ao3-injection.spec.ts
```

Optional chrome is switched on deliberately: the status bar, input bar and quote
tweet are all flex rows of inline children, and all were unmeasured until the
harness turned them on. Remote images are blocked so an image finishing between
the two measurements cannot be misread as injection damage.

**`display:contents` is confirmed legal.** It was the one unverified part of
12b when it shipped — the lint accepts it and the fallback would have been
graceful, but that is not the same as knowing. A Twitter skin with all three
`p{display:contents}` rules was saved on the archive and read back on
7 Aug 2026 with every one of them intact, alongside the narrowed grouped
selectors. Zero drift, 79 of 79 rules.

---

## 13. Comments make AO3 drop rules (7 Aug 2026)

**The only case we have found of the archive silently discarding legal CSS, and
the lint cannot see it.** If you read one section of this document, read this
one — it is the most expensive thing to rediscover.

### 13a. What happened

A saved iOS work skin was read back out of AO3's editor and was missing **eleven
consecutive rules**:

```text
dd.bubble.in.has-tail .bubble-tail-in        kept
  .chat.css-tails …out….has-tail::after      GONE
  .chat.css-tails …in….has-tail::after       GONE
  dd.bubble.out .time                        GONE
  dd.bubble.in .time                         GONE
  dd.bubble.image-bubble .time.image-time    GONE
  dd.bubble .reaction                        GONE
  dd.status-indicator                        GONE
  dd.attach / img.attach-img                 GONE
  .row.typing / .row.typing > *              GONE
.typing-bubble                               kept
```

88 rules sent, 77 stored. Everything before and after survived. The work saved
without error, and the render simply looked wrong — timestamps inline, no
bubble tails — which is indistinguishable from a CSS mistake of our own.

### 13b. How it was settled

Three saves of the same skin:

| Save | Comments in the export | Rules stored |
| --- | --- | --- |
| 1 | yes | 77 of 88 |
| 2 | yes | 77 of 88 — reproduced, so not a paste accident |
| 3 | **no** | **88 of 88** |

Nothing else changed between save 2 and save 3.

### 13c. What it is not

Ruled out before concluding anything, because the obvious answers were all
wrong:

- The lint passes in both modes, zero violations.
- **Every numeric token satisfies AO3's own grammar** `-?\.?\d{1,3}\.?\d{0,3}`,
  checked programmatically across all four stylesheets.
- **Every double quote in the file is inside a comment, and all are paired**, so
  an unterminated string is not the mechanism.
- Android kept the analogous rules, so it is not those selectors being illegal.

### 13d. The trigger, recorded honestly as unproven

The drop began immediately after the only comment in the file that contained a
CSS declaration — a note mentioning `content:""` — and ran to the next comment.
A parser that partly reads comment bodies as CSS would behave exactly like this.

**That is suggestive and it is not evidence, and the distinction matters here.**
Earlier the same day a different mechanism was inferred from symptoms for a
different broken render, written up convincingly, and was simply wrong — the
account had an old skin saved. Cheap to test if it ever matters. It does not,
because the fix is to send no comments at all.

### 13e. The fix

`stripExportComments` in `workSkin.ts`. **AO3 deletes every comment on save**, so
they reach nobody: not the reader, not the author reopening the skin. They exist
for whoever reads `generator.ts`, and that copy is untouched — the preview and
the PNG still carry every word.

Do not "restore" comments to the export without re-saving on real AO3 and
diffing the stored CSS rule by rule.

### 13f. The site-skin product had the same exposure — **closed, 7–8 Aug 2026**

`compile.ts` used to emit a comment per annotated rule plus three header
comments, and **that was never checked on AO3** (BACKLOG 20). The risk was lower
— none of its five comments contained a `property: value` pair — but the class
was identical.

It was deliberately *not* stripped blind, because one of those comments was
load-bearing UI copy: *"leave the skin type on add on to archive skin"* is only
ever seen in the paste box, since AO3 deletes it on save. Removing it would have
traded a possible bug for a certain one.

**The precondition turned out to be met already.** `ExportSkinDialog`'s numbered
steps have carried both that instruction and *"Preferences → Skins → Create Site
Skin"* since it shipped, and `tests/site-skin.spec.ts` pins them there — so the
comments were duplicating guidance the user was already being given somewhere
they would actually read it. The header comments and the `note` field on `Rule`
are gone; the two notes worth keeping are ordinary source comments now.

`compile()` therefore emits **no comments at all**, pinned by *"the export
carries no comments at all"* in `site-skin.unit.spec.ts`. The same rule as the
work skin applies: do not put them back without saving on real AO3 and diffing
the stored CSS rule by rule.

**Nothing is unmeasured any more.** Group chat was the last case, and it is the
one the rule *predicts* is safe: `.group-sender-row` is a flex row of inline
children — an avatar beside a name — which is exactly the shape that collapsed
the status bar and the metrics row, yet it is untouched because it sits inside a
`<dd>`. Confirmed rather than assumed, on both iOS and Android. The
expanded-tweet view and threaded replies are covered too — `.tweet.expanded` is the awkward case, being a flex
row whose first child is a bare `<img>` while still using a child combinator for
its gap, so it carries both failure shapes at once. Its test asserts the fixture
actually produced an expanded and a reply tweet, because a geometry diff passes
trivially when there is nothing on the page to move.

---

## 14. Twitter's chrome is drawn, not fetched (8 Aug 2026)

A tweet used to pull **five images from `media.publit.io`** — verified badge, X
logo, reply, retweet, like. A twenty-tweet thread was a hundred requests from
inside somebody's published fic, **forever**, and that is a failure with a body
count: the WhatsApp skin author outgrew a free Cloudinary tier and every image
in every fic using their skin broke at once, with readers told to relink
(KNOWLEDGE §7, §19).

**It is one image now: the X logo**, which stays an image because it is a
trademark we should not be drawing ourselves. Views and bookmarks are also
still images — opt-in extras rather than part of a standard tweet, and neither
has a character that reads right.

| Was | Is |
| --- | --- |
| `twitter-verifiedBadge.png` ×2 (tweet, quote) | `✔` centred in a CSS circle |
| `twitter-replyIcon.png` | `↩` |
| `twitter-retweetIcon.png` | `⇄` |
| `twitter-likeIcon.png` | `♡` |

The metric row is **grey outline glyphs, not the blue discs it replaced** —
closer to the real site, and the author's call when offered the choice between
matching our existing icons and matching Twitter. Three bonuses fell out of it:
the hover tints now reach the icon, dark mode needs no second set of files, and
a reader who blocks images still sees the row.

### 14a. Two PNG bugs, both invisible to every test we own

Neither is an AO3 problem. Both are html2canvas, and both were found by
exporting a real PNG and comparing it against a stashed baseline.

**1. html2canvas cannot centre a glyph inside a small box.** The tick was drawn
*below* its blue circle — white on a white card, so the badge rasterised as an
empty blue disc. The heart came out clipped at the bottom edge. **Line-height
centring and padding centring fail identically**, so it is not a value to tune.
Two fixes, and which one applies depends on the shape:

- **Plain inline text rasterises perfectly.** This is why the metric glyphs
  carry no box at all — no width, no height, no line-height centring. It is a
  deliberate constraint on that rule, not a style choice.
- **A glyph that genuinely needs a box gets an image back, in the raster only.**
  `renderChunk` swaps both verified badges for the PNG before capture. The
  trade is sound: the reason to drop a chrome image is that a *reader* fetches
  it on every visit, forever, and a PNG is rendered once on the author's own
  machine. Same trade `useCssBubbleTails` makes in the other direction.

The one cost, recorded honestly: the badge is a **plain circle** on AO3 and a
**starburst** in the PNG, because the starburst cannot be drawn without an
image. Both read as "verified"; a CSS starburst is possible (`transform` is
legal, and pseudo-elements are safe here since the raster never sees this rule)
and is the obvious refinement if it ever matters.

**2. The tweet name line was being cut in half in every PNG this app has ever
exported.** Reported by the author, reproduced on a pre-change baseline, so it
long predates this work. `.head` is one line box tall and `overflow:hidden`, and
html2canvas draws text a few pixels lower than the browser — so the bottoms of
"Taylor Swift", the handle and "Follow" were sliced off. It read as a font
problem and was a clipping problem.

Fixed in the export clone with `.head{overflow:visible}`, and **only** there:
that `overflow:hidden` is the block formatting context sitting beside the avatar
float, which is exactly why the float layout survives AO3's paragraph injection
(§12d). It is redundant in the clone because `.name-line` is forced to
`display:flex`, and a flex container is already a BFC. **Do not remove the outer
`.tweet-header{overflow:hidden}`** — that one contains the float, and dropping
it lets the avatar overlap the body text. That was the first attempt.

**Google had the same bug in one place**, also reported by the author: the
search query lost its descenders. `.search-text` is `overflow:hidden` so
`text-overflow:ellipsis` can truncate a long query, and overflow clips
vertically too. Fixed with `padding-bottom` rather than `overflow:visible`,
because the ellipsis has to keep working — overflow clips at the padding edge,
so the descenders get room and nothing else changes. iOS and Android were
checked and are clean.

**The lesson worth keeping: export a real PNG and diff it against a baseline.**
The lint cannot see any of this, the injection harness cannot see it, and the
unit suite passed 170 green through both bugs.

### 14b. The audit that followed, and the third bug

Both reports came from the author looking at exports, so every template was
then exported and read at zoom — including the states no default fixture shows:
group chat, threaded replies, typing, read receipts. Twitter and Google were the
two clipping bugs above. Android, group chat and iOS bubbles are clean.

**iOS turned up something that was not a rasteriser problem at all.**
`isTyping` is a per-message flag; it has been in the schema from the start and
the editor has always honoured it. `buildHTML` never did. So the shipped
example named **"iOS Typing Indicators"** — the one whose entire purpose is to
demonstrate the feature — exported a bubble containing the literal text `...`,
in the PNG and on AO3 alike, while the stylesheet's full indicator (three
descending-opacity dots, §9d) went unused.

On AO3 it was worse than ugly. The dots are CSS shapes, so with the skin off
the indicator is *nothing at all* — the hidden `Riley is typing…` line is the
whole skin-off story for that element (§9a), and it was never emitted.

Fixed by making `msgHTML` return the indicator for a typing message, reusing
`typingRowHTML` — **one copy of that markup**, shared with the chat-level
`chatShowTyping` setting, so the geometry pinned in §12c and the injection
rules apply to both without a second set of anything. Pinned by *"a message
flagged as typing renders the indicator, not three dots of text"*.

Three bugs in one session, all found by looking at pictures, none visible to
169 passing tests. **Render the thing and look at it.**

---

## 15. Sources

Community work skins read while building this — the source of §4a and §5a:

> **Citation corrected, 7 Aug 2026.** This list previously credited
> "Repository: Twitter (Workskin)" at `works/74457591`. The title was roughly
> right and the work id was not: the real one is
> [Repository: Twitter](https://archiveofourown.org/works/22517134/chapters/53973601)
> by gadaursan, now read in full and recorded in `AO3-WORK-SKIN-KNOWLEDGE.md`
> Part 2. `works/74457591` is
> **"Mha Site Skins" by Mylover** — a *site* skin, cited correctly in the
> companion document. The claims in §4a and §5a were right; the evidence
> pointer was not. The real sources are below, and both were re-read in full.

- [Twitter Work Skin: Tweets & Profile (newest layout)](https://archiveofourown.org/works/26754208/chapters/65268931)
  (d33rmilk / starskin) — `float: left` + `overflow: hidden` for the avatar
  split, and the `em` sizing that its summary calls "scalable so it's also
  accessible to mobile users"
- [How to Make iOS Text Messages on AO3](https://archiveofourown.org/works/6434845/chapters/14729722)
  (CodenameCarrot, La_Temperanza) — the `.hide` pattern, `<br><br>` for
  skin-off spacing, CSS bubble tails, `content:` pseudo-element timestamps,
  and the static opacity-staggered typing indicator
- The app's own earlier iMessage output, which used `media.publit.io` absolute
  URLs and CSS bubble tails, and third-party hosts (`i.imgur.com`) for reader
  images

AO3's own documentation, read 7 Aug 2026:

- [Tutorial: Creating a Work Skin FAQ](https://archiveofourown.org/faq/tutorial-creating-a-work-skin) — **a work can only use one skin**; skin titles must be unique across all users; unsupported code is removed on save; `#workskin` is added automatically if you forget it
- [Skins and Archive Interface FAQ](https://archiveofourown.org/faq/skins-and-archive-interface) — "downloaded works don't retain their work skin"; readers can disable custom work skins in Preferences; the `em` recommendation quoted in §10
- [A Step-by-Step Guide to Work Skins](https://archiveofourown.org/admin_posts/1370)

Our own saves on the real archive, 7 Aug 2026 — the primary evidence for §2,
§8, §12 and §13, and the reason most of this document is no longer a model:

- Four work skins saved on a real account and reopened in AO3's editor, and the
  stored (cleaned) CSS diffed rule by rule against what we emit. Twitter, Google,
  iOS and Android; iOS saved three times, which is what isolated §13.
- Two posted works read back as raw HTML, which gave the injection rule in §12a
  directly rather than inferring it from symptoms.

otwarchive `master`:

- [`app/models/work_skin.rb`](https://github.com/otwcode/otwarchive/blob/master/app/models/work_skin.rb) — the three extra refusals and the `#workskin` prefix
- [`config/initializers/gem-plugin_config/sanitizer_config.rb`](https://github.com/otwcode/otwarchive/blob/master/config/initializers/gem-plugin_config/sanitizer_config.rb) — allowed elements, attributes, `remove_contents`
- [`lib/html_cleaner.rb`](https://github.com/otwcode/otwarchive/blob/master/lib/html_cleaner.rb) — which config applies to which field, and the transformers
- [`lib/css_cleaner.rb`](https://github.com/otwcode/otwarchive/blob/master/lib/css_cleaner.rb) — shared with site skins; see the companion doc
