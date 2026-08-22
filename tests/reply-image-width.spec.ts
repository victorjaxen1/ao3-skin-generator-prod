import { expect, test, type Page } from '@playwright/test';
import { PLATFORM_LOOK } from '../src/lib/generator';
import { defaultProject, type SkinProject } from '../src/lib/schema';

const IMAGE = {
  type: 'image' as const,
  url: '/assets/Taylor-Swift-avatar.png',
  alt: 'Reference image',
  intrinsicWidth: 512,
  intrinsicHeight: 512,
};

function replyImageProject(template: SkinProject['template']): SkinProject {
  const project = defaultProject();
  project.template = template;
  Object.assign(project.settings, PLATFORM_LOOK[template]);
  project.settings.iosGroupMode = template === 'ios';
  project.settings.androidGroupMode = template === 'android';
  const participants = [
    { id: 'nadia', name: 'Nadia', color: '#188038', iosTone: 'green' as const, whatsappTone: 'green' as const },
    { id: 'rex', name: 'Rex', color: '#8a6800', iosTone: 'yellow' as const, whatsappTone: 'yellow' as const },
  ];
  project.settings.iosGroupParticipants = participants;
  project.settings.androidGroupParticipants = participants;
  project.messages = [
    { id: 'target', sender: 'Nadia', participantId: 'nadia', content: 'Hi Harry', outgoing: false, timestamp: '11:50 PM' },
    {
      id: 'plain',
      sender: 'Rex',
      participantId: 'rex',
      content: 'Stop it, you hussy. Calm yourself down',
      outgoing: false,
      timestamp: '11:51 PM',
      attachments: [{ ...IMAGE }],
    },
    { id: 'separator', sender: 'You', content: 'One moment', outgoing: true, timestamp: '11:51 PM' },
    {
      id: 'reply',
      sender: 'Rex',
      participantId: 'rex',
      content: 'Stop it, you hussy. Calm yourself down',
      outgoing: false,
      timestamp: '11:52 PM',
      attachments: [{ ...IMAGE }],
      ...(template === 'ios'
        ? { iosReply: { messageId: 'target' } }
        : { whatsappReply: { messageId: 'target' } }),
    },
  ];
  return project;
}

async function openStoredProject(page: Page, project: SkinProject) {
  await page.addInitScript(value => {
    localStorage.setItem('ao3SkinProject', JSON.stringify(value));
    localStorage.setItem('ao3skin_help_dismissed', '1');
    localStorage.setItem('ao3skingen_analytics_consent', 'denied');
  }, project);
  await page.goto('/');
  await page.locator('#workskin:visible').first().waitFor({ state: 'visible' });
}

for (const template of ['ios', 'android'] as const) {
  test(`${template === 'ios' ? 'iMessage' : 'WhatsApp'} reply context does not narrow an image message`, async ({ page }) => {
    await openStoredProject(page, replyImageProject(template));
    const scene = page.locator('#workskin:visible').first();
    const mediaSelector = template === 'ios' ? '.ios-images' : '.wa-images';

    const geometry = await scene.evaluate((root, selector) => {
      const measure = (id: string) => {
        const row = root.querySelector<HTMLElement>(`[data-message-id="${id}"]`)!;
        const bubble = row.querySelector<HTMLElement>('dd.bubble')!;
        const media = row.querySelector<HTMLElement>(selector)!;
        return {
          bubbleWidth: bubble.getBoundingClientRect().width,
          mediaWidth: media.getBoundingClientRect().width,
        };
      };
      return { plain: measure('plain'), reply: measure('reply') };
    }, mediaSelector);

    expect(Math.abs(geometry.plain.bubbleWidth - geometry.reply.bubbleWidth)).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.plain.mediaWidth - geometry.reply.mediaWidth)).toBeLessThanOrEqual(1);
    expect(geometry.plain.bubbleWidth).toBeCloseTo(template === 'ios' ? 260 : 280, 0);
    expect(geometry.reply.bubbleWidth).toBeCloseTo(template === 'ios' ? 260 : 280, 0);
  });
}
