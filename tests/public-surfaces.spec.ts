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

const landingSources = [
  {
    name: 'SwipePages landing source',
    file: 'docs/landing-swipepages-2026-08.html',
  },
  {
    name: 'WordPress hub source',
    file: 'docs/landing-wordfokus-ao3skingen-WORDPRESS.html',
  },
] as const;

for (const surface of landingSources) {
  test(`${surface.name} makes playable media and Magic Picker visible before feature browsing`, async ({ page }, testInfo) => {
    await page.goto(pathToFileURL(path.join(root, surface.file)).href, { waitUntil: 'domcontentloaded' });

    const hero = page.locator('.hero');
    await expect(hero.getByRole('heading', { name: 'Social-media scenes that actually work on AO3' })).toBeVisible();
    await expect(hero.getByRole('link', { name: 'Build a playable scene' })).toBeVisible();
    await expect(hero.getByRole('link', { name: 'Use the Site Skin Magic Picker' })).toBeVisible();

    const magicPickerCard = page.locator('.tool-card').filter({
      has: page.getByRole('heading', { name: 'Site Skin Magic Picker' }),
    });
    await expect(magicPickerCard).toContainText('Paste a picture or website');
    await expect(magicPickerCard).toContainText('Only you see it');

    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(hasHorizontalOverflow).toBe(false);
    await hero.screenshot({ path: testInfo.outputPath('positioning-hero.png'), animations: 'disabled' });
  });
}

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
