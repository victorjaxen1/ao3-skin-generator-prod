# AO3 Site Skin Builder — Implementation Plan

**For:** the developer building this. Assumes familiarity with the existing app.
**Source material:** `ao3-skin-builder-revised-implementation-blueprint.md` and
`ao3-skin-studio-ux-prototype.html`, both written without access to this
codebase. This plan keeps their product thinking and replaces their
architecture with ours.

> ## Start here
>
> **Revision 4 — 13 Aug 2026.** The product is built and deployed; one gate is
> still open and one class of bug has already escaped through it.
>
> **§15 is the handoff.** Current state, the file map, the invariants you must
> not break, how to run everything, and the next work in order. Read it first,
> then come back for whichever section it sends you to.
>
> If you are about to touch the compiler, read **§4b** (who owns which selector)
> and **§14** (why not every declaration may shout) before you write a rule.
> If you are about to touch `ao3Css.ts`, read **§3** and the corrections in §7 —
> and note that the work-skin product depends on that file too.
>
> Reading order for a cold start: §0 → §15 → §3 → §4b → §14 → §5.

**Revision 3 — 6 Aug 2026.** Every rule below was re-verified against
otwarchive `master`, including AO3's *own default stylesheets*, not just its
sanitizer. That reading changed the compiler spec substantially; §4 and §4b are
the parts that moved. Revision 3 added header banners and the image-address
validator (§3a), and reversed the earlier "v1 emits no `url()`". Citations at
the end.

**What revision 4 added.** §13 (Phase 9: tag colours by type, themed
scrollbars, banner-hosting copy), §14 (the defect that shipped — a site skin
overriding an author's work skin, and the cascade rule that came out of it), and
§15 (this handoff). The sections §14 corrects are flagged in place, at §4.1 and
§3b.

**A second product now shares this knowledge.** `WORK-SKIN-IMPLEMENTATION.md`
covers the conversation generator's third export. It relies on §3 below and
records only what differs — chiefly that work skins ban custom properties and
`var()`, that AO3's *HTML* sanitizer fails silently where the CSS one errors
loudly, and that readers can switch a work skin off entirely. If you are
changing `ao3Css.ts`, both products depend on it.

> **Do not import the work-skin constraints wholesale.** A week of reading
> published work skins (`AO3-WORK-SKIN-KNOWLEDGE.md`) produced a lot of rules
> that look universal and are not. **§12 is the reconciliation** — what carries
> over, what is work-skin-only, and what the site-skin product may use *because*
> it is a site skin. Read it before applying anything learned over there.

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
| `ExportPanel` code-modal (lines ~674-742) | Export dialog | Textarea + copy + how-to accordion is already the right shape |
| `Toast` / `useToast` | Copy confirmation | |
| `storage.ts` patterns incl. `PersistResult` | Persistence with visible failure | New key, same discipline |
| `index.tsx` undo/redo + 500ms debounced save | Editor state | Copy the pattern, not the file |
| `PlatformPicker` card layout | Template gallery | |
| Playwright setup + assertion conventions | Tests | See §8 |

### Do not reuse

`generator.ts` (1025 lines, all `#workskin`-scoped for rasterising),
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

`LinesRow` and `ImageUrlRow` stay in `SettingsSheet.tsx` — they pull in
`ImageUrlInput`, which the site-skin editor has no use for.

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

### Values — three branches, not one

`sanitize_css_declaration_value` picks a branch **in this order**, and only the
last two ever reach `VALUE_REGEX`. An earlier draft of this document treated
`VALUE_REGEX` as universal. It is not, and the difference decides whether every
template we ship is legal.

1. **`property == "font-family"`** → `sanitize_css_font`. Each comma-separated
   name, after downcasing and stripping `!important`, must match
   `^('?[a-z0-9\- ]+'?|"?[a-z0-9\- ]+"?)$`.
   - `'Palatino Linotype', Palatino, serif` ✅ — quotes, spaces and digits are fine.
   - A name containing a **period** (`"Foo.Bar"`), a slash, or an underscore ✗.
   - Never emit the **`font` shorthand**: it misses this branch, goes to the
     token path, and `'Palatino Linotype'` fails there.
2. **`property == "content"`** → `sanitize_css_content`: one fully-quoted
   string, a legal `url()`, or `none`. `var()` is rejected first.
   - **`content: "❦"` is safe.** The branch never consults `VALUE_REGEX`, so
     non-ASCII inside the quotes is irrelevant. The earlier draft flagged this
     as an unknown to probe manually; it is settled, and pinned by a test.
3. **Everything else** → `VALUE_REGEX`, which must match the *whole* stripped
   value as `^(VALUE_REGEX,?\s*)+$`. It admits transform functions, `url()`,
   `color-stop()`, colors (`#[0-9a-f]{3,6}`/named/`rgba()`/`hsla()`), numbers
   with units, bare keywords (`[a-z\-]+`), shape/filter/`drop-shadow()`
   functions, and `var()`.
   Shorthand properties take the token path first (split on space/comma, each
   token sanitized separately), which is why `border: 1px solid #4f4571` works.

**`color-mix()` is in none of those.** The prototype's preview leans on it
heavily. Resolve every mix to a literal 6-digit hex before emitting — the
prototype's `mixHex()` already does this and is ported to `colors.ts`.

Numbers are `-?\.?\d{1,3}\.?\d{0,3}`, which *looks* like a three-digit cap and
is not: the dot between the two digit runs is optional, so `1000` matches as
`100` + `0`. Do not tighten our check to three digits. We emit `999px` for
pill tags by convention, not necessity.

### Other hard rules

- `@font-face` is rejected outright.
- `!important` is always permitted, and is stripped before value checks.
- `var()` is rejected inside `content`.
- A rule set whose declarations are *all* dropped is an error
  (`:no_rules_for_selectors`), not a silent no-op. Never emit an empty rule.

### 3a. Image addresses — the rule that decides whether banners work

**Revision 3 reverses this document's earlier "v1 emits no `url()` at all".**
Reading three published skins (§11) made the case: a header banner is the one
change that makes a skin feel like a *fandom's* rather than a recolour, and it
is one declaration, not an architecture. The v1 line was drawn out of caution,
not necessity.

`url()` is permitted on `background`, `background-image`, `border`,
`border-image`, `list-style`, `list-style-image` — and only if the address
satisfies `URI_REGEX`:

```text
(\/images | https?://\w[\w\-.]+\.(TLD)) / [\w\-./]* [\w-] \.(jpg|jpeg|png|gif)
```

Three consequences, all of which our validator now reports in plain language
*before* the user pastes into AO3:

1. **No query strings.** `?` is not in `[\w\-./]`, so the match stops early,
   the closing quote never lines up, and AO3 refuses the whole skin. This
   kills Discord CDN, Google Drive and Dropbox links — which is where fandom
   actually keeps its images.
2. **jpg/jpeg/png/gif only.** No webp, no svg, no avif. Most modern CDNs serve
   webp by default.
3. **The TLD list is an old ICANN snapshot.** No `app`, `dev`, `xyz`, `art`,
   `pics` — and no `moe`, so `files.catbox.moe` cannot be used. `io`, `cc` and
   `co` are present, so `github.io`, `postimg.cc` and `ibb.co` all work.

> **Correction to revision 2.** `tests/ao3-css.unit.spec.ts` asserted that
> `background-image: url(x.png)` and `content: url(x.png)` were safe. Both are
> refused: a relative address has neither a scheme nor an allowlisted domain.
> The earlier lint only checked *which property* carried the `url()`, never the
> address inside it, so the tests encoded the gap rather than catching it.
> `/images/...` — AO3's own assets — is the one relative form that works.

**This validator is the feature, not the constraint.** Every published skin
hands the user a Pastebin and wishes them luck; AO3's own response to a bad
address is "your skin could not be saved", after they have left the app.
Saying "Discord links won't work, use imgur" at the moment of pasting is
something no competitor does.

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

**The mechanism, added 7 Aug 2026, because the danger is worse than "not
supported".** `clean_css_code` iterates `parser.each_rule_set do |rs|` — arity
**one**. The css_parser gem yields `(rule_set, media_types)`, so the media types
are discarded, and the sheet is rebuilt as bare `selectors { declarations }`
with no wrapper. **The rules survive; their condition does not.** A breakpoint
you write is not rejected — it is applied at every width.

This matters because it fails the check a developer would actually run. Paste a
`@media` block, look at the page, see your styling appear, conclude it works. A
widely-read community tutorial does exactly this and states "confirmed working
in AO3 workskins"; it is wrong. `lintAo3Css` refuses `@media` for this reason
and its message says so. Do not relax it.

### 3b. Our CSS is an *addition*, not a replacement

`Skin::ROLES` shows users exactly two roles: `user` ("add on to archive skin",
the default) and `override` ("replace archive skin entirely"). At role `user`,
`Skin#get_style` emits AO3's default stylesheets **and then ours**.

Two consequences, and they drive everything in §4b:

> **§14b limits the `!important` rule below to AO3's own chrome.** A work skin is
> rendered *after* our stylesheet and is `#workskin`-prefixed, so shouting at it
> overrides the author. Six selectors are now emitted quietly for that reason.

- **Source order favours us on ties, specificity does not.** AO3's defaults are
  full of ID- and class-scoped rules — `#dashboard.own`, `#header .heading a`,
  `.blurb h4 a:link`, `h1,…,h6,.heading`. A bare `body {…}` or `h1 {…}` from us
  loses to those outright. **Every declaration the compiler emits carries
  `!important`.** This is not defensive clutter; without it roughly half the
  skin silently does nothing on a real page.
- **AO3's defaults are still there, including the ones we did not think about**
  — a red tiled background image on `#footer`, `color: #fff` on footer text, a
  grey gradient on header dropdowns. §4 lists the ones that actually bite.

The export dialog must tell the user to leave the skin type on **"add on to
archive skin"**. Choosing "replace archive skin entirely" strips AO3's layout
CSS and our skin becomes unstyled HTML.

---

## 4. Defects in the prototype — do not port these

4.1–4.3 were found by reading `compileSkin()` against AO3's templates.
4.4–4.8 were found by reading it against AO3's *stylesheets*, and 4.4 is the
one that would have shipped a visibly broken skin.

> **§14a corrects this section.** Scoping to `#chapters` is necessary and not
> sufficient: the chapter body has parents of its own whenever it contains a work
> skin, and `:first-of-type` matches once per parent. Both details rules now use
> a child combinator. Read §14 before touching either selector.

**4.1 The drop cap lands on summaries and notes, not just the chapter.**
`#workskin p:first-of-type::first-letter` (prototype line 533).

`:first-of-type` matches the first `<p>` *within each parent*, not once per
page. Inside `#workskin` that is the summary blockquote, the chapter notes, and
every chapter body — so a decorative capital appears three or four times on a
normal work page.

Narrow it to the chapter text container. `works/show.html.erb` renders
`div.userstuff.module` per chapter for multi-chapter works and a bare
`div.userstuff` on the single-chapter path, both inside `#chapters`, so
`#chapters .userstuff` covers both:

```css
#chapters .userstuff p:first-of-type::first-letter { … }
```

**This is the one control that must be checked on a real AO3 work before
shipping** — multi-chapter and single-chapter both.

> **Correction to an earlier draft of this document.** It claimed `#workskin`
> exists only on works that already have a work skin, making these selectors
> dead. That was wrong: `app/views/works/show.html.erb` renders
> `<div id="work-skin" class="wrapper"><div id="workskin">` unconditionally.
> Site-skin rules targeting `#workskin` do apply on every work page. The defect
> is the `:first-of-type` scope above.

**4.2 "Page" colour is overridden by "Cards".** `#main` appears in two rules
with `background-color: … !important` — first `bg`, later `surface`. Equal
specificity, later wins, so the Page control only affects `body` and
`#outer.wrapper`. §4b gives each selector exactly one owner.

Verified upside: **AO3's default sets no background on `#main` at all**
(`05-region-main.css` sets only font-size, line-height, margin, padding,
min-height). Leaving `#main` unowned is therefore safe — `body` shows through,
which is exactly what the Page control should mean.

**4.3 Font size compounds.** `font-size: N%` is set on `body`, `#outer.wrapper`
*and* `#main` in one rule. Nested percentages multiply. Set the scale once, on
`body`; AO3's own `#header`/`#main` `0.875em` then scales with it.

**4.4 The header is accent text on an accent background.** The prototype emits
`#header { background-color: accent }` and, separately,
`a, a:link, a:visited { color: accent !important }`. `#header`'s links are
`a`. The site navigation is therefore invisible on every page.

The prototype's own preview hides this: its mock header hard-codes
`color: white` (line 116) while its export does not emit any header text
colour. This is precisely the two-renderings-that-disagree failure §5 exists to
prevent, and it is why the mock DOM must be driven by the exported CSS.

Fix: derive a header foreground from the accent (`readableOn(accent)`) and own
`#header`'s text and links with it. See §4b.

**4.5 The heading font never applies.** The prototype emits
`h1, h2, h3, h4, h5, h6 { font-family: … }` at specificity (0,0,1).
`02-elements.css` has `h1, h2, h3, h4, h5, h6, .heading { font-family: Georgia, serif }`,
which matches every AO3 heading through the `.heading` compound at (0,1,0) and
wins. Mirror AO3's own selector — include `.heading` — and use `!important`.

**4.6 The footer keeps its red tiled texture.**
`#footer { background: #900 url("/images/skins/textures/tiles/red-ao3.png") }`.
A `background-color` alone leaves the image on top of it. Emit
`background-image: none` on `#footer`. AO3 also hard-codes `color: #fff` on
`#footer`, `#footer a`, `#footer button` and `#footer .heading`, so the footer
needs an explicit foreground or it is white-on-cream on every light theme.

**4.7 The dashboard resists a background.**
`#dashboard.own { background: transparent }` at (0,1,1) beats a plain
`#dashboard` rule. `!important` settles it. `#dashboard a, #dashboard span`
also hard-code `color: #111`; the `a` is covered by the global link rule, the
`span` — AO3 uses it for the non-link current item — is not.

**4.8 System messages become unreadable on dark themes.**
`.notice` and friends set a pale blue background but no colour, so they inherit
the body text colour. Cream-on-pale-blue. One fixed rule pins them back to
`#2a2a2a`. Their backgrounds stay untouched: blue/yellow/red is AO3's
meaning-carrying colour code, not decoration. `.error` and `.alert.flash`
already carry their own `#900` and are left alone.

**Not a defect, but dropped: `.listbox li.blurb`.** The prototype pairs every
`li.blurb` selector with it. `11-group-listbox.css` sets only `display` and
`box-shadow` there, so `li.blurb` alone already reaches those blurbs. Redundant.

---

## 4b. Region ownership — the compiler spec

Every selector below has **exactly one** owning control, and every declaration
is emitted with `!important` (§3b). This is what stops defect 4.2 recurring. If
you need a selector to react to two controls, that is a design conversation,
not a second `!important`.

Derived values, all resolved to literal 6-digit hex before emission:

| Name | Formula | Why |
| --- | --- | --- |
| `headerFg` | `readableOn(accent)` | fixes 4.4 |
| `headerDeep` | `mixHex(accent, '#000000', 0.75)` | header border, dropdown panel |
| `border` | `mixHex(accent, surface, 0.27)` | card edges |
| `tagBorder` | `mixHex(accent, surface, 0.45)` | tag edges |

| Control | Owns | Emit |
| --- | --- | --- |
| `colors.background` | `body` | `background-color` |
| `colors.text` | `body` | `color` |
| `colors.surface` | `li.blurb`, `#dashboard` | `background-color`, `color` |
| `colors.surface` | `#workskin` | its own rule, and the one that yields to an author — §14b |
| `colors.surface` | `#footer` | `background-color`, `background-image: none`, `color` — 4.6 |
| `colors.text` | `#footer .heading`, `#footer button`, `#dashboard span` | `color` — 4.6, 4.7 |
| `colors.accent` | `#header` | `background-color`, `border-color` (`headerDeep`) |
| derived `headerFg` | `#header`, `#header a`, `#header a:visited`, `#header .heading a`, `#header .heading` | `color` — 4.4 |
| derived `headerDeep` | `#header .menu`, `#header .menu li`, `#small_login`, and the four hover/open selectors | `background-color`, `background-image: none`, `color: headerFg` |
| `colors.accent` | `a`, `a:link`, `a:visited`, `a.tag` | `color` |
| `colors.accent` | `h1`–`h6` and `.heading` inside `#main` | `color` |
| `colors.accent` | `a.tag:hover` | `background-color`, `color: headerFg` |
| derived `border` | `li.blurb`, `#dashboard`, `#workskin` | `border-color` |
| derived `border` | `#dashboard .current` | `background-color` |
| `typography.headingFont` | `h1`–`h6`, `.heading` | `font-family` — 4.5 |
| `typography.bodyFont` | `body`, `blockquote`, `address` | `font-family` |
| `typography.baseFontScale` | `body` **only** | `font-size` as a percentage |
| `shape.cardRadius` | `li.blurb`, `#dashboard`, `#workskin` | `border-radius` |
| `shape.tagStyle` | `a.tag` | `border`, `border-radius`, `padding` |
| `header.bannerUrl` | `#header` | `background-image`, `-position`, `-repeat`, `-size` |
| `header.bannerHeight` | `#header .heading` | `height` — AO3's header is two lines tall; without this there is nowhere for a banner to show |
| `header.hideLogo` | `#header .logo` | `display: none` |
| `header.textShadow` | `#header .heading a`, `#header .primary a` | `text-shadow`, using `headerShadow` |
| `shape.tagColors` | `li.warnings a.tag` + `dd.warning a.tag`, and the same pair for `relationship`, `character`, `freeform` | `color`, and `border-color` when the tag shape has a border |
| `details.divider` | `#chapters .userstuff > hr` | `border-top`, `::after` glyph — `>`, see §14a |
| `details.dropCap` | `#chapters .userstuff > p:first-of-type::first-letter` | `float`, `font-size`, `color` — `>`, see §14a |
| `details.scrollbar` | `::-webkit-scrollbar`, `-track`, `-thumb`, `-thumb:hover` | `width`/`height`, `background-color`, `border-radius` |
| *(fixed, uncontrolled)* | `.notice`, `.comment_notice`, `.kudos_notice`, `ul.notes` | `color: #2a2a2a` — 4.8 |

The banner sits on `#header` **with the accent still underneath it**, so a slow
or dead image degrades to the theme colour rather than to white.

`header.textShadow` and `header.textColor` are both emitted only when a banner
is present. Over a flat header the foreground is derived from the accent and
contrasts by construction, so a glow would be a control with no visible effect
and `textColor: 'auto'` is not a guess. Over an image it *is* a guess — we
cannot measure the brightness of a photograph — which is exactly why the
override has to exist. Without it, a dark banner under a light accent leaves
the title unreadable and the only other lever is the accent, which would
repaint every link on the site.

`blockquote, pre, address` carry AO3's own `font:` shorthand, which beats
inheritance from `body` — hence the explicit `blockquote, address` selector for
the body font. `pre` is left alone deliberately: code should stay monospace.

**Deliberately unowned: `#main`.** The prototype painted it twice. AO3's
default paints it not at all (4.2), so leaving it transparent lets the page
colour show through everywhere it should, and keeps "Cards" meaning cards.
Do not add a `#main` background.

**Deliberately unowned: system message backgrounds** (4.8), `#dashboard a:hover`
and `.flash`/`.error` colours. All are either meaning-carrying or not
representable in the mock DOM — see §10.

---

## 5. Architecture

```text
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
  ao3Properties.ts                   copied allowlist data
  mockPage.ts                        AO3-shaped mock markup + base CSS, 3 states
  colors.ts                          mixHex, luminance, contrast, readableOn, autoFix
  storage.ts                         key: ao3SiteSkinTheme
```

Pages Router, matching the rest of the app. Ignore the blueprint's
`app/routes/...` layout — that is App Router and would fork the codebase.

`/site-skin?template=<id>` opens the editor straight onto that template,
mirroring how `index.tsx` handles the same parameter. The examples gallery in
`public/` links to it, so a card lands you on the thing you clicked. An
unrecognised id falls through to the gallery rather than to a silent default:
a stale link should look like a wrong turn, not like a choice made for you.

### The preview must be an iframe

Compiled site-skin CSS targets `body`, `#header`, `#main`. Our current
`PreviewPane` injects a `<style>` tag straight into the page, which is only
safe because the generator's rules are all `#workskin`-scoped. Doing that here
would restyle our own application.

Use `<iframe srcdoc>`. Use `sandbox="allow-same-origin"` — **not** `sandbox=""`.
Scripts stay blocked either way, which is the isolation that matters, but
same-origin lets the parent reach `contentDocument` and patch a single
`<style>` element's `textContent` as the user drags a colour picker. With
`sandbox=""` every keystroke reloads the document: the preview flickers and the
reading pane jumps back to the top on every change. Regenerate `srcdoc` only
when the preview *state* changes; fall back to regenerating it if
`contentDocument` is unreachable.

The page's CSP (`next.config.js`) is inherited by `srcdoc` frames. It permits
`style-src 'unsafe-inline'` and the preview loads no external resources, so
nothing more is needed.

### One stylesheet, one truth

**The mock DOM must use AO3's real IDs and classes** — `#header`, `#main`,
`li.blurb`, `#dashboard`, `.userstuff`, `a.tag` — so that *the exact CSS we
export is the CSS that renders the preview*.

The prototype does not do this: its preview is driven by `--p-*` custom
properties while its export is a separately-built string. Two renderings that
can silently disagree is the precise failure this project just spent an audit
removing from the image pipeline — and defect 4.4 is what it costs.

Consequence: `compile(theme)` has one output, used by both. If a control has no
visible effect in the preview, it has no effect on AO3 either — the blueprint's
§5 rule becomes structurally enforced instead of aspirational.

**The second stylesheet in the iframe is AO3's, not ours.** `mockPage.ts` also
exports `AO3_BASE_CSS`, a transcribed subset of AO3's default sheets: the rules
our skin has to fight (`#footer`'s red tile, `.heading`'s Georgia,
`#dashboard.own`'s red bars, `a { color: #900 }`, `.landmark`'s invisibility).
It is loaded *before* the compiled skin, exactly as AO3 loads it (§3b), and it
is **never** part of the export. Without it the preview is unstyled HTML and
every specificity bug in §4 stays invisible until a user hits it.

### 5b. The mock DOM

Transcribed from otwarchive's templates (`layouts/application`,
`layouts/_header`, `layouts/_footer`, `users/_sidebar`, `works/_work_module`,
`works/show`, `works/_preface`, `chapters/_chapter`). Class names are AO3's, not
ours — that is the entire point. Fill with the prototype's sample fic copy.

