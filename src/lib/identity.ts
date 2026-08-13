import {
  GroupParticipant,
  Message,
  SceneCast,
  SceneCharacter,
  SkinProject,
  UniversalCharacter,
} from './schema';

export type SceneCharacterRole = 'self' | 'contact' | 'participant' | 'account';

const GROUP_PARTICIPANT_COLORS = ['#FF5733', '#33A1FF', '#33FF57', '#FF33A1', '#FFC733', '#8B33FF'];

export interface SceneCharacterDraft {
  name: string;
  avatarUrl?: string;
  twitterHandle?: string;
  verified?: boolean;
  sourceLibraryId?: string;
}

export interface ResolvedIdentity {
  id?: string;
  name: string;
  avatarUrl?: string;
  twitterHandle?: string;
  verified: boolean;
  archived?: boolean;
}

export type IdentityTarget =
  | { kind: 'character'; id: string }
  | { kind: 'self' }
  | { kind: 'contact' }
  | { kind: 'twitter-primary' }
  | { kind: 'participant'; id: string };

function localIdentityId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch { /* use a local fallback */ }
  return `character-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeTwitterHandle(value: string | undefined | null): string {
  return (value || '').trim().replace(/^@+/, '');
}

function cleanDraft(draft: SceneCharacterDraft, id: string): SceneCharacter {
  const name = draft.name.trim() || 'User';
  const avatarUrl = draft.avatarUrl?.trim();
  const twitterHandle = normalizeTwitterHandle(draft.twitterHandle);
  return {
    id,
    name,
    ...(avatarUrl ? { avatarUrl } : {}),
    ...(twitterHandle ? { twitterHandle } : {}),
    ...(typeof draft.verified === 'boolean' ? { verified: draft.verified } : {}),
    ...(draft.sourceLibraryId ? { sourceLibraryId: draft.sourceLibraryId } : {}),
  };
}

function availableId(preferred: string, used: Set<string>): string {
  const safe = preferred.trim().replace(/[^a-z0-9._:-]+/gi, '-').replace(/^-+|-+$/g, '') || 'character';
  if (!used.has(safe)) {
    used.add(safe);
    return safe;
  }
  let suffix = 2;
  while (used.has(`${safe}-${suffix}`)) suffix += 1;
  const result = `${safe}-${suffix}`;
  used.add(result);
  return result;
}

function identityKey(identity: Pick<SceneCharacter, 'name' | 'avatarUrl' | 'twitterHandle' | 'verified'>): string {
  return JSON.stringify([
    identity.name.trim().toLocaleLowerCase(),
    identity.avatarUrl?.trim() || '',
    normalizeTwitterHandle(identity.twitterHandle).toLocaleLowerCase(),
    !!identity.verified,
  ]);
}

function fromCharacter(character: SceneCharacter | undefined, fallbackName: string): ResolvedIdentity {
  if (!character) return { name: fallbackName, verified: false };
  return {
    id: character.id,
    name: character.name.trim() || fallbackName,
    ...(character.avatarUrl ? { avatarUrl: character.avatarUrl } : {}),
    ...(character.twitterHandle ? { twitterHandle: normalizeTwitterHandle(character.twitterHandle) } : {}),
    verified: !!character.verified,
    ...(character.archived ? { archived: true } : {}),
  };
}

function findCharacter(project: SkinProject, id: string | undefined): SceneCharacter | undefined {
  return id ? project.cast?.characters.find(character => character.id === id) : undefined;
}

export function resolveIdentityTarget(project: SkinProject, target: IdentityTarget): ResolvedIdentity {
  if (target.kind === 'character') return fromCharacter(findCharacter(project, target.id), 'User');
  if (target.kind === 'self') {
    return fromCharacter(findCharacter(project, project.cast?.selfId), project.settings.chatYourName?.trim() || 'You');
  }
  if (target.kind === 'contact') {
    const name = project.template === 'ios'
      ? project.settings.iosContactName || project.settings.chatContactName
      : project.settings.androidContactName || project.settings.chatContactName;
    return fromCharacter(findCharacter(project, project.cast?.contactId), name?.trim() || 'Them');
  }
  if (target.kind === 'twitter-primary') {
    const fallback: ResolvedIdentity = {
      name: project.settings.twitterDisplayName?.trim() || 'User',
      ...(project.settings.twitterAvatarUrl?.trim() ? { avatarUrl: project.settings.twitterAvatarUrl.trim() } : {}),
      ...(normalizeTwitterHandle(project.settings.twitterHandle)
        ? { twitterHandle: normalizeTwitterHandle(project.settings.twitterHandle) }
        : {}),
      verified: !!project.settings.twitterVerified,
    };
    const character = findCharacter(project, project.cast?.twitterPrimaryId);
    return character ? fromCharacter(character, fallback.name) : fallback;
  }
  const participants = project.template === 'android'
    ? project.settings.androidGroupParticipants
    : project.settings.iosGroupParticipants;
  const participant = participants?.find(entry => entry.id === target.id || entry.characterId === target.id);
  const character = findCharacter(project, participant?.characterId || target.id);
  if (character) return fromCharacter(character, participant?.name || 'Them');
  return {
    name: participant?.name.trim() || 'Them',
    ...(participant?.avatarUrl ? { avatarUrl: participant.avatarUrl } : {}),
    verified: false,
  };
}

export function resolveMessageIdentity(project: SkinProject, message: Message): ResolvedIdentity {
  const explicit = findCharacter(project, message.characterId);
  if (explicit) return fromCharacter(explicit, message.sender.trim() || 'User');

  if (project.template === 'twitter') {
    if (!message.useCustomIdentity) {
      const primary = resolveIdentityTarget(project, { kind: 'twitter-primary' });
      if (primary.id || project.settings.twitterDisplayName?.trim() || project.settings.twitterHandle?.trim()) return primary;
    }
    const name = message.sender.trim()
      || project.settings.twitterDisplayName?.trim()
      || project.messages[0]?.sender.trim()
      || 'User';
    const handle = message.useCustomIdentity
      ? normalizeTwitterHandle(message.twitterHandle)
      : normalizeTwitterHandle(project.settings.twitterHandle);
    const avatarUrl = message.useCustomIdentity
      ? message.avatarUrl?.trim()
      : project.settings.twitterAvatarUrl?.trim() || message.avatarUrl?.trim();
    return {
      name,
      ...(avatarUrl ? { avatarUrl } : {}),
      ...(handle ? { twitterHandle: handle } : {}),
      verified: message.useCustomIdentity ? !!message.verified : !!project.settings.twitterVerified,
    };
  }

  if (message.outgoing) return resolveIdentityTarget(project, { kind: 'self' });
  if (message.participantId) return resolveIdentityTarget(project, { kind: 'participant', id: message.participantId });
  const contact = resolveIdentityTarget(project, { kind: 'contact' });
  const stampedName = message.sender.trim();
  if (contact.id && (!stampedName || stampedName.toLocaleLowerCase() === contact.name.toLocaleLowerCase())) return contact;
  return {
    name: stampedName || contact.name,
    ...(message.avatarUrl?.trim() ? { avatarUrl: message.avatarUrl.trim() } : contact.avatarUrl ? { avatarUrl: contact.avatarUrl } : {}),
    verified: false,
  };
}

function syncBoundLegacyFields(project: SkinProject, character: SceneCharacter): SkinProject {
  const settings = { ...project.settings };
  if (project.cast?.selfId === character.id) settings.chatYourName = character.name;
  if (project.cast?.contactId === character.id) {
    settings.chatContactName = character.name;
    if (project.template === 'ios') {
      settings.iosContactName = character.name;
      settings.iosAvatarUrl = character.avatarUrl || '';
    }
    if (project.template === 'android') {
      settings.androidContactName = character.name;
      settings.androidAvatarUrl = character.avatarUrl || '';
    }
  }
  if (project.cast?.twitterPrimaryId === character.id) {
    settings.twitterDisplayName = character.name;
    settings.twitterHandle = normalizeTwitterHandle(character.twitterHandle);
    settings.twitterAvatarUrl = character.avatarUrl || '';
    settings.twitterVerified = !!character.verified;
  }
  const syncParticipants = (participants: GroupParticipant[] | undefined) => participants?.map(participant =>
    participant.characterId === character.id
      ? { ...participant, name: character.name, avatarUrl: character.avatarUrl }
      : participant
  );
  settings.iosGroupParticipants = syncParticipants(settings.iosGroupParticipants);
  settings.androidGroupParticipants = syncParticipants(settings.androidGroupParticipants);
  return { ...project, settings };
}

export function addSceneCharacter(
  project: SkinProject,
  draft: SceneCharacterDraft,
  role: SceneCharacterRole = 'participant',
): SkinProject {
  const cast: SceneCast = project.cast
    ? { ...project.cast, characters: [...project.cast.characters] }
    : { characters: [] };
  const used = new Set(cast.characters.map(character => character.id));
  const character = cleanDraft(draft, availableId(localIdentityId(), used));
  cast.characters.push(character);
  if (role === 'self') cast.selfId = character.id;
  if (role === 'contact') cast.contactId = character.id;
  if (role === 'account' && !cast.twitterPrimaryId) cast.twitterPrimaryId = character.id;
  return syncBoundLegacyFields({ ...project, cast }, character);
}

/**
 * Reconcile the active chat platform's group roster with its project cast.
 *
 * People can be added while a conversation is still one-to-one. Turning group
 * mode on must not leave those scene identities stranded outside the legacy
 * participant array used by the composer and renderer. Existing bindings keep
 * their ids and colours so old messages remain stable; archived/deleted people
 * leave the new-message roster.
 */
export function syncChatGroupParticipants(project: SkinProject): SkinProject {
  if (project.template !== 'ios' && project.template !== 'android') return project;

  const field = project.template === 'ios' ? 'iosGroupParticipants' : 'androidGroupParticipants';
  const existing = project.settings[field] || [];
  const eligibleCharacters = (project.cast?.characters || []).filter(character =>
    character.id !== project.cast?.selfId && !character.archived
  );
  const usedParticipantIds = new Set(existing.map(participant => participant.id));
  let added = 0;

  const participants = eligibleCharacters.map(character => {
    const current = existing.find(participant => participant.characterId === character.id);
    if (current) {
      return {
        ...current,
        name: character.name,
        avatarUrl: character.avatarUrl,
      };
    }

    const baseId = `p-${character.id}`;
    let id = baseId;
    let suffix = 2;
    while (usedParticipantIds.has(id)) id = `${baseId}-${suffix++}`;
    usedParticipantIds.add(id);
    const participant: GroupParticipant = {
      id,
      characterId: character.id,
      name: character.name,
      avatarUrl: character.avatarUrl,
      color: GROUP_PARTICIPANT_COLORS[(existing.length + added) % GROUP_PARTICIPANT_COLORS.length],
    };
    added += 1;
    return participant;
  });

  return {
    ...project,
    settings: {
      ...project.settings,
      [field]: participants,
    },
  };
}

export function copyLibraryCharacterToScene(
  project: SkinProject,
  source: UniversalCharacter,
  role: SceneCharacterRole = 'participant',
): SkinProject {
  return addSceneCharacter(project, {
    name: source.name,
    avatarUrl: source.avatarUrl,
    twitterHandle: source.twitterHandle,
    verified: source.verified,
    sourceLibraryId: source.id,
  }, role);
}

export function updateSceneCharacter(project: SkinProject, id: string, updates: Partial<SceneCharacterDraft>): SkinProject {
  const existing = findCharacter(project, id);
  if (!existing || !project.cast) return project;
  const next = cleanDraft({
    ...existing,
    ...updates,
    name: updates.name !== undefined && !updates.name.trim() ? existing.name : updates.name ?? existing.name,
  }, existing.id);
  const character: SceneCharacter = {
    ...next,
    ...(existing.archived ? { archived: true } : {}),
    ...(next.sourceLibraryId || existing.sourceLibraryId ? { sourceLibraryId: next.sourceLibraryId || existing.sourceLibraryId } : {}),
  };
  const cast = {
    ...project.cast,
    characters: project.cast.characters.map(entry => entry.id === id ? character : entry),
  };
  return syncBoundLegacyFields({ ...project, cast }, character);
}

export function archiveOrReassignCharacter(project: SkinProject, id: string, replacementId?: string): SkinProject {
  if (!project.cast || !findCharacter(project, id)) return project;
  const referenced = project.messages.some(message => message.characterId === id)
    || (project.settings.iosGroupParticipants || []).some(participant => participant.characterId === id)
    || (project.settings.androidGroupParticipants || []).some(participant => participant.characterId === id);
  if (!referenced) {
    return {
      ...project,
      cast: {
        ...project.cast,
        characters: project.cast.characters.filter(character => character.id !== id),
        ...(project.cast.selfId === id ? { selfId: undefined } : {}),
        ...(project.cast.contactId === id ? { contactId: undefined } : {}),
        ...(project.cast.twitterPrimaryId === id ? { twitterPrimaryId: undefined } : {}),
      },
    };
  }
  if (!replacementId || !findCharacter(project, replacementId)) {
    return {
      ...project,
      cast: {
        ...project.cast,
        characters: project.cast.characters.map(character => character.id === id ? { ...character, archived: true } : character),
      },
    };
  }
  const replaceParticipants = (participants: GroupParticipant[] | undefined) => participants?.map(participant =>
    participant.characterId === id ? { ...participant, characterId: replacementId } : participant
  );
  return {
    ...project,
    settings: {
      ...project.settings,
      iosGroupParticipants: replaceParticipants(project.settings.iosGroupParticipants),
      androidGroupParticipants: replaceParticipants(project.settings.androidGroupParticipants),
    },
    messages: project.messages.map(message => message.characterId === id ? { ...message, characterId: replacementId } : message),
    cast: {
      ...project.cast,
      characters: project.cast.characters.filter(character => character.id !== id),
      selfId: project.cast.selfId === id ? replacementId : project.cast.selfId,
      contactId: project.cast.contactId === id ? replacementId : project.cast.contactId,
      twitterPrimaryId: project.cast.twitterPrimaryId === id ? replacementId : project.cast.twitterPrimaryId,
    },
  };
}

function legacyPrimaryDraft(project: SkinProject): SceneCharacterDraft {
  const first = project.messages[0];
  return {
    name: project.settings.twitterDisplayName?.trim() || first?.sender.trim() || 'User',
    avatarUrl: project.settings.twitterAvatarUrl?.trim() || first?.avatarUrl?.trim(),
    twitterHandle: normalizeTwitterHandle(project.settings.twitterHandle || first?.twitterHandle),
    verified: project.settings.twitterVerified ?? first?.verified ?? false,
  };
}

/** Shape-based, deterministic, and idempotent migration for autosaves and v1 backups. */
export function migrateProjectIdentities(project: SkinProject): SkinProject {
  if (project.template === 'google') {
    return {
      id: project.id,
      template: project.template,
      settings: { ...project.settings },
      messages: project.messages.map(message => ({ ...message })),
    };
  }

  const existing = project.cast?.characters || [];
  const characters: SceneCharacter[] = existing.map(({ twitterHandle, ...character }) => {
    const normalizedHandle = normalizeTwitterHandle(twitterHandle);
    return { ...character, ...(normalizedHandle ? { twitterHandle: normalizedHandle } : {}) };
  });
  const used = new Set(characters.map(character => character.id));
  const byId = (id: string | undefined) => characters.find(character => character.id === id);
  const ensure = (preferredId: string, draft: SceneCharacterDraft, boundId?: string): string => {
    if (boundId && byId(boundId)) return boundId;
    const exact = characters.find(character => identityKey(character) === identityKey(cleanDraft(draft, character.id)));
    if (exact) return exact.id;
    const id = availableId(preferredId, used);
    characters.push(cleanDraft(draft, id));
    return id;
  };

  let selfId = project.cast?.selfId;
  let contactId = project.cast?.contactId;
  let twitterPrimaryId = project.cast?.twitterPrimaryId;
  let iosGroupParticipants = project.settings.iosGroupParticipants?.map(participant => ({ ...participant }));
  let androidGroupParticipants = project.settings.androidGroupParticipants?.map(participant => ({ ...participant }));

  if (project.template === 'ios' || project.template === 'android') {
    selfId = ensure('scene-self', { name: project.settings.chatYourName?.trim() || 'You' }, selfId);
    const contactName = project.template === 'ios'
      ? project.settings.iosContactName || project.settings.chatContactName
      : project.settings.androidContactName || project.settings.chatContactName;
    const contactAvatar = project.template === 'ios' ? project.settings.iosAvatarUrl : project.settings.androidAvatarUrl;
    contactId = ensure('scene-contact', {
      name: contactName?.trim() || project.messages.find(message => !message.outgoing)?.sender.trim() || 'Them',
      avatarUrl: contactAvatar?.trim(),
    }, contactId);

    const migrateParticipants = (participants: GroupParticipant[] | undefined) => participants?.map(participant => {
      const characterId = ensure(`scene-${participant.id}`, {
        name: participant.name,
        avatarUrl: participant.avatarUrl,
      }, participant.characterId);
      return { ...participant, characterId };
    });
    iosGroupParticipants = migrateParticipants(iosGroupParticipants);
    androidGroupParticipants = migrateParticipants(androidGroupParticipants);
  }

  if (project.template === 'twitter') {
    twitterPrimaryId = ensure('twitter-primary', legacyPrimaryDraft(project), twitterPrimaryId);
    for (const preset of project.settings.twitterCharacterPresets || []) {
      ensure(preset.id, {
        name: preset.name,
        avatarUrl: preset.avatarUrl,
        twitterHandle: preset.handle,
        verified: preset.verified,
      });
    }
  }

  const participantMap = new Map<string, string>();
  for (const participant of [...(iosGroupParticipants || []), ...(androidGroupParticipants || [])]) {
    if (participant.characterId) participantMap.set(participant.id, participant.characterId);
  }
  const messages = project.messages.map(message => {
    if (message.characterId && byId(message.characterId)) return { ...message };
    if (project.template === 'twitter') {
      if (!message.useCustomIdentity) return { ...message };
      const legacy = cleanDraft({
        name: message.sender.trim() || 'User',
        avatarUrl: message.avatarUrl,
        twitterHandle: message.twitterHandle,
        verified: message.verified,
      }, 'legacy');
      const match = characters.find(character => identityKey(character) === identityKey(legacy));
      const characterId = match?.id || ensure(`twitter-message-${message.id}`, legacy);
      return { ...message, characterId };
    }
    if (message.outgoing && selfId) return { ...message, characterId: selfId };
    const participantCharacterId = message.participantId ? participantMap.get(message.participantId) : undefined;
    if (participantCharacterId) return { ...message, characterId: participantCharacterId };
    const isGroup = project.template === 'ios'
      ? !!project.settings.iosGroupMode
      : !!project.settings.androidGroupMode;
    const contact = byId(contactId);
    const sender = message.sender.trim().toLocaleLowerCase();
    const matchesContact = !sender || sender === contact?.name.trim().toLocaleLowerCase();
    return !isGroup && contactId && matchesContact
      ? { ...message, characterId: contactId }
      : { ...message };
  });

  return {
    ...project,
    settings: {
      ...project.settings,
      iosGroupParticipants,
      androidGroupParticipants,
    },
    messages,
    cast: {
      characters,
      ...(selfId ? { selfId } : {}),
      ...(contactId ? { contactId } : {}),
      ...(twitterPrimaryId ? { twitterPrimaryId } : {}),
    },
  };
}
