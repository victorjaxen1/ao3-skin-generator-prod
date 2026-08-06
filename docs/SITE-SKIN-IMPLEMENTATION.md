# AO3 Site Skin Builder — Implementation Plan

**For:** the developer building this. Assumes familiarity with the existing app.
**Source material:** `ao3-skin-builder-revised-implementation-blueprint.md` and
`ao3-skin-studio-ux-prototype.html`, both written without access to this
codebase. This plan keeps their product thinking and replaces their
architecture with ours.

Every AO3 rule below was verified against otwarchive source, not folklore.
Citations at the end.

---

## 0. What this is, in one paragraph

A second product inside the same app. Today we render a conversation to a PNG
and hand back an `<img>` tag. A site skin is **CSS text the user pastes into
AO3 Preferences → Skins → Create Site Skin**. The two share a shell and share
no pipeline.

Decisions already made:

| Question | Decision |
| --- | --- |
| Entry point | Own route `/site-skin`, plus a card on the existing picker |
| Data model | Separate `SiteSkinTheme` type and storage key — do **not** extend `SkinSettings` |
| Monetization | Free, no Pro gating in v1 |
| Scope | Site skins only. No work skins |

---

## 1. What we reuse, and what we do not

### Reuse

| Existing | Used for | Note |
| --- | --- | --- |
| `SettingsSheet` row primitives | The four control groups | **Extract first** — see §2 |
| `ExportPanel` code-modal (lines ~633-701) | Export dialog | Textarea + copy + how-to accordion is already the right shape |
| `Toast` / `useToast` | Copy confirmation, contrast warnings | |
| `storage.ts` patterns incl. `PersistResult` | Persistence with visible failure | New key, same discipline |
| `index.tsx` undo/redo + 500ms debounced save | Editor state | Copy the pattern, not the file |
| `PlatformPicker` card layout | Template gallery | |
| Playwright setup + assertion conventions | Tests | See §8 |

### Do not reuse

`generator.ts` (269 rules, all `#workskin`-scoped for rasterising),
`ExportPanel`'s render path, `imgbb.ts`, `imageProxy.ts`, `proFeatures.ts`.
None of it applies to emitting CSS text. Resist the urge to make
`buildCSS()` serve both.

---

## 2. Prerequisite refactor

The row components in `SettingsSheet.tsx` (`ToggleRow`, `SelectRow`,
`TextRow`, `SectionDivider`, `AdvancedSection`) are local `const`s. Extract
them to `src/components/SettingsRows.tsx` and import from both sheets.

Do this as its own commit, with no behaviour change, so the diff stays
readable. `ToggleRow` is already `role="switch"` with `aria-checked`, so the
site-skin editor inherits working accessibility and testable selectors.

---

## 3. AO3's actual rules (verified)

This section is the compiler contract. Get it wrong and the user hits a
cryptic rejection at the moment of payoff.

### Properties — allowlist, not denylist

`clean_css_code` keeps a declaration only if the property:

1. is in `ArchiveConfig.SUPPORTED_CSS_PROPERTIES` (exact), **or**
2. matches `-(moz|ms|o|webkit)-<supported>`, **or**
3. *contains* one of `SUPPORTED_CSS_SHORTHAND_PROPERTIES` as a substring, **or**
4. is a custom property matching `--[0-9a-z\-_]+`.

Shorthands: `background border column cue flex font layer-background
layout-grid list-style margin marker outline overflow padding page-break
pause scrollbar text transform transition`.

The substring rule is why a lot works:

| Property | Allowed? | Why |
| --- | --- | --- |
| `background-color` | ✅ | contains `background` |
| `border-radius` | ✅ | contains `border` |
| `text-align`, `text-shadow` | ✅ | contains `text` |
| `column-gap` | ✅ | contains `column` |
| `grid-template-columns` | ✅ | contains `column` — **yes, really**; see below |
| `box-shadow`, `filter`, `opacity`, `display`, `content` | ✅ | in the property list |
| `gap` | ❌ | no shorthand substring, not listed |
| `animation`, `@keyframes` | ❌ | not listed |
| `pointer-events` | ❌ | not listed |
| `backdrop-filter` | ❌ | not listed (`filter` alone is fine) |

