# iOS/iMessage Group Chat Feature — superseded

**Status: historical. Do not implement from this document.**

This file described the first iOS group-chat build. Every architectural claim in
it is now wrong, and following it would send a developer to components that no
longer exist:

- `IOSEditor.tsx` and `CompactMessageCard.tsx` are not the active editing path;
- participant management lives in `CastPanel.tsx`;
- message editing lives in `MessageTimeline.tsx`, through
  `IOSMessageExtrasEditor.tsx`, which the composer shares;
- the iOS renderer is `buildIOSHTML` / `iosMessageHTML` in `src/lib/generator.ts`,
  extracted out of the shared `msgHTML` path;
- the model and its single validator are `src/lib/ios.ts`.

Two behaviours this document specified were also **defects**, and both are fixed:

1. **Run grouping compared message direction alone**, so two different group
   speakers merged into one visual run with a single tail between them. Runs now
   compare a resolved speaker key (`resolveIOSSpeakerKey`).
2. **Sender colour was a free hex value emitted as an inline `style`.** AO3
   strips `style` from every element, so the colour reached the preview and the
   PNG and was silently dropped on the archive — the published work disagreed
   with what the author approved. Colour is now a finite `iosTone` palette
   compiled to `ios-tone-*` classes the stylesheet carries.

**The authoritative document is
[iOS / iMessage Platform Improvement — Implementation Plan](./IOS-IMESSAGE-PLATFORM-IMPROVEMENT-IMPLEMENTATION-PLAN.md).**
Read that instead. For the AO3 constraints all of this sits inside, read
[Work Skin Implementation](./WORK-SKIN-IMPLEMENTATION.md) and
[AO3 Work Skin Knowledge](./AO3-WORK-SKIN-KNOWLEDGE.md).
