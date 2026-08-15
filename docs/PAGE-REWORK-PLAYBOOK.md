# Page rework playbook

**Written:** August 15, 2026, immediately after reworking the SwipePages landing
page, so the next page starts from a process rather than from scratch.

**Next target:** `https://ao3skingen.wordfokus.com/examples-gallery` — see the
section at the end, which applies this playbook to that page specifically.

This is the exact sequence used on the landing page, including the two steps
that were skipped first time and cost the most.

---

## 0. Know which surface you are editing, before you edit anything

The single biggest waste on the landing rework: an hour of work went into the
wrong file, because three pages share a name and a look.

| Surface | Lives at | Source in this repo | Deployable from here? |
| --- | --- | --- | --- |
| SwipePages landing | `ao3skingen.wordfokus.com` | `docs/landing-swipepages-2026-08.html` | **No** — external builder, paste only |
| WordPress hub | `www.wordfokus.com/ao3skingen/` | `docs/landing-wordfokus-ao3skingen-WORDPRESS.html` | **No** — paste into a Custom HTML block |
| Static pages | `app.ao3skingen.wordfokus.com/*` | `public/*.html` | **Yes** — deploys with the app |
| The app | `app.ao3skingen.wordfokus.com` | `src/` | **Yes** |

**Do this first, every time:**

```bash
# What does the live page actually say right now?
#   (Do not trust the repo copy - they drift independently. §Learning 10.)
curl -s https://<the-page>/ | grep -oE '<title>[^<]*|canonical" href="[^"]*'
```

Then fetch the live page and read its real copy. On the landing rework the repo
copy was *newer and better* than what was live, which inverted the whole plan.

---

## 1. Audit the live page against the code, not against memory

Four checks, in this order. Each one caught something real:

```bash
# 1. Dead hosts. ao3skingen.netlify.app is a 301, not a home.
grep -c "netlify.app" <file>

# 2. Unsupported claims. Any number that is not derived from code is a liability.
grep -nE '[0-9,]+\+? (writers|users|authors)|used by [0-9]' <file>

# 3. Overbroad privacy claims. This one has come back three times.
grep -niE 'never leaves your browser|data never leaves|your work stays' <file>

# 4. Stale counts that ARE derived from code.
npm run audit:ao3-css   # property/shorthand counts printed in copy
```

**The privacy wording is a trap and keeps being re-broken.** The only correct
form is:

> Your **editable project** stays in this browser.

Not "your work", not "your data", not "never leaves". The hosted-image path
uploads a rendered scene *by design*. The qualifier is what makes the sentence
true. All three surfaces must say the same thing.

---

## 2. Say what the product actually does

The recurring failure across every surface: copy describes the product as it was
eighteen months ago. Before writing, diff the feature list against the code.

For the current build that means naming: structured replies, four-image grids,
link cards, voice notes, video, playable media in work-skin output, Tapback
stacking, date and system events, threads, quote posts, polls, and the canonical
cast.

**Name a mechanism, not a category.** This rule was learned twice on the same
page:

- ✗ "Distraction-free writing" — describes a hundred apps, names nothing.
  ✓ "Won't let you edit as you write."
- ✗ "Organise your worldbuilding" — a job most fanfiction authors do not have,
  because canon already did it.
  ✓ "Point it at a draft you have already written and it finds the characters."

---

## 3. Generate imagery from the app itself

Never hand-make a mockup, and never leave the page pointing at a third-party
image host. Learning 18: a default that points at someone else's host is a
permanence bug.

```bash
npm run build
npm run start -- -p 3400          # pick a free port; old servers linger
node scripts/capture-hero.mjs http://127.0.0.1:3400 "$(pwd)/public/<name>.png"
```

`scripts/capture-hero.mjs` emits three files from one run:

| Output | Size | Use |
| --- | --- | --- |
| `<name>.png` | full height | articles, long-form |
| `<name>-crop.png` | 750×1400 | page hero |
| `<name>-social.png` | 2400×1260 | `og:image` / `twitter:image` |

Then reference them at `https://app.ao3skingen.wordfokus.com/<name>.png`, because
`public/` deploys with the app and the app is a host you control.

**Four things the script does deliberately — keep them if you adapt it:**

1. **Captures the DOM, not Save PNG.** html2canvas has a documented history of
   raster-only defects. A promotional image must not ship one.
2. **Declines analytics.** A screenshot must never imply consent was given.
3. **Renders the scene standalone.** Expanding the preview's own scroll container
   was tried first; the fixed export bar bled over a 3000px-tall scene.
4. **Reports failed image requests.** A hero with broken images is worse than a
   stale one.

**Look at every image you generate.** Learning 15 is not optional and it earned
its place again during this rework — see §5.

---

## 4. Validate the HTML before you paste it

```bash
node -e "
const h=require('fs').readFileSync('<file>','utf8').replace(/<!--[\s\S]*?-->/g,'');
for(const [n,o,c] of [['div',/<div/g,/<\/div>/g],['section',/<section/g,/<\/section>/g],['a',/<a /g,/<\/a>/g]]){
  const x=(h.match(o)||[]).length,y=(h.match(c)||[]).length;
  console.log(n.padEnd(8),x,'/',y,x===y?'OK':'MISMATCH');
}"
```

