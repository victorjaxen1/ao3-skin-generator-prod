# One Skin, Four Platforms — Implementation Plan

**For:** the developer building the combined work skin.
**Companion docs:** `WORK-SKIN-IMPLEMENTATION.md` (the per-platform export that
ships today) and `SITE-SKIN-IMPLEMENTATION.md` §3 (the verified account of AO3's
sanitizer). Both are assumed knowledge; this document records only what is new.

**Written 7 Aug 2026.** Informed by *A Beginner's Guide to HTML and CSS on AO3*
by the_untamed_poet25 (supplied as a text file in the repo root; no canonical
URL was included with it), every load-bearing claim of which was re-checked
against otwarchive `master` before being acted on. §2 records which claims survived that
check and which did not — two did not, and one of them would have made our
mobile problem worse.

---

## 1. What this is, and the reason it is worth doing

Today each platform exports its own stylesheet. A user who wants a tweet and an
iMessage exchange copies two lots of CSS — and then discovers they cannot use
both.

**AO3 allows exactly one work skin per work.** The official FAQ says so, and so
does the guide:

> One workskin per work. You can only attach one workskin to a work at a time.
> If you want different styling for different works, create a separate skin for
> each, **or write one flexible skin that you reuse across multiple works.**

So a fic containing both a tweet and a text-message exchange is, with today's
export, **impossible**. Socmed AUs mix platforms constantly. This is not a
convenience feature — it is a capability we do not currently have, and the
guide's own advice is the shape of the fix.

Secondary benefits: the user pastes CSS once ever rather than once per fic, and
a series formats consistently, which is the thing AO3's FAQ actually sells
skins for.

---

## 2. What the guide claims, and what survived checking

The guide is the best single reference on AO3 formatting that exists, and most
of it is right. It is also folk knowledge in places. **Every claim below was
re-checked against `lib/css_cleaner.rb`, `config/config.yml` and
`sanitizer_config.rb` on `master`.** Two are wrong, and both matter to us.

| Guide's claim | Verdict | Basis |
| --- | --- | --- |
| `gap` doesn't work | ✅ **Confirmed** | Not on the property list, contains no shorthand substring. We hit this independently in §5.1 of the work-skin doc |
| `animation` / `@keyframes` blocked | ✅ **Confirmed** | Neither is on the list |
| `id` attributes are stripped from work HTML | ✅ **Confirmed** | `Sanitize::Config::ARCHIVE` allows `align title dir` plus `class`; `id` is on no list |
| The one-line rule — AO3 injects `<br>`/`<p>` at line breaks | ✅ **Confirmed, and we violate it** | See §4 |
| `:has()` and `linear-gradient()` work | ✅ **Plausible, unverified** | AO3 filters properties and values, never selectors; `linear-gradient` reaches `VALUE_REGEX` via `color-stop` |
| **`@media` works in work skins** | ❌ **Wrong, and dangerous** | See below |
| **A banned property drops that rule block** | ❌ **Wrong** | See below |
| `display: flex` is blocked by the validator | ❌ **Wrong as stated** — but see §5 | `display` is on the property list and `flex` matches `ALPHA_REGEX`, so the declaration survives the sanitizer intact |

### 2a. `@media` does not work, and fails silently

The guide says *"Confirmed working in AO3 workskins"* and ships a live
resize-your-window demo. It is wrong, and the failure mode is the worst kind.

`clean_css_code` iterates `parser.each_rule_set do |rs|` — **arity one**. The
css_parser gem yields `(rule_set, media_types)`, so the media types are
discarded, and the sheet is rebuilt as bare `selectors { declarations }` with no
`@media` wrapper. The rules survive. Their condition does not.

A mobile breakpoint therefore applies at **every** width. If you check only that
your styling "appeared", it looks like it worked — which is presumably how the
claim got into circulation.

**Consequence for us: keep rejecting `@media`.** `lintAo3Css` already does, and
its message already says exactly this. Do not relax it on the strength of the
guide. `em` sizing remains the only responsive lever we have (see §9b of the
work-skin doc).

### 2b. A banned property refuses the whole skin, not the rule

The guide's "silent drop rule" says a blocked property discards its rule block
and the skin saves. The source says otherwise:

```ruby
elsif sanitize_css_property(property).blank?
  errors.add(:base, :banned_property, property: property)
```

`errors.add` fails validation, so the **skin does not save at all** and AO3
shows an error. Nothing is silent about it.

This is worth being precise about because it sets how much the lint matters. If
the guide were right, a stray property would cost one rule. Because it is not,
a stray property costs the entire skin — which is why the export blocks on any
violation, and why that must not be softened into a warning.

