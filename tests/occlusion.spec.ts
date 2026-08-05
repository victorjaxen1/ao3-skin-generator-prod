import { test } from '@playwright/test';

const HEIGHTS = [700, 800, 900, 1000, 1100];

test('OCCLUSION: what covers the compose input, and at which viewport heights', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // The picker now gates the workspace for first-time visitors, so pick a
  // platform before the composer exists.
  const picker = page.getByRole('button', { name: 'Start a blank iMessage conversation' });
  if (await picker.isVisible().catch(() => false)) await picker.click();
  await page.getByPlaceholder('Add a message…').waitFor({ timeout: 15000 });

  for (const h of HEIGHTS) {
    await page.setViewportSize({ width: 1280, height: h });
    await page.waitForTimeout(300);

    const box = await page.getByPlaceholder('Add a message…').boundingBox();
    if (!box) {
      console.log(`  [h=${h}] composer has no box`);
      continue;
    }

    const cx = Math.round(box.x + box.width / 2);
    const cy = Math.round(box.y + box.height / 2);

    const hit = await page.evaluate(
      ([x, y]) => {
        const el = document.elementFromPoint(x as number, y as number);
        if (!el) return { tag: '(none)', cls: '', isComposer: false, owner: '' };
        // Walk up to find the nearest positioned ancestor that explains the overlay.
        let owner = '';
        let p: Element | null = el;
        while (p) {
          const cs = getComputedStyle(p);
          if (cs.position === 'fixed' || cs.position === 'sticky') {
            owner = `${p.tagName.toLowerCase()}.${String(p.className).split(' ').slice(0, 4).join('.')} [${cs.position}, z=${cs.zIndex}]`;
            break;
          }
          p = p.parentElement;
        }
        return {
          tag: el.tagName.toLowerCase(),
          cls: String(el.className).split(' ').slice(0, 3).join('.'),
          isComposer: el.tagName === 'TEXTAREA',
          owner,
        };
      },
      [cx, cy]
    );

    let clickable = 'yes';
    try {
      await page.getByPlaceholder('Add a message…').click({ timeout: 3000, trial: true });
    } catch {
      clickable = 'NO — blocked';
    }

    console.log(
      `  [h=${h}] composer y=${Math.round(box.y)}-${Math.round(box.y + box.height)} | hit=${hit.tag}${hit.cls ? '.' + hit.cls : ''} | composer reached=${hit.isComposer} | clickable=${clickable}`
    );
    if (hit.owner) console.log(`          overlay: ${hit.owner}`);
  }
});
