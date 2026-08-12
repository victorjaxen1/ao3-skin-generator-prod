import { UniversalCharacter } from './schema';

export const CHARACTER_STORAGE_KEY = 'ao3skin_universal_characters';
export const MAX_CHARACTER_COUNT = 100;

const MAX_URL_LENGTH = 2048;
const CATEGORIES = new Set(['modern', 'diversity', 'fantasy', 'neutral', 'age-varied']);

function text(value: unknown, limit: number): string {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

export function sanitizeCharacterUrl(value: unknown): string {
  const raw = text(value, MAX_URL_LENGTH);
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? raw : '';
  } catch {
    return raw.startsWith('/assets/') ? raw : '';
  }
}

export function validateCharacter(value: unknown): UniversalCharacter | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const id = text(raw.id, 100);
  const name = text(raw.name, 200);
  if (!id || !name) return null;

  const category = CATEGORIES.has(raw.category as string)
    ? raw.category as UniversalCharacter['category']
    : undefined;
  const usageCount = typeof raw.usageCount === 'number' && Number.isFinite(raw.usageCount)
    ? Math.max(0, Math.min(1_000_000, Math.floor(raw.usageCount)))
    : 0;
  const lastUsed = text(raw.lastUsed, 40);

  return {
    id,
    name,
    usageCount,
    ...(sanitizeCharacterUrl(raw.avatarUrl) ? { avatarUrl: sanitizeCharacterUrl(raw.avatarUrl) } : {}),
    ...(text(raw.twitterHandle, 100) ? { twitterHandle: text(raw.twitterHandle, 100) } : {}),
    ...(text(raw.phoneNumber, 100) ? { phoneNumber: text(raw.phoneNumber, 100) } : {}),
    ...(text(raw.email, 254) ? { email: text(raw.email, 254) } : {}),
    ...(typeof raw.verified === 'boolean' ? { verified: raw.verified } : {}),
    ...(text(raw.bio, 500) ? { bio: text(raw.bio, 500) } : {}),
    ...(category ? { category } : {}),
    ...(lastUsed && !Number.isNaN(Date.parse(lastUsed)) ? { lastUsed: new Date(lastUsed).toISOString() } : {}),
  };
}

export function validateCharacterLibrary(value: unknown): UniversalCharacter[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: UniversalCharacter[] = [];
  for (const candidate of value.slice(0, MAX_CHARACTER_COUNT)) {
    const character = validateCharacter(candidate);
    if (!character || seen.has(character.id)) continue;
    seen.add(character.id);
    result.push(character);
  }
  return result;
}

export function loadCharacterLibrary(): UniversalCharacter[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CHARACTER_STORAGE_KEY);
    return raw && raw.length <= 250_000 ? validateCharacterLibrary(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

export function persistCharacterLibrary(value: UniversalCharacter[]): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(CHARACTER_STORAGE_KEY, JSON.stringify(validateCharacterLibrary(value)));
    return true;
  } catch {
    return false;
  }
}
