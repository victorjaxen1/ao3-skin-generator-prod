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
- **`header.gradient`, as of 17 Aug 2026: `diagonal` on eight, `vertical` on
  two, `none` on the six `minimal`-mood themes.** This changed what this table
  proves. Ten of the sixteen now carry a `linear-gradient` in the CSS a user
  pastes, so P11's gradient question is no longer a scratch-skin curiosity —
  **a refusal here fails ten templates outright**, and it would fail them at
  save time with AO3's own error rather than quietly.
- `reading.requiredTagsAsText` is **off in all sixteen**, deliberately (it
  rewrites every listing on the archive, which a palette should not do). It is
  therefore covered by P13 and by nothing in this table.
- **`box-shadow: none`, as of 17 Aug 2026 (§22e), on all sixteen.** This is the
  **first `box-shadow` the compiler has ever emitted**, so every template in this
  table now depends on P11's shadow row being right. The value is only the
  keyword `none`, which is the safest form there is — but the *property* had
  never been through the archive, and until it has, sixteen templates rest on
  the same unverified reading. Three selectors carry it: `.listbox`,
  `.listbox .index`, `.wrapper:has(> table, > .meta)`.
- **Two selector shapes AO3's sanitizer has never seen from us**, both also new
  on 17 Aug 2026: `:has()` and `:nth-of-type(even)`. Neither should matter —
  `clean_css_code` validates declarations and refuses only `@font-face` in a
  selector (§3) — and that reading is exactly what P8 was written to turn into an
  observation for `::-webkit-scrollbar`. **Check the readback for these two the
  same way.** A selector AO3 silently drops fails quietly, which is the worse
  direction.

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
| P10 | **A work that has its own work skin** — read it with a site skin on | The bug that shipped on 13 Aug 2026 (§14): the drop cap landed on every chat bubble in the work. Confirm one capital at the top of the chapter and none inside the author's markup, that the author's own `<hr>` keeps its own styling, and that their fonts and backgrounds survive. Use a work made with this app's conversation generator | ⬜ |
| P11 | **The §17 capability probe** — a scratch skin, not a template | Settles plan §17 against the only authority. See below | ⬜ |
| P12 | **A header fade, alone and under a banner** | The first gradient we actually *ship* (§18b's header-gradient row, built 16 Aug 2026). **As of 17 Aug 2026 ten templates carry one by default**, so the first half of this probe now happens on its own the moment you save Moonlit Library — what still needs doing by hand is the **layered** form: add a banner to Midnight Academia and save. That emits `background-image: url("…"), linear-gradient(…)`, a different shape from P11's bare gradient and the one a user will really produce. Confirm both survive the readback, that the header reads as one continuous fade rather than two bands, and that AO3's navigation strip does not reappear in its own colour | ⬜ |
| P14 | **The four page types the mock could not render** — Profile, Collections, Own works, and the filter sidebar, on **one dark template** | Added 17 Aug 2026 from the §22 audit, and **rewritten the same day, because §22e landed**: this is no longer "record how wrong it looks", it is the confirmation that the region pass worked. All four are built from `.listbox`, which AO3 paints `#ddd` with a `#fff` inner panel, a white 1px ring *outside* the box and an inset grey bevel *inside* the panel. Confirm on each page that **the outer box and the inner panel are different colours** (the polarity — outer takes the page colour, inner the card colour, and painting both alike is the failure that looks correct in a diff), that **neither keeps a light edge** (the two `box-shadow: none` declarations are what remove the ring and the bevel, and a background colour alone cannot), and that headings on them are legible. Then glance at a work's metadata table (`dl.meta`'s border, and the grey halo on the `.wrapper` AO3 always puts around it), the statistics page's zebra rows, and — §22c — **any listing at all**, where every relationship tag should have lost its pale grey chip while still painting on hover | ⬜ |
| P13 | **Required tags as words, on a real listing** | Off in every template (§18c-2), so nothing in the table above reaches it. Turn "Required tags as words" on, save, and open a works listing. Nine declarations across eight selectors, all of them undoing AO3's own `13-group-blurb.css` — which is the risk: our mock reproduces that stylesheet from a transcription, and the live page is the only place the **cascade** is real. Confirm the four phrases are legible and in the flow, that no sprite remains behind them, that the 65px gutter is reclaimed, and — the one our mock cannot show — that a **bookmark** blurb and a **series** blurb are not left broken by the same rules. `.bookmark .short .header` has a `min-height` of its own | ⬜ |

