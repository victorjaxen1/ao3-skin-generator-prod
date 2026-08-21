# AO3 SkinGen CRO and writer-tool cross-sell implementation plan

**Status:** Releases 0 source changes and Releases 1–2 implemented locally; external publishing and Release 3 remain<br>
**Written:** 21 August 2026<br>
**Primary business objective:** use the genuinely free AO3 SkinGen utility to introduce qualified writers to WordFokus and WorldKonstruct, then measure whether that introduction produces product adoption and paid customers.<br>
**Repository:** `ao3-skin-generator-clean`<br>
**Owner input still needed:** product media files and access to the externally managed landing surfaces. Neither blocks Releases 1 or 2.

Implementation checkpoint, 21 August 2026:

- Release 0 repository sources and regression checks are ready; SwipePages, WordPress, gallery, and app production publishing still require external access.
- Release 1 passive discovery, consent-gated view/click analytics, and fixed referral UTMs are implemented.
- Release 2 local eligibility, handoff counting, contextual recommendations, and suppression are implemented; the exported build-time switch is off for the Release 1 baseline rollout.
- Release 3 tailored destinations, destination analytics, approved media, and verified downstream attribution have not started.

---

## 0. Start here: authority and the decision this document changes

This is an implementation specification, not a list of marketing ideas. A developer should be able to implement the in-app releases without inventing placement, copy, eligibility, analytics, storage, or test behavior.

This document supersedes the following older guidance where the two conflict:

- `ao3skingen-growth-benefit-implementation-doc.md` §11.6's blanket prohibition on a commercial recommendation after a completion event;
- the comment in `src/lib/analytics.ts` saying `completion` should no longer be used for product links;
- the `MoreTools.tsx` comments saying the component must stay off every editor and completion surface;
- the P3 definition of done saying no completion event is followed by a commercial card.

The owner has clarified that AO3 SkinGen's main business purpose is qualified discovery of WordFokus and WorldKonstruct. A recommendation after demonstrated value is therefore allowed **inside an existing off-AO3 success surface**, under the targeting, frequency, and trust constraints below.

Everything else in the older boundary remains in force:

1. No commercial product name, URL, CTA, tracking parameter, donation request, or promotional image may enter generated HTML, generated CSS, PNG output, transcripts, project backups, site-skin CSS, copyable snippets, or anything intended to be pasted into AO3.
2. Optional AO3 SkinGen attribution remains neutral, unlinked, and off by default.
3. No product recommendation may prevent, delay, cover, or compete with the task the user came to complete.
4. No product recommendation shares a component, modal, card group, or mobile viewport with a Ko-fi request.
5. AO3 SkinGen remains fully usable without an account, install, email address, or interaction with either paid product.

AO3 treats links or references advertising paid products as commercial promotion across the archive. The external tool may market products on its own pages, but generated material must preserve the boundary above:

- <https://archive.transformativeworks.org/tos_faq?language_id=en#commercial_promotion>
- <https://www.transformativeworks.org/tos-spotlight-commercial-promotion/>

---

## 1. Executive outcome

AO3 SkinGen should present the three products as one writer lifecycle:

> **Keep the world straight. Finish the draft. Publish the scene.**<br>
> WorldKonstruct for story memory · WordFokus for forward drafting · AO3 SkinGen for AO3-ready presentation.

The app should not become an advertising surface. It should create four clear discovery routes:

1. **Early, compact discovery** on the scene picker before the long starter-template list.
2. **Permanent voluntary discovery** from app settings for returning users who skip the picker.
3. **One contextual recommendation** after a successful scene handoff, inside the success UI the user already opened.
4. **AO3-specific destination pages** that continue the exact promise made in SkinGen before asking for a Marketplace installation.

The funnel is successful only when it can distinguish:

`qualified promotion view → product click → destination engagement → install intent → first product use → paid conversion`

Clicks alone are not the business result.

---

## 2. Audited baseline

### 2.1 In the application

`src/components/MoreTools.tsx` currently renders equal-weight WordFokus and WorldKonstruct cards only on:

- the platform picker, after every platform and starter template;
- the site-skin gallery, after all sixteen site-skin templates.

The current cards have good mechanism-led descriptions but weak click affordance: there is no visible action such as “Try free →”. The entire card is an anchor, which is not obvious from a static view.

Returning scene-builder users with a saved project skip the picker in `src/pages/index.tsx`; they can therefore use the product repeatedly without seeing `MoreTools` again. The scene workspace and export success surfaces contain no product discovery.

The current analytics union has `product_cta_clicked` but no product-view event. It cannot distinguish “the card was below the fold” from “the user saw it and declined”. Tracking is correctly disabled until analytics consent is granted.

The current commercial-destination test requires `MoreTools.tsx` to be the only `src/` module containing a linkable WordFokus, WorldKonstruct, or Ko-fi destination. Preserve this centralization.

### 2.2 On public surfaces, checked 21 August 2026

