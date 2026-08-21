import { expect, test } from '@playwright/test';
import {
  CONTEXTUAL_PRODUCT_PROMOTIONS_ENABLED,
  PRODUCT_PROMO_STORAGE_KEY,
  eligibleContextualProduct,
  eligibleContextualProductWhenEnabled,
  emptyProductPromoState,
  markContextualShown,
  readProductPromoState,
  recordProductClick,
  recordSceneHandoff,
  resetProductPromotionSession,
  suppressProduct,
} from '../src/lib/productPromotion';

type FakeWindow = { localStorage: { getItem: (key: string) => string | null; setItem: (key: string, value: string) => void } };

function withStorage(run: (storage: Map<string, string>) => void, refuse = false): void {
  const originalWindow = (globalThis as { window?: unknown }).window;
  const storage = new Map<string, string>();
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (key: string) => {
        if (refuse) throw new Error('storage refused');
        return storage.get(key) ?? null;
      },
      setItem: (key: string, value: string) => {
        if (refuse) throw new Error('storage refused');
        storage.set(key, value);
      },
    },
  } satisfies FakeWindow;
  resetProductPromotionSession();
  try { run(storage); } finally {
    resetProductPromotionSession();
    (globalThis as { window?: unknown }).window = originalWindow;
  }
}

test('first session-deduplicated handoff selects WordFokus', () => withStorage(() => {
  recordSceneHandoff(new Date('2026-08-20T12:00:00.000Z'));
  recordSceneHandoff(new Date('2026-08-20T13:00:00.000Z'));
  expect(readProductPromoState().sceneHandoffCount).toBe(1);
  expect(readProductPromoState().activeDays).toEqual(['2026-08-20']);
  expect(eligibleContextualProductWhenEnabled(new Date('2026-08-20T13:00:00.000Z'))).toBe('wordfokus');
}));

test('two stored handoffs on one active day still select WordFokus', () => withStorage(storage => {
  storage.set(PRODUCT_PROMO_STORAGE_KEY, JSON.stringify({
    ...emptyProductPromoState(), sceneHandoffCount: 2, activeDays: ['2026-08-20'],
  }));
  expect(eligibleContextualProductWhenEnabled(new Date('2026-08-20T13:00:00.000Z'))).toBe('wordfokus');
}));

test('two handoffs across two days select WorldKonstruct', () => withStorage(storage => {
  storage.set(PRODUCT_PROMO_STORAGE_KEY, JSON.stringify({
    ...emptyProductPromoState(), sceneHandoffCount: 2, activeDays: ['2026-08-19', '2026-08-20'],
  }));
  expect(eligibleContextualProductWhenEnabled(new Date('2026-08-20T13:00:00.000Z'))).toBe('worldkonstruct');
}));

test('the 14-day impression cap is closed before and open at the boundary', () => {
  for (const [days, expected] of [[13, null], [14, 'wordfokus']] as const) withStorage(storage => {
    const now = new Date('2026-08-20T12:00:00.000Z');
    storage.set(PRODUCT_PROMO_STORAGE_KEY, JSON.stringify({
      ...emptyProductPromoState(),
      sceneHandoffCount: 1,
      activeDays: ['2026-08-20'],
      lastContextualShownAt: { wordfokus: new Date(now.getTime() - days * 86_400_000).toISOString() },
    }));
    expect(eligibleContextualProductWhenEnabled(now)).toBe(expected);
  });
});

test('Not for me suppresses for 180 days at the exact boundary', () => withStorage(() => {
  const now = new Date('2026-08-20T12:00:00.000Z');
  suppressProduct('wordfokus', now);
  expect(eligibleContextualProductWhenEnabled(new Date(now.getTime() + 179 * 86_400_000))).toBeNull();
  expect(eligibleContextualProductWhenEnabled(new Date(now.getTime() + 180 * 86_400_000))).toBe('wordfokus');
}));

test('a click suppresses for 30 days and records no destination or content', () => withStorage(() => {
  const now = new Date('2026-08-20T12:00:00.000Z');
  recordProductClick('wordfokus', now);
  const state = readProductPromoState();
  expect(state.clickedAt.wordfokus).toBe(now.toISOString());
  expect(state.suppressedUntil.wordfokus).toBe('2026-09-19T12:00:00.000Z');
  expect(JSON.stringify(state)).not.toContain('http');
  expect(eligibleContextualProductWhenEnabled(new Date('2026-09-19T12:00:00.000Z'))).toBeNull();
}));

test('a qualified contextual impression blocks the whole browser session', () => withStorage(() => {
  markContextualShown('wordfokus', new Date('2026-08-20T12:00:00.000Z'));
  expect(eligibleContextualProductWhenEnabled(new Date('2026-09-20T12:00:00.000Z'))).toBeNull();
}));

test('corrupt and oversized persisted state resets safely', () => {
  for (const invalid of [
    '{bad json',
    JSON.stringify({ ...emptyProductPromoState(), sceneHandoffCount: 1001 }),
    JSON.stringify({ ...emptyProductPromoState(), activeDays: Array.from({ length: 11 }, (_, index) => `2026-08-${String(index + 1).padStart(2, '0')}`) }),
    'x'.repeat(20_001),
  ]) withStorage(storage => {
    storage.set(PRODUCT_PROMO_STORAGE_KEY, invalid);
    expect(readProductPromoState()).toEqual(emptyProductPromoState());
    expect(JSON.parse(storage.get(PRODUCT_PROMO_STORAGE_KEY) || '')).toEqual(emptyProductPromoState());
    expect(eligibleContextualProductWhenEnabled()).toBeNull();
  });
});

test('storage refusal falls back to session memory', () => withStorage(() => {
  recordSceneHandoff(new Date('2026-08-20T12:00:00.000Z'));
  expect(readProductPromoState().sceneHandoffCount).toBe(1);
  expect(eligibleContextualProductWhenEnabled(new Date('2026-08-20T12:00:00.000Z'))).toBe('wordfokus');
}, true));

test('the Release 1 build switch suppresses contextual recommendations', () => withStorage(() => {
  recordSceneHandoff(new Date('2026-08-20T12:00:00.000Z'));
  expect(CONTEXTUAL_PRODUCT_PROMOTIONS_ENABLED).toBe(false);
  expect(eligibleContextualProduct(new Date('2026-08-20T13:00:00.000Z'))).toBeNull();
  expect(eligibleContextualProductWhenEnabled(new Date('2026-08-20T13:00:00.000Z'))).toBe('wordfokus');
}));
