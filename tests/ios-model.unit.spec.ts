import { expect, test } from '@playwright/test';
import {
  isSameIOSRun,
  normalizeIOSTapbacks,
  resolveIOSSpeakerKey,
  validateIOSLinkPreview,
  validateIOSMedia,
  validateIOSMessage,
  iosMessageLabel,
  iosToneForMessage,
} from '../src/lib/ios';
import { defaultProject, IOSMedia, Message, SkinProject } from '../src/lib/schema';

/** §14.1 of the iOS improvement plan. Pure model, no browser, no React. */

function iosProject(messages: Message[], settings: Partial<SkinProject['settings']> = {}): SkinProject {
  const project = defaultProject();
  project.template = 'ios';
  project.messages = messages;
  Object.assign(project.settings, settings);
  return project;
}

function text(id: string, extra: Partial<Message> = {}): Message {
  return { id, sender: 'Sam', content: 'hello', outgoing: false, ...extra };
}

const GROUP = {
  iosGroupMode: true,
  iosGroupParticipants: [
    { id: 'alex', name: 'Alex', color: '#c8102e', iosTone: 'red' as const },
    { id: 'bea', name: 'Bea', color: '#0a58ca', iosTone: 'blue' as const },
  ],
};

test.describe('iOS speaker keys and run grouping', () => {
  test('two incoming group participants are different speakers', () => {
    const alex = text('a', { sender: 'Alex', participantId: 'alex' });
    const bea = text('b', { sender: 'Bea', participantId: 'bea' });
    const project = iosProject([alex, bea], GROUP);
    expect(resolveIOSSpeakerKey(project, alex)).not.toBe(resolveIOSSpeakerKey(project, bea));
    // The defect this replaces: both are incoming, so direction alone merged
    // them into one run with a single tail between two people.
    expect(alex.outgoing).toBe(bea.outgoing);
    expect(isSameIOSRun(project, alex, bea)).toBe(false);
  });

  test('the same participant twice in a row is one run', () => {
    const first = text('a', { sender: 'Alex', participantId: 'alex' });
    const second = text('b', { sender: 'Alex', participantId: 'alex' });
    const project = iosProject([first, second], GROUP);
    expect(isSameIOSRun(project, first, second)).toBe(true);
  });

  test('events, typing, time breaks, and the forced boundary all split runs', () => {
    const first = text('a', { sender: 'Alex', participantId: 'alex' });
    const project = iosProject([first], GROUP);
    const same = (extra: Partial<Message>) => isSameIOSRun(project, first, text('b', { sender: 'Alex', participantId: 'alex', ...extra }));
    expect(same({})).toBe(true);
    expect(same({ iosEvent: { kind: 'date', text: 'Today' } })).toBe(false);
    expect(same({ isTyping: true })).toBe(false);
    expect(same({ showTimeBreak: true, timeBreakText: 'Five minutes later' })).toBe(false);
    expect(same({ iosStartNewRun: true })).toBe(false);
    expect(same({ outgoing: true })).toBe(false);
    expect(isSameIOSRun(project, first, undefined)).toBe(false);
    expect(isSameIOSRun(project, undefined, first)).toBe(false);
  });
});

test.describe('iOS replies', () => {
  const scene = () => iosProject([
    text('one'),
    text('two'),
    { id: 'divider', sender: '', content: '', outgoing: false, iosEvent: { kind: 'date', text: 'Today' } },
    text('three'),
  ]);

  test('accepts an earlier non-event target', () => {
    const project = scene();
    project.messages[3].iosReply = { messageId: 'one' };
    expect(validateIOSMessage(project, project.messages[3], 3)).toEqual([]);
  });

  test('rejects self, missing, future, and event targets', () => {
    const project = scene();
    const check = (messageId: string, index: number) => {
      const message = { ...project.messages[index], iosReply: { messageId } };
      return validateIOSMessage({ ...project, messages: project.messages.map((m, i) => i === index ? message : m) }, message, index);
    };
    expect(check('three', 3)).toEqual(['A message cannot reply to itself.']);
    expect(check('nobody', 3)).toEqual(['The replied-to message no longer exists.']);
    expect(check('three', 1)).toEqual(['A reply must point to an earlier message.']);
    expect(check('divider', 3)).toEqual(['A reply cannot point to a date divider or system event.']);
  });
});

