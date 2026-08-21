import { expect, test, type Page } from '@playwright/test';
import { CONTEXTUAL_PRODUCT_PROMOTIONS_ENABLED } from '../src/lib/productPromotion';

test.skip(!CONTEXTUAL_PRODUCT_PROMOTIONS_ENABLED, 'Release 2 contextual recommendations are disabled for the Release 1 rollout');

const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

async function openTemplate(page: Page, template = 'google-news-articles') {
  await page.goto(`/?template=${template}`, { waitUntil: 'domcontentloaded' });
  await page.locator('#workskin:visible').first().waitFor({ state: 'visible', timeout: 30_000 });
}

async function completeWorkSkinHandoff(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'Work skin' });
  await dialog.getByRole('button', { name: 'Copy work skin CSS' }).click();
  await dialog.getByRole('button', { name: 'Copy scene HTML' }).click();
  return dialog;
}

test('work-skin recommendation appears only after both copies and dismissal persists', async ({ page }) => {
  await openTemplate(page);
  await page.getByRole('button', { name: /work skin/i }).click();
  const dialog = page.getByRole('dialog', { name: 'Work skin' });
  const recommendationHeading = dialog.getByRole('heading', {
    name: 'Your scene is ready. Writing the next chapter in Google Docs?',
  });

  await expect(recommendationHeading).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Copy work skin CSS' }).click();
  await expect(recommendationHeading).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Copy scene HTML' }).click();
  await expect(recommendationHeading).toBeVisible();

  const productLink = dialog.getByRole('link', { name: /Try WordFokus free/i });
  await productLink.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1100);
  await expect(productLink).not.toBeFocused();

  const stateAfterView = await page.evaluate(() => JSON.parse(
    localStorage.getItem('ao3skingen_product_promo_v1') || 'null'
  ));
  expect(stateAfterView.sceneHandoffCount).toBe(1);
  expect(stateAfterView.lastContextualShownAt.wordfokus).toMatch(/^\d{4}-\d{2}-\d{2}T/);

  const order = await dialog.evaluate(element => {
    const textNodes = [...element.querySelectorAll('button, p, section')];
    const backup = textNodes.find(node => node.textContent?.trim() === 'Back up editable project');
    const warning = textNodes.find(node => node.textContent?.includes('Remote icons and media remain external dependencies'));
    const card = textNodes.find(node => node.textContent?.includes('Your scene is ready. Writing the next chapter'));
    if (!backup || !warning || !card) return null;
    return {
      backupBeforeWarning: Boolean(backup.compareDocumentPosition(warning) & Node.DOCUMENT_POSITION_FOLLOWING),
      warningBeforeCard: Boolean(warning.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING),
    };
  });
  expect(order).toEqual({ backupBeforeWarning: true, warningBeforeCard: true });

  await dialog.getByRole('button', { name: 'Not for me: WordFokus' }).click();
  await expect(recommendationHeading).toHaveCount(0);
  const suppressed = await page.evaluate(() => JSON.parse(
    localStorage.getItem('ao3skingen_product_promo_v1') || 'null'
  ).suppressedUntil.wordfokus as string);
  expect(new Date(suppressed).getTime()).toBeGreaterThan(Date.now() + 179 * 86_400_000);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('#workskin:visible').first().waitFor({ state: 'visible', timeout: 30_000 });
  await page.getByRole('button', { name: /work skin/i }).click();
  await completeWorkSkinHandoff(page);
  await expect(page.getByRole('heading', {
    name: 'Your scene is ready. Writing the next chapter in Google Docs?',
  })).toHaveCount(0);
});

test('a returning author sees WorldKonstruct after a second-day handoff', async ({ page }) => {
  await page.addInitScript(() => {
    const yesterday = new Date(Date.now() - 86_400_000);
    const day = [
      yesterday.getFullYear(),
      String(yesterday.getMonth() + 1).padStart(2, '0'),
      String(yesterday.getDate()).padStart(2, '0'),
    ].join('-');
    localStorage.setItem('ao3skingen_product_promo_v1', JSON.stringify({
      version: 1,
      sceneHandoffCount: 1,
      activeDays: [day],
      lastContextualShownAt: {},
      suppressedUntil: {},
      clickedAt: {},
    }));
  });
  await openTemplate(page);
  await page.getByRole('button', { name: /work skin/i }).click();
  const dialog = await completeWorkSkinHandoff(page);
  await expect(dialog.getByRole('heading', { name: 'Is this fic becoming a series?' })).toBeVisible();
  await expect(dialog.getByRole('link', { name: /Try WorldKonstruct free/i })).toHaveAttribute(
    'href', /utm_content=work_skin_success/
  );
});

test('hosted recommendation is absent before copy and appears after clipboard success', async ({ page }) => {
  test.setTimeout(150_000);
  await page.addInitScript(() => localStorage.setItem('ao3skin_imgbb_scene_ack', '1'));
  await page.route('**/api/image-proxy**', route => route.fulfill({
    status: 200, contentType: 'image/png', body: PIXEL,
  }));
  await page.route('**/api/image-upload', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, url: 'https://i.ibb.co/promotion-test.png' }),
  }));

  await openTemplate(page);
  await page.getByRole('button', { name: 'Get AO3 image code' }).click();
  const dialog = page.getByRole('dialog', { name: 'Your AO3 code' });
  await expect(dialog).toBeVisible({ timeout: 120_000 });
  await expect(dialog.getByRole('heading', {
    name: 'Your scene is ready. Writing the next chapter in Google Docs?',
  })).toHaveCount(0);

  await dialog.getByRole('button', { name: 'Copy code' }).click();
  await expect(dialog.getByRole('heading', {
    name: 'Your scene is ready. Writing the next chapter in Google Docs?',
  })).toBeVisible();
  await expect(dialog.getByRole('link', { name: /Try WordFokus free/i })).toHaveAttribute(
    'href', /utm_content=hosted_image_success/
  );
});
