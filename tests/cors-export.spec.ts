import { test, expect } from '@playwright/test';

/**
 * Does a cross-origin image WITHOUT CORS headers break export?
 *
 * This redirects to fastly.picsum.photos, which serves 200 with no
 * Access-Control-Allow-Origin. The browser displays it happily, but
 * html2canvas requests it with crossOrigin='anonymous', so without the export
 * proxy it fails to load and leaves a hole in the PNG.
 */
const NO_CORS_IMAGE = 'https://picsum.photos/id/237/80/80.jpg';

test('EXPORT: non-CORS image survives, and is actually in the output', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') pageErrors.push(`console: ${m.text()}`);
  });

  // The export pipeline routes cross-origin images through the proxy so they
  // rasterise as same-origin data URIs. Watch for that happening.
  const proxied: { url: string; status: number }[] = [];
  page.on('response', async (res) => {
    if (res.url().includes('/api/image-proxy')) {
      proxied.push({ url: res.url(), status: res.status() });
    }
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Start a blank iMessage conversation' }).click();

  // Open the detail tray and paste the image URL.
  await page.getByRole('button', { name: /Add details/ }).click();
  await page.getByLabel('Image address for this message').fill(NO_CORS_IMAGE);

  const composer = page.getByPlaceholder('Add a message…');
  await composer.fill('image test');
  await page.getByRole('button', { name: 'Send message' }).click();

  // Confirm the image actually rendered in the preview (i.e. it loaded at all).
  const imgState = await page.evaluate(async (url) => {
    const imgs = Array.from(document.querySelectorAll('img'));
    const target = imgs.find((i) => i.src.includes('picsum'));
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
  console.log(`  [MEASURE] proxy calls: ${JSON.stringify(proxied)}`);

  expect(result, 'export should produce a download').toBe('DOWNLOAD');

  // Export surviving was never the hard part — the image being *present* is.
  // A host with no Access-Control-Allow-Origin must have gone through the
  // proxy, or html2canvas left a hole where the image should be.
  expect(proxied.length, 'cross-origin image should be proxied before rasterising')
    .toBeGreaterThan(0);
  expect(proxied.every((p) => p.status === 200), 'proxy should succeed').toBe(true);

  // And the user must not have been told an image was dropped.
  await expect(page.getByText(/couldn't be included/i)).toHaveCount(0);
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