The guide's practical advice (*"keep anything you suspect might be blocked in
its own rule"*) is harmless either way, so the disagreement changes no code.

---

## 3. The measured facts

Taken from the four shipped stylesheets, not estimated.

> **Re-measured 8 Aug 2026**, now that the namespacer exists and the numbers can
> be taken from its actual output rather than estimated from `buildCSS`. The
> shape of the conclusion is unchanged; three figures moved. The originals are
> kept in the second table because the reasoning elsewhere in this document was
> built on them.

Measured on the **export** CSS — what `buildWorkSkin` emits, comments stripped
and asset URLs absolutized — which is the only version that can go in a skin,
and then namespaced:

| Platform | Export CSS | Namespaced | Rules |
| --- | --- | --- | --- |
| iOS | 9,767 B | 10,673 B | 88 |
| Android | 8,677 B | 9,799 B | 76 |
| Twitter | 7,850 B | 9,048 B | 80 |
| Google | 4,373 B | 4,998 B | 48 |
| **Combined** | — | **34,518 B** | **292** |

Namespacing costs about **10%** in bytes, which is the price of the platform
class on every selector.

The original estimates, and why they read higher: they were taken from
`buildCSS` *with its comments*, which the export strips.

| Platform | CSS | Rules | Rules that change with the user's theme |
| --- | --- | --- | --- |
| iOS | 11,780 B | 87 | 25% |
| Android | 9,011 B | 76 | 24% |
| Twitter | 9,970 B | 75 | 32% |
| Google | 4,368 B | 52 | **0%** |
| **Combined** | **~38 KB namespaced** | 290 | — |

**Size is a non-issue.** Rosé Pine ships 104 KB and AO3 accepts it, and the real
combined figure came in *under* the estimate at 34.5 KB.

**Collisions are narrow.** 223 distinct selectors, 63 shared by two or more
platforms, of which only **25 actually conflict** — and 24 of those are iOS vs
Android, which both build on `dd.bubble`. Twitter and Google collide with
nothing but `.chat` and `.wm`.

**Namespacing is mechanical.** All 292 selectors begin with `#workskin` —
confirmed, not assumed, and `namespaceCss` now throws rather than pass through
one that does not. The transform came in near the predicted size, but "mechanical"
undersold it: the two things it actually had to get right (the container's own
classes, and comments) are in §6a-i, and both were found by rendering rather than
by reading.

---

## 4. The blocker the guide found for us: the one-line rule

> AO3 only injects `<br>` and `<p>` wrappers at line breaks, so a single line is
> never touched.

This is real, it is the guide's most valuable practical contribution, and
**Google's export violates it today**:

| Platform | Exported HTML | Verdict |
| --- | --- | --- |
| iOS | 1 line | safe |
| Android | 1 line | safe |
| Twitter | 1 line | safe |
| **Google** | **9 lines, 2 blank-line breaks** | **AO3 will rewrite this** |

`buildHTML`'s Google branch uses a formatted template literal. AO3 will inject
`<br>` at each newline and wrap the blank-line-separated chunks in `<p>`,
putting elements inside `.search-result` that our CSS does not expect.

**This is a live bug in a shipped platform, independent of the master skin.**
Fix it first, separately: collapse the Google branch to a single line and add a
test asserting every platform's exported HTML contains no `\n`. That test is
cheap and permanently prevents the class of bug.

---

## 5. The flexbox question, left honestly open

The guide says flex is blocked. The sanitizer says otherwise, plainly:
`display` is an allowed property and `flex` is an allowed value, so the
declaration survives. The guide's demonstration rule almost certainly also
contained `gap` — flex's constant companion, and genuinely banned — which would
drop the skin and look exactly like flex being at fault.

**But we should not dismiss it**, because we have an independent observation of
our own. `WORK-SKIN-IMPLEMENTATION.md` §5a records the Twitter header rendering
correctly locally and *wrong on the real archive* until it was rewritten to
`float` + `overflow: hidden` — a cause the doc admits is not understood. Two
unrelated parties reporting trouble with flex on AO3, for different stated
reasons, is worth more than either report alone.

Current exposure:

| Platform | `display:flex` rules | flex sub-properties |
| --- | --- | --- |
| iOS | 13 | 32 |
| Android | 11 | 27 |
| Google | 6 | 14 |
| Twitter | 5 | 14 |

iOS and Android are the most exposed and have never been rendered on real AO3.

**Do not mass-rewrite this on the strength of a tutorial.** It is one save on a
real account to settle — see §8. If flex does fail, the fix is the same
float/inline-block substitution Twitter already had, and §5a is the worked
example. If it does not, we have removed a doubt that has been sitting in the
docs since the export shipped.

