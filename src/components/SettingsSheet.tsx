import React from 'react';
import { SkinSettings, GroupParticipant } from '../lib/schema';
import { AvatarSelector } from './AvatarSelector';
import BottomSheet from './BottomSheet';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  template: 'ios' | 'android' | 'twitter' | 'google';
  settings: SkinSettings;
  onUpdateSettings: <K extends keyof SkinSettings>(key: K, value: SkinSettings[K]) => void;
}

// Reusable row components
const ToggleRow: React.FC<{
  label: string;
  sublabel?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}> = ({ label, sublabel, checked, onChange }) => (
  <div className="flex items-center justify-between py-3">
    <div>
      <span className="text-sm font-medium text-stone-900">{label}</span>
      {sublabel && <p className="text-xs text-stone-500 mt-0.5">{sublabel}</p>}
    </div>
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors ${
        checked ? 'bg-violet-600' : 'bg-stone-300'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  </div>
);

const SectionDivider: React.FC<{ label: string }> = ({ label }) => (
  <div className="pt-4 pb-1">
    <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">{label}</span>
  </div>
);

const SelectRow: React.FC<{
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}> = ({ label, value, options, onChange }) => (
  <div className="flex items-center justify-between py-3">
    <span className="text-sm font-medium text-stone-900">{label}</span>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-sm text-stone-700 bg-stone-100 border-0 rounded-lg px-3 py-1.5 cursor-pointer focus:ring-2 focus:ring-violet-500"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
);

const TextRow: React.FC<{
  label: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
}> = ({ label, value, placeholder, onChange }) => (
  <div className="flex items-center justify-between py-3 gap-3">
    <span className="text-sm font-medium text-stone-900 shrink-0">{label}</span>
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="text-sm text-stone-700 bg-stone-100 border-0 rounded-lg px-3 py-1.5 w-full max-w-[180px] text-right focus:ring-2 focus:ring-violet-500"
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
              checked={settings.iosShowReadReceipt !== false}
              onChange={(v) => onUpdateSettings('iosShowReadReceipt', v)}
            />
            <ToggleRow
              label="Delivered indicator"
              checked={settings.iosShowDelivered || false}
              onChange={(v) => onUpdateSettings('iosShowDelivered', v)}
            />
            <ToggleRow
              label="Status bar"
              sublabel="Time, signal, battery at top"
              checked={settings.iosShowStatusBar || false}
              onChange={(v) => onUpdateSettings('iosShowStatusBar', v)}
            />
            {settings.iosShowStatusBar && (
              <TextRow
                label="Status bar time"
                value={settings.iosStatusBarTime || '9:41'}
                onChange={(v) => onUpdateSettings('iosStatusBarTime', v)}
              />
            )}
            <ToggleRow
              label="Input bar"
              checked={settings.iosShowInputBar || false}
              onChange={(v) => onUpdateSettings('iosShowInputBar', v)}
            />

            <SectionDivider label="Contact" />
            <TextRow
              label="Contact name"
              value={settings.iosContactName || ''}
              placeholder="Their name"
              onChange={(v) => onUpdateSettings('iosContactName', v)}
            />
            <div className="py-3">
              <span className="text-sm font-medium text-stone-900 block mb-2">Contact avatar</span>
              <AvatarSelector
                value={settings.iosAvatarUrl || ''}
                onChange={(v) => onUpdateSettings('iosAvatarUrl', v)}
                placeholder="Avatar image URL"
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
              label="WhatsApp style"
              checked={settings.androidWhatsAppMode !== false}
              onChange={(v) => onUpdateSettings('androidWhatsAppMode', v)}
            />
            <ToggleRow
              label="Dark mode"
              checked={settings.androidDarkMode || false}
              onChange={(v) => onUpdateSettings('androidDarkMode', v)}
            />
            <ToggleRow
              label="Auto-alternate senders"
              checked={settings.androidAutoAlternate !== false}
              onChange={(v) => onUpdateSettings('androidAutoAlternate', v)}
            />

            <SectionDivider label="Display" />
            <ToggleRow
              label="Online status"
              checked={settings.androidShowStatus !== false}
              onChange={(v) => onUpdateSettings('androidShowStatus', v)}
            />
            {settings.androidShowStatus && (
              <TextRow
                label="Status text"
                value={settings.androidStatusText || 'online'}
                onChange={(v) => onUpdateSettings('androidStatusText', v)}
              />
            )}
            <ToggleRow
              label="Checkmarks"
              checked={settings.androidCheckmarks !== false}
              onChange={(v) => onUpdateSettings('androidCheckmarks', v)}
            />
            <ToggleRow
              label="Read receipt"
              checked={settings.androidShowReadReceipt !== false}
              onChange={(v) => onUpdateSettings('androidShowReadReceipt', v)}
            />

            <SectionDivider label="Contact" />
            <TextRow
              label="Contact name"
              value={settings.androidContactName || ''}
              placeholder="Their name"
              onChange={(v) => onUpdateSettings('androidContactName', v)}
            />
            <div className="py-3">
              <span className="text-sm font-medium text-stone-900 block mb-2">Profile picture</span>
              <AvatarSelector
                value={settings.androidAvatarUrl || ''}
                onChange={(v) => onUpdateSettings('androidAvatarUrl', v)}
                placeholder="Avatar image URL"
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
              label="Display name"
              value={settings.twitterDisplayName || ''}
              placeholder="John Doe"
              onChange={(v) => onUpdateSettings('twitterDisplayName', v)}
            />
            <TextRow
              label="Handle"
              value={settings.twitterHandle || ''}
              placeholder="@johndoe"
              onChange={(v) => onUpdateSettings('twitterHandle', v)}
            />
            <ToggleRow
              label="Verified badge"
              checked={settings.twitterVerified || false}
              onChange={(v) => onUpdateSettings('twitterVerified', v)}
            />
            <div className="py-3">
              <span className="text-sm font-medium text-stone-900 block mb-2">Avatar</span>
              <AvatarSelector
                value={settings.twitterAvatarUrl || ''}
                onChange={(v) => onUpdateSettings('twitterAvatarUrl', v)}
                placeholder="Avatar image URL"
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
              checked={settings.twitterQuoteEnabled || false}
              onChange={(v) => onUpdateSettings('twitterQuoteEnabled', v)}
            />
            {settings.twitterQuoteEnabled && (
              <>
                <TextRow
                  label="Quote name"
                  value={settings.twitterQuoteName || ''}
                  placeholder="Quoted User"
                  onChange={(v) => onUpdateSettings('twitterQuoteName', v)}
                />
                <TextRow
                  label="Quote handle"
                  value={settings.twitterQuoteHandle || ''}
                  placeholder="@quoteduser"
                  onChange={(v) => onUpdateSettings('twitterQuoteHandle', v)}
                />
                <TextRow
                  label="Quote text"
                  value={settings.twitterQuoteText || ''}
                  placeholder="Original tweet text"
                  onChange={(v) => onUpdateSettings('twitterQuoteText', v)}
                />
              </>
            )}
          </>
        )}

        {/* Google Settings */}
        {template === 'google' && (
          <>
            <SectionDivider label="Search" />
            <TextRow
              label="Search query"
              value={settings.googleQuery || ''}
              placeholder="captain jack sparrow"
              onChange={(v) => onUpdateSettings('googleQuery', v)}
            />
            <SelectRow
              label="Engine variant"
              value={settings.googleEngineVariant || 'google'}
              options={[
                { value: 'google', label: 'Google (Modern)' },
                { value: 'google-old', label: 'Google (Classic)' },
                { value: 'naver', label: 'Naver' },
              ]}
              onChange={(v) => onUpdateSettings('googleEngineVariant', v as 'google' | 'google-old' | 'naver')}
            />

            <SectionDivider label="Display" />
            <ToggleRow
              label="Show stats bar"
              sublabel="Results count and time"
              checked={settings.googleShowStats !== false}
              onChange={(v) => onUpdateSettings('googleShowStats', v)}
            />
            {settings.googleShowStats && (
              <>
                <TextRow
                  label="Results count"
                  value={settings.googleResultsCount || ''}
                  placeholder="About 24,040,000,000 results"
                  onChange={(v) => onUpdateSettings('googleResultsCount', v)}
                />
                <TextRow
                  label="Results time"
                  value={settings.googleResultsTime || ''}
                  placeholder="0.56 seconds"
                  onChange={(v) => onUpdateSettings('googleResultsTime', v)}
                />
              </>
            )}
            <ToggleRow
              label="Did you mean"
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

        {/* Shared Settings */}
        <SectionDivider label="Advanced" />
        <div className="flex items-center justify-between py-3 gap-3">
          <span className="text-sm font-medium text-stone-900">Max width</span>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={280}
              max={600}
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
      </div>
    </BottomSheet>
  );
};

export default SettingsSheet;
