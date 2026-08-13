import { expect, test } from '@playwright/test';
import { defaultProject } from '../src/lib/schema';
import {
  createProjectFile,
  createSiteThemeFile,
  parseProjectFile,
  parseSiteThemeFile,
  ProjectFileError,
  serializeProjectFile,
  summarizeProjectFile,
} from '../src/lib/projectFile';
import { cloneTheme, TEMPLATES } from '../src/lib/siteSkin/templates';

test.describe('versioned project files', () => {
  test('round-trips a scene cast and character library through schema v4', () => {
    const project = defaultProject();
    project.id = 'scene-1';
    project.messages[0].statusMode = 'auto';
    project.messages[0].attachments = [{
      type: 'image',
      url: 'https://i.ibb.co/example/image.png',
      alt: 'Cafe sign',
      decorative: false,
    }];
    const text = serializeProjectFile(project, [{
      id: 'alex',
      name: 'Alex',
      avatarUrl: 'https://example.com/alex.png',
      usageCount: 4,
      lastUsed: '2026-08-01T12:00:00.000Z',
    }], new Date('2026-08-12T00:00:00.000Z'));

    const parsed = parseProjectFile(text);
    expect(parsed.schemaVersion).toBe(4);
    expect(parsed.project.cast?.selfId).toBeTruthy();
    expect(parsed.project.messages[0].attachments?.[0]).toEqual({
      type: 'image',
      url: 'https://i.ibb.co/example/image.png',
      alt: 'Cafe sign',
      decorative: false,
    });
    expect(parsed.project.messages[0].statusMode).toBe('auto');
    expect(parsed.characterLibrary).toHaveLength(1);
    expect(summarizeProjectFile(parsed)).toEqual({
      template: 'ios',
      itemCount: 2,
      itemLabel: 'messages',
      characterCount: 1,
      exportedAt: '2026-08-12T00:00:00.000Z',
      hasRemoteImages: true,
    });
  });

  test('rejects future schemas, unknown top-level fields, invalid URLs, and oversized input', () => {
    const valid = createProjectFile(defaultProject(), []);
    expect(() => parseProjectFile(JSON.stringify({ ...valid, schemaVersion: 5 }))).toThrow(ProjectFileError);
    expect(() => parseProjectFile(JSON.stringify({ ...valid, surprise: true }))).toThrow(/Unknown top-level field/);

    const badUrl = structuredClone(valid);
    badUrl.project.messages[0].attachments = [{ type: 'image', url: 'javascript:alert(1)' }];
    expect(() => parseProjectFile(JSON.stringify(badUrl))).toThrow(/unsupported image address/);
    expect(() => parseProjectFile(' '.repeat(2 * 1024 * 1024 + 1))).toThrow(/2 MB/);
  });

  test('imports a v1 scene and migrates it to stable identities', () => {
    const project = defaultProject();
    project.id = 'legacy-scene';
    project.template = 'twitter';
    project.settings.twitterDisplayName = 'Legacy User';
    project.settings.twitterHandle = '@legacy';
    project.settings.twitterAvatarUrl = '/assets/alex-avatar.png';
    project.messages = [{ id: 'legacy-tweet', sender: 'Legacy User', content: 'Old post', outgoing: true }];
    const v1 = {
      format: 'ao3skingen-project',
      schemaVersion: 1,
      exportedAt: '2026-08-12T00:00:00.000Z',
      application: { name: 'AO3 SkinGen', version: '0.1.0' },
      project,
      characterLibrary: [],
    };

    const parsed = parseProjectFile(JSON.stringify(v1));
    expect(parsed.schemaVersion).toBe(4);
    expect(parsed.project.cast?.twitterPrimaryId).toBe('twitter-primary');
    expect(parsed.project.cast?.characters[0]).toMatchObject({
      name: 'Legacy User',
      twitterHandle: 'legacy',
      avatarUrl: '/assets/alex-avatar.png',
    });
  });

  test('preserves legacy dark mode when importing a v3 Twitter backup', () => {
    const project = defaultProject();
    project.template = 'twitter';
    project.settings.twitterDarkMode = true;
    delete project.settings.twitterTheme;
    const v3 = {
      format: 'ao3skingen-project',
      schemaVersion: 3,
      exportedAt: '2026-08-12T00:00:00.000Z',
      application: { name: 'AO3 SkinGen', version: '0.1.0' },
      project,
      characterLibrary: [],
    };

    const parsed = parseProjectFile(JSON.stringify(v3));
    expect(parsed.project.settings.twitterTheme).toBe('dark');
  });

  test('ignores future fields only inside known objects', () => {
    const valid = createProjectFile(defaultProject(), []);
    const raw = structuredClone(valid) as any;
    raw.project.settings.futureSetting = 'ignored';
    raw.project.messages[0].futureMessageField = 'ignored';
    const parsed = parseProjectFile(JSON.stringify(raw));
    expect((parsed.project.settings as any).futureSetting).toBeUndefined();
    expect((parsed.project.messages[0] as any).futureMessageField).toBeUndefined();
  });

  test('rejects malformed Twitter relationship graphs', () => {
    const valid = createProjectFile(defaultProject(), []);
    const malformed = structuredClone(valid);
    malformed.project.template = 'twitter';
    malformed.project.messages = [
      { id: 'a', sender: '', content: 'A', outgoing: true, parentId: 'b' },
      { id: 'b', sender: '', content: 'B', outgoing: true, parentId: 'a' },
    ];
    expect(() => parseProjectFile(JSON.stringify(malformed))).toThrow(/Twitter relationship cycle/);

    malformed.project.messages = [
      { id: 'orphan', sender: '', content: 'Orphan', outgoing: true, parentId: 'missing' },
    ];
    expect(() => parseProjectFile(JSON.stringify(malformed))).toThrow(/missing-parent/);

    malformed.project.messages = [
      { id: 'unknown-account', sender: '', content: 'Unknown', outgoing: true, characterId: 'not-in-cast' },
    ];
    expect(() => parseProjectFile(JSON.stringify(malformed))).toThrow(/not in the scene cast/);
  });

  test('round-trips rich Twitter fields and rejects unsafe or contradictory media', () => {
    const project = defaultProject();
    project.template = 'twitter';
    project.messages = [{
      id: 'rich', sender: 'User', content: 'Rich post', outgoing: true,
      twitterMediaCrop: 'fill-width',
      twitterQuote: { name: 'External', handle: 'external', text: 'Quote', attachments: [{ type: 'image', url: 'https://example.com/quote.png', alt: 'Quote image' }] },
      twitterVideo: { source: 'youtube', url: 'https://youtu.be/bN8449nalT8', title: 'Clip', posterUrl: 'https://example.com/poster.png' },
      twitterPoll: { state: 'closed', options: [{ id: 'yes', text: 'Yes', percent: 60 }, { id: 'no', text: 'No', percent: 40 }] },
      twitterTranslation: { languageLabel: 'French', originalText: 'Bonjour', translatedText: 'Hello', visibleText: 'translated' },
      twitterAccountLabel: 'Parody account',
    }];
    project.settings.twitterTheme = 'dim';
    const parsed = parseProjectFile(serializeProjectFile(project, []));
    expect(parsed.project.settings.twitterTheme).toBe('dim');
    expect(parsed.project.messages[0]).toMatchObject({
      twitterMediaCrop: 'fill-width',
      twitterAccountLabel: 'Parody account',
      twitterVideo: { source: 'youtube', title: 'Clip' },
      twitterPoll: { state: 'closed' },
    });

    const raw = createProjectFile(project, []) as any;
    raw.project.messages[0].attachments = [{ type: 'image', url: 'https://example.com/a.png' }];
    expect(() => parseProjectFile(JSON.stringify(raw))).toThrow(/both a video and an image grid/);
    raw.project.messages[0].attachments = [];
    raw.project.messages[0].twitterVideo.url = '<iframe src="https://youtube.com/embed/bN8449nalT8">';
    expect(() => parseProjectFile(JSON.stringify(raw))).toThrow(/embed markup|HTTPS address/);
  });

  test('round-trips a playable video without an optional title', () => {
    const project = defaultProject();
    project.template = 'twitter';
    project.messages[0].twitterVideo = {
      source: 'youtube',
      url: 'https://youtu.be/bN8449nalT8',
      title: '',
    };

    const parsed = parseProjectFile(serializeProjectFile(project, []));
    expect(parsed.project.messages[0].twitterVideo).toEqual({
      source: 'youtube',
      url: 'https://youtu.be/bN8449nalT8',
      title: '',
    });
  });

  test('round-trips a strict site-theme file separately from scene files', () => {
    const theme = cloneTheme(TEMPLATES[0]);
    const file = createSiteThemeFile(theme, new Date('2026-08-12T00:00:00.000Z'));
    const parsed = parseSiteThemeFile(JSON.stringify(file));
    expect(parsed.theme).toEqual(theme);
    expect(parsed.exportedAt).toBe('2026-08-12T00:00:00.000Z');
    expect(() => parseProjectFile(JSON.stringify(file))).toThrow(/Unknown top-level field|ao3skingen-project/);
  });
});
