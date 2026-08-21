import React, { useState } from 'react';
import { SiteSkinTheme, Mood, MOODS } from '../../lib/siteSkin/theme';
import { TEMPLATES, TEMPLATE_DESCRIPTIONS } from '../../lib/siteSkin/templates';
import { ThemeThumbnail } from './ThemeThumbnail';
import { PaletteFromImageDialog } from './PaletteFromImage';
import { MoreTools } from '../MoreTools';

interface Props {
  onRequestSelect: (theme: SiteSkinTheme) => void;
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

export const TemplateGallery: React.FC<Props> = ({ onRequestSelect, onResume, resumeName }) => {
  const [filter, setFilter] = useState<Mood | 'all'>('all');
  const [showPicker, setShowPicker] = useState(false);
  const visible = TEMPLATES.filter(t => filter === 'all' || t.meta.moods.includes(filter));

  return (
    <div className="min-h-screen bg-stone-50" style={{ paddingBottom: 'var(--analytics-consent-h, 0px)' }}>
      <div className="max-w-5xl mx-auto px-4 py-10 sm:py-12">
        {onResume && resumeName && (
          <div className="mb-4 flex justify-end">
            <button
              type="button"
              onClick={onResume}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-violet-700 bg-violet-50 border border-violet-200 rounded-full hover:bg-violet-100 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
              Continue “{resumeName}”
            </button>
          </div>
        )}

        <header className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-stone-900 tracking-tight">
            Turn a picture or website into your AO3 theme
          </h1>
          <p className="text-stone-500 mt-3 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
            Magic Picker builds light and dark site skins from its colours, ready to
            preview, personalise and paste into AO3. No CSS.
          </p>
        </header>

        <section
          aria-labelledby="magic-picker-heading"
          className="mb-10 overflow-hidden rounded-3xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 shadow-sm"
        >
          <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-violet-600">
                Magic Picker
              </p>
              <h2 id="magic-picker-heading" className="text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
                Paste one link. Get two AO3-ready themes.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-stone-600 sm:text-base">
                Use a link to a picture, poster, screenshot or website. Magic Picker
                extracts the palette, protects readability, and builds light and dark
                versions you can preview and edit.
              </p>
              <button
                type="button"
                onClick={() => setShowPicker(true)}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-violet-700 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 sm:w-auto"
              >
                <span aria-hidden="true">✦</span>
                Open Magic Picker
              </button>
              <p className="mt-3 text-xs leading-relaxed text-stone-500">
                It recreates the colour mood, not the source&apos;s layout. Adding the
                source image as an AO3 header is always optional.
              </p>
            </div>

            <div
              aria-label="A picture or website becomes a light theme and a dark theme"
              className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-violet-100 bg-white/80 p-5 sm:flex-row"
            >
              <div className="w-36 rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
                <div className="flex h-20 items-end rounded-lg bg-gradient-to-br from-fuchsia-300 via-violet-400 to-slate-800 p-2">
                  <div className="flex gap-1" aria-hidden="true">
                    <span className="h-3 w-3 rounded-full bg-fuchsia-200 ring-1 ring-white/70" />
                    <span className="h-3 w-3 rounded-full bg-violet-500 ring-1 ring-white/70" />
                    <span className="h-3 w-3 rounded-full bg-slate-800 ring-1 ring-white/70" />
                  </div>
                </div>
                <p className="mt-2 text-center text-[11px] font-semibold text-stone-600">
                  Your picture or site
                </p>
              </div>

              <span className="text-2xl font-semibold text-violet-400" aria-hidden="true">
                <span className="sm:hidden">↓</span><span className="hidden sm:inline">→</span>
              </span>

              <div className="grid grid-cols-2 gap-2" aria-hidden="true">
                <div className="w-28 overflow-hidden rounded-lg border border-violet-200 bg-violet-50 shadow-sm">
                  <div className="flex h-6 items-center justify-between bg-violet-600 px-2 text-[8px] font-bold text-white">
                    <span>Archive</span><span>•••</span>
                  </div>
                  <div className="m-2 rounded-md border border-violet-100 bg-white p-2">
                    <div className="h-1.5 w-12 rounded bg-violet-500" />
                    <div className="mt-2 h-1 w-full rounded bg-stone-300" />
                    <div className="mt-1 h-1 w-8 rounded bg-stone-200" />
                  </div>
                  <p className="pb-2 text-center text-[9px] font-bold text-violet-700">Light</p>
                </div>
                <div className="w-28 overflow-hidden rounded-lg border border-slate-700 bg-slate-950 shadow-sm">
                  <div className="flex h-6 items-center justify-between bg-violet-700 px-2 text-[8px] font-bold text-white">
                    <span>Archive</span><span>•••</span>
                  </div>
                  <div className="m-2 rounded-md border border-slate-700 bg-slate-900 p-2">
                    <div className="h-1.5 w-12 rounded bg-fuchsia-300" />
                    <div className="mt-2 h-1 w-full rounded bg-slate-600" />
                    <div className="mt-1 h-1 w-8 rounded bg-slate-700" />
                  </div>
                  <p className="pb-2 text-center text-[9px] font-bold text-fuchsia-200">Dark</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="mb-5">
          <h2 className="text-lg font-semibold text-stone-900">Or choose a template</h2>
          <p className="mt-1 text-xs text-stone-500">
            Start from one of sixteen finished looks and change anything you like.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 mb-5" role="group" aria-label="Filter templates">
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
              onClick={() => onRequestSelect(theme)}
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

        <MoreTools placement="site_skin_gallery_shelf" variant="shelf" />
      </div>

      <PaletteFromImageDialog
        isOpen={showPicker}
        onClose={() => setShowPicker(false)}
        placement="gallery"
        onUse={onRequestSelect}
      />
    </div>
  );
};

export default TemplateGallery;
