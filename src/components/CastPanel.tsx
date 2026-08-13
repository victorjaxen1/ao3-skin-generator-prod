import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CHARACTER_BANK } from '../lib/characterBank';
import {
  IdentityTarget,
  SceneCharacterDraft,
  addSceneCharacter,
  archiveOrReassignCharacter,
  copyLibraryCharacterToScene,
  normalizeTwitterHandle,
  resolveIdentityTarget,
  syncChatGroupParticipants,
  updateSceneCharacter,
} from '../lib/identity';
import { SceneCharacter, SkinProject, UniversalCharacter } from '../lib/schema';
import BottomSheet from './BottomSheet';
import { ImageUrlInput } from './ImageUrlInput';
import { ToggleRow } from './SettingsRows';

export type IdentityPanelMode =
  | { kind: 'overview' }
  | { kind: 'create'; suggestedRole?: 'self' | 'contact' | 'participant' | 'account' }
  | { kind: 'edit'; target: IdentityTarget }
  | { kind: 'library' }
  | { kind: 'avatar-presets'; returnTo: 'create' | 'edit' };

interface Props {
  isOpen: boolean;
  onClose: () => void;
  project: SkinProject;
  mode: IdentityPanelMode;
  onModeChange: (mode: IdentityPanelMode) => void;
  onChangeProject: (updater: (project: SkinProject) => SkinProject) => void;
  characters: UniversalCharacter[];
  onAddLibraryCharacter: (character: UniversalCharacter) => void;
  onUpdateLibraryCharacter: (id: string, updates: Partial<UniversalCharacter>) => void;
  onDeleteLibraryCharacter: (id: string) => void;
}

interface FormState {
  name: string;
  avatarUrl: string;
  twitterHandle: string;
  verified: boolean;
  color: string;
  alsoSave: boolean;
}

const EMPTY_FORM: FormState = {
  name: '',
  avatarUrl: '',
  twitterHandle: '',
  verified: false,
  color: '#33A1FF',
  alsoSave: false,
};

const COLORS = ['#FF5733', '#33A1FF', '#33FF57', '#FF33A1', '#FFC733', '#8B33FF'];

function targetId(project: SkinProject, target: IdentityTarget): string | undefined {
  if (target.kind === 'character') return target.id;
  if (target.kind === 'self') return project.cast?.selfId;
  if (target.kind === 'contact') return project.cast?.contactId;
  if (target.kind === 'twitter-primary') return project.cast?.twitterPrimaryId;
  const participants = project.template === 'ios'
    ? project.settings.iosGroupParticipants
    : project.settings.androidGroupParticipants;
  return participants?.find(participant => participant.id === target.id || participant.characterId === target.id)?.characterId;
}

function participantField(project: SkinProject): 'iosGroupParticipants' | 'androidGroupParticipants' {
  return project.template === 'ios' ? 'iosGroupParticipants' : 'androidGroupParticipants';
}

function participantForCharacter(project: SkinProject, id: string) {
  return (project.settings[participantField(project)] || []).find(participant => participant.characterId === id);
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase() || '?';
}

const Avatar: React.FC<{ character: Pick<SceneCharacter, 'name' | 'avatarUrl'>; color?: string }> = ({ character, color = '#7c3aed' }) =>
  character.avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={character.avatarUrl} alt="" className="h-11 w-11 flex-shrink-0 rounded-full border border-stone-200 object-cover" />
  ) : (
    // Decorative: the row already carries the name, so the initials would only
    // stutter it into the accessible name.
    <span aria-hidden="true" className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold" style={{ color, backgroundColor: `${color}18` }}>
      {initials(character.name)}
    </span>
  );

