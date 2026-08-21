import { expect, test } from '@playwright/test';
import { defaultProject, SkinProject } from '../src/lib/schema';

function pairProject(template: SkinProject['template']): SkinProject {
  const project = defaultProject();
  project.template = template;
  project.messages = [{
    id: 'ratio-pair', sender: 'You', content: 'Two views', outgoing: true,
    attachments: [
      { type: 'image', url: '/assets/alex-avatar.png', alt: 'Square view', intrinsicWidth: 1000, intrinsicHeight: 1000 },
      { type: 'image', url: '/assets/twitter-character-thread.png', alt: 'Portrait view', intrinsicWidth: 500, intrinsicHeight: 1000 },
    ],
  }];
  return project;
}

for (const template of ['ios', 'android', 'twitter'] as const) {
  test(`${template} renders the automatic 67/33 pair as real proportional cells`, async ({ page }) => {
    await page.addInitScript(project => {
      localStorage.setItem('ao3skingen_analytics_consent', 'denied');
      localStorage.setItem('ao3SkinProject', JSON.stringify(project));
    }, pairProject(template));
    await page.goto('/');

    // The export renderer keeps an off-screen duplicate ready for rastering;
    // measure the author-facing preview, not that hidden staging copy.
    const composition = page.locator('#workskin .image-split-67-33:visible').first();
    await expect(composition).toBeVisible();
    const first = await composition.locator(':scope > .image-layout-first').boundingBox();
    const second = await composition.locator(':scope > .image-layout-second').boundingBox();
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    const ratio = first!.width / second!.width;
    expect(ratio).toBeGreaterThan(1.9);
    expect(ratio).toBeLessThan(2.1);
  });
}
