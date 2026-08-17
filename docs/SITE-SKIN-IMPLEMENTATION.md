# AO3 Site Skin Builder — Implementation Plan

**For:** the developer building this. Assumes familiarity with the existing app.
**Source material:** `ao3-skin-builder-revised-implementation-blueprint.md` and
`ao3-skin-studio-ux-prototype.html`, both written without access to this
codebase. This plan keeps their product thinking and replaces their
architecture with ours.

> ## Start here
>
> **Revision 9 — 17 Aug 2026.** The product is built and deployed. **Everything
> on the roadmap that could reasonably go in before the release gate has now
> gone in, and the gate is the only thing left at the top of the list.** It has
> been open since the product shipped; it is now holding back sixteen templates
> that carry two things no archive has ever seen from us.
>
> **§23 is the current handoff.** Read it, then §21b and §20b/§20d (the earlier
> learnings and product decisions, all still true), then §15 — which still owns
> the file map, the five invariants and the traps. The handoffs supersede only
> its ordering.
>
> **Starting cold? §21f is five steps and will save you an hour**, most of it in
> local file permissions and a route that takes 70 seconds to compile.
>
> If you read nothing else, read **§23c**. The short version: a property our lint
> permits is not a property the archive has accepted, and we shipped sixteen
> templates on the difference. Then **§23e**, which is the order of work, and
> whose first item is the gate.
>
> **§22 is the region audit and it is now built** (§22e, 17 Aug 2026) — with
> three corrections to its own spec, in §23b. Read §22 for the method, which is
> the reusable part: *read AO3's stylesheet, not our preview*, because a region
> missing from the mock is invisible and invisible looks exactly like finished.
>
> **§16–§18 are revision 5** and they change the roadmap. We read 115 published
> site skins from two prolific authors and diffed every declaration in them
> against both AO3's real sanitizer and our model of it. Two findings:
>
> - **§17 — `ao3Css.ts` blocked CSS AO3 accepts, in five classes.** Chief among
>   them: **AO3 has a dedicated gradient sanitizer we never modelled.** Zero false
>   accepts, 34 false rejects. **Fixed 16 Aug 2026 (Phase 11); the differential
>   now runs 0/0 and `box-shadow`, gradients and `border-image` are available to
>   the compiler.**
> - **§18 — the 10x plan, written to be built from.** We style 5 regions of AO3;
>   the corpus styles ~25. The missing ones are the ones that look *broken* on a
>   dark theme: every button, every form field, every comment byline keeps AO3's
>   light grey.
>
> **If you are the developer picking up the 10x work, read §18d first** — it is
> the ordered table of what to build, what each item is blocked by, and which
> three can run in parallel. Then §18a (chrome, an afternoon plus mock work),
> §18c (the reading controls, the largest piece), §18b (depth, blocked on §17 and
> on the release gate). Phases 11–14 in §7 are the same work in that table's
> canonical place. Every selector and declaration in §18 was verified against
> both AO3's sanitizer and our lint — re-run
> `npx tsx scripts/ao3-capability-probe.mjs` if you change a value.
>
> **§19 is revision 6, and it is the only section written from user demand
> rather than from source.** It answers "why does this feel generic" with an
> answer §18 does not reach: readers want their archive to feel like a *fandom*,
> and we ship sixteen moods. Both phases in it are cheap, neither needs §17, and
> — uniquely on this roadmap — **neither emits a declaration shape the release
> gate does not already cover.** If you want the largest visible return for the
> least risk, start there, not at §18.
>
> If you are about to touch the compiler, read **§4b** (who owns which selector)
> and **§14** (why not every declaration may shout) before you write a rule.
> If you are about to touch `ao3Css.ts`, read **§3**, the corrections in §7, and
> **§17** — and note that the work-skin product depends on that file too.
>
> Reading order for a cold start: §0 → §15 → §3 → §4b → §14 → §5 → §18.

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

> **§17 corrects this heading: there are four.** An `aspect-ratio` branch was
> added upstream between `font-family` and `content`, and our model does not have
> it (Correction 9). §17 also documents a **fifth** path this section misses
> entirely — `sanitize_css_gradient`, reached from the token path — which is the
> largest capability gap in the product (Correction 5).

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

> **We tightened it anyway, everywhere except the case this paragraph pinned.**
> The whole value is matched **repeatedly** — `^(VALUE_REGEX,?\s*)+$` — so
> `0.5375em` is `0.537` + `5em`, and `0.75rem` is `0.75` + `rem` as a bare
> keyword. `rem`, `vw`, `ch` and `fr` all work for that reason without being
> units. See §17, Correction 6.

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
| `header.bannerUrl` + `header.gradient` | `#header` | **one** `background-image` carrying both layers, banner first (§19b-bis); `-position`, `-repeat`, `-size` only when a banner is set |
| `header.gradient` | `#header .primary` | `background-color: transparent` when on, the accent when off — an opaque nav strip across a fade is a visible band |
| `header.bannerHeight` | `#header .heading` | `height` — AO3's header is two lines tall; without this there is nowhere for a banner to show |
| `header.hideLogo` | `#header .logo` | `display: none` |
| `header.textShadow` | `#header .heading a`, `#header .primary a` | `text-shadow`, using `headerShadow` |
| `shape.tagColors` | `li.warnings a.tag` + `dd.warning a.tag`, and the same pair for `relationship`, `character`, `freeform` | `color`, and `border-color` when the tag shape has a border |
| `details.divider` | `#chapters .userstuff > hr` | `border-top`, `::after` glyph — `>`, see §14a |
| `details.dropCap` | `#chapters .userstuff > p:first-of-type::first-letter` | `float`, `font-size`, `color` — `>`, see §14a |
| `details.scrollbar` | `::-webkit-scrollbar`, `-track`, `-thumb`, `-thumb:hover` | `width`/`height`, `background-color`, `border-radius` |
| `colors.background` | `.listbox` | `background-color`, `border-color` (`border`), `box-shadow: none` — §22e |
| `colors.surface` | `.listbox .index` | `background-color`, `box-shadow: none` — §22e |
| derived `border` | `dl.meta` | `border-color` — §22e |
| derived `commentAlt` | `dl.index dd`, `.statistics .index li:nth-of-type(even)` | `background-color` — §22e |
| `colors.accent` | `li.relationships a` | `background-color: transparent` — §22c |
| *(fixed, uncontrolled)* | `.wrapper:has(> table, > .meta)` | `box-shadow: none` — AO3's grey halo around every meta table, §23b |
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

**Deliberately unowned: `.listbox > .heading`.** §22e's table gave it the text
colour; it is not emitted because every listbox on the archive is inside `#main`,
where our own `#main .heading` accent rule at (1,1,0) already beats both AO3's
`#2a2a2a` and any (0,2,0) rule we could add. The row would be a dead declaration
that reads like a working one. See §23b, correction 1 — and note the general
form: **an audit asking "do we name this selector?" over-reports, because our
broad rules reach elements they do not name.**

**Deliberately unowned: `dl.meta .wrapper`.** AO3 styles it; no view in
otwarchive `master` renders it. §23b, correction 2.

**Deliberately unowned: `a.cloud1`…`a.cloud8`.** The tag cloud wants AO3's
eight-step popularity ramp rather than one flat colour, and the mock renders no
Tags page. Invariant 4 settles it until it does — §22e.

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
    gradient: 'none' | 'vertical' | 'diagonal';   // §19b-bis
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
| 11 | **`ao3Css.ts` corrections 5–9** — gradients, the repeating number grammar, long hex, the `font` shorthand, `aspect-ratio`. Acceptance: `scripts/ao3-corpus-differential.mjs` at **0 false accepts / 0 false rejects** | ✅ 16 Aug 2026 — 0/0 over 4,418 declarations; see §17 |
| 12 | **Chrome regions** — buttons, form fields, pagination, comments, autocomplete. Four derived colours, eleven ownership rows, no new theme field | ✅ 16 Aug 2026 — with two corrections to §18a's spec; see the note there |
| 13 | **Reading controls** — required tags as text, tag labels, separators, stat icons, and the three author-overriding controls. Needs the third cascade mode (§18c-0) | 🟨 **§18c-2 landed 17 Aug 2026** — the `reading` group exists, off in all 16. 18c-3…18c-6 remain, and the third cascade mode is still unbuilt because 18c-2 does not need it |
| 14 | **Depth** — card elevation, page wash, header gradient, glow, `border-image` frames, texture | ⬜ §18b, blocked on 11 and on Phase 7 |
| 15 | **Theme from the banner image** — quantize the picture the user already pasted, derive all four colours from it, and stop guessing the header foreground | ⬜ §19b |
| 16 | **Palettes that read as fandoms** — ~12 more templates, mood-named as always | ⬜ §19c |
| 17 | **Regions: listboxes, indexes, meta tables** — the §22 audit's build spec, plus §22c's chip. Four of the nine page types a real skin author screenshots. Acceptance: differential and capability probe **unmoved** | ✅ 17 Aug 2026 — 0/0 and no divergences; landed *before* the gate, on §18a's argument. Two rows of §22e's table were dropped on evidence and one was added; see §23b |

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

> **§16 supersedes this section's sample.** Three skins became 115, read
> mechanically rather than by eye, and two of the conclusions below changed:
> the gradient observation at the end of "Their surface area" turned out to be a
> shipped capability we were blocking (§17, Correction 5), and the 8-digit hex
> "known gap" is now the thing standing between us and `box-shadow` (§18b). The
> judgements about *what not to adopt* — hotlinked images, parent-skin chains —
> all survived the larger sample.

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

  > **§19c takes this one step further and it is the step that was missing.**
  > "Not fandom-named" was read for a year as "not fandom-*shaped*", and those
  > are different things. A palette is not anyone's property; the name on the
  > card is the exposure. We can ship a maroon-and-gold parchment theme that
  > reads as a wizarding house and still call it what we call everything else.

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
| Templates | 16, all lint clean, all round-tripping through storage. **Ten carry a header gradient as of 17 Aug 2026** (§21a) |
| Tests | 468 unit (`--project=unit`), 24 browser (`tests/site-skin.spec.ts`) — counts as of 17 Aug 2026, after §22e |
| Mobile preview | ⚠️ scrolls sideways instead of scaling. Known, deliberate |
| Marketing copy | ⚠️ correct about site skins; still silent on the work-skin export |
| `ao3Css.ts` vs AO3 | ✅ **0 false accepts, 0 false rejects** over 4,418 corpus declarations — §17's corrections landed 16 Aug 2026 |
| Regions styled | ⚠️ **~18 of ~25.** §18a landed 16 Aug 2026 — buttons, fields, pagination, comments and autocomplete — `.required-tags` followed on 17 Aug 2026 (§18c-2, only when a reader turns it on), and **§22e landed the same day**: `.listbox`, `.listbox .index`, `dl.meta`, `dl.index dd`, `.statistics`, the meta halo, and §22c's chip. That closes the four page types the audit found bare. **Still unowned: the tag cloud** (`a.cloud1…8`, deferred — the mock renders no Tags page, §22e), and §22f's list. `.splash` turns out to need nothing |
| Fandom demand | ⚠️ **unserved.** All 16 templates are moods; what readers ask for is Harry Potter, Spider-Man, Iron Man — §19, added 16 Aug 2026 |

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
| `scripts/ao3-sanitizer-oracle.mjs` | a faithful JS port of `css_cleaner.rb`'s value path, built to be **disagreed with** — never shipped, never imported by `src/` | re-verifying against upstream |
| `scripts/ao3-corpus-differential.mjs` | every corpus declaration through both the oracle and our lint. **Acceptance bar: 0 false accepts, 0 false rejects** | before and after any `ao3Css.ts` change |
| `scripts/ao3-capability-probe.mjs` | ~75 named techniques × {AO3 allows, we allow}. Answers "can we do X?" in one run | designing a new control (§18) |
| `scripts/ao3-fetch-corpus.mjs` | downloads the 115-skin corpus (§16). Not checked in | reproducing §16/§17 |

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
   **But the preview being honest is not the same as it being complete** (§22d).
   A region missing from `mockPage.ts` is not "not yet styled" — it is invisible,
   and invisible looks exactly like finished. To ask whether we cover something,
   read AO3's stylesheet; the preview cannot answer.
5. **Never be stricter than AO3.** Four separate bugs in `ao3Css.ts` were this
   (§7). Being stricter blocks CSS the archive accepts, and the user has no way
   to tell we are the ones who are wrong.

### 15d. How to run it