export const CastPanel: React.FC<Props> = ({
  isOpen,
  onClose,
  project,
  mode,
  onModeChange,
  onChangeProject,
  characters,
  onAddLibraryCharacter,
  onUpdateLibraryCharacter,
  onDeleteLibraryCharacter,
}) => {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [dirty, setDirty] = useState(false);
  const [replacementId, setReplacementId] = useState('');
  const [libraryEditId, setLibraryEditId] = useState<string | null>(null);
  const [libraryForm, setLibraryForm] = useState<FormState>(EMPTY_FORM);
  const loadedFormKey = useRef('');
  const editTargetRef = useRef<IdentityTarget | null>(null);

  const isTwitter = project.template === 'twitter';
  const isGroup = project.template === 'ios'
    ? !!project.settings.iosGroupMode
    : project.template === 'android'
      ? !!project.settings.androidGroupMode
      : false;
  const panelTitle = isTwitter ? 'Accounts' : 'People';

  useEffect(() => {
    if (mode.kind === 'overview' || mode.kind === 'library') loadedFormKey.current = '';
    if (mode.kind === 'create') {
      const key = `create:${mode.suggestedRole || ''}`;
      if (loadedFormKey.current === key) return;
      loadedFormKey.current = key;
      setForm({ ...EMPTY_FORM, color: COLORS[(project.settings[participantField(project)] || []).length % COLORS.length] });
      setDirty(false);
      setReplacementId('');
    }
    if (mode.kind === 'edit') {
      editTargetRef.current = mode.target;
      const id = targetId(project, mode.target);
      const key = `edit:${id || mode.target.kind}`;
      if (loadedFormKey.current === key) return;
      loadedFormKey.current = key;
      const identity = resolveIdentityTarget(project, mode.target);
      const participant = id ? participantForCharacter(project, id) : undefined;
      setForm({
        ...EMPTY_FORM,
        name: identity.name,
        avatarUrl: identity.avatarUrl || '',
        twitterHandle: identity.twitterHandle || '',
        verified: identity.verified,
        color: participant?.color || '#33A1FF',
      });
      setDirty(false);
      setReplacementId('');
    }
  }, [mode, project]);

  const changeForm = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(previous => ({ ...previous, [key]: value }));
    setDirty(true);
  };

  const guardUnsaved = (): boolean => !dirty || window.confirm('Discard unsaved identity changes?');
  const go = (next: IdentityPanelMode) => {
    if (!guardUnsaved()) return;
    setDirty(false);
    onModeChange(next);
  };
  const requestClose = () => {
    if (!guardUnsaved()) return;
    setDirty(false);
    onClose();
  };

  const addParticipantBinding = (next: SkinProject, character: SceneCharacter, color: string): SkinProject => {
    const field = participantField(next);
    const existing = next.settings[field] || [];
    return {
      ...next,
      settings: {
        ...next.settings,
        [field]: [...existing, {
          id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          characterId: character.id,
          name: character.name,
          avatarUrl: character.avatarUrl,
          color,
        }],
      },
    };
  };

  const createInScene = (previous: SkinProject, draft: SceneCharacterDraft, role?: 'self' | 'contact' | 'participant' | 'account'): SkinProject => {
    if (previous.template === 'twitter') return addSceneCharacter(previous, draft, 'account');
    if (role === 'self') {
      const id = previous.cast?.selfId;
      return id ? updateSceneCharacter(previous, id, draft) : addSceneCharacter(previous, draft, 'self');
    }
    if (!isGroup && role === 'contact') {
      const configuredContactName = previous.template === 'ios'
        ? previous.settings.iosContactName || previous.settings.chatContactName
        : previous.settings.androidContactName || previous.settings.chatContactName;
      const id = previous.cast?.contactId;
      // The first person replaces the blank/default contact. Once that contact
      // has been explicitly named, later additions are distinct people waiting
      // to join the group rather than replacements for the current contact.
      if (!configuredContactName?.trim()) {
        return id ? updateSceneCharacter(previous, id, draft) : addSceneCharacter(previous, draft, 'contact');
      }
    }
    const withCharacter = addSceneCharacter(previous, draft, 'participant');
    const character = withCharacter.cast?.characters[withCharacter.cast.characters.length - 1];
    return character ? addParticipantBinding(withCharacter, character, form.color) : withCharacter;
  };

  const saveForm = () => {
    const name = form.name.trim();
    if (!name) return;
    const draft: SceneCharacterDraft = {
      name,
      avatarUrl: form.avatarUrl.trim() || undefined,
      twitterHandle: isTwitter ? normalizeTwitterHandle(form.twitterHandle) : undefined,
      verified: isTwitter ? form.verified : undefined,
    };
    if (mode.kind === 'edit') {
      const id = targetId(project, mode.target);
      if (!id) return;
      onChangeProject(previous => {
        const updated = updateSceneCharacter(previous, id, draft);
        const field = participantField(updated);
        return {
          ...updated,
          settings: {
            ...updated.settings,
            [field]: (updated.settings[field] || []).map(participant =>
              participant.characterId === id ? { ...participant, color: form.color } : participant
            ),
          },
        };
      });
    } else if (mode.kind === 'create') {
      onChangeProject(previous => createInScene(previous, draft, mode.suggestedRole));
      if (form.alsoSave) {
        onAddLibraryCharacter({
          id: crypto.randomUUID(),
          name,
          avatarUrl: draft.avatarUrl,
          twitterHandle: draft.twitterHandle,
          verified: draft.verified,
          usageCount: 0,
        });
      }
    }
    setDirty(false);
    loadedFormKey.current = '';
    onModeChange({ kind: 'overview' });
  };

  const applyLibraryCharacter = (source: UniversalCharacter) => {
    onChangeProject(previous => {
      if (previous.template === 'twitter') return copyLibraryCharacterToScene(previous, source, 'account');
      if (!isGroup) {
        const id = previous.cast?.contactId;
        const draft = {
          name: source.name,
          avatarUrl: source.avatarUrl,
          sourceLibraryId: source.id,
        };
        return id ? updateSceneCharacter(previous, id, draft) : addSceneCharacter(previous, draft, 'contact');
      }
      const withCharacter = copyLibraryCharacterToScene(previous, source, 'participant');
      const character = withCharacter.cast?.characters[withCharacter.cast.characters.length - 1];
      return character ? addParticipantBinding(withCharacter, character, COLORS[(withCharacter.settings[participantField(withCharacter)] || []).length % COLORS.length]) : withCharacter;
    });
    onUpdateLibraryCharacter(source.id, {
      usageCount: (source.usageCount || 0) + 1,
      lastUsed: new Date().toISOString(),
    });
    onModeChange({ kind: 'overview' });
  };

  const editTargetId = mode.kind === 'edit' ? targetId(project, mode.target) : undefined;
  const messageReferenceCount = editTargetId
    ? project.messages.filter(message => message.characterId === editTargetId).length
    : 0;
  const isBoundIdentity = !!editTargetId && [project.cast?.selfId, project.cast?.contactId, project.cast?.twitterPrimaryId].includes(editTargetId);
  const replacementOptions = (project.cast?.characters || []).filter(character =>
    character.id !== editTargetId
    && !character.archived
    && (!participantForCharacter(project, editTargetId || '') || !!participantForCharacter(project, character.id))
  );

  const removeOrArchive = (replacement?: string) => {
    if (!editTargetId) return;
    onChangeProject(previous => {
      const field = participantField(previous);
      const participant = (previous.settings[field] || []).find(entry => entry.characterId === editTargetId);
      let prepared = previous;
      if (participant && (messageReferenceCount === 0 || replacement)) {
        const replacementParticipant = replacement
          ? (previous.settings[field] || []).find(entry => entry.characterId === replacement)
          : undefined;
        prepared = {
          ...previous,
          settings: {
            ...previous.settings,
            [field]: (previous.settings[field] || []).filter(entry => entry.characterId !== editTargetId),
          },
          messages: previous.messages.map(message =>
            message.characterId === editTargetId && replacementParticipant
              ? { ...message, participantId: replacementParticipant.id }
              : message
          ),
        };
      }
      return archiveOrReassignCharacter(prepared, editTargetId, replacement);
    });
    setDirty(false);
    loadedFormKey.current = '';
    onModeChange({ kind: 'overview' });
  };

  const updateSimpleSetting = (key: keyof SkinProject['settings'], value: unknown) => {
    onChangeProject(previous => ({
      ...previous,
      settings: { ...previous.settings, [key]: value },
    }));
  };

  const updateGroupMode = (value: boolean) => {
    onChangeProject(previous => {
      const key = previous.template === 'ios' ? 'iosGroupMode' : 'androidGroupMode';
      const updated = {
        ...previous,
        settings: { ...previous.settings, [key]: value },
      };
      return value ? syncChatGroupParticipants(updated) : updated;
    });
  };

  const overview = () => {
    const cast = project.cast?.characters || [];
    const self = cast.find(character => character.id === project.cast?.selfId);
    const contact = cast.find(character => character.id === project.cast?.contactId);
    const primary = cast.find(character => character.id === project.cast?.twitterPrimaryId);
    const participants = (project.settings[participantField(project)] || []).flatMap(participant => {
      const character = cast.find(entry => entry.id === participant.characterId);
      return character ? [{ character, participant }] : [];
    });
    const otherPeople = cast.filter(character =>
      character.id !== self?.id
      && character.id !== contact?.id
      && !character.archived
    );
    const otherAccounts = cast.filter(character => character.id !== primary?.id && !character.archived);

    const row = (character: SceneCharacter, target: IdentityTarget, label?: string, color?: string) => (
      <button
        key={`${target.kind}:${character.id}`}
        type="button"
        onClick={() => onModeChange({ kind: 'edit', target })}
        className="flex w-full items-center gap-3 rounded-xl border border-stone-200 p-3 text-left hover:border-violet-300 hover:bg-violet-50/40"
      >
        <Avatar character={character} color={color} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-stone-900">{character.name}</span>
          {isTwitter && <span className="block truncate text-xs text-stone-500">@{character.twitterHandle || character.name.toLowerCase().replace(/\s+/g, '')}</span>}
          {label && <span className="block text-[11px] text-stone-400">{label}</span>}
        </span>
        <span aria-hidden="true" className="text-stone-400">›</span>
      </button>
    );

    return (
      <div className="space-y-5">
        {isTwitter ? (
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-400">Primary account</h3>
            {primary && row(primary, { kind: 'twitter-primary' }, 'Existing primary posts follow changes here')}
            {otherAccounts.length > 0 && <h3 className="pt-3 text-xs font-semibold uppercase tracking-wide text-stone-400">Other accounts</h3>}
            {otherAccounts.map(character => row(character, { kind: 'character', id: character.id }))}
          </section>
        ) : (
          <>
            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-400">Conversation identities</h3>
              {self && row(self, { kind: 'self' }, 'You')}
              {!isGroup && contact && row(contact, { kind: 'contact' }, 'Contact')}
              {!isGroup && otherPeople.map(character =>
                row(character, { kind: 'character', id: character.id }, 'Added to this conversation')
              )}
            </section>

            <section className="space-y-3 rounded-xl border border-stone-200 p-3">
              {/* ToggleRow is the app-wide toggle primitive; a bare checkbox
                  here would be a second idiom for the same control. */}
              <ToggleRow
                label="Group chat mode"
                checked={isGroup}
                onChange={updateGroupMode}
              />
              {isGroup && (
                <>
                  <input
                    value={(project.settings[project.template === 'ios' ? 'iosGroupName' : 'androidGroupName'] as string) || ''}
                    onChange={event => updateSimpleSetting(project.template === 'ios' ? 'iosGroupName' : 'androidGroupName', event.target.value)}
                    placeholder={project.template === 'ios' ? 'Family Chat' : 'Work Team'}
                    aria-label="Group name"
                    className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500"
                  />
                  <ImageUrlInput
                    value={(project.settings[project.template === 'ios' ? 'iosAvatarUrl' : 'androidAvatarUrl'] as string) || ''}
                    onChange={value => updateSimpleSetting(project.template === 'ios' ? 'iosAvatarUrl' : 'androidAvatarUrl', value)}
                    ariaLabel="Group photo"
                    placeholder="Group photo (optional)"
                    previewShape="circle"
                  />
                </>
              )}
            </section>

            {isGroup && (
              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-400">People in the group</h3>
                {participants.filter(({ character }) => !character.archived).map(({ character, participant }) =>
                  row(character, { kind: 'participant', id: participant.id }, undefined, participant.color)
                )}
                {participants.every(({ character }) => character.archived) && <p className="text-sm text-stone-500">No group members yet.</p>}
              </section>
            )}
          </>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onModeChange({ kind: 'create', suggestedRole: isTwitter ? 'account' : isGroup ? 'participant' : 'contact' })}
            className="rounded-xl bg-violet-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
          >
            {isTwitter ? 'Add account' : 'Add person'}
          </button>
          <button type="button" onClick={() => onModeChange({ kind: 'library' })} className="rounded-xl border border-stone-200 px-3 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50">
            Library
          </button>
        </div>
      </div>
    );
  };

  const formView = () => {
    const editing = mode.kind === 'edit';
    const participant = editTargetId ? participantForCharacter(project, editTargetId) : undefined;
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => go({ kind: 'overview' })} className="text-sm font-medium text-violet-700">← Back to {panelTitle.toLowerCase()}</button>
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-600">Name</label>
          <input
            autoFocus
            value={form.name}
            onChange={event => changeForm('name', event.target.value)}
            placeholder={isTwitter ? 'Display name' : 'Person name'}
            maxLength={200}
            className="w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-600">Avatar</label>
          <ImageUrlInput value={form.avatarUrl} onChange={value => changeForm('avatarUrl', value)} ariaLabel="Avatar image address" placeholder="Paste an image address (optional)" previewShape="circle" />
          <button
            type="button"
            onClick={() => onModeChange({ kind: 'avatar-presets', returnTo: editing ? 'edit' : 'create' })}
            className="mt-2 text-xs font-medium text-violet-700 hover:underline"
          >
            Choose an avatar preset
          </button>
        </div>
        {isTwitter && (
          <div className="grid grid-cols-[1fr_auto] items-end gap-3">
            <label className="block text-xs font-medium text-stone-600">
              Handle
              <div className="mt-1 flex items-center rounded-xl border border-stone-200 bg-white px-3">
                <span className="text-stone-400">@</span>
                <input value={form.twitterHandle} onChange={event => changeForm('twitterHandle', event.target.value)} className="min-w-0 flex-1 border-0 px-1 py-2.5 text-sm outline-none" placeholder="username" />
              </div>
            </label>
            <label className="flex h-11 items-center gap-2 text-sm text-stone-700">
              <input type="checkbox" checked={form.verified} onChange={event => changeForm('verified', event.target.checked)} className="accent-violet-600" />
              Verified
            </label>
          </div>
        )}
        {participant && (
          <label className="block text-xs font-medium text-stone-600">
            Group name colour
            <input type="color" value={form.color} onChange={event => changeForm('color', event.target.value)} className="ml-3 h-8 w-12 align-middle" />
          </label>
        )}
        {!editing && (
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input type="checkbox" checked={form.alsoSave} onChange={event => changeForm('alsoSave', event.target.checked)} className="accent-violet-600" />
            Also save to my library
          </label>
        )}
        <button type="button" onClick={saveForm} disabled={!form.name.trim()} className="w-full rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white disabled:bg-stone-200 disabled:text-stone-400">
          {editing ? 'Save changes' : `Add to this ${isTwitter ? 'scene' : 'conversation'}`}
        </button>

        {editing && !isBoundIdentity && (
          <section className="space-y-2 border-t border-stone-100 pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-400">Remove from composer</h3>
            {messageReferenceCount > 0 ? (
              <>
                <p className="text-xs text-stone-500">Used by {messageReferenceCount} existing {messageReferenceCount === 1 ? 'message' : 'messages'}. Archive it to preserve those messages, or reassign them.</p>
                <button type="button" onClick={() => removeOrArchive()} className="w-full rounded-lg border border-amber-300 px-3 py-2 text-sm font-medium text-amber-800">Archive identity</button>
                {replacementOptions.length > 0 && (
                  <div className="flex gap-2">
                    <select value={replacementId} onChange={event => setReplacementId(event.target.value)} aria-label="Replacement identity" className="min-w-0 flex-1 rounded-lg border border-stone-200 px-2 py-2 text-sm">
                      <option value="">Choose replacement</option>
                      {replacementOptions.map(character => <option key={character.id} value={character.id}>{character.name}</option>)}
                    </select>
                    <button type="button" disabled={!replacementId} onClick={() => removeOrArchive(replacementId)} className="rounded-lg bg-stone-900 px-3 py-2 text-sm font-medium text-white disabled:bg-stone-300">Reassign</button>
                  </div>
                )}
              </>
            ) : (
              <button type="button" onClick={() => removeOrArchive()} className="w-full rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700">Remove identity</button>
            )}
          </section>
        )}
      </div>
    );
  };

  const libraryView = () => {
    const editingCharacter = characters.find(character => character.id === libraryEditId);
    if (editingCharacter) {
      return (
        <div className="space-y-4">
          <button type="button" onClick={() => setLibraryEditId(null)} className="text-sm font-medium text-violet-700">← Back to library</button>
          <input value={libraryForm.name} onChange={event => setLibraryForm(previous => ({ ...previous, name: event.target.value }))} aria-label="Library character name" className="w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm" />
          <ImageUrlInput value={libraryForm.avatarUrl} onChange={value => setLibraryForm(previous => ({ ...previous, avatarUrl: value }))} ariaLabel="Library character avatar" previewShape="circle" />
          <div className="flex items-center gap-3">
            <input value={libraryForm.twitterHandle} onChange={event => setLibraryForm(previous => ({ ...previous, twitterHandle: event.target.value }))} aria-label="Library Twitter handle" placeholder="Twitter handle" className="min-w-0 flex-1 rounded-xl border border-stone-200 px-3 py-2.5 text-sm" />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={libraryForm.verified} onChange={event => setLibraryForm(previous => ({ ...previous, verified: event.target.checked }))} /> Verified</label>
          </div>
          <button type="button" disabled={!libraryForm.name.trim()} onClick={() => {
            onUpdateLibraryCharacter(editingCharacter.id, {
              name: libraryForm.name.trim(),
              avatarUrl: libraryForm.avatarUrl.trim() || undefined,
              twitterHandle: normalizeTwitterHandle(libraryForm.twitterHandle) || undefined,
              verified: libraryForm.verified,
            });
            setLibraryEditId(null);
          }} className="w-full rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white disabled:bg-stone-200">Save library character</button>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => onModeChange({ kind: 'overview' })} className="text-sm font-medium text-violet-700">← Back to {panelTitle.toLowerCase()}</button>
        <p className="text-sm text-stone-500">Adding a library character makes an independent copy in this scene.</p>
        {characters.length === 0 && <p className="rounded-xl bg-stone-50 p-4 text-sm text-stone-500">Your library is empty. Create a person and select “Also save to my library”.</p>}
        {characters.map(character => (
          <div key={character.id} className="flex items-center gap-3 rounded-xl border border-stone-200 p-3">
            <Avatar character={character} />
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{character.name}</p>{character.twitterHandle && <p className="truncate text-xs text-stone-500">@{normalizeTwitterHandle(character.twitterHandle)}</p>}</div>
            <div className="flex flex-col gap-1">
              <button type="button" onClick={() => applyLibraryCharacter(character)} className="rounded-lg bg-violet-600 px-2.5 py-1.5 text-xs font-semibold text-white">Add</button>
              <button type="button" onClick={() => {
                setLibraryEditId(character.id);
                setLibraryForm({ ...EMPTY_FORM, name: character.name, avatarUrl: character.avatarUrl || '', twitterHandle: character.twitterHandle || '', verified: !!character.verified });
              }} className="text-xs text-stone-600 hover:underline">Edit</button>
              <button type="button" onClick={() => onDeleteLibraryCharacter(character.id)} className="text-xs text-red-600 hover:underline">Delete</button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const returnFromAvatarPresets = (): IdentityPanelMode => {
    if (mode.kind === 'avatar-presets' && mode.returnTo === 'edit' && editTargetRef.current) {
      return { kind: 'edit', target: editTargetRef.current };
    }
    return { kind: 'create', suggestedRole: isTwitter ? 'account' : isGroup ? 'participant' : 'contact' };
  };

  const avatarPresetsView = () => (
    <div className="space-y-4">
      <button type="button" onClick={() => onModeChange(returnFromAvatarPresets())} className="text-sm font-medium text-violet-700">← Back to form</button>
      <p className="text-sm text-stone-500">Choose an image, then give the person their real name before saving.</p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {CHARACTER_BANK.map(preset => (
          <button key={preset.id} type="button" onClick={() => {
            setForm(previous => ({ ...previous, avatarUrl: preset.url }));
            setDirty(true);
            onModeChange(returnFromAvatarPresets());
          }} className="overflow-hidden rounded-xl border border-stone-200 text-left hover:border-violet-400">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preset.url} alt="" className="aspect-square w-full object-cover" />
            <span className="block truncate px-2 py-1.5 text-[11px] text-stone-600">{preset.name}</span>
          </button>
        ))}
      </div>
    </div>
  );

  const body = mode.kind === 'overview'
    ? overview()
    : mode.kind === 'library'
      ? libraryView()
      : mode.kind === 'avatar-presets'
        ? avatarPresetsView()
        : formView();

  return <BottomSheet isOpen={isOpen} onClose={requestClose} title={panelTitle} height="max-h-[90vh]">{body}</BottomSheet>;
};

export default CastPanel;
