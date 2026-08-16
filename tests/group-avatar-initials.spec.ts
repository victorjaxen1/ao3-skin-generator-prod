import { expect, test } from '@playwright/test';

/**
 * The initials badge that stands in for a group participant with no photo.
 *
 * This is a measurement test and not a markup test on purpose. The markup was
 * always right: a `<span class="group-avatar-initials">` holding two uppercase
 * letters, which is what every existing assertion checks and what every one of
 * them kept passing while the badge was visibly broken on the archive.
 *
 * The defect was arithmetic. `width` in `em` resolves against the element's own
 * `font-size`, so declaring both on one element multiplies them: a 1.333em box
 * beside a 0.6em font drew a 12px circle around two bold 9px letters, they
 * wrapped, and the second letter sat outside the circle. It was found by
 * exporting a gallery card and looking at it (Learning 15), after 395 unit
 * tests and every raster suite had passed over it.
 *
 * So the assertion is the thing the picture showed: the text inside the badge
 * occupies one line, and that line is not taller than the circle drawn around
 * it. That survives any future change to the font, the size, or the ratio.
 */

const SCENES = [
  { id: 'ios-rich-group-scene', platform: 'iMessage' },
  { id: 'whatsapp-group-chat', platform: 'WhatsApp' },
];

for (const scene of SCENES) {
  test(`${scene.platform} group initials stay on one line inside their circle`, async ({ page }) => {
    await page.goto(`/?template=${scene.id}`);
    // `:visible`, not `.first()`. There are two #workskin nodes — the off-screen
    // Save PNG capture target and the preview — and the hidden one comes first
    // in document order, so measuring it returns zeroes for everything.
    const scope = page.locator('#workskin:visible');
    const badges = scope.locator('.group-avatar-initials');
    // A scene with no un-photographed participant would make this test vacuous
    // and green forever, which is the failure mode it exists to avoid.
    await expect(badges.first()).toBeVisible();

    const overflowing = await badges.evaluateAll(nodes =>
      nodes
        .map(node => {
          const box = node.getBoundingClientRect();
          return {
            text: node.textContent || '',
            clientHeight: node.clientHeight,
            scrollHeight: node.scrollHeight,
            scrollWidth: node.scrollWidth,
            width: Math.round(box.width),
            height: Math.round(box.height),
          };
        })
        // One extra pixel of tolerance: sub-pixel line boxes round up, and a
        // wrapped second line costs a whole line-height, never one pixel.
        .filter(entry => entry.scrollHeight > entry.clientHeight + 1)
    );

    expect(
      overflowing,
      'these initials wrapped and spill outside the badge — check the font-size/width em arithmetic in generator.ts'
    ).toEqual([]);

    // A circle, still. The fix changes two numbers whose product must not move,
    // and a badge that quietly grew into an oval would pass the check above.
    const shape = await badges.first().evaluate(node => {
      const box = node.getBoundingClientRect();
      return { width: box.width, height: box.height };
    });
    expect(Math.abs(shape.width - shape.height)).toBeLessThanOrEqual(1);
  });
}
