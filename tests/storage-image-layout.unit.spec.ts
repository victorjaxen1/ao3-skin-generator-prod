import { expect, test } from '@playwright/test';
import { defaultProject } from '../src/lib/schema';
import { loadStoredProject } from '../src/lib/storage';

test('local recovery preserves safe image metadata and drops malformed hints', () => {
  const stored = defaultProject();
  stored.messages = [{
    id: 'gallery', sender: 'You', content: 'Gallery', outgoing: true,
    imageLayout: 'hero-top',
    attachments: [
      { type: 'image', url: 'https://example.com/a.png', alt: 'A', intrinsicWidth: 1200, intrinsicHeight: 800 },
      { type: 'image', url: 'https://example.com/b.png', alt: 'B', intrinsicWidth: 900 } as never,
    ],
    twitterQuote: {
      name: 'Witness', text: 'Quote', imageLayout: 'stack',
      attachments: [{ type: 'image', url: 'https://example.com/q.png', intrinsicWidth: 640, intrinsicHeight: 480 }],
    },
  }];

  const globals = globalThis as unknown as Record<string, unknown>;
  const previousWindow = globals.window;
  const previousStorage = globals.localStorage;
  globals.window = {};
  globals.localStorage = { getItem: () => JSON.stringify(stored), setItem: () => undefined };
  try {
    const recovered = loadStoredProject(defaultProject);
    expect(recovered.messages[0].imageLayout).toBe('hero-top');
    expect(recovered.messages[0].attachments?.[0]).toMatchObject({ intrinsicWidth: 1200, intrinsicHeight: 800 });
    expect(recovered.messages[0].attachments?.[1].intrinsicWidth).toBeUndefined();
    expect(recovered.messages[0].attachments?.[1].intrinsicHeight).toBeUndefined();
    expect(recovered.messages[0].twitterQuote).toMatchObject({
      imageLayout: 'stack',
      attachments: [{ intrinsicWidth: 640, intrinsicHeight: 480 }],
    });
  } finally {
    if (previousWindow === undefined) delete globals.window;
    else globals.window = previousWindow;
    if (previousStorage === undefined) delete globals.localStorage;
    else globals.localStorage = previousStorage;
  }
});
