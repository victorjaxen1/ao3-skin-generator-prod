import { test, expect } from '@playwright/test';
import { defaultProject, Message, SkinProject } from '../src/lib/schema';
import {
  isSameWhatsAppRun,
  normalizeWhatsAppReactions,
  validateWhatsAppLinkPreview,
  validateWhatsAppMedia,
  validateWhatsAppMessage,
} from '../src/lib/whatsapp';

function whatsappProject(messages: Message[]): SkinProject {
  const project = defaultProject();
  project.template = 'android';
  project.settings.androidGroupMode = true;
  project.settings.androidGroupParticipants = [
    { id: 'alice-p', characterId: 'alice', name: 'Alice', color: '#137333', whatsappTone: 'green' },
    { id: 'bob-p', characterId: 'bob', name: 'Bob', color: '#1769aa', whatsappTone: 'blue' },
  ];
  project.cast = {
    characters: [
      { id: 'self', name: 'You' },
      { id: 'alice', name: 'Alice' },
      { id: 'bob', name: 'Bob' },
    ],
    selfId: 'self',
  };
  project.messages = messages;
  return project;
}

const incoming = (id: string, characterId: string, participantId: string, content = id): Message => ({
  id, sender: characterId, characterId, participantId, content, outgoing: false, timestamp: '10:00',
});

test.describe('WhatsApp model', () => {
  test('two incoming group speakers form separate visual runs', () => {
    const alice = incoming('a', 'alice', 'alice-p');
    const bob = incoming('b', 'bob', 'bob-p');
    const project = whatsappProject([alice, bob]);
    expect(isSameWhatsAppRun(project, alice, bob)).toBe(false);
  });

  test('the same stable speaker remains a run across a rename', () => {
    const first = incoming('a', 'alice', 'alice-p', 'First');
    const second = { ...incoming('b', 'alice', 'alice-p', 'Second'), sender: 'Old Alice' };
    const project = whatsappProject([first, second]);
    expect(isSameWhatsAppRun(project, first, second)).toBe(true);
  });

  test('events and an explicit boundary split runs', () => {
    const first = incoming('a', 'alice', 'alice-p');
    const event: Message = { id: 'event', sender: '', content: '', outgoing: false, whatsappEvent: { kind: 'date', text: 'Today' } };
    const forced = { ...incoming('b', 'alice', 'alice-p'), whatsappStartNewRun: true };
    const project = whatsappProject([first, event, forced]);
    expect(isSameWhatsAppRun(project, first, event)).toBe(false);
    expect(isSameWhatsAppRun(project, first, forced)).toBe(false);
  });

  test('reply targets must exist earlier and be ordinary messages', () => {
    const target = incoming('a', 'alice', 'alice-p');
    const reply: Message = { id: 'b', sender: 'You', content: 'Reply', outgoing: true, whatsappReply: { messageId: 'a' } };
    const project = whatsappProject([target, reply]);
    expect(validateWhatsAppMessage(project, reply, 1)).toEqual([]);
    expect(validateWhatsAppMessage(project, { ...target, whatsappReply: { messageId: 'b' } }, 0)).toContain('A reply must point to an earlier message.');
  });

  test('duplicate reactions merge and invalid entries are removed', () => {
    expect(normalizeWhatsAppReactions([
      { emoji: '❤️', count: 2 }, { emoji: '❤️', count: 3 }, { emoji: '😂' }, { emoji: 'not emoji' },
    ])).toEqual([{ emoji: '❤️', count: 5 }, { emoji: '😂' }]);
  });

  test('structured links require HTTPS and a title', () => {
    expect(validateWhatsAppLinkPreview({ url: 'http://example.com', title: '' })).toEqual([
      'Link previews need an absolute HTTPS address.',
      'Link previews need a title.',
    ]);
  });

  test('media validates MIME and complete caption metadata', () => {
    expect(validateWhatsAppMedia({
      kind: 'video', source: 'direct', url: 'https://example.com/video.mp4', mimeType: 'video/mp4', captionTrackUrl: 'https://example.com/en.vtt',
    })).toContain('Caption URL, language, and label must be provided together.');
  });

  test('accepts supported WhatsApp YouTube URLs and rejects a watch page as a direct file', () => {
    expect(validateWhatsAppMedia({
      kind: 'video', source: 'youtube', url: 'https://www.youtube.com/watch?v=XlcK4VYSWZk',
    })).toEqual([]);
    expect(validateWhatsAppMedia({
      kind: 'video', source: 'direct', url: 'https://www.youtube.com/watch?v=XlcK4VYSWZk', mimeType: 'video/mp4',
    })).toContain('Choose YouTube as the video source for YouTube addresses.');
    expect(validateWhatsAppMedia({
      kind: 'video', source: 'youtube', url: 'https://www.youtube.com/watch?v=XlcK4VYSWZk', posterUrl: 'f',
    })).toEqual([]);
  });

  test('primary content types are mutually exclusive', () => {
    const message: Message = {
      id: 'mixed', sender: 'You', content: '', outgoing: true,
      attachments: [{ type: 'image', url: 'https://example.com/image.png', alt: 'Image' }],
      whatsappLinkPreview: { url: 'https://example.com', title: 'Example' },
    };
    const project = whatsappProject([message]);
    expect(validateWhatsAppMessage(project, message, 0)).toContain('Choose images, a link preview, or audio/video—not more than one.');
  });
});
