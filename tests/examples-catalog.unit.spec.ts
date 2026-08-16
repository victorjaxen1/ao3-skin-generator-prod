import { expect, test } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { TEMPLATE_EXAMPLES, getExampleNames } from '../src/lib/examples';
import { ANALYTICS_TEMPLATE_IDS, analyticsPayload } from '../src/lib/analytics';
import { TEMPLATES } from '../src/lib/siteSkin/templates';

/**
 * Adding a starter example touches four lists, and forgetting one is silent.
 *
 * Three failure modes have already shipped. Five examples reached production
 * without an entry in `TEMPLATE_IDS`, so `analyticsPayload` rejected their whole
 * `template_selected` event and the newest, richest starters recorded nothing.
 * The same five had no entry in `EXAMPLE_LABELS`, so the picker rendered a
 * button reading `ios-rich-group-scene` at a visitor. And the same five were
 * absent from `public/examples-gallery.html`, so the one public page that can
 * rank for "ao3 work skin examples" advertised a product two platform rebuilds
 * out of date.
 *
 * None breaks a build, none throws, and none is visible in a diff of the file
 * being changed — which is exactly why they need a test.
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

/**
 * Read the gallery's deep links out of the published HTML.
 *
 * The gallery is a hand-written page, not a generated one, so the honest thing
 * to check is the artefact a visitor actually receives. Scene examples open the
 * app root, site skins open `/site-skin`; the two are separated by route so a
 * card cannot satisfy the wrong list.
 */
function galleryLinks(): { scene: string[]; siteSkin: string[] } {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'public', 'examples-gallery.html'),
    'utf8'
  );
  const scene: string[] = [];
  const siteSkin: string[] = [];
  for (const match of source.matchAll(/href="[^"]*?(\/site-skin)?\?template=([a-z0-9-]+)"/g)) {
    (match[1] ? siteSkin : scene).push(match[2]);
  }
  return { scene, siteSkin };
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

  test('every example has a card on the public examples gallery', () => {
    const linked = new Set(galleryLinks().scene);
    const missing = ALL_EXAMPLES.map(example => example.id).filter(id => !linked.has(id));
    expect(missing, 'add a card for these to public/examples-gallery.html').toEqual([]);
  });

  test('no gallery card deep-links to an example that no longer exists', () => {
    const ids = new Set(ALL_EXAMPLES.map(example => example.id));
    const orphans = galleryLinks().scene.filter(id => !ids.has(id));
    expect(orphans, 'these gallery cards open a template the app will not find').toEqual([]);
  });

  test('every site-skin template has a gallery card, and none is stale', () => {
    const ids = TEMPLATES.map(template => template.meta.id);
    const linked = galleryLinks().siteSkin;
    expect(ids.filter(id => !linked.includes(id)), 'missing from the gallery').toEqual([]);
    expect(linked.filter(id => !ids.includes(id)), 'gallery names a deleted template').toEqual([]);
  });

  test('a gallery card links each example exactly once', () => {
    const counts = new Map<string, number>();
    for (const id of galleryLinks().scene) counts.set(id, (counts.get(id) || 0) + 1);
    const duplicated = [...counts.entries()].filter(([, count]) => count > 1).map(([id]) => id);
    expect(duplicated, 'two cards open the same example').toEqual([]);
  });
});
