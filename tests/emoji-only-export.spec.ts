import { expect, test } from '@playwright/test';

for (const scenario of [
  { name: 'WhatsApp', template: 'whatsapp-group-chat' },
  { name: 'iMessage', template: 'ios-two-person-chat' },
] as const) {
  test(`PNG export keeps a single ${scenario.name} emoji clear of its timestamp and next message`, async ({ page }) => {
    test.setTimeout(120_000);
    const transparentPixel = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+X5n0WQAAAABJRU5ErkJggg==',
      'base64',
    );
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      const isRemoteImage = url.hostname !== 'localhost' && /\.(?:png|jpe?g|gif|webp)$/i.test(url.pathname);
      const isImageProxy = url.pathname === '/api/image-proxy';
      if (isRemoteImage || isImageProxy) {
        await route.fulfill({ status: 200, contentType: 'image/png', body: transparentPixel });
      } else {
        await route.continue();
      }
    });
    await page.goto(`/?template=${scenario.template}`);

    await page.getByRole('button', { name: 'Message options' }).click();
    await page.getByLabel('Timestamp').fill('12:34 PM');
    const composer = page.getByPlaceholder('Add a message…');
    await composer.fill('🥺');
    await page.getByRole('button', { name: 'Send message' }).click();

    await composer.fill('Message after emoji');
    await page.getByRole('button', { name: 'Send message' }).click();

    await page.evaluate(() => {
      const state = window as typeof window & { __emojiExportMetrics?: unknown };
      const observer = new MutationObserver(() => {
        const clone = document.querySelector('[data-export-clone="true"]');
        const emoji = clone?.querySelector('dd.bubble.emoji1 .emoji-content') as HTMLElement | null;
        const bubble = emoji?.closest('dd.bubble') as HTMLElement | null;
        const row = emoji?.closest('.row') as HTMLElement | null;
        const time = bubble?.querySelector('.time') as HTMLElement | null;
        const next = row?.nextElementSibling as HTMLElement | null;
        if (!emoji || !bubble || !row || !time || !next) return;

        const emojiRect = emoji.getBoundingClientRect();
        const timeRect = time.getBoundingClientRect();
        const nextRect = next.getBoundingClientRect();
        state.__emojiExportMetrics = {
          marginBottom: getComputedStyle(emoji).marginBottom,
          background: getComputedStyle(bubble).backgroundColor,
          shadow: getComputedStyle(bubble).boxShadow,
          emojiBottom: emojiRect.bottom,
          timeTop: timeRect.top,
          timeBottom: timeRect.bottom,
          nextTop: nextRect.top,
        };
        observer.disconnect();
      });
      observer.observe(document.body, { childList: true });
    });

    const downloadPromise = page.waitForEvent('download', { timeout: 90_000 });
    await page.getByRole('button', { name: 'Save PNG' }).first().click();
    const download = await downloadPromise;
    const path = test.info().outputPath(`emoji-only-${scenario.name.toLowerCase()}.png`);
    await download.saveAs(path);

    const metrics = await page.evaluate(() => (
      window as typeof window & {
        __emojiExportMetrics?: {
          marginBottom: string;
          background: string;
          shadow: string;
          emojiBottom: number;
          timeTop: number;
          timeBottom: number;
          nextTop: number;
        };
      }
    ).__emojiExportMetrics);

    expect(await download.failure()).toBeNull();
    expect(metrics).toBeTruthy();
    expect(metrics!.marginBottom).toBe('32px');
    expect(metrics!.background).toBe('rgba(0, 0, 0, 0)');
    expect(metrics!.shadow).toBe('none');
    expect(metrics!.timeTop).toBeGreaterThan(metrics!.emojiBottom);
    expect(metrics!.nextTop).toBeGreaterThanOrEqual(metrics!.timeBottom);
    await test.info().attach(`emoji-only-${scenario.name.toLowerCase()}`, { path, contentType: 'image/png' });
  });
}
