import { test, expect } from '@playwright/test';

/**
 * Does a cross-origin image WITHOUT CORS headers break export?
 * w3.org serves 200 with no Access-Control-Allow-Origin — the exact case
 * that would taint a canvas if html2canvas loaded it without crossOrigin.
 */
const NO_CORS_IMAGE = 'https://www.w3.org/Icons/w3c_home.png';

test('EXPORT: non-CORS image — does Save Image survive?', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') pageErrors.push(`console: ${m.text()}`);
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Start a blank iMessage conversation' }).click();

  // Open the detail tray and paste the image URL.
  await page.getByRole('button', { name: /Add details/ }).click();
  await page.getByPlaceholder('Image URL').fill(NO_CORS_IMAGE);

  const composer = page.getByPlaceholder('Add a message…');
  await composer.fill('image test');
  await page.getByRole('button', { name: 'Send message' }).click();

  // Confirm the image actually rendered in the preview (i.e. it loaded at all).
  const imgState = await page.evaluate(async (url) => {
    const imgs = Array.from(document.querySelectorAll('img'));
    const target = imgs.find((i) => i.src.includes('w3c_home'));
    if (!target) return 'not found in DOM';
    return `complete=${target.complete} naturalWidth=${target.naturalWidth}`;
  }, NO_CORS_IMAGE);
  console.log(`  [MEASURE] preview img: ${imgState}`);

  // Now export. Save Image triggers a download on success.
  const downloadPromise = page
    .waitForEvent('download', { timeout: 45000 })
    .then(() => 'DOWNLOAD')
    .catch(() => 'NO DOWNLOAD');

  await page.getByRole('button', { name: 'Save Image' }).click();
  const result = await downloadPromise;

  console.log(`  [MEASURE] Save Image result: ${result}`);
  console.log(`  [MEASURE] page errors: ${pageErrors.length ? pageErrors.join(' | ') : '(none)'}`);

  const tainted = pageErrors.some((e) => /SecurityError|tainted|insecure/i.test(e));
  console.log(`  [MEASURE] canvas tainted (SecurityError seen): ${tainted}`);

  expect(result, 'export should produce a download').toBe('DOWNLOAD');
});

test('EXPORT: direct canvas taint check for both configs', async ({ page }) => {
  await page.goto('/');

  const result = await page.evaluate(async (url) => {
    async function tryDraw(useCrossOrigin: boolean) {
      return new Promise<string>((resolve) => {
        const img = new Image();
        if (useCrossOrigin) img.crossOrigin = 'anonymous';
        img.onload = () => {
          const c = document.createElement('canvas');
          c.width = 32;
          c.height = 32;
          const ctx = c.getContext('2d')!;
          ctx.drawImage(img, 0, 0, 32, 32);
          try {
            c.toDataURL();
            resolve('loaded, canvas CLEAN');
          } catch (e) {
            resolve(`loaded, canvas TAINTED (${(e as Error).name})`);
          }
        };
        img.onerror = () => resolve('image FAILED to load');
        img.src = url;
        setTimeout(() => resolve('timeout'), 15000);
      });
    }
    return {
      withCrossOrigin: await tryDraw(true),
      withoutCrossOrigin: await tryDraw(false),
    };
  }, NO_CORS_IMAGE);

  console.log(`  [MEASURE] crossOrigin='anonymous' (useCORS:true)  → ${result.withCrossOrigin}`);
  console.log(`  [MEASURE] no crossOrigin      (useCORS:false) → ${result.withoutCrossOrigin}`);
});
