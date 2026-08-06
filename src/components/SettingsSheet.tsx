import React from 'react';
import { SkinSettings, GroupParticipant } from '../lib/schema';
import { AvatarSelector } from './AvatarSelector';
import { ImageUrlInput } from './ImageUrlInput';
import BottomSheet from './BottomSheet';
import {
  ToggleRow,
  SectionDivider,
  SelectRow,
  TextRow,
  AdvancedSection,
} from './SettingsRows';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  template: 'ios' | 'android' | 'twitter' | 'google';
  settings: SkinSettings;
  onUpdateSettings: <K extends keyof SkinSettings>(key: K, value: SkinSettings[K]) => void;
}

/** Multi-line text, one entry per line. */
const LinesRow: React.FC<{
  label: string;
  sublabel?: string;
  value: string[];
  placeholder?: string;
  onChange: (v: string[]) => void;
}> = ({ label, sublabel, value, placeholder, onChange }) => (
  <div className="py-3">
    <span className="text-sm font-medium text-stone-900 block">{label}</span>
    {sublabel && <p className="text-xs text-stone-500 mt-0.5 mb-2">{sublabel}</p>}
    <textarea
      value={(value || []).join('\n')}
      onChange={(e) => onChange(e.target.value.split('\n'))}
      placeholder={placeholder}
      rows={3}
      className="w-full text-xs text-stone-700 bg-stone-100 border-0 rounded-lg px-3 py-2 focus:ring-2 focus:ring-violet-500 resize-none"
    />
  </div>
);

/** URL input with preview, normalisation and expiry warnings. */
const ImageUrlRow: React.FC<{
  label: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
}> = ({ label, value, placeholder, onChange }) => (
  <div className="py-3">
    <span className="text-sm font-medium text-stone-900 block mb-2">{label}</span>
    <ImageUrlInput
      value={value}
      onChange={onChange}
      ariaLabel={label}
      placeholder={placeholder || 'Paste an image address'}
    />
  </div>
);

