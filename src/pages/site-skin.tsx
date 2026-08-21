import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AO3_RULESET } from '../lib/ao3Compatibility';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { SiteSkinTheme } from '../lib/siteSkin/theme';
import { cloneTheme, DEFAULT_TEMPLATE, findTemplate } from '../lib/siteSkin/templates';
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
import { PaletteFromImageDialog } from '../components/siteSkin/PaletteFromImage';
import { SkinPreview } from '../components/siteSkin/SkinPreview';
import { ExportSkinDialog } from '../components/siteSkin/ExportSkinDialog';
import { ModalDialog } from '../components/ModalDialog';
import { SiteSkinToolbar } from '../components/siteSkin/SiteSkinToolbar';
import {
  EDITOR_SECTION_IDS,
  EditorSectionId,
  MobilePane,
  PreviewMode,
} from '../components/siteSkin/uiTypes';
import { ProductHead } from '../components/ProductHead';
import { openPrivacyChoices, trackAnalytics } from '../lib/analytics';
import { isSiteSkinActivated, markActivatedOnce, siteSkinBaseline } from '../lib/activation';

const MAX_HISTORY = 50;

function isEditableTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;
  return element.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName);
}

function resetBaselineFor(theme: SiteSkinTheme): SiteSkinTheme {
  return cloneTheme(findTemplate(theme.meta.id) || theme);
}

/**
 * The site skin builder: gallery ⇄ editor, on one route.
 *
 * A second product inside the same app, sharing the shell and nothing else.
 * It has its own theme type, its own storage key and its own compiler; the
 * conversation generator's project, settings and render path are not involved
 * anywhere on this page.
 */
