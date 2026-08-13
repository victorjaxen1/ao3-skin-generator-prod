import { expect, test } from '@playwright/test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { TEMPLATE_EXAMPLES, instantiateTemplate } from '../src/lib/examples';
import {
  archiveOrReassignCharacter,
  copyLibraryCharacterToScene,
  migrateProjectIdentities,
  normalizeTwitterHandle,
  resolveMessageIdentity,
  syncChatGroupParticipants,
  updateSceneCharacter,
} from '../src/lib/identity';
import { validateCharacterLibrary } from '../src/lib/characterStorage';
import { defaultProject, SkinProject } from '../src/lib/schema';
import { buildHTML } from '../src/lib/generator';
import { buildSceneTranscript } from '../src/lib/transcript';

function twitterProject(): SkinProject {
  const project = defaultProject();
  project.template = 'twitter';
  project.settings.twitterDisplayName = 'Alex Rivers';
  project.settings.twitterHandle = '@alexrivers';
  project.settings.twitterAvatarUrl = '/assets/alex-avatar.png';
  project.settings.twitterVerified = true;
  project.messages = [{ id: 'tweet-1', sender: 'Alex Rivers', content: 'Hello', outgoing: true }];
  return project;
}

test.describe('scene identities', () => {
  test('normalizes Twitter handles', () => {
    expect(normalizeTwitterHandle('@@alex')).toBe('alex');
    expect(normalizeTwitterHandle('  alex  ')).toBe('alex');
    expect(normalizeTwitterHandle(undefined)).toBe('');
  });

  test('updates a complete main-account profile atomically and existing posts follow it', () => {
    const migrated = migrateProjectIdentities(twitterProject());
    const primaryId = migrated.cast?.twitterPrimaryId;
    expect(primaryId).toBeTruthy();
    const updated = updateSceneCharacter(migrated, primaryId!, {
      name: 'A. Rivers',
      twitterHandle: '@arivers',
      avatarUrl: '/assets/jordan-avatar.png',
      verified: false,
    });

    expect(resolveMessageIdentity(updated, updated.messages[0])).toMatchObject({
      id: primaryId,
      name: 'A. Rivers',
      twitterHandle: 'arivers',
      avatarUrl: '/assets/jordan-avatar.png',
      verified: false,
    });
    expect(updated.settings).toMatchObject({
      twitterDisplayName: 'A. Rivers',
      twitterHandle: 'arivers',
      twitterAvatarUrl: '/assets/jordan-avatar.png',
      twitterVerified: false,
    });
    const html = buildHTML(updated);
    const transcript = buildSceneTranscript(updated);
    expect(html).toContain('A. Rivers');
    expect(html).toContain('@arivers');
    expect(html).toContain('/assets/jordan-avatar.png');
    expect(transcript).toContain('A. Rivers (@arivers)');
  });

  test('uses IDs rather than names and a library copy does not mutate its source', () => {
    const source = { id: 'library-alex', name: 'Alex', twitterHandle: '@first', usageCount: 0 };
    let project = migrateProjectIdentities(twitterProject());
    project = copyLibraryCharacterToScene(project, source);
    project = copyLibraryCharacterToScene(project, { ...source, id: 'library-alex-2', twitterHandle: '@second' });
    const copies = project.cast!.characters.filter(character => character.name === 'Alex');

    expect(copies.map(character => character.id)).toEqual(expect.arrayContaining([copies[0].id, copies[1].id]));
    expect(new Set(copies.map(character => character.id)).size).toBe(copies.length);
    expect(source.twitterHandle).toBe('@first');
    const changed = updateSceneCharacter(project, copies[0].id, { name: 'Changed' });
    expect(source.name).toBe('Alex');
    expect(changed.cast!.characters.find(character => character.id === copies[1].id)?.name).toBe('Alex');
  });

  test('migrates legacy profiles idempotently and preserves complete custom identities', () => {
    const project = twitterProject();
    project.settings.twitterCharacterPresets = [{
      id: 'other-account',
      name: 'Alex Rivers',
      handle: 'otheralex',
      avatarUrl: '/assets/jordan-avatar.png',
      verified: false,
    }];
    project.messages.push({
      id: 'tweet-2',
      sender: 'Alex Rivers',
      twitterHandle: '@otheralex',
      avatarUrl: '/assets/jordan-avatar.png',
      verified: false,
      useCustomIdentity: true,
      content: 'Other account',
      outgoing: true,
    });
    const once = migrateProjectIdentities(project);
    const twice = migrateProjectIdentities(once);

    expect(twice).toEqual(once);
    expect(once.messages[1].characterId).toBe('other-account');
    expect(resolveMessageIdentity(once, once.messages[1])).toMatchObject({
      name: 'Alex Rivers',
      twitterHandle: 'otheralex',
      avatarUrl: '/assets/jordan-avatar.png',
      verified: false,
    });
  });

  test('leaves deliberately different legacy chat senders on their stamped fallback', () => {
    const project = defaultProject();
    project.settings.iosContactName = 'Sam';
    project.messages = [
      { id: 'sam', sender: 'Sam', content: 'Hi', outgoing: false },
      { id: 'guest', sender: 'Guest', content: 'Hello too', outgoing: false },
    ];
    const migrated = migrateProjectIdentities(project);

    expect(migrated.messages[0].characterId).toBe(migrated.cast?.contactId);
    expect(migrated.messages[1].characterId).toBeUndefined();
    expect(resolveMessageIdentity(migrated, migrated.messages[1]).name).toBe('Guest');
  });

  test('archives referenced identities so old messages continue to resolve', () => {
    let project = migrateProjectIdentities(twitterProject());
    project = copyLibraryCharacterToScene(project, { id: 'library-b', name: 'B', twitterHandle: 'b', usageCount: 0 });
    const character = project.cast!.characters.find(entry => entry.sourceLibraryId === 'library-b')!;
    project.messages.push({ id: 'tweet-b', sender: 'B', content: 'B post', outgoing: true, characterId: character.id });
    const archived = archiveOrReassignCharacter(project, character.id);

    expect(archived.cast!.characters.find(entry => entry.id === character.id)?.archived).toBe(true);
    expect(resolveMessageIdentity(archived, archived.messages[1]).name).toBe('B');
  });

  test('turning a two-person chat into a group enrolls every added person and drops removed people', () => {
    let project = migrateProjectIdentities(defaultProject());
    const contactId = project.cast!.contactId!;
    project = updateSceneCharacter(project, contactId, { name: 'Casey' });
    project = copyLibraryCharacterToScene(project, { id: 'library-samuel', name: 'Samuel', usageCount: 0 });
    project = syncChatGroupParticipants(project);

    expect(project.settings.iosGroupParticipants?.map(participant => participant.name)).toEqual(['Casey', 'Samuel']);
    expect(new Set(project.settings.iosGroupParticipants?.map(participant => participant.characterId))).toEqual(
      new Set([contactId, project.cast!.characters.find(character => character.name === 'Samuel')!.id])
    );

    const samuelId = project.cast!.characters.find(character => character.name === 'Samuel')!.id;
    project = archiveOrReassignCharacter({
      ...project,
      settings: {
        ...project.settings,
        iosGroupParticipants: project.settings.iosGroupParticipants?.filter(participant => participant.characterId !== samuelId),
      },
    }, samuelId);
    project = syncChatGroupParticipants(project);

    expect(project.settings.iosGroupParticipants?.map(participant => participant.name)).toEqual(['Casey']);
  });

  test('an old chat message follows later character name and avatar edits in group output', () => {
    let project = migrateProjectIdentities(defaultProject());
    const contactId = project.cast!.contactId!;
    project = updateSceneCharacter(project, contactId, { name: 'Casey' });
    project = {
      ...project,
      settings: { ...project.settings, iosGroupMode: true },
      messages: [{
        id: 'before-group-mode',
        sender: 'Casey',
        content: 'This message already existed',
        outgoing: false,
        characterId: contactId,
        // Deliberately absent: one-to-one messages predate participant binding.
        participantId: undefined,
      }],
    };
    project = syncChatGroupParticipants(project);
    project = updateSceneCharacter(project, contactId, {
      name: 'Casey Jones',
      avatarUrl: '/assets/casey-avatar.png',
    });

    const html = buildHTML(project);
    expect(resolveMessageIdentity(project, project.messages[0])).toMatchObject({
      name: 'Casey Jones',
      avatarUrl: '/assets/casey-avatar.png',
    });
    expect(html).toContain('class="group-avatar"');
    expect(html).toContain('src="/assets/casey-avatar.png"');
    expect(html).toContain('>Casey Jones</div>');
  });

  test('instantiates isolated Twitter templates whose posts reference live scene accounts', () => {
    for (const template of TEMPLATE_EXAMPLES.twitter) {
      const first = instantiateTemplate(template);
      const second = instantiateTemplate(template);
      expect(first).not.toBe(template);
      expect(first.id).not.toBe(second.id);
      expect(first.cast?.twitterPrimaryId).toBeTruthy();
      const castIds = new Set(first.cast?.characters.map(character => character.id));
      expect(first.messages.every(message => !!message.characterId && castIds.has(message.characterId))).toBe(true);
      expect(first.messages.some(message => message.characterId === first.cast?.twitterPrimaryId)).toBe(true);
      expect(first.messages.every(message => !message.useCustomIdentity)).toBe(true);
    }
  });

  test('all local quick-template avatar paths exist', () => {
    for (const template of Object.values(TEMPLATE_EXAMPLES).flat()) {
      const project = instantiateTemplate(template);
      const urls = [
        project.settings.iosAvatarUrl,
        project.settings.androidAvatarUrl,
        project.settings.twitterAvatarUrl,
        ...project.messages.map(message => message.avatarUrl),
        ...(project.settings.iosGroupParticipants || []).map(participant => participant.avatarUrl),
        ...(project.settings.androidGroupParticipants || []).map(participant => participant.avatarUrl),
        ...(project.cast?.characters || []).map(character => character.avatarUrl),
      ].filter((value): value is string => !!value && value.startsWith('/assets/'));
      for (const url of urls) expect(existsSync(join(process.cwd(), 'public', url))).toBe(true);
    }
  });

  test('two projects sharing a library source stay independent after an edit', () => {
    const source = { id: 'library-shared', name: 'Shared', twitterHandle: 'shared', usageCount: 0 };
    const projectA = copyLibraryCharacterToScene(migrateProjectIdentities(twitterProject()), source);
    const projectB = copyLibraryCharacterToScene(migrateProjectIdentities(twitterProject()), source);
    const copyA = projectA.cast!.characters.find(character => character.sourceLibraryId === source.id)!;
    const copyB = projectB.cast!.characters.find(character => character.sourceLibraryId === source.id)!;

    const editedA = updateSceneCharacter(projectA, copyA.id, { name: 'Renamed in A', twitterHandle: 'renamed_a' });

    expect(editedA.cast!.characters.find(character => character.id === copyA.id)?.name).toBe('Renamed in A');
    expect(projectB.cast!.characters.find(character => character.id === copyB.id)).toMatchObject({
      name: 'Shared',
      twitterHandle: 'shared',
    });
    expect(source.name).toBe('Shared');
  });

  test('a hostile or oversized avatar on a scene identity is rejected by the shared URL validation', () => {
    // Scene identities take the same avatar values the library does, so they
    // must not become a way around that validation.
    const project = migrateProjectIdentities(twitterProject());
    const primaryId = project.cast!.twitterPrimaryId!;

    const throughLibrary = (avatarUrl: string | undefined) => validateCharacterLibrary([
      { id: 'from-scene', name: 'Scene copy', avatarUrl, usageCount: 0 },
    ])[0].avatarUrl;
    const sceneAvatar = (avatarUrl: string) =>
      updateSceneCharacter(project, primaryId, { avatarUrl });

    // A non-http(s) scheme is dropped outright and never reaches the output.
    const hostile = sceneAvatar('javascript:alert(1)');
    expect(throughLibrary(hostile.cast!.characters.find(c => c.id === primaryId)!.avatarUrl)).toBeUndefined();
    expect(buildHTML(hostile)).not.toContain('javascript:alert(1)');

    // An oversized address is capped rather than stored at full length.
    const oversized = sceneAvatar(`https://example.com/${'a'.repeat(5000)}.png`);
    const capped = throughLibrary(oversized.cast!.characters.find(c => c.id === primaryId)!.avatarUrl);
    expect(capped!.length).toBeLessThan(5000);
  });

  test('Google migration carries no scene identity model', () => {
    const project = defaultProject();
    project.template = 'google';
    project.cast = { characters: [{ id: 'should-go', name: 'Not a search identity' }] };
    expect(migrateProjectIdentities(project).cast).toBeUndefined();
  });
});
