import { expect, test } from '@playwright/test';
import { buildHTML } from '../src/lib/generator';
import { buildWorkSkinPreflight } from '../src/lib/preflight';
import { createProjectFile, parseProjectFile, ProjectFileError } from '../src/lib/projectFile';
import { defaultProject, Message, SkinProject } from '../src/lib/schema';
import { buildSceneTranscript } from '../src/lib/transcript';
import { buildWorkSkin } from '../src/lib/workSkin';

/** §14.2 and §14.3 of the iOS improvement plan. */

function richIOS(): SkinProject {
  const project = defaultProject();
  project.template = 'ios';
  project.settings.iosFrameMode = 'phone';
  project.settings.iosScrollable = true;
  project.settings.iosViewportHeightEm = 32;
  project.settings.iosShowStatusBar = true;
  project.settings.iosGroupMode = true;
  project.settings.iosGroupName = 'Night Shift';
  project.settings.iosGroupParticipants = [
    { id: 'alex', name: 'Alex', color: '#c8102e', iosTone: 'red' },
    { id: 'bea', name: 'Bea', color: '#7a3fb5', iosTone: 'purple' },
  ];
  project.messages = [
    { id: 'date', sender: '', content: '', outgoing: false, iosEvent: { kind: 'date', text: 'Today' } },
    { id: 'alex-1', sender: 'Alex', participantId: 'alex', content: 'The side door is open.', outgoing: false, timestamp: '22:14' },
    { id: 'bea-1', sender: 'Bea', participantId: 'bea', content: 'That was not me.', outgoing: false, timestamp: '22:15', iosTapbacks: [{ emoji: '😮', count: 2 }] },
    { id: 'you-1', sender: 'You', content: 'I am checking it now.', outgoing: true, timestamp: '22:16', status: 'read', iosReply: { messageId: 'alex-1' } },
    { id: 'photos', sender: 'You', content: 'This is what I can see.', outgoing: true, timestamp: '22:17', attachments: [1, 2, 3, 4].map(index => ({ type: 'image' as const, url: `https://example.com/door-${index}.png`, alt: `Door view ${index}` })) },
    { id: 'link', sender: 'Alex', participantId: 'alex', content: 'The access log is here.', outgoing: false, timestamp: '22:18', iosLinkPreview: { url: 'https://example.com/access-log', title: 'Access log', siteName: 'example.com', description: 'A record of recent entries.', image: { type: 'image', url: 'https://example.com/log.png', alt: 'Access log chart' } } },
    { id: 'voice', sender: 'Bea', participantId: 'bea', content: '', outgoing: false, timestamp: '22:19', iosMedia: { kind: 'audio', url: 'https://example.com/note.mp3', mimeType: 'audio/mpeg', duration: '0:08', transcript: 'I heard the latch move.' } },
    { id: 'video', sender: 'You', content: '', outgoing: true, timestamp: '22:20', iosMedia: { kind: 'video', source: 'direct', url: 'https://example.com/door.mp4', mimeType: 'video/mp4', posterUrl: 'https://example.com/door-poster.png', title: 'Side door camera', duration: '0:12', description: 'The side door swings inward.', captionTrackUrl: 'https://example.com/door-en.vtt', captionLanguage: 'en', captionLabel: 'English' } },
    { id: 'system', sender: '', content: '', outgoing: false, iosEvent: { kind: 'system', text: 'Security code changed' } },
  ];
  return project;
}