---

## 6. Design

### 6a. Namespacing — **done, 8 Aug 2026**

`namespaceCss(css, platform)` and `CONTAINER_CLASSES` are in `workSkin.ts`;
`buildHTML` emits the platform class; `tests/namespace.spec.ts` is the
PNG-unchanged check. **What the plan below got wrong is recorded in 6a-i.**

Add a platform class to the container in `buildHTML` — `.chat.ios`,
`.chat.android`, `.chat.twitter`, `.chat.google` — and rewrite every selector:

```text
#workskin .chat            ->  #workskin .chat.ios
#workskin dd.bubble        ->  #workskin .chat.ios dd.bubble
```

Two things to get right:

- **Strip comments before the rewrite.** The prototype missed seven rules
  because the selector capture swallowed the preceding comment. This is the
  fourth time in one session that pattern-matching CSS without stripping
  comments has produced a wrong answer — `lintAo3Css` had the same bug, and two
  tests did. **Put a shared `stripCssComments()` in `ao3Css.ts` and use it
  everywhere.**
- **The class must be added in `buildHTML`, not at the export boundary**, since
  one stylesheet drives the preview, the PNG and the work skin. Adding a class
  raises specificity uniformly, so relative precedence is unchanged — but verify
  the PNG the same way the `em` conversion was verified (§9b), by comparing
  computed values rather than by eye.

### 6a-i. What the plan above got wrong (8 Aug 2026)

Both bullets were right. The transform was still wrong twice, and only the
render diff could see either.

- **"`.chat` roots the selector" is not the rule — the *container's classes*
  do.** The tweet container is `class="chat twitter tweets"`, so `.chat` and
  `.tweets` are the **same element**. Prefixing turned `#workskin .tweets
  .tweet` into `#workskin .chat.twitter .tweets .tweet`, which asks for
  `.tweets` inside itself and matches nothing: every `.tweet` rule lost its
  background, border, padding and rounding at once. Hence `CONTAINER_CLASSES`
  (`chat`, `tweets`, `css-tails`), a compound parser rather than a
  `startsWith`, and a unit test that checks that list against the markup
  `buildHTML` actually emits — because the list is hand-maintained and fails
  silently when it falls behind.
- **"Adding a class raises specificity uniformly" is false.** A rule already
  rooted at the container gains **one** class; every other rule gains **two**.
  Rules that previously tied, and were therefore decided by source order, can
  swap. Nothing static can see it, which is exactly why the check has to be a
  rendering one. (In the event, nothing swapped — but that is a measurement,
  not a deduction.)
- **Namespacing goes last, after `absolutizeCssAssets`.** Android reaches
  `buildCSS` with `url('/assets/…')`, which AO3 refuses outright, so a master
  skin assembled from raw `buildCSS` output would be rejected in full. Caught
  by writing the test the wrong way round.
- **A blocked image is not a fixed-size box.** The harness originally aborted
  image requests, on the sound-looking grounds that every `img` we emit carries
  width and height. But Chrome sizes the broken-image placeholder when the
  failure lands, which is not fixed relative to the load event, so two
  *identical* renders differed by 6.69px on Google — the only platform with a
  single decisive image. That reads exactly like a real namespacing bug. Stub
  images with a 1x1 PNG instead of aborting them; it is deterministic and still
  never touches the network.

### 6b. Theming — enumerate the variants, don't bake one

> **Revised 7 Aug 2026.** This section originally concluded "one skin, one
> theme", reasoning that without `var()` a combined skin must bake a single
> palette. That was too pessimistic, and the evidence against it is the
> strongest kind: CSS AO3 is currently serving. See
> `AO3-WORK-SKIN-KNOWLEDGE.md` §3.

24–32% of rules depend on the user's settings. The obvious way to absorb that is
custom properties — `--sender-bg` once, `var()` everywhere. **Work skins ban
both**, non-negotiably: `WorkSkin#clean_css` refuses any `--` declaration and any
`var()` anywhere, and `tests/work-skin.unit.spec.ts` pins it. Legal in a site
skin, refused here.

The community's answer is not to give up on variants but to **enumerate them as
classes**, and it demonstrably survives the sanitizer:

```css
#workskin .wpp .light .bg1 { background-image: url("…bglight1.png"); }
#workskin .wpp .dark  .bg1 { background-image: url("…bgdark.png");   }
```

One skin carries both palettes; the HTML selects with a wrapper class. The same
published skin does it again for sixteen quote colours. A hand-writer can only
afford a handful of variants — **we generate, so the cost is a loop.**

