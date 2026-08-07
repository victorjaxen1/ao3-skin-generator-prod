# AO3 Work Skin Export — Implementation & Handoff

**For:** the developer debugging what shipped, or adding a fifth platform.
**Companion doc:** `SITE-SKIN-IMPLEMENTATION.md`. That covers the *other*
product (restyling AO3 itself). This one covers a third export on the
conversation generator. §3 of that document is the shared, verified account of
AO3's CSS sanitizer and is assumed knowledge here — this document only records
what is **different** for work skins.

**Written 6 Aug 2026**, against otwarchive `master`.

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

| Platform | Work skin | Why |
| --- | --- | --- |
| **X / Twitter** | ✅ shipped | 0 violations after the fixes in §5 |
| **Google** | ✅ shipped | 0 violations with no changes at all — its CSS was always legal |
| **iOS** | ✅ shipped 7 Aug 2026 | was 12 violations; see §9e |
| **Android** | ✅ shipped 7 Aug 2026 | was 12 violations; see §9e |

`supportsWorkSkin(template)` gates the UI, and `ExportPanel` reads it directly —
so iOS and Android picked the export up with no UI change. A platform is listed
there **only** once its CSS lints clean in both modes: AO3 refuses an entire
skin over one bad property, so "mostly legal" and "broken" are the same thing.

**Release gate, still open:** none of this has been saved on real AO3 by the
author of this document. See §8 — there is one specific unresolved rendering
discrepancy.

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

The tweet header was rewritten from flex to `float: left` + `overflow: hidden`,
and the name line from flex to inline-block.

**This is empirical and the cause is not understood.** The flex version rendered
correctly in this app and in the AO3 simulation of §6, but wrong on the real
archive: the name line right-aligned and the X logo dropped to its own line.
Every established AO3 Twitter work skin — see §11 — uses float and none use
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
*both* modes, that the HTML uses no stripped element, that images carry
dimensions, and — deliberately — that **iOS and Android still fail**. If that
last test starts failing because someone cleaned a platform up, that platform
is ready: add it to `SUPPORTED` rather than deleting the assertion.

### The AO3 simulation (the useful one)

`tests/fixtures/ao3-core.css` is a concatenation of the archive's own
stylesheets (`01-core`, `02-elements`, `05-region-main`, `21-userstuff`,
`08-actions`, `10-types-groups`). Build a page that nests the export the way a
real chapter does —

```text
#outer.wrapper > #inner.wrapper > #main > .work > #work-skin > #workskin
  > #chapters > .chapter > .userstuff.module > [our HTML]
```

— with `ao3-core.css` first and the exported CSS second, and screenshot it.
Render it **twice**: once with the skin and once without, for §4a.

This is how the empty-metrics bug and the Creator's-Style problems were found.
It is not currently a committed test because it asserts nothing automatically;
it is a debugging harness. Promoting it to a visual-regression test would be a
good improvement.

### The manual gate

Save on real AO3. The sanitizer is the only authority, and §8 exists because
the simulation and the archive have already disagreed once.

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

## 8. Open question

**The float rewrite of §5a is unverified against real AO3.** It was made in
response to a screenshot of a broken render that could not be reproduced
locally, so there is no local test that distinguishes the broken version from
the fixed one.

If it is still wrong, the fastest way to settle it is to open the saved work
skin in AO3's own editor: **AO3 stores the cleaned CSS**, so what is in that box
is a direct readout of what the sanitizer kept and dropped. That removes all
the guesswork this section is currently standing in for.

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

### 9f. Two facts the export dialog does not yet say — **the next job**

- **A work can only use one skin.** An author who already has one must *merge*
  our CSS into it. The iOS tutorial leads with this. Our dialog says "create a
  work skin", which silently breaks those users.
- **Skin titles must be unique across all of AO3**, not per account. AO3
  recommends including your username.

Neither is implemented — they are UI copy, not compiler work.

---

## 10. Handoff

Where this stands as of **7 Aug 2026**, and what to pick up.

### The state of things

All four platforms export a work skin AO3 accepts. The compiler work is
essentially finished; what remains is verification and copy.

| | Status |
| --- | --- |
| Twitter, Google, iOS, Android | ✅ 0 violations, both lint modes |
| Reads as prose with no CSS | ✅ all four |
| Sized in `em` | ✅ Twitter only — see "Known gaps" |
| Saved on real AO3 | ❌ **never, by anyone** |

### Start here