| Surface | Current state | CRO consequence |
| --- | --- | --- |
| `ao3skingen.wordfokus.com` | Product shelf is live, near the bottom of a long page and shortly before Ko-fi | Qualified users can find the products, but few will reach them and the donation ask competes with the business goal |
| `www.wordfokus.com/ao3skingen/` | No WorldKonstruct block; retains the unsupported “Used by 1,200+ AO3 Writers” claim | Broken product-family story and avoidable trust risk |
| `ao3skingen.wordfokus.com/examples-gallery` | Live version is stale: old Netlify links, no WorldKonstruct shelf, old footer | High-intent example traffic leaks before product discovery |
| `app.ao3skingen.wordfokus.com` | Source contains the newer Tier 2 shelf but only in the two low placements above | The actual product experience is not functioning as a wedge |

The repository already contains newer landing/gallery source. Deployment parity is a release item, not a new design project.

### 2.3 Adjacent-product evidence

- WordFokus has the larger current Marketplace footprint and a clear mechanism: it prevents repeated editing during first-draft work. It should be the first contextual offer.
- WorldKonstruct has a smaller current Marketplace footprint and a narrower AO3 fit. The AO3-relevant promises are **scan an existing draft** and **keep a long AU or series consistent**, not generic worldbuilding.
- Both products are free to start and commercial because they also offer paid features. “Free to start” may be stated; “free forever” must not be applied to the whole product unless the destination's current offer supports it.

Product references:

- <https://workspace.google.com/marketplace/app/wordfokus_distractionfree_writing_for_do/297087799172>
- <https://workspace.google.com/marketplace/app/worldkonstruct_%E2%80%94_world_builder_story_bib/531264072996>
- <https://app.wordfokus.com/worldkonstruct/>

---

## 3. Audience and stage model

Do not treat every AO3 SkinGen visitor as the same prospect.

| Segment | Evidence available without inspecting content | Best offer | Treatment |
| --- | --- | --- | --- |
| First-time scene builder | Picker shown; no stored project | Product family awareness | Compact writer-tool strip only; primary platform choices remain first |
| First successful scene handoff | Hosted code copied, or both work-skin parts copied | WordFokus | One contextual card inside the existing success modal |
| PNG-only exporter | PNG export succeeds | No immediate card in Release 2 | Count one local handoff; allow a later returning-user offer |
| Returning scene author | Stored project or prior handoff on another active day | WorldKonstruct when eligible; otherwise WordFokus | Contextual recommendation after a later handoff, plus voluntary Settings access |
| Site-skin visitor | Site-skin route/gallery | Weak writer qualification | Passive shelf only; no post-copy product card |
| Deep-link visitor | Opened a starter/template URL | Task intent is already specific | Do not interrupt entry; qualify only after a successful handoff |

Never inspect or transmit story text, character names, handles, media addresses, fandom, relationship tags, or generated output to decide which product to show.

Do not infer that a large cast means WorldKonstruct eligibility. The existing implementation document correctly rejected the cast bridge: a few chat identities are not a story bible.

---

## 4. Product positioning and copy rules

### 4.1 Shared framing

Preferred family line:

> **Tools for the story before, during, and after the draft.**

Longer landing-page line:

> Keep a story's details straight with WorldKonstruct, finish the draft without re-editing every paragraph with WordFokus, then publish special scenes on AO3 with SkinGen.

Do not lead with:

- “productivity”;
- “AI-powered”;
- “distraction-free writing” without naming the mechanism;
- “organize your worldbuilding” for a canon-based audience;
- feature counts;
- prices, discounts, scarcity, or lifetime-deal urgency inside AO3 SkinGen.

### 4.2 WordFokus promise

Use this mechanism:

> Draft in Google Docs without going back to polish every sentence. WordFokus keeps earlier text out of reach so the chapter moves forward.

Allowed short labels:

- `Draft without re-editing`
- `Finish the next chapter`
- `Try WordFokus free`

### 4.3 WorldKonstruct promise

Use the audience-specific job:

> Keeping a long AU or series consistent? WorldKonstruct can scan an existing draft into a story bible beside your manuscript.

Allowed short labels:

- `Keep a series bible`
- `Scan an existing draft`
- `Try WorldKonstruct free`

### 4.4 Disclosure line

Every in-app product group must contain this once:

> Separate Google Docs add-ons · free to start · not required for AO3 SkinGen.

Do not repeat the disclosure inside both cards.

---

## 5. UX specification

### 5.1 Expand `MoreTools` rather than creating scattered commercial components

Keep commercial URLs and outbound anchors centralized in `src/components/MoreTools.tsx`. Expand its API:

```ts
export type ProductId = 'wordfokus' | 'worldkonstruct';

export type MoreToolsPlacement =
  | 'platform_picker_compact'
  | 'platform_picker_shelf'
  | 'site_skin_gallery_shelf'
  | 'workspace_settings'
  | 'hosted_image_success'
  | 'work_skin_success';

export type MoreToolsVariant =
  | 'compact'
  | 'shelf'
  | 'settings'
  | 'contextual';

interface MoreToolsProps {
  placement: MoreToolsPlacement;
  variant: MoreToolsVariant;
  product?: ProductId;
  onDismiss?: () => void;
}
```

`MoreTools` remains responsible for:

