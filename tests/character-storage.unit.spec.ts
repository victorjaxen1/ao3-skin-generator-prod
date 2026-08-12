import { expect, test } from '@playwright/test';
import { MAX_CHARACTER_COUNT, validateCharacterLibrary } from '../src/lib/characterStorage';

test('character-library validation caps count, lengths, URLs, and duplicate IDs', () => {
  const raw = Array.from({ length: MAX_CHARACTER_COUNT + 10 }, (_, index) => ({
    id: index === 1 ? '0' : String(index),
    name: `Character ${index}`.repeat(30),
    avatarUrl: index === 2 ? 'javascript:alert(1)' : `https://example.com/${index}.png`,
    usageCount: index,
    lastUsed: '2026-08-12T00:00:00.000Z',
    unknown: 'ignored',
  }));
  const characters = validateCharacterLibrary(raw);
  expect(characters.length).toBe(MAX_CHARACTER_COUNT - 1);
  expect(characters[0].name.length).toBeLessThanOrEqual(200);
  expect(characters.find(character => character.id === '2')?.avatarUrl).toBeUndefined();
  expect((characters[0] as any).unknown).toBeUndefined();
  expect(characters[0].usageCount).toBe(0);
  expect(characters[0].lastUsed).toBe('2026-08-12T00:00:00.000Z');
});
