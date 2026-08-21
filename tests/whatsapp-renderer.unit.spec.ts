import { expect, test } from '@playwright/test';
import { buildHTML } from '../src/lib/generator';
import { buildWorkSkinPreflight } from '../src/lib/preflight';
import { createProjectFile, parseProjectFile } from '../src/lib/projectFile';
import { defaultProject, SkinProject } from '../src/lib/schema';
import { buildSceneTranscript } from '../src/lib/transcript';
import { buildWorkSkin } from '../src/lib/workSkin';

function richWhatsApp(): SkinProject {
  const project = defaultProject();
  project.template = 'android';
  project.settings.androidFrameMode = 'phone';
  project.settings.androidGroupMode = true;
  project.settings.androidGroupName = 'Night Shift';
  project.settings.androidGroupSubtitleMode = 'members';
  project.settings.androidScrollable = true;
  project.settings.androidViewportHeightEm = 32;
  project.settings.androidGroupParticipants = [
    { id: 'alex', name: 'Alex', color: '#137333', whatsappTone: 'green' },
    { id: 'bea', name: 'Bea', color: '#6f42c1', whatsappTone: 'purple' },
  ];
  project.messages = [
    { id: 'date', sender: '', content: '', outgoing: false, whatsappEvent: { kind: 'date', text: '13 August 2026' } },
    { id: 'alex-1', sender: 'Alex', participantId: 'alex', content: 'The side door is open.', outgoing: false, timestamp: '22:14' },
    { id: 'bea-1', sender: 'Bea', participantId: 'bea', content: 'That was not me.', outgoing: false, timestamp: '22:15', whatsappReactions: [{ emoji: '😬', count: 2 }] },
    { id: 'you-1', sender: 'You', content: 'I am checking it now.', outgoing: true, timestamp: '22:16', status: 'read', whatsappReply: { messageId: 'alex-1' } },
    { id: 'photos', sender: 'You', content: 'This is what I can see.', outgoing: true, timestamp: '22:17', attachments: [1, 2, 3, 4].map(index => ({ type: 'image', url: `https://example.com/door-${index}.png`, alt: `Door view ${index}` })) },
    { id: 'link', sender: 'Alex', participantId: 'alex', content: 'The access log is here.', outgoing: false, timestamp: '22:18', whatsappLinkPreview: { url: 'https://example.com/access-log', title: 'Access log', siteName: 'example.com', description: 'A record of recent entries.', image: { type: 'image', url: 'https://example.com/log.png', alt: 'Access log chart' } } },
    { id: 'voice', sender: 'Bea', participantId: 'bea', content: '', outgoing: false, timestamp: '22:19', whatsappMedia: { kind: 'audio', url: 'https://example.com/note.mp3', mimeType: 'audio/mpeg', duration: '0:08', transcript: 'I heard the latch move.' } },
    { id: 'video', sender: 'You', content: '', outgoing: true, timestamp: '22:20', whatsappMedia: { kind: 'video', source: 'direct', url: 'https://example.com/door.mp4', mimeType: 'video/mp4', posterUrl: 'https://example.com/door-poster.png', duration: '0:12', description: 'The side door swings inward.', captionTrackUrl: 'https://example.com/door-en.vtt', captionLanguage: 'en', captionLabel: 'English' } },
    { id: 'system', sender: '', content: '', outgoing: false, whatsappEvent: { kind: 'system', text: 'Security code changed' } },
  ];
  return project;
}

