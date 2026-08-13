# AO3 Work Skin — Knowledge Store

**What this is:** techniques and constraints learned from published work skins
that we had not already recorded. Not a plan. `WORK-SKIN-IMPLEMENTATION.md` says
what we built; `MASTER-WORK-SKIN-IMPLEMENTATION.md` says what we intend to
build; this file is the raw material both draw on.

**Every entry is labelled with how strongly it is known.**

| Label | Meaning |
| --- | --- |
| **PROVEN** | Read out of CSS that AO3 itself is serving. It passed the sanitizer — there is no stronger evidence short of saving it ourselves |
| **VERIFIED** | Checked against otwarchive `master` source |
| **REPORTED** | An author states it from experience; plausible, unconfirmed |
| **CONVENTION** | What published skins actually do, without anyone saying why |

**Primary source, 7 Aug 2026:**
[Whatsapp Work Skin Template /Revamped](https://archiveofourown.org/works/46531021)
by worlds_end_valentine (itself building on an orphaned WhatsApp skin, with
credited improvements from ovely).

**Why this source is unusually good.** AO3 embeds a work's skin as a `<style>`
block on the work page — so fetching the page yields **the cleaned CSS the
archive stores and serves**, after sanitizing. 46 KB, 174 rules, all of it known
to survive. That is the artefact §8 of the master-skin plan asks us to obtain by
saving a skin ourselves; here is one for free, for somebody else's skin.

---

## 1. Our hidden-text recipe is the wrong one — **PROVEN**

We use `position: absolute; left: -9999px`. The published skin uses the
WCAG-standard clip pattern, and AO3 is serving it intact:

```css
#workskin .screenreader {
  position: absolute; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0, 0, 0, 0);
  white-space: nowrap; border: 0;
}
```

`clip` is on AO3's supported-property list and `rect()` reaches `VALUE_REGEX`
through `SHAPE_FUNCTION_REGEX`, so this is legal — and now demonstrably legal in
production, not just in theory.

**Why it is better than ours.** The off-screen technique can create horizontal
overflow, is inconsistently handled by assistive technology, and on a
right-to-left page pushes content into view. The clip recipe has none of those
problems and is what every accessibility guide recommends.

**Action:** change `.visually-hidden` in `generator.ts` to the clip recipe. Cheap,
and it improves the one mechanism §9a of the work-skin doc rests on. Note their
rule omits `width: 1px`; include it.

Independent convergence worth noting: this author arrived at the same design we
did — invisible while styled, plain prose when not — and describes it in the
same terms. Their own summary: *"It creates an invisible text that is read by
screen readers and turns visible when the work skin is hidden."*

## 2. ARIA does not exist on AO3 — **VERIFIED**

The author: *"Aria-hidden=true doesn't seem to work on ao3, so I am still
clueless about how to solve this issue."*

Confirmed by the sanitizer config: allowed attributes are `align`, `title`,
`dir`, plus `class` on CSS-enabled fields, plus `src/alt/width/height/border` on
`img` and `href/name` on `a`. **No `aria-*` attribute is on any list**, so every
one is stripped silently.

Two consequences we must design around:

- **Decorative text cannot be hidden from screen readers.** Their unsolved
  complaint is timestamps being announced on every message in a long exchange.
  Ours has the same shape.
- **Our hidden prose is additive only.** §9a's design adds "Sam:" and "847
  likes" for screen-reader users, which is the right direction — but it also
  means we cannot later suppress the chrome we add. Keep hidden text short and
  load-bearing; every word is read aloud.

## 3. Both themes can live in one skin — **PROVEN**

The single most useful thing here, and a direct answer to the master-skin
theming problem.

```css
#workskin .wpp .light .bg1 { background-image: url("…bglight1.png"); … }
#workskin .wpp .dark  .bg1 { background-image: url("…bgdark.png");   … }
```

One skin carries both palettes; the HTML picks with a wrapper class, and
switching theme is *"the only thing you have to do is exchange
`<span class="light">` for `<span class="dark">`"*.

This is the community's workaround for work skins banning custom properties and
`var()`: **enumerate the variants as classes.** The same skin does it again for
quote colours — sixteen of them, `green1` through `blue3`, each a hand-written
class pair (`quotesentgreen1`, `fromgreen1`).

**This materially changes `MASTER-WORK-SKIN-IMPLEMENTATION.md` §6b.** That
section concluded "one skin, one theme" because `var()` is unavailable. It is
still true that a *hand-written* skin can only afford a few enumerated variants
— but we generate. Emitting `.chat.ios.light` / `.chat.ios.dark`, or a small set
of named palettes, costs us a loop. Revisit §6b before building it.

## 4. A scrollable chat window — **PROVEN**

```css
#workskin .wpp .light .bg1 {
  background-image: url("…"); background-position: center top;
  background-repeat: repeat-y;
  overflow-y: auto; overflow-x: hidden;
  height: 470px; width: 330px;
}
```

`overflow-x`/`overflow-y` pass the allowlist because `overflow` is a shorthand
name and the test is a substring match. A long conversation becomes a fixed
470px window instead of consuming the whole page — something we do not offer and
which matters for the 50-message exchanges people actually write.

Constraints the author documents, all **REPORTED**:

- The background must be set **in the skin**, because inline `style` is
  stripped. So every distinct background needs its own class pair —
  `bg1`/`footer1`, `bg2`/`footer2`, … A generator does this for free.
- A background image *"NEEDS to be 520px long, and with a width of at least
  340px"* so the footer's background lines up with the body's.

## 5. AO3 supports native audio and video in Work Text — **VERIFIED; CORRECTED 13 AUG 2026**

The earlier version of this entry was wrong. It inspected only AO3's base
`ARCHIVE` element allowlist, saw no `audio`, `video`, `source` or `track`, and
concluded those elements were always stripped. Current otwarchive applies a
second, purpose-built `MediaSanitizer` to fields listed in
`FIELDS_ALLOWING_MEDIA_EMBEDS`. The production configuration lists `content`—
the work/chapter body—and the sanitizer explicitly preserves all four elements.

The sanitizer also adds safe defaults:

```html
<video controls="controls" crossorigin="anonymous"
       preload="metadata" playsinline="playsinline">
  <source src="https://example.com/video.mp4" type="video/mp4">
  <track src="https://example.com/captions.vtt" kind="subtitles"
         srclang="en" label="English">
</video>
```

Allowed native-video attributes are `class`, `controls`, `crossorigin`, `dir`,
`height`, `loop`, `muted`, `playsinline`, `poster`, `preload`, `src`, `title`
and `width`. `source` keeps `src` and `type`; `track` keeps `default`, `kind`,
`label`, `src` and `srclang`. Media URLs must use HTTP(S), and the
`crossorigin="anonymous"` default means a direct-file host must permit CORS.

**Why the published WhatsApp example still lost its media is not settled.** A
bad/expired source, blocked host, missing CORS, malformed markup or older AO3
behavior could all produce the observed empty result. The observation was real;
the universal explanation was not. Never infer the full sanitizer from its base
allowlist when field-specific transformers can add elements.

The static waveform remains useful as an image-export fallback and as fictional
chat chrome. It is no longer the only honest way to include playable media in
an AO3 work.

The supplied published
[Twitter Work Skin Template](https://archiveofourown.org/collections/ao3_socmed_work_skin/works/47803507)
provides direct read-back confirmation. Its current sanitized Work Text contains
three native `video` elements and two native `audio` elements. The videos use a
direct MP4 URL; the audio players contain direct MP3 `source` children. The
read-back markup contains AO3's expected `controls`, `crossorigin="anonymous"`
and `preload="metadata"` defaults, plus `playsinline` on video. This proves the
field-specific native-media path is active on a real published social-media
work, not merely present in source code.

Sources:

- [AO3 Posting and Editing FAQ](https://archiveofourown.org/faq/posting-and-editing?language_id=en)
- [otwarchive media sanitizer](https://github.com/otwcode/otwarchive/blob/master/lib/otw_sanitize/media_sanitizer.rb)
- [otwarchive HTML cleaner](https://github.com/otwcode/otwarchive/blob/master/lib/html_cleaner.rb)
- [otwarchive media configuration](https://github.com/otwcode/otwarchive/blob/master/config/config.yml)

## 6. Patterns we do not implement

All **CONVENTION**, from the same skin.

| Pattern | What it is |
| --- | --- |
| **Emoji-only sizing** | `.emoji1 { font-size: 60px }` for a single emoji, `.emoji2` for two to four, normal size for five or more. Mirrors what WhatsApp and iMessage actually do |
| **Reaction pills** | `.reactionsent` floated right with a negative top margin so it overlaps the bubble's lower edge, `box-shadow` for lift. Supports counts and mixed emoji — `💗2`, `😭🤦💗3` |
| **Link previews** | Thumbnail, title, description snippet and bare domain inside the bubble, above the raw URL |
| **System rows** | `.info` centred pills for `Today` and events like `Person A removed Person B` |
| **Group headers** | Separate `.group` and `.groupmembers` spans, the latter an ellipsised member list |

## 7. Practical constraints worth keeping

- **Square icons only** — **REPORTED**: *"For any icon, use square images! I've
  had a few problems in this skin when using images with ratios other than
  1:1."* This corroborates our §9e note: we dropped `object-fit` because AO3
  bans it, so a non-square avatar letterboxes. The community answer is not to
  fix it in CSS but to require square sources.
- **`width="40%"` on content images** — **CONVENTION**: a *percentage* in the
  HTML `width` attribute, *"just so it doesn't look too weird with creator's
  style hidden"*. We emit pixel `width`/`height`, which is right for icons and
  arguably wrong for content images, where a percentage degrades better.
- **Image hosting is a real failure mode** — **REPORTED**. The author used
  Cloudinary, fic traffic exceeded the free tier, and every image in every fic
  using the skin broke: *"I had to reupload images! if you were using mine
  instead of uploading them, you'll have to relink them."* They are now on
  `i.ibb.co`. Two lessons: our "we ship no images" stance is right, and the
  export dialog should warn that a quota-limited host will break a published fic
  silently.
- **Size ceiling is not near** — **PROVEN**: 46 KB and 174 rules for a *single*
  platform, in production. Our four-platform combined sheet is 38 KB. Whatever
  the limit is, we are not close to it.

## 8. Direct confirmation of the master-skin plan — **REPORTED**

> You can only use a skin per fic, so you can combine different skin in a single
> one (for example, a whatsapp and a twitter template), but make sure they're
> not conflicting with each other.

An experienced skin author, unprompted, describing both the plan and its one
risk. The collision warning is the reason `MASTER-WORK-SKIN-IMPLEMENTATION.md`
§6a namespaces every selector rather than concatenating.

## 9. What this source does *not* settle

- **Whether `display: flex` works.** The served skin contains **zero** `flex`
  and **19** `float` declarations against **21** `inline-block`. That is a
  strong statement of convention, and consistent with the guide in
  `MASTER-WORK-SKIN-IMPLEMENTATION.md` §5 and with our own §5a — but it is
  absence of evidence, not evidence of absence. The author may simply never have
  written flex. **Still needs one real save to settle.**
- **Whether `@media` survives.** Zero occurrences here, so it adds nothing to
  the §2a finding that AO3 flattens media blocks and drops their condition.

---

---

## Part 2 — The Twitter skin, and a competitor

**Sources, 7 Aug 2026:**
[Repository: Twitter](https://archiveofourown.org/works/22517134/chapters/53973601)
by gadaursan (the served skin is 6.8 KB, 137 rules), and the same author's
[AO3 Tweet Builder](https://gadaursan.github.io/AO3TweetBuilder/).

This is the work our own `WORK-SKIN-IMPLEMENTATION.md` §10 was groping for when
it mis-cited "Repository: Twitter (Workskin)". Now correctly identified.

## 10. `.p1` … `.p100` — enumeration is normal, at scale — **PROVEN**

The skin ends with **one hundred** rules of the form:

```css
#workskin .p37 { width: 37%; }
```

That is 100 of its 137 rules — **73% of the stylesheet is one enumerated
numeric variant.** They exist because a poll bar's width is per-instance data,
inline `style` is stripped, and `var()` is banned. There is no other way to get
a number from the HTML into the CSS.

The builder simply picks one:

```js
$(optionClassName).addClass("p" + votePercentage);
```

**This settles the §6b argument beyond doubt.** A hand-writer typed a hundred
classes because enumeration is the only mechanism available; we generate, so
emitting a light/dark pair is trivial by comparison. It also gives us the
technique for any future per-instance numeric — bar widths, progress, ratings.

## 11. The verified badge is drawn in CSS, not fetched — **PROVEN**

```css
#workskin .twVerified {
  display: inline-block; text-align: center;
  width: 15px; height: 15px; font-size: 10px;
  background-color: #1DA1F2; color: #fff; border-radius: 50%;
}
```

A blue circle with a glyph inside it. **We ship a PNG from `media.publit.io` for
exactly this.** Four advantages to their approach:

- No external request, so nothing to break when a host changes or rate-limits —
  which is precisely the failure §7 records happening to a real skin.
- It scales with the text rather than being pinned to 18px.
- It survives a reader who blocks images.
- One less thing in the `absolutizeAssets` path.

**Action:** replace the verified badge with a CSS circle. Worth reviewing which
of our other chrome images could go the same way — the metric icons are
genuinely iconographic and probably cannot, but the badge clearly can.

## 12. Night mode by wrapper class, a third time — **PROVEN**

```css
#workskin .twNM .twComments { border-top: .05em solid #3B5364; }
#workskin .twNM .twWin      { background-color: #74cbfb; }
```

The WhatsApp skin does light/dark this way (§3), this one does night mode this
way, and the poll widths do it for numbers. Three independent skins, one
pattern. Treat variant-classes as *the* AO3 idiom, not a workaround.

## 13. Polls — a feature we do not have — **PROVEN**

Two states, which is the part worth copying:

- **Active** (`.twAPoll`) — options as outlined boxes, no percentages, footer
  reads *"N hours left"*.
- **Finished** (`.twPoll` + `.pNN` + `.twWin`/`.twOpt`) — filled bars at their
  vote share, winner tinted differently, footer *"1,234 votes · Final results"*.

## 14. What the canonical Twitter skin does *not* do — **PROVEN**

Zero occurrences of `screenreader`, `visually-hidden`, `.hide`, or any ARIA in
6.8 KB. **The most-used Twitter work skin has no skin-off handling at all.**

With the skin off — every download, and any reader who disabled work skins — it
degrades to unlabelled text. Our §9a work is therefore a real differentiator,
not table stakes. Worth saying so in the marketing copy, which currently does
not mention the work-skin export at all.

## 15. Sizing convention is *not* settled — **CONVENTION**

This skin uses `max-width: 400px` and `width: 40px` avatars, with `em` only for
padding and borders. starskin's skin is `em` throughout and advertises itself as
"scalable so it's also accessible to mobile users".

So the community is split, and BACKLOG item 4 (`em` for the remaining
platforms) is a considered improvement rather than a correction — AO3's own FAQ
recommending `em` is the tiebreaker, not community consensus.

## 16. The competitor: AO3 Tweet Builder — **PROVEN** (read its source)

A static GitHub Pages app: jQuery, Bootstrap, DOMPurify, clipboard.js. It is
the tool linked from starskin's tutorial as "now you only have to fill in your
text and copy-paste the generated code".

**Its architecture agrees with ours on the thing that matters.** Export is:

```js
document.getElementById('HTMLCode').value =
  document.getElementById('demonstration').innerHTML.trim();
```

The live preview *is* the export — the same "one rendering, not two" principle
`SITE-SKIN-IMPLEMENTATION.md` §5 argues for. Independent convergence.

| | Tweet Builder | Us |
| --- | --- | --- |
| Platforms | Twitter only | Four |
| Threads | One tweet at a time | Thread mode with replies |
| Polls | ✅ | ❌ |
| Verified badge | CSS circle | PNG from a CDN |
| Skin-off / downloads | ❌ nothing | ✅ hidden prose |
| CSS | user copies it from the AO3 work separately | generated and lint-checked |
| AO3-safety checking | none | `lintAo3Css`, blocks export |
| Image export | ❌ | ✅ PNG + upload |
| Input sanitising | DOMPurify | our own `sanitizeText`/`sanitizeUrl` |

Where they are ahead: polls, the CSS badge, and a more mature single-tweet
editing UX. Where we are ahead: everything about the skin being *correct* —
which is invisible until it fails, and is what the export dialog should say.

## 17. Two defences against AO3's formatter, used together — **PROVEN**

`MASTER-WORK-SKIN-IMPLEMENTATION.md` §4 records the one-line rule and the fact
that Google's export violates it. The Repository shows the two techniques a
production skin actually uses, and they are complementary.

**Defence one — comments that swallow the line break.** The author's own
explanation:

> Note that there are comments embedded in the HTML, but **don't remove those**.
> AO3 will see these empty spaces and feel obligated to stuff paragraphs and
> line breaks in between, breaking the code. Ideally, we wouldn't need these
> comments, but we want the code to be readable by humans.

```html
<div class="twUser"><!---
 ---><img class="twAvatar" src="IMAGE URL"><!---
 ---><span>Euphy<span class="twVerified">✔</span><br/><!---
 ---><span class="twHandle">@officialeuphemia</span></span><!---
 ---></div>
```

Every newline falls **inside** a comment, so there is no bare whitespace between
elements for AO3 to convert. This is strictly better than the beginner's guide's
advice to collapse everything onto one unreadable line: the author gets readable
source *and* correct output. Our exports are machine-generated so readability
matters less — but a user who opens their chapter later will thank us.

**Defence two — neutralise the paragraphs in CSS.**

```css
#workskin .tw p { margin: 0; padding: 0; }
```

> AO3 has a habit of stuffing paragraphs and line breaks **depending on how you
> paste HTML into the editor**. We can mitigate this by making sure the blank
> paragraphs take up no space.

This is the more important of the two, because it does not depend on our output
being perfect. Injection is partly a function of *how the user pastes*, which we
cannot control. A `p` reset makes an injected paragraph harmless instead of
catastrophic.

**We have neither.** No platform emits a `p` reset, so an injected `<p>` inherits
AO3's `.userstuff p` margins and pushes our layout apart. This affects all four
platforms, not just the Google branch that violates the one-line rule outright.

## 18. Night mode costs five rules — **PROVEN**

The entire dark theme:

```css
#workskin .twNM            { background-color: #14242C; color: #fff; border-color: #3B5364; }
#workskin .twNM .twBody    { border-color: #3B5364; }
#workskin .twNM .twComments{ border-top: .05em solid #3B5364; }
#workskin .twNM .twWin     { background-color: #74cbfb; }
#workskin .twNM .twOpt     { background-color: #3B5364; }
```

Five rules, because the base skin defines **structure only** and the variant
overrides **colour only**.

Ours works the other way round: `isDark ? x : y` is evaluated throughout
`buildTwitterCSS`, baking one theme into the sheet. That is why our
settings-dependence is 24–32% rather than a handful of rules.

**This changes the cost estimate for BACKLOG item 8.** Shipping light *and* dark
in one skin is not "double the stylesheet" — if we separate structure from
colour first, it is a handful of override rules per platform. That refactor is
worth doing on its own merits, and it makes the master skin much cheaper.

> **Correction, 8 Aug 2026 — the cost estimate above is wrong for us, and the
> reason is worth more than the estimate.** Item 8 was built exactly as
> described: both palettes were reachable as data after 5b, the diff produced
> **64 override rules of pure colour**, and it *rendered wrong*. One override
> tied on specificity with a more specific base rule (`.tweet.no-metrics
> .time-line`, which sets `border:none`) and, coming later, beat it — putting a
> hairline back under a metric-less tweet in one theme only.
>
> **A five-rule night mode is something a hand-writer can do and a generator
> cannot.** The author of that skin knows their own cascade: they know which
> rules can match the same element and they write the override to sit beside
> them. Two compiled stylesheets diffed by a program carry no such knowledge.
>
> Ours is a whole namespaced stylesheet per variant — sound by construction,
> 32 KB rather than 5 KB. **This does not retract §3 or §12**: enumerating
> variants as classes is still the right idiom and still survives the sanitizer.
> It retracts the *size* claim for generated skins. Full account in
> `MASTER-WORK-SKIN-IMPLEMENTATION.md` §6b-i.

## 19. The chrome is text, not images — **PROVEN**

The verified tick is the character `✔` inside a CSS-drawn circle (§11). The like
counter is the character `❤`. The whole skin requires **no chrome images at
all** — the only external image is the user's own avatar.

Ours emits **five CDN images for a single tweet**:

```text
twitter-verifiedBadge.png   twitter-logo.png     twitter-replyIcon.png
twitter-retweetIcon.png     twitter-likeIcon.png
```

A twenty-tweet thread is a hundred requests to `media.publit.io`, inside
somebody's published fic, forever. §7 records exactly this going wrong for the
WhatsApp author when Cloudinary cut them off — every image in every fic using
their skin broke at once, and readers had to be told to relink.

We are one CDN outage away from the same story, and unlike them we would be the
ones who chose the host.

**Not all five are equally replaceable.** The verified badge is a solved problem
(§11). `❤` replaces the like icon exactly. The reply and retweet glyphs have no
single-character equivalent that reads correctly, and the X logo is a trademark
we should probably not draw in CSS anyway. But going from five to two, with the
two remaining being genuinely iconographic, is a large reduction in blast
radius.

## 20. Structural patterns worth copying — **PROVEN**

- **Quote retweet** nests a second `.twBody.twEmbed` inside the tweet, with a
  parallel class set (`twUserEmbed`, `twAvatarEmbed`, `twVerifiedEmbed`,
  `twHandleEmbed`) at smaller sizes. We build quotes with bespoke classes; the
  parallel-suffix convention is tidier and would let a nested quote reuse the
  outer rules.
- **Reply indicator** is two spans in one div, the first at `opacity: 0.6` —
  "replying to " then the handle. Ours is a `.replying-to` div with an `<a>`.
- **`.twStats` / `.twComments`** separate the like-and-time line from the
  "N people are talking about this" line, with the border between them. Ours
  merges those concerns into `.metrics` plus `.time-line`.

---

## Part 3 — The flex question settled, and a catalogue of formats

**Sources, 7 Aug 2026:**
[mystyrust/quaranteen](https://github.com/mystyrust/quaranteen) (the raw
HTML/CSS behind a social-media Danny Phantom fic, plus its README's changelog),
its AO3 counterpart [chat, is this real?](https://archiveofourown.org/works/62188714)
(**559 rules, 71 KB served**), and
[[Ao3 Skin] Twitter with threads](https://archiveofourown.org/works/35006431)
by oakleaf.

## 21. Flex: both sides of the argument were half right — **PROVEN + REPORTED**

**The sanitizer keeps it.** The 71 KB served skin contains **10 `display: flex`
and 9 `display: inline-flex`** declarations. They are in CSS AO3 is serving. So
the beginner's guide's claim that the validator drops flex is **definitively
wrong**, our source reading was right, and `lintAo3Css` is correct to permit it.

**And yet three independent practitioners abandoned it.** The repo's README:

> ao3 pls let us use flex boxes
>
> that being said, i have like... 3-4 different versions of the amongus skin bc
> i started out using flexboxes, **then i adapted when i realized ao3 wouldnt
> allow it**

That also explains the residue: the README says *"i didnt want to delete
anything"*, so the surviving flex rules are the abandoned drafts, still in the
mega-file. Add the beginner's guide and our own §5a and that is three parties who
tried flex on AO3 and rewrote.

**A hypothesis that unifies this with §17.** Flex is not stripped; it *breaks*.
AO3 injects `<p>` wrappers between elements depending on how the HTML is pasted
— and a flex container's direct children then become those paragraphs rather
than the intended elements, which destroys the layout. Float and inline-block
degrade gracefully under the same injection; flex cannot.

If that is right, three things follow, and they are testable:

- The paragraph reset (BACKLOG 2a) and the comment trick are not merely tidiness
  — they are the actual fix for the flex problem.
- Our §5a Twitter header failure had a cause after all, and it was never about
  flex being "blocked".
- Flex might work fine *once paragraph injection is handled*. Worth one
  experiment during the AO3 save, but **float/inline-block remains the correct
  default** because it survives the failure rather than needing it prevented.

## 22. AO3 re-parses your HTML on every edit — **REPORTED**, and alarming

> the html parser keeps changing and **it reruns everytime you add a new
> chapter, update an authors note, or edit html tags**

This is a maintenance hazard nothing else we have read mentions. Markup that
posted correctly can be silently rewritten months later because the author fixed
a typo in an end note. Our exported HTML needs to be **idempotent under
re-parsing**, not merely correct once.

The changelog also records a specific regression and its fix:

> changed quaranteens ch6 and ch7 to be fully in span elements, after some
> changes in ao3s html parser in jan 2023 **prevented `a` tags from being
> siblings with divs**. (a tags would be auto enclosed with p tags, preventing
> the tabbing mechanic from working)
>
> …it was discovered that **enclosing the entire html in a `figure` tag would
> allow `a` tags to be siblings with div tags again**

Two reusable facts: `<a>` as a sibling of `<div>` is fragile, and wrapping the
whole structure in `<figure>` (an allowed element) restores it.

**We emit exactly one anchor** — `<a href="#" class="reply-handle">` in
Twitter's reply indicator. It is a *child* of a div rather than a sibling, so it
is probably safe, but it is also a link that goes nowhere, which screen readers
announce as a link and which scrolls the reader to the top if clicked. It should
be a `<span>`.

## 23. Tables are the flex-free two-column primitive — **PROVEN**

oakleaf solves the thread layout gadaursan's skin explicitly cannot do, without
flex and without absolute positioning:

```css
#workskin .tw-table    { table-layout: fixed; border-collapse: collapse; width: 100%; }
#workskin .tw-td-icon  { width: 45px; height: 45px; }
#workskin .tw-td-thread{ border-left: 2px solid rgb(207, 217, 222); }
```

A two-column table: avatar left, post right — and **the thread connector line is
simply the left border of a cell**. `table`, `tbody`, `tr`, `td` are all allowed
elements and `table-layout` is an allowed property.

Ours draws the same line with `::before`/`::after` at `left: -2em` on a
`margin-left: 2.75em` bubble — magic numbers that must stay in sync. The table
version has no offsets to keep aligned and no float to clear. Worth considering
if the thread line ever misbehaves on real AO3.

## 24. `<details>` + `:has()` + `[open]` is the JS-free interactivity engine — **PROVEN**

In one served stylesheet:

| Construct | Occurrences |
| --- | --- |
| `details` | 175 |
| `[open]` | 213 |
| `:has(…)` | 111 |
| `:not([open])` | 72 |
| `::-webkit-details-marker` | 16 |
| `::-webkit-scrollbar` | 11 |

`<details>` toggles its own `[open]` attribute on click with no script, and
`:has()` lets an **ancestor** react to that state. That is a complete
click-driven state machine inside a fanwork — read-more toggles, collapsible
sections, tabs, and the "restore window" behaviour of a fake browser chrome.

Two supporting details worth keeping: `::-webkit-details-marker` hides the
default disclosure triangle, and `::-webkit-scrollbar` styles a custom scrollbar
— legal because `scrollbar` is on AO3's shorthand list and the vendor prefix is
permitted.

This is the mechanism behind the interactive games the beginner's guide
mentions. We have no use for it today; we would need it the moment we wanted a
"show more replies" control.

## 25. A catalogue of formats, already solved by someone — **PROVEN**

The answer to "what else could we build". Rule counts indicate how much design
work each represents:

| Format | Rules | Notes |
| --- | --- | --- |
| YouTube | 69 | Video page with description, channel avatars, comments |
| Reddit | 49 | Header, sort-by bar, vote box, signup box, photo posts |
| Tumblr (`tungle`) | 41 | Post body, URL bar, notes, reblog line |
| Polaroid | 38 | Photo frames with a custom scrollbar carousel |
| Snapchat | 33 | Shares `details`-based reveal with Spotify |
| Spotify | 17 | Album art, collapsible track list |
| Chrome browser window | 9 | Window chrome with minimise/restore via `:has()` |

Also present at smaller scale: Signal, a newspaper, letters, and a tab system.

None of this is copyable — it is one author's fic-specific CSS — but it is proof
that each format is achievable inside AO3's constraints, and a structural
reference if we build one.

## 26. Paragraph resets, a fifth time — **PROVEN**

`.tw p`, `.spotify-cont-outer p`, `.snap-cont p`, `.polaroid p`, `.tunglebody p`
— every format family in this skin resets paragraphs, and oakleaf's does too
(`.tw p { margin: 0 }`).

Five independent skins, same defence. **BACKLOG 2a is not a nice-to-have; it is
the thing every experienced AO3 skin author does first.**

---

## Part 4 — A full mobile Twitter vocabulary

**Source, 13 Aug 2026:**
[Twitter Mobile Workskin Documentation](https://archiveofourown.org/works/76859551/chapters/201171641)
by LittleMissGhostette. The work has a 91-page downloadable reference covering
markup examples and complete dim, light and dark CSS variants. Representative
pages for main posts, replies, threads, quote posts, media, accounts, polls and
translations were also visually reviewed.

The author describes the design as a mixture of old Twitter, current Twitter
and a little Bluesky rather than a pixel-identical copy of one release. That
makes this source especially useful for **fiction-oriented information
architecture**: it shows which pieces make a post legible in a story, not merely
which controls happen to exist on the live product this month.

## 27. “A tweet” is at least four display contexts — **PROVEN**

The documentation gives distinct examples and class families for:

1. a main/expanded post;
2. a compact reply;
3. a reply opened as the main post;
4. a compact timeline entry.

These are not cosmetic aliases. They carry different information hierarchy:

- the main post gives the body and timestamp more visual weight;
- a compact reply keeps the account, handle, time and relationship together;
- an opened reply is still semantically a reply even though it uses the main
  post treatment;
- timeline entries prioritize scanning over full detail.

**Reusable lesson:** relationship and presentation are separate axes. “This
post replies to X” is data; “show this post expanded” is a view choice. Do not
encode both in one `isReply`/`threadMode` flag. A renderer should be able to show
a reply in either compact or expanded form without losing its parent.

This supports the distinction already latent in our own `parentId` and
`expandedView` fields. The mistake is not the model; it is that the current UI
cannot author either state.

## 28. A thread is a relationship structure, not a line effect — **PROVEN + CONVENTION**

The source documents:

- a root post with replies;
- replies to a main post;
- reply chains;
- “Replying to” account context;
- “Show replies” and “Show thread” separators;
- timeline threads that expand into a connected sequence.

The connector is only the visible consequence. The actual structure is an
ordered set of parent/child relationships plus a focal post. A global “thread
mode” toggle that merely draws a line cannot express that.

**Reusable lesson:** store stable post relationships and derive the line,
indentation and replying-to handles. Do not infer parentage from adjacency or
from who posted. Preserve authored order among roots and siblings, and render a
malformed orphan as a visible top-level post rather than silently dropping it.

The same principle applies to paged/image exports: a reply must not vanish just
because its parent landed in the previous export chunk. Chunking must respect
relationship boundaries or repeat enough context for the next part to remain
legible.

## 29. Quote posts belong to individual posts — **PROVEN**

The reference demonstrates quoted posts inside main posts, replies and timeline
entries. A quote is therefore a composable block attached to one post, not a
page-wide setting.

The quoted account has its own:

- display name and handle;
- avatar and verified state;
- body text;
- optional image;
- compact styling appropriate to nesting.

**Reusable lesson:** model an embed on the message that contains it. A
project-wide quote setting is structurally wrong because it repeats the same
embed on every post. When the quoted account is a known scene character, keep a
stable identity reference so later avatar/handle edits reach old quotes. For an
external account, store a deliberate snapshot.

This also reinforces §20: outer and embedded posts should share primitives and
variants rather than becoming two unrelated renderers.

## 30. Media count changes markup; cropping is author intent — **PROVEN + REPORTED**

The source provides separate structures for one, two, three and four images:

| Count | Documented composition |
| --- | --- |
| 1 | One full-width media card |
| 2 | Two side-by-side cells |
| 3 | One large cell beside two stacked cells |
| 4 | A two-by-two grid |

This is stronger than “allow four attachments.” The renderer needs an explicit
layout variant for each count, particularly for the asymmetric three-image
case.

The guide also distinguishes images that should fill by width from images that
should fill by height. The author presents this as a manual choice because AO3's
CSS constraints do not provide the reliable `object-fit` behavior a normal web
app would use.

**Reusable lesson:** attachment order, count and crop intent are content data.
Store a small crop enum such as `auto`, `fill-width` and `fill-height`; emit
explicit AO3-safe classes. Do not attempt to recover the author's composition
from the image URL or natural dimensions at export time.

Every cell still needs useful alt text. A grid is one visual unit, but skin-off
and screen-reader output must retain the images' authored order and individual
descriptions.

## 31. Account identity has independent adornments — **PROVEN**

The account section covers:

- custom profile pictures;
- several generic/default avatar treatments;
- verified accounts;
- an account label such as “Parody account.”

Verification and account labels are separate concepts. A label is visible
narrative context, not another kind of badge, and must not be represented only
by color or an icon.

**Reusable lesson:** resolve the core identity—name, handle, avatar and verified
state—from a stable account record, while keeping scene-specific adornments such
as an account label on the post. Generic avatars should be generated locally or
drawn from text/CSS where possible; they are not worth another permanent remote
chrome dependency.

## 32. Polls have open and final states — **PROVEN**, independently corroborating §13

This second Twitter source documents the same two-state poll model as
Repository: Twitter:

- an unfinished poll with options and remaining time;
- a finished poll with percentages, a result/winner treatment and final-state
  context.

Independent convergence makes the model more trustworthy than either skin
alone. A poll is not merely a list of percentage bars; its state determines
which facts should appear.

**Reusable lesson:** store two to four options and an explicit open/closed state.
For final results, widths still need the `.p1` … `.p100` enumeration from §10
because AO3 strips inline style and work skins cannot use custom properties.
Always print percentages and result labels as text so the poll survives without
bars or color.

## 33. Translation needs a state even when it is not interactive — **PROVEN**

The reference provides both an interactive translation example and a static
translated example. The important reusable idea is not the toggle mechanism;
it is that one post owns:

- original text;
- translated text;
- language/context label;
- which version is currently visible.

**Reusable lesson:** model translation state separately from the post body. A
generator can emit the selected static state everywhere and consider a
`<details>`/`:has()` enhancement only after real AO3 save/readback testing.
Static output is the safe baseline because it survives downloads, reparsing and
Creator's Style being disabled.

If an interactive version is added, both states must remain understandable to
assistive technology. §2 still applies: AO3 strips ARIA, so a clever visual
toggle cannot be repaired with `aria-hidden` or `aria-live`.

## 34. Dim is a first-class palette, not “less dark mode” — **PROVEN**

The downloadable guide contains three full CSS sections:

- dim (pages 46–60);
- light (pages 61–75);
- dark (pages 76–90).

Dim has its own background, surface, border and secondary-text relationships.
It is not safely derived by changing one background color on the light or dark
sheet.

**Reusable lesson:** once a platform supports three appearances, store a theme
enum rather than adding booleans. Variant classes remain the proven AO3 idiom
from §§3, 12 and 18, but each palette must be generated and visually tested as a
complete reachable state. Do not programmatically diff compiled stylesheets to
manufacture overrides; §18 records why that is cascade-unsafe for our generator.

## 35. Selective fidelity is a feature — **REPORTED**, supported by the source's design

The author explicitly omits bookmarks, views and Grok, and describes the result
as a deliberate blend of Twitter eras and Bluesky. Yet the mockup still reads
immediately as a Twitter conversation because it preserves the fiction-relevant
grammar: account identity, post hierarchy, reply context, embeds, media,
engagement and timestamps.

**Reusable lesson:** a work skin is narrative UI, not a live-site archive. Add
chrome only when it helps a reader understand the scene. Frequently changing
or non-narrative controls increase CSS, accessibility noise and visual-aging
risk without improving the story. Metrics such as views and bookmarks can be
optional; ads, live navigation and network behavior are outside the useful
fidelity boundary.

---

## Part 5 — Playable media and approved embeds

**Sources, 13 Aug 2026:** the supplied playable
[YouTube clip](https://www.youtube.com/watch?v=bN8449nalT8), AO3's current
[Posting and Editing FAQ](https://archiveofourown.org/faq/posting-and-editing?language_id=en),
YouTube's official [embed and privacy-enhanced mode guidance](https://support.google.com/youtube/answer/171780?hl=en),
the supplied reader-facing
[AO3 Social Media AU Work Skins example](https://archiveofourown.org/collections/ao3_socmed_work_skin/works/47803507),
and current otwarchive source for the
[embed sanitizer](https://github.com/otwcode/otwarchive/blob/master/lib/otw_sanitize/embed_sanitizer.rb),
[media sanitizer](https://github.com/otwcode/otwarchive/blob/master/lib/otw_sanitize/media_sanitizer.rb)
and [HTML-cleaner routing](https://github.com/otwcode/otwarchive/blob/master/lib/html_cleaner.rb).

The supplied URL is a five-minute YouTube clip whose current player metadata
allows embedding. Both its ordinary and privacy-enhanced embed endpoints
respond successfully. The supplied AO3 Twitter template independently contains
three direct-file video players and two audio players after AO3 read-back.
Together they cover both supported paths: approved hosted-player embeds and
native media. AO3's FAQ and source code establish why those results are
supported.

## 36. AO3 can play media, but it does not host media — **VERIFIED**

AO3 supports text works containing externally hosted video and audio. There are
two separate playback paths:

1. an approved hosting site's player, sanitized into an `iframe`, `embed` or
   legacy `object` block;
2. a direct HTTP(S) media file played by the browser through native `video` or
   `audio` markup.

In both cases the bytes stay on the external host. If YouTube removes a clip,
an archive.org item changes, a direct-file host blocks CORS, or the reader
blocks third-party content, AO3 cannot repair it. “Playable on AO3” must never
be described as “uploaded to AO3” or “preserved by AO3.”

## 37. Approved player embeds are a field-specific exception — **VERIFIED**

AO3's base sanitizer removes `iframe` and its contents. In the work/chapter
`content` field, `HtmlCleaner` first applies a special `EmbedSanitizer`. That
transformer allowlists only recognized player hosts, cleans the node, and then
marks it safe for the base pass.

The current official video-player list includes 4shared, archive.org, Bilibili,
Critical Commons, Google, vidders.net, viddertube, Vimeo and YouTube. The source
also explicitly recognizes both `youtube.com` and `youtube-nocookie.com`.
Arbitrary iframes are still removed.

For YouTube:

- paste provider embed code in AO3's **HTML editor**, not Rich Text;
- use an `/embed/VIDEO_ID` URL, not a watch-page URL;
- prefer `https://www.youtube-nocookie.com/embed/VIDEO_ID` when generating code;
- do not store or re-emit raw user-supplied iframe HTML;
- expect AO3 to strip attributes outside its iframe list.

AO3 keeps `allowfullscreen`, `frameborder`, `height`, `src`, `title`, `class`,
`type` and `width` on an approved iframe. Modern provider extras such as
`allow`, `referrerpolicy` and clipboard permissions are not in that list. A
minimal AO3-targeted embed is therefore better than blindly preserving the
entire current YouTube snippet.

## 38. Native media supports posters and caption tracks — **VERIFIED**

The native path is not merely a bare player. AO3 preserves:

- a poster image and intrinsic width/height on `video`;
- one or more `source` elements with URL and MIME type;
- `track` elements with subtitle/caption URL, language and label;
- fallback HTML inside the media element;
- a CSS class that a work skin can style.

AO3 forces controls, anonymous CORS, metadata-only preload and inline playback
defaults onto native video. This is a good safety baseline and a warning about
hosting: a file that plays when opened directly may still fail inside AO3 if
its server does not return a compatible cross-origin header.

**Reusable lesson:** a direct-media feature needs a host/CORS preflight, MIME
type, poster, title, caption track where available and an ordinary fallback
link. A URL field alone is not a complete video model.

## 39. Work Text, Preview and downloads are different environments — **VERIFIED + REPORTED**

The media transformers are configured for `content`, not every HTML-bearing
field. Do not promise that the same iframe will survive in a summary, note,
endnote, profile or skin description.

AO3's own FAQ warns that a video may fail to display in Preview even when it
works after posting. It recommends checking while logged out of the hosting
provider. A real posted/read-back fixture is therefore required; preview-only
testing is insufficient.

Likewise, an AO3 download must not be assumed to preserve or play an external
iframe/native stream. Provide nearby text—a title, source link, description or
transcript—whose meaning survives when the player, network or Creator's Style
is absent.

## 40. Playable HTML and raster exports need intentionally different fallbacks — **VERIFIED by format**

| Output | Correct video behavior |
| --- | --- |
| AO3 Work Text + work skin | Emit a sanitized approved iframe or native video; the skin styles its shell. |
| App preview | Show a poster first and load the external player only on explicit user action. |
| Save PNG | Render poster, play symbol, duration/title and optional URL text; it cannot be playable. |
| Hosted AO3 image code | Same static poster treatment because the final artifact is an image. |
| Skin-off / blocked media | Keep adjacent title, description/transcript and an ordinary HTTPS link. |
| AO3 download | Treat playback as unavailable unless separately verified for that format. |

This is a legitimate divergence from “one rendering everywhere”: one shared
media view model should feed two render variants, **interactive HTML** and
**static raster fallback**. Pretending a PNG is playable would be less faithful
than acknowledging the boundary.

## 41. Embeds expand the privacy, accessibility and durability surface — **VERIFIED + PRODUCT CONSTRAINT**

- Never autoplay. It is hostile to readers and can expose them to unexpected
  sound and third-party requests.
- Prefer privacy-enhanced YouTube URLs, while being honest that the player is
  still externally hosted.
- Give every iframe a useful title.
- Support caption tracks or an adjacent transcript/description; do not treat a
  poster's alt text as a substitute for video accessibility.
- Keep an ordinary source link available when embedding is disabled.
- Validate hosts and construct markup ourselves. Raw embed HTML is an XSS and
  sanitizer-consistency risk.
- Do not use the supplied television clip as a built-in example or asset. It is
  a research trigger, not product content.

## 42. A published work is a regression fixture, not the platform specification — **PROVEN + PRODUCT CONSTRAINT**

The supplied AO3 collection work, **Twitter Work Skin Template** by
worlds_end_valentine, shows the reader-facing combination we care about:
social-media-shaped Work Text containing externally hosted native video and
audio. Its saved page still contains the player elements after AO3 sanitization.
Use it to compare pacing, media placement, fallback copy and the experience with
Creator's Style on and off.

It is not the authority for what AO3 will continue accepting. A work can contain
old markup, depend on a host that later changes, or render differently after an
AO3 sanitizer update. The implementation hierarchy is:

1. AO3's current FAQ for author-facing promises;
2. current otwarchive sanitizer/configuration for exact accepted markup;
3. a newly posted and read-back draft for real behavior;
4. existing public works as design examples and regression comparisons.

**Reusable lesson:** save the structured source URL and accessible fallback,
not just whichever embed snippet works today. Generate the current approved
markup at export time.

## Actions from Parts 1–3

All of these are now in **`BACKLOG.md`**, which is the single ranked list —
items 2, 5, 8 and 11–15. In summary, and in order of value:

1. **Switch `.visually-hidden` to the clip recipe** (§1). Small, strictly
   better, and touches the mechanism our skin-off support depends on.
2. **`MASTER-WORK-SKIN-IMPLEMENTATION.md` §6b has been revised** on the strength
   of §3 — "one skin, one theme" was too pessimistic, and light/dark variant
   classes are now the plan.
3. **Warn about image hosting in the export dialog** (§7), alongside the two
   copy fixes already queued in the work-skin doc's §9f.
4. **The scrollable window** (§4) — the highest-value feature here for long
   conversations, and legal.
5. Emoji sizing, reaction counts, link previews, system rows (§6) — genuine
   gaps, none urgent.

## Actions from Part 4

These are specified in
`TWITTER-PLATFORM-IMPROVEMENT-IMPLEMENTATION-PLAN.md`, rather than duplicated in
the general backlog:

1. **Make Twitter replies authorable before adding more decoration** (§§27–28).
   Stable parent relationships, reply context and compact/expanded layout are
   the foundation every other Twitter component attaches to.
2. **Move quote posts to per-message data and support explicit 1–4 image
   layouts** (§§29–30). Preserve live scene identities where appropriate and
   store crop intent rather than guessing it.
3. **Add polls, translations, activity context and account labels as composable
   post blocks** (§§31–33), each with complete skin-off prose.
4. **Replace the dark-mode boolean with a light/dim/dark theme enum** (§34),
   retaining legacy fields as migration inputs.
5. **Keep fidelity selective** (§35). Validate each addition against narrative
   value, AO3 safety, accessibility and long-term image-hosting cost.

## Actions from Part 5

These are incorporated into
`TWITTER-PLATFORM-IMPROVEMENT-IMPLEMENTATION-PLAN.md`:

1. **Add one structured video object per Twitter post** (§§36–38), initially
   mutually exclusive with the image grid. Store a canonical source URL,
   title, poster, duration/description, MIME type and caption metadata—not raw
   iframe HTML.
2. **Generate two intentional output variants** (§40): an approved player for
   editable AO3 Work Text and a static poster card for PNG/hosted-image output.
3. **Gate in-app playback behind explicit user action** (§41), prefer
   privacy-enhanced YouTube embeds, never autoplay, and retain a source link and
   transcript/description when the player is unavailable.
4. **Test a posted AO3 draft, not Preview alone** (§§39, 42). Read the saved
   markup back, test logged out of the media host, disable Creator's Style, and
   exercise a downloaded-work fallback.
5. **Correct documentation and tests that assume native media is always
   stripped** (§5). Native `audio`/`video` and approved player embeds are
   field-specific Work Text exceptions; arbitrary iframes remain disallowed.
