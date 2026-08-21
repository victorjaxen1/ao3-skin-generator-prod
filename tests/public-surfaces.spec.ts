import { expect, test } from '@playwright/test';
import path from 'path';
import { pathToFileURL } from 'url';

const root = path.join(__dirname, '..');

const surfaces = [
  {
    name: 'SwipePages landing source',
    file: 'docs/landing-swipepages-2026-08.html',
    placement: 'swipepages_product_shelf',
  },
  {
    name: 'WordPress hub source',
    file: 'docs/landing-wordfokus-ao3skingen-WORDPRESS.html',
    placement: 'wordpress_hub_product_shelf',
  },
  {
    name: 'examples gallery',
    file: 'public/examples-gallery.html',
    placement: 'examples_gallery_product_shelf',
  },
] as const;

for (const surface of surfaces) {
  test(`${surface.name} renders its attributable product shelf without overflow`, async ({ page }, testInfo) => {
    await page.goto(pathToFileURL(path.join(root, surface.file)).href, { waitUntil: 'domcontentloaded' });

    const shelf = page.locator('#more-tools');
    await shelf.scrollIntoViewIfNeeded();
    await expect(shelf.getByRole('heading', { name: 'Also by the same developer' })).toBeVisible();
    await expect(shelf.locator('.feature-card, .use-case-card')).toHaveCount(2);
    const cardDisplay = await shelf.locator('.features-grid, .use-case-grid').evaluate(element => getComputedStyle(element).display);
    expect(cardDisplay).toBe('grid');

    for (const product of ['WordFokus', 'WorldKonstruct']) {
      const link = shelf.getByRole('link', { name: new RegExp(`^Try ${product} free`) });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      const url = new URL(await link.getAttribute('href') ?? '');
      expect(url.searchParams.get('utm_medium')).toBe('referral');
      expect(url.searchParams.get('utm_content')).toBe(surface.placement);
    }

    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(hasHorizontalOverflow).toBe(false);
    await shelf.screenshot({ path: testInfo.outputPath('product-shelf.png'), animations: 'disabled' });
  });
}