export default function SiteSkinPage() {
  const router = useRouter();
  const [theme, setTheme] = useState<SiteSkinTheme>(() => cloneTheme(DEFAULT_TEMPLATE));
  const [isLoaded, setIsLoaded] = useState(false);
  const [showGallery, setShowGallery] = useState(true);
  const [hasSaved, setHasSaved] = useState(false);
  const [previewState, setPreviewState] = useState<PreviewState>('browse');
  const [showExport, setShowExport] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [mobilePane, setMobilePane] = useState<MobilePane>('preview');
  const [previewMode, setPreviewMode] = useState<PreviewMode>('showcase');
  const [openSections, setOpenSections] = useState<Set<EditorSectionId>>(
    () => new Set(['colors'])
  );
  const [pendingTemplate, setPendingTemplate] = useState<SiteSkinTheme | null>(null);
  const [cameFromEditor, setCameFromEditor] = useState(false);
  const [resetBaseline, setResetBaseline] = useState<SiteSkinTheme | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'failed'>('saved');
  const [saveError, setSaveError] = useState('');

  const [history, setHistory] = useState<SiteSkinTheme[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const historyIndexRef = useRef(-1);

  // The template as it was chosen, so a value the author never touched is never
  // counted as their work (§5.2).
  const activationRef = useRef<string | null>(null);
  const resetBaselineRef = useRef<SiteSkinTheme | null>(null);

  // ── Mount ───────────────────────────────────────────────────────────────
  // `?template=<id>` opens the editor straight onto that template, matching
  // how the conversation generator handles the same parameter. It is what the
  // examples gallery links to, so a card lands you on the thing you clicked
  // rather than on a gallery you have to search again.
  useEffect(() => {
    if (!router.isReady) return;

    const stored = hasStoredTheme();
    let templateId = (router.query.template as string) || '';
    if (!templateId && typeof window !== 'undefined') {
      templateId = new URLSearchParams(window.location.search).get('template') || '';
    }

    const linked = templateId ? findTemplate(templateId) : undefined;
    const initial = linked
      ? cloneTheme(linked)
      : stored
      ? loadStoredTheme()
      : cloneTheme(DEFAULT_TEMPLATE);

    activationRef.current = siteSkinBaseline(initial);
    const baseline = resetBaselineFor(initial);
    resetBaselineRef.current = baseline;
    setResetBaseline(baseline);
    setTheme(initial);
    setHistory([initial]);
    historyIndexRef.current = 0;
    setHistoryIndex(0);
    setHasSaved(stored);
    // An unrecognised id falls through to the gallery rather than to a silent
    // default — a stale link should look like a wrong turn, not like a choice
    // that was made for you.
    if (linked) setShowGallery(false);
    setIsLoaded(true);
  }, [router.isReady, router.query]);

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

      // A changed value has already been previewed by the time it exists —
      // ThemeEditor and SkinPreview are the same screen — so the changed test
      // is the whole of §5.2's site-skin definition.
      const baseline = activationRef.current;
      if (baseline && isSiteSkinActivated(theme, baseline) && markActivatedOnce(`site-skin:${theme.meta.id}`)) {
        trackAnalytics({ name: 'project_activated', templateId: theme.meta.id });
      }

      setHistory(prev => {
        const index = historyIndexRef.current;
        const current = prev[index];
        if (current && JSON.stringify(current) === JSON.stringify(theme)) return prev;

        const next = prev.slice(0, index + 1);
        next.push(theme);
        if (next.length > MAX_HISTORY) next.shift();
        historyIndexRef.current = next.length - 1;
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
  const modifiedSections = useMemo(() => {
    if (!resetBaseline) return new Set<EditorSectionId>();
    return new Set(EDITOR_SECTION_IDS.filter(id => (
      JSON.stringify(theme[id]) !== JSON.stringify(resetBaseline[id])
    )));
  }, [resetBaseline, theme]);

  useEffect(() => {
    if (!issues.length) return;
    setOpenSections(previous => {
      if (previous.has('colors')) return previous;
      const next = new Set(previous);
      next.add('colors');
      return next;
    });
  }, [issues.length]);

  // ── Handlers ────────────────────────────────────────────────────────────
  const updateTheme = useCallback(
    <K extends keyof SiteSkinTheme>(key: K, value: SiteSkinTheme[K]) => {
      setTheme(prev => ({ ...prev, [key]: value }));
    },
    []
  );

  const toggleSection = useCallback((id: EditorSectionId) => {
    setOpenSections(previous => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const resetSection = useCallback((id: EditorSectionId) => {
    const baseline = resetBaselineRef.current;
    if (!baseline) return;
    updateTheme(id, { ...baseline[id] });
  }, [updateTheme]);

  const applyTemplate = useCallback((template: SiteSkinTheme) => {
    const fresh = cloneTheme(template);
    activationRef.current = siteSkinBaseline(fresh);
    const baseline = resetBaselineFor(fresh);
    resetBaselineRef.current = baseline;
    setResetBaseline(baseline);
    setTheme(fresh);
    setHistory([fresh]);
    historyIndexRef.current = 0;
    setHistoryIndex(0);
    setMobilePane('preview');
    setOpenSections(new Set(['colors']));
    setShowGallery(false);
    setCameFromEditor(false);
    setPendingTemplate(null);
    trackAnalytics({ name: 'template_selected', templateId: template.meta.id });
  }, []);

  const requestTemplate = useCallback((template: SiteSkinTheme) => {
    if (hasSaved || cameFromEditor) {
      setPendingTemplate(template);
      return;
    }
    applyTemplate(template);
  }, [applyTemplate, cameFromEditor, hasSaved]);

  const handleOpenExport = () => {
    if (violations.length > 0) {
      trackAnalytics({ name: 'export_failed', outputType: 'site_skin', errorCode: 'CSS_VALIDATION_BLOCKED' });
    } else {
      trackAnalytics({ name: 'export_started', outputType: 'site_skin', templateId: theme.meta.id });
      trackAnalytics({ name: 'export_ready', outputType: 'site_skin', templateId: theme.meta.id });
    }
    setShowExport(true);
  };

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

  /**
   * The picker's editor path: take the colours, leave everything else.
   *
   * The gallery path adopts the generated theme wholesale through
   * `handleSelectTemplate`, because there the user has no theme yet. Here they
   * do, and its fonts, corners, tag style and details are their work — a colour
   * picker that silently reset the typography would be the §5.2 problem in
   * reverse. The header fields ride along only when the picker actually set a
   * banner, which it does only for an address AO3 accepts.
   *
   * No confirmation and no safety backup: this writes four hex strings and lands
   * on the history stack, so Ctrl+Z is the whole escape hatch.
   */
  const applyExtractedTheme = useCallback((extracted: SiteSkinTheme) => {
    setTheme(prev => ({
      ...prev,
      colors: { ...extracted.colors },
      header: extracted.header.bannerUrl
        ? { ...prev.header, ...extracted.header }
        : prev.header,
    }));
  }, []);

  const undo = useCallback(() => {
    const index = historyIndexRef.current;
    if (index <= 0) return;
    historyIndexRef.current = index - 1;
    setHistoryIndex(index - 1);
    setTheme(history[index - 1]);
  }, [history]);

  const redo = useCallback(() => {
    const index = historyIndexRef.current;
    if (index >= history.length - 1) return;
    historyIndexRef.current = index + 1;
    setHistoryIndex(index + 1);
    setTheme(history[index + 1]);
  }, [history]);

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && key === 'z') {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && ((e.shiftKey && key === 'z') || key === 'y')) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [undo, redo]);

  const head = (
    <ProductHead
      title="AO3 Site Skin Maker — AO3 SkinGen"
      description="Pick a look, personalise it, and copy a site skin checked against bundled AO3 compatibility rules. No CSS knowledge or account required."
      path="/site-skin"
    />
  );

  // Hold the first paint until storage has been read, so a returning visitor
  // doesn't see the gallery flash past before it's dismissed.
  if (!isLoaded) {
    return <>{head}<div className="min-h-screen bg-stone-50" aria-busy="true"><h1 className="sr-only">AO3 Site Skin Maker</h1></div></>;
  }

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
            onRequestSelect={requestTemplate}
            onResume={hasSaved ? () => {
              setMobilePane('preview');
              setShowGallery(false);
            } : undefined}
            resumeName={hasSaved ? theme.meta.name : undefined}
          />
        </div>
        <ModalDialog
          isOpen={pendingTemplate !== null}
          onClose={() => setPendingTemplate(null)}
          labelledBy="replace-site-skin-title"
          maxWidthClass="max-w-md"
        >
          <div className="p-5 sm:p-6">
            <h2 id="replace-site-skin-title" className="text-lg font-semibold text-stone-900">
              Start over with {pendingTemplate?.meta.name}?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-stone-600">
              This replaces the theme currently saved in this browser. Your AO3 skin is not
              affected until you paste and use new CSS there.
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setPendingTemplate(null)}
                className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50"
              >
                Keep current theme
              </button>
              <button
                type="button"
                data-autofocus
                onClick={() => pendingTemplate && applyTemplate(pendingTemplate)}
                className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800"
              >
                Start with {pendingTemplate?.meta.name}
              </button>
            </div>
          </div>
        </ModalDialog>
      </>
    );
  }

  return (
    <>
      {head}
      <div className="flex h-screen h-[100dvh] flex-col overflow-hidden bg-stone-50 font-sans">
        <SiteSkinToolbar
          themeName={theme.meta.name}
          violations={violations.length}
          reviewedOn={AO3_RULESET.reviewedOn}
          saveStatus={saveStatus}
          canUndo={historyIndex > 0}
          canRedo={historyIndex < history.length - 1}
          mobilePane={mobilePane}
          onShowTemplates={() => {
            setCameFromEditor(true);
            setShowGallery(true);
          }}
          onUndo={undo}
          onRedo={redo}
          onOpenPrivacy={openPrivacyChoices}
          onInstall={handleOpenExport}
          onMobilePaneChange={setMobilePane}
        />

        {saveStatus === 'failed' && saveError && (
          <div role="alert" className="bg-amber-50 border-b border-amber-200 px-4 py-2">
            <p className="text-xs text-amber-900 max-w-screen-xl mx-auto">{saveError}</p>
          </div>
        )}

        {/* ─── Editor + preview ────────────────────────────────────────── */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
          <div
            data-testid="site-skin-customize-pane"
            className={`${mobilePane === 'customize' ? 'flex' : 'hidden'} min-h-0 w-full flex-1 flex-col overflow-y-auto bg-white px-4 lg:flex lg:w-[340px] lg:flex-none lg:border-r lg:border-stone-200`}
            style={{ paddingBottom: 'calc(1.5rem + var(--analytics-consent-h, 0px))' }}
          >
            <ThemeEditor
              theme={theme}
              onChange={updateTheme}
              issues={issues}
              onFix={handleFix}
              onPickFromImage={() => setShowPicker(true)}
              openSections={openSections}
              modifiedSections={modifiedSections}
              onToggleSection={toggleSection}
              onResetSection={resetSection}
            />
          </div>

          <div
            data-testid="site-skin-preview-pane"
            className={`${mobilePane === 'preview' ? 'flex' : 'hidden'} min-h-0 flex-1 flex-col lg:flex`}
          >
            <SkinPreview
              css={css}
              state={previewState}
              mode={previewMode}
              onStateChange={setPreviewState}
              onModeChange={setPreviewMode}
            />
          </div>
        </div>
      </div>

      <PaletteFromImageDialog
        isOpen={showPicker}
        onClose={() => setShowPicker(false)}
        onUse={applyExtractedTheme}
      />

      <ExportSkinDialog
        isOpen={showExport}
        onClose={() => setShowExport(false)}
        css={css}
        themeName={theme.meta.name}
        templateId={theme.meta.id}
        violations={violations}
        theme={theme}
        onReplaceTheme={(nextTheme) => {
          const fresh = cloneTheme(nextTheme);
          activationRef.current = siteSkinBaseline(fresh);
          const baseline = resetBaselineFor(fresh);
          resetBaselineRef.current = baseline;
          setResetBaseline(baseline);
          setTheme(fresh);
          setHistory([fresh]);
          historyIndexRef.current = 0;
          setHistoryIndex(0);
          setHasSaved(true);
          setMobilePane('preview');
          setOpenSections(new Set(['colors']));
          setShowGallery(false);
        }}
      />
    </>
  );
}
