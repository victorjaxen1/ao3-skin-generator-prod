import { expect, test } from '@playwright/test';
import { buildHTML } from '../src/lib/generator';
import { defaultProject, SkinProject } from '../src/lib/schema';
import { buildWorkSkin } from '../src/lib/workSkin';

function projectFor(template: SkinProject['template']): SkinProject {
  const project = defaultProject();
  project.template = template;
  project.messages = [{
    id: 'gallery',
    sender: 'You',
    content: 'Evidence',
    outgoing: true,
    imageLayout: 'pair',
    attachments: [
      { type: 'image', url: 'https://example.com/first.png', alt: 'First', intrinsicWidth: 1000, intrinsicHeight: 1000 },
      { type: 'image', url: 'https://example.com/second.png', alt: 'Second', intrinsicWidth: 500, intrinsicHeight: 1000 },
      { type: 'image', url: '   ', alt: 'Blank slot' },
    ],
  }];
  return project;
}

test.describe('multi-image renderer contract', () => {
  for (const template of ['ios', 'android', 'twitter'] as const) {
    test(`${template} emits each nonblank image once in order with a finite split class`, () => {
      const project = projectFor(template);
      const html = buildHTML(project);
      expect((html.match(/first\.png/g) || [])).toHaveLength(1);
      expect((html.match(/second\.png/g) || [])).toHaveLength(1);
      expect(html).not.toContain('Blank slot');
      expect(html.indexOf('first.png')).toBeLessThan(html.indexOf('second.png'));
      expect(html).toContain(template === 'twitter' ? 'media-layout-pair' : 'image-layout-pair');
      expect(html).toContain('image-split-67-33');
      expect(html).toContain('width="1000" height="1000"');
      expect(html).toContain('width="500" height="1000"');

      const skin = buildWorkSkin(project);
      expect(skin.violations).toEqual([]);
      expect(skin.html).not.toMatch(/\sstyle=/i);
      expect(skin.css).not.toMatch(/\b(?:object-fit|gap|calc)\s*:/i);
    });
  }

  test('Twitter quote media resolves its own saved layout independently', () => {
    const project = projectFor('twitter');
    project.messages[0].twitterQuote = {
      name: 'Witness',
      text: 'Two more views',
      imageLayout: 'stack',
      attachments: [
        { type: 'image', url: 'https://example.com/quote-one.png', alt: 'Quote one', intrinsicWidth: 800, intrinsicHeight: 600 },
        { type: 'image', url: 'https://example.com/quote-two.png', alt: 'Quote two', intrinsicWidth: 800, intrinsicHeight: 600 },
      ],
    };
    const html = buildHTML(project);
    expect(html).toContain('quote-media twitter-media-grid media-count-2 media-layout-stack');
    expect((html.match(/quote-one\.png/g) || [])).toHaveLength(1);
    expect((html.match(/quote-two\.png/g) || [])).toHaveLength(1);
  });
});