test.describe('iOS primary content exclusivity and images', () => {
  test('only one primary content block may be populated', () => {
    const message = text('a', {
      attachments: [{ type: 'image', url: 'https://example.com/a.png', alt: 'A door' }],
      iosLinkPreview: { url: 'https://example.com', title: 'Example' },
    });
    expect(validateIOSMessage(iosProject([message]), message, 0))
      .toContain('Choose images, a link preview, or audio/video—not more than one.');
  });

  test('one to four images validate, five do not, and each needs alt text or a decorative mark', () => {
    const images = (count: number) => Array.from({ length: count }, (_, i) => ({ type: 'image' as const, url: `https://example.com/${i}.png`, alt: `Image ${i}` }));
    for (const count of [1, 2, 3, 4]) {
      const message = text('a', { attachments: images(count) });
      expect(validateIOSMessage(iosProject([message]), message, 0), `${count} images`).toEqual([]);
    }
    const tooMany = text('a', { attachments: images(5) });
    expect(validateIOSMessage(iosProject([tooMany]), tooMany, 0)).toContain('An iMessage can contain at most four images.');

    const undescribed = text('a', { attachments: [{ type: 'image', url: 'https://example.com/a.png' }] });
    expect(validateIOSMessage(iosProject([undescribed]), undescribed, 0)).toContain('Describe each iMessage image or mark it decorative.');

    const decorative = text('a', { attachments: [{ type: 'image', url: 'https://example.com/a.png', decorative: true }] });
    expect(validateIOSMessage(iosProject([decorative]), decorative, 0)).toEqual([]);
  });

  test('an ordinary message with neither text nor content is invalid, but a typing row is not', () => {
    const empty = text('a', { content: '' });
    expect(validateIOSMessage(iosProject([empty]), empty, 0)).toContain('Add message text or a content card.');
    const typing = text('a', { content: '', isTyping: true });
    expect(validateIOSMessage(iosProject([typing]), typing, 0)).toEqual([]);
  });
});

test.describe('iOS link previews', () => {
  test('require an HTTPS address and a title, and cap the optional fields', () => {
    expect(validateIOSLinkPreview({ url: 'http://example.com', title: 'A' })).toContain('Link previews need an absolute HTTPS address.');
    expect(validateIOSLinkPreview({ url: 'https://example.com', title: '  ' })).toContain('Link previews need a title.');
    expect(validateIOSLinkPreview({ url: 'https://example.com', title: 'x'.repeat(201) })).toContain('Link preview titles must be 200 characters or fewer.');
    expect(validateIOSLinkPreview({ url: 'https://example.com', title: 'A', siteName: 'x'.repeat(101) })).toContain('Site names must be 100 characters or fewer.');
    expect(validateIOSLinkPreview({ url: 'https://example.com', title: 'A', description: 'x'.repeat(501) })).toContain('Link descriptions must be 500 characters or fewer.');
    expect(validateIOSLinkPreview({ url: 'https://example.com', title: 'A' })).toEqual([]);
  });

  test('a preview image needs a description unless it is decorative', () => {
    const base = { url: 'https://example.com', title: 'A' };
    expect(validateIOSLinkPreview({ ...base, image: { type: 'image', url: 'https://example.com/a.png' } }))
      .toContain('Describe the link preview image or mark it decorative.');
    expect(validateIOSLinkPreview({ ...base, image: { type: 'image', url: 'https://example.com/a.png', decorative: true } })).toEqual([]);
    expect(validateIOSLinkPreview({ ...base, image: { type: 'image', url: 'javascript:alert(1)', alt: 'x' } }))
      .toContain('The link preview image address is invalid.');
  });
});

