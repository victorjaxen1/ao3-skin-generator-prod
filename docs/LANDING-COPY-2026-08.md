# SwipePages landing copy — `ao3skingen.wordfokus.com`

**Drafted:** August 15, 2026
**Replaces:** the live page transcribed the same day
**Why:** Section 11.6 Tier 1 of the implementation doc. The page sells two tools;
the product has three. It describes a feature set from before the August 13–15
platform rebuilds. Every claim below is checked against the shipped code.

**Paste target:** SwipePages, section by section. Nothing here needs application
code. Links are already correct on the live page — do not change them.

---

## The three changes that matter most

1. **"Two Free Tools" becomes three.** Work skins — the accessible real-text
   output — are missing from the live page entirely. That is the one thing this
   product does that a generic screenshot site cannot, and it is not mentioned.
2. **The headline stops leading with "fake screenshots."** That framing puts you
   in a category you win on nothing. Lead with what only you do.
3. **The feature list catches up to August.** Replies, photo grids, link cards,
   voice notes, video, reactions, group chats and playable media all shipped and
   none of them appear anywhere public.

Also fix: the footer reads **© 2025**.

---

## Hero

**Headline**

> Social-media scenes for AO3

**Subheadline**

> Build a text conversation, a tweet thread or a search page — then put it in
> your chapter as a picture, or as real text your readers can select, search and
> hear read aloud.

**Eyebrow / trust line**

> Free to use • No signup • Your editable project stays in this browser

**Buttons**

- `Start a conversation` → `https://app.ao3skingen.wordfokus.com`
- `Build a site skin` → `https://app.ao3skingen.wordfokus.com/site-skin`

**Under the buttons**

> Came here from a fic? The small credit under a screenshot points here.
> Everything is free, and you can make the same thing in a couple of minutes.

---

## Section: Three free tools for Archive of Our Own

*(currently "Two Free Tools" — this is the structural fix)*

### 1. Screenshots — *for your readers*

> The quickest thing that works. Build the conversation, take the picture, paste
> it into your chapter.

- iMessage, WhatsApp, X/Twitter, Google
- Goes **inside a chapter**
- Nothing to set up on AO3 — it's an image
- Best when you just want it done

`Make a screenshot`

### 2. Work skins — *for your readers* — **badge: the one people miss**

> The same conversation as **real text**. It reflows on a phone, readers can
> select and copy it, screen readers can read it, and it survives into an EPUB
> download.

- All four platforms, light and dark, in one skin
- Goes in **Preferences → Skins**, once — then you reuse it
- A fic can only have one work skin, so one that covers every platform matters
- Best for long conversations, and for readers on phones

`Build a work skin`

### 3. Site skins — *for you*

> Recolour AO3 itself — page, cards, links, tags, fonts — then copy the CSS into
> your preferences.

- 16 starting points, dark and light
- Goes in **Preferences → Skins**
- Add your own header banner
- Only **you** see it, on every AO3 page

`Build a site skin`

---

## Comparison table

*(Keep this. It is the clearest thing on the WordPress hub and the landing page
has no equivalent.)*

| | Screenshot | Work skin | Site skin |
|---|---|---|---|
| Who sees it | Every reader | Every reader | Only you |
| Where it goes | In the chapter | Chapter + Preferences | Preferences |
| Setup on AO3 | None | Once, then reuse | Once |
| Selectable text | No — it's a picture | Yes | n/a |
| Reflows on a phone | No, readers zoom | Yes | n/a |
| Screen readers | No | Yes | n/a |

---

## Section: What you get

*(This replaces the "Tool Capabilities" list, which is from before August.)*

### Four platforms that look right

iMessage and WhatsApp with the correct bubbles, tails, delivery ticks and read
receipts. X/Twitter with verified badges, quote posts, polls and threads. Google,
in three flavours including Naver.

### Messages that do more than talk

Reply to an earlier message and it carries the quoted original above it. Add four
photos in the grid the real app uses, a link that unfurls into a card with its own
title and thumbnail, or a voice note with its length. Date breaks and the small
grey lines like "Alex added Sam to the chat."

### Reactions and group chats

Tap a message to add a reaction — where iMessage really puts a tapback and where
WhatsApp really puts its pill, stacking when more than one person picks the same
one. Group chats give each person their own name colour and photo.

### Voice notes and video that actually play

In a work skin, a voice note or a video is a real player sitting in your chapter.
Your readers press play on AO3 itself, without leaving the page. Screenshots keep
a still poster card instead, because a picture can't play.

Nothing is uploaded either way — you point at a file that already lives
somewhere. The same warning as images applies: if that host stops serving it, it
goes quiet in every chapter you have already posted.

