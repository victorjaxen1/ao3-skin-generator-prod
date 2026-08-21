import React from 'react';
import { Attachment, ImageLayoutChoice } from '../lib/schema';
import {
  IMAGE_LAYOUT_LABELS,
  imageLayoutChoices,
  normalizeImageLayoutChoice,
  resolveImageLayout,
} from '../lib/imageLayout';
import ImageUrlInput from './ImageUrlInput';

interface Props {
  attachments: Attachment[];
  imageLayout?: ImageLayoutChoice;
  onChange: (value: { attachments: Attachment[]; imageLayout?: ImageLayoutChoice }) => void;
  label?: string;
  idPrefix: string;
  intro?: React.ReactNode;
}

const inputClass = 'w-full rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-xs disabled:bg-stone-100';

function shapeLabel(attachment: Attachment): string | null {
  const width = attachment.intrinsicWidth;
  const height = attachment.intrinsicHeight;
  if (!width || !height) return null;
  const ratio = width / height;
  const shape = ratio >= 1.15 ? 'Landscape' : ratio <= 0.87 ? 'Portrait' : 'Square';
  return `${shape} · ${width} × ${height}`;
}

export default function MultiImageEditor({
  attachments,
  imageLayout,
  onChange,
  label = 'Image',
  idPrefix,
  intro,
}: Props) {
  const count = attachments.length;
  const selectedLayout = normalizeImageLayoutChoice(imageLayout, count);
  // Blank slots still need a predictable count-based layout while the author is
  // entering their addresses. The renderer itself ignores blank URLs.
  const planningAttachments = attachments.map((attachment, index) => ({
    ...attachment,
    url: attachment.url.trim() || `pending-image-${index + 1}`,
  }));
  const plan = resolveImageLayout(planningAttachments, selectedLayout);

  const commit = (next: Attachment[], requested = selectedLayout) => {
    const normalized = normalizeImageLayoutChoice(requested, next.length);
    onChange({ attachments: next, imageLayout: normalized === 'auto' ? undefined : normalized });
  };

  const update = (index: number, updates: Partial<Attachment>) => {
    commit(attachments.map((attachment, itemIndex) => itemIndex === index ? { ...attachment, ...updates } : attachment));
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= attachments.length || from === to) return;
    const next = [...attachments];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    commit(next);
  };

  const waitingForSizes = planningAttachments.some(attachment => !attachment.intrinsicWidth || !attachment.intrinsicHeight);

  return (
    <div className="space-y-3">
      {intro}

      {count >= 2 && (
        <div className="rounded-lg border border-violet-100 bg-violet-50/60 p-2.5">
          <label htmlFor={`${idPrefix}-image-layout`} className="block text-xs font-semibold text-stone-700">Layout</label>
          <select
            id={`${idPrefix}-image-layout`}
            aria-label={`${label} layout`}
            value={selectedLayout}
            onChange={event => commit(attachments, event.target.value as ImageLayoutChoice)}
            className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-xs focus:ring-2 focus:ring-violet-500"
          >
            {imageLayoutChoices(count).map(choice => (
              <option key={choice} value={choice}>
                {choice === 'auto'
                  ? `Automatic — ${waitingForSizes ? 'waiting for image sizes' : IMAGE_LAYOUT_LABELS[plan.layout]}`
                  : IMAGE_LAYOUT_LABELS[choice]}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] leading-relaxed text-stone-500" aria-live="polite">
            {selectedLayout === 'auto'
              ? waitingForSizes
                ? `Using the familiar ${IMAGE_LAYOUT_LABELS[plan.layout].toLowerCase()} arrangement until every image size is available.`
                : `Chosen from the loaded image shapes: ${IMAGE_LAYOUT_LABELS[plan.layout].toLowerCase()}.`
              : 'Manual layout. Reordering images does not change it.'}
          </p>
        </div>
      )}

      {attachments.map((attachment, index) => {
        const shape = shapeLabel(attachment);
        return (
          <div key={`${idPrefix}-image-${index}`} className="space-y-2 rounded-lg border border-stone-200 bg-stone-50 p-2">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="block text-xs font-medium text-stone-700">{label} {index + 1}</span>
                {shape && <span className="block truncate text-[10px] text-stone-500">{shape}</span>}
              </div>
              <div className="flex flex-wrap justify-end gap-1">
                {index > 0 && (
                  <button type="button" onClick={() => move(index, 0)} className="rounded px-1.5 py-1 text-[11px] font-medium text-violet-700">
                    Make primary
                  </button>
                )}
                <button type="button" disabled={index === 0} onClick={() => move(index, index - 1)} aria-label={`Move ${label.toLowerCase()} ${index + 1} earlier`} className="rounded px-1.5 py-1 text-xs text-stone-600 disabled:text-stone-300">↑</button>
                <button type="button" disabled={index === attachments.length - 1} onClick={() => move(index, index + 1)} aria-label={`Move ${label.toLowerCase()} ${index + 1} later`} className="rounded px-1.5 py-1 text-xs text-stone-600 disabled:text-stone-300">↓</button>
                <button type="button" onClick={() => commit(attachments.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove ${label.toLowerCase()} ${index + 1}`} className="rounded px-1.5 py-1 text-xs text-red-600">Remove</button>
              </div>
            </div>
            <ImageUrlInput
              value={attachment.url}
              onChange={url => update(index, { url, intrinsicWidth: undefined, intrinsicHeight: undefined })}
              onMetadata={({ src, width, height }) => {
                if (src.trim() !== attachment.url.trim()) return;
                if (attachment.intrinsicWidth === width && attachment.intrinsicHeight === height) return;
                update(index, { intrinsicWidth: width, intrinsicHeight: height });
              }}
              previewFit="contain"
              ariaLabel={`${label} ${index + 1} address`}
              placeholder="Paste an image address"
            />
            <input
              value={attachment.alt || ''}
              onChange={event => update(index, { alt: event.target.value })}
              disabled={attachment.decorative === true}
              maxLength={500}
              aria-label={`${label} ${index + 1} description`}
              placeholder="Describe this image for readers"
              className={inputClass}
            />
            <label className="flex items-center gap-2 text-xs text-stone-600">
              <input
                type="checkbox"
                checked={attachment.decorative === true}
                onChange={event => update(index, { decorative: event.target.checked, ...(event.target.checked ? { alt: '' } : {}) })}
                className="accent-violet-600"
              />
              Decorative image — use empty alt text
            </label>
          </div>
        );
      })}

      {count < 4 && (
        <button
          type="button"
          onClick={() => commit([...attachments, { type: 'image', url: '', alt: '' }])}
          className="w-full rounded-lg border border-dashed border-violet-300 px-3 py-2 text-xs font-medium text-violet-700"
        >
          Add {label.toLowerCase()}
        </button>
      )}
    </div>
  );
}
