import React from 'react';
import {
  SiteSkinTheme,
  FONT_STACKS,
  FONT_SCALES,
  CARD_RADII,
  TAG_STYLES,
  BANNER_HEIGHTS,
  BANNER_HOST_HINT,
  HEADER_TEXT_COLORS,
  TagStyle,
  HeaderTextColor,
} from '../../lib/siteSkin/theme';
import { ReadabilityIssue } from '../../lib/siteSkin/colors';
import { checkAo3ImageUrl } from '../../lib/siteSkin/ao3Css';
import { normalizeImageUrl } from '../../lib/urlNormalize';
import { SelectRow, ToggleRow, SectionDivider } from '../SettingsRows';

interface Props {
  theme: SiteSkinTheme;
  onChange: <K extends keyof SiteSkinTheme>(key: K, value: SiteSkinTheme[K]) => void;
  issues: ReadabilityIssue[];
  onFix: (issue: ReadabilityIssue) => void;
}

const COLOR_LABELS: { key: keyof SiteSkinTheme['colors']; label: string; hint: string }[] = [
  { key: 'background', label: 'Page', hint: 'Behind everything' },
  { key: 'surface', label: 'Cards', hint: 'Work listings, sidebar, chapter' },
  { key: 'accent', label: 'Accent', hint: 'Header, links, tags, headings' },
  { key: 'text', label: 'Text', hint: 'Body copy' },
];

/** A colour swatch that is also its own label — no CSS vocabulary anywhere. */
const ColorRow: React.FC<{
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
}> = ({ label, hint, value, onChange }) => (
  <div className="flex items-center justify-between py-3 gap-3">
    <div className="min-w-0">
      <span className="text-sm font-medium text-stone-900">{label}</span>
      <p className="text-xs text-stone-500 mt-0.5 truncate">{hint}</p>
    </div>
    <label className="flex items-center gap-2 flex-shrink-0 cursor-pointer">
      <span className="text-[11px] font-mono text-stone-400 uppercase">{value}</span>
      <input
        type="color"
        value={value}
        aria-label={label}
        onChange={e => onChange(e.target.value)}
        className="w-9 h-9 rounded-lg cursor-pointer border border-stone-200 bg-white p-0.5"
      />
    </label>
  </div>
);

