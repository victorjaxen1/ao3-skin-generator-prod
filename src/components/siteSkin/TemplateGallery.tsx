import React, { useState } from 'react';
import { SiteSkinTheme, Mood, MOODS } from '../../lib/siteSkin/theme';
import { TEMPLATES, TEMPLATE_DESCRIPTIONS } from '../../lib/siteSkin/templates';
import { derive } from '../../lib/siteSkin/compile';
import { MoreTools } from '../MoreTools';

interface Props {
  onSelect: (theme: SiteSkinTheme) => void;
  /** Shown when a saved theme exists, so returning users don't start over. */
  onResume?: () => void;
  resumeName?: string;
}

const MOOD_LABELS: Record<Mood, string> = {
  dark: 'Dark',
  light: 'Light',
  minimal: 'Minimal',
  decorative: 'Decorative',
};

/**
 * A small illustration of a theme, not a preview.
 *
 * The honest, compiled-CSS rendering is one click away in the editor; twelve
 * live iframes on a gallery screen would be neither fast nor more truthful at
 * 200 pixels wide. What it does share with the compiler is `derive()` — so the
 * header foreground and card borders here are the same derived colours the
 * export uses, and a card can never advertise a legible header that the real
 * skin does not produce.
 */
const Thumbnail: React.FC<{ theme: SiteSkinTheme }> = ({ theme }) => {
  const d = derive(theme);
  return (
    <div
      className="h-32 rounded-t-xl overflow-hidden flex flex-col"
      style={{ backgroundColor: d.background }}
      aria-hidden="true"
    >
      <div
        className="flex items-center gap-1.5 px-2.5 h-8 flex-shrink-0 text-[10px] font-bold"
        style={{
          backgroundColor: d.accent,
          // The same layer the compiler emits, from the same derived string —
          // ten of the sixteen ship one, and a card showing a flat accent
          // where the editor shows a fade is the drift this thumbnail sharing
          // `derive()` exists to prevent.
          backgroundImage: d.headerGradient || undefined,
          color: d.headerFg,
          fontFamily: theme.typography.headingFont,
          borderBottom: `2px solid ${d.headerDeep}`,
        }}
      >
        <span>Archive</span>
        <span className="ml-auto flex gap-1">
          {[0, 1, 2].map(i => (
            <i
              key={i}
              className="block w-4 h-1 rounded-full"
              style={{ backgroundColor: d.headerFg, opacity: 0.6 }}
            />
          ))}
        </span>
      </div>
      <div className="p-2.5 flex-1">
        <div
          className="p-2 h-full"
          style={{
            backgroundColor: d.surface,
            border: `1px solid ${d.border}`,
            borderRadius: theme.shape.cardRadius,
          }}
        >
          <div
            className="text-[10px] font-semibold truncate"
            style={{ color: d.accent, fontFamily: theme.typography.headingFont }}
          >
            A Study in Lamplight
          </div>
          <div
            className="h-1 rounded mt-1.5"
            style={{ backgroundColor: theme.colors.text, opacity: 0.35, width: '90%' }}
          />
          <div
            className="h-1 rounded mt-1"
            style={{ backgroundColor: theme.colors.text, opacity: 0.35, width: '60%' }}
          />
          <div className="flex gap-1 mt-2">
            {[0, 1, 2].map(i => (
              <span
                key={i}
                className="block h-3 w-8"
                style={{
                  backgroundColor: d.surface,
                  border: `1px solid ${d.tagBorder}`,
                  borderRadius:
                    theme.shape.tagStyle === 'pill'
                      ? '999px'
                      : theme.shape.tagStyle === 'label'
                      ? '3px'
                      : '0px',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export const TemplateGallery: React.FC<Props> = ({ onSelect, onResume, resumeName }) => {
  const [filter, setFilter] = useState<Mood | 'all'>('all');
  const visible = TEMPLATES.filter(t => filter === 'all' || t.meta.moods.includes(filter));

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-5xl mx-auto px-4 py-10 sm:py-14">
        <header className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-stone-900 tracking-tight">
            Make AO3 feel like yours
          </h1>
          <p className="text-stone-500 mt-3 text-sm sm:text-base max-w-md mx-auto leading-relaxed">
            Pick a look, make it yours, then copy it into AO3. No CSS, no account,
            about three minutes.
          </p>
        </header>

        {onResume && resumeName && (
          <div className="mb-8 flex justify-center">
            <button
              type="button"
              onClick={onResume}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-violet-700 bg-violet-50 border border-violet-200 rounded-full hover:bg-violet-100 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
              Keep editing “{resumeName}”
            </button>
          </div>
        )}

        <div className="flex flex-wrap justify-center gap-2 mb-8" role="group" aria-label="Filter templates">
          {(['all', ...MOODS] as const).map(mood => (
            <button
              key={mood}
              type="button"
              aria-pressed={filter === mood}
              onClick={() => setFilter(mood)}
              className={`px-4 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                filter === mood
                  ? 'bg-stone-800 border-stone-800 text-white'
                  : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
              }`}
            >
              {mood === 'all' ? 'All' : MOOD_LABELS[mood]}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map(theme => (
            /* Whole card is the button — no nested interactive elements. */
            <button
              key={theme.meta.id}
              type="button"
              onClick={() => onSelect(theme)}
              className="text-left bg-white border border-stone-200 rounded-xl overflow-hidden hover:border-violet-400 hover:shadow-lg hover:-translate-y-0.5 transition-all focus-visible:ring-2 focus-visible:ring-violet-500"
            >
              <Thumbnail theme={theme} />
              <div className="p-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-stone-900">{theme.meta.name}</h2>
                  <p className="text-xs text-stone-500 mt-0.5 leading-snug">
                    {TEMPLATE_DESCRIPTIONS[theme.meta.id]}
                  </p>
                </div>
                <span className="text-[10px] font-medium text-stone-500 bg-stone-100 rounded-full px-2 py-0.5 flex-shrink-0">
                  {MOOD_LABELS[theme.meta.category]}
                </span>
              </div>
            </button>
          ))}
        </div>

        <p className="text-center text-xs text-stone-400 mt-10">
          Site skins change how AO3 looks for you, in your browser. They don&apos;t
          change what anyone else sees.
        </p>

        <MoreTools placement="site_skin_gallery" />
      </div>
    </div>
  );
};

export default TemplateGallery;
