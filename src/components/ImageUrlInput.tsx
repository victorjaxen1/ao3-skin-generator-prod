/**
 * Shared image-address input.
 *
 * Before this existed the good URL-handling lived only in AvatarSelector:
 * everywhere else you got normalisation and nothing else — no validation, no
 * expiry warning, no sign that your URL had been rewritten, and a file upload
 * that failed in total silence. This is that experience in one place, used by
 * the avatar picker, the compose tray, and per-message editing.
 */

import React, { useEffect, useState } from 'react';
import {
  normalizeImageUrl,
  getExpiringUrlWarning,
  wasNormalized,
  isImageUrl,
} from '../lib/urlNormalize';
import { uploadToImgBB, ImageUploadError } from '../lib/imgbb';

interface Props {
  value: string;
  onChange: (url: string) => void;
  placeholder?: string;
  /** Show the "upload a file instead" button. */
  showUpload?: boolean;
  /** Show a thumbnail of the current image. */
  showPreview?: boolean;
  previewShape?: 'square' | 'circle';
  /** Rendered to the right of the field — e.g. the avatar Presets button. */
  trailing?: React.ReactNode;
  ariaLabel?: string;
  className?: string;
}

const UploadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);

const SpinnerIcon = () => (
  <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" strokeOpacity="0.3" />
    <path d="M12 2a10 10 0 0 1 10 10" />
  </svg>
);

export const ImageUrlInput: React.FC<Props> = ({
  value,
  onChange,
  placeholder = 'Paste an image address…',
  showUpload = true,
  showPreview = true,
  previewShape = 'square',
  trailing,
  ariaLabel = 'Image address',
  className = '',
}) => {
  const [draft, setDraft] = useState(value);
  const [normalizedFrom, setNormalizedFrom] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [loadFailed, setLoadFailed] = useState(false);

  // Keep in step when the value changes from outside (preset picked, message
  // switched, project loaded).
  useEffect(() => {
    setDraft(value);
    setLoadFailed(false);
  }, [value]);

  // The thumbnail is driven by a settled value, not by every keystroke —
  // otherwise typing an address fires a request per character.
  const [previewSrc, setPreviewSrc] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setPreviewSrc(draft.trim()), 400);
    return () => clearTimeout(id);
  }, [draft]);

  // Normalising on every keystroke rewrites URLs mid-type, so it waits for a
  // paste or a blur — the two moments the address is actually complete.
  const commit = (raw: string) => {
    const trimmed = raw.trim();
    const normalized = normalizeImageUrl(trimmed);
    setNormalizedFrom(wasNormalized(trimmed, normalized) ? trimmed : null);
    setDraft(normalized);
    if (normalized !== value) onChange(normalized);
  };

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    setUploadError('');
    try {
      const url = await uploadToImgBB(file);
      setDraft(url);
      setNormalizedFrom(null);
      onChange(url);
    } catch (err) {
      setUploadError(
        err instanceof ImageUploadError
          ? err.userMessage
          : 'Upload failed. You can paste an image address instead.'
      );
    } finally {
      setIsUploading(false);
    }
  };

  const expiringWarning = getExpiringUrlWarning(draft);
  // Only nudge once the address looks finished — mid-typing it never validates.
  const looksUnfinished = draft.trim().length > 0 && !/^https?:\/\/\S+$/i.test(draft.trim());
  const notAnImage =
    draft.trim().length > 0 && !looksUnfinished && !isImageUrl(draft.trim());

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={draft}
          aria-label={ariaLabel}
          onChange={(e) => {
            setDraft(e.target.value);
            onChange(e.target.value.trim());
          }}
          onBlur={(e) => commit(e.target.value)}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData('text');
            if (pasted) {
              e.preventDefault();
              commit(pasted);
            }
          }}
          placeholder={placeholder}
          className="flex-1 min-w-0 text-xs bg-white border border-stone-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
        />

        {showPreview && previewSrc && !loadFailed && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewSrc}
            alt="Preview"
            className={`flex-shrink-0 h-9 w-9 object-cover border border-stone-200 ${
              previewShape === 'circle' ? 'rounded-full' : 'rounded-lg'
            }`}
            onError={() => setLoadFailed(true)}
            onLoad={() => setLoadFailed(false)}
          />
        )}

        {showUpload && (
          <label
            title="Upload an image file"
            aria-label="Upload an image file"
            className={`flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg border border-stone-200 cursor-pointer transition-colors ${
              isUploading
                ? 'bg-violet-100 text-violet-400 cursor-not-allowed'
                : 'bg-stone-50 text-stone-500 hover:bg-violet-50 hover:text-violet-600 hover:border-violet-300'
            }`}
          >
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={isUploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
                e.target.value = '';
              }}
            />
            {isUploading ? <SpinnerIcon /> : <UploadIcon />}
          </label>
        )}

        {draft && (
          <button
            type="button"
            onClick={() => {
              setDraft('');
              setNormalizedFrom(null);
              setUploadError('');
              setLoadFailed(false);
              onChange('');
            }}
            title="Remove image"
            aria-label="Remove image"
            className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg border border-stone-200 bg-stone-50 text-stone-400 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}

        {trailing}
      </div>

      {uploadError && (
        <p role="alert" className="text-xs text-red-600 leading-snug">{uploadError}</p>
      )}

      {normalizedFrom && (
        <p className="text-xs text-green-700 leading-snug">
          ✅ Converted to a direct image link.
        </p>
      )}

      {loadFailed && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 leading-snug">
          This image didn&apos;t load. The site may block other sites from showing
          its images — try saving it and using the upload button instead.
        </p>
      )}

      {!loadFailed && notAnImage && (
        <p className="text-xs text-stone-500 leading-snug">
          This may not be a direct image link. On the image itself, right-click →
          <strong> Copy image address</strong>.
        </p>
      )}

      {expiringWarning && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 leading-snug">
          {expiringWarning}
        </p>
      )}
    </div>
  );
};

export default ImageUrlInput;