**Strip comments first.** Two false alarms during the landing rework came from a
naive regex counting the word `<section>` inside an HTML comment, and from `<li`
matching `<link>` and `<line>`. Confirm a mismatch is real before chasing it.

---

## 5. If the page touches the app, look at a real export

Anything that changes a chat renderer, the export clone, or scene CSS needs an
actual PNG opened and inspected:

```bash
node scripts/capture-export-png.mjs http://127.0.0.1:3400 "$(pwd)/tmp/check.png"
```

**This found a shipped bug during the landing rework.** The hero's first draft
used Save PNG, and "This is what you are driving into." came out sliced through
its second line with the photo grid painted on top. Preview was correct; only
the raster was wrong. It was the same defect fixed for Twitter months earlier —
iMessage and WhatsApp grew the same rich blocks in August and never got the fix.

Note the process failure worth copying: **the first fix was wrong.** Rounding the
bubble's fractional line-height up to a whole pixel seemed obviously right and
changed nothing, which is only knowable by exporting again and looking. Do not
mark a raster bug fixed without a fresh picture.

---

## 6. Commit boundaries

One commit per concern, because a copy change and a renderer change have very
different review needs:

1. copy and links
2. generated imagery + the script that made it
3. any application fix the imagery uncovered

Every commit that changes AO3-bound output must state that no commercial string
reaches it. `tests/more-tools.unit.spec.ts` enforces this.

---

## Applying this to the examples gallery

## What is true today

- Live and returning 200 at **both** `ao3skingen.wordfokus.com/examples-gallery`
  and `app.ao3skingen.wordfokus.com/examples-gallery.html`.
- Source is `public/examples-gallery.html` (86KB), so it **deploys with the app**
  — unlike the landing page, this one you can actually ship from here.
- It has **no `<canonical>` tag**, while serving identical content on two hosts.
- It is linked from **three footers** and from **nowhere in the application**.

## The three problems, in order of cost

**1. Duplicate content with no canonical.** Two hosts, same page, no signal about
which is authoritative. This is a self-inflicted SEO wound on a page that should
be pulling search traffic for "ao3 work skin examples". Add
`<link rel="canonical" href="https://ao3skingen.wordfokus.com/examples-gallery">`
and pick that host, since it is the one already linked publicly.

**2. Zero entry points from the app.** This is the "completely cut out" problem.
A visitor inside the tool cannot reach the gallery, so it only works as a landing
target for people who arrive from search — and see problem 1.

**3. The content is almost certainly stale**, on the same evidence as every other
surface: it predates the August platform rebuilds, so it shows none of the rich
authoring the tool now does. Verify before rewriting.

## Where to link it from the app — recommendation

**Put it on the platform picker, beside the existing example buttons.**

That is the one screen where a visitor is *already choosing an example* and is
therefore in exactly the right frame of mind, and it is a full-page entry screen
with no composer to occlude. `MoreTools` was added to the same screen for the
same reason, so the precedent and the placement rules already exist.

Concretely: one quiet link under the example row — "See all examples →" — not a
card and not a modal.

**Do not** put it in the export bar or the editor. §4.2 is explicit that growth
elements must not compete with the live preview, and the export bar's occlusion
behaviour is pinned by tests.

**Second-best placement**, if you want it above the app: promote it out of the
footers into the landing page's tools section, where someone is choosing between
screenshots, work skins and site skins.

## What you may be missing

Three things, and the third is the one I would actually act on:

1. **A picker-adjacent link is worth more than any footer link**, because footers
   are where links go to be ignored. You already have three footer links and the
   page is still described as cut out — that is the evidence.

2. **The gallery competes with the app's own built-in examples.** The picker
   already lists starter examples that load with one click. A separate gallery
   page has to justify itself against that: it should be the *browsable, linkable,
   search-visible* view — the thing you can send someone — rather than a second
   way to start a project. Decide which job it does before rewriting it.

3. **Its analytics entry point is broken in a way that matters more here than
   anywhere else.** The picker fires `template_selected` with the example id, and
   the newest, richest examples were invisible until this was fixed today. But
   `EXAMPLE_LABELS` in `PlatformPicker.tsx` still has **no entry** for
   `ios-rich-group-scene`, `twitter-quote-post`, `twitter-four-image-post`,
   `twitter-video-post`, or `twitter-long-thread` — so the picker renders their
   raw ids as button text. A visitor currently sees a button labelled
   `ios-rich-group-scene`.

   This is confirmed twice over: `EXAMPLE_LABELS` holds 13 entries against 18
   examples, and `scripts/capture-hero.mjs` clicks that button by matching the
   literal string `ios-rich-group-scene`, which only works because that is the
   visible label.

   It is a five-minute fix, it is on the exact screen this playbook recommends
   linking the gallery from, and it should be done before driving any traffic
   there. Add the label and the analytics id together — `analytics.unit.spec.ts`
   already enforces the second half.