**Therefore:** the master skin carries the user's current settings *plus* a
light/dark pair per platform, selected by a wrapper class on `.chat`. Structure
the namespace to leave room for it:

```text
#workskin .chat.ios.light dd.bubble { … }
#workskin .chat.ios.dark  dd.bubble { … }
```

Two things to decide when building, not now:

- **How many variants.** Light/dark is clearly worth it — dark mode is already a
  per-platform setting, so this costs nothing the user hasn't already asked for.
  A full palette set multiplies the 24–32% settings-dependent rules by N and
  should wait for evidence anyone wants it.
- **Whether the rest of the theme stays baked.** Fonts, widths and accent
  colours can stay generated-from-settings without enumeration; only the
  light/dark split needs to be a variant, because it is the one axis an author
  plausibly changes *within* a single work.

Keep the existing per-platform export alongside it for anyone who wants a
minimal skin for one fic.

### 6c. Versioning, given that AO3 deletes comments

The user saves the skin once. We ship new CSS later. Their saved skin is now
stale while newly generated HTML expects classes it does not contain, and
nothing tells them.

A version comment cannot carry this: **AO3 strips comments entirely** —
`clean_css_code` rebuilds the sheet from rule sets, so nothing outside a rule
survives. Worth knowing on its own account: our
`/* Generated with AO3 Skin Generator … */` header has never once reached the
archive.

Rosé Pine's workaround does survive, because it is a real rule:

```css
#workskin .ao3skingen-v3::after { content: "3"; }
```

Emit one, bump it whenever the class contract changes, and let the app detect a
stale skin if the user pastes their saved CSS back in.

---

## 7. Build order

| Phase | Deliverable |
| --- | --- |
| 0 | ✅ **done.** **Fix Google's multi-line HTML** (§4) and add the no-newline test. Independent of everything else, and a live bug |
| 1 | ✅ **done.** `stripCssComments()` in `ao3Css.ts`, used by the lint and the namespacer |
| 2 | ✅ **done, 8 Aug 2026.** `namespaceCss(css, platform)` + platform class in `buildHTML`, with a PNG-unchanged check — `tests/namespace.spec.ts`, which diffs every computed style on every element, with and without the class and with and without the rewrite, under paragraph injection as well. Two bugs it caught are in §6a-i |
| 3 | ⬅ **next.** `buildMasterWorkSkin(project)` — shared block, four namespaced blocks, version rule |
| 4 | Dedupe the rules that are byte-identical across platforms (`.visually-hidden`, the paragraph reset, the `dd.bubble` text formatting). **Re-measured 8 Aug 2026: 26 distinct rules, 3.4 KB of 34.5 KB** — the "38" this row used to claim predates the `em` conversion and the palette tables. About a tenth, so worth doing and not worth blocking item 3 on |
| 5 | Export UI: "one skin for everything" vs "just this platform", and the §9f copy fixes — one skin per work, globally unique titles |
| 6 | **Save it on real AO3** and settle §5 |

Phases 0 and 1 are worth doing regardless of whether the master skin ships.

---

## 8. What only a real AO3 save can answer

The lint is a careful model of `css_cleaner.rb`, re-verified against `master`
with zero drift. It cannot answer any of these:

- **Does `display: flex` render correctly?** (§5) The single most valuable
  unknown. Save one skin, view a work, resize.
- **Does the combined skin exceed any limit we have not found?** No documented
  cap, and 104 KB skins exist, but 38 KB has not been tried by us.
- **Does AO3's editor mangle a single 38 KB paste?** The guide warns the skin
  editor has no undo history.
- **Re-open each saved skin in AO3's editor.** AO3 stores the **cleaned** CSS,
  so the box is a direct readout of what the sanitizer kept. Diff it against
  what we emitted; anything missing is a rule our lint does not know about, and
  belongs in `SITE-SKIN-IMPLEMENTATION.md` §7 as a correction.

---

## 9. Sources

- *A Beginner's Guide to HTML and CSS on AO3* — the_untamed_poet25, supplied as
  `css and html in ao3 by the_untamed_poet25.txt` in the repo root. Chapters 1 and 3 are the relevant ones: the one-line rule, the blocked-property list, the debugging reference. Treat its AO3-specific claims as leads to verify, not as settled: §2 above records two that do not survive contact with the source.
- [Tutorial: Creating a Work Skin FAQ](https://archiveofourown.org/faq/tutorial-creating-a-work-skin) — one skin per work; titles unique across all users
- otwarchive `master`: `lib/css_cleaner.rb` (`each_rule_set` arity, `errors.add` on a banned property, comment loss), `app/models/work_skin.rb`, `config/initializers/gem-plugin_config/sanitizer_config.rb`