export const SettingsSheet: React.FC<Props> = ({
  isOpen,
  onClose,
  template,
  settings,
  onUpdateSettings,
}) => {
  const addGroupParticipant = (field: 'iosGroupParticipants' | 'androidGroupParticipants') => {
    const existing = settings[field] || [];
    const colors = ['#FF5733', '#33A1FF', '#33FF57', '#FF33A1', '#FFC733', '#8B33FF'];
    const newP: GroupParticipant = {
      id: `p-${Date.now()}`,
      name: `Person ${existing.length + 1}`,
      color: colors[existing.length % colors.length],
    };
    onUpdateSettings(field, [...existing, newP]);
  };

  const removeGroupParticipant = (field: 'iosGroupParticipants' | 'androidGroupParticipants', id: string) => {
    const existing = settings[field] || [];
    onUpdateSettings(field, existing.filter((p: GroupParticipant) => p.id !== id));
  };

  const updateGroupParticipant = (
    field: 'iosGroupParticipants' | 'androidGroupParticipants',
    id: string,
    updates: Partial<GroupParticipant>
  ) => {
    const existing = settings[field] || [];
    onUpdateSettings(field, existing.map((p: GroupParticipant) =>
      p.id === id ? { ...p, ...updates } : p
    ));
  };

  const sheetTitle = {
    ios: 'iMessage settings',
    android: 'WhatsApp settings',
    twitter: 'X / Twitter settings',
    google: 'Google settings',
  }[template] ?? 'Settings';

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={sheetTitle}>
      <div className="divide-y divide-stone-100">
        {/* iOS Settings */}
        {template === 'ios' && (
          <>
            <SectionDivider label="Appearance" />
            <SelectRow
              label="Message type"
              value={settings.iosMode || 'imessage'}
              options={[
                { value: 'imessage', label: 'iMessage (blue)' },
                { value: 'sms', label: 'SMS (green)' },
              ]}
              onChange={(v) => onUpdateSettings('iosMode', v as 'imessage' | 'sms')}
            />
            <ToggleRow
              label="Dark mode"
              checked={settings.iosDarkMode || false}
              onChange={(v) => onUpdateSettings('iosDarkMode', v)}
            />
            <ToggleRow
              label="Auto-alternate senders"
              sublabel="Automatically switch between You and Them"
              checked={settings.iosAutoAlternate !== false}
              onChange={(v) => onUpdateSettings('iosAutoAlternate', v)}
            />

            <SectionDivider label="Display" />
            <ToggleRow
              label="Read receipt"
              sublabel={'Shows "Read" under your last message'}
              checked={settings.iosShowReadReceipt !== false}
              onChange={(v) => onUpdateSettings('iosShowReadReceipt', v)}
            />

            <SectionDivider label="Contact" />
            <div className="py-3">
              <span className="text-sm font-medium text-stone-900 block mb-2">Contact photo</span>
              <p className="text-xs text-stone-500 -mt-1.5 mb-2">
                Their name is the title at the top of the screen — tap it to change.
              </p>
              <AvatarSelector
                value={settings.iosAvatarUrl || ''}
                onChange={(v) => onUpdateSettings('iosAvatarUrl', v)}
                placeholder="Paste an image address, or pick a preset"
              />
            </div>

            <SectionDivider label="Group chat" />
            <ToggleRow
              label="Group chat mode"
              checked={settings.iosGroupMode || false}
              onChange={(v) => onUpdateSettings('iosGroupMode', v)}
            />
            {settings.iosGroupMode && (
              <>
                <TextRow
                  label="Group name"
                  value={settings.iosGroupName || ''}
                  placeholder="Family Chat"
                  onChange={(v) => onUpdateSettings('iosGroupName', v)}
                />
                <div className="py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-stone-900">Participants</span>
                    <button
                      onClick={() => addGroupParticipant('iosGroupParticipants')}
                      className="text-xs font-medium text-violet-600 hover:text-violet-800"
                    >
                      + Add
                    </button>
                  </div>
                  {(settings.iosGroupParticipants || []).map((p) => (
                    <div key={p.id} className="flex items-center gap-2 bg-stone-50 rounded-lg p-2">
                      <input
                        type="color"
                        value={p.color}
                        onChange={(e) => updateGroupParticipant('iosGroupParticipants', p.id, { color: e.target.value })}
                        className="w-6 h-6 rounded cursor-pointer border-0"
                      />
                      <input
                        value={p.name}
                        onChange={(e) => updateGroupParticipant('iosGroupParticipants', p.id, { name: e.target.value })}
                        className="flex-1 text-sm bg-transparent border-0 outline-none"
                        placeholder="Name"
                      />
                      <button
                        onClick={() => removeGroupParticipant('iosGroupParticipants', p.id)}
                        className="text-stone-400 hover:text-red-500 text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

          </>
        )}

        {/* Android / WhatsApp Settings */}
        {template === 'android' && (
          <>
            <SectionDivider label="Appearance" />
            <ToggleRow
              label="Dark mode"
              checked={settings.androidDarkMode || false}
              onChange={(v) => onUpdateSettings('androidDarkMode', v)}
            />
            <ToggleRow
              label="Auto-alternate senders"
              sublabel="Automatically switch between You and Them"
              checked={settings.androidAutoAlternate !== false}
              onChange={(v) => onUpdateSettings('androidAutoAlternate', v)}
            />

            <SectionDivider label="Display" />
            <ToggleRow
              label="Online status"
              sublabel="The line under their name in the header"
              checked={settings.androidShowStatus !== false}
              onChange={(v) => onUpdateSettings('androidShowStatus', v)}
            />
            {settings.androidShowStatus !== false && (
              <TextRow
                label="Status text"
                value={settings.androidStatusText || 'online'}
                placeholder="online"
                onChange={(v) => onUpdateSettings('androidStatusText', v)}
              />
            )}
            <ToggleRow
              label="Checkmarks"
              sublabel="The ✓✓ delivery ticks on your messages"
              checked={settings.androidCheckmarks !== false}
              onChange={(v) => onUpdateSettings('androidCheckmarks', v)}
            />

            <SectionDivider label="Contact" />
            <div className="py-3">
              <span className="text-sm font-medium text-stone-900 block mb-2">Profile picture</span>
              <p className="text-xs text-stone-500 -mt-1.5 mb-2">
                Their name is the title at the top of the screen — tap it to change.
              </p>
              <AvatarSelector
                value={settings.androidAvatarUrl || ''}
                onChange={(v) => onUpdateSettings('androidAvatarUrl', v)}
                placeholder="Paste an image address, or pick a preset"
              />
            </div>

            <SectionDivider label="Group chat" />
            <ToggleRow
              label="Group chat mode"
              checked={settings.androidGroupMode || false}
              onChange={(v) => onUpdateSettings('androidGroupMode', v)}
            />
            {settings.androidGroupMode && (
              <>
                <TextRow
                  label="Group name"
                  value={settings.androidGroupName || ''}
                  placeholder="Work Team"
                  onChange={(v) => onUpdateSettings('androidGroupName', v)}
                />
                <div className="py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-stone-900">Participants</span>
                    <button
                      onClick={() => addGroupParticipant('androidGroupParticipants')}
                      className="text-xs font-medium text-violet-600 hover:text-violet-800"
                    >
                      + Add
                    </button>
                  </div>
                  {(settings.androidGroupParticipants || []).map((p) => (
                    <div key={p.id} className="flex items-center gap-2 bg-stone-50 rounded-lg p-2">
                      <input
                        type="color"
                        value={p.color}
                        onChange={(e) => updateGroupParticipant('androidGroupParticipants', p.id, { color: e.target.value })}
                        className="w-6 h-6 rounded cursor-pointer border-0"
                      />
                      <input
                        value={p.name}
                        onChange={(e) => updateGroupParticipant('androidGroupParticipants', p.id, { name: e.target.value })}
                        className="flex-1 text-sm bg-transparent border-0 outline-none"
                        placeholder="Name"
                      />
                      <button
                        onClick={() => removeGroupParticipant('androidGroupParticipants', p.id)}
                        className="text-stone-400 hover:text-red-500 text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

          </>
        )}

        {/* Twitter Settings */}
        {template === 'twitter' && (
          <>
            <SectionDivider label="Profile" />
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
            <div className="py-3">
              <span className="text-sm font-medium text-stone-900 block mb-2">Profile picture</span>
              <p className="text-xs text-stone-500 -mt-1.5 mb-2">
                The display name is the title at the top of the screen — tap it to change.
              </p>
              <AvatarSelector
                value={settings.twitterAvatarUrl || ''}
                onChange={(v) => onUpdateSettings('twitterAvatarUrl', v)}
                placeholder="Paste an image address, or pick a preset"
              />
            </div>

            <SectionDivider label="Display" />
            <ToggleRow
              label="Dark mode"
              checked={settings.twitterDarkMode || false}
              onChange={(v) => onUpdateSettings('twitterDarkMode', v)}
            />
            <ToggleRow
              label="Thread mode"
              sublabel="Connect tweets with lines"
              checked={settings.twitterThreadMode || false}
              onChange={(v) => onUpdateSettings('twitterThreadMode', v)}
            />
            <ToggleRow
              label="Show metrics"
              sublabel="Likes, retweets, replies"
              checked={settings.twitterShowMetrics !== false}
              onChange={(v) => onUpdateSettings('twitterShowMetrics', v)}
            />
            <TextRow
              label="Timestamp"
              value={settings.twitterTimestamp || ''}
              placeholder="2:15 PM · Nov 26, 2025"
              onChange={(v) => onUpdateSettings('twitterTimestamp', v)}
            />

            <SectionDivider label="Quote tweet" />
            <ToggleRow
              label="Enable quote tweet"
              sublabel="Embed another post inside yours"
              checked={settings.twitterQuoteEnabled || false}
              onChange={(v) => onUpdateSettings('twitterQuoteEnabled', v)}
            />
            {settings.twitterQuoteEnabled && (
              <>
                <TextRow
                  label="Quoted name"
                  value={settings.twitterQuoteName || ''}
                  placeholder="Quoted User"
                  onChange={(v) => onUpdateSettings('twitterQuoteName', v)}
                />
                <TextRow
                  label="Quoted handle"
                  value={settings.twitterQuoteHandle || ''}
                  placeholder="quoteduser"
                  onChange={(v) => onUpdateSettings('twitterQuoteHandle', v)}
                />
                <ToggleRow
                  label="Quoted account verified"
                  checked={settings.twitterQuoteVerified || false}
                  onChange={(v) => onUpdateSettings('twitterQuoteVerified', v)}
                />
                <TextRow
                  label="Quoted text"
                  value={settings.twitterQuoteText || ''}
                  placeholder="Original tweet text"
                  onChange={(v) => onUpdateSettings('twitterQuoteText', v)}
                />
                <div className="py-3">
                  <span className="text-sm font-medium text-stone-900 block mb-2">Quoted profile picture</span>
                  <AvatarSelector
                    value={settings.twitterQuoteAvatar || ''}
                    onChange={(v) => onUpdateSettings('twitterQuoteAvatar', v)}
                    placeholder="Paste an image address, or pick a preset"
                  />
                </div>
                <ImageUrlRow
                  label="Image in the quoted post"
                  value={settings.twitterQuoteImage || ''}
                  onChange={(v) => onUpdateSettings('twitterQuoteImage', v)}
                />
              </>
            )}
          </>
        )}

        {/* Google Settings */}
        {template === 'google' && (
          <>
            <SectionDivider label="Search" />
            <p className="text-xs text-stone-500 pb-3">
              What was searched for is the title at the top of the screen — tap it
              to change.
            </p>
            <SelectRow
              label="Search engine"
              value={settings.googleEngineVariant || 'google'}
              options={[
                { value: 'google', label: 'Google' },
                { value: 'google-old', label: 'Google (older look)' },
                { value: 'naver', label: 'Naver (Korean)' },
              ]}
              onChange={(v) => onUpdateSettings('googleEngineVariant', v as 'google' | 'google-old' | 'naver')}
            />
            <LinesRow
              label="Autocomplete suggestions"
              sublabel="One per line — shown in the dropdown under the search box"
              value={settings.googleSuggestions || []}
              placeholder={'captain jack sparrow actor\ncaptain jack sparrow quotes'}
              onChange={(v) => onUpdateSettings('googleSuggestions', v)}
            />

            <SectionDivider label="Display" />
            <ToggleRow
              label="Show results bar"
              sublabel='The "About 24,000,000 results" line'
              checked={settings.googleShowStats !== false}
              onChange={(v) => onUpdateSettings('googleShowStats', v)}
            />
            <ToggleRow
              label="Did you mean"
              sublabel="Show a spelling correction above the results"
              checked={settings.googleShowDidYouMean || false}
              onChange={(v) => onUpdateSettings('googleShowDidYouMean', v)}
            />
            {settings.googleShowDidYouMean && (
              <TextRow
                label="Correction"
                value={settings.googleDidYouMean || ''}
                placeholder="Captain Jack Sparrow"
                onChange={(v) => onUpdateSettings('googleDidYouMean', v)}
              />
            )}

          </>
        )}

        {/* One Advanced section, not two — the platform-specific rows and the
            shared ones live together so there is a single place to look. */}
        <AdvancedSection>
          {template === 'ios' && (
            <>
              <ToggleRow
                label="Phone status bar"
                sublabel="Time, signal and battery across the top"
                checked={settings.iosShowStatusBar || false}
                onChange={(v) => onUpdateSettings('iosShowStatusBar', v)}
              />
              <ToggleRow
                label="Typing bar"
                sublabel="The message box along the bottom"
                checked={settings.iosShowInputBar || false}
                onChange={(v) => onUpdateSettings('iosShowInputBar', v)}
              />
              <ImageUrlRow
                label="Header background"
                value={settings.iosHeaderImageUrl || ''}
                onChange={(v) => onUpdateSettings('iosHeaderImageUrl', v)}
              />
              <ImageUrlRow
                label="Footer background"
                value={settings.iosFooterImageUrl || ''}
                onChange={(v) => onUpdateSettings('iosFooterImageUrl', v)}
              />
            </>
          )}

          {template === 'android' && (
            <>
              <ImageUrlRow
                label="Header background"
                value={settings.androidHeaderImageUrl || ''}
                onChange={(v) => onUpdateSettings('androidHeaderImageUrl', v)}
              />
              <ImageUrlRow
                label="Footer background"
                value={settings.androidFooterImageUrl || ''}
                onChange={(v) => onUpdateSettings('androidFooterImageUrl', v)}
              />
            </>
          )}

          {template === 'google' && (
            <>
              {/* Left blank, these read as plausible numbers derived from the
                  query — which is all anyone wanted from them. */}
              <TextRow
                label="Results count"
                value={settings.googleResultsCount || ''}
                placeholder="Auto"
                onChange={(v) => onUpdateSettings('googleResultsCount', v)}
              />
              <TextRow
                label="Search time"
                value={settings.googleResultsTime || ''}
                placeholder="Auto"
                onChange={(v) => onUpdateSettings('googleResultsTime', v)}
              />
            </>
          )}

          <div className="flex items-center justify-between py-3 gap-3">
            <span className="text-sm font-medium text-stone-900">Width</span>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={280}
                max={600}
                aria-label="Width in pixels"
                value={settings.maxWidthPx}
                onChange={(e) => onUpdateSettings('maxWidthPx', parseInt(e.target.value))}
                className="w-24 accent-violet-600"
              />
              <span className="text-xs text-stone-500 w-10 text-right">{settings.maxWidthPx}px</span>
            </div>
          </div>
          <ToggleRow
            label="Watermark"
            sublabel="Remove with Pro"
            checked={settings.watermark !== false}
            onChange={(v) => onUpdateSettings('watermark', v)}
          />
        </AdvancedSection>
      </div>
    </BottomSheet>
  );
};

export default SettingsSheet;