The `grid-template-columns` / `gap` asymmetry is not a typo. The shorthand test
is an unanchored substring match, so a long property containing `column` passes
while the three-letter `gap` does not. Our lint reproduces this faithfully and
`tests/ao3-css.unit.spec.ts` pins it, with a comment telling future readers not
to "fix" it — tightening our check would reject CSS AO3 actually accepts.

### Values

`VALUE_REGEX` accepts transform functions, `url()`, `color-stop()`, colors
(hex/named/`rgba()`/`hsla()`), numbers with units, plain keywords (`[a-z\-]+`),
shape functions, filter functions, `drop-shadow()`, and `var()`.

**`color-mix()` is not in that list.** The prototype's preview leans on it
heavily. Resolve every mix to a literal hex before emitting — the prototype's
`mixHex()` already does this and should be ported as-is.

### Other hard rules

- `@font-face` is rejected outright.
- `!important` is always permitted.
- `url()` is allowed only on `background`, `background-image`, `border`,
  `border-image`, `list-style`, `list-style-image`, restricted to
  jpg/jpeg/png/gif on an allowlisted TLD. **v1 emits no `url()` at all.**
- `var()` is rejected inside `content`.

### @media is not CSS here

`Skin::MEDIA` is a whitelist on the skin *model*, chosen in AO3's form — not
`@media` blocks in the CSS body:

```
all screen handheld speech print braille embossed projection tty tv
"only screen and (max-width: 42em)"
"only screen and (max-width: 62em)"
"(prefers-color-scheme: dark)"
"(prefers-color-scheme: light)"
```

**v1 emits no `@media` blocks.** If we later want a dark variant, it is a
second skin with `(prefers-color-scheme: dark)` set, combined via AO3's parent
skin mechanism — a v2 conversation, not a compiler feature.

---

## 4. Defects in the prototype — do not port these

Found by reading `compileSkin()` against AO3's real templates.

**4.1 The drop cap lands on summaries and notes, not just the chapter.**
`#workskin p:first-of-type::first-letter` (prototype line 533).

`:first-of-type` matches the first `<p>` *within each parent*, not once per
page. Inside `#workskin` that is the summary blockquote, the chapter notes, and
every chapter body — so a decorative capital appears three or four times on a
normal work page.

Narrow it to the chapter text container. Note that AO3 renders chapter text as
`div.userstuff.module` for multi-chapter works but plain `div.userstuff` for
the single-chapter path, so `#chapters .userstuff` is the pragmatic target:

```css
#chapters .userstuff p:first-of-type::first-letter { … }
```

**This is the one control that must be checked on a real AO3 work before
shipping** — multi-chapter and single-chapter both.

> **Correction to an earlier draft of this document.** It claimed `#workskin`
> exists only on works that already have a work skin, making these selectors
> dead. That was wrong: `app/views/works/show.html.erb` renders
> `<div id="workskin">` unconditionally — the template comment reads "BEGIN
> section where work skin applies." Site-skin rules targeting `#workskin` do
> apply on every work page. The defect is the `:first-of-type` scope above.

**4.2 "Page" colour is overridden by "Cards".** `#main` appears in two rules
with `background-color: … !important` — first `bg`, later `surface`. Equal
specificity, later wins, so the Page control only affects `body` and
`#outer.wrapper`. That violates the blueprint's own §5 rule that every control
must have a visible effect. §6 gives each selector exactly one owner.

**4.3 Font size compounds.** `font-size: N%` is set on `body`, `#outer.wrapper`
*and* `#main` in one rule. Nested percentages multiply. Set the scale once, on
`body`.

---

## 4b. Region ownership — the compiler spec

Every selector below has **exactly one** owning control. This is what stops
defect 4.2 recurring. If you need a selector to react to two controls, that is
a design conversation, not a second `!important`.

