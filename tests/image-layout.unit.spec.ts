import { expect, test } from '@playwright/test';
import { resolveImageLayout } from '../src/lib/imageLayout';
import { Attachment } from '../src/lib/schema';

const image = (name: string, width?: number, height?: number): Attachment => ({
  type: 'image',
  url: `https://example.com/${name}.png`,
  alt: name,
  ...(width && height ? { intrinsicWidth: width, intrinsicHeight: height } : {}),
});

test.describe('multi-image layout resolver', () => {
  test('uses proportional finite buckets for compatible pairs', () => {
    expect(resolveImageLayout([image('square', 1000, 1000), image('portrait', 500, 1000)])).toEqual({
      layout: 'pair',
      splits: [{ bucket: '67-33', first: 67, second: 33 }],
      source: 'dimensions',
    });
  });

  test('stacks an automatic pair rather than making an unreadably narrow cell', () => {
    const plan = resolveImageLayout([image('panorama', 2400, 600), image('portrait', 600, 1200)]);
    expect(plan).toMatchObject({ layout: 'stack', source: 'dimensions' });
  });

  test('selects a balanced feature-side or feature-top composition for three images', () => {
    expect(resolveImageLayout([
      image('primary', 1000, 1000), image('second', 1000, 1000), image('third', 1000, 1000),
    ])).toMatchObject({ layout: 'hero-side', splits: [{ bucket: '67-33' }] });

    expect(resolveImageLayout([
      image('wide-primary', 1600, 900), image('second', 1000, 1000), image('third', 1000, 1000),
    ])).toMatchObject({ layout: 'hero-top', splits: [{ bucket: '50-50' }] });
  });

  test('requires both rows of a four-image grid to remain readable', () => {
    expect(resolveImageLayout([
      image('one', 1000, 1000), image('two', 500, 1000), image('three', 600, 1000), image('four', 1000, 1000),
    ])).toMatchObject({ layout: 'grid', splits: [{ bucket: '67-33' }, { bucket: '40-60' }] });

    expect(resolveImageLayout([
      image('one', 2400, 400), image('two', 400, 1200), image('three', 1000, 1000), image('four', 1000, 1000),
    ])).toMatchObject({ layout: 'stack', source: 'dimensions' });
  });

  test('keeps legacy count layouts while dimensions are missing and honors manual choices', () => {
    expect(resolveImageLayout([image('one'), image('two'), image('three')])).toMatchObject({
      layout: 'hero-side', source: 'fallback', splits: [{ bucket: '67-33' }],
    });
    expect(resolveImageLayout([image('wide', 2400, 400), image('narrow', 400, 1200)], 'pair')).toMatchObject({
      layout: 'pair', source: 'manual', splits: [{ bucket: '67-33' }],
    });
  });

  test('ignores blank image slots without changing authored order', () => {
    const blank = { ...image('blank'), url: '   ' };
    const plan = resolveImageLayout([blank, image('visible', 800, 600)]);
    expect(plan).toMatchObject({ layout: 'single' });
  });
});