- product name, copy, icon path, destination, CTA text;
- the actual outbound `<a>` elements;
- `target="_blank"` and `rel="noopener noreferrer"`;
- click tracking;
- qualified view tracking through a reusable hook;
- rendering the shared disclosure.

Other components may decide *whether* and *where* to render `MoreTools`; they must not contain commercial URLs.

### 5.2 Platform picker: compact discovery before templates

In `PlatformPicker.tsx`, add the `compact` variant:

- after the Site Skin card;
- before `Or start from a template`;
- full width of the existing `max-w-lg` content column;
- no product screenshots or animation;
- one quiet heading, two text links/buttons;
- no modal and no auto-focus.

Exact copy:

> **Writing the fic too?**<br>
> Free-to-start Google Docs tools from the maker of AO3 SkinGen.<br>
> `Draft without re-editing` · `Keep a series bible`

Retain a detailed `shelf` lower on the page, but add visible CTA text to each card. Rename its placement from `platform_picker` to `platform_picker_shelf`.

The compact strip is not frequency-capped; it is a normal part of the picker. It must never appear before the primary platform choices.

### 5.3 Site-skin gallery: passive shelf only

Keep the existing detailed shelf after the template grid. Rename its analytics placement to `site_skin_gallery_shelf` and add explicit CTA text.

Do not add a success recommendation to `ExportSkinDialog`. Site-skin users are insufficiently qualified as writers, and the copy/install task already requires careful instructions.

### 5.4 Workspace Settings: permanent voluntary discovery

Returning users skip the platform picker. Add a small `Writer tools` row near the bottom of `SettingsSheet`, after tool preferences and before legal/privacy links.

Interaction:

- row label: `Writer tools from this developer`;
- sublabel: `Drafting and story-bible tools for Google Docs`;
- activating it expands an inline `settings` variant or opens the existing accessible bottom-sheet/modal pattern;
- it never opens automatically;
- it never receives initial focus when Settings opens.

This is the permanent route. Do not add another icon to the already crowded `WorkspaceHeader` in the first release.

### 5.5 Hosted-image success recommendation

In `ExportPanel.tsx`, the hosted-image handoff completes only after `handleCopyCode` writes the AO3 embed code successfully.

After `copiedCode` becomes true:

- keep the copied confirmation and AO3 instructions first;
- append one eligible contextual product card below `Back up editable project`;
- do not replace or move the backup action;
- do not change `data-autofocus`; focus stays on the copy action;
- do not open a second modal;
- use placement `hosted_image_success`.

The contextual card remains visible after the two-second copied-button label resets, until the modal closes.

Do not derive recommendation visibility from `copiedCode`, because that state is deliberately transient. Add a separate `hostedHandoffComplete` boolean, set it only after the clipboard write succeeds, and reset it before a new hosted export/modal journey begins. Render the eligible recommendation from that persistent success flag.

### 5.6 Work-skin success recommendation

The work-skin handoff completes only after both CSS and HTML have been copied. Reuse the existing `workSkinHandoffTrackedRef` boundary.

Once both parts are copied:

- append one eligible contextual card below `Back up editable project` and the remote-media warning;
- do not insert the card between step 1 and step 2;
- do not show it while the export is blocked or only one part has been copied;
- use placement `work_skin_success`.

Do not derive recommendation visibility from `copyState`; both copied labels reset after two seconds. Add a separate `workSkinHandoffComplete` boolean. Set it at the same guarded boundary where `workSkinHandoffTrackedRef` records the first two-part completion, and reset it in `openWorkSkin` and `resetCopiedWorkSkin`. Render the eligible recommendation from that persistent success flag.

### 5.7 PNG success

Release 2 does **not** add a commercial toast, modal, or extra fixed bar after PNG download. The export area is already spatially constrained and the existing implementation has explicit anti-occlusion behavior.

On a successful PNG export, update the local handoff state once per browser session. That makes a later returning-user recommendation eligible without interrupting the download.

Revisit a PNG-specific inline offer only after Release 3 has real exposure and click data.

---

## 6. Contextual recommendation rules

### 6.1 Local-only promotion state

Create `src/lib/productPromotion.ts`. It contains eligibility and local frequency state, but no commercial destination URLs.

Storage key:

```text
ao3skingen_product_promo_v1
```

Schema:

```ts
interface ProductPromoStateV1 {
  version: 1;
  sceneHandoffCount: number;
  activeDays: string[]; // YYYY-MM-DD, unique, newest 10 only
  lastContextualShownAt: Partial<Record<ProductId, string>>;
  suppressedUntil: Partial<Record<ProductId, string>>;
  clickedAt: Partial<Record<ProductId, string>>;
}
```

Rules:

- sanitize every read; invalid values reset to the empty state;
- cap `sceneHandoffCount` at 1000;
- cap `activeDays` at 10;
- ISO timestamps only;
- storage failures fall back to in-memory session state;
- never store template, output type, text, names, URLs, or project identifiers here;
- this state is functional presentation memory, not an analytics-consent bypass, and is never transmitted by this module.

Add an in-memory guard so repeated exports in one page session increase `sceneHandoffCount` at most once. Multiple clicks or output types from the same project session must not manufacture a “returning author”.

### 6.2 Eligibility

A contextual offer is eligible only when all are true:

1. The relevant handoff completed successfully.
2. No contextual product offer has been shown in the current browser session.
3. That product was not shown contextually in the last 14 days.
4. That product is not suppressed.
5. The user has not just clicked the same product in this session.

For frequency purposes, “shown” means the qualified visibility boundary in §8.2, not React render or modal open. A contextual card that remains below the modal's scroll viewport has not been shown. Once it qualifies, update `lastContextualShownAt` and the in-memory current-session guard whether analytics consent is granted or denied. This local presentation state is not transmitted.

Product selection:

```text
If activeDays < 2 or sceneHandoffCount < 2:
    WordFokus
Else:
    WorldKonstruct, unless suppressed
    otherwise WordFokus, unless suppressed
```

The first qualifying success therefore introduces WordFokus. WorldKonstruct becomes contextual only after activity on at least two distinct days and at least two session-deduplicated handoffs.

### 6.3 Suppression

- `Not for me` suppresses that product for 180 days.
- A product click suppresses the same product for 30 days.
- Closing the export modal does not count as dismissal and does not add suppression beyond the 14-day impression cap.
- The permanent picker shelf and voluntary Settings route remain available even when a contextual offer is suppressed.
- No “remind me later” control is needed.

### 6.4 Contextual card copy

WordFokus:

> **Your scene is ready. Writing the next chapter in Google Docs?**<br>
> WordFokus keeps you drafting instead of polishing the same paragraph again.<br>
> `Try WordFokus free →` · `Not for me`

WorldKonstruct:

> **Is this fic becoming a series?**<br>
> WorldKonstruct can scan an existing draft into a story bible, so AU details and continuity stay easy to find.<br>
> `Try WorldKonstruct free →` · `Not for me`

Footer:

> Separate Google Docs add-on · free to start.

Do not say “recommended for you”; the app does not know enough about the writer to make that claim.

---

## 7. Destination and link contract

### 7.1 Release 1 destinations

Until AO3-specific destination pages exist, use the current owned product pages with fixed, content-free campaign parameters:

```text
https://app.wordfokus.com/?utm_source=ao3skingen&utm_medium=referral&utm_campaign=writer_toolkit&utm_content=<placement>

https://app.wordfokus.com/worldkonstruct/?utm_source=ao3skingen&utm_medium=referral&utm_campaign=writer_toolkit&utm_content=<placement>
```

`<placement>` must come from the fixed `MoreToolsPlacement` union. Do not concatenate an arbitrary query value, browser path, project id, or referrer.

The manually published public surfaces use fixed literals rather than app-event placements: `swipepages_product_shelf`, `swipepages_footer`, `wordpress_hub_product_shelf`, and `examples_gallery_product_shelf`. These values are written directly into reviewed HTML and must not be derived from a URL or user content.

`rel="noreferrer"` removes the full referring URL; the fixed campaign query survives and contains no user content.

### 7.2 Release 3 destinations

Create dedicated routes in the WordFokus/WorldKonstruct web project:

```text
https://app.wordfokus.com/for/fanfiction-writers
https://app.wordfokus.com/worldkonstruct/for/fanfiction-writers
```

When live, update only the centralized destinations in `MoreTools.tsx`.

Do not add redirect endpoints in AO3 SkinGen unless the owner specifically needs server-side routing. A direct owned destination plus fixed campaign values is simpler and avoids creating an unnecessary request log in this privacy-sensitive utility.

### 7.3 Marketplace handoff

Each destination page should have one primary CTA:

- `Install WordFokus free in Google Docs`
- `Install WorldKonstruct free in Google Docs`

The Marketplace listing is the install surface. The tailored page is the explanation and qualification surface. Do not force an email capture before installation.

Google describes the Marketplace store listing as the place where app information is presented to potential users; install flows must be tested with the published listing:

- <https://developers.google.com/workspace/marketplace/create-listing>

Do not claim person-level attribution through Marketplace unless the destination product has actually implemented and verified it. Initially report destination CTA clicks and aggregate Marketplace/first-run movement separately.

---

## 8. Analytics contract

### 8.1 Consent remains unchanged

`trackAnalytics` must continue returning without sending anything unless analytics consent is `granted`. Promotion UI and local frequency control must work when analytics is denied.

No analytics event may contain:

- story or message text;
- names, handles, fandoms, tags, titles, or search queries;
- uploaded filenames or media addresses;
- generated HTML/CSS;
- full page URLs or arbitrary referrers;
- email addresses, Google account identifiers, or Marketplace account information.

Google Analytics prohibits sending information it can recognize as personally identifiable:

- <https://support.google.com/analytics/answer/6366371>

### 8.2 Add a qualified view event

Extend the analytics union:

```ts
| {
    name: 'product_promo_viewed';
    product: ProductId;
    placement: MoreToolsPlacement;
    variant: MoreToolsVariant;
  }
```

Payload:

```ts
{
  product: 'wordfokus' | 'worldkonstruct',
  placement: enumerated placement,
  variant: 'compact' | 'shelf' | 'settings' | 'contextual'
}
```