| Control | Owns | Emit |
| --- | --- | --- |
| `colors.background` | `body` | `background-color` |
| `colors.surface` | `li.blurb`, `#dashboard`, `#workskin`, `#footer` | `background-color` |
| `colors.text` | `body` | `color` (cards inherit) |
| `colors.accent` | `#header` | `background-color`, `border-color` |
| `colors.accent` | `a`, `a:link`, `a:visited`, `a.tag` | `color` |
| `colors.accent` | `h1`–`h6` inside `#main` | `color` |
| derived border | `li.blurb`, `#dashboard`, `#workskin`, `a.tag` | `border-color` — `mixHex(accent, surface, 0.27)` |
| `typography.headingFont` | `#header .heading`, `h1`–`h6` | `font-family` |
| `typography.bodyFont` | `body` | `font-family` |
| `typography.baseFontScale` | `body` **only** | `font-size` as a percentage |
| `shape.cardRadius` | `li.blurb`, `#dashboard`, `#workskin` | `border-radius` |
| `shape.tagStyle` | `a.tag` | `border-radius` |
| `details.divider` | `#chapters .userstuff hr` | `border-top`, `::after` glyph |
| `details.dropCap` | `#chapters .userstuff p:first-of-type::first-letter` | `float`, `font-size`, `color` |

**Deliberately unowned: `#main`.** The prototype painted it twice. Leaving it
transparent lets the page colour show through everywhere it should, and keeps
"Cards" meaning cards. Do not add a `#main` background.

Colour derivations resolve to literal hex before emission — `color-mix()` is
not in AO3's value grammar and the lint rejects it.

---

## 5. Architecture

```
src/pages/site-skin.tsx              route: gallery ⇄ editor
src/components/siteSkin/
  TemplateGallery.tsx                cards + mood filters
  ThemeEditor.tsx                    left rail, four groups
  SkinPreview.tsx                    sandboxed iframe, three states
  ExportSkinDialog.tsx               copy + AO3 instructions
src/components/SettingsRows.tsx      extracted in §2, shared
src/lib/siteSkin/
  theme.ts                           SiteSkinTheme, defaults, validation
  templates.ts                       launch catalog
  compile.ts                         theme → CSS
  ao3Css.ts                          allowlist + lint  ← the safety layer
  mockPage.ts                        AO3-shaped mock markup, 3 states
  colors.ts                          mixHex, luminance, contrast, autoFix
  storage.ts                         key: ao3SiteSkinTheme
```

Pages Router, matching the rest of the app. Ignore the blueprint's
`app/routes/...` layout — that is App Router and would fork the codebase.

### The preview must be an iframe

Compiled site-skin CSS targets `body`, `#header`, `#main`. Our current
`PreviewPane` injects a `<style>` tag straight into the page, which is only
safe because all 269 generator rules are `#workskin`-scoped. Doing that here
would restyle our own application.

Use `<iframe srcdoc>` with `sandbox=""` (no scripts needed). Isolation is
total, and the preview becomes honest.

### One stylesheet, one truth

**The mock DOM must use AO3's real IDs and classes** — `#header`, `#main`,
`li.blurb`, `#dashboard`, `.userstuff`, `a.tag` — so that *the exact CSS we
export is the CSS that renders the preview*.

The prototype does not do this: its preview is driven by `--p-*` custom
properties while its export is a separately-built string. Two renderings that
can silently disagree is the precise failure this project just spent an audit
removing from the image pipeline. Do not reintroduce it.

Consequence: `compile(theme)` has one output, used by both. If a control has no
visible effect in the preview, it has no effect on AO3 either — the blueprint's
§5 rule becomes structurally enforced instead of aspirational.

### 5b. The mock DOM

Transcribed from otwarchive's templates (`layouts/application`,
`layouts/_header`, `layouts/_footer`, `users/_sidebar`, `works/_work_module`,
`works/show`, `works/_preface`, `chapters/_chapter`). Class names are AO3's, not
ours — that is the entire point. Fill with the prototype's sample fic copy.

**Shell, wrapping all three states:**

```html
<body class="logged-in">
  <div id="outer" class="wrapper">
    <header id="header" class="region">
      <h1 class="heading"><a href="#">Archive of Our Own</a></h1>
      <ul class="primary navigation actions">
        <li class="dropdown"><a href="#">Fandoms</a></li>
        <li class="dropdown"><a href="#">Browse</a></li>
        <li class="search"><a href="#">Search</a></li>
      </ul>
    </header>
    <div id="inner" class="wrapper">
      <!-- #dashboard sits here, in the dashboard state only -->
      <div id="main" class="region"><!-- state content --></div>
    </div>
    <div id="footer" class="region">
      <ul class="navigation actions"><li class="module group"><a href="#">About</a></li></ul>
    </div>
  </div>
</body>
```