### P11 in detail — do this one first, it unblocks the roadmap

Plan §17 claimed our lint refused five classes of CSS that AO3 accepts, and §18
builds on that claim. **Those corrections have now shipped** (Phase 11, 16 Aug
2026), which raises the stakes here rather than lowering them: the product is
now emitting on the strength of a model rather than merely refusing on it. The
evidence is still a **faithful port** of `css_cleaner.rb`
(`scripts/ao3-sanitizer-oracle.mjs`), which is still a model — the same category
of thing that was wrong four times before (§7).

Save this as a scratch site skin, then **reopen it** and record which
declarations came back. AO3 stores the *cleaned* CSS, so the readback is a direct
readout of what the sanitizer kept. Nothing here ships; it is a question put to
the archive.

```css
.p11-gradient-a { background: linear-gradient(to bottom, #fab0b9, #ce9ffd); }
.p11-gradient-b { background-image: radial-gradient(circle at 50% 0%, #402060 0%, #100818 70%); }
.p11-gradient-c { background: repeating-linear-gradient(45deg, #eee 0px, #eee 10px, #ddd 10px, #ddd 20px); }
.p11-gradient-d { border-image: linear-gradient(45deg, #bf242c 0%, #7fcf5d 100%) 1; }
.p11-shadow    { box-shadow: 0 2px 8px #00000044; }
.p11-hex7      { color: #0f4a59c; }
.p11-units     { margin: 0.5375em 0; border-radius: 0.75rem; max-width: 70ch; }
.p11-grid      { grid-template-columns: 1fr 1fr; }
.p11-ratio     { aspect-ratio: 16/9; }
.p11-font      { font: Georgia, serif; }
```

| Line | Plan claims | AO3 said | |
| --- | --- | --- | --- |
| `p11-gradient-a`…`d` | kept — `sanitize_css_gradient`, Correction 5 | | ⬜ |
| `p11-shadow` | kept — 8-digit hex reads as `#000000` + `44`, Correction 7 | | ⬜ |
| `p11-hex7` | kept — same mechanism | | ⬜ |
| `p11-units` | all three kept — the value grammar repeats, Correction 6 | | ⬜ |
| `p11-grid` | kept — `1fr` is `1` + `fr` | | ⬜ |
| `p11-ratio` | kept — the fourth branch, Correction 9 | | ⬜ |
| `p11-font` | kept — bare keywords tokenise, Correction 8 | | ⬜ |

**A rule set whose declarations are all dropped is an error, not a silent
no-op** (§3), so anything AO3 refuses should announce itself at save time and
name the selector. If a whole class is refused, that is a correction to write
back into §17 — and §18b's roadmap shrinks accordingly.

**A note on what this table can and cannot tell you.** Every row above asks
"did AO3 accept it", which is the sanitizer question. It does **not** ask "does
the page look finished" — and §22 found that on four common page types the
answer was no, for reasons that have nothing to do with the sanitizer. A template
can pass every column here and still leave a reader looking at a white panel on
a black theme. P14 is the row that asks the other question.

**`p11-shadow` is now load-bearing.** It was written when `box-shadow` was
something §18b *might* want. Since §22e (17 Aug 2026) all sixteen templates ship
`box-shadow: none`, so a refusal on that property is no longer a note for the
roadmap — it leaves a white ring around every listbox on the archive, on every
template, and the reader has no way to tell it is AO3's doing rather than ours.
The value we ship is the bare keyword `none` rather than the 8-digit hex this
line probes, so the two can fail independently: **if `p11-shadow` is refused,
add `.p11-shadow-none { box-shadow: none; }` and save again before concluding
anything**, because that is the form sixteen templates actually depend on.

## Known open risks, to confirm or clear while you are in there

- **8-digit hex** (plan §11, §17 Correction 7). Our lint refuses `#89797925`
  where AO3 accepts it by accident. We emit no alpha colours today, so nothing
  in the sixteen templates should hit it — but if a readback shows a colour
  changed, this is the first suspect. **P11 settles it**, and `box-shadow` in
  §18b depends on the answer.
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
- P11 result, and any correction to §17 / the §18b roadmap:
