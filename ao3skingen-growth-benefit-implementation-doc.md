# AO3 SkinGen repository-grounded growth and publishing plan

## Developer handoff

- **Owner:** Project owner
- **Audience:** A developer who is new to this codebase
- **Revised:** August 15, 2026 — twice. The second revision is the **strategy
  correction** in Section 11.6; read it before planning any commercial work
  (previous revision: August 12, 2026)
- **Repository baseline:** `main` at `c733066`, plus uncommitted activation work
  described under "Closed later on August 15"
- **Status:** Active implementation handoff. Releases 0–3 are substantially
  shipped, **Release 4's bridge is withdrawn on audience grounds rather than
  merely blocked** (Section 11.6), and a large unplanned **platform authoring
  program** has landed on top of all of them
- **Application today:** `https://app.ao3skingen.wordfokus.com/`
- **Public landing page:** `https://ao3skingen.wordfokus.com/`
- **Additional crawlable product/guide hub:** `https://www.wordfokus.com/ao3skingen/`

This revision replaces the earlier outside-in plan. The earlier strategy was
directionally sound, but it described some shipped features as missing, did not
account for the app's current component and storage boundaries, and would have
asked a developer to add more choices and prompts to an already dense export
experience.

The implementation order in this document is deliberate. Do not start with the
WorldKonstruct card, a ZIP generator, a project library, more templates, or an
email form. First make the current product honest, secure, recoverable, and
measurable. Then add the workflow bridge.

### What changed since the August 12 revision — read this first

Fifteen commits landed between `b3c4545` and `c733066`: **95 files and 17,169
added lines**, excluding this document. Releases 0–3 together changed 75 files
and added 3,583 lines. This baseline therefore carries roughly **five times the
code volume of the entire plan that precedes it**, and almost none of it was work
this document asked for. A developer who reads the previous revision's file
references literally will be wrong about the data model, the project file format,
and where identity lives.

The four things that invalidate old assumptions:

1. **Identity is now canonical, not scattered.** `SceneCharacter`/`SceneCast` in
   [`src/lib/schema.ts`](src/lib/schema.ts) and the resolver in the new
   [`src/lib/identity.ts`](src/lib/identity.ts) replaced the five competing
   identity sources that Section 11.1 was written to untangle. Messages and
   group participants reference a stable `characterId`. **Section 11.1's premise
   is obsolete — read the rewritten section before planning any cast work.**
2. **The project file is schema v7, not v1.** Six pure migrations (`v1→v7`) are
   dispatched from `PROJECT_FILE_MIGRATIONS` in
   [`src/lib/projectFile.ts`](src/lib/projectFile.ts). The instruction "when
   adding schema v2, write pure migrations and fixtures first" was followed six
   times; it is established practice now, not future advice.
3. **Three of the four platforms were rebuilt as fiction-authoring tools.**
   WhatsApp, Twitter, and iOS/iMessage each gained a validator module
   ([`whatsapp.ts`](src/lib/whatsapp.ts), [`twitter.ts`](src/lib/twitter.ts),
   [`ios.ts`](src/lib/ios.ts)), a shared extras editor used by both the composer
   and the timeline, structured replies/media/link cards/reactions, and frame
   modes. Google was not touched. The master work skin is at version 7.
4. **AO3 Work Text now emits playable media.** Narrowly generated `<audio>`,
   `<video>`, and privacy-enhanced YouTube embeds reach the archive; static
   output (preview, Save PNG, ImgBB) deliberately keeps a linked poster card
   instead. **No media byte is ever downloaded, proxied, or uploaded by this
   app** — but a published work now makes third-party requests the reader's
   browser performs, which is a permanence and public-copy question the privacy
   disclosure in Section 7.4 does not yet cover.

### Implementation progress — August 15, 2026

**Core engineering program: 74% complete.** This is a planning estimate, not a
product metric. It is the equal-weight average of the five numbered releases,
rescored against repository and production evidence gathered on August 15, 2026:

| Release | Completion | Evidence shipped | Remaining work |
| --- | ---: | --- | --- |
| Release 0 — trust and baseline | **95%** (was 86%) | Pro and fake activation removed; generic donation/success path removed; fiction label and neutral attribution separated; the hardcoded commercial credit is gone from generated output, and a unit test pins that master-skin credit stays off by default and is added at most once; README, Terms, validation copy, scripts, and pinned AO3 ruleset updated. **Both remaining items closed later on August 15:** a tracked `LICENSE` now exists (source-available, all rights reserved) with the README agreeing, and every watermark reference is gone from `content-policy.html` — replaced by an accurate description of the default fiction label and the separate opt-in credit. The unsupported "1,200+ writers" claim was removed from both hub files in the same pass | Two content items, neither engineering: the SwipePages landing still has to be updated by hand from [`docs/LANDING-COPY-2026-08.md`](docs/LANDING-COPY-2026-08.md), and the privacy policy and Terms have not been re-read against the current product |
| Release 1 — secure images | **95%** (unchanged) | Server-only `/api/image-upload`; explicit file and rendered-scene consent; byte/type/magic-byte limits; provider timeout; origin checks; hardened DNS/redirect/streaming proxy; narrowed CSP; security tests. **Re-verified August 15:** no live application bundle contains `api.imgbb.com`, so the browser no longer reaches the provider at all | Replace the warm-instance rate/daily counters with a durable shared budget store only if traffic or abuse warrants it. One new surface to keep honest: structured media means published works reference third-party media hosts, which preflight warns about but the privacy copy does not yet describe |
| Release 2 — identity, domains, analytics | **85%** (was 76%) | Shared product config; SSR metadata (**verified live**: the app root serves `robots: noindex,follow` and its own canonical before hydration); PWA/deep-link fixes; branded app domain; Netlify 301 to the branded app (**verified live**); the SwipePages landing links the branded app (**verified live**); typed content-free analytics with explicit opt-in and reopenable privacy choices. **Both code-side gaps closed later on August 15**: `project_activated` now fires from a pure predicate, and the five missing example ids are in the allowlist behind a drift test | Raised because the two code gaps closed; the external items did not move. The WordPress hub still links the old Netlify host, and the sitemap/Search Console recheck and the weekly dashboard remain. All three are owner/content work, not engineering |
| Release 3 — backup and publishing handoff | **100%** (held) | Strict versioned scene and site-theme files; safe replace with automatic backup; validated character storage; fallback preview; deterministic transcript; attachment/scene alt; composed preflight; coordinated output-specific AO3 handoffs. **The release held through six schema migrations** — the strongest evidence in this document that the boundary was built correctly | Keep writing pure `vN→vN+1` migrations with fixtures. Preflight has grown to 24 composed checks; keep composing existing validators rather than writing a second one. Still no evidence justifying a ZIP |
| Release 4 — cast portability | **15%, and now on hold** (was 0%) | **The data prerequisite shipped.** Section 11.1 asked for one canonical answer to "what is the cast"; `SceneCast` plus `identity.ts` is that answer, with archive-or-reassign instead of silent deletion, and library entries copied into a scene rather than linked live. `cast_exported`/`cast_imported` remain reserved-only event types | **The remaining 85% should not be built as specified.** Section 11.6 withdraws the WorldKonstruct bridge on audience grounds — the owner inputs are no longer the binding constraint, the audience mismatch is. The percentage is retained so the number stays comparable, not as a plan to finish it |

Calculation: `(95 + 95 + 85 + 100 + 15) / 5 = 78`, reported as 78%.

Releases 0 and 2 were rescored against work that landed on the afternoon of
August 15. Releases 1, 3, and 4 carry their morning scores unchanged, because
nothing in that work touched them and no fresh evidence was gathered for them.
Release 4 keeps 15% even though its plan changed, so that the figure keeps
meaning "how much of the original scope exists" rather than silently absorbing a
strategy decision.

Sections 12–15 contain ongoing compatibility, accessibility, measurement, and
distribution work. They are not counted as a finite sixth release, and neither
is the platform program below. Track their individual deliverables, but do not
change the 74% figure without rescoring all five releases against repository and
production evidence.

### The unscored sixth program — platform authoring depth

The largest body of work in this baseline belongs to none of the five releases.
It is recorded here so that it is visible, and it is deliberately **not** folded
into the 74% figure, for the same reason Sections 12–15 are not: the five
releases score the growth-and-publishing plan, and rescoring them against work
they never scoped would make the number mean nothing.

| Platform | Status | Model module | Open |
| --- | --- | --- | --- |
| WhatsApp (`template: 'android'`) | Shipped 13 Aug; schema v5–v6 | [`src/lib/whatsapp.ts`](src/lib/whatsapp.ts) | AO3 save/read-back |
| Twitter / X | Shipped 13 Aug; schema v6, master skin v6 | [`src/lib/twitter.ts`](src/lib/twitter.ts) | AO3 save/read-back |
| iOS / iMessage | Shipped 14 Aug; schema v7, master skin v7 | [`src/lib/ios.ts`](src/lib/ios.ts) | AO3 save/read-back — **this is the open release gate** |
| Google Search | Not rebuilt | none | Nothing scheduled. Do not start one speculatively |
| Site skin | Phase 9 shipped, plus the §14 author-wins defect fix | `src/lib/siteSkin/*` | Phase 7: never once saved on real AO3 |
| Identity / cast | Shipped 13 Aug (`5e8d9bc`) | [`src/lib/identity.ts`](src/lib/identity.ts) | One product decision, recorded in that plan's §11.7 |

Each platform has its own implementation plan in `docs/`, and each is written as
a handoff rather than a task list. Read the relevant one before touching a
renderer; they carry defect histories this document does not repeat.

### Two open archive gates

Both are external, both need a human with an AO3 account, and **neither can be
closed by any test in this repository.** They are the highest-value work
outstanding on the whole project — higher than anything in Section 14's backlog.

1. **Master work skin v7 read-back.** `tests/ao3-readback.unit.spec.ts` currently
   **skips**, printing `The newest AO3 readback predates master-skin v7`, because
   the two readback files in the repository root are from v6. A skipping test is
   not a passing one. The exact procedure is in
   [`docs/IOS-IMESSAGE-PLATFORM-IMPROVEMENT-IMPLEMENTATION-PLAN.md`](docs/IOS-IMESSAGE-PLATFORM-IMPROVEMENT-IMPLEMENTATION-PLAN.md)
   under "The one thing still open". Save the stored CSS back into the repository
   root as `ao3 master workskin <date>.txt` and the test picks it up
   automatically.
2. **Site-skin Phase 7.** No template in the 16-template catalog has ever been
   pasted into AO3 and submitted. Until
   [`docs/SITE-SKIN-AO3-CHECKLIST.md`](docs/SITE-SKIN-AO3-CHECKLIST.md) is filled
   in, every "AO3-safe" claim in the site-skin UI is a well-tested prediction. Do
   probe P10 first — read a work that has its own work skin with a site skin on.
   That is the class of bug that already escaped once, in `5c47eda`.

### Release 2 gaps found on August 15

These are small, specific, and cheap. They are named here because "typed
analytics shipped" has been read as "measurement works", and it does not yet.

1. **The WordPress hub still points at the old Netlify host.**
   `https://www.wordfokus.com/ao3skingen/` returned 200 and links
   `https://ao3skingen.netlify.app` and `https://ao3skingen.netlify.app/site-skin`.
   The 301 to the branded app works, so no user is stranded, but the hub's own
   links have not been updated. This was listed as open on August 12 and is still
   open.
2. **`project_activated` is declared but never fired.** ~~It is a member of the
   `AnalyticsEvent` union in [`src/lib/analytics.ts`](src/lib/analytics.ts) and
   appears at no call site anywhere in `src/`.~~ **Closed later on August 15 —
   see below.**
3. **Five starter examples are silently invisible to analytics.**
   `analyticsPayload` rejects the *entire event* when `templateId` is not in
   `TEMPLATE_IDS`, and `index.tsx` fires `template_selected` with the example's
   own id. `ios-rich-group-scene`, `twitter-quote-post`,
   `twitter-four-image-post`, `twitter-video-post`, and `twitter-long-thread`
   existed in [`src/lib/examples.ts`](src/lib/examples.ts) but not in that
   allowlist, so choosing the newest and richest examples recorded nothing.
   Export events were unaffected: they send `project.template`, which is always
   one of the four platform ids. **Closed later on August 15 — see below.**

### Closed later on August 15, 2026 — the two Release 2 code gaps

Both are in the working tree and not yet committed at the time of writing.
Verified together: typecheck passed, `npm run test:unit` reported **381 passed,
1 skipped** (up from 362; the single skip is still the AO3 read-back gate), and
`npm run build` succeeded. No renderer, schema, or export path was touched.

**Gap 3 — the allowlist.** The five ids are now in `TEMPLATE_IDS`, and the class
of bug is closed rather than the instance: `analytics.unit.spec.ts` now walks
every example in `examples.ts` and every site-skin template and asserts each one
survives `analyticsPayload`. A future example that forgets its id fails a test
instead of going quiet in production. `ANALYTICS_TEMPLATE_IDS` is exported for
that test only.

**Gap 2 — activation.** [`src/lib/activation.ts`](src/lib/activation.ts) is a new
pure module holding both halves of Section 5.2: the per-platform thresholds, and
the rule that outranks them — seeded example content does not count until the
author edits it. It works by fingerprinting each message at the moment the
project is handed over and comparing later. Four decisions worth knowing:

1. **The signature covers every structured field**, not `content` alone. Section
   5.2's "materially edits two messages" predates the platform rebuilds; an
   author who adds a voice message or a Tapback to a seeded example has plainly
   done real work.
2. **`status`/`statusMode` are excluded from the signature.**
   `appendChatMessage` advances an automatic status to `read` on every earlier
   outgoing message when a reply arrives. Counting those would score one new
   message as several and clear the two-message chat threshold on its own. A
   test pins this.
3. **Keys are sorted before hashing.** `{ ...message, content }` preserves key
   order and appends, so two structurally identical messages could otherwise
   serialize differently and read as an edit.
4. **The baseline is taken *after* `migrateProjectIdentities`**, or the stamped
   `characterId`s read as authorship.

Firing rides the existing debounced persist effect in both pages, so there is no
second listener to keep in step. Only `project.template` (or the site-skin
template id) is sent; the local project UUID is used to deduplicate and never
leaves the browser, exactly as Section 5.2 requires. `markActivatedOnce` falls
back to an in-memory set when localStorage is refused, so a private-browsing
visitor produces one event per session rather than none.

One finding worth recording: an early test asserted that setting
`twitterDisplayName` alone should activate a Twitter project. It failed, and the
**test** was wrong. The predicate reads the primary account through
`resolveIdentityTarget`, which is canonical; `settings.twitterDisplayName` is a
legacy fallback that the identity panel keeps in sync via `updateSceneCharacter`.
Reading the resolver is correct, and Learning 19 applies — decide which side is
wrong before editing either.

### Shipped commit trail

Releases 0–3, as recorded in the previous revision:

- `f20d0bd` — secure image handling and trust baseline
- `7dc4178` — branded application domain, metadata, PWA, and deep links
- `4701bb7` and `695a37e` — explicit content-safe analytics consent and copy
- `5d6478a` — versioned project/theme backups and improved publishing handoff
- `b3c4545` — moved privacy choices into real layouts so the control cannot
  cover the composer; added desktop/mobile collision coverage

Since that revision:

- `03ecd10` — recorded the previous implementation progress and brought this
  document into the repository
- `f2bc76c` — site-skin Phase 9: tag colours by type, themed scrollbars, and
  banner hosting in the export dialog
- `5e8d9bc` — **made character identity one coherent feature**; introduced
  `SceneCast`, `identity.ts`, and project schema v2
- `5c47eda` — **fixed a shipped defect in which a reader's site skin vandalised
  an author's work skin**; the preview mock now carries an author's work skin
  permanently, and loads three stylesheets in AO3's real order
- `11cd532`, `53a560c` — rewrote the site-skin and identity plans as handoffs
- `027bf91` — kept group identities in sync
- `98e51ac`, `be0960c` — message emoji picker
- `1f2c612`, `36e8eb5` — native emoji-only chat messages, and emoji spacing
  preserved in PNG exports
- `4db9c21` — automated editable message metadata
- `0064e6c`, `06519ef` — planned and shipped the Twitter platform overhaul
  (schema v6, master skin v6)
- `c733066` — **rebuilt the iMessage platform as a fiction-authoring tool**
  (schema v7, master skin v7); fixed two P0 defects, one of which was group
  colour emitted as an inline `style` that AO3 strips outright, so the colour
  reached the preview and the PNG and was silently dropped on the archive

The tracked implementation is clean at this baseline. The working directory
still contains owner-created, untracked documents, screenshots, article drafts,
and image-reference material. Preserve them. This document was one of those
files before the previous handoff and is now intentionally part of the
implementation record.

### Current production architecture

The owner-approved split differs from the original recommendation later in this
document:

```text
ao3skingen.wordfokus.com       public SwipePages landing page
app.ao3skingen.wordfokus.com   interactive Netlify application
www.wordfokus.com/ao3skingen/  additional WordPress product/guide hub
```

Treat `https://app.ao3skingen.wordfokus.com` as `PRODUCT.appUrl` and
`https://ao3skingen.wordfokus.com` as `PRODUCT.hubUrl`. Do not collapse the
landing page and app onto one host unless the owner deliberately reverses this
decision. The old `ao3skingen.netlify.app` address redirects to the branded app
and is not the public application identity.

Live domain verification, re-run on August 15, 2026:

