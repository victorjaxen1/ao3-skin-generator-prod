import React, { useState } from 'react';
import { Violation } from '../../lib/siteSkin/ao3Css';
import { SiteSkinTheme } from '../../lib/siteSkin/theme';
import { parseSiteThemeFile, ProjectFileError, PROJECT_FILE_MAX_BYTES, serializeSiteThemeFile } from '../../lib/projectFile';
import { downloadTextFile, safeFilenamePart } from '../../lib/download';
import { AO3_RULESET_STATUS } from '../../lib/ao3Compatibility';
import { trackAnalytics } from '../../lib/analytics';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  css: string;
  themeName: string;
  templateId: string;
  /** Non-empty means the skin will not save on AO3. Blocks copy. */
  violations: Violation[];
  theme: SiteSkinTheme;
  onReplaceTheme: (theme: SiteSkinTheme) => void;
}

const STEPS: { title: string; body: React.ReactNode }[] = [
  {
    title: 'Copy your skin',
    body: <>The button below copies the whole stylesheet. You never need to read or edit it.</>,
  },
  {
    title: "Open AO3's skin editor",
    body: (
      <>
        On AO3, go to <strong className="text-stone-800">Preferences → Skins → Create Site Skin</strong>.
      </>
    ),
  },
  {
    title: 'Paste it into the CSS box, and give it a title',
    body: (
      <>
        Leave <strong className="text-stone-800">Type</strong> on “Site Skin” and{' '}
        <strong className="text-stone-800">“add on to archive skin”</strong>. The other
        option strips AO3&apos;s own layout, and this skin is built to sit on top of it.
      </>
    ),
  },
  {
    title: 'Submit, then choose “Use”',
    body: <>AO3 checks the CSS when you submit. Preview it before you switch it on.</>,
  },
];

/**
 * Copy + instructions, in the shape of ExportPanel's code modal — a textarea,
 * a copy button, and the guidance folded underneath.
 *
 * The safety indicator is not decorative. AO3 does not silently drop a
 * property it dislikes; it refuses the entire skin and shows an error. So the
 * one place a lint failure must never be a soft warning is here, at the moment
 * the user is about to paste. Copy is disabled while violations exist.
 *
 * Note this is the *sanitizer* question only. Contrast warnings live beside the
 * colour controls and never reach this dialog — see plan §9.
 */