1. **Read `SITE-SKIN-IMPLEMENTATION.md` §3 first.** It is the verified account
   of AO3's sanitizer and this document assumes all of it. §7 of that file
   records four corrections to `ao3Css.ts`, three of which were the same
   mistake: *being stricter than AO3*. That is the failure mode to fear here —
   it blocks working CSS and the user cannot tell that we, not the archive, are
   wrong.
2. **Run the gate:** `npx playwright test --project=unit`. No browser, no
   server, about ten seconds. It asserts every platform lints clean in both
   modes, that none emits `animation`/`@keyframes`/`gap`/`object-fit`/`calc()`,
   and that all four read as prose unstyled.
3. **Change CSS in `generator.ts`, never at the export boundary.** One
   stylesheet feeds the preview, the PNG and the work skin. That is deliberate;
   `SITE-SKIN-IMPLEMENTATION.md` §5 explains what two renderings that can
   disagree cost the other product.

### The three constraints that are easy to forget

- **AO3 refuses the entire skin over one bad property.** "Mostly legal" and
  "broken" are identical outcomes. The lint is the gate, not a suggestion.
- **html2canvas cannot rasterise `::before`/`::after`.** Anything you move into
  a pseudo-element vanishes from the PNG. This is why the iOS tails are an
  inline `<svg>`, and why §9c's otherwise-elegant `content:` trick is unusable.
- **The skin is absent more often than you think.** Every download is a
  skin-off rendering (§9a). Test with the CSS thrown away, not just with it on.

### Known gaps, in the order I would take them

1. **§9f — the export dialog copy.** Two factual errors an author hits on their
   first paste: a work can only use one skin, and skin titles are unique across
   all of AO3. Smallest change here, and the only one users meet directly.
2. **`em` for iOS and Android.** Twitter was converted (§9b); the other three
   are still `px`. The method is in `buildTwitterCSS`'s header comment, and
   `tests/work-skin.unit.spec.ts` has the assertion to copy. Convert each value
   against **its own rule's font-size context** — do that and the PNG is
   unchanged, get it wrong and every card resizes. Keep em values to three
   decimals; AO3's number grammar splits `0.9375em` into `0.937` + `5em`.
3. **The float rewrite of §5a is still unverified** — see §8. Settling it needs
   one real AO3 save, and the trick there is that **AO3 stores the *cleaned*
   CSS**, so reopening the saved skin in AO3's editor is a direct readout of
   what the sanitizer kept.
4. **Negative margins against `.userstuff`** (§9d). Not yet needed; every
   community skin ends up needing them.

### The release gate that is still open

**Nothing here has been saved on real AO3.** Our lint is a careful model of
`css_cleaner.rb`, re-verified against `master` on 7 Aug 2026 with zero drift in
all five copied lists — but a model is not the archive. Before promoting this
further:

- Save all four platforms' CSS as work skins on a real account.
- Paste the HTML into a real chapter and post it, single- and multi-chapter.
- Check with Creator's Style **on and off**, and download the EPUB.
- Reopen each saved skin in AO3's editor and diff the stored CSS against what
  we emitted. Anything missing is a rule our lint does not know about — and is
  worth a correction entry in `SITE-SKIN-IMPLEMENTATION.md` §7.

### Deployment

Netlify, building from `main` on push (`netlify.toml`, `@netlify/plugin-nextjs`).
There is no separate deploy step and no staging environment: **a push to `main`
is a production release.** Run `npm run build` and the unit project before
pushing.

---

## 11. Sources

Community work skins read while building this — the source of §4a and §5a:

> **Citation corrected, 7 Aug 2026.** This list previously credited
> "Repository: Twitter (Workskin)" at `works/74457591`. That work is
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

otwarchive `master`:

- [`app/models/work_skin.rb`](https://github.com/otwcode/otwarchive/blob/master/app/models/work_skin.rb) — the three extra refusals and the `#workskin` prefix
- [`config/initializers/gem-plugin_config/sanitizer_config.rb`](https://github.com/otwcode/otwarchive/blob/master/config/initializers/gem-plugin_config/sanitizer_config.rb) — allowed elements, attributes, `remove_contents`
- [`lib/html_cleaner.rb`](https://github.com/otwcode/otwarchive/blob/master/lib/html_cleaner.rb) — which config applies to which field, and the transformers
- [`lib/css_cleaner.rb`](https://github.com/otwcode/otwarchive/blob/master/lib/css_cleaner.rb) — shared with site skins; see the companion doc