**Browse — inside `#main`:**

```html
<h2 class="heading">Works in your favourite fandom</h2>
<ol class="work index group">
  <li id="work_1" class="work blurb group" role="article">
    <div class="header module">
      <h4 class="heading">
        <a href="#">The Cartographer's Impossible Map</a> by <a rel="author" href="#">inkandstarlight</a>
      </h4>
      <h5 class="fandoms heading">
        <span class="landmark">Fandoms:</span> <a class="tag" href="#">Original Work</a>
      </h5>
      <p class="datetime">06 Aug 2026</p>
    </div>
    <ul class="tags commas">
      <li class="relationships"><a class="tag" href="#">Mara/Court Messenger</a></li>
      <li class="freeforms"><a class="tag" href="#">Slow Burn</a></li>
      <li class="freeforms"><a class="tag" href="#">Happy Ending</a></li>
    </ul>
    <blockquote class="userstuff summary">
      <p>Mara discovers a map that redraws itself whenever someone tells a lie.</p>
    </blockquote>
    <dl class="stats">
      <dt class="words">Words:</dt><dd class="words">12,842</dd>
      <dt class="chapters">Chapters:</dt><dd class="chapters">1/1</dd>
    </dl>
  </li>
  <!-- two more blurbs: one long summary, one very short, to test wrapping -->
</ol>
```

**Reading — inside `#main`.** Note the real nesting; the drop cap and divider
selectors in §4b depend on it:

```html
<div class="work">
  <div id="work-skin" class="wrapper">
    <div id="workskin">
      <div class="preface group">
        <h2 class="title heading">The Cartographer's Impossible Map</h2>
        <h3 class="byline heading"><a rel="author" href="#">inkandstarlight</a></h3>
        <div class="summary module">
          <h3 class="heading">Summary:</h3>
          <blockquote class="userstuff"><p>A map that lies.</p></blockquote>
        </div>
      </div>
      <div id="chapters" role="article">
        <div class="chapter" id="chapter-1">
          <div class="chapter preface group"><h3 class="title">Chapter 1</h3></div>
          <div class="userstuff module" role="article">
            <h3 class="landmark heading">Chapter Text</h3>
            <p>The map began lying on a Tuesday…</p>
            <hr />
            <p>By noon, the palace messenger had arrived…</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
```

Keep the summary blockquote in this state. It is how a reviewer sees at a
glance whether the drop cap has escaped its container (defect 4.1).

**Dashboard — `#dashboard` as a sibling of `#main` inside `#inner`:**

```html
<div id="dashboard" class="region own" role="navigation">
  <h4 class="landmark heading">Your account</h4>
  <ul class="navigation actions">
    <li><a href="#">Profile</a></li>
    <li><a href="#">Works</a></li>
    <li><a href="#">Bookmarks</a></li>
  </ul>
</div>
```

---

## 6. Data model

```ts
// src/lib/siteSkin/theme.ts
export interface SiteSkinTheme {
  schemaVersion: 1;
  meta: { id: string; name: string; category: 'dark'|'light'|'minimal'|'decorative' };
  colors: { background: string; surface: string; text: string; accent: string };
  typography: { headingFont: string; bodyFont: string; baseFontScale: number };
  shape: { cardRadius: string; tagStyle: 'pill'|'label'|'plain' };
  details: { divider: boolean; dropCap: boolean };
}
```

Separate from `SkinProject`. Separate localStorage key. The two products never
share a settings object — that is the mistake the platform audit just spent
~60 deleted fields undoing.

Fonts are a fixed list of web-safe stacks (no `@font-face`, so no webfonts).
Always emit a fallback stack.

---

## 7. Build order

