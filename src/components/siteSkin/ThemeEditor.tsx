import React from 'react';
import {
  SiteSkinTheme,
  FONT_GROUP_LABELS,
  FontGroup,
  FontRole,
  fontStacksFor,
  FONT_SCALES,
  CARD_RADII,
  TAG_STYLES,
  BANNER_HEIGHTS,
  BANNER_HOST_HINT,
  HEADER_TEXT_COLORS,
  HEADER_GRADIENTS,
  TAG_SEPARATORS,
  PAGE_TEXTURES,
  CARD_ELEVATIONS,
  TagStyle,
  TagSeparator,
  PageTexture,
  CardElevation,
  HeaderTextColor,
  HeaderGradient,
} from '../../lib/siteSkin/theme';
import { ReadabilityIssue } from '../../lib/siteSkin/colors';
import { checkAo3ImageUrl } from '../../lib/siteSkin/ao3Css';
import { normalizeImageUrl } from '../../lib/urlNormalize';
import { ToggleRow, SectionDivider } from '../SettingsRows';

interface Props {
  theme: SiteSkinTheme;
  onChange: <K extends keyof SiteSkinTheme>(key: K, value: SiteSkinTheme[K]) => void;
  issues: ReadabilityIssue[];
  onFix: (issue: ReadabilityIssue) => void;
  /** Opens the Magic Picker. The page owns the dialog and the apply path. */
  onPickFromImage: () => void;
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
            // Named with its group, because the visible word is not unique in
            // this panel: "Soft" is a corner and a depth, "Flat" is a depth and
            // a header fade. Sighted users disambiguate from the row heading;
            // anyone listening to the buttons gets "Soft" twice and no way to
            // tell which is which.
            aria-label={`${label}: ${opt.label}`}
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
 * A font picker that shows you the font.
 *
 * Three decisions here, and each replaces something the plain `SelectRow` could
 * not do once the bank grew from seven stacks to twenty-four:
 *
 * 1. **Native `<select>` with `<optgroup>`.** Grouping twenty-four faces by
 *    shelf is the difference between a list and a wall. It stays a native
 *    control for the same reason `ToggleRow` is a real `role="switch"` — the
 *    keyboard and screen-reader behaviour is correct for free, and a custom
 *    listbox would be a week of getting that back.
 * 2. **Each option is styled in its own stack.** Chrome and Firefox on desktop
 *    render option text in the face it names, which turns the menu into a
 *    specimen sheet. Safari and most mobile browsers ignore it — hence 3.
 * 3. **A specimen line under the control**, which works everywhere. It renders
 *    the same sample the preview would, in the stack you just picked.
 *
 * **The specimen is not a second rendering of the skin** (invariant 3). It is a
 * typeface sample in the control rail; the iframe remains the only thing that
 * renders `compile()`'s output. Note it also renders using *this* machine's
 * fonts, which is exactly why the caveat below the Type group is not optional —
 * a face you can see here may not exist on a reader's device.
 */
const FontRow: React.FC<{
  label: string;
  role: FontRole;
  sample: string;
  value: string;
  onChange: (v: string) => void;
}> = ({ label, role, sample, value, onChange }) => {
  const stacks = fontStacksFor(role);
  const groups = (Object.keys(FONT_GROUP_LABELS) as FontGroup[])
    .map(g => ({ group: g, items: stacks.filter(f => f.group === g) }))
    .filter(g => g.items.length > 0);

  return (
    <div className="py-3">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={`font-${role}`} className="text-sm font-medium text-stone-900">
          {label}
        </label>
        <select
          id={`font-${role}`}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="text-sm text-stone-700 bg-stone-100 border-0 rounded-lg px-3 py-1.5 cursor-pointer focus:ring-2 focus:ring-violet-500 max-w-[190px]"
        >
          {groups.map(({ group, items }) => (
            <optgroup key={group} label={FONT_GROUP_LABELS[group]}>
              {items.map(f => (
                <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                  {f.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      <p
        className="mt-2 text-stone-800 leading-snug truncate"
        style={{ fontFamily: value, fontSize: role === 'heading' ? '1.2rem' : '0.9rem' }}
      >
        {sample}
      </p>
    </div>
  );
};

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
export const ThemeEditor: React.FC<Props> = ({ theme, onChange, issues, onFix, onPickFromImage }) => {
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

      {/* Under the four swatches on purpose: it sets exactly these and nothing
          else, so it belongs beside them rather than in its own group. Four
          colour pickers is the slowest way to describe a look you already have
          a picture of. Undo covers it — see PaletteFromImageDialog. */}
      <div className="py-3">
        <button
          type="button"
          onClick={onPickFromImage}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-violet-700 bg-violet-50 border border-violet-200 rounded-lg hover:bg-violet-100 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
          Take these from a picture or a site
        </button>
      </div>

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
      {/* Headings get every face, including handwriting and display. Body text
          gets serif, sans and monospace only — a script face behind every blurb
          summary and every chapter would make the archive harder to read, which
          is the opposite of what a reading skin is for. The split is in the
          bank itself (`roles`), so the storage boundary enforces it too. */}
      <FontRow
        label="Headings"
        role="heading"
        sample="The Cartographer's Impossible Map"
        value={theme.typography.headingFont}
        onChange={v => onChange('typography', { ...theme.typography, headingFont: v })}
      />
      <FontRow
        label="Body text"
        role="body"
        sample="The map began lying on a Tuesday, which Mara felt was typical of it."
        value={theme.typography.bodyFont}
        onChange={v => onChange('typography', { ...theme.typography, bodyFont: v })}
      />
      <SegmentRow
        label="Text size"
        value={theme.typography.baseFontScale}
        options={FONT_SCALES}
        onChange={v => onChange('typography', { ...theme.typography, baseFontScale: v })}
      />
      {/* The honesty line, and it is load-bearing rather than a disclaimer.
          AO3 rejects @font-face, so we can never send a reader a font file —
          a font-family is a suggestion their device either can or cannot
          honour. The specimens above render with the fonts on THIS machine,
          so without this sentence the picker quietly over-promises. */}
      <p className="text-xs text-stone-400 py-3 leading-relaxed">
        AO3 doesn&apos;t allow skins to supply font files, so a font only appears for
        readers whose device already has it. Each choice lists several
        alternatives and ends in a safe fallback, so everyone sees something
        close.
      </p>

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
      {/* First in the group on purpose. This is the header you get without
          finding an image, hosting it anywhere, or hoping the host outlives
          the skin — it is two literal colours the theme already implies. The
          banner below is the bring-your-own option; we ship no images. */}
      <SegmentRow
        label="Header fade"
        value={theme.header.gradient}
        options={HEADER_GRADIENTS}
        onChange={(v: HeaderGradient) => onChange('header', { ...theme.header, gradient: v })}
      />
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

      <SectionDivider label="Depth" />
      {/* The image-free half of what a decorative skin does. Every popular
          skin in the corpus tiles a hosted wallpaper; we cannot ship one and
          will not host one, so the pattern is built from two colours the theme
          already has. Stripes are not roses — but at page scale they do most
          of what a wallpaper does, for zero bytes and no host to expire. */}
      <SegmentRow
        label="Page pattern"
        value={theme.surface.texture}
        options={PAGE_TEXTURES}
        onChange={(v: PageTexture) => onChange('surface', { ...theme.surface, texture: v })}
      />
      <SegmentRow
        label="Card depth"
        value={theme.surface.elevation}
        options={CARD_ELEVATIONS}
        onChange={(v: CardElevation) => onChange('surface', { ...theme.surface, elevation: v })}
      />
      <ToggleRow
        label="Glow"
        sublabel="A halo on headings and cards — made for dark themes"
        checked={theme.surface.glow}
        onChange={v => onChange('surface', { ...theme.surface, glow: v })}
      />
      <p className="text-xs text-stone-400 py-3 leading-relaxed">
        The pattern is drawn from your Page colour, so it can&apos;t clash with
        the palette. It costs nothing to load and can never break — unlike the
        hosted wallpapers most decorative skins rely on.
      </p>

      <SectionDivider label="Reading" />
      {/* The one control here that makes AO3 easier to use rather than nicer
          to look at. The words are already in AO3's markup — it hides them and
          paints an icon over the top — so this un-hides them rather than
          inventing anything, which is why the sublabel says "show" and not
          "replace". Visible in the Browse preview. */}
      <ToggleRow
        label="Required tags as words"
        sublabel="Rating, warnings, category and status spelled out instead of icons"
        checked={theme.reading.requiredTagsAsText}
        onChange={v => onChange('reading', { ...theme.reading, requiredTagsAsText: v })}
      />
      {/* AO3 marks each tag with its group's class and prints the group's name
          nowhere, so a listing is one undifferentiated run of tags. This is the
          label the work page already gives you, moved to the listing. */}
      <ToggleRow
        label="Name each tag group"
        sublabel={'"Relationships:", "Characters:" before the tags they belong to'}
        checked={theme.reading.tagLabels}
        onChange={v => onChange('reading', { ...theme.reading, tagLabels: v })}
      />
      <SegmentRow
        label="Tag separator"
        value={theme.reading.tagSeparator}
        options={TAG_SEPARATORS}
        onChange={(v: TagSeparator) =>
          onChange('reading', { ...theme.reading, tagSeparator: v })
        }
      />
      {/* The label is hidden the way AO3 hides its own — clipped, not removed —
          so a screen reader still says "Kudos" and only the pixels go. The
          sublabel says which labels stay, because "Published: 2026-08-06"
          losing its word is the version of this control that reads as a bug. */}
      <ToggleRow
        label="Stats as icons"
        sublabel="Words, kudos and hits get a symbol; language and dates keep their labels"
        checked={theme.reading.statIcons}
        onChange={v => onChange('reading', { ...theme.reading, statIcons: v })}
      />
      <p className="text-xs text-stone-400 py-3 leading-relaxed">
        All four appear in the Browse preview. "One group per line" is easiest
        to read on a work with many tags, and it pairs with the group names.
      </p>

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
