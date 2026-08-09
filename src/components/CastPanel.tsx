import React from 'react';
import { SkinSettings, GroupParticipant, UniversalCharacter, TwitterCharacter } from '../lib/schema';
import { AvatarSelector } from './AvatarSelector';
import { ImageUrlInput } from './ImageUrlInput';
import BottomSheet from './BottomSheet';
import { ToggleRow, TextRow } from './SettingsRows';

/**
 * "Who is in this conversation, and what do they look like."
 *
 * Before this panel, that question was answered in four places: the other
 * person's name was the header title, their photo was in Settings under
 * "Contact", your Twitter handle was in Settings under "Profile", saved
 * characters were in a fourth drawer — and **your own name did not exist at
 * all**. Settings apologised for the split three times, in the form of "Their
 * name is the title at the top of the screen — tap it to change". That sentence
 * was a bug report.
 *
 * ## This is four panels, not one layout with conditionals
 *
 * Switch on `template` at the top level and share the leaf components
 * underneath. The alternative — one tree sprinkled with
 * `template === 'ios' && !settings.iosGroupMode &&` — is how this file would
 * become unreadable, because group mode does not *add* fields, it **changes
 * what the existing ones mean**:
 *
 * - The header renders `iosGroupName` / `androidGroupName`; the contact name is
 *   still used to label unassigned incoming messages, but is invisible.
 * - `iosAvatarUrl` / `androidAvatarUrl` becomes **the group's** photo rather
 *   than a person's. Same field, different meaning, no label change anywhere in
 *   the generator.
 *
 * So the "Them" card is *replaced* by a "The group" card, not supplemented.
 */

interface Props {
  isOpen: boolean;
  onClose: () => void;
  template: 'ios' | 'android' | 'twitter' | 'google';
  settings: SkinSettings;
  onUpdateSettings: <K extends keyof SkinSettings>(key: K, value: SkinSettings[K]) => void;
  /** Renames the contact *and* rewrites the messages they have already sent. */
  onRenameContact: (name: string) => void;
  universalCharacters: UniversalCharacter[];
  onOpenCharacterLibrary: () => void;
}

/** A titled block for one identity: a name, an optional photo, and a note. */
const PersonCard: React.FC<{
  title: string;
  note?: string;
  children?: React.ReactNode;
}> = ({ title, note, children }) => (
  <div className="py-3">
    <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider block mb-1">
      {title}
    </span>
    <div className="space-y-2">{children}</div>
    {note && <p className="text-xs text-stone-500 mt-2 leading-relaxed">{note}</p>}
  </div>
);

/** A 40px round avatar, or a coloured monogram — the same fallback the generator uses. */
const Monogram: React.FC<{ name: string; url?: string; color?: string }> = ({
  name,
  url,
  color = '#a8a29e',
}) =>
  url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      className="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-stone-200"
    />
  ) : (
    <span
      className="w-10 h-10 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
      style={{ backgroundColor: `${color}20`, color }}
    >
      {name.substring(0, 2).toUpperCase()}
    </span>
  );