Shell for all three states:

```text
body.logged-in > #outer.wrapper > ( #header.region,
                                    #inner.wrapper > [ #dashboard, ] #main.region,
                                    #footer.region )
```

The Browse state carries three blurbs (one long summary, one short, to test
wrapping), a `.notice`, and **one `li.dropdown.open` with its `.menu` panel
rendered** — that last is what makes the header dropdown rules in §4b
previewable rather than a leap of faith.

The Reading state uses the real nesting, which the §4b drop-cap and divider
selectors depend on:

```html
<div class="work">
  <div id="work-skin" class="wrapper">
    <div id="workskin">
      <div class="preface group">…summary blockquote…</div>
      <div id="chapters" role="article">
        <div class="chapter" id="chapter-1">
          <div class="userstuff module" role="article">
            <p>…</p><hr /><p>…</p>
```

Keep the summary blockquote. It is how a reviewer sees at a glance whether the
drop cap has escaped its container (defect 4.1).

The Dashboard state puts `#dashboard.region.own` as a sibling of `#main` inside
`#inner`, and includes a `<span>` current item (4.7) alongside the links.

---

## 6. Data model

```ts
// src/lib/siteSkin/theme.ts
export interface SiteSkinTheme {
  schemaVersion: 1;
  meta: {
    id: string;
    name: string;
    category: 'dark' | 'light' | 'minimal' | 'decorative';
    moods: readonly ('dark' | 'light' | 'minimal' | 'decorative')[];
  };
  colors: { background: string; surface: string; text: string; accent: string };
  typography: { headingFont: string; bodyFont: string; baseFontScale: number };
  shape: {
    cardRadius: string;
    tagStyle: 'pill' | 'label' | 'plain';
    tagColors: boolean;                // colour tags by type — §13
  };
  header: {
    bannerUrl: string;                 // '' = none; validated against §3a
    bannerHeight: string;
    hideLogo: boolean;
    textShadow: boolean;
    textColor: 'auto' | 'light' | 'dark';
  };
  details: {
    divider: boolean;
    dropCap: boolean;
    scrollbar: boolean;                // ::-webkit-scrollbar — §13
  };
}
```

