# The Magic Picker — Implementation Plan

**For:** the developer building this. Assumes you have read
`SITE-SKIN-IMPLEMENTATION.md` §15 (the file map, the five invariants, the traps)
and §19 (the fandom question). This document is the full build; §19b and §19a
over there are its history and are partly superseded here — see §7.

**Status: all three phases are built.** Phase A landed 17 Aug 2026; Phase B the
same day (§11 records what it cost and what it corrected); Phase C — the URL
picker — landed 17 Aug 2026 (§12). The release gate closed first, as §8 required,
and P15 passed, so §6d's mapping targets stand as written.

> ## Start here
>
> **What it is, in one sentence.** The user pastes a link — to a website, or to a
> picture — and we build an AO3 site skin from its colours.
>
> **The single most important thing in this document is §2**: what AO3 makes
> *impossible*, and therefore what this feature can and cannot promise. Get that
> wrong and you will build something that works perfectly and disappoints
> everyone who uses it.
>
> **Read in this order:** §1 (why), §2 (the wall), §3 (what it must promise),
> then §5 (Phase B), whose §5f records four things the first draft of this plan
> got wrong. §6 is Phase C — the headline feature and the one with real risk in
> it — and §12 is what building it actually cost and corrected.
>
> **The invariant that keeps this cheap is §8.** The output is a
> `SiteSkinTheme` and nothing else. If you find yourself editing `compile.ts`,
> stop and re-read it.

---

## 1. Why this exists

Sixteen templates is a finite catalog. §19c wants roughly twelve more and it
still will not cover taste, because taste is not a list. The picker converts a
closed set into an open one: instead of *"pick the closest of sixteen"*, the user
brings the thing they already love.

There is a second reason and it is about acquisition rather than product.
*"Turn any website into an AO3 skin"* is a sentence somebody posts on Tumblr.
*"We have sixteen templates"* is not. `docs/AO3-CONTENT-PLAN.md` is the place
that argument gets cashed.

**Where the idea came from.** §19 records it as a product question — *an app
exists that takes a URL, pulls the site's palette and builds a design out of it,
how hard is that here?* §19a answered "the target was wrong" and pointed the work
at an image instead, on the grounds that *"nobody is going to paste `marvel.com`
into an AO3 skin tool."* That is probably true and it is also answering a
different question. §19a killed the URL picker as a **fandom** mechanism. This
document revives it as a **taste** mechanism: for the reader who has looked at
all sixteen templates and wants none of them. That premise was never argued
against.

---

## 2. The wall — what AO3 makes impossible

Read this before designing anything. Every one of these is verified against
`otwarchive` master, and the first is the one that shapes the whole feature.

### 2a. Fonts cannot be transferred. At all.

`clean_css_code` refuses `@font-face` outright — it is the one thing AO3 rejects
at *selector* level. `src` is not among its 181 allowed properties. And `url()`
is permitted only on `background`, `background-image`, `border`, `border-image`,
`list-style` and `list-style-image` — never on a font.

So there is no reachable path to loading a font file. **Not one we host, and not
one from Google Fonts, Bunny, Fontshare or any other library.** A library would
also need `@import` or a `<link>` tag; a skin is CSS only and the sanitizer's
rule walk carries neither.