test.describe('iOS renderer and export contract', () => {
  test('renders every structured block without loading a player in the app or PNG path', () => {
    const html = buildHTML(richIOS());
    expect(html).toContain('ios-frame-phone');
    expect(html).toContain('ios-scroll');
    expect(html).toContain('ios-status-bar');
    expect(html).toContain('ios-reply ios-reply-red');
    expect(html).toContain('ios-images-4');
    expect(html).toContain('ios-link-preview');
    expect(html).toContain('ios-audio-card');
    expect(html).toContain('ios-video-card');
    expect(html).toContain('ios-tapbacks');
    expect(html).toContain('ios-event-date');
    expect(html).toContain('ios-event-system');
    // The static path is the live preview, Save PNG, and the ImgBB upload.
    expect(html).not.toMatch(/<(audio|video|source|track|iframe)\b/i);
    // AO3 strips inline style from every element, so emitting one means the
    // preview and the archive disagree.
    expect(html).not.toMatch(/\sstyle=/i);
  });

  test('group speakers get their own run, tail, and tone class', () => {
    const html = buildHTML(richIOS());
    // Alex and Bea are both incoming. Comparing direction alone merged them
    // into one run with a single tail between two different people.
    expect(html).toContain('ios-tone-red');
    expect(html).toContain('ios-tone-purple');
    expect((html.match(/bubble-tail-in/g) || []).length).toBeGreaterThanOrEqual(2);
    expect(html).not.toContain('row in middle');
  });

  test('emits narrowly generated native media only in AO3 Work Text', () => {
    const html = buildHTML(richIOS(), 'ao3-work');
    expect(html).toContain('<audio class="ios-native-audio" title="Voice message" controls="controls" crossorigin="anonymous" preload="metadata">');
    expect(html).toContain('<source src="https://example.com/note.mp3" type="audio/mpeg">');
    expect(html).toContain('<video class="ios-native-video" title="iMessage video" controls="controls" crossorigin="anonymous" preload="metadata"');
    expect(html).toContain('<track src="https://example.com/door-en.vtt" kind="captions" srclang="en" label="English" default="default">');
    expect(html).toContain('Captions: <a href="https://example.com/door-en.vtt">English</a>');
    // Nothing pasted, nothing scripted: only what the generator built.
    expect(html).not.toMatch(/<(script|object|embed)\b/i);
    // The static-only decorations. Matched with the closing quote because
    // `ios-video-player` contains `ios-video-play` as a substring.
    expect(html).not.toContain('class="ios-video-play"');
    expect(html).not.toContain('class="ios-audio-play"');
    expect(html).not.toContain('ios-waveform');
    expect(html).not.toContain('ios-video-poster');
    // The visible fallback survives beside the player.
    expect(html).toContain('ios-media-source');
  });

  test('YouTube derives its thumbnail statically and its privacy-enhanced embed on AO3', () => {
    const project = richIOS();
    project.messages = [{
      id: 'youtube', sender: 'You', content: 'Watch this', outgoing: true,
      iosMedia: { kind: 'video', source: 'youtube', url: 'https://www.youtube.com/watch?v=XlcK4VYSWZk' },
    }];
    const scene = buildHTML(project, 'static');
    const ao3 = buildHTML(project, 'ao3-work');
    expect(scene).toContain('https://i.ytimg.com/vi/XlcK4VYSWZk/hqdefault.jpg');
    expect(scene).not.toMatch(/<iframe\b/i);
    expect(ao3).toContain('<iframe src="https://www.youtube-nocookie.com/embed/XlcK4VYSWZk"');
    expect(ao3).not.toMatch(/<video\b/i);
  });

  test('a malformed optional poster cannot suppress the derived thumbnail', () => {
    const project = richIOS();
    project.messages = [{
      id: 'youtube', sender: 'You', content: 'Watch this', outgoing: true,
      iosMedia: { kind: 'video', source: 'youtube', url: 'https://www.youtube.com/watch?v=XlcK4VYSWZk', posterUrl: 'f' },
    }];
    const scene = buildHTML(project, 'static');
    expect(scene).toContain('https://i.ytimg.com/vi/XlcK4VYSWZk/hqdefault.jpg');
    expect(scene).not.toContain('src="f"');
    // And the backup stays usable rather than being rejected over it.
    const parsed = parseProjectFile(JSON.stringify(createProjectFile(project, [])));
    expect(parsed.project.messages[0].iosMedia).toEqual({
      kind: 'video', source: 'youtube', url: 'https://www.youtube.com/watch?v=XlcK4VYSWZk',
    });
  });

  test('every image is emitted once with its own alt text', () => {
    const html = buildHTML(richIOS());
    for (const index of [1, 2, 3, 4]) {
      expect((html.match(new RegExp(`door-${index}\\.png`, 'g')) || []).length, `image ${index}`).toBe(1);
      expect(html).toContain(`alt="Door view ${index}"`);
    }
  });

  test('events sit outside the bubble list and Tapbacks sit inside it', () => {
    const html = buildHTML(richIOS());
    expect(html).toMatch(/<div class="ios-event ios-event-date"[^>]*><dl>/);
    expect(html).not.toMatch(/<dd class="[^"]*bubble[^"]*"[^>]*>[^<]*<div class="ios-event/);
    // The only rule that styles the stack is a descendant selector, so a
    // sibling would render as unstyled trailing text.
    expect(html).toMatch(/<dd class="[^"]*bubble[^"]*">.*?ios-tapbacks.*?<\/dd>/s);
  });

  test('produces AO3-safe CSS and a comprehensible skin-off reading order', () => {
    const skin = buildWorkSkin(richIOS());
    expect(skin.violations).toEqual([]);
    expect(skin.css).not.toMatch(/\/\*/);
    expect(skin.html).not.toContain('data-message-id');
    // SVG tails go; the CSS pair switches on.
    expect(skin.html).not.toContain('<svg');
    expect(skin.html).toContain('css-tails');
    const asRead = skin.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    expect(asRead).toContain('Replying to Alex The side door is open.');
    expect(asRead.match(/Replying to Alex/g)).toHaveLength(1);
    expect(asRead).toContain('Tapbacks: 😮 2');
    expect(asRead).toContain('Transcript: I heard the latch move.');
    expect(asRead).toContain('Video source');
    expect(asRead).toContain('Access log');
    expect(asRead).toContain('https://example.com/access-log');
  });

  test('a reply resolves against the full scene when a chunk is rastered', () => {
    const source = richIOS();
    const chunk: SkinProject = { ...source, messages: [source.messages[3]] };
    const html = buildHTML(chunk, 'static', { sourceMessages: source.messages });
    expect(html).toContain('Replying to Alex');
    // Run boundaries stay local to the chunk, so a lone message is a whole run.
    expect(html).toContain('row out single');
  });

  test('a reply preview follows later edits to its target rather than a stored copy', () => {
    const project = richIOS();
    expect(buildHTML(project)).toContain('The side door is open.');
    project.messages[1].content = 'The side door is wide open.';
    const edited = buildHTML(project);
    expect(edited).toContain('The side door is wide open.');
    expect(edited).not.toContain('The side door is open.<');
  });

  test('a missing reply target renders an explicit fallback and blocks export', () => {
    const project = richIOS();
    project.messages = project.messages.filter(message => message.id !== 'alex-1');
    expect(buildHTML(project)).toContain('Original message unavailable');
    const skin = buildWorkSkin(project);
    const preflight = buildWorkSkinPreflight(project, skin.html, skin.violations, true);
    expect(preflight.find(item => item.id === 'ios-model')).toMatchObject({ severity: 'block', status: 'fail' });
  });
});

test.describe('iOS persistence', () => {
  test('v7 round-trips every iOS field and keeps transcript and preflight detail', () => {
    const project = richIOS();
    const parsed = parseProjectFile(JSON.stringify(createProjectFile(project, [])));
    expect(parsed.schemaVersion).toBe(7);
    const shape = (messages: Message[]) => messages.map(message => ({
      id: message.id,
      reply: message.iosReply,
      link: message.iosLinkPreview,
      media: message.iosMedia,
      tapbacks: message.iosTapbacks,
      event: message.iosEvent,
      newRun: message.iosStartNewRun,
    }));
    expect(shape(parsed.project.messages)).toEqual(shape(project.messages));
    expect(parsed.project.settings).toMatchObject({
      iosFrameMode: 'phone',
      iosScrollable: true,
      iosViewportHeightEm: 32,
    });
    expect(parsed.project.settings.iosGroupParticipants?.map(participant => participant.iosTone)).toEqual(['red', 'purple']);

    const transcript = buildSceneTranscript(parsed.project);
    expect(transcript).toContain('You replied to Alex: The side door is open.');
    expect(transcript).toContain('[Voice message, 0:08]\nTranscript: I heard the latch move.');
    expect(transcript).toContain('[Video: Side door camera, 0:12]');
    expect(transcript).toContain('Tapbacks: 😮 ×2');

    const skin = buildWorkSkin(parsed.project);
    const preflight = buildWorkSkinPreflight(parsed.project, skin.html, skin.violations, true);
    expect(preflight.find(item => item.id === 'ios-model')).toMatchObject({ severity: 'block', status: 'pass' });
    expect(preflight.find(item => item.id === 'ios-media-fallback')).toMatchObject({ severity: 'warn', status: 'pass' });
    expect(preflight.find(item => item.id === 'ios-video-poster')).toMatchObject({ severity: 'warn', status: 'pass' });
    expect(preflight.find(item => item.id === 'ios-scroll-flattened')).toMatchObject({ severity: 'warn', status: 'fail' });
  });

  test('an optional video title and poster may be absent and still round-trip', () => {
    const project = richIOS();
    project.messages = [{
      id: 'video', sender: 'You', content: 'Watch', outgoing: true,
      iosMedia: { kind: 'video', source: 'direct', url: 'https://example.com/a.mp4', mimeType: 'video/mp4' },
    }];
    const parsed = parseProjectFile(JSON.stringify(createProjectFile(project, [])));
    expect(parsed.project.messages[0].iosMedia).toEqual({
      kind: 'video', source: 'direct', url: 'https://example.com/a.mp4', mimeType: 'video/mp4',
    });
  });

  test('strict import rejects malformed discriminators and contradictory content', () => {
    const withMessages = (messages: Message[]) => {
      const project = richIOS();
      project.messages = messages;
      return JSON.stringify(createProjectFile(project, []));
    };
    // A media block with no recognisable source is rejected, not guessed at.
    expect(() => parseProjectFile(withMessages([
      { id: 'a', sender: 'You', content: 'x', outgoing: true, iosMedia: { kind: 'video', url: 'https://example.com/a.mp4' } as never },
    ]))).toThrow(ProjectFileError);
    // Two primary content types at once.
    expect(() => parseProjectFile(withMessages([
      { id: 'a', sender: 'You', content: 'x', outgoing: true, attachments: [{ type: 'image', url: 'https://example.com/a.png', alt: 'A' }], iosLinkPreview: { url: 'https://example.com', title: 'T' } },
    ]))).toThrow(ProjectFileError);
    // A reply that points forward.
    expect(() => parseProjectFile(withMessages([
      { id: 'a', sender: 'You', content: 'x', outgoing: true, iosReply: { messageId: 'b' } },
      { id: 'b', sender: 'You', content: 'y', outgoing: true },
    ]))).toThrow(ProjectFileError);
    // An event carrying message content.
    expect(() => parseProjectFile(withMessages([
      { id: 'a', sender: '', content: 'hello', outgoing: false, iosEvent: { kind: 'date', text: 'Today' } },
    ]))).toThrow(ProjectFileError);
  });

  test('an iOS field never leaks into a WhatsApp scene, or the reverse', () => {
    const ios = buildHTML(richIOS());
    expect(ios).not.toMatch(/\bwa-/);

    const whatsapp = defaultProject();
    whatsapp.template = 'android';
    whatsapp.messages = [
      { id: 'a', sender: 'Sam', content: 'first', outgoing: false },
      // iOS fields on a WhatsApp scene must be inert, not rendered.
      { id: 'b', sender: 'You', content: 'second', outgoing: true, iosReply: { messageId: 'a' }, iosTapbacks: [{ emoji: '❤️' }] },
    ];
    const html = buildHTML(whatsapp);
    expect(html).not.toMatch(/\bios-/);
    expect(html).not.toContain('Replying to');
  });
});
