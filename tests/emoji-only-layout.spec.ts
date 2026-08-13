import { expect, test } from '@playwright/test';
import { buildCSS, buildHTML } from '../src/lib/generator';
import { defaultProject } from '../src/lib/schema';

for (const template of ['ios', 'android'] as const) {
  test(`${template} visually floats emoji while preserving metadata scale and ordinary bubbles`, async ({ page }) => {
    const project = defaultProject();
    project.template = template;
    project.messages = [
      { id: 'one-out', sender: 'You', content: '😊', outgoing: true, timestamp: '2:40 PM', status: 'read' },
      { id: 'one-in', sender: 'Sam', content: '👨‍👩‍👧‍👦', outgoing: false, timestamp: '2:41 PM' },
      { id: 'few', sender: 'You', content: '😂❤️😭', outgoing: true, timestamp: '2:42 PM' },
      { id: 'mixed', sender: 'Sam', content: 'hello 😊', outgoing: false, timestamp: '2:43 PM' },
      { id: 'five', sender: 'You', content: '😂❤️😭👍🔥', outgoing: true, timestamp: '2:44 PM' },
    ];

    await page.setContent(
      `<!doctype html><style>${buildCSS(project)}</style><div id="workskin">${buildHTML(project)}</div>`,
      { waitUntil: 'domcontentloaded' },
    );

    const measurements = await page.evaluate(() => {
      const inspect = (id: string) => {
        const row = document.querySelector(`[data-message-id="${id}"]`)!;
        const bubble = row.querySelector('.bubble') as HTMLElement;
        const emoji = row.querySelector('.emoji-content') as HTMLElement | null;
        const time = row.querySelector('.time') as HTMLElement | null;
        return {
          classes: bubble.className,
          background: getComputedStyle(bubble).backgroundColor,
          shadow: getComputedStyle(bubble).boxShadow,
          bubbleFont: parseFloat(getComputedStyle(bubble).fontSize),
          emojiFont: emoji ? parseFloat(getComputedStyle(emoji).fontSize) : 0,
          timeFont: time ? parseFloat(getComputedStyle(time).fontSize) : 0,
          tailCount: row.querySelectorAll('.bubble-tail').length,
        };
      };
      return Object.fromEntries(['one-out', 'one-in', 'few', 'mixed', 'five'].map(id => [id, inspect(id)]));
    });

    for (const id of ['one-out', 'one-in']) {
      expect(measurements[id].classes).toContain('emoji-only');
      expect(measurements[id].background).toBe('rgba(0, 0, 0, 0)');
      expect(measurements[id].shadow).toBe('none');
      expect(measurements[id].emojiFont).toBeGreaterThan(measurements[id].bubbleFont * 3.5);
      expect(measurements[id].timeFont).toBeLessThan(measurements[id].emojiFont / 3);
      expect(measurements[id].tailCount).toBe(0);
    }

    expect(measurements.few.classes).toContain('emoji2');
    expect(measurements.few.background).toBe('rgba(0, 0, 0, 0)');
    expect(measurements.few.emojiFont).toBeGreaterThan(measurements.few.bubbleFont * 2);

    for (const id of ['mixed', 'five']) {
      expect(measurements[id].classes).not.toContain('emoji-only');
      expect(measurements[id].background).not.toBe('rgba(0, 0, 0, 0)');
    }
  });
}