/** A small set of named choices, shown as one row of buttons. */
function SegmentRow<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="py-3">
      <span className="text-sm font-medium text-stone-900 block mb-2">{label}</span>
      <div className="flex gap-1" role="group" aria-label={label}>
        {options.map(opt => (
          <button
            key={String(opt.value)}
            type="button"
            aria-pressed={value === opt.value}
            onClick={() => onChange(opt.value)}
            className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              value === opt.value
                ? 'bg-violet-600 border-violet-600 text-white'
                : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * The banner address.
 *
 * The only free-text field in the editor, and the only one that can be refused
 * by AO3 — so it is validated as you type, against the same rule the export
 * gate uses. AO3's own error for a bad address is "your skin could not be
 * saved", after you have already left this app, pasted, and hit submit. Saying
 * "Discord links won't work, use imgur" *here* is the entire point of the
 * field being ours rather than a Pastebin.
 *
 * We run the pasted address through `normalizeImageUrl` first — the same
 * helper the conversation generator uses — because an imgur *page* link is
 * what people copy, and it is one rewrite away from being valid.
 */
const BannerRow: React.FC<{
  value: string;
  onChange: (v: string) => void;
}> = ({ value, onChange }) => {
  const verdict = checkAo3ImageUrl(value);
  const showProblem = value.trim().length > 0 && !verdict.ok;

  return (
    <div className="py-3">
      <label htmlFor="banner-url" className="text-sm font-medium text-stone-900 block">
        Banner image
      </label>
      <p className="text-xs text-stone-500 mt-0.5 mb-2">
        Paste a direct image address to put a picture behind the header.
      </p>
      <input
        id="banner-url"
        type="url"
        inputMode="url"
        value={value}
        placeholder="https://i.imgur.com/yourimage.png"
        onChange={e => onChange(normalizeImageUrl(e.target.value))}
        className={`w-full text-xs text-stone-700 bg-stone-100 border rounded-lg px-3 py-2 focus:ring-2 focus:ring-violet-500 ${
          showProblem ? 'border-amber-400' : 'border-transparent'
        }`}
      />

      {showProblem ? (
        <div role="status" className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
          <p className="text-xs font-semibold text-amber-900">{verdict.problem}</p>
          <p className="text-xs text-amber-800 mt-1 leading-relaxed">{verdict.fix}</p>
        </div>
      ) : (
        <p className="text-[11px] text-stone-400 mt-1.5 leading-relaxed">
          {value.trim() ? 'AO3 will accept this address.' : BANNER_HOST_HINT}
        </p>
      )}
    </div>
  );
};

/**
 * The five control groups: Colours, Type, Shape, Header, Details.
 *
 * Readability warnings live here, beside the colour controls that cause them —
 * not in the top bar next to the AO3-safe indicator. The two are unrelated
 * questions (plan §9): a low-contrast skin saves on AO3 perfectly well, and a
 * beautifully legible one can still use a property AO3 refuses. Putting the
 * readability warning next to its cause also means the fix button is next to
 * the control the user would otherwise reach for.
 */
export const ThemeEditor: React.FC<Props> = ({ theme, onChange, issues, onFix }) => {
  const setColor = (key: keyof SiteSkinTheme['colors'], value: string) =>
    onChange('colors', { ...theme.colors, [key]: value });

  return (
    <div className="divide-y divide-stone-100">
      <SectionDivider label="Colours" />
      {COLOR_LABELS.map(({ key, label, hint }) => (
        <ColorRow
          key={key}
          label={label}
          hint={hint}
          value={theme.colors[key]}
          onChange={v => setColor(key, v)}
        />
      ))}

      {issues.length > 0 && (
        <div className="py-3 space-y-2">
          {issues.map(issue => (
            <div
              key={issue.id}
              role="status"
              className="bg-amber-50 border border-amber-200 rounded-xl p-3"
            >
              <p className="text-xs text-amber-900 leading-relaxed">{issue.message}</p>
              <button
                type="button"
                onClick={() => onFix(issue)}
                className="mt-2 text-xs font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-700"
              >
                {issue.fixLabel}
              </button>
            </div>
          ))}
        </div>
      )}

      <SectionDivider label="Type" />
      <SelectRow
        label="Headings"
        value={theme.typography.headingFont}
        options={FONT_STACKS.map(f => ({ value: f.value, label: f.label }))}
        onChange={v => onChange('typography', { ...theme.typography, headingFont: v })}
      />
      <SelectRow
        label="Body text"
        value={theme.typography.bodyFont}
        options={FONT_STACKS.map(f => ({ value: f.value, label: f.label }))}
        onChange={v => onChange('typography', { ...theme.typography, bodyFont: v })}
      />
      <SegmentRow
        label="Text size"
        value={theme.typography.baseFontScale}
        options={FONT_SCALES}
        onChange={v => onChange('typography', { ...theme.typography, baseFontScale: v })}
      />

      <SectionDivider label="Shape" />
      <SegmentRow
        label="Card corners"
        value={theme.shape.cardRadius}
        options={CARD_RADII}
        onChange={v => onChange('shape', { ...theme.shape, cardRadius: v })}
      />
      <SegmentRow
        label="Tag shape"
        value={theme.shape.tagStyle}
        options={TAG_STYLES}
        onChange={(v: TagStyle) => onChange('shape', { ...theme.shape, tagStyle: v })}
      />
      {/* Semantic, not decorative: the colour says what kind of tag it is
          before you read it. The four hues are derived from the accent, so
          this stays one theme rather than becoming four. */}
      <ToggleRow
        label="Colour tags by type"
        sublabel="Warnings, relationships, characters and extra tags each get their own shade"
        checked={theme.shape.tagColors}
        onChange={v => onChange('shape', { ...theme.shape, tagColors: v })}
      />

      <SectionDivider label="Header" />
      <BannerRow
        value={theme.header.bannerUrl}
        onChange={v => onChange('header', { ...theme.header, bannerUrl: v })}
      />
      {theme.header.bannerUrl.trim() && (
        <>
          <SegmentRow
            label="Banner height"
            value={theme.header.bannerHeight}
            options={BANNER_HEIGHTS}
            onChange={v => onChange('header', { ...theme.header, bannerHeight: v })}
          />
          {/* Offered only with a banner, because only then is it a judgement
              call. On a flat header "Auto" is not a guess — it is derived from
              the accent and guaranteed to contrast. Over an image we cannot
              measure the brightness, so the person looking at it decides. */}
          <SegmentRow
            label="Header text"
            value={theme.header.textColor}
            options={HEADER_TEXT_COLORS}
            onChange={(v: HeaderTextColor) =>
              onChange('header', { ...theme.header, textColor: v })
            }
          />
          {/* Only offered alongside a banner. On a flat header the text colour
              is already derived to contrast with it, so a glow is just noise —
              and a control with no visible effect is one we said we wouldn't
              ship. */}
          <ToggleRow
            label="Glow behind header text"
            sublabel="Keeps the title readable over a busy picture"
            checked={theme.header.textShadow}
            onChange={v => onChange('header', { ...theme.header, textShadow: v })}
          />
        </>
      )}
      <ToggleRow
        label="Hide AO3's logo"
        sublabel="Removes the roundel next to the site title"
        checked={theme.header.hideLogo}
        onChange={v => onChange('header', { ...theme.header, hideLogo: v })}
      />

      <SectionDivider label="Details" />
      <ToggleRow
        label="Decorative divider"
        sublabel="Replaces the line between scenes with an ornament"
        checked={theme.details.divider}
        onChange={v => onChange('details', { ...theme.details, divider: v })}
      />
      <ToggleRow
        label="Drop cap"
        sublabel="A large first letter at the start of each chapter"
        checked={theme.details.dropCap}
        onChange={v => onChange('details', { ...theme.details, dropCap: v })}
      />
      <ToggleRow
        label="Themed scrollbar"
        sublabel="Chrome and Edge only — Firefox and Safari keep their own"
        checked={theme.details.scrollbar}
        onChange={v => onChange('details', { ...theme.details, scrollbar: v })}
      />
      <p className="text-xs text-stone-400 py-3 leading-relaxed">
        The divider and drop cap appear in the Reading preview. They affect
        chapter text only — not summaries or notes.
      </p>
    </div>
  );
};

export default ThemeEditor;
