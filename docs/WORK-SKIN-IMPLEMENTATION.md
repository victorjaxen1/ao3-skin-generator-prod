# AO3 Work Skin Export — Implementation & Handoff

**For:** the developer adding iOS and Android, or debugging what shipped.
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
| iOS | ⬜ 12 violations | see §7 |
| Android | ⬜ 12 violations | see §7 |

`supportsWorkSkin(template)` gates the UI. A platform is listed there **only**
once its CSS lints clean — AO3 refuses an entire skin over one bad property, so
"mostly legal" and "broken" are the same thing.

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
Every established AO3 Twitter work skin — see §9 — uses float and none use
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

## 7. Handoff: iOS and Android

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

## 9. Sources

Community work skins read while building this — the source of §4a and §5a:

- [Repository: Twitter (Workskin)](https://archiveofourown.org/works/74457591) — the tutorial that documents "with the workskin / without the workskin", the `float: left` + `overflow: hidden` pattern, and intrinsic `width`/`height` attributes
- The app's own earlier iMessage output, which used `media.publit.io` absolute
  URLs and CSS bubble tails, and third-party hosts (`i.imgur.com`) for reader
  images

otwarchive `master`:

- [`app/models/work_skin.rb`](https://github.com/otwcode/otwarchive/blob/master/app/models/work_skin.rb) — the three extra refusals and the `#workskin` prefix
- [`config/initializers/gem-plugin_config/sanitizer_config.rb`](https://github.com/otwcode/otwarchive/blob/master/config/initializers/gem-plugin_config/sanitizer_config.rb) — allowed elements, attributes, `remove_contents`
- [`lib/html_cleaner.rb`](https://github.com/otwcode/otwarchive/blob/master/lib/html_cleaner.rb) — which config applies to which field, and the transformers
- [`lib/css_cleaner.rb`](https://github.com/otwcode/otwarchive/blob/master/lib/css_cleaner.rb) — shared with site skins; see the companion doc