`header.bannerUrl` is the only free-text field in the product and the only one
AO3 can refuse, so it is validated in three places against the same rule: as
the user types, at the storage boundary (`validateTheme` drops an address that
would fail, rather than letting a stored theme block export for no visible
reason), and in `lintAo3Css`, which makes the export dialog the last line of
defence.

`category` is the single badge on a card; `moods` is what the filter chips
match. They are separate because eight of the prototype's twelve templates are
honestly two things at once — Moonlit Library is dark *and* decorative — and
collapsing that to one value makes the filters lie.

Separate from `SkinProject`. Separate localStorage key. The two products never
share a settings object — that is the mistake the platform audit just spent
~60 deleted fields undoing.

Fonts are a fixed list of web-safe stacks (no `@font-face`, so no webfonts).
Always emit a fallback stack, and keep every family name inside
`[a-z0-9\- ]` (§3).

---

## 7. Build order

| Phase | Deliverable | Status |
| --- | --- | --- |
| 1 | `ao3Properties.ts` + `ao3Css.ts` + unit tests | ✅ built, then hardened with the font-family and value-grammar branches of §3 |
| 0 | Extract `SettingsRows.tsx` | ✅ five row primitives shared; `LinesRow`/`ImageUrlRow` left behind |
| 2 | `theme.ts`, `colors.ts`, `compile.ts`, 12 templates | ✅ every template's output passes lint |
| 3 | `mockPage.ts` + `SkinPreview.tsx`, 3 states | ✅ real AO3 selectors, iframe isolated, AO3's base CSS loaded first |
| 4 | `ThemeEditor.tsx`, four control groups + contrast | ✅ two readability checks, each with its own fix |
| 5 | `TemplateGallery.tsx` | ✅ mood chips, thumbnails share `derive()` with the compiler |
| 6 | `ExportSkinDialog.tsx` + picker card + route | ✅ copy blocked while the lint fails |
| 7 | A11y, tests, **manual AO3 save of every template** | ⬜ **the remaining gate** — see §8 |
| 8 | Header banners, hide-logo, URL validator, 4 banner-ready presets | ✅ 16 templates; see §3a and §11 |
| 9 | Tag colours by type, themed scrollbars, banner-hosting copy, the Phase 7 checklist file | ✅ 13 Aug 2026; see §13 |
| 10 | **Fix:** details rules scoped to direct children, `!important` withdrawn from six selectors, work skin added to the preview | ✅ 13 Aug 2026 — a defect found on a live page; see §14 |

### Corrections made to `ao3Css.ts` after Phase 8

Two bugs in the safety layer, both found by pointing it at CSS it had not been
written for. Both are the *same* failure — being stricter than AO3 — which is
the one this file must not have, because it blocks working CSS and looks like
the archive's fault:

- **The value tokeniser split on commas without respecting parentheses**, so
  `rgba(255, 255, 255, 0.5)` became four broken tokens and was rejected. AO3's
  `tokenize_and_sanitize_css_value` scans to the matching close paren. Fixing
  it dropped the false-positive count on the generator's stylesheet from 36 to
  19.
- **`url()` values were never checked at all** — only the *property* carrying
  them was. `tests/ao3-css.unit.spec.ts` had asserted that
  `background-image: url(x.png)` and `content: url(x.png)` were safe. Both are
  refused: a relative address has neither a scheme nor an allowlisted domain.
  The tests encoded the gap rather than catching it.

`lintAo3Css` also gained a `mode` parameter (`'site'` | `'work'`). Site is the
default and is unchanged.

### Correction 3 — the address validator was too *loose* (7 Aug 2026)

Found by re-verifying against `master` rather than by a failing test, and it is
the opposite failure from the two above: **`AO3_URI` was unanchored.**

AO3 anchors the address by construction rather than with anchors — `URI_REGEX`
sits inside `URL_FUNCTION_REGEX` as `url\(\s*` … `\s*\)`, so it must begin
immediately after the paren and be fully consumed before it closes. Ours was a
bare substring test, so the `\/images` alternative matched *inside* a path and
green-lit six shapes AO3 refuses:

| Address | Why AO3 refuses it | Why we accepted it |
| --- | --- | --- |
| `https://cdn.example.xyz/images/banner.png` | `.xyz` is not in the TLD list | `/images/banner.png` matched on its own |
| `https://evil.app/images/x.jpg` | `.app` is not in the list | same |
| `https://nope.moe/images/a.gif` | `.moe` is not in the list | same |
| `javascript:alert(1)/images/x.png` | no scheme | same |
| `https://ok.com/a.png extra-junk` | trailing junk — the paren never lines up | unanchored tail |
| `https://ok.com/a.png"); body{display:none}` | same | same |

These are **false accepts**, which is the quieter failure and the worse one for
the user: §3a's whole promise is that we catch a bad address *before* they
leave the app, and instead we would have sent them to AO3 to be told "your skin
could not be saved". Anchoring both ends takes the divergence against a
faithful port of `URL_FUNCTION_REGEX` to zero across all fourteen probes.

A second, smaller fix went in alongside: the diagnostic checked the file
extension before the character set, so `…/a.png extra` was reported as *"AO3
doesn't accept .png extra images"*. The character-set check now runs first and
says the true thing about spaces and symbols.

Pinned by two tests in `tests/ao3-css.unit.spec.ts`. Note that neither of the
last two rows is an AO3 exploit — the archive rejects them — but until this fix
our own preview iframe would have rendered the broken-out CSS.

### Correction 4 — the at-rule checks ran before comments were stripped (7 Aug 2026)

`lintAo3Css` searched the **raw** stylesheet for `@font-face` and `@media`, then
stripped comments afterwards for the rule walk. So a stylesheet whose *comment*
mentioned either word was refused.

AO3 never sees a comment: css_parser hands `clean_css_code` rule sets, and the
`@font-face` check runs against a **selector**. A comment explaining why we
avoid `@media` is completely acceptable to the archive. This is the
stricter-than-AO3 direction again — the third such bug in this file, and the
same root cause as Correction 1.

It surfaced when the Twitter work skin's stylesheet grew a comment explaining
its `em` conversion, which mentioned `@media`; the whole platform stopped
linting. Comments now come off first.

Worth knowing how contagious the mistake is: the same oversight then appeared
**twice more** in the test written to pin the fix — once reading "a 16px base"
from a comment as a stray pixel value, once reading `0.9375em` out of a comment
that existed to warn about four-decimal values. **Strip comments before you
pattern-match a stylesheet.**

### What still needs a human

- **Save all sixteen templates on AO3.** (Phase 8 raised the catalog from 12 to
  16; this line said "twelve" until 7 Aug 2026.) The sanitizer is the only authority,
  and our lint is a model of it. Until that checklist is filled in, "AO3-safe"
  is a well-tested prediction rather than an observation.
- **Check the drop cap and divider on a real work**, single-chapter *and*
  multi-chapter. §4.1 is the one selector whose scope our mock can only
  approximate.
- Known rough edge: on a phone the preview scrolls sideways rather than
  scaling AO3's desktop layout down to fit. It is usable; it is not elegant.
  Scaling was left out rather than added untested at the end.

### Marketing pages, corrected alongside this

`public/ao3skingen.wordfokus.com.txt` (the SwipePages source) and
`public/examples-gallery.html` described the app as a **work skin** generator.
It has never made one: `buildCSS`/`buildHTML` only fed the preview and the
capture, and the export uploaded a PNG. Three false claims were fixed — the
work-skin framing, "Export CSS, HTML, or Images", and "Your Data Never Leaves
Your Browser" (the AO3 flow uploads to ImgBB, which the privacy policy already
disclosed correctly).