A qualified view fires once per mounted product card when:

- at least 50% of the card is inside the viewport;
- it remains so continuously for at least 1000 ms;
- the document is visible;
- the first three conditions have been met; the analytics event itself is sent only when consent is granted.

Use `IntersectionObserver`. Cancel the timer when visibility drops, the document hides, or the component unmounts. Do not qualify on render alone.

The qualification timer runs regardless of analytics consent so UI frequency behavior stays identical for all users. At qualification:

1. for a contextual card, update the local impression timestamp and current-session guard;
2. call `trackAnalytics`, which continues to no-op unless consent is `granted`.

Passive `compact`, `shelf`, and `settings` views do not update contextual frequency state.

### 8.3 Extend the click event

Keep the established event name for report continuity:

```ts
| {
    name: 'product_cta_clicked';
    product: ProductId;
    placement: MoreToolsPlacement;
    variant: MoreToolsVariant;
  }
```

Add the fixed `variant` key. Do not include CTA copy or destination URL.

Google reserves some generic event names, including `click`; keeping an explicit custom name avoids that collision:

- <https://support.google.com/analytics/answer/13316687>

Google also supports promotion-view and promotion-selection events. This release keeps the existing custom event family to preserve the current dashboard, but the event semantics should match a viewed/selected promotion pair:

- <https://support.google.com/analytics/answer/12200568>

### 8.4 Add a suppression event only if it will drive a decision

Optional after Release 2:

```ts
| {
    name: 'product_promo_dismissed';
    product: ProductId;
    placement: 'hosted_image_success' | 'work_skin_success';
  }
```

Do not add it merely for curiosity. Its decision is whether contextual frequency or fit is wrong.

### 8.5 Dashboard definitions

| Metric | Formula | Meaning |
| --- | --- | --- |
| Qualified product impressions | count of `product_promo_viewed` | Recommendations actually seen, not merely rendered below the fold |
| Product CTR | product clicks / qualified product impressions | Message/placement resonance |
| Destination-to-install intent | Marketplace CTA clicks / AO3 campaign landing views | Destination-page persuasion |
| Contextual dismissal rate | explicit dismissals / contextual impressions | Trust/fit guardrail |
| AO3 handoff completion | completed handoffs / export starts | Core task guardrail |
| Attributed paid conversion | paid conversions carrying verified AO3 campaign source / qualified product impressions | Business outcome when destination instrumentation exists |

Never call a Marketplace CTA click an install. Never call an install a paid conversion.

---

## 9. Destination-page specification

This work likely lives outside this repository. It is part of the funnel and must be assigned, not hand-waved.

### 9.1 WordFokus for fanfiction writers

Hero:

> **Finish the next chapter before you edit it.**<br>
> WordFokus works inside Google Docs and keeps earlier text out of reach while you draft, so the scene moves forward instead of being rewritten five times.

Primary CTA:

> `Install free in Google Docs`

Required proof order:

1. A short still or user-controlled demo of Blur/Ghost behavior.
2. “Your words stay in Google Docs” trust statement, accurately matching the current product.
3. Free-versus-paid summary without hiding the free utility.
4. One testimonial about increased drafting momentum, only if permission and provenance are documented.
5. Marketplace CTA repeated after proof.

### 9.2 WorldKonstruct for fanfiction writers

Hero:

> **Your long fic should not require a second memory.**<br>
> Scan an existing Google Docs draft into a story bible for characters, places, events, and AU continuity—then keep it beside the manuscript while you write the next chapter.

Primary CTA:

> `Build a free story bible in Google Docs`

Required proof order:

1. Existing-draft scan, shown on fictional/sample content.
2. Series/long-AU continuity example.
3. Manual-first and optional-AI explanation.
4. Data ownership and Google Drive location.
5. Free limits stated plainly, followed by Pro.

### 9.3 Shared destination rules

- Preserve the AO3 campaign parameters through the landing session.
- Track landing view, primary CTA click, demo start, and pricing view under consent.
- If checkout is owned and supports fixed campaign metadata, attach `ao3skingen` as the source; do not attach story/user content.
- Do not use an interstitial email gate.
- Do not lead with a limited-time sale.
- Do not use AO3 logos or imply affiliation.

---

## 10. Asset intake and media rules

The owner has PNG, GIF, and other media for WordFokus and WorldKonstruct. Assets are useful, but they do not block the first in-app release.

### 10.1 Request this asset package

For each product:

| Asset | Preferred source | Delivery target | Use |
| --- | --- | --- | --- |
| Product icon/logo | Transparent PNG, SVG if original exists | 512×512 master | Picker/settings card at 32–48 CSS px |
| Hero still | PNG or high-quality WebP | 1440×900 or larger | AO3-specific destination hero |
| Feature still | PNG/WebP | 1200×750 | One mechanism demonstration |
| Short motion demo | MP4/WebM preferred; GIF accepted as source | 6–12 seconds, muted | Destination page only, user controlled |
| Poster frame | PNG/WebP | Same aspect ratio as motion | Default when motion is paused/reduced |
| Alt-text draft | Plain text | One per still/demo | Accessibility and review starting point |

