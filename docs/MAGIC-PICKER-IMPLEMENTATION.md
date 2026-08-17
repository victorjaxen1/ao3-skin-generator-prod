# The Magic Picker — Implementation Plan

**For:** the developer building this. Assumes you have read
`SITE-SKIN-IMPLEMENTATION.md` §15 (the file map, the five invariants, the traps)
and §19 (the fandom question). This document is the full build; §19b and §19a
over there are its history and are partly superseded here — see §7.

**Status: not built.** Phase A landed 17 Aug 2026 and is the only part that
exists. Phases B and C are specified, not written.

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
> then §5 (Phase B) — which is the one to build first, and is nearly free.
> §6 (Phase C) is the headline feature and the one with real risk in it.
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
already ship. §6e is the mitigation.

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

**Not yet proven:** P15 in `SITE-SKIN-AO3-CHECKLIST.md`. `sanitize_css_font` is
our model of AO3's rule and no five-name stack has ever been through a real save.
One bad name drops the entire declaration.

---

## 5. Phase B — palette from an image

**Build this first.** It is nearly free, it is the engine Phase C needs, and it
ships value on its own. §19b costed it at about a day and that still looks right.

### 5a. Why it goes through `/api/image-proxy`, for two reasons

The obvious one is SSRF, and **that work is already done and already generic**:
`validateRemoteImageUrl` is HTTPS-only, refuses credentials and non-443 ports,
and resolves the hostname through DNS before checking it against blocked IPv4 and
IPv6 ranges. `fetchValidatedImage` wraps it in a manual redirect loop with a byte
cap, a timeout, an SVG refusal and a magic-bytes-versus-`content-type` check.
`/api/image-proxy` adds an origin check and 60 requests per IP per minute, takes
`POST {url}` and returns `{ dataUri, mimeType }`. **Nothing new is needed.**

The reason that is easy to miss: **a cross-origin image taints a canvas.**
Loading the picture straight into an `<img>` and calling `getImageData` throws a
`SecurityError` unless the host sends CORS headers, and image hosts largely do
not. Routing through the proxy returns the bytes as a `data:` URI, which is
same-origin, which is what makes the pixels readable at all.

> Anyone who "simplifies" this by dropping the proxy will find it works on their
> test image and fails on most real ones. **Put that in the comment.**

### 5b. The pipeline

| Step | Where | Note |
| --- | --- | --- |
| Fetch | `/api/image-proxy` | existing endpoint, unchanged |
| Downscale to ~64×64 | client, canvas | cheap, and it blurs JPEG artefacts that would otherwise cluster as their own colour |
| Skip near-transparent pixels | client | **load-bearing.** Fan art PNGs have transparent margins; without an alpha floor they quantize as white and every theme comes out cream |
| Cluster | new `src/lib/siteSkin/palette.ts` | popularity binning or median cut. No dependency, ~60 lines |
| Map to four fields | `palette.ts` | below |

### 5c. The mapping, and the floor that makes it shippable

| Field | From |
| --- | --- |
| `accent` | the highest-chroma cluster with enough population to be deliberate |
| `background` | the darkest (or lightest) neutral cluster — **offer both polarities**, which is one toggle and doubles the perceived output for no extra maths |
| `surface` | `mixHex(background, text, 0.06–0.10)` |
| `text` | `bestTextColor(background, surface)` |
| all of it | then `fixAccent` — and only then |

**The last row is the feature, not a safety net.** A muddy poster produces a
muddy theme unless the result is pushed through the same contrast maths every
template already obeys.

> **Required test.** Over a fixture set of synthetic pixel arrays,
> `findReadabilityIssues` must return **empty** for every extracted theme. An
> extraction path that can produce a warning the templates cannot is a path that
> makes the product worse for the users most likely to use it.

### 5d. Two things it fixes for free

**`header.textColor: 'auto'` stops being a guess.** It exists because of a
sentence in `theme.ts` and §4b: *"we cannot measure the brightness of a
photograph."* Once the pixels are in hand, **we can.** `textShadow` likewise
becomes a recommendation the app can justify rather than a toggle whose purpose
is invisible until you try it.

**A Discord CDN address becomes a partial win.** It fails `checkAo3ImageUrl` and
always will (§3a — the `?` in a query string kills the whole skin). It is still a
perfectly good image to read colours from. *"That address can't be used as a
banner on AO3 — but here are your colours from it"* turns the single most common
rejection in the product into something useful.

### 5e. Give it a stable id

`site-skin.tsx` keys activation analytics on `site-skin:${theme.meta.id}`. Use a
fixed `meta.id` (`from-image`), or a per-extraction id will fragment the metric
into noise.

---

## 6. Phase C — the URL picker

The headline feature, and the one with real risk. **Do not start it before Phase
B works**, because the right design is a thin fetcher in front of Phase B's
quantizer rather than a second extraction system.

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
| `border-radius` on cards/buttons | → `shape.cardRadius` |
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

### 6e. The boring-result problem

If the extraction returns near-white, dark-grey and one accent, **say so and
offer the dark inversion**: *"This site is light. Want the night version?"* —
Phase B already computes both polarities (§5c). That turns the most common
disappointing result into a choice, and it is free.

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
to prove.** Different hex values in rules the checklist already covers.

> If you find yourself adding a property to `compile.ts` to support this, you
> have left the design. The picker chooses values for controls that already
> exist; it does not add controls.

**One caveat, and it is a sequencing one.** `SITE-SKIN-IMPLEMENTATION.md` §23c
records the lesson the hard way: *"our lint permits it" and "the archive accepts
it" are different states.* The gate (Phase 7) is still empty. A machine that
generates themes on demand inherits every sanitizer surprise at scale, so **the
gate should close before Phase C ships**, even though Phase C adds nothing to it.

---

## 9. Build order

| # | Work | Blocked by | Est. |
| --- | --- | --- | --- |
| A | Font bank + picker UI | — | ✅ done |
| — | **Phase 7 release gate**, incl. P15 | a human with an AO3 account | — |
| B | `palette.ts` + image extraction + the contrast-floor test | — | ~1 day |
| C1 | Font classification lookup + `classifyFont()` | A | ~½ day |
| C2 | `/api/site-palette` + security review | — | ~1 day |
| C3 | Picker UI, both polarities, the "what we did" explanation | B, C1, C2 | ~1 day |

B is independently shippable and should not wait for C.

---

## 10. Open questions

- **Does a five-name font stack survive AO3's save?** P15. Blocks nothing here,
  but if the answer is no, §6d's mapping targets shrink.
- **How often is `og:image` genuinely representative?** Untested. Cheapest answer
  is to run twenty real sites through a throwaway script before building C3.
- **Is the URL or the image the better front door?** The instinct in this
  document is that a URL is lower friction — pasting a link beats finding an
  image, hosting it, and satisfying `checkAo3ImageUrl`. That is a belief, not a
  measurement, and Phase B ships early partly so it can be measured.
- **Analytics.** §20d's `bannerSet` line is still unwritten, and the same
  argument applies here: without one event we will not know whether anyone uses
  this.