This is settled, published knowledge in the AO3 community, not our discovery.
The long-running tutorial *"Fonts, and colors, and work skins, oh my!"*
([work 28934610](https://archiveofourown.org/works/28934610)) states it plainly:

> "Since embedding the fonts isn't an option on AO3, you can only enter a picture
> (hosted elsewhere) or hope that your reader's device has at least one of the
> fonts that you list in a given rule"

and, on what a `font-family` actually is:

> "your choice of font doesn't embed the font(s) into the fic's download nor into
> the online page as it would on a piece of paper, it just makes a suggestion and
> the reader's device will try to comply."

**Do not re-propose webfonts.** Three separate people will think of it.

### 2b. Layout cannot be transferred either

AO3's page structure is fixed. We are recolouring somebody else's HTML, not
rebuilding a site. Grid, spacing, column widths, illustration, motion — none of
it crosses over, and none of it can.

### 2c. What that leaves

| Signal on the source | Extractable? | Survives to AO3? |
| --- | --- | --- |
| Colours | Yes, well | **Yes — this is the payload** |
| `border-radius` | Yes | Yes → `shape.cardRadius` |
| Font *category* (serif / geometric sans / mono / script) | Yes | **Yes, as a nearest match** — see §4 |
| Font *identity* (Inter, Poppins, GT America) | Yes | **No** |
| Layout, spacing, imagery, motion | Partly | **No** |

Two columns wide, one column deep. That is the honest shape of this feature and
§3 is what to do about it.

---

## 3. What it must promise — and this is a product decision, not copy

**Do not promise "match this website."** When someone says they love a site's
design they overwhelmingly mean its typeface, its spacing and its pictures. We
can deliver four colours, a corner radius and a font *category*. "Match" sets up
a comparison we lose on every single use.

**Promise "steal this site's colours."** It is what the feature does, it is still
a good hook, and it converts the font result from a broken promise into a bonus:
*"this site uses a geometric sans — closest AO3 allows is Futura."*

There is a second honesty problem worth designing for up front: **the modal
result is boring.** Most sites people admire are near-white, dark-grey text and
one saturated accent. That extraction lands very close to Clean Slate, which we
already ship. §5e and §6e are the mitigation, and §5e is the one that is built:
**both polarities are shown side by side at the moment of choice**, so the
common result is a decision rather than a verdict.

---

## 4. Phase A — the font bank ✅ built 17 Aug 2026

The prerequisite, and the reason it came first: with the old seven stacks, any
classifier's honest answer was "Georgia" or "Arial", so the font half of the
picker was a shrug no matter how good the extraction was.

**What exists now** in `src/lib/siteSkin/theme.ts`:

- `FONT_STACKS` grew 7 → 24, each stack naming a Windows face, a macOS
  counterpart and a generic — e.g. `'Segoe UI', Candara, Optima, sans-serif`
- `FontGroup` (`serif | sans | display | script | mono`) drives the `<optgroup>`s
- `FontRole` (`heading | body`) — script and display faces are **heading only**,
  enforced in `validateTheme` as well as in the editor
- `fontStacksFor(role)` is the accessor both the UI and the tests use
- `FontRow` in `ThemeEditor.tsx`: grouped native select, each option styled in
  its own face, plus a live specimen line

**The constraint you must not break.** `validateTheme` accepts a font only if the
string is a member of `FONT_STACKS`, and a stored theme holds the literal stack
string. **The bank is append-only.** Deepening `'Georgia, serif'` into a longer
chain would silently reset every saved theme that chose it. A test pins the
original seven byte for byte.

**Proven since:** P15 in `SITE-SKIN-AO3-CHECKLIST.md` passed on 17 Aug 2026. A
five-name, three-quote stack was saved to AO3 and read back **whole**, in all
three places the compiler emits it, single quotes byte for byte. So
`sanitize_css_font` behaves as our port models it and the 24-stack bank is safe
as shipped.

---

## 5. Phase B — palette from an image ✅ built 17 Aug 2026

**Built first**, as ordered: it is nearly free, it is the engine Phase C needs,
and it ships value on its own. §19b costed it at about a day and that was right.

Read §5f before changing any of it. The first draft of this section contained
four errors, and two of them would have shipped a working feature that was
quietly wrong.

### 5a. Why it goes through `/api/image-proxy`, for two reasons

The obvious one is SSRF, and **that work is already done and already generic**:
`validateRemoteImageUrl` is HTTPS-only, refuses credentials and non-443 ports,
and resolves the hostname through DNS before checking it against blocked IPv4 and
IPv6 ranges. `fetchValidatedImage` wraps it in a manual redirect loop with a byte
cap, a timeout, an SVG refusal and a magic-bytes-versus-`content-type` check.
`/api/image-proxy` adds an origin check and 60 requests per IP per minute, takes
`POST {url}` and returns `{ dataUri, mimeType }`. **Nothing new is needed** — and
nothing new was added.

The reason that is easy to miss: **a cross-origin image taints a canvas.**
Loading the picture straight into an `<img>` and calling `getImageData` throws a
`SecurityError` unless the host sends CORS headers, and image hosts largely do
not. Routing through the proxy returns the bytes as a `data:` URI, which is
same-origin, which is what makes the pixels readable at all.

> Anyone who "simplifies" this by dropping the proxy will find it works on their
> test image and fails on most real ones. **That is in the comment**, at the top
> of `src/lib/siteSkin/imageSample.ts`.

`next.config.js`'s CSP was checked and already permits `img-src … data:`, which
the export path relies on too. `connect-src 'self'` covers the POST.

### 5b. The pipeline

| Step | Where | Note |
| --- | --- | --- |
| Fetch | `/api/image-proxy` via `proxyImageToDataUri` | existing endpoint **and existing client**, unchanged |
| Downscale to ≤64×64 | `imageSample.ts`, canvas | cheap, and it blurs JPEG artefacts that would otherwise cluster as their own colour. **Leave `imageSmoothingEnabled` on** — the averaging is the point, not a defect |
| Skip near-transparent pixels | `palette.ts` | **load-bearing.** Fan art PNGs have transparent margins; without an alpha floor they quantize as white and every theme comes out cream |
| Cluster | `palette.ts` | 4-bit-per-channel popularity bins, then a merge pass. No dependency, ~70 lines |
| Map to four fields | `palette.ts` | §5c |

The split is deliberate: **`palette.ts` never touches the DOM** and takes a plain
`ArrayLike<number>` of RGBA bytes, which is why the whole of §5c is unit-tested
against synthetic pixel arrays with no browser in the room. `imageSample.ts` is
the only file that knows what a canvas is, and it is nineteen lines.

### 5c. The mapping, and the floor that makes it shippable

| Field | From |
| --- | --- |
| `accent` | the highest-chroma cluster **with enough population to be deliberate** (≥2% of sampled pixels), excluding near-black and near-white |
| `background` | the image's overall cast, mixed a short way into the polarity's pole — `mixHex(cast, pole, 0.12)` light, `0.18` dark. **Both polarities are always computed**; the user picks |
| `surface` | `background` stepped toward white until it clears a 1.12 contrast ratio against it |
| `text` | `bestTextColor(background, surface)` |
| `accent`, again | `fixAccent(accent, background, surface)` — and only then |

**The last row is the feature, not a safety net.** A muddy poster produces a
muddy theme unless the result is pushed through the same contrast maths every
template already obeys.

**And the floor is structural, not statistical.** `colorsFromSwatches` runs the
result through `findReadabilityIssues` and, if anything is left, pushes the
background further toward its pole and recomputes — up to six times. A mid-tone
page is the only input that can defeat both text colours at once, and moving it
toward the pole is exactly the repair. So the extractor cannot emit a palette
the editor would then warn about.

> **Required test — written.** `tests/palette.unit.spec.ts` runs a fixture set of
> synthetic pixel arrays (flat greys, a mid-tone wall, transparent-margin fan
> art, a two-colour poster, muddy photographs, 200 pseudo-random images) through
> both polarities. `findReadabilityIssues` returns **empty** for every one. An
> extraction path that can produce a warning the templates cannot is a path that
> makes the product worse for the users most likely to use it.

### 5d. Two things it fixes for free

**`header.textColor: 'auto'` stops being a guess.** It exists because of a
sentence in `theme.ts` and §4b: *"we cannot measure the brightness of a
photograph."* Once the pixels are in hand, **we can.** `readBannerBrightness`
returns mean luminance and its spread, so `textColor` becomes a measurement and
`textShadow` becomes a recommendation the app can justify — on when the image is
*busy*, which is the only condition under which a glow earns its place.

**But this only applies when the sampled image is actually the banner** — see
§5f, correction 3. It is gated on the address passing `checkAo3ImageUrl` *and*
the user opting in.

**A Discord CDN address becomes a partial win.** It fails `checkAo3ImageUrl` and
always will (§3a — the `?` in a query string kills the whole skin). It is still a
perfectly good image to read colours from. *"That address can't be used as a
banner on AO3 — but here are your colours from it"* turns the single most common
rejection in the product into something useful.

### 5e. The shape of the interaction, and where it lives

**Two entry points, one component.**

| Where | Why there | What it applies |
| --- | --- | --- |
| **The gallery**, in a panel above the mood chips | §1's premise *is* the gallery moment: the reader has looked at all sixteen and wants none of them | A whole theme, through the existing `handleSelectTemplate` |
| **The editor**, a button in the Colours group | The §19b framing — *"paste your banner, we'll build the theme around it"* — for someone who already has a theme they like the shape of | **The four colours only**, plus the banner fields if opted in. Fonts, radius, tag style and details are the user's work and are left alone |

**The result screen is two cards, not one.** Light and dark side by side, each
rendered by the *same* `ThemeThumbnail` every gallery card uses — so it shares
`derive()`, and the picker can never advertise a header the compiler would not
produce. That is §3's boring-result mitigation and it costs one extra call to a
pure function.

**Undo is the escape hatch, and that is why there is no confirmation step.** The
editor path pushes onto the existing history stack, so `Ctrl+Z` reverts it. This
is deliberately *unlike* the theme-backup import in `ExportSkinDialog`, which
downloads a safety copy first — that one replaces everything including the
fonts and the banner, this one replaces four hex strings.

**The copy never says "match".** §3. The panel says *"Build one from a picture"*
and *"We read its colours"*; the result says *"Your colours, two ways."*

### 5f. Four corrections to this section's own first draft

None of these came from a failing test. Three came from reading the code the
plan was going to call, and one from reading the shipped catalog.

**1. `mixHex`'s arguments were the wrong way round.** The draft said
`surface = mixHex(background, text, 0.06–0.10)`. `mixHex(a, b, weight)` keeps
`weight` of the **first** colour, so that expression is *90% text* — a cream card
carrying cream text on every dark theme. This exact inversion is already recorded
in `compile.ts`'s `controlBg` comment, where it *survived a green test suite*
because the test compared the emitted value against `d.controlBg` rather than
against a contrast floor. Writing it into the plan a second time is how a lesson
gets unlearned.

**2. And the dependency was wrong too — a card is lighter than the page in
*both* polarities.** Deriving `surface` from `text` inverts it on light themes:
light text is dark, so `background + 7% text` is a *darker* card. Check the
sixteen: Paper & Ink is `#f4efe5` → `#fffdf8`, Moonlit Library is `#101725` →
`#182238`. Both lighter. So the surface steps toward **white** regardless of
polarity, and the target is a contrast *ratio* rather than a mix weight — which
also dissolves the draft's circular definition, where `surface` needed `text` and
`text` needed `surface`.

**3. The banner brightness measurement was pointed at the wrong image.** §5d is
right that having the pixels turns `header.textColor` from a guess into a
measurement — but in Phase B the pasted image is *usually not the banner*. That
is §5d's own second half: the whole point of the Discord line is that the address
works for colours and not for AO3. Measuring an image the header will never
render, and then writing the answer into `header.textColor`, is a measurement of
the wrong thing presented as a fact. Gated on `checkAo3ImageUrl(url).ok` **and**
the user ticking the banner box.

**4. §5e's stable `meta.id` is necessary and not sufficient — the analytics
boundary drops the id on the floor.** The draft correctly says to use a fixed
`from-image` id so activation does not fragment. But `analyticsPayload` validates
every `templateId` against a hard-coded `TEMPLATE_IDS` allowlist and returns
`null` — **rejecting the whole event** — for anything else. Without adding
`from-image` there, a generated theme records no `template_selected`, no
`project_activated`, no `export_started`, no `export_ready` and no
`handoff_completed`: the entire funnel for the one feature whose adoption §10
says we need to measure, silent. `analytics.ts`'s own comment records this
happening before, to five examples, for two days.

The existing drift test does not catch it, because it iterates
`SITE_SKIN_TEMPLATES` and the generated theme is deliberately not in the catalog.
So the guard lives in `tests/palette.unit.spec.ts` instead, next to the id it
protects.

### 5g. What Phase B deliberately does not do

- **No fonts.** An image has no `font-family` to read. The generated theme takes
  Georgia and the default scale, and §6d is where that stops being a default.
- **No `cardRadius`.** Same reason — it is a Phase C signal, from CSS.
- **No `og:image`, no URL, no HTML.** `palette.ts` contains no concept of a URL
  at all, which is what keeps Phase C a thin fetcher in front of it rather than a
  second extraction system.
- **No server-side downscale.** The proxy still returns full-resolution bytes, so
  an 8 MB image crosses the wire as ~11 MB of base64 to extract sixteen colours
  from. The export path already ships exactly this, so it is not a new cost. If
  it bites, the fix is a downscale mode on the server, not a client workaround.

---

## 6. Phase C — the URL picker ✅ built 17 Aug 2026

The headline feature, and the one with real risk. §12 records what shipped; this
section is the design it was built to, and it held. **Phase B works now**, which
is the precondition: the right design is a thin fetcher in front of Phase B's
quantizer rather than a second extraction system. `paletteFromPixels` and
`colorsFromSwatches` are already exported and already tested; Phase C should call
them and add nothing to them.

### 6a. The shape

```
URL → /api/site-palette → { colors[], fonts[], radius, ogImage }
                              ↓
                    og:image → /api/image-proxy → Phase B quantizer
                              ↓
                    merge → SiteSkinTheme → existing preview + export
```

**`og:image` is the primary signal, not a secondary one.** §19a objected to "a
second fetch for `og:image`"; making it the main input is what dissolves that
objection. A site's social card is a deliberate, designed summary of its look —
often a better answer than its CSS, which is full of greys.

### 6b. The new endpoint, and its risk

This is the only genuinely new attack surface in the whole feature. It fetches an
arbitrary user-supplied URL server-side.

- **Reuse `validateRemoteImageUrl`'s host checks.** Do not write new ones. The
  DNS-resolution-then-IP-range check is the part people get wrong.
- Same manual redirect loop — a redirect to `169.254.169.254` is the classic
  bypass, and following redirects with `fetch` defaults is how it happens.
- `text/html` only, byte cap, short timeout, and **never return the fetched body
  to the client** — return only the extracted values. That single rule turns the
  endpoint from a general-purpose proxy into a narrow one.
- Rate limit as `/api/image-proxy` does.

> **This needs its own security review before it ships.** It is the first
> endpoint in the product that fetches non-image content from an arbitrary host.

### 6c. Extraction, and what it will actually get

Parse the HTML and the linked stylesheets — **no headless browser.** A headless
browser on Netlify functions is real infrastructure for a marginal gain.

| Source | Yield |
| --- | --- |
| `<meta name="theme-color">` | one high-quality colour, when present |
| `:root` custom properties | **the best signal on modern sites.** Tailwind and design-token sites put the palette here in named form |
| Declared `color` / `background-color` frequency | good, weight by rule specificity as a proxy for area |
| `font-family` on `body` and on `h1`–`h3` | the two we need — see §7 |
| `border-radius` on cards/buttons | → `shape.cardRadius`, snapped to the four values `CARD_RADII` offers |
| `og:image` | → Phase B |

**Accept that JS-rendered sites yield little.** A React SPA whose HTML is an
empty `<div id="root">` gives you `theme-color` and `og:image` and nothing else.
That is *fine* — `og:image` is the primary signal precisely because it survives
this case. Do not build a headless browser to fix it.

### 6d. Font classification — where Phase A pays off

The source gives you a stack like `Inter, system-ui, sans-serif` or
`"GT Sectra", Georgia, serif`. Map it to our bank:

1. Match any named family against a lookup of ~200 well-known faces → a
   `FontGroup` (`serif` / `sans` / `display` / `script` / `mono`) plus a
   sub-character (geometric, humanist, grotesque, old-style, transitional…).
2. Fall back to the generic family at the end of the stack.
3. Pick the nearest stack in `fontStacksFor(role)` — geometric sans → *Futura*,
   humanist sans → *Gill Sans*, old-style serif → *Garamond*, transitional serif
   → *Baskerville*, slab → *Rockwell*.
4. **Say what you did.** *"This site uses a geometric sans. Closest AO3 allows is
   Futura."* Naming the limitation is what turns it from a failure into
   competence.

The lookup table is the whole feature here and it is taste, not code. ~200 names
is an afternoon.

**Emit the stack string, never an index.** `fontStacksFor(role)[n]` is a moving
target because the bank is append-only and grows; the classifier's output must be
a literal `FONT_STACKS` value or `validateTheme` will drop it at the storage
boundary and the user will lose the font on reload.

### 6e. The boring-result problem

Phase B already shows both polarities side by side (§5e), so Phase C inherits the
mitigation rather than needing one: *"This site is light. Here it is both ways."*
The extra move available to C and not to B is to **say which it was** — naming
the source's own polarity is the difference between a choice and a guess.

---

## 7. What this supersedes in `SITE-SKIN-IMPLEMENTATION.md`

- **§19a's table row** *"Scrape a website … **Dropped.**"* — reopened, on the
  taste-versus-fandom argument in §1 above. Its *reasons* still stand: the
  endpoint and SSRF surface in §6b are real costs, and §6 exists to pay them
  deliberately rather than by accident.
- **§19b-bis's closing paragraph** — *"The website-URL half of the original
  proposal stays dropped"* — is no longer the decision. Everything else in
  §19b-bis stands, and stands firmly: **we still ship no images**, the header
  gradient is still the answer to a palette-only template, and `bannerUrl` still
  takes an address the user chose and hosts.
- **§19b's pipeline table** is superseded by §5b and §5c here, which correct it
  — see §5f.
- **§19a's logo refusal is NOT reopened.** SVG format, `?v=3` query strings and
  the rights question are all still walls. This feature reads colours; it never
  points an AO3 page at somebody else's asset.

---

## 8. The invariant that keeps this cheap

**The output is a `SiteSkinTheme` and nothing else.**

Not one line of `compile.ts` or `ao3Css.ts` changes. The lint gate, the preview,
the readability checks and the export all apply unmodified. Every derived colour
is already resolved to literal hex because AO3 has no `color-mix()`. Invariant 4
is satisfied by construction — the thing produced *is* a theme, so the preview
shows it.

**It therefore emits no declaration shape the release gate does not already have
to prove.** Different hex values in rules the checklist already covers. Phase B
held this exactly: `compile.ts`, `ao3Css.ts`, `colors.ts` and `mockPage.ts` are
untouched, and `tests/palette.unit.spec.ts` asserts `lintAo3Css(compile(theme))`
is empty for every extracted theme so that the claim keeps being true.

> If you find yourself adding a property to `compile.ts` to support this, you
> have left the design. The picker chooses values for controls that already
> exist; it does not add controls.

**One caveat, and it is a sequencing one.** `SITE-SKIN-IMPLEMENTATION.md` §23c
records the lesson the hard way: *"our lint permits it" and "the archive accepts
it" are different states.* The gate (Phase 7) is still empty. A machine that
generates themes on demand inherits every sanitizer surprise at scale, so **the
gate should close before Phase C ships**, even though Phase C adds nothing to it.

Phase B is safe ahead of the gate for the reason §19b gave and §11 re-checked
against §23c's lesson: it emits **no property the sixteen templates do not
already emit**, only different values in the same rules. §23c's trap was a
*property* (`box-shadow`) that had never been compiled before and was assumed
covered because the lint permitted it. Nothing here is new to the compiler.

---

## 9. Build order

| # | Work | Blocked by | Est. |
| --- | --- | --- | --- |
| A | Font bank + picker UI | — | ✅ done |
| B | `palette.ts` + image extraction + the contrast-floor test | — | ✅ done, ~1 day |
| — | **Phase 7 release gate**, incl. P15 | a human with an AO3 account | ✅ closed, P15 passed |
| C1 | Font classification lookup + `classifyFont()` | A | ✅ done |
| C2 | `/api/site-palette` + security review | — | ✅ done |
| C3 | Picker UI, both polarities, the "what we did" explanation | B, C1, C2 | ✅ done |

C3 shrank because Phase B's `PaletteFromImage` already owns the input, the
loading state, the error surface, the two-polarity result and both entry points.
Phase C adds a source toggle and a "what we did" line to a component that exists.

---

## 10. Open questions

- ~~**Does a five-name font stack survive AO3's save?**~~ **Answered: yes.** P15
  passed on 17 Aug 2026 — both stacks came back whole, quotes byte for byte. §6d's
  mapping targets do not shrink.
- **How often is `og:image` genuinely representative?** Still untested at scale.
  Five sites were run through the real endpoint while building C (§12) and the
  *stylesheet* answer was good on all five; the card was never compared against
  it, because comparing them needs a canvas and the probe had none. That is the
  measurement to make next, and it is now one throwaway script rather than a
  build.
- **Is the URL or the image the better front door?** The instinct in this
  document is that a URL is lower friction — pasting a link beats finding an
  image, hosting it, and satisfying `checkAo3ImageUrl`. That is a belief, not a
  measurement, and Phase B shipped early partly so it can be measured.
  **`palette_applied` is now the instrument** (§11), and it carries `source`, so
  when C ships the comparison is a query rather than a new build.
- **Is the 2% "deliberate" floor right?** It is taste, tuned against synthetic
  fixtures rather than against real fan art. A logo-sized splash of saturated
  colour on a muted photograph is exactly the case it exists to catch and exactly
  the case that could go wrong in either direction. Worth twenty real images.

---

## 11. What Phase B cost, and what it touched

**Landed 17 Aug 2026.** One day, as costed.

| File | Change |
| --- | --- |
| `src/lib/siteSkin/palette.ts` | **new.** Quantizer, the §5c mapping, the structural contrast floor, `readBannerBrightness`. No DOM, no URL |
| `src/lib/siteSkin/imageSample.ts` | **new.** 19 lines: proxy → `<img>` → 64px canvas → `getImageData`. The only file that knows what a canvas is |
| `src/components/siteSkin/PaletteFromImage.tsx` | **new.** The panel, the dialog wrapper, the two-polarity result |
| `src/components/siteSkin/ThemeThumbnail.tsx` | **new**, by extraction — `Thumbnail` moved out of `TemplateGallery.tsx` unchanged so the picker's result cards and the gallery's template cards are the same component |
| `src/components/siteSkin/TemplateGallery.tsx` | imports the thumbnail; gains the picker panel |
| `src/components/siteSkin/ThemeEditor.tsx` | one button in the Colours group |
| `src/pages/site-skin.tsx` | owns the dialog and the two apply paths |
| `src/lib/imageProxy.ts` | comment only — it is no longer "used only by the export pipeline" |
| `src/lib/analytics.ts` | `from-image` added to `TEMPLATE_IDS` (§5f.4); new `palette_applied` event |
| `public/privacy-policy.html` | one clause — the proxy is no longer only "when an export needs them" |
| `tests/palette.unit.spec.ts` | **new**, 30 tests: the quantizer, the mapping, the floor over 200+ fixtures, the lint round-trip, the storage round-trip, the analytics guard |
| `tests/site-skin.spec.ts` | the journey: the panel exists, rejects a non-address without a round trip, and both entry points open |

**Unchanged, and that is the point:** `compile.ts`, `ao3Css.ts`, `colors.ts`,
`theme.ts`, `templates.ts`, `mockPage.ts`, `storage.ts`, `/api/image-proxy.ts`,
`imageSecurity.ts`. No new endpoint, no new property, no new AO3 surface.

### 11a. Two defects the tests found, which the plan could not have

**`liftSurface` compounded instead of interpolating, and its own fallback hid
it.** The first version stepped `mixHex('#ffffff', candidate, 0.06)` off the
previous candidate — Zeno's arrow, which never arrives at white. On a page at
luminance 0.87, where the only colour clearing the 1.12 target is very near pure
white, it exhausted its iterations and fell through to the "page is already at
the pole" branch, quietly producing a **darker card on a light theme**. Nothing
threw. The fallback worked exactly as designed, on a question it should never
have been asked. It was caught because the test asserts the *rule* — the card is
lighter than the page, as all sixteen templates are — rather than asserting that
nothing crashed. Interpolating from the background to the pole fixed it, and the
comment in `palette.ts` carries the arithmetic.

**The result cards were ambiguous to a screen reader.** "Light" and "Dark" is the
right label on screen, because the two cards sit side by side and the pictures
carry the difference. Announced, "Dark" is indistinguishable from the gallery's
"Dark" mood filter a few hundred pixels below. Now
`aria-label="Use the dark version"`. This surfaced as a Playwright strict-mode
violation while driving the real UI — the *test* problem was trivial and the
*product* problem underneath it was real, and only the trivial one complained.

### 11b. The learning

**A plan is a place errors hide with their reasons attached.** All four §5f
corrections were in a document that had been read, reviewed and committed —
and two of them (`mixHex`'s argument order, and the analytics allowlist) were
each *already recorded elsewhere in this repository as a bug that had happened
before*. The comment in `compile.ts` and the comment in `analytics.ts` both name
the exact failure the plan then re-specified.

The general shape: **a plan that names an existing helper has not checked that
helper's contract.** `mixHex(background, text, 0.07)` reads correctly in English
and is backwards in TypeScript. The cheapest defence is the one that caught it
here — before writing a line, open every function the plan names and read its
signature and its comment, especially where the plan is quoting itself from an
earlier section.


---

## 12. What Phase C cost, and what it touched

**Landed 17 Aug 2026.** C1, C2 and C3 in one pass, close to the ~2 days §9
costed. The gate closed first, which is what §8 asked for.

| File | Change |
| --- | --- |
| `src/lib/siteSkin/fontClassify.ts` | **new.** ~200 faces → 19 characters → a literal `FONT_STACKS` value, plus the sentence that explains the substitution. No network, no DOM |
| `src/lib/siteSkin/siteStyle.ts` | **new.** HTML and CSS *text* → colours with weights, two font declarations, a radius, `og:image`, the site's own polarity. Regex, not a DOM parser, and no headless browser (§6c) |
| `src/lib/server/siteFetch.ts` | **new.** The only file that opens a page. Host checks, redirect loop and byte cap are all `imageSecurity.ts`'s, unchanged |
| `src/pages/api/site-palette.ts` | **new.** Origin check and per-IP window copied from `/api/image-proxy`; 20/minute rather than 60, because this is a person pasting a link |
| `src/lib/siteSkin/sitePaletteClient.ts` | **new.** Field-by-field validation of the response |
| `src/lib/siteSkin/siteTheme.ts` | **new.** The merge: which signal wins, and the "what we did" lines |
| `src/lib/siteSkin/palette.ts` | one addition — `swatchesFromColors`, the adapter that lets declared colours enter Phase B's mapping. The quantizer and the contrast floor are untouched |
| `src/components/siteSkin/PaletteFromImage.tsx` | a source toggle, the notes list, and a second privacy sentence. As §9 predicted, C3 was re-pointing rather than building |
| `src/components/siteSkin/ThemeEditor.tsx` | one button label |
| `public/privacy-policy.html` | one clause and a TL;DR phrase — a pasted *website* address is a different promise from a pasted image address, and the copy in the panel says so too |
| `tests/font-classify.unit.spec.ts` | **new**, 66 tests |
| `tests/site-palette.unit.spec.ts` | **new**, 45 tests: parsing (including the ReDoS bound in §12c), the network refusals, and the §8 round trip |
| `tests/site-skin.spec.ts` | two journeys: both doors exist, and each says where the reading happens |

**Unchanged, and that is still the point:** `compile.ts`, `ao3Css.ts`,
`colors.ts`, `theme.ts`, `templates.ts`, `mockPage.ts`, `storage.ts`,
`imageSecurity.ts`, `/api/image-proxy.ts`. **No new property reaches AO3** — a
website chooses different values in rules the gate has already proved.

### 12a. What the code corrected in the plan, and what five real sites corrected

**`og:image` is primary in the design and second in the code path, deliberately.**
§6a is right that a social card is a better summary than a stylesheet full of
greys — but the card can only be *read* through a canvas, and it fails often
(SVG cards, hosts the proxy refuses). So the client tries the card first and
falls back to the declared colours without losing the extraction, and
`themesFromSite` reports which one it used so the copy cannot claim the wrong
source.

**A bank face must be matched by the stack that *leads* with it.** The first
version mapped "Verdana" to the Trebuchet stack, because Trebuchet's stack names
Verdana second and came first in the catalog. That answers a request for one face
with a different one — and it looked correct in every test that only asked
whether the result was a legal stack. Fixed with a leading-name pass before the
containing-name pass.

**Five real sites through the live endpoint, and they are why two things
changed.** mozilla.org, archiveofourown.org, smashingmagazine.com, example.com
and vercel.com. The colour answers were good on all five — Mozilla's blue,
Smashing's red, AO3's own `#990000` — and nothing produced a readability warning.
But example.com produced *"This site only asks for a interface sans"*, which is
the kind of slip that makes a reader trust the rest of the sentence less than
they should; the article is now computed, and a test walks every known face
looking for `a` before a vowel. The same probe is what showed the stylesheet path
is strong enough that §10's `og:image` question is about *how much better*, not
about whether the fallback works.

**The unanswerable half of that probe.** The card was never compared against the
stylesheet on those five sites, because sampling it needs a canvas and the probe
was a unit test. That comparison is the next cheap measurement, and
`palette_applied` already carries `source`, so the production version of the
question is a query.

### 12b. The learning

**§11b said a plan that names an existing helper has not checked that helper's
contract. Phase C's version is smaller and the same shape:** a lookup table that
returns *a* legal answer will pass every test that asks whether the answer is
legal. The Verdana bug was invisible to `expect(FONT_STACKS).toContain(result)`
and obvious the moment a test asked whether the answer was the *right* one. When
the output space is an allowlist, test membership **and** identity — membership
alone is the assertion that always passes.

### 12c. The security review §6b asked for

Done against the diff, on the endpoint and everything it calls. **One finding,
and it was not SSRF.**

**Found and fixed: a denial of service in the CSS parser, not the network code.**
The first version of `readCssRules` was the obvious one regex —
`/([^{}]+)\{([^{}]*)\}/g`. On text containing no braces, `[^{}]+` runs to the
end of the string, fails to find `{`, backtracks one character at a time, and
then the engine advances the start position and repeats: quadratic. Measured:
**236 seconds on 200 KB**, against a function that is handed up to a megabyte
fetched from an address a stranger typed, four times per request. Any host
serving `text/css` that is not CSS — a minified JSON blob, a padded response
written for this purpose — would have pinned a serverless function until its
timeout, twenty times a minute per IP. It is now an `indexOf` scan: 1 MB returns
in under a millisecond, and a test asserts the bound rather than the shape.

The lesson is narrower than "avoid regex". The dangerous input did not come from
the user — it came from **the third party the user's input pointed at**, which is
the part of this feature that had no threat model before it was written.

**Checked and found sound:**

- **Every redirect hop re-validates.** A 302 to `169.254.169.254` fails on the
  second hop, not the first, and a test drives exactly that.
- **The body never leaves the server.** The handler enumerates its response
  field by field rather than spreading the parsed object, so a future extractor
  cannot widen the endpoint by accident. `title` is parsed and deliberately not
  returned — it is the page's *content* rather than a measurement of it, and
  nothing consumes it.
- **A hostile response cannot reach a style attribute.** Every colour crosses
  `normalizeHex`, which fails closed to `#000000`; the client re-validates the
  response field by field before any of it becomes a theme.
- **`og:image` from a hostile page is not trusted.** It goes back through
  `/api/image-proxy`, which applies the same host rules and a magic-bytes check,
  and through `checkAo3ImageUrl` before it can become a banner.
- **Amplification is bounded:** one request in, four out, each capped at 1 MB,
  each host-validated, twenty requests per IP per minute.

**Known and accepted, both inherited rather than new:**

- **DNS rebinding.** `validateRemoteImageUrl` resolves the hostname and then
  `fetch` resolves it again; a record that changes between the two is not caught.
  This is the existing image proxy's posture, and closing it means pinning the
  resolved address into the connection, which is an agent-level change to make
  once for both endpoints rather than twice by halves.
- **The rate limit is per instance and in memory**, so it counts per serverless
  container rather than globally — the same as `/api/image-proxy`.