Ask the owner to identify:

- which feature each asset depicts;
- whether the content is fictional/sample content safe for public display;
- whether the owner has rights to every image, font, avatar, and screenshot shown;
- whether an asset is current UI or an obsolete version.

### 10.2 In-app asset policy

- Use icons or a single static crop only.
- No GIF or video in the picker, Settings, or export modal.
- Self-host finalized assets under `public/products/<product>/`.
- Do not hotlink Marketplace screenshot CDN URLs.
- Lazy-load any image below the fold.
- Provide useful `alt`, or `alt=""` when an icon is redundant with adjacent product text.

### 10.3 Destination animation policy

Prefer MP4/WebM plus a poster over animated GIF: it is smaller, controllable, and can respect motion preferences.

- Do not autoplay audio.
- If motion autoplays, it must be muted, stop within five seconds or provide pause/stop, and honor `prefers-reduced-motion` by showing the poster.
- Do not animate merely to attract attention to the commercial CTA.
- Any meaningful spoken content requires captions/transcript.

WCAG 2.2 requires a pause/stop/hide mechanism for non-essential moving content that starts automatically and lasts more than five seconds:

- <https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html>

---

## 11. Repository implementation map

### 11.1 Modify

| File | Change |
| --- | --- |
| `src/components/MoreTools.tsx` | Central product catalog, variants, fixed campaign URLs, explicit CTAs, qualified-view hook integration, contextual dismiss control |
| `src/components/PlatformPicker.tsx` | Compact row before starter templates; retain and rename lower shelf placement |
| `src/components/SettingsSheet.tsx` | Voluntary Writer Tools row/expansion |
| `src/components/ExportPanel.tsx` | Mark local handoffs; render contextual card after hosted/work-skin completion only |
| `src/lib/analytics.ts` | New view event, placement/variant enums, updated click payload validation |
| `tests/more-tools.unit.spec.ts` | Preserve one commercial URL owner; cover variants, destinations, placements, output boundary |
| `tests/analytics.unit.spec.ts` | Exact payload tests and rejection of unenumerated values |
| `tests/work-skin.spec.ts` | Contextual card appears only after both copies; no obstruction or focus theft |
| Relevant picker/settings browser specs | DOM order, keyboard access, mobile layout, outbound link contract |

### 11.2 Add

| File | Responsibility |
| --- | --- |
| `src/lib/productPromotion.ts` | Sanitized local state, session deduplication, eligibility, suppression |
| `tests/product-promotion.unit.spec.ts` | Date, session, suppression, storage-failure, and selection matrix |
| `tests/product-promotion.spec.ts` | End-to-end impression/click/success visibility journey |
| `public/products/wordfokus/*` | Approved static icon/still only when supplied |
| `public/products/worldkonstruct/*` | Approved static icon/still only when supplied |

Do not create a second analytics client, storage abstraction, modal framework, or commercial URL catalog.

### 11.3 Public/manual surfaces

| Surface/source | Task |
| --- | --- |
| `docs/landing-swipepages-2026-08.html` | Promote the product-family lifecycle; move Ko-fi farther away; verify all current product links |
| `docs/landing-wordfokus-ao3skingen-WORDPRESS.html` | Add WorldKonstruct/product-family section and remove unsupported usage claim |
| `public/examples-gallery.html` | Deploy the repository version to the live gallery route; verify app-domain deep links and product shelf |
| WordFokus web project | Add the two `/for/fanfiction-writers` routes and destination analytics |
| Marketplace listings | Ensure screenshots/copy reflect current free and paid behavior before sending more traffic |

---

## 12. Release sequence

### Release 0 — deployment and trust repair

No app behavior change.

1. Remove “Used by 1,200+ AO3 Writers” wherever it remains.
2. Publish the newer WordPress hub copy with both products.
3. Deploy the current examples gallery to the live route.
4. Replace old `ao3skingen.netlify.app` links with canonical app URLs.
5. Separate the product shelf and Ko-fi request by at least one full content section; if no section fits, demote Ko-fi to the footer/support page.
6. Verify all four public surfaces with live HTTP and visual checks.

Done when the live pages, not merely repository drafts, tell the same product-family story.

### Release 1 — measurable discovery

1. Refactor `MoreTools` into variants.
2. Add explicit CTA affordances.
3. Add the compact picker placement.
4. Add the voluntary Settings placement.
5. Add qualified view analytics and the new enumerated placements.
6. Add fixed campaign parameters to outbound destinations.
7. Ship no contextual success card yet.

Run for at least 30 days or until each primary placement has 200 qualified impressions, whichever is later. This establishes whether basic discovery is working.

### Release 2 — contextual success recommendation

1. Add local-only promotion state and tests.
2. Record successful scene handoffs once per session, including PNG.
3. Add WordFokus after the first qualifying hosted/work-skin handoff.
4. Add WorldKonstruct only after the two-day/two-handoff threshold.
5. Add `Not for me` and suppression.
6. Keep site-skin completion unchanged.

Roll out to all users unless traffic is high enough for a genuine controlled experiment. Do not split tiny traffic into variants that cannot reach a decision.