```bash
npm run dev                      # localhost:3000/site-skin

npx playwright test --project=unit          # 468 tests, no browser, no server
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
- **`!important` also defeats AO3's own exemptions.** Before emitting a bare
  element or class selector, check whether AO3 carves something out of it with a
  quiet ID-scoped rule — it exempts its header and footer from its own button
  cascade that way, and a shouted (0,1,1) from us beats a silent (1,0,1) from
  them. Three separate bugs now share this root (§14b, §18a, §20b).
- **Transcribe AO3's rule into `mockPage.ts`, not the part of it we override —
  and keep AO3's source order.** Equal-specificity conflicts are decided by
  order and nothing else, so an omitted declaration can move a rule we never
  touched. Fetch the real stylesheet; do not reconstruct it from a table of what
  we intend to undo (§21b).
- **Backticks in a comment inside `mockPage.ts` terminate the CSS template
  literal.** Quote selectors with `"` in there. The symptom is a dev-server 500;
  `tsc --noEmit` names it immediately (§21b).
- **The value grammar's number rule is not a three-digit cap.** `1000` matches as
  `100` + `0`. Do not "fix" it (§3).
- **`gap` is refused while `grid-template-columns` is allowed.** An unanchored
  substring test. Faithful, and pinned (§3).
- **Being stricter than AO3 is the failure this file keeps having.** Corrections
  1, 2 and 4 were this; §17 found five more. Before adding a refusal to
  `ao3Css.ts`, run `scripts/ao3-corpus-differential.mjs` — the acceptance bar is
  **0 false accepts and 0 false rejects**, and the harness to prove it is checked
  in.
- **AO3 accepts far more garbage than it rejects.** `border: d4836e` (a hex code
  missing its `#`) is stored happily, as `d` + `4836` + `e`. Our lint is not a
  correctness checker and must not become one — it exists to predict *refusal*,
  and refusal is rare.

### 15f. What to do next, in order

> **Superseded by §20e (revision 7).** Items 1 and 2 of §18d are done; the
> current order lives in §20e. The list below is kept because items 3–6 are
> still accurate and still unclaimed.
>
> **Revision 5 reorders this list.** §18 is the current roadmap: the five
> `ao3Css.ts` corrections in §17 come first (invariant 5 is being violated in
> production), then §18a's chrome regions, then Phase 7 below, then depth. Items
> 3 and 6 here have been absorbed into §18 — item 6 in particular is no longer
> last, because `box-shadow` needs it. The rest of this list stands.
>
> **Revision 6 adds two items that sit outside that order entirely** — §19c's
> fandom-shaped palettes and §19b's theme-from-an-image. Both are unblocked, both
> are about a day, and **neither adds anything the release gate has to prove**, so
> neither has to wait behind item 1 or item 4. If the gate stays open for a while,
> these are what to build while it does.

1. **Phase 7 — the release gate.** `docs/SITE-SKIN-AO3-CHECKLIST.md`: sixteen
   templates × saved/applied/readback, then ten named probes. **Do P10 first** —
   read a work that has its own work skin with a site skin on. That is the class
   of bug that already escaped, and it is the one our tests model least well.
   While you are in AO3's editor, reopen each saved skin: AO3 stores the
   *cleaned* CSS, so that box is a direct readout of what the sanitizer kept.
   Anything missing is a rule our lint does not know about, and belongs in §7 as
   a numbered correction.
2. **Whatever the gate finds.** Assume it finds something.
3. ~~**Tag colours *within* a listing's required tags**~~ — ✅ **done 17 Aug
   2026**, as part of §18c-2 rather than on its own. The four spans take the
   theme's tag colours whenever "Colour tags by type" is also on, which is the
   reuse that made this ours rather than a snippet: nobody else's version of the
   required-tags trick is theme-aware.
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

## 16. The published-skin corpus — what 115 real skins do that we do not

**Read 16 Aug 2026.** §11 read three published skins and drew good conclusions
from a small sample. This is the same exercise at 38× the size, and it is
mechanical rather than by eye.

### The corpus

Every repository belonging to two prolific AO3 skin authors:

| | | |
| --- | --- | --- |
| [`memorizingthedigitsofpi`](https://github.com/memorizingthedigitsofpi) | 29 repos, 262 followers | Aesthetic skins + an `Add-Ons` repo of single-feature snippets |
| [`Ao3SiteSkins`](https://github.com/Ao3SiteSkins) | 5 repos | 25 original skins plus three fandom collections |

**115 stylesheets, ~50,000 lines, 3,942 distinct declarations.** The flagship is
`medieval-times-AO3-skin` at 283 stars — an illuminated-parchment theme built
almost entirely out of `border-image`, which is a technique we do not have.

Reproduce it:

```bash
node scripts/ao3-fetch-corpus.mjs /tmp/ao3corpus
for f in /tmp/ao3corpus/*.tar.gz; do tar --force-local -xzf "$f" -C /tmp/ao3corpus; done
npx tsx scripts/ao3-corpus-differential.mjs /tmp/ao3corpus   # our lint vs AO3's
npx tsx scripts/ao3-capability-probe.mjs                     # what AO3 allows
```

The declaration count moves as those repositories do — the 16 Aug reading was
3,942 distinct declarations in the morning and 4,418 by the Phase 11 re-run the
same day. **The acceptance bar is the ratio, not the total**: 0 false accepts
and 0 false rejects, whatever the denominator turns out to be.

The corpus is **not** checked in. It is other people's work, read to calibrate
our sanitizer model, and §11's rule still stands: **we ship no images and no
copied skins.** Nothing below proposes shipping anyone's CSS.

### What the corpus uses, by frequency

Comments stripped first (§7, Correction 4 — the same mistake is very easy to
make on a corpus this size).

| Technique | Occurrences | Do we emit it? |
| --- | --- | --- |
| `box-shadow` | 982 | ❌ never |
| `content` (`:before`/`:after`) | 826 across ~1,100 pseudo-element rules | one `::after` glyph |
| `nth-child` / `nth-of-type` | 618 | ❌ never |
| `background-image: url(...)` | 215 | banner only |
| `filter` (sepia/saturate/contrast/blur) | 110 | ❌ never |
| `font-variant: small-caps` | 63 | ❌ never |
| `linear-gradient` | 57 | ❌ **blocked by our own lint** — §17 |
| `border-image` | 53 | ❌ never |
| `text-shadow` | 44 | banner only |
| `transform` | 18 | ❌ never |
| `[href*="…" i]` attribute matching | 13 | ❌ never |
| `display: flex` | 9 | ❌ never |
| `:has()` | 2 | ❌ never |
| `@media` | **0** | ✅ correct — §3 |
| `@font-face` / `@import` | **0** | ✅ correct |

Two of those confirm our reading rather than challenging it: **nobody in a
115-file corpus uses `@media` or `@font-face`.** §3 is right, and the community
has independently arrived at the same place.

### The regions they style and we do not

Selector frequency across the corpus, against what `compile.ts` owns today:

| AO3 region | Corpus hits | We own |
| --- | --- | --- |
| `#header` / `.dropdown` / `#greeting` / `.menu` | 2074 / 1024 / 936 / 833 | ✅ mostly |
| `.actions`, `button`, `input`, `select`, `textarea` | 673 + ~220 | ❌ **nothing** |
| `.blurb` | 723 | ✅ |
| `#dashboard` | 665 | ✅ |
| `.comment`, `.thread .even`, `.byline` | 613 + 105 + 141 | ❌ **nothing** |
| `.listbox` | 615 | ❌ nothing |
| `.splash` (the logged-out home page) | 603 | ❌ nothing |
| `.autocomplete` | 279 | ❌ nothing |
| `.filters` / `.search` | 187 / 141 | ❌ nothing |
| `.current` (pagination) | 451 | `#dashboard .current` only |
| `.required-tags` (the rating/warning icons) | 148 | ❌ nothing — already §15f item 3 |
| `.reading` / `.viewed` (History) | 220 / 218 | ❌ nothing |
| `.statistics` / `#stat_chart` | 126 / 99 | ❌ nothing |
| `#modal` | 98 | ❌ nothing |

**We style five regions. A competitive skin styles about twenty-five.** That is
the headline, and §18 turns it into an order of work.

### The `Add-Ons` repository is the most interesting thing in the corpus

Thirteen single-purpose snippets, each with a plain-language comment header
explaining what it does and which number to change. They are not decoration —
they are **reading-experience controls**, and they are the closest thing in the
wild to what our editor is for:

| Add-on | What it does |
| --- | --- |
| `blurb icons to text` | Replaces the rating/warning/category icon sprites with readable text labels |
| `Rename tag categories` | `content: "Relationships: "` before each tag group in a listing |
| `Highlight or blackout tags` | `li.blurb a.tag[href*="angst" i] { background: #000; color: #5e5757 }` |
| `Replace stats names with emoji` | `dd.kudos::before { content: "❤️" }` |
| `Change font size (just inside a fic)` | `#workskin, .blurb, .comment { font-size: 130% }` |
| `force blank line between paragraphs` | `#workskin p { white-space: pre-line }` |
| `Force left align` | `#workskin p { text-align: left }` |
| `Remove images from works` | `#workskin img { display: none }` |
| `Icons as text + separating tags by line` | `float`/`clear` per tag group, `.commas li:after { content: " • " }` |
| `Change comment background colour` | `.thread .even` |
| `Remove muted users notice` | `p.muted.notice { display: none }` |

**Three of these deliberately reach inside works** (`#workskin p`, `#workskin
img`). That is the §14b line, and it is not obviously wrong here: a reader
choosing "force left align" is asking us to override the author, knowingly, for
themselves. §18c takes a position on it rather than assuming §14b settles it.

### One thing the corpus does that we should not copy

Hotlinked images, overwhelmingly to `64.media.tumblr.com`. The medieval skin
alone hotlinks 21 separate Tumblr-hosted PNGs. §11 already ruled on this and the
larger sample does not change it: **we ship no images**, the fandom specificity
comes from the address the user pastes, and §12's warning about a host blowing a
quota and breaking every skin at once applies to every one of these.

The same rule is what refuses the "pull the logo off a website" idea in §19a —
and §19b is what we do *instead*, which is to read a palette out of the address
the user pasted rather than to acquire an image of our own.

---

## 17. Corrections 5–9 — `ao3Css.ts` is stricter than AO3 in five ways

**Found 16 Aug 2026 by differential testing, not by a failing test.** Invariant
5 says *never be stricter than AO3*. It was being violated in production, and
one of the five was blocking the single biggest visual capability available
to us.

> **All five landed the same day (Phase 11).** The value grammar in `ao3Css.ts`
> is no longer an approximation: `VALUE_REGEX` and its constants are rebuilt
> from `css_cleaner.rb` and applied the way AO3 applies them — repeatedly, over
> the whole stripped value, with the token path and the whole-value path kept
> distinct because that split is what makes a gradient legal on
> `background-image` and illegal on `color`. The differential now reports
> **0 false accepts / 0 false rejects over 4,418 distinct corpus declarations**,
> and all 75 rows of the capability probe agree with the archive.
>
> Diagnostics were moved behind the grammar into `diagnoseValue()`, which only
> runs once AO3 has already decided to drop the declaration. That separation is
> the structural fix for the class of bug this section is about: the blanket
> `font` refusal (Correction 8) was a *message* that had quietly become a
> *rule*. A diagnostic that cannot refuse anything cannot make us stricter than
> the archive.
>
> **`box-shadow`, gradients, `border-image` and `rem`/`ch`/`fr` sizing are all
> available to the compiler now.** §18b is unblocked on the lint side — though
> it is still blocked on Phase 7 (§18d item 4), and that has not changed.

### Method — a differential oracle

`scripts/ao3-sanitizer-oracle.mjs` is a faithful JS port of `css_cleaner.rb`'s
value path, written from the Ruby source rather than from this document:
`sanitize_css_declaration_value`, `tokenize_and_sanitize_css_value`,
`sanitize_css_token`, `sanitize_css_gradient`, `sanitize_css_value`,
`sanitize_css_content`, `sanitize_css_font`, and every regex constant.

It exists to be *disagreed with*, not to be shipped. Every one of the 3,942
corpus declarations goes through both it and `lintAo3Css`:

| | |
| --- | --- |
| Agree | **3,908** |
| We reject, AO3 accepts (**false reject**) | **34** |
| We accept, AO3 rejects (**false accept**) | **0** |

Zero false accepts is the reassuring half — §3a's promise to catch a bad address
before the user leaves the app is intact. The 34 are all one of five things.

> **Two Ruby subtleties the port had to get right**, both of which would have
> produced phantom divergences:
>
> - `NUMBER_WITH_UNIT_REGEX` is built in a **double-quoted** Ruby string, where
>   `\s` is the escape for a literal **space**, not the character class. Lines
>   using single quotes or `\\s` really do mean `\s`.
> - **`!important` never reaches the value sanitizer.** css_parser yields it as a
>   separate `is_important` flag. An oracle that leaves it in the string reports
>   ~275 false divergences; the Sources section already recorded this and the
>   first run of the oracle rediscovered it the hard way.

### Correction 5 — AO3 has a gradient sanitizer, and we never knew (26 of the 34)

**This is the important one.** `css_cleaner.rb` line 211:

```ruby
def sanitize_css_token(token)
  if token.match?(/gradient/)
    sanitize_css_gradient(token)
  else
    sanitize_css_value(token)
  end
end
```

`sanitize_css_gradient` splits `name(interior)`, requires `name` to contain
`gradient`, and recursively tokenises the interior. So **any gradient function
is legal, on any property that takes the token path** — which is every property
whose name *contains* a shorthand substring (§3's unanchored rule), so
`background`, `background-image`, `background-color`, `border-image`, and
`list-style-image` all qualify.

Probed against the oracle and confirmed legal:

| | |
| --- | --- |
| `linear-gradient(to bottom, #fab0b9, #ce9ffd)` | ✅ |
| `linear-gradient(180deg, rgba(20,20,30,1) 0%, rgba(60,20,80,1) 100%)` | ✅ |
| `radial-gradient(circle at 50% 0%, #402060 0%, #100818 70%)` | ✅ |
| `repeating-linear-gradient(45deg, #eee 0px, #eee 10px, #ddd 10px, #ddd 20px)` | ✅ |
| `conic-gradient(#f00, #0f0, #00f)` | ✅ |
| `linear-gradient(#0008,#0008), url("https://i.imgur.com/a.png")` | ✅ (already passes) |

The interior is tokenised, so each stop must still be a legal value: hex, `rgba()`,
`hsl()`, a number with a unit, or a bare keyword (`to`, `bottom`, `circle`). The
constraint is real but generous.

**`§11 said "AO3 permits … gradients" and nothing was done with it.** The claim
was right, was never turned into a lint rule, and the lint quietly refused them
for a year. 57 gradient declarations across 15 corpus files are things AO3 stores
happily and our export dialog would have blocked.

### Correction 6 — the number grammar repeats, and our port stopped at one token

`margin: 0.5375em` is refused by us and accepted by AO3. The value regex is
applied as `^(VALUE_REGEX,?\s*)+$` — **repeating** — so `0.5375em` matches as
`0.537` followed by `5em`. Identically:

| Value | AO3 parses it as | We say |
| --- | --- | --- |
| `0.5625em` | `0.562` + `5em` | ❌ |
| `0.75rem` | `0.75` + `rem` (bare keyword) | ❌ |
| `20vw` | `20` + `vw` (bare keyword) | ❌ |
| `70ch` | `70` + `ch` | ❌ |
| `1fr` | `1` + `fr` | ❌ |

**`rem`, `vw`, `vh`, `ch` and `fr` are not in `UNITS_REGEX` and do not need to
be** — `ALPHA_REGEX` (`[a-z\-]+`) sweeps up the unit as a separate token. §3
already documented exactly this mechanism for `1000` → `100` + `0`, and told the
reader not to tighten the check. The implementation tightened it anyway for
every case except the one the test pinned.

Consequence for §18: **`grid-template-columns: 1fr 1fr` is legal**, and so is
sizing in `rem` and `ch`.

### Correction 7 — hex longer than six digits (already known as a gap, now measured)

`#0f4a59c` and `#89797925` both pass AO3: `#[0-9a-f]{3,6}` consumes the first six
and `ALPHA_REGEX` eats the tail. §11 spotted this in Rosé Pine and §15f filed it
as the *last* thing to do because "it does not bite while we emit no alpha
colours."

It bites now. **`box-shadow: 0 2px 8px #00000044` is the ordinary way to write a
soft shadow**, and §18 wants shadows. The gap is no longer theoretical.

### Correction 8 — the `font` shorthand is refused outright, and AO3 takes it

`font: Georgia, serif` is accepted by AO3 (token path: `Georgia` and `serif` are
both bare keywords). §3's *guidance* is still right — never emit the shorthand,
because `font: 'Palatino Linotype', serif` misses `sanitize_css_font` and fails —
but a blanket refusal is stricter than the archive. The check should refuse the
shorthand **when a value token would fail**, not on sight.

### Correction 9 — `aspect-ratio` has its own branch, and §3 says there are three

`sanitize_css_declaration_value` has **four** branches, not three.
`aspect-ratio` was added between `font-family` and `content`:

```ruby
elsif property == "aspect-ratio"
  clean = value if value.match(/\A(#{ALPHA_REGEX}|(auto\s+)?#{NUMBER_OR_RATIO_REGEX}(\s+auto)?)\z/i)
```

So `aspect-ratio: 16/9` is legal and we refuse it. **§3's "Values — three
branches, not one" is now wrong and is flagged in place.** This is also the first
evidence in this document of *upstream drift*: the Sources section says "no
upstream drift" as of 7 Aug 2026, and this branch is not in our model.

### What to change, in one list

All five are in `ao3Css.ts`, and the work-skin product imports the same file — so
every change needs `tests/ao3-css.unit.spec.ts` **and** a work-skin regression run.

1. Model `sanitize_css_gradient`: a token matching `/gradient/` is `name(interior)`
   where `name` contains `gradient` and `interior` tokenises clean.
2. Apply the value grammar as a **repeating** match over the whole stripped value,
   with `ALPHA_REGEX` available as a fallback token, instead of validating
   number-plus-unit as one atom.
3. Accept `#[0-9a-f]{3,6}` followed by more hex characters as
   colour-plus-keyword, matching AO3.
4. Refuse `font` only when tokenisation fails, not by property name.
5. Add the `aspect-ratio` branch.

Then **re-run the differential and require 0/0.** That number is the acceptance
test, and `scripts/` now holds everything needed to produce it.

---

## 18. The 10x plan

The corpus makes the diagnosis specific. We are not boring because we made
restrained choices — we are boring because **the compiler only knows about five
regions, four colours, and flat fills.** Three moves, in dependency order.

### 18a. Move one — stop looking broken (the biggest win, and it is a bug fix)

**Seven of our sixteen templates have a dark page colour.** On every one of
them, AO3's own defaults leave light-grey islands we never repaint:

| AO3 default | Where it shows |
| --- | --- |
| `.actions a, .actions button, .actions input, input[type=submit], button, .current, .actions label { background: #eee; color: #444 }` (`08-actions.css`) | **Every button on the site** — Post, Comment, Kudos, Subscribe, Sort & Filter, and every pagination number |
| `.current { background: #ccc; color: #111 }` | The current page in pagination |
| `input, textarea { border: 1px solid #bbb; box-shadow: inset 0 1px 2px #ccc }` plus the browser's white field | Every search box, every comment box |
| `input:focus, select:focus, textarea:focus { background: #f3efec }` | Cream flash on focus, on a black theme |
| `.comment h4.byline { background: #ddd }`, `.thread .even { background: #eee }` (`15-group-comments.css`) | Every comment thread |
| `.autocomplete` panels | Every tag field |

This is not a taste gap. **A user installs Neon Terminal, opens any work, and
the comment button is 2010 grey.** It reads as our skin being half-finished,
because it is.

**No new control, no new field in `SiteSkinTheme`, no new lint capability.** It
is four derived colours and eleven rows added to §4b's ownership table.

> ## Built 16 Aug 2026 — and the spec below was wrong twice
>
> Both corrections are recorded here rather than silently applied, because both
> are the kind of thing a later reader would "fix" back.
>
> **1. Every control selector is scoped to `#main`. The table below is not, and
> must not be copied literally.** AO3 styles its buttons with a bare
> `.actions a, .actions button, …` in `08-actions.css` and then *exempts* its own
> header and footer with ID-scoped rules — `#header a, #header fieldset, …` and
> `#footer a, #footer button`, both `background: transparent` at (1,0,1), both
> beating `.actions a` at (0,1,1) on the real page.
>
> Those exemptions are **not** `!important`. Ours are (§3b). So a bare
> `.actions a` from us defeats them and puts a button-coloured chip behind every
> header nav link and every footer link, on every page. Scoping to `#main` keeps
> AO3's structure intact and loses nothing: pagination, comment boxes, filter
> forms and work actions all live inside `#main` anyway. The header and footer
> are already owned by the rules in §4b. `.autocomplete` stays unscoped, because
> AO3 attaches the dropdown next to whichever field it serves.
>
> A test enumerates the twelve bare selectors and fails if any is emitted.
>
> **2. `mixHex(a, b, weight)` keeps `weight` of the FIRST colour**, so the four
> derived values below are written backwards. "Surface nudged 10% toward text"
> is `mixHex(text, surface, 0.1)`, **not** `mixHex(surface, text, 0.1)` — which
> is 90% text, and produced a light cream button carrying light cream text on
> all seven dark templates. Defect §4.4 exactly, in a new region.
>
> It shipped through a green suite, and the reason is worth more than the bug:
> every assertion compared the emitted value against `d.controlBg`, so they were
> tautological. **A derived colour is only meaningfully tested against a contrast
> floor.** There is now one per template — text against `controlBg`, `fieldBg`
> and `commentAlt` at 4.5:1, plus `controlBg` against `surface` so a button stays
> distinguishable from its card — and reverting the mix fails all sixteen.
>
> The `background-image: none` note below is correct and load-bearing; it is
> asserted separately.

#### New derived values, for `derive()` in `compile.ts`

| Name | Formula | Why |
| --- | --- | --- |
| `controlBg` | `mixHex(surface, text, 0.10)` | A button sits slightly proud of the card it is on, in either polarity |
| `controlBorder` | `mixHex(surface, text, 0.25)` | Visible edge without becoming a second accent |
| `fieldBg` | `background` | A form field reads as *recessed*: the page colour inside a card is exactly that, and it needs no new maths |
| `commentAlt` | `mixHex(surface, text, 0.05)` | AO3's alternating comment shading, at our contrast rather than `#eee` |

#### Ownership rows to add to §4b

Every one carries `!important` (default mode). **None of these can land inside a
work** — comments live in `#feedback`, outside `#work-skin` — so §14b does not
apply and there is no `authorWins` decision to make here.

| Control | Owns | Emit |
| --- | --- | --- |
| derived `controlBg` | `.actions a`, `.actions a:link`, `.action`, `.action:link`, `.actions button`, `.actions input`, `input[type="submit"]`, `button`, `.actions label` | `background-color`, `background-image: none`, `color: text`, `border-color: controlBorder` |
| `colors.accent` | `.actions a:hover`, `.actions button:hover`, `.actions input:hover`, `.actions a:focus`, `.actions button:focus`, `.actions input:focus`, `.action:hover`, `.action:focus` | `background-color`, `color: headerFg` |
| `colors.accent` | `.current`, `a.current`, `a:link.current`, `.current a:visited` | `background-color`, `color: headerFg` |
| derived `fieldBg` | `input`, `textarea`, `select` | `background-color`, `color: text`, `border-color: controlBorder` |
| derived `fieldBg` | `input:focus`, `textarea:focus`, `select:focus` | `background-color` — kills AO3's `#f3efec` cream flash |
| derived `controlBg` | `.comment h4.byline` | `background-color`, `color: text` |
| derived `commentAlt` | `.thread .even` | `background-color` |
| `colors.surface` | `li.comment`, `div.comment` | `background-color`, `border-color: border` |
| `colors.surface` | `.autocomplete .dropdown ul li` | `background-color`, `color: text` |
| `colors.accent` | `.autocomplete .dropdown ul li.selected` | `background-color`, `color: headerFg` |
| derived `controlBg` | `.filters dt`, `fieldset legend`, `form.verbose legend` | `background-color`, `color: text` |

**`background-image: none` on the button row is load-bearing**, not tidiness:
`08-actions.css` layers a `linear-gradient(#fff 2%,#ddd 95%,#bbb 100%)` (plus four
vendor-prefixed copies) on top of `background: #eee`. A `background-color` alone
leaves that white-to-grey gradient sitting on it — the same defect as the footer's
red tile in §4.6, and it will look like the control does nothing.

Note also that AO3's own default stylesheet uses `linear-gradient` here. AO3's
stylesheets never pass through the sanitizer, so this is not proof of §17
Correction 5 — but it is a good sanity check on it.

#### Mock DOM, before any of it ships (invariant 4)

| State | Add |
| --- | --- |
| Browse | a `ul.actions` with two buttons, a pagination `ol.pagination` with a `.current`, and a search `input` |
| Browse | `.autocomplete` dropdown with one `li.selected` — as with the header dropdown in §5b, it must be rendered *open* or the rule ships unverified |
| Reading | a comment thread: two `li.comment`, one `.thread .even`, each with an `h4.byline`, plus a `textarea` for the comment box |

That mock work is most of the effort in §18a. The compiler change is an
afternoon.

### 18b. Move two — depth, once §17 lands

§17's corrections unlock a materially different visual range. Each of these is a
`shape` or new `surface` control, previewable, and expressible in §4b's
one-owner-per-selector spec:

| Control | Emits | Unlocked by |
| --- | --- | --- |
| **Card elevation** — flat / soft / lifted | `box-shadow` on `li.blurb`, `#dashboard`, `#workskin` | Correction 7 (8-digit hex) |
| **Page wash** — flat / vertical / radial | `linear-gradient` or `radial-gradient` on `body` | Correction 5 |
| ~~**Header gradient** — accent → `headerDeep`~~ | `background-image` on `#header`, *under* any banner | ✅ **built 16 Aug 2026** — `header.gradient`, off in all 16 templates. Pulled forward out of §18b order; see §19b-bis |
| **Glow** (dark themes) | `box-shadow` + `text-shadow` on accent elements | Corrections 5, 7 |
| **Ornament frames** | `border-image` with a user-supplied address, validated by §3a | already legal |
| **Texture** | `repeating-linear-gradient` stripes/plaid on `body` | Correction 5 |

`border-image` deserves its own note: it is how the 283-star medieval skin gets
its entire identity, it is **already legal today**, it takes a `url()` our §3a
validator already checks, and it is one declaration. It is the highest
visual-return item in the whole document.

**What stays out.** §10 still holds. No `@media`, no webfonts, no raw CSS
editing, no parent-skin chains, no animation (`animation` is genuinely refused —
confirmed by the probe, not assumed). And nothing that cannot be previewed.

### 18c. Move three — reading controls (the `Add-Ons` features). **Build spec.**

The `Add-Ons` repository is evidence for a claim this document has not made
before: **the most valuable AO3 customisations are not visual.** This is the
buildable version of it.

**It has no dependency on §17.** All 46 declarations specified below were probed
against both the oracle and `lintAo3Css`: every one is legal on AO3 *and* already
passes our lint today. §18c can be built before, after, or beside §17 and §18a.
Re-run `npx tsx scripts/ao3-capability-probe.mjs` if you change a value.

#### 18c-0. The cascade rule this needs — a third kind of rule

§14b gave `Rule` two modes. These controls need a third, and the distinction is
the whole product argument:

| Mode | `!important`? | For |
| --- | --- | --- |
| default | yes | AO3's chrome. Beats `#dashboard.own` and friends (§3b) |
| `authorWins: true` | no | Rules that *can* land in a work but were not asked for (§14b) |
| **`overridesAuthor: true`** | **yes** | Rules that land in a work **because the user ticked a box** |

§14b was right about the default and wrong to be read as absolute. It forbade a
**colour scheme** silently rewriting an author's layout. A reader who ticks
"force left align" is not being surprised — they asked, and no amount of
specificity discipline can deliver it quietly, because the author carries
`#workskin` and loads later.

> **Rules the user did not ask for are emitted quietly. Rules the user
> deliberately turned on may shout — and the control must say so.**

Three constraints, all testable, all non-negotiable:

1. Every `overridesAuthor` control is **off in all 16 templates**.
2. Its editor row says it overrides the author's formatting.
3. `tests/site-skin.unit.spec.ts` enumerates the `overridesAuthor` selectors
   exactly, the way it already enumerates the six `authorWins` ones. **Invariant 2's
   existing test will fail when you add the third mode — that is correct, and the
   fix is to teach it three categories, not to loosen it.**

#### 18c-1. Data model

New group in `SiteSkinTheme` (§6). Separate from `details` on purpose: `details`
is decoration, this is legibility.

```ts
reading: {
  /** Rating/warning/category/status icons rendered as their real words. */
  requiredTagsAsText: boolean;
  /** "Relationships:" etc. before each tag group in a listing. */
  tagLabels: boolean;
  /** How tags in a listing are separated. */
  tagSeparator: 'comma' | 'bullet' | 'line';
  /** Stat names as icons, with the words kept for screen readers. */
  statIcons: boolean;

  // ── overridesAuthor. All three default to off in every template. ──
  /** 1 = off. Font size inside works, comments and blurbs only. */
  workFontScale: number;
  /** Blank line between paragraphs, for authors who pasted without one. */
  paragraphSpacing: boolean;
  /** Left-align prose regardless of the author's centring. */
  forceLeftAlign: boolean;
}
```

`validateTheme` coerces each the way `details` already is; `workFontScale`
against a `WORK_FONT_SCALES` list so a stored theme cannot inject a number.

#### 18c-2. Required tags as text — the accessibility one

**Do this one first.** It is §15f item 3, it is the most-requested item in the
corpus, and it is the only one that makes AO3 *more* accessible rather than
merely prettier.

> ## Built 17 Aug 2026 — and the table below is an abridgement, which cost an afternoon
>
> **1. The table lists what must be *undone*, not what AO3 *has*, and the
> difference is load-bearing in the mock.** `13-group-blurb.css` also carries
> `.blurb ul.required-tags { margin: 0 }`, which is absent below because nothing
> needs to undo it. But `.blurb .header ul` (the 65px gutter, two rows down) and
> `.blurb ul.required-tags` are **both (0,2,1)**, so the later of the two wins —
> and the later one is AO3's `margin: 0`. Transcribe the abridged version into
> the preview and the icon block is pushed 65px right, landing on top of the
> title it exists to make room for. It looked exactly like a bug in our own
> rules and was not; it was a mock that had never been AO3.
>
> The lesson generalises past this control: **when transcribing an AO3 rule into
> `mockPage.ts`, transcribe the rule, not the part of it we care about — and
> keep AO3's source order**, because equal-specificity conflicts are decided by
> nothing else. A test now pins that ordering.
>
> **2. The fourth `li` needs no rule of its own.** The table lists both
> `li+li+li` and `li+li+li+li`. One rule covers them: `li+li+li` already matches
> the fourth item (it *is* preceded by two `li`s), and ours carries `!important`,
> which beats AO3's more specific fourth rule regardless. Emitting both would be
> a second owner of `top`, which is how §4.2 started.
>
> **3. The four type colours are two derivations and two assignments.** A
> warning is `tagColors.warning` and an AO3 category *is* a relationship shape,
> so those two are exact. Rating→character and status→freeform are picked so all
> four are distinguishable, and the code says so rather than dressing it up.
>
> Off in all sixteen templates. It rewrites every listing on the archive, and a
> reader who picked a palette did not ask for that — the argument is in
> `templates.ts` beside the constant. It therefore ships **uncovered by the
> release-gate table**, which is why the checklist gained P13.

The markup, from `tags_helper.rb#get_symbols_for` — note the `li`s carry **no
class**, which is why AO3's own CSS positions them with `li+li+li`:

```html
<ul class="required-tags">
  <li><a class="help symbol question">
    <span class="rating-general-audience rating" title="General Audiences">
      <span class="text">General Audiences</span></span></a></li>
  <li>…<span class="warning-no warnings">…<span class="text">No Archive Warnings Apply</span>…</li>
  <li>…<span class="category-gen category">…<span class="text">Gen</span>…</li>
  <li>…<span class="complete-yes iswip">…<span class="text">Complete Work</span>…</li>
</ul>
```

**The real words are already in the DOM**, in `span.text`. AO3 hides them and
paints a sprite over the outer span. So this control does not invent content — it
un-hides what is there. Target the **inner span classes** (`.rating`,
`.warnings`, `.category`, `.iswip`), which are stable; never the `li+li+li`
positions, which is what the corpus add-on does and why its offsets are hand-tuned
to one person's font size.

Every AO3 default that has to be undone, from `13-group-blurb.css`:

| AO3 default (`13-group-blurb.css`) | Emit |
| --- | --- |
| `.blurb ul.required-tags { position: absolute; top: 0; width: 60px }` | `position: static`, `width: auto` |
| `.blurb ul.required-tags li, li a, li span { display: block; width: 25px; height: 25px }` | `display: inline`, `width: auto`, `height: auto` |
| `.blurb ul.required-tags li+li+li { position: absolute; left: 28px; top: 0 }` and `li+li+li+li { top: 28px }` | `position: static`, `left: auto`, `top: auto` |
| `.blurb span.text { height: 0; width: 0; font-size: 0.001em; color: transparent }` | `height: auto`, `width: auto`, `font-size: 1em`, `color: inherit` |
| the sprite on `.blurb ul.required-tags li span` | `background-image: none` |
| `.blurb .header .heading, .blurb .header ul { margin: 0.375em 5.25em 0 65px }` | `margin-left: 0` — the 65px reserved the icon block |
| `.blurb .header { min-height: 55px }` | `min-height: 0` |

Then make it readable: `padding-right: 1em` on the `li`, and colour the four
spans from `d.tagColors` when `shape.tagColors` is on, so a rating and a warning
are told apart at a glance. That reuse is the reason this control belongs to us
rather than being a snippet — **nobody else's version is theme-aware.**

#### 18c-3. Tag group labels

**The markup fact that decides the whole design.** `tags_helper.rb#blurb_tag_block`
emits **one `<li>` per tag**, every tag in a group sharing the group's class:

```html
<ul class="tags commas">
  <li class="warnings"><strong><a class="tag">…</a></strong></li>
  <li class="warnings"><strong><a class="tag">…</a></strong></li>
  <li class="relationships"><a class="tag">…</a></li>
  …
```

A "group" is therefore a **run of same-class siblings**, and a label belongs on
the first `li` of each run. CSS cannot say "previous sibling is not `.warnings`",
so the runs have to be enumerated. AO3's order is fixed —
warnings → relationships → characters → freeforms — which makes it tractable:
**four `:first-child` rules** (any group can be first, because warnings and
freeforms can be hidden by a user preference) and **six adjacency rules** for
every way one group can follow another.

```css
ul.tags li.warnings:first-child::before      { content: "Archive Warnings: "; }
ul.tags li.relationships:first-child::before { content: "Relationships: "; }
ul.tags li.characters:first-child::before    { content: "Characters: "; }
ul.tags li.freeforms:first-child::before     { content: "Additional Tags: "; }

li.warnings      + li.relationships::before { content: "Relationships: "; }
li.warnings      + li.characters::before    { content: "Characters: "; }
li.warnings      + li.freeforms::before     { content: "Additional Tags: "; }
li.relationships + li.characters::before    { content: "Characters: "; }
li.relationships + li.freeforms::before     { content: "Additional Tags: "; }
li.characters    + li.freeforms::before     { content: "Additional Tags: "; }
```

Ten rules, `font-weight: bold` and `color: d.text` on each. **`hide_warnings?`
and `hide_freeform?` are real user preferences in `tags_helper.rb`** — that is
why the four `:first-child` rules exist and why dropping them would leave a
reader with warnings hidden seeing no labels at all.

#### 18c-4. Tag separator

AO3 puts the comma in CSS, on `.commas li:after`, so all three options are one
owned selector:

| Value | Emit |
| --- | --- |
| `comma` | nothing — AO3's default stands |
| `bullet` | `.commas li::after { content: " • " }` |
| `line` | `.commas li::after { content: "" }`, plus `ul.tags li.warnings, li.relationships, li.characters, li.freeforms { float: left }` and `clear: left` on the same six adjacency pairs as 18c-3 |

`line` is the one readers ask for and it reuses 18c-3's adjacency list exactly —
build them together or `line` will drift.

#### 18c-5. Stat icons — and a correction to the add-on

The corpus version does `dl.stats dt { display: none }`. **Do not copy that.**
`display: none` removes the label from the accessibility tree, so a screen reader
loses "Kudos" and reads a bare number. The whole point of 18c-2 is that we are the
version that gets accessibility right; contradicting it two controls later is not
acceptable.

Use AO3's own visually-hidden technique instead — `clip: rect(0,0,0,0)`, which §12
already established is legal (`clip` is on the property list and `rect()` reaches
`VALUE_REGEX` through `SHAPE_FUNCTION_REGEX`):

```css
dl.stats dt { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); }
dl.stats dd.words::before      { content: "✍️ "; }
dl.stats dd.chapters::before   { content: "📄 "; }
dl.stats dd.comments::before   { content: "💬 "; }
dl.stats dd.kudos::before      { content: "❤️ "; }
dl.stats dd.bookmarks::before  { content: "🔖 "; }
dl.stats dd.hits::before       { content: "👀 "; }
dl.stats dd.collections::before{ content: "🗂️ "; }
```

Class names verified against `works/_work_module.html.erb`. Non-ASCII inside a
quoted string is safe — §3's `content` branch never consults `VALUE_REGEX`, and a
test already pins it. Leave `dd.language` alone: a language name with no label is
ambiguous, and there is no obvious glyph for it.

#### 18c-6. The three that override the author

All `overridesAuthor: true`, all off by default, each one row in its own labelled
subsection.

| Control | Emit | Note |
| --- | --- | --- |
| `workFontScale` | `#workskin, li.blurb, .comment { font-size: N% }` | **Not `body`** — that is `typography.baseFontScale`, which already exists and owns `body` exclusively (§4.3). Two font-size owners on `body` is defect 4.2 again |
| `paragraphSpacing` | `#chapters .userstuff p { white-space: pre-line }` | |
| `forceLeftAlign` | `#chapters .userstuff p { text-align: left }` | |

**Descendant, not `>` — and this is the one place §14a's rule is deliberately
inverted.** §14a used a child combinator so our decoration would *not* reach into
an author's markup. Here reaching into it is the entire feature: a reader who
wants left-aligned prose wants it for the paragraphs inside the author's divs too,
which is exactly where centring lives. Same selector shape, opposite intent,
because the user asked. Say so in the comment above the rule or someone will
"fix" it back.

`paragraphSpacing` and `forceLeftAlign` share a selector and must therefore be
**one rule with two conditional declarations**, not two rules — invariant 1.

#### 18c-7. Deliberately not built: tag blackout by text

`li.blurb a.tag[href*="angst" i]` is the most-wanted item in the corpus and it is
being left out of this phase on purpose. It is a **free-text field**, and §6 says
we have exactly one of those (`bannerUrl`) which carries validation in three
places for good reason. A tag string goes into a selector rather than a value, so
it needs its own escaping story that nothing in `ao3Css.ts` currently provides —
`lintAo3Css` validates declarations, and AO3 never validates selectors at all
(§15e), so a broken string here is stored silently and goes wrong quietly.

Worth building. Not worth building at the same time as six other controls.

#### 18c-8. Mock DOM — invariant 4, and most of the work

None of the above may ship before `mockPage.ts` can show it. Additions:

| State | Add |
| --- | --- |
| Browse | a full `ul.required-tags` on each blurb — all four `li`s, real inner span classes, real `span.text` contents |
| Browse | `ul.tags.commas` with **multiple `li` per group** and at least one blurb *missing* a group, so 18c-3's `:first-child` and adjacency rules are both exercised |
| Browse | a `dl.stats` with `dt`/`dd` pairs for words, chapters, kudos, hits |
| Reading | already has the author's work skin from §14c — that is what makes 18c-6 watchable. Add a **centred** paragraph inside it, or `forceLeftAlign` has nothing to visibly beat |

The blurb missing a tag group is the important one. Without it, ten label rules
look like four and nobody notices until a reader with `hide_warnings?` set files
a bug.

#### 18c-9. The five-file change, per §15d

For each control, in order: `theme.ts` (field + `validateTheme`) →
`templates.ts` (**all 16**; the three `overridesAuthor` ones off everywhere) →
`compile.ts` (rules, and pick one of the three cascade modes) → `mockPage.ts` →
`ThemeEditor.tsx` (new "Reading" group) → `tests/site-skin.unit.spec.ts` +
`tests/site-skin.spec.ts`. Browser assertions check the **compiled CSS**, not that
a switch moved.

### 18d. The order, and why

| # | Work | Why here | Blocked by |
| --- | --- | --- | --- |
| 1 | ~~**§17's five corrections**, differential at 0/0~~ | ✅ **done 16 Aug 2026.** Differential 0/0 over 4,418 declarations, probe 75/75 | — |
| 2 | ~~**§18a** chrome regions~~ | ✅ **done 16 Aug 2026.** Two corrections to the spec below | — |
| 3 | ~~**§18c-2** required tags as text~~ | ✅ **done 17 Aug 2026.** One correction to the spec in §18c-2; see §21 | — |
| 4 | **Phase 7 + P11** on real AO3 | The open gate (§15a). P11 settles §17 against the archive, and this must happen *before* §18b multiplies what the checklist has to prove | 1–3 |
| 5 | **§18c-3 … 18c-6** the rest of the reading controls | Largest scope; 18c-6 needs the third cascade mode and its test | 3 |
| 6 | **§18b** depth | Every item is a new thing the checklist must re-prove | 1, 4 |
| 7 | **§18c-7** tag blackout | Needs a free-text escaping story of its own | 5 |
| — | ~~**§22 the region pass**~~ | ✅ **done 17 Aug 2026**, before item 4 as planned — three corrections to its own spec (§23b), and its "adds no declaration shape" argument turned out to be wrong about `box-shadow` (§23c). §23e is the live ordering | mock DOM |

Items 1, 2 and 3 are independent of each other and can run in parallel. **Nothing
in §18b may start before item 4** — shipping six new capabilities on top of a
sanitizer model that has never been checked against the archive is how §14
happened.

**§19's two phases are outside this table on purpose.** Everything above is
ordered by what the sanitizer permits and what the gate must re-prove. §19b and
§19c are ordered by neither, because they add no declaration the compiler cannot
already emit — they can be picked up at any point in this list, by anyone not
currently holding it.

---

## 19. The fandom question — the only section here written from demand

**Written 16 Aug 2026**, and it does not come from reading AO3's source. It comes
from a product question: *an app exists that takes a URL, pulls the site's colour
palette and logos, and builds a design out of it — how hard is that here?*

The mechanism is easy. The **target** was wrong, and correcting it makes the
feature cheaper than the thing originally asked for.

### 19a. What users are actually asking for

Nobody is going to paste `marvel.com` into an AO3 skin tool. Readers want their
archive to feel like Harry Potter, or Spider-Man, or Iron Man — and what a fan
has in hand is not a corporate website. It is **an image**: fan art, a poster, a
screenshot, the picture they already wanted as their banner.

Three consequences, and they redirect the work rather than cancelling it:

| The original idea | What it becomes |
| --- | --- |
| Scrape a website for `theme-color`, its manifest and its favicon | **Dropped.** A day of new endpoint, HTML parsing and SSRF surface for a signal our users do not have |
| Quantize an image into a palette | **Kept, and pointed at `header.bannerUrl`** — an address the user already supplies, through an endpoint that already exists (§19b) |
| Pull the site's **logo** and use it | **Refused.** §11 already ruled on this and §19c explains why the larger sample makes it more clear-cut, not less |

The logo half is worth spelling out once so it is not re-proposed. Three separate
walls, and only the third is a judgement call:

1. **Format.** Real sites serve logos as SVG. AO3's `URI_REGEX` takes
   jpg/jpeg/png/gif only (§3a), and `fetchValidatedImage` refuses SVG outright.
2. **Address shape.** `logo.png?v=3` kills the *entire skin* — `?` is not in the
   character class, so the closing quote never lines up (§3a). And the TLD list is
   an old ICANN snapshot: no `.app`, no `.dev`, no `.xyz`. A large share of the
   sites anyone would paste cannot be hotlinked at all.
3. **Rights.** Even where the address is legal, we would be pointing AO3 pages at
   someone else's server for an asset we do not own. **We ship no images** (§11,
   reaffirmed at §16) — that rule is exactly why `bannerUrl` takes an address the
   *user* chose and hosts.

There is a technically working path — proxy, re-encode to PNG, push through the
existing ImgBB upload, since `ibb.co` is on AO3's TLD list. It makes us the
redistributor of a third party's artwork on a quota-limited account, and §12
already records what happens when such a quota blows: every image in every fic
using that skin breaks at once. **Do not build it.**

### 19b. Phase 15 — theme from the banner image

**One control: "Paste your banner — we'll build the theme around it."** The user
pastes fan art they already picked, and the four colour fields fill in from it.

#### Why it goes through `/api/image-proxy`, for two reasons and not one

The obvious reason is SSRF, and that work is already done and already generic:
`validateRemoteImageUrl` is HTTPS-only, refuses credentials and non-443 ports, and
resolves the hostname through DNS before checking it against blocked IPv4 and IPv6
ranges; `fetchValidatedImage` wraps it in a manual redirect loop with a byte cap,
a timeout, an SVG refusal and a magic-bytes-versus-`content-type` check.
`/api/image-proxy` adds an origin check and 60 requests per IP per minute, takes
`POST {url}`, and returns `{ dataUri, mimeType }`. **Nothing new is needed.**

The reason that is easy to miss: **a cross-origin image taints a canvas.**
Loading the banner directly into an `<img>` and calling `getImageData` throws a
`SecurityError` unless the host sends CORS headers, and image hosts largely do
not. Routing through the proxy returns the bytes as a `data:` URI, which is
same-origin, which is what makes the pixels readable at all. Anyone who "simplifies"
this by dropping the proxy will find it works on their test image and fails on
most real ones — **write that in the comment.**

Check before building: `next.config.js`'s CSP must permit `img-src data:`. The
export path already ships this exact payload shape, so it very likely does.

#### The pipeline

| Step | Where | Note |
| --- | --- | --- |
| Fetch | `/api/image-proxy` | existing endpoint, unchanged |
| Downscale to ~64×64 | client, canvas | cheap, and it blurs JPEG artefacts that would otherwise become their own cluster |
| Skip near-transparent pixels | client | **load-bearing.** Fan art PNGs have transparent margins; without an alpha floor they quantize as white and every theme comes out cream |
| Cluster | `src/lib/siteSkin/palette.ts` | popularity binning or median cut. No dependency; ~60 lines |
| Map to four fields | `palette.ts` | below |

#### The mapping, and the floor that makes it shippable

| Field | From |
| --- | --- |
| `accent` | the highest-chroma cluster with enough population to be deliberate |
| `background` | the darkest (or lightest) neutral cluster — offer both polarities, which is one toggle and doubles the perceived output for no extra maths |
| `surface` | `mixHex(background, text, 0.06–0.10)` |
| `text` | `bestTextColor(background, surface)` |
| all of it | then `fixAccent`, and only then |

**The last row is the feature, not a safety net.** A muddy poster produces a muddy
theme unless the result is pushed through the same contrast maths every template
already obeys. Assert it: a unit test over a fixture set of synthetic pixel arrays
must show `findReadabilityIssues` returning **empty** for every extracted theme.
An extraction path that can produce a warning the templates cannot is a path that
makes the product worse for the users most likely to use it.

Give the generated theme a **stable `meta.id`** (`from-image`, say). `site-skin.tsx`
keys activation analytics on `site-skin:${theme.meta.id}`, so a per-extraction id
would fragment the metric into noise.

#### What it fixes for free

`header.textColor: 'auto'` exists because of a sentence in `theme.ts` and §4b:
*"we cannot measure the brightness of a photograph."* Once the pixels have been
fetched, **we can.** The guess becomes a measurement — `auto` stops being a coin
flip over a banner, and `textShadow` becomes a recommendation the app can justify
instead of a toggle whose purpose is invisible until you try it.

#### What it unlocks that looks like a bug fix

A Discord CDN address fails `checkAo3ImageUrl` and always will (§3a). It is still
a perfectly good image to read colours from. **"That address can't be used as a
banner on AO3 — but here are your colours from it"** turns the single most common
rejection in the product into a partial win. §3a's argument was that catching the
bad address before the user leaves is something no competitor does; this is the
same argument one step further.

#### What it does *not* change — and why this matters for the release gate

Its output is a `SiteSkinTheme` and nothing else. Not one line of `compile.ts` or
`ao3Css.ts` changes; the lint gate, the preview and the export all apply
unmodified; every derived colour is already resolved to literal hex because AO3
has no `color-mix()` (§3). Invariant 4 is satisfied by construction — the thing
produced *is* a theme, so the preview shows it.

**It therefore emits no declaration shape Phase 7's checklist does not already
have to prove.** Different hex values in rules the checklist already covers. That
is the argument for doing it before §18b, which multiplies what the gate must
prove by six.

#### Cost, and one known inefficiency

About a day: the endpoint exists, the colour maths exists, the field exists. The
mapping is where the time actually goes, and it is taste as much as code.

The proxy returns full-resolution bytes, so an 8 MB banner crosses the wire as
~11 MB of base64 to extract sixteen colours from. The export path already ships
exactly this, so it is not a new cost — but if it bites, the fix is a downscale
mode on the server, not a client-side workaround.

**Disclosure.** This sends an address the user typed to our server to be fetched.
Check that the privacy copy covers it before shipping; the ImgBB upload is already
disclosed, and this is the same class of outbound.

### 19b-bis. The banner question, settled — we still ship no images

**Decided 16 Aug 2026, and it closes a question §19a left half-open.** The
proposal on the table was a gallery of premade banners "in the style of popular
fandoms", with the palette extractor as the bring-your-own alternative. The
product instinct was right and the implementation is not the one it looks like.

Shipping our own banner images fails on three counts, and only the third is a
judgement call:

| | Why it fails |
| --- | --- |
| **We become a permanent image host** | AO3 hotlinks; it stores no copy. The moment a reader saves a skin pointing at our URL, that address is load-bearing forever, on a site we do not control, for a person we cannot contact. Rename or delete one file and every skin using it breaks at once — the exact §12 failure, except we would be the host that caused it |
| **Bandwidth that scales with success** | Every AO3 page view by every user of that skin hits our origin. That is AO3's traffic billed to us, growing with adoption. "We ship no images" was incidentally protecting us from this the whole time |
| **The IP line moves** | §19c settles that *palettes* are safe and the *name* is the exposure. An image is a step up: art we commission is ours, so §11's "somebody's fan art" objection dissolves — but art built to evoke a franchise can implicate trade dress when it **depicts** rather than suggests |

**What we built instead: `header.gradient`.** A fade from the accent to
`headerDeep`, vertical or diagonal, off by default. Zero bytes, no host, nothing
to expire, and no rights question at all — it is two colours the theme already
implies. That is the header a §19c palette gets, and it is why those palettes
can read as fandoms without us distributing anything.

**`bannerUrl` is unchanged.** The user finds the image, the user hosts it, and
§3a's validator tells them before they leave the app whether AO3 will take it.
The two controls compose rather than compete: the banner layers *on top of* the
gradient in one `background-image` declaration, so a dead or slow image degrades
to the fade rather than to a flat fill. That is a better version of the promise
§4b already made.

> **The rule survives revision 6 intact: we ship no images.** It has now been
> tested against the most attractive reason yet to break it, and the cheaper
> answer turned out to be the one that keeps it.

The website-URL half of the original proposal stays dropped, for §19a's
reasons — a new endpoint with a new SSRF surface, plus a second fetch for
`og:image`, for a signal nobody has. "Paste an image address" reuses
`/api/image-proxy` untouched; that is the one worth building (§19b).

### 19c. Phase 16 — palettes that read as fandoms

Sixteen templates, all mood-named: Moonlit Library, Paper & Ink, Gothic Velvet.
They are well chosen and they are all *moods*. A reader wanting their archive to
feel like a wizarding school does not search for Moonlit Library.

**A maroon-and-gold palette on parchment, with a serif heading font, is not
anyone's property — and it reads as Gryffindor to everyone who wants it to.**
Red-and-navy reads as the web-slinger. Crimson, gold and graphite read as the
armoured billionaire. Ship as many as taste allows.

The line this document draws, and the reasoning behind each half:

| | Position |
| --- | --- |
| **Colours and typography** | Not protectable, and not protected. Ship freely |
| **The name on the card** | The actual exposure — a template name is a product identifier, which is the use that matters most. **Mood names only, exactly as today.** "House Colours", not "Gryffindor"; "Gold & Circuitry", not "Arc Reactor" |
| **Images and logos** | Unchanged from §11 and §16. We ship none |
| **Articles** | May name fandoms. §19d |

This is product policy with reasoning attached, not legal advice; if the catalog
ever grows a name that is arguably doing brand work, that is the moment to ask
someone qualified rather than to reason from this table.

#### What it costs

`templates.ts` is data. Each template is about nine lines and every template's
compiled output is **already** covered by an automated lint test, plus the
contrast floors and the storage round-trip. Twelve more palettes is an afternoon
and a lot of taste. It is the highest demand-per-effort item on this roadmap.

#### One honest cost, and how to resolve it

Phase 7's gate reads "save all **sixteen** templates on AO3 by hand" (§8, §15f).
Naively that becomes twenty-eight, which would be the tail wagging the dog.

The resolution is in what the gate is *for*: the checklist exists to prove our
sanitizer model against the archive, and a new palette introduces **no new
declaration shape** — same rules, same properties, different hex. So new
templates that add no field and no rule need a spot-check, not a row each.
**Record that decision in `docs/SITE-SKIN-AO3-CHECKLIST.md` when you make it**,
with this reasoning, or the next person will either do twenty-eight manual saves
or quietly skip twelve without knowing which twelve mattered.

If a palette ever wants a font stack or a radius outside the existing lists, that
is a field change and the exemption stops applying.

### 19d. Discovery belongs to the articles, not to the app

A card named *Old Library* cannot rank for "harry potter ao3 skin". This is the
whole reason §19c's naming rule feels like it costs something — and it does not,
because the keyword was never going to live in the app.

**Naming a fandom to describe what an article is about is a different act from
branding a product with it.** It is what every fandom blog on the internet does,
and `docs/AO3-CONTENT-PLAN.md` is already the machinery for it: the audience
analysis, the five rules, the accuracy sheet. The deep link exists too —
`/site-skin?template=<id>`, which the examples gallery already uses (§5).

So the shape is: **the fandom keyword lives in the article, the mood name ships in
the app.** An article ends in one click into the editor with the palette
pre-loaded and the banner field waiting for whatever art the reader already had.

Two of the content plan's own rules bear directly on this and should be re-read
before writing one:

- **Rule 5, "no fandom cosplay."** The article is competent and warm about a
  wizarding-school palette; it does not perform being a fan.
- **Rule 1, "never claim the tool does something it does not."** We help a reader
  build the skin from art *they* chose. We do not supply the art. Being the tool
  that says so plainly is a better story on tumblr than being the tool that
  shipped somebody's Spider-Man.

### 19e. Order — and why neither of these touches the gate

| # | Work | Blocked by | Note |
| --- | --- | --- | --- |
| — | **§19c palettes** | nothing | Data only. Can be built beside anything in §18, including by a different person on the same day |
| — | **§19b theme from image** | nothing | No §17 dependency, no new field, no new endpoint |

Both slot into §18d's list without disturbing it. **Neither is blocked on Phase 7
and neither adds to what Phase 7 must prove** — which is the property that
distinguishes them from every item in §18b, and the reason they are worth doing
while the gate stays open rather than after.

The order between them is a product call, not a technical one. §19c is faster and
visible immediately; §19b is the thing that makes someone tell a friend.

---

## 20. Handoff — 16 Aug 2026 (revision 7)

> **Superseded by §21 (revision 8, 17 Aug 2026).** Items 1–3 of 20e are done and
> 20c's unrun test has been run. Everything else here — particularly 20b and 20d
> — still stands and is not repeated in §21.

**This supersedes §15f's ordering.** §15 is still the
right place for the file map, the five invariants, and the traps; everything
there remains true. What follows is what moved, what is proven, what is *not*
proven, and what to pick up.

### 20a. What landed

| | Status |
| --- | --- |
| **Phase 11** — §17's five `ao3Css.ts` corrections | ✅ Differential **0 false accepts / 0 false rejects** over 4,418 distinct corpus declarations; capability probe **75/75 agree** |
| **Phase 12** — §18a chrome regions | ✅ Compiler, mock DOM and unit tests. Browser test written, **not yet executed** — see 20c |
| Unit tests | 432 passing (`--project=unit`), `tsc --noEmit` clean |
| Header gradient control | ✅ Was already in the working tree at the start of this session — `header.gradient`, three options, `.primary` fix. **All 16 templates still ship `gradient: 'none'`**, so nothing uses it yet |

Everything is **uncommitted**, on `growth/tier1-tier2-trust-copy`. That branch
name is about unrelated trust copy; this work wants a branch of its own before
it is committed.

### 20b. The two learnings, which are worth more than the code

**A derived colour is only meaningfully tested against a contrast floor.**
`controlBg` shipped inverted — `mixHex(surface, text, 0.1)` keeps 90% of *text*,
not 10% — producing a cream button carrying cream text on all seven dark
templates. That is defect §4.4 again, in a new region, and it passed a green
suite because every assertion compared the emitted value against `d.controlBg`
and was therefore tautological. It was caught by *reading the compiled output*,
not by a test. The floors are in place now and reverting the mix fails all
sixteen templates. **Assert against a threshold, never against the formula.**

**`!important` defeats AO3's own exemptions, not just its defaults.** §3b argues
for blanket `!important` against AO3's ID-scoped defaults, and §14b already
found the first place that argument overreaches (an author's work skin). §18a
found the second: AO3 exempts its header and footer from its own button cascade
with quiet (1,0,1) rules, and a shouted (0,1,1) from us beats them. The lesson
generalises past both cases — **before emitting a bare element or class
selector, check whether AO3 relies on specificity to carve something out of it.**
That is now three separate bugs from the same root, so it belongs in §15e as a
standing trap.

### 20c. What is NOT proven, precisely

- **The §18a browser test has never run.** `tests/site-skin.spec.ts` gained
  "AO3s grey chrome is repainted, and the header and footer are spared", which
  is the only check of the `#main` scoping decision against a real cascade — and
  it has not been executed once. The dev server needs ~60s to boot and the
  `/site-skin` route did not finish compiling inside a 180s warm-up in this
  environment. **Run it first:**

  ```bash
  npm run dev            # wait for "Ready", then load /site-skin once by hand
  UX_BASE_URL=http://localhost:3000 npx playwright test --project=desktop \
    tests/site-skin.spec.ts -g "grey chrome"
  ```

  Treat a failure there as a real finding about the scoping, not as a flaky test.
- **Phase 7 is still the open gate**, and it is now carrying more: the chrome
  rules add `input[type="submit"]` (an attribute selector) and a batch of
  pseudo-class selectors that no template previously emitted. AO3 never
  validates selectors (§15e), so these will store silently whether or not they
  are right.
- The environment ended this session unable to write `playwright-report/` and
  with git refusing the repo for `dubious ownership`. Both are local, neither is
  caused by these changes; `git config --global --add safe.directory` fixes the
  second.

### 20d. Product decisions taken in conversation, not from source

Recorded because none of them is derivable from the code, and the reasoning is
the part that will otherwise be re-litigated:

- **Premade templates get gradient headers. We ship no images.** The control
  already exists and is unused. This keeps §11/§16/§19a's "we ship no images"
  rule intact at zero cost, and it means a premade can never break the way a
  hotlinked banner does when its host disappears (§12).
- **Users may still supply their own banner address** — that path is unchanged
  and already validated in three places (§3a, §6).
- **If shipping our own banner images is ever reconsidered**, three costs were
  identified and none is in this document elsewhere: we become a *permanent*
  image host (a saved skin points at our URL forever, and renaming a file breaks
  every skin using it silently); every AO3 pageview by every user of that skin
  bills bandwidth to us, scaling with the feature's success; and original art
  built to evoke a franchise moves the IP question from "palette" (settled, §19c)
  to trade dress (not settled). `app.ao3skingen.wordfokus.com` *is* on AO3's TLD
  list and `public/` serves stable filenames with no query string, so the
  mechanism would work — the objections are not technical.
- **§19b should be reframed as a fallback, not the headline.** If premades carry
  their own palettes, extraction is only needed for "none of these are my
  fandom." That is a much smaller promise than §19b currently makes.
- **Nothing records whether `bannerUrl` is ever used.** `site-skin.tsx` fires one
  event, `project_activated`, carrying `templateId` and nothing else. §19b's
  entire value rests on an assumption no data can currently confirm. **Adding a
  `bannerSet` boolean to that event is a one-line change and should precede any
  further banner work.**

### 20e. What to do next, in order

| # | Work | Why here |
| --- | --- | --- |
| 1 | **Run the §18a browser test** (20c) | The only unverified thing that just shipped |
| 2 | **Turn gradients on across the 16 templates** | The control is built and unused; this is the decision in 20d, and it is data plus taste, no code |
| 3 | **§18c-2 — required tags as text** | §18d item 3, unchanged: highest-demand single control, accessibility win, no §17 dependency. The corpus's own `Add-Ons` repo independently arrived at §18c-3's exact ten-rule adjacency pattern, which is good evidence the design is right |
| 4 | **Phase 7 + P11 on real AO3** | The gate, now with more to prove (20c) |
| 5 | §18c-3 … 18c-6, then §18b | Unchanged from §18d |

§19c's palettes remain unblocked and outside this order, exactly as §18d says.

---

## 21. Handoff — 17 Aug 2026 (revision 8)

**The current handoff.** §15 still owns the file map, the five invariants and
the traps. §20b (the two learnings) and §20d (the product decisions) are still
true and are not restated here. This section is only what moved.

### 21a. What landed

| | Status |
| --- | --- |
| **§20c's unrun test** | ✅ **Run, and it passes.** `tests/site-skin.spec.ts` "AO3s grey chrome is repainted, and the header and footer are spared" — the `#main` scoping decision is now checked against a real cascade rather than asserted |
| **Gradients across the catalog** (§20e item 2) | ✅ Ten of sixteen; the rule is `gradientFor(moods)` in `templates.ts` and a test pins every template to it |
| **§18c-2 — required tags as words** (§20e item 3, §18d item 3) | ✅ New `reading` group, nine declarations, mock DOM, editor row, unit + browser tests. Off in all sixteen |
| Tests | 442 unit, 23 browser (`tests/site-skin.spec.ts`) — all passing, `tsc --noEmit` clean |

The catalog's gradient rule, so nobody re-argues it template by template:
`minimal` mood → flat, `decorative` → diagonal, neither → vertical, with
`minimal` tested first so Terminal Green (`dark, minimal`) stays flat. It is the
same shape of rule that already governs `tagColors`, and `gradientFor` is
exported so the test asserts the rule rather than sixteen literals.

**Turning gradients on made two illustrations lie, and both are fixed.** The
gallery thumbnail in `TemplateGallery.tsx` painted a flat accent header — the
exact drift its `derive()` sharing exists to prevent, and its own comment
promises a card cannot advertise a header the skin does not produce. It now
takes `d.headerGradient` from the same derived string the compiler emits. The
marketing gallery (`public/examples-gallery.html`) had the same flat headers,
and was patched from the cards' own colours: each card already carried the
accent as its header background and `headerDeep` as its border, which are
exactly the two stops. **That page is generated by a script that was never
checked in** (§7's "throwaway script"), so it can drift again and nothing will
fail — worth an hour to check the generator in if anyone touches it next.

Everything is still **uncommitted**, still on `growth/tier1-tier2-trust-copy`,
and still wants a branch of its own. That has not changed since §20a.

### 21b. The learning, and it is about the preview rather than the compiler

**A transcribed AO3 rule is not the same thing as the part of it we care
about.** §18c-2's spec table lists the declarations our control has to *undo*.
Transcribing that table into `mockPage.ts` as though it were AO3's stylesheet
left out one declaration nothing needed to undo — `margin: 0` on
`.blurb ul.required-tags` — and that omission changed a cascade: the icon block
and the 65px gutter rule are both (0,2,1), so **source order decides**, and
without AO3's later `margin: 0` the icons rendered on top of the title.

It presented as a bug in our own rules. It was a mock that had never been AO3.
The general form belongs beside invariant 3 in §15c:

> The preview is only honest about **our** CSS. It is honest about **AO3's**
> only to the extent that `AO3_BASE_CSS` is a faithful transcription — rule
> **and** order. Fetch the real stylesheet when adding to it; do not
> reconstruct it from a table of what we intend to override.

`AO3_BASE_CSS`'s required-tags block was taken from
`public/stylesheets/site/2.0/13-group-blurb.css` on `master`, verbatim and in
file order, and a test now asserts the ordering rather than only the content.

Two smaller things, both of which cost a cycle each and are cheap to avoid:

- **Backticks inside `mockPage.ts`'s CSS template literals terminate the
  string.** Twice in one session, both times in a comment quoting a selector.
  Use double quotes in those comments. `tsc --noEmit` catches it instantly; the
  dev server reports it as a 500 with no obvious cause.
- **Chrome will not compute a font-size below 6px**, so AO3's `0.001em`
  hiding trick reads as `6px` in `getComputedStyle`, and the hidden `span.text`
  is 25px wide rather than 0 (AO3's own `li span` rule is more specific than its
  `span.text` rule). Assert transparency and the *width change*, not a
  sub-pixel font size.

### 21c. What is NOT proven

- **Phase 7 is still the open gate, and it now carries two new shapes.** Ten
  templates ship a `linear-gradient` — so P11's gradient question is no longer
  academic, and a refusal fails ten templates at save time. The required-tags
  rules add `min-height`, `margin-left`, an adjacency selector and a
  `background-image: none` on a sprite, none of which any template emits by
  default. `docs/SITE-SKIN-AO3-CHECKLIST.md` gained **P13** for the second and
  its coverage list now records the first.
- **Nothing in the mock proves the required-tags rules are safe on a
  *bookmark* or a *series* blurb.** Both reuse `.blurb`, and
  `13-group-blurb.css` gives `.bookmark .short .header` a `min-height` of its
  own that our `!important` will beat. P13 asks for it; the mock does not
  render either.
- The environment issues in §20c were **local file permissions**, not code:
  `.next`, `test-results` and `playwright-report` were owned by
  Administrators and unwritable, which is what stopped the dev server and the
  test runner. `icacls <dir> /grant "<user>:(OI)(CI)F" /T` clears it, and
  `git config --global --add safe.directory <repo>` clears the git half. The
  `/site-skin` route takes ~70s to compile cold; warm it with one request
  before running the browser spec or the first test eats the timeout.

### 21d. The region audit, added the same day

After the above landed, a published skin's own screenshots prompted an audit of
what we style against what AO3 hard-codes. **§22 is the result, and it reorders
the list below.** The short version: five of the nine page types a real skin author
screenshots are covered, four are not, the failures concentrate in `.listbox`,
one of them is a **bug shipping today** (22c), and our preview could not have
shown any of it (22d). §22e is a build spec, ordered, with the mock work first.

### 21e. What to do next, in order

> **Superseded by §23e.** Items 1 and 2 below landed on 17 Aug 2026; items 3–7
> are still accurate and are restated there in the same order.
>
> Revised by 21d. §22 moves ahead of the gate, on §18a's argument: it changes
> what all sixteen templates emit, and running the gate on CSS we are about to
> change means running it twice. **It is the last thing that may go in before
> the gate** — everything after item 2 waits.

| # | Work | Why here |
| --- | --- | --- |
| 1 | ~~**§22c — the relationship-tag chip**~~ ✅ 17 Aug 2026 | Two lines. A feature we ship today makes thirteen templates *worse* in every listing; it should not wait behind anything |
| 2 | ~~**§22e — the region pass**, mock first~~ ✅ 17 Aug 2026 | Same shape and size as §18a, no new declaration shape, and it finishes the page types readers actually look at. Doing it after the gate means a second gate. (**"No new declaration shape" was wrong** — see §23c) |
| 3 | **Phase 7 + P11 + P12 + P13 + P14 on real AO3** | The gate. Ten templates now carry gradients, so P11 is no longer a scratch-skin curiosity — a refusal fails ten templates at save time |
| 4 | **§18c-3 and §18c-4 together** | Tag labels and the separator share the same ten-rule adjacency list; building either alone means building it twice. Neither needs the third cascade mode |
| 5 | **§18c-5, then §18c-6** | Stat icons are self-contained. 18c-6 is the one that needs §18c-0's third cascade mode and its test, so it wants a clear run |
| 6 | **§18b** depth | Unchanged: blocked on the gate. Note §22e emits the compiler's first `box-shadow`, and §18b's card elevation must extend those rules rather than adding new ones |
| 7 | The `bannerSet` analytics line from §20d | Still one line, still unwritten, and §19b still rests on the assumption it would test |

§19c's palettes remain unblocked and outside this order.

### 21f. If you are starting cold, do this

1. `git config --global --add safe.directory <repo>`, and grant yourself write
   access to `.next`, `test-results` and `playwright-report` (21c).
2. `npm run dev`, then **load `/site-skin` once by hand** — it takes ~70s to
   compile cold and the first browser test will otherwise eat its timeout.
3. `npx playwright test --project=unit` (468, no server) and
   `UX_BASE_URL=http://localhost:3000 npx playwright test --project=desktop
   tests/site-skin.spec.ts` (24). Both should be green before you touch
   anything; if they are not, that is the finding.
4. Read §15b (the file map) and §15c (the five invariants), then §22e.
5. Adding a control is still the five-file change in §15d, in that order, and
   **all sixteen templates** every time.

---

## 22. The region audit — nine screenshots, and what they showed we do not style

**Written 17 Aug 2026, and it changes §21e's order.** Read this before starting
anything in §18b; it is smaller than §18b, it is the same shape of work as
§18a, and one item in it is a bug shipping today.

### 22a. Where it came from, and why the method matters

A published site skin ([Romantic](https://archiveofourown.org/works/38434996),
distributed the usual way — a work with the CSS pasted into a chapter) advertises
itself with **nine screenshots**: Main, Profile, Footer, Filters, Forms, Works,
Comments/Kudos, Collections, Own works. That list is not a design choice. It is
the author telling you which pages they had to think about, and it is a better
coverage checklist than anything we had written.

The audit was mechanical, not visual: every selector the compiler can emit (113
of them, with every control on) against the colour-bearing rules in AO3's own
stylesheets, **fetched from `master` on 17 Aug 2026** rather than recalled.

The result is that we cover five of the nine well and four of them poorly, and
the failures concentrate in a single AO3 construct.

### 22b. The evidence

Everything below is an AO3 default with a **hard-coded light colour** that no
rule of ours overrides. On the seven dark templates, each one is a light-grey or
white island on a dark page — §18a's defect, one region deeper.

| AO3 default | File | Where a reader meets it | Ours? |
| --- | --- | --- | --- |
| `.listbox, fieldset fieldset.listbox { background: #ddd; border: 2px solid #ccc; box-shadow: 0 0 0 1px #fff }` | `11-group-listbox` | Profile, Collections, Own works, the filter sidebar | ❌ |
| `.listbox .index { background: #fff; box-shadow: inset 1px 1px 3px #bbb }` | `11-group-listbox` | a **white** panel inside that grey box, on all of the above | ❌ |
| `.listbox > .heading, .listbox .heading a:visited { color: #2a2a2a }` | `11-group-listbox` | near-black heading text on it | ❌ |
| `dl.meta { border: 1px solid #ccc }`, `dl.meta .wrapper { border-bottom: 1px solid #ccc }` | `12-group-meta` | the work metadata table — on **every work page** | ❌ |
| `dl.index dd { background: #ededed }` | `10-types-groups` | profile and collection index panels | ❌ |
| `li.relationships a { background: #eee }` | `10-types-groups` | **every listing on the archive** — see 22c | ❌ |
| `.statistics .index li:nth-of-type(even) { background: #eee }` | `10-types-groups` | the statistics page's zebra rows | ❌ |
| `a.cloud1 … a.cloud8 { color: #200 … #900 }` | `10-types-groups` | the tag cloud — dark red on a dark page | ❌ |
| `.wrapper:has(> table, > .meta) { box-shadow: 1px 1px 5px #aaa }` | `10-types-groups` | a light halo around meta tables | ❌ low priority |

Three findings in the other direction, worth recording so nobody re-audits them:

- **The front page is already ours.** `17-zone-home.css` sets exactly one colour
  rule, `.home .header h2 { border-bottom: 2px solid }` — no colour value, so it
  takes `currentColor` and follows the theme for free. "Main" looks unstyled in
  the corpus screenshots because of `.listbox`, not because of anything in the
  home zone.
- **`a.tag:hover` is covered.** AO3's rule pairs it with
  `.listbox .heading a.tag:visited:hover` at much higher specificity, but ours
  carries `!important` and wins both.
- **`p.qr svg { background: #fff; border: 1em solid #fff }` must stay white.**
  A QR code on a dark background does not scan. This is a *deliberately
  unowned* row in §4b's sense, and it is the clearest example of one.

### 22c. The bug that is shipping right now

`li.relationships a { background: #eee }` gives every relationship tag in every
listing a pale grey chip. Our "colour tags by type" control sets that tag's
**text** colour and leaves the chip, so on a dark theme thirteen templates
render a light pill carrying tinted text — a worse result than the accent it
replaced, in the feature §13 shipped to make listings more readable.

**Two lines fix it** (`li.relationships a { background-color: transparent }`,
which loses to `a.tag:hover` at (0,2,1) so hover still paints). It is listed
separately from the rest of 22b because it is a regression rather than a gap,
and because it needs no design conversation at all.

### 22d. Why we could not see any of it — and the rule that follows

**`AO3_BASE_CSS` carries none of these rules.** No `.listbox`, no `.statistics`,
no `dl.index`, no relationship chip, and `dl.meta`'s border transcribed as `#ddd`
where AO3 says `#ccc`. So the preview shows three states that look finished while
the real pages are not, and it would have gone on showing that indefinitely: the
mock cannot fail a test we never wrote about markup it does not contain.

This is §14's failure with a different subject. §14 was *a model of AO3 with no
work skin in it*; this is *a model of AO3 with only three of its pages in it*.
The lesson from §21b generalises one step further, and belongs beside invariant
4:

> **Invariant 4 says a control must be previewable. It does not say the preview
> is complete.** A region absent from `mockPage.ts` is not "not yet styled" —
> it is *invisible*, and invisible is indistinguishable from finished. When you
> want to know whether we cover something, read AO3's stylesheet, not our
> preview.

### 22e. Build spec

> **Built 17 Aug 2026. Three corrections to what follows, all found while
> building it and all recorded in §23b: `.listbox > .heading` is *not* emitted,
> `dl.meta .wrapper` is *not* emitted, and `.wrapper:has(> table, > .meta)` —
> the "low priority" row in 22b — *is*. The claim below that this adds no new
> declaration shape is also wrong: `box-shadow` is new, and the checklist now
> carries that.**

No new theme field, no new control, no new lint capability, and **no new
declaration shape** — every property below is one all sixteen templates already
emit. That is what makes this safe to do before the gate rather than after it,
by exactly the argument that let §18a go first.

**Order matters here.** Do the mock first, or every rule below ships unverified:

| # | Step | Note |
| --- | --- | --- |
| 1 | **Transcribe the 22b rules into `AO3_BASE_CSS`** — verbatim, in file order (§21b) | Fix `dl.meta`'s `#ddd` → `#ccc` while in there. After this step the preview should look *worse*, which is the point |
| 2 | **Mock markup**: extend the Dashboard state with a `.listbox` containing an `.index`, a `dl.index`, and a `.statistics .index`; add a `dl.meta .wrapper` to Reading | Dashboard is already the "your account" page, which is where a reader meets listboxes. A fourth preview state is not needed and would cost a tab |
| 3 | **22c's chip** | Two lines, fixes a live regression |
| 4 | **Ownership rows below** | |
| 5 | Re-run the differential and the capability probe | Neither should move; if either does, stop |

Rows for §4b's table:

| Control | Owns | Emit |
| --- | --- | --- |
| `colors.background` | `.listbox` | `background-color`, `border-color: border`, `box-shadow: none` |
| `colors.surface` | `.listbox .index` | `background-color`, `box-shadow: none` |
| `colors.text` | `.listbox > .heading`, `.listbox .heading a:visited` | `color` |
| derived `border` | `dl.meta`, `dl.meta .wrapper` | `border-color` |
| derived `commentAlt` | `dl.index dd`, `.statistics .index li:nth-of-type(even)` | `background-color` |
| `colors.accent` | `li.relationships a` | `background-color: transparent` — 22c |

**The polarity of the listbox pair is deliberate.** AO3 paints the outer box
`#ddd` and the inner panel `#fff` — outer darker, inner lighter, inner reads as
the card. Mapping outer→`background` and inner→`surface` keeps that relationship
in either polarity, and reuses the two colours the Page and Cards controls
already mean. Painting both `surface` would flatten a distinction AO3 is using
to separate a container from its contents.

`box-shadow: none` on both is load-bearing for the same reason
`background-image: none` is on the footer and the buttons: AO3 layers a white
1px ring on the outer box and an inset grey shadow on the inner one, and a
background colour alone leaves both sitting on top. Note this is the **first**
`box-shadow` the compiler emits, and §18b's card-elevation control wants the
same property — so whoever builds this owns the selector, and §18b must add its
shadows to *these* rules rather than to new ones (invariant 1).

**The tag cloud is deliberately deferred.** `a.cloud1…8` is eight rules, and the
honest version keeps AO3's popularity ramp — eight steps mixing from a muted
accent to the full accent — rather than flattening all eight to one colour. But
the cloud lives on the Tags page, which the mock does not render, and invariant
4 says that settles it: either the mock gains a cloud or the control does not
ship. Not worth holding the rest of 22e for.

### 22f. What this does *not* cover

Still unowned after 22e, and each needs a reason before it is picked up:
`.splash` (see 22b — likely nothing to do), `.reading`/`.viewed` state markers on
a history page, `#modal`, `.admin` regions, and the tag cloud above. None of
them appears in the corpus's nine screenshots, which is itself evidence about
what readers actually look at.

---

## 23. Handoff — 17 Aug 2026, later (revision 9)

**The current handoff.** §15 still owns the file map, the five invariants and
the traps. §20b, §20d and §21b are still true and are not restated. This section
is only what moved since §21.

### 23a. What landed

| | Status |
| --- | --- |
| **§22c — the relationship chip** (§21e item 1) | ✅ Two lines. `li.relationships a { background-color: transparent }`, unconditional |
| **§22e — the region pass** (§21e item 2) | ✅ `.listbox`, `.listbox .index`, `dl.meta`, `dl.index dd`, `.statistics` even rows, and the meta halo. Mock first, as ordered |
| Acceptance | ✅ Differential **0 false accepts / 0 false rejects** over 4,418 declarations, unmoved. Capability probe: **no divergences**. `tsc --noEmit` clean |
| Tests | 468 unit (was 442), 24 browser (was 23) — all passing |

Everything is still **uncommitted**, still on `growth/tier1-tier2-trust-copy`,
and still wants a branch of its own. That has not changed since §20a.

### 23b. Three corrections to §22e's own spec, and how each was found

None of these came from a failing test. All three came from reading AO3's source
rather than the audit's summary of it — which is the same method §22 used, one
level down.

**1. `.listbox > .heading` is not emitted, and must not be.** §22e's table gave
it `colors.text`, on the strength of AO3's
`.listbox > .heading { color: #2a2a2a }`. But every listbox on the archive is
inside `#main`, and our own `#main .heading` accent rule is **(1,1,0)** against
that selector's **(0,2,0)**. Both carry `!important`, so specificity decides and
the accent wins — meaning AO3's near-black is *already* overridden, and the row
would have added a rule that loses to another of ours on every page it could
apply to. **A dead declaration that reads like a working one is worse than a
missing one**, so the omission is pinned by a test with the arithmetic in it.

This is the general shape worth carrying: **an audit that reads AO3's stylesheet
against "do we own this selector?" will over-report.** The question is not
whether we name the selector, it is whether anything of ours *reaches the
element* — and our own broad rules reach a great deal. Check what wins before
adding a row.

**2. `dl.meta .wrapper` is not emitted either — the markup does not exist.**
12-group-meta carries a "mod: wrapped data" block, so the audit listed it.
Grepping every template in otwarchive `master` for `wrapper` returns
thirty-three, and **every one of them is the div AO3 wraps *around* a meta list**
— `works/_meta`, `stats/index`, `profile/show`, `series/show`,
`collection_profile/show`. Not one is inside a `dl.meta`. The rule styles markup
the archive does not currently render, and emitting it would put a permanently
dead declaration into the stylesheet every user pastes.

**3. `.wrapper:has(> table, > .meta)` *is* emitted, though 22b marked it low
priority.** Chasing correction 2 settled it: otwcode's own meta pattern states
the rule outright — *"meta is always wrapped in `<div class='wrapper'>`"* — and
the five views above confirm it. So AO3's `box-shadow: 1px 1px 5px #aaa` is a
grey halo on **every work page**, plus Profile, Series, Collections and Stats.
It was "low priority" only because nothing in the preview rendered a `.wrapper`
around a `dl.meta`; adding one to the Reading mock turned it from invisible into
an obvious ring, and then it was one line. That is §22d's rule working as
intended in the other direction — **the mock made the case for the fix.**

### 23c. The learning, and it is a correction to something this file believes

**`box-shadow` is a new declaration shape, and §22e said it was not.** The spec's
argument for going before the release gate rested on "no new declaration shape —
every property below is one all sixteen templates already emit". That was
checked against the *ownership table's* properties and it is false: `box-shadow`
had never been emitted by the compiler, and it is now in all sixteen templates
because §22e's rules are unconditional.

The claim was not carelessness so much as a category error. `box-shadow` was
*permitted* — §17's Correction 5 unblocked it in Phase 11 — and permitted got
read as covered. But the release gate is not a lint; it exists precisely because
the lint is a model (§15a). **"Our lint accepts it" and "the gate has proven it"
are different states, and the second is the one that lets you skip the gate.**

The cost is bounded and the checklist now carries it: sixteen templates rest on
`box-shadow: none` being kept, and P11's shadow row is the probe. Two selector
shapes are new too — `:has()` and `:nth-of-type(even)` — and while `§3` says AO3
never validates a selector, that reading is exactly what P8 exists to turn into
an observation for `::-webkit-scrollbar`. Both are now called out there.

> Beside invariant 5, and it is the inverse of it: **being stricter than AO3 is
> our recurring bug; assuming AO3 agrees with our model is the same bug wearing
> the other face.** A capability the lint permits has not been to the archive.

### 23d. What is NOT proven

- **Phase 7 is still the open gate**, and it now carries `box-shadow: none` on
  all sixteen templates, plus the two new selector shapes. `P14` has been
  rewritten from "record how wrong these four pages look" into the confirmation
  that §22e worked, and `P11`'s shadow row is flagged as load-bearing.
- **The polarity of the listbox pair is a judgement, not a measurement.** Outer →
  `background`, inner → `surface` preserves AO3's own darker-outer relationship
  in either polarity, and a browser test asserts the two differ. Whether it reads
  *well* on a real profile page is P14's question.
- **The tag cloud is still deferred** and the reason has not changed: `a.cloud1…8`
  wants AO3's eight-step popularity ramp rather than one flat colour, and the
  mock renders no Tags page. Invariant 4 settles it — either the mock gains a
  cloud or the control does not ship.

### 23e. What to do next, in order

§21e's items 1 and 2 are done. The rest of that list stands, moved up:

| # | Work | Why here |
| --- | --- | --- |
| 1 | **Phase 7 + P11 + P12 + P13 + P14 on real AO3** | The gate, and nothing should go in ahead of it now. Ten templates carry gradients and all sixteen carry a `box-shadow`; both are model-only until this runs. **Do P10 first** (§15f) |
| 2 | **Whatever the gate finds.** Assume it finds something | |
| 3 | **§18c-3 and §18c-4 together** | Tag labels and the separator share the same ten-rule adjacency list; building either alone means building it twice. Neither needs the third cascade mode |
| 4 | **§18c-5, then §18c-6** | Stat icons are self-contained. 18c-6 is the one that needs §18c-0's third cascade mode and its test, so it wants a clear run |
| 5 | **§18b** depth | Blocked on the gate. **And now on §22e**: `.listbox`, `.listbox .index` and `.wrapper:has(…)` already own `box-shadow`, so card elevation must extend *those* rules rather than adding new ones, or invariant 1 breaks the moment both ship |
| 6 | The `bannerSet` analytics line from §20d | Still one line, still unwritten |

§19c's palettes remain unblocked and outside this order.

### 23f. One thing worth an hour, still unclaimed

`public/examples-gallery.html` is generated by a script that **was never checked
in** (§21a). It has now been hand-patched twice — once for gradients, once for
the trust copy — and each time the drift was caught by someone looking. Nothing
fails when it drifts. §22e did not touch it, because the gallery shows header
and card colours and this pass changed neither; the next pass that changes a
card *will* touch it, and will find the same missing generator.

---

## Sources

AO3 rules verified against otwarchive `master`, 6 August 2026, **re-verified
7 August 2026**, and **re-verified again 16 August 2026** against
`lib/css_cleaner.rb` and `config/config.yml` for revision 5 (§17). The 16 August
pass found the first real upstream drift — an `aspect-ratio` branch that is not
in our model — and four defects of our own. The re-verification diffed our copied data against upstream
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