test.describe('iOS media', () => {
  test('audio needs an HTTPS file and a supported MIME type', () => {
    expect(validateIOSMedia({ kind: 'audio', url: 'https://example.com/a.mp3', mimeType: 'audio/mpeg' })).toEqual([]);
    expect(validateIOSMedia({ kind: 'audio', url: 'http://example.com/a.mp3', mimeType: 'audio/mpeg' }))
      .toContain('Voice messages need an absolute HTTPS file address.');
    expect(validateIOSMedia({ kind: 'audio', url: 'https://example.com/a.aac', mimeType: 'audio/aac' as never }))
      .toContain('Choose a supported audio file type.');
  });

  test('a voice note with no address at all is a decorative one, not an error', () => {
    // **The state the editor creates by default.** `blankMedia('audio')` is
    // `{ kind: 'audio', url: '', mimeType: 'audio/mpeg' }`, and the generator
    // draws exactly that: no url means no `playableSource`, so it emits the
    // waveform card and instantiates no player. An author writing a scene wants
    // a *picture* of a voice note far more often than a hosted file.
    //
    // Four gates disagreed about this until 18 Aug 2026 — the editor created
    // it, the renderer drew it, localStorage silently discarded it on reload,
    // and the project backup threw `Message N iOS media URL cannot be empty`.
    // The rule that was actually intended is the one above: an address, if
    // given, must be HTTPS.
    expect(validateIOSMedia({ kind: 'audio', url: '', mimeType: 'audio/mpeg' })).toEqual([]);
    expect(validateIOSMedia({ kind: 'audio', url: '   ', mimeType: 'audio/mpeg' })).toEqual([]);
    // And a malformed one is still refused, which is what the test above pins.
    expect(validateIOSMedia({ kind: 'audio', url: 'not-a-url', mimeType: 'audio/mpeg' }))
      .toContain('Voice messages need an absolute HTTPS file address.');
  });

  test('every supported YouTube address shape normalizes', () => {
    const urls = [
      'https://www.youtube.com/watch?v=XlcK4VYSWZk',
      'https://youtu.be/XlcK4VYSWZk',
      'https://www.youtube.com/shorts/XlcK4VYSWZk',
      'https://www.youtube.com/embed/XlcK4VYSWZk',
      'https://www.youtube.com/live/XlcK4VYSWZk',
    ];
    for (const url of urls) {
      expect(validateIOSMedia({ kind: 'video', source: 'youtube', url }), url).toEqual([]);
    }
    expect(validateIOSMedia({ kind: 'video', source: 'youtube', url: 'https://example.com/not-youtube' }))
      .toContain('Use a supported HTTPS YouTube watch, share, Shorts, live, or embed address.');
  });

  test('an empty or malformed YouTube poster is never an error, so it cannot suppress the derived thumbnail', () => {
    const base = { kind: 'video', source: 'youtube', url: 'https://www.youtube.com/watch?v=XlcK4VYSWZk' } as const;
    expect(validateIOSMedia({ ...base })).toEqual([]);
    expect(validateIOSMedia({ ...base, posterUrl: '' })).toEqual([]);
    expect(validateIOSMedia({ ...base, posterUrl: '   ' })).toEqual([]);
    expect(validateIOSMedia({ ...base, posterUrl: 'f' })).toEqual([]);
  });

  test('an optional video title may be absent, empty, or present', () => {
    const base = { kind: 'video', source: 'youtube', url: 'https://youtu.be/XlcK4VYSWZk' } as const;
    expect(validateIOSMedia({ ...base })).toEqual([]);
    expect(validateIOSMedia({ ...base, title: '' })).toEqual([]);
    expect(validateIOSMedia({ ...base, title: 'The drive north' })).toEqual([]);
  });

  test('direct video demands HTTPS, a supported MIME, and an all-or-nothing caption trio', () => {
    const base: Extract<IOSMedia, { source: 'direct' }> = { kind: 'video', source: 'direct', url: 'https://example.com/a.mp4', mimeType: 'video/mp4' };
    expect(validateIOSMedia(base)).toEqual([]);
    expect(validateIOSMedia({ ...base, url: 'http://example.com/a.mp4' })).toContain('Direct video needs an absolute HTTPS file address.');
    expect(validateIOSMedia({ ...base, url: 'https://www.youtube.com/watch?v=XlcK4VYSWZk' }))
      .toContain('Choose YouTube as the video source for YouTube addresses.');
    expect(validateIOSMedia({ ...base, mimeType: 'video/quicktime' as never })).toContain('Choose a supported video file type.');
    expect(validateIOSMedia({ ...base, posterUrl: 'http://example.com/p.png' })).toContain('The video poster needs an absolute HTTPS address.');

    const partial = 'Caption URL, language, and label must be provided together.';
    expect(validateIOSMedia({ ...base, captionTrackUrl: 'https://example.com/a.vtt' })).toContain(partial);
    expect(validateIOSMedia({ ...base, captionTrackUrl: 'https://example.com/a.vtt', captionLanguage: 'en' })).toContain(partial);
    expect(validateIOSMedia({ ...base, captionLabel: 'English' })).toContain(partial);
    expect(validateIOSMedia({ ...base, captionTrackUrl: 'https://example.com/a.vtt', captionLanguage: 'en', captionLabel: 'English' })).toEqual([]);
  });
});

