import React, { useRef, useState } from 'react';
import { SkinProject, UniversalCharacter } from '../lib/schema';
import {
  parseProjectFile,
  ProjectFileError,
  ProjectFileSummary,
  PROJECT_FILE_MAX_BYTES,
  SceneProjectFileV1,
  summarizeProjectFile,
} from '../lib/projectFile';
import { trackAnalytics } from '../lib/analytics';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onDownloadCurrent: (suffix?: string) => boolean;
  onReplace: (project: SkinProject, characters: UniversalCharacter[]) => void;
}

export const ProjectBackupDialog: React.FC<Props> = ({
  isOpen,
  onClose,
  onDownloadCurrent,
  onReplace,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [candidate, setCandidate] = useState<SceneProjectFileV1 | null>(null);
  const [summary, setSummary] = useState<ProjectFileSummary | null>(null);
  const [error, setError] = useState('');
  const [downloaded, setDownloaded] = useState(false);

  if (!isOpen) return null;

  const downloadCurrent = () => {
    const ok = onDownloadCurrent();
    setDownloaded(ok);
    setError(ok ? '' : 'Your browser could not start the backup download.');
  };

  const chooseFile = async (file: File | undefined) => {
    setCandidate(null);
    setSummary(null);
    setError('');
    if (!file) return;
    if (file.size > PROJECT_FILE_MAX_BYTES) {
      setError('That backup is larger than the 2 MB import limit.');
      return;
    }
    try {
      const parsed = parseProjectFile(await file.text());
      setCandidate(parsed);
      setSummary(summarizeProjectFile(parsed));
    } catch (cause) {
      const message = cause instanceof ProjectFileError ? cause.message : 'That backup could not be read.';
      setError(message);
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const replace = () => {
    if (!candidate) return;
    if (!onDownloadCurrent('before-import')) {
      setError('The safety backup could not be downloaded, so the current project was not replaced.');
      return;
    }
    onReplace(candidate.project, candidate.characterLibrary);
    trackAnalytics({ name: 'project_backup_imported', schemaVersion: candidate.schemaVersion });
    setCandidate(null);
    setSummary(null);
    setError('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black bg-opacity-60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Project backup"
      onClick={onClose}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl" onClick={event => event.stopPropagation()}>
        <div className="flex items-center justify-between bg-stone-900 px-5 py-4 text-white">
          <div>
            <h3 className="text-sm font-semibold">Project backup</h3>
            <p className="mt-0.5 text-xs text-stone-400">Local JSON file · no account or upload</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-2xl font-bold leading-none">×</button>
        </div>

        <div className="space-y-4 p-5">
          <section className="rounded-xl border border-stone-200 p-4">
            <h4 className="text-sm font-semibold text-stone-900">Keep a recoverable copy</h4>
            <p className="mt-1 text-xs leading-relaxed text-stone-500">
              Includes this scene and your character library. The file stays on your device.
            </p>
            <button type="button" onClick={downloadCurrent} className="mt-3 w-full rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700">
              {downloaded ? '✓ Backup downloaded' : 'Download project backup'}
            </button>
          </section>

          <section className="rounded-xl border border-stone-200 p-4">
            <h4 className="text-sm font-semibold text-stone-900">Restore a backup</h4>
            <p className="mt-1 text-xs leading-relaxed text-stone-500">
              Import is replace-only. You will see a summary before anything changes, and the current project is downloaded first.
            </p>
            <label className="mt-3 block cursor-pointer rounded-xl border border-dashed border-stone-300 bg-stone-50 px-4 py-3 text-center text-sm font-semibold text-stone-700 hover:border-violet-400 hover:bg-violet-50">
              Choose backup file
              <input
                ref={inputRef}
                type="file"
                accept=".json,application/json"
                className="sr-only"
                onChange={event => void chooseFile(event.target.files?.[0])}
              />
            </label>
          </section>

          {summary && candidate && (
            <section className="rounded-xl border border-amber-200 bg-amber-50 p-4" aria-label="Backup preview">
              <h4 className="text-sm font-semibold text-amber-950">Replace with this project?</h4>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-amber-900">
                <dt>Platform</dt><dd className="font-semibold text-right">{summary.template}</dd>
                <dt>{summary.itemLabel === 'results' ? 'Results' : 'Messages'}</dt><dd className="font-semibold text-right">{summary.itemCount}</dd>
                <dt>Characters</dt><dd className="font-semibold text-right">{summary.characterCount}</dd>
                <dt>Exported</dt><dd className="font-semibold text-right">{new Date(summary.exportedAt).toLocaleString()}</dd>
                <dt>Remote images</dt><dd className="font-semibold text-right">{summary.hasRemoteImages ? 'Yes' : 'No'}</dd>
              </dl>
              {summary.hasRemoteImages && (
                <p className="mt-2 text-[11px] leading-relaxed text-amber-800">
                  Remote image references are links, not image copies. They still depend on their hosts.
                </p>
              )}
              <div className="mt-3 flex flex-col gap-2 sm:flex-row-reverse">
                <button type="button" onClick={replace} className="rounded-xl bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-800">
                  Replace current project
                </button>
                <button type="button" onClick={() => { setCandidate(null); setSummary(null); }} className="rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-sm font-semibold text-amber-900">
                  Cancel import
                </button>
              </div>
            </section>
          )}

          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        </div>
      </div>
    </div>
  );
};

export default ProjectBackupDialog;
