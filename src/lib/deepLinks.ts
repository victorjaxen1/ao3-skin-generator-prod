import type { SkinProject } from './schema';

export type BlankPlatform = SkinProject['template'];

const BLANK_PLATFORMS = new Set<BlankPlatform>(['ios', 'android', 'twitter', 'google']);

export function parseBlankPlatform(value: string | string[] | undefined): BlankPlatform | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && BLANK_PLATFORMS.has(candidate as BlankPlatform)
    ? candidate as BlankPlatform
    : null;
}
