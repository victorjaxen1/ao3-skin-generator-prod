import React from 'react';
import { SkinSettings } from '../lib/schema';
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
import { resolveTwitterSceneMode } from '../lib/twitter';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  template: 'ios' | 'android' | 'twitter' | 'google';
  settings: SkinSettings;
  messageCount?: number;
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
  messageCount = 0,
  onUpdateSettings,
}) => {
  // The participant add/remove/update handlers moved to CastPanel with the
  // editor they serve. They were duplicated here for iOS and Android; there is
  // one copy now, taking the field as an argument.

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
        {/* Four rows and no section headers. Who is in the conversation — the
            contact photo, group mode, the group name, the participant editor —
            lives in the People panel now, and with what is left a "Display"
            heading over a single toggle organised nothing. */}
        {template === 'ios' && (
          <>
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

            <ToggleRow
              label="Delivery status"
              sublabel={'Shows "Delivered" or "Read" under your last message'}
              checked={settings.iosShowReadReceipt !== false}
              onChange={(v) => onUpdateSettings('iosShowReadReceipt', v)}
            />
          </>
        )}

        {/* Android / WhatsApp Settings */}
        {template === 'android' && (
          <>
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

            {/* A group chat puts the member count where a 1-on-1 shows "online",
                and never reads androidStatusText at all — so in group mode this
                toggle and its text field were live controls over dead settings.
                (iOS has no counterpart worth adding: its group header renders no
                subtitle at all, so there is nothing to hide. Adding a count
                there would change buildHTML for every existing iOS group
                project — logged as a parity item, not done here.) */}
            {!settings.androidGroupMode && (
              <>
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
              </>
            )}
            <ToggleRow
              label="Checkmarks"
              sublabel="The ✓✓ delivery ticks on your messages"
              checked={settings.androidCheckmarks !== false}
              onChange={(v) => onUpdateSettings('androidCheckmarks', v)}
            />
          </>
        )}

        {/* Twitter Settings */}
        {/* Handle, verified badge and profile picture moved to the People
            panel — they are who is posting, not how it looks. */}
        {template === 'twitter' && (
          <>
            <SelectRow
              label="Scene mode"
              value={resolveTwitterSceneMode(settings, messageCount)}
              options={[
                { value: 'single', label: 'Single post' },
                { value: 'timeline', label: 'Timeline' },
                { value: 'thread', label: 'Thread' },
              ]}
              onChange={(v) => onUpdateSettings('twitterSceneMode', v as SkinSettings['twitterSceneMode'])}
            />
            <SelectRow
              label="Theme"
              value={settings.twitterTheme || (settings.twitterDarkMode ? 'dark' : 'light')}
              options={[
                { value: 'light', label: 'Light' },
                { value: 'dim', label: 'Dim' },
                { value: 'dark', label: 'Dark' },
              ]}
              onChange={(v) => onUpdateSettings('twitterTheme', v as SkinSettings['twitterTheme'])}
            />
            <ToggleRow
              label="Show metrics"
              sublabel="Likes, retweets, replies"
              checked={settings.twitterShowMetrics !== false}
              onChange={(v) => onUpdateSettings('twitterShowMetrics', v)}
            />
          </>
        )}

        {/* Google Settings */}
        {template === 'google' && (
          <>
            {/* The "what was searched for is the title at the top" paragraph
                lived here and pointed at a control on a different surface. The
                header's own placeholder already says it, which is where
                somebody about to type is actually looking. */}
            <SectionDivider label="Search" />
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
            label="Fiction label"
            sublabel="Recommended for realistic mockups; removing it can make the image look real"
            checked={settings.fictionLabel !== false}
            onChange={(v) => onUpdateSettings('fictionLabel', v)}
          />
          {settings.fictionLabel !== false && (
            <TextRow
              label="Fiction label text"
              value={settings.fictionLabelText || 'Fictional scene'}
              placeholder="Fictional scene"
              onChange={(v) => onUpdateSettings('fictionLabelText', v)}
            />
          )}
          <ToggleRow
            label="Tool credit"
            sublabel="Optional · adds “Made with AO3 SkinGen” to PNGs"
            checked={settings.toolAttribution === true}
            onChange={(v) => onUpdateSettings('toolAttribution', v)}
          />
        </AdvancedSection>
      </div>
    </BottomSheet>
  );
};

export default SettingsSheet;
