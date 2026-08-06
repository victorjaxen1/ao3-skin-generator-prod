# UX friction tests

Run against the live site:

```bash
npx playwright test                      # both viewports
npx playwright test --project=mobile     # phone only
npx playwright show-report               # screenshots + traces
```

Point at a local build instead:

```bash
npm run build && npm run start
UX_BASE_URL=http://localhost:3000 npx playwright test --workers=1
```

Use `--workers=1`. With the default two workers the heavier specs time out from
contention rather than from real failures. A local run is also the only way to
exercise `image-proxy.spec.ts`, which needs the `/api/image-proxy` route.

## Two kinds of spec live here

**Assertions** — these fail when behaviour breaks:

| Spec | Guards |
| --- | --- |
| `image-proxy.spec.ts` | The export proxy: data-URI conversion, SSRF blocking, image-only enforcement |
| `cors-export.spec.ts` | A cross-origin image is proxied and actually present in the export, not silently dropped |
| `upload-errors.spec.ts` | A failed upload, a bad address, and a rewritten share-page URL each say so |
| `settings-render.spec.ts` | Settings that once existed but never rendered — the iOS status bar, both group names, WhatsApp's online status — reach the output |

**Instrumentation** — the rest. See below.

## What the instrumentation specs are

Instrumentation. They measure steps-to-goal, missing affordances, unlabeled
controls, and what is visible vs. hidden at each stage. Output is `[MEASURE]`
lines plus screenshot attachments.

## What these are NOT

Usability testing. An automated agent cannot tell you whether a person
*understood* your interface. It won't overlook a low-contrast button, won't
arrive with a mental model from a different app, won't misread an icon, and
won't quit in frustration. Those are the things that make a product feel
unintuitive, and none of them are observable here.

Treat a green run as "the flow is mechanically completable," never as
"the flow is easy." For the second question, watch five real people from an
AO3 or fandom Discord try it without help. That will outperform any amount
of agent simulation.
