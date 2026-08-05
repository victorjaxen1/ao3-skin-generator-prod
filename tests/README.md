# UX friction tests

Run against the live site:

```bash
npx playwright test                      # both viewports
npx playwright test --project=mobile     # phone only
npx playwright show-report               # screenshots + traces
```

Point at a local build instead:

```bash
UX_BASE_URL=http://localhost:3000 npx playwright test
```

## What these are

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