### A cast you set up once

Say who's in the conversation in one place — names, handles, photos. Rename
someone and every message they have already sent follows. Two characters can
share a first name and stay separate.

### Checked before you paste

AO3 refuses an entire skin over one CSS property it doesn't allow, and its list is
stricter and stranger than you'd guess. Everything is checked against AO3's real
rules — all 182 properties and 20 shorthands — before you paste, so you don't find
out afterwards.

### Live preview, and auto-save

Watch it change as you work. Site skins preview over a mock AO3 page — a work
listing, a chapter, your dashboard — using the exact CSS you'll copy. Your work
saves in this browser as you type; close the tab and pick up where you left off.

---

## Section: Also by the same developer

*(New. This is Section 11.6 Tier 1 — the product lineup, on your own page, where
AO3's rules do not reach. Keep it plain and factual: a shelf, not a pitch. It
belongs low on the page, below the tools and features.)*

> **Built by one person, in the evenings**
>
> AO3 SkinGen is free and stays free. If you write, two other things I make may
> be useful — both separate Google Docs add-ons, neither needed for anything on
> this page.
>
> **WordFokus** — drafting in Google Docs that won't let you edit as you write.
> It locks what you have already typed, so you stop re-polishing the first
> sentence and the chapter actually gets finished. Editing comes afterwards, when
> there is something to edit.
> `Visit WordFokus` → `https://app.wordfokus.com`
>
> **WorldKonstruct** — a story bible that lives beside the manuscript:
> characters, locations, factions, events, with @mentions that update themselves
> when you rename someone. Point it at a draft you've already written and it can
> find the elements for you. Useful when a fic turns into a series and you can no
> longer remember what you decided in chapter 3.
> `Visit WorldKonstruct` → `https://app.wordfokus.com/worldkonstruct`

**Why both lines are worded that way.** Each names a *mechanism*, not a category.

*WordFokus* is not "distraction-free writing" — that phrase covers a hundred apps
and describes nothing. Refusing to let you edit while you draft is unusual,
immediately understandable, and the actual reason someone would install it. It
also fits this audience precisely: an author who has just finished a fic knows
exactly how long they spent rewriting the first paragraph.

*WorldKonstruct* rests on two specifics, both true of the shipped add-on:
*manuscript scanning*, which makes it relevant to someone who has already
finished writing — the state nearly every SkinGen visitor is in — and *series
bibles*, the one long-fic problem this audience genuinely has. Avoid generic
"organise your worldbuilding" copy; it describes a job most fanfic authors don't
have, because canon already did it.

**Two constraints on this block, from Section 2 of the implementation doc:**

- It lives on **your** pages and inside the app only. It must never appear in
  generated work-skin HTML, CSS, PNG output, or anything an author pastes into
  AO3.
- Keep it away from the Ko-fi block. Section 4.5 forbids a donation ask and a
  product promotion sharing a surface.

---

## Footer

> © 2026 AO3 Skin Generator. An unofficial fan tool, not affiliated with the
> Organization for Transformative Works. Built by the creator of WordFokus.

---

## Decisions taken on August 15, 2026

### 1. The "1,200+ AO3 writers" claim — **removed**

It was in the trust bar of both hub files. Section 3.2 flagged an unsupported user
count as a stale claim, and analytics is consent-gated and opt-in, so it
undercounts by design and could never have substantiated the figure.

The trust bar now reads:

> ✨ Free Forever • No Signup Required • Your Editable Project Stays In This Browser

**Note the exact wording, and do not "improve" it.** The obvious replacement —
"your work never leaves your browser" — is the stale claim Section 3.2 already
had removed once, and it is false: the hosted-image path uploads a rendered scene
by design. "Editable project" is the qualifier that makes the sentence true, and
it matches the wording already live on the SwipePages landing. Keep all three
surfaces saying the same thing.

### 2. The WorldKonstruct destination — **supplied**

`https://app.wordfokus.com/worldkonstruct`, a live Google Docs add-on (freemium,
paid features, optional AI). Confirmed against its Marketplace listing.

A plain outbound link is fine to launch with. Section 11.6 Tier 3 eventually wants
an owned `/go/worldkonstruct` redirect instead, so the click can be counted
without leaking a referrer or anything about the project.

---

## What is already correct — don't "fix" these

- Every link on the live landing already points at
  `app.ao3skingen.wordfokus.com`. Verified August 15.
- "Free to use • No signup required • Your editable project stays in this
  browser" is accurate and carefully worded. Keep it exactly.
- The AO3 tutorial and template gallery links are good.
- Do not add an email signup. Section 13.4 gates that behind a maintained
  compatibility ledger that does not exist yet.
