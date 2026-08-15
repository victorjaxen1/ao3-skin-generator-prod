import { expect, test } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { TEMPLATE_EXAMPLES, getExampleNames } from '../src/lib/examples';
import { ANALYTICS_TEMPLATE_IDS, analyticsPayload } from '../src/lib/analytics';

/**
 * Adding a starter example touches three lists, and forgetting one is silent.
 *
 * Both failure modes have already shipped. Five examples reached production
 * without an entry in `TEMPLATE_IDS`, so `analyticsPayload` rejected their whole
 * `template_selected` event and the newest, richest starters recorded nothing.
 * The same five had no entry in `EXAMPLE_LABELS`, so the picker rendered a
 * button reading `ios-rich-group-scene` at a visitor.
 *
 * Neither breaks a build, neither throws, and neither is visible in a diff of
 * the file being changed — which is exactly why they need a test.
 */

const ALL_EXAMPLES = Object.values(TEMPLATE_EXAMPLES).flat();

/**
 * Read the label map out of the component source.
 *
 * Importing `PlatformPicker` would drag React and the whole component graph into
 * a suite that is deliberately browser-free, and exporting the map purely for a
 * test would widen the component's API for no product reason. The map is a flat
 * literal, so reading it is both cheap and honest about what it is checking.
 */
function pickerLabelIds(): string[] {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'components', 'PlatformPicker.tsx'),
    'utf8'
  );
  const block = source.match(/const EXAMPLE_LABELS[^{]*\{([\s\S]*?)\n\};/);
  if (!block) throw new Error('EXAMPLE_LABELS not found in PlatformPicker.tsx');
  return [...block[1].matchAll(/'([^']+)'\s*:/g)].map(match => match[1]);
}

test.describe('the starter example catalog stays in step', () => {
  test('every example has a picker label, so no raw id reaches a button', () => {
    const labelled = new Set(pickerLabelIds());
    const missing = ALL_EXAMPLES.map(example => example.id).filter(id => !labelled.has(id));
    expect(missing, 'add these to EXAMPLE_LABELS in PlatformPicker.tsx').toEqual([]);
  });

  test('every example survives the analytics boundary', () => {
    const rejected = ALL_EXAMPLES
      .map(example => example.id)
      .filter(id => analyticsPayload({ name: 'template_selected', templateId: id }) === null);
    expect(rejected, 'add these to TEMPLATE_IDS in analytics.ts').toEqual([]);
    expect(ALL_EXAMPLES.every(example => ANALYTICS_TEMPLATE_IDS.has(example.id))).toBe(true);
  });

  test('no label is left over for an example that no longer exists', () => {
    const ids = new Set(ALL_EXAMPLES.map(example => example.id));
    const orphans = pickerLabelIds().filter(id => !ids.has(id));
    expect(orphans, 'these labels name examples that were deleted').toEqual([]);
  });

  test('the gallery listing agrees with the examples it lists', () => {
    for (const [platform, examples] of Object.entries(TEMPLATE_EXAMPLES)) {
      const listed = getExampleNames(platform).map(entry => entry.id);
      const actual = examples.map(example => example.id);
      expect(listed.slice().sort(), `getExampleNames('${platform}') is out of step`)
        .toEqual(actual.slice().sort());
    }
  });
});
