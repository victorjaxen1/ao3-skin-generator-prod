import { Attachment, ImageLayoutChoice } from './schema';

export type ResolvedImageLayout = 'single' | 'stack' | 'pair' | 'hero-top' | 'hero-side' | 'grid';
export type ImageSplitBucket = '33-67' | '40-60' | '50-50' | '60-40' | '67-33';

export interface ImageSplit {
  bucket: ImageSplitBucket;
  first: number;
  second: number;
}

export interface ImageLayoutPlan {
  layout: ResolvedImageLayout;
  /** Pair rows, or the outer columns for hero-side. */
  splits: ImageSplit[];
  source: 'manual' | 'dimensions' | 'fallback';
}

const SPLITS: readonly ImageSplit[] = [
  { bucket: '33-67', first: 33, second: 67 },
  { bucket: '40-60', first: 40, second: 60 },
  { bucket: '50-50', first: 50, second: 50 },
  { bucket: '60-40', first: 60, second: 40 },
  { bucket: '67-33', first: 67, second: 33 },
] as const;

const EVEN_SPLIT = SPLITS[2];

export const IMAGE_LAYOUT_LABELS: Readonly<Record<ImageLayoutChoice | ResolvedImageLayout, string>> = {
  auto: 'Automatic',
  single: 'Full width',
  stack: 'Stacked',
  pair: 'Side by side',
  'hero-top': 'Feature above',
  'hero-side': 'Feature beside',
  grid: 'Balanced grid',
};

function aspect(attachment: Attachment | undefined): number | null {
  const width = attachment?.intrinsicWidth;
  const height = attachment?.intrinsicHeight;
  if (!Number.isFinite(width) || !Number.isFinite(height) || !width || !height || width <= 0 || height <= 0) return null;
  return Math.max(0.1, Math.min(10, width / height));
}

function nearestSplit(share: number, clamp: boolean): ImageSplit | null {
  if (!Number.isFinite(share)) return null;
  if (!clamp && (share < 0.33 || share > 0.67)) return null;
  const percent = Math.max(33, Math.min(67, share * 100));
  return SPLITS.reduce((best, candidate) =>
    Math.abs(candidate.first - percent) < Math.abs(best.first - percent) ? candidate : best
  );
}

function pairSplit(first: Attachment | undefined, second: Attachment | undefined, clamp = false): ImageSplit | null {
  const a = aspect(first);
  const b = aspect(second);
  if (a === null || b === null) return null;
  return nearestSplit(a / (a + b), clamp);
}

function heroSideSplit(attachments: Attachment[], clamp = false): ImageSplit | null {
  const first = aspect(attachments[0]);
  const second = aspect(attachments[1]);
  const third = aspect(attachments[2]);
  if (first === null || second === null || third === null) return null;
  const stackedHeightFactor = (1 / second) + (1 / third);
  return nearestSplit((first * stackedHeightFactor) / (1 + first * stackedHeightFactor), clamp);
}

export function imageLayoutChoices(count: number): ImageLayoutChoice[] {
  if (count === 2) return ['auto', 'pair', 'stack'];
  if (count === 3) return ['auto', 'hero-side', 'hero-top', 'stack'];
  if (count >= 4) return ['auto', 'grid', 'stack'];
  return ['auto'];
}

export function normalizeImageLayoutChoice(choice: ImageLayoutChoice | undefined, count: number): ImageLayoutChoice {
  const selected = choice || 'auto';
  return imageLayoutChoices(count).includes(selected) ? selected : 'auto';
}

function manualPlan(attachments: Attachment[], choice: Exclude<ImageLayoutChoice, 'auto'>): ImageLayoutPlan {
  if (choice === 'stack') return { layout: 'stack', splits: [], source: 'manual' };
  if (choice === 'pair') {
    return { layout: 'pair', splits: [pairSplit(attachments[0], attachments[1], true) || EVEN_SPLIT], source: 'manual' };
  }
  if (choice === 'hero-side') {
    return { layout: 'hero-side', splits: [heroSideSplit(attachments, true) || SPLITS[4]], source: 'manual' };
  }
  if (choice === 'hero-top') {
    return { layout: 'hero-top', splits: [pairSplit(attachments[1], attachments[2], true) || EVEN_SPLIT], source: 'manual' };
  }
  return {
    layout: 'grid',
    splits: [
      pairSplit(attachments[0], attachments[1], true) || EVEN_SPLIT,
      pairSplit(attachments[2], attachments[3], true) || EVEN_SPLIT,
    ],
    source: 'manual',
  };
}

/**
 * Resolve one-to-four attachments into a finite, AO3-safe composition.
 *
 * Automatic never changes attachment order and never asks a cell to occupy less
 * than one third of a row. Missing dimensions retain the app's established
 * count-based arrangements until the preview has measured every image.
 */
export function resolveImageLayout(
  input: Attachment[] | undefined,
  requested?: ImageLayoutChoice,
): ImageLayoutPlan {
  const attachments = (input || []).filter(attachment => attachment.type === 'image' && attachment.url.trim()).slice(0, 4);
  const count = attachments.length;
  if (count <= 1) return { layout: 'single', splits: [], source: requested && requested !== 'auto' ? 'manual' : 'fallback' };

  const choice = normalizeImageLayoutChoice(requested, count);
  if (choice !== 'auto') return manualPlan(attachments, choice);

  const hasEveryDimension = attachments.every(attachment => aspect(attachment) !== null);
  if (!hasEveryDimension) {
    if (count === 2) return { layout: 'pair', splits: [EVEN_SPLIT], source: 'fallback' };
    if (count === 3) return { layout: 'hero-side', splits: [SPLITS[4]], source: 'fallback' };
    return { layout: 'grid', splits: [EVEN_SPLIT, EVEN_SPLIT], source: 'fallback' };
  }

  if (count === 2) {
    const split = pairSplit(attachments[0], attachments[1]);
    return split
      ? { layout: 'pair', splits: [split], source: 'dimensions' }
      : { layout: 'stack', splits: [], source: 'dimensions' };
  }

  if (count === 3) {
    const columns = heroSideSplit(attachments);
    if (columns) return { layout: 'hero-side', splits: [columns], source: 'dimensions' };
    const lowerRow = pairSplit(attachments[1], attachments[2]);
    return lowerRow
      ? { layout: 'hero-top', splits: [lowerRow], source: 'dimensions' }
      : { layout: 'stack', splits: [], source: 'dimensions' };
  }

  const firstRow = pairSplit(attachments[0], attachments[1]);
  const secondRow = pairSplit(attachments[2], attachments[3]);
  return firstRow && secondRow
    ? { layout: 'grid', splits: [firstRow, secondRow], source: 'dimensions' }
    : { layout: 'stack', splits: [], source: 'dimensions' };
}