test.describe('iOS Tapbacks', () => {
  test('normalization merges duplicates, caps counts and list size, and drops non-graphemes', () => {
    expect(normalizeIOSTapbacks([{ emoji: '❤️' }, { emoji: '❤️' }])).toEqual([{ emoji: '❤️', count: 2 }]);
    expect(normalizeIOSTapbacks([{ emoji: '👍', count: 5 }])).toEqual([{ emoji: '👍', count: 5 }]);
    expect(normalizeIOSTapbacks([{ emoji: '👍', count: 99999 }])).toEqual([{ emoji: '👍', count: 9999 }]);
    expect(normalizeIOSTapbacks([{ emoji: 'ab' }, { emoji: '' }, { emoji: '  ' }])).toEqual([]);
    expect(normalizeIOSTapbacks([{ emoji: '❤️' }, { emoji: '👍' }, { emoji: '😂' }, { emoji: '😮' }]))
      .toEqual([{ emoji: '❤️' }, { emoji: '👍' }, { emoji: '😂' }]);
    expect(normalizeIOSTapbacks(undefined)).toEqual([]);
  });

  test('validation rejects a fourth type, a multi-grapheme emoji, and an out-of-range count', () => {
    const four = text('a', { iosTapbacks: [{ emoji: '❤️' }, { emoji: '👍' }, { emoji: '😂' }, { emoji: '😮' }] });
    expect(validateIOSMessage(iosProject([four]), four, 0)).toContain('A message can carry at most three Tapback types.');
    const pair = text('a', { iosTapbacks: [{ emoji: '❤️👍' }] });
    expect(validateIOSMessage(iosProject([pair]), pair, 0)).toContain('Each Tapback must be one emoji.');
    for (const count of [0, -1, 10000, 1.5]) {
      const message = text('a', { iosTapbacks: [{ emoji: '❤️', count }] });
      expect(validateIOSMessage(iosProject([message]), message, 0), String(count)).toContain('Tapback counts must be between 1 and 9999.');
    }
  });
});

test.describe('iOS events and group membership', () => {
  test('an event needs text and may carry no message data', () => {
    const empty: Message = { id: 'e', sender: '', content: '', outgoing: false, iosEvent: { kind: 'date', text: '  ' } };
    expect(validateIOSMessage(iosProject([empty]), empty, 0)).toContain('Date dividers and system events need text.');

    const contaminated: Message = { id: 'e', sender: '', content: 'hello', outgoing: false, iosEvent: { kind: 'system', text: 'Alex named the conversation' } };
    expect(validateIOSMessage(iosProject([contaminated]), contaminated, 0)).toContain('An event cannot also contain message content.');

    const clean: Message = { id: 'e', sender: '', content: '', outgoing: false, iosEvent: { kind: 'system', text: 'Alex named the conversation Road Trip' } };
    expect(validateIOSMessage(iosProject([clean]), clean, 0)).toEqual([]);
  });

  test('an incoming group message must resolve to a real participant', () => {
    const stranger = text('a', { sender: 'Nobody', participantId: 'ghost' });
    expect(validateIOSMessage(iosProject([stranger], GROUP), stranger, 0))
      .toContain('Choose a valid group participant for this incoming message.');
    const member = text('a', { sender: 'Alex', participantId: 'alex' });
    expect(validateIOSMessage(iosProject([member], GROUP), member, 0)).toEqual([]);
    // Outgoing messages are the author, who is never in the participant list.
    const you = text('a', { sender: 'You', outgoing: true, participantId: undefined });
    expect(validateIOSMessage(iosProject([you], GROUP), you, 0)).toEqual([]);
  });
});

test.describe('iOS labels and tones', () => {
  test('a message is labelled by its content type', () => {
    expect(iosMessageLabel(text('a', { content: 'Where are you?' }))).toBe('Where are you?');
    expect(iosMessageLabel(text('a', { content: '', iosEvent: { kind: 'date', text: 'Today' } }))).toBe('Date divider');
    expect(iosMessageLabel(text('a', { content: '', iosEvent: { kind: 'system', text: 'Renamed' } }))).toBe('System event');
    expect(iosMessageLabel(text('a', { content: '', isTyping: true }))).toBe('Typing indicator');
    expect(iosMessageLabel(text('a', { content: '', attachments: [{ type: 'image', url: 'x' }] }))).toBe('Photo');
    expect(iosMessageLabel(text('a', { content: '', attachments: [{ type: 'image', url: 'x' }, { type: 'image', url: 'y' }] }))).toBe('Photos');
    expect(iosMessageLabel(text('a', { content: '', iosMedia: { kind: 'audio', url: 'https://a/a.mp3', mimeType: 'audio/mpeg' } }))).toBe('Voice message');
    expect(iosMessageLabel(text('a', { content: '', iosMedia: { kind: 'video', source: 'youtube', url: 'https://youtu.be/XlcK4VYSWZk' } }))).toBe('Video');
    expect(iosMessageLabel(text('a', { content: '', iosLinkPreview: { url: 'https://a', title: 'Access log' } }))).toBe('Access log');
  });

  test('a tone resolves by character first, then participant, then a stable default', () => {
    const project = iosProject([], GROUP);
    expect(iosToneForMessage(project, text('a', { participantId: 'alex' }))).toBe('red');
    expect(iosToneForMessage(project, text('a', { participantId: 'bea' }))).toBe('blue');
    expect(iosToneForMessage(project, text('a', { participantId: 'ghost' }))).toBe('blue');
  });
});