### Release 3 — tailored destinations and downstream attribution

1. Build the two fanfiction-specific product pages.
2. Add approved owner assets.
3. Update centralized links.
4. Track destination CTA and demo engagement under consent.
5. Add verified checkout/first-run source only where the destination product can support it honestly.

### Release 4 — research, only if the funnel remains ambiguous

If qualified impressions are healthy but clicks are weak, do not immediately make the cards louder. First run a one-question, fixed-answer survey:

> Where do you usually draft your fic?<br>
> Google Docs · AO3 editor · Word · Scrivener · Other

Rules:

- show once, separate from the product recommendation;
- no free text;
- record only under analytics consent;
- provide `Skip`;
- do not build a survey backend for this one question.

This answers the gating qualification question: both paid products require Google Docs.

---

## 13. Testing and visual verification

Follow the evidence ladder used in `WORK-SKIN-IMPLEMENTATION.md` and `SITE-SKIN-IMPLEMENTATION.md`, but do not claim an AO3 save/read-back for this off-AO3 UI work.

### 13.1 Unit gate

Required:

```powershell
npx playwright test --project=unit tests/product-promotion.unit.spec.ts tests/more-tools.unit.spec.ts tests/analytics.unit.spec.ts
npm run typecheck
```

Unit acceptance matrix:

- first handoff selects WordFokus;
- two handoffs on one active day do not select WorldKonstruct;
- handoffs across two days select WorldKonstruct;
- one page session increments handoff at most once;
- 14-day impression cap works at both boundaries;
- `Not for me` suppresses for 180 days;
- click suppresses for 30 days;
- corrupt/oversized storage resets safely;
- storage refusal uses session fallback;
- analytics rejects unknown products, placements, and variants;
- denied/unset consent sends no event;
- generated output remains free of both products and every commercial destination;
- only `MoreTools.tsx` owns linkable commercial URLs.

### 13.2 Local browser journeys

Warm the development server first, then run with one worker as the project docs require:

```powershell
npm run dev
```

In a second terminal:

```powershell
$env:UX_BASE_URL='http://localhost:3000'
npx playwright test --project=desktop --workers=1 tests/product-promotion.spec.ts tests/work-skin.spec.ts tests/landing.spec.ts
```

Required browser assertions:

1. Compact writer-tool row is after Site Skin and before the starter-template heading.
2. Both compact links are keyboard reachable and have visible focus.
3. Both outbound links use a new tab, `noopener noreferrer`, fixed campaign values, and no current-page/story values.
4. Returning users can open Writer Tools from Settings without going back to the picker.
5. Hosted recommendation is absent before copy and present after successful copy.
6. Work-skin recommendation is absent after one copied part and present after both.
7. The recommendation does not become the modal's autofocus target.
8. Explicit dismissal removes the contextual card immediately.
9. Reload respects suppression.
10. Site-skin copy success contains no contextual offer.
11. Analytics consent denied: UI behaves identically and no events are sent.
12. Analytics consent granted: one qualified view and one click fire with exact fixed payloads.

### 13.3 Required screenshots

Save and inspect:

- picker at 360×740, 412×915, 768×1024, and 1440×1000;
- Settings route/expanded Writer Tools at 360 and desktop;
- hosted modal before and after copy at 360 and desktop;
- work-skin modal after CSS only and after both parts at 360 and desktop;
- long translated/zoomed text at 200% browser zoom;
- product cards with images disabled or missing.

The card must not cover the copy controls, backup action, remote-media warning, or modal close button. A screenshot is required because DOM assertions do not establish that the extra content remains reachable in a constrained mobile modal.

### 13.4 Production and connected Chrome

After deployment:

1. Run the relevant browser specs against the default production `baseURL`.
2. In connected Chrome, inspect the live picker, Settings, hosted success, and work-skin success.
3. Open every outbound product link and verify the final URL, campaign parameters, page title, mobile layout, and install CTA.
4. Confirm the live WordPress hub and gallery match their repository sources.

No AO3 account or AO3 save/read-back is required because this plan must not alter generated output. If the commercial-output boundary test changes, stop and review the change before deployment.

### 13.5 Build gate

```powershell
npm run build
npm run test:unit
```

Run the repository's existing smoke set in proportion to touched files. Commercial UI work is not permission to skip the work-skin/site-skin regression suite.

---

## 14. Accessibility and trust acceptance criteria

- Product cards are ordinary links or buttons with correct semantics, not clickable `div`s.
- The visible CTA describes the destination; “Learn more” alone is insufficient.
- Contextual content is appended after success and never announced before the success message.
- Use a polite live region only for copy success. Do not make the entire commercial card an `aria-live` announcement.
- `Not for me` is keyboard accessible and has an unambiguous accessible name including the product.
- Focus never moves to a product card automatically.
- No automatic animation in the app.
- At 200% zoom and 320 CSS px width, copy/export controls remain visible and reachable.
- Product icons do not become the sole way to distinguish products.
- Color is not the sole indication that a card is clickable.
- Analytics denial has no visual or functional penalty.
- The app states that the tools are separate and optional.
- No false usage numbers, review counts, ratings, “most popular” claims, or implied AO3 endorsement.

