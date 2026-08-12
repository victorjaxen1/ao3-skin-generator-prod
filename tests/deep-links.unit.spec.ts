import { expect, test } from '@playwright/test';
import { parseBlankPlatform } from '../src/lib/deepLinks';

test.describe('blank platform deep links', () => {
  for (const platform of ['ios', 'android', 'twitter', 'google'] as const) {
    test(`accepts ${platform}`, () => {
      expect(parseBlankPlatform(platform)).toBe(platform);
    });
  }

  test('uses the first query value', () => {
    expect(parseBlankPlatform(['twitter', 'ios'])).toBe('twitter');
  });

  test('rejects missing, invalid, and stale values', () => {
    expect(parseBlankPlatform(undefined)).toBeNull();
    expect(parseBlankPlatform('whatsapp')).toBeNull();
    expect(parseBlankPlatform('twitter-character-thread')).toBeNull();
  });
});