test.describe('WhatsApp renderer and export contract', () => {
  test('renders all structured content without loading playable media in the app or PNG path', () => {
    const project = richWhatsApp();
    const html = buildHTML(project);
    expect(html).toContain('wa-frame-phone');
    expect(html).toContain('wa-reply-green');
    expect(html).toContain('wa-images-4');
    expect(html).toContain('wa-link-preview');
    expect(html).toContain('wa-audio');
    expect(html).toContain('wa-video');
    expect(html).toContain('wa-reactions');
    expect(html).toContain('wa-event-date');
    expect(html).toContain('wa-event-system');
    expect(html).not.toMatch(/<(audio|video|source|track)\b/i);
    expect(html).not.toMatch(/\sstyle=/i);
  });

  test('emits narrowly generated native media only in AO3 work mode', () => {
    const project = richWhatsApp();
    const html = buildHTML(project, 'ao3-work');
    expect(html).toContain('<audio class="wa-native-audio" title="Voice message" controls="controls" crossorigin="anonymous" preload="metadata">');
    expect(html).toContain('<source src="https://example.com/note.mp3" type="audio/mpeg">');
    expect(html).toContain('<video class="wa-native-video" title="WhatsApp video" controls="controls" crossorigin="anonymous" preload="metadata"');
    expect(html).toContain('<track src="https://example.com/door-en.vtt" kind="captions" srclang="en" label="English" default="default">');
    expect(html).toContain('Captions: <a href="https://example.com/door-en.vtt">English</a>');
    expect(html).not.toMatch(/<(iframe|script|object|embed)\b/i);
    expect(html).not.toContain('wa-video-play');
    expect(html).not.toContain('wa-waveform');
  });

  test('uses a no-request placeholder without a poster and never puts players in static output', () => {
    const project = richWhatsApp();
    const video = project.messages.find(message => message.id === 'video')!;
    video.whatsappMedia = { ...video.whatsappMedia!, posterUrl: undefined } as typeof video.whatsappMedia;
    const scene = buildHTML(project, 'static');
    expect(scene).toContain('wa-video-placeholder');
    expect(scene).not.toMatch(/<(audio|video|source|track)\b/i);
    expect(buildHTML(project, 'ao3-work')).toContain('<video class="wa-native-video"');
  });

  test('produces AO3-safe CSS and a comprehensible skin-off reading order', () => {
    const skin = buildWorkSkin(richWhatsApp());
    expect(skin.violations).toEqual([]);
    expect(skin.css).not.toMatch(/\/\*/);
    expect(skin.html).not.toContain('data-message-id');
    const asRead = skin.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    expect(asRead).toContain('Replying to Alex The side door is open.');
    expect(asRead.match(/Replying to Alex/g)).toHaveLength(1);
    expect(asRead).toContain('Reactions: 😬 ×2');
    expect(asRead.match(/Reactions:/g)).toHaveLength(1);
    expect(asRead).toContain('Transcript: I heard the latch move.');
    expect(asRead).toContain('Video source');
  });

  test('round-trips every WhatsApp field and retains transcript/preflight detail', () => {
    const project = richWhatsApp();
    const parsed = parseProjectFile(JSON.stringify(createProjectFile(project, [])));
    expect(parsed.schemaVersion).toBe(7);
    expect(parsed.project.messages.map(message => ({
      id: message.id,
      reply: message.whatsappReply,
      link: message.whatsappLinkPreview,
      media: message.whatsappMedia,
      reactions: message.whatsappReactions,
      event: message.whatsappEvent,
      newRun: message.whatsappStartNewRun,
    }))).toEqual(project.messages.map(message => ({
      id: message.id,
      reply: message.whatsappReply,
      link: message.whatsappLinkPreview,
      media: message.whatsappMedia,
      reactions: message.whatsappReactions,
      event: message.whatsappEvent,
      newRun: message.whatsappStartNewRun,
    })));
    expect(parsed.project.settings).toMatchObject({
      androidFrameMode: 'phone',
      androidGroupSubtitleMode: 'members',
      androidScrollable: true,
      androidViewportHeightEm: 32,
    });
    const transcript = buildSceneTranscript(parsed.project);
    expect(transcript).toContain('You replied to Alex: The side door is open.');
    expect(transcript).toContain('[Voice message, 0:08]\nTranscript: I heard the latch move.');
    expect(transcript).toContain('[Video, 0:12]\nThe side door swings inward.');
    expect(transcript).toContain('Reactions: 😬 ×2');
    const skin = buildWorkSkin(parsed.project);
    const preflight = buildWorkSkinPreflight(parsed.project, skin.html, skin.violations, true);
    expect(preflight.find(item => item.id === 'whatsapp-model')).toMatchObject({ severity: 'warn', status: 'pass' });
    expect(preflight.find(item => item.id === 'whatsapp-media-fallback')).toMatchObject({ severity: 'warn', status: 'pass' });
    expect(preflight.find(item => item.id === 'whatsapp-video-poster')).toMatchObject({ severity: 'warn', status: 'pass' });
  });

  test('renders WhatsApp YouTube as a thumbnail in static output and a real AO3 iframe', () => {
    const project = richWhatsApp();
    project.messages = [{
      id: 'youtube', sender: 'You', content: 'Watch this', outgoing: true,
      whatsappMedia: { kind: 'video', source: 'youtube', url: 'https://www.youtube.com/watch?v=XlcK4VYSWZk' },
    }];
    const scene = buildHTML(project, 'static');
    const ao3 = buildHTML(project, 'ao3-work');
    expect(scene).toContain('https://i.ytimg.com/vi/XlcK4VYSWZk/hqdefault.jpg');
    expect(scene).not.toMatch(/<iframe\b/i);
    expect(ao3).toContain('<iframe src="https://www.youtube-nocookie.com/embed/XlcK4VYSWZk"');
    expect(ao3).not.toMatch(/<video\b/i);
    const parsed = parseProjectFile(JSON.stringify(createProjectFile(project, [])));
    expect(parsed.schemaVersion).toBe(7);
    expect(parsed.project.messages[0].whatsappMedia).toEqual({
      kind: 'video', source: 'youtube', url: 'https://www.youtube.com/watch?v=XlcK4VYSWZk',
    });
  });

  test('ignores an unfinished YouTube poster override and keeps the automatic thumbnail and backup usable', () => {
    const project = richWhatsApp();
    project.messages = [{
      id: 'youtube', sender: 'You', content: 'Watch this', outgoing: true,
      whatsappMedia: { kind: 'video', source: 'youtube', url: 'https://www.youtube.com/watch?v=XlcK4VYSWZk', posterUrl: 'f' },
    }];
    expect(buildHTML(project, 'static')).toContain('https://i.ytimg.com/vi/XlcK4VYSWZk/hqdefault.jpg');
    expect(buildHTML(project, 'static')).not.toContain('src="f"');
    const parsed = parseProjectFile(JSON.stringify(createProjectFile(project, [])));
    expect(parsed.project.messages[0].whatsappMedia).toEqual({
      kind: 'video', source: 'youtube', url: 'https://www.youtube.com/watch?v=XlcK4VYSWZk',
    });
  });

  test('resolves reply cards from the source scene while keeping chunk run boundaries local', () => {
    const source = richWhatsApp();
    const chunk: SkinProject = { ...source, messages: [source.messages[3]] };
    const html = buildHTML(chunk, 'static', { sourceMessages: source.messages });
    expect(html).toContain('Replying to Alex');
    expect(html).toContain('row out single');
  });

  // Group messages carry a participant avatar, on both branches.
  //
  // They never did. The symptom read as AO3 stripping the inline styles off an
  // avatar, but the inline-styled avatar code lived in a branch of the shared
  // msgHTML that this renderer returns before reaching — the markup had no
  // avatar in it at all. Both branches are asserted because the monogram is
  // what a scene built from the picker gets: participants have no avatarUrl
  // until someone sets one.
  test('a group message carries a participant avatar, with and without an avatar url', () => {
    const withoutAvatar = buildHTML(richWhatsApp());
    expect(withoutAvatar).toContain('class="group-avatar-initials"');
    expect(withoutAvatar).toContain('>AL</span>');
    expect(withoutAvatar).not.toContain('class="group-avatar"');

    const project = richWhatsApp();
    project.cast = {
      characters: [{ id: 'alex', name: 'Alex', avatarUrl: 'https://example.com/alex.png' }],
    };
    project.settings.androidGroupParticipants = [
      { id: 'alex', name: 'Alex', color: '#137333', whatsappTone: 'green', characterId: 'alex' },
      { id: 'bea', name: 'Bea', color: '#6f42c1', whatsappTone: 'purple' },
    ];
    project.messages = project.messages.map(message =>
      message.id === 'alex-1' ? { ...message, characterId: 'alex' } : message);

    const withAvatar = buildHTML(project);
    expect(withAvatar).toContain('class="group-avatar"');
    expect(withAvatar).toContain('https://example.com/alex.png');
    // Bea still has none, so the monogram branch has to survive alongside it.
    expect(withAvatar).toContain('class="group-avatar-initials"');
  });

  // The strongest form of the rule, and deliberately not narrowed to the
  // avatar: AO3 strips `style` outright, so anything styled that way reaches
  // the preview and the PNG and is silently dropped on the published work. An
  // assertion aimed at one class would have missed the sender row that used to
  // carry its own inline flex.
  test('WhatsApp group markup carries no inline style attribute anywhere', () => {
    for (const mode of ['static', 'ao3-work'] as const) {
      const html = buildHTML(richWhatsApp(), mode);
      expect(html, `${mode} output must not inline styles`).not.toContain('style=');
    }
  });
});
