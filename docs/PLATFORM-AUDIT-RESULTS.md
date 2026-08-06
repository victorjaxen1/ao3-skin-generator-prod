# Platform Workflow Audit — Results

Implementation of [PLATFORM-AUDIT-PLAN.md](./PLATFORM-AUDIT-PLAN.md). All seven
phases are done. This records what changed, what the plan got wrong, and what is
still outstanding.

---

## Corrections to the plan

The plan was accurate on almost everything. Four findings differ.

### 1. More settings were dead than §1.4 listed

§1.4 named four dead settings. The iOS header was a five-way branch on
(platform × has-background-image), and its trailing `else` was **unreachable** —
`isIOS` is either true or false, and both were already caught by earlier
branches. Everything that lived only in that branch never rendered:

| Setting | Plan's verdict | Actual |
| --- | --- | --- |
| `iosShowStatusBar` | "move to Advanced" | **Dead** — only in the unreachable branch |
| `iosStatusBarTime` | "hard-code 9:41" | **Dead** — same |
| `iosShowHeader` | not mentioned | **Dead** — same |
| `androidShowStatus` | not mentioned | **Dead** — same |
| `androidStatusText` | not mentioned | **Dead** — same |

Worse, both platforms **ship with a default header image**, so the image
branches were the live ones — and those were the branches that ignored group
names. WhatsApp group mode showed the contact's name, not the group's.

The header is now one code path per platform with the background image as a
detail, so a setting cannot be honoured on one branch and ignored on another.
Locked in by `tests/settings-render.spec.ts`.

### 2. "New tweets show `0 0 0`" (§3.3) does not reproduce

The generator already suppresses falsy metrics (`${likes ? … : ''}`), so a tweet
with zero engagement renders no metrics at all rather than three zeros. No fix
needed. Views and Bookmarks *were* genuinely uneditable — inputs added.

### 3. Twitter handle and verified were already render-time

§3.3 said identity is stamped at send time. Half true: `twitterHandle` and
`twitterVerified` already read from settings at render time. Only **display name
and avatar** were stamped (and from `messages[0]`, not the message itself).
Those two are now resolved at render time like the others.

### 4. The proxy is a Next API route, not a standalone Netlify function

§4.3 said "port it to a Netlify function". Implemented as `src/pages/api/image-proxy.ts`
instead: the Netlify Next plugin deploys it as a serverless function either way,
and as a route it also runs under `next dev`/`next start`, which is what makes
it testable locally. Same security controls, one implementation.

---

## Per-platform audit tables

Only rows that changed are listed.

### iMessage (`ios`) — 15 decisions → 8, plus 4 in Advanced

| Control | Location | Vital? | Action |
| --- | --- | --- | --- |
| Delivered indicator | Settings → Display | No | **Deleted** — dead |
| Group name | Settings → Group chat | Yes | **Implemented** — now renders in the header |
| Contact name | Settings → Contact | — | **Deleted** — duplicated the header title |
| Status bar time | Settings → Display | No | **Deleted** — hard-coded to 9:41 |
| Phone status bar | Settings → Display | No | Moved to Advanced; **now actually renders** |
| Typing bar | Settings → Display | No | Moved to Advanced |
| Header/footer background | Settings | No | Moved to Advanced |
| Read receipt | Settings → Display | Yes | Kept, sublabel added |

### WhatsApp (`android`) — 16 decisions → 7, plus 2 in Advanced

| Control | Location | Vital? | Action |
| --- | --- | --- | --- |
| WhatsApp style | Settings → Appearance | No | **Deleted** — dead and incoherent (the platform *is* WhatsApp) |
| Read receipt | Settings → Display | No | **Deleted** — dead; Checkmarks does the same job and works |
| Sent/Received bubble colour | Settings → Appearance | No | **Deleted** — authentic colours hard-coded in `handleSelectPlatform` |
| Online status / Status text | Settings → Display | Yes | **Implemented** — now renders under the contact name |
| Group name | Settings → Group chat | Yes | **Fixed** — was ignored on the default (header-image) path |
| Contact name | Settings → Contact | — | **Deleted** — duplicated the header title |
| Header/footer background | Settings | No | Moved to Advanced |