export const ExportSkinDialog: React.FC<Props> = ({
  isOpen,
  onClose,
  css,
  themeName,
  templateId,
  violations,
  theme,
  onReplaceTheme,
}) => {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [importCandidate, setImportCandidate] = useState<{ theme: SiteSkinTheme; exportedAt: string } | null>(null);

  if (!isOpen) return null;

  const blocked = violations.length > 0;

  const downloadThemeBackup = (suffix = '') => {
    const filename = `ao3skingen-site-theme-${safeFilenamePart(theme.meta.name)}${suffix ? `-${safeFilenamePart(suffix)}` : ''}.json`;
    const ok = downloadTextFile(serializeSiteThemeFile(theme), filename);
    setError(ok ? '' : 'Your browser could not start the theme backup download.');
    if (ok) trackAnalytics({ name: 'project_backup_exported', schemaVersion: 1 });
    return ok;
  };

  const selectThemeFile = async (file: File | undefined) => {
    setImportCandidate(null);
    setError('');
    if (!file) return;
    if (file.size > PROJECT_FILE_MAX_BYTES) {
      setError('That backup is larger than the 2 MB import limit.');
      return;
    }
    try {
      const parsed = parseSiteThemeFile(await file.text());
      setImportCandidate({ theme: parsed.theme, exportedAt: parsed.exportedAt });
    } catch (cause) {
      setError(cause instanceof ProjectFileError ? cause.message : 'That theme backup could not be read.');
    }
  };

  const replaceTheme = () => {
    if (!importCandidate) return;
    if (!downloadThemeBackup('before-import')) {
      setError('The safety backup could not be downloaded, so the current theme was not replaced.');
      return;
    }
    onReplaceTheme(importCandidate.theme);
    trackAnalytics({ name: 'project_backup_imported', schemaVersion: 1 });
    setImportCandidate(null);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(css);
      setCopied(true);
      setError('');
      setTimeout(() => setCopied(false), 2500);
      trackAnalytics({ name: 'output_copied', outputType: 'site_skin', part: 'css' });
      trackAnalytics({ name: 'handoff_completed', outputType: 'site_skin', templateId });
    } catch {
      // Clipboard is blocked in plenty of ordinary situations. The textarea
      // above is already selectable, so say that rather than just failing.
      setError('Your browser blocked the clipboard. Select the CSS above and copy it manually.');
      trackAnalytics({ name: 'export_failed', outputType: 'site_skin', errorCode: 'CLIPBOARD_DENIED' });
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Copy your site skin"
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-stone-900 text-white px-5 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-sm font-semibold">Your site skin is ready</h3>
            <p className="text-xs text-stone-400 mt-0.5">{themeName}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-white hover:text-stone-300 text-2xl font-bold leading-none ml-4"
          >
            ×
          </button>

          <section className="mt-5 rounded-xl border border-stone-200 p-4">
            <h4 className="text-sm font-semibold text-stone-900">Theme backup</h4>
            <p className="mt-1 text-xs leading-relaxed text-stone-500">Download or restore this editable theme locally. It is separate from scene-project backups.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={() => downloadThemeBackup()} className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50">
                Download theme backup
              </button>
              <label className="cursor-pointer rounded-lg border border-stone-300 bg-white px-3 py-2 text-center text-xs font-semibold text-stone-700 hover:bg-stone-50">
                Restore theme backup
                <input type="file" accept=".json,application/json" className="sr-only" onChange={event => { void selectThemeFile(event.target.files?.[0]); event.currentTarget.value = ''; }} />
              </label>
            </div>
            {importCandidate && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <p><strong>{importCandidate.theme.meta.name}</strong></p>
                <p className="mt-1">Exported {new Date(importCandidate.exportedAt).toLocaleString()} · Banner link {importCandidate.theme.header.bannerUrl ? 'included' : 'not included'}</p>
                <p className="mt-1 text-[11px]">Replacing downloads the current theme first. No merge is performed.</p>
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={replaceTheme} className="rounded-lg bg-amber-700 px-3 py-2 font-semibold text-white">Replace current theme</button>
                  <button type="button" onClick={() => setImportCandidate(null)} className="rounded-lg border border-amber-300 bg-white px-3 py-2 font-semibold">Cancel</button>
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="p-5 overflow-y-auto">
          {blocked ? (
            <div role="alert" className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
              <p className="text-sm font-semibold text-red-900">
                AO3 would refuse this skin
              </p>
              <p className="text-xs text-red-800 mt-1 leading-relaxed">
                AO3 rejects a whole skin when it meets CSS it does not allow, so copying
                this would waste your time. This is a bug in the generator, not something
                you did — please report it.
              </p>
              <ul className="mt-2 space-y-1">
                {violations.slice(0, 5).map((v, i) => (
                  <li key={i} className="text-[11px] font-mono text-red-700">
                    {v.subject}: {v.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4 flex items-start gap-2">
              <span className="text-green-600 font-bold">✓</span>
              <div>
                <p className="text-sm font-semibold text-green-900">{AO3_RULESET_STATUS}</p>
                <p className="text-xs text-green-800 mt-0.5">
                  The generated CSS passes this app&apos;s reviewed compatibility rules.
                </p>
              </div>
            </div>
          )}

          <textarea
            readOnly
            value={css}
            rows={10}
            aria-label="Site skin CSS"
            className="w-full font-mono text-xs bg-gray-950 text-green-400 border border-gray-700 rounded-lg p-3 resize-none focus:outline-none"
            onClick={e => (e.target as HTMLTextAreaElement).select()}
          />

          <button
            onClick={handleCopy}
            disabled={blocked}
            className={`w-full mt-4 py-3 rounded-xl font-semibold text-sm transition-all ${
              blocked
                ? 'bg-stone-100 text-stone-400 cursor-not-allowed'
                : copied
                ? 'bg-green-500 text-white'
                : 'bg-violet-600 text-white hover:bg-violet-700'
            }`}
          >
            {copied ? '✓ Copied' : 'Copy site skin CSS'}
          </button>

          {error && (
            <p role="alert" className="text-xs text-amber-800 mt-2 text-center">
              {error}
            </p>
          )}

          <ol className="mt-5 space-y-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-stone-100 text-stone-600 text-xs font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <div>
                  <strong className="text-sm text-stone-900 block">{step.title}</strong>
                  <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <p className="text-[11px] text-stone-400 mt-5 text-center leading-relaxed">
            Unofficial. Not affiliated with the Organization for Transformative Works.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ExportSkinDialog;