Both pages now describe two products and say plainly that **neither is a work
skin**, which is the distinction an AO3 user arrives confused about. The
gallery gained the 16 site-skin templates — generated from the real catalog by
a throwaway script rather than hand-transcribed, so the page cannot drift from
what ships — and its "Try This Style" buttons, which previously only logged
`"implement later"` to the console, now deep-link to `?template=<id>`.

Since Phase 8 the conversation generator *does* emit a real work skin for two
platforms. The marketing copy has **not** been updated to mention it.

The catalog is the prototype's 12 templates — they are well chosen and already
carry exactly our field set.

### Phase 1 is already built, and was extended by this revision

The safety layer is the piece where being wrong is silent and expensive, so it
ships with this document rather than being described by it:

| File | What |
| --- | --- |
| `src/lib/siteSkin/ao3Properties.ts` | AO3's 181 properties and 20 shorthands, copied verbatim from `config.yml`, dated |
| `src/lib/siteSkin/ao3Css.ts` | `isPropertyAllowed()`, `lintAo3Css()`, `isAo3Safe()` |
| `tests/ao3-css.unit.spec.ts` | the pinned rules |

Revision 2 adds the two value branches the first pass missed (§3): a
`font-family` check mirroring `sanitize_css_font`, and a `VALUE_REGEX`
approximation for everything else, so an illegal font name or a four-digit
pixel value is caught at build time rather than by AO3.

Run it with `npx playwright test --project=unit` — no browser, no server.
The `unit` project exists in `playwright.config.ts` for exactly this.

Writing the tests caught two errors in an earlier draft of this document
(`grid-template-columns` is allowed, and `content: url()` is allowed because
AO3 branches on `content` before the url gate). Treat the tests, not this prose,
as the specification.

---

## 8. Testing

Automatable, and therefore required:

- **Allowlist unit tests** — `ao3Css.ts` against the verified property rules,
  including the substring quirks (`column-gap` ✅, `gap` ❌) and the three
  value branches.
- **Lint every template's compiled output** — no template ships that cannot
  pass AO3.
- **Ownership assertions** — one owner per selector. Assert that `#main` never
  receives a background, that `font-size` appears exactly once, and that every
  emitted declaration carries `!important`. These are the three defects of §4
  turned into tests.
- **Contrast tests** — the WCAG ratio maths, plus the "Fix text colour" action.
- **Playwright**: gallery → editor → each preview state → export → copy.
  Follow `tests/settings-render.spec.ts`: assert the compiled CSS actually
  contains the changed value, not merely that a control moved.

Note that `playwright.config.ts` points the browser projects at the deployed
site. Run the site-skin browser spec against a local build with
`UX_BASE_URL=http://localhost:3000 npx playwright test --project=desktop
tests/site-skin.spec.ts` while `npm run dev` is up. The unit project needs
neither.

Not automatable, and therefore a release gate:

- **Save every launch template on AO3 by hand** and confirm it applies. AO3's
  sanitizer is the only authority. Record results in a checklist.
- Specifically probe: the `#chapters .userstuff` selectors from §4.1 on both a
  single-chapter and a multi-chapter work, and the header dropdown from §4.4
  with a real logged-in account.

---

## 9. Two indicators, not one

The prototype's "AO3-safe" pill flips to "1 readability warning" — conflating
sanitizer safety with contrast. They are unrelated:

- **AO3-safe** — does the compiled CSS pass our allowlist lint? Blocks export.
- **Readability** — does text meet contrast against page and cards? Warns,
  offers a direct fix, never blocks.

A user should never be told their skin is unsafe because it is low-contrast, or
safe because it is readable.

Readability checks two things, not one. Text against page and cards is the
obvious one. **Accent against cards** is the one the prototype misses: every
link, tag and heading on the page is accent-coloured, so a dark accent on a
dark surface makes the archive unusable while the text check stays green. Each
warning carries its own one-click fix.

---

## 10. Scope discipline

Before adding a control, the blueprint's §19 test still applies, plus one of
ours: **it must be expressible in the allowlist and visible in the mock DOM.**
If it cannot be previewed honestly, it cannot ship. This rule is what put the
open header dropdown and the `#dashboard span` into the mock instead of letting
their rules ship unverified — and what keeps `#dashboard a:hover` out.

Explicitly out of v1: work skins, raw CSS editing, webfonts, `@media`
variants, sharing, accounts. (Background images moved *in* — see §3a and §11.)

---

## 11. What the published skins taught us

Three site skins distributed as AO3 works, read against the sanitizer:

| | Shape | Install |
| --- | --- | --- |
| [Hello Kitty](https://archiveofourown.org/works/56749162) (e_o_n_s) | One file on Pastebin | copy → paste |
| [Mha Site Skins](https://archiveofourown.org/works/74457591) (Mylover) | ~100 hand-written lines in the chapter text | copy → paste |
| [Rosé Pine](https://archiveofourown.org/works/69993411) (BlackBatCat) | 4,544 lines / 104KB on GitHub, forked from `neos` by ZerafinaCSS | **six skins, chained by hand** |

**Adopted.**

- **Header banners and a hidden logo** — MHA's whole identity is
  `#header { background-image: url(…tumblr…jpg) }`, `#header .heading { height: 15em }`
  and `visibility: hidden` on the logo. One declaration each; see §3a and §4b.
- **Aesthetic presets tuned for a banner**, not fandom-named ones. MHA
  hotlinks what is almost certainly somebody's fan art. That is one reader's
  choice for their own browser; shipping it as a product feature would make us
  the distributor of both a trademark and an artwork. **We ship no images.**
  The fandom specificity comes from the address the user pastes.

**Deliberately not adopted.**

- **Rosé Pine's parent-skin chain.** Base (structure, all `var(--bg5)`) →
  theme (`:root` colours only) → tag mod → tablet → mobile → a chaining skin
  whose CSS body is the placeholder `.rose-pine {opacity: 1;}` purely so AO3
  accepts it. It is how they get responsive breakpoints and automatic
  light/dark, and it confirms our §3 reading that `@media` lives on the skin
  record. It also turns one-click copy into a six-skin manual install, which
  is the opposite of the three-minute promise. If we ever do it, the
  complexity belongs entirely in the export dialog.
- **Their surface area.** 4,544 lines against our ~130. AO3 permits far more
  than we use — flexbox (29 `display:flex` in Rosé Pine, plus `order`,
  `align-items`, `justify-content`), gradients, attribute selectors like
  `[class^=relationship]` for colouring tags by type, and full icon-sprite
  replacement via `url()`. Chasing it means becoming a page builder and §10
  stops holding.

**Worth taking next, in this order.** Tag colours *by type* — the
`--tag-fandom-bg` / `--tag-warning-bg` / `--tag-character-bg` family is the
most-requested AO3 customisation, it is semantic rather than decorative, and
it is previewable in the Browse mock. **Shipped in Phase 9** (§13), as literal
colours derived from the accent rather than as custom properties. Then
`.site-skin-metadata { content: "…" }`,
which is how Rosé Pine smuggles attribution past a sanitizer that strips
comments — our own header comment is deleted the moment a user submits.

**One divergence to keep in view.** Rosé Pine relies on 8-digit hex
(`#89797925`) in shadows. That appears to pass AO3 only by accident — the
regex matches `#897979` and then `25` as a bare keyword. Our lint rejects it,
which makes us *stricter* than AO3, against the "never tighten" rule of §3. It
does not bite while we emit no alpha colours, but it is a known gap.

**Where we already win.** Every one of these is copy-paste-and-hope. Rosé Pine
ships ~20 static PNG previews because it has no other way to show you, and its
own instructions tell users to keep a master copy in Notepad *because AO3
mangles the CSS on save*. We are the master copy: the theme lives in storage
and is regenerated, never hand-edited.

---

## 12. Handoff — and what the work-skin research does and does not change

**Written 7 Aug 2026**, after reading a dozen published work skins, AO3's own
FAQs and two community tutorials for the *other* product. The obvious question
is whether any of it lands here. Mostly it does not, and knowing precisely why
is the useful part.

### The audit

Every shipped template was recompiled and counted, not eyeballed:

| | Result |
| --- | --- |
| Templates shipped | 16 |
| Lint violations, all templates | **0** |
| `display: flex` emitted | 0 |
| `@media` emitted | 0 |
| `var()` / custom properties emitted | 0 |

**No code change is required by anything learned for work skins.** What follows
is guidance, plus one stale number that has been corrected (§7 said "twelve
templates"; it is sixteen).

### What carries over

| Finding | Applies here because |
| --- | --- |
| **`@media` is flattened, not rejected** — the condition is silently dropped | Same `clean_css_code` path. Now documented with the mechanism in §3; the lint already refuses it |
| **AO3 deletes comments** | Same. §11 already notes our header comment never reaches the archive; the `content:` attribution trick is the only thing that survives |
| **Strip comments before pattern-matching CSS** | Bit `lintAo3Css` directly — Correction 4 in §7 |
| **The URL validator was too loose** | Correction 3 in §7. This is a site-skin feature: banner addresses |
| **Image hosts fail, and take published work with them** | A published skin's author blew a free-tier quota and every image in every fic using it broke at once. Our banner feature points users at *their* host. The export dialog should say: use imgur or postimg, not a quota-limited account |

### What is work-skin-only — do not import it

| Work-skin rule | Why it does not apply here |
| --- | --- |
| **"Never use flexbox"** | The loudest rule over there, and it is **not a site-skin rule**. The sanitizer demonstrably keeps `display: flex`. The working hypothesis for why it fails in work skins is AO3's `<p>` injection into *user-pasted chapter HTML* — which does not exist here, because a site skin styles AO3's own DOM. §11 already observes Rosé Pine using flex 29 times successfully; that now has an explanation rather than being an anomaly |
| **Enumerated variant classes** (`.p1`…`.p100`, `.light`/`.dark` pairs) | An elaborate workaround for work skins banning `var()`. **Site skins permit custom properties and `var()`** — we have the better tool and simply do not use it yet. Do not copy the enumeration pattern here |
| **Paragraph resets, the one-line rule, the `<!--- --->` comment trick** | All defences against AO3 rewriting *user-pasted HTML*. We emit no HTML |
| **`.visually-hidden` / skin-off prose** | A work skin is absent on every download. A site skin is a preference the reader chose and can switch off; there is no "downloaded with the skin missing" state |
| **html2canvas cannot render `::before`/`::after`** | Only constrains the shared stylesheet feeding the PNG export. Nothing here passes through html2canvas, which is why §4b's `::after` divider glyph is fine |

### Newly proven, and available to us

Read out of CSS AO3 is currently serving, so these are known-legal:

- **`:has()`** — 111 occurrences in one served skin. Would let a rule react to
  page state without JavaScript.
- **`<details>` / `[open]`** — 175 and 213 occurrences. Not obviously useful for
  restyling AO3, since we do not control the markup.
- **`::-webkit-scrollbar`** — legal, though not for the reason first written
  here; **shipped in Phase 9**, see §13 for the corrected mechanism.
- **`clip: rect(0,0,0,0)`** — `clip` is on the property list and `rect()` reaches
  `VALUE_REGEX` through `SHAPE_FUNCTION_REGEX`.

### The state of this product, as of 7 Aug 2026

> **Superseded by §15.** Kept because the *reconciliation* above — what work-skin
> research does and does not carry over — is still current and is the reason this
> section exists. For state and next steps, read §15.

| | Status |
| --- | --- |
| Compiler, editor, gallery, export | ✅ Phases 0–6, 8 and 9 complete |
| 16 templates lint clean | ✅ |
| Saved on real AO3 | ❌ **never** — the open gate |
| Mobile preview | ⚠️ scrolls sideways rather than scaling |
| Marketing copy mentions the work-skin export | ❌ still not |

---

## 13. Phase 9 — the three things §12 said to do next

**Built 13 Aug 2026.** §12 named four next steps and one of them needs a human.
The other three are in, plus the checklist file that the release gate was
missing.

### Tag colours by type

The most-requested AO3 customisation, and semantic rather than decorative: the
colour tells you what kind of tag you are reading before you read it. One
toggle, `shape.tagColors`, on for every template except the six carrying the
`minimal` mood — four tag hues is exactly what a reader choosing "minimal" is
asking us not to do.

Two things were not obvious going in:

- **AO3 marks the type up in two different places.** A listing puts it on the
  `li` (`li.warnings a.tag`, `works/_work_module`); a work page puts it on the
  `dd` (`dd.warning a.tag`, `works/_meta`). Emitting only the first colours half
  the site, and the half nobody would notice missing is the work page. Both are
  now in the mock — the Reading state gained a real `dl.work.meta` table — so
  both are watchable rather than taken on trust (§10).
- **The four hues have to be derived, and then made legible.**
  `colors.tagTypeColors()` starts from four fixed anchors — red, rose, blue,
  green, chosen for the meaning readers already attach to them — pulls each 62%
  of the way toward the theme's accent, then runs it through the existing
  `fixAccent` so it clears 3:1 against both the page and the cards. Without that
  last step this control would make a page *harder* to read than the accent it
  replaces: a red tag on a Gothic Velvet card sits below the bar. A test asserts
  the floor for all four types across all sixteen templates, and that the four
  stay distinct.

### Themed scrollbars

`details.scrollbar`, on for all sixteen. Four rules:
`::-webkit-scrollbar`, `-track`, `-thumb`, `-thumb:hover`.

§12 said this was legal "because `scrollbar` is on the shorthand list", which is
the right answer for the wrong reason — the shorthand list is about *properties*
and `::-webkit-scrollbar` is a *selector*. Re-read against `css_cleaner.rb`:
**AO3 never validates a selector.** `clean_css_code` maps `rs.selectors` through
a newline strip, an `&gt;` unescape and a prefix test, refusing only a selector
containing `@font-face`. So the pseudo-element passes through untouched and the
declarations inside are ordinary `width` / `background-color` / `border-radius`.
Chromium-only by nature, which is why the control says so and why the off state
emits nothing at all. **P8 in the checklist is what turns that reading into an
observation.**

### Banner hosting, in the export dialog

One section, shown only when a banner is set — AO3 links to the image rather
than storing a copy, so the skin outlives the picture only if the host does. It
names imgur and postimg, says to keep the original file, and says the thing
nobody else says: a hotlink is someone else's artwork and someone else's
bandwidth. The failure it prevents has already happened to a published skin
(§12).

Found while editing that file: the theme-backup section had been nested **inside
the dialog's dark title bar**, in a `flex items-center justify-between` row.
Moved into the scrolling body where it belongs. `tests/project-backup.spec.ts`
still passes — it locates the buttons by role, which is why it never caught the
placement.

### What it cost

No change to `ao3Css.ts`, no new value shapes, no new `url()`. All 270 unit
tests pass, 19 site-skin browser tests pass against a local build, and the
three new browser tests assert the *compiled CSS* changed, not that a switch
moved.

---

## 14. The defect that shipped — a site skin vandalising a work skin

**13 Aug 2026, found on a real AO3 page**, hours after Phase 9 deployed. A work
using the conversation generator's own work skin, viewed by a reader with
Moonlit Library on: **a floated 4em drop capital on every chat bubble, every
caption and every footer line in the work.** The screenshot is
`tester skn - Proverbialfun - No Fandom [Arc-mh.png`.

Two separate mistakes, one visible and one structural. Both are the same
misjudgement — treating "inside a work" as our territory.

### 14a. `:first-of-type` matches once per parent, and a work skin is all parents

`#chapters .userstuff p:first-of-type::first-letter` — the §4.1 selector, and
§4.1 was **right about the mechanism and one level short on the scope**. It
reasoned about the summary and the notes, which are siblings of the chapter, and
concluded that scoping to `#chapters` was enough. It is not: the chapter body
itself contains as many parents as the author pasted into it, and a work skin is
precisely a tree of nested divs each holding a `<p>`. Every one of them is a
`:first-of-type` match.

Fixed by scoping both details rules to **direct children**:

```css
#chapters .userstuff > p:first-of-type::first-letter { … }
#chapters .userstuff > hr { … }
```

This degrades the right way. Prose opens with a top-level `<p>` and still gets
its capital; a chapter that opens with a work skin's container gets nothing,
which is the correct amount of our decoration to put inside someone else's
design. **`:first-child` would not work** — AO3 renders
`<h3 class="landmark heading">Chapter Text</h3>` first, so the opening paragraph
is never the first child.

The `hr` rule had the same latent bug and was fixed the same way: an author's own
rule inside their markup no longer gets our ornament welded onto it.

### 14b. `!important` on everything means we always beat the author

The deeper one. §3b's argument for blanket `!important` is sound and is about
**AO3's chrome** — `#dashboard.own` and friends outrank us on specificity. It
says nothing about work skins, and nobody noticed that the same hammer lands on
them:

- AO3 renders a work skin **in the page body** — `works/show.html.erb` has
  `<div id="work-skin"><%= render "works/work_skin" %></div>` — so it is *later*
  in the document than our stylesheet in `<head>`.
- AO3 prefixes every work-skin selector with `#workskin`, so the author carries
  an ID we do not.

The author therefore beats us on **both** source order and specificity — unless
we shout, and then we beat them on nothing but volume. A reader's colour scheme
was silently rewriting authors' layouts.

`Rule.authorWins` now marks the rules that can land inside a work, and they are
emitted **without** `!important`. Each was checked against the AO3 default it
still has to overcome, and wins that on specificity or order alone:

| Rule | Beats AO3's default because | Loses to |
| --- | --- | --- |
| `blockquote, address` | AO3's font comes from `blockquote, pre, address { font: 1em … }` at (0,0,1); ours is (0,0,1) and later. `.userstuff blockquote` sets margins and a border, no font | `#workskin blockquote.note` (1,0,1) |
| `#workskin` | AO3 paints it not at all — it is only the container | the author's own `#workskin` rule, later in the document |
| `#chapters .userstuff > hr` and `> hr::after` | (0,2,2) against `.userstuff hr` (0,1,1) | `#workskin hr` (1,0,1) |
| `#chapters .userstuff > p:first-of-type::first-letter` | nothing in AO3 styles `::first-letter` | any `#workskin` rule the author writes |

`#workskin` was split out of the `li.blurb, #dashboard` card rule so it could be
the one that yields. A reader still gets their card colour on every work with no
skin, which is nearly all of them.

**What keeps its `!important`, deliberately.** Links, headings and the chrome
regions. `a { color }` has to beat `.blurb h4 a:link` (0,2,1) or every work
title in a listing stays AO3 red, and there is no way to win that without
shouting. So a reader's link and heading colours do reach inside works. That is
ordinary site-skin behaviour — it is what the reader asked for, it is what AO3's
own skins do, and it changes colour rather than layout.

### 14c. Why the preview did not catch it

Because the preview contained no work skin. The Reading mock was clean prose,
which is the one kind of chapter these selectors cannot hurt. §5's "one
stylesheet, one truth" makes the preview honest about *our* CSS; it said nothing
about the CSS underneath ours.

Two changes, both permanent:

- **The Reading mock now contains an author's work skin** — nested bubbles, a
  caption, an author `<hr>`, and a deliberately opinionated Courier blockquote —
  shaped like the conversation generator's output, since that is the work skin
  most likely to be under one of our site skins.
- **`mockDocument` now loads three stylesheets in AO3's real order**: AO3's
  defaults, our compiled skin, then `AUTHOR_WORK_SKIN_CSS`. The third one is the
  point. With the author's CSS in its real position, "does our skin trample the
  author's work?" is a question you can answer by looking.

Regression tests, both verified non-vacuous by reverting the fix and watching
them fail: a browser test counts what the selectors actually reach in the DOM and
reads `getComputedStyle(el, '::first-letter')` on both a chapter paragraph and a
bubble paragraph (56px vs 14px before the fix), and asserts the author's Courier
blockquote survives; a unit test enumerates the six author-wins selectors and
pins that every other declaration still carries `!important`.

### 14d. Fixed alongside, found in the same screenshot

The header dropdown panel was visible in **every** preview state, sitting on top
of the work in Reading. `AO3_BASE_CSS` had transcribed the rules that *show* an
open menu but never the `display: none` that hides a closed one, so the
`openDropdown` flag's "opens in Browse only" contract had been false since Phase
3. Now transcribed.

### What this says about the release gate

Every one of these was invisible to 273 passing unit tests and to a preview that
matched the export exactly, and visible within minutes of a real reader opening
a real work. **The mock is a model of AO3, and a model of AO3 with no work skin
in it was a model of the wrong page.** `docs/SITE-SKIN-AO3-CHECKLIST.md` gained a
probe: P10, the drop cap and divider over a work that has its own work skin.

---

## 15. Handoff — 13 Aug 2026

Everything a person picking this up needs, in the order they need it. Where a
claim has a longer story, the section number is the story.

### 15a. Where the product stands

| | |
| --- | --- |
| Deployed | ✅ `main` → Netlify, at `/site-skin`. Commits `f2bc76c` (Phase 9) and `5c47eda` (the §14 fix) |
| Phases 0–6, 8, 9, 10 | ✅ complete |
| Phase 7 — **saved on real AO3** | ❌ **never done.** The one open gate |
| Templates | 16, all lint clean, all round-tripping through storage |
| Tests | 273 unit (`--project=unit`), 20 browser (`tests/site-skin.spec.ts`) |
| Mobile preview | ⚠️ scrolls sideways instead of scaling. Known, deliberate |
| Marketing copy | ⚠️ correct about site skins; still silent on the work-skin export |

**What "not saved on real AO3" means, precisely.** Our lint is a faithful port of
`clean_css_code`, re-verified against upstream twice, and it is still a *model*.
No template in this catalog has been pasted into AO3 and submitted. Until
`docs/SITE-SKIN-AO3-CHECKLIST.md` is filled in, every "AO3-safe" claim in the UI
is a well-tested prediction. **This is the single highest-value thing left, and
it needs a human with an account, not a test.**

### 15b. The file map

| File | What it is | Touch it when |
| --- | --- | --- |
| `src/pages/site-skin.tsx` | route; gallery ⇄ editor, undo/redo, debounced save, one `compile()` call feeding both preview and export | adding page-level state |
| `src/lib/siteSkin/theme.ts` | `SiteSkinTheme`, the option lists, `validateTheme` (the storage boundary) | adding a control — **and then all 16 templates** |
| `src/lib/siteSkin/compile.ts` | theme → CSS. `derive()` for everything computed, `buildRules()` for the spec in §4b, `serialize()` for `!important` | any change to emitted CSS |
| `src/lib/siteSkin/colors.ts` | mix, luminance, contrast, `readableOn`, `fixAccent`, `tagTypeColors` — all colour maths, resolved to literal hex because AO3 has no `color-mix()` | deriving a colour |
| `src/lib/siteSkin/ao3Css.ts` | **the safety layer.** Property allowlist, value grammar, URL validator, lint. **The work-skin product imports this too** | never casually; see §15e |
| `src/lib/siteSkin/ao3Properties.ts` | AO3's 181 properties, 20 shorthands, 270 TLDs, copied verbatim and dated | re-verifying against upstream |
| `src/lib/siteSkin/mockPage.ts` | the preview's DOM in AO3's markup, AO3's base CSS, and an author's work skin — three stylesheets in AO3's real order (§14c) | adding a control that must be previewable |
| `src/lib/siteSkin/templates.ts` | the 16-template catalog, descriptions, `cloneTheme` | adding a theme or a field |
| `src/lib/siteSkin/storage.ts` | key `ao3SiteSkinTheme`, `PersistResult` discipline | never, ideally |
| `src/components/siteSkin/*` | `TemplateGallery`, `ThemeEditor`, `SkinPreview`, `ExportSkinDialog` | UI |
| `tests/site-skin.unit.spec.ts` | the compiler's contract: ownership, cascade, contrast floors, validation | always, alongside the change |
| `tests/site-skin.spec.ts` | the journey, and every assertion checks the **compiled CSS**, not that a control moved | always |
| `tests/ao3-css.unit.spec.ts` | the sanitizer model's pinned rules | with `ao3Css.ts` |
| `docs/SITE-SKIN-AO3-CHECKLIST.md` | the Phase 7 gate, unfilled | when you have an AO3 account open |

### 15c. The five invariants

Each is enforced by a test, and each exists because breaking it produced a bug
that a diff review did not catch.

1. **One owner per (selector, property).** A selector may appear in two rules,
   never for the same property. §4.2 is what happens otherwise — the Page colour
   control silently stopped working.
2. **`!important` on chrome; never on anything that can land inside a work.**
   Six selectors are enumerated in the test. §14b is the whole argument; the
   short version is that AO3 renders a work skin *after* our stylesheet and
   prefixes it with `#workskin`, so shouting is the only way we could override an
   author, and we must not.
3. **The preview renders the exported string.** One `compile()`, no second
   rendering path. The prototype had two and shipped an invisible header (§4.4).
4. **If it cannot be previewed honestly, it does not ship.** This is what put the
   open dropdown, `#dashboard span`, the work-meta table and the author's work
   skin into the mock. §14c is the cost of forgetting it.
5. **Never be stricter than AO3.** Four separate bugs in `ao3Css.ts` were this
   (§7). Being stricter blocks CSS the archive accepts, and the user has no way
   to tell we are the ones who are wrong.

### 15d. How to run it

```bash
npm run dev                      # localhost:3000/site-skin

npx playwright test --project=unit          # 273 tests, no browser, no server
npx playwright test --project=unit tests/site-skin.unit.spec.ts

# Browser projects point at the DEPLOYED site by default. For local work:
UX_BASE_URL=http://localhost:3000 npx playwright test --project=desktop tests/site-skin.spec.ts

npx tsc --noEmit -p tsconfig.json
```

Adding a control is a five-file change, in this order: `theme.ts` (field +
`validateTheme`), `templates.ts` (**all 16**), `compile.ts` (rules, and decide
`authorWins`), `mockPage.ts` (something for it to style), `ThemeEditor.tsx`, then
both specs. If you cannot see it in the preview, stop — invariant 4.

### 15e. Traps, each of which has already been paid for

- **Strip comments before you pattern-match CSS.** Four wrong answers in this
  codebase came from not doing it, twice inside the tests written to fix it (§7,
  Correction 4).
- **The export carries no comments at all.** AO3 deletes them, and a work skin
  saved with comments came back missing eleven consecutive rules (WORK-SKIN §13).
  Do not reintroduce them without saving on real AO3 and diffing.
- **`@media` is flattened, not rejected.** The rules survive and the condition is
  dropped, so it *looks* like it works. A widely-read tutorial says it does. It
  does not (§3).
- **AO3 validates declarations, never selectors** — only `@font-face` in a
  selector is refused. That is why `::-webkit-scrollbar` is legal (§13), and it
  also means a mistaken selector will be stored happily and go wrong quietly.
- **`:first-of-type` matches once per parent.** §14a. The chapter body is full of
  parents whenever an author has pasted a work skin into it.
- **`!important` beats the author, not just AO3.** §14b.
- **The value grammar's number rule is not a three-digit cap.** `1000` matches as
  `100` + `0`. Do not "fix" it (§3).
- **`gap` is refused while `grid-template-columns` is allowed.** An unanchored
  substring test. Faithful, and pinned (§3).

### 15f. What to do next, in order

1. **Phase 7 — the release gate.** `docs/SITE-SKIN-AO3-CHECKLIST.md`: sixteen
   templates × saved/applied/readback, then ten named probes. **Do P10 first** —
   read a work that has its own work skin with a site skin on. That is the class
   of bug that already escaped, and it is the one our tests model least well.
   While you are in AO3's editor, reopen each saved skin: AO3 stores the
   *cleaned* CSS, so that box is a direct readout of what the sanitizer kept.
   Anything missing is a rule our lint does not know about, and belongs in §7 as
   a numbered correction.
2. **Whatever the gate finds.** Assume it finds something.
3. **Tag colours *within* a listing's required tags** — `ul.required-tags` uses
   sprite-backed spans rather than `a.tag`, so the Phase 9 work does not reach
   the rating/warning icons. Previewable, and the same semantic argument.
4. **Marketing copy** — it describes two products and still does not mention that
   the conversation generator now emits a real work skin for two platforms.
5. **The mobile preview** — scale AO3's desktop layout rather than scrolling it
   sideways. Left out rather than added untested.
6. **The 8-digit hex gap** (§11) — our lint refuses `#89797925` where AO3 accepts
   it by accident. We are stricter than the archive, which invariant 5 forbids.
   It does not bite while we emit no alpha colours, so it is last.

Deliberately **not** next, and the reasons are in §10 and §11: raw CSS editing,
webfonts, `@media` variants, parent-skin chains, sharing, accounts, and anything
that turns this into a page builder.

`BACKLOG.md` carries the cross-product list; item 20 is this product's gate. The
other 28 items are work-skin work and do not touch these files.

### 15g. The two lessons worth carrying, in one line each

**A model of AO3 with no work skin in it was a model of the wrong page.** 273
green tests and a preview that matched the export byte for byte did not see §14;
a reader opening a real work saw it in minutes.

**Our CSS is a guest twice over** — on AO3's page, and inside an author's work.
The `!important` that makes us a good guest on the first is what made us a bad
one on the second.

---

## Sources

AO3 rules verified against otwarchive `master`, 6 August 2026 and **re-verified
7 August 2026**. The re-verification diffed our copied data against upstream
mechanically rather than by eye:

| Copied list | Upstream | Ours | |
| --- | --- | --- | --- |
| `SUPPORTED_CSS_PROPERTIES` | 181 | 181 | match |
| `SUPPORTED_CSS_SHORTHAND_PROPERTIES` | 20 | 20 | match |
| `TOP_LEVEL_DOMAINS` | 270 | 270 | match |
| `SUPPORTED_EXTERNAL_URLS` | 4 | 4 | match |
| url()-bearing properties | 6 | 6 | match |
| `Skin::MEDIA`, `Skin::ROLES` | — | — | match |

No upstream drift. The one defect found was ours, not AO3's — see Correction 3
in §7. Also settled while re-reading: `content: "…" !important` is safe even
though `sanitize_css_content` does not strip `!important`, because css_parser's
`each_declaration` yields it as a separate `is_important` flag and
`clean_css_code` re-appends it afterwards. The value the sanitizer sees never
contains it.

- [`lib/css_cleaner.rb`](https://github.com/otwcode/otwarchive/blob/master/lib/css_cleaner.rb) — `legal_property?`, `legal_shorthand_property?`, `sanitize_css_declaration_value` branch order, `sanitize_css_font`, `sanitize_css_content`, `VALUE_REGEX`, `@font-face` rejection, `url()` gating
- [`config/config.yml`](https://github.com/otwcode/otwarchive/blob/master/config/config.yml) — `SUPPORTED_CSS_PROPERTIES`, `SUPPORTED_CSS_SHORTHAND_PROPERTIES`, `SUPPORTED_CSS_KEYWORDS`, `SUPPORTED_EXTERNAL_URLS`
- [`app/models/skin.rb`](https://github.com/otwcode/otwarchive/blob/master/app/models/skin.rb) — `MEDIA` and `ROLES` whitelists, `get_style` load order, unprefixed `clean_css_code`
- [`app/views/works/show.html.erb`](https://github.com/otwcode/otwarchive/blob/master/app/views/works/show.html.erb) — `#work-skin` → `#workskin` → `#chapters` → `.userstuff` nesting
- `public/stylesheets/site/2.0/*` — the default skin our CSS is layered on top
  of. `01-core`, `02-elements`, `03-region-header`, `04-region-dashboard`,
  `05-region-main`, `06-region-footer`, `10-types-groups`, `11-group-listbox`,
  `13-group-blurb`, `14-group-preface`, `21-userstuff`, `22-system-messages`.
  §4.4–4.8 all come from this directory; it is the part the first revision
  never read.

Re-verify before each release — AO3 changes these lists, and a stale allowlist
is worse than none.