### X / Twitter (`twitter`)

| Control | Location | Vital? | Action |
| --- | --- | --- | --- |
| Display name | Settings → Profile | Yes | **Moved to the header title**; identity now resolved at render time |
| Quote avatar / image / verified | — | Yes | **Built** — rendered but had no controls |
| Views, Replies | Per-message | Yes | **Added** — in the schema, previously uneditable |
| Per-message handle | Per-message | Yes | **Fixed** — now sets `useCustomIdentity`, so editing it does something |
| "Posting as" selector | Compose bar | Yes | **Fixed** — fed by the Character Library, not just three starter templates |

### Google (`google`)

| Control | Location | Vital? | Action |
| --- | --- | --- | --- |
| Send button | Compose bar | — | **Fixed** — was enabled on empty input and did nothing |
| Search query | Settings → Search | — | **Deleted** — duplicated the header title, which is now labelled "Search query" |
| Results count / time | Settings → Display | No | **Generated** from the query; overrides moved to Advanced |
| Autocomplete suggestions | — | Yes | **Built** — rendered but had no control |
| Engine variant | Settings → Search | Yes | Kept; relabelled ("Naver (Korean)") |
| Compose affordances | Compose bar | — | Relabelled to "Add result" with a `+` icon |

---

## Definition of done (§7)

- [x] All four workflows run cold-start → export, desktop and mobile.
- [x] Every remaining control visibly changes the preview. The dead ones are
      deleted or implemented; none were left as decoration.
- [x] Labels rewritten for a non-technical reader; placeholders show real
      examples ("Time, e.g. 10:15", not "Timestamp").
- [x] Paste, upload, bad URL and hotlink-blocked URL each produce a clear
      outcome. No silent failures.
- [x] Cross-origin images are present in the export — images are proxied to
      `data:` URIs before rasterising, and anything that can't be fetched raises
      a warning instead of vanishing.
- [x] Suite green: 90 passed, 0 failed, 4 skipped (`--workers=1`, local build).
      Up from 46; the 44 new ones are the four assertion specs listed in
      `tests/README.md`.
- [x] No Cloudinary in code, env files, the README, or the legal pages.

---

## Image proxy abuse limits

`/api/image-proxy` fetches arbitrary URLs on request, so it needs to not be
usable as a general-purpose open proxy. Beyond the SSRF/HTTPS/image-only/8 MB
controls ported from the reference:

- **Cross-site calls are refused.** Browsers attach `Origin` to every
  cross-origin POST, so a request from someone else's page gets a 403. A
  missing `Origin` is allowed rather than blocked, so a browser that omits it
  can't break exports.
- **60 requests per minute per IP**, returning 429 with `Retry-After`. Keyed on
  `x-nf-client-connection-ip` (Netlify sets it, so a caller can't forge it),
  falling back to the *last* `X-Forwarded-For` entry — the first is
  client-supplied and would let an abuser rotate past the limit.

**Known limit, stated plainly:** the counter lives in one warm serverless
instance's memory. It throttles a single caller hitting a single instance; it is
not a distributed quota and it resets on cold start. That is proportionate to a
free fandom tool, not to sustained targeted abuse. If that ever arrives, this
needs a shared store (Netlify Blobs or Upstash) — the swap is confined to
`rateLimit()`.

---

## Still outstanding

1. **Historical docs still mention Cloudinary** — `CHANGELOG.md`,
   `SPRINT-1-COMPLETE.md`, `UX-SPRINT-TRACKER.md`, `phases plan.txt`,
   `docs/IOS-GROUP-CHAT-FEATURE.md`. These are records of what happened at the
   time and were deliberately not rewritten.
2. **Playwright runs need `--workers=1` on this machine.** With two workers,
   heavy tests time out from contention, not from real failures. Left as a
   documented convention rather than pinned in `playwright.config.ts`, so CI or
   a faster machine can still parallelise.

The Cloudinary environment variables have been deleted from the Netlify
dashboard; only `NEXT_PUBLIC_IMGBB_API_KEY` and `NEXT_PUBLIC_GA_MEASUREMENT_ID`
remain.