| Phase | Deliverable | Done when |
| --- | --- | --- |
| ~~1~~ | ~~`ao3Properties.ts` + `ao3Css.ts` + unit tests~~ | ✅ **Done** — see below |
| 0 | Extract `SettingsRows.tsx` | Existing settings sheet unchanged, tests green |
| 2 | `theme.ts`, `colors.ts`, `compile.ts`, 2 reference themes | Compiled output passes lint |
| 3 | `mockPage.ts` + `SkinPreview.tsx`, 3 states | Real AO3 selectors, iframe isolated |
| 4 | `ThemeEditor.tsx`, four control groups + contrast | Every control visibly changes the preview |
| 5 | `TemplateGallery.tsx` + full catalog | Distinct at thumbnail size |
| 6 | `ExportSkinDialog.tsx` + picker card + route | Copy works, instructions correct |
| 7 | A11y, tests, **manual AO3 save of every template** | See §8 |

Start the catalog from the prototype's 12 templates — they are well chosen and
already carry exactly our field set.

### Phase 1 is already built

The safety layer is the piece where being wrong is silent and expensive, so it
ships with this document rather than being described by it:

| File | What |
| --- | --- |
| `src/lib/siteSkin/ao3Properties.ts` | AO3's 181 properties and 20 shorthands, copied verbatim from `config.yml`, dated |
| `src/lib/siteSkin/ao3Css.ts` | `isPropertyAllowed()`, `lintAo3Css()`, `isAo3Safe()` |
| `tests/ao3-css.unit.spec.ts` | 39 tests |

Run it with `npx playwright test --project=unit` — no browser, no server, ~4s.
The `unit` project was added to `playwright.config.ts` for exactly this.

Writing the tests caught two errors in an earlier draft of this document
(`grid-template-columns` is allowed, and `content: url()` is allowed because
AO3 branches on `content` before the url gate). Treat the tests, not this prose,
as the specification.

---

## 8. Testing

Automatable, and therefore required:

- **Allowlist unit tests** — `ao3Css.ts` against the verified property rules,
  including the substring quirks (`column-gap` ✅, `gap` ❌).
- **Compile snapshot per template** — catches accidental property drift.
- **Lint every template's output** — no template ships that cannot pass AO3.
- **Contrast tests** — the WCAG ratio maths, plus the "Fix text color" action.
- **Playwright**: gallery → editor → each preview state → export → copy.
  Follow `tests/settings-render.spec.ts`: assert the compiled CSS actually
  contains the changed value, not merely that a control moved.

Not automatable, and therefore a release gate:

- **Save every launch template on AO3 by hand** and confirm it applies. AO3's
  sanitizer is the only authority. Record results in a checklist.
- Specifically probe: `content: "❦"` (non-ASCII in `content` may not survive
  `VALUE_REGEX`) and the `.userstuff` selectors from §4.1.

---

## 9. Two indicators, not one

The prototype's "AO3-safe" pill flips to "1 readability warning" — conflating
sanitizer safety with contrast. They are unrelated:

- **AO3-safe** — does the compiled CSS pass our allowlist lint? Blocks export.
- **Readability** — does text meet contrast against page and cards? Warns,
  offers "Fix text color", never blocks.

A user should never be told their skin is unsafe because it is low-contrast, or
safe because it is readable.

---

## 10. Scope discipline

Before adding a control, the blueprint's §19 test still applies, plus one of
ours: **it must be expressible in the allowlist and visible in the mock DOM.**
If it cannot be previewed honestly, it cannot ship.

Explicitly out of v1: work skins, raw CSS editing, webfonts, `@media`
variants, background images, sharing, accounts.

---

## Sources

AO3 rules verified against otwarchive `master`:

- [`lib/css_cleaner.rb`](https://github.com/otwcode/otwarchive/blob/master/lib/css_cleaner.rb) — `legal_property?`, `legal_shorthand_property?`, `VALUE_REGEX`, `@font-face` rejection, `url()` gating
- [`config/config.yml`](https://github.com/otwcode/otwarchive/blob/master/config/config.yml) — `SUPPORTED_CSS_PROPERTIES`, `SUPPORTED_CSS_SHORTHAND_PROPERTIES`, `SUPPORTED_CSS_KEYWORDS`, `SUPPORTED_EXTERNAL_URLS`
- [`app/models/skin.rb`](https://github.com/otwcode/otwarchive/blob/master/app/models/skin.rb) — `MEDIA` whitelist, `clean_css` pipeline

Re-verify before Phase 1 — AO3 changes these lists, and a stale allowlist is
worse than none.
