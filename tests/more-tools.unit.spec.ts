import { expect, test } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { analyticsPayload } from '../src/lib/analytics';
import { productDestination, type MoreToolsPlacement, type MoreToolsVariant } from '../src/components/MoreTools';
import { defaultProject } from '../src/lib/schema';
import { buildHTML, buildCSS } from '../src/lib/generator';
import { buildWorkSkin, buildMasterWorkSkin } from '../src/lib/workSkin';
import { compile } from '../src/lib/siteSkin/compile';
import { TEMPLATES } from '../src/lib/siteSkin/templates';

/**
 * Section 2 is the rule this file exists to enforce: no commercial string may
 * travel into anything an author pastes into AO3. Section 11.6 Tier 2 adds a
 * product surface to the application for the first time, so the boundary now
 * needs a test rather than a convention.
 */

const COMMERCIAL_MARKERS = [
  'wordfokus.com',
  'worldkonstruct',
  'WordFokus',
  'WorldKonstruct',
  'ko-fi',
  'Ko-fi',
];

function assertClean(label: string, output: string) {
  const found = COMMERCIAL_MARKERS.filter(marker => output.includes(marker));
  expect(found, `${label} must contain no commercial reference`).toEqual([]);
}

test.describe('no commercial content reaches AO3-bound output', () => {
  test('generated scene markup and stylesheet are clean', () => {
    const project = defaultProject();
    assertClean('buildHTML', buildHTML(project));
    assertClean('buildCSS', buildCSS(project));
  });

  test('the single-platform work skin is clean', () => {
    const project = defaultProject();
    const skin = buildWorkSkin(project);
    assertClean('buildWorkSkin', typeof skin === 'string' ? skin : JSON.stringify(skin));
  });

  test('the master work skin is clean, including with credit switched on', () => {
    const project = defaultProject();
    const off = buildMasterWorkSkin(project);
    assertClean('buildMasterWorkSkin', typeof off === 'string' ? off : JSON.stringify(off));

    // Optional tool attribution is the one credit Section 2.2 permits, and it
    // must stay a neutral tool name — never a link to a commercial destination.
    const credited = buildMasterWorkSkin({
      ...project,
      settings: { ...project.settings, toolAttribution: true },
    });
    assertClean('buildMasterWorkSkin (attribution on)', typeof credited === 'string' ? credited : JSON.stringify(credited));
  });

  test('every site-skin template compiles clean', () => {
    for (const theme of TEMPLATES) {
      assertClean(`site skin ${theme.meta.id}`, compile(theme));
    }
  });
});

test.describe('the product surface stays where it belongs', () => {
  /**
   * MoreTools is the only module allowed to hold a commercial **destination**.
   *
   * The check is deliberately for a linkable URL rather than for the words
   * themselves. Two legitimate non-destination uses exist and must keep
   * working: `analytics.ts` enumerates `'worldkonstruct' | 'wordfokus'` as event
   * *values*, which is what makes the click countable without a URL ever
   * leaving that module, and `urlNormalize.ts` credits a WorldKonstruct
   * reference document in a comment. Neither is clickable and neither can reach
   * output, so a word-match here would fail on correct code and train the next
   * developer to delete the assertion.
   */
  test('only MoreTools holds a commercial destination URL in src/', () => {
    const root = path.join(__dirname, '..', 'src');
    /**
     * Anchored to the commercial hosts, because AO3 SkinGen's own domains sit
     * under `wordfokus.com` too. `app.ao3skingen.wordfokus.com`,
     * `ao3skingen.wordfokus.com` and the Section 2.2 neutral credit page
     * `www.wordfokus.com/ao3skingen/made-with/` are the product itself and must
     * keep passing; `app.wordfokus.com`, anything naming WorldKonstruct, and
     * Ko-fi are the destinations this test is actually about.
     */
    const DESTINATION = /https?:\/\/(app\.wordfokus\.com|[^\s'"`)]*ko-fi\.com|[^\s'"`)]*worldkonstruct)/i;
    const offenders: string[] = [];

    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { walk(full); continue; }
        if (!/\.(ts|tsx)$/.test(entry.name)) continue;
        const rel = path.relative(root, full).replace(/\\/g, '/');
        if (rel === 'components/MoreTools.tsx') continue;
        if (DESTINATION.test(fs.readFileSync(full, 'utf8'))) offenders.push(rel);
      }
    };
    walk(root);

    expect(offenders, 'a commercial destination URL escaped MoreTools.tsx').toEqual([]);
  });

  test('every passive placement survives the analytics boundary with its fixed variant', () => {
    const placements: Array<[MoreToolsPlacement, MoreToolsVariant]> = [
      ['platform_picker_compact', 'compact'],
      ['platform_picker_shelf', 'shelf'],
      ['site_skin_gallery_shelf', 'shelf'],
      ['workspace_settings', 'settings'],
    ];
    for (const [placement, variant] of placements) {
      for (const product of ['wordfokus', 'worldkonstruct'] as const) {
        expect(
          analyticsPayload({ name: 'product_cta_clicked', product, placement, variant }),
          `${product} @ ${placement} must not be rejected`
        ).toEqual({ product, placement, variant });
        expect(
          analyticsPayload({ name: 'product_promo_viewed', product, placement, variant })
        ).toEqual({ product, placement, variant });
      }
    }
  });

  test('unenumerated promotion values are rejected whole', () => {
    expect(analyticsPayload({
      name: 'product_cta_clicked',
      product: 'wordfokus',
      placement: 'message_timeline',
      variant: 'shelf',
    } as never)).toBeNull();
    expect(analyticsPayload({
      name: 'product_promo_viewed',
      product: 'unknown',
      placement: 'workspace_settings',
      variant: 'settings',
    } as never)).toBeNull();
    expect(analyticsPayload({
      name: 'product_promo_viewed',
      product: 'wordfokus',
      placement: 'workspace_settings',
      variant: 'banner',
    } as never)).toBeNull();
  });

  test('destinations carry only the fixed cross-sell campaign values', () => {
    for (const placement of [
      'platform_picker_compact',
      'platform_picker_shelf',
      'site_skin_gallery_shelf',
      'workspace_settings',
      'hosted_image_success',
      'work_skin_success',
    ] as const) {
      for (const product of ['wordfokus', 'worldkonstruct'] as const) {
        const url = new URL(productDestination(product, placement));
        expect(url.searchParams.get('utm_source')).toBe('ao3skingen');
        expect(url.searchParams.get('utm_medium')).toBe('referral');
        expect(url.searchParams.get('utm_campaign')).toBe('writer_toolkit');
        expect(url.searchParams.get('utm_content')).toBe(placement);
        expect([...url.searchParams.keys()]).toEqual(['utm_source', 'utm_medium', 'utm_campaign', 'utm_content']);
      }
    }
  });

  test('shelf cards expose a visible CTA, disclosure, and safe new-tab links', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'MoreTools.tsx'), 'utf8');
    expect(source).toContain("cta: 'Try WordFokus free'");
    expect(source).toContain("cta: 'Try WorldKonstruct free'");
    expect(source).toContain('not required for AO3 SkinGen');
    expect(source).toContain('target="_blank"');
    expect(source).toContain('rel="noopener noreferrer"');
  });
});