---

## 15. CRO operating hypotheses and decision rules

These are starting hypotheses, not industry benchmarks.

| Hypothesis | Initial signal | Decision |
| --- | --- | --- |
| Current placement is the main leak | Compact placement materially outperforms lower shelf | Keep compact; leave shelf as secondary proof |
| Success timing raises relevance | Contextual CTR exceeds passive shelf CTR without harming handoffs | Keep frequency-capped success placement |
| WordFokus is the broader adjacent fit | WordFokus earns more first-success clicks | Keep it first; do not force equal exposure |
| WorldKonstruct needs returning/series context | Returning contextual placement outperforms passive shelf | Keep delayed qualification |
| Generic product pages lose intent | AO3-specific page raises install-CTA rate | Make tailored pages canonical destinations |

Directional thresholds after at least 500 qualified impressions in a placement:

- contextual CTR below 1%: re-check stage/product fit before increasing prominence;
- contextual dismissal above 20%: reduce frequency or revise the promise;
- high SkinGen click rate but low destination CTA rate: fix the destination page;
- high destination CTA rate but no first-run movement: inspect Marketplace/install/onboarding friction;
- first-run movement but no paid movement: the paid offer/product is the constraint, not SkinGen prominence;
- core handoff completion drops by more than 5% relative to the preceding comparable period: rollback the contextual UI and inspect obstruction/performance.

Do not make a placement decision on fewer than 200 qualified impressions. Do not call a change a winner on clicks if downstream activation moved in the opposite direction.

Business model formula to populate with real data:

```text
monthly qualified SkinGen users
× qualified promotion-view rate
× product CTR
× destination install-intent rate
× first-run activation rate
× paid conversion rate
× contribution per paid user
= monthly wedge contribution
```

The owner should decide the minimum monthly contribution required to justify ongoing SkinGen development. Until that number exists, “more exposure” has no economic definition of success.

---

## 16. Rollback and kill switches

No remote feature-flag service is required for the first release.

Implementation must make rollback cheap:

- contextual offers are rendered through one `MoreTools` branch;
- one exported boolean constant in `productPromotion.ts` may disable contextual eligibility at build time;
- passive picker/settings discovery remains independent;
- removing the contextual render calls must not affect handoff tracking or copy behavior;
- unknown/corrupt local state fails closed for contextual offers, not for the core app.

If the community reacts negatively:

1. disable contextual offers;
2. retain the voluntary Settings route and passive shelf;
3. do not argue with users or make the same promotion visually louder;
4. review actual dismissal, handoff, and downstream data.

---

## 17. Definition of done

The plan is implemented when:

- all live AO3 SkinGen surfaces tell the same accurate three-product story;
- stale Netlify links and unsupported usage claims are gone;
- a first-time visitor can discover the writer tools before the long template list;
- a returning user can voluntarily find them without returning to the picker;
- a successful hosted/work-skin handoff can show exactly one eligible, non-blocking product recommendation;
- WordFokus is the first contextual offer and WorldKonstruct is delayed until evidence of return activity;
- every contextual recommendation obeys session, 14-day, click, and dismissal suppression;
- qualified views and clicks are measurable under consent with fixed enumerated payloads;
- fixed campaign values survive to the destination without including any user content;
- AO3-specific product pages continue the promise and provide one clear free-install CTA;
- supplied media has passed rights, currency, accessibility, size, and reduced-motion review;
- product discovery works identically when analytics is denied;
- no commercial product or destination can enter AO3-bound output;
- unit, local Playwright, screenshot, production smoke, and connected-Chrome checks pass;
- the owner can see the funnel from qualified impression through the deepest verified downstream event.

---

## 18. Do not build in this program

- A cast JSON bridge to WorldKonstruct.
- Story-text analysis for marketing eligibility.
- AO3 login, posting, scraping, browser extension, or injected AO3 promotion.
- Product branding inside generated scenes or optional tool credit.
- A new commercial popup/modal after export.
- A product carousel.
- Animated GIFs inside the app.
- An email gate before product installation.
- A cloud account or cross-site identity graph for SkinGen.
- Person-level Marketplace attribution that has not been technically verified.
- Equal product rotation merely to be “fair”; relevance and downstream value decide exposure.
- A/B testing before traffic can support a decision.
- More AO3 SkinGen features as a substitute for fixing this funnel.

---

## 19. Owner handoff checklist

Before Release 3, the owner supplies:

- [ ] WordFokus logo/icon master.
- [ ] WorldKonstruct logo/icon master.
- [ ] Current WordFokus stills and/or motion demo.
- [ ] Current WorldKonstruct stills and/or motion demo.
- [ ] Confirmation that every asset uses public-safe sample content.
- [ ] Rights/provenance confirmation for every visible third-party element.
- [ ] Access or an assignee for SwipePages.
- [ ] Access or an assignee for the WordPress hub.
- [ ] Access or an assignee for the WordFokus/WorldKonstruct web project.
- [ ] The business's chosen minimum acceptable monthly wedge contribution.

The developer should not wait for these to implement Release 0, Release 1, local eligibility, analytics, copy, or tests.
