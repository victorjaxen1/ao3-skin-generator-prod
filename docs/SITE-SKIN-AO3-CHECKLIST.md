# Site Skin — the AO3 release gate

**Phase 7 of `SITE-SKIN-IMPLEMENTATION.md`.** Everything else in that plan is
built and tested; this file is the one thing tests cannot do. Until it is filled
in, **"AO3-safe" is a well-tested prediction, not an observation** — our lint is
a model of `clean_css_code`, and the sanitizer is the only authority.

Created 13 Aug 2026. Fill it in against a real AO3 account and commit it.

---

## Why by hand

AO3 does not drop a declaration it dislikes — it refuses the whole skin. So the
question is binary per template, and one answer per template is all this costs.
There is a second, quieter thing only a manual pass can find: **AO3 stores the
*cleaned* CSS**, so reopening a saved skin in AO3's editor is a direct readout of
what the sanitizer kept. Anything missing from that box is a rule our lint does
not know about, and belongs in §7 of the plan as a numbered correction.

## How to run it

1. `/site-skin`, open a template, **Copy to AO3** without changing anything —
   the catalog is what ships, so the catalog is what gets tested.
2. AO3 → **Preferences → Skins → Create Site Skin**.
3. Title it `gate-<id>`. Leave **Type** on “Site Skin” and the role on
   **“add on to archive skin”**. The other role strips AO3's layout and this
   skin is built to sit on top of it.
4. Paste, **Submit**. Record what AO3 says.
5. **Use** it, then look at a works listing, a work, and your dashboard.
6. **Reopen the skin in AO3's editor** and diff the CSS box against what we
   emitted. Note anything absent.

Record the AO3 error text verbatim if a save fails. "It didn't work" is not
something the next person can act on.

## The sixteen templates

Saved = AO3 accepted the submit. Applied = the page visibly changed. Readback =
the reopened editor still contains every rule we emitted.

| # | Template | id | Saved | Applied | Readback clean | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Moonlit Library | `moonlit` | ⬜ | ⬜ | ⬜ | |
| 2 | Paper & Ink | `paper` | ⬜ | ⬜ | ⬜ | |
| 3 | Lavender Cloud | `lavender` | ⬜ | ⬜ | ⬜ | |
| 4 | Crimson Archive | `crimson` | ⬜ | ⬜ | ⬜ | |
| 5 | Forest Study | `forest` | ⬜ | ⬜ | ⬜ | |
| 6 | Ocean Glass | `ocean` | ⬜ | ⬜ | ⬜ | |
| 7 | Rose Tea | `rose` | ⬜ | ⬜ | ⬜ | |
| 8 | High Contrast | `contrast` | ⬜ | ⬜ | ⬜ | |
| 9 | Terminal Green | `terminal` | ⬜ | ⬜ | ⬜ | |
| 10 | Golden Hour | `golden` | ⬜ | ⬜ | ⬜ | |
| 11 | Gothic Velvet | `gothic` | ⬜ | ⬜ | ⬜ | |
| 12 | Clean Slate | `clean` | ⬜ | ⬜ | ⬜ | |
| 13 | Midnight Academia | `academia` | ⬜ | ⬜ | ⬜ | banner-ready |
| 14 | Soft Shoujo | `shoujo` | ⬜ | ⬜ | ⬜ | banner-ready |
| 15 | Neon Terminal | `neon` | ⬜ | ⬜ | ⬜ | banner-ready |
| 16 | Sun-Bleached Western | `western` | ⬜ | ⬜ | ⬜ | banner-ready |

Between them the sixteen cover every branch the compiler has except the banner
`url()` and the two later toggles, which is what the probes below are for:

- all three tag shapes (`pill` / `label` / `plain`)
- all four card radii
- divider on and off, drop cap on and off
- `tagColors` on (13 of them) and off (the six `minimal`-mood themes)
- `scrollbar` on (all sixteen — the off state emits nothing, so it cannot fail)
- both header text derivations, and `hideLogo` on four

## The named probes

These are the selectors whose scope the mock can only approximate. Each needs a
real page.

| # | Probe | Why it cannot be tested here | Result |
| --- | --- | --- | --- |
| P1 | **Drop cap on a single-chapter work** | `#chapters .userstuff` — the single-chapter path renders a bare `.userstuff`, the multi-chapter one `.userstuff.module`. §4.1 | ⬜ |
| P2 | **Drop cap on a multi-chapter work** | same selector, other branch. Confirm **one** capital per chapter and **none** on the summary or notes — the defect the prototype shipped | ⬜ |
| P3 | **Divider on both work shapes** | `hr::after` glyph and the three border longhands | ⬜ |
| P4 | **Header dropdown, logged in** | `#header .menu`, `#small_login` and the four hover/open selectors only exist for a signed-in reader | ⬜ |
| P5 | **A banner from imgur** | the one `url()` we emit, and the one thing AO3 can refuse on address grounds alone | ⬜ |
| P6 | **A banner that 404s** | the accent must still be underneath it (§4b), so a dead image degrades to the theme rather than to white | ⬜ |
| P7 | **Tag colours on a real listing and a real work page** | `li.warnings a.tag` vs `dd.warning a.tag` — two markups, and only the listing one is common | ⬜ |
| P8 | **Themed scrollbar in Chrome, and Firefox unharmed** | `::-webkit-scrollbar` is a selector AO3 has no opinion about; confirm it survives the save and that Firefox simply ignores it | ⬜ |
| P9 | **Footer and system messages** | AO3's red tile and `.notice`'s pale blue, on one dark and one light theme (§4.6, §4.8) | ⬜ |

## Known open risks, to confirm or clear while you are in there

- **8-digit hex** (plan §11). Our lint refuses `#89797925` where AO3 accepts it
  by accident. We emit no alpha colours, so nothing here should hit it — but if
  a readback shows a colour changed, this is the first suspect.
- **Comments.** We emit none, deliberately (WORK-SKIN §13). If a readback ever
  shows missing rules, do not add comments back to test the theory in a skin
  someone is using.
- **`::-webkit-scrollbar`.** Verified against `css_cleaner.rb` — selectors are
  never validated, only declarations — but this is the first pseudo-element we
  ship that AO3's own stylesheets never use. P8 is what turns that reading into
  an observation.

## Outcome

Fill this in when the table is complete.

- Date run:
- AO3 account used (not the password):
- Templates that failed to save:
- Rules the readback showed missing:
- Corrections written back into `SITE-SKIN-IMPLEMENTATION.md` §7:
