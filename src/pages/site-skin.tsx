import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { SiteSkinTheme } from '../lib/siteSkin/theme';
import { cloneTheme, DEFAULT_TEMPLATE } from '../lib/siteSkin/templates';
import { compile } from '../lib/siteSkin/compile';
import { lintAo3Css } from '../lib/siteSkin/ao3Css';
import {
  bestTextColor,
  fixAccent,
  findReadabilityIssues,
  ReadabilityIssue,
} from '../lib/siteSkin/colors';
import { PreviewState } from '../lib/siteSkin/mockPage';
import { hasStoredTheme, loadStoredTheme, persistTheme } from '../lib/siteSkin/storage';
import { TemplateGallery } from '../components/siteSkin/TemplateGallery';
import { ThemeEditor } from '../components/siteSkin/ThemeEditor';
import { SkinPreview } from '../components/siteSkin/SkinPreview';
import { ExportSkinDialog } from '../components/siteSkin/ExportSkinDialog';

const MAX_HISTORY = 50;

/**
 * The site skin builder: gallery ⇄ editor, on one route.
 *
 * A second product inside the same app, sharing the shell and nothing else.
 * It has its own theme type, its own storage key and its own compiler; the
 * conversation generator's project, settings and render path are not involved
 * anywhere on this page.
 */
