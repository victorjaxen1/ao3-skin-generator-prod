import React, { useState } from 'react';
import { SiteSkinTheme, Mood, MOODS } from '../../lib/siteSkin/theme';
import { TEMPLATES, TEMPLATE_DESCRIPTIONS } from '../../lib/siteSkin/templates';
import { ThemeThumbnail } from './ThemeThumbnail';
import { PaletteFromImage } from './PaletteFromImage';
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

        {/* Above the chips, not below the grid. The premise of the picker is
            the gallery moment itself — a reader who has looked at all sixteen
            and wants none of them — and a panel underneath sixteen cards is a
            panel nobody scrolls to. */}
        <div className="mb-8">
          <PaletteFromImage placement="gallery" onUse={onSelect} />
        </div>

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
              <ThemeThumbnail theme={theme} />
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
