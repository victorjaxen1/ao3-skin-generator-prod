import { expect, test } from '@playwright/test';
import {
  ANALYTICS_CONSENT_KEY,
  analyticsPayload,
  mapUploadErrorCode,
  trackAnalytics,
  validMeasurementId,
} from '../src/lib/analytics';

test.describe('content-free analytics boundary', () => {
  test('accepts only a valid GA4 measurement id', () => {
    expect(validMeasurementId('g-abcdefgh12')).toBe('G-ABCDEFGH12');
    expect(validMeasurementId('G-not-valid')).toBe('');
    expect(validMeasurementId(undefined)).toBe('');
  });

  test('emits only fixed keys and rejects unknown template values', () => {
    expect(analyticsPayload({
      name: 'export_ready',
      outputType: 'work_skin',
      templateId: 'twitter',
      storyText: 'must not escape',
    } as never)).toEqual({ output_type: 'work_skin', template_id: 'twitter' });

    expect(analyticsPayload({
      name: 'template_selected',
      templateId: 'a user-controlled value',
    })).toBeNull();
  });

  test('maps raw upload boundary codes to the safe error union', () => {
    expect(mapUploadErrorCode('PROVIDER_TIMEOUT')).toBe('IMAGE_UPLOAD_TIMEOUT');
    expect(mapUploadErrorCode('RATE_LIMITED')).toBe('IMAGE_UPLOAD_RATE_LIMITED');
    expect(mapUploadErrorCode('some provider detail')).toBe('IMAGE_UPLOAD_PROVIDER_ERROR');
  });

  test('uses a fake window.gtag only after stored consent', () => {
    const originalWindow = (globalThis as { window?: unknown }).window;
    const calls: unknown[][] = [];
    const storage = new Map([[ANALYTICS_CONSENT_KEY, 'granted']]);
    (globalThis as { window?: unknown }).window = {
      localStorage: { getItem: (key: string) => storage.get(key) ?? null },
      __AO3SKINGEN_ANALYTICS_READY__: true,
      gtag: (...args: unknown[]) => calls.push(args),
    };
    try {
      expect(trackAnalytics({ name: 'tool_viewed', tool: 'scene_builder' })).toBe(true);
      expect(calls).toEqual([['event', 'tool_viewed', { tool: 'scene_builder' }]]);
      storage.set(ANALYTICS_CONSENT_KEY, 'denied');
      expect(trackAnalytics({ name: 'tool_viewed', tool: 'scene_builder' })).toBe(false);
      expect(calls).toHaveLength(1);
    } finally {
      (globalThis as { window?: unknown }).window = originalWindow;
    }
  });
});
