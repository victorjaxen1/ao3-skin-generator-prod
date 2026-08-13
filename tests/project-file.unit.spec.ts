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
  test('round-trips a scene cast and character library through schema v2', () => {
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
    expect(parsed.schemaVersion).toBe(2);
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
    expect(() => parseProjectFile(JSON.stringify({ ...valid, schemaVersion: 3 }))).toThrow(ProjectFileError);
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
    expect(parsed.schemaVersion).toBe(2);
    expect(parsed.project.cast?.twitterPrimaryId).toBe('twitter-primary');
    expect(parsed.project.cast?.characters[0]).toMatchObject({
      name: 'Legacy User',
      twitterHandle: 'legacy',
      avatarUrl: '/assets/alex-avatar.png',
    });
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

  test('round-trips a strict site-theme file separately from scene files', () => {
    const theme = cloneTheme(TEMPLATES[0]);
    const file = createSiteThemeFile(theme, new Date('2026-08-12T00:00:00.000Z'));
    const parsed = parseSiteThemeFile(JSON.stringify(file));
    expect(parsed.theme).toEqual(theme);
    expect(parsed.exportedAt).toBe('2026-08-12T00:00:00.000Z');
    expect(() => parseProjectFile(JSON.stringify(file))).toThrow(/Unknown top-level field|ao3skingen-project/);
  });
});