- the branded app returned 200, and its **server-rendered** HTML carried
  `<meta name="robots" content="noindex,follow">` and
  `<link rel="canonical" href="https://app.ao3skingen.wordfokus.com/">` — the
  Section 9.2 requirement is genuinely satisfied, not client-only;
- the SwipePages landing returned 200 and contained the branded application URL;
- the WordPress hub returned 200 but **still links `https://ao3skingen.netlify.app`
  and `https://ao3skingen.netlify.app/site-skin`**, not the branded app. This is
  unchanged from August 12 and is the oldest open external item;
- `https://ao3skingen.netlify.app/` returned `301` to
  `https://app.ao3skingen.wordfokus.com/`, so hub visitors still arrive correctly;
- the live `content-policy.html` still contains three "watermark" references,
  confirming the Release 0 copy debt is deployed and not merely local; and
- no live application JavaScript bundle contained `api.imgbb.com`, which is the
  standing Release 1 check.

Every one of these is mutable external state. Re-run them before domain or
content work rather than trusting this list.

### Implementation learnings

1. **A public environment variable is not a protected credential.** The old
   `NEXT_PUBLIC_IMGBB_API_KEY` was absent from Git history but present in the
   browser bundle by design. The correct boundary is the same-origin server
   route with `IMGBB_API_KEY`. Never print `.env.local` values while debugging.
2. **Use one canonical renderer per output.** Backup, transcript, fallback, and
   preflight work succeeded because they wrap existing `buildHTML`, `buildCSS`,
   `buildWorkSkin`, `buildMasterWorkSkin`, and site-skin `compile(theme)` output.
   Do not introduce a second “Publishing Kit” renderer.
3. **Strict imports and tolerant local recovery are different trust
   boundaries.** Project files use explicit keys, limits, enums, URLs, format,
   and version checks. The localStorage recovery loader may retain backward-
   compatibility behavior, but arbitrary imported JSON must never enter React
   state through it.
4. **A backup is meaningful only when its freshness changes with the project.**
   Backup status is based on a project fingerprint, so editing after download
   correctly returns the preflight to “backup recommended.”
5. **Alt edits do not require another hosted upload.** Once ImgBB returns the
   image URL, changing the short scene description regenerates the local AO3
   embed code. The image bytes and URL stay unchanged.
6. **Fixed controls must participate in layout.** The floating Privacy pill was
   placed above the measured export bar and therefore landed on the composer.
   Privacy choices now open through an application event from controls located
   in the export bar, landing footer, and site-skin header. Preserve the
   desktop/mobile collision test whenever fixed UI changes.
7. **Production image handling is healthy across the supported formats tested.**
   Fresh PNG, JPEG, and WebP files uploaded through the live API, returned valid
   public image responses, rendered through the live UI, and appeared in a PNG
   export. A report of blank image bubbles was not reproduced and was most
   consistent with stale local/browser state. Recheck with a fresh file and a
   hard refresh before changing the upload pipeline.
8. **Service workers and CDN propagation can make a correct deployment look
   half-updated.** Netlify took several minutes to serve `b3c4545`, and one probe
   briefly saw an HTML document that referenced an unavailable old script.
   Verify the deployed bundle and then run the relevant test against the public
   URL. If a browser alone shows old UI, use a hard refresh before diagnosing a
   source regression.
9. **Browser tests default to production.** `playwright.config.ts` uses the live
   app unless `UX_BASE_URL` is set. For local checks, start the app and explicitly
   set `UX_BASE_URL=http://127.0.0.1:3000`. Use `--workers=1` for stateful UI
   sequences and deployment verification.
10. **Public copy is a separate deployment surface.** Repository HTML, the
    SwipePages landing page, WordPress, privacy/Terms pages, and the application
    can drift independently. A code deploy does not prove all public claims are
    aligned.

Added by the August 13–14 platform, identity, and site-skin work. Each cost real
time, and each generalizes beyond the feature that taught it:

11. **AO3 strips every inline `style`, so a colour that must survive has to be a
    class.** iOS group colour was a free hex value emitted inline. It reached the
    preview and the PNG and was silently dropped on the archive — the app and the
    published work disagreed, and only the archive could show it. It is now a
    finite `iosTone` palette compiled to classes the stylesheet carries. Any new
    author-chosen value that has to survive AO3 needs the same treatment: a
    finite enum, not a free value.
12. **Our CSS is a guest twice over — on AO3's page, and inside an author's
    work.** AO3 renders a work skin in the page body, *after* our site-skin
    stylesheet in `<head>`, and prefixes every selector with `#workskin`. The
    author therefore beats us on both source order and specificity unless we use
    `!important`, and then we beat them on nothing but volume. A shipped site
    skin put a floated 4em drop capital on every chat bubble in a real work.
    `Rule.authorWins` now marks the six selectors that can land inside a work.
    Colour reaching inside a work is what the reader asked for; layout is not.
13. **A preview that contains no work skin is a model of the wrong page.** 273
    green tests and a preview that matched the export byte for byte did not catch
    the defect above; a reader opening a real work saw it in minutes. The mock
    page now carries an author's work skin permanently. When you build a preview,
    ask what it structurally cannot contain — that is where the next defect is.
14. **Take the characterization golden before the refactor, not after.** Pulling
    the iOS renderer out of the shared `msgHTML` path turned "did the extraction
    change anything?" into a diff, and it proved both P0 defects on the first
    run. Refresh a golden only while reading its diff — that diff is the review.
15. **html2canvas is not the browser, and only a picture catches the
    difference.** Two shipped-quality defects were invisible to the lint, the
    injection harness, and 362 unit tests: a reply card rendered red-on-blue, and
    a mis-centred two-line header painted its text low. Export a real PNG and
    look at it, at zoom, whenever chat layout changes.
16. **Literal whitespace between inline children is load-bearing.** With the skin
    on, the elements are block-level and the space costs nothing; with the skin
    off it is the only thing separating two readings. One run of the skin-off
    harness caught four welded readings — `ALAlex`, `Replying to AlexThe side
    door…`. Add a span, add the space with it.
17. **Never guess a discriminator during storage recovery.** A missing or
    unrecognised media `kind`/`source` drops the whole block rather than
    inferring "this URL looks like YouTube". A wrong guess produces a card the
    author never wrote, which is worse than an empty message — preflight reports
    the empty message in plain words.
18. **A default that points at a third-party host is a permanence bug in every
    work already published.** The iOS header and footer defaults fetched remote
    chrome strips, so each published work made permanent requests to a host that
    AO3 keeps no copy of; that host going away would take the header out of every
    chapter already posted. They now default to empty, and remain as advanced
    overrides. Apply the same test to any new default that carries a URL.
19. **A feature-local suite passing is not evidence the app works.** The identity
    work's own 20 scenarios passed while three real accessibility defects sat in
    surfaces the wider suite touched. When a rename breaks an unrelated test,
    decide which side is wrong before editing either.

Added by the August 15 strategy review:

20. **A schema that will not fill itself is telling you the products do not
    fit.** Two fields in the neutral cast schema — `aliases` and `notes` — have
    no source anywhere in this application, and never acquired one across six
    migrations. Meanwhile the field the app is richest in, a Twitter handle, is
    the least story-bible-like thing in the file: it is a rendering choice made
    for one screenshot, not a fact about a character. The mapping gap was visible
    for months and was read as "fields to fill in later" rather than as evidence.
    When an interchange schema needs data your product has no reason to collect,
    check the audience before writing the exporter.
21. **Ask who the user is at the moment you interrupt them, not who they are in
    general.** Release 4 was planned around an author keeping a cast consistent
    across a fic. The person exporting from this app has almost always finished
    writing and is solving a presentation problem. Both propositions can be true
    about the same human and still make the offer irrelevant, because they
    describe different weeks. Stage, not persona.
22. **Prove the code you are blaming can execute.** The WhatsApp missing-avatar
    defect was diagnosed in writing, in detail, against markup that builds a
    `.group-sender-row` with inline styles — and that code is unreachable.
    `msgHTML` returns to `whatsappMessageHTML` for `android` and to
    `iosMessageHTML` for `ios` long before it, so its `isGroupMode` is false for
    everything that reaches it. The written analysis was internally coherent,
    named real line numbers, and identified a real AO3 behaviour (inline styles
    are stripped). It was still wrong, because it never asked whether the branch
    runs. One `querySelectorAll('.group-sender-row')` against the live preview
    settled it in seconds. **Read the dispatch, not just the function**, and when
    a document tells you to reproduce before fixing — as that one did, in bold —
    the instruction is load-bearing.
23. **A branch whose arms resolve to the same value is invisible to every test
    that asserts on markup.** `PLATFORM_ASSETS.twitter.logoGrey` pointed at the
    same black PNG as `logo`, so the dark-mode X was drawn black on a black card.
    The renderer branched correctly, the markup was correct, and every assertion
    passed; the file was simply the wrong picture. This is Learning 15's point
    arriving without html2canvas anywhere in it — the defect is in an *asset*,
    and only looking at the render finds it. When a theme, locale, or mode
    branch exists, check that the two arms actually differ.
24. **An inline style in the export clone outranks the stylesheet, so scope it
    as narrowly as the thing it compensates for.** `ExportPanel` forced
    `position:relative` on every `.tweet .twitter-logo` to seat the compact
    logo on its name line. When the expanded tweet gained a logo positioned in
    the card corner, that blanket rule would have knocked it back into flow **in
    the PNG only** — preview and archive correct, exported image wrong. The
    export clone is a third renderer with the highest specificity in the system;
    every selector added to it should name the case it fixes.

### Clean handoff for the next developer

Start from `main` at or after `6364508`, which is deployed. Do not reset or
clean the workspace; the untracked screenshots, reference exports, article
drafts, implementation blueprints, and image-handling examples belong to the
owner. There were 23 untracked entries at the close of the August 15 render
pass and none of them were committed — that is deliberate, not an oversight.
Some are clearly owner material (`docs/AO3-CONTENT-PLAN.md`, `docs/articles/`,
the two article generator scripts under `scripts/`) and may be worth committing
once the owner says so; the rest are screenshots and drafts.

Environment and boundaries:

- `IMGBB_API_KEY` is server-only and configured in Netlify; never add the
  `NEXT_PUBLIC_` prefix.
- `NEXT_PUBLIC_GA_MEASUREMENT_ID` is intentionally public, but analytics must
  remain disabled until explicit consent.
- Editable fiction, identities, image addresses, generated code, raw errors,
  and imported-file contents must never enter analytics.
- The app stores one scene project, one separate site theme, and a validated
  character library locally. There is no cloud account or project library.
- **Project file schema v7** is documented in
  [`docs/PROJECT-FILE-SCHEMA.md`](docs/PROJECT-FILE-SCHEMA.md), together with the
  v1–v6 import rules and the reasoning for each migration step.
- Media URLs are validated and stored; **media bytes are never downloaded,
  proxied, or uploaded.** Keep it that way — it is what makes structured media a
  schema question rather than a hosting one.

Where the code now lives. This is the orientation the previous revision's
Section 3 table can no longer give:

| Concern | Module | Note |
| --- | --- | --- |
| Scene and settings types | [`src/lib/schema.ts`](src/lib/schema.ts) | Also `SceneCharacter`/`SceneCast` |
| Identity resolution and migration | [`src/lib/identity.ts`](src/lib/identity.ts) | The one resolver every output reads through |
| Per-platform models | [`ios.ts`](src/lib/ios.ts), [`twitter.ts`](src/lib/twitter.ts), [`whatsapp.ts`](src/lib/whatsapp.ts) | Deliberately separate; they must not read each other's fields |
| Markup and stylesheets | [`src/lib/generator.ts`](src/lib/generator.ts) | One stylesheet drives preview, PNG, and both skins |
| The export clone — effectively a third renderer | [`src/components/ExportPanel.tsx`](src/components/ExportPanel.tsx) | Inline styles applied to a detached clone before html2canvas. They **outrank the stylesheet**, apply to the PNG only, and are where every html2canvas compensation lives. Scope each selector to the case it fixes (Learning 24) |
| Bundled platform chrome | [`src/lib/platformAssets.ts`](src/lib/platformAssets.ts) | Paths plus `LOCAL_ASSETS_MAP`, which is what the work-skin path treats as chrome to absolutise. A "grey variant" here may be a literal duplicate of the light one — check before trusting a theme branch (Learning 23) |
| Single and master work skins | [`src/lib/workSkin.ts`](src/lib/workSkin.ts) | `MASTER_SKIN_VERSION` is stamped as a CSS rule, because AO3 deletes comments |
| Strict file boundary | [`src/lib/projectFile.ts`](src/lib/projectFile.ts) | v1–v7, pure migrations |
| Tolerant local recovery | [`src/lib/storage.ts`](src/lib/storage.ts) | A different trust boundary; never merge the two |
| Composed blockers and warnings | [`src/lib/preflight.ts`](src/lib/preflight.ts) | 24 checks, all composed from existing validators |
| Site skin | `src/lib/siteSkin/*` | `compile.ts` feeds preview and export from one call |

Verification commands on Windows PowerShell:

```powershell
npm run typecheck
npm run build
npm run test:unit          # --project=unit: pure logic, no browser, no server
npm run audit:ao3-css      # explicit, developer-invoked; never runs in a build
# In a separate terminal after the build:
npm run start -- -p 3000
# Back in the test terminal:
$env:UX_BASE_URL='http://127.0.0.1:3000'
npx playwright test tests/project-backup.spec.ts tests/analytics-consent.spec.ts --project=desktop --project=mobile --workers=1
```

Note that `npm run test:unit` is now `playwright test --project=unit`, not a
`tests/*.unit.spec.ts` glob — the previous revision's Section 7.1 script list is
superseded by what is actually in `package.json`.

For production verification, replace `UX_BASE_URL` with
`https://app.ao3skingen.wordfokus.com`. **Browser projects default to the live
app**, so an unset `UX_BASE_URL` silently tests production.

Evidence re-gathered for this revision on August 15, 2026, and again after the
render-defect pass later the same day:

- TypeScript check: **passed**; production build: **passed**;
- deterministic unit suite: **395 passed, 1 skipped** (362 earlier in the day,
  249 at the original audit). The single skip is the AO3 read-back gate
  described above, and it is skipping for a correct reason: no human has saved
  the v7 skin on the archive yet. **Both `ao3 master workskin*.txt` files in
  the repository root are `v2`** — five versions stale — so the gate cannot be
  closed by anything in the working tree;
- browser suites re-run serially against a local production build after the
  render pass: `ao3-injection`, `whatsapp-raster`, `ios-raster`,
  `twitter-raster`, `skin-off` — **21 passed**. `work-skin` and
  `whatsapp-authoring` each failed once under two workers and passed alone;
  treat a single failure in a combined run as a flake until it repeats;
- **`tests/settings-render.spec.ts` fails six tests on `main`, and did so
  before this pass.** Confirmed by running it against the deployed site, which
  carried none of the new work. One expects a `2 participants` subtitle where
  the renderer emits the members list. Open, unowned, and not a regression;
- AO3 CSS ruleset audit: **182 properties and 20 shorthands, no drift** in either
  direction, against pinned upstream commit
  `cf1d7f997047eaca14370985dafd156a91696313`. The `aspect-ratio` gap recorded in
  Section 3.3 is closed;
- live production probes: app 200 with SSR robots/canonical, landing 200 with the
  branded app URL, Netlify 301 to the branded app, no `api.imgbb.com` in any live
  bundle, and the live iOS bundle carries the v7 markers (`ios-tone-`,
  `Tapback`), so `c733066` is deployed.

Not re-run, and therefore not claimed: the **mobile** browser project, and live
upload checks. The platform plans record their own passing runs from 13–14
August; treat those as current unless you change a renderer.

#### The render-defect pass, August 15 2026 — what shipped

Six defects were reported against the live app; five are closed and the sixth
was not a bug. Full analysis, including two corrections to its own earlier
diagnosis, is in
[`docs/RENDER-DEFECTS-AND-GALLERY-HANDOFF.md`](docs/RENDER-DEFECTS-AND-GALLERY-HANDOFF.md).

| Commit | What | Reaches AO3? |
| --- | --- | --- |
| `ecb5aa9` | WhatsApp header and reply card no longer clip their text in exported PNGs | No — export clone only |
| `f3bc60e` | The expanded tweet template gained the X logo it never had, positioned in the card corner | **Yes** |
| `e78dcc6` | WhatsApp group messages draw a participant avatar; the unreachable inline-styled avatar path and seven dead iOS rules deleted | **Yes** |
| `845933f` | A real light-on-dark X logo asset, so dark tweets stop drawing it black on black | **Yes** |
| `dc30b8a` | Help text under the iOS header-image field explaining the empty default | No |
| `6364508` | Documentation corrections | — |

One commit per blast radius, deliberately: the export-clone changes and the
generated-markup changes have different review needs and different failure
modes on the archive.

Three things worth carrying forward:

1. **The default path was the broken one.** A blank Twitter project defaults to
   scene mode `single`, and `resolveTwitterLayout` sends a single scene's first
   post to the expanded template — the one with no logo. Four of the seven
   Twitter examples are compact, so every developer check hit a working path
   while every new visitor hit the broken one. When a defect "only affects some
   examples", find out which path a *blank project* takes before believing it is
   an edge case.
2. **The documented diagnosis was wrong twice**, and both corrections came from
   measurement rather than re-reading: the missing avatar was unreachable code,
   not stripped inline styles (Learning 22), and the clipped reply quote was
   `overflow:hidden` on a one-line box, not a `max-height` clamp the arithmetic
   shows is never reached. A prose analysis with real line numbers can be
   entirely self-consistent and still describe code that does not run.
