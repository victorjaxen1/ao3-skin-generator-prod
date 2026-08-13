import { expect, test } from '@playwright/test';
import { emojiMessageSize } from '../src/lib/emoji';
import { buildCSS, buildHTML } from '../src/lib/generator';
import { defaultProject, SkinProject } from '../src/lib/schema';

function chatProject(template: 'ios' | 'android', content: string, attachment = false): SkinProject {
  const project = defaultProject();
  project.template = template;
  project.messages = [{
    id: 'emoji-message',
    sender: 'You',
    content,
    outgoing: true,
    timestamp: '2:40 PM',
    status: 'read',
    ...(attachment ? { attachments: [{ type: 'image' as const, url: '/assets/jordan-avatar.png' }] } : {}),
  }];
  return project;
}

test.describe('emoji-only chat presentation', () => {
  test('recognizes complete emoji graphemes and the one/few sizing boundary', () => {
    expect(emojiMessageSize('😊')).toBe('emoji1');
    expect(emojiMessageSize('  👨‍👩‍👧‍👦  ')).toBe('emoji1');
    expect(emojiMessageSize('👍🏽')).toBe('emoji1');
    expect(emojiMessageSize('🇬🇭')).toBe('emoji1');
    expect(emojiMessageSize('😂 ❤️ 😭 👍')).toBe('emoji2');
    expect(emojiMessageSize('😂❤️😭👍🔥')).toBeUndefined();
  });

  test('rejects mixed text, punctuation, empty content, and attachments', () => {
    expect(emojiMessageSize('hello 😊')).toBeUndefined();
    expect(emojiMessageSize('😊!')).toBeUndefined();
    expect(emojiMessageSize('   ')).toBeUndefined();
    expect(emojiMessageSize('😊', true)).toBeUndefined();
  });

  test('does not apply chat-only presentation to Twitter or Google', () => {
    for (const template of ['twitter', 'google'] as const) {
      const project = defaultProject();
      project.template = template;
      project.messages = [{
        id: 'plain-emoji',
        sender: 'You',
        content: '😊',
        outgoing: true,
      }];

      expect(buildHTML(project)).not.toContain('emoji-only');
      expect(buildHTML(project)).not.toContain('emoji-content');
    }
  });

  for (const template of ['ios', 'android'] as const) {
    test(`${template} emits floating emoji markup but keeps ordinary messages in bubbles`, () => {
      const one = buildHTML(chatProject(template, '😊'));
      const few = buildHTML(chatProject(template, '😂❤️😭'));
      const mixed = buildHTML(chatProject(template, 'hello 😊'));
      const attached = buildHTML(chatProject(template, '😊', true));

      expect(one).toContain('emoji-only emoji1');
      expect(one).toContain('<span class="emoji-content emoji1">😊</span>');
      expect(few).toContain('emoji-only emoji2');
      expect(mixed).not.toContain('emoji-only');
      expect(attached).not.toContain('emoji-only');
      if (template === 'ios') expect(one).not.toContain('bubble-tail');
    });

    test(`${template} stylesheet removes the bubble and enlarges only emoji content`, () => {
      const css = buildCSS(chatProject(template, '😊'));
      expect(css).toMatch(/dd\.bubble\.emoji-only\{[^}]*background:transparent;[^}]*box-shadow:none;/);
      expect(css).toMatch(/dd\.bubble\.emoji1 \.emoji-content\{font-size:[\d.]+em;/);
      expect(css).toMatch(/dd\.bubble\.emoji2 \.emoji-content\{font-size:[\d.]+em;/);
    });
  }
});
