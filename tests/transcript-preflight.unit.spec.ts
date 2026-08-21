import { expect, test } from '@playwright/test';
import { defaultProject } from '../src/lib/schema';
import { buildSceneTranscript, defaultSceneAlt } from '../src/lib/transcript';
import { buildWorkSkinPreflight } from '../src/lib/preflight';
import { buildWorkSkin } from '../src/lib/workSkin';
import { updateHostedImageAlt } from '../src/components/ExportPanel';

test('builds a deterministic reading-order transcript from scene data', () => {
  const project = defaultProject();
  project.settings.chatYourName = 'Rhys';
  project.messages = [
    { id: '1', sender: 'You', content: '*Hello*', outgoing: true, timestamp: '10:00', attachments: [{ type: 'image', url: 'https://example.com/a.jpg', alt: 'A red door' }] },
    { id: '2', sender: 'Sam', content: '', outgoing: false, reaction: '❤️', attachments: [{ type: 'image', url: 'https://example.com/b.jpg', decorative: true }] },
  ];
  expect(buildSceneTranscript(project)).toBe([
    'iMessage conversation',
    '',
    'Rhys (10:00): Hello',
    '[Image: A red door]',
    '',
    'Sam:',
    '[Decorative image]',
    '[Reaction: ❤️]',
  ].join('\n'));
  expect(defaultSceneAlt(project)).toBe('Fictional iMessage conversation with 2 messages.');
});

test('composes work-skin blocks and warnings without calling warnings AO3 failures', () => {
  const project = defaultProject();
  project.messages[0].attachments = [{ type: 'image', url: 'https://cdn.discordapp.com/attachments/a/b.png', alt: '' }];
  const skin = buildWorkSkin(project);
  const report = buildWorkSkinPreflight(project, skin.html, skin.violations, false);
  expect(report.find(item => item.id === 'ao3-css')).toMatchObject({ severity: 'block', status: 'pass' });
  expect(report.find(item => item.id === 'attachment-alt')).toMatchObject({ severity: 'warn', status: 'fail' });
  expect(report.find(item => item.id === 'image-host')).toMatchObject({ severity: 'warn', status: 'fail' });
  expect(report.find(item => item.id === 'project-backup')).toMatchObject({ severity: 'warn', status: 'fail' });
});

test('preflight only returns checks applicable to the current platform', () => {
  for (const template of ['ios', 'android', 'twitter', 'google'] as const) {
    const project = { ...defaultProject(), template };
    const skin = buildWorkSkin(project);
    const ids = buildWorkSkinPreflight(project, skin.html, skin.violations, false).map(item => item.id);
    expect(ids.some(id => id.startsWith('ios-'))).toBe(template === 'ios');
    expect(ids.some(id => id.startsWith('whatsapp-'))).toBe(template === 'android');
    expect(ids.includes('video-fallback')).toBe(template === 'twitter');
    expect(ids.includes('speaker-identity')).toBe(template === 'ios' || template === 'android');
    expect(ids.includes('contrast')).toBe(template !== 'google');
  }
});

test('escapes attachment alt text in generated work-skin HTML', () => {
  const project = defaultProject();
  project.messages[0].attachments = [{ type: 'image', url: 'https://example.com/a.jpg', alt: 'A "quote" <tag>' }];
  const html = buildWorkSkin(project).html;
  expect(html).toContain('alt="A &quot;quote&quot; &lt;tag&gt;"');
  expect(html).not.toContain('alt="A "quote"');
});

test('updates hosted-image alt text locally and labels multi-part order', () => {
  const project = defaultProject();
  const code = '<img src="https://example.com/1.png" alt="old" /><img src="https://example.com/2.png" alt="old" />';
  expect(updateHostedImageAlt(code, 'A "long" scene', project)).toBe(
    '<img src="https://example.com/1.png" alt="A &quot;long&quot; scene Part 1 of 2." /><img src="https://example.com/2.png" alt="A &quot;long&quot; scene Part 2 of 2." />'
  );
});