export const CastPanel: React.FC<Props> = ({
  isOpen,
  onClose,
  template,
  settings,
  onUpdateSettings,
  onRenameContact,
  universalCharacters,
  onOpenCharacterLibrary,
}) => {
  // ── Participant handlers ────────────────────────────────────────────────
  // Moved verbatim from SettingsSheet, with one addition: `add` takes a seed so
  // the "+ Add" button and the library strip share a single code path.
  type ParticipantField = 'iosGroupParticipants' | 'androidGroupParticipants';

  const addParticipant = (field: ParticipantField, seed?: Partial<GroupParticipant>) => {
    const existing = settings[field] || [];
    const colors = ['#FF5733', '#33A1FF', '#33FF57', '#FF33A1', '#FFC733', '#8B33FF'];
    onUpdateSettings(field, [
      ...existing,
      {
        id: `p-${Date.now()}`,
        name: `Person ${existing.length + 1}`,
        color: colors[existing.length % colors.length],
        ...seed,
      } as GroupParticipant,
    ]);
  };

  const removeParticipant = (field: ParticipantField, id: string) => {
    const existing = settings[field] || [];
    onUpdateSettings(field, existing.filter((p: GroupParticipant) => p.id !== id));
  };

  const updateParticipant = (
    field: ParticipantField,
    id: string,
    updates: Partial<GroupParticipant>
  ) => {
    const existing = settings[field] || [];
    onUpdateSettings(
      field,
      existing.map((p: GroupParticipant) => (p.id === id ? { ...p, ...updates } : p))
    );
  };

  // ── Shared sub-sections ─────────────────────────────────────────────────

  const participantSection = (field: ParticipantField) => {
    const people = settings[field] || [];
    return (
      <div className="py-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
            People in the group
          </span>
          <button
            onClick={() => addParticipant(field)}
            className="text-xs font-medium text-violet-600 hover:text-violet-800"
          >
            + Add
          </button>
        </div>

        {people.length === 0 && (
          <p className="text-xs text-stone-500">
            Add someone, then pick them from the selector beside the message box as you write.
          </p>
        )}

        {people.map((p) => (
          <div key={p.id} className="rounded-xl border border-stone-200 p-2.5 space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={p.color}
                onChange={(e) => updateParticipant(field, p.id, { color: e.target.value })}
                aria-label={`Name colour for ${p.name}`}
                title={`Name colour for ${p.name}`}
                className="w-6 h-6 rounded cursor-pointer border-0 flex-shrink-0"
              />
              <input
                value={p.name}
                onChange={(e) => updateParticipant(field, p.id, { name: e.target.value })}
                aria-label="Participant name"
                placeholder="Name"
                className="flex-1 min-w-0 text-sm bg-stone-100 rounded-lg px-2.5 py-1.5 border-0 outline-none focus:ring-2 focus:ring-violet-500"
              />
              <button
                onClick={() => removeParticipant(field, p.id)}
                aria-label={`Remove ${p.name}`}
                title={`Remove ${p.name}`}
                className="flex-shrink-0 text-stone-400 hover:text-red-500 text-xs w-6 h-6"
              >
                ✕
              </button>
            </div>

            {/*
              THE FIELD THAT WAS MISSING. The generator has drawn participant
              avatars since group chat shipped — a 20px round image beside a
              colour-coded name, or a coloured monogram from the initials
              without one — and `GroupParticipant.avatarUrl` has been in the
              schema the whole time. A UI rewrite dropped the input, so the
              rendering path stayed live and tested with nothing able to reach it.

              ImageUrlInput rather than AvatarSelector, deliberately: the preset
              browser is absolutely positioned and this list sits inside a
              BottomSheet whose content area is overflow-y-auto, which clips it.
              One presets entry point for the whole section, at the bottom.
            */}
            <ImageUrlInput
              value={p.avatarUrl || ''}
              onChange={(url) => updateParticipant(field, p.id, { avatarUrl: url })}
              previewShape="circle"
              ariaLabel={`Photo for ${p.name}`}
              placeholder="Photo (optional) — a monogram is used without one"
            />
          </div>
        ))}

        {universalCharacters.length > 0 && (
          <div className="pt-2">
            <p className="text-[11px] text-stone-500 mb-1.5">Add from your library</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {universalCharacters.map((c) => (
                <button
                  key={c.id}
                  onClick={() => addParticipant(field, { name: c.name, avatarUrl: c.avatarUrl })}
                  title={`Add ${c.name}`}
                  className="flex-shrink-0 flex flex-col items-center gap-1 w-14"
                >
                  <Monogram name={c.name} url={c.avatarUrl} />
                  <span className="text-[10px] text-stone-600 truncate w-full text-center">
                    {c.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={onOpenCharacterLibrary}
          className="text-xs font-medium text-violet-600 hover:underline"
        >
          Browse avatar presets →
        </button>
      </div>
    );
  };

  // ── Per-platform bodies ─────────────────────────────────────────────────

  const chatBody = (kind: 'ios' | 'android') => {
    const groupOn = kind === 'ios' ? settings.iosGroupMode : settings.androidGroupMode;
    const avatarKey = kind === 'ios' ? 'iosAvatarUrl' : 'androidAvatarUrl';
    const groupNameKey = kind === 'ios' ? 'iosGroupName' : 'androidGroupName';
    const groupModeKey = kind === 'ios' ? 'iosGroupMode' : 'androidGroupMode';
    const contactKey = kind === 'ios' ? 'iosContactName' : 'androidContactName';
    const participantField: ParticipantField =
      kind === 'ios' ? 'iosGroupParticipants' : 'androidGroupParticipants';
    const appName = kind === 'ios' ? 'iMessage' : 'WhatsApp';

    return (
      <>
        <PersonCard
          title="You"
          // Not filler. "Where do I set my own photo?" is the question that
          // produced this panel, and the answer is that there is nowhere for it
          // to go — neither app draws your picture on your own messages. Saying
          // why stops the hunt for a control that should not exist.
          note={`Your own photo isn't shown — ${appName} never draws it on your own messages. Your name isn't shown on screen either, but it is what a reader sees if they turn the skin off or download the work as an ebook.`}
        >
          <TextRow
            label="Your name"
            value={settings.chatYourName || ''}
            placeholder="You"
            onChange={(v) => onUpdateSettings('chatYourName', v)}
          />
        </PersonCard>

        <div className="border-t border-stone-100" />

        {groupOn ? (
          <PersonCard
            title="The group"
            // The SAME settings field as "their photo" below. In group mode the
            // generator renders it beside the group's name in the header, so
            // labelling it "their photo" here would be a lie.
            note="Shown beside the group name at the top of the chat."
          >
            <TextRow
              label="Group name"
              value={(settings[groupNameKey] as string) || ''}
              placeholder={kind === 'ios' ? 'Family Chat' : 'Work Team'}
              onChange={(v) => onUpdateSettings(groupNameKey, v)}
            />
            <AvatarSelector
              value={(settings[avatarKey] as string) || ''}
              onChange={(v) => onUpdateSettings(avatarKey, v)}
              placeholder="Group photo — paste an address, or pick a preset"
            />
          </PersonCard>
        ) : (
          <PersonCard title="Them" note="Shown in the header at the top of the chat.">
            <TextRow
              label="Their name"
              value={(settings[contactKey] as string) || settings.chatContactName || ''}
              placeholder="Their name, e.g. Steve"
              // Renaming rewrites what they have already said — see
              // handleRenameContact in index.tsx.
              onChange={onRenameContact}
            />
            <AvatarSelector
              value={(settings[avatarKey] as string) || ''}
              onChange={(v) => onUpdateSettings(avatarKey, v)}
              placeholder="Their photo — paste an address, or pick a preset"
            />
          </PersonCard>
        )}

        <div className="border-t border-stone-100" />

        <ToggleRow
          label="Group chat mode"
          sublabel="Several people in one thread, each with their own name and colour"
          checked={Boolean(groupOn)}
          onChange={(v) => onUpdateSettings(groupModeKey, v)}
        />

        {groupOn && participantSection(participantField)}
      </>
    );
  };

  const twitterBody = () => {
    // Two stores merged into one list, and only one of them is deletable here.
    // The compose bar's "posting as" roster is
    // `settings.twitterCharacterPresets` (project-scoped) plus
    // `universalCharacters` (global, in localStorage). A delete control that
    // did not distinguish them would let a click inside one fic remove a
    // character from every project the author has ever made — so the library
    // rows carry a tag and no ✕, and removing one stays the Character
    // Library's job.
    const presets: TwitterCharacter[] = settings.twitterCharacterPresets || [];
    const fromLibrary = universalCharacters.filter(
      (c) => !presets.some((p) => p.name === c.name)
    );

    return (
      <>
        <PersonCard
          title="You"
          // chatYourName must NOT appear here: twitterDisplayName is the
          // equivalent and it is already the header title. Two fields for one
          // name is the problem this panel exists to remove.
          note="Your display name is the title at the top of the screen."
        >
          <TextRow
            label="Handle"
            value={settings.twitterHandle || ''}
            placeholder="johndoe"
            onChange={(v) => onUpdateSettings('twitterHandle', v)}
          />
          <ToggleRow
            label="Verified badge"
            checked={settings.twitterVerified || false}
            onChange={(v) => onUpdateSettings('twitterVerified', v)}
          />
          <AvatarSelector
            value={settings.twitterAvatarUrl || ''}
            onChange={(v) => onUpdateSettings('twitterAvatarUrl', v)}
            placeholder="Your photo — paste an address, or pick a preset"
          />
        </PersonCard>

        <div className="border-t border-stone-100" />

        <div className="py-3 space-y-2">
          <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider block">
            Other accounts in this thread
          </span>
          <p className="text-xs text-stone-500">
            These fill the &ldquo;posting as&rdquo; list beside the message box.
          </p>

          {presets.length === 0 && fromLibrary.length === 0 && (
            <p className="text-xs text-stone-500">
              Nobody yet. Save a character in the library and they show up here.
            </p>
          )}

          {presets.map((c) => (
            <div key={c.id} className="flex items-center gap-2 rounded-xl border border-stone-200 p-2">
              <Monogram name={c.name} url={c.avatarUrl} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-stone-900 truncate">{c.name}</p>
                <p className="text-[11px] text-stone-500 truncate">@{c.handle.replace(/^@/, '')}</p>
              </div>
              <span className="text-[10px] text-stone-400 flex-shrink-0">this fic</span>
              <button
                onClick={() =>
                  onUpdateSettings(
                    'twitterCharacterPresets',
                    presets.filter((p) => p.id !== c.id)
                  )
                }
                aria-label={`Remove ${c.name}`}
                title={`Remove ${c.name} from this project`}
                className="flex-shrink-0 text-stone-400 hover:text-red-500 text-xs w-6 h-6"
              >
                ✕
              </button>
            </div>
          ))}

          {fromLibrary.map((c) => (
            <div key={c.id} className="flex items-center gap-2 rounded-xl border border-stone-200 p-2">
              <Monogram name={c.name} url={c.avatarUrl} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-stone-900 truncate">{c.name}</p>
                <p className="text-[11px] text-stone-500 truncate">
                  @{(c.twitterHandle || c.name.toLowerCase().replace(/\s+/g, '')).replace(/^@/, '')}
                </p>
              </div>
              {/* No ✕ — this one is global. Saying where it comes from is what
                  makes the missing button read as intentional. */}
              <span className="text-[10px] text-stone-400 flex-shrink-0">library</span>
            </div>
          ))}

          <button
            onClick={onOpenCharacterLibrary}
            className="text-xs font-medium text-violet-600 hover:underline"
          >
            Browse avatar presets →
          </button>
        </div>
      </>
    );
  };

  const title =
    template === 'twitter' ? 'Accounts' : template === 'google' ? 'People' : 'People';

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={title}>
      <div className="divide-y divide-stone-100">
        {(template === 'ios' || template === 'android') && chatBody(template)}
        {template === 'twitter' && twitterBody()}
        {/* Google never reaches here — index.tsx routes its header button to
            the Character Library instead, because Google has no cast and
            hiding the button would strand that feature. */}
      </div>
    </BottomSheet>
  );
};

export default CastPanel;