3. **AO3 injection breaks child combinators, and it bit again.** A logo placed
   with `.tweet.expanded > .twitter-logo` lost 31px of card width under
   `ao3-injection.spec.ts`, because AO3 wraps a bare `<img>` child in its own
   paragraph and that paragraph becomes a flex item. The remedy — descendant
   selector plus `display:contents` on the wrapper — was already written down in
   `generator.ts` at `.quote-head`, along with the sentence explaining that the
   two fixes are complementary. It was found by the test rather than by reading
   the comment. Read that comment before adding any positioned rule inside a
   flex row.

**Deploy verification.** `main` was fast-forwarded and pushed, and the result
checked on production rather than assumed: `hero-scene-video.png` now answers
200, closing the hero 404 that made the landing image render as alt text. A 200
on that file alone would not have proved the new build was live — it could have
been cached — so `assets/twitter-logoGrey.png`, which exists in no earlier
deploy, was probed as well, and the WhatsApp and Twitter exports were captured
from production and inspected.

The next work should proceed in this order:

0. **Re-paste the landing page into SwipePages.** Newly the cheapest item on the
   list, and the only one left from the render pass. `hero-scene-video.png` now
   serves 200, so the hero will load — but `docs/landing-swipepages-2026-08.html`
   is pasted by hand into a system that cannot see this repository, and the
   bottom-fade fix and the corrected image URL are not live until a human pastes
   it. **Deploy the asset before pasting the markup, and `curl` every image URL
   the page names first.** That ordering is what the hero 404 cost three
   iterations to learn: the page looked like a layout bug and was a missing file.
1. **Close the two archive gates.** Both need an AO3 account and roughly an hour
   between them. They outrank every code task on this list, because the master
   skin v7 and all sixteen site-skin templates are currently *predictions* about
   what the archive stores. Do the master-skin read-back first; it has a history
   of finding bugs nothing else can see. Two changes landed on August 15 that
   reach the archive — the expanded tweet's corner logo and the WhatsApp group
   avatar — and neither has been seen by AO3. Both were built to the rules
   (finite tone classes, no inline styles, descendant selectors, only allowlisted
   properties) but that is a prediction too. Neither required a
   `MASTER_SKIN_VERSION` bump, because no new class is emitted and a v7 skin
   already carries rules for every class involved; **do not bump to v8 before
   this gate closes**, or the repository owes two read-backs instead of one.
2. **Close the copy gap — this is now the highest-value non-blocked work.**
   Section 1 already identified it as the cheapest remaining growth lever, and
   Section 11.6 promotes it to the main one: the product does considerably more
   than any public page says, and the same pass can place the owner's other
   products properly. It is content work on owned surfaces, with no application
   code and no risk to the shipped renderers. Covers the stale hub links at the
   same time. **`public/examples-gallery.html` is the concrete first piece**, and
   it has a written brief in §7 of the render-defects handoff: regenerate its
   imagery with `scripts/capture-hero.mjs` before any redesign, decide which of
   the two hosts owns the page and 301 the other, audit its copy against the
   real feature set, and make every card deep-link with `?template=`. Note the
   trap recorded there — the gallery is a **fourth** hand-maintained copy of the
   example catalogue, so either generate it from `examples.ts` (there is
   precedent in `scripts/generate-*.mjs`) or extend
   `tests/examples-catalog.unit.spec.ts` to parse the HTML and assert it agrees.
   Do not add a fifth list and hope.
3. **Finish Release 0's audit.** The licence and the content-policy language
   closed on August 15. What is left is re-reading the privacy policy and Terms
   against the current product — neither has been checked since structured media
   and the Section 11.6 product surface shipped.
4. **Finish Release 2's external half.** The two code gaps closed on August 15.
   What remains is owner/operations work: recheck WordPress sitemap and Search
   Console, and build the weekly content-free dashboard from the events that now
   exist — `project_activated` among them.
5. **Extend the privacy disclosure to structured media.** Section 7.4's text
   predates playable media. A reader's browser now fetches third-party audio,
   video, and YouTube embeds from a published work. Say so.
6. **Build product visibility per Section 11.6, in its stated tiers.** Tiers 1
   and 2 first; Tier 3 only when there is traffic worth measuring; Tier 4 only
   after Tier 3 can judge it.
7. **Continue compatibility work:** add the Markdown compatibility ledger and
   dated AO3 Default/Reversi/Low Vision checks before expanding public
   compatibility claims.
8. **Do not build Release 4's bridge at all.** This is a change from the previous
   revision, which said "not speculatively" and listed the owner inputs as the
   blocker. Those inputs are no longer the binding constraint. **Section 11.6 is
   the reasoning; read it before reopening the question.**

When adding schema v8, write the pure `v7 -> v8` migration and its fixtures
before changing the importer, and add an explicit dispatch entry even when the
step adds no data — `v6 -> v7` does exactly that, and says why in the schema doc.
A migration must never invent content the author did not write: the retired
single `reaction` string is deliberately *not* copied into `iosTapbacks`.

When changing the export bar, consent UI, composer, or mobile preview, rerun
occlusion/collision checks at both desktop and narrow mobile widths. When
changing AO3 CSS, record the exact upstream commit, run `npm run audit:ao3-css`,
and keep builds and tests independent of live GitHub. When changing a chat
renderer, export a real PNG and look at it — learning 15 above is there because
two shipped-quality defects survived 362 unit tests and every lint.

### Audit scope and external evidence

This revision did not treat the workspace as the whole product. It also checked:

- the [public GitHub repository](https://github.com/victorjaxen1/ao3-skin-generator-prod)
  and every commit reachable from its `main` branch;
- the [production Netlify app](https://ao3skingen.netlify.app/) HTML and
  JavaScript bundles;
- the [WordPress hub](https://www.wordfokus.com/ao3skingen/),
  [allowed-CSS article](https://www.wordfokus.com/ao3-allowed-css-properties/),
  Rank Math page sitemap, and [legacy subdomain](https://ao3skingen.wordfokus.com/);
- the current [WordFokus Google Workspace Marketplace listing](https://workspace.google.com/marketplace/app/wordfokus_distractionfree_writing_for_do/297087799172);
- [ImgBB's current API documentation](https://api.imgbb.com/);
- the current [`otwcode/otwarchive` CSS configuration](https://github.com/otwcode/otwarchive/blob/cf1d7f997047eaca14370985dafd156a91696313/config/config.yml)
  on GitHub; and
- current OTW/AO3 policy guidance on commercial promotion.

External state can change after this date. Re-run the specific checks named in
the relevant release instead of copying these findings indefinitely.

**What the August 15, 2026 revision checked, and what it did not.** This revision
was primarily a repository reconciliation — fifteen commits had landed and the
document described a codebase that no longer existed. Against the repository it
read the full diff `b3c4545..c733066`, the platform, identity, and site-skin
implementation plans in `docs/`, the schema, identity, analytics, preflight,
project-file, and work-skin modules, and `package.json`/`playwright.config.ts`.
It ran typecheck, the unit suite, and the AO3 CSS audit. Against production it
re-probed the app, landing, hub, and Netlify redirect, read the app's
server-rendered metadata, scanned the live JavaScript bundles for the ImgBB host
and for iOS v7 markers, and checked the live legal and content-policy pages.

**The second August 15 revision** was a strategy review, not an audit. It gathered
no new external evidence and re-ran no probes. It closed the two Release 2 code
gaps — verified by typecheck, the unit suite at 381 passed / 1 skipped, and a
successful production build — and it withdrew Release 4's bridge on the reasoning
in Section 11.6. Where it changed a claim about the world rather than about the
code, it is reasoning from evidence already recorded here, chiefly the schema gap
in Learning 20. **Its central claim — that this app's users have finished writing
— is an argument, not a measurement.** Section 11.6 Tier 3 is what would test it.

Neither revision re-ran the desktop or mobile browser suites or live upload
checks, and neither re-audited the Marketplace listing, the otwarchive
configuration beyond the pinned-commit comparison, or OTW policy
guidance. Those were verified on 12–14 August by the work that shipped; treat
them as current unless a renderer changes. Where this document states a test
result, it states which run produced it — do not promote an inherited number into
a fresh claim.

## 1. Executive decision

AO3 SkinGen should become the **AO3 publishing utility for social-media scenes**,
not another generic fake-screenshot site.

Its defensible promise is:

> Build a social-media scene visually, then publish it as a PNG or as accessible
> real text with AO3-compatible CSS and a readable no-skin/download fallback.

The app already earns this position, and earns it more strongly than when this
document was written. It has four scene types — three of which are now real
authoring tools rather than bubble mockups, with structured replies, image
collages, link cards, voice and video, reaction stacks, and date/system events —
plus image export, hosted AO3 image code, single-platform and all-platform work
skins, meaningful skin-off output, a site-skin maker, an AO3 CSS
allowlist/linter, local auto-save, a canonical project-scoped cast, group
participants, and extensive AO3 regression tests.

The strategic risk has changed shape accordingly. In August 12's baseline the
risk was that the product promised more than it did. At this baseline the risk is
the reverse: **the product does considerably more than any of its public copy
says.** The landing page, the WordPress hub, and the guides describe a screenshot
generator with a site-skin maker. None of them mention that three platforms
author rich scenes, or that the work-skin export now carries playable media. That
gap is a marketing problem, not an engineering one, and it is the cheapest
remaining growth lever in this document.

The next product work should therefore do five things:

1. remove trust contradictions and secure image handling;
2. measure actual completed handoffs instead of button clicks;
3. make backup, fallback text, and accessibility visible in the export flow;
4. consolidate the existing character concepts before adding cast portability;
5. ~~offer WorldKonstruct only at a genuinely relevant cast-success moment.~~
   **Superseded August 15, 2026:** close the copy gap so the product's public
   promise matches what it does, and make the owner's other products *findable*
   rather than *pitched*. The cast-success moment is not relevant to this
   audience — Section 11.6.

WordFokus remains a secondary drafting companion, relevant at the start of the
work rather than at the end of it. Neither paid products nor Ko-fi belong in
generated AO3 content.

## 2. Non-negotiable AO3 and product boundary

AO3 is a non-commercial archive. Treat every string that can travel into a work,
skin, image, transcript, README, or pasteable snippet as AO3-bound content.

Never insert any of the following into AO3-bound output:

- a paid-product recommendation;
- a Marketplace link;
- pricing or upgrade language;
- a Ko-fi or donation request;
- an affiliate or referral parameter;
- an email signup;
- a tracked URL; or
- hidden promotional text.

Relevant policy and product references:

- [AO3 Terms of Service](https://archiveofourown.org/tos)
- [AO3 Terms of Service FAQ](https://archiveofourown.org/tos_faq)
- [OTW commercial-promotion explainer](https://www.transformativeworks.org/tos-spotlight-commercial-promotion/)
- [AO3 skins and archive interface FAQ](https://archiveofourown.org/faq/skins-and-archive-interface)

### 2.1 Keep three concepts separate

1. **Fiction/safety label** — identifies a realistic-looking image as fictional.
   This is a safety feature.
2. **Free-tool attribution** — optional neutral credit for AO3 SkinGen. This is
   attribution, not a safety label.
3. **Commercial recommendation** — WorldKonstruct, WordFokus, Ko-fi, or any paid
   offer. This may appear only inside the standalone app or the owner's sites.

Do not use one control for all three. Removing optional tool attribution must not
remove a safety label, unlock a paid feature, lower export resolution, or alter
the user's scene.

### 2.2 Recommended attribution defaults

- For AO3-bound work-skin HTML: offer neutral credit as an unchecked option in
  the export dialog. Do not append it unconditionally.
- For PNGs: default a short fiction label on for realistic mockups and let the
  user edit or remove it after a clear warning. Offer tool attribution as a
  separate option.
- Keep commercial content out of both.
- The safest default is no linked credit. If the owner wants optional credit,
  use the plain tool name or create a dedicated, durable, commercial-neutral
  page such as `https://www.wordfokus.com/ao3skingen/made-with/`. That destination
  and every navigation element reachable from it must contain no paid-product,
  Marketplace, affiliate, or donation CTA.

This changes the current behavior. The work-skin generator currently appends
`made by wordfokus.com/ao3skingen` to every HTML export, while PNG attribution is
removed only by the unfinished Pro gate. The current `/ao3skingen/` hub contains
Ko-fi and commercial WordFokus links, so it is not an acceptable AO3-bound credit
destination under this plan. Remove the hardcoded URL before offering any new
credit option.

## 3. Repository truth at the original audit baseline

This section records `3990fba`, the baseline from which Releases 0–3 were
implemented. It explains why each requirement exists, but its “Current
implementation” column is **historical and now substantially wrong**. Two
revisions of work have landed on top of it.

Use the progress table, the "What changed" summary, and the module map in the
clean handoff above for the state at `c733066`. In particular, this table's rows
on scene state, character state, scene UX, image output, image upload, analytics,
monetization, and metadata all describe conditions that no longer hold. It is
kept because the *implication* column is still the reasoning behind the current
design, and deleting it would lose why the boundaries are where they are.

| Area | Current implementation | Implication |
| --- | --- | --- |
| Framework | Next.js 16 Pages Router with React 18; routes are [`src/pages/index.tsx`](src/pages/index.tsx) and [`src/pages/site-skin.tsx`](src/pages/site-skin.tsx) | Use `next/head` per route. Do not introduce App Router conventions into this work. |
| Scene state | One `SkinProject` with `id`, `template`, flat `settings`, and `messages` in [`src/lib/schema.ts`](src/lib/schema.ts) | Project portability can wrap this type, but imports need a stricter validator than the current localStorage loader. |
| Scene persistence | One project at `localStorage['ao3SkinProject']`, debounced by 500 ms, capped at 500 KB | Backup/import is P2. An IndexedDB project library is not the first step. |
| Site-skin state | Separate `SiteSkinTheme` and `localStorage['ao3SiteSkinTheme']` | Keep site-skin project files separate from scene project files. |
| Character state | Global library at `ao3skin_universal_characters`, project Twitter presets, group participants, primary identities in settings, and per-message Twitter overrides | There is no single cast yet. Consolidate types and collection rules before building interchange. |
| Scene UX | Platform/template picker, header identity field, message timeline, compose bar, live preview, People/Cast sheet, Settings sheet, fixed export bar | Do not add growth CTAs to the editor canvas or fixed bar. They belong after completion. |
| Image output | `Save Image` downloads a PNG; `Copy for AO3` renders, uploads to ImgBB, then opens an embed-code modal | The second label is misleading: it uploads before anything is copied. Rename and disclose it. |
| Real-text output | [`src/lib/workSkin.ts`](src/lib/workSkin.ts) builds validated single-platform and all-platform work skins from the same generator HTML/CSS | Do not build a parallel work-skin generator for a Publishing Kit. Reuse `buildWorkSkin` and `buildMasterWorkSkin`. |
| Skin-off/download behavior | Speaker attribution and reading order are already implemented and tested in [`tests/skin-off.spec.ts`](tests/skin-off.spec.ts) and [`tests/work-skin.unit.spec.ts`](tests/work-skin.unit.spec.ts) | Expose this strength in the UI; do not describe it as wholly unbuilt. |
| Site-skin output | 16 templates, one compiler used by preview and export, contrast warnings, and blocking AO3 lint | Instrument and improve the handoff; do not replace the compiler or create a second output path. |
| AO3 validation | Shared allowlist/linter in [`src/lib/siteSkin/ao3Css.ts`](src/lib/siteSkin/ao3Css.ts) | Keep this as the only CSS gate. Add a dated ruleset/version label rather than claiming permanent safety. |
| Image upload | Browser sends files and finished PNGs directly to ImgBB using `NEXT_PUBLIC_IMGBB_API_KEY` | Move this to a server-only API route and rotate the exposed key. |
| Image proxy | A Next API route already handles export-time CORS failures and has HTTPS/origin/size/rate checks | Harden the existing route. Do not create a second proxy. |
| Analytics | GA loads in `_document`; two successful image paths call `gtag` directly | Add a typed helper, route events, failures, copy completions, and content-safe parameters. |
| Monetization | An unfinished local-only Pro gate locks 4× output and watermark removal; the success modal shows Ko-fi and WordFokus together | Remove the fake Pro surface now. Replace the modal instead of repairing its counter alone. |
| Metadata | Root has no route `<Head>`; site-skin metadata is returned only after client hydration; manifest and HTML theme colors disagree | Add SSR-visible route metadata and make PWA values share one config. |
| Regression coverage | Extensive Playwright/unit coverage for AO3 readback, work skins, site skins, mobile, occlusion, image proxy, and accessibility labels | Extend this suite. Do not trade it for a new test stack. |
| Public source | `victorjaxen1/ao3-skin-generator-prod` is public and its `main` exactly matches local `3990fba`; the README says MIT, but there is no tracked `LICENSE` file | Treat licensing as incomplete, not as a private-repository decision. Add the intended license file and make Terms agree. |
| Public documentation | The GitHub README describes deleted components and export paths, says “no tracking,” and calls the browser-inlined ImgBB key publishable | README cleanup is a P0 trust task, not optional housekeeping. |

### 3.1 Original online ImgBB-key finding

The actual key in local `.env.local` was compared without printing it.

- It has **zero matches** in all Git commits reachable from the public GitHub
  `main` branch.
- `.env.local` has never been tracked in reachable history.
- Only the blank `.env.example` is present in Git.
- The exact key **is present** in the live production JavaScript bundle at the
  audit date.

This is expected from `NEXT_PUBLIC_IMGBB_API_KEY`: Next.js inlines
`NEXT_PUBLIC_` values into browser JavaScript at build time. The Git repository
did not leak the value; the deployment architecture did. Do not waste time
rewriting Git history for this key. Move upload server-side first, deploy, verify
the browser bundles no longer contain the value, and then rotate the old key.

Reference: [Next.js browser environment-variable bundling](https://nextjs.org/docs/pages/guides/environment-variables#bundling-environment-variables-for-the-browser).

### 3.2 Original public-web findings

As checked on 2026-08-12:

- `https://www.wordfokus.com/ao3skingen/` and the allowed-CSS article return 200,
  are indexable, and self-canonicalize.
- Neither URL appears in `https://www.wordfokus.com/page-sitemap.xml`. Treat that
  as a specific WordPress/Rank Math configuration issue, not a generic SEO task.
- `https://ao3skingen.wordfokus.com/` is still live, indexable, and
  self-canonical. It duplicates the product surface and retains stale claims,
  including “Your Data Never Leaves Your Browser” and an unsupported user count.
- The Netlify app root and `/site-skin` return no useful route title, canonical,
  or robots metadata in the initial HTML. Client-only metadata is insufficient
  for this app's public entry routes.
- WordFokus has a live Google Workspace Marketplace product with a real install
  base and paid features. It is a commercial destination, not neutral tool help.
- No public indexed WorldKonstruct destination or interchange schema was found.
  Do not invent either in product copy; require the owner inputs in Section 6.
  **Half closed on August 15, 2026:** the destination exists and was supplied —
  a live Marketplace add-on at `https://app.wordfokus.com/worldkonstruct`. The
  audit simply had not found it. No interchange schema exists, and per Section
  11.6 none is now planned.

Recheck all six observations immediately before domain or content work. Search
indexes, sitemaps, redirects, and Marketplace listings are mutable external state.

Status of these six on August 15, 2026: the fourth is **closed** — both app
routes now serve title, canonical, and `robots` in the initial HTML, confirmed
against production. The third is closed in substance: the legacy landing is the
deliberate SwipePages surface now, and the "never leaves your browser" claim was
removed from every page checked. The rest were not re-audited except the hub
link, which is still stale.

### 3.3 Original AO3 compatibility snapshot

The current `otwcode/otwarchive` `master` allowlist was compared directly with
[`AO3_PROPERTIES`](src/lib/siteSkin/ao3Css.ts) on 2026-08-12:

- upstream `SUPPORTED_CSS_PROPERTIES`: 182 entries;
- local `AO3_PROPERTIES`: 181 entries;
- missing locally: `aspect-ratio`;
- extra locally: none;
- upstream and local shorthand lists: 20 entries and an exact match.

This is conservative drift: the app can reject a property AO3 currently permits.
It does not prove that existing generated exports are broken. Sync the missing
property through a reviewed change, record upstream commit
`cf1d7f997047eaca14370985dafd156a91696313`, and add a repeatable drift check.
Never download an allowlist dynamically at runtime or silently update it during
a production build.

**Closed.** `npm run audit:ao3-css` re-run on August 15, 2026 reports
`properties: local=182 upstream=182` and `shorthands: local=20 upstream=20`, with
nothing missing and nothing extra in either direction, against the same pinned
commit. `aspect-ratio` was synced, the review date and upstream commit live in
[`src/lib/ao3Compatibility.ts`](src/lib/ao3Compatibility.ts), and the audit is a
developer-invoked script that no build or test depends on. The remaining known
divergence is the opposite kind and is deliberate: our lint refuses 8-digit hex
where AO3 accepts it by accident, which violates the site skin's "never be
stricter than AO3" invariant but cannot bite while no template emits alpha
colours.

### 3.4 Existing behavior that must be preserved

- The platform picker is the first-visit experience.
- Returning users skip the picker only when a real saved project exists.
- Replacing work from the picker asks for confirmation.
- Mobile has a collapsible live preview and still renders an off-screen capture
  target when collapsed.
- The fixed export bar publishes its measured height through `--export-bar-h` so
  it does not cover the composer.
- The work-skin export and preview derive from the existing generator functions.
- The master skin contains all four platforms and light/dark variants.
- AO3 export CSS has comments removed intentionally; do not restore them without
  a real AO3 save/readback test.
- The site-skin preview and copied CSS use the exact same `compile(theme)` result.
- Clipboard failure always leaves selectable text and a manual-copy instruction.
- A failed local save is visible to the user.

Added since, and each pinned by a test that exists because breaking it produced a
real defect:

- **Scene identities are canonical, and names are never identity keys.** Two
  characters may share a display name and stay distinct. A rename or avatar
  change must reach every message that identity already speaks in. Preview, AO3
  HTML, work skin, skin-off, and transcript all resolve through the one resolver
  in `identity.ts`, so every output agrees by construction.
- **A referenced identity is archived or explicitly reassigned, never silently
  deleted.**
- **Library entries are copied into a scene, not linked.** Scene edits never
  write back to the library, and two projects seeded from one library entry stay
  independent.
- **iOS and WhatsApp fields stay separate even where their shapes match.** A
  shared type is one refactor away from a shared renderer, and the platforms
  agree on almost nothing except what a URL looks like. Tests assert neither
  platform's markup can contain the other's class prefix.
- **Run grouping compares a resolved speaker key, not message direction.**
  Comparing direction alone merged two different group speakers into one visual
  run.
- **Any value that must survive AO3 is a finite enum compiled to a class**, never
  a free value emitted as an inline `style`.
- **Static output carries no native players.** Preview, Save PNG, and the ImgBB
  upload keep a linked poster card; only AO3 Work Text gets `<audio>`, `<video>`,
  and the privacy-enhanced YouTube embed.
- **Media discriminators are never guessed** on import or on local recovery.
- **`!important` never lands on a site-skin selector that can appear inside an
  author's work.** Six selectors are enumerated in a test.
- **One committed message model, one transient editor draft.** The extras editor
  is the only UI that edits structured content, and it is shared by the composer
  and the timeline. A second draft model competing with the editor is exactly
  what the iOS rebuild removed.
- **A reply always comes after its target**, enforced on add, move, and delete.

### 3.5 Incorrect or incomplete assumptions in the previous plan

- Work-skin generation, CSS validation, an all-platform master skin, meaningful
  no-skin output, and mobile preview are already built.
- “Successful publishing” cannot be observed. The app can measure an AO3-ready
  handoff, not whether the user actually published on AO3.
- A full ZIP Publishing Kit is not required to improve activation and would
  reintroduce archive/dependency complexity that this project intentionally
  removed.
- The cast is not simply `UniversalCharacter[]`; identities are distributed
  across five data sources.
- The existing image proxy is not absent, but it is also not fully SSRF-safe.
- Fixing the donation counter is insufficient. The current success modal fires
  before some actions are complete, makes unsupported time-saved claims, and
  presents two unrelated promotions together.
- ~~A generic post-export WorldKonstruct card is less relevant than a cast-export
  success card.~~ True, and beside the point: Section 11.6 finds that *neither*
  is relevant to an author who has finished writing. This bullet corrected the
  placement of an offer whose audience was never checked.
- Site skins do not need an ebook preview. Ebook/no-skin fallback belongs to work
  content, not a personal AO3 interface theme.

## 4. Target experience

### 4.1 First visit

Keep the current picker structure. Change the positioning copy from:

> Fake screenshots for your fanfics

to:

> Social-media scenes for AO3 — export as an image or accessible real text.

Use a truthful privacy line near the footer:

> No account required. Editable text and settings stay in this browser. Hosted
> image features upload only when you choose them.

Do not put WorldKonstruct, WordFokus, Ko-fi, an email form, or a pricing card on
the picker. The first decision should remain “what do I want to make?”

### 4.2 Editing

Preserve the current editor hierarchy:

```text
workspace header
  -> message/result editor
  -> live preview
  -> compose action
  -> fixed export bar
```

The editor's job is rapid feedback. Growth elements, backup reminders, and
publishing explanations must not occlude the composer or compete with the live
preview.

Add one accessible overflow menu to the workspace header for project-level
actions:

- Back up project
- Import project
- Start a new project
- Privacy and data use

Do not add four more header icons. Implement a controlled `ProjectMenu` and test
it at mobile widths.

**What shipped instead, and why it is acceptable.** There is no `ProjectMenu`.
[`WorkspaceHeader`](src/components/WorkspaceHeader.tsx) takes four explicit
callbacks — `onSettingsOpen`, `onCastOpen`, `onIdentityOpen`, `onBackupOpen` —
so the header carries direct controls rather than one overflow. The identity work
made that a deliberate choice: its central finding was that a person should be
editable *from wherever that person is visible*, and burying identity one level
down inside an overflow menu works against that. Backup and import live behind
`onBackupOpen`; privacy choices are reached through the application event from
the export bar rather than the header.

The constraint the original wording was protecting still holds and is still
enforced: the header must not grow further, and every control must remain
reachable and non-occluding at narrow mobile widths. If a fifth project-level
action is ever needed, build the overflow menu then — not before.

### 4.3 Export choices

Keep the current three-path model, but make every label state what happens:

| Current | Revised label | Behavior |
| --- | --- | --- |
| Save Image | Save PNG | Renders locally and triggers a file download. No network upload. |
| Copy for AO3 | Get AO3 image code | Shows the hosted-upload disclosure, uploads the rendered scene, then displays embed HTML. |
| Work skin | Accessible work skin | Opens CSS + HTML handoff with fallback preview and validation status. |

The quality chip may remain in the fixed bar after Pro is removed. Offer only
the resolutions that are reliable on low-memory mobile devices. Do not show a
locked choice for a product that cannot be purchased.

**Shipped.** All three revised labels are live in
[`ExportPanel.tsx`](src/components/ExportPanel.tsx), including the accessible
names, and the help text beside them states the network behaviour of each path in
one line — "Nothing is uploaded", "Visible story text is included in that
upload", "Two pastes, one on your AO3 preferences page". Preserve that pairing:
the label says what the button does, and the line under it says what leaves the
device.

### 4.4 Completion moments

Delete the generic success modal. Each output already has its own natural place
to confirm completion.

- **Save PNG:** show a toast after the browser download is triggered. Offer
  transcript/alt-text actions from the image export disclosure or a small
  non-modal completion panel.
- **Hosted AO3 image:** render/upload first; call it ready only after upload
  succeeds. Mark the handoff complete only after the embed code is copied.
- **Work skin:** show a two-item checklist. Complete only after valid CSS and HTML
  have both been copied in the current modal session.
- **Site skin:** complete only after valid CSS is copied.
- **Project backup:** complete after the file download is triggered.
- **Cast exchange:** complete after the cast file download is triggered.

Never say “Code copied” when the user has only generated it. Never claim an
exact number of hours saved without defensible research.

### 4.5 Post-success next step

At most one next-step card may be visible after a completion event. Centralize
the decision in a pure function instead of scattering conditions through
components.

Priority:

1. finish the current AO3 handoff;
2. fix a validation/accessibility problem;
3. back up the project;
4. ~~cast portability/WorldKonstruct, but only after cast export;~~ **removed
   August 15, 2026 — Section 11.6.** No commercial step belongs in a
   completion-triggered card at all; product visibility is permanent and quiet
   instead;
5. ~~WordFokus, but only in a drafting context;~~ **survives, but not here.** It
   belongs on a *return* visit or "start another scene", which is Section 11.6
   Tier 4 and not a post-completion next step;
6. compatibility-alert signup;
7. ~~Ko-fi.~~ **Deferred indefinitely**, per Section 11.6's "what stays dead".

The surviving priority is therefore steps 1, 2, 3, and 6 — which is close to the
product-neutral `NextStep` union that actually shipped, and is the second time
that union has turned out to be right where this section was wrong.

Recommended implementation:

```ts
type NextStep =
  | 'finish_handoff'
  | 'fix_preflight'
  | 'backup_project'
  | 'worldkonstruct'
  | 'wordfokus'
  | 'compatibility_alerts'
  | 'kofi'
  | null;

function chooseNextStep(context: NextStepContext): NextStep;
```

Unit-test every priority collision. A card being eligible does not mean it must
be shown.

**Status: not built, and the reserved type does not match this design.** There is
no `chooseNextStep` and no arbiter module. The `NextStep` union that actually
exists in [`src/lib/analytics.ts`](src/lib/analytics.ts) is:

```ts
type NextStep = 'make_another' | 'build_site_skin' | 'read_guide' | 'back_up_project';
```

Four product-neutral steps, with no `worldkonstruct`, `wordfokus`, `kofi`,
`finish_handoff`, or `fix_preflight` member — and `next_step_shown` is fired
nowhere. That is a defensible position rather than an oversight: it reserves
measurement for the steps that help the writer and declines to reserve any for
the commercial ones. Two consequences for whoever builds this:

1. **The union above is the contract to extend, not the one in the code block
   further up this section.** Adding a member is a deliberate product decision,
   and adding `kofi` or `worldkonstruct` re-opens every Section 2 question.
2. **Build the arbiter before the second card, not before the first.** With no
   card shown anywhere today, a pure priority function has nothing to arbitrate.
   The rule it protects — at most one next-step surface after a completion — is
   currently satisfied by there being none.

## 5. Measurement model

### 5.1 North-star metric

Use **weekly AO3-ready handoffs**, not “successful publishing kits.”

Count one handoff when one of these exact conditions occurs:

- `hosted_image`: hosted embed HTML was copied after a successful upload;
- `work_skin`: valid CSS and matching HTML were both copied in one export
  session;
- `site_skin`: valid site-skin CSS was copied.

Track local PNG downloads separately. They are useful outcomes but are not
necessarily AO3-ready publishing handoffs.

Do not claim that a handoff was published. The app has no AO3 integration and
should not add one.

### 5.2 Activation

Fire `project_activated` once per browser-local project when meaningful author
work first exists:

- chat: the user creates or materially edits two messages;
- Twitter: one tweet plus a non-placeholder identity;
- Google: a non-placeholder query plus one result;
- site skin: a template value is changed and previewed.

Do not count seeded example content until the user edits it. Do not use the
current `default-project` string as an analytics identity; every blank project
currently shares it. Generate a local project UUID with `crypto.randomUUID()`
and never send that UUID to analytics. The UUID exists only to deduplicate local
activation and migrations.

**Shipped on August 15, 2026.** The UUID half was already done: `defaultProject()`
in [`src/lib/schema.ts`](src/lib/schema.ts) calls `localProjectId()`, which uses
`crypto.randomUUID()` with a non-crypto local fallback, and the shared
`default-project` string is gone. The event half now exists in
[`src/lib/activation.ts`](src/lib/activation.ts), as this section asked: a pure
function beside the platform models, so all four platforms answer the question
the same way, with the seeded-example case unit-tested explicitly for each of the
four platforms.

The one decision the platform rebuilds forced was taken as anticipated — the
definitions above predate structured content, so a message that gains a reply, an
image collage, a link card, media, or a reaction counts as material work. See
"Closed later on August 15" near the top of this document for the four
implementation decisions worth knowing, including the one that is not obvious:
automatic delivery-status changes are excluded from the fingerprint, because
`appendChatMessage` advances earlier messages to `read` and would otherwise let a
single new message clear the two-message threshold by itself.

### 5.3 Typed content-free analytics

**Shipped.** [`src/lib/analytics.ts`](src/lib/analytics.ts) exists, is the only
module that calls `gtag`, and implements every rule in this section: SSR/test/
opt-out short-circuits, per-event key allowlists, enumerated template ids, output
types, error codes and placements, referrer reduced to an origin, and consent
that defaults to off and can be revoked. The union below is accurate as shipped
except for the `NextStep` member, which is narrower than Section 4.5 proposed —
see that section.

Three things to know before extending it, all learned the hard way:

- **`analyticsPayload` rejects the whole event on any unknown value.** That is
  correct behaviour at a content boundary and it is also why the five missing
  example ids silently erased `template_selected` for the newest examples. Adding
  an enumerated value is part of adding the feature, not follow-up work — and
  since August 15 a test enforces it, so the omission fails loudly instead of
  going quiet in production.
- **Declaring a union member is not instrumentation.** Five of the sixteen
  members — `next_step_shown`, `product_cta_clicked`, `donation_clicked`,
  `cast_exported`, `cast_imported` — are still fired nowhere. Do not read the
  union as a description of what is measured. `project_activated` left this list
  on August 15; `cast_exported`/`cast_imported` are unlikely to leave it, given
  Section 11.6.
- **Export events send `project.template`, not the example id.** So the funnel
  from `export_started` onward is platform-level and complete; only the
  starter-example entry point has the gap.

The original specification follows, and remains the contract:

Create `src/lib/analytics.ts`. It is the only module
allowed to call `gtag`.

```ts
type OutputType = 'png' | 'hosted_image' | 'work_skin' | 'site_skin';

type AnalyticsEvent =
  | { name: 'tool_viewed'; tool: 'scene_builder' | 'site_skin' }
  | { name: 'template_selected'; templateId: string }
  | { name: 'project_activated'; templateId: string }
  | { name: 'export_started'; outputType: OutputType; templateId: string }
  | { name: 'export_ready'; outputType: OutputType; templateId: string }
  | { name: 'output_copied'; outputType: Exclude<OutputType, 'png'>; part: 'embed' | 'css' | 'html' }
  | { name: 'handoff_completed'; outputType: Exclude<OutputType, 'png'>; templateId: string }
  | { name: 'export_failed'; outputType: OutputType; errorCode: ExportErrorCode }
  | { name: 'fallback_preview_opened'; templateId: string }
  | { name: 'project_backup_exported'; schemaVersion: number }
  | { name: 'project_backup_imported'; schemaVersion: number }
  | { name: 'cast_exported'; characterCountBucket: CountBucket; includesAvatarUrls: boolean }
  | { name: 'cast_imported'; characterCountBucket: CountBucket }
  | { name: 'next_step_shown'; nextStep: Exclude<NextStep, null>; placement: string }
  | { name: 'product_cta_clicked'; product: 'worldkonstruct' | 'wordfokus'; placement: string }
  | { name: 'donation_clicked'; placement: string };
```

The helper must:

- return immediately during SSR, tests, opt-out, or missing GA configuration;
- allow only enumerated keys per event;
- reject or omit unknown values;
- never accept a raw `Error` object;
- never accept arbitrary strings for template, placement, or error code;
- never throw into the product flow; and
- be unit-tested with a fake `window.gtag`.

Never send:

- dialogue, search queries, character names, handles, or notes;
- project IDs or titles;
- CSS, HTML, transcripts, or alt text;
- pasted URLs, image URLs, filenames, or provider responses;
- raw exception messages; or
- complete referrer URLs with query strings.

### 5.4 Safe error codes

Use one shared error union:

```text
IMAGE_UPLOAD_TIMEOUT
IMAGE_UPLOAD_PROVIDER_ERROR
IMAGE_UPLOAD_RATE_LIMITED
IMAGE_TOO_LARGE
UNSUPPORTED_IMAGE_TYPE
REMOTE_IMAGE_BLOCKED
REMOTE_IMAGE_NOT_FOUND
REMOTE_IMAGE_TOO_LARGE
EXPORT_RENDER_FAILED
DOWNLOAD_TRIGGER_FAILED
CLIPBOARD_DENIED
CSS_VALIDATION_BLOCKED
PROJECT_IMPORT_INVALID
PROJECT_SCHEMA_UNSUPPORTED
PROJECT_IMPORT_TOO_LARGE
LOCAL_STORAGE_UNAVAILABLE
```

Map provider/network errors to these at the boundary. UI may show a safe fixed
explanation. Analytics receives only the code.

## 6. Decisions the owner must make

These are product or external-system decisions. A developer must not guess.

| Decision | Current owner/product decision | Status / blocks |
| --- | --- | --- |
| Canonical domains | SwipePages landing at `ao3skingen.wordfokus.com`; app at `app.ao3skingen.wordfokus.com`; WordPress remains an additional product/guide hub | **Decided and deployed.** Re-verified August 15, 2026: app SSR canonical/robots, landing, and the Netlify 301 are all correct. **The WordPress hub still links `ao3skingen.netlify.app`**, not the branded app, and sitemap/Search Console verification is still outstanding. |
| Source license | **Source-available, all rights reserved.** The code stays publicly readable so visitors can verify the privacy claim; no copying, forking, or reuse is granted | **Decided August 15, 2026.** A tracked `LICENSE` now exists and the README agrees with it — which was the original defect: the two disagreed, and the README claimed MIT rights that no licence granted. The file is explicit that it covers the source only and makes no claim over anything an author creates with the tool. Do not reintroduce an MIT claim. |
| AO3SkinGen Pro | Keep the core publishing utility free; remove the unfinished local activation path | **Decided and complete.** The Pro components and local license helper are deleted. |
| Attribution | Separate default-on editable fiction label from optional neutral, unlinked tool credit | **Decided and complete in code**, and now pinned by a master-skin unit test that credit stays off by default and is added at most once. **Still open:** `public/content-policy.html` describes a watermark in three places, confirmed live on August 15. |
| Hosted image provider | Keep ImgBB behind the same-origin server route | **Decided and deployed.** Re-verified August 15: no live bundle contains `api.imgbb.com`. Durable shared abuse/budget storage remains optional follow-up. |
| Analytics consent/opt-out | Analytics remains off until explicit opt-in; the visitor can reopen Privacy choices and deny later | **Implemented.** Qualified legal review remains an owner responsibility. |
| WorldKonstruct contract | **Withdrawn August 15, 2026.** No cast bridge; product visibility is handled by the Section 11.6 tiers instead | **No longer an open decision, and no longer a blocker.** The four inputs previously requested are moot because the bridge is not being built — the constraint was never the contract, it was the audience. Reopening this needs a counter-argument to Section 11.6, not the missing repository details. |
| Product visibility | Discovery on owned surfaces and a permanent quiet in-app presence; no completion-timed commercial card | **Decided August 15, 2026 (Section 11.6).** Tiers 1 and 2 are unblocked and need no owner input beyond the copy itself. **Tier 3 is now unblocked too** — the owner supplied `https://app.wordfokus.com/worldkonstruct`, so the redirect has a destination. Tier 4 still needs Tier 3's data first. |
| WorldKonstruct destination | `https://app.wordfokus.com/worldkonstruct` — a live Google Docs add-on, freemium with paid features | **Supplied August 15, 2026.** Verified against its Marketplace listing the same day. Treat as a commercial destination under Section 2: owner surfaces and in-app only, never in AO3-bound output. |
| Structured media in AO3 output | Work Text emits narrowly generated `<audio>`, `<video>`, and privacy-enhanced YouTube embeds; static output keeps a linked poster card; the app never touches media bytes | **Decided and shipped**, across three platforms. What is *not* decided is how the privacy copy describes it. A reader of a published work now makes third-party requests the author chose; Section 7.4's disclosure predates this and must be extended. |
| Google Search platform | Left as a mockup while the other three became authoring tools | **Open, and deliberately unhurried.** Google is the least like the others — no identities, no cast, no reply model — so parity is not automatically the goal. Decide from demand, not symmetry. |
| Blank Twitter project | Whether a blank Twitter project should prompt for primary-account creation instead of synthesizing a default `User` | **Open, polish only.** Migration always supplies a primary account, so nothing is incorrect today. Recorded in the identity plan §11.7 item 4. |
| iMessage header chrome | Build a finite `iosHeaderTone` enum compiled to a class; keep the CSS-drawn header as the default; do **not** restore a remote image default | **Decided August 15, 2026.** Raised as "the header lost its background image and looks grey". Grey is correct for modern iMessage, and AO3 hosts no images, so an image is always a permanent hotlink — Learning 18. A tint costs no network request, survives skin-off and EPUB, and cannot break when a host dies. Spec in [`docs/RENDER-DEFECTS-AND-GALLERY-HANDOFF.md`](docs/RENDER-DEFECTS-AND-GALLERY-HANDOFF.md) §3.3. Needs schema v8, so close the outstanding v7 read-back gate first. |

Record these answers in this document or an ADR before the relevant PR.

At the audit date, WordFokus has a live Marketplace listing with free and paid
features, so it is unquestionably a commercial destination. That remains true and
still governs where it may appear. **WorldKonstruct is the same kind of
destination**, confirmed on August 15, 2026 against its Marketplace listing:
a freemium Google Docs add-on with paid features and optional AI. Both are
commercial, both are welcome on owner surfaces and inside the application, and
neither may reach AO3-bound output.

~~The owner must provide the WorldKonstruct repository, destination URL, current
product status, and import constraints before the developer treats that bridge as
real.~~ **Superseded August 15, 2026:** those four inputs are no longer requested,
because the bridge is not being built. An owned redirect destination is still
needed for Section 11.6 Tier 3, but that is a URL, not a contract.

## 7. Release 0 — trust and baseline cleanup

This is the first code release. Keep it small enough to review.

**Implementation status: 95% — substantially shipped.** The deleted Pro and
generic-success paths must stay deleted. Commit evidence: `f20d0bd`.

Both items that were open on the morning of August 15 closed the same afternoon:

- **Source licence.** A tracked `LICENSE` exists: source-available, all rights
  reserved. The code stays publicly readable because that readability is what
  backs the "editable project stays in this browser" claim; nothing else is
  granted. It states explicitly that it covers the source only and makes no claim
  over an author's scenes, dialogue, images, or generated output. The README's
  "Source license status" section was rewritten to agree, which was the actual
  original defect — the README claimed MIT rights that no licence file granted.
- **Content-policy language.** Every watermark reference is gone. The page now
  describes what the product does: an editable "Fictional scene" label on by
  default, and credit to AO3 SkinGen as a **separate** opt-in that is off unless
  the author turns it on — the two-control separation Section 2.1 requires. The
  unsupported "1,200+ AO3 writers" claim was removed from both hub files in the
  same pass, and no `never leaves your browser` variant survives anywhere.

One trap worth recording, because it was nearly shipped. The first replacement
for the user-count claim read "Your Work Stays In Your Browser" — which is the
same overbroad claim Section 3.2 had already stripped once, and it is false: the
hosted-image path uploads a rendered scene by design. The wording that is both
true and already live on the SwipePages landing is **"Your editable project stays
in this browser"**. All surfaces now say that. Do not shorten it.

What remains is content, not engineering: the SwipePages landing must be updated
by hand from [`docs/LANDING-COPY-2026-08.md`](docs/LANDING-COPY-2026-08.md), and
the privacy policy and Terms have not been re-read against the current product.

### 7.1 Preserve the working tree

At the time of this revision, the repository contains owner changes and
untracked assets/docs. Do not reset, clean, or overwrite unrelated files.

Before each PR:

```text
git status --short
npm run build
npx playwright test --project=desktop tests/work-skin.unit.spec.ts tests/site-skin.unit.spec.ts
```

Add stable package scripts so the next developer does not have to know hidden
commands:

```json
{
  "scripts": {
    "test": "playwright test",
    "test:unit": "playwright test --project=desktop tests/*.unit.spec.ts",
    "test:smoke": "playwright test --project=desktop tests/landing.spec.ts tests/work-skin.spec.ts tests/site-skin.spec.ts",
    "typecheck": "tsc --noEmit"
  }
}
```

Adjust the unit glob for Windows if Playwright does not expand it consistently.

**Shipped, and the glob problem was solved better than proposed.** `package.json`
now defines `test:unit` as `playwright test --project=unit`, backed by a real
`unit` project in `playwright.config.ts` with `testMatch: '**/*.unit.spec.ts'`.
That removes the shell-expansion question entirely and runs the suite with no
browser and no server. `lint` and `audit:ao3-css` were added alongside. Use the
`package.json` in the repository as the source of truth, not the block above.

### 7.2 Remove the unfinished Pro path

Current problem:

- `src/lib/proFeatures.ts` treated a localStorage flag as
  a license;
- any key beginning with `AO3PRO-` can activate it in code;
- the purchase UI says purchases are “coming soon”;
- 4× export and watermark removal are still presented as locked features.

Required work:

1. Remove `ProUpgradeModal` from [`src/components/ExportPanel.tsx`](src/components/ExportPanel.tsx).
2. Remove the locked 4× row and any upgrade button.
3. Replace `skipWatermark`/`getProFeatures()` with explicit fiction-label and
   optional-attribution settings.
4. Delete `src/components/ProUpgradeModal.tsx` and `src/lib/proFeatures.ts` once
   no imports remain.
5. Remove Pro claims from Terms, privacy copy, metadata, and tests if present.
6. Leave reliable 1×/2× export available. Add 4× for everyone only if memory
   tests pass on mobile; otherwise omit it.
7. Remove the unconditional `wordfokus.com/ao3skingen` credit from generated
   work-skin HTML. Update the tests that currently require it. If optional plain
   tool-name credit is added, test both enabled and disabled output explicitly.

Acceptance:

- no non-purchasable upgrade is visible;
- no localStorage string can unlock a product;
- no required safety label is tied to payment;
- all existing PNG/work-skin regressions pass.

### 7.3 Replace the generic success modal

Remove `src/components/SuccessModal.tsx` and `src/lib/donationPrompt.ts` from the
export path.

Do not merely fix the off-by-one. Today `recordExport()` increments before
`shouldShowDonationModal()` checks its milestones, so the documented “third
export” fires on the second. More importantly, hosted code is called “copied”
before the user presses Copy, and the modal shows Ko-fi, WordFokus, and sharing
together.

Reintroduce a donation prompt later through the central next-step arbiter, based
on completed handoffs, with a seven-day cooldown and permanent dismissal.

### 7.4 Correct public copy

Update [`src/components/PlatformPicker.tsx`](src/components/PlatformPicker.tsx),
[`public/privacy-policy.html`](public/privacy-policy.html),
[`public/terms-of-service.html`](public/terms-of-service.html), and the owned web
pages.

Use this technical disclosure as the source of truth:

> Editable project text and settings are stored in your browser. Pasted image
> addresses are requested from their host for preview and may be sent to our
> image proxy when an export needs them. If you upload a file, that file is sent
> to our image-upload service and ImgBB. If you choose hosted AO3 image code, the
> finished rendered scene — including any visible story text — is uploaded to
> ImgBB. Content-free analytics may record which tool and export type were used,
> but not story text, names, handles, image addresses, or generated code.

Do not say “your data never leaves your browser.” Do not describe the finished
rendered scene as though it contains no creative content.

**This disclosure is now incomplete, and updating it is item 4 on the next-work
list.** It was written before structured media existed. Three sentences are
missing, and all three describe the reader's browser rather than the author's:

> Link cards, voice messages, and videos are stored as web addresses. AO3 SkinGen
> never downloads, copies, or re-hosts those files. When someone reads your
> posted work, their browser requests them directly from whoever hosts them — so
> if that host removes the file or goes away, the work loses it, and AO3 keeps no
> copy.

The same paragraph should say plainly that a YouTube embed uses the
privacy-enhanced domain, and that preflight warns before export when a scene
depends on a host that is likely to expire. The good news is that the *behaviour*
already satisfies the strictest reading of Section 2: the app touches no media
byte, so there is nothing here to disclose except what the author chose. Say it
before an author discovers it from a broken chapter.

Resolve the current conflict between a public repository whose README says MIT
and Terms that forbid reverse engineering, code extraction, redistribution, and
derivative works. A README sentence is not a substitute for a license grant.

Preferred resolution:

1. add the standard MIT license text as a root `LICENSE` file with the correct
   copyright holder and year;
2. keep the open-source claim;
3. rewrite Terms so they do not take away permissions the MIT license grants;
4. distinguish the source-code license from trademarks, hosted service rules,
   third-party assets, and user output.

If the owner does not intend to grant an open-source license, remove “MIT” and
“open source” from the public README and app, and use:

> Free, browser-based, and no account required.

Also rewrite the public GitHub README from the current code. It describes deleted
Cloudinary/Imgur/ZIP modules, virtual scrolling and editor components that are no
longer present; says there is no tracking even though GA is configured; and
documents the public browser key as an intentional production setup. A new
developer must not implement stale README claims back into the app.

### 7.5 Make validation claims precise

Change permanent-sounding `AO3-safe` claims to dated compatibility language:

> Passes the bundled AO3 CSS checks · rules reviewed YYYY-MM-DD

On a blocked export:

> This generated CSS fails the bundled AO3 checks. That is a generator bug, not
> something you entered.

Keep the blocking behavior. Add the allowlist review date and generator version
to a single config, not scattered JSX.

### 7.6 Sync and pin the AO3 CSS ruleset

Update the canonical list in
[`src/lib/siteSkin/ao3Css.ts`](src/lib/siteSkin/ao3Css.ts) to include
`aspect-ratio`. In the same PR:

1. record the upstream `otwcode/otwarchive` commit and review date beside the
   vendored rules;
2. add a script or fixture-based test that compares the local property and
   shorthand sets with a deliberately refreshed upstream snapshot;
3. make drift output list missing and extra values, not just counts;
4. require human review before changing the vendored list; and
5. run the existing site-skin and AO3 readback tests.

The check may fetch upstream only when a developer explicitly invokes a sync or
audit command. Tests and production builds must remain deterministic and must
not depend on GitHub availability.

## 8. Release 1 — secure image handling

This release preceded growth instrumentation because the key was public at the
original baseline and hosted image export sends the whole rendered scene off-
device.

**Implementation status: 95% — shipped with documented serverless limits.**
The credential is server-only, uploads require explicit action/consent, the
proxy is hardened, CSP is narrowed, and production uploads have been exercised.
The per-IP and daily counters are intentionally warm-instance memory, so they
reset on cold starts. Add a shared durable limiter only when traffic, cost, or
abuse evidence justifies the dependency. Commit evidence: `f20d0bd`.

Re-verified August 15, 2026: no live application bundle contains
`api.imgbb.com`, which is the standing check this release asked for. Keep running
it after any deploy that touches upload code.

The platform work added a second class of remote reference that this release's
threat model did not anticipate, and it is worth being precise about why it needs
no new server code. Structured media stores **addresses only**. Nothing fetches
them: not the browser during authoring, not the proxy, not the upload route. They
are validated as absolute HTTPS URLs with known hosts and MIME types, then
emitted into AO3 Work Text for the *reader's* browser to resolve. The relevant
defect risk is therefore permanence and privacy in the published work, not SSRF
or credential exposure here — which is why the mitigation lives in preflight
warnings and public copy rather than in `/api/*`. Two related hardening changes
already shipped in the same spirit: `iosHeaderImageUrl` and `iosFooterImageUrl`
default to empty, so an ordinary work makes no third-party request for decoration
the CSS can draw itself.

### 8.1 Server-side upload route

Add `src/pages/api/image-upload.ts`. Change
[`src/lib/imgbb.ts`](src/lib/imgbb.ts) into a same-origin client for that route.

Target flow:

```text
explicit user action
  -> first-use hosted-image disclosure
  -> POST image bytes to /api/image-upload
  -> validate origin, size, declared type, and magic bytes
  -> server posts to ImgBB using IMGBB_API_KEY
  -> return only the public display URL and a fixed provider result shape
```

Requirements:

- use server-only `IMGBB_API_KEY`; remove `NEXT_PUBLIC_IMGBB_API_KEY`;
- rotate the exposed production key after the new route deploys;
- disable the default body parser and enforce a streaming byte limit, or use a
  deliberately selected multipart parser with its own limit;
- allow only PNG, JPEG, WebP, and GIF if all four are actually supported;
- reject SVG regardless of declared MIME type;
- verify magic bytes, not filename or header alone;
- cap selected-file uploads and finished-render uploads separately;
- accept only same-site requests and known production origins;
- use a short provider timeout and bounded retry policy;
- implement a durable rate/budget limit where possible; document that the
  existing in-memory limit resets on serverless cold starts;
- add a daily kill switch or budget threshold;
- never return the provider's raw response or secret;
- never log image bytes, base64, filenames, URLs, or provider deletion tokens;
- return fixed error codes and safe user messages.

Update [`.env.example`](.env.example) and [`netlify.toml`](netlify.toml). Do not
print or commit `.env.local`.

### 8.2 Upload consent UX

[`src/components/ImageUrlInput.tsx`](src/components/ImageUrlInput.tsx) currently
uploads immediately after a file is selected. Change it so the first file stays
local until the user accepts:

> This file will be uploaded to ImgBB and will be publicly accessible to anyone
> with its link. Do not upload private material or images you do not have the
> right to use.

The hosted-scene action needs a more specific disclosure:

> To create AO3 image code, the finished scene image — including its visible
> text — will be uploaded to ImgBB. AO3 links to that hosted file and does not
> keep its own copy. Save a local PNG as a backup.

Remember acknowledgement locally, but keep a short disclosure beside every
hosted action. “Get AO3 image code” itself is the final explicit action; merely
opening the export UI must not upload.

### 8.3 Harden the existing image proxy

Extend [`src/pages/api/image-proxy.ts`](src/pages/api/image-proxy.ts). It already
checks method, origin, HTTPS, several literal private hosts, response MIME, byte
size, and a warm-instance rate limit. It still needs:

- DNS resolution before each request and rejection of private, loopback,
  link-local, multicast, reserved, and metadata-service IP ranges;
- explicit handling of IPv4-mapped IPv6;
- `redirect: 'manual'`, a maximum redirect count, and full validation of every
  redirect target and resolved address;
- rejection of arbitrary ports;
- connection/read timeout with `AbortController`;
- streaming response limits so a missing/false `Content-Length` cannot allocate
  an unbounded buffer;
- magic-byte validation and explicit SVG rejection;
- no raw network exception text returned to the browser;
- no user URL in logs or analytics.

The special Pinterest resolver currently follows redirects and fetches HTML
outside the main safe-fetch path. Either route it through the same validated
redirect/DNS helper or remove the special case until it can be safe. Do not leave
a privileged bypass.

### 8.4 Narrow CSP after upload migration

Once direct browser-to-ImgBB upload is gone, change `connect-src` in
[`next.config.js`](next.config.js) from all HTTPS origins to:

```text
'self' https://www.googletagmanager.com https://www.google-analytics.com
```

Keep broad `img-src https:` only because users may paste remote image addresses.
Broad image loading does not require broad scripts or connections.

Reconcile [`netlify.toml`](netlify.toml) with `next.config.js`; Next's response
headers are the effective source in the current Netlify deployment. Preserve
`frame-ancestors 'none'`, `object-src 'none'`, and `base-uri 'self'`.

### 8.5 Security tests

Extend [`tests/image-proxy.spec.ts`](tests/image-proxy.spec.ts) and add upload
route tests for:

- private IP reached through DNS;
- public URL redirecting to private IP;
- IPv6 and IPv4-mapped IPv6;
- too many redirects;
- missing `Content-Length` with an oversized stream;
- MIME/header mismatch;
- SVG sent as `image/png`;
- timeout;
- foreign origin;
- rate limit;
- provider errors sanitized;
- valid PNG/JPEG/WebP success.

## 9. Release 2 — metadata, domains, and content-safe analytics

**Implementation status: 76% — core code shipped; external closure remains, and
two code gaps were found on August 15.** The deployed domain split is the one
recorded at the top of this document, not the original target shown in Section
9.4. Metadata, product config, PWA links, typed analytics, explicit consent, and
privacy-choice reopening are live, and the SSR metadata requirement was confirmed
against the production HTML rather than assumed. WordPress sitemap/Search Console
checks, the WordPress-to-app link, the remaining public-link audit, and an
operational dashboard remain. Commit evidence: `7dc4178`, `4701bb7`, `695a37e`,
and `b3c4545`.

Lowered to 76% on the morning of August 15 because "the analytics code shipped"
turned out not to mean "the funnel is measurable": `project_activated` had no
call site, and the five newest starter examples were rejected by the template
allowlist, so the entry point of the funnel was partly blind.

**Raised to 85% the same afternoon**, when both were closed — see "Closed later
on August 15" near the top of this document. The funnel now has its activation
step, and every selectable template id survives the analytics boundary behind a
drift test. What keeps this release below 100% is entirely external and
non-engineering: the WordPress sitemap and Search Console recheck, the hub's
stale links to the old Netlify host, and the weekly dashboard that Section 15
specifies but nobody has built.

### 9.1 One runtime config

Replace the obsolete design-token contents of [`src/lib/brand.ts`](src/lib/brand.ts)
with, or add, a product config that owns:

```ts
export const PRODUCT = {
  name: 'AO3 SkinGen',
  appUrl: 'https://ao3skingen.wordfokus.com',
  hubUrl: 'https://www.wordfokus.com/ao3skingen/',
  madeWithUrl: 'https://www.wordfokus.com/ao3skingen/made-with/',
  supportEmail: 'support@wordfokus.com',
  themeColor: '#7c3aed',
  compatibilityReviewedAt: 'YYYY-MM-DD',
  appVersion: '0.1.0'
} as const;
```

Do not use this client module for secrets. Product URLs, version, PWA metadata,
export credit, and analytics placements should stop having separate hard-coded
opinions.

**Shipped, with values that differ from the sketch above.** The real
[`src/lib/brand.ts`](src/lib/brand.ts) reflects the owner-approved domain split
that was decided after this section was drafted: `appUrl` is
`https://app.ao3skingen.wordfokus.com` and `hubUrl` is
`https://ao3skingen.wordfokus.com` — the reverse of the block above. It also
carries `backgroundColor`, a real `supportEmail`, and
`compatibilityReviewedAt: '2026-08-12'`. Read the module, not this block.

**`compatibilityReviewedAt` is a dated claim and it is now three days stale.** It
must only move when the comparison actually ran. `npm run audit:ao3-css` was
re-run on August 15 with no drift, so advancing it to `2026-08-15` is justified
and would keep the user-visible "rules reviewed" string honest — but note that
[`src/lib/ao3Compatibility.ts`](src/lib/ao3Compatibility.ts) carries its own
`reviewedOn` for the same purpose. **Two dates for one fact is a bug waiting to
happen.** Collapse them into one before the next review.

### 9.2 SSR-visible metadata

The root route currently returns only an `aria-busy` div on the server. The
site-skin route constructs `<Head>`, but returns before it while `isLoaded` is
false. Add route metadata before the hydration gate or include it in every
return branch.

For both application routes add:

- distinct title and description;
- canonical URL on the owned application domain;
- Open Graph/Twitter metadata;
- `robots=noindex,follow` under the recommended split;
- the same theme color and application name as the manifest;
- an SSR-visible product heading or useful loading shell where practical.

Recommended indexing split:

- WordPress hub and guides: `index,follow`;
- interactive app routes: `noindex,follow`;
- no URLs may contain creative content.

If the owner chooses to index app routes instead, render useful crawlable
content server-side. Do not index an empty client shell.

**Shipped and independently verified.** A production fetch of the app root on
August 15, 2026 returned `<meta name="robots" content="noindex,follow">` and
`<link rel="canonical" href="https://app.ao3skingen.wordfokus.com/">` in the
server-rendered HTML, before any hydration. The recommended indexing split is the
one in force. This is the check to repeat after any change to `ProductHead` or
the route return branches — a regression here is invisible in a browser, because
the client would render the tags anyway.

### 9.3 Fix PWA contract and deep links

[`public/manifest.json`](public/manifest.json) uses blue while `_document` uses
violet. Standardize name, short name, description, theme/background colors, and
icons.

The current manifest shortcuts use `?template=twitter` and `?template=ios`, but
the scene route resolves `template` only against example IDs such as
`twitter-character-thread`. Introduce an explicit blank-platform query:

```text
/?platform=twitter
/?platform=ios
```

Reserve `?template=` for catalog template IDs. Validate both through a shared
parser and add tests for valid, invalid, and stale links. Keep creative content
out of URLs.

### 9.4 Domain cutover

This work spans Netlify, DNS, the legacy marketing surface, and WordPress. It is
not a repo-only ticket.

Owner-approved target, deployed during Release 2:

```text
ao3skingen.wordfokus.com/                  public SwipePages landing page
app.ao3skingen.wordfokus.com/              interactive scene app
app.ao3skingen.wordfokus.com/site-skin     site-skin app
www.wordfokus.com/ao3skingen/              additional product/guide hub
www.wordfokus.com/ao3-guides/...           crawlable guides
```

Sequence:

1. Preserve the useful legacy examples and map every card to an existing
   example/template ID.
2. Keep the public landing on `ao3skingen.wordfokus.com` and attach
   `app.ao3skingen.wordfokus.com` to the Netlify app with verified TLS.
3. Replace public Netlify links with the branded application URL only after the
   custom app host works.
4. Keep the verified permanent redirect from the Netlify default hostname to
   the branded application URL unless the hosting architecture changes.
5. Keep the public landing and `www.wordfokus.com/ao3skingen/` useful and
   crawlable. Optional AO3 attribution remains unlinked plain text unless a
   commercial-neutral destination is deliberately maintained.
6. Update privacy, Terms, content policy, manifest, examples, docs, generated
   attribution, and analytics origins.
7. Verify canonical and robots headers with `curl` and Search Console.

The original legacy landing used claims such as “Your Data Never Leaves Your
Browser” and “Used by 1,200+ AO3 Writers.” The owner updated the SwipePages
surface during cutover. Re-audit the live page rather than assuming the checked-
in landing source and CDN copy remain synchronized.

### 9.5 WordPress and sitemap tasks

The Rank Math/sitemap findings are external and must be rechecked in WordPress;
they cannot be fixed from this repository. At the audit date, the product hub and
allowed-CSS reference were both published, indexable, and self-canonical, but
neither appeared in `page-sitemap.xml`. Confirm the pages are enabled for the
correct post type, included in a submitted sitemap, and fetchable in Search
Console. Do not change canonicals that are already correct merely to make a
generic SEO checklist look complete.

Add structured data only on crawlable pages with matching visible content:

- `SoftwareApplication` on the hub;
- `HowTo` on complete installation guides;
- `BreadcrumbList`;
- `Article` on real guides;
- `FAQPage` only when the visible page and current search rules justify it.

Never invent ratings, prices, or user counts.

### 9.6 Analytics implementation

After the trust/security copy is live:

1. add the typed helper from Section 5;
2. remove direct `window.gtag` calls from `ExportPanel`;
3. instrument starts, ready states, copies, completions, and fixed failures;
4. instrument site-skin CSS copy;
5. instrument project/cast file actions after those ship;
6. add route-change page views in the Pages Router if GA does not capture them;
7. implement the owner-approved opt-out/consent behavior without breaking the
   tool when analytics is unavailable.

Do not add product CTAs until their impressions and clicks can be measured
without content.

**Status against that seven-item list.** Items 1, 2, 4, and 7 are done. Item 3 is
done for starts, ready states, copies, completions, and fixed failures — but
**not for activation**, which is item 5's neighbour and the one gap that matters
most; see Section 5.2. Item 5 is done for project backup export/import and
unstartable for cast files, which do not exist. Item 6 has not been needed. The
allowlist maintenance duty this section did not anticipate is now the live
defect: adding a starter example without adding its id to `TEMPLATE_IDS` silently
erases its `template_selected` event.

## 10. Release 3 — backup and an honest publishing handoff

This release adds the highest-value missing capability without changing the
proven renderers.

**Implementation status: 100% — shipped, verified, and since stress-tested.**
Scene and theme backups, strict import boundaries, automatic pre-replacement
backup, character storage cleanup, fallback preview, transcript, alt workflow,
preflight, and the coordinated publishing handoff are implemented without adding
a parallel renderer. Commit evidence: `5d6478a`.

**This is the release that earned its score.** Since it shipped, the project file
has gone from schema v1 to v7 through six migrations, three platforms have added
structured content, and the identity model was replaced wholesale — and the
boundary held through all of it without a rewrite. Every migration is a pure
`vN→vN+1` function with fixtures; imports still never reach React state through
the tolerant recovery loader; preflight grew from its original checks to 24 by
composing existing validators rather than by growing a second one. When a future
change makes one of these boundaries inconvenient, that history is the argument
for moving the change rather than the boundary.

### 10.1 Versioned project backup

Add `src/lib/projectFile.ts` with a pure serializer,
validator, and migration table.

**Shipped, and now at schema v7.** The two examples below are the original v1
shapes and are kept because they show the envelope contract, which has not
changed: exact top-level keys, an integer version, and a future version rejected
rather than guessed at. For the current field-by-field format — scene cast,
Twitter relationships, and the separate WhatsApp and iOS structured-content
models — read [`docs/PROJECT-FILE-SCHEMA.md`](docs/PROJECT-FILE-SCHEMA.md), which
is maintained alongside the code and explains the reasoning for each migration
step, including why `v6 → v7` deliberately adds no data.

Scene file:

```json
{
  "format": "ao3skingen-project",
  "schemaVersion": 1,
  "exportedAt": "2026-08-12T00:00:00.000Z",
  "application": {
    "name": "AO3 SkinGen",
    "version": "0.1.0"
  },
  "project": {
    "id": "local-project-id",
    "template": "ios",
    "settings": {},
    "messages": []
  },
  "characterLibrary": []
}
```

Site-skin file:

```json
{
  "format": "ao3skingen-site-theme",
  "schemaVersion": 1,
  "exportedAt": "2026-08-12T00:00:00.000Z",
  "theme": {}
}
```

Requirements:

- local file download and user-selected file input only;
- maximum 2 MB import before parsing;
- exact top-level format and integer schema version;
- explicit allowlists, length limits, enum validation, message-count limits, and
  URL sanitization;
- no `dangerouslySetInnerHTML` from imported values;
- unknown future fields ignored only inside known objects;
- unsupported future schema rejected with a useful message;
- preview summary before replacement: template, message/result count, character
  count, export date, and whether remote image references are present;
- explicit “Replace current project” confirmation;
- automatic backup of the current project before replacement if download can be
  triggered reliably;
- v1 import is replace-only. Do not implement a vague merge operation;
- migrations are pure `vN -> vN+1` functions with fixtures.

Do not call `loadStoredProject()` directly on arbitrary imported JSON. Its
current `...parsed.settings` merge is appropriate for trusted local persistence
recovery, not a strict file boundary.

### 10.2 Canonical local character type cleanup

Before including the library in backup:

- keep one `UniversalCharacter` definition in [`src/lib/schema.ts`](src/lib/schema.ts);
- remove the duplicate interface in [`src/lib/characterBank.ts`](src/lib/characterBank.ts);
- delete or migrate the unused `src/lib/characterCache.ts`;
- remove the unused `settings.universalCharacters` field after a backward-
  compatibility read;
- add a validated character-library storage helper instead of raw
  `JSON.parse(localStorage.getItem(...))` in `index.tsx`;
- cap character count, string lengths, and URL lengths;
- keep `usageCount` and `lastUsed` local-only.

This cleanup is a prerequisite for cast interchange.

**Done, and then superseded by something stronger.** The storage helper, caps,
and validation shipped in Release 3; `characterCache.ts` is gone. The identity
work of `5e8d9bc` then went further than this section asked, replacing the
consolidation goal with a canonical project-scoped `SceneCast`. The duplicate
`UniversalCharacter` interface question is moot in the direction that matters:
`UniversalCharacter` remains the *library* type in
[`schema.ts`](src/lib/schema.ts), while scenes hold `SceneCharacter` copies, and
the two are deliberately different types because they have different lifetimes.
Legacy per-message and settings identity fields still exist and are still read as
migration fallback. **Do not delete them yet** — the identity plan §11.7 defers
that until old files have been exercised in production, and the v1 backup
fixtures depend on those branches.

### 10.3 Fallback preview

The fallback content exists; expose it.

In the accessible work-skin modal add two preview tabs:

- **Styled** — the existing generated work skin;
- **Without work skin / downloads** — the same exported HTML with generator CSS
  absent, plus a plain-text view built by a deterministic local function.

Do not call the second view an exact EPUB emulator. AO3 conversion can change.
Use copy such as:

> This is the reading order and text your export is designed to preserve when a
> reader hides the work skin or downloads the work.

Reuse the semantics tested in `skin-off.spec.ts`. Do not create a different
transcript algorithm that can drift from exported HTML.

### 10.4 Image alt text and transcript

Add a deterministic local `buildSceneTranscript(project)` and an editable
overall scene-alt field in the hosted-image export flow.

Requirements:

- never send project content to an AI or server to write alt text;
- produce speaker/result order from the same project data as the renderer;
- let the author edit the short alt text;
- offer the full transcript as selectable text and a `.txt` download;
- add per-attachment alt editing to the existing message editor because
  `Attachment.alt` exists but is not currently exposed consistently;
- warn on content images with empty alt; allow intentionally decorative images
  to be marked as such;
- escape alt attributes correctly in generated embed HTML;
- for multi-part hosted images, describe the whole scene and identify part
  order without duplicating a huge transcript into every `alt` attribute.

### 10.5 Preflight status

Do not invent one giant validator. Compose existing checks into a report:

```ts
interface PreflightItem {
  id: string;
  severity: 'block' | 'warn' | 'info';
  status: 'pass' | 'fail';
  message: string;
}
```

Work-skin blocks:

- shared AO3 CSS lint failure;
- generator HTML contract failure;
- missing speaker identity that makes fallback ambiguous.

Warnings:

- empty attachment alt;
- contrast below the chosen threshold;
- remote/expiring image host;
- very long unbroken content or mobile overflow risk;
- no project backup yet.

Site-skin keeps its existing CSS blocks and contrast warnings. Hosted image
keeps remote-host permanence and transcript warnings. A warning must not be
silently promoted to “AO3 rejected this.”

**Shipped and grown to 24 checks**, all composed from validators that already
existed — which is exactly what this section asked for and is why it scaled. The
blocks are still the three named above plus each platform's model validity
(`whatsapp-model`, `ios-model`); the warnings now also cover video fallback,
media posters, media hosts, host dependence, and flattened scrolling. Two rules
have held throughout and should keep holding:

- **Content problems warn; they do not trap the author.** `ExportPanel` blocks
  the work-skin export only on generator-level failures, so an empty alt or a
  risky host never prevents an export the author has chosen to make.
- **Every check delegates.** A new check must call an existing validator or model
  function. If you find yourself writing validation logic inside `preflight.ts`,
  it belongs in the platform model instead, where the composer and the importer
  can share it.

### 10.6 Publishing Kit scope

In this release, “Publishing Kit” means a coordinated handoff UI, not a ZIP.

- Work skin: CSS, HTML, fallback preview/text, preflight, backup action, exact
  AO3 steps.
- Hosted image: embed HTML, short alt text, transcript, local PNG reminder,
  hosting warning.
- Site skin: CSS, validation result, theme backup, exact AO3 steps.

Keep individual copy/download actions. Defer a ZIP archive until analytics or
user research shows that people want it. If a ZIP is later added, generate it
only from these canonical outputs; do not re-render or rebuild them.

No Publishing Kit artifact may contain commercial or donation content.

## 11. Release 4 — neutral cast portability and WorldKonstruct

> **Withdrawn on August 15, 2026.** This section described the primary commercial
> bridge. **Section 11.6 replaces it**, on the grounds that the bridge is aimed at
> the wrong stage of the author's work. Sections 11.1–11.5 are kept because their
> engineering reasoning is sound and because the cast *file* may still ship later
> as a plain convenience feature — but the WorldKonstruct card, the two-way gate,
> and the framing of this as "the primary commercial bridge" are superseded. Do
> not implement 11.4 as written.

**Implementation status: 15%, on hold — the data prerequisite shipped; the bridge
is now deliberately abandoned rather than merely deferred.** Reserved analytics
event types still do not count as a cast implementation.

### 11.1 Define what “the cast” means in this app

**This section is now history, and its problem is solved.** It is preserved
because the matching rules below are still the right rules for *import*, and
because the reasoning explains why the identity work was worth doing before any
bridge.

The five scattered sources it described are gone. `5e8d9bc` made project-scoped
`SceneCharacter` identities canonical: messages and group participants reference
a stable `characterId`, `SceneCast` names the self, contact, and Twitter primary,
library entries are copied rather than linked, and a referenced identity is
archived or explicitly reassigned instead of silently deleted. Legacy fields
survive only as migration fallback.

Three consequences for whoever eventually builds the bridge:

1. **`collectCastCandidates` is no longer needed as specified.** There is nothing
   to collect from five places. `project.cast.characters` *is* the candidate
   list, already deduplicated, already stably identified, and already normalized
   through `identity.ts`. Filter out `archived` entries and you have the export
   set. Writing the original function now would add a layer over a model that
   already answers the question.
2. **The matching order below still applies, but only on import.** Export needs
   no matching at all, because ids are stable. Import from a foreign product does
   — and rule 4 is the one that matters most: two different characters can share
   a display name, and `identity.ts` was built on exactly that premise. Do not
   let an importer reintroduce name-keyed merging that the app itself abandoned.
3. **The user-facing selection step is still required.** An export must still
   show the cast with checkboxes and let the author correct names and handles
   first. Stable ids make that screen simpler; they do not make it optional.

The historical description follows.

Potential character sources today:

1. global `UniversalCharacter[]` library;
2. `twitterCharacterPresets` in the current project;
3. iOS/Android group participants;
4. the current contact/group/account identity in settings;
5. per-message custom Twitter identities.

Implement a pure `collectCastCandidates(project, library)` that returns source-
labelled candidates. Do not silently merge every matching display name; two
different characters can share a name.

Suggested matching order for import/export preview only:

1. same stable local ID;
2. same normalized platform handle;
3. same normalized name plus the same avatar URL;
4. otherwise treat as distinct and ask the user.

Before export, show the candidates with checkboxes and let the user correct
names/handles. “Save selected to my character library” should canonicalize scene
identities before interchange.

### 11.2 Neutral schema v1

Agree this contract with WorldKonstruct before writing promotional UI:

```json
{
  "format": "writer-cast-exchange",
  "schemaVersion": 1,
  "exportedAt": "2026-08-12T00:00:00.000Z",
  "source": {
    "application": "AO3 SkinGen",
    "version": "0.1.0"
  },
  "characters": [
    {
      "id": "stable-local-id",
      "name": "Alex Rivers",
      "aliases": ["Alex"],
      "handles": {
        "twitter": "alexrivers"
      },
      "avatarUrl": null,
      "notes": ""
    }
  ]
}
```

Rules:

- dialogue, messages, search results, metrics, and project title are never
  included;
- avatar URLs are excluded by default and require an explicit checkbox;
- local usage counts/timestamps are never included;
- handles are stored without a leading `@`;
- IDs are data identifiers, not analytics identifiers;
- unknown future fields are ignored safely;
- schema/version/size/type/string limits are validated;
- imports show conflicts and never overwrite silently;
- file download/import works without WorldKonstruct or an account;
- publish a short schema document in `docs/`.

JSON is the v1 interchange. Defer CSV until a real consumer asks for it; CSV
cannot round-trip aliases, nested handles, and optional metadata without another
contract.

The shipped `SceneCharacter` maps onto this almost directly — `id`, `name`,
`twitterHandle` → `handles.twitter`, `avatarUrl` — which is a good sign for the
schema and a bad reason to build it early. Two fields need a deliberate decision
rather than a mechanical copy: `sourceLibraryId` is a local provenance pointer
and must **not** be exported, and `archived` is a local lifecycle state that a
consumer has no way to interpret, so archived identities should simply be
excluded. Neither decision is difficult; both are the kind of thing that gets
wrong silently if the exporter is written by spreading an internal type.

### 11.3 Two-way acceptance gate

Do not show “See WorldKonstruct” merely because AO3 SkinGen can export JSON.
Release the bridge only when:

- AO3 SkinGen exports and reimports the schema without loss;
- WorldKonstruct imports the same fixture;
- WorldKonstruct exports a fixture AO3 SkinGen imports;
- duplicate/conflict behavior is documented in both products;
- both products share contract fixtures or a versioned schema package;
- the owned redirect destination exists.

### 11.4 Contextual WorldKonstruct card

Show this only after a cast export succeeds:

> **Keep this cast consistent across the whole fic**
>
> Your cast file works on its own. WorldKonstruct is a separate Google Docs
> story-bible tool by the same developer and can import this file.
>
> `[Open WorldKonstruct]`

The useful primary action is already complete: the user owns the cast file.
WorldKonstruct is optional. Use an owned route such as:

```text
/go/worldkonstruct?src=ao3skingen&placement=cast-export-success
```

The redirect may append stable UTM values and log source, placement, timestamp,
and destination. It must not receive the cast file, character count, names,
project ID, or a complete referrer query.

### 11.5 WordFokus and Ko-fi

Do not place WordFokus in the cast flow. Show it only after a drafting action
exists, for example “Start another scene” or a writing-workflow guide:

> **Drafting the chapters between the messages?**
>
> WordFokus is a separate Google Docs add-on for focused drafting sessions.

Ko-fi may return later after repeated completed handoffs, never in the same
completion panel as WorldKonstruct, WordFokus, an email signup, or a backup
warning.

### 11.6 Why the bridge is withdrawn, and what replaces it

This section supersedes 11.3 and 11.4, and demotes 11.2 from "commercial
contract" to "possible convenience feature". It was written on August 15, 2026
after the owner asked a question this document had never asked: what is the user
actually doing at the moment the cast card would appear?

#### The finding

**AO3 SkinGen's users have finished writing. Both adjacent products serve people
who have not.**

The realistic path into this app is: an author finished a fic weeks ago, one
chapter contains a text-message scene, they are now fighting AO3's editor, they
search for a way to make that scene look right, they build it, they copy the work
skin, and they leave. At the moment 11.4 would offer a cast file, they have three
or four characters whose names they typed minutes earlier, in a story that is
already finished. The consistency problem the card offers to solve was solved by
the author, elsewhere, months ago.

Three consequences:

1. **WorldKonstruct is a story-bible tool, and fanfiction's defining property is
   that someone else already built the world.** An author writing two canon
   characters does not need a character database for them; the fandom wiki is the
   story bible, and it is free and exhaustive. The overlap between "needs a fake
   iMessage screenshot" and "needs a story bible" is far thinner than Release 4
   assumed. It is not empty — original fiction posted to AO3, and long AUs with
   large original-character ensembles, are real — but that is a minority of a
   minority, and this document called the bridge *primary*.
2. **WordFokus is a drafting tool, offered to someone who has finished
   drafting.** Section 11.5 already kept it out of the cast flow for the right
   reason; the same reasoning applied one step further removes the cast flow's
   own justification.
3. **At the point of maximum goodwill, there is nothing relevant to sell.** That
   is a stage mismatch, not a placement problem, and no amount of card copy,
   timing, or prominence fixes it.

The corroborating evidence was already in this document and was misread. See
Learning 20: the two story-bible fields in the 11.2 schema, `aliases` and
`notes`, have no source anywhere in this application and never acquired one
across six migrations, while the field the app is richest in — a Twitter handle —
is a rendering choice, not a character fact. The schema could not fill itself
because the two products model different things.

Note also that Section 15's interpretation rule 7 ("cast card impressions but few
clicks: improve the workflow benefit and interchange, not banner prominence")
assumes there is a workflow benefit to improve. For this audience there may not
be, in which case the metric would eventually have said *stop*, after Release 4
had been paid for.

#### What the WorldKonstruct listing added, later on August 15

The owner supplied the destination after this section was first written. It is a
live Google Workspace Marketplace product — **WorldKonstruct — World Builder &
Story Bible**, by 3LB Fire, a Google Docs add-on, freemium with paid features and
optional AI, around 164 reviews, owned destination
`https://app.wordfokus.com/worldkonstruct`. Six entry types (characters,
locations, objects, factions, worldbuilding, events), self-updating `@mentions`
with backlinks, series bibles, co-author collaboration, and **optional manuscript
scanning that detects story elements in an existing draft**.

This is real evidence and it cuts both ways. Recorded honestly:

**It weakens one leg of the argument above.** The finding said WorldKonstruct
serves people who have not finished writing. Manuscript scanning means it also
serves people who *have* — point it at a finished draft and it extracts the
elements. So "the product is irrelevant to this audience" was too strong, and is
withdrawn. WorldKonstruct is a plausible thing to *show* a SkinGen user. That is
Tier 1 and Tier 2, and the listing makes their copy better and more specific.

**It strengthens the case against the cast file.** If the add-on can read a whole
manuscript and find every character in it, then a JSON file carrying three or
four names out of one chat scene is not a useful import — it is a strictly worse
version of something the destination already does better, from a source that has
far more context. The bridge was already unnecessary; this makes it close to
pointless. Sections 11.2–11.4 stay withdrawn, and the reasoning is now stronger
rather than weaker.

**It unblocks Tier 3.** An owned redirect destination exists, which was the last
thing that tier needed.

**It confirms the Section 2 handling.** Freemium with paid features and AI makes
this unambiguously a commercial destination, exactly like WordFokus. It may
appear on owner surfaces and inside the application, and never in AO3-bound
output.

One copy note that follows from the six entry types: they are oriented to
*original* worldbuilding. Generic "organise your worldbuilding" copy will not
land on an audience whose world was built by canon. The two specifics that do
land are manuscript scanning and series bibles — see
[`docs/LANDING-COPY-2026-08.md`](docs/LANDING-COPY-2026-08.md).

#### What replaces it

Not "no promotion". The distinction is between a **conversion funnel timed to a
moment**, which is withdrawn, and **discovery**, which is mostly unbuilt and
should be built. Users knowing who made this tool and what else that person makes
is legitimate, useful to them, and currently close to absent.

Expect low single-digit cross-sell at best, and treat that as success rather than
as a reason to escalate. The real return is name recognition landing months later
when the author starts their next project, which is the stage where either
product becomes relevant. Section 15's rule 9 stands and now carries more weight:
do not argue users into accepting a funnel — this audience talks to each other.

Build in tiers, and do not skip ahead:

**Tier 1 — owned surfaces. No application code. Do this first.** The SwipePages
landing page and the WordPress hub are the owner's own property and AO3's rules
do not reach them. Describe what the application actually became — three
platforms rebuilt as fiction-authoring tools, structured media, playable AO3
output — and place the product lineup around that story. This is the same work
item as "close the copy gap", so it is one job and not two, and it subsumes the
stale `ao3skingen.netlify.app` links recorded in Section 9.5.

**Tier 2 — a permanent, quiet presence inside the application. Shipped August 15,
2026.** [`src/components/MoreTools.tsx`](src/components/MoreTools.tsx) renders on
the two entry screens only — the platform picker and the site-skin gallery — both
full-page surfaces with no composer to occlude. It is not a card, not a modal and
not timed to any completion event. Clicks fire `product_cta_clicked` with two new
enumerated placements, `platform_picker` and `site_skin_gallery`, so Tier 3's
question is already partly answered by the time Tier 3 arrives. Outbound links
carry `rel="noopener noreferrer"`, because Section 11.4's rule that the
destination must never receive a complete referrer applies to a plain link too.

[`tests/more-tools.unit.spec.ts`](tests/more-tools.unit.spec.ts) holds the
Section 2 boundary that this tier is the first thing to test rather than assume:
generated markup, stylesheet, single and master work skins (including with
optional attribution switched on), and all sixteen compiled site skins must
contain no commercial reference, and `MoreTools.tsx` must be the only module in
`src/` holding a commercial destination URL. Two lessons from writing it, both
worth keeping — a word-level match fails on correct code, because `analytics.ts`
must enumerate `'worldkonstruct'` as an event *value* and `urlNormalize.ts`
credits a reference document in a comment; and a naive host match also fails,
because the product's own domains live under `wordfokus.com` too. The assertion
is on a *linkable commercial destination*, which is the thing Section 2 actually
forbids.

The original specification follows, and still describes the intent:

Not a card, not
a modal, not timed to any completion event: a persistent "more tools by the same
developer" entry in the application footer or an About panel, always present and
free to ignore. Someone who likes this tool will go looking for who made it, and
today they largely cannot find out. This closes the leak permanently instead of
interrupting anyone, and it does not touch Section 4.5's at-most-one-card rule,
because it is not a next-step card. It must remain outside every AO3-bound
output, which Section 2 already requires.

**Tier 3 — make it measurable, cheaply.** `product_cta_clicked` is already a
declared member of the analytics union and fires nowhere. Add the owned
`/go/worldkonstruct` and `/go/wordfokus` redirects — the shape and the privacy
constraints in 11.4 are still correct even though its card is not — and wire that
event. Until this exists, every question about placement is a matter of opinion.
Do it when there is enough traffic for the answer to mean something.

**Tier 4 — one honest in-app moment, later.** There is exactly one, and it is not
cast export: the author returning to start the *next* scene or the next fic.
Section 11.5 already named it ("Start another scene"). A returning author on
their third or fifth local project is the closest signal this app has to
"maintains an ongoing universe", and that is a person for whom a story-bible tool
is genuinely relevant. Build it only after Tier 3 can judge whether it works.

#### What stays dead

- The WorldKonstruct card on cast export (11.4 as written).
- Any commercial content in AO3-bound output. Unchanged, non-negotiable, and an
  archive-policy risk rather than a matter of taste — see Section 2.
- Ko-fi in the same surface as a product promotion, per Section 4.5.

#### If the cast file ships anyway

It may, and there is a decent case for it — multi-chapter and series authors do
re-enter the same six characters, and that friction is real. If it ships, it
ships as a **convenience and backup feature with no card attached**, judged on
whether authors use it, and the 11.2 schema rules still apply in full. Note that
the local character library already covers most of this need; the file's genuine
addition is portability off the device.

## 12. Compatibility and accessibility program

**Program status: active, materially stronger, and still not separately
percentage-scored.** The deterministic suite grew from 249 unit tests to **362
passing plus one correctly-skipping gate**, and gained whole classes of coverage
this section asked for: per-platform model suites, renderer contracts, a
characterization golden of emitted HTML and CSS, raster checks that assert what a
real PNG contains, hosted-export chunking, and identity flows run on desktop and
mobile. A maintained compatibility ledger, a representative AO3
Default/Reversi/Low Vision record, broader RTL and enlarged-text fixtures, and
automated axe coverage all still remain.

**The two archive gates named at the top of this document belong to this
program**, and they are its most important open items. Everything below describes
how to model AO3; those gates are the only things that ask AO3 directly. A
skipping read-back test and an unfilled site-skin checklist are the honest
statement of what is unverified — do not let either quietly become "covered"
because the surrounding suite is green. Both have already found defects that no
amount of local testing could see.

### 12.1 Regression matrix

Extend the current suite rather than starting over. Required coverage:

- all four platforms, single and master skin;
- light/dark variants;
- AO3 paragraph injection/readback;
- work skin disabled;
- exported plain reading order;
- mobile/desktop and enlarged text;
- long names, messages, and unbroken URLs;
- non-Latin and right-to-left fixtures where supported;
- keyboard/focus behavior for every new menu/dialog;
- reduced motion;
- attachment alt and overall scene alt;
- prompt arbitration collisions;
- project and cast migration fixtures.

Add automated axe checks to the app UI where practical. Keep semantic assertions
for generated work content; an axe pass alone does not prove readable fallback
order.

### 12.2 AO3 themes

Test representative work output against AO3 Default, Reversi, and Low Vision
fixtures. Classify results as:

- pass;
- warning with known interaction;
- unsupported combination.

Do not promise compatibility forever. Every public compatibility claim needs a
generator version and test date.

### 12.3 Compatibility ledger

Start with a maintained Markdown ledger before building an observatory product:

```text
Date tested
Generator commit/version
AO3 behavior observed
Template/output
AO3 site skin
Browser/device class
Skins enabled/disabled
Pass/warn/fail
Known workaround
Fixture/test link
Retest date
```

Link it to the existing AO3 knowledge and work-skin implementation docs. Do not
collect user dialogue to build the ledger.

Later, an opt-in diagnostic report may send only rule IDs, generator version,
output type, broad environment class, and fixed errors. Show the exact payload
before sending.

### 12.4 Ruleset maintenance

Use the single vendored allowlist from Section 7.6 for both work-skin and
site-skin validation. On every scheduled compatibility review:

1. compare against a named upstream `otwcode/otwarchive` commit;
2. inspect every added, removed, or renamed property and shorthand;
3. update the review date only when the comparison actually ran;
4. run generated-output lint plus the AO3 save/readback fixtures; and
5. add the result to the compatibility ledger.

An upstream allowlist match is necessary but not sufficient: AO3 sanitization,
HTML transformation, browser behavior, and site skins can still affect output.

## 13. Search, distribution, and audience work

These tasks follow the application foundation. They are mostly owner/content
work, not reasons to expand the app editor.

**Program status: not scored as engineering completion.** Draft content and
WordPress-ready artifacts exist in the working tree, but publication, sitemap
inclusion, Search Console validation, community distribution, and any email
program are owner/operations work and require current external verification.

### 13.1 Content priorities

Build on [`docs/AO3-CONTENT-PLAN.md`](docs/AO3-CONTENT-PLAN.md) and existing
WordPress-ready articles. Prioritize problems the app demonstrably solves:

1. Work skin versus site skin
2. How to apply and merge AO3 work skins
3. Why AO3 rejected CSS
4. Screenshot versus accessible real text
5. What readers see with creator styles disabled
6. What happens in AO3 downloads
7. Why a hosted image disappeared
8. Accessible social-media AUs
9. Mobile testing for work skins
10. AO3 site-skin contrast and readability

Each guide must provide complete native value, link to official AO3 material,
and use one relevant starter template. Do not write thin pages for every keyword.

### 13.2 Safe starter links and style sharing

Deep links may contain only catalog IDs and non-sensitive style settings. Never
put dialogue, names, handles, image URLs, project IDs, or notes in a URL.

A later `.ao3style.json` may include template, colors, layout, and typography
while excluding creative content. Validate it with the same import boundary as
project files.

Defer public template submission until moderation, reporting, licensing, and
compatibility-versioning capacity exists.

### 13.3 Community distribution

Useful native topics:

- styled versus work-skin-disabled comparison;
- image versus real-text comparison;
- an AO3 CSS rejection and the fix;
- a compatibility update after an AO3 change;
- a complete free recipe/template;
- accessible alt/transcript guidance.

For Reddit, Tumblr, and creator partnerships, disclose ownership and follow each
community's promotion rules. Never ask authors to carry paid-product promotion
into AO3 notes or works.

### 13.4 Compatibility-alert email

Only after the compatibility ledger is maintained, offer a new optional list:

> **AO3 Skin Compatibility Alerts**
>
> At most one email per month when AO3 changes something that may affect
> generated skins, plus major SkinGen updates.

Requirements:

- double opt-in;
- no signup required for any tool or export;
- separate consent for general product marketing;
- source recorded as AO3 SkinGen;
- unsubscribe/export/delete process;
- no prechecked box;
- never shown with a commercial or donation prompt.

Do not import the old dark-mode-confused list.

## 14. Sequenced backlog

### P0 — trust and security

**Progress:** Mostly shipped. Items 1, 5, and 6 retain owner/external closure —
item 5's `LICENSE` and item 6's content-policy watermark language were both
re-confirmed open on August 15. Item 8 is closed and stays closed: the August 15
audit reports 182/182 properties and 20/20 shorthands with no drift in either
direction. Item 9 is re-verified against live bundles. The durable shared limiter
remains a documented Release 1 follow-up. All other items have repository
implementations and tests.

1. Record owner decisions from Section 6.
2. Add typecheck/test scripts and capture a green baseline.
3. Remove unfinished Pro gating.
4. Replace the generic success modal.
5. Add the intended `LICENSE`, align Terms, and replace the stale public README.
6. Correct privacy and validation copy across every live domain.
7. Separate fiction label from optional tool attribution and remove the current
   hardcoded commercial credit destination.
8. Sync `aspect-ratio`, pin the reviewed AO3 ruleset source, and add a drift check.
9. Add server-side ImgBB upload and rotate the public key.
10. Harden the existing image proxy.
11. Narrow CSP.

Done when:

- no browser bundle contains the ImgBB key;
- upload disclosure precedes the first byte sent;
- no fake purchase/activation path remains;
- privacy copy matches every network path;
- one export action produces at most one completion/next-step surface;
- AO3-bound output contains no commercial request or link to a page with one;
- the local AO3 property/shorthand sets match the recorded upstream snapshot;
- existing work-skin/site-skin/readback tests pass.

### P1 — identity, metadata, and measurement

**Progress:** Core application work shipped, with two code gaps found on August
15. Items 1–4 are done and re-verified live. Item 5 is unchanged and still open.
Item 6 shipped as a module but is **incompletely wired**: `project_activated`
fires nowhere, and five starter-example ids are missing from the analytics
template allowlist, so `template_selected` is dropped for the newest examples.
Item 7 remains a definition rather than an operational dashboard. The WordPress
hub still links the old Netlify host.

1. Add one product config.
2. Add SSR-visible route metadata and chosen robots policy.
3. Fix PWA theme/name/shortcut consistency.
4. Cut over the owned app domain and update public links.
5. Recheck WordPress sitemap/canonical configuration.
6. Add typed analytics and fixed error mapping.
7. Define the weekly AO3-ready handoff dashboard.

Done when:

- both routes expose correct title/description/robots without hydration;
- manifest shortcuts open the intended blank platform;
- no creative content appears in analytics requests;
- every handoff definition is implemented exactly once;
- Netlify, custom domain, hub, privacy, examples, and redirects agree.

### P2 — recoverable and accessible handoff

**Progress:** Complete at `5d6478a`, and maintained through six schema migrations
since. Item 2 was superseded by the canonical `SceneCast` in `5e8d9bc`, which
went further than this item asked. Items 3–6 are unchanged and intact; preflight
has grown to 24 composed checks without a second validator appearing.

1. Add versioned scene and site-theme backup/import.
2. Consolidate character types and validate library storage.
3. Add fallback/plain preview to work-skin export.
4. Add deterministic transcript and editable alt text.
5. Add composed preflight status.
6. Add output-specific completion states and backup reminder.

Done when:

- clearing localStorage is no longer the only-copy failure mode;
- a bad import cannot replace current work without preview and confirmation;
- a user can inspect the intended no-skin/download reading order;
- hosted image output has useful alt/transcript support;
- no parallel renderer was introduced.

### P3 — product visibility (replaces the cast bridge)

**Progress:** The bridge is withdrawn — see Section 11.6. What replaces it is
discovery work, most of which needs no application code. The shipped canonical
`SceneCast` remains real progress and is not wasted: it is what would make a
convenience cast file cheap, if authors ever ask for one.

Withdrawn from this priority, and moved to Section 16:

- ~~Agree the neutral schema with WorldKonstruct.~~
- ~~Pass shared fixtures in both products.~~
- ~~Add the cast-export-success WorldKonstruct card.~~

The work now is, in order:

1. **Tier 1** — rewrite the landing page and WordPress hub so the public promise
   matches the product, and place the owner's product lineup around it. Fixes the
   stale `ao3skingen.netlify.app` links in the same pass.
2. **Tier 2** — add a permanent, non-interrupting "more tools" entry in the
   application footer or an About panel. Never in AO3-bound output.
3. **Tier 3** — add owned `/go/*` redirects and fire `product_cta_clicked`, when
   there is enough traffic for the answer to mean anything.
4. **Tier 4** — one WordFokus surface on a *return* visit or "start another
   scene", only after Tier 3 can judge it.

Done when:

- a visitor can tell what this application does before using it;
- a visitor who wants to know who made it can find out without being sold to;
- no completion event is followed by a commercial card;
- no commercial string can reach AO3-bound output;
- `product_cta_clicked` carries a placement and nothing else.

### P4 — compound learning and distribution

**Progress:** Owner drafts exist, but the maintained ledger, publishing,
distribution, alerts, and diagnostics program has not been operationalized.

1. Maintain and publish the compatibility ledger.
2. Connect priority guides to valid starter IDs.
3. Add style-only export/import if demanded.
4. Launch compatibility alerts.
5. Add opt-in payload-preview diagnostics only after the ledger process works.
6. Consider a local multi-project library only after backup/return-use data shows
   that one is needed.

## 15. Dashboard and decision rules

Weekly dashboard:

- unique scene-builder and site-skin visitors;
- activation rate by tool/template;
- PNG download-trigger rate;
- hosted-image ready/copy/failure rate;
- work-skin CSS copy, HTML copy, and completed-pair rate;
- site-skin valid-copy rate;
- top fixed error codes;
- fallback-preview usage;
- backup export/import rate;
- ~~cast export/import rate;~~ no cast file ships, per Section 11.6;
- ~~WorldKonstruct eligible impression and click rate;~~ withdrawn with the card;
- product-link click rate by placement, once Section 11.6 Tier 3 exists;
- seven- and thirty-day return rate using privacy-approved aggregation. **This is
  now a primary metric rather than a secondary one** — Section 11.6 Tier 4 makes
  the returning author the only in-app moment where an adjacent product is
  genuinely relevant, so return rate is what identifies that audience.

Interpret in this order:

1. Low hub-to-app rate: fix the promise and starter links.
2. App opens but low activation: simplify first content creation.
3. Activation but low export start: clarify PNG versus hosted image versus real
   text.
4. Starts but low ready rate: fix render/upload/validation failures.
5. Ready but low copy completion: fix modal instructions and clipboard fallback.
6. Completion but low return: improve backup and resume before building cloud
   accounts.
7. ~~Cast card impressions but few clicks: improve the workflow benefit and
   interchange, not banner prominence.~~ **Retired.** This rule assumed there was
   a workflow benefit to improve; Section 11.6 concludes there probably was not,
   which is the failure mode it would eventually have diagnosed at much greater
   cost. Its replacement: **product-link impressions but few clicks means the
   offer is aimed at the wrong stage of the author's work — check that before
   changing the copy.**
8. Clicks but no activation in the destination product: fix that product's
   landing and onboarding before increasing promotion here.
9. Community resistance: reduce branding and commercial adjacency; do not argue
   users into accepting a funnel.

## 16. Do not build next

Defer:

- AI dialogue or alt-text generation;
- automated real-profile imports or real-person lookup;
- AO3 login, scraping, posting, or browser extension;
- cloud projects/accounts;
- public sharing of dialogue-bearing projects;
- paid template packs;
- watermark-removal paywalls;
- a ZIP dependency before handoff demand is measured;
- **the WorldKonstruct cast bridge, the two-way acceptance gate, and the
  post-cast-export card** — withdrawn on audience grounds, not deferred on
  scheduling grounds; read Section 11.6 before reopening;
- **any commercial card timed to a completion event**; product visibility is
  permanent and quiet, per Section 11.6 Tier 2;
- CSV cast exchange before a real consumer defines it;
- a multi-project IndexedDB library before local backup ships;
- community submissions before moderation capacity;
- more platform clones before current publishing paths are reliable and
  measured.

## 17. Pull-request checklist

Every implementation PR must include:

- the user-visible problem being solved;
- before/after UI copy or screenshots for visual changes;
- files and canonical functions reused;
- analytics events added, with their exact allowed parameters;
- privacy/network behavior changed;
- migration/backward-compatibility behavior;
- unit and end-to-end tests added;
- confirmation that generated AO3 output contains no commercial CTA;
- for compatibility changes, the exact upstream AO3 commit and allowlist diff;
- `git status --short`, typecheck, build, and relevant test results.

Additional review rules:

- Never edit generator output in a component with string replacements when a
  canonical generator function should own it.
- Never add a second AO3 CSS allowlist.
- Never make preview and export use different site-skin CSS.
- Never parse project/cast imports directly into React state.
- Never send raw errors to analytics.
- Never use message count alone to decide first-visit/returning state; seeded
  defaults contain messages.
- Never reload immediately after edits in a test; auto-save is debounced 500 ms.
- Never add fixed UI without retesting composer occlusion and mobile safe areas.
- Never restore work-skin CSS comments without a real AO3 save/readback check.
- Never make tests or production builds fetch the live AO3 allowlist.

## 18. Final definition of done

The growth implementation is complete when:

- AO3 SkinGen has one coherent owned-domain identity and honest public copy;
- image-host credentials are server-side, rotated, rate-limited, and disclosed;
- remote-image proxying validates DNS, redirects, bytes, size, and timeouts;
- a writer can distinguish local PNG, hosted image code, accessible work skin,
  and site skin before acting;
- the app measures AO3-ready handoffs without claiming to observe publication;
- no analytics payload contains fiction or identity content;
- generated work remains readable with creator styles off and in the intended
  download reading order;
- projects and site themes can be backed up and restored locally;
- image output includes an alt/transcript workflow;
- character data has one validated local model;
- ~~AO3 SkinGen and WorldKonstruct round-trip a neutral cast file before any
  bridge is promoted;~~ **replaced August 15, 2026:** the public copy describes
  what the product actually does, and a user who wants to know who built it can
  find out without being sold to (Section 11.6, Tiers 1 and 2);
- one contextually relevant next step appears at most once after completion, and
  it is never a commercial one;
- no commercial or donation content travels into AO3-bound output;
- compatibility claims are versioned and dated;
- the vendored AO3 CSS ruleset has a recorded upstream commit and visible drift
  check;
- the existing AO3 regression suite remains green.

Two criteria should be added to that list, because the work since August 12 made
them real rather than hypothetical:

- generated work that carries media degrades honestly — the reader is never shown
  a player for something the app cannot guarantee, and the author is warned
  before publishing a dependence on a host that can disappear; and
- every output that names a person resolves that name through one identity model,
  so the preview, the PNG, the work skin, the skin-off reading, and the
  transcript cannot disagree.

At `c733066`, the implementation is **74% complete** by the release scoring
defined at the top of this document, up from 72%. That movement is deliberately
much smaller than the volume of work would suggest: Release 2 was rescored
*downward* after two measurement gaps were found, Release 4 was credited only for
its shipped data prerequisite, and the platform program that dominates this
baseline is not scored at all. A number that rises because unrelated work shipped
would stop being useful. Releases 0–3
delivered the trust cleanup, secure image boundary, branded and consented
measurement foundation, and recoverable publishing handoff. On top of them, an
unplanned platform program turned three of the four scene types into real
authoring tools and gave the app one canonical cast.

The immediate work is not a cast bridge, and it is no longer primarily code:

1. **the two archive gates** — master skin v7 read-back, and site-skin Phase 7;
2. **the copy gap** — Section 11.6 Tier 1, which is now the top of the growth
   work and not a footnote to it;
3. **Release 0's two open items** — the license decision and the content-policy
   watermark language;
4. **Release 2's remaining gap** — the hub's stale links and the dashboard. Its
   two code gaps closed on August 15;
5. **the privacy copy for structured media**; and
6. **the compatibility ledger.**

~~Release 4 begins only after WorldKonstruct can participate in the shared
contract and the two-way fixture gate.~~ **Release 4's bridge does not begin.**
Section 11.6 withdraws it: the constraint was never the contract, it was that the
people using this app have finished writing, and both adjacent products serve
people who have not. Product visibility replaces it, in tiers, starting with work
that touches no application code.

One closing observation, because it is the largest strategic gap this revision
found — and the second revision only sharpened it. Every number in this document
measures whether the product is honest, secure, recoverable, and measurable, and
by those measures it is in good shape. None of them measures whether anyone knows
what it does. The app authors rich, accessible, AO3-ready social-media fiction
across three platforms; the public copy still describes a screenshot generator.

That gap was the cheapest growth lever in the August 15 morning revision. By the
afternoon it was the *main* one, because the alternative — a commercial bridge
timed to an export — turned out to be aimed at a person who had already left the
stage of work where it would have helped.