export default function SiteSkinPage() {
  const [theme, setTheme] = useState<SiteSkinTheme>(() => cloneTheme(DEFAULT_TEMPLATE));
  const [isLoaded, setIsLoaded] = useState(false);
  const [showGallery, setShowGallery] = useState(true);
  const [hasSaved, setHasSaved] = useState(false);
  const [previewState, setPreviewState] = useState<PreviewState>('browse');
  const [showExport, setShowExport] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'failed'>('saved');
  const [saveError, setSaveError] = useState('');

  const [history, setHistory] = useState<SiteSkinTheme[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // ── Mount ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const stored = hasStoredTheme();
    const initial = stored ? loadStoredTheme() : cloneTheme(DEFAULT_TEMPLATE);
    setTheme(initial);
    setHistory([initial]);
    setHistoryIndex(0);
    setHasSaved(stored);
    setIsLoaded(true);
  }, []);

  // ── Persist + history ───────────────────────────────────────────────────
  // Same discipline as the generator: debounce, then report a refused save
  // rather than logging it somewhere nobody looks.
  useEffect(() => {
    if (!isLoaded || showGallery) return;
    setSaveStatus('saving');
    const timer = setTimeout(() => {
      const result = persistTheme(theme);
      setSaveStatus(result.ok ? 'saved' : 'failed');
      setSaveError(result.ok ? '' : result.message || '');
      if (result.ok) setHasSaved(true);

      setHistory(prev => {
        if (prev.length && JSON.stringify(prev[prev.length - 1]) === JSON.stringify(theme)) {
          return prev;
        }
        const next = [...prev, theme];
        if (next.length > MAX_HISTORY) next.shift();
        setHistoryIndex(next.length - 1);
        return next;
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [theme, isLoaded, showGallery]);

  // ── Derived ─────────────────────────────────────────────────────────────
  // One compile. The preview renders this exact string, and the export dialog
  // copies this exact string — there is no second path that could disagree.
  const css = useMemo(() => compile(theme), [theme]);
  const violations = useMemo(() => lintAo3Css(css), [css]);
  const issues = useMemo(() => findReadabilityIssues(theme.colors), [theme.colors]);

  // ── Handlers ────────────────────────────────────────────────────────────
  const updateTheme = useCallback(
    <K extends keyof SiteSkinTheme>(key: K, value: SiteSkinTheme[K]) => {
      setTheme(prev => ({ ...prev, [key]: value }));
    },
    []
  );

  const handleSelectTemplate = useCallback((template: SiteSkinTheme) => {
    const fresh = cloneTheme(template);
    setTheme(fresh);
    setHistory([fresh]);
    setHistoryIndex(0);
    setShowGallery(false);
  }, []);

  const handleFix = useCallback((issue: ReadabilityIssue) => {
    setTheme(prev => {
      if (issue.id === 'text') {
        return {
          ...prev,
          colors: { ...prev.colors, text: bestTextColor(prev.colors.background, prev.colors.surface) },
        };
      }
      return {
        ...prev,
        colors: {
          ...prev.colors,
          accent: fixAccent(prev.colors.accent, prev.colors.background, prev.colors.surface),
        },
      };
    });
  }, []);

  const undo = useCallback(() => {
    setHistoryIndex(i => {
      if (i <= 0) return i;
      setTheme(history[i - 1]);
      return i - 1;
    });
  }, [history]);

  const redo = useCallback(() => {
    setHistoryIndex(i => {
      if (i >= history.length - 1) return i;
      setTheme(history[i + 1]);
      return i + 1;
    });
  }, [history]);

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showExport) setShowExport(false);
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [showExport, undo, redo]);

  // Hold the first paint until storage has been read, so a returning visitor
  // doesn't see the gallery flash past before it's dismissed.
  if (!isLoaded) {
    return <div className="min-h-screen bg-stone-50" aria-busy="true" />;
  }

  const head = (
    <Head>
      <title>AO3 Site Skin Maker — AO3 SkinGen</title>
      <meta
        name="description"
        content="Pick a look, personalise it, and copy an AO3-safe site skin. No CSS, no account."
      />
    </Head>
  );

  if (showGallery) {
    return (
      <>
        {head}
        <div className="relative">
          <Link
            href="/"
            className="absolute top-4 left-4 z-10 text-xs font-medium text-stone-500 hover:text-stone-800"
          >
            ← All tools
          </Link>
          <TemplateGallery
            onSelect={handleSelectTemplate}
            onResume={hasSaved ? () => setShowGallery(false) : undefined}
            resumeName={hasSaved ? theme.meta.name : undefined}
          />
        </div>
      </>
    );
  }

  return (
    <>
      {head}
      <div className="flex flex-col h-screen bg-stone-50 font-sans">
        {/* ─── Top bar ─────────────────────────────────────────────────── */}
        <header className="flex items-center gap-3 px-3 sm:px-4 py-2.5 bg-white border-b border-stone-200 flex-shrink-0">
          <button
            type="button"
            onClick={() => setShowGallery(true)}
            className="flex items-center gap-1.5 text-sm font-medium text-stone-600 hover:text-stone-900"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            <span className="hidden sm:inline">Templates</span>
          </button>

          <span className="text-sm font-semibold text-stone-900 truncate">
            {theme.meta.name}
          </span>

          {/* AO3-safe is the sanitizer question and nothing else. Contrast
              lives beside the colour controls — see plan §9. */}
          <span
            role="status"
            className={`text-[11px] font-medium px-2 py-1 rounded-full border flex-shrink-0 ${
              violations.length === 0
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {violations.length === 0 ? 'AO3-safe' : `${violations.length} blocked`}
          </span>

          <span className="ml-auto flex items-center gap-2">
            {saveStatus === 'saving' && (
              <span className="text-[11px] text-stone-400 hidden sm:inline">Saving…</span>
            )}
            <button
              type="button"
              onClick={() => setShowExport(true)}
              className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition-colors"
            >
              Copy to AO3
            </button>
          </span>
        </header>

        {saveStatus === 'failed' && saveError && (
          <div role="alert" className="bg-amber-50 border-b border-amber-200 px-4 py-2">
            <p className="text-xs text-amber-900 max-w-screen-xl mx-auto">{saveError}</p>
          </div>
        )}

        {/* ─── Editor + preview ────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
          <div className="w-full lg:w-[340px] flex-shrink-0 overflow-y-auto bg-white lg:border-r border-stone-200 px-4 pb-6 order-2 lg:order-1">
            <ThemeEditor theme={theme} onChange={updateTheme} issues={issues} onFix={handleFix} />
          </div>

          <div className="flex-1 min-h-[45vh] lg:min-h-0 order-1 lg:order-2 flex flex-col">
            <SkinPreview css={css} state={previewState} onStateChange={setPreviewState} />
          </div>
        </div>
      </div>

      <ExportSkinDialog
        isOpen={showExport}
        onClose={() => setShowExport(false)}
        css={css}
        themeName={theme.meta.name}
        violations={violations}
      />
    </>
  );
}
